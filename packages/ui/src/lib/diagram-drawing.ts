/* ══ What a Diagram draws ══
   The pure half of the Diagram component: from nodes and edges (placed, or laid out by `lib/diagram-layout`) to the routes,
   label boxes and bounds it draws (`drawDiagram`), and where its view opens (`firstView`). Nothing here renders, so the
   component and a test of what it draws run the same code. */
import { rectOf, unionRect, type Pt, type Rect, type Viewport } from '@/lib/canvas-math';
import type { DiagramInsets } from '@/lib/diagram-chrome';
import { edgesByNode, fitViewport, viewportToKeep } from '@/lib/diagram-keyboard';
import {
  DIAGRAM_LEGIBLE_ZOOM, diagramBounds, edgeGeometries, edgeLabelSize, facePorts, hasEdgeLabel, holdsNodes, indexDiagram, isInside, labelBoxAvoiding,
  loopsBeside, nodeAnatomy, rectIndex, regionDividers, roundedPolylineD,
  type ConnectorGeometry, type DiagramDivider, type DiagramEdge, type DiagramIndex, type DiagramNode,
} from '@/lib/diagram-model';
import type { TextMeasurer } from '@/lib/diagram-text';

const isContainer = holdsNodes;
/** The strip along a group's top that its title takes, which an edge label keeps off, when it has nothing measured. */
const GROUP_TITLE_ROOM = 30;
/** How far a route's corners are rounded, in board units. */
const ROUTE_RADIUS = 8;

export interface DiagramDrawing<N = unknown, E = unknown> {
  index: DiagramIndex<N>;
  geometries: Map<string, ConnectorGeometry>;
  edgesAt: ReturnType<typeof edgesByNode>;
  containers: DiagramNode<N>[];
  leaves: DiagramNode<N>[];
  /** Each edge with its route, the route's bounds, and its path data (corners rounded). */
  edges: { edge: DiagramEdge<E>; geometry: ConnectorGeometry; box: Rect; d: string }[];
  labels: { edge: DiagramEdge<E>; box: Rect }[];
  dividers: DiagramDivider[];
  /** Edges from a box to what it holds that start inside it, under its sections: drawn with a dot where they start. */
  origins: Set<string>;
  bounds: Rect | null;
}

/** A route's path data: a curve as it is, and anything square with its corners rounded. */
const routeD = (edge: DiagramEdge<unknown>, g: ConnectorGeometry) => ((edge.route === 'curve' && !edge.points) ? g.d : roundedPolylineD(g.pts, ROUTE_RADIUS));

/** Up to this many nodes and edges, hand-placed edges go round the cards in their way (not while something's dragged). */
export const AVOID_UP_TO = 200;
/** Up to this many, edges between ports, and any that would run along another, get lanes of their own (`routeInLanes`). */
const LANES_UP_TO = 120;

/**
 * What a Diagram draws, worked out from its nodes and edges, with nothing rendered: each edge's route (its own `points`, or
 * one made for it), each label's box, the containers and leaves in drawing order, the region dividers, the origin dots and
 * the bounds. The Diagram component draws exactly this, and a test can check it. `moving`: a drag is on, so nothing's routed
 * round anything.
 */
export function drawDiagram<N, E>(given: readonly DiagramNode<N>[], givenEdges: readonly DiagramEdge<E>[], text: TextMeasurer, moving = false): DiagramDrawing<N, E> {
  const looped = placeLoops(given, givenEdges, text);
  // A port on a card's row sits at the end of the row that faces where its edges go.
  const nodes = facePorts(given, looped);
  const index = indexDiagram(nodes);
  const headOf = (n: DiagramNode<N>) => (n.title || n.sections?.length ? Math.max(GROUP_TITLE_ROOM, nodeAnatomy(n, text).top) : GROUP_TITLE_ROOM);
  const edges = ownEdgesInside(looped, index, headOf, (e) => edgeLabelSize(e, text)?.w ?? 0);
  // Edges in lanes of their own come with their labels, on runs of their own.
  const laned = new Map<string, Rect>();
  const geometries = edgeGeometries(edges, index, {
    avoid: !moving && nodes.length + edges.length <= AVOID_UP_TO,
    ...(nodes.length + edges.length <= LANES_UP_TO ? { headOf, labelSize: (e: DiagramEdge<E>) => edgeLabelSize(e, text), labels: laned } : null),
  });
  const drawn: DiagramDrawing<N, E>['edges'] = [];
  const labels: DiagramDrawing<N, E>['labels'] = [];
  // A label sits on its route, the edge running into it and out of it: where a layout put it if that's clear, or else
  // the first clear place along the route, then beside it, or else where it covers least. It keeps off the nodes, off
  // the labels already placed (two edges on one route) and off the other routes, so it isn't read as theirs. A group is
  // only in the way along its header and sections.
  for (const edge of edges) {
    const geometry = geometries.get(edge.id);
    if (geometry) drawn.push({ edge, geometry, box: rectOf(geometry.pts), d: routeD(edge, geometry) });
  }
  // A label a layout placed with its route (or a lane's) stays where it is: only one with no place yet looks for one, and
  // only then is everything it keeps off indexed (every card and every run of every route: at 2,000 nodes, most of a
  // drag's frame, for nothing).
  const placedBy = (edge: DiagramEdge<E>) => laned.get(edge.id) ?? (edge.labelBox && edge.points && edge.points.length >= 2 ? edge.labelBox : null);
  const unplaced = drawn.some((d) => hasEdgeLabel(d.edge) && !placedBy(d.edge));
  if (!unplaced) {
    for (const { edge } of drawn) if (hasEdgeLabel(edge)) labels.push({ edge, box: placedBy(edge)! });
  } else {
    const room = rectIndex(nodes.flatMap((n) => (n.kind === 'root' || n.kind === 'region' || n.kind === 'marker' ? []
      : holdsNodes(n) ? [{ x: n.x, y: n.y, w: n.w, h: headOf(n) }] : [n])));
    const routes = new Map<string, Set<Rect>>();
    for (const { edge, geometry } of drawn) {
      const own = new Set<Rect>();
      for (let i = 1; i < geometry.pts.length; i++) {
        const a = geometry.pts[i - 1], b = geometry.pts[i];
        const r = { x: Math.min(a.x, b.x) - 1, y: Math.min(a.y, b.y) - 1, w: Math.abs(b.x - a.x) + 2, h: Math.abs(b.y - a.y) + 2 };
        own.add(r);
        room.add(r);
      }
      routes.set(edge.id, own);
    }
    for (const { edge } of drawn) {
      const box = laned.get(edge.id);
      if (box && hasEdgeLabel(edge)) room.add(box);
    }
    for (const { edge, geometry } of drawn) {
      if (!hasEdgeLabel(edge)) continue;
      const own = routes.get(edge.id)!;
      const size = edge.labelBox ?? edgeLabelSize(edge, text)!;
      // A route and a label a layout worked out together stay together: the route runs through the label. So do a lane's.
      const lane = laned.get(edge.id);
      const box = lane ?? (edge.labelBox && edge.points && edge.points.length >= 2 ? edge.labelBox : labelBoxAvoiding(geometry.pts, size, (b) => room.overlap(b, (r) => own.has(r)), edge.labelBox));
      if (!lane) room.add(box);
      labels.push({ edge, box });
    }
  }
  // Outer containers first, so what's inside draws over them, however the nodes were listed.
  const depth = (n: DiagramNode<N>) => index.depth.get(n.id) ?? 0;
  const containers = nodes.filter(isContainer).map((n, i) => ({ n, i })).sort((a, b) => depth(a.n) - depth(b.n) || a.i - b.i).map(({ n }) => n);
  const leaves = nodes.filter((n) => !isContainer(n));
  // An entry marker stands out past its node's corner.
  const entries = nodes.filter((n) => n.entry).map((n) => ({ x: n.x - 22, y: n.y - 16, w: 22, h: 16 }));
  const origins = new Set<string>();
  for (const { edge, geometry } of drawn) {
    const box = index.byId.get(edge.from);
    if (!box || !isInside(index, edge.to, edge.from)) continue;
    const p = geometry.start;
    if (p.x > box.x + 1 && p.x < box.x + box.w - 1 && p.y > box.y + 1 && p.y < box.y + box.h - 1) origins.add(edge.id);
  }
  return {
    index, geometries, edgesAt: edgesByNode(drawn.map((d) => d.edge)), containers, leaves, edges: drawn, labels, dividers: regionDividers(index), origins,
    bounds: diagramBounds([...nodes, ...entries], geometries.values(), labels.map((l) => l.box)),
  };
}

/**
 * A box's own edges to what it holds (and back), with no route of their own: from the line under its header (and its
 * sections), where a dot says where it starts, straight down to the top of what it goes to, not from its border; two
 * between the same box and child (one each way) in two lanes, each with its label. Ones with ports, or a route, or a child
 * too close under the header to run to, are left as they are.
 */
function ownEdgesInside<N, E>(edges: readonly DiagramEdge<E>[], index: DiagramIndex<N>, headOf: (n: DiagramNode<N>) => number, labelWidth: (e: DiagramEdge<E>) => number): readonly DiagramEdge<E>[] {
  const pairs = new Map<string, DiagramEdge<E>[]>();
  for (const e of edges) {
    if (e.points || e.fromPort || e.toPort || e.from === e.to) continue;
    const box = isInside(index, e.to, e.from) ? e.from : isInside(index, e.from, e.to) ? e.to : null;
    if (!box) continue;
    const key = box === e.from ? `${e.from}\0${e.to}` : `${e.to}\0${e.from}`;
    pairs.set(key, [...(pairs.get(key) ?? []), e]);
  }
  if (!pairs.size) return edges;
  const routed = new Map<string, Pt[]>();
  for (const [key, list] of pairs) {
    const [boxId, childId] = key.split('\0') as [string, string];
    const box = index.byId.get(boxId), child = index.byId.get(childId);
    if (!box || !child) continue;
    const top = box.y + Math.min(box.h, headOf(box));
    if (child.y - top < 16) continue;
    // Far enough apart for their labels not to touch: each on its own line.
    const apart = Math.max(24, ...list.map(labelWidth)) + 12;
    list.forEach((e, i) => {
      const x = Math.round((child.x + child.w / 2 + (i - (list.length - 1) / 2) * apart) * 100) / 100;
      const down = [{ x, y: top }, { x, y: child.y }];
      routed.set(e.id, e.from === boxId ? down : down.reverse());
    });
  }
  return routed.size ? edges.map((e) => { const pts = routed.get(e.id); return pts ? { ...e, points: pts } : e; }) : edges;
}

/** A placed card's self-loops with no route of their own, each beside it with its label on it (`loopsBeside`). */
function placeLoops<N, E>(nodes: readonly DiagramNode<N>[], edges: readonly DiagramEdge<E>[], text: TextMeasurer): readonly DiagramEdge<E>[] {
  const loops = new Map<string, DiagramEdge<E>[]>();
  for (const e of edges) if (e.from === e.to && !e.points) loops.set(e.from, [...(loops.get(e.from) ?? []), e]);
  if (!loops.size) return edges;
  const placed = new Map<string, { points: Pt[]; labelBox?: Rect }>();
  for (const n of nodes) {
    const list = loops.get(n.id);
    if (!list || holdsNodes(n) || n.kind === 'marker') continue;
    for (const [id, at] of loopsBeside(n, list.map((e) => ({ id: e.id, size: edgeLabelSize(e, text) })))) placed.set(id, at);
  }
  return placed.size ? edges.map((e) => { const at = placed.get(e.id); return at ? { ...e, ...at } : e; }) : edges;
}

/** Where a diagram opens, until the view's moved: all of it, centered, when that can be read; otherwise at the least size
 *  that can be read, from its top-start corner (where a machine's name and context are, and a system's), across its width
 *  (centered) when that fits, to be scrolled. Never past 100%, and always in the part of the board nothing covers (`pad`:
 *  the toolbar, the minimap, a frame's bar and drawer). What has the eye is brought in after (`keepInView`). */
export function firstView(box: Rect | null, size: { width: number; height: number }, pad: DiagramInsets): Viewport {
  const fit = fitViewport(box, size, pad);
  if (!box || box.w <= 0 || box.h <= 0 || fit.zoom >= DIAGRAM_LEGIBLE_ZOOM) return fit;
  const room = Math.max(1, size.width - pad.left - pad.right);
  const zoom = DIAGRAM_LEGIBLE_ZOOM;
  const x = box.w * zoom <= room ? pad.left + (room - box.w * zoom) / 2 - box.x * zoom : pad.left - box.x * zoom;
  return { zoom, x, y: pad.top - box.y * zoom };
}

/** A drawing's top-start corner, which its first view shows: a root's header and sections (as much of their width as a
 *  phone shows), or the top-start of what's drawn. */
export function drawingCorner<N, E>(d: Pick<DiagramDrawing<N, E>, 'index' | 'bounds'>, text: TextMeasurer): Rect | null {
  const root = d.index.nodes.find((n) => n.kind === 'root' && !d.index.parent.get(n.id));
  if (root) return { x: root.x, y: root.y, w: Math.min(root.w, CORNER_WIDTH), h: Math.min(root.h, Math.max(GROUP_TITLE_ROOM, nodeAnatomy(root, text).top)) };
  const b = d.bounds;
  return b ? { x: b.x, y: b.y, w: Math.min(b.w, CORNER_WIDTH), h: Math.min(b.h, GROUP_TITLE_ROOM) } : null;
}
const CORNER_WIDTH = 240;

/** What has the eye: what has to be in view (the selection, or the state a machine is in), and what should be with it when
 *  there's room (the labels of the transitions it can take now). */
export interface DiagramEye {
  must: Rect;
  want?: Rect | null;
  /** One thing (a box, say) that may be too big to be seen whole: then it's seen from its top-start corner, where it says
   *  what it is. Without it, what's too big is kept by the least pan (a selection of many things). */
  one?: boolean;
}

const unionOf = (rs: readonly (Rect | null | undefined)[]): Rect | null => unionRect(rs.filter((r): r is Rect => !!r));

/** What has the eye in the opening view when nothing's selected or current: where the drawing starts, the first of its root's
 *  own cards with an entry marker (a machine's initial state, a system's first entry point), marker and all. Kept in view
 *  with the top-start corner when both can be read; else it wins, so a phone opens on where a machine starts. */
export function diagramStartEye<N, E>(d: Pick<DiagramDrawing<N, E>, 'index'>): DiagramEye | null {
  const { index } = d;
  const root = index.nodes.find((n) => n.kind === 'root' && !index.parent.get(n.id));
  const pool = root ? index.children.get(root.id) ?? [] : index.nodes.filter((n) => !index.parent.get(n.id));
  const first = pool.filter((n) => n.entry && n.kind !== 'marker').sort((a, b) => a.y - b.y || a.x - b.x)[0];
  return first ? { must: { x: first.x - 22, y: first.y - 16, w: first.w + 22, h: first.h + 16 } } : null;
}

/**
 * How tall a board is for its drawing to be read whole: the drawing at the size it opens at across the board's `width` (100%,
 * or as far down as the readable size to fit across), with the room `insets` keep for the chrome over it; between `min` and
 * `max`. Past `max`, the board opens on its top-start corner and the drawing pans.
 */
export function diagramContentHeight(bounds: Rect | null, width: number, insets: DiagramInsets, { min = 0, max = Infinity }: { min?: number; max?: number } = {}): number {
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return min;
  const across = Math.max(1, width - insets.left - insets.right);
  const zoom = Math.min(1, Math.max(DIAGRAM_LEGIBLE_ZOOM, across / bounds.w));
  return Math.min(max, Math.max(min, Math.ceil(bounds.h * zoom + insets.top + insets.bottom)));
}

/**
 * What has the eye in a drawing: the nodes and edges given (what's selected, or what's current), each node as its box (the
 * innermost of those that hold one another), each edge as its label (or its middle); with it, what's wanted beside it when
 * there's room: the labels of `wanted` edges (the transitions a machine can take now), and with `ends`, the two cards each
 * edge joins (a selection: a connection just made is seen with what it connects).
 */
export function diagramEye<N, E>(d: Pick<DiagramDrawing<N, E>, 'index' | 'labels' | 'geometries' | 'edges'>, on: { nodes: readonly string[]; edges: readonly string[] }, wanted?: ReadonlySet<string> | null, { ends = false }: { ends?: boolean } = {}): DiagramEye | null {
  const rects: Rect[] = [];
  // The innermost of them: a state, not the box around it that's current as well.
  const set = new Set(on.nodes);
  const holdsOne = new Set<string>();
  for (const id of on.nodes) for (let p = d.index.parent.get(id); p; p = d.index.parent.get(p) ?? null) { if (set.has(p)) holdsOne.add(p); }
  for (const id of on.nodes) { const n = d.index.byId.get(id); if (n && !holdsOne.has(id)) rects.push(n); }
  for (const id of on.edges) {
    const l = d.labels.find((x) => x.edge.id === id)?.box;
    const g = l ? null : d.geometries.get(id);
    if (l) rects.push(l);
    else if (g) rects.push({ x: g.mid.x - 1, y: g.mid.y - 1, w: 2, h: 2 });
  }
  const must = unionRect(rects);
  if (!must) return null;
  const labels = wanted?.size ? d.labels.filter((l) => wanted.has(l.edge.id)).map((l) => l.box) : [];
  // A selected edge's two ends, with its label: what it joins is what it's about (a connection just made, say).
  const joined = ends ? on.edges.flatMap((id) => { const e = d.edges.find((x) => x.edge.id === id)?.edge; return e ? [d.index.byId.get(e.from), d.index.byId.get(e.to)].filter((n): n is DiagramNode<N> => !!n) : []; }) : [];
  const want = labels.length || joined.length ? unionRect([...labels, ...joined, ...(joined.length ? [must] : [])]) : null;
  return { must, want, one: rects.length === 1 && !on.edges.length };
}

/**
 * The view, moved as little as keeps what has the eye in the part of the board nothing covers (`insets`): with what it
 * wants beside it, and then with the drawing's top-start corner when that's in view now (it isn't taken away to show
 * something else), at this zoom if they fit, or else zoomed out as far as they need, but never under the readable size.
 * Past that, what has to be in view alone. The same view when nothing needs to move.
 */
export function keepInView(view: Viewport, eye: DiagramEye, corner: Rect | null, size: { width: number; height: number }, insets: DiagramInsets): Viewport {
  const free = { w: size.width - insets.left - insets.right, h: size.height - insets.top - insets.bottom };
  const shown = (r: Rect) => r.x * view.zoom + view.x >= insets.left - 1 && r.y * view.zoom + view.y >= insets.top - 1 && (r.x + r.w) * view.zoom + view.x <= size.width - insets.right + 1 && (r.y + r.h) * view.zoom + view.y <= size.height - insets.bottom + 1;
  const keepCorner = corner && shown(corner) ? corner : null;
  const tries = [unionOf([eye.must, eye.want, keepCorner]), unionOf([eye.must, eye.want]), unionOf([eye.must, keepCorner]), eye.must];
  for (const r of tries) {
    if (!r) continue;
    if (r.w * view.zoom <= free.w && r.h * view.zoom <= free.h) return viewportToKeep(view, r, size, insets);
    const zoom = Math.min(free.w / r.w, free.h / r.h);
    if (zoom >= DIAGRAM_LEGIBLE_ZOOM && zoom < view.zoom) {
      // Zoomed out about where it is: its start where it was, as far as that keeps it all in.
      const sx = Math.min(Math.max(r.x * view.zoom + view.x, insets.left), size.width - insets.right - r.w * zoom);
      const sy = Math.min(Math.max(r.y * view.zoom + view.y, insets.top), size.height - insets.bottom - r.h * zoom);
      return { zoom, x: sx - r.x * zoom, y: sy - r.y * zoom };
    }
  }
  // One thing too big to be seen whole: from its top-start corner, where it says what it is (a box's header), as much as fits.
  const fit = eye.one ? { ...eye.must, w: Math.min(eye.must.w, free.w / view.zoom), h: Math.min(eye.must.h, free.h / view.zoom) } : eye.must;
  return viewportToKeep(view, fit, size, insets);
}
