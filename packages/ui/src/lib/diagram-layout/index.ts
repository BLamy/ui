/* ══ Diagram layout — where nodes go, by ELK ══
   `elk.algorithm: layered` with `elk.hierarchyHandling: INCLUDE_CHILDREN` places nodes, groups and the routes between
   them, and with nothing inside anything, `SEPARATE_CHILDREN` packs what isn't connected into rows. In a browser it runs in a Web Worker: on the main thread, 2,000 nodes stop the page for about 5 s. On a server it
   runs in the process.

   ELK is an optional peer, as it's 442 KB gzipped and licensed EPL-2.0 OR GPL-3.0-or-later, so it's only imported here, when
   a layout's first asked for, and an app with fixed positions never loads it. Nothing at module scope touches a browser
   API, so this is safe to import on a server. `lib/diagram-layout/react` has the hook. */
import type { Pt, Rect } from '@/lib/canvas-math';
import { CONTAINER_PADDING, diagramBounds, edgeLabelSize, hasEdgeLabel, holdsNodes, indexDiagram, nodeAnatomy, placeItemPorts, type DiagramEdge, type DiagramNode, type DiagramSide } from '@/lib/diagram-model';
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

interface ElkLabel { text?: string; x?: number; y?: number; width?: number; height?: number; layoutOptions?: Record<string, string> }
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
/** A region has no border of its own, and the padding of the group it's a lane of is already around it. */
const REGION_PADDING = { side: 12, bottom: 12, top: 8 };
/** A group of regions keeps little air: each region has its own. */
const LANES_PADDING = { side: 8, bottom: 8, top: 8 };

const SIDE: Record<DiagramSide, string> = { top: 'NORTH', right: 'EAST', bottom: 'SOUTH', left: 'WEST' };

/** The room between things, per density: between layers, between nodes in a layer, between edges and around them. */
const SPACING: Record<DiagramLayoutDensity, { layers: number; nodes: number; edges: number; edgeNode: number }> = {
  compact: { layers: 36, nodes: 24, edges: 8, edgeNode: 12 },
  default: { layers: 44, nodes: 40, edges: 14, edgeNode: 18 },
  comfortable: { layers: 64, nodes: 56, edges: 18, edgeNode: 24 },
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
    'elk.spacing.portPort': '8',
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
  for (const n0 of placed) {
    const el: ElkGraph = { id: n0.id };
    const hasChildren = !!index.children.get(n0.id)?.length;
    const anatomy = nodeAnatomy(n0, text);
    const holds = hasChildren || holdsNodes(n0);
    // A port an item names sits on the item's row, which is known once the card's measured.
    const n = holds ? n0 : placeItemPorts(n0, anatomy, n0.h || anatomy.h);
    if (holds) {
      el.children = [];
      // Room for the header and the sections, then air around what it holds. A group of regions keeps less: each region
      // has its own.
      const air = n.kind === 'region' ? REGION_PADDING : index.children.get(n.id)?.some((c) => c.kind === 'region') ? LANES_PADDING : CONTAINER_PADDING;
      el.layoutOptions = {
        'elk.padding': padding({ ...air, top: Math.ceil(anatomy.top) + air.top }),
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${n.w || anatomy.w}, ${n.h || anatomy.h})`,
      };
    } else {
      el.width = n.w || anatomy.w;
      el.height = n.h || anatomy.h;
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
  const root: ElkGraph = {
    id: ROOT,
    // Laying out what's inside something takes everything at once. With nothing inside anything, ELK can treat what isn't connected
    // apart, and pack it into rows, where otherwise it's all one long column.
    layoutOptions: { ...diagramElkOptions(options.density), ...(placed.some((n) => index.parent.get(n.id)) ? null : { 'elk.hierarchyHandling': 'SEPARATE_CHILDREN' }), ...(options.direction ? { 'elk.direction': options.direction.toUpperCase() } : null), ...options.elk },
    children: [],
    edges: [],
  };
  for (const n of placed) {
    const p = index.parent.get(n.id);
    (p ? elements.get(p)! : root).children!.push(elements.get(n.id)!);
  }
  // A self-loop goes out to a stand-in the size of its label, placed one layer on in the same parent, right after its node
  // in the order, and comes back from it (drawn by `fromElkGraph`): a loop below the node (beside it, across), with its
  // label on it, in room ELK has kept.
  for (const e of draft.edges ?? []) {
    if (e.from !== e.to || !index.byId.has(e.from)) continue;
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
  for (const n of dedupe(draft.nodes)) {
    const box = boxes.get(n.id);
    if (!box) continue;
    // A port ELK chose the place of is drawn there.
    const ports = n.ports?.map((p) => {
      const got = placed.get(n.id)?.ports?.find((q) => q.id === portId(n.id, p.id));
      if (p.at !== undefined || got?.x === undefined || got.y === undefined) return p;
      const at = p.side === 'left' || p.side === 'right' ? got.y / (box.h || 1) : got.x / (box.w || 1);
      return { ...p, at: round(at) };
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
    const route = routes.get(e.id);
    if (!route) continue;
    const stand = e.from === e.to ? boxes.get(loopId(e.id)) : undefined;
    const node = stand ? boxes.get(e.from) : undefined;
    const at = origin.get(route.container ?? ROOT) ?? { x: 0, y: 0 };
    const move = (p: Pt): Pt => ({ x: round(p.x + at.x), y: round(p.y + at.y) });
    const points: Pt[] = [];
    for (const s of route.sections ?? []) {
      points.push(move(s.startPoint));
      for (const b of s.bendPoints ?? []) points.push(move(b));
      points.push(move(s.endPoint));
    }
    const { labelBox: _stale, ...rest } = e;
    if (stand && node && points.length) {
      // Out to the label, and back from its side to the node.
      edges.push({ ...rest, points: loopRoute(node, stand, direction), ...(hasEdgeLabel(e) ? { labelBox: stand } : null) });
      continue;
    }
    const l = route.labels?.[0];
    edges.push({
      ...rest,
      points,
      ...(l && l.x != null && l.y != null ? { labelBox: { x: round(l.x + at.x), y: round(l.y + at.y), w: l.width ?? 0, h: l.height ?? 0 } } : null),
    });
  }
  const bounds = diagramBounds(nodes, edges.map((e) => ({ pts: e.points ?? [] })), edges.flatMap((e) => (e.labelBox ? [e.labelBox] : []))) ?? { x: 0, y: 0, w: 0, h: 0 };
  return { nodes, edges, bounds };
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

/** One layout, on an engine that outlives it. */
export async function runLayout<N, E>(draft: DiagramDraft<N, E>, options: DiagramLayoutOptions, engine: DiagramLayoutEngine, graph = toElkGraph(draft, options)): Promise<DiagramLayoutResult<N, E>> {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const { graph: out, engine: where } = await engine.run(graph, options.signal);
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
  return { ...fromElkGraph(draft, out), engine: where, ms };
}

