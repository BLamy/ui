/* ══ Canvas math — the geometry behind an infinite, pannable, zoomable surface ══
   Everything is plain functions on plain data, so it works with any item model. Board units are px at 100% zoom.
   - the camera: a screen point is `board * z + (x, y)`;
   - frames: a rectangle that may be turned about its center (`rot`, degrees), with corners, hit tests and bounds;
   - handles: where the eight resize handles and the rotate handle sit on a frame, and what dragging them does;
   - snapping: alignment guides for a box being moved among others. */

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
/** A rectangle with a rotation (degrees, about its center): the position, size and turn of an item. */
export interface Frame extends Rect { rot: number }

/* ── The camera ── */

export interface Camera { x: number; y: number; z: number }

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
/** The smallest a frame can be resized to. */
export const MIN_SIZE = 24;

export const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

export const toBoard = (c: Camera, sx: number, sy: number): Pt => ({ x: (sx - c.x) / c.z, y: (sy - c.y) / c.z });
export const toScreen = (c: Camera, p: Pt): Pt => ({ x: p.x * c.z + c.x, y: p.y * c.z + c.y });

/** Zoom by `factor`, keeping the board point under the screen point (sx, sy) where it is. */
export function zoomAt(c: Camera, factor: number, sx: number, sy: number): Camera {
  const z = clampZoom(c.z * factor);
  const k = z / c.z;
  return { z, x: sx - (sx - c.x) * k, y: sy - (sy - c.y) * k };
}

/** A camera that shows `r` centered in a view of `size`, with `pad` px of air, zoomed in no further than 100%. */
export function fitCamera(r: Rect | null, size: { width: number; height: number }, pad = 72): Camera {
  if (!r || r.w <= 0 || r.h <= 0) return { x: size.width / 2, y: size.height / 2, z: 1 };
  const z = clampZoom(Math.min(1, (size.width - pad * 2) / r.w, (size.height - pad * 2) / r.h));
  return { z, x: size.width / 2 - (r.x + r.w / 2) * z, y: size.height / 2 - (r.y + r.h / 2) * z };
}

/* ── Frames ── */

const RAD = Math.PI / 180;
export const rotatePt = (p: Pt, c: Pt, deg: number): Pt => {
  const a = deg * RAD, s = Math.sin(a), k = Math.cos(a);
  const dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * k - dy * s, y: c.y + dx * s + dy * k };
};
export const centerOf = (f: Rect): Pt => ({ x: f.x + f.w / 2, y: f.y + f.h / 2 });
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** The four corners of a frame, rotated, clockwise from top-left. */
export function cornersOf(f: Frame): Pt[] {
  const c = centerOf(f);
  return [
    { x: f.x, y: f.y }, { x: f.x + f.w, y: f.y }, { x: f.x + f.w, y: f.y + f.h }, { x: f.x, y: f.y + f.h },
  ].map((p) => (f.rot ? rotatePt(p, c, f.rot) : p));
}

/** The smallest rectangle holding all of `pts`. */
export function rectOf(pts: Pt[]): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The smallest rectangle holding all of `rs`, or null when there are none. */
export const unionRect = (rs: Rect[]): Rect | null => {
  if (!rs.length) return null;
  return rectOf(rs.flatMap((r) => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }]));
};

export const intersects = (a: Rect, b: Rect) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;

/** Is `p` inside the (rotated) frame, `pad` units out? */
export function inFrame(p: Pt, f: Frame, pad = 0): boolean {
  const q = f.rot ? rotatePt(p, centerOf(f), -f.rot) : p;
  return q.x >= f.x - pad && q.x <= f.x + f.w + pad && q.y >= f.y - pad && q.y <= f.y + f.h + pad;
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distToPolyline(p: Pt, pts: Pt[]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) best = Math.min(best, distToSegment(p, pts[i - 1], pts[i]));
  return pts.length === 1 ? dist(p, pts[0]) : best;
}

/* ── Handles ── */

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rot' | 'from' | 'to';
export interface Handle { id: HandleId; pt: Pt }

/** The direction of each resize handle, as (x, y) in -1…1. */
export const HANDLE_DIR: Record<string, [number, number]> = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };

export const ALL_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
/** Handles for a frame that can only change width. */
export const EDGE_HANDLES = ['e', 'w'] as const;

/** The resize handles of `frame` (and, with `rotate`, a rotate handle 30 screen px above it), turned with the frame.
 *  `z` is the zoom, so the rotate handle keeps its screen distance. */
export function frameHandles(frame: Frame, z: number, { ids = ALL_HANDLES, rotate = true }: { ids?: readonly (typeof ALL_HANDLES[number])[]; rotate?: boolean } = {}): Handle[] {
  const c = centerOf(frame);
  const local = (id: string): Pt => {
    const [hx, hy] = HANDLE_DIR[id];
    return { x: c.x + (hx * frame.w) / 2, y: c.y + (hy * frame.h) / 2 };
  };
  const handles: Handle[] = ids.map((id) => ({ id, pt: rotatePt(local(id), c, frame.rot) }));
  if (rotate) handles.push({ id: 'rot', pt: rotatePt({ x: c.x, y: frame.y - 30 / z }, c, frame.rot) });
  return handles;
}

/** Which way a resize cursor should point for a handle on a frame turned `rot` degrees. */
export function handleCursor(id: HandleId, rot: number): string {
  if (id === 'rot') return 'grab';
  if (id === 'from' || id === 'to') return 'crosshair';
  const [hx, hy] = HANDLE_DIR[id];
  const base = Math.atan2(hy, hx) * (180 / Math.PI) + rot;
  const a = ((Math.round(base / 45) * 45) % 180 + 180) % 180;
  return a === 0 ? 'ew-resize' : a === 45 ? 'nwse-resize' : a === 90 ? 'ns-resize' : 'nesw-resize';
}

/** The frame after dragging `handle` from board point `p0` to `p`. The opposite side stays put, whatever the rotation. */
export function resizeFrame(orig: Frame, handle: HandleId, p0: Pt, p: Pt, lockAspect: boolean): Frame {
  const [hx, hy] = HANDLE_DIR[handle];
  const d = rotatePt({ x: p.x - p0.x, y: p.y - p0.y }, { x: 0, y: 0 }, -orig.rot);
  let w = orig.w + hx * d.x;
  let h = orig.h + hy * d.y;
  if (lockAspect) {
    // One scale for both sides: the corner's larger change, or the edge's own.
    const sx = w / orig.w, sy = h / orig.h;
    const s = Math.max(hx && hy ? (Math.abs(sx - 1) > Math.abs(sy - 1) ? sx : sy) : hx ? sx : sy, Math.max(MIN_SIZE / orig.w, MIN_SIZE / orig.h));
    w = orig.w * s;
    h = orig.h * s;
  } else {
    w = Math.max(MIN_SIZE, w);
    h = Math.max(MIN_SIZE, h);
  }
  const c0 = centerOf(orig);
  const anchor = rotatePt({ x: c0.x - (hx * orig.w) / 2, y: c0.y - (hy * orig.h) / 2 }, c0, orig.rot);
  const off = rotatePt({ x: -(hx * w) / 2, y: -(hy * h) / 2 }, { x: 0, y: 0 }, orig.rot);
  const c1 = { x: anchor.x - off.x, y: anchor.y - off.y };
  return { x: c1.x - w / 2, y: c1.y - h / 2, w, h, rot: orig.rot };
}

/** Rotation from dragging the handle: the angle to the pointer, snapped to right angles and 15° steps. */
export function rotateFrame(orig: Frame, p: Pt, free: boolean): number {
  const c = centerOf(orig);
  let deg = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI + 90;
  deg = ((deg % 360) + 540) % 360 - 180;
  if (!free) deg = Math.round(deg / 15) * 15;
  else for (const s of [-180, -90, 0, 90, 180]) if (Math.abs(deg - s) < 3) deg = s;
  return Math.round(deg * 10) / 10;
}

/* ── Alignment guides ── */

export interface Guide { x1: number; y1: number; x2: number; y2: number }

/** Nudges a moving box so its edges and center line up with its neighbours', and says which lines to draw. */
export function snapMove(box: Rect, others: Rect[], thr: number): { dx: number; dy: number; guides: Guide[] } {
  const mine = (r: Rect, axis: 'x' | 'y') => (axis === 'x' ? [r.x, r.x + r.w / 2, r.x + r.w] : [r.y, r.y + r.h / 2, r.y + r.h]);
  const best = (axis: 'x' | 'y') => {
    let pick: { d: number; at: number } | null = null;
    for (const o of others) for (const t of mine(o, axis)) for (const m of mine(box, axis)) {
      const d = t - m;
      if (Math.abs(d) <= thr && (!pick || Math.abs(d) < Math.abs(pick.d))) pick = { d, at: t };
    }
    return pick;
  };
  const bx = best('x'), by = best('y');
  const dx = bx?.d ?? 0, dy = by?.d ?? 0;
  const moved: Rect = { x: box.x + dx, y: box.y + dy, w: box.w, h: box.h };
  const guides: Guide[] = [];
  const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
  for (const o of others) {
    if (bx) for (const t of mine(o, 'x')) if (near(t, bx.at)) {
      guides.push({ x1: bx.at, x2: bx.at, y1: Math.min(o.y, moved.y), y2: Math.max(o.y + o.h, moved.y + moved.h) });
    }
    if (by) for (const t of mine(o, 'y')) if (near(t, by.at)) {
      guides.push({ y1: by.at, y2: by.at, x1: Math.min(o.x, moved.x), x2: Math.max(o.x + o.w, moved.x + moved.w) });
    }
  }
  return { dx, dy, guides };
}
