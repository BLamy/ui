import {
  announce,
  bindDrag,
  createChange,
  createController,
  createViewport,
  definePrimitive,
  live,
  type CanvasRect,
  type ChangeDetails,
  type ChangeOptions,
  type Viewport,
  type ViewportReason,
} from '@ui-sdk/core';
import { toBoard, type Pt, type Rect } from '@/lib/canvas-math';

/* ══ The canvas primitive: an infinite board on UI SDK's viewport ══
   Panning and zooming are `createViewport`: the wheel pans, Ctrl or ⌘ with the wheel and a trackpad pinch zoom at the
   pointer, a drag pans and two fingers pinch, focus brings a board item into view (`reveal`), and find in page pans to
   its match (`bindFindable` on the pane around the board). What this adds is a board that is also a drawing surface:
   a press on it is the host's (selection, drawing, connecting), unless it is a navigation press — the middle button,
   Space held, the hand tool (`panning`), or a second finger, which hands both fingers to the viewport's pinch. The zoom
   keys are the viewport's (+ − 0) plus a design tool's (⌘ + − 0 1: in, out, fit `fit`, 100%), announced in the zoom
   they leave; arrow keys the host leaves alone pan; the minimap takes a press and a drag (`bindDrag`). No React:
   `components/canvas.tsx` renders it. */

/** Why the view moved: the viewport's own reasons, arrow keys panning it (`move-key`), or a press (`track-press`) and a
 *  drag (`drag`) on the minimap. */
export type CanvasViewportReason = ViewportReason | 'move-key' | 'track-press';
export type CanvasViewportChangeDetails = ChangeDetails<CanvasViewportReason>;

/** Where a pointer is, for a press the canvas hands on. */
export interface CanvasPointerInfo {
  /** In the canvas's own pixels. */
  screen: Pt;
  /** In board units (the viewport undone). */
  board: Pt;
  viewport: Viewport;
}

/** Screen pixels on each side of a canvas: room a fit leaves for what floats over the board. */
export type CanvasInsets = { top?: number; right?: number; bottom?: number; left?: number };

export type CanvasFitOptions = {
  /** Screen pixels of air around the box, on every side or on each. Default the canvas's `fitPadding`, or 72. */
  padding?: number | CanvasInsets;
  /** How far in a fit may zoom. Default 1. */
  maxZoom?: number;
};

/** What a canvas controller and `useCanvas()` can do with the view. Methods that move it take an optional reason
 *  (`imperative` by default) and event, which reach `onViewportChange`'s details. */
export type CanvasController = {
  getViewport: () => Viewport;
  setViewport: (viewport: Viewport, options?: ChangeOptions<CanvasViewportReason>) => boolean;
  /** Pans by screen pixels. */
  panBy: (dx: number, dy: number, options?: ChangeOptions<CanvasViewportReason>) => boolean;
  /** Zooms to a scale, keeping the board point under `at` (client pixels; default the canvas's center) still. */
  zoomTo: (zoom: number, at?: Pt, options?: ChangeOptions<CanvasViewportReason>) => boolean;
  zoomBy: (factor: number, at?: Pt, options?: ChangeOptions<CanvasViewportReason>) => boolean;
  /** Shows a board box whole and centered (default the canvas's `fit`); none centers the origin at 100%. */
  fit: (rect?: Rect | null, fitOptions?: CanvasFitOptions, options?: ChangeOptions<CanvasViewportReason>) => boolean;
  /** Pans the least that brings a board box into view, with `padding` screen pixels around it (default 24). */
  reveal: (rect: Rect, revealOptions?: { padding?: number }, options?: ChangeOptions<CanvasViewportReason>) => boolean;
  /** A client point (a pointer's `clientX`, `clientY`) in board units. */
  toCanvas: (clientX: number, clientY: number) => Pt;
  /** A board point in client pixels. */
  toScreen: (point: Pt) => Pt;
  /** The board box on screen now. */
  visible: () => Rect;
};

/** A handle for a canvas: pass it as `controller`, then move its view from anywhere, like a toolbar's zoom buttons. */
export function createCanvasController() {
  return createController<CanvasController>();
}

export type CanvasOptions = {
  /** The view, to control it: a board point is on screen at `board * zoom + (x, y)`. */
  viewport?: Viewport;
  defaultViewport?: Viewport;
  /** Runs when the view wants to move; `details.reason` says why (`wheel`, `drag`, `pinch`, `zoom-key`, `move-key`,
   *  `focus-in`, `find-in-page`, `track-press`, `imperative`) and `details.cancel()` stops it. */
  onViewportChange?: (viewport: Viewport, details: CanvasViewportChangeDetails) => void;
  /** A press with the primary button drags the view (a hand tool). The middle button and Space always do. */
  panning?: boolean;
  /** What ⌘0 and `fit()` show (the bounds of your content); none centers the origin. */
  fit?: Rect | null;
  /** How much air ⌘0 and `fit()` leave around `fit`, in screen px (default 72): on every side, or on each (a side left
   *  out gets 72), for a toolbar or a bar floating over one edge. */
  fitPadding?: number | CanvasInsets;
  /** Default 0.02: far enough out for a map of a hundred screens. */
  minZoom?: number;
  /** Default 4. */
  maxZoom?: number;
  /** What a screen reader hears after a zoom key. Default "Zoom 150%". */
  message?: (zoom: number) => string;
  /** Focus the canvas once it mounts, so keys work before a click. */
  autoFocus?: boolean;
  /** Whether the board writes its zoom as `--canvas-zoom`, which the overlay parts divide by (default true). A change to it
   *  restyles everything on the board, every frame of a zoom, so a board of thousands of items turns it off and writes
   *  it, in steps, around the parts that use it (as `Diagram` does). */
  zoomVariable?: boolean;
  /** A press that is not a navigation gesture. The canvas has captured the pointer. */
  onCanvasPointerDown?: (event: PointerEvent, info: CanvasPointerInfo) => void;
  /** Movement, hover included (no button down), unless the view is being panned or pinched. */
  onCanvasPointerMove?: (event: PointerEvent, info: CanvasPointerInfo) => void;
  onCanvasPointerUp?: (event: PointerEvent, info: CanvasPointerInfo) => void;
  onCanvasDoubleClick?: (event: MouseEvent, info: CanvasPointerInfo) => void;
  /** A second finger turned a press into a pinch: drop any gesture of your own that was in progress. */
  onNavigationStart?: () => void;
  /** Keys the canvas doesn't use itself (Space and the zoom keys are its own). Arrow keys you leave alone pan. */
  onCanvasKeyDown?: (event: KeyboardEvent) => void;
  controller?: CanvasController;
};

type CanvasState = {
  viewport: Viewport;
  /** Space is held: a press drags the view. */
  spaceHeld: boolean;
  /** The view is being dragged. */
  grabbing: boolean;
};

export type CanvasMiniMapLayout = { scale: number; offsetX: number; offsetY: number };

/** How a minimap of `width` × `height` px draws `items` and the `view` (board units): one scale, centered, with `pad`
 *  px of air. */
export function miniMapLayout(items: readonly Rect[], view: Rect, width: number, height: number, pad = 6): CanvasMiniMapLayout {
  let x0 = view.x, y0 = view.y, x1 = view.x + view.w, y1 = view.y + view.h;
  for (const it of items) {
    x0 = Math.min(x0, it.x); y0 = Math.min(y0, it.y);
    x1 = Math.max(x1, it.x + it.w); y1 = Math.max(y1, it.y + it.h);
  }
  const scale = Math.min((width - pad * 2) / Math.max(1, x1 - x0), (height - pad * 2) / Math.max(1, y1 - y0));
  return {
    scale,
    offsetX: pad + (width - pad * 2 - (x1 - x0) * scale) / 2 - x0 * scale,
    offsetY: pad + (height - pad * 2 - (y1 - y0) * scale) / 2 - y0 * scale,
  };
}

const ORIGIN: Viewport = { x: 0, y: 0, zoom: 1 };
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
/** The viewport's zoom keys (+ − 0, as `createViewport`'s `keydown`), and ⌘ with them as in a design tool: ⌘0 fits. */
const ZOOM_KEYS: Record<string, 'in' | 'out' | 'actual'> = { '+': 'in', '=': 'in', '-': 'out', _: 'out', '0': 'actual' };
const MOD_ZOOM_KEYS: Record<string, 'in' | 'out' | 'fit' | 'actual'> = { '+': 'in', '=': 'in', '-': 'out', '0': 'fit', '1': 'actual' };
/** Screen px an arrow key pans by; Shift pans four times as far. */
const PAN_STEP = 48;

const toCanvasRect = (r: Rect): CanvasRect => ({ left: r.x, top: r.y, right: r.x + r.w, bottom: r.y + r.h });
const fromCanvasRect = (r: CanvasRect): Rect => ({ x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top });

/** Typing inside the board (a note being edited) keeps its keys. */
const editable = (target: EventTarget | null) =>
  !!(target as Element | null)?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');

export const canvas = definePrimitive({
  name: 'canvas',
  options: {
    viewport: 'value', defaultViewport: 'value', onViewportChange: 'callback', panning: 'boolean', fit: 'value', fitPadding: 'value',
    minZoom: 'number', maxZoom: 'number', message: 'callback', autoFocus: 'boolean', zoomVariable: 'value',
    onCanvasPointerDown: 'callback', onCanvasPointerMove: 'callback', onCanvasPointerUp: 'callback',
    onCanvasDoubleClick: 'callback', onNavigationStart: 'callback', onCanvasKeyDown: 'callback', controller: 'value',
  },
  controlled: ['viewport'],
  state: (options: CanvasOptions): CanvasState => ({
    viewport: options.viewport ?? options.defaultViewport ?? ORIGIN,
    spaceHeld: false,
    grabbing: false,
  }),
  sync: (options) => (options.viewport ? { viewport: options.viewport } : {}),
  live: ['viewport'],
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const root = () => context.element('root');
    // The last view asked for: a controlled view is still the old one until the app passes the new one back.
    let asked: Viewport | null = null;
    const viewport = createViewport<CanvasState>(context, {
      key: 'viewport',
      surface: root,
      set: (value, details) => {
        asked = value;
        return change('viewport', value, details);
      },
      minZoom: () => context.options().minZoom ?? 0.02,
      maxZoom: () => context.options().maxZoom ?? 4,
    });
    const say = () => {
      const zoom = (asked ?? viewport.get()).zoom;
      announce(context.options().message?.(zoom) ?? `Zoom ${Math.round(zoom * 100)}%`);
    };

    /** A pointer in the canvas's own pixels, in board units, and the view. */
    const info = (event: { clientX: number; clientY: number }): CanvasPointerInfo => {
      const box = root()?.getBoundingClientRect();
      const screen = { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
      const now = viewport.get();
      return { screen, board: toBoard(now, screen.x, screen.y), viewport: now };
    };

    // Touches on the board, where they last were, so a second finger can hand the first to the pinch.
    const touches = new Map<number, Pt>();
    // The pointers the viewport has (a pan or a pinch): the host hears nothing of them.
    const navigating = new Set<number>();
    const inMiniMap = (event: Event) => !!(event.target as Element | null)?.closest?.('[data-slot="canvas-minimap"]');
    const navigate = (event: PointerEvent) => {
      navigating.add(event.pointerId);
      store.set({ grabbing: true });
      viewport.pointerdown(event);
    };
    const lift = (event: PointerEvent) => {
      touches.delete(event.pointerId);
      if (!navigating.delete(event.pointerId)) return false;
      if (!navigating.size) store.set({ grabbing: false });
      return true;
    };

    const api = {
      getViewport: () => viewport.get(),
      setViewport: (value: Viewport, { reason = 'imperative', event }: ChangeOptions<CanvasViewportReason> = {}) =>
        viewport.setViewport(value, { reason: reason as ViewportReason, event }),
      panBy: (dx: number, dy: number, { reason = 'imperative', event }: ChangeOptions<CanvasViewportReason> = {}) =>
        viewport.panBy(dx, dy, { reason: reason as ViewportReason, event }),
      zoomTo: (zoom: number, at?: Pt, { reason = 'imperative', event }: ChangeOptions<CanvasViewportReason> = {}) =>
        viewport.zoomTo(zoom, at, { reason: reason as ViewportReason, event }),
      zoomBy: (factor: number, at?: Pt, { reason = 'imperative', event }: ChangeOptions<CanvasViewportReason> = {}) =>
        viewport.zoomBy(factor, at, { reason: reason as ViewportReason, event }),
      fit(rect?: Rect | null, { padding = context.options().fitPadding ?? 72, maxZoom = 1 }: CanvasFitOptions = {}, { reason = 'imperative', event }: ChangeOptions<CanvasViewportReason> = {}) {
        const box = rect === undefined ? context.options().fit : rect;
        const details = { reason: reason as ViewportReason, event };
        if (!box || box.w <= 0 || box.h <= 0) {
          const frame = root()?.getBoundingClientRect();
          return viewport.setViewport({ x: (frame?.width ?? 0) / 2, y: (frame?.height ?? 0) / 2, zoom: 1 }, details);
        }
        if (typeof padding === 'number') return viewport.fit(toCanvasRect(box), { padding, maxZoom }, details);
        // A side each: centered in the room the insets leave.
        const frame = root()?.getBoundingClientRect();
        const pad = { top: 72, right: 72, bottom: 72, left: 72, ...padding };
        const w = Math.max(1, (frame?.width ?? 0) - pad.left - pad.right), h = Math.max(1, (frame?.height ?? 0) - pad.top - pad.bottom);
        const min = context.options().minZoom ?? 0.02, max = Math.min(maxZoom, context.options().maxZoom ?? 4);
        const zoom = Math.max(min, Math.min(max, w / box.w, h / box.h));
        return viewport.setViewport({ zoom, x: pad.left + w / 2 - (box.x + box.w / 2) * zoom, y: pad.top + h / 2 - (box.y + box.h / 2) * zoom }, details);
      },
      reveal: (rect: Rect, revealOptions?: { padding?: number }, { reason = 'focus-in', event }: ChangeOptions<CanvasViewportReason> = {}) =>
        viewport.reveal(toCanvasRect(rect), revealOptions, { reason: reason as ViewportReason, event }),
      toCanvas: (clientX: number, clientY: number) => viewport.toCanvas(clientX, clientY),
      toScreen: (point: Pt) => viewport.toScreen(point),
      visible: () => fromCanvasRect(viewport.visible()),
      internal: {
        viewport,
        /** The world's style: one transform for the whole board, and its zoom as `--canvas-zoom` unless that's off. */
        style: (state: CanvasState) => {
          const style = viewport.style(state);
          return context.options().zoomVariable === false ? style.replace(/;?--canvas-zoom:[^;]*/, '') : style;
        },
        bindFindable: (el: HTMLElement) => viewport.bindFindable(el),
        mount(el: HTMLElement) {
          if (context.options().autoFocus) el.focus({ preventScroll: true });
        },
        wheel: (event: WheelEvent) => viewport.wheel(event),
        pointerdown(event: PointerEvent) {
          const el = root();
          if (!el || inMiniMap(event)) return;
          // Focus for the keys, not for the ring: a pointer press never shows the keyboard focus ring.
          el.focus({ preventScroll: true, focusVisible: false });
          const point = { x: event.clientX, y: event.clientY };
          if (navigating.size) {
            // Another finger joins a pinch or a pan.
            if (event.pointerType === 'touch') {
              touches.set(event.pointerId, point);
              navigate(event);
            }
            return;
          }
          if (event.pointerType === 'touch') {
            touches.set(event.pointerId, point);
            if (touches.size === 2) {
              context.options().onNavigationStart?.();
              // The first finger is already down, as the host's press: the viewport takes it over where it is now.
              for (const [pointerId, at] of touches) {
                if (pointerId === event.pointerId) continue;
                const View = el.ownerDocument.defaultView?.PointerEvent;
                if (View) navigate(new View('pointerdown', { pointerId, pointerType: 'touch', clientX: at.x, clientY: at.y, isPrimary: true }));
              }
              navigate(event);
              return;
            }
          }
          if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1) return;
          const { spaceHeld } = store.get();
          if (event.button === 1 || spaceHeld || context.options().panning) {
            navigate(event);
            return;
          }
          try {
            el.setPointerCapture(event.pointerId);
          } catch {
            // A synthetic press has no live pointer to capture.
          }
          context.options().onCanvasPointerDown?.(event, info(event));
        },
        pointermove(event: PointerEvent) {
          if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (navigating.has(event.pointerId) || inMiniMap(event)) return;
          context.options().onCanvasPointerMove?.(event, info(event));
        },
        pointerup(event: PointerEvent) {
          if (lift(event) || inMiniMap(event)) return;
          context.options().onCanvasPointerUp?.(event, info(event));
        },
        pointercancel(event: PointerEvent) {
          if (lift(event) || inMiniMap(event)) return;
          context.options().onCanvasPointerUp?.(event, info(event));
        },
        dblclick(event: MouseEvent) {
          if (inMiniMap(event)) return;
          context.options().onCanvasDoubleClick?.(event, info(event));
        },
        keydown(event: KeyboardEvent) {
          const el = root();
          if (!editable(event.target)) {
            const mod = event.metaKey || event.ctrlKey;
            const zoomKey = event.altKey ? undefined : (mod ? MOD_ZOOM_KEYS : ZOOM_KEYS)[event.key];
            if (zoomKey) {
              event.preventDefault();
              const details = { reason: 'zoom-key' as const, event };
              const moved = zoomKey === 'fit' ? api.fit(undefined, undefined, details)
                : zoomKey === 'actual' ? viewport.zoomTo(1, undefined, details)
                : viewport.zoomBy(zoomKey === 'in' ? 1.25 : 0.8, undefined, details);
              if (moved) say();
              return;
            }
            if (event.key === ' ' && !mod) {
              event.preventDefault();
              if (!store.get().spaceHeld) store.set({ spaceHeld: true });
              return;
            }
          }
          context.options().onCanvasKeyDown?.(event);
          const arrow = ARROWS[event.key];
          if (arrow && event.target === el && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            const step = PAN_STEP * (event.shiftKey ? 4 : 1);
            viewport.panBy(arrow[0] * step, arrow[1] * step, { reason: 'move-key' as ViewportReason, event });
          }
        },
        keyup(event: KeyboardEvent) {
          if (event.key === ' ' && store.get().spaceHeld) store.set({ spaceHeld: false });
        },
        focusout() {
          if (store.get().spaceHeld) store.set({ spaceHeld: false });
        },
        /** A board item took focus: bring it into view. */
        focusin(event: FocusEvent) {
          const target = event.target as Element | null;
          const world = context.element('board');
          if (!target || target === root() || !world?.contains(target)) return;
          viewport.reveal(viewport.rectOf(target), { padding: 24 }, { reason: 'focus-in', event });
        },
        /** A press on the minimap moves the view there; dragging keeps moving it, and Escape puts it back. */
        minimapdown(el: HTMLElement, event: PointerEvent, props: { items?: readonly Rect[]; width?: number; height?: number }) {
          if (event.button !== 0) return;
          event.preventDefault();
          const frame = root()?.getBoundingClientRect();
          if (!frame) return;
          const before = viewport.get();
          // The map keeps the scale the press began with, so it doesn't rescale under the pointer.
          const map = miniMapLayout(props.items ?? [], api.visible(), props.width ?? 184, props.height ?? 120);
          const centerOn = (clientX: number, clientY: number, reason: CanvasViewportReason, cause: Event) => {
            const box = el.getBoundingClientRect();
            const bx = (clientX - box.left - map.offsetX) / map.scale;
            const by = (clientY - box.top - map.offsetY) / map.scale;
            const { zoom } = viewport.get();
            viewport.setViewport({ x: frame.width / 2 - bx * zoom, y: frame.height / 2 - by * zoom, zoom }, { reason: reason as ViewportReason, event: cause });
          };
          centerOn(event.clientX, event.clientY, 'track-press', event);
          bindDrag(el, event, {
            onMove: ({ x, y, event: move }) => centerOn(x, y, 'drag', move),
            onEnd: (end, canceled) => {
              if (canceled) viewport.setViewport(before, { reason: 'drag', event: end });
            },
            cancelOnEscape: true,
          });
        },
      },
    };
    return api;
  },
  slots: (slot) => ({
    // The frame: it clips the board and takes the gestures. A canvas passes its keys through to the page, as an application.
    root: slot({
      role: 'application',
      attrs: (state) => ({
        tabindex: '0',
        'aria-roledescription': 'canvas',
        'data-panning': state.spaceHeld ? '' : undefined,
        'data-grabbing': state.grabbing ? '' : undefined,
      }),
      state: (state) => ({ spaceHeld: state.spaceHeld, grabbing: state.grabbing }),
      bind: (el, { api }) => api.internal.mount(el),
      on: {
        wheel: (event, { api }) => api.internal.wheel(event),
        pointerdown: (event, { api }) => api.internal.pointerdown(event),
        pointermove: (event, { api }) => api.internal.pointermove(event),
        pointerup: (event, { api }) => api.internal.pointerup(event),
        pointercancel: (event, { api }) => api.internal.pointercancel(event),
        dblclick: (event, { api }) => api.internal.dblclick(event),
        keydown: (event, { api }) => api.internal.keydown(event),
        keyup: (event, { api }) => api.internal.keyup(event),
        focusin: (event, { api }) => api.internal.focusin(event),
        focusout: (_event, { api }) => api.internal.focusout(),
      },
    }),
    // Fills the frame and scrolls (programmatically: its overflow is hidden), so find in page and focus can bring board items
    // into view; it holds only the board. Not a tab stop: the canvas is the one stop, and it pans.
    pane: slot({
      attrs: () => ({ tabindex: '-1' }),
      bind: (el, { api }) => api.internal.bindFindable(el),
    }),
    // Everything on the board, moved and scaled by one transform; `--canvas-zoom` is the scale.
    board: slot({
      live: live((state, { api }) => ({ style: api.internal.style(state) })),
    }),
    minimap: slot<{ items?: readonly Rect[]; width?: number; height?: number }>({
      props: { items: 'value', width: 'number', height: 'number' },
      attrs: () => ({ 'aria-hidden': 'true' }),
      on: {
        pointerdown: (event, { el, api, props }) => {
          if (el) api.internal.minimapdown(el, event, props);
        },
      },
    }),
  }),
  agent: { actions: ['setViewport', 'panBy', 'zoomBy', 'zoomTo', 'fit'] },
});
