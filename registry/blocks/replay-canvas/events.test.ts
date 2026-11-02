import { describe, expect, it } from 'vitest';
import type { ReplayEvent } from '@/components/ui/replay-preview';
import { playableEvents } from './events';

const img = (id: number, extra: Record<string, string> = {}) => ({ id, type: 2, tagName: 'img', attributes: { src: 'http://localhost/logo.svg', ...extra }, childNodes: [] });
const snapshot = (node: unknown) => ({ type: 2, timestamp: 1, data: { node: { id: 1, type: 0, childNodes: [node] }, initialOffset: { top: 0, left: 0 } } }) as unknown as ReplayEvent;
const adds = (node: unknown) => ({ type: 3, timestamp: 2, data: { source: 0, adds: [{ parentId: 1, nextId: null, node }], removes: [], texts: [], attributes: [] } }) as unknown as ReplayEvent;

describe('playableEvents', () => {
  it('makes an inlined image its src, in snapshots and in added nodes', () => {
    const out = playableEvents([snapshot(img(2, { rr_dataURL: 'data:image/png;base64,AAA' })), adds(img(3, { rr_dataURL: 'data:image/png;base64,BBB' }))]) as unknown as { data: any }[];
    expect(out[0].data.node.childNodes[0].attributes).toEqual({ src: 'data:image/png;base64,AAA' });
    expect(out[1].data.adds[0].node.attributes).toEqual({ src: 'data:image/png;base64,BBB' });
  });

  it('leaves recordings without inlined images as they are', () => {
    const events = [snapshot(img(2)), adds(img(3))];
    expect(playableEvents(events)).toBe(events);
  });
});
