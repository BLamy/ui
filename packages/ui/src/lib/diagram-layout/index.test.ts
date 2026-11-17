import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIAGRAM_ELK_OPTIONS, DiagramLayoutError, createDiagramLayoutEngine, fromElkGraph, layoutDiagram, toElkGraph, wrapDiagram, type DiagramDraft, type ElkGraph } from '@/lib/diagram-layout';
import type { DiagramEdge, DiagramNode } from '@/lib/diagram-model';
import type { Pt } from '@/lib/canvas-math';

const text = (t: string) => ({ w: t.length * 10, h: 15 });
const inside = (a: DiagramNode, b: DiagramNode) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w + 0.01 && a.y + a.h <= b.y + b.h + 0.01;
const overlap = (a: DiagramNode, b: DiagramNode) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('what isn’t connected', () => {
  const nodes = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `n${i}`, w: 224, h: 58 + (i % 5) * 19 }));
  const spread = (laid: readonly DiagramNode[]) => {
    const wide = Math.max(...laid.map((n) => n.x + n.w)) - Math.min(...laid.map((n) => n.x));
    const high = Math.max(...laid.map((n) => n.y + n.h)) - Math.min(...laid.map((n) => n.y));
    return wide / high;
  };

  it('goes in rows, where it would otherwise be one long column', async () => {
    const loose = await layoutDiagram({ nodes: nodes(40) }, {});
    expect(new Set(loose.nodes.map((n) => n.x)).size).toBeGreaterThan(3);
    expect(spread(loose.nodes)).toBeGreaterThan(0.8);
    for (let i = 0; i < loose.nodes.length; i++) for (let j = i + 1; j < loose.nodes.length; j++) expect(overlap(loose.nodes[i]!, loose.nodes[j]!)).toBe(false);
    // Asked for what it was, it's one long row (the layers run down), which is what this is here to stop.
    const row = await layoutDiagram({ nodes: nodes(40) }, { elk: { 'elk.hierarchyHandling': 'INCLUDE_CHILDREN' } });
    expect(spread(row.nodes)).toBeGreaterThan(10);
  });

  it('keeps what is connected together, and in order', async () => {
    const out = await layoutDiagram({ nodes: nodes(12), edges: [{ id: 'a', from: 'n0', to: 'n1' }, { id: 'b', from: 'n1', to: 'n2' }] }, {});
    const at = (id: string) => out.nodes.find((n) => n.id === id)!;
    expect(at('n0').y).toBeLessThan(at('n1').y);
    expect(at('n1').y).toBeLessThan(at('n2').y);
    expect(out.edges).toHaveLength(2);
    for (const e of out.edges) expect(e.points?.length).toBeGreaterThan(1);
  });
});

describe('toElkGraph', () => {
  it('asks for layered layout, with hierarchy, and takes your options over its own', () => {
    const g = toElkGraph({ nodes: [{ id: 'box', kind: 'group' }, { id: 'in', parent: 'box' }] });
    expect(g.layoutOptions!['elk.algorithm']).toBe('layered');
    expect(g.layoutOptions!['elk.hierarchyHandling']).toBe('INCLUDE_CHILDREN');
    // With nothing inside anything, what isn't connected can be packed.
    expect(toElkGraph({ nodes: [{ id: 'a' }, { id: 'b' }] }).layoutOptions!['elk.hierarchyHandling']).toBe('SEPARATE_CHILDREN');
    expect(toElkGraph({ nodes: [{ id: 'a' }] }, { elk: { 'elk.hierarchyHandling': 'INCLUDE_CHILDREN' } }).layoutOptions!['elk.hierarchyHandling']).toBe('INCLUDE_CHILDREN');
    // Top to bottom unless told otherwise, with labels on their routes and room to read at 100%.
    expect(g.layoutOptions!['elk.direction']).toBe('DOWN');
    expect(toElkGraph({ nodes: [] }, { direction: 'right' }).layoutOptions!['elk.direction']).toBe('RIGHT');
    expect(Number(toElkGraph({ nodes: [] }, { density: 'compact' }).layoutOptions!['elk.spacing.nodeNode'])).toBeLessThan(Number(g.layoutOptions!['elk.spacing.nodeNode']));
    expect(Number(toElkGraph({ nodes: [] }, { density: 'comfortable' }).layoutOptions!['elk.spacing.nodeNode'])).toBeGreaterThan(Number(g.layoutOptions!['elk.spacing.nodeNode']));
    expect(toElkGraph({ nodes: [] }, { direction: 'down', elk: { 'elk.direction': 'LEFT', 'elk.foo': 'bar' } }).layoutOptions).toMatchObject({ 'elk.direction': 'LEFT', 'elk.foo': 'bar' });
    expect(Object.keys(DIAGRAM_ELK_OPTIONS)).toContain('elk.edgeRouting');
  });

  it('nests nodes under their parents, however they were listed, with every edge on the root', () => {
    const g = toElkGraph({
      nodes: [{ id: 'kid', parent: 'box', title: 'abc' }, { id: 'box', kind: 'group', title: 'hello' }, { id: 'free', title: 'x' }],
      edges: [{ id: 'e', from: 'kid', to: 'free', title: 'GO' }],
    }, { text });
    expect(g.children!.map((c) => c.id)).toEqual(['box', 'free']);
    const box = g.children![0];
    expect(box.children!.map((c) => c.id)).toEqual(['kid']);
    expect(box.width).toBeUndefined();
    expect(box.layoutOptions!['elk.nodeSize.constraints']).toBe('MINIMUM_SIZE');
    // The least a compound can be is its header strip; what it holds starts under it.
    expect(box.layoutOptions!['elk.nodeSize.minimum']).toBe('(72, 29)');
    expect(box.layoutOptions!['elk.padding']).toBe('[top=40,left=16,bottom=16,right=16]');
    // A label is a pill on its route, sized to its title.
    expect(g.edges![0]).toEqual({ id: 'e', sources: ['kid'], targets: ['free'], labels: [{ text: 'GO', width: 42, height: 25, layoutOptions: { 'elk.edgeLabels.inline': 'true', 'elk.edgeLabels.placement': 'CENTER' } }] });
  });

  it('sizes leaves to their words, and keeps a size it was given', () => {
    const g = toElkGraph({ nodes: [{ id: 'a', title: 'x'.repeat(20) }, { id: 'b', title: 'x'.repeat(20), w: 50, h: 60 }, { id: 'i', kind: 'marker' }] }, { text });
    expect(g.children![0]).toMatchObject({ width: 222, height: 29 });
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
    const claim = (node: string, ports: string[]) => ports.map((p) => ({ id: `${node}-${p}`, from: node, fromPort: p, to: 'z' }));
    const fixed = toElkGraph({ nodes: [{ id: 'a', w: 100, h: 50, ports: [
      { id: 'l', side: 'left', at: 0.2 }, { id: 'r', side: 'right', at: 0.8 }, { id: 't', side: 'top', at: 0.25 }, { id: 'b', side: 'bottom' },
    ] }, { id: 'z' }], edges: claim('a', ['l', 'r', 't', 'b']) });
    const node = fixed.children![0];
    expect(node.layoutOptions!['elk.portConstraints']).toBe('FIXED_POS');
    expect(node.ports!.map((p) => [p.x, p.y])).toEqual([[0, 10], [100, 40], [25, 0], [50, 50]]);
    const holding = toElkGraph({ nodes: [{ id: 'c', kind: 'group', ports: [{ id: 'in', side: 'left' }] }, { id: 'kid', parent: 'c' }, { id: 'z' }], edges: claim('c', ['in']) });
    const compound = holding.children![0];
    expect(compound.layoutOptions!['elk.portConstraints']).toBe('FIXED_SIDE');
    expect(compound.ports![0].x).toBeUndefined();
  });

  it('leaves out a port no edge claims (a dot to connect by), so that it changes nothing in the layout', () => {
    const dots = toElkGraph({ nodes: [{ id: 'a', w: 100, h: 50, ports: [{ id: 'l', side: 'left' }, { id: 'r', side: 'right' }] }, { id: 'b' }], edges: [{ id: 'e', from: 'a', to: 'b' }] });
    const none = toElkGraph({ nodes: [{ id: 'a', w: 100, h: 50 }, { id: 'b' }], edges: [{ id: 'e', from: 'a', to: 'b' }] });
    expect(dots).toEqual(none);
  });

  it('reads back where ELK put a port it was left to place, and leaves one that had a place alone', () => {
    const draft = { nodes: [
      { id: 'c', kind: 'group' as const, ports: [{ id: 'in', side: 'left' as const }, { id: 'out', side: 'right' as const, at: 0.25 }] },
      { id: 'kid', parent: 'c' }, { id: 'z' },
    ], edges: [{ id: 'i', from: 'z', to: 'c', toPort: 'in' }, { id: 'o', from: 'c', fromPort: 'out', to: 'z' }] };
    const graph = toElkGraph(draft);
    const out = JSON.parse(JSON.stringify(graph));
    out.children[0] = { ...out.children[0], x: 0, y: 0, width: 200, height: 100, children: [{ ...out.children[0].children[0], x: 10, y: 10, width: 50, height: 20 }] };
    out.children[0].ports[0] = { ...out.children[0].ports[0], x: 0, y: 40 };
    const { nodes } = fromElkGraph(draft, out);
    expect(nodes.find((n) => n.id === 'c')!.ports).toEqual([{ id: 'in', side: 'left', at: 0.4 }, { id: 'out', side: 'right', at: 0.25 }]);
  });

  it('passes ports on, by side', () => {
    const g = toElkGraph({
      nodes: [{ id: 'a', ports: [{ id: 'out', side: 'right' }, { id: 'up', side: 'top' }] }, { id: 'b', ports: [{ id: 'in', side: 'left' }] }],
      edges: [{ id: 'e', from: 'a', fromPort: 'out', to: 'b', toPort: 'in' }, { id: 'f', from: 'a', fromPort: 'nope', to: 'b' }],
    });
    const a = g.children![0];
    // `up` is claimed by no edge, so ELK isn't told of it.
    expect(a.ports!.map((p) => p.layoutOptions!['elk.port.side'])).toEqual(['EAST']);
    expect(g.edges![0].sources[0]).toBe(a.ports![0].id);
    expect(g.edges![0].targets[0]).toBe(g.children![1].ports![0].id);
    // A port that doesn't exist falls back to the node.
    expect(g.edges![1].sources).toEqual(['a']);
  });
});

describe('fromElkGraph', () => {
  const draft: DiagramDraft = {
    nodes: [{ id: 'kid', parent: 'box', title: 'k', data: { keep: true } }, { id: 'box', kind: 'group', title: 'b' }],
    edges: [{ id: 'e', from: 'box', to: 'kid', label: 'GO', variant: 'dotted', labelBox: { x: 1, y: 2, w: 3, h: 4 } }, { id: 'lost', from: 'box', to: 'gone' }],
  };
  const out: ElkGraph = {
    id: '__root',
    children: [{ id: 'box', x: 100, y: 50, width: 300, height: 200, children: [{ id: 'kid', x: 10, y: 20, width: 80, height: 34 }] }],
    edges: [{ id: 'e', container: 'box', sources: ['box'], targets: ['kid'], labels: [{ x: 5, y: 6, width: 30, height: 11 }], sections: [{ startPoint: { x: 0, y: 30 }, bendPoints: [{ x: 5, y: 30 }], endPoint: { x: 10, y: 30 } }] }],
  };

  it('makes everything absolute, in the order it was given, and keeps what ELK didn’t touch', () => {
    const { nodes, edges, bounds } = fromElkGraph(draft, out);
    expect(nodes.map((n) => n.id)).toEqual(['kid', 'box']);
    expect(nodes[0]).toMatchObject({ x: 110, y: 70, w: 80, h: 34, title: 'k', data: { keep: true }, parent: 'box' });
    expect(nodes[1]).toMatchObject({ x: 100, y: 50, w: 300, h: 200 });
    expect(edges.map((e) => e.id)).toEqual(['e']);
    expect(edges[0].variant).toBe('dotted');
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
    const d: DiagramDraft = { nodes: [{ id: 'p', kind: 'group', variant: 'dashed' }, { id: 'a', kind: 'region', parent: 'p' }, { id: 'b', kind: 'region', parent: 'p' }] };
    const elk: ElkGraph = { id: '__root', children: [{ id: 'p', x: 0, y: 0, width: 400, height: 300, children: [{ id: 'a', x: 40, y: 30, width: 200, height: 100 }, { id: 'b', x: 80, y: 150, width: 100, height: 100 }] }] };
    const { nodes } = fromElkGraph(d, elk);
    expect(nodes[1]).toMatchObject({ x: 8, w: 384, y: 30, h: 100 });
    expect(nodes[2]).toMatchObject({ x: 8, w: 384, y: 150, h: 100 });
  });
});

const MACHINE: DiagramDraft = {
  nodes: [
    { id: 'root', kind: 'root', title: 'upload' },
    { id: 'i0', kind: 'marker', parent: 'root' },
    { id: 'worker', kind: 'group', parent: 'root', title: 'worker' },
    { id: 'i1', kind: 'marker', parent: 'worker' },
    { id: 'auth', parent: 'worker', title: 'authenticating', description: 'invoke verifyToken' },
    { id: 'stream', parent: 'worker', title: 'streaming' },
    { id: 'p', kind: 'group', variant: 'dashed', parent: 'root', title: 'processing', description: 'parallel' },
    { id: 'r1', kind: 'region', parent: 'p', title: 'scan' },
    { id: 'r2', kind: 'region', parent: 'p', title: 'thumbnails' },
    { id: 'scanning', parent: 'r1', title: 'scanning' },
    { id: 'clean', variant: 'double', parent: 'r1', title: 'clean' },
    { id: 'resizing', parent: 'r2', title: 'resizing' },
    { id: 'stored', variant: 'double', parent: 'r2', title: 'stored' },
    { id: 'done', variant: 'double', parent: 'root', title: 'done' },
  ],
  edges: [
    { id: 'e0', from: 'i0', to: 'worker', variant: 'strong' },
    { id: 'e1', from: 'i1', to: 'auth', variant: 'strong' },
    { id: 'e2', from: 'auth', to: 'stream', title: 'done' },
    { id: 'self', from: 'stream', to: 'stream', title: 'CHUNK' },
    { id: 'e3', from: 'stream', to: 'p', title: 'EOF' },
    { id: 'e4', from: 'scanning', to: 'clean', title: 'done' },
    { id: 'e5', from: 'resizing', to: 'stored', title: 'done' },
    { id: 'e6', from: 'p', to: 'done', title: 'done' },
    { id: 'wall', from: 'worker', to: 'stream', title: 'RESET' },
    { id: 'out', from: 'stream', to: 'done', title: 'CANCEL' },
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
      if (e.title) expect(e.labelBox, e.id).toBeDefined();
    }
    expect(out.bounds.w).toBeGreaterThan(100);
    // A self-transition comes back to where it started, and doesn't run through the node.
    const self = out.edges.find((e) => e.id === 'self')!;
    expect(self.points!.length).toBeGreaterThanOrEqual(4);
  });

  it('gives regions the width of their parallel state', async () => {
    const { nodes } = await layoutDiagram(MACHINE, { text });
    const [r1, r2, p] = ['r1', 'r2', 'p'].map((id) => nodes.find((n) => n.id === id)!);
    // The layers run down, so the lanes sit side by side, each as tall as the group has room for.
    expect(r1.y).toBe(r2.y);
    expect(r1.h).toBe(r2.h);
    expect(r1.y + r1.h).toBe(p.y + p.h - 8);
  });

  it('copes with a cycle through a compound, and a compound with an edge to its own child', async () => {
    const out = await layoutDiagram({
      nodes: [{ id: 'a', title: 'a' }, { id: 'box', kind: 'group', title: 'box' }, { id: 'kid', parent: 'box', title: 'kid' }, { id: 'kid2', parent: 'box', title: 'kid2' }],
      edges: [{ id: '1', from: 'a', to: 'kid' }, { id: '2', from: 'kid', to: 'kid2' }, { id: '3', from: 'kid2', to: 'a' }, { id: '4', from: 'box', to: 'kid' }, { id: '5', from: 'kid2', to: 'box' }, { id: '6', from: 'a', to: 'box' }, { id: '7', from: 'box', to: 'a' }],
    }, { text });
    expect(out.edges.every((e) => (e.points?.length ?? 0) >= 2)).toBe(true);
  });

  it('runs the way it’s told', async () => {
    const draft: DiagramDraft = { nodes: [{ id: 'a', title: 'a' }, { id: 'b', title: 'b' }], edges: [{ id: 'e', from: 'a', to: 'b' }] };
    const right = await layoutDiagram(draft, { text, direction: 'right' });
    expect(right.nodes[1].x).toBeGreaterThan(right.nodes[0].x);
    expect(right.nodes[1].y).toBe(right.nodes[0].y);
    const down = await layoutDiagram(draft, { text });
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

/** Whether two orthogonal routes cross (a point where a run of one goes through a run of the other, ends aside). */
const crosses = (p: readonly Pt[], q: readonly Pt[]) => {
  for (let i = 1; i < p.length; i++) for (let j = 1; j < q.length; j++) {
    const a = p[i - 1], b = p[i], c = q[j - 1], d = q[j];
    const v1 = a.x === b.x, v2 = c.x === d.x;
    if (v1 === v2) continue;
    const [v, h] = v1 ? [[a, b], [c, d]] : [[c, d], [a, b]];
    const x = v[0].x, y = h[0].y;
    if (x > Math.min(h[0].x, h[1].x) + 0.5 && x < Math.max(h[0].x, h[1].x) - 0.5 && y > Math.min(v[0].y, v[1].y) + 0.5 && y < Math.max(v[0].y, v[1].y) - 0.5) return true;
  }
  return false;
};
const square = (pts: readonly Pt[]) => pts.every((p, i) => !i || Math.abs(p.x - pts[i - 1].x) < 0.5 || Math.abs(p.y - pts[i - 1].y) < 0.5);

describe('the anatomy, laid out (J1)', () => {
  it('gives a self-loop each its own side of its card, its label there, the two loops apart', async () => {
    const out = await layoutDiagram({
      nodes: [{ id: 'm', kind: 'root', title: 'M' }, { id: 'a', parent: 'm', title: 'Paused' }, { id: 'b', parent: 'm', title: 'Playing', sections: [{ title: 'Entry actions', items: [{ title: 'onPlay', icon: 'bolt' }] }] }],
      edges: [{ id: 'go', from: 'a', to: 'b', title: 'play' }, { id: 'r', from: 'b', to: 'b', title: 'restart', sections: [{ items: [{ title: 'onRestart' }] }] }, { id: 't', from: 'b', to: 'b', title: 'time', sections: [{ items: [{ title: 'onUpdateTime' }] }] }],
    }, { text });
    const b = out.nodes.find((n) => n.id === 'b')!;
    const r = out.edges.find((e) => e.id === 'r')!, t = out.edges.find((e) => e.id === 't')!;
    // One on each side, beside it, not over it.
    expect(r.labelBox!.x + r.labelBox!.w).toBeLessThanOrEqual(b.x);
    expect(t.labelBox!.x).toBeGreaterThanOrEqual(b.x + b.w);
    for (const e of [r, t]) {
      expect(square(e.points!)).toBe(true);
      // Out of the card and back into it.
      expect(Math.abs(e.points![0].x - (e === r ? b.x : b.x + b.w))).toBeLessThan(0.5);
      expect(Math.abs(e.points![e.points!.length - 1].x - (e === r ? b.x : b.x + b.w))).toBeLessThan(0.5);
    }
    expect(crosses(r.points!, t.points!)).toBe(false);
  });

  it('makes a box as wide as its own header and sections, and starts its edge to what it holds under them', async () => {
    const long = 'api.example.com/uploads/everything/*';
    const out = await layoutDiagram({
      nodes: [{ id: 'w', kind: 'group', title: 'API', sections: [{ title: 'Triggers', items: [{ title: long }] }] }, { id: 'c', parent: 'w', title: 'Room' }],
      edges: [{ id: 'own', from: 'w', to: 'c', title: 'ROOM' }],
    }, { text });
    const w = out.nodes.find((n) => n.id === 'w')!, c = out.nodes.find((n) => n.id === 'c')!;
    expect(w.w).toBeGreaterThanOrEqual(long.length * 10);
    const own = out.edges.find((e) => e.id === 'own')!;
    // Header (15 + padding) and the section (caption and chip) are above where it starts, and the child below it.
    expect(own.points![0].y).toBeGreaterThan(w.y + 40);
    expect(own.points![0].y).toBeLessThanOrEqual(c.y);
  });

  it('brings an edge into what a box holds in under its header, not across it', async () => {
    const out = await layoutDiagram({
      nodes: [{ id: 'x', title: 'Outside' }, { id: 'g', kind: 'group', title: 'Box', sections: [{ title: 'About it', items: [{ title: 'one' }, { title: 'two' }] }] }, { id: 'in', parent: 'g', title: 'Inside' }],
      edges: [{ id: 'e', from: 'x', to: 'in' }],
    }, { text });
    const g = out.nodes.find((n) => n.id === 'g')!;
    const pts = out.edges.find((e) => e.id === 'e')!.points!;
    const head = { x: g.x, y: g.y, w: g.w, h: 70 };
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const through = Math.max(a.x, b.x) > head.x + 1 && Math.min(a.x, b.x) < head.x + head.w - 1 && Math.max(a.y, b.y) > head.y + 1 && Math.min(a.y, b.y) < head.y + head.h - 1;
      expect(through).toBe(false);
    }
  });
});

describe('wrapDiagram (J1)', () => {
  const chain = (n: number): DiagramDraft => ({
    nodes: [{ id: 'root', kind: 'root', title: 'Pipeline' }, ...Array.from({ length: n }, (_, i) => ({ id: `s${i}`, parent: 'root', title: `step ${i}`, w: 200, h: 120 }))],
    edges: Array.from({ length: n - 1 }, (_, i): DiagramEdge => ({ id: `e${i}`, from: `s${i}`, to: `s${i + 1}`, title: `E${i}` })),
  });

  it('wraps a long run into columns on a wide board, every route still square and nothing on anything', async () => {
    const laid = await layoutDiagram(chain(9), { text });
    const wrapped = wrapDiagram(laid, { width: 1280, height: 800 });
    const steps = wrapped.nodes.filter((n) => n.id.startsWith('s'));
    expect(new Set(steps.map((n) => Math.round(n.x))).size).toBeGreaterThan(1);
    expect(wrapped.bounds.w / wrapped.bounds.h).toBeGreaterThan(laid.bounds.w / laid.bounds.h * 2);
    for (const a of steps) for (const b of steps) if (a !== b) expect(overlap(a, b)).toBe(false);
    for (const e of wrapped.edges) expect(square(e.points!)).toBe(true);
    // Each edge still runs from its card to the next, on one of its sides.
    const onSide = (p: Pt, r: { x: number; y: number; w: number; h: number }) => Math.abs(p.y - r.y) < 1 || Math.abs(p.y - (r.y + r.h)) < 1 || Math.abs(p.x - r.x) < 1 || Math.abs(p.x - (r.x + r.w)) < 1;
    for (const e of wrapped.edges) {
      const from = steps.find((n) => n.id === e.from)!, to = steps.find((n) => n.id === e.to)!;
      const pts = e.points!;
      const [p, q] = [pts[0], pts[pts.length - 1]];
      expect(onSide(p, from) && onSide(q, to)).toBe(true);
      // From one column to the next, no U-turn round the drawing: no longer than half again its ends' distance, and a bit.
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
      expect(len).toBeLessThanOrEqual(1.5 * (Math.abs(q.x - p.x) + Math.abs(q.y - p.y)) + 200);
      // Its label is on it.
      const l = e.labelBox!;
      expect(pts.some((a, i) => i > 0 && Math.max(a.x, pts[i - 1].x) >= l.x && Math.min(a.x, pts[i - 1].x) <= l.x + l.w && Math.max(a.y, pts[i - 1].y) >= l.y && Math.min(a.y, pts[i - 1].y) <= l.y + l.h)).toBe(true);
    }
    const root = wrapped.nodes.find((n) => n.id === 'root')!;
    for (const n of steps) expect(inside(n, root)).toBe(true);
  });

  it('keeps one column on a phone, and leaves what fits alone', async () => {
    const laid = await layoutDiagram(chain(9), { text });
    expect(wrapDiagram(laid, { width: 390, height: 844 })).toBe(laid);
    const small = await layoutDiagram(chain(3), { text });
    expect(wrapDiagram(small, { width: 1280, height: 800 })).toBe(small);
  });

  it('arranges parts nothing joins to fill the board, the biggest first, each from the top', async () => {
    const laid = await layoutDiagram({
      nodes: [{ id: 'root', kind: 'root', title: 'Account' }, { id: 'big', parent: 'root', kind: 'group', title: 'production' }, ...Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, parent: 'big', title: `p${i}`, w: 220, h: 140 })), { id: 'small', parent: 'root', kind: 'group', title: 'staging' }, { id: 'q', parent: 'small', title: 'q', w: 220, h: 140 }],
      // A fan: production is wide.
      edges: Array.from({ length: 5 }, (_, i): DiagramEdge => ({ id: `e${i}`, from: 'p0', to: `p${i + 1}` })),
    }, { text });
    const wide = wrapDiagram(laid, { width: 2400, height: 900 });
    const tall = wrapDiagram(laid, { width: 700, height: 1600 });
    const at = (r: typeof wide, id: string) => r.nodes.find((n) => n.id === id)!;
    // Side by side, tops lined up, on a wide board; one over the other on a tall one, the biggest on top.
    expect(Math.abs(at(wide, 'big').y - at(wide, 'small').y)).toBeLessThan(1);
    expect(at(tall, 'small').y).toBeGreaterThan(at(tall, 'big').y + at(tall, 'big').h - 1);
  });
});
