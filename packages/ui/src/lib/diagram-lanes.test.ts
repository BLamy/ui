import { describe, expect, it } from 'vitest';
import { cloudflareBoardData, placeInLayers } from '@/lib/cloudflare-board';
import type { CloudflareSystem } from '@/lib/cloudflare-system';
import type { Pt, Rect } from '@/lib/canvas-math';
import { layoutDiagram, routePortEdges } from '@/lib/diagram-layout';
import { DIAGRAM_CARD, edgeGeometries, edgeLabelSize, facePorts, indexDiagram, nodeAnatomy, sizeNodesToText, type DiagramEdge, type DiagramNode } from '@/lib/diagram-model';
import { drawDiagram } from '@/lib/diagram-drawing';
import { estimateText } from '@/lib/diagram-text';

/* Edges in lanes of their own (`routeInLanes`, through `edgeGeometries` and the layout's `routePortEdges`): every edge has a
   route of its own from end to end, and its label is on a straight run only its edge uses. */

/** The longest stretch, in board units, along which two routes run within a unit of each other. */
function sharedRun(a: readonly Pt[], b: readonly Pt[]): number {
  const sample = (pts: readonly Pt[]) => {
    const out: Pt[] = [];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i], n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 2));
      for (let k = 0; k < n; k++) out.push({ x: p.x + ((q.x - p.x) * k) / n, y: p.y + ((q.y - p.y) * k) / n });
    }
    return out;
  };
  const sb = sample(b);
  let run = 0, longest = 0;
  for (const p of sample(a)) {
    run = sb.some((q) => Math.abs(q.x - p.x) < 1 && Math.abs(q.y - p.y) < 1) ? run + 2 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

/** Whether a route goes through the inside of a box. */
const through = (pts: readonly Pt[], r: Rect) => pts.some((p, i) => {
  if (!i) return false;
  const q = pts[i - 1];
  const x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x), y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y);
  return x1 > r.x + 2 && x0 < r.x + r.w - 2 && y1 > r.y + 2 && y0 < r.y + r.h - 2;
});

/** The board as Diagram routes it: ports facing their edges, lanes, and each label where the router put it. */
function routed(nodes: DiagramNode[], edges: DiagramEdge[]) {
  const faced = facePorts(sizeNodesToText(nodes, estimateText), edges);
  const index = indexDiagram(faced);
  const labels = new Map<string, Rect>();
  const geometries = edgeGeometries(edges, index, { avoid: true, headOf: (n) => nodeAnatomy(n, estimateText).top, labelSize: (e) => edgeLabelSize(e, estimateText), labels });
  return { nodes: faced, geometries, labels };
}

const UPLOAD: CloudflareSystem = {
  services: [
    { id: 'api', kind: 'workers', label: 'API' },
    { id: 'files', kind: 'r2', label: 'Files' },
    { id: 'jobs', kind: 'queues', label: 'Jobs' },
    { id: 'consumer', kind: 'workers', label: 'Consumer' },
    { id: 'db', kind: 'd1', label: 'Uploads' },
  ],
  edges: [
    { id: 'api-files', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put'] },
    { id: 'api-jobs', from: 'api', to: 'jobs', via: 'queues', binding: 'JOBS', operations: ['send'] },
    { id: 'jobs-consumer', from: 'jobs', to: 'consumer', via: 'queue-consumer' },
    { id: 'consumer-db', from: 'consumer', to: 'db', via: 'd1_databases', binding: 'DB', operations: ['prepare'] },
  ],
};

describe('a hand-placed editable system (the studio)', () => {
  // As the Diagram draws it: the studio's board is placed, its routes and labels the Diagram's own.
  const drawingOf = (editable: boolean) => {
    const board = cloudflareBoardData(placeInLayers(UPLOAD, { editable }), { editable });
    return drawDiagram(sizeNodesToText(board.nodes, estimateText), board.edges, estimateText);
  };
  const drawing = drawingOf(true);
  const nodes = drawing.index.nodes;
  const geometries = drawing.geometries;
  const labels = new Map(drawing.labels.map((l) => [l.edge.id, l.box]));
  const ids = drawing.edges.map((e) => e.edge.id);

  it('gives every edge a lane of its own: no two run along each other for more than a crossing', () => {
    for (const a of ids) for (const b of ids) if (a < b) expect(sharedRun(geometries.get(a)!.pts, geometries.get(b)!.pts), `${a} and ${b}`).toBeLessThanOrEqual(4);
  });

  it('puts each label on its own route, clear of every card and of every other route', () => {
    const cards = nodes.filter((n) => n.kind !== 'root');
    for (const id of ids) {
      const box = labels.get(id)!;
      expect(box, id).toBeDefined();
      expect(through(geometries.get(id)!.pts, box), `${id} runs through its label`).toBe(true);
      for (const other of ids) if (other !== id) expect(through(geometries.get(other)!.pts, box), `${other} runs through ${id}'s label`).toBe(false);
      for (const c of cards) if (c.kind !== 'group') expect(box.x < c.x + c.w && c.x < box.x + box.w && box.y < c.y + c.h && c.y < box.y + box.h, `${id}'s label on ${c.id}`).toBe(false);
    }
  });

  it('never runs a route through a card', () => {
    for (const { edge: e } of drawing.edges) for (const n of nodes) {
      if (n.kind === 'root' || n.kind === 'group' || n.id === e.from || n.id === e.to) continue;
      expect(through(geometries.get(e.id)!.pts, n), `${e.id} through ${n.id}`).toBe(false);
    }
  });

  it('draws the routes the read-only board does: the dots are only there to connect by', () => {
    const reading = drawingOf(false);
    for (const id of ids) expect(geometries.get(id)!.pts, id).toEqual(reading.geometries.get(id)!.pts);
    expect(nodes.some((n) => n.ports?.length)).toBe(true);
  });
});

describe('facePorts', () => {
  const card = (id: string, x: number, port: { id: string; side: 'left' | 'right' }): DiagramNode => ({
    id, x, y: 0, w: 100, h: 60, title: id, ports: [port], sections: [{ items: [{ title: port.id, port: port.id }] }],
  });

  it('puts a row’s port at the end of the row that faces where its edges go', () => {
    const nodes = [card('a', 400, { id: 'out', side: 'right' }), card('b', 0, { id: 'in', side: 'left' })];
    const faced = facePorts(nodes, [{ id: 'e', from: 'a', to: 'b', fromPort: 'out', toPort: 'in' }]);
    expect(faced[0].ports![0].side).toBe('left');
    expect(faced[1].ports![0].side).toBe('right');
  });

  it('leaves a port no edge uses, and a port no item names, where it was declared, and the same node objects', () => {
    const nodes = [card('a', 400, { id: 'out', side: 'right' }), { id: 'b', x: 0, y: 0, w: 100, h: 60, ports: [{ id: 'in', side: 'left' as const }] }];
    const faced = facePorts(nodes, [{ id: 'e', from: 'b', to: 'a', fromPort: 'in' }]);
    expect(faced[0]).toBe(nodes[0]);
    expect(faced[1]).toBe(nodes[1]);
  });
});

describe('an inline section', () => {
  it('is a row of chips that wraps where it gets to DIAGRAM_CARD.inlineMax, measured as it’s drawn', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ title: `fact-${i}`, description: 'zone' }));
    const row = nodeAnatomy({ kind: 'root', title: 'System', sections: [{ title: 'Account', variant: 'inline', items }] }, estimateText);
    const column = nodeAnatomy({ kind: 'root', title: 'System', sections: [{ title: 'Account', items }] }, estimateText);
    expect(row.w).toBeLessThanOrEqual(DIAGRAM_CARD.inlineMax + DIAGRAM_CARD.bodyX * 2 + 4);
    expect(row.top).toBeLessThan(column.top / 2);
    expect(row.w).toBeGreaterThan(column.w);
  });
});

describe('after a layout', () => {
  it('routes an editable system’s ports again, in lanes, with each label on its own route', async () => {
    const board = cloudflareBoardData(UPLOAD, { editable: true });
    const laid = await layoutDiagram({ nodes: board.nodes, edges: board.edges }, { text: estimateText });
    for (const a of laid.edges) for (const b of laid.edges) if (a.id < b.id) expect(sharedRun(a.points!, b.points!), `${a.id} and ${b.id}`).toBeLessThanOrEqual(4);
    for (const e of laid.edges) if (e.labelBox) expect(through(e.points!, e.labelBox), `${e.id} runs through its label`).toBe(true);
  });

  it('starts an edge out of a box with sections beside them, not from under what the box holds', async () => {
    const system: CloudflareSystem = {
      services: [
        { id: 'consumer', kind: 'workers', label: 'Consumer', settings: { compatibilityDate: '2026-11-01' } },
        { id: 'room', kind: 'durable-objects', label: 'Room', host: 'consumer' },
        { id: 'db', kind: 'd1', label: 'Uploads' },
      ],
      edges: [
        { id: 'room', from: 'consumer', to: 'room', via: 'durable_objects', binding: 'ROOM' },
        { id: 'db', from: 'consumer', to: 'db', via: 'd1_databases', binding: 'DB', operations: ['prepare'] },
      ],
    };
    const board = cloudflareBoardData(system);
    const laid = routePortEdges(await layoutDiagram({ nodes: board.nodes, edges: board.edges }, { text: estimateText }), estimateText);
    const consumer = laid.nodes.find((n) => n.id === 'consumer')!;
    const start = laid.edges.find((e) => e.id === 'db')!.points![0];
    expect(start.y).toBeLessThanOrEqual(consumer.y + nodeAnatomy(consumer, estimateText).top);
    expect([consumer.x, consumer.x + consumer.w]).toContain(start.x);
  });
});
