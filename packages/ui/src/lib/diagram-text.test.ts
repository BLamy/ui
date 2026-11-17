import { describe, expect, it } from 'vitest';
import { DIAGRAM_TEXT_MAX_WIDTH, estimateText, measureText, onFontsLoaded } from './diagram-text';
import {
  DIAGRAM_CARD, MARKER_SIZE, diagramTextRuns, edgeLabelSize, nodeAnatomy, nodeSize, placeItemPorts, sizeNodesToText, type DiagramNode,
} from './diagram-model';

describe('estimating, as on a server', () => {
  it('grows with the text, and goes by which letters', () => {
    expect(estimateText('', 'title').w).toBe(0);
    expect(estimateText('checkingQuota', 'title').w).toBeGreaterThan(estimateText('idle', 'title').w);
    expect(estimateText('MMMM', 'item').w).toBeGreaterThan(estimateText('iiii', 'item').w);
    // A typical state name at 13 px in a system font is about 7 px a letter, and it's generous rather than short.
    const w = estimateText('authenticating', 'title').w;
    expect(w).toBeGreaterThan(14 * 5);
    expect(w).toBeLessThan(14 * 9);
  });

  it('takes CJK as a full em each, and a mono face as the same width for every letter', () => {
    expect(estimateText('認証', 'item').w).toBe(Math.ceil(2 * 12 * 1.03));
    expect(estimateText('한글', 'item').w).toBe(Math.ceil(2 * 12 * 1.03));
    expect(estimateText('iiii', 'code').w).toBe(estimateText('MMMM', 'code').w);
  });

  it('wraps past the limit, with or without spaces', () => {
    const long = estimateText('aVeryLongStateNameWithNoSpacesInItAtAllThatHasToBreakSomewhere', 'title');
    expect(long.w).toBe(DIAGRAM_TEXT_MAX_WIDTH);
    expect(long.h).toBeGreaterThanOrEqual(32);
    expect(estimateText('short', 'item').h).toBe(15);
  });

  it('never wraps an edge label’s title or a badge', () => {
    const long = estimateText('a'.repeat(200), 'edge');
    expect(long.w).toBeGreaterThan(DIAGRAM_TEXT_MAX_WIDTH);
    expect(long.h).toBe(15);
    expect(estimateText('a'.repeat(200), 'trailing').h).toBe(14);
  });

  it('has only estimates when there is no document, and doesn’t fail', () => {
    const text = measureText([{ text: 'hello', kind: 'title' }]);
    expect(text('hello', 'title')).toEqual(estimateText('hello', 'title'));
    expect(onFontsLoaded(() => undefined)).toBeTypeOf('function');
  });
});

describe('a card’s anatomy, from its text', () => {
  // Every letter 10 wide; a line 15 high, 14 for a caption or a badge.
  const text = (t: string, kind: string) => ({ w: t.length * 10, h: kind === 'caption' || kind === 'trailing' ? 14 : 15 });
  const C = DIAGRAM_CARD;
  const header = 15 + C.headerY * 2;

  it('is only its header strip when it has nothing but a title, and stays small', () => {
    expect(nodeSize({ title: 'x'.repeat(20) }, text)).toEqual({ w: 200 + C.headerX * 2 + 2, h: header + 2 });
    expect(nodeSize({ title: 'x' }, text)).toEqual({ w: C.minW + 2, h: header + 2 });
    expect(nodeSize({}, text)).toEqual({ w: C.minW + 2, h: header + 2 });
  });

  it('makes room in the header for a glyph and a trailing badge', () => {
    const plain = nodeSize({ title: 'x'.repeat(10) }, text).w;
    expect(nodeSize({ title: 'x'.repeat(10), icon: 'bolt' }, text).w).toBe(plain + C.glyph + C.glyphGap);
    expect(nodeSize({ title: 'x'.repeat(10), icon: { text: 'H*' } }, text).w).toBe(plain + 24 + C.glyphGap);
    expect(nodeSize({ title: 'x'.repeat(10), trailing: 'abc' }, text).w).toBe(plain + C.trailingGap + 30 + C.badgeX * 2);
  });

  it('puts a description and the sections under the header, with their captions and chips', () => {
    const node = {
      title: 'Paused', description: 'd'.repeat(5),
      sections: [{ title: 'Entry actions', items: [{ title: 'onPause', icon: 'bolt' as const }, { title: 'onEnter' }] }],
    };
    const a = nodeAnatomy(node, text);
    const chip = 15 + C.chipY * 2 + 2;
    const body = C.bodyTop + 15 + C.descriptionGap + 14 + C.captionGap + chip + C.chipGap + chip + C.bodyBottom;
    expect(a.header).toBe(header);
    expect(a.h).toBe(1 + header + 1 + body + 1);
    // The widest thing is the caption, "Entry actions": 130.
    expect(a.w).toBe(130 + C.bodyX * 2 + 2);
    // Each item's row, from the card's top.
    const first = 1 + header + 1 + C.bodyTop + 15 + C.descriptionGap + 14 + C.captionGap + chip / 2;
    expect(a.rows.get('0\0onPause')).toBe(first);
    expect(a.rows.get('0\0onEnter')).toBe(first + chip + C.chipGap);
  });

  it('draws list and code rows without a chip’s box', () => {
    const chips = nodeSize({ title: 't', sections: [{ items: [{ title: 'abc' }] }] }, text);
    const list = nodeSize({ title: 't', sections: [{ variant: 'list', items: [{ title: 'abc' }] }] }, text);
    expect(chips.h - list.h).toBe(C.chipY * 2 + 2);
    expect(diagramTextRuns([{ id: 'n', x: 0, y: 0, w: 1, h: 1, sections: [{ variant: 'code', items: [{ title: 'a', description: 'string' }] }] }])).toEqual([
      { text: 'a', kind: 'code' }, { text: 'string', kind: 'code' },
    ]);
  });

  it('allows for a double border', () => {
    expect(nodeSize({ title: 'x'.repeat(20), variant: 'double' }, text).w).toBe(200 + C.headerX * 2 + 4);
  });

  it('draws a marker the same size whatever it says', () => {
    expect(nodeSize({ kind: 'marker', title: 'ignored' }, text)).toEqual({ w: MARKER_SIZE, h: MARKER_SIZE });
  });

  it('gives what holds others room for its header and sections, and says where its children can start', () => {
    const group = nodeAnatomy({ kind: 'group', title: 'x'.repeat(10) }, text);
    expect(group.w).toBe(100 + C.headerX * 2 + 2);
    expect(group.top).toBe(1 + header);
    const root = nodeAnatomy({ kind: 'root', title: 'Machine', sections: [{ title: 'Context', variant: 'code', items: [{ title: 'a:', description: 'string' }] }] }, text);
    expect(root.top).toBe(1 + header + 1 + C.bodyTop + 14 + C.captionGap + 15 + C.bodyBottom);
    // A region has no border and no strip of its own unless it's titled.
    expect(nodeAnatomy({ kind: 'region' }, text).top).toBe(0);
  });

  it('sizes an edge’s label: a pill for a title, a card with its items', () => {
    expect(edgeLabelSize({}, text)).toBeNull();
    expect(edgeLabelSize({ title: 'loaded' }, text)).toEqual({ w: 60 + C.pillX * 2 + 2, h: 15 + C.pillY * 2 + 2 });
    const card = edgeLabelSize({ title: 'loading', sections: [{ items: [{ title: 'onLoad', icon: 'bolt' }] }] }, text)!;
    const chip = 15 + C.chipY * 2 + 2;
    expect(card.h).toBe(C.labelTop + 15 + C.labelTitleGap + chip + C.labelBottom + 2);
    expect(card.w).toBe(Math.max(70, 60 + 12 + C.chipIconGap + C.chipX * 2 + 2) + C.labelX * 2 + 2);
  });

  it('puts a port an item names on that item’s row', () => {
    const node: DiagramNode = {
      id: 'w', x: 0, y: 0, w: 0, h: 0, title: 'Worker',
      ports: [{ id: 'env', side: 'right' }, { id: 'top', side: 'top' }, { id: 'fixed', side: 'left', at: 0.2 }],
      sections: [{ title: 'Bindings', items: [{ title: 'FILES', port: 'env' }, { title: 'X', port: 'top' }, { title: 'Y', port: 'fixed' }] }],
    };
    const a = nodeAnatomy(node, text);
    const placed = placeItemPorts(node, a, a.h);
    expect(placed.ports![0].at).toBeCloseTo(a.rows.get('0\0FILES')! / a.h, 3);
    // Only a left or right port, and only one without an `at` of its own.
    expect(placed.ports![1].at).toBeUndefined();
    expect(placed.ports![2].at).toBe(0.2);
  });

  it('resizes around the center, and leaves alone what didn’t change or what holds others', () => {
    const size = nodeSize({ title: 'x'.repeat(20) }, text);
    const same: DiagramNode = { id: 'a', title: 'x'.repeat(20), x: 0, y: 0, ...size };
    const grows: DiagramNode = { id: 'b', title: 'x'.repeat(20), x: 100, y: 100, w: 100, h: 20 };
    const holds: DiagramNode = { id: 'c', kind: 'group', title: 'x', x: 0, y: 0, w: 5, h: 5 };
    const [a, b, c] = sizeNodesToText([same, grows, holds], text);
    expect(a).toBe(same);
    expect(c).toBe(holds);
    expect(b.w).toBe(size.w);
    expect(b.x + b.w / 2).toBe(150);
    expect(b.y + b.h / 2).toBe(110);
  });

  it('collects what there is to measure, every part of the anatomy', () => {
    expect(diagramTextRuns(
      [
        { id: 'a', title: 'L', description: 'D', trailing: 'B', icon: { text: 'H' }, x: 0, y: 0, w: 1, h: 1, sections: [{ title: 'S', items: [{ title: 'I', description: 'ID' }] }] },
        { id: 'c', kind: 'group', title: 'T', x: 0, y: 0, w: 1, h: 1 },
        { id: 'i', kind: 'marker', title: 'not drawn', x: 0, y: 0, w: 1, h: 1 },
      ],
      [{ id: 'e', from: 'a', to: 'c', title: 'E', sections: [{ items: [{ title: 'act' }] }] }, { id: 'f', from: 'a', to: 'c' }],
    )).toEqual([
      { text: 'L', kind: 'title' }, { text: 'B', kind: 'trailing' }, { text: 'D', kind: 'description' }, { text: 'H', kind: 'trailing' },
      { text: 'S', kind: 'caption' }, { text: 'I', kind: 'item' }, { text: 'ID', kind: 'description' },
      { text: 'T', kind: 'title' }, { text: 'E', kind: 'edge' }, { text: 'act', kind: 'item' },
    ]);
  });
});
