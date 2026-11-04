import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIAGRAM_ELK_OPTIONS, DiagramLayoutError, createDiagramLayoutEngine, fromElkGraph, layoutDiagram, toElkGraph, type DiagramDraft, type ElkGraph } from '@/lib/diagram-layout';
import type { DiagramNode } from '@/lib/diagram-model';

const text = (t: string) => ({ w: t.length * 10, h: 15 });
const inside = (a: DiagramNode, b: DiagramNode) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w + 0.01 && a.y + a.h <= b.y + b.h + 0.01;
const overlap = (a: DiagramNode, b: DiagramNode) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('toElkGraph', () => {
  it('asks for layered layout, with hierarchy, and takes your options over its own', () => {
    const g = toElkGraph({ nodes: [] });
    expect(g.layoutOptions!['elk.algorithm']).toBe('layered');
    expect(g.layoutOptions!['elk.hierarchyHandling']).toBe('INCLUDE_CHILDREN');
    expect(g.layoutOptions!['elk.direction']).toBe('RIGHT');
    expect(toElkGraph({ nodes: [] }, { direction: 'DOWN' }).layoutOptions!['elk.direction']).toBe('DOWN');
    expect(toElkGraph({ nodes: [] }, { direction: 'DOWN', elk: { 'elk.direction': 'LEFT', 'elk.foo': 'bar' } }).layoutOptions).toMatchObject({ 'elk.direction': 'LEFT', 'elk.foo': 'bar' });
    expect(Object.keys(DIAGRAM_ELK_OPTIONS)).toContain('elk.edgeRouting');
  });

  it('nests nodes under their parents, however they were listed, with every edge on the root', () => {
    const g = toElkGraph({
      nodes: [{ id: 'kid', parent: 'box', label: 'abc' }, { id: 'box', kind: 'compound', label: 'hello' }, { id: 'free', label: 'x' }],
      edges: [{ id: 'e', from: 'kid', to: 'free', label: 'GO' }],
    }, { text });
    expect(g.children!.map((c) => c.id)).toEqual(['box', 'free']);
    const box = g.children![0];
    expect(box.children!.map((c) => c.id)).toEqual(['kid']);
    expect(box.width).toBeUndefined();
    expect(box.layoutOptions!['elk.nodeSize.constraints']).toBe('MINIMUM_SIZE');
    // The least a compound can be is its title, and its padding.
    expect(box.layoutOptions!['elk.nodeSize.minimum']).toBe('(74, 31)');
    expect(g.edges![0]).toEqual({ id: 'e', sources: ['kid'], targets: ['free'], labels: [{ text: 'GO', width: 20, height: 15 }] });
  });

  it('sizes leaves to their words, and keeps a size it was given', () => {
    const g = toElkGraph({ nodes: [{ id: 'a', label: 'x'.repeat(20) }, { id: 'b', label: 'x'.repeat(20), w: 50, h: 60 }, { id: 'i', kind: 'initial' }] }, { text });
    expect(g.children![0]).toMatchObject({ width: 226, height: 34 });
    expect(g.children![1]).toMatchObject({ width: 50, height: 60 });
    expect(g.children![2]).toMatchObject({ width: 12, height: 12 });
  });

  it('leaves out edges with a missing end, takes a duplicate id once, and survives a loop of parents', () => {
    const g = toElkGraph({
      nodes: [{ id: 'a' }, { id: 'a' }, { id: 'x', parent: 'y' }, { id: 'y', parent: 'x' }],
      edges: [{ id: 'gone', from: 'a', to: 'nope' }, { id: 'ok', from: 'a', to: 'x' }],
    });
    expect(g.children!.map((c) => c.id).sort()).toEqual(['a', 'x', 'y']);
    expect(g.edges!.map((e) => e.id)).toEqual(['ok']);
  });

  it('puts a node’s ports where they’re drawn, and leaves those of what holds others for ELK to place', () => {
    const fixed = toElkGraph({ nodes: [{ id: 'a', w: 100, h: 50, ports: [
      { id: 'l', side: 'l', at: 0.2 }, { id: 'r', side: 'r', at: 0.8 }, { id: 't', side: 't', at: 0.25 }, { id: 'b', side: 'b' },
    ] }] });
    const node = fixed.children![0];
    expect(node.layoutOptions!['elk.portConstraints']).toBe('FIXED_POS');
    expect(node.ports!.map((p) => [p.x, p.y])).toEqual([[0, 10], [100, 40], [25, 0], [50, 50]]);
    const holding = toElkGraph({ nodes: [{ id: 'c', kind: 'compound', ports: [{ id: 'in', side: 'l' }] }, { id: 'kid', parent: 'c' }] });
    const compound = holding.children![0];
    expect(compound.layoutOptions!['elk.portConstraints']).toBe('FIXED_SIDE');
    expect(compound.ports![0].x).toBeUndefined();
  });

  it('reads back where ELK put a port it was left to place, and leaves one that had a place alone', () => {
    const draft = { nodes: [
      { id: 'c', kind: 'compound' as const, ports: [{ id: 'in', side: 'l' as const }, { id: 'out', side: 'r' as const, at: 0.25 }] },
      { id: 'kid', parent: 'c' },
    ] };
    const graph = toElkGraph(draft);
    const out = JSON.parse(JSON.stringify(graph));
    out.children[0] = { ...out.children[0], x: 0, y: 0, width: 200, height: 100, children: [{ ...out.children[0].children[0], x: 10, y: 10, width: 50, height: 20 }] };
    out.children[0].ports[0] = { ...out.children[0].ports[0], x: 0, y: 40 };
    const { nodes } = fromElkGraph(draft, out);
    expect(nodes.find((n) => n.id === 'c')!.ports).toEqual([{ id: 'in', side: 'l', at: 0.4 }, { id: 'out', side: 'r', at: 0.25 }]);
  });

  it('passes ports on, by side', () => {
    const g = toElkGraph({
      nodes: [{ id: 'a', ports: [{ id: 'out', side: 'r' }, { id: 'up', side: 't' }] }, { id: 'b', ports: [{ id: 'in', side: 'l' }] }],
      edges: [{ id: 'e', from: 'a', fromPort: 'out', to: 'b', toPort: 'in' }, { id: 'f', from: 'a', fromPort: 'nope', to: 'b' }],
    });
    const a = g.children![0];
    expect(a.ports!.map((p) => p.layoutOptions!['elk.port.side'])).toEqual(['EAST', 'NORTH']);
    expect(g.edges![0].sources[0]).toBe(a.ports![0].id);
    expect(g.edges![0].targets[0]).toBe(g.children![1].ports![0].id);
    // A port that doesn't exist falls back to the node.
    expect(g.edges![1].sources).toEqual(['a']);
  });
});

describe('fromElkGraph', () => {
  const draft: DiagramDraft = {
    nodes: [{ id: 'kid', parent: 'box', label: 'k', data: { keep: true } }, { id: 'box', kind: 'compound', label: 'b' }],
    edges: [{ id: 'e', from: 'box', to: 'kid', label: 'GO', labelBox: { x: 1, y: 2, w: 3, h: 4 }, kind: 'event' }, { id: 'lost', from: 'box', to: 'gone' }],
  };
  const out: ElkGraph = {
    id: '__root',
    children: [{ id: 'box', x: 100, y: 50, width: 300, height: 200, children: [{ id: 'kid', x: 10, y: 20, width: 80, height: 34 }] }],
    edges: [{ id: 'e', container: 'box', sources: ['box'], targets: ['kid'], labels: [{ x: 5, y: 6, width: 30, height: 11 }], sections: [{ startPoint: { x: 0, y: 30 }, bendPoints: [{ x: 5, y: 30 }], endPoint: { x: 10, y: 30 } }] }],
  };

  it('makes everything absolute, in the order it was given, and keeps what ELK didn’t touch', () => {
    const { nodes, edges, bounds } = fromElkGraph(draft, out);
    expect(nodes.map((n) => n.id)).toEqual(['kid', 'box']);
    expect(nodes[0]).toMatchObject({ x: 110, y: 70, w: 80, h: 34, label: 'k', data: { keep: true }, parent: 'box' });
    expect(nodes[1]).toMatchObject({ x: 100, y: 50, w: 300, h: 200 });
    expect(edges.map((e) => e.id)).toEqual(['e']);
    expect(edges[0].kind).toBe('event');
    // In the frame of its container, which here is the box.
    expect(edges[0].points).toEqual([{ x: 100, y: 80 }, { x: 105, y: 80 }, { x: 110, y: 80 }]);
    expect(edges[0].labelBox).toEqual({ x: 105, y: 56, w: 30, h: 11 });
    expect(bounds).toEqual({ x: 100, y: 50, w: 300, h: 200 });
  });

  it('drops a label position ELK has no answer for, rather than keeping a stale one', () => {
    const quiet: ElkGraph = { ...out, edges: [{ ...out.edges![0], labels: undefined }] };
    expect(fromElkGraph(draft, quiet).edges[0].labelBox).toBeUndefined();
  });

  it('stretches regions to their parallel state, so titles and dividers line up', () => {
    const d: DiagramDraft = { nodes: [{ id: 'p', kind: 'parallel' }, { id: 'a', kind: 'region', parent: 'p' }, { id: 'b', kind: 'region', parent: 'p' }] };
    const elk: ElkGraph = { id: '__root', children: [{ id: 'p', x: 0, y: 0, width: 400, height: 300, children: [{ id: 'a', x: 40, y: 30, width: 200, height: 100 }, { id: 'b', x: 80, y: 150, width: 100, height: 100 }] }] };
    const { nodes } = fromElkGraph(d, elk);
    expect(nodes[1]).toMatchObject({ x: 8, w: 384, y: 30, h: 100 });
    expect(nodes[2]).toMatchObject({ x: 8, w: 384, y: 150, h: 100 });
  });
});

const MACHINE: DiagramDraft = {
  nodes: [
    { id: 'root', kind: 'root', label: 'upload' },
    { id: 'i0', kind: 'initial', parent: 'root' },
    { id: 'worker', kind: 'compound', parent: 'root', label: 'worker' },
    { id: 'i1', kind: 'initial', parent: 'worker' },
    { id: 'auth', parent: 'worker', label: 'authenticating', detail: 'invoke verifyToken' },
    { id: 'stream', parent: 'worker', label: 'streaming' },
    { id: 'p', kind: 'parallel', parent: 'root', label: 'processing', detail: 'parallel' },
    { id: 'r1', kind: 'region', parent: 'p', label: 'scan' },
    { id: 'r2', kind: 'region', parent: 'p', label: 'thumbnails' },
    { id: 'scanning', parent: 'r1', label: 'scanning' },
    { id: 'clean', kind: 'final', parent: 'r1', label: 'clean' },
    { id: 'resizing', parent: 'r2', label: 'resizing' },
    { id: 'stored', kind: 'final', parent: 'r2', label: 'stored' },
    { id: 'done', kind: 'final', parent: 'root', label: 'done' },
  ],
  edges: [
    { id: 'e0', from: 'i0', to: 'worker', kind: 'initial' },
    { id: 'e1', from: 'i1', to: 'auth', kind: 'initial' },
    { id: 'e2', from: 'auth', to: 'stream', label: 'done' },
    { id: 'self', from: 'stream', to: 'stream', label: 'CHUNK' },
    { id: 'e3', from: 'stream', to: 'p', label: 'EOF' },
    { id: 'e4', from: 'scanning', to: 'clean', label: 'done' },
    { id: 'e5', from: 'resizing', to: 'stored', label: 'done' },
    { id: 'e6', from: 'p', to: 'done', label: 'done' },
    { id: 'wall', from: 'worker', to: 'stream', label: 'RESET' },
    { id: 'out', from: 'stream', to: 'done', label: 'CANCEL' },
  ],
};

describe('layoutDiagram, with real ELK, on a server', () => {
  it('places everything: children inside parents, siblings apart, routes and labels', async () => {
    const out = await layoutDiagram(MACHINE, { text });
    expect(out.engine).toBe('server');
    expect(out.ms).toBeGreaterThanOrEqual(0);
    expect(out.nodes).toHaveLength(MACHINE.nodes.length);
    expect(out.edges).toHaveLength(MACHINE.edges!.length);
    const byId = new Map(out.nodes.map((n) => [n.id, n]));
    for (const n of out.nodes) {
      for (const v of [n.x, n.y, n.w, n.h]) expect(Number.isFinite(v)).toBe(true);
      if (n.parent) expect(inside(n, byId.get(n.parent)!), `${n.id} inside ${n.parent}`).toBe(true);
      for (const m of out.nodes) if (m.id < n.id && m.parent === n.parent) expect(overlap(m, n), `${m.id} and ${n.id}`).toBe(false);
    }
    for (const e of out.edges) {
      expect(e.points!.length, e.id).toBeGreaterThanOrEqual(2);
      if (e.label) expect(e.labelBox, e.id).toBeDefined();
    }
    expect(out.bounds.w).toBeGreaterThan(100);
    // A self-transition comes back to where it started, and doesn't run through the node.
    const self = out.edges.find((e) => e.id === 'self')!;
    expect(self.points!.length).toBeGreaterThanOrEqual(4);
  });

  it('gives regions the width of their parallel state', async () => {
    const { nodes } = await layoutDiagram(MACHINE, { text });
    const [r1, r2, p] = ['r1', 'r2', 'p'].map((id) => nodes.find((n) => n.id === id)!);
    expect(r1.x).toBe(r2.x);
    expect(r1.w).toBe(r2.w);
    expect(r1.w).toBe(p.w - 16);
  });

  it('copes with a cycle through a compound, and a compound with an edge to its own child', async () => {
    const out = await layoutDiagram({
      nodes: [{ id: 'a', label: 'a' }, { id: 'box', kind: 'compound', label: 'box' }, { id: 'kid', parent: 'box', label: 'kid' }, { id: 'kid2', parent: 'box', label: 'kid2' }],
      edges: [{ id: '1', from: 'a', to: 'kid' }, { id: '2', from: 'kid', to: 'kid2' }, { id: '3', from: 'kid2', to: 'a' }, { id: '4', from: 'box', to: 'kid' }, { id: '5', from: 'kid2', to: 'box' }, { id: '6', from: 'a', to: 'box' }, { id: '7', from: 'box', to: 'a' }],
    }, { text });
    expect(out.edges.every((e) => (e.points?.length ?? 0) >= 2)).toBe(true);
  });

  it('runs the way it’s told', async () => {
    const draft: DiagramDraft = { nodes: [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }], edges: [{ id: 'e', from: 'a', to: 'b' }] };
    const right = await layoutDiagram(draft, { text });
    expect(right.nodes[1].x).toBeGreaterThan(right.nodes[0].x);
    expect(right.nodes[1].y).toBe(right.nodes[0].y);
    const down = await layoutDiagram(draft, { text, direction: 'DOWN' });
    expect(down.nodes[1].y).toBeGreaterThan(down.nodes[0].y);
    expect(down.nodes[1].x).toBe(down.nodes[0].x);
  });

  it('is the same every time', async () => {
    const [a, b] = await Promise.all([layoutDiagram(MACHINE, { text }), layoutDiagram(MACHINE, { text })]);
    expect(a.nodes).toEqual(b.nodes);
    expect(a.edges).toEqual(b.edges);
  });

  it('draws nothing from nothing', async () => {
    const out = await layoutDiagram({ nodes: [] });
    expect(out.nodes).toEqual([]);
    expect(out.bounds).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('stops when told to, before it starts', async () => {
    const stop = new AbortController();
    stop.abort();
    await expect(layoutDiagram(MACHINE, { signal: stop.signal })).rejects.toMatchObject({ code: 'aborted' });
  });
});

/* A stand-in Worker, so what happens around ELK can be checked here. */
class FakeWorker extends EventTarget {
  static made: FakeWorker[] = [];
  terminated = false;
  posted: { id: number; graph: ElkGraph }[] = [];
  constructor() {
    super();
    FakeWorker.made.push(this);
  }
  postMessage(m: { id: number; graph: ElkGraph }) { this.posted.push(m); }
  terminate() { this.terminated = true; }
  answer(id = this.posted.at(-1)!.id) { this.dispatchEvent(Object.assign(new Event('message'), { data: { id, graph: { id: '__root', children: [] } } })); }
  fail(message = 'boom') { this.dispatchEvent(Object.assign(new Event('error'), { message })); }
}

describe('the engine, in a page', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeWorker.made = [];
  });
  const graph: ElkGraph = { id: '__root', children: [] };

  it('keeps one worker across layouts, and stops it when disposed', async () => {
    const engine = createDiagramLayoutEngine({ worker: () => new FakeWorker() as unknown as Worker });
    vi.stubGlobal('Worker', FakeWorker);
    const first = engine.run(graph);
    await Promise.resolve();
    FakeWorker.made[0].answer();
    await expect(first).resolves.toMatchObject({ engine: 'worker' });
    const second = engine.run(graph);
    await Promise.resolve();
    FakeWorker.made[0].answer();
    await second;
    expect(FakeWorker.made).toHaveLength(1);
    expect(FakeWorker.made[0].terminated).toBe(false);
    engine.dispose();
    expect(FakeWorker.made[0].terminated).toBe(true);
  });

  it('stops the worker when a layout’s aborted, and starts a new one for the next', async () => {
    const engine = createDiagramLayoutEngine({ worker: () => new FakeWorker() as unknown as Worker });
    vi.stubGlobal('Worker', FakeWorker);
    const stop = new AbortController();
    const first = engine.run(graph, stop.signal);
    await Promise.resolve();
    stop.abort();
    await expect(first).rejects.toMatchObject({ code: 'aborted' });
    expect(FakeWorker.made[0].terminated).toBe(true);
    const second = engine.run(graph);
    await Promise.resolve();
    expect(FakeWorker.made).toHaveLength(2);
    FakeWorker.made[1].answer();
    await second;
  });

  it('ignores an answer to something else', async () => {
    const engine = createDiagramLayoutEngine({ worker: () => new FakeWorker() as unknown as Worker });
    vi.stubGlobal('Worker', FakeWorker);
    let done = false;
    const run = engine.run(graph).then(() => { done = true; });
    await Promise.resolve();
    FakeWorker.made[0].answer(999);
    await new Promise((r) => setTimeout(r, 5));
    expect(done).toBe(false);
    FakeWorker.made[0].answer();
    await run;
    expect(done).toBe(true);
  });

  it('passes on a refusal from ELK', async () => {
    const engine = createDiagramLayoutEngine({ worker: () => new FakeWorker() as unknown as Worker });
    vi.stubGlobal('Worker', FakeWorker);
    const run = engine.run(graph);
    await Promise.resolve();
    const w = FakeWorker.made[0];
    w.dispatchEvent(Object.assign(new Event('message'), { data: { id: w.posted[0].id, error: 'Referenced shape does not exist: x' } }));
    await expect(run).rejects.toMatchObject({ code: 'elk', message: 'Referenced shape does not exist: x' });
  });

  it('says so when a worker you gave it can’t start, and doesn’t fall back', async () => {
    const engine = createDiagramLayoutEngine({ worker: () => new FakeWorker() as unknown as Worker });
    vi.stubGlobal('Worker', FakeWorker);
    const run = engine.run(graph);
    await Promise.resolve();
    FakeWorker.made[0].fail('404');
    const error = await run.catch((e) => e);
    expect(error).toBeInstanceOf(DiagramLayoutError);
    expect(error.code).toBe('worker');
    expect(error.message).toContain('404');
  });

  it('falls back to the main thread when its own worker can’t load, once, and says how to fix it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // `new URL(..., import.meta.url)` needs a Worker that fails, which is what a bundler that moved the script gets.
    vi.stubGlobal('Worker', class extends FakeWorker { constructor() { super(); queueMicrotask(() => this.fail('not a script')); } });
    vi.stubGlobal('document', {});
    const engine = createDiagramLayoutEngine();
    const first = await engine.run({ id: '__root', layoutOptions: { 'elk.algorithm': 'layered' }, children: [{ id: 'a', width: 10, height: 10 }], edges: [] });
    expect(first.engine).toBe('main-thread');
    expect(first.graph.children![0].x).toBeTypeOf('number');
    expect(warn.mock.calls[0][0]).toContain('main thread');
    expect(warn.mock.calls[0][0]).toContain('Pass `worker`');
    const before = FakeWorker.made.length;
    await engine.run({ id: '__root', layoutOptions: {}, children: [], edges: [] });
    expect(FakeWorker.made).toHaveLength(before);
  });
});

describe('without the peer', () => {
  afterEach(() => {
    vi.doUnmock('elkjs/lib/elk.bundled.js');
    vi.resetModules();
  });

  it('says what to install', async () => {
    vi.resetModules();
    vi.doMock('elkjs/lib/elk.bundled.js', () => { throw new Error('Cannot find package'); });
    const { layoutDiagram: again, DiagramLayoutError: Err } = await import('@/lib/diagram-layout');
    const error = await again({ nodes: [{ id: 'a' }] }).catch((e) => e);
    expect(error).toBeInstanceOf(Err);
    expect(error.code).toBe('peer');
    expect(error.message).toContain('npm install elkjs');
    expect(error.cause).toBeDefined();
  });
});
