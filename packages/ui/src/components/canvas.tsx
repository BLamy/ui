'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useSyncExternalStore, type CSSProperties, type ReactNode, type Ref } from 'react';
import type { Viewport } from '@ui-sdk/core';
import { usePart, usePrimitive } from '@ui-sdk/react/primitive';
import { useContainerSize } from '@/lib/container';
import { toBoard, toScreen, type Frame, type Guide, type Handle, type Pt, type Rect } from '@/lib/canvas-math';
import { canvas, miniMapLayout, type CanvasController, type CanvasOptions, type CanvasPointerInfo } from '@/lib/canvas-primitive';
import { cn } from '@/lib/utils';

export { createCanvasController } from '@/lib/canvas-primitive';
export type { CanvasController, CanvasFitOptions, CanvasPointerInfo, CanvasViewportChangeDetails, CanvasViewportReason } from '@/lib/canvas-primitive';
export type { Viewport };

/* ══ Canvas — an infinite, pannable, zoomable surface ══
   The canvas owns *navigation*, on UI SDK's viewport (the canvas primitive): scroll pans, pinch or ⌘-scroll zooms, hold
   Space (or use the middle button, or set `panning`) to drag the view, + − 0 and ⌘ + − 0 1 zoom in, out, fit and 100%,
   arrow keys you don't use pan, focus brings a board item into view, find in page pans to its match, and a dotted or
   ruled background follows the view. Everything else is yours: it hands you the pointer with the point already in board
   coordinates, so selection, dragging, drawing and connecting can be one state machine that does not care about the view.

     <Canvas viewport={viewport} onViewportChange={setViewport} onCanvasPointerDown={(e, { board }) => …}>
       {items.map((it) => <Card key={it.id} style={{ left: it.x, top: it.y }} />)}   // board units, scaled by the view
       <CanvasFrame frame={selected} />                                                // selection outline, constant on screen
     </Canvas>

   Children live in the *board layer* (one element moved and scaled by the view); `overlay` is drawn on top in screen
   space (an empty state, a `CanvasMiniMap`). `useCanvas()` gives children the zoom, the conversions and the controller's
   methods; `createCanvasController()` gives them to code outside it (a toolbar's zoom buttons). The overlay parts
   (`CanvasFrame`, `CanvasHandles`, `CanvasMarquee`, `CanvasGuides`) keep their lines the same thickness on screen at any
   zoom. The frame math (`toBoard`, `resizeFrame`, `snapMove` …) is in `@/lib/canvas-math`.

   A child can take presses before the host with `useCanvas().addPointerLayer(layer)`: that is how a `PencilCanvas`
   rendered inside a Canvas becomes its drawing layer (ink in board units, under the same pan and zoom). The resting
   cursor is the caller's (`className="cursor-crosshair"`, or `style` for one that changes); grab and grabbing win while
   the view is dragged. */

export interface CanvasProps extends CanvasOptions {
  /** The pattern behind the board (default `dots`). */
  background?: 'dots' | 'grid' | 'none';
  'aria-label'?: string;
  ref?: Ref<HTMLDivElement>;
  /** Drawn over the canvas in screen space, not scaled. */
  overlay?: ReactNode;
  /** The board layer: in board units, moved and scaled by the view. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** A child that takes presses before the host (`useCanvas().addPointerLayer`): a drawing layer, say. */
export interface CanvasPointerLayer {
  /** A press the host would get (navigation presses never come here). Return `true` to take it: its moves and its
   *  release then come to the layer instead of `onCanvasPointerMove` / `onCanvasPointerUp`. */
  onPointerDown: (event: PointerEvent, info: CanvasPointerInfo) => boolean;
  onPointerMove?: (event: PointerEvent, info: CanvasPointerInfo) => void;
  onPointerUp?: (event: PointerEvent, info: CanvasPointerInfo) => void;
  /** The view took the pointer over (a second finger began a pinch): drop what the press started. */
  onCancel?: () => void;
}

export interface CanvasContextValue extends Omit<CanvasController, 'getViewport'> {
  viewport: Viewport;
  /** The view's zoom: divide a screen length by it to get board units. */
  zoom: number;
  /** The canvas's size in px. */
  size: { width: number; height: number };
  /** A pointer event's position in the canvas's own pixels. */
  local: (e: { clientX: number; clientY: number }) => Pt;
  /** A pointer event's position in board units. */
  toBoard: (e: { clientX: number; clientY: number }) => Pt;
  /** A board point in the canvas's own pixels, the partner of `local` (`toScreen` gives client pixels). */
  toLocal: (p: Pt) => Pt;
  /** Lets a child take presses before the host; returns the cleanup. The last one added is asked first. */
  addPointerLayer: (layer: CanvasPointerLayer) => () => void;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

/** The view, zoom, conversions and view controls of the nearest `<Canvas>`. With `{ optional: true }` it returns
 *  `null` outside one, for a part that works on a Canvas and on its own. */
export function useCanvas(): CanvasContextValue;
export function useCanvas(options: { optional: true }): CanvasContextValue | null;
export function useCanvas(options?: { optional?: boolean }): CanvasContextValue | null {
  const value = useContext(CanvasContext);
  if (!value && !options?.optional) throw new Error('useCanvas must be used within <Canvas>');
  return value;
}

export function Canvas({
  viewport, defaultViewport, onViewportChange, panning, fit, minZoom, maxZoom, message, autoFocus,
  onCanvasPointerDown, onCanvasPointerMove, onCanvasPointerUp, onCanvasDoubleClick, onNavigationStart, onCanvasKeyDown, controller,
  background = 'dots', 'aria-label': ariaLabel = 'Canvas', overlay, children, className, style, ref: refProp,
}: CanvasProps) {
  // Pointer layers ask for a press before the host; a press one takes stays with it until the pointer lifts.
  const layers = useRef<CanvasPointerLayer[]>([]);
  const claimed = useRef(new Map<number, CanvasPointerLayer>());
  const addPointerLayer = useCallback((layer: CanvasPointerLayer) => {
    layers.current = [...layers.current, layer];
    return () => {
      layers.current = layers.current.filter((l) => l !== layer);
      for (const [id, l] of claimed.current) if (l === layer) claimed.current.delete(id);
    };
  }, []);
  const handle = usePrimitive(canvas, {
    viewport, defaultViewport, onViewportChange, panning, fit, minZoom, maxZoom, message, autoFocus, onCanvasDoubleClick, onCanvasKeyDown, controller,
    onCanvasPointerDown: (event, info) => {
      for (const layer of [...layers.current].reverse()) {
        if (layer.onPointerDown(event, info)) { claimed.current.set(event.pointerId, layer); return; }
      }
      onCanvasPointerDown?.(event, info);
    },
    onCanvasPointerMove: (event, info) => {
      const layer = claimed.current.get(event.pointerId);
      if (layer) layer.onPointerMove?.(event, info);
      else onCanvasPointerMove?.(event, info);
    },
    onCanvasPointerUp: (event, info) => {
      const layer = claimed.current.get(event.pointerId);
      claimed.current.delete(event.pointerId);
      if (layer) layer.onPointerUp?.(event, info);
      else onCanvasPointerUp?.(event, info);
    },
    onNavigationStart: () => {
      for (const layer of new Set(claimed.current.values())) layer.onCancel?.();
      claimed.current.clear();
      onNavigationStart?.();
    },
  });
  const { instance, api } = handle;
  // The background, the overlay parts and the minimap follow the view as it moves; the board's transform is live.
  const subscribe = useCallback((listener: () => void) => instance.subscribe(listener), [instance]);
  const read = useCallback(() => instance.get(), [instance]);
  const state = useSyncExternalStore(subscribe, read, read);
  const view = viewport ?? state.viewport;
  const [ref, size] = useContainerSize<HTMLDivElement>({ width: 1000, height: 700 });
  // The measured root is also the caller's `ref`.
  const rootRef = useCallback((el: HTMLDivElement | null) => {
    ref.current = el;
    if (typeof refProp === 'function') refProp(el);
    else if (refProp) refProp.current = el;
  }, [ref, refProp]);

  const local = useCallback((e: { clientX: number; clientY: number }): Pt => {
    const r = ref.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }, [ref]);

  const bgStyle = useMemo<CSSProperties>(() => {
    if (background === 'none') return {};
    let step = (background === 'dots' ? 24 : 40) * view.zoom;
    while (step < 12) step *= 2;
    const ink = 'color-mix(in srgb, var(--muted-foreground) 34%, transparent)';
    const pos = `${view.x}px ${view.y}px`;
    return background === 'dots'
      ? { backgroundImage: `radial-gradient(${ink} 1.1px, transparent 1.4px)`, backgroundSize: `${step}px ${step}px`, backgroundPosition: pos }
      : { backgroundImage: `linear-gradient(to right, ${ink} 1px, transparent 1px), linear-gradient(to bottom, ${ink} 1px, transparent 1px)`, backgroundSize: `${step}px ${step}px`, backgroundPosition: pos };
  }, [background, view.x, view.y, view.zoom]);

  const value = useMemo<CanvasContextValue>(() => ({
    viewport: view, zoom: view.zoom, size, local,
    toBoard: (e) => { const s = local(e); return toBoard(view, s.x, s.y); },
    toLocal: (p) => toScreen(view, p), toScreen: api.toScreen, toCanvas: api.toCanvas, visible: api.visible,
    setViewport: api.setViewport, panBy: api.panBy, zoomTo: api.zoomTo, zoomBy: api.zoomBy, fit: api.fit, reveal: api.reveal,
    addPointerLayer,
  }), [view, size, local, api, addPointerLayer]);

  // Dragging the view shows the hand over any resting cursor the caller set (a class or `style`).
  const grab = state.grabbing ? 'cursor-grabbing!' : state.spaceHeld || panning ? 'cursor-grab!' : undefined;
  const board = usePart(handle, 'board', {}, { className: 'pointer-events-auto absolute top-0 left-0 text-foreground', children }, 'div');
  const pane = usePart(handle, 'pane', {}, { className: 'pointer-events-none absolute inset-0 touch-none overflow-scroll [scrollbar-width:none]', children: board }, 'div');
  const root = usePart(handle, 'root', {}, {
    ref: rootRef,
    'aria-label': ariaLabel,
    // The focus ring is an overlay above the board, inset so it never shifts or clips.
    className: cn(
      'absolute inset-0 cursor-default touch-none overflow-clip bg-background outline-none select-none',
      'after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset',
      className,
      grab,
    ),
    style: { ...bgStyle, ...style },
    children: <>{pane}{overlay}</>,
  }, 'div');
  return <CanvasContext.Provider value={value}>{root}</CanvasContext.Provider>;
}

/* ── Overlay parts: lines and handles that keep their thickness on screen at any zoom ──
   They divide by the board's `--canvas-zoom` (the viewport's live style writes it on the board layer), so a pan or a
   zoom restyles them in CSS and never renders them again. */

/** Screen pixels as board units, under the board's scale. */
const px = (n: number) => `calc(${n}px / var(--canvas-zoom, 1))`;

const HANDLE_PX = 10;

/** What every overlay part takes besides its geometry: classes and styles merged after its own. */
interface OverlayPartProps {
  className?: string;
  style?: CSSProperties;
}

export interface CanvasFrameProps extends OverlayPartProps {
  frame: Frame;
  /** A dashed outline (a locked item). */
  dashed?: boolean;
  /** Air between the frame and its outline, in screen px (default 3). */
  offset?: number;
}

/** An outline around a (rotated) frame, in the theme's primary color. Put it in the board layer. */
export function CanvasFrame({ frame, dashed, offset = 3, className, style }: CanvasFrameProps) {
  return (
    <div
      data-slot="canvas-frame"
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute rounded-(--canvas-frame-radius) outline-(length:--canvas-frame-line) outline-offset-(--canvas-frame-offset) outline-primary',
        dashed ? 'outline-dashed' : 'outline-solid',
        className,
      )}
      style={{
        left: frame.x, top: frame.y, width: frame.w, height: frame.h,
        transform: frame.rot ? `rotate(${frame.rot}deg)` : undefined,
        '--canvas-frame-line': px(1.6), '--canvas-frame-offset': px(offset), '--canvas-frame-radius': px(2),
        ...style,
      } as CSSProperties}
    />
  );
}

export interface CanvasHandlesProps extends OverlayPartProps {
  /** From `frameHandles`, or your own (a connector's ends). */
  handles: Handle[];
}

/** Resize and rotate handles. Round for `rot`, `from` and `to`; `data-handle` names each one for styling. */
export function CanvasHandles({ handles, className, style }: CanvasHandlesProps) {
  return (
    <>
      {handles.map((h) => (
        <span
          key={h.id}
          data-slot="canvas-handle"
          data-handle={h.id}
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute size-(--canvas-handle) border-(length:--canvas-handle-line) border-solid border-primary bg-background',
            h.id === 'rot' || h.id === 'from' || h.id === 'to' ? 'rounded-full' : 'rounded-xs',
            className,
          )}
          style={{ left: `calc(${h.pt.x}px - ${px(HANDLE_PX / 2)})`, top: `calc(${h.pt.y}px - ${px(HANDLE_PX / 2)})`, '--canvas-handle': px(HANDLE_PX), '--canvas-handle-line': px(1.6), ...style } as CSSProperties}
        />
      ))}
    </>
  );
}

export interface CanvasMarqueeProps extends OverlayPartProps {
  rect: Rect;
}

/** The rubber band of a drag-select, in board units. */
export function CanvasMarquee({ rect, className, style }: CanvasMarqueeProps) {
  return (
    <span
      data-slot="canvas-marquee"
      aria-hidden="true"
      className={cn('pointer-events-none absolute border-(length:--canvas-marquee-line) border-solid border-primary bg-primary/10', className)}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, '--canvas-marquee-line': px(1), ...style } as CSSProperties}
    />
  );
}

export interface CanvasGuidesProps extends OverlayPartProps {
  /** From `snapMove`. */
  guides: Guide[];
}

/** Alignment guides drawn as hairlines. */
export function CanvasGuides({ guides, className, style }: CanvasGuidesProps) {
  return (
    <>
      {guides.map((g, i) => (
        <span
          key={i}
          data-slot="canvas-guide"
          aria-hidden="true"
          className={cn('pointer-events-none absolute bg-primary', className)}
          // A guide is a line along one axis: at least a screen pixel across.
          style={{ left: g.x1, top: g.y1, width: `max(${g.x2 - g.x1}px, ${px(1)})`, height: `max(${g.y2 - g.y1}px, ${px(1)})`, ...style }}
        />
      ))}
    </>
  );
}

/* ── MiniMap: the whole board in a corner, the view outlined; press or drag on it to move the view there ── */

export interface CanvasMiniMapItem extends Rect {
  id?: string;
  /** Fill class for the item's mark (default `fill-muted-foreground/35`); a selected item might be `fill-primary`. */
  className?: string;
}

export interface CanvasMiniMapProps {
  /** What's on the board, in board units: frames, cards, nodes. */
  items: readonly CanvasMiniMapItem[];
  /** The edge it sits on (default `bottom`). */
  side?: 'top' | 'bottom';
  /** Where along that edge (default `end`, the trailing corner; `start` is the leading one in either direction). */
  align?: 'start' | 'end';
  /** Its size in px (default 184 × 120). */
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
}

/** An overview of the board for `<Canvas overlay>`: every item as a mark and the view as an outline. Pressing or
 *  dragging on it centers the view there, and Escape during a drag puts the view back; the canvas keeps the keyboard
 *  (⌘0 fits, arrows pan). */
export function CanvasMiniMap({ items, side = 'bottom', align = 'end', width = 184, height = 120, className, style }: CanvasMiniMapProps) {
  const { viewport: v, size } = useCanvas();
  // The view in board units, and everything the map has to show: the items and the view.
  const view: Rect = { x: -v.x / v.zoom, y: -v.y / v.zoom, w: size.width / v.zoom, h: size.height / v.zoom };
  const { scale: k, offsetX: ox, offsetY: oy } = miniMapLayout(items, view, width, height);
  return usePart(canvas, 'minimap', { items, width, height }, {
    className: cn(
      'absolute z-10 cursor-pointer overflow-hidden rounded-ctl bg-popover/90 shadow-raised backdrop-blur-md',
      side === 'top' ? 'top-3' : 'bottom-3',
      align === 'start' ? 'start-3' : 'end-3',
      className,
    ),
    style: { width, height, ...style },
    children: (
      <svg width={width} height={height} className="block" data-side={side} data-align={align}>
        {items.map((it, i) => (
          <rect key={it.id ?? i} x={ox + it.x * k} y={oy + it.y * k} width={Math.max(1.5, it.w * k)} height={Math.max(1.5, it.h * k)} rx={1.5}
            className={it.className ?? 'fill-muted-foreground/35'} />
        ))}
        <rect data-slot="canvas-minimap-view" x={ox + view.x * k} y={oy + view.y * k} width={view.w * k} height={view.h * k} rx={2}
          className="fill-primary/8 stroke-primary" strokeWidth={1.5} />
      </svg>
    ),
  }, 'div');
}
