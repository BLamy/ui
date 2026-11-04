'use client';
import {
  useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type FocusEvent, type HTMLAttributes, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref,
} from 'react';
import { cva } from 'class-variance-authority';
import { useControllableState } from '@/lib/controllable-state';
import { cn } from '@/lib/utils';
import {
  TRACE_GUTTER, TRACE_MIN_SPAN, TRACE_RULER, TRACE_SCRUB_SPEEDS, TRACE_SNAP_REACH, TRACE_WAVE_PEAK, TRACE_WAVE_REST,
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
       orientation={narrow ? 'vertical' : 'horizontal'} side="right" top={8} bottom={8} />

   Marks go on a canvas, at most one thing per device pixel per row, found by binary search over sorted arrays, so an hour
   with hundreds of thousands of marks costs what the pixels cost. Colours are the theme's tokens, read from its CSS
   variables and read again when the theme changes. Press or drag to seek; on a rail, pull away from it to slow the scrub.
   Wheel and pinch zoom around the pointer. The root is a `slider`, with the keyboard that implies. ══ */

export const traceTimelineVariants = cva('font-sans touch-none select-none', {
  variants: {
    orientation: {
      horizontal: 'relative block h-(--tt-height) w-full cursor-crosshair bg-background -outline-offset-2 [outline:2px_solid_transparent] focus-visible:[outline:2px_solid_var(--primary)]',
      vertical: 'absolute top-(--tt-top) bottom-(--tt-bottom) z-80 w-(--tt-width) cursor-pointer rounded-lg -outline-offset-2 [outline:2px_solid_transparent] focus-visible:[outline:2px_solid_var(--primary)]',
    },
    side: { right: '', left: '' },
  },
  compoundVariants: [
    { orientation: 'vertical', side: 'right', className: 'right-0' },
    { orientation: 'vertical', side: 'left', className: 'left-0' },
  ],
  defaultVariants: { orientation: 'horizontal', side: 'right' },
});

export interface TraceValueInfo<K extends TraceKey = TraceKey> {
  /** `start` on the press, `move` at most once a frame, `end` on release. A key press is one `end`. */
  phase: 'start' | 'move' | 'end';
  /** The stop the value snapped to, if any. */
  stop: TraceStop<K> | null;
}

/** What a redraw took: `data` is the rows, when the view or the data changed; `overlay` is the playhead and hover line. */
export interface TraceDrawStats {
  layer: 'data' | 'overlay';
  ms: number;
  columns: number;
}

export interface TraceTimelineHandle {
  /** Shows the whole range. */
  fit(): void;
  /** Shows a stretch of time (reports it through `onViewChange`). */
  setView(view: TraceRange): void;
  /** The time at each CSS pixel of the plot: the times a drag can land on, worth reading ahead. */
  pixelTimes(): number[];
  /** Draws everything again. */
  redraw(): void;
  focus(): void;
}

export type TraceFetchActivity = (laneKey: string, edges: Float64Array, signal: AbortSignal) => Promise<readonly TraceActivity[]> | readonly TraceActivity[];

export interface TraceTimelineProps<K extends TraceKey = TraceKey> extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue'> {
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
  onValueChange?: (time: number, info: TraceValueInfo<K>) => void;
  /** The stretch of time on show. Hold it to keep the zoom through a remount. */
  view?: TraceRange;
  defaultView?: TraceRange;
  onViewChange?: (view: TraceRange) => void;
  /** `horizontal` is the strip, `vertical` the rail. */
  orientation?: 'horizontal' | 'vertical';
  /** Rail: the edge it sits on. Its stops and card are on the inner side. */
  side?: 'left' | 'right';
  /** Rail: its insets from the top and bottom of its parent. */
  top?: number | string;
  bottom?: number | string;
  /** Rail: its width in px. */
  railWidth?: number;
  /** Rail: publish how far list rows run under it as `--bl-index-bar-inset` on its parent, as IndexBar does, so ListRows
   *  beside it keep their trailing accessories clear of it (right side only). Default true. */
  insetContent?: boolean;
  /** The lane in focus (a single lane always is). */
  focusedLane?: string | null;
  onFocusLane?: (laneKey: string) => void;
  /** The selected thread, in the focused lane. */
  selectedThread?: TraceKey | null;
  onSelectThread?: (threadId: TraceKey, laneKey: string) => void;
  selectedRequest?: TraceKey | null;
  onSelectRequest?: (requestId: TraceKey) => void;
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
  /** Preview card: a slot above its text, for a thumbnail of that moment. */
  renderPreview?: (time: number, stop: TraceStop<K> | null) => ReactNode;
  /** Preview card: lines of `preview` shown (default 2), and its width in px (default 260). */
  previewLines?: number;
  previewWidth?: number;
  /** Strip: the width of the label gutter, 0 for none. */
  gutter?: number;
  /** Strip: the gutter's label for the requests row and the stops row. */
  requestsLabel?: string;
  stopsLabel?: string;
  /** The slider's accessible name. */
  label?: string;
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
  error: 'text-destructive',
  chart1: 'text-chart-1',
  chart2: 'text-chart-2',
  chart3: 'text-chart-3',
  chart4: 'text-chart-4',
  chart5: 'text-chart-5',
} as const;
type TokenName = keyof typeof TOKENS;
const TOKEN_NAMES = Object.keys(TOKENS) as TokenName[];

const TONE_DASH: Record<Exclude<TraceTone, 'default'>, string> = {
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-destructive',
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
    surface: t.surface, ruler: t.ruler, card: t.card, warning: t.warning, success: t.success, error: t.error,
    chart: [t.chart1, t.chart2, t.chart3, t.chart4, t.chart5],
  };
}

/** The theme's colours, for a canvas: read now, and again when an ancestor's class or style changes or the system's
 *  light or dark does. */
function useThemeColors(root: React.RefObject<HTMLElement | null>, holder: React.RefObject<HTMLElement | null>) {
  const [theme, setTheme] = useState<{ colors: TraceColors; font: string; signature: string } | null>(null);
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
    const scheme = typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-color-scheme: dark)');
    scheme?.addEventListener?.('change', soon);
    // Labels drawn before a web font landed need drawing again once it has.
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    const fontsLoaded = () => setTheme((prev) => (prev ? { ...prev } : prev));
    fonts?.addEventListener?.('loadingdone', fontsLoaded);
    return () => {
      cancelAnimationFrame(raf);
      mo?.disconnect();
      scheme?.removeEventListener?.('change', soon);
      fonts?.removeEventListener?.('loadingdone', fontsLoaded);
    };
  }, [root, holder]);
  return theme;
}

const len = (v: number | string | undefined) => (typeof v === 'number' ? v + 'px' : v);

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

type Gesture =
  | { kind: 'idle' }
  /** A pinch has ended with a finger still down: nothing more until it lifts. */
  | { kind: 'spent' }
  | { kind: 'pinch'; win: TraceWindow; separation: number; mid: number }
  | { kind: 'scrub'; id: number; pointerType: string; s: TraceScrub; along: number; pull: number; before: number; last: number; snap: boolean; travel: number; pressAlong: number; pressAcross: number };

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
  value, defaultValue, onValueChange, view: viewProp, defaultView, onViewChange,
  orientation = 'horizontal', side = 'right', top, bottom, railWidth = 44, insetContent = true,
  focusedLane, onFocusLane, selectedThread = null, onSelectThread, selectedRequest = null, onSelectRequest,
  fetchActivity, activityDebounce = 60, step, minSpan = TRACE_MIN_SPAN, formatTime = formatTraceTime,
  renderPreview, previewLines = 2, previewWidth = 260, gutter = TRACE_GUTTER, requestsLabel = 'requests', stopsLabel = 'stops',
  label = 'Timeline', onDraw, ref, className, style, onKeyDown, onBlur, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave, onLostPointerCapture, ...rest
}: TraceTimelineProps<K>) {
  const vertical = orientation === 'vertical';
  const rootRef = useRef<HTMLDivElement>(null);
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

  const [viewState, setViewState] = useControllableState<TraceRange>(viewProp, defaultView ?? rangeMemo);
  // By its numbers, so a host that passes a new object with the same ones doesn't cost a redraw.
  const view = useMemo(() => clampView({ start: viewState.start, end: viewState.end }, rangeMemo, minSpan), [viewState.start, viewState.end, rangeMemo, minSpan]);
  const win = useMemo(() => viewWindow(axis, view), [axis, view]);
  const [valueState, setValueState] = useControllableState<number>(value, defaultValue ?? range.start);
  const time = Math.max(range.start, Math.min(range.end, valueState));

  const [size, setSize] = useState({ width: 0, height: 0, hostWidth: 0, hostHeight: 0, top: 0 });
  const start = vertical ? 0 : gutter;
  const length = Math.max(0, (vertical ? size.height : size.width) - start);

  const hasRequests = requests.length > 0;
  const hasStops = stops.length > 0;
  const rows = useMemo<TraceRow[]>(
    () => (vertical ? layoutRail(lanes) : layoutStrip(lanes, size.height, { requests: hasRequests, stops: hasStops })),
    [vertical, lanes, hasRequests, hasStops, size.height],
  );
  const marks = useMemo(() => selectStops(stops, { axis, win, length }), [stops, axis, win, length]);
  const sortedStops = useMemo(() => stopsByTime(stops), [stops]);
  const focusedKey = focusedLane ?? (lanes.length === 1 ? lanes[0].key : null);

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
    () => (theme ? groupRequests(requests, axis, (r) => (r.color ? colorOf(r.color) : r.tone ? toneColor(theme.colors, r.tone) : theme.colors.chart[0])) : []),
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

  const emitValue = (t: number, phase: TraceValueInfo<K>['phase'], stop: TraceStop<K> | null) => {
    setValueState(t);
    onValueChange?.(t, { phase, stop });
  };
  const applyView = (next: TraceRange) => {
    const clamped = clampView(next, rangeMemo, minSpan);
    if (clamped.start === view.start && clamped.end === view.end) return;
    setViewState(clamped);
    onViewChange?.(clamped);
  };
  const applyWindow = (next: TraceWindow) => {
    const nextView = windowView(axis, next);
    if (nextView.end - nextView.start < minSpan) return;
    winNow.current = next;
    applyView(nextView);
  };
  const fit = () => applyView(rangeMemo);

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

  /* ── Publish how far rows run under a right-hand rail: a row's right edge minus the rail's left edge, as IndexBar does.
     Only changes outside the rail count, as its own dashes change as it's used. ── */
  useLayoutEffect(() => {
    const el = rootRef.current;
    const host = el?.parentElement;
    if (!el || !host || !vertical || !insetContent || side !== 'right') return undefined;
    let raf = 0;
    const sync = () => {
      raf = 0;
      const row = host.querySelector<HTMLElement>('[data-slot="list-row-content"]');
      const overlap = row ? Math.max(0, row.getBoundingClientRect().right - el.getBoundingClientRect().left) : railWidth;
      const v = `${Math.round(overlap)}px`;
      if (host.style.getPropertyValue('--bl-index-bar-inset') !== v) host.style.setProperty('--bl-index-bar-inset', v);
    };
    sync();
    const later = () => { if (!raf) raf = requestAnimationFrame(sync); };
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(later);
    ro?.observe(host);
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver((records) => {
      if (records.some((r) => !el.contains(r.target))) later();
    });
    mo?.observe(host, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      mo?.disconnect();
      host.style.removeProperty('--bl-index-bar-inset');
    };
  }, [vertical, insetContent, side, railWidth]);

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
    return { ctx, dpr, vertical, side, width: size.width, height: size.height, start, length, columns: Math.max(1, Math.round(length * dpr)), axis, win, colors: theme.colors, font: theme.font };
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
      focusedLane: focusedKey, selectedThread, selectedRequest, requests: requestGroups, requestsLabel, stopsLabel,
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
  }, [theme, size, vertical, side, start, length, axis, win, rows, lanes, requestGroups, marks, focusedKey, selectedThread, selectedRequest, activityVersion, requestsLabel, stopsLabel]);
  useLayoutEffect(() => {
    painters.current.paintOverlay();
  }, [theme, size, vertical, side, start, length, axis, win, rows, time, hover]);

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
      applyWindow(panWindow({ from: f - half, to: f + half }, 0));
    }
    // Only the playhead moving does this; applyWindow reads the rest from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

  // A new range starts over from the whole of it, when nobody's holding the view.
  const seenRange = useRef(rangeMemo);
  useEffect(() => {
    if (seenRange.current === rangeMemo) return;
    seenRange.current = rangeMemo;
    activity.current.clear();
    if (viewProp === undefined) {
      setViewState(rangeMemo);
      onViewChange?.(rangeMemo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeMemo]);

  /* ── Gestures ── */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dirty = useRef({ scrub: false, pinch: false, hover: null as { along: number; across: number } | null });
  const frameRequest = useRef(0);
  const lastTap = useRef<{ at: number; along: number; across: number } | null>(null);

  const rect = () => (rootRef.current as HTMLElement).getBoundingClientRect();
  const alongOf = (r: DOMRect, x: number, y: number) => (vertical ? y - r.top : x - r.left - start);
  const acrossOf = (r: DOMRect, x: number, y: number) => (vertical ? (side === 'right' ? r.right - x : x - r.left) : y - r.top);
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

  /** Puts a scrub's position on the playhead, and brings the view along when it goes past the edge. */
  const commitScrub = (g: Extract<Gesture, { kind: 'scrub' }>, phase: TraceValueInfo<K>['phase']) => {
    const { fraction, mark } = scrubPosition(g.s, g.along, scrubContext(g.snap));
    const current = winNow.current;
    if (fraction < current.from) applyWindow(panWindow(current, fraction - current.from));
    else if (fraction > current.to) applyWindow(panWindow(current, fraction - current.to));
    const t = mark ? mark.stop.time : axis.timeAt(fraction);
    if (t !== g.last || phase !== 'move') emitValue(t, phase, mark?.stop ?? null);
    g.last = t;
    setDrag({ along: vertical ? g.along : Math.max(0, Math.min(length, alongOfFraction(fraction))), pull: g.pull, time: t, mark, tier: g.s.tier });
  };

  const runFrame = () => {
    frameRequest.current = 0;
    const g = gesture.current;
    const d = dirty.current;
    if (g.kind === 'scrub' && d.scrub) {
      d.scrub = false;
      commitScrub(g, 'move');
    } else if (g.kind === 'pinch' && d.pinch) {
      d.pinch = false;
      const [a, b] = [...pointers.current.values()];
      if (a && b) {
        const r = rect();
        applyWindow(pinchWindow(g.win, g.separation, g.mid, Math.hypot(a.x - b.x, a.y - b.y), alongOf(r, (a.x + b.x) / 2, (a.y + b.y) / 2), length));
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

  const endScrub = (g: Extract<Gesture, { kind: 'scrub' }>, restore: number | null) => {
    dirty.current.scrub = false;
    gesture.current = { kind: 'idle' };
    if (restore !== null) emitValue(restore, 'end', null);
    else commitScrub(g, 'end');
    setDrag(null);
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || !(length > 0)) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Not a live pointer (a synthesized event); the gesture still works while it stays over the timeline.
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setPeek(null);
    const count = pointers.current.size;
    const r = rect();
    if (count === 2) {
      // A second finger makes this a pinch, so take back the first finger's jump.
      const g = gesture.current;
      if (g.kind === 'scrub') endScrub(g, g.before);
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: 'pinch', win: winNow.current, separation: Math.hypot(a.x - b.x, a.y - b.y), mid: alongOf(r, (a.x + b.x) / 2, (a.y + b.y) / 2) };
      setPointerAt(null);
      return;
    }
    if (count > 2 || gesture.current.kind !== 'idle') return;
    const along = alongOf(r, e.clientX, e.clientY);
    const across = acrossOf(r, e.clientX, e.clientY);
    const row = rowAt(rows, across);
    // Picking out a lane on a rail takes a pointer finer than a finger; everywhere else, a press on a row is a pick.
    if (row?.lane && row.lane.key !== focusedKey && !(vertical && e.pointerType === 'touch')) onFocusLane?.(row.lane.key);
    if (row?.type === 'requests') {
      const hit = requestAt(requests, (t) => alongOfFraction(axis.fraction(t)), along);
      if (hit) onSelectRequest?.(hit.id);
    }
    if (row?.type === 'thread' && row.thread && row.lane && row.thread.id !== selectedThread) onSelectThread?.(row.thread.id, row.lane.key);
    if (along < 0) return; // The gutter picks rows but doesn't seek.
    const current = winNow.current;
    const scale = (current.to - current.from) / length;
    const g: Extract<Gesture, { kind: 'scrub' }> = {
      kind: 'scrub', id: e.pointerId, pointerType: e.pointerType, s: startScrub(along, current.from + along * scale, scale), along, pull: 0, before: time, last: NaN,
      snap: vertical || row?.type === 'stops', travel: 0, pressAlong: along, pressAcross: across,
    };
    gesture.current = g;
    setPointerAt(null);
    commitScrub(g, 'start');
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const known = pointers.current.get(e.pointerId);
    if (known) {
      known.x = e.clientX;
      known.y = e.clientY;
    }
    const g = gesture.current;
    const r = rect();
    if (g.kind === 'scrub' && g.id === e.pointerId) {
      followPointer(g, r, e.clientX, e.clientY);
      g.travel = Math.max(g.travel, Math.abs(g.along - g.pressAlong) + Math.abs(acrossOf(r, e.clientX, e.clientY) - g.pressAcross));
      dirty.current.scrub = true;
      requestFrame();
    } else if (g.kind === 'pinch') {
      dirty.current.pinch = true;
      requestFrame();
    } else if (g.kind === 'idle' && e.pointerType !== 'touch') {
      dirty.current.hover = { along: alongOf(r, e.clientX, e.clientY), across: acrossOf(r, e.clientX, e.clientY) };
      requestFrame();
    }
  };

  const release = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    if (g.kind === 'scrub' && g.id === e.pointerId) {
      const r = rect();
      if (!cancelled) followPointer(g, r, e.clientX, e.clientY);
      endScrub(g, null);
      // Two presses in the same place reset the zoom on a rail.
      if (vertical && !cancelled && g.travel < DOUBLE_PX / 2) {
        const tap = lastTap.current;
        if (tap && e.timeStamp - tap.at < DOUBLE_MS && Math.abs(tap.along - g.pressAlong) < DOUBLE_PX && Math.abs(tap.across - g.pressAcross) < DOUBLE_PX) {
          lastTap.current = null;
          fit();
        } else {
          lastTap.current = { at: e.timeStamp, along: g.pressAlong, across: g.pressAcross };
        }
      } else {
        lastTap.current = null;
      }
      if (e.pointerType !== 'touch' && !cancelled) {
        const across = acrossOf(r, e.clientX, e.clientY);
        if (across >= 0 && across <= (vertical ? railWidth : size.height)) {
          dirty.current.hover = { along: alongOf(r, e.clientX, e.clientY), across };
          requestFrame();
        }
      }
    } else if (g.kind === 'pinch' && pointers.current.size < 2) {
      gesture.current = pointers.current.size ? { kind: 'spent' } : { kind: 'idle' };
      lastTap.current = null;
    } else if (g.kind === 'spent' && !pointers.current.size) {
      gesture.current = { kind: 'idle' };
    }
  };

  const handlers = useRef({ wheel: (_: WheelEvent) => {} });
  handlers.current.wheel = (e: WheelEvent) => {
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
      applyWindow(zoomWindow(current, anchor, Math.exp(Math.max(-50, Math.min(50, dy)) * 0.01)));
    } else if (vertical) {
      // At the whole range there's nothing to pan, so the wheel stays the page's.
      if (span >= 1) return;
      e.preventDefault();
      applyWindow(panWindow(current, ((dy || dx) / length) * span));
    } else if (e.shiftKey || Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
      applyWindow(panWindow(current, (((e.shiftKey ? dy || dx : dx)) / length) * span));
    } else {
      e.preventDefault();
      applyWindow(zoomWindow(current, anchor, Math.exp(dy * 0.002)));
    }
  };
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const onWheelNative = (e: WheelEvent) => handlers.current.wheel(e);
    // Non-passive, so the page behind doesn't scroll as the timeline zooms. React's onWheel is passive.
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, []);

  // A gesture doesn't outlive the orientation it started in.
  const seenOrientation = useRef(orientation);
  useEffect(() => {
    if (seenOrientation.current === orientation) return;
    seenOrientation.current = orientation;
    const g = gesture.current;
    if (g.kind === 'scrub') endScrub(g, null);
    else gesture.current = { kind: 'idle' };
    pointers.current.clear();
    setPointerAt(null);
    setDrag(null);
    setPeek(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation]);

  /* ── Keyboard ── */
  const peekTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(peekTimer.current), []);
  const showPeek = (stop: TraceStop<K> | null) => {
    if (!vertical) return;
    setPeek({ stop });
    clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => setPeek(null), PEEK_MS);
  };
  const seekByKey = (t: number, stop: TraceStop<K> | null) => {
    emitValue(Math.max(range.start, Math.min(range.end, t)), 'end', stop);
    showPeek(stop);
  };
  const playheadAlong = ((axis.fraction(time) - win.from) / (win.to - win.from)) * length;
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    // Cmd and the like with these keys belong to the browser (zoom, history) or the host.
    if (e.defaultPrevented || !(length > 0) || e.metaKey || e.ctrlKey || e.altKey) return;
    const nudge = (direction: 1 | -1) => {
      const times = e.shiftKey ? 10 : 1;
      if (step != null) return seekByKey(time + direction * step * times, null);
      const f = axis.fraction(time) + direction * times * ((win.to - win.from) / length);
      seekByKey(axis.timeAt(f), null);
    };
    const zoomBy = (factor: number) => {
      const inView = playheadAlong >= 0 && playheadAlong <= length;
      applyWindow(zoomWindow(win, inView ? playheadAlong / length : 0.5, factor));
    };
    // Time runs down a rail, so down is later there, as on IndexBar. On a strip up and right are later, as on any slider.
    switch (e.key) {
      case 'ArrowRight': nudge(1); break;
      case 'ArrowLeft': nudge(-1); break;
      case 'ArrowDown': nudge(vertical ? 1 : -1); break;
      case 'ArrowUp': nudge(vertical ? -1 : 1); break;
      case 'PageUp':
      case 'PageDown': {
        const direction = e.key === 'PageDown' ? 1 : -1;
        const stop = adjacentStop(sortedStops, time, direction, Math.max(1e-9, Math.abs(time) * 1e-12));
        if (stop) seekByKey(stop.time, stop);
        break;
      }
      case 'Home': seekByKey(range.start, null); break;
      case 'End': seekByKey(range.end, null); break;
      case '+':
      case '=': zoomBy(1 / KEY_ZOOM); break;
      case '-':
      case '_': zoomBy(KEY_ZOOM); break;
      case '0': fit(); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
  };
  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    onBlur?.(e);
    setPeek(null);
  };

  const api = useRef({ fit, applyView });
  api.current = { fit, applyView };
  useImperativeHandle(ref, () => ({
    fit: () => api.current.fit(),
    setView: (next) => api.current.applyView(next),
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
  }), []);

  /* ── The preview card ── */
  const focusSpot: Spot<K> | null = drag ?? hover ?? (peek && vertical ? { along: playheadAlong, pull: 0, time, mark: peek.stop ? { stop: peek.stop, along: playheadAlong, count: 1, tone: peek.stop.tone ?? 'default', first: peek.stop.time, last: peek.stop.time, dim: false } : null } : null);
  const showCard = !!focusSpot && (vertical || !!renderPreview || !!focusSpot.mark);
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

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={range.start}
      aria-valuemax={range.end}
      aria-valuenow={time}
      aria-valuetext={atStop?.caption ? `${timeText}, ${atStop.caption}` : timeText}
      {...rest}
      ref={rootRef}
      data-slot="trace-timeline"
      data-orientation={orientation}
      data-side={vertical ? side : undefined}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        handlePointerDown(e);
      }}
      onPointerMove={(e) => {
        onPointerMove?.(e);
        handlePointerMove(e);
      }}
      onPointerUp={(e) => {
        onPointerUp?.(e);
        release(e, false);
      }}
      onPointerCancel={(e) => {
        onPointerCancel?.(e);
        release(e, true);
      }}
      onLostPointerCapture={(e) => {
        onLostPointerCapture?.(e);
        release(e, true);
      }}
      onPointerLeave={(e) => {
        onPointerLeave?.(e);
        dirty.current.hover = null;
        setPointerAt(null);
      }}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={cn(traceTimelineVariants({ orientation, side }), className)}
      style={{
        '--tt-width': railWidth + 'px',
        '--tt-height': stripHeight(lanes, { requests: hasRequests, stops: hasStops }) + 'px',
        '--tt-top': len(top ?? 0),
        '--tt-bottom': len(bottom ?? 0),
        '--tt-dash': dashInset + 'px',
        '--tt-lines': previewLines,
        '--tt-card-w': Math.min(previewWidth, Math.max(160, size.hostWidth - railWidth - 16)) + 'px',
        ...style,
      } as CSSProperties}
    >
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
        const rest = (mark.stop.level ?? 1) > 1 ? TRACE_WAVE_REST - 3 : TRACE_WAVE_REST;
        return (
          <span
            key={String(mark.stop.key ?? mark.stop.time)}
            data-slot="trace-timeline-stop"
            data-tone={mark.tone}
            data-count={mark.count}
            style={{ '--y': `${mark.along - 1}px`, '--len': `${rest + (TRACE_WAVE_PEAK - rest) * f}px`, '--f': f } as CSSProperties}
            className={cn(
              'pointer-events-none absolute top-(--y) h-[2px] w-(--len) rounded-full transition-[width,background-color] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
              side === 'left' ? 'left-(--tt-dash)' : 'right-(--tt-dash)',
              mark.tone !== 'default' ? TONE_DASH[mark.tone]
                : hot ? 'bg-foreground' : current ? 'bg-primary'
                : 'bg-[color:color-mix(in_oklab,var(--foreground)_calc(var(--f)*75%),var(--tertiary-foreground,color-mix(in_oklab,var(--muted-foreground)_60%,transparent)))]',
              mark.dim && !hot && 'opacity-55',
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
            side === 'left' ? 'left-[calc(var(--tt-width)+3px)]' : 'right-[calc(var(--tt-width)+3px)]',
          )}
        >
          {timeText}
        </span>
      )}
      {showCard && focusSpot ? (
        <div
          ref={cardRef}
          data-slot="trace-timeline-card"
          data-speed={speed ?? undefined}
          style={cardStyle}
          className={cn(
            'pointer-events-none absolute top-(--tt-card-y) z-10 box-border w-max max-w-(--tt-card-w) min-w-[160px] rounded-card bg-card px-[13px] py-[9px]',
            'shadow-[0_8px_28px_--alpha(black/28%),0_0_0_1px_var(--border)] motion-reduce:transition-none',
            'animate-[blWaveCard_var(--duration-spring-snappy)_var(--ease-spring-snappy)] motion-reduce:animate-none',
            vertical
              ? cn('transition-[top,left,right] duration-spring-snappy ease-spring-snappy', side === 'left' ? 'left-(--tt-card-x) origin-left' : 'right-(--tt-card-x) origin-right')
              : 'left-(--tt-card-x) origin-bottom',
          )}
        >
          {renderPreview ? <div data-slot="trace-timeline-preview" className="mb-[6px] empty:hidden">{renderPreview(focusSpot.time, cardStop)}</div> : null}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 truncate text-footnote leading-[18px] font-semibold text-foreground">{cardTitle}</div>
            {cardStop?.trailing}
          </div>
          {cardStop ? (
            <div className="text-caption leading-[16px] text-muted-foreground tabular-nums">
              {formatTime(cardStop.time, resolutionHere)}
              {focusSpot.mark && focusSpot.mark.count > 1 ? ` · ${focusSpot.mark.count - 1} more here` : ''}
            </div>
          ) : null}
          {cardStop?.preview != null
            ? <div className="mt-[2px] line-clamp-(--tt-lines) text-caption leading-[16px] text-pretty text-muted-foreground">{cardStop.preview}</div>
            : null}
          {focusSpot.lane ? <div className="text-caption leading-[16px] text-muted-foreground">{focusSpot.lane}</div> : null}
          {speed != null ? (
            <div data-slot="trace-timeline-speed" className="mt-[3px] text-caption leading-[16px] font-medium text-primary">
              {TRACE_SCRUB_SPEEDS[speed].label}{speed === 0 ? ' · pull away to slow' : ''}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
