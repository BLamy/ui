import { describe, expect, it } from 'vitest';
import { onLayout } from '@/lib/diagram-layout/react';

// A service renamed, or given a machine, lays out the same, as its size doesn't change, so no new layout comes. What's
// drawn has to be the draft as it is now, where the last layout put it.
describe('onLayout', () => {
  const laid = {
    nodes: [
      { id: 'a', label: 'Workers', x: 10, y: 20, w: 224, h: 80, data: { machine: false }, ports: [{ id: 'env', side: 'r' as const, at: 0.4 }] },
      { id: 'b', label: 'R2', x: 400, y: 20, w: 224, h: 60 },
    ],
    edges: [{ id: 'e', from: 'a', to: 'b', label: 'FILES', points: [{ x: 234, y: 52 }, { x: 400, y: 52 }], labelBox: { x: 300, y: 40, w: 40, h: 12 } }],
  };

  it('takes where things are from the layout, and the rest from the draft', () => {
    const draft = {
      nodes: [
        { id: 'a', label: 'API', w: 224, h: 80, data: { machine: true }, ports: [{ id: 'env', side: 'r' as const, label: 'env' }] },
        { id: 'b', label: 'Files' },
      ],
      edges: [{ id: 'e', from: 'a', to: 'b', label: 'UPLOADS', labelBox: { x: 0, y: 0, w: 1, h: 1 } }],
    };
    const { nodes, edges } = onLayout(draft, laid);
    expect(nodes).toEqual([
      { id: 'a', label: 'API', x: 10, y: 20, w: 224, h: 80, data: { machine: true }, ports: [{ id: 'env', side: 'r', label: 'env', at: 0.4 }] },
      { id: 'b', label: 'Files', x: 400, y: 20, w: 224, h: 60 },
    ]);
    expect(edges).toEqual([{ id: 'e', from: 'a', to: 'b', label: 'UPLOADS', points: laid.edges[0].points, labelBox: laid.edges[0].labelBox }]);
  });

  it('leaves out what the layout hasn’t placed yet, and what the draft doesn’t have any more', () => {
    const { nodes, edges } = onLayout({ nodes: [{ id: 'a' }, { id: 'new' }], edges: [] }, laid);
    expect(nodes.map((n) => n.id)).toEqual(['a']);
    expect(edges).toEqual([]);
  });

  it('keeps a port’s own place', () => {
    const { nodes } = onLayout({ nodes: [{ id: 'a', ports: [{ id: 'env', side: 'r' as const, at: 0.9 }, { id: 'other', side: 'l' as const }] }] }, laid);
    expect(nodes[0]!.ports).toEqual([{ id: 'env', side: 'r', at: 0.9 }, { id: 'other', side: 'l' }]);
  });
});
