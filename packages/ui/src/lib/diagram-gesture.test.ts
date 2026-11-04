import { describe, expect, it } from 'vitest';
import { DRAG_THRESHOLD, hitTestDiagram, movableNodes, nodesInMarquee, stepDiagramGesture, type DiagramGesture, type DiagramGestureContext, type DiagramGestureEvent } from './diagram-gesture';
import { indexDiagram, polylinePath, type DiagramNode, type DiagramSelection } from './diagram-model';

const nodes: DiagramNode[] = [
  { id: 'root', kind: 'root', x: 0, y: 0, w: 1000, h: 1000 },
  { id: 'a', parent: 'root', x: 100, y: 100, w: 100, h: 40 },
  { id: 'b', parent: 'root', x: 300, y: 100, w: 100, h: 40 },
  { id: 'box', kind: 'compound', parent: 'root', x: 100, y: 300, w: 300, h: 300 },
  { id: 'kid', parent: 'box', x: 150, y: 350, w: 100, h: 40 },
  { id: 'p', kind: 'parallel', parent: 'root', x: 500, y: 300, w: 300, h: 300 },
  { id: 'r', kind: 'region', parent: 'p', x: 510, y: 330, w: 280, h: 100 },
  { id: 'rk', parent: 'r', x: 550, y: 350, w: 100, h: 40 },
];
const index = indexDiagram(nodes);
const none: DiagramSelection = { nodes: [], edges: [] };
const ctx = (selection = none, extra: Partial<DiagramGestureContext> = {}): DiagramGestureContext => ({ index, selection, zoom: 1, editable: true, ...extra });
const IDLE: DiagramGesture = { k: 'idle' };

/** Runs events, keeping the selection as the component does. */
function run(events: DiagramGestureEvent[], start = none, extra: Partial<DiagramGestureContext> = {}) {
  let g = IDLE, selection = start;
  const commits: unknown[] = [];
  for (const e of events) {
    const step = stepDiagramGesture(g, e, ctx(selection, extra));
    g = step.gesture;
    if (step.selection) selection = step.selection;
    if (step.commit) commits.push(step.commit);
  }
  return { g, selection, commits };
}
const down = (hit: { kind: 'node' | 'edge'; id: string } | null, x = 0, y = 0, additive = false): DiagramGestureEvent => ({ type: 'down', hit, board: { x, y }, screen: { x, y }, additive });
const move = (x: number, y: number, noSnap = true): DiagramGestureEvent => ({ type: 'move', board: { x, y }, screen: { x, y }, noSnap });
const up: DiagramGestureEvent = { type: 'up' };
const node = (id: string) => ({ kind: 'node' as const, id });
const edge = (id: string) => ({ kind: 'edge' as const, id });

describe('selecting', () => {
  it('selects what’s pressed, and only it', () => {
    expect(run([down(node('a')), up]).selection).toEqual({ nodes: ['a'], edges: [] });
    expect(run([down(node('a')), up], { nodes: ['b'], edges: ['e'] }).selection).toEqual({ nodes: ['a'], edges: [] });
    expect(run([down(edge('e')), up], { nodes: ['b'], edges: [] }).selection).toEqual({ nodes: [], edges: ['e'] });
  });

  it('adds with the modifier, and takes away on a second press', () => {
    const one = { nodes: ['a'], edges: [] };
    expect(run([down(node('b'), 0, 0, true), up], one).selection).toEqual({ nodes: ['a', 'b'], edges: [] });
    expect(run([down(node('a'), 0, 0, true), up], { nodes: ['a', 'b'], edges: [] }).selection).toEqual({ nodes: ['b'], edges: [] });
    expect(run([down(edge('e'), 0, 0, true), up], one).selection).toEqual({ nodes: ['a'], edges: ['e'] });
    expect(run([down(edge('e'), 0, 0, true), up], { nodes: [], edges: ['e'] }).selection).toEqual({ nodes: [], edges: [] });
  });

  it('leaves only what’s clicked when it was one of several, but not until the click is over', () => {
    const two = { nodes: ['a', 'b'], edges: [] };
    const pressed = stepDiagramGesture(IDLE, down(node('a')), ctx(two));
    expect(pressed.selection).toBeUndefined();
    expect(run([down(node('a')), up], two).selection).toEqual({ nodes: ['a'], edges: [] });
  });

  it('clears on the background, unless the modifier’s held', () => {
    expect(run([down(null), up], { nodes: ['a'], edges: ['e'] }).selection).toEqual(none);
    expect(run([down(null, 0, 0, true), up], { nodes: ['a'], edges: [] }).selection).toEqual({ nodes: ['a'], edges: [] });
  });
});

describe('moving', () => {
  it('doesn’t start until the pointer’s gone far enough', () => {
    expect(run([down(node('a'), 100, 100), move(100 + DRAG_THRESHOLD - 1, 100)]).g.k).toBe('press');
    expect(run([down(node('a'), 100, 100), move(100 + DRAG_THRESHOLD, 100)]).g.k).toBe('move');
  });

  it('doesn’t lose the first step: the delta is from the press', () => {
    const { g } = run([down(node('a'), 100, 100), move(110, 106)]);
    expect(g.k === 'move' && g.delta).toEqual({ x: 10, y: 6 });
    const { commits } = run([down(node('a'), 100, 100), move(110, 106), move(180, 148), up]);
    expect(commits).toEqual([{ ids: ['a'], delta: { x: 80, y: 48 } }]);
  });

  it('commits nothing for no movement, and nothing at all until it’s let go', () => {
    expect(run([down(node('a'), 100, 100), move(110, 100)]).commits).toEqual([]);
    expect(run([down(node('a'), 100, 100), move(110, 100), move(100, 100), up]).commits).toEqual([]);
    expect(run([down(node('a'), 100, 100), up]).commits).toEqual([]);
  });

  it('moves everything selected, when what’s pressed is one of them', () => {
    const { commits } = run([down(node('a'), 100, 100), move(150, 100), up], { nodes: ['a', 'b'], edges: [] });
    expect(commits).toEqual([{ ids: ['a', 'b'], delta: { x: 50, y: 0 } }]);
  });

  it('doesn’t move what can’t be edited', () => {
    expect(run([down(node('a'), 100, 100), move(150, 100), up], none, { editable: false })).toMatchObject({ g: IDLE, commits: [], selection: { nodes: ['a'] } });
  });

  it('doesn’t move edges', () => {
    expect(run([down(edge('e'), 100, 100), move(150, 100), up]).commits).toEqual([]);
  });

  it('snaps to what’s near, by a distance that’s on screen, and only if asked', () => {
    const near = { type: 'move', board: { x: 120, y: 100 }, screen: { x: 120, y: 100 } } as const;
    const started = stepDiagramGesture(IDLE, down(node('b'), 100, 100), ctx());
    const snapped = stepDiagramGesture(started.gesture, near, ctx({ nodes: ['b'], edges: [] }));
    // `b` starts level with `a`, so y's already lined up: a guide, and no movement across.
    expect(snapped.gesture.k === 'move' && snapped.gesture.delta).toEqual({ x: 20, y: 0 });
    expect(snapped.gesture.k === 'move' && snapped.gesture.guides.length).toBeGreaterThan(0);
    const unsnapped = stepDiagramGesture(started.gesture, { ...near, board: { x: 120, y: 103 }, noSnap: true }, ctx({ nodes: ['b'], edges: [] }));
    expect(unsnapped.gesture.k === 'move' && unsnapped.gesture.delta).toEqual({ x: 20, y: 3 });
    // 3 units off at 100%: it snaps back into line.
    const at1 = stepDiagramGesture(started.gesture, { ...near, board: { x: 120, y: 103 } }, ctx({ nodes: ['b'], edges: [] }));
    expect(at1.gesture.k === 'move' && at1.gesture.delta.y).toBe(0);
    // The same 3 units at 400% is 12 px on screen, which is too far to snap.
    const at4 = stepDiagramGesture(started.gesture, { ...near, board: { x: 120, y: 103 } }, ctx({ nodes: ['b'], edges: [] }, { zoom: 4 }));
    expect(at4.gesture.k === 'move' && at4.gesture.delta.y).toBe(3);
  });

  it('knows what can move: not a root, a region as its parallel state, and a child only on its own', () => {
    expect(movableNodes(index, ['root'])).toEqual([]);
    expect(movableNodes(index, ['r'])).toEqual(['p']);
    expect(movableNodes(index, ['box', 'kid'])).toEqual(['box']);
    expect(movableNodes(index, ['kid'])).toEqual(['kid']);
    expect(movableNodes(index, ['gone'])).toEqual([]);
  });
});

describe('the marquee', () => {
  it('starts from nothing, and selects what it touches', () => {
    const { g, selection } = run([down(null, 50, 50), move(350, 200)], { nodes: ['kid'], edges: ['e'] });
    expect(g.k).toBe('marquee');
    expect(selection).toEqual({ nodes: ['a', 'b'], edges: [] });
  });

  it('adds to the selection with the modifier', () => {
    const { selection } = run([down(null, 50, 50, true), move(250, 200)], { nodes: ['kid'], edges: ['e'] });
    expect(selection).toEqual({ nodes: ['kid', 'a'], edges: ['e'] });
  });

  it('takes back what it no longer touches', () => {
    const { selection } = run([down(null, 50, 50), move(350, 200), move(250, 200)]);
    expect(selection.nodes).toEqual(['a']);
  });

  it('takes what holds others only if all of it’s inside, and never a root', () => {
    expect(nodesInMarquee(index, { x: 90, y: 290, w: 100, h: 100 })).toEqual(['kid']);
    expect(nodesInMarquee(index, { x: 90, y: 290, w: 400, h: 400 })).toEqual(['box', 'kid']);
    expect(nodesInMarquee(index, { x: -10, y: -10, w: 2000, h: 2000 })).not.toContain('root');
  });

  it('commits nothing, and ends on release', () => {
    expect(run([down(null, 50, 50), move(350, 200), up])).toMatchObject({ g: IDLE, commits: [] });
  });
});

describe('dropping a gesture', () => {
  it('commits nothing when a move’s cancelled', () => {
    expect(run([down(node('a'), 100, 100), move(150, 100), { type: 'cancel' }])).toMatchObject({ g: IDLE, commits: [] });
  });

  it('puts the selection back when a marquee’s cancelled', () => {
    expect(run([down(null, 50, 50), move(350, 200), { type: 'cancel' }], { nodes: ['kid'], edges: ['e'] }).selection).toEqual({ nodes: ['kid'], edges: ['e'] });
  });

  it('ignores what comes after, until the next press', () => {
    const { g, commits } = run([down(node('a'), 100, 100), move(150, 100), { type: 'cancel' }, move(170, 100), up]);
    expect(g).toEqual(IDLE);
    expect(commits).toEqual([]);
  });

  it('ignores a second press during a gesture, as the first still owns the pointer', () => {
    const { g } = run([down(node('a'), 100, 100), move(150, 100), down(node('b'), 300, 100)]);
    expect(g.k === 'move' && g.ids).toEqual(['a']);
  });
});

describe('what’s under the pointer', () => {
  const what = {
    index,
    geometries: new Map([
      ['over-box', polylinePath([{ x: 100, y: 500 }, { x: 400, y: 500 }])],
      ['through-kid', polylinePath([{ x: 100, y: 370 }, { x: 400, y: 370 }])],
      ['open', polylinePath([{ x: 900, y: 100 }, { x: 950, y: 100 }])],
    ]),
    labels: [{ id: 'labelled', box: { x: 200, y: 520, w: 60, h: 11 } }],
  };
  const hit = (x: number, y: number, z = 1) => hitTestDiagram({ x, y }, what, z);

  it('takes a leaf, even with a line through it', () => {
    expect(hit(120, 120)).toEqual({ kind: 'node', id: 'a' });
    expect(hit(200, 370)).toEqual({ kind: 'node', id: 'kid' });
  });

  it('takes a line or a label over what holds things, and what holds things otherwise', () => {
    expect(hit(200, 500)).toEqual({ kind: 'edge', id: 'over-box' });
    expect(hit(210, 525)).toEqual({ kind: 'edge', id: 'labelled' });
    expect(hit(350, 560)).toEqual({ kind: 'node', id: 'box' });
    expect(hit(700, 500)).toEqual({ kind: 'node', id: 'p' });
  });

  it('never takes the root, which is the background', () => {
    expect(hit(900, 800)).toBeNull();
    expect(hit(2000, 2000)).toBeNull();
    expect(hit(925, 103)).toEqual({ kind: 'edge', id: 'open' });
  });

  it('goes by distance on screen', () => {
    expect(hit(925, 106)).toEqual({ kind: 'edge', id: 'open' });
    expect(hit(925, 107)).toBeNull();
    // At half size, that's 12 units.
    expect(hit(925, 111, 0.5)).toEqual({ kind: 'edge', id: 'open' });
    expect(hit(925, 106, 4)).toBeNull();
  });
});
