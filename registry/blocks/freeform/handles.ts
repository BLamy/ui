/* Selection handles and what dragging them does: resize, rotate, scale a group, snap a move to its neighbours. */
import { centerOf, connectorGeometry, cornersOf, rectOf, rotatePt, unionRect, type Pt, type Rect } from './geometry';
import { isAttached, MIN_SIZE, type Frame, type Item } from './model';

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rot' | 'from' | 'to';
export interface Handle { id: HandleId; pt: Pt }

const DIR: Record<string, [number, number]> = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };

export type SelectionKind = 'none' | 'single' | 'group' | 'connector';

export interface SelectionFrame {
  kind: SelectionKind;
  /** The frame the handles sit on (a single item's own, rotated; a group's bounding box). */
  frame: Frame | null;
  handles: Handle[];
}

/** Text and link cards resize in width only; everything else in both. */
const EDGES_X = ['e', 'w'] as const;
const ALL = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;

export function selectionFrame(selected: Item[], byId: Map<string, Item>, z: number): SelectionFrame {
  const live = selected.filter((i) => !i.locked);
  if (selected.length === 1 && selected[0].kind === 'connector') {
    const c = selected[0];
    if (c.locked) return { kind: 'connector', frame: null, handles: [] };
    const g = connectorGeometry(c, byId);
    return { kind: 'connector', frame: null, handles: [{ id: 'from', pt: g.start }, { id: 'to', pt: g.end }] };
  }
  if (selected.length === 1 && selected[0].kind !== 'connector') {
    const it = selected[0];
    const frame: Frame = { x: it.x, y: it.y, w: it.w, h: it.h, rot: it.rot };
    if (it.locked) return { kind: 'single', frame, handles: [] };
    const ids = it.kind === 'text' || it.kind === 'link' ? EDGES_X : ALL;
    const c = centerOf(frame);
    const local = (id: string): Pt => {
      const [hx, hy] = DIR[id];
      return { x: c.x + (hx * frame.w) / 2, y: c.y + (hy * frame.h) / 2 };
    };
    const handles: Handle[] = ids.map((id) => ({ id, pt: rotatePt(local(id), c, frame.rot) }));
    if (it.kind !== 'stroke') handles.push({ id: 'rot', pt: rotatePt({ x: c.x, y: frame.y - 30 / z }, c, frame.rot) });
    return { kind: 'single', frame, handles };
  }
  const rects = selected.map((i) => rectOf(i.kind === 'connector' ? connectorGeometry(i, byId).pts : cornersOf(i)));
  const box = unionRect(rects);
  if (!box) return { kind: 'none', frame: null, handles: [] };
  const frame: Frame = { ...box, rot: 0 };
  if (!live.length) return { kind: 'group', frame, handles: [] };
  const corners: [HandleId, Pt][] = [
    ['nw', { x: box.x, y: box.y }], ['ne', { x: box.x + box.w, y: box.y }],
    ['se', { x: box.x + box.w, y: box.y + box.h }], ['sw', { x: box.x, y: box.y + box.h }],
  ];
  return { kind: 'group', frame, handles: corners.map(([id, pt]) => ({ id, pt })) };
}

/** Which way a resize cursor should point for a handle on a frame turned `rot` degrees. */
export function handleCursor(id: HandleId, rot: number): string {
  if (id === 'rot') return 'grab';
  if (id === 'from' || id === 'to') return 'crosshair';
  const [hx, hy] = DIR[id];
  const base = Math.atan2(hy, hx) * (180 / Math.PI) + rot;
  const a = ((Math.round(base / 45) * 45) % 180 + 180) % 180;
  return a === 0 ? 'ew-resize' : a === 45 ? 'nwse-resize' : a === 90 ? 'ns-resize' : 'nesw-resize';
}

/** The frame after dragging `handle` from board point `p0` to `p`. The opposite side stays put, whatever the rotation. */
export function resizeFrame(orig: Frame, handle: HandleId, p0: Pt, p: Pt, lockAspect: boolean): Frame {
  const [hx, hy] = DIR[handle];
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

/** `item` scaled by (sx, sy) about `origin` — a group resize. Fonts follow the smaller scale. */
export function scaleItem(item: Item, sx: number, sy: number, origin: Pt): Item {
  const mx = (x: number) => origin.x + (x - origin.x) * sx;
  const my = (y: number) => origin.y + (y - origin.y) * sy;
  const s = Math.min(Math.abs(sx), Math.abs(sy));
  if (item.kind === 'connector') {
    const end = (e: typeof item.from) => (isAttached(e) ? e : { x: mx(e.x), y: my(e.y) });
    return { ...item, from: end(item.from), to: end(item.to) };
  }
  if (item.kind === 'stroke') {
    return { ...item, x: mx(item.x), y: my(item.y), w: item.w * sx, h: item.h * sy, points: item.points.map(([x, y, p]) => [mx(x), my(y), p]) };
  }
  const size = 'size' in item ? { size: Math.max(6, Math.round(item.size * s)) } : null;
  return { ...item, x: mx(item.x), y: my(item.y), w: Math.max(MIN_SIZE, item.w * sx), h: Math.max(MIN_SIZE, item.h * sy), ...size } as Item;
}

export function moveItem(item: Item, dx: number, dy: number): Item {
  if (item.kind === 'connector') {
    const end = (e: typeof item.from) => (isAttached(e) ? e : { x: e.x + dx, y: e.y + dy });
    return { ...item, from: end(item.from), to: end(item.to) };
  }
  if (item.kind === 'stroke') return { ...item, x: item.x + dx, y: item.y + dy, points: item.points.map(([x, y, p]) => [x + dx, y + dy, p]) };
  return { ...item, x: item.x + dx, y: item.y + dy };
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

