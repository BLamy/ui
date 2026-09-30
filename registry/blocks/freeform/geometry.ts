/* Freeform's geometry: rotated frames, hit testing, bounds, and where a connector runs. All in board units. */
import { PK_TOOLS } from '@/components/ui/pencilkit/constants';
import { isAttached, isBox, type BoxItem, type ConnectorEnd, type ConnectorItem, type Frame, type Item, type Side, type StrokeItem } from './model';

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

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

export function rectOf(pts: Pt[]): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

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

/* ── Connectors ── */

export const SIDES: Side[] = ['t', 'r', 'b', 'l'];
const NORMAL: Record<Side, Pt> = { t: { x: 0, y: -1 }, r: { x: 1, y: 0 }, b: { x: 0, y: 1 }, l: { x: -1, y: 0 } };

/** The midpoint of an item's side, in the board (rotation applied). */
export function anchorPoint(item: BoxItem, side: Side): Pt {
  const local: Pt = side === 't' ? { x: item.x + item.w / 2, y: item.y }
    : side === 'b' ? { x: item.x + item.w / 2, y: item.y + item.h }
    : side === 'l' ? { x: item.x, y: item.y + item.h / 2 }
    : { x: item.x + item.w, y: item.y + item.h / 2 };
  return item.rot ? rotatePt(local, centerOf(item), item.rot) : local;
}

/** Which way a side faces on the board (rotation applied), as a unit vector. */
function anchorNormal(item: BoxItem, side: Side): Pt {
  const n = NORMAL[side];
  return item.rot ? rotatePt(n, { x: 0, y: 0 }, item.rot) : n;
}

export interface ConnectorGeometry {
  /** SVG path data. */
  d: string;
  /** The path as a polyline, for hit testing and bounds. */
  pts: Pt[];
  start: Pt;
  end: Pt;
  /** Unit vectors pointing out of each end, along the path (where an arrowhead points). */
  startDir: Pt;
  endDir: Pt;
}

const unit = (v: Pt): Pt => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
const dominantSide = (from: Pt, to: Pt): Pt => (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? { x: Math.sign(to.x - from.x) || 1, y: 0 } : { x: 0, y: Math.sign(to.y - from.y) || 1 });

function endPoint(e: ConnectorEnd, byId: Map<string, Item>): { p: Pt; n: Pt | null } {
  if (isAttached(e)) {
    const it = byId.get(e.id);
    if (it && isBox(it)) return { p: anchorPoint(it, e.side), n: anchorNormal(it, e.side) };
  }
  return { p: 'x' in e ? { x: e.x, y: e.y } : { x: 0, y: 0 }, n: null };
}

/** Sample a cubic bezier into a polyline. */
function cubic(a: Pt, b: Pt, c: Pt, d: Pt, steps = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push({
      x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
      y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
    });
  }
  return out;
}

export function connectorGeometry(c: ConnectorItem, byId: Map<string, Item>): ConnectorGeometry {
  const a = endPoint(c.from, byId);
  const b = endPoint(c.to, byId);
  const na = a.n ?? dominantSide(a.p, b.p);
  const nb = b.n ?? dominantSide(b.p, a.p);
  let pts: Pt[];
  let d: string;
  if (c.route === 'straight') {
    pts = [a.p, b.p];
    d = `M${a.p.x} ${a.p.y}L${b.p.x} ${b.p.y}`;
  } else if (c.route === 'curve') {
    const k = Math.max(40, dist(a.p, b.p) * 0.4);
    const c1 = { x: a.p.x + na.x * k, y: a.p.y + na.y * k };
    const c2 = { x: b.p.x + nb.x * k, y: b.p.y + nb.y * k };
    pts = cubic(a.p, c1, c2, b.p);
    d = `M${a.p.x} ${a.p.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.p.x} ${b.p.y}`;
  } else {
    // Elbow: leave each end along its side, and meet in the middle with right angles.
    const gap = 28;
    const a1 = { x: a.p.x + na.x * gap, y: a.p.y + na.y * gap };
    const b1 = { x: b.p.x + nb.x * gap, y: b.p.y + nb.y * gap };
    const horizA = Math.abs(na.x) > 0.5, horizB = Math.abs(nb.x) > 0.5;
    let mid: Pt[];
    if (horizA && horizB) { const mx = (a1.x + b1.x) / 2; mid = [{ x: mx, y: a1.y }, { x: mx, y: b1.y }]; }
    else if (!horizA && !horizB) { const my = (a1.y + b1.y) / 2; mid = [{ x: a1.x, y: my }, { x: b1.x, y: my }]; }
    else if (horizA) mid = [{ x: b1.x, y: a1.y }];
    else mid = [{ x: a1.x, y: b1.y }];
    pts = [a.p, a1, ...mid, b1, b.p];
    d = 'M' + pts.map((p) => `${p.x} ${p.y}`).join('L');
  }
  const startDir = unit({ x: pts[0].x - pts[1].x, y: pts[0].y - pts[1].y });
  const last = pts.length - 1;
  const endDir = unit({ x: pts[last].x - pts[last - 1].x, y: pts[last].y - pts[last - 1].y });
  return { d, pts, start: a.p, end: b.p, startDir, endDir };
}

/* ── Bounds and hit testing ── */

/** Where a stroke's ink reaches, padded by half its widest nib. */
export function strokeFrame(points: StrokeItem['points'], tool: StrokeItem['tool'], width: number): Rect {
  const pad = (PK_TOOLS[tool].opt.size * width) / 2 + 1;
  const r = rectOf(points.map(([x, y]) => ({ x, y })));
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}

/** An item's bounding box on the board (rotation applied; a connector's is its path's). */
export function boundsOf(item: Item, byId: Map<string, Item>): Rect {
  if (item.kind === 'connector') return rectOf(connectorGeometry(item, byId).pts);
  return rectOf(cornersOf(item));
}

/** Is the board point `p` on `item`? `tol` is how far off a thin thing (a stroke, a connector) still counts. */
export function hitItem(p: Pt, item: Item, byId: Map<string, Item>, tol: number): boolean {
  if (item.kind === 'connector') return distToPolyline(p, connectorGeometry(item, byId).pts) <= tol + item.width / 2;
  if (item.kind === 'stroke') {
    if (!inFrame(p, item, tol)) return false;
    const r = (PK_TOOLS[item.tool].opt.size * item.width) / 2 + tol;
    return distToPolyline(p, item.points.map(([x, y]) => ({ x, y }))) <= r;
  }
  // An unfilled shape with no text is hit on its outline, not its empty middle, so a frame drawn around other
  // things doesn't swallow clicks meant for them.
  if (item.kind === 'shape' && item.fill === null && !item.text) {
    const edge = tol + item.sw + 6;
    return inFrame(p, item, tol) && !inFrame(p, { ...item, x: item.x + edge, y: item.y + edge, w: item.w - edge * 2, h: item.h - edge * 2 });
  }
  return inFrame(p, item, tol);
}

/** The side of an item nearest to `p`, when `p` is within `tol` of the item; else null. Stickies, shapes, text, images, links. */
export function nearestAnchor(p: Pt, items: Item[], tol: number, exclude?: string): { id: string; side: Side; point: Pt } | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (!isBox(it) || it.id === exclude || !inFrame(p, it, tol)) continue;
    let best: { side: Side; point: Pt; d: number } | null = null;
    for (const side of SIDES) {
      const point = anchorPoint(it, side);
      const d = dist(point, p);
      if (!best || d < best.d) best = { side, point, d };
    }
    if (best) return { id: it.id, side: best.side, point: best.point };
  }
  return null;
}

