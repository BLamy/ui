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
export interface DiagramEye { must: Rect; want?: Rect | null }

const unionOf = (rs: readonly (Rect | null | undefined)[]): Rect | null => unionRect(rs.filter((r): r is Rect => !!r));

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
  return viewportToKeep(view, eye.must, size, insets);
}
