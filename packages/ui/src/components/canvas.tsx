'use client';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react';
import { useContainerSize } from '@/lib/container';
import { dist, fitCamera, toBoard, toScreen, zoomAt, type Camera, type Frame, type Guide, type Handle, type Pt, type Rect } from '@/lib/canvas-math';
import { cn } from '@/lib/utils';

/* ══ Canvas — an infinite, pannable, zoomable surface ══
   The canvas owns *navigation*: scroll pans, pinch or ⌘-scroll zooms, hold Space (or use the middle button, or set
   `panning`) to drag the view, ⌘ + / − / 0 / 1 zoom in, out, fit and 100%, and a dotted or ruled background follows the
   camera. Everything else is yours: it hands you the pointer with the point already in board coordinates, so selection,
   dragging, drawing and connecting can be one state machine that does not care about the camera.

     <Canvas camera={camera} onCameraChange={setCamera} onCanvasPointerDown={(e, { board }) => …}>
       {items.map((it) => <Card key={it.id} style={{ left: it.x, top: it.y }} />)}   // board units, scaled by the camera
       <CanvasFrame frame={selected} />                                                // selection outline, constant on screen
     </Canvas>

   Children live in the *board layer* (a div translated and scaled by the camera); `overlay` is drawn on top in screen
   space (an empty state, a minimap). `useCanvas()` gives children the zoom and the coordinate conversions, and the
   overlay parts (`CanvasFrame`, `CanvasHandles`, `CanvasMarquee`, `CanvasGuides`) keep their lines the same thickness on
   screen at any zoom. The math (`toBoard`, `zoomAt`, `resizeFrame`, `snapMove` …) is in `@/lib/canvas-math`. */

export interface CanvasPointerInfo {
  /** The pointer in the canvas's own pixels. */
  screen: Pt;
  /** The pointer in board units (the camera undone). */
  board: Pt;
  camera: Camera;
}

export interface CanvasProps {
  /** Controlled camera: a screen point is `board * z + (x, y)`. */
  camera?: Camera;
  defaultCamera?: Camera;
  onCameraChange?: (camera: Camera) => void;
  /** The pattern behind the board (default `dots`). */
  background?: 'dots' | 'grid' | 'none';
  /** Drag the view with the primary button (a hand tool). The middle button and Space always do. */
  panning?: boolean;
  /** What ⌘0 fits the view to (the bounds of your content); empty centers the origin. */
  fit?: Rect | null;
  /** The cursor over the canvas when it is not being dragged (`grab` / `grabbing` take over while panning). */
  cursor?: string;
  /** Focus the canvas on mount, so keys work before a click. */
  autoFocus?: boolean;
  /** A press that is not a navigation gesture (pan, pinch). Capture is already set on the canvas. */
  onCanvasPointerDown?: (e: ReactPointerEvent, info: CanvasPointerInfo) => void;
  /** Movement, including hover (no button down), unless the view is being panned or pinched. */
  onCanvasPointerMove?: (e: ReactPointerEvent, info: CanvasPointerInfo) => void;
  onCanvasPointerUp?: (e: ReactPointerEvent, info: CanvasPointerInfo) => void;
  onCanvasDoubleClick?: (e: ReactMouseEvent, info: CanvasPointerInfo) => void;
  /** A two-finger pinch began: drop any gesture of your own that was in progress. */
  onNavigationStart?: () => void;
  /** Keys the canvas does not use itself (Space and the zoom keys are its own). */
  onCanvasKeyDown?: (e: ReactKeyboardEvent) => void;
  'aria-label'?: string;
  /** Drawn over the canvas in screen space, not scaled. */
  overlay?: ReactNode;
  /** The board layer: in board units, translated and scaled by the camera. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export interface CanvasContextValue {
  camera: Camera;
  /** The camera's zoom: divide a screen length by it to get board units. */
  zoom: number;
  /** The canvas's size in px. */
  size: { width: number; height: number };
  /** A pointer event's position in the canvas's own pixels. */
  local: (e: { clientX: number; clientY: number }) => Pt;
  /** A pointer event's position in board units. */
  toBoard: (e: { clientX: number; clientY: number }) => Pt;
  /** A board point in the canvas's own pixels. */
  toScreen: (p: Pt) => Pt;
  /** Move the camera (the updater sees the latest camera, so several calls in one event compose). */
  update: (fn: (c: Camera) => Camera) => void;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

/** The camera, zoom and conversions of the nearest `<Canvas>`. */
export function useCanvas(): CanvasContextValue {
  const value = useContext(CanvasContext);
  if (!value) throw new Error('useCanvas must be used within <Canvas>');
  return value;
}

type Nav = { k: 'pan'; sx: number; sy: number; cam: Camera } | { k: 'pinch'; d: number; mid: Pt };

const ORIGIN: Camera = { x: 0, y: 0, z: 1 };

export function Canvas({
  camera: controlled, defaultCamera = ORIGIN, onCameraChange, background = 'dots', panning, fit, cursor = 'default', autoFocus,
  onCanvasPointerDown, onCanvasPointerMove, onCanvasPointerUp, onCanvasDoubleClick, onNavigationStart, onCanvasKeyDown,
  'aria-label': ariaLabel = 'Canvas', overlay, children, className, style,
}: CanvasProps) {
  const [ref, size] = useContainerSize<HTMLDivElement>({ width: 1000, height: 700 });
  const [own, setOwn] = useState(defaultCamera);
  const camera = controlled ?? own;
  // The latest camera, written as soon as it changes, so several updates inside one event (a pinch's pan and zoom) compose.
  const cam = useRef(camera);
  cam.current = camera;
  const change = useRef(onCameraChange);
  change.current = onCameraChange;
  const update = useCallback((fn: (c: Camera) => Camera) => {
    const next = fn(cam.current);
    cam.current = next;
    setOwn(next);
    change.current?.(next);
  }, []);

  const touches = useRef(new Map<number, Pt>());
  const nav = useRef<Nav | null>(null);
  const [space, setSpace] = useState(false);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => { if (autoFocus) ref.current?.focus({ preventScroll: true }); }, [autoFocus, ref]);

  const local = useCallback((e: { clientX: number; clientY: number }): Pt => {
    const r = ref.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }, [ref]);
  const info = (s: Pt): CanvasPointerInfo => ({ screen: s, board: toBoard(cam.current, s.x, s.y), camera: cam.current });

  /* ── Pointer: pan and pinch are ours; the rest goes to you ── */
  const onPointerDown = (e: ReactPointerEvent) => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const s = local(e);
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, s);
      if (touches.current.size === 2) {
        const [a, b] = [...touches.current.values()];
        nav.current = { k: 'pinch', d: dist(a, b), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
        onNavigationStart?.();
        return;
      }
    }
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
    el.setPointerCapture(e.pointerId);
    if (e.button === 1 || space || panning) {
      nav.current = { k: 'pan', sx: s.x, sy: s.y, cam: cam.current };
      setGrabbing(true);
      return;
    }
    onCanvasPointerDown?.(e, info(s));
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const s = local(e);
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, s);
      const n = nav.current;
      if (n?.k === 'pinch' && touches.current.size >= 2) {
        const [a, b] = [...touches.current.values()];
        const d = dist(a, b), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        update((c) => {
          const zoomed = zoomAt(c, d / n.d, mid.x, mid.y);
          return { ...zoomed, x: zoomed.x + (mid.x - n.mid.x), y: zoomed.y + (mid.y - n.mid.y) };
        });
        nav.current = { k: 'pinch', d, mid };
        return;
      }
    }
    const n = nav.current;
    if (n?.k === 'pan') {
      update(() => ({ ...n.cam, x: n.cam.x + s.x - n.sx, y: n.cam.y + s.y - n.sy }));
      return;
    }
    onCanvasPointerMove?.(e, info(s));
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    touches.current.delete(e.pointerId);
    const n = nav.current;
    if (n?.k === 'pinch') {
      if (touches.current.size < 2) nav.current = null;
      return;
    }
    if (n?.k === 'pan') {
      nav.current = null;
      setGrabbing(false);
      return;
    }
    onCanvasPointerUp?.(e, info(local(e)));
  };

  /* ── Wheel: scroll pans, pinch (or ⌘-scroll) zooms. Non-passive so the page behind does not scroll. ── */
  const wheel = useRef<(e: WheelEvent) => void>(() => {});
  wheel.current = (e) => {
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 16 : 1;
    if (e.ctrlKey || e.metaKey) {
      const s = local(e);
      // A trackpad pinch sends small deltas; a mouse wheel's notch is big, so one event zooms by at most ~1.6×.
      update((c) => zoomAt(c, Math.exp(-Math.max(-50, Math.min(50, e.deltaY * scale)) * 0.009), s.x, s.y));
    } else update((c) => ({ ...c, x: c.x - e.deltaX * scale, y: c.y - e.deltaY * scale }));
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fn = (e: WheelEvent) => wheel.current(e);
    el.addEventListener('wheel', fn, { passive: false });
    return () => el.removeEventListener('wheel', fn);
  }, [ref]);

  /* ── Keys: Space pans, ⌘ + − 0 1 zoom ── */
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    const zoomBy = (k: number) => update((c) => zoomAt(c, k, size.width / 2, size.height / 2));
    if (key === ' ' && !mod) { e.preventDefault(); setSpace(true); return; }
    if (mod && (key === '=' || key === '+')) { e.preventDefault(); zoomBy(1.25); return; }
    if (mod && key === '-') { e.preventDefault(); zoomBy(0.8); return; }
    if (mod && key === '0') { e.preventDefault(); update(() => fitCamera(fit ?? null, size)); return; }
    if (mod && key === '1') { e.preventDefault(); update((c) => zoomAt(c, 1 / c.z, size.width / 2, size.height / 2)); return; }
    onCanvasKeyDown?.(e);
  };

  const z = camera.z;
  const bgStyle = useMemo<CSSProperties>(() => {
    if (background === 'none') return {};
    let step = (background === 'dots' ? 24 : 40) * camera.z;
    while (step < 12) step *= 2;
    const ink = 'color-mix(in srgb, var(--muted-foreground) 34%, transparent)';
    const pos = `${camera.x}px ${camera.y}px`;
    return background === 'dots'
      ? { backgroundImage: `radial-gradient(${ink} 1.1px, transparent 1.4px)`, backgroundSize: `${step}px ${step}px`, backgroundPosition: pos }
      : { backgroundImage: `linear-gradient(to right, ${ink} 1px, transparent 1px), linear-gradient(to bottom, ${ink} 1px, transparent 1px)`, backgroundSize: `${step}px ${step}px`, backgroundPosition: pos };
  }, [background, camera.x, camera.y, camera.z]);

  const value = useMemo<CanvasContextValue>(() => ({
    camera, zoom: z, size, local,
    toBoard: (e) => { const s = local(e); return toBoard(camera, s.x, s.y); },
    toScreen: (p) => toScreen(camera, p),
    update,
  }), [camera, z, size, local, update]);

  return (
    <CanvasContext.Provider value={value}>
      <div
        ref={ref}
        data-slot="canvas"
        tabIndex={0}
        role="application"
        aria-label={ariaLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => onCanvasDoubleClick?.(e, info(local(e)))}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => { if (e.key === ' ') setSpace(false); }}
        onBlur={() => setSpace(false)}
        className={cn('absolute inset-0 touch-none overflow-hidden bg-background outline-none select-none focus-visible:outline-none', className)}
        style={{ ...bgStyle, cursor: grabbing ? 'grabbing' : space || panning ? 'grab' : cursor, ...style }}
      >
        <div data-slot="canvas-board" className="absolute top-0 left-0 origin-top-left text-foreground" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${z})` }}>
          {children}
        </div>
        {overlay}
      </div>
    </CanvasContext.Provider>
  );
}

/* ── Overlay parts: lines and handles that keep their thickness on screen at any zoom ── */

const HANDLE_PX = 10;

export interface CanvasFrameProps {
  frame: Frame;
  /** A dashed outline (a locked item). */
  dashed?: boolean;
  /** Air between the frame and its outline, in screen px (default 3). */
  offset?: number;
}

/** An outline around a (rotated) frame, in the theme's primary color. Put it in the board layer. */
export function CanvasFrame({ frame, dashed, offset = 3 }: CanvasFrameProps) {
  const { zoom: z } = useCanvas();
  return (
    <div
      data-slot="canvas-frame"
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{
        left: frame.x, top: frame.y, width: frame.w, height: frame.h,
        transform: frame.rot ? `rotate(${frame.rot}deg)` : undefined,
        outline: `${1.6 / z}px ${dashed ? 'dashed' : 'solid'} var(--primary)`, outlineOffset: offset / z, borderRadius: 2 / z,
      }}
    />
  );
}

/** Resize and rotate handles (from `frameHandles`, or your own: a connector's ends). Round for `rot`, `from` and `to`. */
export function CanvasHandles({ handles }: { handles: Handle[] }) {
  const { zoom: z } = useCanvas();
  const hx = HANDLE_PX / z;
  return (
    <>
      {handles.map((h) => (
        <span
          key={h.id}
          data-slot="canvas-handle"
          data-handle={h.id}
          aria-hidden="true"
          className={cn('pointer-events-none absolute bg-background', h.id === 'rot' || h.id === 'from' || h.id === 'to' ? 'rounded-full' : 'rounded-[2px]')}
          style={{ left: h.pt.x - hx / 2, top: h.pt.y - hx / 2, width: hx, height: hx, border: `${1.6 / z}px solid var(--primary)` }}
        />
      ))}
    </>
  );
}

/** The rubber band of a drag-select, in board units. */
export function CanvasMarquee({ rect }: { rect: Rect }) {
  const { zoom: z } = useCanvas();
  return (
    <span
      data-slot="canvas-marquee"
      aria-hidden="true"
      className="pointer-events-none absolute bg-primary/10"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, border: `${1 / z}px solid var(--primary)` }}
    />
  );
}

/** Alignment guides (from `snapMove`) drawn as hairlines. */
export function CanvasGuides({ guides }: { guides: Guide[] }) {
  const { zoom: z } = useCanvas();
  return (
    <>
      {guides.map((g, i) => (
        <span
          key={i}
          data-slot="canvas-guide"
          aria-hidden="true"
          className="pointer-events-none absolute bg-primary"
          style={{ left: g.x1, top: g.y1, width: Math.max(g.x2 - g.x1, 1 / z), height: Math.max(g.y2 - g.y1, 1 / z) }}
        />
      ))}
    </>
  );
}
