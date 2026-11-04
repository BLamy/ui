/* ══ Diagram layout — where nodes go, by ELK ══
   `elk.algorithm: layered` with `elk.hierarchyHandling: INCLUDE_CHILDREN` places nodes, compounds and the routes between
   them. In a browser it runs in a Web Worker: on the main thread, 2,000 nodes stop the page for about 5 s. On a server it
   runs in the process.

   ELK is an optional peer, as it's 442 KB gzipped and licensed EPL-2.0 OR GPL-3.0-or-later, so it's only imported here, when
   a layout's first asked for, and an app with fixed positions never loads it. Nothing at module scope touches a browser
   API, so this is safe to import on a server. `lib/diagram-layout/react` has the hook. */
import type { Pt, Rect } from '@/lib/canvas-math';
import { diagramBounds, indexDiagram, nodeTextSize, type DiagramEdge, type DiagramNode, type DiagramSide } from '@/lib/diagram-model';
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

export interface DiagramLayoutOptions {
  /** Which way the layers run (default `RIGHT`). */
  direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
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

interface ElkLabel { text?: string; x?: number; y?: number; width?: number; height?: number }
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
/** Room for a title along the top of what holds other nodes. */
const COMPOUND_PADDING = '[top=32,left=16,bottom=16,right=16]';
/** A region has no border of its own, and its parallel state's padding is already around it. */
const REGION_PADDING = '[top=30,left=12,bottom=12,right=12]';
const PARALLEL_PADDING = '[top=28,left=8,bottom=8,right=8]';

const SIDE: Record<DiagramSide, string> = { t: 'NORTH', r: 'EAST', b: 'SOUTH', l: 'WEST' };

/** What these defaults are for: readable statecharts. They come from the Cloudflare diagrams spike. */
export const DIAGRAM_ELK_OPTIONS: Readonly<Record<string, string>> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.spacing.nodeNodeBetweenLayers': '36',
  'elk.spacing.nodeNode': '24',
  'elk.spacing.edgeLabel': '4',
  'elk.edgeLabels.inline': 'false',
  'elk.layered.edgeLabels.sideSelection': 'ALWAYS_UP',
  'elk.layered.mergeEdges': 'false',
  'elk.padding': COMPOUND_PADDING,
};

const portId = (node: string, port: string) => `${node}\0${port}`;

const holdsOthers = (n: { kind?: string }) => n.kind === 'compound' || n.kind === 'parallel' || n.kind === 'region' || n.kind === 'root';

/** A graph for ELK: nodes nested as their parents say, sized to their words, with every edge on the root, which is what
 *  `INCLUDE_CHILDREN` wants. Edges with a missing end are left out, and duplicate ids count once. */
export function toElkGraph<N, E>(draft: DiagramDraft<N, E>, options: Pick<DiagramLayoutOptions, 'direction' | 'elk' | 'text'> = {}): ElkGraph {
  const text = options.text ?? estimateText;
  const placed = dedupe(draft.nodes).map((n) => ({ ...n, x: n.x ?? 0, y: n.y ?? 0, w: n.w ?? 0, h: n.h ?? 0 })) as DiagramNode<N>[];
  const index = indexDiagram(placed);
  const elements = new Map<string, ElkGraph>();
  for (const n of placed) {
    const el: ElkGraph = { id: n.id };
    const hasChildren = !!index.children.get(n.id)?.length;
    const size = nodeTextSize(n, text);
    if (hasChildren || holdsOthers(n)) {
      el.children = [];
      el.layoutOptions = {
        'elk.padding': n.kind === 'region' ? REGION_PADDING : n.kind === 'parallel' ? PARALLEL_PADDING : COMPOUND_PADDING,
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${n.w || size.w}, ${n.h || size.h})`,
      };
    } else {
      el.width = n.w || size.w;
      el.height = n.h || size.h;
    }
    if (n.ports?.length) {
      // A node's size is known here, so its ports can stay where they're drawn, with routes ending at them. One that holds
      // others is only as big as ELK makes it, so ELK says where they went, and `fromElkGraph` reads that back.
      const known = el.width !== undefined && el.height !== undefined;
      el.layoutOptions = { ...el.layoutOptions, 'elk.portConstraints': known ? 'FIXED_POS' : 'FIXED_SIDE' };
      el.ports = n.ports.map((p) => {
        const at = p.at ?? 0.5;
        const place = !known ? null : p.side === 'l' ? { x: 0, y: at * el.height! } : p.side === 'r' ? { x: el.width!, y: at * el.height! } : p.side === 't' ? { x: at * el.width!, y: 0 } : { x: at * el.width!, y: el.height! };
        return { id: portId(n.id, p.id), width: 0, height: 0, ...place, layoutOptions: { 'elk.port.side': SIDE[p.side] } };
      });
    }
    elements.set(n.id, el);
  }
  const root: ElkGraph = {
    id: ROOT,
    layoutOptions: { ...DIAGRAM_ELK_OPTIONS, ...(options.direction ? { 'elk.direction': options.direction } : null), ...options.elk },
    children: [],
    edges: [],
  };
  for (const n of placed) {
    const p = index.parent.get(n.id);
    (p ? elements.get(p)! : root).children!.push(elements.get(n.id)!);
  }
  const hasPort = (node: DiagramNode<N> | undefined, id?: string) => !!id && !!node?.ports?.some((p) => p.id === id);
  for (const e of draft.edges ?? []) {
    const a = index.byId.get(e.from), b = index.byId.get(e.to);
    if (!a || !b) continue;
    const el: ElkEdge = {
      id: e.id,
      sources: [hasPort(a, e.fromPort) ? portId(e.from, e.fromPort!) : e.from],
      targets: [hasPort(b, e.toPort) ? portId(e.to, e.toPort!) : e.to],
    };
    if (e.label) {
      const size = text(e.label, 'edge');
      el.labels = [{ text: e.label, width: size.w, height: size.h }];
    }
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
 *  parallel state's width, or height if they're side by side, which ELK doesn't do, so that dividers and titles line up. */
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
      const at = p.side === 'l' || p.side === 'r' ? got.y / (box.h || 1) : got.x / (box.w || 1);
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
  for (const e of draft.edges ?? []) {
    const route = routes.get(e.id);
    if (!route) continue;
    const at = origin.get(route.container ?? ROOT) ?? { x: 0, y: 0 };
    const move = (p: Pt): Pt => ({ x: round(p.x + at.x), y: round(p.y + at.y) });
    const points: Pt[] = [];
    for (const s of route.sections ?? []) {
      points.push(move(s.startPoint));
      for (const b of s.bendPoints ?? []) points.push(move(b));
      points.push(move(s.endPoint));
    }
    const { labelBox: _stale, ...rest } = e;
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
    for (const i of list) {
      const r = nodes[i];
      nodes[i] = across >= down ? { ...r, x: round(p.x + pad), w: round(p.w - pad * 2) } : { ...r, y: round(p.y + 28), h: round(p.h - 28 - pad) };
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

