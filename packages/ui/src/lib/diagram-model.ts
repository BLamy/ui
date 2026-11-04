/* ══ Diagram model — nodes, ports, edges and compounds as plain data, and the geometry of what connects them ══
   Nothing here renders, and it is the one place a connector gets its shape.
   - a node is a box in board units, absolute rather than relative to its parent; `parent` nests it in a compound;
   - a port is a named place on one side of a node;
   - an edge joins two nodes, or two of their ports. `points` is a route someone already worked out (a layout), and
     without it `edgeGeometry` finds one.
   Freeform's connectors, Interface Builder's segues and Replay Canvas's segues run on the same geometry. The frame math
   underneath (rotation, distances, bounds) is the canvas toolkit's, in `@/lib/canvas-math`. */
import { centerOf, dist, distToPolyline, inFrame, rectOf, rotatePt, type Pt, type Rect } from '@/lib/canvas-math';

/* ── The data ── */

/** Top, right, bottom, left. */
export type DiagramSide = 't' | 'r' | 'b' | 'l';
export const DIAGRAM_SIDES: readonly DiagramSide[] = ['t', 'r', 'b', 'l'];

/** A box that may be turned about its center (degrees). A `Frame` is one. */
export type DiagramBox = Rect & { rot?: number };

/** A named place on a node's side. */
export interface DiagramPort {
  id: string;
  side: DiagramSide;
  /** How far along the side, from 0 at its top or left end to 1 at the other (default 0.5). */
  at?: number;
  label?: string;
  /** What it carries, for whoever validates a connection. */
  kind?: string;
}

/** What a node is drawn as. `compound`, `parallel`, `region` and `root` hold other nodes. */
export type DiagramNodeKind = 'node' | 'compound' | 'parallel' | 'region' | 'root' | 'final' | 'initial';

export interface DiagramNode<D = unknown> extends Rect {
  id: string;
  /** The compound it sits in. A node moves with its parent. */
  parent?: string | null;
  kind?: DiagramNodeKind;
  label?: string;
  /** A second, quieter line. */
  detail?: string;
  ports?: readonly DiagramPort[];
  data?: D;
}

/** The way an edge runs when it has no `points` of its own. */
export type ConnectorRoute = 'straight' | 'elbow' | 'curve';

export interface DiagramEdge<D = unknown> {
  id: string;
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
  /** Default `elbow`. Ignored when there are `points`. */
  route?: ConnectorRoute;
  /** A route already worked out, in board units, from the start to the tip. */
  points?: readonly Pt[];
  label?: string;
  /** Where a layout put the label, in board units. Without it `labelBox` finds a place. */
  labelBox?: Rect;
  /** What it is, for drawing: `event`, `always`, `after`, `done`, `invoke`, `initial`, or your own. */
  kind?: string;
  data?: D;
}

export interface DiagramModel<N = unknown, E = unknown> {
  nodes: readonly DiagramNode<N>[];
  edges: readonly DiagramEdge<E>[];
}

/* ── Nesting ── */

export interface DiagramIndex<N = unknown> {
  nodes: readonly DiagramNode<N>[];
  byId: ReadonlyMap<string, DiagramNode<N>>;
  /** Each node's parent, or null. A parent that doesn't exist counts as none, and so does a loop of parents. */
  parent: ReadonlyMap<string, string | null>;
  /** A node's children in drawing order. The nodes with no parent are under `null`. */
  children: ReadonlyMap<string | null, readonly DiagramNode<N>[]>;
  /** How deep each node is: 0 for those with no parent. */
  depth: ReadonlyMap<string, number>;
}

/** Looks up nodes, parents, children and depths. Whatever the data says, the result is a forest. */
export function indexDiagram<N>(nodes: readonly DiagramNode<N>[]): DiagramIndex<N> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // The nodes on a loop of parents have none, so everything else stays a tree.
  const looped = new Set<string>();
  const clear = new Set<string>();
  for (const n of nodes) {
    const path = new Set<string>();
    let at: DiagramNode<N> | undefined = n;
    while (at && !clear.has(at.id) && !looped.has(at.id) && !path.has(at.id)) {
      path.add(at.id);
      at = at.parent != null ? byId.get(at.parent) : undefined;
    }
    if (at && path.has(at.id)) {
      let on: DiagramNode<N> = at;
      do { looped.add(on.id); on = byId.get(on.parent!)!; } while (on !== at);
    }
    for (const id of path) if (!looped.has(id)) clear.add(id);
  }
  const parent = new Map<string, string | null>();
  const children = new Map<string | null, DiagramNode<N>[]>();
  for (const n of nodes) {
    const p = n.parent != null && byId.has(n.parent) && !looped.has(n.id) ? n.parent : null;
    parent.set(n.id, p);
    const list = children.get(p);
    if (list) list.push(n);
    else children.set(p, [n]);
  }
  const depth = new Map<string, number>();
  const stack: [DiagramNode<N>, number][] = (children.get(null) ?? []).map((n) => [n, 0]);
  while (stack.length) {
    const [n, d] = stack.pop()!;
    if (depth.has(n.id)) continue;
    depth.set(n.id, d);
    for (const k of children.get(n.id) ?? []) stack.push([k, d + 1]);
  }
  return { nodes, byId, parent, children, depth };
}

/** The ids above a node, nearest first. */
export function ancestorsOf<N>(index: DiagramIndex<N>, id: string): string[] {
  const out: string[] = [];
  for (let at = index.parent.get(id) ?? null; at !== null && !out.includes(at); at = index.parent.get(at) ?? null) out.push(at);
  return out;
}

/** The ids under a node, parents before their children. */
export function descendantsOf<N>(index: DiagramIndex<N>, id: string): string[] {
  const out: string[] = [];
  const seen = new Set([id]);
  const stack = [...(index.children.get(id) ?? [])].reverse();
  while (stack.length) {
    const n = stack.pop()!;
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n.id);
    const kids = index.children.get(n.id);
    if (kids) for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
  return out;
}

/** Is `inner` somewhere inside `outer`? A node isn't inside itself. */
export const isInside = <N>(index: DiagramIndex<N>, inner: string, outer: string): boolean => inner !== outer && ancestorsOf(index, inner).includes(outer);

/* ── Anchors ── */

const NORMAL: Record<DiagramSide, Pt> = { t: { x: 0, y: -1 }, r: { x: 1, y: 0 }, b: { x: 0, y: 1 }, l: { x: -1, y: 0 } };
const OPPOSITE: Record<DiagramSide, DiagramSide> = { t: 'b', r: 'l', b: 't', l: 'r' };

/** A place on a box's side, in the board (rotation applied): the midpoint unless `at` says otherwise. */
export function anchorPoint(box: DiagramBox, side: DiagramSide, at = 0.5): Pt {
  const local: Pt = side === 't' ? { x: box.x + box.w * at, y: box.y }
    : side === 'b' ? { x: box.x + box.w * at, y: box.y + box.h }
    : side === 'l' ? { x: box.x, y: box.y + box.h * at }
    : { x: box.x + box.w, y: box.y + box.h * at };
  return box.rot ? rotatePt(local, centerOf(box), box.rot) : local;
}

/** Which way a side faces on the board (rotation applied), as a unit vector. */
export function anchorNormal(box: DiagramBox, side: DiagramSide): Pt {
  const n = NORMAL[side];
  return box.rot ? rotatePt(n, { x: 0, y: 0 }, box.rot) : n;
}

/** The side whose midpoint is nearest `p`, the earlier of `t`, `r`, `b`, `l` on a tie. */
export function nearestSide(box: DiagramBox, p: Pt): { side: DiagramSide; point: Pt } {
  let best: { side: DiagramSide; point: Pt; d: number } | null = null;
  for (const side of DIAGRAM_SIDES) {
    const point = anchorPoint(box, side);
    const d = dist(point, p);
    if (!best || d < best.d) best = { side, point, d };
  }
  return { side: best!.side, point: best!.point };
}

/** The nearest side of the last box in `boxes` that `p` is within `tol` of, or null. Boxes are searched topmost first. */
export function nearestAnchor(p: Pt, boxes: readonly (DiagramBox & { id: string })[], tol: number, exclude?: string): { id: string; side: DiagramSide; point: Pt } | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const box = boxes[i];
    if (box.id === exclude || !inFrame(p, box, tol)) continue;
    return { id: box.id, ...nearestSide(box, p) };
  }
  return null;
}

/** A port's place and which way it faces. */
export function portPoint(box: DiagramBox, port: DiagramPort): ConnectorEnd {
  return { p: anchorPoint(box, port.side, port.at ?? 0.5), n: anchorNormal(box, port.side) };
}

/* ── Connector geometry ── */

/** Where a connector leaves or arrives, and which way it faces there. A free end faces nowhere. */
export interface ConnectorEnd {
  p: Pt;
  n: Pt | null;
}

export interface ConnectorGeometry {
  /** SVG path data. */
  d: string;
  /** The path as a polyline, for hit testing and bounds. A curve is sampled. */
  pts: Pt[];
  start: Pt;
  end: Pt;
  /** Unit vectors pointing out of each end, along the polyline's last chord. */
  startDir: Pt;
  endDir: Pt;
  /** Halfway: a curve's midpoint, or half a polyline's length. */
  mid: Pt;
  /** The direction at the end, in radians. On a curve it's the curve's own tangent, which `endDir` only approaches. */
  angle: number;
}

const unit = (v: Pt): Pt => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };

const dominantSide = (from: Pt, to: Pt): Pt => (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? { x: Math.sign(to.x - from.x) || 1, y: 0 } : { x: 0, y: Math.sign(to.y - from.y) || 1 });

/** Polyline points as SVG path data. */
export const polylineD = (pts: readonly Pt[]): string => (pts.length ? 'M' + pts.map((p) => `${p.x} ${p.y}`).join('L') : '');

/** A cubic bezier at `t`. */
export function cubicAt(a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

/** The direction leaving `pts` from its end, skipping points that sit on top of each other. */
function endDirection(pts: readonly Pt[], from: 'start' | 'end'): Pt {
  const last = pts.length - 1;
  const tip = from === 'end' ? pts[last] : pts[0];
  for (let i = 1; i <= last; i++) {
    const q = from === 'end' ? pts[last - i] : pts[i];
    if (q.x !== tip.x || q.y !== tip.y) return unit({ x: tip.x - q.x, y: tip.y - q.y });
  }
  return { x: 0, y: 0 };
}

/** The point `t` of the way along a polyline (by length), with the direction it runs there. */
export function pointAlong(pts: readonly Pt[], t = 0.5): { point: Pt; dir: Pt } {
  if (!pts.length) return { point: { x: 0, y: 0 }, dir: { x: 0, y: 0 } };
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  let left = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const l = dist(pts[i - 1], pts[i]);
    if (!l) continue;
    if (left <= l) {
      const k = left / l;
      const a = pts[i - 1], b = pts[i];
      return { point: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, dir: unit({ x: b.x - a.x, y: b.y - a.y }) };
    }
    left -= l;
  }
  return { point: pts[pts.length - 1], dir: { x: 0, y: 0 } };
}

/** A route through `pts`, in straight lines. */
export function polylinePath(points: readonly Pt[]): ConnectorGeometry {
  const pts = points.length ? (points.length === 1 ? [points[0], points[0]] : [...points]) : [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  const endDir = endDirection(pts, 'end');
  return {
    d: polylineD(pts), pts, start: pts[0], end: pts[pts.length - 1],
    startDir: endDirection(pts, 'start'), endDir,
    mid: pointAlong(pts).point, angle: Math.atan2(endDir.y, endDir.x),
  };
}

/** A cubic bezier from `start` to `end`, sampled into `steps` chords for hit testing. */
export function curvePath(start: Pt, c1: Pt, c2: Pt, end: Pt, steps = 24): ConnectorGeometry {
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) pts.push(cubicAt(start, c1, c2, end, i / steps));
  return {
    d: `M${start.x} ${start.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`, pts, start, end,
    startDir: endDirection(pts, 'start'), endDir: endDirection(pts, 'end'),
    mid: cubicAt(start, c1, c2, end, 0.5), angle: Math.atan2(end.y - c2.y, end.x - c2.x),
  };
}

/** How far out of each end an elbow runs before it may turn. */
export const ELBOW_GAP = 28;

/** A connector between two ends. A curve and an elbow leave along the way each end faces; a free end faces the other. */
export function connectorPath(route: ConnectorRoute, a: ConnectorEnd, b: ConnectorEnd): ConnectorGeometry {
  if (route === 'straight') return polylinePath([a.p, b.p]);
  const na = a.n ?? dominantSide(a.p, b.p);
  const nb = b.n ?? dominantSide(b.p, a.p);
  if (route === 'curve') {
    const k = Math.max(40, dist(a.p, b.p) * 0.4);
    return curvePath(a.p, { x: a.p.x + na.x * k, y: a.p.y + na.y * k }, { x: b.p.x + nb.x * k, y: b.p.y + nb.y * k }, b.p);
  }
  // Elbow: leave each end along its side, and meet in the middle with right angles.
  const a1 = { x: a.p.x + na.x * ELBOW_GAP, y: a.p.y + na.y * ELBOW_GAP };
  const b1 = { x: b.p.x + nb.x * ELBOW_GAP, y: b.p.y + nb.y * ELBOW_GAP };
  const horizA = Math.abs(na.x) > 0.5, horizB = Math.abs(nb.x) > 0.5;
  let mid: Pt[];
  if (horizA && horizB) { const mx = (a1.x + b1.x) / 2; mid = [{ x: mx, y: a1.y }, { x: mx, y: b1.y }]; }
  else if (!horizA && !horizB) { const my = (a1.y + b1.y) / 2; mid = [{ x: a1.x, y: my }, { x: b1.x, y: my }]; }
  else if (horizA) mid = [{ x: b1.x, y: a1.y }];
  else mid = [{ x: a1.x, y: b1.y }];
  return polylinePath([a.p, a1, ...mid, b1, b.p]);
}

/** A curve from one box's edge to the edge of another that faces it. Mostly sideways when the two sit side by side, and
 *  from above when one's below. `src`, when given, is what it leaves from instead of `from`: a control in a screen. It
 *  stops `gap` short of the target, so an arrowhead has room. Interface Builder's segues. */
export function facingCurve(from: Rect, to: Rect, src: Rect | null, gap: number): ConnectorGeometry {
  const fc = centerOf(from), tc = centerOf(to);
  const dx = tc.x - fc.x, dy = tc.y - fc.y;
  let start: Pt, end: Pt, c1: Pt, c2: Pt;
  if (Math.abs(dx) >= Math.abs(dy) * 0.6) {
    const dir = dx >= 0 ? 1 : -1;
    start = src ? { x: dir > 0 ? src.x + src.w : src.x, y: src.y + src.h / 2 } : { x: dir > 0 ? from.x + from.w : from.x, y: fc.y };
    end = { x: dir > 0 ? to.x - gap : to.x + to.w + gap, y: Math.max(to.y + 40, Math.min(to.y + to.h - 40, start.y)) };
    const k = Math.max(48, Math.abs(end.x - start.x) * 0.42);
    c1 = { x: start.x + k * dir, y: start.y };
    c2 = { x: end.x - k * dir, y: end.y };
  } else {
    const dir = dy >= 0 ? 1 : -1;
    start = src ? { x: src.x + src.w, y: src.y + src.h / 2 } : { x: fc.x, y: dir > 0 ? from.y + from.h : from.y };
    end = { x: tc.x, y: dir > 0 ? to.y - gap : to.y + to.h + gap };
    const k = Math.max(60, Math.abs(end.y - start.y) * 0.45);
    c1 = src ? { x: start.x + k, y: start.y } : { x: start.x, y: start.y + k * dir };
    c2 = { x: end.x, y: end.y - k * dir };
  }
  return curvePath(start, c1, c2, end);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A curve from a point to a box's near side, swinging round to its top or bottom when the box is behind the point. It
 *  moves `offset` to its side, so several can run side by side. Replay Canvas's segues. */
export function loopingCurve(start0: Pt, to: Rect, offset = 0): ConnectorGeometry {
  const start = { ...start0 };
  let end: Pt, c1: Pt, c2: Pt;
  if (to.x >= start.x + 60) {
    end = { x: to.x - 10, y: clamp(start.y, to.y + 24, to.y + to.h - 24) };
    const k = Math.max(80, (end.x - start.x) * 0.45);
    c1 = { x: start.x + k, y: start.y };
    c2 = { x: end.x - k, y: end.y };
  } else {
    const below = to.y >= start.y;
    end = { x: to.x + Math.min(to.w / 2, 240), y: below ? to.y - 10 : to.y + to.h + 10 };
    const k = Math.max(160, Math.abs(end.y - start.y) * 0.4);
    const side = Math.max(start.x, end.x) + 220;
    c1 = { x: side, y: start.y };
    c2 = { x: end.x, y: below ? end.y - k : end.y + k };
  }
  if (offset) {
    const len = Math.hypot(end.x - start.x, end.y - start.y) || 1;
    const nx = (-(end.y - start.y) / len) * offset, ny = ((end.x - start.x) / len) * offset;
    for (const pt of [start, c1, c2, end]) { pt.x += nx; pt.y += ny; }
  }
  return curvePath(start, c1, c2, end);
}

/* ── Arrowheads ── */

/** An arrowhead's proportions, per unit of its size. */
export interface ArrowShape {
  length: number;
  halfWidth: number;
}
/** As long as its size, and wide. Freeform's. */
export const ARROW_BROAD: ArrowShape = { length: 1, halfWidth: 0.55 };
/** Sides as long as its size, 0.45 radians off the line. Interface Builder's and Replay Canvas's. */
export const ARROW_SLIM: ArrowShape = { length: Math.cos(0.45), halfWidth: Math.sin(0.45) };

/** An arrowhead's three corners, the tip first, pointing along `dir`, a unit vector. */
export function arrowHead(tip: Pt, dir: Pt, size: number, shape: ArrowShape = ARROW_BROAD): [Pt, Pt, Pt] {
  const bx = tip.x - dir.x * size * shape.length, by = tip.y - dir.y * size * shape.length;
  const px = -dir.y * size * shape.halfWidth, py = dir.x * size * shape.halfWidth;
  return [tip, { x: bx + px, y: by + py }, { x: bx - px, y: by - py }];
}

/** Corners as a `<polygon points>`. */
export const polygonPoints = (pts: readonly Pt[]): string => pts.map((p) => `${p.x},${p.y}`).join(' ');
/** Corners as closed SVG path data. */
export const closedD = (pts: readonly Pt[]): string => (pts.length ? `${polylineD(pts)}Z` : '');
/** The unit vector for an angle in radians. */
export const dirOf = (angle: number): Pt => ({ x: Math.cos(angle), y: Math.sin(angle) });

/* ── Labels ── */

/** Where a label of `size` sits beside a path: `t` of the way along it, moved off the line far enough that the line
 *  doesn't run through the text, and above it where there's a choice. */
export function labelBox(pts: readonly Pt[], size: { w: number; h: number }, { t = 0.5, gap = 2 }: { t?: number; gap?: number } = {}): Rect {
  const { point, dir } = pointAlong(pts, t);
  let nx = dir.y, ny = -dir.x;
  if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
  const off = gap + (Math.abs(nx) * size.w) / 2 + (Math.abs(ny) * size.h) / 2;
  return { x: point.x + nx * off - size.w / 2, y: point.y + ny * off - size.h / 2, w: size.w, h: size.h };
}

/* ── An edge's route ── */

/** How far a self-loop stands off its node. */
export const SELF_LOOP_SIZE = 24;

/** A route from one place on a box to another that stays outside it. A self-loop. */
export function selfLoopPath(box: DiagramBox, a: ConnectorEnd, b: ConnectorEnd, size = SELF_LOOP_SIZE): ConnectorGeometry {
  const na = a.n ?? NORMAL.t, nb = b.n ?? na;
  const a1 = { x: a.p.x + na.x * size, y: a.p.y + na.y * size };
  const b1 = { x: b.p.x + nb.x * size, y: b.p.y + nb.y * size };
  const dot = na.x * nb.x + na.y * nb.y;
  let mid: Pt[] = [];
  if (Math.abs(dot) < 0.5) {
    // Neighbouring sides: out to the corner they share.
    mid = [Math.abs(na.x) > 0.5 ? { x: a1.x, y: b1.y } : { x: b1.x, y: a1.y }];
  } else if (dot < 0) {
    // Opposite sides: over the top, or round the right.
    if (Math.abs(na.x) > 0.5) { const y = box.y - size; mid = [{ x: a1.x, y }, { x: b1.x, y }]; }
    else { const x = box.x + box.w + size; mid = [{ x, y: a1.y }, { x, y: b1.y }]; }
  }
  return polylinePath([a.p, a1, ...mid, b1, b.p]);
}

/** Which sides two boxes face each other on: along whichever axis their centers are further apart. Two boxes in the same
 *  place count as side by side, so the answer's still a real route. */
export function facingSides(a: DiagramBox, b: DiagramBox): { from: DiagramSide; to: DiagramSide } {
  const ca = centerOf(a), cb = centerOf(b);
  const dx = cb.x - ca.x, dy = cb.y - ca.y;
  const from: DiagramSide = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'r' : 'l') : dy >= 0 ? 'b' : 't';
  return { from, to: OPPOSITE[from] };
}

/** An edge between a compound and something inside it runs from the compound's nearest wall straight to the child. */
function wallToChild(outer: DiagramBox, inner: DiagramBox): { wall: ConnectorEnd; child: ConnectorEnd } {
  const gaps: [DiagramSide, number][] = [['t', inner.y - outer.y], ['r', outer.x + outer.w - (inner.x + inner.w)], ['b', outer.y + outer.h - (inner.y + inner.h)], ['l', inner.x - outer.x]];
  let side: DiagramSide = 'l', best = Infinity;
  for (const [s, gap] of gaps) if (gap < best) { best = gap; side = s; }
  const c = centerOf(inner);
  const p = side === 't' ? { x: c.x, y: outer.y } : side === 'b' ? { x: c.x, y: outer.y + outer.h } : side === 'l' ? { x: outer.x, y: c.y } : { x: outer.x + outer.w, y: c.y };
  // A child dragged through that wall is met on its near side, not across its whole width.
  const near = best < 0 ? OPPOSITE[side] : side;
  return { wall: { p, n: NORMAL[near === side ? OPPOSITE[side] : side] }, child: { p: anchorPoint(inner, near), n: NORMAL[near] } };
}

const portOf = (node: DiagramNode<unknown>, id: string | undefined) => (id ? node.ports?.find((p) => p.id === id) : undefined);

/** The route of one edge: its `points` if it has them, otherwise one that fits how its ends sit. Null when an end doesn't
 *  exist. `spread` says how far along their shared side this edge's ends sit (see `edgeGeometries`), so parallel edges
 *  don't lie on top of each other. */
export function edgeGeometry<N, E>(edge: DiagramEdge<E>, index: DiagramIndex<N>, spread?: { from?: number; to?: number; loop?: number }): ConnectorGeometry | null {
  if (edge.points && edge.points.length >= 2) return polylinePath(edge.points);
  const a = index.byId.get(edge.from), b = index.byId.get(edge.to);
  if (!a || !b) return null;
  const pa = portOf(a, edge.fromPort), pb = portOf(b, edge.toPort);
  if (a === b) {
    const loop = spread?.loop ?? 0;
    const ends: [ConnectorEnd, ConnectorEnd] = pa || pb
      ? [pa ? portPoint(a, pa) : { p: anchorPoint(a, 't', 0.35), n: NORMAL.t }, pb ? portPoint(a, pb) : { p: anchorPoint(a, 't', 0.65), n: NORMAL.t }]
      : [{ p: anchorPoint(a, 't', 0.35 - Math.min(loop, 3) * 0.08), n: NORMAL.t }, { p: anchorPoint(a, 't', 0.65 + Math.min(loop, 3) * 0.08), n: NORMAL.t }];
    return selfLoopPath(a, ends[0], ends[1], SELF_LOOP_SIZE + loop * 12);
  }
  const route = edge.route ?? 'elbow';
  if (!pa && !pb && (isInside(index, b.id, a.id) || isInside(index, a.id, b.id))) {
    const outer = isInside(index, b.id, a.id) ? a : b, inner = outer === a ? b : a;
    const { wall, child } = wallToChild(outer, inner);
    // They're in a line already, so anything but a curve is a straight run.
    const run = route === 'curve' ? 'curve' : 'straight';
    return outer === a ? connectorPath(run, wall, child) : connectorPath(run, child, wall);
  }
  const sides = facingSides(a, b);
  const from: ConnectorEnd = pa ? portPoint(a, pa) : { p: anchorPoint(a, sides.from, spread?.from ?? 0.5), n: anchorNormal(a, sides.from) };
  const to: ConnectorEnd = pb ? portPoint(b, pb) : { p: anchorPoint(b, sides.to, spread?.to ?? 0.5), n: anchorNormal(b, sides.to) };
  return connectorPath(route, from, to);
}

/** The routes of many edges, by id. Edges that have no route of their own and leave the same side of a node share it out
 *  evenly, in the order of what they lead to, and a node's self-loops nest. An edge whose end doesn't exist isn't in it. */
export function edgeGeometries<N, E>(edges: readonly DiagramEdge<E>[], index: DiagramIndex<N>): Map<string, ConnectorGeometry> {
  // Who's on each side of each node.
  const onSide = new Map<string, { edge: string; end: 'from' | 'to'; other: Pt }[]>();
  const loops = new Map<string, number>();
  const spread = new Map<string, { from?: number; to?: number; loop?: number }>();
  for (const e of edges) {
    if ((e.points && e.points.length >= 2) || e.fromPort || e.toPort) continue;
    const a = index.byId.get(e.from), b = index.byId.get(e.to);
    if (!a || !b) continue;
    if (a === b) {
      const loop = loops.get(a.id) ?? 0;
      loops.set(a.id, loop + 1);
      spread.set(e.id, { loop });
      continue;
    }
    if (isInside(index, b.id, a.id) || isInside(index, a.id, b.id)) continue;
    const sides = facingSides(a, b);
    const add = (node: DiagramNode<N>, side: DiagramSide, end: 'from' | 'to', other: DiagramNode<N>) => {
      const key = `${node.id}\0${side}`;
      const list = onSide.get(key);
      const item = { edge: e.id, end, other: centerOf(other) };
      if (list) list.push(item);
      else onSide.set(key, [item]);
    };
    add(a, sides.from, 'from', b);
    add(b, sides.to, 'to', a);
  }
  for (const [key, list] of onSide) {
    if (list.length < 2) continue;
    const side = key.slice(key.lastIndexOf('\0') + 1);
    const horizontal = side === 't' || side === 'b';
    list.sort((p, q) => (horizontal ? p.other.x - q.other.x : p.other.y - q.other.y) || (p.edge < q.edge ? -1 : 1));
    list.forEach((item, i) => {
      const s = spread.get(item.edge) ?? {};
      s[item.end] = (i + 1) / (list.length + 1);
      spread.set(item.edge, s);
    });
  }
  const out = new Map<string, ConnectorGeometry>();
  for (const e of edges) {
    const g = edgeGeometry(e, index, spread.get(e.id));
    if (g) out.set(e.id, g);
  }
  return out;
}

/* ── Hit tests ── */

/** How far `p` is from a connector. */
export const distToConnector = (g: { pts: readonly Pt[] }, p: Pt): number => distToPolyline(p, g.pts);

/** A connector's bounds. */
export const connectorBounds = (g: { pts: readonly Pt[] }): Rect => rectOf(g.pts);

/** The deepest node under `p`, `pad` units out, and the last drawn of those. */
export function nodeAt<N>(p: Pt, index: DiagramIndex<N>, pad = 0): DiagramNode<N> | null {
  let best: DiagramNode<N> | null = null;
  let depth = -1;
  for (const n of index.nodes) {
    if (!inFrame(p, n, pad)) continue;
    const d = index.depth.get(n.id) ?? 0;
    if (d >= depth) { best = n; depth = d; }
  }
  return best;
}

/** The nearest connector within `tol` of `p`, and the last given of those at the same distance. */
export function edgeAt(p: Pt, geometries: ReadonlyMap<string, ConnectorGeometry>, tol: number): string | null {
  let best: string | null = null;
  let d = Infinity;
  for (const [id, g] of geometries) {
    const here = distToConnector(g, p);
    if (here <= tol && here <= d) { best = id; d = here; }
  }
  return best;
}
