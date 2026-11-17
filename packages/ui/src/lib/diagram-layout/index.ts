/* ══ Diagram layout — where nodes go, by ELK ══
   `elk.algorithm: layered` with `elk.hierarchyHandling: INCLUDE_CHILDREN` places nodes, groups and the routes between
   them, and with nothing inside anything, `SEPARATE_CHILDREN` packs what isn't connected into rows. In a browser it runs in a Web Worker: on the main thread, 2,000 nodes stop the page for about 5 s. On a server it
   runs in the process.

   ELK is an optional peer, as it's 442 KB gzipped and licensed EPL-2.0 OR GPL-3.0-or-later, so it's only imported here, when
   a layout's first asked for, and an app with fixed positions never loads it. Nothing at module scope touches a browser
   API, so this is safe to import on a server. `lib/diagram-layout/react` has the hook. */
import type { Pt, Rect } from '@/lib/canvas-math';
import { CONTAINER_PADDING, DIAGRAM_LEGIBLE_ZOOM, ELBOW_GAP, ancestorsOf, descendantsOf, diagramBounds, edgeLabelSize, facePorts, hasEdgeLabel, holdsNodes, indexDiagram, isInside, itemKey, laneRoutes, nodeAnatomy, placeItemPorts, regionDividers, rerouteOrthogonal, sectionKey, sideLoopRoute, simplifyRoute, type ConnectorEnd, type DiagramEdge, type DiagramIndex, type DiagramNode, type DiagramSide } from '@/lib/diagram-model';
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
/** How far apart the edges leaving one side of a card are, at the least: a lane, so two never read as one. */
const EDGE_APART = 16;
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
  // How many edges leave each node, and come into it (not its own loops), which its width has to give room to.
  const ends = new Map<string, number>();
  for (const e of draft.edges ?? []) {
    if (e.from === e.to) continue;
    ends.set(`${e.from}\0out`, (ends.get(`${e.from}\0out`) ?? 0) + 1);
    ends.set(`${e.to}\0in`, (ends.get(`${e.to}\0in`) ?? 0) + 1);
  }
  const usedPorts = new Set((draft.edges ?? []).flatMap((e) => [...(e.fromPort ? [portId(e.from, e.fromPort)] : []), ...(e.toPort ? [portId(e.to, e.toPort)] : [])]));
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
      // And one that says how far down it is, which is from the top too.
      for (const p of n.ports ?? []) if (p.offset !== undefined && (p.side === 'left' || p.side === 'right')) rows[p.id] = p.offset;
      el.layoutOptions = {
        'elk.padding': padding({ ...air, side, top: Math.ceil(anatomy.top) + air.top }),
        [AIR_TOP]: String(air.top),
        ...(Object.keys(rows).length ? { [PORT_ROWS]: JSON.stringify(rows) } : null),
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${n.w || anatomy.w}, ${n.h || anatomy.h})`,
      };
    } else {
      // Wide enough for the edges that leave (or come in) by one side to be a lane apart, so none reads as another's.
      el.width = n.w || (n.kind === 'marker' ? anatomy.w : Math.max(anatomy.w, (Math.max(ends.get(`${n.id}\0out`) ?? 0, ends.get(`${n.id}\0in`) ?? 0) + 1) * EDGE_APART));
      el.height = n.h || anatomy.h;
    }
    // A leaf's self-loops sit beside it, their labels on its sides (the first on its start side, the next on its end side,
    // and so on), which ELK keeps room for as it does for a node's own outside labels: edges still meet the card itself.
    const loops = holds ? [] : loopsOf.get(n.id) ?? [];
    if (loops.length) {
      el.labels = loops.map((e, i) => {
        const size = edgeLabelSize(e, text) ?? LOOP_ROOM;
        // With room under it for the loop's way back.
        // A card with an entry marker has it at its start side: its first loop goes on its end side, clear of it.
        const after = n.entry ? i % 2 === 0 : i % 2 === 1;
        return { id: loopId(e.id), text: e.title ?? '', width: size.w, height: size.h + LOOP_FOOT, layoutOptions: { 'elk.nodeLabels.placement': after ? LOOP_AFTER : LOOP_BEFORE } };
      });
    }
    // Where things start is first in what holds it.
    if (n.entry) el.layoutOptions = { ...el.layoutOptions, 'elk.layered.layering.layerConstraint': 'FIRST' };
    // Only a port an edge claims has a say in where things go: one that's only there to connect by (a dot) changes nothing,
    // so a diagram with dots to connect by is laid out as it is without them.
    const claimed = n.ports?.filter((p) => usedPorts.has(portId(n.id, p.id)));
    if (claimed?.length) {
      // A node's size is known here, so its ports can stay where they're drawn, with routes ending at them. One that holds
      // others is only as big as ELK makes it, so ELK says where they went, and `fromElkGraph` reads that back.
      const known = el.width !== undefined && el.height !== undefined;
      el.layoutOptions = { ...el.layoutOptions, 'elk.portConstraints': known ? 'FIXED_POS' : 'FIXED_SIDE' };
      el.ports = claimed.map((p) => {
        const length = p.side === 'left' || p.side === 'right' ? el.height ?? 0 : el.width ?? 0;
        const at = p.offset !== undefined ? Math.min(1, p.offset / (length || 1)) : p.at ?? 0.5;
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
      if (p.at !== undefined || p.offset !== undefined || got?.x === undefined || got.y === undefined) return p;
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
    /** What ELK had for each route this takes round a box's head, which is where its ends are. */
    const was = new Map<string, readonly Pt[]>();
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
      if (pts !== e.points) { was.set(e.id, e.points); edges[i] = { ...e, points: pts }; }
    }
    // Those are routed again, with their labels, which were on the way ELK had them: in a lane of their own, round every
    // box's head, into a box through its wall below that (`laneRoutes`). Too many to route, they keep the way round.
    // Only those whose label the way round left behind (few: the rest keep the way round, a label put back on it), as each
    // is a search round everything.
    const offRoute = (e: DiagramEdge<E>) => {
      const l = e.labelBox, pts = e.points ?? [];
      if (!l) return false;
      const mid = { x: l.x + l.w / 2, y: l.y + l.h / 2 };
      return !pts.some((p, i) => i > 0 && onRun(pts[i - 1], p, mid));
    };
    const again = new Set(edges.filter((e) => was.has(e.id) && offRoute(e)).map((e) => e.id));
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      if (was.has(e.id) && e.labelBox && (!again.has(e.id) || again.size > REROUTE_AT_MOST || nodes.length + edges.length > SEARCH_UP_TO)) edges[i] = { ...e, labelBox: seatLabel(e.points!, e.labelBox) };
    }
    if (again.size && again.size <= REROUTE_AT_MOST && nodes.length + edges.length <= SEARCH_UP_TO) {
      const lane = edges.filter((e) => again.has(e.id));
      const others = edges.filter((e) => !again.has(e.id));
      const ends = new Map(lane.map((e) => {
        const o = was.get(e.id)!, n = o.length;
        return [e.id, { from: { p: o[0], n: wayOf(o[0], o[1]) }, to: { p: o[n - 1], n: wayOf(o[n - 1], o[n - 2]) } }];
      }));
      const routed = laneRoutes(index, lane, {
        headOf: (n) => Math.max(0, (innerTop(placed.get(n.id), n) ?? n.y) - n.y),
        captionOf: (n) => nodeAnatomy(n, estimateText).w,
        around: others.map((e) => e.points ?? []),
        labels: others.flatMap((e) => (e.labelBox ? [e.labelBox] : [])),
        labelSize: (e) => (e.labelBox ? { w: e.labelBox.w, h: e.labelBox.h } : null),
      }, ends);
      const blocks = heads.map((h) => ({ x: h.n.x, y: h.n.y, w: h.n.kind === 'region' ? Math.min(h.n.w, nodeAnatomy(h.n, estimateText).w) : h.n.w, h: h.top - h.n.y }));
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        if (!again.has(e.id)) continue;
        const r = routed.get(e.id);
        // Where there's no way in but through a head (no room under it to come into what it holds), the way round stays,
        // and its label goes on it.
        const through = !r || r.pts.some((p, j) => j > 0 && blocks.some((b) => runCrosses(r.pts[j - 1], p, b)));
        const { labelBox: label, ...rest } = e;
        if (!through) { edges[i] = { ...rest, points: r!.pts, ...(r!.label ? { labelBox: r!.label } : null) }; continue; }
        edges[i] = { ...rest, points: e.points, ...(label ? { labelBox: seatLabel(e.points!, label) } : null) };
      }
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

/** Whether a run from `a` to `b` (along the layers) crosses the cut at `y`: a point on the cut is in the column above it. */
const crossesCut = (a: number, b: number, y: number) => Math.min(a, b) <= y && y < Math.max(a, b);

/**
 * A laid out diagram, with the run of its main container (the root, or the top level) wrapped into as many columns as fit
 * `board` best: cut between layers where few edges cross, each column moved up beside the one before it, and each edge that
 * crosses a cut taken from the foot of its column, along the gap, over to the head of the next. Unchanged when one column
 * fits best (a phone gets one column, read by scrolling), or when no cut is clean. Works on layers that run down or across.
 * Parts that nothing joins are packed side by side after the biggest has been wrapped on its own (`packing`: that's been
 * done, and this is the packing).
 */
export function wrapDiagram<N, E>(laid: Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'>, board: DiagramBoardSize, direction: DiagramDirection = 'down', packing = false): Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'> {
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
  // And each block's card alone, without its entry marker: where a column's first card is.
  const bare = new Map<string, Rect>();
  for (const id of runIds) {
    const n = index.byId.get(id)!;
    grow(id, tr(n));
    bare.set(id, tr(n));
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
  // What isn't joined to anything else in the run (an environment of its own, a service just added) is arranged with the rest
  // to fill the board: side by side on a wide one, one above the other on a tall one, each from the top. The biggest part is
  // wrapped first, as a run of its own: a card on its own beside it is no reason for a long run not to wrap (round 9's F1,
  // where adding an unconnected service unwrapped a two-column system into one 1,500 px column).
  const parts = partsOfRun(laid.edges, runIds, blockOf);
  if (parts.length > 1 && !packing) {
    const biggest = parts.reduce((a, b) => (b.length > a.length ? b : a));
    const wrapped = biggest.length >= 3 ? wrapPart(laid, holder, biggest, blockOf, board, direction) : laid;
    return wrapDiagram(wrapped, board, direction, true);
  }
  const packed = packParts(laid, { holder, runIds, blockOf, box, labelBlocks, room, tr, tp });
  if (packed) return packed;
  // Parts already wrapped and packed: nothing more to cut.
  if (runIds.length < 3 || parts.length > 1) return laid;
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
    const across = routes.filter(({ pts }) => pts.some((p, j) => j > 0 && crossesCut(pts[j - 1].y, p.y, y)));
    // Room between the columns either side of it: for its routes side by side, and for the widest label among them.
    const gap = Math.max(WRAP_GAP + across.length * WRAP_LANE, ...across.map(({ e }) => (e.labelBox ? tr(e.labelBox).w + WRAP_LABEL_AIR : 0)));
    return { y, crossing: across.length, gap };
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
    w += cuts.reduce((sum, i) => sum + cutAt[i - 1].gap, 0);
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
      if (crossesCut(q.y, p.y, y)) list.push({ edge: e.id, x: q.x + ((p.x - q.x) * (y - q.y)) / (p.y - q.y) });
    }
    return list.sort((u, v) => v.x - u.x);
  });
  const colOfBlockAt = (id: string) => { const r = box.get(id)!; return columnOfY(r.y + r.h / 2); };
  const spans = Array.from({ length: k }, (_, c) => width(c === 0 ? start - 1 : lines[c - 1], c === k - 1 ? end + 1 : lines[c]));
  // Between two columns, room for the routes that go from one to the next, side by side, and for the widest of their labels
  // on the run across (each column's head level with the first's: the routes go straight across, not round).
  const labelAcross = (c: number) => Math.max(0, ...crossings[c].map((x0) => { const l = laid.edges.find((e) => e.id === x0.edge)?.labelBox; return l ? tr(l).w : 0; }));
  const gapAfter = (c: number) => (c < crossings.length ? Math.max(WRAP_GAP + crossings[c].length * WRAP_LANE, labelAcross(c) + WRAP_LABEL_AIR) : 0);
  // A column's head is its first card: the label of an edge from the column before, which ELK put above it, goes with
  // that edge's new route.
  const crossingLabels = new Set(crossings.flatMap((list) => list.map((c) => c.edge)));
  // Each column's first card goes level with the first column's, less the strip for what comes across (an entry marker
  // stands out above its card, into the room ELK keeps above the first layer, so a column's head is its card, never its
  // marker).
  const headOfColumn = (c: number) => {
    const lo = c ? lines[c - 1] : -Infinity, hi = c < lines.length ? lines[c] : Infinity;
    const tops = [...box.entries()].filter(([, r]) => r.y + r.h / 2 > lo && r.y + r.h / 2 <= hi).map(([id]) => bare.get(id)!.y)
      .concat(labelBlocks.filter((l) => !crossingLabels.has(l.edge) && l.r.y + l.r.h / 2 > lo && l.r.y + l.r.h / 2 <= hi).map((l) => l.r.y));
    return tops.length ? Math.min(...tops) : lo;
  };
  const head0 = headOfColumn(0);
  /** The room over a column's head: a lane for each route coming across, one to spare, and where one of them comes to (or
   *  from) something at the head itself, so it can only go over, its label as well. */
  const stripOver = (c: number) => {
    const head = headOfColumn(c);
    let label = 0;
    // The routes across the cuts either side of it.
    for (const cut of [c - 1, c]) for (const { edge } of crossings[cut] ?? []) {
      const e = laid.edges.find((x) => x.id === edge);
      const ends = e ? [blockOf.get(e.from), blockOf.get(e.to)] : [];
      if (e?.labelBox && ends.some((b) => b && colOfBlockAt(b) === c && Math.abs(bare.get(b)!.y - head) < 1)) label = Math.max(label, tr(e.labelBox).h + WRAP_LANE * 2);
    }
    return (c ? WRAP_LANE * (crossings[c - 1].length + 1) : 0) + label;
  };
  /** The columns placed (with a strip over each for what comes across, or not), routed across, and the box grown round them. */
  const place = (strips: boolean) => {
    const offsets: Pt[] = [];
    let x = spans[0].x0;
    for (let c = 0; c < k; c++) {
      // Under a strip for the routes coming across into it, a lane each and one to spare, so one that has to go over what's at
      // its head can, rather than through the box's header and sections above it.
      offsets.push({ x: x - spans[c].x0, y: head0 - headOfColumn(c) + (strips ? stripOver(c) : 0) });
      x += spans[c].x1 - spans[c].x0 + gapAfter(c);
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
    const moved = laid.edges.map((e) => {
      const pts = (e.points ?? []).map(tp);
      if (!pts.length || !blockOf.has(e.from)) return e;
      const out: Pt[] = [];
      for (let j = 0; j < pts.length; j++) {
        const p = pts[j];
        if (j > 0) {
          const q = pts[j - 1];
          const down = p.y > q.y;
          const crossed = lines.map((y, c) => ({ y, c })).filter(({ y }) => crossesCut(q.y, p.y, y)).sort((u, v) => (down ? u.y - v.y : v.y - u.y));
          for (const { y, c } of crossed) {
            // This run's own crossing: the one at its x (an edge that crosses a cut twice has one each way).
            const here = q.x + ((p.x - q.x) * (y - q.y)) / (p.y - q.y);
            const at = crossings[c].filter((x0) => x0.edge === e.id).sort((u, v) => Math.abs(u.x - here) - Math.abs(v.x - here))[0]!;
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
    // An edge from one column to another doesn't keep ELK's way, which went down a layer: it's routed again between where its
    // ends are now, in a lane of its own, its label on a run of its own (`laneRoutes`), so it goes across, not round.
    const crossed = new Set(crossings.flatMap((list) => list.map((c) => c.edge)));
    const edges = rerouteAcross(nodes, moved, crossed, tr, tp);
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
  };
  // Without strips first, which keeps it as short as it can be; with them when a route across has nowhere to go but
  // through a box's header and sections (or its label onto them).
  const flat = place(false);
  return crossesHeads(flat, crossingLabels) ? place(true) : flat;
}

/** The run's parts that nothing joins to one another, each as the ids of its blocks, in the run's order. */
function partsOfRun<E>(edges: readonly DiagramEdge<E>[], runIds: readonly string[], blockOf: ReadonlyMap<string, string>): string[][] {
  const root = new Map(runIds.map((id) => [id, id]));
  const find = (id: string): string => { let r = id; while (root.get(r) !== r) r = root.get(r)!; return r; };
  for (const e of edges) {
    const a = blockOf.get(e.from), b = blockOf.get(e.to);
    if (a && b && a !== b) root.set(find(a), find(b));
  }
  const parts = new Map<string, string[]>();
  for (const id of runIds) parts.set(find(id), [...(parts.get(find(id)) ?? []), id]);
  return [...parts.values()];
}

/** One part of a run wrapped on its own (the others left where they are, for packing after): the part with its box, as if it
 *  were all the box held, wrapped to the board, and put back. */
function wrapPart<N, E>(laid: Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'>, holder: DiagramNode<N> | null, part: readonly string[], blockOf: ReadonlyMap<string, string>, board: DiagramBoardSize, direction: DiagramDirection): Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'> {
  const inPart = new Set(part);
  const mine = (id: string) => inPart.has(blockOf.get(id) ?? '');
  const nodes = laid.nodes.filter((n) => mine(n.id));
  const edges = laid.edges.filter((e) => mine(e.from) && mine(e.to));
  if (holder) {
    // The box as tall and wide as this part needs of it (with its header and sections), so what's beside it isn't counted.
    const x1 = Math.max(...nodes.map((n) => n.x + n.w), ...edges.flatMap((e) => (e.points ?? []).map((p) => p.x))) + CONTAINER_PADDING.side;
    const y1 = Math.max(...nodes.map((n) => n.y + n.h), ...edges.flatMap((e) => (e.points ?? []).map((p) => p.y))) + CONTAINER_PADDING.bottom;
    const own = Math.ceil(nodeAnatomy(holder, estimateText).w);
    nodes.unshift({ ...holder, w: Math.max(own, x1 - holder.x), h: y1 - holder.y });
  }
  const bounds = diagramBounds(nodes, edges.map((e) => ({ pts: e.points ?? [] })), edges.flatMap((e) => (e.labelBox ? [e.labelBox] : []))) ?? laid.bounds;
  const wrapped = wrapDiagram({ nodes, edges, bounds }, board, direction, true);
  if (wrapped.nodes === nodes) return laid;
  const placed = new Map(wrapped.nodes.map((n) => [n.id, n]));
  const routed = new Map(wrapped.edges.map((e) => [e.id, e]));
  const outNodes = laid.nodes.map((n) => {
    const p = placed.get(n.id);
    if (!p) return n;
    // The box keeps its own width at least, and holds the rest of what's in it as well: packing grows it round them all.
    return n.id === holder?.id ? { ...n, x: p.x, y: p.y, w: Math.max(p.w, n.w), h: Math.max(p.h, n.h) } : p;
  });
  const outEdges = laid.edges.map((e) => routed.get(e.id) ?? e);
  return { nodes: outNodes, edges: outEdges, bounds: diagramBounds(outNodes, outEdges.map((e) => ({ pts: e.points ?? [] })), outEdges.flatMap((e) => (e.labelBox ? [e.labelBox] : []))) ?? laid.bounds };
}

/** Whether any of the given edges runs through a box's header and sections (or a lane under them), or has its label on
 *  them. */
function crossesHeads<N, E>(laid: Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges'>, ids: ReadonlySet<string>): boolean {
  // A lane under the head too: a route that close to its hairline reads as the hairline.
  const heads = laid.nodes.filter((n) => holdsNodes(n) && n.kind !== 'region').map((n) => ({ x: n.x, y: n.y, w: n.w, h: Math.min(n.h, nodeAnatomy(n, estimateText).top + 10) }));
  const meets = (p: Rect, q: Rect) => p.x < q.x + q.w - 1 && q.x < p.x + p.w - 1 && p.y < q.y + q.h - 1 && q.y < p.y + p.h - 1;
  return laid.edges.some((e) => ids.has(e.id) && heads.some((h) => (e.labelBox && meets(e.labelBox, h)) || (e.points ?? []).some((p, i, pts) => i > 0 && runCrosses(pts[i - 1], p, { x: h.x + 1, y: h.y + 1, w: h.w - 2, h: h.h - 2 }))));
}

/** Room either side of a label on the run between two columns. */
const WRAP_LABEL_AIR = 40;

/**
 * Edges that go from one wrapped column to another, routed again from where their ends are now (worked out as if the layers
 * ran down), each by the cheapest of the ways it could go: out of the source's foot into the target's head (or side) when
 * the target is lower down; straight across, out of the side of one into the side of the other, where the two are level;
 * out of the source's side into the target's foot when the target is higher up; side to side. Ports, where an edge has
 * them, are its ends. Every other route and label stays, and these
 * keep a lane from them. Nothing changes past `SEARCH_UP_TO` nodes and edges.
 */
function rerouteAcross<N, E>(nodes: DiagramNode<N>[], edges: DiagramEdge<E>[], ids: ReadonlySet<string>, tr: (r: Rect) => Rect, tp: (p: Pt) => Pt): DiagramEdge<E>[] {
  if (!ids.size || nodes.length + edges.length > SEARCH_UP_TO) return edges;
  const index = indexDiagram(nodes);
  const lane = edges.filter((e) => ids.has(e.id) && e.from !== e.to && index.byId.has(e.from) && index.byId.has(e.to));
  if (!lane.length) return edges;
  const others = edges.filter((e) => !lane.includes(e));
  const tops = new Map<string, number>();
  const headOf = (n: DiagramNode<N>) => { let t = tops.get(n.id); if (t === undefined) { t = nodeAnatomy(n, estimateText).top; tops.set(n.id, t); } return t; };
  const options = {
    headOf,
    captionOf: (n: DiagramNode<N>) => nodeAnatomy(n, estimateText).w,
    around: others.map((e) => e.points ?? []),
    labels: others.flatMap((e) => (e.labelBox ? [e.labelBox] : [])),
    labelSize: (e: DiagramEdge<E>) => (e.labelBox ? { w: e.labelBox.w, h: e.labelBox.h } : null),
  };
  const ends = new Map<string, { from: ConnectorEnd; to: ConnectorEnd }>();
  for (const e of lane) {
    const s = tr(index.byId.get(e.from)!), t = tr(index.byId.get(e.to)!);
    const end = (p: Pt, n: Pt): ConnectorEnd => ({ p: tp({ x: round(p.x), y: round(p.y) }), n: tp(n) });
    const right = t.x + t.w / 2 >= s.x + s.w / 2;
    const level = Math.min(s.y + s.h, t.y + t.h) - Math.max(s.y, t.y);
    const sideOf = (r: Rect, out: boolean, y: number) => end({ x: (right === out) ? r.x + r.w : r.x, y }, { x: (right === out) ? 1 : -1, y: 0 });
    const foot = (r: Rect) => end({ x: r.x + r.w / 2, y: r.y + r.h }, { x: 0, y: 1 });
    const head = (r: Rect) => end({ x: r.x + r.w / 2, y: r.y }, { x: 0, y: -1 });
    const middle = (r: Rect) => r.y + Math.min(r.h / 2, 24);
    // The ways it could go: out of the foot into the head when the target's lower down; across, level, where they're
    // both; out of the side into the foot when it's higher up; out of the foot into the side, and side to side.
    const ways: { from: ConnectorEnd; to: ConnectorEnd }[] = [];
    if (t.y >= s.y + s.h + WRAP_LANE * 2) ways.push({ from: foot(s), to: head(t) }, { from: foot(s), to: sideOf(t, false, middle(t)) });
    if (level >= 24) { const y = Math.max(s.y, t.y) + level / 2; ways.push({ from: sideOf(s, true, y), to: sideOf(t, false, y) }); }
    if (t.y + t.h + WRAP_LANE * 2 <= s.y + s.h) ways.push({ from: sideOf(s, true, middle(s)), to: foot(t) });
    ways.push({ from: sideOf(s, true, middle(s)), to: sideOf(t, false, middle(t)) });
    ends.set(e.id, cheapestWay(index, e, ways, options));
  }
  const routed = laneRoutes(index, lane, options, ends);
  return edges.map((e) => {
    const r = routed.get(e.id);
    if (!r) return e;
    const { labelBox: _was, ...rest } = e;
    return { ...rest, points: r.pts, ...(r.label ? { labelBox: r.label } : null) };
  });
}

/** Of the ways an edge could go between given ends, the cheapest routed on its own: its length, a turn's worth for each turn,
 *  and more for a label that found no clear run of its own (or for running along a wall or another route, which the lane
 *  router prices in, so a way that does is longer by that much). */
function cheapestWay<N, E>(index: DiagramIndex<N>, e: DiagramEdge<E>, ways: { from: ConnectorEnd; to: ConnectorEnd }[], options: Parameters<typeof laneRoutes<N, E>>[2]): { from: ConnectorEnd; to: ConnectorEnd } {
  if (ways.length < 2) return ways[0];
  let best = ways[0], cost = Infinity;
  for (const way of ways) {
    const r = laneRoutes(index, [e], options, new Map([[e.id, way]])).get(e.id);
    if (!r) continue;
    let c = 0;
    for (let i = 1; i < r.pts.length; i++) c += Math.abs(r.pts[i].x - r.pts[i - 1].x) + Math.abs(r.pts[i].y - r.pts[i - 1].y);
    c += 40 * Math.max(0, r.pts.length - 2) + ((e.labelBox || options.labelSize?.(e)) && !r.clear ? 400 : 0) + wallHugging(index, r.pts);
    if (c < cost) { cost = c; best = way; }
  }
  return best;
}

/** How much of a route runs along a box's wall (closer than a lane), priced as the lane router prices it. */
function wallHugging<N>(index: DiagramIndex<N>, pts: readonly Pt[]): number {
  let c = 0;
  for (const n of index.nodes) {
    if (!holdsNodes(n) || n.kind === 'region') continue;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const level = Math.abs(a.y - b.y) < 0.5;
      const along = level
        ? (Math.abs(a.y - n.y) < 8 || Math.abs(a.y - n.y - n.h) < 8 ? Math.min(Math.max(a.x, b.x), n.x + n.w) - Math.max(Math.min(a.x, b.x), n.x) : 0)
        : (Math.abs(a.x - n.x) < 8 || Math.abs(a.x - n.x - n.w) < 8 ? Math.min(Math.max(a.y, b.y), n.y + n.h) - Math.max(Math.min(a.y, b.y), n.y) : 0);
      if (along > 0.5) c += 5000 + along * 20;
    }
  }
  return c;
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
  const parts = partsOfRun(laid.edges, runIds, blockOf);
  if (parts.length < 2) return null;
  const union = (rs: Rect[]): Rect => {
    const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));
    return { x: x0, y: y0, w: Math.max(...rs.map((r) => r.x + r.w)) - x0, h: Math.max(...rs.map((r) => r.y + r.h)) - y0 };
  };
  const list = parts.map((ids) => {
    const set = new Set(ids);
    const rects = ids.map((id) => box.get(id)!);
    for (const e of laid.edges) {
      if (!set.has(blockOf.get(e.from) ?? '')) continue;
      for (const p of e.points ?? []) { const q = tp(p); rects.push({ x: q.x, y: q.y, w: 0, h: 0 }); }
      const l = labelBlocks.find((b) => b.edge === e.id);
      if (l) rects.push(l.r);
    }
    const r = union(rects);
    // How far its first card is below its top (an entry marker, a label over it): parts in a row line up by their cards,
    // so a part with neither doesn't stand up into what's above the run (a box's header).
    const cardsTop = Math.min(...ids.map((id) => tr(laid.nodes.find((n) => n.id === id)!).y));
    return { ids: set, r, lift: Math.max(0, cardsTop - r.y) };
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
      const lift = Math.max(...row.map((p) => p.lift));
      let x = run.x;
      for (const p of row) { at.push({ x, y: y + lift - p.lift }); x += p.r.w + PACK_GAP; }
      w = Math.max(w, x - PACK_GAP - run.x);
      y += Math.max(...row.map((p) => p.r.h + lift - p.lift)) + PACK_GAP;
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
 * Edges between ports that items name (a card's rows: an editable system's handlers), or that sit at a fixed place on a side (its header), routed again once ELK has placed
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
  const way = wayOf;
  const options = {
    headOf: (n: DiagramNode<N>) => headOf(n).top,
    captionOf: (n: DiagramNode<N>) => nodeAnatomy(n, text).w,
    around: others.map((e) => e.points ?? []),
    labels: others.flatMap((e) => (e.labelBox ? [e.labelBox] : [])),
    labelSize: (e: DiagramEdge<E>) => edgeLabelSize(e, text),
  };
  const ends = new Map<string, { from: ConnectorEnd; to: ConnectorEnd }>(lane.map((e) => {
    const pts = e.points!, n = pts.length;
    const to = { p: pts[n - 1], n: way(pts[n - 1], pts[n - 2]) };
    if (!fromFoot(e)) return [e.id, { from: { p: pts[0], n: way(pts[0], pts[1]) }, to }];
    // Out of a side, halfway down its sections: whichever side has the cheaper way (the one facing where it goes, unless
    // that way runs down a wall or round the far side of something).
    const a = index.byId.get(e.from)!, t = headOf(a);
    const y = round(a.y + (t.header + t.top) / 2);
    const sides = [to.p.x >= a.x + a.w / 2, to.p.x < a.x + a.w / 2].map((right) => ({ from: { p: { x: right ? a.x + a.w : a.x, y }, n: { x: right ? 1 : -1, y: 0 } }, to }));
    return [e.id, cheapestWay(index, e, sides, options)];
  }));
  const routed = laneRoutes(index, lane, options, ends);
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

/** At most this many edges a box's head turned away are routed again with their labels; past that, a label goes on the way round. */
const REROUTE_AT_MOST = 4;
/** Up to this many nodes and edges, the routes a layout's own passes re-make are searched for (the lane router's cost grows fast with both). */
const SEARCH_UP_TO = 120;

/** Up to this many nodes and edges, routes that go round are routed again (`noUTurns`). */
const U_TURNS_UP_TO = 80;

/** Up to this many nodes and edges, `routePortEdges` routes again. */
const ROUTE_AGAIN_UP_TO = 300;

/** Which way a route goes from `a` to `b`, the nearer of the four. */
const wayOf = (a: Pt, b: Pt): Pt => (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? { x: Math.sign(b.x - a.x) || 1, y: 0 } : { x: 0, y: Math.sign(b.y - a.y) || 1 });

/**
 * Edges that share another's label (`forkOf`: a transition to several targets) drawn from that label: along the route of the
 * one they fork from, out of the label the way it goes, as far as the turn from where a square way to their own target is
 * shortest and clear of every card, box head and label, and on from there. So the one label has one line out of it, which
 * splits. Where no such way is clear, a fork gets a lane of its own from the label (`laneRoutes`). The rest stays as it is.
 * Nothing changes past `ROUTE_AGAIN_UP_TO` nodes and edges, or for a fork whose label has no place.
 */
export function routeForks<N, E>(laid: Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'>, text: TextMeasurer = estimateText): Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'> {
  const forks = laid.edges.filter((e) => e.forkOf && e.from !== e.to && (e.points?.length ?? 0) >= 2);
  if (!forks.length || laid.nodes.length + laid.edges.length > ROUTE_AGAIN_UP_TO) return laid;
  const byId = new Map(laid.edges.map((e) => [e.id, e]));
  const index = indexDiagram(laid.nodes);
  const tops = new Map<string, number>();
  const headOf = (n: DiagramNode<N>) => { let t = tops.get(n.id); if (t === undefined) { t = nodeAnatomy(n, text).top; tops.set(n.id, t); } return t; };
  // What a way out of the trunk mustn't go through: every card, each box's head (a region's caption), every label.
  const blocks: { id: string; r: Rect }[] = [];
  for (const n of laid.nodes) {
    if (n.kind === 'marker' || n.kind === 'root') continue;
    if (!holdsNodes(n)) blocks.push({ id: n.id, r: n });
    else if (n.kind === 'region') { if (n.title) blocks.push({ id: n.id, r: { x: n.x, y: n.y, w: Math.min(n.w, nodeAnatomy(n, text).w), h: Math.min(n.h, headOf(n)) } }); }
    else blocks.push({ id: n.id, r: { x: n.x, y: n.y, w: n.w, h: Math.min(n.h, headOf(n)) } });
  }
  for (const e of laid.edges) if (e.labelBox) blocks.push({ id: `\0label:${e.id}`, r: e.labelBox });
  // A box's walls: a run beside one, closer than a lane, reads as the wall.
  const walls = laid.nodes.filter((n) => holdsNodes(n) && n.kind !== 'region').flatMap((n) => [
    [{ x: n.x, y: n.y }, { x: n.x + n.w, y: n.y }], [{ x: n.x, y: n.y + n.h }, { x: n.x + n.w, y: n.y + n.h }],
    [{ x: n.x, y: n.y }, { x: n.x, y: n.y + n.h }], [{ x: n.x + n.w, y: n.y }, { x: n.x + n.w, y: n.y + n.h }],
  ]);
  const clear = (a: Pt, b: Pt, to: string, self: string) => walls.every((w) => !alongRoute(a, b, w))
    && blocks.every(({ id, r }) => id === to || !runCrosses(a, b, { x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 8 }))
    // nor along another route, closer than a lane (the one it forks from is its trunk, and others fork from it too)
    && laid.edges.every((o) => o.id === self || o.forkOf === byId.get(self)?.forkOf || o.id === byId.get(self)?.forkOf || !alongRoute(a, b, o.points ?? []));
  const out = new Map<string, Pt[]>();
  const fallback = new Map<string, { from: ConnectorEnd; to: ConnectorEnd }>();
  for (const f of forks) {
    const o = byId.get(f.forkOf!), l = o?.labelBox, op = o?.points;
    if (!l || !op || op.length < 2) continue;
    // The run of its route the label's on, and which way that goes.
    let at = -1, dir: Pt | null = null;
    for (let i = 1; i < op.length && at < 0; i++) {
      const a = op[i - 1], b = op[i];
      const hits = Math.max(a.x, b.x) >= l.x && Math.min(a.x, b.x) <= l.x + l.w && Math.max(a.y, b.y) >= l.y && Math.min(a.y, b.y) <= l.y + l.h;
      if (hits && (Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5)) { at = i; dir = wayOf(a, b); }
    }
    if (!dir) continue;
    const exit = dir.x ? { x: dir.x > 0 ? l.x + l.w : l.x, y: op[at].y } : { x: op[at].x, y: dir.y > 0 ? l.y + l.h : l.y };
    const fp = f.points!, end = fp[fp.length - 1], into = wayOf(fp[fp.length - 2], end);
    // The trunk: from the label on, the other's route but its last stretch, into its own target.
    const trunk = [exit, ...op.slice(at, -1)];
    let best: { pts: Pt[]; len: number } | null = null;
    let along = 0;
    for (let k = 0; k < trunk.length; k++) {
      if (k) along += Math.abs(trunk[k].x - trunk[k - 1].x) + Math.abs(trunk[k].y - trunk[k - 1].y);
      const v = trunk[k];
      // Square from there into its end, arriving the way its end faces: across, then along it, or the other way round.
      const corner = into.y ? { x: end.x, y: v.y } : { x: v.x, y: end.y };
      if ((into.y && Math.sign(end.y - v.y) !== into.y) || (into.x && Math.sign(end.x - v.x) !== into.x)) continue;
      if (!clear(v, corner, f.to, f.id) || !clear(corner, end, f.to, f.id)) continue;
      // Its length, and a lane's worth more for each route it crosses.
      const len = along + Math.abs(corner.x - v.x) + Math.abs(corner.y - v.y) + Math.abs(end.x - corner.x) + Math.abs(end.y - corner.y)
        + 30 * laid.edges.reduce((n, o) => n + (o.id === f.id || o.id === f.forkOf ? 0 : crossings([v, corner, end], o.points ?? [])), 0);
      if (!best || len < best.len) best = { pts: simplifyRoute([...trunk.slice(0, k + 1), corner, end]), len };
    }
    if (best) out.set(f.id, best.pts);
    else fallback.set(f.id, { from: { p: exit, n: dir }, to: { p: end, n: { x: -into.x, y: -into.y } } });
  }
  if (fallback.size && laid.nodes.length + laid.edges.length <= SEARCH_UP_TO) {
    const others = laid.edges.filter((e) => !fallback.has(e.id) && !out.has(e.id));
    const routed = laneRoutes(index, forks.filter((f) => fallback.has(f.id)), {
      headOf,
      captionOf: (n) => nodeAnatomy(n, text).w,
      around: [...others.map((e) => e.points ?? []), ...out.values()],
      labels: others.flatMap((e) => (e.labelBox ? [e.labelBox] : [])),
    }, fallback);
    for (const [id, r] of routed) out.set(id, r.pts);
  }
  if (!out.size) return laid;
  const edges = laid.edges.map((e) => {
    const pts = out.get(e.id);
    if (!pts) return e;
    const { labelBox: _none, ...rest } = e;
    return { ...rest, points: pts };
  });
  const bounds = diagramBounds(laid.nodes, edges.map((e) => ({ pts: e.points ?? [] })), edges.flatMap((e) => (e.labelBox ? [e.labelBox] : []))) ?? laid.bounds;
  return { nodes: laid.nodes, edges, bounds };
}

/** Whether a run lies along any run of a route, closer than a lane, for more than a crossing. */
function alongRoute(a: Pt, b: Pt, pts: readonly Pt[]): boolean {
  const level = Math.abs(a.y - b.y) < 0.5;
  for (let i = 1; i < pts.length; i++) {
    const c = pts[i - 1], d = pts[i];
    if (level && Math.abs(c.y - d.y) < 0.5 && Math.abs(c.y - a.y) < 12 && Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) > 12) return true;
    if (!level && Math.abs(c.x - d.x) < 0.5 && Math.abs(c.x - a.x) < 12 && Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) > 12) return true;
  }
  return false;
}

/** How many times two square routes cross. */
function crossings(p: readonly Pt[], q: readonly Pt[]): number {
  let n = 0;
  for (let i = 1; i < p.length; i++) for (let j = 1; j < q.length; j++) {
    const a = p[i - 1], b = p[i], c = q[j - 1], d = q[j];
    const aLevel = Math.abs(a.y - b.y) < 0.5, cLevel = Math.abs(c.y - d.y) < 0.5;
    if (aLevel === cLevel) continue;
    const [h0, h1, v0, v1] = aLevel ? [a, b, c, d] : [c, d, a, b];
    if (v0.x > Math.min(h0.x, h1.x) + 0.5 && v0.x < Math.max(h0.x, h1.x) - 0.5 && h0.y > Math.min(v0.y, v1.y) + 0.5 && h0.y < Math.max(v0.y, v1.y) - 0.5) n++;
  }
  return n;
}

/** A label moved onto a route, if it's no longer on it: centered on the longest straight run. */
function seatLabel(pts: readonly Pt[], label: Rect): Rect {
  const mid = { x: label.x + label.w / 2, y: label.y + label.h / 2 };
  if (pts.some((p, i) => i > 0 && onRun(pts[i - 1], p, mid))) return label;
  let best = 1, len = -1;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
    if (l > len) { len = l; best = i; }
  }
  const a = pts[best - 1], b = pts[best];
  return { ...label, x: round((a.x + b.x) / 2 - label.w / 2), y: round((a.y + b.y) / 2 - label.h / 2) };
}

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

/** What ELK's answer becomes before it's drawn, the same wherever it's laid out: wrapped to fill `board` (when there's one),
 *  then the routes between ports in lanes of their own (`routePortEdges`), then the edges that fork from another's label
 *  (`routeForks`), no U-turns, room inside the outermost boxes, and the ends of different edges on a card's side a lane
 *  apart (`spreadEnds`). `useDiagramLayout` runs it on each new board size without running ELK again. */
export function finishLayout<N, E>(laid: Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'>, { board, direction, text = estimateText }: { board?: DiagramBoardSize | null; direction?: DiagramDirection; text?: TextMeasurer } = {}): Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'> {
  return spreadEnds(roomInside(noUTurns(routeForks(routePortEdges(board ? wrapDiagram(laid, board, direction) : laid, text), text), text)));
}

/**
 * An edge that goes round (out of a side that doesn't face where it goes, or into the far side of where it goes, with three
 * or more turns more than a way between facing sides would take, as ELK's back edges do, and a route kept from before a
 * card moved) routed again between facing sides, in a lane of its own with its label on its own run: kept when that's
 * fewer turns, or shorter, with its label clear. Not one another's label forks from; the four longest at most, the two
 * shortest ways between facing sides each, and nothing past `U_TURNS_UP_TO` nodes and edges (each try is a search round
 * everything: on a generated 45-state machine, all of them took 31 s).
 */
function noUTurns<N, E>(laid: Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'>, text: TextMeasurer): Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'> {
  if (laid.nodes.length + laid.edges.length > U_TURNS_UP_TO) return laid;
  const index = indexDiagram(laid.nodes);
  const forked = new Set(laid.edges.flatMap((e) => (e.forkOf ? [e.forkOf, e.id] : [])));
  const round0 = laid.edges.filter((e) => {
    const pts = e.points ?? [], a = index.byId.get(e.from), b = index.byId.get(e.to);
    if (pts.length < 2 || e.from === e.to || forked.has(e.id) || !a || !b || a.kind === 'marker' || isInside(index, a.id, b.id) || isInside(index, b.id, a.id)) return false;
    return goesRound(a, b, pts);
  });
  // Each is a search round everything, a few times over: the worst few, the longest first.
  const length = (pts: readonly Pt[]) => pts.reduce((sum, p, i) => sum + (i ? Math.abs(p.x - pts[i - 1].x) + Math.abs(p.y - pts[i - 1].y) : 0), 0);
  round0.sort((p, q) => length(q.points!) - length(p.points!)).splice(REROUTE_AT_MOST);
  if (!round0.length) return laid;
  const tops = new Map<string, number>();
  const headOf = (n: DiagramNode<N>) => { let t = tops.get(n.id); if (t === undefined) { t = nodeAnatomy(n, text).top; tops.set(n.id, t); } return t; };
  let edges = laid.edges;
  for (const e of round0) {
    const a = index.byId.get(e.from)!, b = index.byId.get(e.to)!;
    const others = edges.filter((o) => o.id !== e.id);
    const options = {
      headOf, captionOf: (n: DiagramNode<N>) => nodeAnatomy(n, text).w,
      around: others.map((o) => o.points ?? []), labels: others.flatMap((o) => (o.labelBox ? [o.labelBox] : [])),
      labelSize: (x: DiagramEdge<E>) => (x.labelBox ? { w: x.labelBox.w, h: x.labelBox.h } : edgeLabelSize(x, text)),
    };
    const span = (w: { from: ConnectorEnd; to: ConnectorEnd }) => Math.abs(w.from.p.x - w.to.p.x) + Math.abs(w.from.p.y - w.to.p.y);
    const ways = facingWays(a, b, index).sort((p, q) => span(p) - span(q)).slice(0, 2);
    if (!ways.length) continue;
    const way = cheapestWay(index, e, ways, options);
    const r = laneRoutes(index, [e], options, new Map([[e.id, way]])).get(e.id);
    if (!r || goesRound(a, b, r.pts) || (options.labelSize(e) && !r.clear) || (r.pts.length >= (e.points?.length ?? 0) && length(r.pts) >= length(e.points ?? []))) continue;
    const { labelBox: _was, ...rest } = e;
    edges = edges.map((o) => (o.id === e.id ? { ...rest, points: r.pts, ...(r.label ? { labelBox: r.label } : null) } : o));
  }
  if (edges === laid.edges) return laid;
  const bounds = diagramBounds(laid.nodes, edges.map((e) => ({ pts: e.points ?? [] })), edges.flatMap((e) => (e.labelBox ? [e.labelBox] : []))) ?? laid.bounds;
  return { nodes: laid.nodes, edges, bounds };
}

/** Which way out of a side is, by the side a point is on. */
const sideOut = (r: Rect, p: Pt): Pt => {
  const ds = [Math.abs(p.y - r.y), Math.abs(p.x - (r.x + r.w)), Math.abs(p.y - (r.y + r.h)), Math.abs(p.x - r.x)];
  return [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }][ds.indexOf(Math.min(...ds))];
};
/** Whether a side (by its way out) faces a box: the box's middle is past it. */
const faces = (from: Rect, to: Rect, n: Pt) => {
  const cx = to.x + to.w / 2, cy = to.y + to.h / 2;
  return n.x > 0 ? cx > from.x + from.w : n.x < 0 ? cx < from.x : n.y > 0 ? cy > from.y + from.h : cy < from.y;
};
/** Whether a route from `a` to `b` goes round: out of (or into) a side not facing the other, with three turns or more past
 *  the fewest a route between facing sides takes (none when they're in line, one otherwise). */
function goesRound(a: Rect, b: Rect, pts: readonly Pt[]): boolean {
  const inLine = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 16 || Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 16;
  const least = inLine ? 0 : 1;
  const away = !faces(a, b, sideOut(a, pts[0])) || !faces(b, a, sideOut(b, pts[pts.length - 1]));
  return away && pts.length - 2 >= least + 3;
}
/** The ways between the sides of `a` and `b` that face each other: out of the middle of one, into the middle of the other. */
function facingWays<N>(a: DiagramNode<N>, b: DiagramNode<N>, index: DiagramIndex<N>): { from: ConnectorEnd; to: ConnectorEnd }[] {
  const dividers = regionDividers(index);
  // Across a box's top or foot, its middle, unless that's where a divider between two of its regions meets it: then the
  // middle of the region nearest, so the line isn't read as the divider going on.
  const across = (r: DiagramNode<N>) => {
    const mid = r.x + r.w / 2;
    const regions = (index.children.get(r.id) ?? []).filter((c) => c.kind === 'region' && c.h > r.h / 3);
    const onDivider = dividers.some((d) => Math.abs(d.x1 - d.x2) < 0.5 && d.x1 > r.x && d.x1 < r.x + r.w && Math.abs(d.x1 - mid) < 16);
    if (!onDivider) return round(mid);
    const near = [...regions].sort((p, q) => Math.abs(p.x + p.w / 2 - mid) - Math.abs(q.x + q.w / 2 - mid))[0];
    // A divider deeper in (a region's own regions): a lane and a half to one side of it.
    return round(near ? near.x + near.w / 2 : mid + 24);
  };
  const sides: { n: Pt; at: (r: DiagramNode<N>) => Pt }[] = [
    { n: { x: 0, y: -1 }, at: (r) => ({ x: across(r), y: r.y }) }, { n: { x: 1, y: 0 }, at: (r) => ({ x: r.x + r.w, y: round(r.y + Math.min(r.h / 2, 24)) }) },
    { n: { x: 0, y: 1 }, at: (r) => ({ x: across(r), y: r.y + r.h }) }, { n: { x: -1, y: 0 }, at: (r) => ({ x: r.x, y: round(r.y + Math.min(r.h / 2, 24)) }) },
  ];
  const ways: { from: ConnectorEnd; to: ConnectorEnd }[] = [];
  for (const s of sides) for (const t of sides) if (faces(a, b, s.n) && faces(b, a, t.n)) ways.push({ from: { p: s.at(a), n: s.n }, to: { p: t.at(b), n: t.n } });
  return ways;
}

/**
 * The outermost boxes (a machine, a system) grown where a route or a label inside them comes closer to a wall than the air a
 * box keeps around what it holds: after wrapping, packing and routing again, a route can end up running down a wall, or a
 * label across it, and the wall moves out instead. Boxes inside others keep their size, as growing could run them into a
 * neighbour; the routers keep off their walls.
 */
function roomInside<N, E>(laid: Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'>): Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'> {
  const index = indexDiagram(laid.nodes);
  const tops = laid.nodes.filter((n) => holdsNodes(n) && !index.parent.get(n.id));
  if (!tops.length || laid.nodes.length > WRAP_UP_TO) return laid;
  const air = CONTAINER_PADDING.side;
  let nodes = laid.nodes;
  for (const box of tops) {
    const inside = new Set(descendantsOf(index, box.id));
    let x0 = box.x, x1 = box.x + box.w, y1 = box.y + box.h;
    for (const e of laid.edges) {
      if (!inside.has(e.from) || !inside.has(e.to)) continue;
      for (const p of e.points ?? []) { x0 = Math.min(x0, p.x - air); x1 = Math.max(x1, p.x + air); y1 = Math.max(y1, p.y + air); }
      const l = e.labelBox;
      if (l) { x0 = Math.min(x0, l.x - air); x1 = Math.max(x1, l.x + l.w + air); y1 = Math.max(y1, l.y + l.h + air); }
    }
    if (x0 === box.x && x1 === box.x + box.w && y1 === box.y + box.h) continue;
    const grown = { x: round(x0), y: box.y, w: round(x1 - x0), h: round(y1 - box.y) };
    // Not into another box beside it.
    if (tops.some((o) => o !== box && grown.x < o.x + o.w && o.x < grown.x + grown.w && grown.y < o.y + o.h && o.y < grown.y + grown.h)) continue;
    nodes = nodes.map((n) => (n.id === box.id ? { ...n, ...grown } : n));
  }
  if (nodes === laid.nodes) return laid;
  const bounds = diagramBounds(nodes, laid.edges.map((e) => ({ pts: e.points ?? [] })), laid.edges.flatMap((e) => (e.labelBox ? [e.labelBox] : []))) ?? laid.bounds;
  return { nodes, edges: laid.edges, bounds };
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
  const shaped = routePorts ? finishLayout(laid, options) : options.board ? wrapDiagram(laid, options.board, options.direction) : laid;
  return { ...shaped, engine: where, ms };
}


/* ── Ends kept apart ── */

/** How far apart the ends of different edges on one side of a card keep: a lane. */
const END_LANE = 12;
/** How far from a card's corner an end stays. */
const END_CORNER = 7;

/**
 * Ends of different edges that meet on one side of a card moved apart along it, a lane at least, so an arrowhead never lands
 * where another edge leaves (and two never arrive at one point): the end and the bend next to it slide along the side
 * together, keeping the route square, and a label on that run goes with them. Ends at a port (spread by the router) and a
 * box's own edges to what it holds are left alone, and a slide that would take a run through a card, or an end off its side,
 * isn't made.
 */
function spreadEnds<N, E>(laid: Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'>): Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'> {
  if (laid.nodes.length > WRAP_UP_TO) return laid;
  const index = indexDiagram(laid.nodes);
  const cards = laid.nodes.filter((n) => !holdsNodes(n) && n.kind !== 'marker');
  interface End { edge: number; start: boolean; p: Pt; along: 'x' | 'y'; node: DiagramNode<N> }
  const groups = new Map<string, End[]>();
  laid.edges.forEach((e, i) => {
    const pts = e.points;
    if (!pts || pts.length < 2 || e.from === e.to || e.route === 'curve' || e.route === 'straight') return;
    for (const start of [true, false]) {
      if ((start && (e.forkOf || e.fromPort)) || (!start && e.toPort)) continue;
      const n = index.byId.get(start ? e.from : e.to), other = index.byId.get(start ? e.to : e.from);
      if (!n || n.kind === 'marker' || !other || (holdsNodes(n) && isInside(index, other.id, n.id))) continue;
      const p = start ? pts[0] : pts[pts.length - 1];
      const side = Math.abs(p.y - n.y) < 1.5 ? 'top' : Math.abs(p.y - n.y - n.h) < 1.5 ? 'foot' : Math.abs(p.x - n.x) < 1.5 ? 'start' : Math.abs(p.x - n.x - n.w) < 1.5 ? 'end' : null;
      if (!side) continue;
      const key = `${n.id}\0${side}`;
      groups.set(key, [...(groups.get(key) ?? []), { edge: i, start, p, along: side === 'top' || side === 'foot' ? 'x' : 'y', node: n }]);
    }
  });
  let edges = laid.edges;
  const slide = (end: End, by: number): boolean => {
    const e = edges[end.edge];
    const pts = (e.points ?? []).map((q) => ({ ...q }));
    const k = end.along;
    // The end and the bend after it (or the whole run, for a straight one between two cards).
    const which = pts.length === 2 ? [0, 1] : end.start ? [0, 1] : [pts.length - 1, pts.length - 2];
    const a = pts[which[0]], b = pts[which[1]];
    if (Math.abs(a[k] - b[k]) > 0.5) return false;
    for (const j of which) pts[j] = { ...pts[j], [k]: pts[j][k] + by };
    const n = end.node;
    const lo = k === 'x' ? n.x : n.y, hi = k === 'x' ? n.x + n.w : n.y + n.h;
    if (pts[which[0]][k] < lo + END_CORNER || pts[which[0]][k] > hi - END_CORNER) return false;
    if (pts.length === 2) {
      const far = index.byId.get(end.start ? e.to : e.from)!;
      const flo = k === 'x' ? far.x : far.y, fhi = k === 'x' ? far.x + far.w : far.y + far.h;
      if (pts[which[1]][k] < flo + END_CORNER || pts[which[1]][k] > fhi - END_CORNER) return false;
    }
    const ends = new Set([e.from, e.to]);
    for (let j = 1; j < pts.length; j++) if (cards.some((c) => !ends.has(c.id) && runCrosses(pts[j - 1], pts[j], c))) return false;
    // Nor alongside another route, a lane or less from it.
    for (let j = 1; j < pts.length; j++) {
      const a = pts[j - 1], b = pts[j];
      const level = Math.abs(a.y - b.y) < 0.5;
      for (const [o, other] of edges.entries()) {
        if (o === end.edge) continue;
        const q = other.points ?? [];
        for (let m = 1; m < q.length; m++) {
          const c = q[m - 1], d = q[m];
          const along = level
            ? Math.abs(c.y - d.y) < 0.5 && Math.abs(c.y - a.y) < 10 && Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) - Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))
            : Math.abs(c.x - d.x) < 0.5 && Math.abs(c.x - a.x) < 10 && Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) - Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y));
          if (typeof along === 'number' && along > 20) return false;
        }
      }
    }
    // A label on the run that slid goes with it.
    const seg = end.start ? [pts[0], pts[1]] : [pts[pts.length - 2], pts[pts.length - 1]];
    const was = e.labelBox;
    const onIt = was && (k === 'x' ? Math.abs(was.x + was.w / 2 - (seg[0].x - by)) < 2 : Math.abs(was.y + was.h / 2 - (seg[0].y - by)) < 2);
    const labelBox = onIt ? { ...was!, [k]: was![k] + by } : was;
    edges = edges.map((x, j) => (j === end.edge ? { ...x, points: pts, ...(labelBox ? { labelBox } : null) } : x));
    end.p = pts[which[0]];
    return true;
  };
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const k = list[0].along;
    list.sort((u, v) => u.p[k] - v.p[k]);
    for (let i = 1; i < list.length; i++) {
      const u = list[i - 1], v = list[i];
      if (u.edge === v.edge) continue;
      const gap = v.p[k] - u.p[k];
      if (gap >= END_LANE) continue;
      // The later one on along, or else the earlier one back, or else each half the way (a short card's side).
      const need = END_LANE - gap;
      if (slide(v, need) || slide(u, -need)) continue;
      // Either way round: at one point, which of the two goes which way is the routes' to say.
      const before = { edges, u: u.p, v: v.p };
      for (const s of [1, -1]) {
        if (slide(v, (s * need) / 2) && slide(u, (-s * need) / 2)) break;
        edges = before.edges; u.p = before.u; v.p = before.v;
      }
    }
  }
  if (edges === laid.edges) return laid;
  const bounds = diagramBounds(laid.nodes, edges.map((e) => ({ pts: e.points ?? [] })), edges.flatMap((e) => (e.labelBox ? [e.labelBox] : []))) ?? laid.bounds;
  return { nodes: laid.nodes, edges, bounds };
}

/* ── Editing a drawing without moving what's in it ── */

/** What a card says, which its size is for: the same, and the size it was laid out at (in its measured words) still holds. */
const lookOf = (n: DiagramNode<unknown>) => JSON.stringify([n.kind ?? null, n.variant ?? null, n.title ?? null, n.icon ?? null, n.trailing ?? null, n.description ?? null, n.sections ?? null, !!n.entry, n.ports?.map((p) => p.id) ?? null]);
const labelLookOf = (e: DiagramEdge<unknown>) => JSON.stringify([e.title ?? null, e.icon ?? null, e.sections ?? null, e.forkOf ?? null]);
const sameBox = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
const meets = (p: Rect, q: Rect) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;

/**
 * A drawing changed without moving what the change didn't touch: `next` is what to draw now, its cards where they're placed
 * (a laid-out board's places, written down by its first edit), and `was` is what was drawn last. A card that says what it said
 * keeps the size it was drawn at; a new one, or one that says something else, is sized to its words. A box grows to hold
 * what's in it and never shrinks or moves (a deletion leaves the rest in place); a new one is drawn round what it holds. A
 * route whose two ends are where they were, with a label that says the same and nothing new in its way, is kept as it was;
 * any other (a new connection, one whose end moved) is routed between its cards where they are, in a lane of its own with
 * its label on its own run, clear of what's kept, out of a side that faces the other end. With nothing routed to keep (a
 * board placed by hand from the start), routes are the Diagram's own, as before.
 */
export function keepLayout<N, E>(was: { nodes: readonly DiagramNode<N>[]; edges: readonly DiagramEdge<E>[] } | null, next: { nodes: readonly DiagramNode<N>[]; edges: readonly DiagramEdge<E>[] }, { text = estimateText }: { text?: TextMeasurer } = {}): Pick<DiagramLayoutResult<N, E>, 'nodes' | 'edges' | 'bounds'> {
  const wasNodes = new Map((was?.nodes ?? []).map((n) => [n.id, n]));
  const wasEdges = new Map((was?.edges ?? []).map((e) => [e.id, e]));
  const byId = new Map<string, DiagramNode<N>>();
  const resized: string[] = [];
  for (const n of next.nodes) {
    if (holdsNodes(n) || n.kind === 'marker') { byId.set(n.id, n); continue; }
    const w0 = wasNodes.get(n.id);
    if (w0 && lookOf(w0) === lookOf(n)) byId.set(n.id, { ...n, w: w0.w, h: w0.h, ...(w0.ports ? { ports: w0.ports } : null) });
    else {
      const a = nodeAnatomy(n, text);
      byId.set(n.id, placeItemPorts({ ...n, w: a.w, h: a.h }, a, a.h));
      if (w0 && w0.x === n.x && w0.y === n.y && (a.w > w0.w + 0.5 || a.h > w0.h + 0.5)) resized.push(n.id);
    }
  }
  // A card that says more than it did (a longer name) grows the way there's room: from where it starts, else from where it
  // ends, else about its middle; with none, it goes to the nearest free room itself. Nothing else moves for it.
  for (const id of resized) {
    const n = byId.get(id)!, w0 = wasNodes.get(id)!;
    const index1 = indexDiagram([...byId.values()]);
    const others = [...byId.values()].filter((o) => o.id !== id && o.kind !== 'marker' && !(holdsNodes(o) && isInside(index1, id, o.id)));
    const blocked = (r: Rect) => others.some((o) => meets({ x: r.x - 16, y: r.y - 16, w: r.w + 32, h: r.h + 32 }, o))
      || ancestorsOf(index1, id).some((b) => { const box = byId.get(b)!; return meets(r, { x: box.x, y: box.y, w: box.w, h: Math.min(box.h, nodeAnatomy(box, text).top) }); });
    const tries = [{ x: n.x, y: n.y }, { x: w0.x + w0.w - n.w, y: n.y }, { x: w0.x + (w0.w - n.w) / 2, y: n.y }];
    const fit = tries.find((p) => !blocked({ ...n, ...p }));
    const at = fit ?? freePlace({ nodes: [...byId.values()].filter((o) => o.id !== id), edges: (was?.edges ?? []) as DiagramEdge<E>[] }, n, { parent: n.parent ?? null, near: null, center: { x: w0.x + w0.w / 2, y: w0.y + w0.h / 2 }, text });
    if (at.x !== n.x || at.y !== n.y) byId.set(id, { ...n, x: round(at.x), y: round(at.y) });
  }
  // Boxes, innermost first, each round what it holds now, and never less than it was.
  const index0 = indexDiagram([...byId.values()]);
  const boxes = [...byId.values()].filter(holdsNodes).sort((a, b) => (index0.depth.get(b.id) ?? 0) - (index0.depth.get(a.id) ?? 0));
  const P = CONTAINER_PADDING;
  for (const b of boxes) {
    const kids = (index0.children.get(b.id) ?? []).map((k) => byId.get(k.id)!);
    const a = nodeAnatomy(b, text);
    // Room under its sections for the labels of its own edges into what it holds.
    const own = Math.max(0, ...next.edges.filter((e) => e.from === b.id && isInside(index0, e.to, b.id)).map((e) => edgeLabelSize(e, text)?.h ?? 0));
    const room = own ? own + ELBOW_GAP + 12 : 0;
    const w0 = wasNodes.get(b.id);
    let r: Rect = w0 && w0.w > 0 && w0.h > 0 ? { x: w0.x, y: w0.y, w: w0.w, h: w0.h } : { x: b.x, y: b.y, w: Math.max(b.w, a.w), h: Math.max(b.h, a.h) };
    if (kids.length) {
      const rs = kids.flatMap((k) => [k as Rect, ...(k.entry ? [{ x: k.x - 22, y: k.y - 16, w: 22, h: 16 }] : [])]);
      const kx0 = Math.min(...rs.map((q) => q.x)), ky0 = Math.min(...rs.map((q) => q.y));
      const kx1 = Math.max(...rs.map((q) => q.x + q.w)), ky1 = Math.max(...rs.map((q) => q.y + q.h));
      if (!w0) {
        // New: round what it holds, as a placed board's boxes are.
        r = { x: kx0 - P.side, y: ky0 - a.top - P.top - room, w: Math.max(a.w, kx1 - kx0 + P.side * 2), h: ky1 - ky0 + a.top + P.top + room + P.bottom };
      } else {
        // Grown only where what it holds is past its walls (its start, its header, its end, its foot), never moved.
        const x0 = Math.min(r.x, kx0 - P.side), x1 = Math.max(r.x + r.w, kx1 + P.side), y1 = Math.max(r.y + r.h, ky1 + P.bottom);
        const y0 = ky0 < r.y + a.top + 8 ? Math.min(r.y, ky0 - a.top - P.top - room) : r.y;
        r = { x: x0, y: y0, w: Math.max(a.w, x1 - x0), h: y1 - y0 };
      }
    }
    byId.set(b.id, placeItemPorts({ ...b, ...r, ...(w0?.ports && lookOf(w0) === lookOf(b) ? { ports: w0.ports } : null) }, a, r.h));
  }
  const nodes = next.nodes.map((n) => byId.get(n.id)!);
  const index = indexDiagram(nodes);
  // What's new or has moved, which a kept route mustn't now run through.
  const moved = nodes.filter((n) => n.kind !== 'marker' && !(wasNodes.has(n.id) && sameBox(wasNodes.get(n.id)!, n)));
  const changed = moved.filter((n) => !holdsNodes(n));
  const changedIds = new Set(moved.map((n) => n.id));
  const kept: DiagramEdge<E>[] = [];
  const todo: DiagramEdge<E>[] = [];
  for (const e of next.edges) {
    const w0 = wasEdges.get(e.id);
    const pts = w0?.points;
    const keep = !!w0 && !!pts && pts.length >= 2 && w0.from === e.from && w0.to === e.to && (w0.fromPort ?? null) === (e.fromPort ?? null) && (w0.toPort ?? null) === (e.toPort ?? null)
      && !changedIds.has(e.from) && !changedIds.has(e.to) && labelLookOf(w0) === labelLookOf(e)
      && !changed.some((c) => pts.some((p, i) => i > 0 && runCrosses(pts[i - 1], p, c)) || (!!w0.labelBox && meets(w0.labelBox, c)));
    if (keep) kept.push({ ...e, points: pts, ...(w0.labelBox ? { labelBox: w0.labelBox } : null) });
    else { const { points: _p, labelBox: _l, ...rest } = e; todo.push(rest as DiagramEdge<E>); }
  }
  const routed = new Map<string, DiagramEdge<E>>(kept.map((e) => [e.id, e]));
  // Routed only where there were routes to keep: a board placed by hand is routed by the Diagram, all of it, as before.
  if (was?.edges.some((e) => (e.points?.length ?? 0) >= 2) && nodes.length + next.edges.length <= SEARCH_UP_TO * 2) {
    const tops = new Map<string, number>();
    const headOf = (n: DiagramNode<N>) => { let t = tops.get(n.id); if (t === undefined) { t = nodeAnatomy(n, text).top; tops.set(n.id, t); } return t; };
    for (const e of todo) {
      const a = index.byId.get(e.from), b = index.byId.get(e.to);
      // A loop, a box's own edge to what it holds and an edge that forks from another's label are the Diagram's to draw.
      if (!a || !b || a === b || e.forkOf || isInside(index, a.id, b.id) || isInside(index, b.id, a.id)) continue;
      const others = [...routed.values()];
      const options = {
        headOf, captionOf: (n: DiagramNode<N>) => nodeAnatomy(n, text).w,
        around: others.map((o) => o.points ?? []), labels: others.flatMap((o) => (o.labelBox ? [o.labelBox] : [])),
        labelSize: (x: DiagramEdge<E>) => edgeLabelSize(x, text),
      };
      // Out of the middle of each side that faces the other end, a lane along from any end already there.
      const taken = others.flatMap((o) => (o.points?.length ? [o.points[0], o.points[o.points.length - 1]] : []));
      const ways = facingWays(a, b, index).map((w) => ({ from: clearEnd(w.from, a, taken), to: clearEnd(w.to, b, taken) }));
      if (!ways.length) continue;
      const way = cheapestWay(index, e, ways, options);
      const r = laneRoutes(index, [e], options, new Map([[e.id, way]])).get(e.id);
      if (r) routed.set(e.id, { ...e, points: r.pts, ...(r.label ? { labelBox: r.label } : null) });
    }
  }
  const edges = next.edges.map((e) => routed.get(e.id) ?? todo.find((t) => t.id === e.id) ?? e);
  const grown = roomInside({ nodes, edges, bounds: { x: 0, y: 0, w: 0, h: 0 } });
  const bounds = diagramBounds(grown.nodes, edges.map((e) => ({ pts: e.points ?? [] })), edges.flatMap((e) => (e.labelBox ? [e.labelBox] : []))) ?? { x: 0, y: 0, w: 0, h: 0 };
  return { nodes: grown.nodes, edges, bounds };
}

/** An end on a card's side moved along it, a lane at a time, until it's two lanes from every end already there (and off the
 *  card's corners). */
function clearEnd(end: ConnectorEnd, card: Rect, taken: readonly Pt[]): ConnectorEnd {
  const n = end.n;
  if (!n) return end;
  const k = n.x !== 0 ? 'y' : 'x';
  const lo = (k === 'x' ? card.x : card.y) + 12, hi = (k === 'x' ? card.x + card.w : card.y + card.h) - 12;
  // Two lanes from what's there: an arrowhead's width and a lane between.
  const free = (v: number) => !taken.some((p) => Math.abs((k === 'x' ? p.y : p.x) - (k === 'x' ? end.p.y : end.p.x)) < 1.5 && Math.abs(p[k] - v) < END_LANE * 2);
  for (let i = 0; i <= 12; i++) for (const s of i ? [1, -1] : [1]) {
    const v = end.p[k] + s * i * END_LANE;
    if (v >= lo && v <= hi && free(v)) return { ...end, p: { ...end.p, [k]: round(v) } };
  }
  return end;
}

/**
 * Where a new card of `size` goes on a drawing without moving anything: in free room, next to `near` (a card's id) when
 * there's one, else nearest `center` (the middle of the view): never on a card, a label, an entry marker, or the header and
 * sections of the box it goes in (`parent`, default the drawing's root), nor in a box it isn't in, and a lane's room from all
 * of them; clear of routes where it can be. Within the box's start and top, so the box grows only on its end side and foot.
 */
export function freePlace<N, E>(drawn: { nodes: readonly DiagramNode<N>[]; edges: readonly DiagramEdge<E>[] }, size: { w: number; h: number }, { parent, near, center, text = estimateText }: { parent?: string | null; near?: string | null; center?: Pt | null; text?: TextMeasurer } = {}): Pt {
  const index = indexDiagram(drawn.nodes);
  const box = parent ? index.byId.get(parent) : drawn.nodes.find((n) => n.kind === 'root' && !index.parent.get(n.id));
  const GAP = 40, HALF = 20;
  const grow = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });
  const hard: Rect[] = [];
  for (const n of drawn.nodes) {
    if (n.kind === 'marker') continue;
    if (holdsNodes(n)) {
      if (n.kind === 'region') continue;
      const mine = box && (n.id === box.id || isInside(index, box.id, n.id));
      hard.push(mine ? grow({ x: n.x, y: n.y, w: n.w, h: Math.min(n.h, nodeAnatomy(n, text).top) }, HALF) : grow(n, GAP));
    } else hard.push(grow(n, GAP));
    if (n.entry) hard.push(grow({ x: n.x - 22, y: n.y - 16, w: 22, h: 34 }, 8));
  }
  for (const e of drawn.edges) if (e.labelBox) hard.push(grow(e.labelBox, HALF));
  const soft: Rect[] = drawn.edges.flatMap((e) => (e.points ?? []).slice(1).map((b, i) => {
    const a = e.points![i];
    return grow({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }, 12);
  }));
  const top = box ? box.y + Math.min(box.h, nodeAnatomy(box, text).top) + CONTAINER_PADDING.top + HALF : -Infinity;
  const start = box ? box.x + CONTAINER_PADDING.side + HALF : -Infinity;
  const fits = (r: Rect, withRoutes: boolean) => r.x >= start && r.y >= top && !hard.some((h) => meets(r, h)) && (!withRoutes || !soft.some((s) => meets(r, s)));
  const at = (x: number, y: number): Rect => ({ x: round(x), y: round(y), w: size.w, h: size.h });
  const by = near ? index.byId.get(near) : undefined;
  // Beside what it's for: its end side, its foot, its start side, its top.
  if (by) {
    const slots = [at(by.x + by.w + GAP, by.y), at(by.x, by.y + by.h + GAP), at(by.x - GAP - size.w, by.y), at(by.x, by.y - GAP - size.h)];
    for (const withRoutes of [true, false]) for (const s of slots) if (fits(s, withRoutes)) return { x: s.x, y: s.y };
  }
  // Else the nearest free room, ring by ring.
  const c = by ? { x: by.x + by.w / 2, y: by.y + by.h / 2 } : center ?? (box ? { x: box.x + box.w / 2, y: box.y + box.h / 2 } : { x: 0, y: 0 });
  const STEP = 16;
  for (const withRoutes of [true, false]) {
    for (let ring = 0; ring <= 250; ring++) {
      const found: Rect[] = [];
      for (let i = -ring; i <= ring; i++) for (const [dx, dy] of [[i, -ring], [i, ring], [-ring, i], [ring, i]] as const) {
        if (ring && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const r = at(c.x - size.w / 2 + dx * STEP, c.y - size.h / 2 + dy * STEP);
        if (fits(r, withRoutes)) found.push(r);
      }
      if (found.length) {
        found.sort((p, q) => Math.hypot(p.x + p.w / 2 - c.x, p.y + p.h / 2 - c.y) - Math.hypot(q.x + q.w / 2 - c.x, q.y + q.h / 2 - c.y));
        return { x: found[0].x, y: found[0].y };
      }
    }
  }
  // Nowhere near: past the end of everything.
  const right = Math.max(...drawn.nodes.map((n) => n.x + n.w), 0);
  return { x: round(right + GAP), y: round(Math.max(top, box?.y ?? 0)) };
}
