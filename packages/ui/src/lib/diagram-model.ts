/* ══ Diagram model — nodes, ports, edges and groups as plain data, and the geometry of what connects them ══
   Nothing here renders, and it is the one place a connector gets its shape.
   - a node is a box in board units, absolute rather than relative to its parent; `parent` nests it in a group;
   - a port is a named place on one side of a node;
   - an edge joins two nodes, or two of their ports. `points` is a route someone already worked out (a layout), and
     without it `edgeGeometry` finds one.
   Freeform's connectors, Interface Builder's segues and Replay Canvas's segues run on the same geometry. The frame math
   underneath (rotation, distances, bounds) is the canvas toolkit's, in `@/lib/canvas-math`. */
import { centerOf, dist, distToPolyline, inFrame, rectOf, rotatePt, unionRect, type Pt, type Rect } from '@/lib/canvas-math';
import type { DiagramTextKind } from '@/lib/diagram-text';
import type { IconName } from '@/lib/icon';

/* ── The data ── */

/** A side of a box. Physical words, not `start` / `end`: a board doesn't mirror in a right-to-left language. */
export type DiagramSide = 'top' | 'right' | 'bottom' | 'left';
export const DIAGRAM_SIDES: readonly DiagramSide[] = ['top', 'right', 'bottom', 'left'];

/** A box that may be turned about its center (degrees). A `Frame` is one. */
export type DiagramBox = Rect & { rot?: number };

/** A named place on a node's side. */
export interface DiagramPort {
  id: string;
  side: DiagramSide;
  /** How far along the side, from 0 at its top or left end to 1 at the other (default 0.5). */
  at?: number;
  label?: string;
  /** What it carries. By default a connection can only join ports of the same kind. */
  kind?: string;
  /** Which way connections go: `in`, `out` or (the default) `both`. */
  direction?: 'in' | 'out' | 'both';
}

/** What a node is: a `node` (the default), a `group` that holds others, a `region` (a lane of a group, with a line
 *  between it and the next), the `root` that holds everything and isn't a thing to select, or a small round `marker`. */
export type DiagramNodeKind = 'node' | 'group' | 'region' | 'root' | 'marker';

/** A node's border: one line (the default), a dashed line, or two lines. */
export type DiagramNodeVariant = 'default' | 'dashed' | 'double';

/** An edge's line: thin and quiet (the default), dashed, dotted, or strong. */
export type DiagramEdgeVariant = 'default' | 'dashed' | 'dotted' | 'strong';

/** An edge's color: `destructive` for something wrong with it, which is dashed as well, as a color isn't enough. */
export type DiagramEdgeTone = 'default' | 'destructive';

/** Whether a node holds others: a group, a region or the root. */
export const holdsNodes = (node: { kind?: DiagramNodeKind }): boolean => node.kind === 'group' || node.kind === 'region' || node.kind === 'root';

/** A glyph: one of the kit's icons by name, or a few characters drawn as one (`{ text: 'H*' }`). */
export type DiagramGlyph = IconName | { text: string };

/** The kit's semantic colors, and `muted` for a quiet one. */
export type DiagramTone = 'default' | 'success' | 'warning' | 'destructive' | 'muted';

/** One entry of a section: a chip, or a row of text in a `list` or `code` section. */
export interface DiagramSectionItem {
  /** Its address in `onAction` (default: its `title`). Unique in its section. */
  id?: string;
  title: string;
  /** Quieter words after the title: a type, a value, parameters. */
  description?: string;
  icon?: DiagramGlyph;
  tone?: DiagramTone;
  /** A port of the node that sits on this item's row: without an `at` of its own, the port follows the row. */
  port?: string;
}

/** A labelled group of items: a quiet caption over a column of them. */
export interface DiagramSection {
  /** Its address in `onAction` (default: its index, as a string). */
  id?: string;
  /** The caption. An edge label's chips usually go without one. */
  title?: string;
  /** `default`: bordered chips. `list`: plain rows of text. `code`: plain rows in the mono face. */
  variant?: 'default' | 'list' | 'code';
  items: readonly DiagramSectionItem[];
}

export interface DiagramNode<D = unknown> extends Rect {
  id: string;
  /** The group it sits in. A node moves with its parent. */
  parent?: string | null;
  kind?: DiagramNodeKind;
  variant?: DiagramNodeVariant;
  /** The header strip's words. */
  title?: string;
  /** A glyph at the start of the header strip. */
  icon?: DiagramGlyph;
  /** Short words at the end of the header strip, drawn as a quiet badge. */
  trailing?: string;
  /** A quiet paragraph under the header. */
  description?: string;
  /** Labelled sections of items under the header (and, in something that holds others, before what it holds). */
  sections?: readonly DiagramSection[];
  /** The entry marker: a dot with a curved arrow into the node's top-start corner. */
  entry?: boolean;
  /** A colored accent on the header strip; `default` for none. */
  tone?: DiagramTone;
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
  /** The label's heading. Alone, the label is a pill; with `sections`, a small card with the title on top. */
  title?: string;
  /** A glyph before the title. */
  icon?: DiagramGlyph;
  /** Items under the title, which make the label a card. */
  sections?: readonly DiagramSection[];
  /** Where the label sits, in board units: a layout puts it on the route. Without it, one is found. */
  labelBox?: Rect;
  variant?: DiagramEdgeVariant;
  tone?: DiagramEdgeTone;
  data?: D;
}

/** A section's address: its `id`, or its index. */
export const sectionKey = (section: DiagramSection, index: number): string => section.id ?? String(index);
/** An item's address in its section: its `id`, or its title. */
export const itemKey = (item: DiagramSectionItem): string => item.id ?? item.title;

/** Whether an edge has a label to draw. */
export const hasEdgeLabel = (edge: Pick<DiagramEdge<unknown>, 'title' | 'sections'>): boolean => !!edge.title || !!edge.sections?.some((s) => s.items.length);

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

const NORMAL: Record<DiagramSide, Pt> = { top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 } };
const OPPOSITE: Record<DiagramSide, DiagramSide> = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' };

/** A place on a box's side, in the board (rotation applied): the midpoint unless `at` says otherwise. */
export function anchorPoint(box: DiagramBox, side: DiagramSide, at = 0.5): Pt {
  const local: Pt = side === 'top' ? { x: box.x + box.w * at, y: box.y }
    : side === 'bottom' ? { x: box.x + box.w * at, y: box.y + box.h }
    : side === 'left' ? { x: box.x, y: box.y + box.h * at }
    : { x: box.x + box.w, y: box.y + box.h * at };
  return box.rot ? rotatePt(local, centerOf(box), box.rot) : local;
}

/** Which way a side faces on the board (rotation applied), as a unit vector. */
export function anchorNormal(box: DiagramBox, side: DiagramSide): Pt {
  const n = NORMAL[side];
  return box.rot ? rotatePt(n, { x: 0, y: 0 }, box.rot) : n;
}

/** The side whose midpoint is nearest `p`, the earlier of top, right, bottom, left on a tie. */
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
export function connectorPath(route: ConnectorRoute, a: ConnectorEnd, b: ConnectorEnd, gap = ELBOW_GAP, turn = 0.5): ConnectorGeometry {
  if (route === 'straight') return polylinePath([a.p, b.p]);
  const na = a.n ?? dominantSide(a.p, b.p);
  const nb = b.n ?? dominantSide(b.p, a.p);
  if (route === 'curve') {
    const k = Math.max(40, dist(a.p, b.p) * 0.4);
    return curvePath(a.p, { x: a.p.x + na.x * k, y: a.p.y + na.y * k }, { x: b.p.x + nb.x * k, y: b.p.y + nb.y * k }, b.p);
  }
  // Elbow: leave each end along its side, and meet in the middle with right angles.
  const a1 = { x: a.p.x + na.x * gap, y: a.p.y + na.y * gap };
  const b1 = { x: b.p.x + nb.x * gap, y: b.p.y + nb.y * gap };
  const horizA = Math.abs(na.x) > 0.5, horizB = Math.abs(nb.x) > 0.5;
  let mid: Pt[];
  // `turn` says where between the two the middle run goes: 0 next to `a`, 1 next to `b`.
  const between = (u: number, v: number) => (turn === 0.5 ? (u + v) / 2 : u + (v - u) * turn);
  if (horizA && horizB) { const mx = between(a1.x, b1.x); mid = [{ x: mx, y: a1.y }, { x: mx, y: b1.y }]; }
  else if (!horizA && !horizB) { const my = between(a1.y, b1.y); mid = [{ x: a1.x, y: my }, { x: b1.x, y: my }]; }
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
 *  doesn't run through the text, and above it where there's a choice (`flip` puts it on the other side). */
export function labelBox(pts: readonly Pt[], size: { w: number; h: number }, { t = 0.5, gap = 2, flip = false }: { t?: number; gap?: number; flip?: boolean } = {}): Rect {
  const { point, dir } = pointAlong(pts, t);
  let nx = dir.y, ny = -dir.x;
  if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
  if (flip) { nx = -nx; ny = -ny; }
  const off = gap + (Math.abs(nx) * size.w) / 2 + (Math.abs(ny) * size.h) / 2;
  return { x: point.x + nx * off - size.w / 2, y: point.y + ny * off - size.h / 2, w: size.w, h: size.h };
}

/** A label's box centered on a route, `t` of the way along it: the route runs into it and out of it. */
export function labelBoxOnRoute(pts: readonly Pt[], size: { w: number; h: number }, t = 0.5): Rect {
  const { point } = pointAlong(pts, t);
  return { x: point.x - size.w / 2, y: point.y - size.h / 2, w: size.w, h: size.h };
}

/** Where along a route a label tries to go, in order: on the route, at the middle and then out along it; then beside it,
 *  above and then below; then the same again, standing further off the line, a step at a time. */
const LABEL_TRIES: readonly { t: number; flip: boolean; step: number }[] = [
  ...[0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8].map((t) => ({ t, flip: false, step: -1 })),
  ...[0, 1, 2].flatMap((step) => [0.5, 0.35, 0.65, 0.2, 0.8].flatMap((t) => [{ t, flip: false, step }, { t, flip: true, step }])),
];

/** A label's box that keeps clear of what `overlap` says it covers (nodes, other labels): `given` if that's clear, or else
 *  the first clear place on the route, then beside it and further off it, or failing all that the place that covers least. */
export function labelBoxAvoiding(pts: readonly Pt[], size: { w: number; h: number }, overlap: (box: Rect) => number, given?: Rect): Rect {
  if (given && overlap(given) <= 0) return given;
  let best = given ?? null, least = given ? overlap(given) : Infinity;
  // First, on the middle of a straight run that holds it with room to spare: the one into its end (where a fan's labels
  // stand apart), then the one out of its start, then the longest. There it reads as the line's and leaves the turns clear.
  const runs: number[] = [];
  const line = simplifyRoute(pts);
  let longest = -1, most = 0;
  for (let i = 1; i < line.length; i++) { const l = dist(line[i - 1], line[i]); if (l > most) { most = l; longest = i; } }
  for (const i of [line.length - 1, 1, longest]) {
    if (i < 1 || runs.includes(i)) continue;
    const a = line[i - 1], b = line[i];
    const along = Math.abs(a.x - b.x) < 0.5 ? size.h : Math.abs(a.y - b.y) < 0.5 ? size.w : Infinity;
    if (dist(a, b) >= along + 24) runs.push(i);
  }
  for (const i of runs) {
    const m = { x: (line[i - 1].x + line[i].x) / 2, y: (line[i - 1].y + line[i].y) / 2 };
    const box = { x: m.x - size.w / 2, y: m.y - size.h / 2, w: size.w, h: size.h };
    const covered = overlap(box);
    if (covered <= 0) return box;
    if (covered < least) { least = covered; best = box; }
  }
  for (const { t, flip, step } of LABEL_TRIES) {
    const box = step < 0 ? labelBoxOnRoute(pts, size, t) : labelBox(pts, size, { t, flip, gap: 2 + step * (size.h + 8) });
    const covered = overlap(box);
    if (covered <= 0) return box;
    if (covered < least) { least = covered; best = box; }
  }
  return best!;
}

/** A polyline as SVG path data with its corners rounded by up to `radius`, never more than half of either run beside a
 *  corner, so short steps stay square-ish and nothing overshoots. */
export function roundedPolylineD(pts: readonly Pt[], radius = 8): string {
  if (pts.length < 3 || radius <= 0) return polylineD(pts);
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const l1 = dist(a, b), l2 = dist(b, c);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    if (r < 0.5) { d += `L${b.x} ${b.y}`; continue; }
    const p1 = { x: b.x + ((a.x - b.x) / l1) * r, y: b.y + ((a.y - b.y) / l1) * r };
    const p2 = { x: b.x + ((c.x - b.x) / l2) * r, y: b.y + ((c.y - b.y) / l2) * r };
    d += `L${round2(p1.x)} ${round2(p1.y)}Q${b.x} ${b.y} ${round2(p2.x)} ${round2(p2.y)}`;
  }
  const z = pts[pts.length - 1];
  return `${d}L${z.x} ${z.y}`;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Rects in a grid of `cell`-sized buckets, for asking quickly how much of a box they cover. */
export function rectIndex(rects: readonly Rect[], cell = 160): { add: (r: Rect) => void; overlap: (box: Rect, except?: (r: Rect) => boolean) => number } {
  const buckets = new Map<string, Rect[]>();
  const cells = (r: Rect, visit: (key: string) => void) => {
    for (let i = Math.floor(r.x / cell); i <= Math.floor((r.x + r.w) / cell); i++) {
      for (let j = Math.floor(r.y / cell); j <= Math.floor((r.y + r.h) / cell); j++) visit(`${i},${j}`);
    }
  };
  const add = (r: Rect) => cells(r, (key) => {
    const list = buckets.get(key);
    if (list) list.push(r);
    else buckets.set(key, [r]);
  });
  for (const r of rects) add(r);
  return {
    add,
    overlap: (box, except) => {
      const seen = new Set<Rect>();
      let area = 0;
      cells(box, (key) => {
        for (const r of buckets.get(key) ?? []) {
          if (seen.has(r) || except?.(r)) continue;
          seen.add(r);
          const w = Math.min(box.x + box.w, r.x + r.w) - Math.max(box.x, r.x), h = Math.min(box.y + box.h, r.y + r.h) - Math.max(box.y, r.y);
          if (w > 0 && h > 0) area += w * h;
        }
      });
      return area;
    },
  };
}

/* ── An edge's route ── */

/** How far a self-loop stands off its node. */
export const SELF_LOOP_SIZE = 24;

/** A route from one place on a box to another that stays outside it. A self-loop. */
export function selfLoopPath(box: DiagramBox, a: ConnectorEnd, b: ConnectorEnd, size = SELF_LOOP_SIZE): ConnectorGeometry {
  const na = a.n ?? NORMAL.top, nb = b.n ?? na;
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

/** Which sides two boxes face each other on: across the wider gap between them. Where they overlap one way there's only
 *  the other, as a route out of the facing side would have to double back through the box. Two that overlap both ways go
 *  by their centers, and two in the same place count as side by side, so the answer's still a real route. */
export function facingSides(a: DiagramBox, b: DiagramBox): { from: DiagramSide; to: DiagramSide } {
  const ca = centerOf(a), cb = centerOf(b);
  const dx = cb.x - ca.x, dy = cb.y - ca.y;
  const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  const across = gapX > 0 || gapY > 0 ? gapX >= gapY : Math.abs(dx) >= Math.abs(dy);
  const from: DiagramSide = across ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top';
  return { from, to: OPPOSITE[from] };
}

/** An edge between a group and something inside it runs from the group's nearest wall straight to the child. */
function wallToChild(outer: DiagramBox, inner: DiagramBox): { wall: ConnectorEnd; child: ConnectorEnd } {
  const gaps: [DiagramSide, number][] = [['top', inner.y - outer.y], ['right', outer.x + outer.w - (inner.x + inner.w)], ['bottom', outer.y + outer.h - (inner.y + inner.h)], ['left', inner.x - outer.x]];
  let side: DiagramSide = 'left', best = Infinity;
  for (const [s, gap] of gaps) if (gap < best) { best = gap; side = s; }
  const c = centerOf(inner);
  const p = side === 'top' ? { x: c.x, y: outer.y } : side === 'bottom' ? { x: c.x, y: outer.y + outer.h } : side === 'left' ? { x: outer.x, y: c.y } : { x: outer.x + outer.w, y: c.y };
  // A child dragged through that wall is met on its near side, not across its whole width.
  const near = best < 0 ? OPPOSITE[side] : side;
  return { wall: { p, n: NORMAL[near === side ? OPPOSITE[side] : side] }, child: { p: anchorPoint(inner, near), n: NORMAL[near] } };
}

const portOf = (node: DiagramNode<unknown>, id: string | undefined) => (id ? node.ports?.find((p) => p.id === id) : undefined);

const ownRoutes = new WeakMap<object, ConnectorGeometry>();

/** The route of one edge: its `points` if it has them, otherwise one that fits how its ends sit. Null when an end doesn't
 *  exist. `spread` says how far along their shared side this edge's ends sit (see `edgeGeometries`), so parallel edges
 *  don't lie on top of each other. */
export function edgeGeometry<N, E>(edge: DiagramEdge<E>, index: DiagramIndex<N>, spread?: { from?: number; to?: number; loop?: number; turn?: number }): ConnectorGeometry | null {
  if (edge.points && edge.points.length >= 2) {
    // A route of its own doesn't depend on anything else, so it's only worked out once per edge object.
    let g = ownRoutes.get(edge);
    if (!g) { g = polylinePath(edge.points); ownRoutes.set(edge, g); }
    return g;
  }
  const a = index.byId.get(edge.from), b = index.byId.get(edge.to);
  if (!a || !b) return null;
  const pa = portOf(a, edge.fromPort), pb = portOf(b, edge.toPort);
  if (a === b) {
    const loop = spread?.loop ?? 0;
    // Beside the node, out of its right side and back in: a loop that doesn't cross the header.
    const ends: [ConnectorEnd, ConnectorEnd] = pa || pb
      ? [pa ? portPoint(a, pa) : { p: anchorPoint(a, 'right', 0.35), n: NORMAL.right }, pb ? portPoint(a, pb) : { p: anchorPoint(a, 'right', 0.65), n: NORMAL.right }]
      : [{ p: anchorPoint(a, 'right', 0.35 - Math.min(loop, 3) * 0.08), n: NORMAL.right }, { p: anchorPoint(a, 'right', 0.65 + Math.min(loop, 3) * 0.08), n: NORMAL.right }];
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
  // Two ends closer than two runs out from each would overshoot and come back, so each only goes halfway.
  const apart = from.n ? (to.p.x - from.p.x) * from.n.x + (to.p.y - from.p.y) * from.n.y : Infinity;
  const gap = apart > 0 && apart < ELBOW_GAP * 2 ? apart / 2 : ELBOW_GAP;
  if (route === 'elbow') {
    const around = elbowAround(from, to, a, b, gap);
    if (around) return around;
  }
  return connectorPath(route, from, to, gap, spread?.turn);
}

/** An elbow whose ends face away from each other (a port on the right of one card to a port on the left of a card to its
 *  left, say) would run back through the cards. It goes around them instead: out of each end, then along a channel
 *  between the two boxes, or past both of them on the side nearer the ends. Null when the plain elbow is fine. */
export function elbowAround(from: ConnectorEnd, to: ConnectorEnd, a: Rect, b: Rect, gap = ELBOW_GAP): ConnectorGeometry | null {
  const na = from.n, nb = to.n;
  if (!na || !nb) return null;
  const horizontal = Math.abs(na.x) > 0.5 && Math.abs(nb.x) > 0.5;
  const vertical = Math.abs(na.y) > 0.5 && Math.abs(nb.y) > 0.5;
  if (!horizontal && !vertical) return null;
  // Work across x as "along" and y as "across", and turn the answer back for an upright pair.
  const along = (p: Pt) => (horizontal ? p.x : p.y), across = (p: Pt) => (horizontal ? p.y : p.x);
  const make = (u: number, v: number): Pt => (horizontal ? { x: u, y: v } : { x: v, y: u });
  const da = along(na), db = along(nb);
  const a1 = along(from.p) + da * gap, b1 = along(to.p) + db * gap;
  // Facing each other with room between, or one behind the other going the same way: the plain elbow's middle is fine.
  if ((b1 - a1) * da >= 0 && (a1 - b1) * db >= 0) return null;
  const lo = (r: Rect) => (horizontal ? r.y : r.x), hi = (r: Rect) => (horizontal ? r.y + r.h : r.x + r.w);
  let channel: number;
  if (hi(a) + gap <= lo(b) - gap || hi(b) + gap <= lo(a) - gap) {
    // There's a gap between them across the way: run along the middle of it.
    channel = hi(a) <= lo(b) ? (hi(a) + lo(b)) / 2 : (hi(b) + lo(a)) / 2;
  } else {
    const before = Math.min(lo(a), lo(b)) - gap, after = Math.max(hi(a), hi(b)) + gap;
    const cost = (c: number) => Math.abs(across(from.p) - c) + Math.abs(across(to.p) - c);
    channel = cost(before) <= cost(after) ? before : after;
  }
  return polylinePath([from.p, make(a1, across(from.p)), make(a1, channel), make(b1, channel), make(b1, across(to.p)), to.p]);
}

/** Whether an upright or level run from `a` to `b` goes through the inside of `r`. */
function runHits(a: Pt, b: Pt, r: Rect): boolean {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  return x1 > r.x + 0.5 && x0 < r.x + r.w - 0.5 && y1 > r.y + 0.5 && y0 < r.y + r.h - 0.5;
}

/** Whether a route goes through any of `boxes`. */
function routeHits(pts: readonly Pt[], boxes: readonly Rect[]): boolean {
  for (let i = 1; i < pts.length; i++) for (const r of boxes) if (runHits(pts[i - 1], pts[i], r)) return true;
  return false;
}

/** How far a route around boxes keeps from them, and what a turn costs against length. */
const AROUND_GAP = 14;
const TURN_COST = 40;

/**
 * A square route from one end to the other that goes round `boxes` instead of through them: the shortest, with few turns,
 * along lines a little off each box's sides and out from each end. Null when there's none (an end shut in).
 */
function routeAround(from: ConnectorEnd, to: ConnectorEnd, boxes: readonly Rect[], gap = ELBOW_GAP): Pt[] | null {
  const na = from.n ?? dominantSide(from.p, to.p), nb = to.n ?? dominantSide(to.p, from.p);
  const a1 = { x: from.p.x + na.x * gap, y: from.p.y + na.y * gap }, b1 = { x: to.p.x + nb.x * gap, y: to.p.y + nb.y * gap };
  if (boxes.some((r) => runHits(from.p, a1, r) || runHits(b1, to.p, r))) return null;
  const xs = new Set([a1.x, b1.x]), ys = new Set([a1.y, b1.y]);
  for (const r of boxes) {
    xs.add(r.x - AROUND_GAP); xs.add(r.x + r.w + AROUND_GAP);
    ys.add(r.y - AROUND_GAP); ys.add(r.y + r.h + AROUND_GAP);
  }
  const X = [...xs].sort((p, q) => p - q), Y = [...ys].sort((p, q) => p - q);
  const inside = (x: number, y: number) => boxes.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
  const W = X.length, H = Y.length;
  const id = (i: number, j: number, d: number) => (j * W + i) * 4 + d;
  // Dijkstra over grid points and the way it's going (0 right, 1 down, 2 left, 3 up).
  const cost = new Float64Array(W * H * 4).fill(Infinity);
  const prev = new Int32Array(W * H * 4).fill(-1);
  const si = X.indexOf(a1.x), sj = Y.indexOf(a1.y), ti = X.indexOf(b1.x), tj = Y.indexOf(b1.y);
  const startDir = na.x > 0.5 ? 0 : na.y > 0.5 ? 1 : na.x < -0.5 ? 2 : 3;
  const heap: [number, number][] = [];
  const push = (c: number, k: number) => {
    heap.push([c, k]);
    for (let i = heap.length - 1; i > 0;) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; }
    }
    return top;
  };
  cost[id(si, sj, startDir)] = 0;
  push(0, id(si, sj, startDir));
  const step = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let end = -1;
  while (heap.length) {
    const [c, k] = pop();
    if (c > cost[k]) continue;
    const d = k % 4, cell = (k - d) / 4, i = cell % W, j = (cell - i) / W;
    if (i === ti && j === tj) { end = k; break; }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (d + 2) % 4) continue;
      const ni = i + step[nd][0], nj = j + step[nd][1];
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const p = { x: X[i], y: Y[j] }, q = { x: X[ni], y: Y[nj] };
      if (inside(q.x, q.y) || boxes.some((r) => runHits(p, q, r))) continue;
      const nc = c + Math.abs(q.x - p.x) + Math.abs(q.y - p.y) + (nd === d ? 0 : TURN_COST);
      const nk = id(ni, nj, nd);
      if (nc < cost[nk]) { cost[nk] = nc; prev[nk] = k; push(nc, nk); }
    }
  }
  if (end < 0) return null;
  const path: Pt[] = [];
  for (let k = end; k >= 0; k = prev[k]) { const cell = (k - (k % 4)) / 4; path.push({ x: X[cell % W], y: Y[(cell - (cell % W)) / W] }); }
  path.reverse();
  return simplifyRoute([from.p, ...path, to.p]);
}

/** The routes of many edges, by id. Edges that have no route of their own and leave the same side of a node share it out
 *  evenly, in the order of what they lead to, and a node's self-loops nest. With `avoid`, one whose elbow would run through
 *  a card (or a box's header) goes round instead: for a hand-placed diagram that isn't too big to work out each time. An
 *  edge whose end doesn't exist isn't in it. */
export function edgeGeometries<N, E>(edges: readonly DiagramEdge<E>[], index: DiagramIndex<N>, { avoid = false }: { avoid?: boolean } = {}): Map<string, ConnectorGeometry> {
  // Who's on each side of each node.
  const onSide = new Map<string, { edge: string; end: 'from' | 'to'; other: Pt }[]>();
  const loops = new Map<string, number>();
  const spread = new Map<string, { from?: number; to?: number; loop?: number; turn?: number }>();
  const keys = new Map<string, [string, string]>();
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
    keys.set(e.id, [`${a.id}\0${sides.from}`, `${b.id}\0${sides.to}`]);
  }
  // A fan (one side with more ends than the other) turns next to its crowded end, so each edge's long run, where its label
  // goes, is next to the end it has to itself.
  for (const [id, [fk, tk]] of keys) {
    const f = onSide.get(fk)?.length ?? 0, t = onSide.get(tk)?.length ?? 0;
    if (f === t) continue;
    spread.set(id, { ...spread.get(id), turn: f > t ? 0 : 1 });
  }
  for (const [key, list] of onSide) {
    if (list.length < 2) continue;
    const side = key.slice(key.lastIndexOf('\0') + 1);
    const horizontal = side === 'top' || side === 'bottom';
    list.sort((p, q) => (horizontal ? p.other.x - q.other.x : p.other.y - q.other.y) || (p.edge < q.edge ? -1 : 1));
    list.forEach((item, i) => {
      const s = spread.get(item.edge) ?? {};
      s[item.end] = (i + 1) / (list.length + 1);
      spread.set(item.edge, s);
    });
  }
  const out = new Map<string, ConnectorGeometry>();
  // What a route mustn't go through: every card, and the strip along the top of every box that its header takes.
  const blocks = avoid ? index.nodes.flatMap((n) => (n.kind === 'marker' || n.kind === 'region' ? [] : holdsNodes(n) ? (n.kind === 'root' ? [] : [{ id: n.id, r: { x: n.x, y: n.y, w: n.w, h: Math.min(n.h, HEADER_ROOM) } }]) : [{ id: n.id, r: rectOf2(n) }])) : [];
  for (const e of edges) {
    let g = edgeGeometry(e, index, spread.get(e.id));
    if (g && avoid && !e.points && e.from !== e.to && e.route !== 'curve' && e.route !== 'straight') {
      const keep = new Set([e.from, e.to, ...ancestorsOf(index, e.from), ...ancestorsOf(index, e.to)]);
      const boxes = blocks.filter((b) => !keep.has(b.id)).map((b) => b.r);
      if (routeHits(g.pts, boxes)) {
        const a = g.pts[0], b = g.pts[g.pts.length - 1];
        // Each end leaves its card the way it faces: against the way the route runs into it.
        const around = routeAround({ p: a, n: unitOrNull({ x: -g.startDir.x, y: -g.startDir.y }) }, { p: b, n: unitOrNull({ x: -g.endDir.x, y: -g.endDir.y }) }, boxes);
        if (around) g = polylinePath(around);
      }
    }
    if (g) out.set(e.id, g);
  }
  return out;
}

/** How much of a box's top an edge keeps off when going round: its header strip. */
const HEADER_ROOM = 32;
const rectOf2 = (n: Rect): Rect => ({ x: n.x, y: n.y, w: n.w, h: n.h });
/** A route's way out of an end as one of the four sides' normals. */
const unitOrNull = (d: Pt): Pt | null => (Math.abs(d.x) < 1e-6 && Math.abs(d.y) < 1e-6 ? null : Math.abs(d.x) >= Math.abs(d.y) ? { x: Math.sign(d.x), y: 0 } : { x: 0, y: Math.sign(d.y) });

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
  const along = edgesAtPoint(p, geometries, tol);
  return along.length ? along[along.length - 1] : null;
}

/** Every connector within `tol` of `p` that's as near as the nearest, in the order given. Two edges between the same two
 *  ports are one line, so a press there is on both. */
export function edgesAtPoint(p: Pt, geometries: ReadonlyMap<string, ConnectorGeometry>, tol: number): string[] {
  let out: string[] = [];
  let d = Infinity;
  for (const [id, g] of geometries) {
    const here = distToConnector(g, p);
    if (here > tol) continue;
    if (here < d - 1e-9) { out = [id]; d = here; }
    else if (here <= d + 1e-9) out.push(id);
  }
  return out;
}

/* ── What else gets drawn ── */

export interface DiagramDivider {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** The lines between the regions of each node that holds two or more: halfway across each gap, wall to wall. Regions stacked one above
 *  another get level lines, and regions side by side get upright ones. */
export function regionDividers<N>(index: DiagramIndex<N>): DiagramDivider[] {
  const out: DiagramDivider[] = [];
  for (const p of index.nodes) {
    const regions = (index.children.get(p.id) ?? []).filter((n) => n.kind === 'region');
    if (regions.length < 2) continue;
    // Regions one above another overlap across, and regions side by side overlap down. Their sizes can differ, so where
    // their centers are doesn't say.
    let across = 0, down = 0;
    for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) {
      const a = regions[i], b = regions[j];
      across += Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      down += Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    }
    const stacked = across >= down;
    const sorted = [...regions].sort((a, b) => (stacked ? a.y - b.y : a.x - b.x));
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1], b = sorted[i];
      if (stacked) { const y = (a.y + a.h + b.y) / 2; out.push({ id: `${p.id}/${i}`, x1: p.x, x2: p.x + p.w, y1: y, y2: y }); }
      else { const x = (a.x + a.w + b.x) / 2; out.push({ id: `${p.id}/${i}`, x1: x, x2: x, y1: p.y, y2: p.y + p.h }); }
    }
  }
  return out;
}

/** Everything that gets drawn: the nodes, the routes and the labels' boxes. Null when there's nothing. */
export function diagramBounds(nodes: readonly Rect[], geometries: Iterable<{ pts: readonly Pt[] }> = [], labels: Iterable<Rect> = []): Rect | null {
  const rects: Rect[] = [...nodes];
  for (const g of geometries) rects.push(rectOf(g.pts));
  for (const l of labels) rects.push(l);
  return unionRect(rects);
}

/* ── Sizes from text: a card's anatomy ── */

/** A card's measures, in board units. `DiagramNodeBody` and the edge label draw with the same numbers, as classes. */
export const DIAGRAM_CARD = {
  /** Header strip: padding, a glyph and the room beside it, the badge's padding. */
  headerX: 10, headerY: 6, glyph: 14, glyphGap: 6, trailingGap: 8, badgeX: 6, badgeY: 1,
  /** Under the header: padding, and the room between a description, sections, a caption and its items. */
  bodyX: 10, bodyTop: 8, bodyBottom: 10, descriptionGap: 8, sectionGap: 10, captionGap: 4,
  /** A chip: padding, its glyph, and the room between chips; a list row's room. */
  chipX: 8, chipY: 2, chipIcon: 12, chipIconGap: 6, chipDescriptionGap: 6, chipGap: 4, rowGap: 2,
  /** The least width of a card. */
  minW: 64,
  /** An edge label: a pill's padding; a card's padding, and the room under its title. */
  pillX: 10, pillY: 4, labelX: 10, labelTop: 6, labelTitleGap: 6, labelBottom: 8,
} as const;

/** A `marker`'s size. */
export const MARKER_SIZE = 12;

/** The least zoom a diagram opens at: a chip's 12 px words stay about 11 px (10.5), a title's 13 px over 11. A diagram that
 *  can't be seen whole at that size opens at it, from its top, to be scrolled; a layout wraps a long run into columns to
 *  avoid that. */
export const DIAGRAM_LEGIBLE_ZOOM = 0.875;

/** The room a group keeps around what it holds, past its header and sections. */
export const CONTAINER_PADDING = { side: 16, bottom: 16, top: 12 } as const;

type TextOf = (text: string, kind: DiagramTextKind) => { w: number; h: number };

const NONE = { w: 0, h: 0 };

/** How wide a glyph is: an icon is square, a few characters as wide as they are. */
function glyphSize(glyph: DiagramGlyph, size: number, text: TextOf): number {
  return typeof glyph === 'string' ? size : Math.max(size, text(glyph.text, 'trailing').w + 4);
}

/** An item's title as drawn: in a `code` section, a key with a value or type after it reads `key:` (`audioRef: string`). */
export const codeKey = (item: Pick<DiagramSectionItem, 'title' | 'description'>, code: boolean): string => (code && item.description ? `${item.title}:` : item.title);

function itemSize(item: DiagramSectionItem, variant: DiagramSection['variant'], text: TextOf): { w: number; h: number } {
  const C = DIAGRAM_CARD;
  const code = variant === 'code';
  const t = text(codeKey(item, code), code ? 'code' : 'item');
  const d = item.description ? text(item.description, code ? 'code' : 'description') : NONE;
  const icon = item.icon ? glyphSize(item.icon, C.chipIcon, text) : 0;
  const w = (icon ? icon + C.chipIconGap : 0) + t.w + (item.description ? C.chipDescriptionGap + d.w : 0);
  const h = Math.max(t.h, d.h, icon ? C.chipIcon : 0);
  return !variant || variant === 'default' ? { w: w + C.chipX * 2 + 2, h: h + C.chipY * 2 + 2 } : { w, h };
}

/** The sections block: its size, and the middle of each item's row from its top, by `section\0item`. */
function sectionsSize(sections: readonly DiagramSection[], text: TextOf, gap: number = DIAGRAM_CARD.sectionGap): { w: number; h: number; rows: Map<string, number> } {
  const C = DIAGRAM_CARD;
  const rows = new Map<string, number>();
  let y = 0, w = 0, first = true;
  sections.forEach((s, si) => {
    if (!s.items.length && !s.title) return;
    if (!first) y += gap;
    first = false;
    if (s.title) {
      const c = text(s.title, 'caption');
      w = Math.max(w, c.w);
      y += c.h + (s.items.length ? C.captionGap : 0);
    }
    s.items.forEach((it, ii) => {
      if (ii) y += !s.variant || s.variant === 'default' ? C.chipGap : C.rowGap;
      const size = itemSize(it, s.variant, text);
      rows.set(`${sectionKey(s, si)}\0${itemKey(it)}`, y + size.h / 2);
      w = Math.max(w, size.w);
      y += size.h;
    });
  });
  return { w, h: y, rows };
}

/** The header strip's size. */
function headerSize(node: Pick<DiagramNode<unknown>, 'title' | 'icon' | 'trailing'>, text: TextOf): { w: number; h: number } {
  const C = DIAGRAM_CARD;
  const t = node.title ? text(node.title, 'title') : NONE;
  const icon = node.icon ? glyphSize(node.icon, C.glyph, text) : 0;
  const badge = node.trailing ? text(node.trailing, 'trailing') : null;
  const w = C.headerX * 2 + (icon ? icon + (t.w ? C.glyphGap : 0) : 0) + t.w + (badge ? C.trailingGap + badge.w + C.badgeX * 2 : 0);
  const h = Math.max(t.h || text('M', 'title').h, icon ? C.glyph : 0, badge ? badge.h + C.badgeY * 2 : 0) + C.headerY * 2;
  return { w, h };
}

/** What's under the header: a description and the sections. */
function bodySize(node: Pick<DiagramNode<unknown>, 'description' | 'sections'>, text: TextOf): { w: number; h: number; rows: Map<string, number> } | null {
  const C = DIAGRAM_CARD;
  const sections = node.sections?.filter((s) => s.items.length || s.title) ?? [];
  if (!node.description && !sections.length) return null;
  const d = node.description ? text(node.description, 'description') : NONE;
  const block = sections.length ? sectionsSize(sections, text) : { w: 0, h: 0, rows: new Map<string, number>() };
  const top = C.bodyTop + d.h + (node.description && sections.length ? C.descriptionGap : 0);
  const rows = new Map<string, number>();
  for (const [k, y] of block.rows) rows.set(k, top + y);
  return { w: Math.max(d.w, block.w) + C.bodyX * 2, h: top + block.h + C.bodyBottom, rows };
}

/** A node's anatomy, in board units: its size, how tall its header strip is, where what's under the header starts and
 *  ends (for what holds others, where its children's room starts), and the middle of each item's row from the node's top. */
export interface DiagramAnatomy {
  w: number;
  h: number;
  /** The border's width. */
  border: number;
  header: number;
  /** From the node's top to the end of its header and sections: where something that holds others has room for them. */
  top: number;
  rows: Map<string, number>;
}

/** The anatomy of a node: what `DiagramNodeBody` draws, measured. What holds others gets its size from them, so this is
 *  the least it can be. */
export function nodeAnatomy(node: Pick<DiagramNode<unknown>, 'kind' | 'variant' | 'title' | 'icon' | 'trailing' | 'description' | 'sections'>, text: TextOf): DiagramAnatomy {
  if (node.kind === 'marker') return { w: MARKER_SIZE, h: MARKER_SIZE, border: 0, header: 0, top: 0, rows: new Map() };
  const C = DIAGRAM_CARD;
  // A double border is a pixel thicker on each side, and its inner line takes up a little more.
  const border = node.variant === 'double' ? 2 : node.kind === 'region' ? 0 : 1;
  const inner = node.variant === 'double' ? 4 : border * 2;
  const header = node.title || node.icon || node.trailing || !holdsNodes(node) ? headerSize(node, text) : { w: 0, h: 0 };
  const body = bodySize(node, text);
  const rows = new Map<string, number>();
  const bodyAt = border + header.h + (header.h && body ? 1 : 0);
  if (body) for (const [k, y] of body.rows) rows.set(k, bodyAt + y);
  const top = bodyAt + (body?.h ?? 0);
  const w = Math.ceil(Math.max(holdsNodes(node) ? 0 : C.minW, header.w, body?.w ?? 0) + inner);
  return { w, h: Math.ceil(top + border + (inner - border * 2) / 2), border, header: header.h, top, rows };
}

/** How big a node needs to be for what it says. */
export function nodeSize(node: Pick<DiagramNode<unknown>, 'kind' | 'variant' | 'title' | 'icon' | 'trailing' | 'description' | 'sections'>, text: TextOf): { w: number; h: number } {
  const a = nodeAnatomy(node, text);
  return { w: a.w, h: a.h };
}

/** The size of an edge's label: a pill for a title alone, a card with sections. Null when it has none. */
export function edgeLabelSize(edge: Pick<DiagramEdge<unknown>, 'title' | 'icon' | 'sections'>, text: TextOf): { w: number; h: number } | null {
  if (!hasEdgeLabel(edge)) return null;
  const C = DIAGRAM_CARD;
  const t = edge.title ? text(edge.title, 'edge') : NONE;
  const icon = edge.icon ? glyphSize(edge.icon, C.chipIcon, text) : 0;
  const head = { w: (icon ? icon + (t.w ? 4 : 0) : 0) + t.w, h: Math.max(t.h, icon ? C.chipIcon : 0) };
  const sections = edge.sections?.filter((s) => s.items.length || s.title) ?? [];
  if (!sections.length) return { w: Math.ceil(head.w + C.pillX * 2 + 2), h: Math.ceil(head.h + C.pillY * 2 + 2) };
  const block = sectionsSize(sections, text, 8);
  return {
    w: Math.ceil(Math.max(head.w, block.w) + C.labelX * 2 + 2),
    h: Math.ceil(C.labelTop + head.h + (head.h ? C.labelTitleGap : 0) + block.h + C.labelBottom + 2),
  };
}

/** A port that an item names, without an `at` of its own, sits on that item's row. */
export function placeItemPorts<N extends Pick<DiagramNode<unknown>, 'ports' | 'sections'>>(node: N, anatomy: DiagramAnatomy, h: number): N {
  if (!node.ports?.length || !node.sections?.length) return node;
  const rowOf = new Map<string, number>();
  node.sections.forEach((s, si) => s.items.forEach((it) => { if (it.port) rowOf.set(it.port, anatomy.rows.get(`${sectionKey(s, si)}\0${itemKey(it)}`) ?? -1); }));
  if (!rowOf.size) return node;
  let changed = false;
  const ports = node.ports.map((p) => {
    const y = rowOf.get(p.id);
    if (p.at !== undefined || y === undefined || y < 0 || (p.side !== 'left' && p.side !== 'right')) return p;
    changed = true;
    return { ...p, at: Math.round((y / (h || 1)) * 1000) / 1000 };
  });
  return changed ? { ...node, ports } : node;
}

/** The texts in a diagram, for measuring in one go. */
export function diagramTextRuns(nodes: readonly DiagramNode<unknown>[], edges: readonly DiagramEdge<unknown>[] = []): { text: string; kind: DiagramTextKind }[] {
  const runs: { text: string; kind: DiagramTextKind }[] = [];
  const glyph = (g: DiagramGlyph | undefined) => { if (g && typeof g !== 'string') runs.push({ text: g.text, kind: 'trailing' }); };
  const sections = (list: readonly DiagramSection[] | undefined) => {
    for (const s of list ?? []) {
      if (s.title) runs.push({ text: s.title, kind: 'caption' });
      const code = s.variant === 'code';
      for (const it of s.items) {
        runs.push({ text: codeKey(it, code), kind: code ? 'code' : 'item' });
        if (it.description) runs.push({ text: it.description, kind: code ? 'code' : 'description' });
        glyph(it.icon);
      }
    }
  };
  for (const n of nodes) {
    if (n.kind === 'marker') continue;
    if (n.title) runs.push({ text: n.title, kind: 'title' });
    if (n.trailing) runs.push({ text: n.trailing, kind: 'trailing' });
    if (n.description) runs.push({ text: n.description, kind: 'description' });
    glyph(n.icon);
    sections(n.sections);
  }
  for (const e of edges) {
    if (e.title) runs.push({ text: e.title, kind: 'edge' });
    glyph(e.icon);
    sections(e.sections);
  }
  return runs;
}

/** Nodes resized to what they say, around their centers, with ports that items name placed on their rows. Nodes that
 *  hold others, and nodes whose size didn't change, come back as they were, so a memo on them holds. */
export function sizeNodesToText<N>(nodes: readonly DiagramNode<N>[], text: TextOf): DiagramNode<N>[] {
  return nodes.map((n) => {
    if (holdsNodes(n)) return n;
    const a = nodeAnatomy(n, text);
    const placed = placeItemPorts(n, a, a.h);
    if (a.w === n.w && a.h === n.h && placed === n) return n;
    return { ...placed, x: n.x + (n.w - a.w) / 2, y: n.y + (n.h - a.h) / 2, w: a.w, h: a.h };
  });
}

/* ── Moving things ── */

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

/** A polyline with points on top of each other and points in the middle of a straight run taken out. */
export function simplifyRoute(points: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const a = out[out.length - 1], b = out[out.length - 2];
    if (a && near(a.x, p.x) && near(a.y, p.y)) continue;
    if (a && b && ((near(a.x, b.x) && near(a.x, p.x)) || (near(a.y, b.y) && near(a.y, p.y)))) out.pop();
    out.push(p);
  }
  return out;
}

/**
 * A route that follows its ends when they move by `a` and `b`, staying square: the bend next to each end moves across the
 * run it's on, so that run keeps its direction and the next one only changes length. A single straight run that can't stay
 * straight gets a step in the middle. Anything that isn't square to begin with only has its ends moved.
 */
export function rerouteOrthogonal(points: readonly Pt[], a: Pt, b: Pt): Pt[] {
  if (points.length < 2 || (!a.x && !a.y && !b.x && !b.y)) return [...points];
  if (a.x === b.x && a.y === b.y) return points.map((p) => ({ x: p.x + a.x, y: p.y + a.y }));
  const pts = simplifyRoute(points);
  if (pts.length < 2) return points.map((p, i) => (i === points.length - 1 ? { x: p.x + b.x, y: p.y + b.y } : { x: p.x + a.x, y: p.y + a.y }));
  const last = pts.length - 1;
  const start = { x: pts[0].x + a.x, y: pts[0].y + a.y }, end = { x: pts[last].x + b.x, y: pts[last].y + b.y };
  if (last === 1) {
    if (near(pts[0].y, pts[1].y) && !near(start.y, end.y)) { const m = (start.x + end.x) / 2; return [start, { x: m, y: start.y }, { x: m, y: end.y }, end]; }
    if (near(pts[0].x, pts[1].x) && !near(start.x, end.x)) { const m = (start.y + end.y) / 2; return [start, { x: start.x, y: m }, { x: end.x, y: m }, end]; }
    return [start, end];
  }
  const out = pts.map((p) => ({ ...p }));
  const across = (at: number, run: number, d: Pt) => {
    if (near(pts[at].y, pts[run].y)) out[at] = { x: out[at].x, y: out[at].y + d.y };
    else if (near(pts[at].x, pts[run].x)) out[at] = { x: out[at].x + d.x, y: out[at].y };
    else out[at] = { x: out[at].x + d.x, y: out[at].y + d.y };
  };
  across(1, 0, a);
  across(last - 1, last, b);
  out[0] = start;
  out[last] = end;
  return out;
}

/** A label's box after its route changed: it keeps its place beside the run it sits by. */
export function rerouteLabel(box: Rect, before: readonly Pt[], after: readonly Pt[]): Rect {
  const c = centerOf(box);
  let shift: Pt;
  if (before.length === after.length && before.length >= 2) {
    let best = 1, d = Infinity;
    for (let i = 1; i < before.length; i++) {
      const here = distToPolyline(c, [before[i - 1], before[i]]);
      if (here < d) { d = here; best = i; }
    }
    shift = {
      x: (after[best - 1].x + after[best].x - before[best - 1].x - before[best].x) / 2,
      y: (after[best - 1].y + after[best].y - before[best - 1].y - before[best].y) / 2,
    };
  } else {
    const from = pointAlong(before).point, to = pointAlong(after).point;
    shift = { x: to.x - from.x, y: to.y - from.y };
  }
  return { ...box, x: box.x + shift.x, y: box.y + shift.y };
}

/** The air a group keeps around what's dragged inside it, and the room for its title. */
const COMPOUND_AIR = { top: 32, side: 12 };

/**
 * Nodes moved by (dx, dy), with what's inside them, and edges that follow: a route keeps its shape and stays square, and its
 * label stays beside it. A group grows if a child's dragged to its wall, and because this works from the same starting
 * data each time, it shrinks back if the child's dragged away again. Whatever didn't change comes back as the same object,
 * so a memo on it holds. Ids that don't exist are ignored.
 */
export function moveNodes<N, E>(
  nodes: readonly DiagramNode<N>[], edges: readonly DiagramEdge<E>[], ids: Iterable<string>, dx: number, dy: number, index: DiagramIndex<N> = indexDiagram(nodes),
): { nodes: DiagramNode<N>[]; edges: DiagramEdge<E>[] } {
  const moving = new Set<string>();
  const tops: string[] = [];
  for (const id of ids) {
    if (!index.byId.has(id) || moving.has(id)) continue;
    tops.push(id);
    moving.add(id);
    for (const d of descendantsOf(index, id)) moving.add(d);
  }
  // The groups that have to grow, from the inside out.
  const grown = new Map<string, Rect>();
  const growFor = (id: string, box: Rect) => {
    const parentId = index.parent.get(id);
    if (!parentId || moving.has(parentId)) return;
    const was = grown.get(parentId) ?? index.byId.get(parentId)!;
    const x0 = Math.min(was.x, box.x - COMPOUND_AIR.side), y0 = Math.min(was.y, box.y - COMPOUND_AIR.top);
    const x1 = Math.max(was.x + was.w, box.x + box.w + COMPOUND_AIR.side), y1 = Math.max(was.y + was.h, box.y + box.h + COMPOUND_AIR.side);
    if (x0 === was.x && y0 === was.y && x1 === was.x + was.w && y1 === was.y + was.h) return;
    const next = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    grown.set(parentId, next);
    growFor(parentId, next);
  };
  if (dx || dy) for (const id of tops) { const n = index.byId.get(id)!; growFor(id, { x: n.x + dx, y: n.y + dy, w: n.w, h: n.h }); }
  const nextNodes = nodes.map((n) => {
    if (moving.has(n.id)) return dx || dy ? { ...n, x: n.x + dx, y: n.y + dy } : n;
    const g = grown.get(n.id);
    return g ? { ...n, ...g } : n;
  });
  const shift = { x: dx, y: dy }, none = { x: 0, y: 0 };
  /** How far an edge's end goes: with its node, or with the wall it's on if its node grew. */
  const endShift = (id: string, at: Pt | undefined): Pt => {
    if (moving.has(id)) return shift;
    const g = grown.get(id);
    if (!g || !at) return none;
    const was = index.byId.get(id)!;
    const onLeft = near(at.x, was.x), onRight = near(at.x, was.x + was.w), onTop = near(at.y, was.y), onBottom = near(at.y, was.y + was.h);
    return {
      x: onLeft ? g.x - was.x : onRight ? g.x + g.w - was.x - was.w : 0,
      y: onTop ? g.y - was.y : onBottom ? g.y + g.h - was.y - was.h : 0,
    };
  };
  const nextEdges = edges.map((e) => {
    const a = endShift(e.from, e.points?.[0]), b = endShift(e.to, e.points?.[e.points.length - 1]);
    if (!a.x && !a.y && !b.x && !b.y) return e;
    if (!e.points || e.points.length < 2) {
      if (!e.labelBox) return e;
      // No route of its own, so `labelBox` only needs to go along. It moves half as far when only one end did.
      return { ...e, labelBox: { ...e.labelBox, x: e.labelBox.x + (a.x + b.x) / 2, y: e.labelBox.y + (a.y + b.y) / 2 } };
    }
    const points = rerouteOrthogonal(e.points, a, b);
    return { ...e, points, ...(e.labelBox ? { labelBox: rerouteLabel(e.labelBox, simplifyRoute(e.points).length === points.length ? simplifyRoute(e.points) : e.points, points) } : null) };
  });
  return { nodes: nextNodes, edges: nextEdges };
}

/** What's selected in a diagram. */
export interface DiagramSelection {
  nodes: readonly string[];
  edges: readonly string[];
}

export const NOTHING_SELECTED: DiagramSelection = { nodes: [], edges: [] };

/** A diagram without what's selected: nodes go with what's inside them, and edges go with either end. */
export function deleteItems<N, E>(
  nodes: readonly DiagramNode<N>[], edges: readonly DiagramEdge<E>[], selection: DiagramSelection, index: DiagramIndex<N> = indexDiagram(nodes),
): { nodes: DiagramNode<N>[]; edges: DiagramEdge<E>[] } {
  const gone = new Set<string>();
  for (const id of selection.nodes) {
    if (!index.byId.has(id)) continue;
    gone.add(id);
    for (const d of descendantsOf(index, id)) gone.add(d);
  }
  const goneEdges = new Set(selection.edges);
  return {
    nodes: nodes.filter((n) => !gone.has(n.id)),
    edges: edges.filter((e) => !goneEdges.has(e.id) && !gone.has(e.from) && !gone.has(e.to)),
  };
}

/* ── Connecting ── */

/** A connection between two nodes, or two of their ports. With `edge`, it's an existing edge whose end is moving. */
export interface DiagramConnection {
  from: string;
  fromPort?: string;
  to: string;
  toPort?: string;
  edge?: string;
}

/** The ordinary rules, for when an app has none of its own: a port can't connect to itself, nothing's connected twice, a
 *  connection goes the way its ports go, and ports of a kind only join that kind. Self-loops are fine. Returns true, or why
 *  not, in words. */
export function checkConnection<N, E>(c: DiagramConnection, index: DiagramIndex<N>, edges: readonly DiagramEdge<E>[]): true | string {
  const a = index.byId.get(c.from), b = index.byId.get(c.to);
  if (!a || !b) return 'That isn’t there any more.';
  const pa = c.fromPort ? a.ports?.find((p) => p.id === c.fromPort) : undefined, pb = c.toPort ? b.ports?.find((p) => p.id === c.toPort) : undefined;
  if (a.id === b.id && c.fromPort && c.fromPort === c.toPort) return 'A port can’t connect to itself.';
  if (pa?.direction === 'in') return `${pa.label ?? pa.id} only takes connections in.`;
  if (pb?.direction === 'out') return `${pb.label ?? pb.id} only goes out.`;
  if (pa?.kind && pb?.kind && pa.kind !== pb.kind) return `${pa.label ?? pa.id} carries ${pa.kind}, and ${pb.label ?? pb.id} takes ${pb.kind}.`;
  if (edges.some((e) => e.id !== c.edge && e.from === c.from && e.to === c.to && (e.fromPort ?? '') === (c.fromPort ?? '') && (e.toPort ?? '') === (c.toPort ?? ''))) return 'Those are already connected.';
  return true;
}

/** The edges with a new one added, under an id nothing else has. */
export function addConnection<E>(edges: readonly DiagramEdge<E>[], c: DiagramConnection, create?: (c: DiagramConnection) => DiagramEdge<E>): DiagramEdge<E>[] {
  if (create) return [...edges, create(c)];
  const taken = new Set(edges.map((e) => e.id));
  let n = edges.length + 1;
  while (taken.has(`edge-${n}`)) n++;
  return [...edges, { id: `edge-${n}`, from: c.from, to: c.to, ...(c.fromPort ? { fromPort: c.fromPort } : null), ...(c.toPort ? { toPort: c.toPort } : null) }];
}

/** The edges with one's ends moved. Its old route's dropped, as it was for the old ends, and it keeps everything else. */
export function moveEdgeEnd<E>(edges: readonly DiagramEdge<E>[], c: DiagramConnection & { edge: string }): DiagramEdge<E>[] {
  return edges.map((e) => {
    if (e.id !== c.edge) return e;
    const { points: _p, labelBox: _l, fromPort: _f, toPort: _t, ...rest } = e;
    return { ...rest, from: c.from, to: c.to, ...(c.fromPort ? { fromPort: c.fromPort } : null), ...(c.toPort ? { toPort: c.toPort } : null) };
  });
}

/* ── What's worth drawing ── */

/** How far past the view things get drawn, as a share of its size, so a pan has somewhere to go first. */
const RENDER_MARGIN = 0.5;

/** The part of the board to draw, given what was drawn last time and what's in view now. It only changes when the view leaves
 *  it, or it's got much larger than the view needs, so most frames of a pan change nothing at all. */
export function renderWindow(previous: Rect | null, view: Rect, margin = RENDER_MARGIN): Rect {
  if (previous) {
    const inside = view.x >= previous.x && view.y >= previous.y && view.x + view.w <= previous.x + previous.w && view.y + view.h <= previous.y + previous.h;
    const roomy = previous.w <= view.w * (1 + margin * 2) * 2 && previous.h <= view.h * (1 + margin * 2) * 2;
    if (inside && roomy) return previous;
  }
  return { x: view.x - view.w * margin, y: view.y - view.h * margin, w: view.w * (1 + margin * 2), h: view.h * (1 + margin * 2) };
}
