/* ══ Diagram layout — where nodes go, by ELK ══
   `elk.algorithm: layered` with `elk.hierarchyHandling: INCLUDE_CHILDREN` places nodes, groups and the routes between
   them, and with nothing inside anything, `SEPARATE_CHILDREN` packs what isn't connected into rows. In a browser it runs in a Web Worker: on the main thread, 2,000 nodes stop the page for about 5 s. On a server it
   runs in the process.

   ELK is an optional peer, as it's 442 KB gzipped and licensed EPL-2.0 OR GPL-3.0-or-later, so it's only imported here, when
   a layout's first asked for, and an app with fixed positions never loads it. Nothing at module scope touches a browser
   API, so this is safe to import on a server. `lib/diagram-layout/react` has the hook. */
import type { Pt, Rect } from '@/lib/canvas-math';
import { CONTAINER_PADDING, DIAGRAM_LEGIBLE_ZOOM, ancestorsOf, descendantsOf, diagramBounds, edgeLabelSize, facePorts, hasEdgeLabel, holdsNodes, indexDiagram, isInside, itemKey, laneRoutes, nodeAnatomy, placeItemPorts, rerouteOrthogonal, sectionKey, simplifyRoute, type ConnectorEnd, type DiagramEdge, type DiagramNode, type DiagramSide } from '@/lib/diagram-model';
import { estimateText, type TextMeasurer } from '@/lib/diagram-text';

/* ── What goes in and what comes out ── */

/** A node that hasn't been placed yet. A size it's given is kept, and otherwise it's sized to its words. */
export type DiagramDraftNode<N = unknown> = Omit<DiagramNode<N>, 'x' | 'y' | 'w' | 'h'> & Partial<Rect>;

export interface DiagramDraft<N = unknown, E = unknown> {
  nodes: readonly DiagramDraftNode<N>[];
  edges?: readonly DiagramEdge<E>[];
}

export interface DiagramLayoutResult<N = unknown, E = unknown> {
  nodes: DiagramNode<N>[];
  edges: DiagramEdge<E>[];
  bounds: Rect;
  /** Which thread it ran on. */
  engine: 'worker' | 'main-thread' | 'server';
  /** How long ELK took, from asking to answering. */
  ms: number;
}

/** Which way a layout's layers run: what an edge mostly points along. */
export type DiagramDirection = 'right' | 'down' | 'left' | 'up';

/** How much room a layout leaves between things: `compact` for big generated graphs, `default` to read at 100%. */
export type DiagramLayoutDensity = 'compact' | 'default' | 'comfortable';

export interface DiagramLayoutOptions {
  /** Which way the layers run (default `down`). */
  direction?: DiagramDirection;
  /** How much room between things (default `default`). */
  density?: DiagramLayoutDensity;
  /** The board it'll be shown on, in px: a long run wraps into columns (rows, across) to fill it at a readable size. Left
   *  out, nothing wraps. `useDiagramLayout` measures its `host` for this. */
  board?: DiagramBoardSize;
  /** ELK options of your own, which win over these defaults. */
  elk?: Record<string, string>;
  /** Text sizes. The default is `estimateText`, which is what a server has. In a browser, use `measureText`. */
  text?: TextMeasurer;
  /** Start the worker yourself: `() => new Worker(new URL('./my-worker.js', import.meta.url), { type: 'module' })`. */
  worker?: () => Worker;
  signal?: AbortSignal;
}

export class DiagramLayoutError extends Error {
  /** `peer`: elkjs isn't installed. `worker`: a worker you gave couldn't start. `elk`: ELK refused the graph. `aborted`: stopped. */
  code: 'peer' | 'worker' | 'elk' | 'aborted';
  constructor(code: DiagramLayoutError['code'], message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DiagramLayoutError';
    this.code = code;
  }
}

/* ── To ELK and back ── */

interface ElkLabel { id?: string; text?: string; x?: number; y?: number; width?: number; height?: number; layoutOptions?: Record<string, string> }
const LABEL_OPTIONS: Record<string, string> = { 'elk.edgeLabels.inline': 'true', 'elk.edgeLabels.placement': 'CENTER' };
interface ElkPort { id: string; x?: number; y?: number; layoutOptions?: Record<string, string>; width?: number; height?: number }
interface ElkSection { startPoint: Pt; endPoint: Pt; bendPoints?: Pt[] }
interface ElkEdge { id: string; sources: string[]; targets: string[]; labels?: ElkLabel[]; sections?: ElkSection[]; container?: string }
export interface ElkGraph {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  layoutOptions?: Record<string, string>;
  labels?: ElkLabel[];
  ports?: ElkPort[];
  children?: ElkGraph[];
  edges?: ElkEdge[];
}

const ROOT = '__root';
/** Not ELK's: how much of a box's top padding is air, past its header and sections (`fromElkGraph` reads it back). */
const AIR_TOP = 'diagram.airTop';
/** Not ELK's either: where on a box's sides its item ports' rows are, from its top, by port. */
const PORT_ROWS = 'diagram.portRows';
/** A region has no border of its own, and the padding of the group it's a lane of is already around it. */
const REGION_PADDING = { side: 12, bottom: 12, top: 8 };
/** A group of regions keeps little air: each region has its own. */
const LANES_PADDING = { side: 8, bottom: 8, top: 8 };

const SIDE: Record<DiagramSide, string> = { top: 'NORTH', right: 'EAST', bottom: 'SOUTH', left: 'WEST' };

/** Where a leaf's self-loop labels go, as ELK's outside node labels, and the room between the card and them for the loop. */
const LOOP_BEFORE = '[OUTSIDE, H_LEFT, V_CENTER]';
const LOOP_AFTER = '[OUTSIDE, H_RIGHT, V_CENTER]';
const LOOP_GAP = 32;
const LOOP_FOOT = 20;
/** Up to this many nodes, a layout spends more on looks (see `toElkGraph`). */
const QUALITY_UP_TO = 120;

/** The room between things, per density: between layers, between nodes in a layer, between edges and around them. */
const SPACING: Record<DiagramLayoutDensity, { layers: number; nodes: number; edges: number; edgeNode: number }> = {
  compact: { layers: 36, nodes: 24, edges: 8, edgeNode: 12 },
  default: { layers: 28, nodes: 64, edges: 32, edgeNode: 24 },
  comfortable: { layers: 48, nodes: 80, edges: 28, edgeNode: 32 },
};

/** ELK options for a density. */
export function diagramElkOptions(density: DiagramLayoutDensity = 'default'): Record<string, string> {
  const s = SPACING[density];
  return {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.spacing.nodeNodeBetweenLayers': String(s.layers),
    'elk.spacing.nodeNode': String(s.nodes),
    'elk.spacing.edgeEdge': String(s.edges),
    'elk.layered.spacing.edgeEdgeBetweenLayers': String(s.edges),
    'elk.spacing.edgeNode': String(s.edgeNode),
    'elk.layered.spacing.edgeNodeBetweenLayers': String(s.edgeNode),
    // A label is an object on its edge: the edge runs into it and out of it.
    'elk.edgeLabels.inline': 'true',
    'elk.edgeLabels.placement': 'CENTER',
    'elk.spacing.edgeLabel': '0',
    'elk.layered.mergeEdges': 'false',
    'elk.layered.selfLoopDistribution': 'EQUALLY',
    'elk.spacing.portPort': '16',
    // A leaf's self-loop labels are its outside labels: room between them and the card for the loop's legs.
    'elk.spacing.labelNode': String(LOOP_GAP),
    'elk.spacing.labelLabel': '12',
    // An edge that goes back up (a machine going back to where it was) leaves and comes in at the sides, round the rest.
    'elk.layered.feedbackEdges': 'true',
  };
}

/** The defaults: readable diagrams at 100%, top to bottom. */
export const DIAGRAM_ELK_OPTIONS: Readonly<Record<string, string>> = diagramElkOptions('default');

const padding = (p: { top: number; side: number; bottom: number }) => `[top=${p.top},left=${p.side},bottom=${p.bottom},right=${p.side}]`;

const portId = (node: string, port: string) => `${node}\0${port}`;
/** The stand-in for a self-loop's label: a node one layer on, so ELK makes room for the loop and routes its way out. */
const loopId = (edge: string) => `\0loop\0${edge}`;
/** The size of an unlabelled self-loop's stand-in. */
const LOOP_ROOM = { w: 16, h: 8 };


/** A graph for ELK: nodes nested as their parents say, sized to their words, with every edge on the root, which is what
 *  `INCLUDE_CHILDREN` wants. Edges with a missing end are left out, and duplicate ids count once. */
export function toElkGraph<N, E>(draft: DiagramDraft<N, E>, options: Pick<DiagramLayoutOptions, 'direction' | 'density' | 'elk' | 'text'> = {}): ElkGraph {
  const text = options.text ?? estimateText;
  const placed = dedupe(draft.nodes).map((n) => ({ ...n, x: n.x ?? 0, y: n.y ?? 0, w: n.w ?? 0, h: n.h ?? 0 })) as DiagramNode<N>[];
  const index = indexDiagram(placed);
  const elements = new Map<string, ElkGraph>();
  const loopsOf = new Map<string, DiagramEdge<E>[]>();
  for (const e of draft.edges ?? []) if (e.from === e.to && index.byId.has(e.from)) loopsOf.set(e.from, [...(loopsOf.get(e.from) ?? []), e]);
  const anatomies = new Map<string, ReturnType<typeof nodeAnatomy>>();
  const anatomyOf = (n: DiagramNode<N>) => { let a = anatomies.get(n.id); if (!a) { a = nodeAnatomy(n, text); anatomies.set(n.id, a); } return a; };
  // The least width each node will have: a card's own, a box's own or its widest child's and its air.
  const least = new Map<string, number>();
  const widest = (id: string): number => Math.max(0, ...(index.children.get(id) ?? []).map((c) => leastWidth(c)));
  const leastWidth = (n: DiagramNode<N>): number => {
    let w = least.get(n.id);
    if (w === undefined) {
      least.set(n.id, 0);
      const own = n.w || anatomyOf(n).w;
      w = index.children.get(n.id)?.length ? Math.max(own, widest(n.id) + CONTAINER_PADDING.side * 2) : own;
      least.set(n.id, w);
    }
    return w;
  };
  for (const n0 of placed) {
    const el: ElkGraph = { id: n0.id };
    const hasChildren = !!index.children.get(n0.id)?.length;
    const anatomy = anatomyOf(n0);
    const holds = hasChildren || holdsNodes(n0);
    // A port an item names sits on the item's row, which is known once the card's measured.
    const n = holds ? n0 : placeItemPorts(n0, anatomy, n0.h || anatomy.h);
    if (holds) {
      el.children = [];
      // Room for the header and the sections, then air around what it holds. A group of regions keeps less: each region
      // has its own.
      const air = n.kind === 'region' ? REGION_PADDING : index.children.get(n.id)?.some((c) => c.kind === 'region') ? LANES_PADDING : CONTAINER_PADDING;
      // ELK doesn't hold a box that holds others to a least size, so one whose header and sections are wider than what it
      // holds gets the difference as air at its sides: as much as its widest child leaves (more children only add width).
      const want = n.w || anatomy.w;
      const side = air.side + Math.max(0, Math.ceil((want - widest(n.id) - air.side * 2) / 2));
      // A port an item names sits on the item's row, which is known from the top, though the box's height isn't yet.
      const rows: Record<string, number> = {};
      n.sections?.forEach((sec, si) => sec.items.forEach((it) => { if (it.port) { const y = anatomy.rows.get(`${sectionKey(sec, si)}\0${itemKey(it)}`); if (y !== undefined) rows[it.port] = Math.round(y * 100) / 100; } }));
      el.layoutOptions = {
        'elk.padding': padding({ ...air, side, top: Math.ceil(anatomy.top) + air.top }),
        [AIR_TOP]: String(air.top),
        ...(Object.keys(rows).length ? { [PORT_ROWS]: JSON.stringify(rows) } : null),
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${n.w || anatomy.w}, ${n.h || anatomy.h})`,
      };
    } else {
      el.width = n.w || anatomy.w;
      el.height = n.h || anatomy.h;
    }
    // A leaf's self-loops sit beside it, their labels on its sides (the first on its start side, the next on its end side,
    // and so on), which ELK keeps room for as it does for a node's own outside labels: edges still meet the card itself.
    const loops = holds ? [] : loopsOf.get(n.id) ?? [];
    if (loops.length) {
      el.labels = loops.map((e, i) => {
        const size = edgeLabelSize(e, text) ?? LOOP_ROOM;
        // With room under it for the loop's way back.
        return { id: loopId(e.id), text: e.title ?? '', width: size.w, height: size.h + LOOP_FOOT, layoutOptions: { 'elk.nodeLabels.placement': i % 2 ? LOOP_AFTER : LOOP_BEFORE } };
      });
    }
    // Where things start is first in what holds it.
    if (n.entry) el.layoutOptions = { ...el.layoutOptions, 'elk.layered.layering.layerConstraint': 'FIRST' };
    if (n.ports?.length) {
      // A node's size is known here, so its ports can stay where they're drawn, with routes ending at them. One that holds
      // others is only as big as ELK makes it, so ELK says where they went, and `fromElkGraph` reads that back.
      const known = el.width !== undefined && el.height !== undefined;
      el.layoutOptions = { ...el.layoutOptions, 'elk.portConstraints': known ? 'FIXED_POS' : 'FIXED_SIDE' };
      el.ports = n.ports.map((p) => {
        const at = p.at ?? 0.5;
        const place = !known ? null : p.side === 'left' ? { x: 0, y: at * el.height! } : p.side === 'right' ? { x: el.width!, y: at * el.height! } : p.side === 'top' ? { x: at * el.width!, y: 0 } : { x: at * el.width!, y: el.height! };
        return { id: portId(n.id, p.id), width: 0, height: 0, ...place, layoutOptions: { 'elk.port.side': SIDE[p.side] } };
      });
    }
    elements.set(n.id, el);
  }
  // A graph a person reads gets the placement that straightens and balances the most (network simplex), which costs too much
  // past a hundred or so nodes (7 times BK's at 300, nearly 100 times at 1,000).
  const small = placed.length <= QUALITY_UP_TO ? { 'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX' } : null;
  const layered: Record<string, string> = { ...diagramElkOptions(options.density), ...small, ...(options.direction ? { 'elk.direction': options.direction.toUpperCase() } : null), ...options.elk };
  const root: ElkGraph = {
    id: ROOT,
    // Laying out what's inside something takes everything at once. With nothing inside anything, ELK can treat what isn't connected
    // apart, and pack it into rows, where otherwise it's all one long column.
    layoutOptions: { ...layered, ...(placed.some((n) => index.parent.get(n.id)) ? null : { 'elk.hierarchyHandling': 'SEPARATE_CHILDREN' }), ...options.elk },
    children: [],
    edges: [],
  };
  // ELK reads a graph's spacing, placement and routing from the node that holds it, not from the root: what holds others
  // gets the same, under its own padding and size.
  const { 'elk.hierarchyHandling': _h, 'elk.algorithm': _a, ...inner } = layered;
  for (const el of elements.values()) if (el.children) el.layoutOptions = { ...inner, ...el.layoutOptions };
  for (const n of placed) {
    const p = index.parent.get(n.id);
    (p ? elements.get(p)! : root).children!.push(elements.get(n.id)!);
  }
  // A self-loop goes out to a stand-in the size of its label, placed one layer on in the same parent, right after its node
  // in the order, and comes back from it (drawn by `fromElkGraph`): a loop below the node (beside it, across), with its
  // label on it, in room ELK has kept.
  for (const e of draft.edges ?? []) {
    if (e.from !== e.to || !index.byId.has(e.from) || !elements.get(e.from)?.children) continue;
    const size = edgeLabelSize(e, text) ?? LOOP_ROOM;
    const p = index.parent.get(e.from);
    const list = (p ? elements.get(p)! : root).children!;
    const at = list.findIndex((c) => c.id === e.from);
    list.splice(at + 1, 0, { id: loopId(e.id), width: size.w, height: size.h });
  }
  const hasPort = (node: DiagramNode<N> | undefined, id?: string) => !!id && !!node?.ports?.some((p) => p.id === id);
  for (const e of draft.edges ?? []) {
    const a = index.byId.get(e.from), b = index.byId.get(e.to);
    if (!a || !b) continue;
    const loop = e.from === e.to;
    // A leaf's loop is drawn by `fromElkGraph`, through the label ELK made room for.
    if (loop && !elements.get(e.from)?.children) continue;
    const el: ElkEdge = {
      id: e.id,
      sources: [hasPort(a, e.fromPort) ? portId(e.from, e.fromPort!) : e.from],
      targets: [loop ? loopId(e.id) : hasPort(b, e.toPort) ? portId(e.to, e.toPort!) : e.to],
    };
    const size = loop ? null : edgeLabelSize(e, text);
    // On the route, the edge running into it and out of it: these are the label's own options.
    if (size) el.labels = [{ text: e.title ?? '', width: size.w, height: size.h, layoutOptions: LABEL_OPTIONS }];
    root.edges!.push(el);
  }
  return root;
}

function dedupe<T extends { id: string }>(nodes: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const n of nodes) byId.set(n.id, n);
  return [...byId.values()];
}

const round = (v: number) => Math.round(v * 100) / 100;

/** ELK's answer as nodes and edges, in absolute board units, in the order they were given. Each region is stretched to its
 *  group's width, or height if they're side by side, which ELK doesn't do, so that dividers and titles line up. */
export function fromElkGraph<N, E>(draft: DiagramDraft<N, E>, out: ElkGraph): Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'> {
  const boxes = new Map<string, Rect>();
  const placed = new Map<string, ElkGraph>();
  const origin = new Map<string, Pt>([[ROOT, { x: 0, y: 0 }]]);
  const visit = (el: ElkGraph, ox: number, oy: number) => {
    for (const c of el.children ?? []) {
      const x = ox + (c.x ?? 0), y = oy + (c.y ?? 0);
      origin.set(c.id, { x, y });
      placed.set(c.id, c);
      boxes.set(c.id, { x: round(x), y: round(y), w: round(c.width ?? 0), h: round(c.height ?? 0) });
      visit(c, x, y);
    }
  };
  visit(out, 0, 0);

  const nodes: DiagramNode<N>[] = [];
  /** A box's item port that ELK put elsewhere on its side, moved onto its row: by how much, to move its routes' ends. */
  const portMoves = new Map<string, Pt>();
  for (const n of dedupe(draft.nodes)) {
    const box = boxes.get(n.id);
    if (!box) continue;
    const rows = JSON.parse(placed.get(n.id)?.layoutOptions?.[PORT_ROWS] ?? '{}') as Record<string, number>;
    // A port ELK chose the place of is drawn there, but one an item names, which goes on the item's row.
    const ports = n.ports?.map((p) => {
      const got = placed.get(n.id)?.ports?.find((q) => q.id === portId(n.id, p.id));
      const side = p.side === 'left' || p.side === 'right';
      const row = side ? rows[p.id] : undefined;
      if (row !== undefined) {
        // On its item's row, whatever fraction it was given for a card's height: the box is as tall as ELK made it.
        if (got?.y !== undefined) portMoves.set(`${n.id}\0${p.id}`, { x: 0, y: row - got.y });
        return { ...p, at: round(row / (box.h || 1)) };
      }
      if (p.at !== undefined || got?.x === undefined || got.y === undefined) return p;
      return { ...p, at: round(side ? got.y / (box.h || 1) : got.x / (box.w || 1)) };
    });
    nodes.push({ ...n, ...box, ...(ports ? { ports } : null) } as DiagramNode<N>);
  }
  stretchRegions(nodes);

  const routes = new Map<string, ElkEdge>();
  const collect = (el: ElkGraph) => {
    for (const e of el.edges ?? []) routes.set(e.id, e);
    for (const c of el.children ?? []) collect(c);
  };
  collect(out);
  const edges: DiagramEdge<E>[] = [];
  const direction = (out.layoutOptions?.['elk.direction'] ?? 'DOWN') as 'DOWN' | 'UP' | 'RIGHT' | 'LEFT';
  for (const e of draft.edges ?? []) {
    const beside = e.from === e.to ? placed.get(e.from)?.labels?.find((l) => (l as { id?: string }).id === loopId(e.id)) : undefined;
    const node = beside ? boxes.get(e.from) : undefined;
    if (beside && node && beside.x != null && beside.y != null) {
      const label = { x: round(node.x + beside.x), y: round(node.y + beside.y), w: beside.width ?? 0, h: Math.max(0, (beside.height ?? 0) - LOOP_FOOT) };
      const { labelBox: _was, ...own } = e;
      edges.push({ ...own, points: sideLoopRoute(node, label, direction), ...(hasEdgeLabel(e) ? { labelBox: label } : null) });
      continue;
    }
    const route = routes.get(e.id);
    if (!route) continue;
    const stand = e.from === e.to ? boxes.get(loopId(e.id)) : undefined;
    const loopNode = stand ? boxes.get(e.from) : undefined;
    const at = origin.get(route.container ?? ROOT) ?? { x: 0, y: 0 };
    const move = (p: Pt): Pt => ({ x: round(p.x + at.x), y: round(p.y + at.y) });
    const points: Pt[] = [];
    for (const s of route.sections ?? []) {
      points.push(move(s.startPoint));
      for (const b of s.bendPoints ?? []) points.push(move(b));
      points.push(move(s.endPoint));
    }
    const { labelBox: _stale, ...rest } = e;
    if (stand && loopNode && points.length) {
      // Out to the label, and back from its side to the node.
      edges.push({ ...rest, points: loopRoute(loopNode, stand, direction), ...(hasEdgeLabel(e) ? { labelBox: stand } : null) });
      continue;
    }
    const l = route.labels?.[0];
    const moveFrom = e.fromPort ? portMoves.get(`${e.from}\0${e.fromPort}`) : undefined, moveTo = e.toPort ? portMoves.get(`${e.to}\0${e.toPort}`) : undefined;
    edges.push({
      ...rest,
      points: moveFrom || moveTo ? rerouteOrthogonal(points, moveFrom ?? { x: 0, y: 0 }, moveTo ?? { x: 0, y: 0 }) : points,
      ...(l && l.x != null && l.y != null ? { labelBox: { x: round(l.x + at.x), y: round(l.y + at.y), w: l.width ?? 0, h: l.height ?? 0 } } : null),
    });
  }
  // An edge between a box and something inside it comes from (or goes to) the box's inner edge, under its header and
  // sections, not across them from its outer border.
  if (direction === 'DOWN' || direction === 'UP') {
    const index = indexDiagram(nodes);
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (e.from === e.to || !e.points || e.points.length < 2) continue;
      const outer = isInside(index, e.to, e.from) ? e.from : isInside(index, e.from, e.to) ? e.to : null;
      const box = outer ? index.byId.get(outer) : undefined;
      const top = box ? innerTop(placed.get(box.id), box) : null;
      if (!box || top === null) continue;
      const pts = outer === e.from ? e.points : [...e.points].reverse();
      const j = pts.findIndex((p) => p.y >= top);
      if (j <= 0) continue;
      const a = pts[j - 1], b = pts[j];
      const x = b.y === a.y ? b.x : a.x + ((b.x - a.x) * (top - a.y)) / (b.y - a.y);
      const cut = [{ x: round(x), y: round(top) }, ...pts.slice(j)];
      edges[i] = { ...e, points: outer === e.from ? cut : cut.reverse() };
    }
    // An edge from outside a box to something in it (or back) that ELK brought in through the box's head goes round:
    // along its side, in under its header and sections, then on as it was.
    const heads = nodes.flatMap((n) => {
      if (!holdsNodes(n) || n.kind === 'root') return [];
      const top = innerTop(placed.get(n.id), n);
      return top === null || top <= n.y ? [] : [{ n, top, air: Number(placed.get(n.id)?.layoutOptions?.[AIR_TOP] ?? 12) }];
    });
    const lanes = new Map<string, number>();
    /** Each run down through the box's head: lowered into the room under its sections when the route comes in from beside
     *  the box (it was only above it to come down), and otherwise taken round its side, clear of its entry marker. */
    const under = (pts: Pt[], n: DiagramNode<N>, top: number, air: number): Pt[] => {
      const out: Pt[] = [pts[0]];
      for (let j = 1; j < pts.length; j++) {
        const a = out[out.length - 1], b = pts[j];
        const through = Math.abs(a.x - b.x) < 0.5 && b.y > a.y && a.x > n.x && a.x < n.x + n.w && a.y < top && b.y > n.y;
        if (!through) { out.push(b); continue; }
        const inY = round(top + Math.min(6, air / 2));
        const prev = out[out.length - 2];
        if (prev && Math.abs(prev.y - a.y) < 0.5 && (prev.x <= n.x || prev.x >= n.x + n.w) && a.y <= n.y) {
          out[out.length - 2] = { x: prev.x, y: inY };
          out[out.length - 1] = { x: a.x, y: inY };
          out.push(b);
          continue;
        }
        const left = a.x - n.x <= n.x + n.w - a.x && !n.entry;
        const key = `${n.id}\0${left}`;
        const lane = (lanes.get(key) ?? 0) + 1;
        lanes.set(key, lane);
        const laneX = round(left ? n.x - 12 * lane : n.x + n.w + 12 * lane);
        const above = round(Math.min(a.y, n.y - 12));
        out.push({ x: a.x, y: above }, { x: laneX, y: above }, { x: laneX, y: inY }, { x: a.x, y: inY }, b);
      }
      return simplifyRoute(out);
    };
    const headOf = new Map(heads.map((h) => [h.n.id, h]));
    for (let i = 0; i < edges.length && heads.length; i++) {
      const e = edges[i];
      if (e.from === e.to || !e.points || e.points.length < 2) continue;
      // The boxes it goes into or out of: those around one of its ends and not the other.
      const around = (id: string) => new Set(ancestorsOf(index, id));
      const a = around(e.from), b = around(e.to);
      const crossed = [...a].filter((id) => !b.has(id) && id !== e.to).concat([...b].filter((id) => !a.has(id) && id !== e.from));
      let pts = e.points as Pt[];
      for (const id of crossed) {
        const h = headOf.get(id);
        if (!h) continue;
        // Into it going down, and out of it going up (the same, the other way round).
        pts = under([...under(pts, h.n, h.top, h.air)].reverse(), h.n, h.top, h.air).reverse();
      }
      if (pts !== e.points) edges[i] = { ...e, points: pts };
    }
  }
  const bounds = diagramBounds(nodes, edges.map((e) => ({ pts: e.points ?? [] })), edges.flatMap((e) => (e.labelBox ? [e.labelBox] : []))) ?? { x: 0, y: 0, w: 0, h: 0 };
  return { nodes, edges, bounds };
}

/** Where a box's own header and sections end, from the padding it was laid out with: its top padding less the air. */
function innerTop(el: ElkGraph | undefined, box: Rect): number | null {
  const pad = /top=([\d.]+)/.exec(el?.layoutOptions?.['elk.padding'] ?? '');
  const air = Number(el?.layoutOptions?.[AIR_TOP] ?? NaN);
  return pad && Number.isFinite(air) ? box.y + Number(pad[1]) - air : null;
}

/** A self-loop's route, through its label's stand-in one layer on: out of the node's side nearer the label (or its foot,
 *  when the label's under it) and into the label's head, then back out of the label's far side and into the node's foot
 *  (or its other side, when there's no room under it). The two legs keep apart. Worked out as if the layers ran down, and
 *  turned to the way they do. */
function loopRoute(node: Rect, label: Rect, direction: 'DOWN' | 'UP' | 'RIGHT' | 'LEFT'): Pt[] {
  // Into a frame where the layers run down, and back.
  const to = (p: Pt): Pt => (direction === 'DOWN' ? p : direction === 'UP' ? { x: p.x, y: -p.y } : direction === 'RIGHT' ? { x: p.y, y: p.x } : { x: p.y, y: -p.x });
  const from = (p: Pt): Pt => (direction === 'DOWN' ? p : direction === 'UP' ? { x: p.x, y: -p.y } : direction === 'RIGHT' ? { x: p.y, y: p.x } : { x: -p.y, y: p.x });
  const box = (r: Rect): Rect => {
    const a = to({ x: r.x, y: r.y }), b = to({ x: r.x + r.w, y: r.y + r.h });
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  };
  const n = box(node), l = box(label);
  const foot = n.y + n.h, mid = l.y + l.h / 2, side = n.y + n.h - Math.min(10, n.h / 3);
  const lc = l.x + l.w / 2;
  const inset = Math.min(14, n.w / 4);
  // Mirror so the label's toward the start, work it out, and mirror back.
  const flip = lc > n.x + n.w / 2;
  const fx = (x: number) => (flip ? n.x + n.w - (x - n.x) : x);
  const L = flip ? { ...l, x: n.x + n.w - (l.x + l.w - n.x) } : l;
  const lcx = L.x + L.w / 2;
  const out: Pt[] = lcx < n.x - 6
    ? [{ x: n.x, y: side }, { x: lcx, y: side }, { x: lcx, y: L.y }]
    : (() => { const x = Math.min(Math.max(L.x + 12, n.x + inset), n.x + n.w / 2 - 6); return [{ x, y: foot }, { x, y: L.y }]; })();
  const outX = out[out.length - 1].x;
  const x = Math.max(L.x + L.w + 14, n.x + inset, outX + 12);
  const back: Pt[] = x <= n.x + n.w - inset
    ? [{ x: L.x + L.w, y: mid }, { x, y: mid }, { x, y: foot }]
    : [{ x: L.x + L.w, y: mid }, { x: Math.max(x, n.x + n.w + 14), y: mid }, { x: Math.max(x, n.x + n.w + 14), y: n.y + n.h / 2 }, { x: n.x + n.w, y: n.y + n.h / 2 }];
  return [...out, ...back].map((p) => { const q = from({ x: fx(p.x), y: p.y }); return { x: round(q.x), y: round(q.y) }; });
}

/** A leaf's self-loop through its label beside it: out of the card's side, across into the label's near side, out of the
 *  label's foot and back up the gap between them into the card's side, lower down, where the arrow lands. Each loop has a
 *  side (or a place on one) of its own, so two never cross. Worked out as if the layers ran down: a label to the left or the
 *  right of its card; with the layers running across, above or below it. */
function sideLoopRoute(node: Rect, label: Rect, direction: 'DOWN' | 'UP' | 'RIGHT' | 'LEFT' = 'DOWN'): Pt[] {
  // Across the layers is x when they run down or up, and y when they run across: work in a frame where it's x.
  const across = direction === 'RIGHT' || direction === 'LEFT';
  const t = (p: Pt): Pt => (across ? { x: p.y, y: p.x } : p);
  const tb = (r: Rect): Rect => (across ? { x: r.y, y: r.x, w: r.h, h: r.w } : r);
  const n = tb(node), l = tb(label);
  const before = l.x + l.w / 2 < n.x + n.w / 2;
  const sideX = before ? n.x : n.x + n.w;
  const nearX = before ? l.x + l.w : l.x;
  const gapX = (sideX + nearX) / 2;
  const lc = l.x + l.w / 2;
  // Out at a third of the way down the card, or the label's middle if that's higher and on the card; back in near its foot.
  const top = Math.max(n.y + 8, l.y + 8);
  const y1 = Math.min(Math.max(top, n.y + n.h * 0.3), n.y + n.h - 18, l.y + l.h - 8);
  const y2 = Math.max(y1 + 10, n.y + n.h - Math.min(10, n.h / 4));
  const foot = Math.max(l.y + l.h + 12, y2 + 12);
  const pts: Pt[] = [{ x: sideX, y: y1 }, { x: nearX, y: y1 }, { x: lc, y: y1 }, { x: lc, y: foot }, { x: gapX, y: foot }, { x: gapX, y: y2 }, { x: sideX, y: y2 }];
  // In through the label's side, out through its foot: the two are one route, the label on it.
  return pts.map((p) => { const q = t(p); return { x: round(q.x), y: round(q.y) }; });
}

function stretchRegions<N>(nodes: DiagramNode<N>[]): void {
  const byId = new Map(nodes.map((n, i) => [n.id, i]));
  const regions = new Map<string, number[]>();
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.kind !== 'region' || n.parent == null) continue;
    const list = regions.get(n.parent);
    if (list) list.push(i);
    else regions.set(n.parent, [i]);
  }
  for (const [parent, list] of regions) {
    const at = byId.get(parent);
    if (at === undefined) continue;
    const p = nodes[at];
    let across = 0, down = 0;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = nodes[list[i]], b = nodes[list[j]];
      across += Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      down += Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    }
    const pad = 8;
    // Side by side, they start where the highest does (under the group's header and sections) and reach its foot.
    const top = Math.min(...list.map((i) => nodes[i].y));
    for (const i of list) {
      const r = nodes[i];
      nodes[i] = across >= down ? { ...r, x: round(p.x + pad), w: round(p.w - pad * 2) } : { ...r, y: round(top), h: round(p.y + p.h - pad - top) };
    }
  }
}

/* ── Wrapping a long run into columns, to fill a board ── */

/** The board a layout will be shown on, in px: a long run wraps into columns (or rows, when the layers run across) to come
 *  closer to its shape, while every column stays readable at 100%. */
export interface DiagramBoardSize { width: number; height: number }

/** How much of a board a fit can use: the chrome over it (a toolbar, a frame's bar) and air around. */
const BOARD_CHROME = { across: 48, along: 128 };
/** At most this many columns, and edges crossing from one to the next, so that what's wrapped still reads as one run. */
const WRAP_MAX_COLUMNS = 4;
const WRAP_MAX_CROSSING = 3;
const WRAP_UP_TO = 300;
/** Room between columns, and between the lanes of the edges that go from one to the next. */
const WRAP_GAP = 48;
const WRAP_LANE = 12;

interface Band { top: number; bottom: number }

/**
 * A laid out diagram, with the run of its main container (the root, or the top level) wrapped into as many columns as fit
 * `board` best: cut between layers where few edges cross, each column moved up beside the one before it, and each edge that
 * crosses a cut taken from the foot of its column, along the gap, over to the head of the next. Unchanged when one column
 * fits best (a phone gets one column, read by scrolling), or when no cut is clean. Works on layers that run down or across.
 */
export function wrapDiagram<N, E>(laid: Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'>, board: DiagramBoardSize, direction: DiagramDirection = 'down'): Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'> {
  // A graph this big is explored, not read whole: it stays as laid out (and wrapping it would hold the main thread).
  if ((direction !== 'down' && direction !== 'right') || laid.nodes.length > WRAP_UP_TO) return laid;
  // Work as if the layers ran down: x across them, y along them.
  const across = direction === 'right';
  const tp = (p: Pt): Pt => (across ? { x: p.y, y: p.x } : p);
  const tr = (r: Rect): Rect => (across ? { x: r.y, y: r.x, w: r.h, h: r.w } : r);
  const room = across ? { w: board.height - BOARD_CHROME.along, h: board.width - BOARD_CHROME.across } : { w: board.width - BOARD_CHROME.across, h: board.height - BOARD_CHROME.along };
  if (room.w <= 0 || room.h <= 0) return laid;

  const index = indexDiagram(laid.nodes);
  const tops = laid.nodes.filter((n) => !index.parent.get(n.id));
  const holder = tops.length === 1 && holdsNodes(tops[0]) ? tops[0] : null;
  const runIds = holder ? (index.children.get(holder.id) ?? []).map((n) => n.id) : tops.map((n) => n.id);
  if (runIds.length < 2) return laid;
  // Which of the run each node is in: itself or the one it's inside.
  const blockOf = new Map<string, string>();
  for (const id of runIds) {
    blockOf.set(id, id);
    for (const d of descendantsOf(index, id)) blockOf.set(d, id);
  }
  // Each block's box: the node, its entry marker, and the labels of edges that stay inside it (a self-loop's).
  const box = new Map<string, Rect>();
  const grow = (id: string, r: Rect) => {
    const b = box.get(id);
    box.set(id, !b ? r : { x: Math.min(b.x, r.x), y: Math.min(b.y, r.y), w: Math.max(b.x + b.w, r.x + r.w) - Math.min(b.x, r.x), h: Math.max(b.y + b.h, r.y + r.h) - Math.min(b.y, r.y) });
  };
  for (const id of runIds) {
    const n = index.byId.get(id)!;
    grow(id, tr(n));
    for (const d of [id, ...descendantsOf(index, id)]) if (index.byId.get(d)?.entry) { const m = index.byId.get(d)!; grow(id, tr({ x: m.x - 22, y: m.y - 16, w: 22, h: 16 })); }
  }
  // An edge between blocks has its label as a block of its own, in the run between them.
  const labelBlocks: { edge: string; r: Rect }[] = [];
  for (const e of laid.edges) {
    const a = blockOf.get(e.from), b = blockOf.get(e.to);
    if (!a || !b) { if (a || b) return laid; continue; }
    if (a === b) { if (e.labelBox) grow(a, tr(e.labelBox)); continue; }
    if (e.labelBox) labelBlocks.push({ edge: e.id, r: tr(e.labelBox) });
  }
  // What isn't joined to anything else in the run (an environment of its own) is arranged with the rest to fill the board:
  // side by side on a wide one, one above the other on a tall one, each from the top.
  const packed = packParts(laid, { holder, runIds, blockOf, box, labelBlocks, room, tr, tp });
  if (packed) return packed;
  if (runIds.length < 3) return laid;
  const blocks = [...[...box.values()], ...labelBlocks.map((l) => l.r)].sort((p, q) => p.y - q.y);
  const bands: Band[] = [];
  for (const r of blocks) {
    const last = bands[bands.length - 1];
    if (last && r.y < last.bottom) last.bottom = Math.max(last.bottom, r.y + r.h);
    else bands.push({ top: r.y, bottom: r.y + r.h });
  }
  if (bands.length < 2) return laid;
  const routes = laid.edges.map((e) => ({ e, pts: (e.points ?? []).map(tp) }));
  // A cut between two bands, in the middle of the gap, and how many routes go through it.
  const cutAt = bands.slice(1).map((b, i) => {
    let y = (bands[i].bottom + b.top) / 2;
    // A route running along the cut would be cut lengthwise: move off it.
    while (routes.some(({ pts }) => pts.some((p, j) => j > 0 && Math.abs(p.y - y) < 0.5 && Math.abs(pts[j - 1].y - y) < 0.5))) y += 1;
    const crossing = routes.filter(({ pts }) => pts.some((p, j) => j > 0 && (pts[j - 1].y - y) * (p.y - y) < 0)).length;
    return { y, crossing };
  });
  const width = (lo: number, hi: number) => {
    let x0 = Infinity, x1 = -Infinity;
    for (const r of blocks) if (r.y >= lo && r.y + r.h <= hi) { x0 = Math.min(x0, r.x); x1 = Math.max(x1, r.x + r.w); }
    for (const { pts } of routes) for (const p of pts) if (p.y > lo && p.y < hi) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); }
    return x1 > x0 ? { x0, x1 } : { x0: 0, x1: 0 };
  };
  const start = bands[0].top, end = bands[bands.length - 1].bottom;
  const one = width(start - 1, end + 1);
  // What isn't the run: the container's header and sections above it, its padding, what's beside it.
  const all = tr(laid.bounds);
  const extra = { w: Math.max(0, all.w - (one.x1 - one.x0)), h: Math.max(0, start - all.y) + Math.max(0, all.y + all.h - end) };
  const zoomOf = (w: number, h: number) => Math.min(1, room.w / (w + extra.w), room.h / (h + extra.h));
  const fitsAcross = (w: number) => (w + extra.w) * DIAGRAM_LEGIBLE_ZOOM <= room.w;
  // The best split into k columns: the one whose tallest column is shortest, through clean cuts only.
  const split = (k: number): number[] | null => {
    const n = bands.length;
    const best: (number | null)[][] = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(null));
    const from: number[][] = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(-1));
    best[0][0] = 0;
    for (let c = 1; c <= k; c++) {
      for (let j = 1; j <= n; j++) {
        for (let i = c - 1; i < j; i++) {
          const prev = best[c - 1][i];
          if (prev === null) continue;
          if (i > 0 && cutAt[i - 1].crossing > WRAP_MAX_CROSSING) continue;
          const h = Math.max(prev, bands[j - 1].bottom - bands[i].top);
          if (best[c][j] === null || h < best[c][j]!) { best[c][j] = h; from[c][j] = i; }
        }
      }
    }
    if (best[k][n] === null) return null;
    const cuts: number[] = [];
    for (let c = k, j = n; c > 1; c--) { j = from[c][j]; cuts.unshift(j); }
    return cuts;
  };
  // The most it can be seen at: all of it, readable, in as few columns as do that well; or, when no number of columns can,
  // as many as fit across at a readable size, which is the least to scroll.
  let chosen: { cuts: number[]; zoom: number; h: number } = { cuts: [], zoom: zoomOf(one.x1 - one.x0, end - start), h: end - start };
  let scroll: { cuts: number[]; h: number } | null = null;
  for (let k = 2; k <= Math.min(WRAP_MAX_COLUMNS, bands.length); k++) {
    const cuts = split(k);
    if (!cuts) continue;
    const edgesAt = [start - 1, ...cuts.map((i) => cutAt[i - 1].y), end + 1];
    let w = 0, h = 0;
    for (let c = 0; c < k; c++) {
      const span = width(edgesAt[c], edgesAt[c + 1]);
      w += span.x1 - span.x0;
      h = Math.max(h, bands[(c === k - 1 ? bands.length : cuts[c]) - 1].bottom - bands[c === 0 ? 0 : cuts[c - 1]].top);
    }
    const lanes = cuts.reduce((sum, i) => sum + cutAt[i - 1].crossing, 0);
    w += (k - 1) * WRAP_GAP + lanes * WRAP_LANE;
    h += 2 * (Math.max(...cuts.map((i) => cutAt[i - 1].crossing)) * WRAP_LANE + WRAP_LANE);
    const zoom = zoomOf(w, h);
    // Only for a real gain, to a size that can be read.
    if (zoom >= DIAGRAM_LEGIBLE_ZOOM && zoom > chosen.zoom * 1.12) chosen = { cuts, zoom, h };
    if (fitsAcross(w) && (!scroll || h < scroll.h * 0.88)) scroll = { cuts, h };
  }
  if (chosen.zoom < DIAGRAM_LEGIBLE_ZOOM && scroll && fitsAcross(one.x1 - one.x0)) chosen = { ...scroll, zoom: 0 };
  if (!chosen.cuts.length) return laid;

  // Each column's place: beside the one before it, its head where the first one's is, under a strip for the lanes coming in.
  const lines = chosen.cuts.map((i) => cutAt[i - 1].y);
  const columnOfY = (y: number) => { let c = 0; while (c < lines.length && y > lines[c]) c++; return c; };
  const k = lines.length + 1;
  // Where each route crosses each cut, and its lane there: the one nearest the gap innermost.
  const crossings = lines.map((y) => {
    const list: { edge: string; x: number }[] = [];
    for (const { e, pts } of routes) for (let j = 1; j < pts.length; j++) {
      const q = pts[j - 1], p = pts[j];
      if ((q.y - y) * (p.y - y) < 0) list.push({ edge: e.id, x: q.x + ((p.x - q.x) * (y - q.y)) / (p.y - q.y) });
    }
    return list.sort((u, v) => v.x - u.x);
  });
  const spans = Array.from({ length: k }, (_, c) => width(c === 0 ? start - 1 : lines[c - 1], c === k - 1 ? end + 1 : lines[c]));
  const offsets: Pt[] = [];
  let x = spans[0].x0;
  for (let c = 0; c < k; c++) {
    offsets.push({ x: x - spans[c].x0, y: c === 0 ? 0 : start - lines[c - 1] + WRAP_LANE * crossings[c - 1].length + 8 });
    x += spans[c].x1 - spans[c].x0 + WRAP_GAP + (c < crossings.length ? crossings[c].length * WRAP_LANE : 0);
  }
  const move = (p: Pt, c: number): Pt => ({ x: round(p.x + offsets[c].x), y: round(p.y + offsets[c].y) });
  const moveRect = (r: Rect, c: number): Rect => ({ ...r, ...move(r, c) });

  // Nodes: each block goes with the column its middle is in.
  const colOfBlock = new Map<string, number>();
  for (const [id, r] of box) colOfBlock.set(id, columnOfY(r.y + r.h / 2));
  const nodes = laid.nodes.map((n) => {
    const b = blockOf.get(n.id);
    return b === undefined ? n : { ...n, ...tr(moveRect(tr(n), colOfBlock.get(b)!)) };
  });
  // Edges: each piece of a route in its column, and between columns a way down the foot of one, up the gap and into the
  // head of the next (the other way round for a route going up).
  const edges = laid.edges.map((e) => {
    const pts = (e.points ?? []).map(tp);
    if (!pts.length || !blockOf.has(e.from)) return e;
    const out: Pt[] = [];
    const seen = lines.map(() => 0);
    for (let j = 0; j < pts.length; j++) {
      const p = pts[j];
      if (j > 0) {
        const q = pts[j - 1];
        const down = p.y > q.y;
        const crossed = lines.map((y, c) => ({ y, c })).filter(({ y }) => (q.y - y) * (p.y - y) < 0).sort((u, v) => (down ? u.y - v.y : v.y - u.y));
        for (const { y, c } of crossed) {
          const mine = crossings[c].filter((x0) => x0.edge === e.id);
          const at = mine[Math.min(seen[c]++, mine.length - 1)];
          const lane = crossings[c].indexOf(at);
          const xAt = at.x;
          const leave = move({ x: xAt, y }, c), enter = move({ x: xAt, y }, c + 1);
          const footY = round(leave.y + WRAP_LANE * lane);
          const gapX = round(spans[c].x1 + offsets[c].x + WRAP_GAP / 2 + WRAP_LANE * lane);
          const headY = round(enter.y - WRAP_LANE * (crossings[c].length - lane));
          const way = [leave, { x: leave.x, y: footY }, { x: gapX, y: footY }, { x: gapX, y: headY }, { x: enter.x, y: headY }, enter];
          out.push(...(down ? way : way.reverse()));
        }
      }
      out.push(move(p, columnOfY(p.y)));
    }
    const label = e.labelBox ? tr(e.labelBox) : null;
    const labelBox = label ? tr(moveRect(label, columnOfY(label.y + label.h / 2))) : undefined;
    return { ...e, points: simplifyRoute(out.map(tp)), ...(labelBox ? { labelBox } : null) };
  });
  // The container grows around its columns.
  let outNodes = nodes;
  if (holder) {
    const inside = outNodes.filter((n) => blockOf.has(n.id)).map(tr);
    const pts = edges.filter((e) => blockOf.has(e.from)).flatMap((e) => (e.points ?? []).map(tp));
    const h0 = tr(holder);
    const x1 = Math.max(...inside.map((r) => r.x + r.w), ...pts.map((p) => p.x)) + CONTAINER_PADDING.side;
    const y1 = Math.max(...inside.map((r) => r.y + r.h), ...pts.map((p) => p.y)) + CONTAINER_PADDING.bottom;
    const x0 = Math.min(h0.x, ...inside.map((r) => r.x - CONTAINER_PADDING.side));
    const grown = tr({ x: x0, y: h0.y, w: Math.max(h0.x + h0.w, x1) - x0, h: y1 - h0.y });
    outNodes = outNodes.map((n) => (n.id === holder.id ? { ...n, ...grown } : n));
  }
  const bounds = diagramBounds(outNodes, edges.map((e) => ({ pts: e.points ?? [] })), edges.flatMap((e) => (e.labelBox ? [e.labelBox] : []))) ?? laid.bounds;
  return { nodes: outNodes, edges, bounds };
}

interface PackInput<N> {
  holder: DiagramNode<N> | null;
  runIds: string[];
  blockOf: Map<string, string>;
  box: Map<string, Rect>;
  labelBlocks: { edge: string; r: Rect }[];
  room: { w: number; h: number };
  tr: (r: Rect) => Rect;
  tp: (p: Pt) => Pt;
}

const PACK_GAP = 48;

/** The run's parts that nothing joins, in a grid of rows that fills the board best, the biggest first (left to right, then
 *  down), each part kept as it was laid out. Null when there's one part, or the arrangement it has is as good. */
function packParts<N, E>(laid: Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'>, { holder, runIds, blockOf, box, labelBlocks, room, tr, tp }: PackInput<N>): Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'> | null {
  const root = new Map(runIds.map((id) => [id, id]));
  const find = (id: string): string => { let r = id; while (root.get(r) !== r) r = root.get(r)!; return r; };
  for (const e of laid.edges) {
    const a = blockOf.get(e.from), b = blockOf.get(e.to);
    if (a && b && a !== b) root.set(find(a), find(b));
  }
  const parts = new Map<string, string[]>();
  for (const id of runIds) parts.set(find(id), [...(parts.get(find(id)) ?? []), id]);
  if (parts.size < 2) return null;
  const union = (rs: Rect[]): Rect => {
    const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));
    return { x: x0, y: y0, w: Math.max(...rs.map((r) => r.x + r.w)) - x0, h: Math.max(...rs.map((r) => r.y + r.h)) - y0 };
  };
  const list = [...parts.values()].map((ids) => {
    const set = new Set(ids);
    const rects = ids.map((id) => box.get(id)!);
    for (const e of laid.edges) {
      if (!set.has(blockOf.get(e.from) ?? '')) continue;
      for (const p of e.points ?? []) { const q = tp(p); rects.push({ x: q.x, y: q.y, w: 0, h: 0 }); }
      const l = labelBlocks.find((b) => b.edge === e.id);
      if (l) rects.push(l.r);
    }
    return { ids: set, r: union(rects) };
    // The biggest first: it's what the board opens on.
  }).sort((a, b) => b.r.w * b.r.h - a.r.w * a.r.h || a.r.x - b.r.x);
  const all = tr(laid.bounds), run = union(list.map((p) => p.r));
  const extra = { w: Math.max(0, all.w - run.w), h: Math.max(0, all.h - run.h) };
  const zoomOf = (w: number, h: number) => Math.min(1, room.w / (w + extra.w), room.h / (h + extra.h));
  // Each number of rows, the parts filling them in order.
  const grid = (rows: number) => {
    const per = Math.ceil(list.length / rows);
    const at: Pt[] = [];
    let y = run.y, w = 0;
    for (let r = 0; r * per < list.length; r++) {
      const row = list.slice(r * per, (r + 1) * per);
      let x = run.x;
      for (const p of row) { at.push({ x, y }); x += p.r.w + PACK_GAP; }
      w = Math.max(w, x - PACK_GAP - run.x);
      y += Math.max(...row.map((p) => p.r.h)) + PACK_GAP;
    }
    return { at, w, h: y - PACK_GAP - run.y };
  };
  const grids = list.map((_, i) => ({ rows: i + 1, ...grid(i + 1) }));
  let best = grids[0], bestZoom = zoomOf(best.w, best.h);
  for (const g of grids.slice(1)) {
    const z = zoomOf(g.w, g.h);
    if (z > bestZoom * 1.05) { best = g; bestZoom = z; }
  }
  // None can be read whole: the shortest that's readable across the board's width, to scroll one way, or the narrowest.
  if (bestZoom < DIAGRAM_LEGIBLE_ZOOM) {
    const across = grids.filter((g) => (g.w + extra.w) * DIAGRAM_LEGIBLE_ZOOM <= room.w).sort((a, b) => a.h - b.h);
    best = across[0] ?? [...grids].sort((a, b) => a.w - b.w)[0];
  }
  const moves = new Map<string, Pt>();
  list.forEach((p, i) => { const to = best.at[i]; for (const id of p.ids) moves.set(id, { x: to.x - p.r.x, y: to.y - p.r.y }); });
  if ([...moves.values()].every((m) => Math.abs(m.x) < 0.5 && Math.abs(m.y) < 0.5)) return null;
  const by = (id: string) => moves.get(blockOf.get(id) ?? '') ?? null;
  const shift = (p: Pt, m: Pt): Pt => tp({ ...(() => { const q = tp(p); return { x: round(q.x + m.x), y: round(q.y + m.y) }; })() });
  const nodes = laid.nodes.map((n) => {
    const m = by(n.id);
    if (!m) return n;
    const at = shift(n, m);
    return { ...n, x: at.x, y: at.y };
  });
  const edges = laid.edges.map((e) => {
    const m = by(e.from);
    if (!m) return e;
    return { ...e, points: e.points?.map((p) => shift(p, m)), ...(e.labelBox ? { labelBox: { ...e.labelBox, ...shift(e.labelBox, m) } } : null) };
  });
  let out = nodes;
  if (holder) {
    const inside = out.filter((n) => blockOf.has(n.id)).map(tr);
    const h0 = tr(holder);
    const x1 = Math.max(...inside.map((r) => r.x + r.w)) + CONTAINER_PADDING.side;
    const y1 = Math.max(...inside.map((r) => r.y + r.h)) + CONTAINER_PADDING.bottom;
    // At least as wide as its own header and sections, which only an estimate can say here (with a little to spare).
    const own = Math.min(h0.w, Math.ceil(nodeAnatomy(holder, estimateText).w * 1.08));
    const grown = tr({ x: h0.x, y: h0.y, w: Math.max(x1 - h0.x, own), h: y1 - h0.y });
    out = out.map((n) => (n.id === holder.id ? { ...n, ...grown } : n));
  }
  const bounds = diagramBounds(out, edges.map((e) => ({ pts: e.points ?? [] })), edges.flatMap((e) => (e.labelBox ? [e.labelBox] : []))) ?? laid.bounds;
  return { nodes: out, edges, bounds };
}

/* ── Routes between ports, again ── */

/**
 * Edges between ports that items name (a card's rows: an editable system's Connect section), routed again once ELK has placed
 * everything: each port on the end of its row that faces where its edges go, each edge in a lane of its own from end to end,
 * those that share a port side by side out of it, and each label on a straight run only its edge uses, which the routes after
 * it keep clear of (`routeInLanes`). ELK can only route a port on a box's side from where it put it, and in a layered layout
 * a port on a side isn't the way the layers run, so its routes went round and shared lanes. Everything else stays where ELK
 * put it, and those routes keep a lane from what's there.
 */
export function routePortEdges<N, E>(laid: Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'>, text: TextMeasurer = estimateText): Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'> {
  const ported = (e: DiagramEdge<E>) => (!!e.fromPort || !!e.toPort) && e.from !== e.to;
  const index0 = indexDiagram(laid.nodes);
  const tops = new Map<string, { header: number; top: number }>();
  const headOf = (n: DiagramNode<N>) => { let t = tops.get(n.id); if (!t) { const a = nodeAnatomy(n, text); t = { header: a.header, top: a.top }; tops.set(n.id, t); } return t; };
  // A box with something under its header (a Worker's bindings, a state's actions) whose edge out ELK took from its foot,
  // under what it holds, where it reads as the last thing in it's: from its side, beside its sections, instead.
  const fromFoot = (e: DiagramEdge<E>) => {
    const a = index0.byId.get(e.from);
    if (!a || e.fromPort || e.from === e.to || !holdsNodes(a) || a.kind === 'root' || a.kind === 'region' || !(e.points?.length ?? 0)) return false;
    if (!a.description && !a.sections?.some((sec) => sec.items.length)) return false;
    if (isInside(index0, e.to, e.from)) return false;
    return e.points![0].y > a.y + headOf(a).top + 1;
  };
  // A graph this big is explored rather than read, and routing each edge round all the rest would hold the main thread.
  if (laid.nodes.length + laid.edges.length > ROUTE_AGAIN_UP_TO || !laid.edges.some((e) => ported(e) || fromFoot(e))) return laid;
  const nodes = facePorts(laid.nodes, laid.edges);
  const index = indexDiagram(nodes);
  // Such an edge keeps the rest of ELK's route (and its label, where it still is on it): it starts beside the box's sections
  // and goes straight out to where ELK's route passes by, outside the box, and on from there.
  const cards = nodes.filter((n) => !holdsNodes(n) && n.kind !== 'marker');
  const spliced = new Map<string, { points: Pt[]; labelBox?: DiagramEdge<E>['labelBox'] }>();
  for (const e of laid.edges) {
    if (!fromFoot(e)) continue;
    const a = index.byId.get(e.from)!, t = headOf(a), pts = e.points!;
    const y = round(a.y + (t.header + t.top) / 2);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      const side = p.x >= a.x + a.w + 4 ? a.x + a.w : p.x <= a.x - 4 ? a.x : null;
      if (side === null || Math.abs(p.x - q.x) > 0.5 || y < Math.min(p.y, q.y) || y > Math.max(p.y, q.y)) continue;
      const start = { x: side, y }, join = { x: p.x, y };
      if (cards.some((c) => c.id !== e.to && runCrosses(start, join, c))) break;
      const points = simplifyRoute([start, join, ...pts.slice(i)]);
      const l = e.labelBox, mid = l ? { x: l.x + l.w / 2, y: l.y + l.h / 2 } : null;
      const still = mid && points.some((u, k) => k > 0 && onRun(points[k - 1], u, mid));
      spliced.set(e.id, { points, ...(still ? { labelBox: l } : null) });
      break;
    }
  }
  const lane = laid.edges.filter((e) => (ported(e) || (fromFoot(e) && !spliced.get(e.id)?.labelBox)) && index.byId.has(e.from) && index.byId.has(e.to) && (e.points?.length ?? 0) >= 2);
  const ids = new Set(lane.map((e) => e.id));
  const others = laid.edges.filter((e) => !ids.has(e.id));
  // An end that isn't a port leaves the way ELK had it leave.
  const way = (a: { x: number; y: number }, b: { x: number; y: number }) => (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? { x: Math.sign(b.x - a.x) || 1, y: 0 } : { x: 0, y: Math.sign(b.y - a.y) || 1 });
  const ends = new Map<string, { from: ConnectorEnd; to: ConnectorEnd }>(lane.map((e) => {
    const pts = e.points!, n = pts.length;
    const to = { p: pts[n - 1], n: way(pts[n - 1], pts[n - 2]) };
    if (!fromFoot(e)) return [e.id, { from: { p: pts[0], n: way(pts[0], pts[1]) }, to }];
    // Out of the side that faces where it goes, halfway down its sections.
    const a = index.byId.get(e.from)!, t = headOf(a);
    const right = to.p.x >= a.x + a.w / 2;
    return [e.id, { from: { p: { x: right ? a.x + a.w : a.x, y: round(a.y + (t.header + t.top) / 2) }, n: { x: right ? 1 : -1, y: 0 } }, to }];
  }));
  const routed = laneRoutes(index, lane, {
    headOf: (n) => headOf(n).top,
    around: others.map((e) => e.points ?? []),
    labels: others.flatMap((e) => (e.labelBox ? [e.labelBox] : [])),
    labelSize: (e) => edgeLabelSize(e, text),
  }, ends);
  const edges = laid.edges.map((e) => {
    const r = routed.get(e.id);
    const s0 = spliced.get(e.id);
    if (!r && s0) return { ...e, points: s0.points, labelBox: s0.labelBox };
    if (!r) return e;
    const { labelBox: _was, ...rest } = e;
    return { ...rest, points: r.pts, ...(r.label ? { labelBox: r.label } : null) };
  });
  const bounds = diagramBounds(nodes, edges.map((e) => ({ pts: e.points ?? [] })), edges.flatMap((e) => (e.labelBox ? [e.labelBox] : []))) ?? laid.bounds;
  return { nodes, edges, bounds };
}

/** Up to this many nodes and edges, `routePortEdges` routes again. */
const ROUTE_AGAIN_UP_TO = 300;

/** Whether a level or upright run goes through a card. */
const runCrosses = (a: Pt, b: Pt, r: Rect) => Math.max(a.x, b.x) > r.x + 0.5 && Math.min(a.x, b.x) < r.x + r.w - 0.5 && Math.max(a.y, b.y) > r.y + 0.5 && Math.min(a.y, b.y) < r.y + r.h - 0.5;
/** Whether `p` is on the run from `a` to `b`. */
const onRun = (a: Pt, b: Pt, p: Pt) => (Math.abs(a.x - b.x) < 0.5 ? Math.abs(p.x - a.x) < 2 && p.y >= Math.min(a.y, b.y) - 1 && p.y <= Math.max(a.y, b.y) + 1 : Math.abs(p.y - a.y) < 2 && p.x >= Math.min(a.x, b.x) - 1 && p.x <= Math.max(a.x, b.x) + 1);

/* ── Running ELK ── */

type Elk = { layout: (graph: ElkGraph) => Promise<ElkGraph> };
const PEER = 'Laying out a diagram needs elkjs, an optional peer of @brett_lamy/ui: npm install elkjs';

let inProcess: Promise<Elk> | null = null;

async function loadElk(): Promise<Elk> {
  if (!inProcess) {
    inProcess = import('elkjs/lib/elk.bundled.js')
      .then((m) => new (m.default as unknown as new () => Elk)())
      .catch((error) => {
        // A failed import is forgotten, so installing it and trying again works without a reload.
        inProcess = null;
        throw new DiagramLayoutError('peer', PEER, { cause: error });
      });
  }
  return inProcess;
}

const startWorker = (): Worker => new Worker(new URL('./layout-worker.js', import.meta.url), { type: 'module' });

/** Something that runs layouts, one at a time. It keeps its worker between them, as starting one means loading ELK again,
 *  and only `dispose` or aborting a layout stops it. */
export interface DiagramLayoutEngine {
  run(graph: ElkGraph, signal?: AbortSignal): Promise<{ graph: ElkGraph; engine: DiagramLayoutResult['engine'] }>;
  dispose(): void;
}

export function createDiagramLayoutEngine(options: Pick<DiagramLayoutOptions, 'worker'> = {}): DiagramLayoutEngine {
  let worker: Worker | null = null;
  let next = 0;
  // Once the default worker has failed to start, this page's bundler can't do it. No sense trying each time.
  let noWorker = false;
  let fellBack = false;

  const stop = () => {
    worker?.terminate();
    worker = null;
  };

  const inWorker = (graph: ElkGraph, signal?: AbortSignal) =>
    new Promise<ElkGraph>((resolve, reject) => {
      const w = (worker ??= (options.worker ?? startWorker)());
      const id = ++next;
      const finish = () => {
        w.removeEventListener('message', onMessage);
        w.removeEventListener('error', onError);
        w.removeEventListener('messageerror', onError);
        signal?.removeEventListener('abort', onAbort);
      };
      const onMessage = (e: MessageEvent) => {
        if (e.data?.id !== id) return;
        finish();
        if (e.data.error) reject(new DiagramLayoutError('elk', String(e.data.error)));
        else resolve(e.data.graph);
      };
      const onError = (e: Event) => {
        finish();
        stop();
        reject(new DiagramLayoutError('worker', `The diagram layout worker couldn't start: ${(e as ErrorEvent).message ?? 'it failed to load'}`));
      };
      const onAbort = () => {
        // ELK can't be interrupted, so stopping a layout means stopping the worker.
        finish();
        stop();
        reject(new DiagramLayoutError('aborted', 'The layout was stopped.'));
      };
      w.addEventListener('message', onMessage);
      w.addEventListener('error', onError);
      w.addEventListener('messageerror', onError);
      signal?.addEventListener('abort', onAbort);
      w.postMessage({ id, graph });
    });

  return {
    async run(graph, signal) {
      if (signal?.aborted) throw new DiagramLayoutError('aborted', 'The layout was stopped.');
      if (typeof Worker !== 'undefined' && !noWorker) {
        try {
          return { graph: await inWorker(graph, signal), engine: 'worker' };
        } catch (error) {
          if (!(error instanceof DiagramLayoutError) || error.code !== 'worker' || options.worker) throw error;
          noWorker = true;
          fellBack = true;
        }
      }
      // If elkjs isn't installed that's why a worker failed too, and this says so.
      const elk = await loadElk();
      if (fellBack) {
        fellBack = false;
        // eslint-disable-next-line no-console
        console.warn('Diagram layout is running on the main thread, which stops the page while it works: its worker script could not be loaded. Pass `worker` to start it yourself.');
      }
      const out = await elk.layout(graph);
      return { graph: out, engine: typeof document === 'undefined' ? 'server' : 'main-thread' };
    },
    dispose: stop,
  };
}

/** Places a diagram. Rejects with a `DiagramLayoutError`, whose message says what to install if elkjs isn't there. */
export async function layoutDiagram<N, E>(draft: DiagramDraft<N, E>, options: DiagramLayoutOptions = {}): Promise<DiagramLayoutResult<N, E>> {
  const engine = createDiagramLayoutEngine(options);
  try {
    return await runLayout(draft, options, engine);
  } finally {
    engine.dispose();
  }
}

const NS = 'NETWORK_SIMPLEX';
/** A graph with ELK's own node placement (BK) wherever it asked for network simplex. */
function withoutSimplex(graph: ElkGraph): ElkGraph {
  const strip = (el: ElkGraph): ElkGraph => {
    const { 'elk.layered.nodePlacement.strategy': placement, ...rest } = el.layoutOptions ?? {};
    return { ...el, ...(el.layoutOptions ? { layoutOptions: placement === NS ? rest : el.layoutOptions } : null), ...(el.children ? { children: el.children.map(strip) } : null) };
  };
  return strip(graph);
}

/** One layout, on an engine that outlives it. `routePorts: false` leaves the routes between ports as ELK has them, for a
 *  caller that wraps the result first (`routePortEdges` after that). */
export async function runLayout<N, E>(draft: DiagramDraft<N, E>, options: DiagramLayoutOptions, engine: DiagramLayoutEngine, graph = toElkGraph(draft, options), routePorts = true): Promise<DiagramLayoutResult<N, E>> {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let ran: Awaited<ReturnType<DiagramLayoutEngine['run']>>;
  try {
    ran = await engine.run(graph, options.signal);
  } catch (error) {
    // ELK's network simplex placement fails on some graphs (fixed ports inside boxes): those get its default instead.
    if (!(error instanceof DiagramLayoutError) || error.code !== 'elk' || !JSON.stringify(graph).includes(NS)) throw error;
    ran = await engine.run(withoutSimplex(graph), options.signal);
  }
  const { graph: out, engine: where } = ran;
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
  const laid = fromElkGraph(draft, out);
  const wrapped = options.board ? wrapDiagram(laid, options.board, options.direction) : laid;
  return { ...(routePorts ? routePortEdges(wrapped, options.text) : wrapped), engine: where, ms };
}

