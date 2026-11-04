import { describe, expect, it } from 'vitest';
import { distToPolyline, type Pt, type Rect } from '@/lib/canvas-math';
import {
  ARROW_BROAD, ARROW_SLIM, anchorNormal, anchorPoint, ancestorsOf, arrowHead, closedD, connectorBounds, connectorPath, curvePath, descendantsOf, dirOf, distToConnector,
  diagramBounds, edgeAt, edgeGeometries, edgeGeometry, facingCurve, facingSides, indexDiagram, isInside, labelBox, loopingCurve, nearestAnchor, nearestSide, nodeAt, pointAlong, polygonPoints,
  polylinePath, portPoint, regionDividers, selfLoopPath, type ConnectorGeometry, type DiagramEdge, type DiagramNode,
} from './diagram-model';

const node = (id: string, x: number, y: number, w = 100, h = 40, extra: Partial<DiagramNode> = {}): DiagramNode => ({ id, x, y, w, h, ...extra });
const finite = (g: ConnectorGeometry) => {
  for (const v of [g.start.x, g.start.y, g.end.x, g.end.y, g.startDir.x, g.startDir.y, g.endDir.x, g.endDir.y, g.mid.x, g.mid.y, g.angle, ...g.pts.flatMap((p) => [p.x, p.y])]) expect(Number.isFinite(v)).toBe(true);
  expect(g.d).not.toMatch(/NaN|Infinity|undefined/);
};
const square = (pts: readonly Pt[]) => { for (let i = 1; i < pts.length; i++) expect(pts[i].x === pts[i - 1].x || pts[i].y === pts[i - 1].y).toBe(true); };
const inRect = (p: Pt, r: Rect, pad = 0.0001) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;

describe('nesting', () => {
  const nodes = [node('root', 0, 0, 500, 500), node('a', 10, 10, 200, 200, { parent: 'root' }), node('a1', 20, 40, 50, 20, { parent: 'a' }), node('a2', 80, 40, 50, 20, { parent: 'a' }), node('b', 300, 10, 50, 50, { parent: 'root' })];
  const index = indexDiagram(nodes);

  it('knows parents, children and depths', () => {
    expect(index.depth.get('root')).toBe(0);
    expect(index.depth.get('a1')).toBe(2);
    expect(index.children.get('a')?.map((n) => n.id)).toEqual(['a1', 'a2']);
    expect(index.children.get(null)?.map((n) => n.id)).toEqual(['root']);
    expect(ancestorsOf(index, 'a1')).toEqual(['a', 'root']);
    expect(descendantsOf(index, 'root')).toEqual(['a', 'a1', 'a2', 'b']);
    expect(isInside(index, 'a1', 'root')).toBe(true);
    expect(isInside(index, 'root', 'a1')).toBe(false);
    expect(isInside(index, 'a', 'a')).toBe(false);
  });

  it('treats a missing parent as none', () => {
    const i = indexDiagram([node('x', 0, 0, 1, 1, { parent: 'gone' })]);
    expect(i.parent.get('x')).toBeNull();
    expect(i.depth.get('x')).toBe(0);
    expect(ancestorsOf(i, 'x')).toEqual([]);
  });

  it('survives a loop of parents, and keeps what hangs off it', () => {
    const i = indexDiagram([node('a', 0, 0, 1, 1, { parent: 'b' }), node('b', 0, 0, 1, 1, { parent: 'a' }), node('c', 0, 0, 1, 1, { parent: 'a' }), node('self', 0, 0, 1, 1, { parent: 'self' })]);
    expect(i.parent.get('a')).toBeNull();
    expect(i.parent.get('b')).toBeNull();
    expect(i.parent.get('self')).toBeNull();
    expect(i.parent.get('c')).toBe('a');
    expect(i.depth.get('c')).toBe(1);
    expect(ancestorsOf(i, 'c')).toEqual(['a']);
    expect(descendantsOf(i, 'a')).toEqual(['c']);
  });

  it('terminates with a duplicate id, whichever node the id ends up meaning', () => {
    const i = indexDiagram([node('y', 0, 0, 1, 1), node('x', 0, 0, 1, 1, { parent: 'y' }), node('x', 0, 0, 1, 1), node('y', 0, 0, 1, 1, { parent: 'x' })]);
    expect(i.depth.size).toBeGreaterThan(0);
    expect(ancestorsOf(i, 'x').length).toBeLessThan(4);
    expect(descendantsOf(i, 'y').length).toBeLessThan(4);
  });
});

describe('anchors', () => {
  const box = { x: 100, y: 100, w: 100, h: 40 };

  it('finds the midpoint of each side, and places along it', () => {
    expect(anchorPoint(box, 't')).toEqual({ x: 150, y: 100 });
    expect(anchorPoint(box, 'r')).toEqual({ x: 200, y: 120 });
    expect(anchorPoint(box, 'b')).toEqual({ x: 150, y: 140 });
    expect(anchorPoint(box, 'l')).toEqual({ x: 100, y: 120 });
    expect(anchorPoint(box, 't', 0)).toEqual({ x: 100, y: 100 });
    expect(anchorPoint(box, 'r', 1)).toEqual({ x: 200, y: 140 });
  });

  it('turns with a rotated box', () => {
    const turned = { ...box, rot: 90 };
    const r = anchorPoint(turned, 'r');
    expect(r.x).toBeCloseTo(150);
    expect(r.y).toBeCloseTo(170);
    const n = anchorNormal(turned, 'r');
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(1);
  });

  it('finds the nearest side, topmost box first, and honors exclude and tol', () => {
    const boxes = [{ id: 'under', ...box }, { id: 'over', ...box }];
    expect(nearestAnchor({ x: 195, y: 120 }, boxes, 0)?.id).toBe('over');
    expect(nearestAnchor({ x: 195, y: 120 }, boxes, 0)?.side).toBe('r');
    expect(nearestAnchor({ x: 195, y: 120 }, boxes, 0, 'over')?.id).toBe('under');
    expect(nearestAnchor({ x: 230, y: 120 }, boxes, 10)).toBeNull();
    expect(nearestAnchor({ x: 230, y: 120 }, boxes, 40)?.side).toBe('r');
    expect(nearestSide(box, { x: 150, y: 90 }).side).toBe('t');
  });

  it('hit tests a rotated item in its own frame', () => {
    // Turned a quarter, this box is 40 wide and 100 tall about (150, 120): (150, 165) is on it, (195, 120) isn't.
    const boxes = [{ id: 'a', ...box, rot: 90 }];
    expect(nearestAnchor({ x: 150, y: 165 }, boxes, 0)?.id).toBe('a');
    expect(nearestAnchor({ x: 195, y: 120 }, boxes, 0)).toBeNull();
  });

  it('places a port on its side, facing out', () => {
    const end = portPoint(box, { id: 'p', side: 'b', at: 0.25 });
    expect(end.p).toEqual({ x: 125, y: 140 });
    expect(end.n).toEqual({ x: 0, y: 1 });
  });
});

describe('routes', () => {
  const a = { p: { x: 0, y: 0 }, n: { x: 1, y: 0 } };
  const b = { p: { x: 200, y: 100 }, n: { x: -1, y: 0 } };

  it('runs straight', () => {
    const g = connectorPath('straight', a, b);
    expect(g.pts).toEqual([a.p, b.p]);
    expect(g.d).toBe('M0 0L200 100');
    expect(g.mid).toEqual({ x: 100, y: 50 });
    expect(g.endDir.x).toBeCloseTo(200 / Math.hypot(200, 100));
    expect(g.startDir.x).toBeCloseTo(-200 / Math.hypot(200, 100));
  });

  it('runs an elbow square, leaving each end the way it faces', () => {
    const g = connectorPath('elbow', a, b);
    expect(g.pts[0]).toEqual(a.p);
    expect(g.pts[1]).toEqual({ x: 28, y: 0 });
    expect(g.pts[g.pts.length - 2]).toEqual({ x: 172, y: 100 });
    square(g.pts);
    expect(g.endDir).toEqual({ x: 1, y: 0 });
    // Neighbouring faces meet in one bend.
    const turned = connectorPath('elbow', a, { p: { x: 200, y: 100 }, n: { x: 0, y: -1 } });
    expect(turned.pts).toHaveLength(5);
    square(turned.pts);
    // Facing the same way, both vertical.
    square(connectorPath('elbow', { p: a.p, n: { x: 0, y: 1 } }, { p: b.p, n: { x: 0, y: -1 } }).pts);
  });

  it('gives a free end the direction of the other end', () => {
    const g = connectorPath('elbow', { p: { x: 0, y: 0 }, n: null }, { p: { x: 10, y: 200 }, n: null });
    square(g.pts);
    expect(g.pts[1]).toEqual({ x: 0, y: 28 });
  });

  it('curves, with its midpoint on the curve and the tangent at the end', () => {
    const g = connectorPath('curve', a, b);
    expect(g.d.startsWith('M0 0C')).toBe(true);
    expect(g.pts).toHaveLength(25);
    expect(g.pts[0]).toEqual(a.p);
    expect(g.pts[24]).toEqual(b.p);
    expect(distToConnector(g, g.mid)).toBeLessThan(0.5);
    // It arrives from the left, the way `b` faces.
    expect(g.angle).toBeCloseTo(0);
    expect(g.endDir.x).toBeGreaterThan(0.9);
  });

  it('does not return NaN when both ends are the same point', () => {
    for (const route of ['straight', 'elbow', 'curve'] as const) finite(connectorPath(route, { p: { x: 5, y: 5 }, n: null }, { p: { x: 5, y: 5 }, n: null }));
  });

  it('skips points on top of each other when working out which way an end points', () => {
    const g = polylinePath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }]);
    expect(g.endDir).toEqual({ x: 1, y: 0 });
    expect(g.startDir).toEqual({ x: -1, y: 0 });
    finite(polylinePath([]));
    finite(polylinePath([{ x: 3, y: 4 }]));
  });

  it('measures halfway along a polyline by length', () => {
    expect(polylinePath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 300 }]).mid).toEqual({ x: 100, y: 100 });
    expect(pointAlong([{ x: 0, y: 0 }, { x: 10, y: 0 }], 0).point).toEqual({ x: 0, y: 0 });
    expect(pointAlong([{ x: 0, y: 0 }, { x: 10, y: 0 }], 1).point).toEqual({ x: 10, y: 0 });
    expect(pointAlong([{ x: 0, y: 0 }, { x: 10, y: 0 }], 7).point).toEqual({ x: 10, y: 0 });
    expect(pointAlong([]).point).toEqual({ x: 0, y: 0 });
  });

  it('leaves a box from its facing edge', () => {
    const left = { x: 0, y: 0, w: 100, h: 200 }, right = { x: 300, y: 0, w: 100, h: 200 }, below = { x: 0, y: 600, w: 100, h: 200 };
    const across = facingCurve(left, right, null, 10);
    expect(across.start).toEqual({ x: 100, y: 100 });
    expect(across.end).toEqual({ x: 290, y: 100 });
    expect(facingCurve(right, left, null, 10).start).toEqual({ x: 300, y: 100 });
    const down = facingCurve(left, below, null, 10);
    expect(down.start).toEqual({ x: 50, y: 200 });
    expect(down.end).toEqual({ x: 50, y: 590 });
    expect(facingCurve(left, right, { x: 20, y: 20, w: 40, h: 20 }, 10).start).toEqual({ x: 60, y: 30 });
  });

  it('swings round to a box that is behind the point, and offsets to its side', () => {
    const to = { x: 400, y: 100, w: 200, h: 200 };
    const ahead = loopingCurve({ x: 100, y: 150 }, to);
    expect(ahead.end).toEqual({ x: 390, y: 150 });
    const behind = loopingCurve({ x: 500, y: 0 }, { x: 100, y: 300, w: 200, h: 100 });
    expect(behind.end).toEqual({ x: 200, y: 290 });
    const above = loopingCurve({ x: 500, y: 900 }, { x: 100, y: 300, w: 200, h: 100 });
    expect(above.end).toEqual({ x: 200, y: 410 });
    const moved = loopingCurve({ x: 100, y: 150 }, to, 20);
    expect(moved.start.y).toBeCloseTo(170);
    expect(moved.end.y).toBeCloseTo(170);
    // The point it was given is left alone.
    const given = { x: 100, y: 150 };
    loopingCurve(given, to, 20);
    expect(given).toEqual({ x: 100, y: 150 });
  });
});

describe('arrowheads', () => {
  it('points along the direction, with the tip first', () => {
    const [tip, l, r] = arrowHead({ x: 100, y: 50 }, { x: 1, y: 0 }, 10);
    expect(tip).toEqual({ x: 100, y: 50 });
    expect(l).toEqual({ x: 90, y: 55.5 });
    expect(r).toEqual({ x: 90, y: 44.5 });
  });

  it('has a slim shape whose sides are as long as its size', () => {
    const [tip, l, r] = arrowHead({ x: 0, y: 0 }, dirOf(1.2), 9, ARROW_SLIM);
    expect(Math.hypot(l.x - tip.x, l.y - tip.y)).toBeCloseTo(9);
    expect(Math.hypot(r.x - tip.x, r.y - tip.y)).toBeCloseTo(9);
    expect(Math.atan2(tip.y - l.y, tip.x - l.x)).toBeCloseTo(1.2 - 0.45);
    expect(Math.atan2(tip.y - r.y, tip.x - r.x)).toBeCloseTo(1.2 + 0.45);
    expect(ARROW_BROAD.length).toBe(1);
  });

  it('writes itself as a polygon and a path', () => {
    const corners = arrowHead({ x: 0, y: 0 }, { x: 1, y: 0 }, 2);
    expect(polygonPoints(corners)).toBe('0,0 -2,1.1 -2,-1.1');
    expect(closedD(corners)).toBe('M0 0L-2 1.1L-2 -1.1Z');
    expect(closedD([])).toBe('');
  });
});

describe('labels', () => {
  const size = { w: 40, h: 12 };

  it('sits above a horizontal line', () => {
    const r = labelBox([{ x: 0, y: 100 }, { x: 200, y: 100 }], size);
    expect(r).toEqual({ x: 80, y: 86, w: 40, h: 12 });
  });

  it('sits above whichever way the line runs', () => {
    expect(labelBox([{ x: 200, y: 100 }, { x: 0, y: 100 }], size).y).toBe(86);
  });

  it('sits beside a vertical line, whichever way it runs', () => {
    for (const pts of [[{ x: 50, y: 0 }, { x: 50, y: 200 }], [{ x: 50, y: 200 }, { x: 50, y: 0 }]]) {
      const r = labelBox(pts, size);
      expect(r.x).toBe(52);
      expect(r.y).toBe(94);
    }
  });

  it('does not touch a slanted line', () => {
    const pts = [{ x: 0, y: 0 }, { x: 300, y: 200 }];
    const r = labelBox(pts, size);
    for (const corner of [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x, y: r.y + r.h }, { x: r.x + r.w, y: r.y + r.h }]) expect(distToPolyline(corner, pts)).toBeGreaterThan(1.9);
  });

  it('goes where it says along the line', () => {
    expect(labelBox([{ x: 0, y: 0 }, { x: 100, y: 0 }], size, { t: 0, gap: 0 }).x).toBe(-20);
    expect(labelBox([{ x: 0, y: 0 }, { x: 100, y: 0 }], size, { t: 1, gap: 0 }).x).toBe(80);
  });
});

describe('edge routes', () => {
  const nodes = [
    node('a', 0, 0), node('b', 300, 0), node('below', 0, 300),
    node('box', 500, 500, 400, 300), node('kid', 540, 700, 100, 40, { parent: 'box' }),
    node('ported', 0, 500, 100, 40, { ports: [{ id: 'out', side: 'r' }, { id: 'up', side: 't', at: 0.25 }, { id: 'in', side: 'l' }] }),
    node('same1', 900, 0), node('same2', 900, 0),
  ];
  const index = indexDiagram(nodes);
  const route = (e: Partial<DiagramEdge> & { from: string; to: string }) => edgeGeometry({ id: 'e', ...e }, index)!;

  it('takes the facing sides', () => {
    expect(facingSides(nodes[0], nodes[1])).toEqual({ from: 'r', to: 'l' });
    expect(facingSides(nodes[1], nodes[0])).toEqual({ from: 'l', to: 'r' });
    expect(facingSides(nodes[0], nodes[2])).toEqual({ from: 'b', to: 't' });
    const g = route({ from: 'a', to: 'b' });
    expect(g.start).toEqual({ x: 100, y: 20 });
    expect(g.end).toEqual({ x: 300, y: 20 });
    square(g.pts);
  });

  it('uses the points it was given, whatever the nodes say', () => {
    const points = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 9 }];
    expect(route({ from: 'a', to: 'b', points }).pts).toEqual(points);
    expect(route({ from: 'a', to: 'gone', points }).pts).toEqual(points);
  });

  it('returns null when an end does not exist', () => {
    expect(edgeGeometry({ id: 'e', from: 'a', to: 'gone' }, index)).toBeNull();
    expect(edgeGeometry({ id: 'e', from: 'gone', to: 'a' }, index)).toBeNull();
  });

  it('honors each route', () => {
    expect(route({ from: 'a', to: 'b', route: 'straight' }).pts).toHaveLength(2);
    expect(route({ from: 'a', to: 'b', route: 'curve' }).d).toContain('C');
  });

  it('honors ports', () => {
    const g = route({ from: 'ported', fromPort: 'up', to: 'a' });
    expect(g.start).toEqual({ x: 25, y: 500 });
    expect(g.pts[1]).toEqual({ x: 25, y: 472 });
    square(g.pts);
    // An unknown port falls back to the node.
    expect(route({ from: 'a', fromPort: 'nope', to: 'b' }).start).toEqual({ x: 100, y: 20 });
  });

  it('loops a self-transition outside the node, top by default', () => {
    const g = route({ from: 'a', to: 'a' });
    finite(g);
    square(g.pts);
    expect(g.start.y).toBe(0);
    expect(g.end.y).toBe(0);
    expect(g.start.x).not.toBe(g.end.x);
    // It leaves and comes back, and everything between stands clear of the node.
    for (const p of g.pts.slice(1, -1)) expect(p.y).toBeLessThan(0);
    // Its arrow points down, into the node.
    expect(g.endDir).toEqual({ x: 0, y: 1 });
    expect(labelBox(g.pts, { w: 40, h: 12 }).y + 12).toBeLessThan(g.pts[1].y);
  });

  it('loops between two ports of the same node, without crossing it', () => {
    const box = nodes.find((n) => n.id === 'ported')!;
    const clear = (g: ConnectorGeometry) => {
      finite(g);
      square(g.pts);
      for (const p of g.pts.slice(1, -1)) expect(inRect(p, box, -0.001)).toBe(false);
    };
    clear(route({ from: 'ported', fromPort: 'out', to: 'ported', toPort: 'up' })); // neighbours
    clear(route({ from: 'ported', fromPort: 'in', to: 'ported', toPort: 'out' })); // opposite, sideways
    clear(route({ from: 'ported', fromPort: 'up', to: 'ported', toPort: 'up' })); // the same one
    const tb = selfLoopPath(box, portPoint(box, { id: 't', side: 't' }), portPoint(box, { id: 'b', side: 'b' }));
    clear(tb); // opposite, up and down
  });

  it('nests a node’s self-loops, so they can be told apart', () => {
    const two = edgeGeometries([{ id: 'x', from: 'a', to: 'a' }, { id: 'y', from: 'a', to: 'a' }], index);
    const [x, y] = [two.get('x')!, two.get('y')!];
    expect(y.pts[1].y).toBeLessThan(x.pts[1].y);
    expect(y.start.x).toBeLessThan(x.start.x);
  });

  it('runs an edge between a compound and its own child inside the compound, either way round', () => {
    const box = nodes.find((n) => n.id === 'box')!;
    const kid = nodes.find((n) => n.id === 'kid')!;
    const check = (g: ConnectorGeometry) => {
      finite(g);
      for (const p of g.pts) expect(inRect(p, box)).toBe(true);
    };
    const down = route({ from: 'box', to: 'kid' });
    check(down);
    // The kid is nearest the left wall, so that's where it comes from.
    expect(down.start).toEqual({ x: 500, y: 720 });
    expect(down.end).toEqual({ x: 540, y: 720 });
    expect(down.endDir).toEqual({ x: 1, y: 0 });
    const up = route({ from: 'kid', to: 'box' });
    check(up);
    expect(up.start).toEqual({ x: 540, y: 720 });
    expect(up.end).toEqual({ x: 500, y: 720 });
    check(route({ from: 'box', to: 'kid', route: 'curve' }));
    check(route({ from: 'box', to: 'kid', route: 'straight' }));
    // It doesn't run across the child.
    expect(distToConnector(down, { x: 590, y: 720 })).toBeGreaterThan(40);
  });

  it('meets a child dragged through its parent’s wall on its near side', () => {
    const i = indexDiagram([node('box', 0, 0, 100, 100), node('kid', 200, 30, 50, 40, { parent: 'box' })]);
    const g = edgeGeometry({ id: 'e', from: 'box', to: 'kid' }, i)!;
    expect(g.start).toEqual({ x: 100, y: 50 });
    expect(g.end).toEqual({ x: 200, y: 50 });
  });

  it('gives a finite route to two nodes in the same place', () => {
    for (const r of ['elbow', 'straight', 'curve'] as const) {
      const g = route({ from: 'same1', to: 'same2', route: r });
      finite(g);
      expect(distToConnector(g, g.mid)).toBeLessThan(1);
    }
    const g = route({ from: 'same1', to: 'same2' });
    expect(g.start).not.toEqual(g.end);
  });

  it('shares a side out among parallel edges, in the order of what they lead to', () => {
    const edges: DiagramEdge[] = [{ id: '1', from: 'a', to: 'b' }, { id: '2', from: 'a', to: 'b' }, { id: '3', from: 'a', to: 'b' }];
    const all = edgeGeometries(edges, index);
    const ys = ['1', '2', '3'].map((id) => all.get(id)!.start.y);
    expect(new Set(ys).size).toBe(3);
    expect(ys).toEqual([10, 20, 30]);
    // One edge alone stays in the middle.
    expect(edgeGeometries([edges[0]], index).get('1')!.start).toEqual({ x: 100, y: 20 });
    // Those that lead lower sit lower, so they don't cross on the way out.
    const i = indexDiagram([node('s', 0, 100), node('hi', 300, 0), node('lo', 300, 200)]);
    const fan = edgeGeometries([{ id: 'lo', from: 's', to: 'lo' }, { id: 'hi', from: 's', to: 'hi' }], i);
    expect(fan.get('hi')!.start.y).toBeLessThan(fan.get('lo')!.start.y);
    // What can't be drawn isn't there.
    expect(edgeGeometries([{ id: 'x', from: 'a', to: 'gone' }], index).has('x')).toBe(false);
  });
});

describe('hit tests', () => {
  const nodes = [node('root', 0, 0, 500, 500), node('c', 10, 10, 200, 200, { parent: 'root' }), node('kid', 20, 40, 50, 20, { parent: 'c' })];
  const index = indexDiagram(nodes);

  it('finds the deepest node, however they were listed', () => {
    expect(nodeAt({ x: 30, y: 50 }, index)?.id).toBe('kid');
    expect(nodeAt({ x: 100, y: 100 }, index)?.id).toBe('c');
    expect(nodeAt({ x: 400, y: 400 }, index)?.id).toBe('root');
    expect(nodeAt({ x: 900, y: 900 }, index)).toBeNull();
    const shuffled = indexDiagram([nodes[2], nodes[0], nodes[1]]);
    expect(nodeAt({ x: 30, y: 50 }, shuffled)?.id).toBe('kid');
  });

  it('takes the last drawn of two at the same depth', () => {
    const i = indexDiagram([node('a', 0, 0), node('b', 0, 0)]);
    expect(nodeAt({ x: 5, y: 5 }, i)?.id).toBe('b');
  });

  it('reaches `pad` out', () => {
    expect(nodeAt({ x: 505, y: 100 }, index)).toBeNull();
    expect(nodeAt({ x: 505, y: 100 }, index, 6)?.id).toBe('root');
  });

  it('finds the nearest edge within tolerance', () => {
    const a = polylinePath([{ x: 0, y: 0 }, { x: 100, y: 0 }]), b = polylinePath([{ x: 0, y: 10 }, { x: 100, y: 10 }]);
    const m = new Map([['a', a], ['b', b]]);
    expect(edgeAt({ x: 50, y: 2 }, m, 4)).toBe('a');
    expect(edgeAt({ x: 50, y: 8 }, m, 4)).toBe('b');
    expect(edgeAt({ x: 50, y: 5 }, m, 6)).toBe('b');
    expect(edgeAt({ x: 50, y: 50 }, m, 6)).toBeNull();
    expect(connectorBounds(b)).toEqual({ x: 0, y: 10, w: 100, h: 0 });
  });

  it('hits a curve between its samples, where the old sampled distance missed', () => {
    const g = curvePath({ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 0 }, { x: 1600, y: 0 });
    // A long straight-looking curve: halfway between any two samples is still on the line.
    for (let x = 3; x < 1600; x += 41) expect(distToConnector(g, { x, y: 0 })).toBeLessThan(0.001);
  });
});

describe('what else gets drawn', () => {
  it('puts a line across each gap between stacked regions, wall to wall', () => {
    const i = indexDiagram([
      node('p', 0, 0, 400, 300, { kind: 'parallel' }),
      node('b', 10, 110, 100, 90, { kind: 'region', parent: 'p' }),
      node('a', 50, 10, 300, 80, { kind: 'region', parent: 'p' }),
      node('c', 10, 220, 200, 70, { kind: 'region', parent: 'p' }),
    ]);
    expect(regionDividers(i)).toEqual([
      { id: 'p/1', x1: 0, x2: 400, y1: 100, y2: 100 },
      { id: 'p/2', x1: 0, x2: 400, y1: 210, y2: 210 },
    ]);
  });

  it('stands the line up between regions side by side', () => {
    const i = indexDiagram([node('p', 0, 0, 400, 100, { kind: 'parallel' }), node('a', 10, 10, 100, 80, { kind: 'region', parent: 'p' }), node('b', 200, 10, 100, 80, { kind: 'region', parent: 'p' })]);
    expect(regionDividers(i)).toEqual([{ id: 'p/1', x1: 155, x2: 155, y1: 0, y2: 100 }]);
  });

  it('draws no line for one region, or for a parallel state that has none', () => {
    expect(regionDividers(indexDiagram([node('p', 0, 0, 400, 100, { kind: 'parallel' }), node('a', 10, 10, 100, 80, { kind: 'region', parent: 'p' })]))).toEqual([]);
    expect(regionDividers(indexDiagram([node('p', 0, 0, 400, 100, { kind: 'parallel' }), node('a', 10, 10, 100, 80, { parent: 'p' }), node('b', 10, 10, 100, 80, { parent: 'p' })]))).toEqual([]);
    expect(regionDividers(indexDiagram([node('c', 0, 0, 400, 100, { kind: 'compound' }), node('a', 10, 10, 100, 80, { kind: 'region', parent: 'c' }), node('b', 200, 10, 100, 80, { kind: 'region', parent: 'c' })]))).toEqual([]);
  });

  it('takes in the nodes, the routes that stray past them and the labels', () => {
    const g = polylinePath([{ x: 0, y: 0 }, { x: 500, y: -50 }]);
    expect(diagramBounds([{ x: 0, y: 0, w: 100, h: 100 }])).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(diagramBounds([{ x: 0, y: 0, w: 100, h: 100 }], [g])).toEqual({ x: 0, y: -50, w: 500, h: 150 });
    expect(diagramBounds([{ x: 0, y: 0, w: 100, h: 100 }], [g], [{ x: -20, y: 90, w: 40, h: 40 }])).toEqual({ x: -20, y: -50, w: 520, h: 180 });
    expect(diagramBounds([])).toBeNull();
  });
});
