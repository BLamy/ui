import { describe, expect, it } from 'vitest';
import { DIAGRAM_TEXT_MAX_WIDTH, estimateText, measureText, onFontsLoaded } from './diagram-text';
import { INITIAL_SIZE, NODE_MIN_SIZE, NODE_PADDING, diagramTextRuns, nodeTextSize, sizeNodesToText, type DiagramNode } from './diagram-model';

describe('estimating, as on a server', () => {
  it('grows with the text, and goes by which letters', () => {
    expect(estimateText('', 'label').w).toBe(0);
    expect(estimateText('checkingQuota', 'label').w).toBeGreaterThan(estimateText('idle', 'label').w);
    expect(estimateText('MMMM', 'label').w).toBeGreaterThan(estimateText('iiii', 'label').w);
    // A typical state name at 12 px in a system font is about 6 px a letter, and it's generous rather than short.
    const w = estimateText('authenticating', 'label').w;
    expect(w).toBeGreaterThan(14 * 5);
    expect(w).toBeLessThan(14 * 8);
  });

  it('takes CJK as a full em each', () => {
    expect(estimateText('認証', 'label').w).toBe(Math.ceil(2 * 12 * 1.03));
    expect(estimateText('한글', 'label').w).toBe(Math.ceil(2 * 12 * 1.03));
    expect(estimateText('😀', 'edge').w).toBe(11);
  });

  it('wraps past the limit, with or without spaces', () => {
    const long = estimateText('aVeryLongStateNameWithNoSpacesInItAtAllThatHasToBreakSomewhere', 'label');
    expect(long.w).toBe(DIAGRAM_TEXT_MAX_WIDTH);
    expect(long.h).toBeGreaterThanOrEqual(30);
    expect(estimateText('short', 'label').h).toBe(15);
  });

  it('never wraps an edge’s label', () => {
    const long = estimateText('a'.repeat(200), 'edge');
    expect(long.w).toBeGreaterThan(DIAGRAM_TEXT_MAX_WIDTH);
    expect(long.h).toBe(11);
  });

  it('has only estimates when there is no document, and doesn’t fail', () => {
    const text = measureText([{ text: 'hello', kind: 'label' }]);
    expect(text('hello', 'label')).toEqual(estimateText('hello', 'label'));
    expect(onFontsLoaded(() => undefined)).toBeTypeOf('function');
  });
});

describe('sizes from text', () => {
  const text = (t: string, kind: string) => ({ w: t.length * 10, h: kind === 'detail' ? 14 : 15 });

  it('makes room for a node’s words, its padding and its border', () => {
    expect(nodeTextSize({ label: 'x'.repeat(20) }, text)).toEqual({ w: 200 + NODE_PADDING.x * 2 + 2, h: NODE_MIN_SIZE.h });
    expect(nodeTextSize({ label: 'x'.repeat(20), detail: 'y'.repeat(30) }, text)).toEqual({ w: 300 + NODE_PADDING.x * 2 + 2, h: 15 + 14 + NODE_PADDING.y * 2 + 2 });
  });

  it('allows for a final state’s heavier border', () => {
    expect(nodeTextSize({ label: 'x'.repeat(20), kind: 'final' }, text).w).toBe(200 + NODE_PADDING.x * 2 + 4);
  });

  it('keeps to a least size', () => {
    expect(nodeTextSize({ label: 'x' }, text)).toEqual(NODE_MIN_SIZE);
    expect(nodeTextSize({}, text)).toEqual(NODE_MIN_SIZE);
  });

  it('draws an initial marker the same size whatever it says', () => {
    expect(nodeTextSize({ kind: 'initial', label: 'ignored' }, text)).toEqual({ w: INITIAL_SIZE, h: INITIAL_SIZE });
  });

  it('gives what holds others the room for its title', () => {
    expect(nodeTextSize({ kind: 'compound', label: 'x'.repeat(10) }, text)).toEqual({ w: 100 + 24, h: 15 + 16 });
    expect(nodeTextSize({ kind: 'parallel', label: 'x'.repeat(10), detail: 'parallel' }, text).w).toBe(100 + ' (parallel)'.length * 10 + 24);
  });

  it('resizes around the center, and leaves alone what didn’t change or what holds others', () => {
    const same: DiagramNode = { id: 'a', label: 'x'.repeat(20), x: 0, y: 0, w: 226, h: 34 };
    const grows: DiagramNode = { id: 'b', label: 'x'.repeat(20), x: 100, y: 100, w: 100, h: 20 };
    const holds: DiagramNode = { id: 'c', kind: 'compound', label: 'x', x: 0, y: 0, w: 5, h: 5 };
    const [a, b, c] = sizeNodesToText([same, grows, holds], text);
    expect(a).toBe(same);
    expect(c).toBe(holds);
    expect(b.w).toBe(226);
    expect(b.x + b.w / 2).toBe(150);
    expect(b.y + b.h / 2).toBe(110);
  });

  it('collects what there is to measure', () => {
    expect(diagramTextRuns([{ id: 'a', label: 'L', detail: 'D', x: 0, y: 0, w: 1, h: 1 }, { id: 'c', kind: 'compound', label: 'T', x: 0, y: 0, w: 1, h: 1 }, { id: 'i', kind: 'initial', x: 0, y: 0, w: 1, h: 1 }], [{ id: 'e', from: 'a', to: 'c', label: 'E' }, { id: 'f', from: 'a', to: 'c' }])).toEqual([
      { text: 'L', kind: 'label' }, { text: 'D', kind: 'detail' }, { text: 'T', kind: 'title' }, { text: 'E', kind: 'edge' },
    ]);
  });
});
