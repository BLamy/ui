'use client';
import {
  useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type CSSProperties, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref,
} from 'react';
import { cva } from 'class-variance-authority';
import { announce } from '@ui-sdk/core';
import { usePart, usePrimitive } from '@ui-sdk/react/primitive';
import { useAppearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { clampView, formatTraceTime, pinchWindow, TRACE_MIN_SPAN } from '@/lib/trace-timeline-model';
import {
  FLAME_ERROR, FLAME_GUTTER, FLAME_MINIMAP, FLAME_PENDING, FLAME_ROW_HEIGHT, FLAME_RULER, FLAME_WAITING,
  firstChild, firstRoot, flameExtent, flameIndex, flameTicks, formatDuration, laneTint, layoutLanes, rowAtY, selfTime, siblingOf, spanAt, subIndex,
  type FlameData, type FlameRange,
} from '@/lib/flame-chart-model';
import {
  FlameBuffers, drawFlameData, drawFlameOverlay, flameMinimap, inkFor,
  type FlameColors, type FlameDrawCounts, type FlameFrame,
} from '@/lib/flame-chart-draw';
import {
  flameChart,
  type FlameActivateDetails, type FlameChartGestures, type FlameChartOptions, type FlameCollapsedLanesChangeDetails, type FlamePress,
  type FlameSelectedChangeDetails, type FlameValueChangeDetails, type FlameValueCommitDetails, type FlameViewChangeDetails, type FlameViewChangeReason,
} from '@/lib/flame-chart-primitive';

/* ══ FlameChart — a distributed trace on a canvas ══
   Each lane is a process or a service, and in it each span sits under the span that caused it. Where the cause was in
   another lane a curve joins the two, from where the caller was when the other side started on it. Solid ran here,
   outlined was waiting (dashed: never finished), red failed. A minimap of the whole trace sits over a ruler, and a
   playhead runs through it all, the same `value` as TraceTimeline's, so a debugger can follow it:

     <FlameChart data={flameData(lanes, spans)} value={t} onValueChange={setT}
       selected={i} onSelectedChange={setI} onSpanActivate={(i) => openInDebugger(i)} highlight={matches} />

   Spans are columns of typed arrays (lib/flame-chart-model), indexed per row by start, so a view finds what it shows by
   binary search and a row costs what its pixels cost: a million spans draw in a few milliseconds (lib/flame-chart-draw).
   The data layer is drawn again only when the view, the scroll, the data, the selection or the highlight change; the
   playhead and hover go on an overlay. Colours are the theme's tokens, read from its CSS variables. The root is an
   `application` (the flame-chart primitive: its value, view, selection and collapsed lanes, each with UI SDK change
   details, its keys and its drags on `bindDrag`). ══ */

export const flameChartVariants = cva(
  'relative block h-(--fc-height) w-full touch-none overflow-hidden font-sans select-none -outline-offset-2 [outline:2px_solid_transparent] focus-visible:[outline:2px_solid_var(--primary)]',
  {
    variants: {
      frame: {
        none: 'bg-background',
        card: 'rounded-card bg-background shadow-hairline',
      },
    },
    defaultVariants: { frame: 'none' },
  },
);

export type {
  FlameActivateDetails, FlameActivateReason, FlameCollapseReason, FlameCollapsedLanesChangeDetails, FlameSelectReason, FlameSelectedChangeDetails,
  FlameValueChangeDetails, FlameValueChangeReason, FlameValueCommitDetails, FlameViewChangeDetails, FlameViewChangeReason,
} from '@/lib/flame-chart-primitive';

/** What a redraw took: `data` is the lanes and spans, when the view, scroll, data, selection or highlight changed;
 *  `overlay` is the playhead and hover. `bars`, `runs`, `labels` and `links` are what the data layer drew. */
export interface FlameDrawStats extends Partial<FlameDrawCounts> {
  layer: 'data' | 'overlay';
  ms: number;
  spans: number;
}

export interface FlameChartHandle {
  /** Shows the whole range. */
  fit(): void;
  /** Shows a stretch of time (reported through `onViewChange` as `imperative`). */
  setView(view: FlameRange): void;
  /** Brings a span into view: opens its lane, scrolls to its row and pans to it; `zoom` fits the view to it. */
  reveal(index: number, options?: { zoom?: boolean }): void;
  /** Draws everything again. */
  redraw(): void;
  focus(): void;
}

export interface FlameChartProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue' | 'onSelect'> {
  /** The spans, as columns (`flameData(lanes, spans)` packs objects). Keep it stable between renders. */
  data: FlameData;
  /** The whole stretch of time the chart covers. Default: from the first start to the last end. */
  range?: FlameRange;
  /** The stretch on show. */
  view?: FlameRange;
  defaultView?: FlameRange;
  onViewChange?: (view: FlameRange, details: FlameViewChangeDetails) => void;
  /** The playhead, on the shared clock. A press on empty space or a drag on the ruler seeks it. */
  value?: number;
  defaultValue?: number;
  onValueChange?: (time: number, details: FlameValueChangeDetails) => void;
  /** Once a press, a drag or a key is done, with where the playhead ended. */
  onValueCommit?: (time: number, details: FlameValueCommitDetails) => void;
  /** The selected span's index, or -1. */
  selected?: number;
  defaultSelected?: number;
  onSelectedChange?: (index: number, details: FlameSelectedChangeDetails) => void;
  /** A double press or Enter on a span: "open this span". */
  onSpanActivate?: (index: number, details: FlameActivateDetails) => void;
  /** Spans kept lit while the rest dim: search matches, a critical path, a family. Null (default) dims nothing. */
  highlight?: ArrayLike<number> | ReadonlySet<number> | null;
  /** Draw curves between a caller and what it caused in another lane. Default true. */
  showLinks?: boolean;
  /** Lanes shown as their header alone, by key. */
  collapsedLanes?: readonly string[];
  defaultCollapsedLanes?: readonly string[];
  onCollapsedLanesChange?: (lanes: string[], details: FlameCollapsedLanesChangeDetails) => void;
  /** An overview strip of the whole range with the view as a window. Default true. */
  minimap?: boolean;
  /** Prints a time, given how far apart the times worth telling apart are. Default: the offset from the start of `range`. */
  formatTime?: (time: number, resolution: number) => string;
  /** The hover card's content for a span. Default: its name, lane, duration, self time and state. */
  renderTooltip?: (index: number) => ReactNode;
  /** A row's height, px. Default 18. */
  rowHeight?: number;
  /** The lane label gutter's width, px. Default 148 (at most a third of a narrow chart). */
  gutter?: number;
  /** The shortest stretch of time the view can show. */
  minSpan?: number;
  /** The root's accessible name. Default "Flame chart". */
  'aria-label'?: string;
  /** Called after each canvas redraw, with what it took. */
  onDraw?: (stats: FlameDrawStats) => void;
  frame?: 'none' | 'card';
  ref?: Ref<FlameChartHandle>;
}

/** The utilities the canvas's colours are read from, hidden in the DOM. */
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
  destructive: 'text-destructive',
  warning: 'text-warning',
} as const;
type TokenName = keyof typeof TOKENS;
const TOKEN_NAMES = Object.keys(TOKENS) as TokenName[];

/** The theme's colours, for a canvas: read now, again when the kit's appearance changes, when an ancestor's class or
 *  style changes (a ThemeScope), and when web fonts land. */
function useThemeColors(root: React.RefObject<HTMLElement | null>, holder: React.RefObject<HTMLElement | null>) {
  const [theme, setTheme] = useState<{ colors: FlameColors; font: string; boldFont: string; signature: string } | null>(null);
  const appearance = useAppearance();
  useLayoutEffect(() => {
    const el = root.current;
    const tokens = holder.current;
    if (!el || !tokens || typeof getComputedStyle === 'undefined') return undefined;
    const read = () => {
      const colors = {} as FlameColors;
      for (const child of Array.from(tokens.children)) {
        const name = (child as HTMLElement).dataset.token as TokenName | undefined;
        if (name) colors[name] = getComputedStyle(child).color;
      }
      const family = getComputedStyle(el).fontFamily || 'sans-serif';
      const font = `11px ${family}`;
      const boldFont = `600 11px ${family}`;
      const signature = JSON.stringify(colors) + font;
      setTheme((prev) => (prev?.signature === signature ? prev : { colors, font, boldFont, signature }));
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

/** What the pointers are doing. */
type Gesture =
  | { kind: 'idle' }
  | { kind: 'scrub' }
  | { kind: 'minimap'; grab: number }
  | { kind: 'pan'; x: number; y: number; view: FlameRange; scroll: number; travel: number; hit: number; time: number }
  | { kind: 'gutter'; y: number; scroll: number; travel: number; lane: number; header: boolean }
  | { kind: 'pinch'; view: FlameRange; separation: number; mid: number };

const NO_LANES: readonly string[] = [];
/** Two presses this close, in ms, on the same span are a double press. */
const DOUBLE_MS = 400;
/** A press that moves less than this, px, is a press and not a drag. */
const CLICK_PX = 4;
const KEY_ZOOM = 2;

export function FlameChart({
  data, range: rangeProp, view: viewProp, defaultView, onViewChange, value, defaultValue, onValueChange, onValueCommit,
  selected: selectedProp, defaultSelected, onSelectedChange, onSpanActivate, highlight = null, showLinks = true,
  collapsedLanes, defaultCollapsedLanes, onCollapsedLanesChange, minimap = true, formatTime: formatProp, renderTooltip,
  rowHeight = FLAME_ROW_HEIGHT, gutter: gutterProp = FLAME_GUTTER, minSpan = TRACE_MIN_SPAN, 'aria-label': ariaLabel, onDraw,
  frame, ref, className, style, onPointerMove, onPointerLeave, 'aria-describedby': describedBy, ...rest
}: FlameChartProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dataCanvas = useRef<HTMLCanvasElement>(null);
  const overlayCanvas = useRef<HTMLCanvasElement>(null);
  const tokenHolder = useRef<HTMLSpanElement>(null);
  const probe = useRef<HTMLElement>(null);
  const descriptionId = useId();
  const count = data.start.length;

  /* ── The model ── */
  const extent = useMemo(() => flameExtent(data), [data]);
  const rangeStart = rangeProp?.start ?? extent.start;
  const rangeEnd = rangeProp?.end ?? extent.end;
  const range = useMemo<FlameRange>(() => ({ start: rangeStart, end: rangeEnd > rangeStart ? rangeEnd : rangeStart + 1 }), [rangeStart, rangeEnd]);
  const index = useMemo(() => flameIndex(data), [data]);
  const formatTime = useMemo(() => formatProp ?? ((t: number, res: number) => formatTraceTime(t - range.start, res)), [formatProp, range.start]);

  const gestureRef = useRef<FlameChartGestures | null>(null);
  const gestures = useMemo<FlameChartGestures>(() => {
    const now = () => gestureRef.current as FlameChartGestures;
    return {
      press: (e) => now().press(e),
      move: (e) => now().move(e),
      release: (e, canceled) => now().release(e, canceled),
      pinch: (points, event) => now().pinch(points, event),
      key: (e, at) => now().key(e, at),
      wheel: (e) => now().wheel(e),
    };
  }, []);
  const handle = usePrimitive(flameChart, {
    value, defaultValue, onValueChange, onValueCommit, view: viewProp, defaultView, onViewChange, minSpan,
    selected: selectedProp, defaultSelected, onSelectedChange,
    collapsedLanes, defaultCollapsedLanes, onCollapsedLanesChange: onCollapsedLanesChange as FlameChartOptions['onCollapsedLanesChange'],
    onSpanActivate, count, min: range.start, max: range.end, gestures,
  });
  const { instance, api } = handle;
  const subscribe = useCallback((listener: () => void) => instance.subscribe(listener), [instance]);
  const readState = useCallback(() => instance.get(), [instance]);
  const state = useSyncExternalStore(subscribe, readState, readState);
  const time = Math.max(range.start, Math.min(range.end, value ?? state.value));
  const viewState = viewProp ?? state.view;
  const view = useMemo(() => clampView({ start: viewState.start, end: viewState.end }, range, minSpan), [viewState.start, viewState.end, range, minSpan]);
  const selectedRaw = selectedProp ?? state.selected;
  const selected = selectedRaw >= 0 && selectedRaw < count ? selectedRaw : -1;
  const collapsedList = collapsedLanes ?? state.collapsedLanes ?? NO_LANES;
  const collapsedKey = collapsedList.join('\u0000');
  // By what it holds, so a host's new array with the same keys doesn't lay out again.
  const collapsed = useMemo(() => new Set(collapsedList), [collapsedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const layout = useMemo(() => layoutLanes(index, collapsed, data.lanes, rowHeight), [index, collapsed, data.lanes, rowHeight]);

  /* ── Size ── */
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const read = () => setSize((prev) => (prev.width === el.clientWidth && prev.height === el.clientHeight ? prev : { width: el.clientWidth, height: el.clientHeight }));
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const gutter = Math.max(0, Math.min(gutterProp, Math.round(size.width / 3)));
  const plot = Math.max(0, size.width - gutter);
  const minimapHeight = minimap ? FLAME_MINIMAP : 0;
  const bodyTop = minimapHeight + FLAME_RULER;
  const bodyHeight = Math.max(0, size.height - bodyTop);
  const maxScroll = Math.max(0, layout.total - bodyHeight);
  const [scrollState, setScroll] = useState(0);
  const scroll = Math.max(0, Math.min(maxScroll, scrollState));
  const scrollNow = useRef(scroll);
  scrollNow.current = scroll;
  const scrollTo = (y: number) => {
    const next = Math.max(0, Math.min(maxScroll, y));
    scrollNow.current = next;
    setScroll(next);
  };

  /* ── Colours ── */
  const theme = useThemeColors(rootRef, tokenHolder);
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
      if (!el || typeof getComputedStyle === 'undefined') return css;
      el.style.color = '';
      el.style.color = css;
      out = getComputedStyle(el).color || css;
      resolved.current.set(css, out);
    }
    return out;
  };
  // colorOf only reads refs; these change with the theme and the data.
  const spanColors = useMemo(() => (theme ? data.colors.map(colorOf) : []), [theme, data.colors]);
  const spanInk = useMemo(() => (theme ? spanColors.map((c) => inkFor(c, theme.colors)) : []), [theme, spanColors]);
  const laneColors = useMemo(() => (theme ? data.lanes.map((_, l) => colorOf(laneTint(data.lanes, l))) : []), [theme, data.lanes]);

  /* ── What's lit ── */
  const litMask = useMemo(() => {
    if (highlight == null) return null;
    const mask = new Uint8Array(count);
    const each = (i: number) => {
      if (i >= 0 && i < count) mask[i] = 1;
    };
    if (typeof (highlight as ReadonlySet<number>).has === 'function') (highlight as ReadonlySet<number>).forEach(each);
    else for (let k = 0; k < (highlight as ArrayLike<number>).length; k++) each((highlight as ArrayLike<number>)[k]);
    return mask;
  }, [highlight, count]);
  const lit = useMemo(() => (litMask ? subIndex(data, litMask) : null), [data, litMask]);
  const errors = useMemo(() => {
    const mask = new Uint8Array(count);
    let any = false;
    for (let i = 0; i < count; i++) {
      if (data.flags[i] & FLAME_ERROR && (!litMask || litMask[i])) {
        mask[i] = 1;
        any = true;
      }
    }
    return any ? subIndex(data, mask) : null;
  }, [data, count, litMask]);
  const overview = useMemo(() => (minimap && plot > 0 ? flameMinimap(data, range, Math.max(1, Math.round(plot / 2))) : null), [minimap, data, range, plot]);
  const ticks = useMemo(() => flameTicks(range, view, plot), [range, view, plot]);

  /* ── Pointer state ── */
  const [pointerAt, setPointerAt] = useState<{ x: number; y: number } | null>(null);
  const gesture = useRef<Gesture>({ kind: 'idle' });
  const viewNow = useRef(view);
  viewNow.current = view;
  const xOf = (t: number) => gutter + ((t - view.start) / (view.end - view.start || 1)) * plot;
  const timeAtX = (x: number, v: FlameRange = viewNow.current) => v.start + ((x - gutter) / (plot || 1)) * (v.end - v.start);

  /** The span at a point on the root, or -1. */
  const hitAt = (x: number, y: number) => {
    if (y < bodyTop || x < gutter || x > gutter + plot) return -1;
    const at = rowAtY(layout, y - bodyTop + scrollNow.current);
    if (!at || at.row < 0) return -1;
    const v = viewNow.current;
    const slop = (3 / (plot || 1)) * (v.end - v.start);
    return spanAt(index, at.lane, at.row, timeAtX(x, v), slop);
  };
  const hover = useMemo(() => {
    if (!pointerAt) return null;
    return { ...pointerAt, index: hitAt(pointerAt.x, pointerAt.y) };
    // hitAt reads this render's layout and view.
  }, [pointerAt, layout, view, scroll, index]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Drawing ── */
  const buffers = useRef(new FlameBuffers());
  const formatRef = useRef(formatTime);
  formatRef.current = formatTime;
  const frameFor = (canvas: HTMLCanvasElement | null): FlameFrame | null => {
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx || !theme || !size.width || !size.height || !(plot > 0)) return null;
    const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
    const pw = Math.round(size.width * dpr);
    const ph = Math.round(size.height * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    return {
      ctx, dpr, width: size.width, height: size.height, gutter, plot, bodyTop, minimapHeight, rulerHeight: FLAME_RULER,
      view, scroll, colors: theme.colors, font: theme.font, boldFont: theme.boldFont,
    };
  };
  const paintData = () => {
    const f = frameFor(dataCanvas.current);
    if (!f) return;
    const began = performance.now();
    const counts = drawFlameData(f, {
      data, index, layout, range, spanColors, spanInk, laneColors, ticks, format: (t, res) => formatRef.current(t, res),
      selected, lit, litMask, errors, showLinks, minimap: overview,
    }, buffers.current);
    onDraw?.({ layer: 'data', ms: performance.now() - began, spans: count, ...counts });
  };
  const paintOverlay = () => {
    const f = frameFor(overlayCanvas.current);
    if (!f) return;
    const began = performance.now();
    const px = xOf(time);
    let box = null;
    const h = hover && gesture.current.kind === 'idle' ? hover.index : -1;
    if (h >= 0) {
      const l = data.lane[h];
      const top = bodyTop + layout.tops[l] - scroll + layout.header + data.depth[h] * layout.rowHeight + 1;
      const x0 = xOf(data.start[h]);
      box = { x: x0, y: top, w: xOf(data.end[h]) - x0, h: layout.rowHeight - 2 };
    }
    const hoverX = hover && hover.x >= gutter && hover.y >= minimapHeight && gesture.current.kind === 'idle' ? hover.x : null;
    drawFlameOverlay(f, {
      playhead: px >= gutter && px <= gutter + plot ? px : null,
      hover: hoverX == null ? null : { x: hoverX, label: formatRef.current(timeAtX(hoverX, view), (view.end - view.start) / (plot || 1)) },
      box,
    });
    onDraw?.({ layer: 'overlay', ms: performance.now() - began, spans: count });
  };
  const painters = useRef({ paintData, paintOverlay });
  painters.current = { paintData, paintOverlay };
  useLayoutEffect(() => {
    painters.current.paintData();
  }, [theme, size, gutter, view, scroll, data, index, layout, range, spanColors, spanInk, laneColors, ticks, selected, lit, errors, showLinks, overview]);
  useLayoutEffect(() => {
    painters.current.paintOverlay();
  }, [theme, size, gutter, view, scroll, layout, time, hover]);

  /* ── Moving the view ── */
  type ViewGiven = { reason: FlameViewChangeReason; event?: Event };
  const applyView = (next: FlameRange, details: ViewGiven) => {
    if (!(next.end - next.start >= Math.min(minSpan, range.end - range.start))) return;
    if (api.setView(next, details)) viewNow.current = clampView(next, range, minSpan);
  };
  const zoomAt = (anchorTime: number, factor: number, details: ViewGiven) => {
    const v = viewNow.current;
    const span = Math.min(range.end - range.start, Math.max(minSpan, (v.end - v.start) * factor));
    const f = (anchorTime - v.start) / (v.end - v.start || 1);
    const start = anchorTime - f * span;
    applyView({ start, end: start + span }, details);
  };
  const panBy = (ms: number, details: ViewGiven) => {
    const v = viewNow.current;
    const span = v.end - v.start;
    const start = Math.max(range.start, Math.min(range.end - span, v.start + ms));
    applyView({ start, end: start + span }, details);
  };

  /** Brings a span into view: its lane opened, its row scrolled to, and the view panned (or fitted, with `zoom`). */
  const reveal = (i: number, zoom: boolean, reason: FlameViewChangeReason) => {
    if (i < 0 || i >= count) return;
    const l = data.lane[i];
    let lay = layout;
    if (layout.collapsed[l]) {
      const key = data.lanes[l].key;
      api.toggleLane(key);
      lay = layoutLanes(index, collapsedList.filter((k) => k !== key), data.lanes, rowHeight);
    }
    const s = data.start[i];
    const e = data.end[i];
    const v = viewNow.current;
    const span = v.end - v.start;
    if (zoom) {
      const pad = Math.max((e - s) * 0.15, minSpan * 4, 1e-3);
      applyView({ start: s - pad, end: e + pad }, { reason });
    } else if (s < v.start || e > v.end) {
      const start = e - s > span * 0.9 ? s - span * 0.05 : (s + e) / 2 - span / 2;
      applyView({ start, end: start + span }, { reason });
    }
    const top = lay.tops[l] + lay.header + data.depth[i] * lay.rowHeight;
    const cur = scrollNow.current;
    const room = Math.max(0, lay.total - bodyHeight);
    if (top < cur + 4) scrollTo(Math.max(0, Math.min(room, top - lay.header - 4)));
    else if (top + lay.rowHeight > cur + bodyHeight - 4) scrollTo(Math.max(0, Math.min(room, top + lay.rowHeight - bodyHeight + 8)));
  };

  // When the playhead moves out of the view (playing, stepping), the view goes to it.
  const followed = useRef(time);
  useLayoutEffect(() => {
    if (followed.current === time) return;
    followed.current = time;
    if (gesture.current.kind !== 'idle') return;
    if (time < view.start || time > view.end) {
      const half = (view.end - view.start) / 2;
      applyView({ start: time - half, end: time + half }, { reason: 'follow' });
    }
  }, [time]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new range starts over from the whole of it, when nobody holds the view.
  const seenRange = useRef(range);
  useEffect(() => {
    if (seenRange.current === range) return;
    seenRange.current = range;
    if (viewProp === undefined) api.setView(range, { reason: 'range-change' });
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Words for a span, for the hover card's default, the description and announcements. */
  const describe = (i: number) => {
    const fl = data.flags[i];
    const lane = data.lanes[data.lane[i]];
    const state = [fl & FLAME_ERROR && 'error', fl & FLAME_PENDING && 'pending', fl & FLAME_WAITING && 'waiting'].filter(Boolean).join(', ');
    return `${data.names[data.name[i]]}, ${lane?.title ?? ''}, ${formatDuration(data.end[i] - data.start[i])}${state ? `, ${state}` : ''}`;
  };

  /* ── Gestures ── */
  const lastClick = useRef<{ at: number; index: number } | null>(null);
  const rect = () => (rootRef.current as HTMLElement).getBoundingClientRect();
  const local = (e: { clientX: number; clientY: number }) => {
    const r = rect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const minimapView = (x: number, grab: number) => {
    const v = viewNow.current;
    const span = v.end - v.start;
    const t = range.start + ((x - gutter) / (plot || 1)) * (range.end - range.start);
    const start = Math.max(range.start, Math.min(range.end - span, t - grab));
    return { start, end: start + span };
  };

  gestureRef.current = {
    press(e): FlamePress {
      if (!(plot > 0)) return null;
      const { x, y } = local(e);
      setPointerAt(null);
      if (y < minimapHeight) {
        if (x < gutter) return null;
        const v = viewNow.current;
        const t = range.start + ((x - gutter) / plot) * (range.end - range.start);
        // Inside the window it's grabbed where pressed; outside, the window jumps to centre on the press.
        const grab = t >= v.start && t <= v.end ? t - v.start : (v.end - v.start) / 2;
        gesture.current = { kind: 'minimap', grab };
        applyView(minimapView(x, grab), { reason: 'minimap', event: e });
        return { kind: 'drag' };
      }
      if (y < bodyTop) {
        if (x < gutter) return null;
        gesture.current = { kind: 'scrub' };
        return { kind: 'scrub', time: Math.max(range.start, Math.min(range.end, timeAtX(x))) };
      }
      if (x < gutter) {
        const at = rowAtY(layout, y - bodyTop + scrollNow.current);
        gesture.current = { kind: 'gutter', y, scroll: scrollNow.current, travel: 0, lane: at?.lane ?? -1, header: at?.row === -1 };
        return { kind: 'drag' };
      }
      gesture.current = { kind: 'pan', x, y, view: viewNow.current, scroll: scrollNow.current, travel: 0, hit: hitAt(x, y), time: timeAtX(x) };
      return { kind: 'drag' };
    },
    move(e) {
      const g = gesture.current;
      const { x, y } = local(e);
      switch (g.kind) {
        case 'scrub': return Math.max(range.start, Math.min(range.end, timeAtX(x)));
        case 'minimap': applyView(minimapView(x, g.grab), { reason: 'minimap', event: e }); return null;
        case 'gutter':
          g.travel = Math.max(g.travel, Math.abs(y - g.y));
          if (g.travel >= CLICK_PX) scrollTo(g.scroll - (y - g.y));
          return null;
        case 'pan': {
          g.travel = Math.max(g.travel, Math.hypot(x - g.x, y - g.y));
          if (g.travel < CLICK_PX) return null;
          const span = g.view.end - g.view.start;
          const start = Math.max(range.start, Math.min(range.end - span, g.view.start - ((x - g.x) / (plot || 1)) * span));
          applyView({ start, end: start + span }, { reason: 'drag', event: e });
          scrollTo(g.scroll - (y - g.y));
          return null;
        }
        default: return null;
      }
    },
    release(e, canceled) {
      const g = gesture.current;
      gesture.current = { kind: 'idle' };
      if (e.pointerType !== 'touch' && e.type === 'pointerup') setPointerAt(local(e));
      if (g.kind === 'pan') {
        if (canceled) {
          // Escape puts the view back where the drag found it.
          if (e.type !== 'pointercancel') {
            applyView(g.view, { reason: 'escape-key' });
            scrollTo(g.scroll);
          }
          return null;
        }
        if (g.travel >= CLICK_PX) return null;
        if (g.hit >= 0) {
          api.select(g.hit, { reason: 'item-press', event: e });
          const last = lastClick.current;
          if (last && last.index === g.hit && e.timeStamp - last.at < DOUBLE_MS) {
            lastClick.current = null;
            api.activate(g.hit, { reason: 'double-press', event: e });
          } else {
            lastClick.current = { at: e.timeStamp, index: g.hit };
          }
          return null;
        }
        lastClick.current = null;
        return g.time;
      }
      if (g.kind === 'gutter' && !canceled && g.travel < CLICK_PX && g.header && g.lane >= 0) {
        api.toggleLane(data.lanes[g.lane].key, { reason: 'trigger-press', event: e });
      }
      return null;
    },
    pinch(points, event) {
      if (!points) {
        gesture.current = { kind: 'idle' };
        return;
      }
      const [a, b] = points;
      const r = rect();
      const mid = (a.x + b.x) / 2 - r.left - gutter;
      const separation = Math.hypot(a.x - b.x, a.y - b.y);
      const g = gesture.current;
      if (g.kind !== 'pinch') {
        gesture.current = { kind: 'pinch', view: viewNow.current, separation, mid };
        setPointerAt(null);
        return;
      }
      // pinchWindow works in fractions of the range.
      const full = range.end - range.start;
      const win = { from: (g.view.start - range.start) / full, to: (g.view.end - range.start) / full };
      const next = pinchWindow(win, g.separation, g.mid, separation, mid, plot || 1);
      applyView({ start: range.start + next.from * full, end: range.start + next.to * full }, { reason: 'pinch', event });
    },
    wheel(e) {
      if (!(plot > 0)) return;
      const { x, y } = local(e);
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? bodyHeight : 1;
      const dy = e.deltaY * unit;
      const dx = e.deltaX * unit;
      if (y >= bodyTop && x < gutter && !e.ctrlKey && !e.metaKey) {
        // Over the lane labels the wheel scrolls the lanes, and the page once they're at an end.
        const next = Math.max(0, Math.min(maxScroll, scrollNow.current + dy));
        if (next === scrollNow.current) return;
        e.preventDefault();
        scrollTo(next);
        return;
      }
      e.preventDefault();
      const v = viewNow.current;
      const span = v.end - v.start;
      const anchor = Math.max(v.start, Math.min(v.end, timeAtX(Math.max(gutter, x))));
      if (e.ctrlKey || e.metaKey) zoomAt(anchor, Math.exp(Math.max(-50, Math.min(50, dy)) * 0.01), { reason: 'wheel', event: e });
      else if (e.shiftKey || Math.abs(dx) > Math.abs(dy)) panBy(((e.shiftKey ? dy || dx : dx) / plot) * span, { reason: 'wheel', event: e });
      else zoomAt(anchor, Math.exp(dy * 0.002), { reason: 'wheel', event: e });
    },
    key(e) {
      const v = viewNow.current;
      const span = v.end - v.start;
      const pick = (i: number) => {
        if (i < 0) return true as const;
        if (api.select(i, { reason: 'list-navigation', event: e })) {
          reveal(i, false, 'follow');
          announce(describe(i));
        }
        return true as const;
      };
      const zoomBy = (factor: number) => {
        const anchor = selected >= 0 && data.end[selected] >= v.start && data.start[selected] <= v.end
          ? Math.max(v.start, Math.min(v.end, (data.start[selected] + data.end[selected]) / 2))
          : time >= v.start && time <= v.end ? time : (v.start + v.end) / 2;
        zoomAt(anchor, factor, { reason: 'zoom-key', event: e });
        return true as const;
      };
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight': {
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          if (e.shiftKey) {
            panBy(dir * span * 0.1, { reason: 'pan-key', event: e });
            return true;
          }
          if (!count) return null;
          return pick(selected < 0 ? firstRoot(data) : siblingOf(data, selected, dir));
        }
        case 'ArrowUp':
          if (!count) return null;
          return pick(selected < 0 ? firstRoot(data) : data.parent[selected]);
        case 'ArrowDown':
          if (!count) return null;
          return pick(selected < 0 ? firstRoot(data) : firstChild(data, selected));
        case 'PageUp':
        case 'PageDown':
          scrollTo(scrollNow.current + (e.key === 'PageDown' ? 1 : -1) * Math.max(rowHeight, bodyHeight - rowHeight * 2));
          return true;
        case 'Home': return range.start;
        case 'End': return range.end;
        case '+':
        case '=': return zoomBy(1 / KEY_ZOOM);
        case '-':
        case '_': return zoomBy(KEY_ZOOM);
        case '0': api.fit({ reason: 'zoom-key', event: e }); return true;
        case 'Enter':
          if (selected < 0) return null;
          api.activate(selected, { reason: 'enter-key', event: e });
          return true;
        case 'Escape':
          if (selected < 0) return null;
          api.select(-1, { reason: 'escape-key', event: e });
          return true;
        default: return null;
      }
    },
  };

  /* ── Hover ── */
  const frameRequest = useRef(0);
  const pendingHover = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => () => cancelAnimationFrame(frameRequest.current), []);
  const handleHover = (e: ReactPointerEvent<HTMLDivElement>) => {
    onPointerMove?.(e);
    if (gesture.current.kind !== 'idle' || e.pointerType === 'touch' || api.internal.busy()) return;
    pendingHover.current = local(e);
    if (!frameRequest.current) {
      frameRequest.current = requestAnimationFrame(() => {
        frameRequest.current = 0;
        const at = pendingHover.current;
        if (!at) return;
        setPointerAt(at);
        const el = rootRef.current;
        if (el) {
          const hit = hitAt(at.x, at.y);
          el.style.cursor = at.y < minimapHeight ? 'grab' : at.y < bodyTop ? (at.x >= gutter ? 'col-resize' : '') : hit >= 0 ? 'pointer' : at.x < gutter ? '' : 'grab';
        }
      });
    }
  };

  useImperativeHandle(ref, () => ({
    fit: () => { api.fit(); },
    setView: (next) => { api.setView(next); },
    reveal: (i, options) => reveal(i, !!options?.zoom, 'imperative'),
    redraw: () => {
      painters.current.paintData();
      painters.current.paintOverlay();
    },
    focus: () => rootRef.current?.focus(),
  }));

  /* ── The hover card ── */
  const hovered = hover && gesture.current.kind === 'idle' ? hover.index : -1;
  let card: ReactNode = null;
  if (hovered >= 0 && hover) {
    const fl = data.flags[hovered];
    const lane = data.lanes[data.lane[hovered]];
    const right = hover.x > size.width - 260;
    const below = hover.y < size.height - 120;
    card = (
      <div
        data-slot="flame-chart-card"
        style={{ '--fc-card-x': `${right ? hover.x - 12 : hover.x + 14}px`, '--fc-card-y': `${below ? hover.y + 14 : hover.y - 12}px` } as CSSProperties}
        className={cn(
          'pointer-events-none absolute top-(--fc-card-y) left-(--fc-card-x) z-10 w-max max-w-[300px] min-w-[180px] rounded-card bg-card px-[12px] py-[8px] shadow-popover',
          right && '-translate-x-full', !below && '-translate-y-full',
        )}
      >
        {renderTooltip ? renderTooltip(hovered) : (
          <>
            <div className="truncate text-footnote leading-[18px] font-semibold text-foreground">{data.names[data.name[hovered]]}</div>
            <div className="truncate text-caption leading-[16px] text-muted-foreground">{lane?.title}{lane?.subtitle ? ` · ${lane.subtitle}` : ''}</div>
            <dl className="mt-[4px] grid grid-cols-[auto_1fr] gap-x-3 text-caption leading-[16px] tabular-nums">
              <dt className="text-muted-foreground">Duration</dt><dd className="text-foreground">{formatDuration(data.end[hovered] - data.start[hovered])}</dd>
              <dt className="text-muted-foreground">Self time</dt><dd className="text-foreground">{formatDuration(selfTime(data, hovered))}</dd>
              <dt className="text-muted-foreground">Starts at</dt><dd className="text-foreground">{formatTime(data.start[hovered], Math.max(1e-3, (data.end[hovered] - data.start[hovered]) / 100))}</dd>
            </dl>
            {fl ? (
              <div className="mt-[4px] flex gap-2 text-caption leading-[16px] font-medium">
                {fl & FLAME_ERROR ? <span className="text-destructive">Error</span> : null}
                {fl & FLAME_PENDING ? <span className="text-warning">Pending</span> : null}
                {fl & FLAME_WAITING ? <span className="text-muted-foreground">Waiting</span> : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  }

  const height = Math.max(120, Math.min(560, bodyTop + layout.total));
  const dataAttrs = { 'data-spans': count, 'data-selected': selected >= 0 ? selected : undefined };
  const root = usePart(handle, 'root', {}, {
    'aria-label': ariaLabel ?? (rest['aria-labelledby'] ? undefined : 'Flame chart'),
    'aria-describedby': [describedBy, descriptionId].filter(Boolean).join(' '),
    'aria-keyshortcuts': 'ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight + - 0 Home End PageUp PageDown Enter Escape',
    ...rest,
    ...dataAttrs,
    ref: rootRef,
    onPointerMove: handleHover,
    onPointerLeave: (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerLeave?.(e);
      pendingHover.current = null;
      setPointerAt(null);
    },
    className: cn(flameChartVariants({ frame }), className),
    style: { '--fc-height': `${height}px`, ...style } as CSSProperties,
    children: (
      <>
        <canvas ref={dataCanvas} aria-hidden data-slot="flame-chart-canvas" className="pointer-events-none absolute inset-0 size-full" />
        <canvas ref={overlayCanvas} aria-hidden data-slot="flame-chart-overlay" className="pointer-events-none absolute inset-0 size-full" />
        <span ref={tokenHolder} hidden>
          {TOKEN_NAMES.map((name) => <i key={name} data-token={name} className={TOKENS[name]} />)}
          <i ref={probe} />
        </span>
        <span id={descriptionId} hidden>
          {selected >= 0 ? `Selected: ${describe(selected)}.` : `${count} spans in ${data.lanes.length} lanes. Arrow keys select spans.`}
        </span>
        {card}
      </>
    ),
  }, 'div');
  return root;
}
