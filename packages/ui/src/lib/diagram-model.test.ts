import { describe, expect, it } from 'vitest';
import { distToPolyline, type Pt, type Rect } from '@/lib/canvas-math';
import {
  ARROW_BROAD, ARROW_SLIM, anchorNormal, anchorPoint, ancestorsOf, arrowHead, closedD, connectorBounds, connectorPath, curvePath, descendantsOf, dirOf, distToConnector,
  addConnection, checkConnection, deleteItems, diagramBounds, edgeAt, edgeGeometries, edgeGeometry, edgesAtPoint, facingCurve, facingSides, indexDiagram, isInside, labelBox, loopingCurve, moveEdgeEnd, moveNodes, nearestAnchor, nearestSide, nodeAt, pointAlong, polygonPoints,
  polylinePath, portPoint, regionDividers, renderWindow, rerouteLabel, rerouteOrthogonal, selfLoopPath, simplifyRoute, type ConnectorGeometry, type DiagramEdge, type DiagramNode,
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

  it('goes across the wider gap, and never doubles back through a box', () => {
    const box = (x: number, y: number) => ({ x, y, w: 130, h: 36 });
    // Their centers are further apart across, but they overlap across, so it has to be up and down.
    const sides = facingSides(box(0, 0), box(110, 90));
    expect(sides).toEqual({ from: 'b', to: 't' });
    const nodes2 = indexDiagram([node('a', 0, 0, 130, 36), node('c', 110, 90, 130, 36)]);
    const g = edgeGeometry({ id: 'e', from: 'a', to: 'c' }, nodes2)!;
    square(g.pts);
    expect(g.start).toEqual({ x: 65, y: 36 });
    expect(g.end).toEqual({ x: 175, y: 90 });
    for (let i = 1; i < g.pts.length; i++) expect(g.pts[i].y).toBeGreaterThanOrEqual(g.pts[i - 1].y);
    // And the other way round.
    expect(facingSides(box(0, 0), box(90, 300))).toEqual({ from: 'b', to: 't' });
    expect(facingSides(box(0, 0), box(300, 10))).toEqual({ from: 'r', to: 'l' });
    expect(facingSides(box(300, 10), box(0, 0))).toEqual({ from: 'l', to: 'r' });
    // Apart both ways: the wider gap.
    expect(facingSides(box(0, 0), box(400, 60))).toEqual({ from: 'r', to: 'l' });
    expect(facingSides(box(0, 0), box(140, 300))).toEqual({ from: 'b', to: 't' });
    // Overlapping both ways: their centers.
    expect(facingSides(box(0, 0), box(50, 5))).toEqual({ from: 'r', to: 'l' });
    expect(facingSides(box(0, 0), box(5, 20))).toEqual({ from: 'b', to: 't' });
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

  it('finds every edge as near as the nearest, in order, and edgeAt takes the last of them', () => {
    const a = polylinePath([{ x: 0, y: 0 }, { x: 100, y: 0 }]), b = polylinePath([{ x: 0, y: 10 }, { x: 100, y: 10 }]);
    const m = new Map([['a', a], ['same', a], ['b', b]]);
    expect(edgesAtPoint({ x: 50, y: 2 }, m, 4)).toEqual(['a', 'same']);
    expect(edgeAt({ x: 50, y: 2 }, m, 4)).toBe('same');
    expect(edgesAtPoint({ x: 50, y: 8 }, m, 4)).toEqual(['b']);
    expect(edgesAtPoint({ x: 50, y: 5 }, m, 6)).toEqual(['a', 'same', 'b']);
    expect(edgesAtPoint({ x: 50, y: 50 }, m, 6)).toEqual([]);
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

describe('routes that follow', () => {
  it('leaves a route alone when nothing moved', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(rerouteOrthogonal(pts, { x: 0, y: 0 }, { x: 0, y: 0 })).toEqual(pts);
  });

  it('carries the whole route when both ends move together', () => {
    expect(rerouteOrthogonal([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], { x: 5, y: 7 }, { x: 5, y: 7 })).toEqual([{ x: 5, y: 7 }, { x: 15, y: 7 }, { x: 15, y: 17 }]);
  });

  it('keeps a route square, when one end moves', () => {
    const pts = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 }];
    const out = rerouteOrthogonal(pts, { x: 10, y: 30 }, { x: 0, y: 0 });
    square(out);
    expect(out[0]).toEqual({ x: 10, y: 30 });
    expect(out[3]).toEqual({ x: 100, y: 100 });
    const both = rerouteOrthogonal(pts, { x: 10, y: 30 }, { x: -20, y: 40 });
    square(both);
    expect(both[3]).toEqual({ x: 80, y: 140 });
  });

  it('works on one bend, moved by either end', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const out = rerouteOrthogonal(pts, { x: 0, y: 20 }, { x: 30, y: 0 });
    square(out);
    expect(out).toEqual([{ x: 0, y: 20 }, { x: 130, y: 20 }, { x: 130, y: 100 }]);
  });

  it('gives a straight run a step when it can’t stay straight, and leaves it straight when it can', () => {
    const level = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const out = rerouteOrthogonal(level, { x: 0, y: 0 }, { x: 0, y: 50 });
    square(out);
    expect(out).toHaveLength(4);
    expect(out[3]).toEqual({ x: 100, y: 50 });
    expect(rerouteOrthogonal(level, { x: 0, y: 0 }, { x: 30, y: 0 })).toEqual([{ x: 0, y: 0 }, { x: 130, y: 0 }]);
    const upright = rerouteOrthogonal([{ x: 0, y: 0 }, { x: 0, y: 100 }], { x: 40, y: 0 }, { x: 0, y: 0 });
    square(upright);
    expect(upright).toHaveLength(4);
  });

  it('moves only the ends of what isn’t square', () => {
    expect(rerouteOrthogonal([{ x: 0, y: 0 }, { x: 100, y: 50 }], { x: 5, y: 5 }, { x: 0, y: 0 })).toEqual([{ x: 5, y: 5 }, { x: 100, y: 50 }]);
  });

  it('cleans a route up first, so a stray point can’t bend it', () => {
    expect(simplifyRoute([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }])).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    const out = rerouteOrthogonal([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], { x: 0, y: 20 }, { x: 0, y: 0 });
    square(out);
  });

  it('keeps a label beside its run', () => {
    const before = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 100 }];
    const after = rerouteOrthogonal(before, { x: 0, y: 30 }, { x: 0, y: 0 });
    // By the first run, which came down 30.
    expect(rerouteLabel({ x: 40, y: -14, w: 20, h: 11 }, before, after)).toEqual({ x: 40, y: 16, w: 20, h: 11 });
    // By the last, which didn't.
    expect(rerouteLabel({ x: 140, y: 86, w: 20, h: 11 }, before, after)).toEqual({ x: 140, y: 86, w: 20, h: 11 });
  });
});

describe('moving nodes', () => {
  const nodes: DiagramNode[] = [
    node('a', 0, 0), node('b', 300, 0),
    node('box', 500, 0, 300, 300, { kind: 'compound' }), node('kid', 550, 100, 100, 40, { parent: 'box' }), node('kid2', 660, 100, 100, 40, { parent: 'box' }),
    node('far', 0, 500),
  ];
  const edges: DiagramEdge[] = [
    { id: 'ab', from: 'a', to: 'b', points: [{ x: 100, y: 20 }, { x: 300, y: 20 }], label: 'x', labelBox: { x: 180, y: 6, w: 40, h: 11 } },
    { id: 'kk', from: 'kid', to: 'kid2', points: [{ x: 650, y: 120 }, { x: 660, y: 120 }] },
    { id: 'bx', from: 'b', to: 'box', points: [{ x: 400, y: 20 }, { x: 500, y: 20 }] },
    { id: 'free', from: 'a', to: 'far' },
    { id: 'other', from: 'far', to: 'far' },
  ];

  it('moves what’s asked, and follows with its edges, and leaves the rest the same object', () => {
    const out = moveNodes(nodes, edges, ['a'], 10, 40);
    expect(out.nodes[0]).toMatchObject({ x: 10, y: 40 });
    expect(out.nodes[1]).toBe(nodes[1]);
    expect(out.edges[0].points![0]).toEqual({ x: 110, y: 60 });
    expect(out.edges[0].points![out.edges[0].points!.length - 1]).toEqual({ x: 300, y: 20 });
    square(out.edges[0].points!);
    expect(out.edges[1]).toBe(edges[1]);
    expect(out.edges[4]).toBe(edges[4]);
    // An edge with no route of its own has nothing to change: it's worked out from where the nodes are.
    expect(out.edges[3]).toBe(edges[3]);
  });

  it('takes a compound’s children with it, and the edges between them whole', () => {
    const out = moveNodes(nodes, edges, ['box'], 100, 50);
    const byId = new Map(out.nodes.map((n) => [n.id, n]));
    expect(byId.get('kid')).toMatchObject({ x: 650, y: 150 });
    expect(byId.get('kid2')).toMatchObject({ x: 760, y: 150 });
    expect(out.edges[1].points).toEqual([{ x: 750, y: 170 }, { x: 760, y: 170 }]);
    expect(out.edges[2].points![0]).toEqual({ x: 400, y: 20 });
    expect(out.edges[2].points!.at(-1)).toEqual({ x: 600, y: 70 });
  });

  it('doesn’t move a child twice when its parent’s moving too', () => {
    const out = moveNodes(nodes, edges, ['box', 'kid'], 100, 0);
    expect(out.nodes.find((n) => n.id === 'kid')).toMatchObject({ x: 650 });
  });

  it('keeps a label by its route', () => {
    const out = moveNodes(nodes, edges, ['a', 'b'], 20, 30);
    expect(out.edges[0].labelBox).toEqual({ x: 200, y: 36, w: 40, h: 11 });
  });

  it('grows a compound when a child’s dragged to its wall, and shrinks it again when it comes back', () => {
    const out = moveNodes(nodes, edges, ['kid2'], 100, 0);
    const box = out.nodes.find((n) => n.id === 'box')!;
    // kid2's right edge is now at 860, and the compound keeps 12 of air.
    expect(box).toMatchObject({ x: 500, y: 0, w: 372, h: 300 });
    const back = moveNodes(nodes, edges, ['kid2'], 5, 0);
    expect(back.nodes.find((n) => n.id === 'box')).toBe(nodes[2]);
  });

  it('grows up the chain, and carries an edge on a wall with that wall', () => {
    const nested: DiagramNode[] = [node('outer', 0, 0, 400, 300, { kind: 'compound' }), node('inner', 20, 40, 200, 200, { kind: 'compound', parent: 'outer' }), node('kid', 40, 80, 100, 40, { parent: 'inner' }), node('o', 600, 100)];
    const wall: DiagramEdge[] = [{ id: 'w', from: 'outer', to: 'o', points: [{ x: 400, y: 120 }, { x: 600, y: 120 }] }];
    const out = moveNodes(nested, wall, ['kid'], 500, 0);
    expect(out.nodes[1].w).toBe(540 + 100 + 12 - 20);
    expect(out.nodes[0].x + out.nodes[0].w).toBe(out.nodes[1].x + out.nodes[1].w + 12);
    expect(out.edges[0].points![0].x).toBe(out.nodes[0].x + out.nodes[0].w);
  });

  it('makes room for a compound’s title at the top', () => {
    const out = moveNodes(nodes, edges, ['kid'], 0, -90);
    expect(out.nodes.find((n) => n.id === 'box')).toMatchObject({ y: 10 - 32, h: 322 });
  });

  it('ignores what isn’t there, and returns the same objects when nothing moved', () => {
    const out = moveNodes(nodes, edges, ['gone'], 10, 10);
    expect(out.nodes[0]).toBe(nodes[0]);
    expect(out.edges[0]).toBe(edges[0]);
    expect(moveNodes(nodes, edges, ['a'], 0, 0).nodes[0]).toBe(nodes[0]);
  });
});

describe('deleting', () => {
  const nodes: DiagramNode[] = [node('a', 0, 0), node('box', 500, 0, 300, 300, { kind: 'compound' }), node('kid', 550, 100, 100, 40, { parent: 'box' }), node('b', 0, 200)];
  const edges: DiagramEdge[] = [{ id: 'ak', from: 'a', to: 'kid' }, { id: 'ab', from: 'a', to: 'b' }, { id: 'bb', from: 'b', to: 'b' }];

  it('takes a node’s edges with it', () => {
    const out = deleteItems(nodes, edges, { nodes: ['a'], edges: [] });
    expect(out.nodes.map((n) => n.id)).toEqual(['box', 'kid', 'b']);
    expect(out.edges.map((e) => e.id)).toEqual(['bb']);
  });

  it('takes a compound’s children, and edges to them', () => {
    const out = deleteItems(nodes, edges, { nodes: ['box'], edges: [] });
    expect(out.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(out.edges.map((e) => e.id)).toEqual(['ab', 'bb']);
  });

  it('takes an edge on its own', () => {
    const out = deleteItems(nodes, edges, { nodes: [], edges: ['ab'] });
    expect(out.nodes).toHaveLength(4);
    expect(out.edges.map((e) => e.id)).toEqual(['ak', 'bb']);
  });

  it('ignores what isn’t there', () => {
    expect(deleteItems(nodes, edges, { nodes: ['gone'], edges: ['gone'] }).nodes).toHaveLength(4);
  });
});

describe('connections', () => {
  const nodes: DiagramNode[] = [
    node('w', 0, 0, 100, 100, { ports: [{ id: 'sql', side: 'r', kind: 'sql', label: 'DB', direction: 'out' }, { id: 'files', side: 'r', at: 0.8, kind: 'files', direction: 'out' }, { id: 'in', side: 'l', direction: 'in' }, { id: 'both', side: 't' }] }),
    node('d', 300, 0, 100, 40, { ports: [{ id: 'in', side: 'l', kind: 'sql', label: 'queries', direction: 'in' }, { id: 'out', side: 'r', direction: 'out' }] }),
    node('plain', 0, 300), node('plain2', 300, 300),
  ];
  const index = indexDiagram(nodes);
  const edges: DiagramEdge[] = [{ id: 'one', from: 'w', fromPort: 'sql', to: 'd', toPort: 'in' }, { id: 'two', from: 'plain', to: 'plain2' }];

  it('allows what’s ordinary, including a self-loop', () => {
    expect(checkConnection({ from: 'w', fromPort: 'files', to: 'plain' }, index, edges)).toBe(true);
    expect(checkConnection({ from: 'plain2', to: 'plain' }, index, edges)).toBe(true);
    expect(checkConnection({ from: 'plain', to: 'plain' }, index, edges)).toBe(true);
    expect(checkConnection({ from: 'w', fromPort: 'both', to: 'w', toPort: 'in' }, index, edges)).toBe(true);
  });

  it('refuses a port to itself, and what’s gone', () => {
    expect(checkConnection({ from: 'w', fromPort: 'both', to: 'w', toPort: 'both' }, index, edges)).toBe('A port can’t connect to itself.');
    expect(checkConnection({ from: 'w', to: 'gone' }, index, edges)).toBe('That isn’t there any more.');
  });

  it('goes the way its ports go', () => {
    expect(checkConnection({ from: 'w', fromPort: 'in', to: 'plain' }, index, edges)).toBe('in only takes connections in.');
    expect(checkConnection({ from: 'plain', to: 'd', toPort: 'out' }, index, edges)).toBe('out only goes out.');
    // A port that doesn't say goes both ways.
    expect(checkConnection({ from: 'w', fromPort: 'both', to: 'd', toPort: 'in' }, index, edges)).toBe(true);
  });

  it('joins ports of a kind only with that kind, and a port with no kind with anything', () => {
    expect(checkConnection({ from: 'w', fromPort: 'files', to: 'd', toPort: 'in' }, index, edges)).toBe('files carries files, and queries takes sql.');
    expect(checkConnection({ from: 'w', fromPort: 'both', to: 'd', toPort: 'in' }, index, edges)).toBe(true);
  });

  it('won’t connect what’s connected, but moving an edge onto where it already is isn’t a duplicate', () => {
    expect(checkConnection({ from: 'w', fromPort: 'sql', to: 'd', toPort: 'in' }, index, edges)).toBe('Those are already connected.');
    expect(checkConnection({ from: 'plain', to: 'plain2' }, index, edges)).toBe('Those are already connected.');
    expect(checkConnection({ from: 'plain', to: 'plain2', edge: 'two' }, index, edges)).toBe(true);
    // The other way round isn't the same connection.
    expect(checkConnection({ from: 'plain2', to: 'plain' }, index, edges)).toBe(true);
  });

  it('adds an edge under an id nothing else has, or the one you make', () => {
    const out = addConnection([{ id: 'edge-2', from: 'a', to: 'b' }], { from: 'w', fromPort: 'sql', to: 'd' });
    expect(out[1]).toEqual({ id: 'edge-3', from: 'w', fromPort: 'sql', to: 'd' });
    expect(addConnection([], { from: 'a', to: 'b' }, (c) => ({ id: 'mine', from: c.from, to: c.to, label: 'hi' }))).toEqual([{ id: 'mine', from: 'a', to: 'b', label: 'hi' }]);
  });

  it('moves an edge’s ends: its old route and label place go, as they were for the old ends, and the rest stays', () => {
    const before: DiagramEdge[] = [{ id: 'e', from: 'a', fromPort: 'p', to: 'b', toPort: 'q', label: 'x', kind: 'after', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], labelBox: { x: 0, y: 0, w: 1, h: 1 } }, { id: 'f', from: 'a', to: 'b' }];
    const [e, f] = moveEdgeEnd(before, { edge: 'e', from: 'a', to: 'c' });
    expect(e).toEqual({ id: 'e', from: 'a', to: 'c', label: 'x', kind: 'after' });
    expect(f).toBe(before[1]);
    expect(moveEdgeEnd(before, { edge: 'e', from: 'z', fromPort: 'r', to: 'c', toPort: 's' })[0]).toMatchObject({ from: 'z', fromPort: 'r', to: 'c', toPort: 's' });
  });
});

describe('the window that gets drawn', () => {
  const view = { x: 0, y: 0, w: 1000, h: 500 };

  it('starts half as big again each way', () => {
    expect(renderWindow(null, view)).toEqual({ x: -500, y: -250, w: 2000, h: 1000 });
  });

  it('stays the same while the view’s inside it, so a pan changes nothing', () => {
    const win = renderWindow(null, view);
    expect(renderWindow(win, { ...view, x: 300, y: 100 })).toBe(win);
    expect(renderWindow(win, { ...view, x: -500, y: -250 })).toBe(win);
  });

  it('moves when the view leaves it, around where the view went', () => {
    const win = renderWindow(null, view);
    const moved = renderWindow(win, { ...view, x: 600 });
    expect(moved).not.toBe(win);
    expect(moved).toEqual({ x: 100, y: -250, w: 2000, h: 1000 });
  });

  it('grows when zooming out takes the view past it', () => {
    const win = renderWindow(null, view);
    expect(renderWindow(win, { x: -2000, y: -2000, w: 4000, h: 4000 })).toEqual({ x: -4000, y: -4000, w: 8000, h: 8000 });
  });

  it('shrinks when zooming in leaves it far larger than it needs to be', () => {
    const win = renderWindow(null, view);
    expect(renderWindow(win, { x: 100, y: 100, w: 500, h: 250 })).toBe(win);
    const small = renderWindow(win, { x: 100, y: 100, w: 400, h: 200 });
    expect(small).toEqual({ x: -100, y: 0, w: 800, h: 400 });
  });
});
