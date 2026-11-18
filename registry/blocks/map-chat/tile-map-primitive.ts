import {
  announce,
  createChange,
  createViewport,
  definePrimitive,
  dragThreshold,
  type ChangeDetails,
  type Viewport,
  type ViewportReason,
} from '@brett_lamy/ui/sdk/core';

/* ══ The tile map's navigation, on UI SDK's viewport ══
   The map is a canvas whose units are Web Mercator pixels at zoom level 0 (the world is 256 across), so the viewport's
   `zoom` is `2 ** level` and its `x`, `y` place that world in the frame. `createViewport` does the gestures: the wheel
   or two fingers pan, Ctrl or ⌘ with the wheel and a trackpad pinch zoom at the pointer, a drag pans and two fingers
   pinch. What a map adds:
   - Presses are taps until they move past UI SDK's `dragThreshold`: a press on a pin stays the pin's click, a press on
     the bare map is `onTap`, and only a press that moves becomes the viewport's drag (the press is handed over where it
     began). A second finger hands both to the viewport's pinch.
   - Keys on the focused map: the arrows pan (Shift pans further), + and − zoom one level, and 0 is `onHome` (back to
     the map's own view). Each zoom key is announced as the level it leaves the map at.
   No React: `tile-map.tsx` renders it, and keeps the camera (center and level) the viewport is derived from. */

/** Why the camera moved: the viewport's reasons, or an arrow key (`move-key`). */
export type TileMapViewportReason = ViewportReason | 'move-key';
export type TileMapViewportChangeDetails = ChangeDetails<TileMapViewportReason>;

export type TileMapOptions = {
  /** The viewport, always controlled: the map derives it from its camera. */
  viewport?: Viewport;
  /** The viewport wants to move; `details.reason` says why. */
  onViewportChange?: (viewport: Viewport, details: TileMapViewportChangeDetails) => void;
  /** Gestures and keys are on. */
  interactive?: boolean;
  /** As viewport zooms (`2 ** level`). */
  minZoom?: number;
  maxZoom?: number;
  /** A press on the map (not a pin, not the map's own controls) that lifted without moving it. */
  onTap?: (event: PointerEvent) => void;
  /** What the 0 key does: the map's own view again. */
  onHome?: () => void;
};

type TileMapState = {
  viewport: Viewport;
  /** A drag or a pinch is moving the map. */
  grabbing: boolean;
  /** From the option: gestures and keys are on. */
  interactive: boolean;
};

/** Screen px an arrow key pans by; Shift pans four times as far. */
const PAN_STEP = 64;
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

/** What the focused map's `on.keydown` handles. */
const MAP_KEYS = [
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'shift+ArrowLeft', 'shift+ArrowRight', 'shift+ArrowUp', 'shift+ArrowDown',
  '+', '=', '-', '_', '0',
] as const;

/** The map's own controls (zoom buttons, attribution) keep their presses. */
const inMapUi = (event: Event) => !!(event.target as Element | null)?.closest?.('[data-map-ui]');
const onPin = (event: Event) => !!(event.target as Element | null)?.closest?.('[data-pin]');

export const tileMap = definePrimitive({
  name: 'tile-map',
  options: {
    viewport: 'value', onViewportChange: 'callback', interactive: 'boolean', minZoom: 'number', maxZoom: 'number',
    onTap: 'callback', onHome: 'callback',
  },
  controlled: ['viewport'],
  state: (options: TileMapOptions): TileMapState => ({
    viewport: options.viewport ?? { x: 0, y: 0, zoom: 1 },
    grabbing: false,
    interactive: options.interactive !== false,
  }),
  sync: (options) => ({ interactive: options.interactive !== false, ...(options.viewport ? { viewport: options.viewport } : {}) }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const root = () => context.element('root');
    const viewport = createViewport<TileMapState>(context, {
      key: 'viewport',
      surface: root,
      set: (value, details) => change('viewport', value, details),
      minZoom: () => context.options().minZoom ?? 8,
      maxZoom: () => context.options().maxZoom ?? 65536,
    });
    const interactive = () => store.get().interactive;

    // A press that has not moved yet: still a tap (or a pin's click), so the pointer is not captured.
    let pending: PointerEvent | null = null;
    // The pointers the viewport has (a pan or a pinch).
    const navigating = new Set<number>();
    const navigate = (event: PointerEvent) => {
      navigating.add(event.pointerId);
      store.set({ grabbing: true });
      viewport.pointerdown(event);
    };
    const lift = (event: PointerEvent) => {
      if (pending?.pointerId === event.pointerId) pending = null;
      if (navigating.delete(event.pointerId) && !navigating.size) store.set({ grabbing: false });
    };
    const zoomKey = (event: KeyboardEvent, factor: number) => {
      event.preventDefault();
      if (viewport.zoomBy(factor, undefined, { reason: 'zoom-key', event })) {
        announce(`Zoom level ${Math.round(Math.log2(viewport.get().zoom))}`);
      }
    };

    const api = {
      getViewport: () => viewport.get(),
      panBy: (dx: number, dy: number) => viewport.panBy(dx, dy, { reason: 'imperative' }),
      zoomBy: (factor: number) => viewport.zoomBy(factor, undefined, { reason: 'imperative' }),
      internal: {
        wheel(event: WheelEvent) {
          if (interactive() && !inMapUi(event)) viewport.wheel(event);
        },
        pointerdown(event: PointerEvent) {
          if (!interactive() || inMapUi(event)) return;
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          if (navigating.size) {
            // Another finger joins the pan: a pinch.
            if (event.pointerType === 'touch') navigate(event);
            return;
          }
          if (pending && event.pointerType === 'touch') {
            // A second finger before the first moved: both go to the pinch, the first from where it pressed.
            const first = pending;
            pending = null;
            navigate(first);
            navigate(event);
            return;
          }
          if (!onPin(event)) root()?.focus({ preventScroll: true });
          pending = event;
        },
        pointermove(event: PointerEvent) {
          const down = pending;
          if (!down || down.pointerId !== event.pointerId) return;
          if (Math.abs(event.clientX - down.clientX) < dragThreshold && Math.abs(event.clientY - down.clientY) < dragThreshold) return;
          pending = null;
          navigate(down);
        },
        pointerup(event: PointerEvent) {
          const tap = pending?.pointerId === event.pointerId;
          lift(event);
          if (tap && !onPin(event) && !inMapUi(event)) context.options().onTap?.(event);
        },
        pointercancel(event: PointerEvent) {
          lift(event);
        },
        keydown(event: KeyboardEvent) {
          if (!interactive() || event.altKey || event.ctrlKey || event.metaKey) return;
          if (event.key === '+' || event.key === '=') return zoomKey(event, 2);
          if (event.key === '-' || event.key === '_') return zoomKey(event, 0.5);
          if (event.key === '0' && context.options().onHome) {
            event.preventDefault();
            context.options().onHome?.();
            return;
          }
          const arrow = ARROWS[event.key];
          if (arrow && event.target === root()) {
            event.preventDefault();
            const step = PAN_STEP * (event.shiftKey ? 4 : 1);
            // Not the viewport's own reason, so the pan goes straight to the change rather than through `panBy`.
            const { x, y, zoom } = viewport.get();
            change('viewport', { x: x + arrow[0] * step, y: y + arrow[1] * step, zoom }, { reason: 'move-key', event });
          }
        },
      },
    };
    return api;
  },
  slots: (slot) => ({
    // The frame: it clips the map and takes the gestures. Focused, it passes its keys through as an application.
    root: slot({
      role: 'application',
      focus: (state) => (state.interactive ? 'tab-stop' : { none: 'Not interactive: the map is a picture.' }),
      keys: (state) => (state.interactive ? MAP_KEYS : []),
      attrs: (state) => ({
        tabindex: state.interactive ? '0' : undefined,
        'aria-roledescription': 'map',
        'data-dragging': state.grabbing ? '' : undefined,
      }),
      state: (state) => ({ grabbing: state.grabbing }),
      on: {
        wheel: (event, { api }) => api.internal.wheel(event),
        pointerdown: (event, { api }) => api.internal.pointerdown(event),
        pointermove: (event, { api }) => api.internal.pointermove(event),
        pointerup: (event, { api }) => api.internal.pointerup(event),
        pointercancel: (event, { api }) => api.internal.pointercancel(event),
        keydown: (event, { api }) => api.internal.keydown(event),
      },
    }),
  }),
  agent: { actions: ['panBy', 'zoomBy'] },
});
