import { describe, expect, it } from 'vitest';
import { indexDiagram, type DiagramEdge, type DiagramNode } from './diagram-model';
import { fitViewport, viewportToShow, describeEdge, describeNode, edgesByNode, focusOrder, nearestNode, nodeInDirection, stepFocus, type DiagramItem } from './diagram-keyboard';

const node = (id: string, x: number, y: number, extra: Partial<DiagramNode> = {}): DiagramNode => ({ id, title: id, x, y, w: 100, h: 40, ...extra });
const nodes: DiagramNode[] = [
  node('a', 0, 0), node('b', 300, 0), node('c', 300, 200), node('d', 0, 200),
  node('box', 600, 0, { kind: 'group', w: 400, h: 300 }), node('k1', 650, 60, { parent: 'box' }), node('k2', 850, 200, { parent: 'box' }),
  node('alone', 150, 500),
];
// a → b → c → d → a is a cycle.
const edges: DiagramEdge[] = [
  { id: 'ab', from: 'a', to: 'b', title: 'GO' }, { id: 'bc', from: 'b', to: 'c' }, { id: 'cd', from: 'c', to: 'd' }, { id: 'da', from: 'd', to: 'a' },
  { id: 'loop', from: 'b', to: 'b', title: 'AGAIN' }, { id: 'in', from: 'b', to: 'k1' }, { id: 'k', from: 'k1', to: 'k2' },
];
const ctx = { index: indexDiagram(nodes), edges };
const n = (id: string): DiagramItem => ({ kind: 'node', id });
const e = (id: string): DiagramItem => ({ kind: 'edge', id });

describe('a root', () => {
  it('isn’t somewhere focus goes, as it’s the background', () => {
    const index = indexDiagram([node('r', 0, 0, { kind: 'root', w: 1000, h: 1000 }), node('a', 10, 10, { parent: 'r' }), node('b', 200, 10, { parent: 'r' })]);
    const ctx = { index, edges: [] };
    expect(focusOrder(ctx).map((f) => f.id)).toEqual(['a', 'b']);
    expect(stepFocus(null, 'first', ctx)).toEqual({ kind: 'node', id: 'a' });
    expect(stepFocus({ kind: 'node', id: 'a' }, 'previous', ctx)?.id).not.toBe('r');
    expect(stepFocus({ kind: 'node', id: 'b' }, 'next', ctx)?.id).not.toBe('r');
  });
});

describe('going a direction', () => {
  it('follows an edge if one goes that way', () => {
    expect(nodeInDirection('a', { x: 1, y: 0 }, ctx)).toBe('b');
    expect(nodeInDirection('b', { x: 0, y: 1 }, ctx)).toBe('c');
    expect(nodeInDirection('c', { x: -1, y: 0 }, ctx)).toBe('d');
    expect(nodeInDirection('d', { x: 0, y: -1 }, ctx)).toBe('a');
  });

  it('prefers what’s connected, over something nearer that isn’t', () => {
    const list = [node('s', 0, 0), node('near', 150, 0), node('far', 500, 0)];
    const c = { index: indexDiagram(list), edges: [{ id: 'x', from: 's', to: 'far' }] };
    expect(nodeInDirection('s', { x: 1, y: 0 }, c)).toBe('far');
  });

  it('takes whatever’s nearest that way when nothing’s connected, so a disconnected node can be reached and left', () => {
    expect(nodeInDirection('d', { x: 0, y: 1 }, ctx)).toBe('alone');
    // c and d are the same distance from it, and c comes first.
    expect(nodeInDirection('alone', { x: 0, y: -1 }, ctx)).toBe('c');
    expect(nodeInDirection('alone', { x: 1, y: 0 }, ctx)).toBe('k2');
  });

  it('prefers straight ahead to nearer but off to the side', () => {
    const list = [node('s', 0, 0), node('ahead', 400, 0), node('aside', 200, 250)];
    expect(nodeInDirection('s', { x: 1, y: 0 }, { index: indexDiagram(list), edges: [] })).toBe('ahead');
  });

  it('says so at the edge of the diagram, with nothing that way', () => {
    expect(nodeInDirection('a', { x: 0, y: -1 }, ctx)).toBeNull();
    expect(nodeInDirection('gone', { x: 1, y: 0 }, ctx)).toBeNull();
  });

  it('doesn’t go to what’s around it or in it, which the other keys are for', () => {
    expect(nodeInDirection('k1', { x: 1, y: 0 }, ctx)).not.toBe('box');
    expect(nodeInDirection('box', { x: -1, y: 0 }, ctx)).not.toBe('k1');
  });
});

describe('stepping', () => {
  it('goes along an edge: forward to where it goes, back to where it comes from', () => {
    expect(stepFocus(e('ab'), 'ArrowRight', ctx)).toEqual(n('b'));
    expect(stepFocus(e('ab'), 'ArrowDown', ctx)).toEqual(n('b'));
    expect(stepFocus(e('ab'), 'ArrowLeft', ctx)).toEqual(n('a'));
    expect(stepFocus(e('ab'), 'ArrowUp', ctx)).toEqual(n('a'));
  });

  it('steps through a node’s edges, those going out first', () => {
    expect(stepFocus(n('b'), 'edge+', ctx)).toEqual(e('bc'));
    expect(stepFocus(n('b'), 'edge-', ctx)).toEqual(e('ab'));
    expect(stepFocus(e('bc'), 'edge+', ctx)).toEqual(e('loop'));
    expect(stepFocus(e('loop'), 'edge+', ctx)).toEqual(e('in'));
    expect(stepFocus(e('in'), 'edge+', ctx)).toEqual(e('bc'));
    expect(stepFocus(e('bc'), 'edge-', ctx)).toEqual(e('in'));
    expect(stepFocus(n('alone'), 'edge+', ctx)).toBeNull();
  });

  it('goes into what a node holds, and out to what holds it', () => {
    expect(stepFocus(n('box'), 'in', ctx)).toEqual(n('k1'));
    expect(stepFocus(n('k1'), 'out', ctx)).toEqual(n('box'));
    expect(stepFocus(n('a'), 'in', ctx)).toBeNull();
    expect(stepFocus(n('a'), 'out', ctx)).toBeNull();
    expect(stepFocus(e('ab'), 'in', ctx)).toBeNull();
  });

  it('reaches every node and every edge with one key, and comes back round', () => {
    const all = focusOrder(ctx);
    expect(all).toHaveLength(nodes.length + edges.length);
    let at: DiagramItem = all[0];
    const seen = new Set<string>();
    for (let i = 0; i < all.length; i++) {
      seen.add(`${at.kind}:${at.id}`);
      at = stepFocus(at, 'next', ctx)!;
    }
    expect(seen.size).toBe(all.length);
    expect(at).toEqual(all[0]);
    expect(stepFocus(all[0], 'previous', ctx)).toEqual(all[all.length - 1]);
    expect(stepFocus(null, 'next', ctx)).toEqual(all[0]);
  });

  it('doesn’t offer an edge that can’t be drawn', () => {
    const list = focusOrder({ index: indexDiagram([node('a', 0, 0)]), edges: [{ id: 'x', from: 'a', to: 'gone' }] });
    expect(list).toEqual([n('a')]);
  });

  it('can’t get stuck in a cycle: every direction out of it still goes somewhere', () => {
    // Walking right round a ring of nodes returns to the start, rather than stopping.
    let at = 'a';
    const walk = [['ArrowRight', 'b'], ['ArrowDown', 'c'], ['ArrowLeft', 'd'], ['ArrowUp', 'a']] as const;
    for (const [key, to] of walk) { at = stepFocus(n(at), key, ctx)!.id; expect(at).toBe(to); }
    // And from anywhere on it, something else can be reached.
    expect(stepFocus(n('c'), 'ArrowRight', ctx)?.id).toBe('k2');
  });

  it('knows first and last', () => {
    expect(stepFocus(n('c'), 'first', ctx)).toEqual(n('a'));
    expect(stepFocus(n('c'), 'last', ctx)).toEqual(n('alone'));
    expect(stepFocus(null, 'first', { index: indexDiagram([]), edges: [] })).toBeNull();
  });

  it('stays put with nothing to go to', () => {
    expect(stepFocus(e('gone'), 'ArrowRight', ctx)).toBeNull();
    expect(stepFocus(n('alone'), 'ArrowDown', ctx)).toBeNull();
  });

  it('finds what’s nearest a place, for when what’s focused goes away', () => {
    expect(nearestNode(ctx.index, { x: 310, y: 210 })).toBe('c');
    expect(nearestNode(indexDiagram([]), { x: 0, y: 0 })).toBeNull();
    expect(nearestNode(indexDiagram([node('r', 0, 0, { kind: 'root', w: 1000, h: 1000 }), node('x', 900, 900)]), { x: 500, y: 500 })).toBe('x');
  });
});

describe('what a screen reader hears', () => {
  const at = edgesByNode(edges);
  const says = (id: string) => describeNode(ctx.index.byId.get(id)!, ctx.index, at.get(id));

  it('says what a node is and what it connects to', () => {
    expect(says('a')).toBe('a, node. 1 going out: GO to b. 1 coming in: from d.');
    expect(says('b')).toBe('b, node. 3 going out: to c, AGAIN back to itself, to k1. 1 coming in: GO from a.');
  });

  it('says where it is, and what a group holds', () => {
    expect(says('k1')).toBe('k1, node, in box. 1 going out: to k2. 1 coming in: from b.');
    expect(says('box')).toBe('box, group, holding 2 nodes. Not connected to anything.');
  });

  it('says when a node’s not connected', () => {
    expect(says('alone')).toBe('alone, node. Not connected to anything.');
  });

  it('names each kind', () => {
    const list: DiagramNode[] = [
      node('r', 0, 0, { kind: 'root' }), node('p', 0, 0, { kind: 'group', variant: 'dashed', parent: 'r' }), node('g', 0, 0, { kind: 'region', parent: 'p' }),
      node('f', 0, 0, { variant: 'double', parent: 'g' }), node('i', 0, 0, { kind: 'marker', parent: 'g', title: undefined }), node('d', 0, 0, { description: 'invoke verifyToken', parent: 'r' }),
    ];
    const index = indexDiagram(list);
    const text = (id: string) => describeNode(index.byId.get(id)!, index, undefined);
    expect(text('r')).toBe('r, diagram, holding 2 nodes. Not connected to anything.');
    expect(text('p')).toBe('p, group, holding 1 node. Not connected to anything.');
    expect(text('g')).toBe('g, region, holding 2 nodes, in p. Not connected to anything.');
    // A border's a look, and says nothing; a marker goes by its label, if it has one.
    expect(text('f')).toBe('f, node, in g. Not connected to anything.');
    expect(text('i')).toBe('Marker, in g. Not connected to anything.');
    const started = indexDiagram([node('s', 0, 0, { kind: 'marker', title: 'Start' })]);
    expect(describeNode(started.byId.get('s')!, started, undefined)).toBe('Start, marker. Not connected to anything.');
    expect(text('d')).toBe('d, node. invoke verifyToken. Not connected to anything.');
  });

  it('keeps a long list short', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, from: 'a', to: 'b', title: `E${i}` }));
    const text = describeNode(ctx.index.byId.get('a')!, ctx.index, edgesByNode(many).get('a'));
    expect(text).toContain('8 going out: E0 to b, E1 to b, E2 to b, E3 to b, E4 to b, and 3 more.');
  });

  it('says what an edge joins', () => {
    expect(describeEdge(edges[0], ctx.index)).toBe('GO, edge from a to b.');
    expect(describeEdge(edges[1], ctx.index)).toBe('Edge from b to c.');
    expect(describeEdge(edges[4], ctx.index)).toBe('AGAIN, edge from b back to itself.');
    expect(describeEdge({ id: 'x', from: 'a', to: 'gone' }, ctx.index)).toBe('Edge from a to gone.');
  });
});

describe('the view follows', () => {
  const size = { width: 800, height: 600 };
  const viewport = { x: 0, y: 0, zoom: 1 };

  it('leaves the view alone when it’s already in view', () => {
    expect(viewportToShow(viewport, { x: 100, y: 100, w: 100, h: 40 }, size)).toBe(viewport);
  });

  it('moves as little as it can, with air', () => {
    expect(viewportToShow(viewport, { x: 900, y: 100, w: 100, h: 40 }, size)).toEqual({ x: -248, y: 0, zoom: 1 });
    expect(viewportToShow(viewport, { x: -300, y: 100, w: 100, h: 40 }, size)).toEqual({ x: 348, y: 0, zoom: 1 });
    expect(viewportToShow(viewport, { x: 100, y: 900, w: 100, h: 40 }, size)).toEqual({ x: 0, y: -388, zoom: 1 });
  });

  it('goes by what’s on screen, at the zoom it’s at', () => {
    const z = { x: 0, y: 0, zoom: 2 };
    const next = viewportToShow(z, { x: 500, y: 100, w: 100, h: 40 }, size);
    // Its right edge is at 1200 on screen, and has to come to 752.
    expect(next).toEqual({ x: -448, y: 0, zoom: 2 });
  });

  it('centers what’s too big to fit', () => {
    const next = viewportToShow(viewport, { x: 0, y: 0, w: 2000, h: 40 }, size);
    expect(next.x).toBe(400 - 1000);
  });

  it('fits what there is, no closer than 100%, and the origin when there’s nothing', () => {
    expect(fitViewport(null, size)).toEqual({ x: 400, y: 300, zoom: 1 });
    expect(fitViewport({ x: 0, y: 0, w: 100, h: 50 }, size)).toEqual({ x: 350, y: 275, zoom: 1 });
    const far = fitViewport({ x: 0, y: 0, w: 1504, h: 100 }, size);
    expect(far.zoom).toBeCloseTo(0.5);
    expect(far.x).toBeCloseTo(400 - 752 * 0.5);
  });
});

describe('fitViewport', () => {
  it('fits in what each side’s padding leaves, centered there', () => {
    const v = fitViewport({ x: 0, y: 0, w: 100, h: 100 }, { width: 400, height: 400 }, { top: 60, right: 0, bottom: 140, left: 0 });
    // 200 px tall is left, so 100 units fit at 2, capped at 1, and centered at y = 60 + 100.
    expect(v.zoom).toBe(1);
    expect(v.y).toBe(160 - 50);
    expect(v.x).toBe(200 - 50);
    const big = fitViewport({ x: 0, y: 0, w: 1000, h: 1000 }, { width: 400, height: 400 }, { top: 60, right: 0, bottom: 140, left: 0 });
    expect(big.zoom).toBeCloseTo(0.2);
    expect(big.y).toBeCloseTo(60);
  });
});
