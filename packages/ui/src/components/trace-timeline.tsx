'use client';
import {
  createContext, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type CSSProperties, type FocusEvent, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref,
} from 'react';
import { cva } from 'class-variance-authority';
import { announce, isRTL } from '@ui-sdk/core';
import { usePart, usePrimitive } from '@ui-sdk/react/primitive';
import { useAppearance } from '@/lib/theme';
import {
  traceTimeline,
  type TraceFocusedLaneChangeDetails, type TraceSeek, type TraceSelectedRequestChangeDetails, type TraceSelectedThreadChangeDetails, type TraceTimelineGestures,
  type TraceTimelineOptions, type TraceValueChangeDetails, type TraceValueCommitDetails, type TraceViewChangeDetails, type TraceViewChangeReason,
} from '@/lib/trace-timeline-primitive';
import { cn } from '@/lib/utils';
import { bindRowInset, waveCard, waveDash, waveDashLength, waveDashTone } from '@/lib/wave-rail';
import {
  TRACE_GUTTER, TRACE_MIN_SPAN, TRACE_RULER, TRACE_SCRUB_SPEEDS, TRACE_SNAP_REACH,
  adjacentStop, chooseTicks, clampView, formatTraceTime, layoutRail, layoutStrip, linearAxis, moveScrub, nearestMark, panWindow, pinchWindow, pixelEdges, placeRailCard, placeStripCard,
  railDashInset, requestAt, rescaleScrub, resolutionAt, rowAt, sameLanes, scrubPosition, selectStops, startScrub, stopsByTime, stripHeight, traceSwell, viewWindow, windowView, zoomWindow,
  type TraceActivity, type TraceAxis, type TraceKey, type TraceLane, type TraceRange, type TraceRequest, type TraceRow, type TraceScrub, type TraceStop, type TraceStopMark, type TraceTone, type TraceWindow,
} from '@/lib/trace-timeline-model';
import {
  TraceBuffers, drawTraceData, drawTraceOverlay, groupRequests, toneColor,
  type TraceColors, type TraceFrame, type TraceLaneActivity,
} from '@/lib/trace-timeline-draw';

/* ══ TraceTimeline — a long session on one clock, in a strip or a rail ══
   One model and two orientations. `horizontal` is the strip: a ruler, rows of diamonds, density with marks over it,
   thread activity and requests, several lanes on a shared clock. `vertical` is the rail for narrow windows: a tall thin
   overlay on the window's edge, like IndexBar's wave, with each lane a thin column and landmarks (`stops`) as dashes that
   swell around the pointer. They share the data, the axis, the view and the drawing code (a canvas transform swaps x and
   y), so a host swaps `orientation` when its width crosses a threshold and nothing is lost:

     <TraceTimeline range={range} lanes={lanes} stops={stops} value={t} onValueChange={setT}
       orientation={narrow ? 'vertical' : 'horizontal'} side="end" className={narrow ? 'inset-y-2' : undefined} />

   Marks go on a canvas, at most one thing per device pixel per row, found by binary search over sorted arrays, so an hour
   with hundreds of thousands of marks costs what the pixels cost. Colours are the theme's tokens, read from its CSS
   variables and read again when the theme changes. Press or drag to seek; on a rail, pull away from it to slow the scrub,
   and press Escape to put the playhead back. Wheel and pinch zoom around the pointer. The root is a `slider` (the
   trace-timeline primitive: its value, keys and the scrub, on UI SDK's `bindDrag`), with the keyboard that implies,
   plus keys that pick what a press picks: Alt+↑/↓ a lane, [ and ] a request, { and } a thread. A rail shares its wave,
   card and row inset with IndexBar's `wave` variant (lib/wave-rail). ══ */

export const traceTimelineVariants = cva('font-sans touch-none select-none', {
  variants: {
    orientation: {
      // The focus outline is drawn over the canvases, inset, and follows the host's corners (a strip in a card).
      horizontal: 'relative block h-(--tt-height) w-full cursor-crosshair rounded-[inherit] bg-background -outline-offset-2 [outline:2px_solid_transparent] focus-visible:[outline:2px_solid_var(--primary)]',
      // A rail fills its positioned parent's height, 44px wide: move or size it with classes (`inset-y-2`, `w-14`).
      vertical: 'absolute top-0 bottom-0 z-80 w-11 cursor-pointer rounded-lg -outline-offset-2 [outline:2px_solid_transparent] focus-visible:[outline:2px_solid_var(--primary)]',
    },
    side: { end: '', start: '' },
  },
  compoundVariants: [
    { orientation: 'vertical', side: 'end', className: 'end-0' },
    { orientation: 'vertical', side: 'start', className: 'start-0' },
  ],
  defaultVariants: { orientation: 'horizontal', side: 'end' },
});

export type {
  TraceFocusedLaneChangeDetails, TracePickReason, TraceSelectedRequestChangeDetails, TraceSelectedThreadChangeDetails, TraceValueChangeDetails,
  TraceValueChangeReason, TraceValueCommitDetails, TraceViewChangeDetails, TraceViewChangeReason,
} from '@/lib/trace-timeline-primitive';

/** What a redraw took: `data` is the rows, when the view or the data changed; `overlay` is the playhead and hover line. */
export interface TraceDrawStats {
  layer: 'data' | 'overlay';
  ms: number;
  columns: number;
}

export interface TraceTimelineHandle {
  /** Shows the whole range. */
  fit(): void;
  /** Shows a stretch of time (reports it through `onViewChange`, as `imperative`). */
  setView(view: TraceRange): void;
  /** The time at each CSS pixel of the plot: the times a drag can land on, worth reading ahead. */
  pixelTimes(): number[];
  /** Draws everything again. */
  redraw(): void;
  focus(): void;
}

export interface TraceTimelinePreviewProps<K extends TraceKey = TraceKey> {
  /** Lines of a stop's `preview` the card shows. Default 2. */
  lines?: number;
  /** The card's widest, in px. Default 260. */
  width?: number;
  /** A slot at the top of the card, for a thumbnail of that moment; with it, a strip shows the card wherever you hover. */
  children?: (time: number, stop: TraceStop<K> | null) => ReactNode;
}

/** What the card beside the pointer shows and where, from the root, for the part that draws it. */
interface CardState<K extends TraceKey> {
  show: boolean;
  spot: Spot<K> | null;
  stop: TraceStop<K> | null;
  title: string;
  /** The stop's time, and how many more are in its cluster. */
  meta: string | null;
  speed: number | null;
  vertical: boolean;
  side: 'start' | 'end';
  /** Its place: `--tt-card-x` / `--tt-card-y`. */
  style: CSSProperties | undefined;
  /** The widest it can be beside the rail, in px. */
  room: number;
  ref: Ref<HTMLDivElement>;
}

interface CardContextValue {
  card: CardState<TraceKey>;
  /** A TraceTimelinePreview says it's there (and whether it has a slot of its own); returns its leaving. */
  register: (slot: boolean) => () => void;
}

const CardContext = createContext<CardContextValue | null>(null);

/** The card: a stop's title, time and preview, or the time under the pointer; a slot of the host's on top. */
function TraceCard<K extends TraceKey>({ card, lines, width, slot }: { card: CardState<K>; lines: number; width: number; slot?: TraceTimelinePreviewProps<K>['children'] }) {
  const { show, spot, stop } = card;
  if (!show || !spot) return null;
  return (
    <div
      ref={card.ref}
      data-slot="trace-timeline-card"
      data-speed={card.speed ?? undefined}
      style={{ ...card.style, '--tt-lines': lines, '--tt-card-w': `${Math.min(width, card.room)}px` } as CSSProperties}
      className={cn(
        'pointer-events-none absolute top-(--tt-card-y) z-10 box-border w-max max-w-(--tt-card-w) min-w-[160px] px-[13px] py-[9px] motion-reduce:transition-none',
        waveCard,
        card.vertical
          ? cn(
            'transition-[top,inset-inline-start,inset-inline-end] duration-spring-snappy ease-spring-snappy',
            // It grows out of the rail: from the inner side's edge.
            card.side === 'start' ? 'start-(--tt-card-x) origin-left rtl:origin-right' : 'end-(--tt-card-x) origin-right rtl:origin-left',
          )
          : 'left-(--tt-card-x) origin-bottom',
      )}
    >
      {slot ? <div data-slot="trace-timeline-preview" className="mb-[6px] empty:hidden">{slot(spot.time, stop)}</div> : null}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 truncate text-footnote leading-[18px] font-semibold text-foreground">{card.title}</div>
        {stop?.trailing}
      </div>
      {card.meta != null ? <div className="text-caption leading-[16px] text-muted-foreground tabular-nums">{card.meta}</div> : null}
      {stop?.preview != null
        ? <div className="mt-[2px] line-clamp-(--tt-lines) text-caption leading-[16px] text-pretty text-muted-foreground">{stop.preview}</div>
        : null}
      {spot.lane ? <div className="text-caption leading-[16px] text-muted-foreground">{spot.lane}</div> : null}
      {card.speed != null ? (
        <div data-slot="trace-timeline-speed" className="mt-[3px] text-caption leading-[16px] font-medium text-primary">
          {TRACE_SCRUB_SPEEDS[card.speed].label}{card.speed === 0 ? ' · pull away to slow' : ''}
        </div>
      ) : null}
    </div>
  );
}

/** The card beside the pointer, drawn where it's placed inside a TraceTimeline (which places it beside the rail or over
 *  the strip): a stop's title, time and preview, with a slot of your own on top. Without one, the timeline draws the
 *  card itself with two lines of preview. */
export function TraceTimelinePreview<K extends TraceKey = TraceKey>({ lines = 2, width = 260, children }: TraceTimelinePreviewProps<K>) {
  const context = useContext(CardContext);
  const register = context?.register;
  const slot = !!children;
  useLayoutEffect(() => register?.(slot), [register, slot]);
  if (!context) throw new Error('TraceTimelinePreview must be inside a TraceTimeline');
  return <TraceCard<K> card={context.card as CardState<K>} lines={lines} width={width} slot={children} />;
}

export type TraceFetchActivity = (laneKey: string, edges: Float64Array, signal: AbortSignal) => Promise<readonly TraceActivity[]> | readonly TraceActivity[];

export interface TraceTimelineProps<K extends TraceKey = TraceKey> extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue'> {
  /** A `TraceTimelinePreview`, for a card of your own: more lines, a wider card, a thumbnail on top. */
  children?: ReactNode;
  /** The whole timeline, on the shared clock. */
  range: TraceRange;
  /** Turns times into positions. Default: `linearAxis(range)`. */
  axis?: TraceAxis;
  lanes?: TraceLane[];
  /** Keep this array stable between renders. */
  requests?: TraceRequest[];
  /** Landmarks: dashes on the rail, a row on the strip, and what PageUp and PageDown go to. Keep this array stable. */
  stops?: Array<TraceStop<K>>;
  /** The playhead. */
  value?: number;
  defaultValue?: number;
  /** As the playhead moves: `details.reason` is `track-press` on a press, `drag` at most once a frame while dragging,
   *  `step-key` for a key, `escape-key` when Escape puts a scrub back; `details.stop` is the stop it snapped to. */
  onValueChange?: (time: number, details: TraceValueChangeDetails<K>) => void;
  /** Once a press, a drag or a key is done, with where the playhead ended. */
  onValueCommit?: (time: number, details: TraceValueCommitDetails<K>) => void;
  /** The stretch of time on show. Hold it to keep the zoom through a remount. */
  view?: TraceRange;
  defaultView?: TraceRange;
  /** As the view moves: `details.reason` is `wheel`, `pinch`, `zoom-key`, `double-press`, `drag` (a scrub past the edge),
   *  `playhead` (the playhead left it), `range-change` or `imperative`. `details.cancel()` keeps the view. */
  onViewChange?: (view: TraceRange, details: TraceViewChangeDetails) => void;
  /** `horizontal` is the strip, `vertical` the rail. */
  orientation?: 'horizontal' | 'vertical';
  /** Rail: the edge it sits on, `end` (default) or `start`, as IndexBar's. Its stops and card are on the inner side.
   *  Place and size the rail itself with classes (`inset-y-2`, `w-14`): it fills its positioned parent's height and is
   *  44px wide. */
  side?: 'start' | 'end';
  /** Rail: publish how far list rows run under it as `--bl-index-bar-inset` on its parent, as IndexBar does, so ListRows
   *  beside it keep their trailing accessories clear of it (`end` side only). Default true. */
  insetContent?: boolean;
  /** The lane in focus (a single lane always is). A press on a lane's row focuses it (`item-press`), and so does
   *  Alt+↑ / Alt+↓ (`list-navigation`). */
  focusedLane?: string | null;
  defaultFocusedLane?: string | null;
  onFocusedLaneChange?: (lane: string, details: TraceFocusedLaneChangeDetails) => void;
  /** The selected thread, in the focused lane. A press on a thread's row selects it, and `{` / `}` step through the
   *  focused lane's threads; `details.lane` is its lane. */
  selectedThread?: TraceKey | null;
  defaultSelectedThread?: TraceKey | null;
  onSelectedThreadChange?: (thread: TraceKey | null, details: TraceSelectedThreadChangeDetails) => void;
  /** The selected request. A press on one selects it, and `[` / `]` select the one before or after it (or the
   *  playhead) and move the playhead to it. */
  selectedRequest?: TraceKey | null;
  defaultSelectedRequest?: TraceKey | null;
  onSelectedRequestChange?: (request: TraceKey | null, details: TraceSelectedRequestChangeDetails) => void;
  /** Thread activity for the current view: one call per lane with bucket edges in that lane's own time, debounced as the
   *  view moves, with stale answers dropped and `signal` aborted. Answer with a count per bucket per thread. */
  fetchActivity?: TraceFetchActivity;
  /** How long the view has to stay put before `fetchActivity` runs, in ms. Default 60. */
  activityDebounce?: number;
  /** What an arrow key moves the playhead by, in time. Default: a pixel's worth. Shift is ten times that. */
  step?: number;
  /** The shortest stretch of time the view can show. */
  minSpan?: number;
  /** Prints a time, given how far apart the times worth telling apart are. Default: `formatTraceTime`. */
  formatTime?: (time: number, resolution: number) => string;
  /** Strip: the width of the label gutter, px (default 84, which fits a word like "Checkpoints"); 0 for none. */
  gutter?: number;
  /** Strip: the gutter's label for the requests row and the stops row. */
  requestsLabel?: string;
  stopsLabel?: string;
  /** The slider's accessible name. Default "Timeline"; or name it with `aria-labelledby`. */
  'aria-label'?: string;
  /** Called after each canvas redraw, with what it took. */
  onDraw?: (stats: TraceDrawStats) => void;
  ref?: Ref<TraceTimelineHandle>;
}

const NO_LANES: TraceLane[] = [];
const NO_REQUESTS: TraceRequest[] = [];
const NO_STOPS: never[] = [];
const NO_MARKS: never[] = [];

/** The utilities the canvas's colours are read from, hidden in the DOM, so they resolve through the same variables and
 *  fallbacks as everything else in the theme. */
const TOKENS = {
  foreground: 'text-foreground',
  muted: 'text-muted-foreground',
  faint: 'text-tertiary-foreground',
  border: 'text-border',
  primary: 'text-primary',
  background: 'text-background',
  surface: 'text-muted',
  ruler: 'text-secondary',
  card: 'text-card',
  warning: 'text-warning',
  success: 'text-success',
  destructive: 'text-destructive',
  chart1: 'text-chart-1',
  chart2: 'text-chart-2',
  chart3: 'text-chart-3',
  chart4: 'text-chart-4',
  chart5: 'text-chart-5',
} as const;
type TokenName = keyof typeof TOKENS;
const TOKEN_NAMES = Object.keys(TOKENS) as TokenName[];

const TONE_DASH: Record<Exclude<TraceTone, 'default'>, string> = {
  muted: 'bg-tertiary-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

function readTokens(holder: HTMLElement): Record<TokenName, string> {
  const out = {} as Record<TokenName, string>;
  for (const el of Array.from(holder.children)) {
    const name = (el as HTMLElement).dataset.token as TokenName | undefined;
    if (name) out[name] = getComputedStyle(el).color;
  }
  return out;
}

function toColors(t: Record<TokenName, string>): TraceColors {
  return {
    foreground: t.foreground, muted: t.muted, faint: t.faint, border: t.border, primary: t.primary, background: t.background,
    surface: t.surface, ruler: t.ruler, card: t.card, warning: t.warning, success: t.success, destructive: t.destructive,
    chart: [t.chart1, t.chart2, t.chart3, t.chart4, t.chart5],
  };
}

/** The theme's colours, for a canvas: read now, again when the kit's appearance changes (`useAppearance`: an
 *  AppearanceProvider, or the `dark` class on <html>), and again when an ancestor's class or style changes, which is how
 *  a ThemeScope's own `appearance`, palette or tint reaches what's under it. */
function useThemeColors(root: React.RefObject<HTMLElement | null>, holder: React.RefObject<HTMLElement | null>) {
  const [theme, setTheme] = useState<{ colors: TraceColors; font: string; signature: string } | null>(null);
  const appearance = useAppearance();
  useLayoutEffect(() => {
    const el = root.current;
    const tokens = holder.current;
    if (!el || !tokens || typeof getComputedStyle === 'undefined') return undefined;
    const read = () => {
      const values = readTokens(tokens);
      const font = `11px ${getComputedStyle(el).fontFamily || 'sans-serif'}`;
      const signature = JSON.stringify(values) + font;
      setTheme((prev) => (prev?.signature === signature ? prev : { colors: toColors(values), font, signature }));
    };
    read();
    let raf = 0;
    const soon = () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; read(); });
    };
    let mo: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(soon);
      for (let up = el.parentElement; up; up = up.parentElement) mo.observe(up, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-theme-scope'] });
    }
    // Labels drawn before a web font landed need drawing again once it has.
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    const fontsLoaded = () => setTheme((prev) => (prev ? { ...prev } : prev));
    fonts?.addEventListener?.('loadingdone', fontsLoaded);
    return () => {
      cancelAnimationFrame(raf);
      mo?.disconnect();
      fonts?.removeEventListener?.('loadingdone', fontsLoaded);
    };
  }, [root, holder, appearance]);
  return theme;
}

interface Spot<K extends TraceKey> {
  /** Px along the plot, where the card and the swell go. */
  along: number;
  /** How far the pointer is past the rail's inner edge. */
  pull: number;
  time: number;
  mark: TraceStopMark<K> | null;
  /** A scrub's speed. */
  tier?: number;
  /** The title of the rail column under the pointer: a column has no label of its own. */
  lane?: string;
}

/** What the pointers are doing, as far as drawing goes; the primitive follows them. */
type Gesture =
  | { kind: 'idle' }
  | { kind: 'pinch'; win: TraceWindow; separation: number; mid: number }
  | { kind: 'scrub'; s: TraceScrub; along: number; pull: number; last: number; snap: boolean; travel: number; pressAlong: number; pressAcross: number };

/** How long a key's preview card stays, in ms. */
const PEEK_MS = 1500;
/** Two presses this close, in ms and px, are a double press. */
const DOUBLE_MS = 350;
const DOUBLE_PX = 12;
/** A key press zooms by this much. */
const KEY_ZOOM = 2;
/** Activity is fetched at one bucket per this many px. */
const ACTIVITY_PX = 2;

export function TraceTimeline<K extends TraceKey = TraceKey>({
  range, axis: axisProp, lanes: lanesProp = NO_LANES, requests = NO_REQUESTS, stops = NO_STOPS as Array<TraceStop<K>>,
  value, defaultValue, onValueChange, onValueCommit, view: viewProp, defaultView, onViewChange,
  orientation = 'horizontal', side = 'end', insetContent = true, children,
  focusedLane, defaultFocusedLane, onFocusedLaneChange, selectedThread, defaultSelectedThread, onSelectedThreadChange,
  selectedRequest, defaultSelectedRequest, onSelectedRequestChange,
  fetchActivity, activityDebounce = 60, step, minSpan = TRACE_MIN_SPAN, formatTime = formatTraceTime,
  gutter = TRACE_GUTTER, requestsLabel = 'Requests', stopsLabel = 'Stops',
  'aria-label': ariaLabel, onDraw, ref, className, style, onBlur, onPointerMove, onPointerLeave, ...rest
}: TraceTimelineProps<K>) {
  const vertical = orientation === 'vertical';
  const rootRef = useRef<HTMLDivElement>(null);
  // The edge a rail is on, on the page: `side` in the root's text direction, for the canvas and the pointer's maths.
  const [rtl, setRtl] = useState(false);
  // Read once a rail is on the page: the text direction of a page or panel doesn't change under a mounted timeline.
  useLayoutEffect(() => {
    if (rootRef.current && vertical) setRtl(isRTL(rootRef.current));
  }, [vertical]);
  const edge: 'left' | 'right' = (side === 'end') !== rtl ? 'right' : 'left';
  // A TraceTimelinePreview among the children draws the card; without one the root does.
  const [previewPart, setPreviewPart] = useState<{ slot: boolean } | null>(null);
  const registerPreview = useCallback((slot: boolean) => {
    setPreviewPart({ slot });
    return () => setPreviewPart(null);
  }, []);
  const dataCanvas = useRef<HTMLCanvasElement>(null);
  const overlayCanvas = useRef<HTMLCanvasElement>(null);
  const tokenHolder = useRef<HTMLSpanElement>(null);
  const probe = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  /* ── The model ── */
  const rangeMemo = useMemo(() => ({ start: range.start, end: range.end }), [range.start, range.end]);
  const axis = useMemo(() => axisProp ?? linearAxis(rangeMemo), [axisProp, rangeMemo]);
  // A host may rebuild its lane list on every render; only a real change redraws.
  const lanesRef = useRef(lanesProp);
  if (!sameLanes(lanesRef.current, lanesProp)) lanesRef.current = lanesProp;
  const lanes = lanesRef.current;

  // The playhead, its keys and the scrub are the primitive's; what a press or a key means here comes from `gestures`.
  const gestureRef = useRef<TraceTimelineGestures<K> | null>(null);
  const gestures = useMemo<TraceTimelineGestures<K>>(() => {
    // The latest render's answers: they read its axis, view and rows.
    const now = () => gestureRef.current as TraceTimelineGestures<K>;
    return {
      press: (e) => now().press(e),
      scrub: (e) => now().scrub(e),
      release: (e, canceled) => now().release(e, canceled),
      pinch: (points, event) => now().pinch(points, event),
      key: (e, at) => now().key(e, at),
      wheel: (e) => now().wheel(e),
    };
  }, []);
  const handle = usePrimitive(traceTimeline, {
    value, defaultValue, onValueChange: onValueChange as TraceTimelineOptions['onValueChange'], onValueCommit: onValueCommit as TraceTimelineOptions['onValueCommit'],
    view: viewProp, defaultView, onViewChange, minSpan,
    focusedLane, defaultFocusedLane, onFocusedLaneChange,
    selectedThread, defaultSelectedThread, onSelectedThreadChange,
    selectedRequest, defaultSelectedRequest, onSelectedRequestChange,
    min: range.start, max: range.end, orientation, gestures: gestures as TraceTimelineGestures,
  });
  const { instance } = handle;
  const subscribe = useCallback((listener: () => void) => instance.subscribe(listener), [instance]);
  const readState = useCallback(() => instance.get(), [instance]);
  const state = useSyncExternalStore(subscribe, readState, readState);
  const time = Math.max(range.start, Math.min(range.end, value ?? state.value));
  // What a host holds wins over the state until the primitive syncs to it.
  const viewState = viewProp ?? state.view;
  // By its numbers, so a host that passes a new object with the same ones doesn't cost a redraw.
  const view = useMemo(() => clampView({ start: viewState.start, end: viewState.end }, rangeMemo, minSpan), [viewState.start, viewState.end, rangeMemo, minSpan]);
  const win = useMemo(() => viewWindow(axis, view), [axis, view]);
  const selectedThreadKey = (selectedThread === undefined ? state.selectedThread : selectedThread) ?? null;
  const selectedRequestKey = (selectedRequest === undefined ? state.selectedRequest : selectedRequest) ?? null;

  const [size, setSize] = useState({ width: 0, height: 0, hostWidth: 0, hostHeight: 0, top: 0 });
  const start = vertical ? 0 : gutter;
  // A rail's width is its own (44px, or what its classes make it), measured.
  const railWidth = vertical && size.width ? size.width : 44;
  const length = Math.max(0, (vertical ? size.height : size.width) - start);

  const hasRequests = requests.length > 0;
  const hasStops = stops.length > 0;
  const rows = useMemo<TraceRow[]>(
    () => (vertical ? layoutRail(lanes) : layoutStrip(lanes, size.height, { requests: hasRequests, stops: hasStops })),
    [vertical, lanes, hasRequests, hasStops, size.height],
  );
  const marks = useMemo(() => selectStops(stops, { axis, win, length }), [stops, axis, win, length]);
  // For `[` and `]`: the requests in time order (a stable sort keeps equal times in the host's order).
  const requestsByTime = useMemo(() => [...requests].sort((a, b) => a.time - b.time), [requests]);
  const sortedStops = useMemo(() => stopsByTime(stops), [stops]);
  const focusedKey = (focusedLane === undefined ? state.focusedLane : focusedLane) ?? (lanes.length === 1 ? lanes[0].key : null);

  const theme = useThemeColors(rootRef, tokenHolder);
  // Colours a host passes, resolved once per theme.
  const resolved = useRef(new Map<string, string>());
  const resolvedFor = useRef(theme);
  if (resolvedFor.current !== theme) {
    resolved.current.clear();
    resolvedFor.current = theme;
  }
  const colorOf = (css: string) => {
    let out = resolved.current.get(css);
    if (out === undefined) {
      const el = probe.current;
      if (!el) return css;
      el.style.color = css;
      out = getComputedStyle(el).color || css;
      resolved.current.set(css, out);
    }
    return out;
  };
  const requestGroups = useMemo(
    () => (theme ? groupRequests(requests, axis, (r) => (r.tint ? colorOf(r.tint) : r.tone ? toneColor(theme.colors, r.tone) : theme.colors.chart[0])) : []),
    // colorOf only reads refs.
    [requests, axis, theme],
  );

  /* ── What the pointer is doing, for the card, the swell and the hover line ── */
  const [pointerAt, setPointerAt] = useState<{ along: number; across: number } | null>(null);
  const [drag, setDrag] = useState<Spot<K> | null>(null);
  const [peek, setPeek] = useState<{ stop: TraceStop<K> | null } | null>(null);
  const [activityVersion, setActivityVersion] = useState(0);
  const activity = useRef(new Map<string, TraceLaneActivity>());

  // Where the pointer is stays put as the view moves under it; what's under it is worked out from the view.
  const hover = useMemo<Spot<K> | null>(() => {
    if (!pointerAt || pointerAt.along < 0 || pointerAt.along > length) return null;
    const row = rowAt(rows, pointerAt.across);
    const mark = vertical || row?.type === 'stops' ? nearestMark(marks, pointerAt.along, TRACE_SNAP_REACH) : null;
    return { along: pointerAt.along, pull: 0, time: axis.timeAt(win.from + (pointerAt.along / length) * (win.to - win.from)), mark, lane: vertical ? row?.lane?.title : undefined };
  }, [pointerAt, length, rows, vertical, marks, axis, win]);

  // What the imperative handle reads, current as of this render.
  const latest = useRef({ axis, win, length });
  latest.current = { axis, win, length };
  // The window the last gesture asked for: ahead of `win` until the next render, so events between frames add up.
  const winNow = useRef(win);
  winNow.current = win;

  type ViewGiven = { reason: TraceViewChangeReason; event?: Event };
  /** Asks the primitive for a window of the axis; only a change that goes through moves what the next event starts from. */
  const applyWindow = (next: TraceWindow, details: ViewGiven) => {
    const nextView = windowView(axis, next);
    if (nextView.end - nextView.start < minSpan) return;
    if (handle.api.setView(nextView, details)) winNow.current = next;
  };
  const fit = (details: ViewGiven) => handle.api.fit(details);

  /* ── Size ── */
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    // What a rail is placed in, and so what its card has to stay inside.
    const host = (vertical ? el.offsetParent : null) ?? el.parentElement;
    const read = () => setSize((prev) => {
      const next = { width: el.clientWidth, height: el.clientHeight, hostWidth: host?.clientWidth ?? el.clientWidth, hostHeight: host?.clientHeight ?? el.clientHeight, top: el.offsetTop };
      return prev.width === next.width && prev.height === next.height && prev.hostWidth === next.hostWidth && prev.hostHeight === next.hostHeight && prev.top === next.top ? prev : next;
    });
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    if (host) ro.observe(host);
    return () => ro.disconnect();
  }, [vertical]);

  /* ── Publish how far rows run under a right-hand rail, as IndexBar does (lib/wave-rail). ── */
  const insetOptions = useRef({ insetContent, side, railWidth });
  insetOptions.current = { insetContent, side, railWidth };
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || !vertical) return undefined;
    const bound = bindRowInset(el, {
      enabled: () => insetOptions.current.insetContent && insetOptions.current.side === 'end',
      fallback: () => insetOptions.current.railWidth,
      ignoreOwnChanges: true,
    });
    return bound.cleanup;
  }, [vertical, insetContent, side]);

  /* ── Activity: fetched for the view once it settles. Older answers are dropped, and until a new one comes the last one
     stays on screen, moved to where its times now are. ── */
  const fetchRef = useRef(fetchActivity);
  fetchRef.current = fetchActivity;
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const wantsActivity = !!fetchActivity && length > 0;
  useEffect(() => {
    if (!wantsActivity) return undefined;
    const timer = setTimeout(() => {
      const fetcher = fetchRef.current;
      if (!fetcher) return;
      const current = ++generation.current;
      abort.current?.abort();
      const controller = typeof AbortController === 'undefined' ? null : new AbortController();
      abort.current = controller;
      const buckets = Math.max(10, Math.floor(length / ACTIVITY_PX));
      const edges = pixelEdges(axis, win, buckets);
      // A rail only shows activity for lanes it has no density for.
      const asked = lanes.filter((lane) => lane.threads?.length && !(vertical && (lane.density || lane.marks?.length)));
      if (!asked.length) return;
      Promise.all(asked.map(async (lane) => {
        const offset = lane.offset ?? 0;
        const local = edges.map((t) => t - offset);
        try {
          const answer = await fetcher(lane.key, local, (controller?.signal ?? undefined) as AbortSignal);
          if (current !== generation.current) return;
          const threads = new Map<TraceKey, { counts: ArrayLike<number>; max: number }>();
          const total = new Float64Array(buckets);
          let totalMax = 0;
          for (const { id, counts } of answer) {
            let max = 0;
            for (let b = 0; b < counts.length; b++) {
              if (counts[b] > max) max = counts[b];
              if (b < buckets) {
                total[b] += counts[b];
                if (total[b] > totalMax) totalMax = total[b];
              }
            }
            threads.set(id, { counts, max });
          }
          activity.current.set(lane.key, { edges: local, threads, total: { counts: total, max: totalMax } });
        } catch {
          // A lane whose answer failed keeps what it had.
        }
      })).then(() => {
        if (current === generation.current) setActivityVersion((v) => v + 1);
      });
    }, activityDebounce);
    return () => clearTimeout(timer);
  }, [wantsActivity, lanes, axis, win, length, vertical, activityDebounce]);
  useEffect(() => () => {
    generation.current++;
    abort.current?.abort();
  }, []);

  /* ── Drawing ── */
  const buffers = useRef<TraceBuffers | null>(null);
  // A host's inline formatter doesn't count as a change worth a redraw.
  const formatRef = useRef(formatTime);
  formatRef.current = formatTime;
  const frameFor = (canvas: HTMLCanvasElement | null): TraceFrame | null => {
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx || !theme || !size.width || !size.height || !(length > 0)) return null;
    const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
    const pw = Math.round(size.width * dpr);
    const ph = Math.round(size.height * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    return { ctx, dpr, vertical, edge, width: size.width, height: size.height, start, length, columns: Math.max(1, Math.round(length * dpr)), axis, win, colors: theme.colors, font: theme.font };
  };
  const paintData = () => {
    const f = frameFor(dataCanvas.current);
    if (!f) return;
    const began = performance.now();
    const b = buffers.current ?? (buffers.current = new TraceBuffers());
    b.resize(f.columns);
    pixelEdges(axis, win, f.columns, b.edges);
    drawTraceData(f, {
      rows, lanes, ticks: vertical ? [] : chooseTicks(axis, win, view, length), format: (t, res) => formatRef.current(t, res), activity: activity.current,
      focusedLane: focusedKey, selectedThread: selectedThreadKey, selectedRequest: selectedRequestKey, requests: requestGroups, requestsLabel, stopsLabel,
      stopMarks: marks as ReadonlyArray<TraceStopMark>, color: colorOf,
    }, b);
    onDraw?.({ layer: 'data', ms: performance.now() - began, columns: f.columns });
  };
  const paintOverlay = () => {
    const f = frameFor(overlayCanvas.current);
    if (!f) return;
    const began = performance.now();
    const last = rows[rows.length - 1];
    drawTraceOverlay(f, {
      playhead: start + ((axis.fraction(time) - win.from) / (win.to - win.from)) * length,
      hover: hover ? { along: start + hover.along, label: vertical ? undefined : formatRef.current(hover.time, resolutionAt(axis, win, length, hover.along)) } : null,
      from: vertical ? rows[0]?.at ?? 0 : TRACE_RULER,
      to: vertical ? (last ? last.at + last.size : 0) : size.height,
      thumb: vertical && win.to - win.from < 1 ? win : null,
    });
    onDraw?.({ layer: 'overlay', ms: performance.now() - began, columns: f.columns });
  };
  const painters = useRef({ paintData, paintOverlay });
  painters.current = { paintData, paintOverlay };
  // These run in the same commit as the DOM dashes and pill, so the canvas and they can't disagree on screen.
  useLayoutEffect(() => {
    painters.current.paintData();
  }, [theme, size, vertical, edge, start, length, axis, win, rows, lanes, requestGroups, marks, focusedKey, selectedThreadKey, selectedRequestKey, activityVersion, requestsLabel, stopsLabel]);
  useLayoutEffect(() => {
    painters.current.paintOverlay();
  }, [theme, size, vertical, edge, start, length, axis, win, rows, time, hover]);

  // A view can be panned away from the playhead, but when the playhead itself moves out of the view (playing, stepping,
  // a key), the view goes to it. A scrub handles that itself.
  const gesture = useRef<Gesture>({ kind: 'idle' });
  const followed = useRef(time);
  useLayoutEffect(() => {
    if (followed.current === time) return;
    followed.current = time;
    if (gesture.current.kind !== 'idle') return;
    if (time < view.start || time > view.end) {
      const f = axis.fraction(time);
      const half = (win.to - win.from) / 2;
      applyWindow(panWindow({ from: f - half, to: f + half }, 0), { reason: 'playhead' });
    }
    // Only the playhead moving does this; applyWindow reads the rest from this render.
  }, [time]);

  // A new range starts over from the whole of it, when nobody's holding the view.
  const seenRange = useRef(rangeMemo);
  useEffect(() => {
    if (seenRange.current === rangeMemo) return;
    seenRange.current = rangeMemo;
    activity.current.clear();
    if (viewProp === undefined) handle.api.setView(rangeMemo, { reason: 'range-change' });
  }, [rangeMemo]);

  /* ── Gestures: what a press, a move, a pinch, the wheel and a key mean here (the primitive follows the pointer) ── */
  const dirty = useRef({ pinch: false, hover: null as { along: number; across: number } | null });
  const pinchPoints = useRef<ReadonlyArray<{ x: number; y: number }>>([]);
  const pinchEvent = useRef<PointerEvent | undefined>(undefined);
  const frameRequest = useRef(0);
  const lastTap = useRef<{ at: number; along: number; across: number } | null>(null);

  const rect = () => (rootRef.current as HTMLElement).getBoundingClientRect();
  const alongOf = (r: DOMRect, x: number, y: number) => (vertical ? y - r.top : x - r.left - start);
  const acrossOf = (r: DOMRect, x: number, y: number) => (vertical ? (edge === 'right' ? r.right - x : x - r.left) : y - r.top);
  const pullOf = (r: DOMRect, x: number, y: number) => (vertical ? Math.max(0, acrossOf(r, x, y) - railWidth) : 0);
  const scrubContext = (snap: boolean) => ({ axis, win: winNow.current, length, marks: snap ? marks : NO_MARKS });
  const alongOfFraction = (fraction: number) => ((fraction - winNow.current.from) / (winNow.current.to - winNow.current.from)) * length;

  /** Takes in where the pointer is now. A zoom since the last move re-anchors first, where the pointer last was, so this
   *  move is measured at the new zoom; a speed change re-anchors after it. */
  const followPointer = (g: Extract<Gesture, { kind: 'scrub' }>, r: DOMRect, x: number, y: number) => {
    const along = alongOf(r, x, y);
    const pull = pullOf(r, x, y);
    const current = winNow.current;
    const scale = (current.to - current.from) / length;
    if (scale !== g.s.scale) g.s = rescaleScrub(g.s, g.along, axis.fraction(g.last), scale);
    g.s = moveScrub(g.s, along, pull, scrubContext(g.snap));
    g.along = along;
    g.pull = pull;
  };

  /** Where a scrub's position puts the playhead; brings the view along when it goes past the edge. */
  const placeScrub = (g: Extract<Gesture, { kind: 'scrub' }>, event: PointerEvent): TraceSeek<K> => {
    const { fraction, mark } = scrubPosition(g.s, g.along, scrubContext(g.snap));
    const current = winNow.current;
    if (fraction < current.from) applyWindow(panWindow(current, fraction - current.from), { reason: 'drag', event });
    else if (fraction > current.to) applyWindow(panWindow(current, fraction - current.to), { reason: 'drag', event });
    const t = mark ? mark.stop.time : axis.timeAt(fraction);
    g.last = t;
    setDrag({ along: vertical ? g.along : Math.max(0, Math.min(length, alongOfFraction(fraction))), pull: g.pull, time: t, mark, tier: g.s.tier });
    return { time: t, stop: mark?.stop ?? null };
  };

  const runFrame = () => {
    frameRequest.current = 0;
    const g = gesture.current;
    const d = dirty.current;
    if (g.kind === 'pinch' && d.pinch) {
      d.pinch = false;
      const [a, b] = pinchPoints.current;
      if (a && b) {
        const r = rect();
        applyWindow(pinchWindow(g.win, g.separation, g.mid, Math.hypot(a.x - b.x, a.y - b.y), alongOf(r, (a.x + b.x) / 2, (a.y + b.y) / 2), length), { reason: 'pinch', event: pinchEvent.current });
      }
    }
    if (d.hover) {
      setPointerAt(g.kind === 'idle' ? d.hover : null);
      d.hover = null;
    }
  };
  const requestFrame = () => {
    if (!frameRequest.current) frameRequest.current = requestAnimationFrame(() => frameHandler.current());
  };
  const frameHandler = useRef(runFrame);
  frameHandler.current = runFrame;
  useEffect(() => () => cancelAnimationFrame(frameRequest.current), []);

  const KEY_SEEK = (direction: 1 | -1, shift: boolean): number => {
    const times = shift ? 10 : 1;
    if (step != null) return time + direction * step * times;
    return axis.timeAt(axis.fraction(time) + direction * times * ((win.to - win.from) / length));
  };
  const playheadAlong = ((axis.fraction(time) - win.from) / (win.to - win.from)) * length;

  gestureRef.current = {
    press(e) {
      if (!(length > 0)) return null;
      setPeek(null);
      const r = rect();
      const along = alongOf(r, e.clientX, e.clientY);
      const across = acrossOf(r, e.clientX, e.clientY);
      const row = rowAt(rows, across);
      // Picking out a lane on a rail takes a pointer finer than a finger; everywhere else, a press on a row is a pick.
      const picked = { reason: 'item-press', event: e } as const;
      if (row?.lane && row.lane.key !== focusedKey && !(vertical && e.pointerType === 'touch')) handle.api.focusLane(row.lane.key, picked);
      if (row?.type === 'requests') {
        const hit = requestAt(requests, (t) => alongOfFraction(axis.fraction(t)), along);
        if (hit) handle.api.selectRequest(hit.id, picked);
      }
      if (row?.type === 'thread' && row.thread && row.lane) handle.api.selectThread(row.thread.id, { ...picked, lane: row.lane.key });
      if (along < 0) return null; // The gutter picks rows but doesn't seek.
      const current = winNow.current;
      const scale = (current.to - current.from) / length;
      const g: Extract<Gesture, { kind: 'scrub' }> = {
        kind: 'scrub', s: startScrub(along, current.from + along * scale, scale), along, pull: 0, last: NaN,
        snap: vertical || row?.type === 'stops', travel: 0, pressAlong: along, pressAcross: across,
      };
      gesture.current = g;
      setPointerAt(null);
      return placeScrub(g, e);
    },
    scrub(e) {
      const g = gesture.current;
      if (g.kind !== 'scrub') return { time, stop: null };
      const r = rect();
      followPointer(g, r, e.clientX, e.clientY);
      g.travel = Math.max(g.travel, Math.abs(g.along - g.pressAlong) + Math.abs(acrossOf(r, e.clientX, e.clientY) - g.pressAcross));
      return placeScrub(g, e);
    },
    release(e, canceled) {
      const g = gesture.current;
      if (g.kind !== 'scrub') return;
      gesture.current = { kind: 'idle' };
      setDrag(null);
      // Two presses in the same place reset the zoom on a rail.
      if (vertical && !canceled && g.travel < DOUBLE_PX / 2) {
        const tap = lastTap.current;
        if (tap && e.timeStamp - tap.at < DOUBLE_MS && Math.abs(tap.along - g.pressAlong) < DOUBLE_PX && Math.abs(tap.across - g.pressAcross) < DOUBLE_PX) {
          lastTap.current = null;
          fit({ reason: 'double-press', event: e });
        } else {
          lastTap.current = { at: e.timeStamp, along: g.pressAlong, across: g.pressAcross };
        }
      } else {
        lastTap.current = null;
      }
      if (e.pointerType !== 'touch' && !canceled && e.type === 'pointerup') {
        const r = rect();
        const across = acrossOf(r, e.clientX, e.clientY);
        if (across >= 0 && across <= (vertical ? railWidth : size.height)) {
          dirty.current.hover = { along: alongOf(r, e.clientX, e.clientY), across };
          requestFrame();
        }
      }
    },
    pinch(points, event) {
      lastTap.current = null;
      pinchEvent.current = event;
      if (!points) {
        gesture.current = { kind: 'idle' };
        return;
      }
      pinchPoints.current = points;
      if (gesture.current.kind !== 'pinch') {
        const [a, b] = points;
        const r = rect();
        gesture.current = { kind: 'pinch', win: winNow.current, separation: Math.hypot(a.x - b.x, a.y - b.y), mid: alongOf(r, (a.x + b.x) / 2, (a.y + b.y) / 2) };
        setPointerAt(null);
        setPeek(null);
        return;
      }
      dirty.current.pinch = true;
      requestFrame();
    },
    wheel(e) {
      if (!(length > 0)) return;
      const current = winNow.current;
      const span = current.to - current.from;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? length : 1;
      const dy = e.deltaY * unit;
      const dx = e.deltaX * unit;
      const r = rect();
      const anchor = Math.max(0, Math.min(1, alongOf(r, e.clientX, e.clientY) / length));
      if (e.ctrlKey || e.metaKey) {
        // A trackpad pinch: small deltas, sent as a ctrl wheel. A mouse's notches are big, so one zooms by at most ~1.6×.
        e.preventDefault();
        applyWindow(zoomWindow(current, anchor, Math.exp(Math.max(-50, Math.min(50, dy)) * 0.01)), { reason: 'wheel', event: e });
      } else if (vertical) {
        // At the whole range there's nothing to pan, so the wheel stays the page's.
        if (span >= 1) return;
        e.preventDefault();
        applyWindow(panWindow(current, ((dy || dx) / length) * span), { reason: 'wheel', event: e });
      } else if (e.shiftKey || Math.abs(dx) > Math.abs(dy)) {
        e.preventDefault();
        applyWindow(panWindow(current, (((e.shiftKey ? dy || dx : dx)) / length) * span), { reason: 'wheel', event: e });
      } else {
        e.preventDefault();
        applyWindow(zoomWindow(current, anchor, Math.exp(dy * 0.002)), { reason: 'wheel', event: e });
      }
    },
    key(e, at) {
      if (!(length > 0)) return null;
      const seekTo = (t: number, stop: TraceStop<K> | null): TraceSeek<K> => {
        showPeek(stop);
        return { time: Math.max(range.start, Math.min(range.end, t)), stop };
      };
      const zoomBy = (factor: number) => {
        const inView = playheadAlong >= 0 && playheadAlong <= length;
        applyWindow(zoomWindow(win, inView ? playheadAlong / length : 0.5, factor), { reason: 'zoom-key', event: e });
        return true as const;
      };
      // Alt+↑/↓ steps through the lanes, as a press on a lane's row picks it.
      if (e.altKey) {
        if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || lanes.length < 2) return null;
        const i = lanes.findIndex((lane) => lane.key === focusedKey);
        const next = lanes[i < 0 ? (e.key === 'ArrowDown' ? 0 : lanes.length - 1) : Math.max(0, Math.min(lanes.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
        if (next.key !== focusedKey) {
          handle.api.focusLane(next.key, { reason: 'list-navigation', event: e });
          announce(`${next.title ?? next.key} lane`);
        }
        return true;
      }
      // Time runs down a rail, so down is later there, as on IndexBar. On a strip up and right are later, as on any slider.
      switch (e.key) {
        case '[':
        case ']': {
          // The request before or after the selected one (or the playhead): selected, with the playhead on it.
          if (!requestsByTime.length) return null;
          const dir = e.key === ']' ? 1 : -1;
          const held = selectedRequestKey == null ? -1 : requestsByTime.findIndex((r) => r.id === selectedRequestKey);
          let k: number;
          if (held >= 0) k = held + dir;
          else {
            k = requestsByTime.findIndex((r) => r.time >= at);
            if (k < 0) k = requestsByTime.length;
            if (dir < 0) k -= 1;
          }
          const hit = requestsByTime[k];
          if (!hit) return true;
          handle.api.selectRequest(hit.id, { reason: 'list-navigation', event: e });
          announce(`Request ${String(hit.id)}, ${formatTime(hit.time, resolutionAt(axis, win, length, Math.max(0, Math.min(length, playheadAlong))))}`);
          return seekTo(hit.time, null);
        }
        case '{':
        case '}': {
          const lane = lanes.find((l) => l.key === focusedKey);
          const threads = lane?.threads ?? [];
          if (!lane || !threads.length) return null;
          const i = threads.findIndex((t) => t.id === selectedThreadKey);
          const next = threads[i < 0 ? (e.key === '}' ? 0 : threads.length - 1) : Math.max(0, Math.min(threads.length - 1, i + (e.key === '}' ? 1 : -1)))];
          if (next.id !== selectedThreadKey) {
            handle.api.selectThread(next.id, { reason: 'list-navigation', event: e, lane: lane.key });
            announce(`${next.label ?? String(next.id)} thread`);
          }
          return true;
        }
        case 'ArrowRight': return seekTo(KEY_SEEK(1, e.shiftKey), null);
        case 'ArrowLeft': return seekTo(KEY_SEEK(-1, e.shiftKey), null);
        case 'ArrowDown': return seekTo(KEY_SEEK(vertical ? 1 : -1, e.shiftKey), null);
        case 'ArrowUp': return seekTo(KEY_SEEK(vertical ? -1 : 1, e.shiftKey), null);
        case 'PageUp':
        case 'PageDown': {
          const stop = adjacentStop(sortedStops, at, e.key === 'PageDown' ? 1 : -1, Math.max(1e-9, Math.abs(at) * 1e-12));
          return stop ? seekTo(stop.time, stop) : true;
        }
        case 'Home': return seekTo(range.start, null);
        case 'End': return seekTo(range.end, null);
        case '+':
        case '=': return zoomBy(1 / KEY_ZOOM);
        case '-':
        case '_': return zoomBy(KEY_ZOOM);
        case '0': fit({ reason: 'zoom-key', event: e }); return true;
        default: return null;
      }
    },
  };

  // A gesture doesn't outlive the orientation it started in.
  const seenOrientation = useRef(orientation);
  useEffect(() => {
    if (seenOrientation.current === orientation) return;
    seenOrientation.current = orientation;
    handle.api.internal.reset();
    gesture.current = { kind: 'idle' };
    setPointerAt(null);
    setDrag(null);
    setPeek(null);
  }, [orientation]);

  /** Hover, for the card, the swell and the hover line: only a pointer that hovers, and only while nothing is pressed. */
  const handleHover = (e: ReactPointerEvent<HTMLDivElement>) => {
    onPointerMove?.(e);
    if (gesture.current.kind !== 'idle' || e.pointerType === 'touch') return;
    const r = rect();
    dirty.current.hover = { along: alongOf(r, e.clientX, e.clientY), across: acrossOf(r, e.clientX, e.clientY) };
    requestFrame();
  };

  /* ── The card a key shows on a rail ── */
  const peekTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(peekTimer.current), []);
  const showPeek = (stop: TraceStop<K> | null) => {
    if (!vertical) return;
    setPeek({ stop });
    clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => setPeek(null), PEEK_MS);
  };
  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    onBlur?.(e);
    setPeek(null);
  };

  useImperativeHandle(ref, () => ({
    fit: () => { handle.api.fit(); },
    setView: (next) => { handle.api.setView(next); },
    pixelTimes: () => {
      const { axis: a, win: w, length: l } = latest.current;
      const times: number[] = [];
      for (let x = 0; x < l; x++) times.push(a.timeAt(w.from + (x / l) * (w.to - w.from)));
      return times;
    },
    redraw: () => {
      painters.current.paintData();
      painters.current.paintOverlay();
    },
    focus: () => rootRef.current?.focus(),
  }), [handle.api]);

  /* ── The preview card ── */
  const focusSpot: Spot<K> | null = drag ?? hover ?? (peek && vertical ? { along: playheadAlong, pull: 0, time, mark: peek.stop ? { stop: peek.stop, along: playheadAlong, count: 1, tone: peek.stop.tone ?? 'default', first: peek.stop.time, last: peek.stop.time, disabled: false } : null } : null);
  const showCard = !!focusSpot && (vertical || !!previewPart?.slot || !!focusSpot.mark);
  const cardStop = focusSpot?.mark?.stop ?? null;
  const [cardSize, setCardSize] = useState({ width: 200, height: 56 });
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return undefined;
    const read = () => setCardSize((prev) => (prev.width === el.offsetWidth && prev.height === el.offsetHeight ? prev : { width: el.offsetWidth, height: el.offsetHeight }));
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showCard]);

  let cardStyle: CSSProperties | undefined;
  if (showCard && focusSpot) {
    if (vertical) {
      const spot = placeRailCard({ along: focusSpot.along, pull: focusSpot.pull, railWidth, railTop: size.top, hostWidth: size.hostWidth, hostHeight: size.hostHeight, cardWidth: cardSize.width, cardHeight: cardSize.height });
      cardStyle = { '--tt-card-x': `${spot.inset}px`, '--tt-card-y': `${spot.top}px` } as CSSProperties;
    } else {
      const own = rootRef.current?.getBoundingClientRect();
      const host = rootRef.current?.parentElement?.getBoundingClientRect();
      const spot = placeStripCard({ along: start + focusSpot.along, width: size.width, height: size.height, above: own && host ? own.top - host.top : 0, below: own && host ? host.bottom - own.bottom : 0, cardWidth: cardSize.width, cardHeight: cardSize.height });
      cardStyle = { '--tt-card-x': `${spot.left}px`, '--tt-card-y': `${spot.top}px` } as CSSProperties;
    }
  }
  const speed = vertical ? drag?.tier ?? null : null;
  const resolutionHere = length > 0 ? resolutionAt(axis, win, length, Math.max(0, Math.min(length, focusSpot?.along ?? playheadAlong))) : 1;
  const cardTitle = cardStop ? cardStop.caption || cardStop.label || formatTime(cardStop.time, resolutionHere) : focusSpot ? formatTime(focusSpot.time, resolutionHere) : '';

  /* ── The rail's dashes and pill ── */
  const focal = !vertical ? null : drag ? playheadAlong : hover ? hover.along : peek ? playheadAlong : null;
  const currentMark = vertical ? nearestMark(marks, playheadAlong, 2) : null;
  const hotMark = hover?.mark ?? drag?.mark ?? null;
  const pillAlong = Math.max(9, Math.min(length - 9, playheadAlong));
  const pillResolution = length > 0 ? resolutionAt(axis, win, length, Math.max(0, Math.min(length, playheadAlong))) : 1;
  const timeText = formatTime(time, pillResolution);
  const atStop = currentMark && currentMark.stop.time === time ? currentMark.stop : null;
  const dashInset = railDashInset(rows);
  // The card says the time; the pill would only sit under it.
  const pillHidden = showCard && !!focusSpot && Math.abs(focusSpot.along - playheadAlong) < cardSize.height / 2 + 12 && focusSpot.pull < 40;

  const card: CardState<K> = {
    show: showCard,
    spot: focusSpot,
    stop: cardStop,
    title: cardTitle,
    meta: cardStop ? `${formatTime(cardStop.time, resolutionHere)}${focusSpot?.mark && focusSpot.mark.count > 1 ? ` · ${focusSpot.mark.count - 1} more here` : ''}` : null,
    speed,
    vertical,
    side,
    style: cardStyle,
    room: Math.max(160, size.hostWidth - railWidth - 16),
    ref: cardRef,
  };
  const cardContext: CardContextValue = { card: card as CardState<TraceKey>, register: registerPreview };

  const sideAttr = { 'data-side': vertical ? side : undefined };
  const root = usePart(handle, 'root', {}, {
    'aria-label': ariaLabel ?? (rest['aria-labelledby'] ? undefined : 'Timeline'),
    'aria-valuetext': atStop?.caption ? `${timeText}, ${atStop.caption}` : timeText,
    'aria-keyshortcuts': [lanes.length > 1 && 'Alt+ArrowUp Alt+ArrowDown', hasRequests && '[ ]', lanes.some((l) => l.threads?.length) && '{ }'].filter(Boolean).join(' ') || undefined,
    ...rest,
    ...sideAttr,
    ref: rootRef,
    onPointerMove: handleHover,
    onPointerLeave: (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerLeave?.(e);
      dirty.current.hover = null;
      setPointerAt(null);
    },
    onBlur: handleBlur,
    className: cn(traceTimelineVariants({ orientation, side }), className),
    style: {
      '--tt-width': railWidth + 'px',
      '--tt-height': stripHeight(lanes, { requests: hasRequests, stops: hasStops }) + 'px',
      '--tt-dash': dashInset + 'px',
      ...style,
    } as CSSProperties,
    children: (
      <>
      <canvas ref={dataCanvas} aria-hidden data-slot="trace-timeline-canvas" className="pointer-events-none absolute inset-0 size-full" />
      <canvas ref={overlayCanvas} aria-hidden data-slot="trace-timeline-overlay" className="pointer-events-none absolute inset-0 size-full" />
      {/* Where the canvas's colours are read from. */}
      <span ref={tokenHolder} hidden>
        {TOKEN_NAMES.map((name) => <i key={name} data-token={name} className={TOKENS[name]} />)}
        <i ref={probe} />
      </span>
      {vertical && marks.map((mark) => {
        const hot = hotMark === mark;
        const current = currentMark === mark;
        const f = hot || current ? 1 : focal == null ? 0 : traceSwell(mark.along - focal);
        const tint = mark.stop.tint;
        return (
          <span
            key={String(mark.stop.key ?? mark.stop.time)}
            data-slot="trace-timeline-stop"
            data-tone={mark.tone}
            data-count={mark.count}
            // As IndexBar's options say it: the stop you're at, and one with nothing to jump to.
            data-current={current ? '' : undefined}
            data-disabled={mark.disabled ? '' : undefined}
            style={{ '--y': `${mark.along - 1}px`, '--len': `${waveDashLength(f, mark.stop.level ?? 1)}px`, '--f': f, ...(tint && !hot ? { backgroundColor: tint } : {}) } as CSSProperties}
            className={cn(
              'pointer-events-none absolute top-(--y)', waveDash,
              side === 'start' ? 'start-(--tt-dash)' : 'end-(--tt-dash)',
              mark.tone !== 'default' ? TONE_DASH[mark.tone] : waveDashTone({ hot, current }),
              mark.disabled && !hot && 'opacity-55',
            )}
          />
        );
      })}
      {vertical && (
        <span
          data-slot="trace-timeline-pill"
          aria-hidden
          data-hidden={pillHidden || undefined}
          style={{ '--y': `${pillAlong}px` } as CSSProperties}
          className={cn(
            'pointer-events-none absolute top-(--y) -translate-y-1/2 rounded-full bg-primary px-1.5 text-caption2 leading-[17px] font-semibold whitespace-nowrap text-primary-foreground tabular-nums shadow-[0_1px_4px_--alpha(black/24%)]',
            'transition-opacity duration-100 motion-reduce:transition-none data-hidden:opacity-0',
            side === 'start' ? 'start-[calc(var(--tt-width)+3px)]' : 'end-[calc(var(--tt-width)+3px)]',
          )}
        >
          {timeText}
        </span>
      )}
      <CardContext.Provider value={cardContext}>
        {children}
        {previewPart ? null : <TraceCard<K> card={card} lines={2} width={260} />}
      </CardContext.Provider>
      </>
    ),
  }, 'div');
  return root;
}
