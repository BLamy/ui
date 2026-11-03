import { describe, expect, it, vi } from 'vitest';
import {
  CodeLexer, CodeTokenStore, LEX_START, LineMetrics, LineScanner, MAX_SCROLL_SIZE, TILE_CELLS, alignedScroll, clipTokens,
  codePointCells, displayPieces, extendSelection, hostProducer, identityRowMap, isCollapsed, lexCodeLine, lexRange, lexerProducer,
  markersInRange, movePosition, nextCellWindow, nextLineState, nextRowWindow, orderedSelection, originOf, physicalSize, revealScroll, selectionCells,
  selectionText, splitCodeLines, toPhysicalScroll, toVirtualScroll, visibleCells, visibleRows, wordAt, wrapRowMap, wrappedSpan,
  type CodeToken, type LexEmit,
} from '@/lib/code-viewer';

const never = () => false;

/** What a text is labelled, char by char: comparable however the tokens were cut. */
function labelsOf(tokens: readonly CodeToken[]): string[] {
  return tokens.flatMap((t) => Array.from({ length: t.text.length }, () => t.type ?? 'plain'));
}

const pairs = (tokens: readonly CodeToken[]) => tokens.filter((t) => t.type).map((t) => [t.text, t.type]);

/** Long label arrays are equal, or the first place they differ is what the failure shows. */
function expectSameLabels(actual: readonly string[], expected: readonly string[], text: string, base = 0) {
  expect(actual.length).toBe(expected.length);
  const at = actual.findIndex((label, i) => label !== expected[i]);
  if (at >= 0) expect({ at: base + at, near: text.slice(Math.max(0, base + at - 30), base + at + 30), label: actual[at] }).toEqual({ at: base + at, near: text.slice(Math.max(0, base + at - 30), base + at + 30), label: expected[at] });
}

/* A seeded stand-in for a bundle: a line of what minifiers really write, nothing clever. */
function minified(size: number, seed = 1): string {
  const pieces = [
    'function a(b,c){return b+c}', 'var d=/["\'`]/g,e="it\'s",f=\'a "b"\';', 'g=h/2/i;', 'const j=`x${k?`y${l}`:"z"}w`;',
    'if(m)n.o(p)&&q();', 'r=s?.t??u;', 'class V extends W{x(){return this.y}}', 'for(let i=0;i<10;i++)z[i]=i*1.5e+3;',
    '/*!c*/', 'A=typeof B=="function"?B():void 0;', 'C=D.replace(/\\/\\*.*?\\*\\//g,"");', 'E=[1,2,3].map(F=>F/2);',
  ];
  let state = seed;
  let out = '';
  while (out.length < size) {
    state = (state * 1664525 + 1013904223) >>> 0;
    out += pieces[state % pieces.length];
  }
  return out.slice(0, size);
}

describe('LineMetrics', () => {
  it('treats a line of plain characters as one cell per code unit, with no storage', () => {
    const m = new LineMetrics('const a = 1;');
    expect(m.plain).toBe(true);
    expect(m.cells).toBe(12);
    expect(m.cellAt(5)).toBe(5);
    expect(m.offsetAt(5)).toBe(5);
    expect(m.offsetAt(100)).toBe(12);
    expect(m.cellAt(100)).toBe(12);
  });

  it('counts accented Latin, Greek and Cyrillic as plain', () => {
    expect(new LineMetrics('café Ωμέγα Привет').plain).toBe(true);
  });

  it('takes tabs to the next stop, wherever they start', () => {
    const m = new LineMetrics('\ta\tbc\td', 4);
    expect(m.plain).toBe(false);
    expect(m.cellAt(0)).toBe(0);
    expect(m.cellAt(1)).toBe(4); // a
    expect(m.cellAt(2)).toBe(5); // the tab after a
    expect(m.cellAt(3)).toBe(8); // b
    expect(m.cellAt(6)).toBe(12); // d
    expect(m.cells).toBe(13);
    expect(m.offsetAt(6)).toBe(2); // inside the second tab
    expect(m.offsetAt(8)).toBe(3);
  });

  it('gives wide characters two cells and keeps surrogate pairs whole', () => {
    const m = new LineMetrics('a漢😀b');
    expect(m.cells).toBe(1 + 2 + 2 + 1);
    expect(m.cellAt(1)).toBe(1);
    expect(m.cellAt(2)).toBe(3);
    expect(m.cellAt(3)).toBe(3); // the low half of the pair
    expect(m.cellAt(4)).toBe(5);
    expect(m.offsetAt(2)).toBe(1); // the second cell of 漢
    expect(m.offsetAt(4)).toBe(2); // the second cell of the emoji
    expect(m.offsetAt(5)).toBe(4);
  });

  it('keeps marks, joiners, skin tones and flags on one cluster', () => {
    expect(new LineMetrics('e\u0301x').cells).toBe(2);
    expect(new LineMetrics('👩\u200d💻').cells).toBe(2);
    expect(new LineMetrics('👍🏽').cells).toBe(2);
    expect(new LineMetrics('🇺🇸').cells).toBe(2);
    expect(new LineMetrics('\u0301').cells).toBe(1); // a mark with nothing to sit on still shows
    const m = new LineMetrics('a👩\u200d💻b');
    expect(m.offsetAt(2)).toBe(1);
    expect(m.offsetAt(3)).toBe('a👩\u200d💻'.length);
  });

  it('finds the nearest boundary for a click', () => {
    const plain = new LineMetrics('abcdef');
    expect(plain.nearest(2.4)).toBe(2);
    expect(plain.nearest(2.6)).toBe(3);
    expect(plain.nearest(-1)).toBe(0);
    expect(plain.nearest(99)).toBe(6);
    const wide = new LineMetrics('a漢b');
    expect(wide.nearest(1.4)).toBe(1);
    expect(wide.nearest(2.6)).toBe(2);
  });

  it('agrees with a plain walk at every offset of a long mixed line', () => {
    const unit = 'abc\t漢字😀e\u0301 \u200bxyz';
    const text = unit.repeat(400);
    const m = new LineMetrics(text, 4);
    // The same grid, walked by hand one code unit at a time.
    let cell = 0;
    const cells: number[] = [];
    for (let i = 0; i < text.length; ) {
      const cp = text.codePointAt(i) as number;
      const size = cp > 0xffff ? 2 : 1;
      if (cp !== 0x301) {
        cells[i] = cell;
        if (size === 2) cells[i + 1] = cell;
        cell += cp === 9 ? 4 - (cell % 4) : codePointCells(cp);
      } else cells[i] = cell - 1;
      i += size;
    }
    expect(m.cells).toBe(cell);
    for (let i = 0; i < text.length; i += 7) expect(m.cellAt(i)).toBe(cells[i]);
    for (let c = 0; c < cell; c += 11) {
      const offset = m.offsetAt(c);
      expect(m.cellAt(offset)).toBeLessThanOrEqual(c);
      expect(m.cellAt(m.after(offset))).toBeGreaterThan(c);
    }
  });

  it('is quick on a megabyte line, plain or not', () => {
    const plain = new LineMetrics('x'.repeat(1 << 20));
    expect(plain.plain).toBe(true);
    const text = 'x\t漢'.repeat(350_000);
    const m = new LineMetrics(text, 8);
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) m.cellAt((i * 523) % text.length);
    for (let i = 0; i < 2000; i++) m.offsetAt((i * 777) % m.cells);
    expect(performance.now() - t0).toBeLessThan(250);
  });
});

describe('displayPieces', () => {
  const pieces = (text: string, start = 0, end = text.length, tab = 4) => displayPieces(new LineMetrics(text, tab), start, end);

  it('leaves plain text as one run', () => {
    expect(pieces('const a = 1')).toEqual(['const a = 1']);
    expect(pieces('const a = 1', 6, 9)).toEqual(['a =']);
  });

  it('turns tabs into the spaces they span from their place on the line', () => {
    expect(pieces('a\tb')).toEqual(['a   b']);
    // Cut after the first cell: the tab still ends at the same stop.
    expect(pieces('a\tb', 1)).toEqual(['   b']);
  });

  it('boxes what could leave the grid', () => {
    expect(pieces('a漢b')).toEqual(['a', { text: '漢', cells: 2 }, 'b']);
    expect(pieces('😀')).toEqual([{ text: '😀', cells: 2 }]);
    expect(pieces('e\u0301x')).toEqual(['e\u0301x']);
  });

  it('shows control and invisible characters', () => {
    expect(pieces('a\u0007b')).toEqual(['a', { text: '␇', cells: 1, control: true }, 'b']);
    expect(pieces('a\u202eb')).toEqual(['a', { text: '·', cells: 1, control: true }, 'b']);
  });

  it('adds up to the grid', () => {
    const text = 'a\t漢😀e\u0301\u200bz';
    const m = new LineMetrics(text, 4);
    const cells = displayPieces(m, 0, text.length).reduce((n, p) => n + (typeof p === 'string' ? [...p].filter((c) => c !== '\u0301').length : p.cells), 0);
    expect(cells).toBe(m.cells);
  });
});

describe('windows', () => {
  it('finds the visible rows', () => {
    expect(visibleRows(0, 100, 20, 1000)).toEqual({ start: 0, end: 5 });
    expect(visibleRows(30, 100, 20, 1000)).toEqual({ start: 1, end: 7 });
    expect(visibleRows(19990, 100, 20, 1000)).toEqual({ start: 999, end: 1000 });
    expect(visibleRows(0, 100, 20, 0)).toEqual({ start: 0, end: 0 });
  });

  it('keeps the row window while everything visible is in it, and moves it by the overscan', () => {
    const first = nextRowWindow(null, { start: 100, end: 120 }, 1000, 8);
    expect(first).toEqual({ start: 92, end: 128 });
    expect(nextRowWindow(first, { start: 105, end: 125 }, 1000, 8)).toBe(first);
    expect(nextRowWindow(first, { start: 110, end: 130 }, 1000, 8)).toEqual({ start: 102, end: 138 });
    expect(nextRowWindow(first, { start: 0, end: 20 }, 1000, 8)).toEqual({ start: 0, end: 28 });
    // The file got shorter.
    expect(nextRowWindow(first, { start: 100, end: 110 }, 110, 8)).toEqual({ start: 92, end: 110 });
  });

  it('keeps the cell window on tile boundaries around what is visible', () => {
    const visible = visibleCells(10_000 * 8, 800, 8);
    expect(visible).toEqual({ start: 10_000, end: 10_101 });
    const cells = nextCellWindow(null, visible);
    expect(cells.start % TILE_CELLS).toBe(0);
    expect(cells.end % TILE_CELLS).toBe(0);
    expect(cells.start).toBeLessThanOrEqual(visible.start);
    expect(cells.end).toBeGreaterThanOrEqual(visible.end);
    expect(cells.end - cells.start).toBeLessThanOrEqual(TILE_CELLS * 3);
    expect(nextCellWindow(cells, visibleCells(10_010 * 8, 800, 8))).toBe(cells);
    expect(nextCellWindow(cells, visibleCells(20_000 * 8, 800, 8)).start).toBeGreaterThan(cells.end);
    expect(nextCellWindow(null, visibleCells(0, 800, 8)).start).toBe(0);
  });

  it('puts the origin on a multiple, so DOM numbers stay small', () => {
    expect(originOf(0, 4096)).toBe(0);
    expect(originOf(4095, 4096)).toBe(0);
    expect(originOf(499_999, 4096)).toBe(499_712);
  });
});

describe('scroll range', () => {
  it('is the identity while it fits', () => {
    expect(physicalSize(10_000_000)).toBe(10_000_000);
    expect(toVirtualScroll(1234, 10_000_000, 800)).toBe(1234);
    expect(toPhysicalScroll(1234, 10_000_000, 800)).toBe(1234);
  });

  it('compresses past the limit and is exact at both ends', () => {
    const size = 100_000_000;
    expect(physicalSize(size)).toBe(MAX_SCROLL_SIZE);
    expect(toVirtualScroll(0, size, 800)).toBe(0);
    expect(toVirtualScroll(MAX_SCROLL_SIZE - 800, size, 800)).toBeCloseTo(size - 800);
    const middle = 40_000_000;
    expect(toVirtualScroll(toPhysicalScroll(middle, size, 800), size, 800)).toBeCloseTo(middle);
  });

  it('reveals a line only if it needs to', () => {
    expect(revealScroll(1000, 20, 300, 900, 30)).toBe(900);
    expect(revealScroll(1000, 20, 300, 980, 30)).toBe(900);
    expect(revealScroll(1000, 20, 300, 740, 30)).toBe(900);
    expect(revealScroll(1000, 20, 300, 800, 30)).toBe(800);
  });

  it('aligns a line', () => {
    expect(alignedScroll(1000, 20, 400, 0, 'start')).toBe(1000);
    expect(alignedScroll(1000, 20, 400, 0, 'center')).toBe(810);
    expect(alignedScroll(1000, 20, 400, 0, 'end')).toBe(620);
    expect(alignedScroll(1000, 20, 400, 900, 'nearest')).toBe(900);
    expect(alignedScroll(1000, 20, 400, 0, 'nearest')).toBe(620);
    expect(alignedScroll(1000, 20, 400, 1100, 'nearest')).toBe(1000);
    expect(alignedScroll(1000, 20, 400, 990, 'nearest', 20)).toBe(980);
  });
});

describe('row maps', () => {
  it('maps rows to lines one to one with wrapping off', () => {
    const map = identityRowMap(500_000);
    expect(map.rowCount).toBe(500_000);
    expect(map.locate(123)).toEqual({ line: 123, part: 0 });
    expect(map.rowOfLine(123)).toBe(123);
  });

  it('counts the rows of wrapped lines', () => {
    const map = wrapRowMap(Uint32Array.from([10, 0, 100, 41, 40]), 40);
    expect(map.rowCount).toBe(1 + 1 + 3 + 2 + 1);
    expect(map.rowOfLine(2)).toBe(2);
    expect(map.rowOfLine(3)).toBe(5);
    expect(map.locate(0)).toEqual({ line: 0, part: 0 });
    expect(map.locate(3)).toEqual({ line: 2, part: 1 });
    expect(map.locate(4)).toEqual({ line: 2, part: 2 });
    expect(map.locate(6)).toEqual({ line: 3, part: 1 });
    expect(map.locate(7)).toEqual({ line: 4, part: 0 });
  });
});

describe('wrappedSpan', () => {
  it('cuts a plain line at the columns', () => {
    const m = new LineMetrics('abcdefghij');
    expect(wrappedSpan(m, 0, 4)).toEqual({ start: 0, end: 4 });
    expect(wrappedSpan(m, 2, 4)).toEqual({ start: 8, end: 10 });
  });

  it('keeps a wide character on the row it starts on', () => {
    const m = new LineMetrics('abc漢de');
    expect(wrappedSpan(m, 0, 4)).toEqual({ start: 0, end: 4 });
    expect(wrappedSpan(m, 1, 4)).toEqual({ start: 4, end: 6 });
  });
});

describe('markersInRange', () => {
  const marker = (column: number) => ({ column });
  it('finds what is in the window, by binary search if there are many', () => {
    const many = Array.from({ length: 50_000 }, (_, i) => marker(i * 20));
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) expect(markersInRange(many, 400_000, 400_100).length).toBe(5);
    expect(performance.now() - t0).toBeLessThan(200);
  });

  it('sorts what comes unsorted, and keeps the array when all of it is in range', () => {
    const list = [marker(30), marker(10), marker(20)];
    expect(markersInRange(list, 15, 35).map((m) => m.column)).toEqual([20, 30]);
    const sorted = [marker(1), marker(2)];
    expect(markersInRange(sorted, 0, Infinity)).toBe(sorted);
  });
});

describe('selection', () => {
  const lines = ['one', '\ttwo', 'three', 'four'];
  const get = (i: number) => lines[i];
  const at = (line: number, offset: number) => ({ line, offset });

  it('orders the ends', () => {
    expect(orderedSelection({ anchor: at(2, 1), focus: at(0, 2) })).toEqual({ from: at(0, 2), to: at(2, 1) });
    expect(isCollapsed({ anchor: at(1, 1), focus: at(1, 1) })).toBe(true);
  });

  it('copies the source: tabs stay tabs, lines join with a newline', () => {
    expect(selectionText({ anchor: at(0, 1), focus: at(0, 3) }, get).text).toBe('ne');
    expect(selectionText({ anchor: at(2, 2), focus: at(0, 1) }, get).text).toBe('ne\n\ttwo\nth');
    expect(selectionText({ anchor: at(0, 0), focus: at(3, 4) }, get)).toEqual({ text: lines.join('\n'), truncated: false });
    expect(selectionText({ anchor: at(0, 3), focus: at(1, 0) }, get).text).toBe('\n');
  });

  it('stops at the limit and says so', () => {
    expect(selectionText({ anchor: at(0, 0), focus: at(3, 4) }, get, 6)).toEqual({ text: 'one\n\tt', truncated: true });
    expect(selectionText({ anchor: at(2, 0), focus: at(2, 5) }, get, 2)).toEqual({ text: 'th', truncated: true });
  });

  it('copies a slice of a megabyte line without touching the rest', () => {
    const text = minified(1 << 20);
    const out = selectionText({ anchor: at(0, 700_000), focus: at(0, 700_100) }, () => text);
    expect(out.text).toBe(text.slice(700_000, 700_100));
  });

  it('finds words for a double click', () => {
    const text = 'foo.bar_baz  (qux)';
    expect(wordAt(text, 1)).toEqual({ start: 0, end: 3 });
    expect(wordAt(text, 3)).toEqual({ start: 3, end: 4 });
    expect(wordAt(text, 5)).toEqual({ start: 4, end: 11 });
    expect(wordAt(text, 11)).toEqual({ start: 11, end: 13 });
    expect(wordAt(text, 13)).toEqual({ start: 13, end: 14 });
    expect(wordAt(text, 999)).toEqual({ start: 17, end: 18 });
    expect(wordAt('', 0)).toEqual({ start: 0, end: 0 });
  });
});

describe('selectionCells', () => {
  const at = (line: number, offset: number) => ({ line, offset });
  const ordered = { from: at(1, 2), to: at(3, 4) };

  it('covers the line from the start, to its end and a newline', () => {
    expect(selectionCells(ordered, 0, new LineMetrics('abcdef'))).toBeNull();
    expect(selectionCells(ordered, 1, new LineMetrics('abcdef'))).toEqual({ start: 2, end: 7 });
    expect(selectionCells(ordered, 2, new LineMetrics(''))).toEqual({ start: 0, end: 1 });
    expect(selectionCells(ordered, 3, new LineMetrics('abcdef'))).toEqual({ start: 0, end: 4 });
    expect(selectionCells(ordered, 4, new LineMetrics('abcdef'))).toBeNull();
  });

  it('counts cells, not code units', () => {
    expect(selectionCells({ from: at(0, 1), to: at(0, 2) }, 0, new LineMetrics('a漢b'))).toEqual({ start: 1, end: 3 });
    expect(selectionCells({ from: at(0, 1), to: at(0, 2) }, 0, new LineMetrics('\t\tb', 4))).toEqual({ start: 4, end: 8 });
  });
});

describe('extendSelection', () => {
  const lines = ['alpha beta gamma', 'delta epsilon', 'zeta'];
  const get = (i: number) => lines[i];
  const at = (line: number, offset: number) => ({ line, offset });

  it('by characters, from the anchor', () => {
    expect(extendSelection({ anchor: at(0, 3), focus: at(0, 3) }, at(1, 2), 'char', get, 3)).toEqual({ anchor: at(0, 3), focus: at(1, 2) });
  });

  it('by words, keeping the word it started on', () => {
    const base = { anchor: at(0, 6), focus: at(0, 10) }; // beta
    expect(extendSelection(base, at(0, 7), 'word', get, 3)).toEqual({ anchor: at(0, 6), focus: at(0, 10) });
    expect(extendSelection(base, at(0, 12), 'word', get, 3)).toEqual({ anchor: at(0, 6), focus: at(0, 16) });
    expect(extendSelection(base, at(0, 1), 'word', get, 3)).toEqual({ anchor: at(0, 10), focus: at(0, 0) });
    expect(extendSelection(base, at(1, 8), 'word', get, 3)).toEqual({ anchor: at(0, 6), focus: at(1, 13) });
  });

  it('by lines, to the start of the next', () => {
    const base = { anchor: at(1, 0), focus: at(2, 0) };
    expect(extendSelection(base, at(1, 5), 'line', get, 3)).toEqual(base);
    expect(extendSelection(base, at(0, 5), 'line', get, 3)).toEqual({ anchor: at(2, 0), focus: at(0, 0) });
    expect(extendSelection(base, at(2, 2), 'line', get, 3)).toEqual({ anchor: at(1, 0), focus: at(2, 4) });
  });
});

describe('movePosition', () => {
  const lines = ['abc', 'a\u6f22b', '', 'wxyz'].map((text) => new LineMetrics(text));
  const metricsOf = (line: number) => lines[line];
  const move = (line: number, offset: number, key: Parameters<typeof movePosition>[1]) => movePosition({ line, offset }, key, metricsOf, lines.length);

  it('goes along a line and over its ends', () => {
    expect(move(0, 1, 'ArrowRight')).toEqual({ line: 0, offset: 2 });
    expect(move(0, 3, 'ArrowRight')).toEqual({ line: 1, offset: 0 });
    expect(move(1, 0, 'ArrowLeft')).toEqual({ line: 0, offset: 3 });
    expect(move(0, 0, 'ArrowLeft')).toEqual({ line: 0, offset: 0 });
    expect(move(3, 4, 'ArrowRight')).toEqual({ line: 3, offset: 4 });
  });

  it('keeps a surrogate pair whole', () => {
    const emoji = [new LineMetrics('a\u{1f600}b')];
    expect(movePosition({ line: 0, offset: 1 }, 'ArrowRight', (i) => emoji[i], 1)).toEqual({ line: 0, offset: 3 });
    expect(movePosition({ line: 0, offset: 3 }, 'ArrowLeft', (i) => emoji[i], 1)).toEqual({ line: 0, offset: 1 });
  });

  it('keeps its place on the grid going up and down', () => {
    expect(move(0, 3, 'ArrowDown')).toEqual({ line: 1, offset: 2 }); // cell 3, after the wide character
    expect(move(1, 2, 'ArrowUp')).toEqual({ line: 0, offset: 3 });
    expect(move(1, 3, 'ArrowDown')).toEqual({ line: 2, offset: 0 });
    expect(move(0, 2, 'ArrowUp')).toEqual({ line: 0, offset: 0 });
    expect(move(3, 1, 'ArrowDown')).toEqual({ line: 3, offset: 4 });
  });

  it('goes to the ends of the line', () => {
    expect(move(3, 2, 'Home')).toEqual({ line: 3, offset: 0 });
    expect(move(3, 2, 'End')).toEqual({ line: 3, offset: 4 });
  });
});

describe('splitCodeLines', () => {
  it('splits where engines count a line', () => {
    expect(splitCodeLines('a\nb')).toEqual(['a', 'b']);
    expect(splitCodeLines('a\r\nb\rc\u2028d\u2029e')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('clipTokens', () => {
  const tokens: CodeToken[] = [{ text: 'const', type: 'keyword' }, { text: ' a = ' }, { text: '"str"', type: 'string' }];
  it('cuts tokens at the window', () => {
    expect(clipTokens(tokens, 0, 0, 15)).toEqual(tokens);
    expect(clipTokens(tokens, 0, 3, 12)).toEqual([{ text: 'st', type: 'keyword' }, { text: ' a = ' }, { text: '"s', type: 'string' }]);
    expect(clipTokens(tokens, 0, 5, 10)).toEqual([{ text: ' a = ' }]);
    expect(clipTokens(tokens, 100, 0, 5)).toEqual([]);
  });
});

describe('the default lexer', () => {
  it('labels what the library labels', () => {
    expect(pairs(lexCodeLine('const f = (a) => a?.b ?? g(1) // done'))).toEqual([
      ['const', 'keyword'], ['=', 'operator'], ['=>', 'operator'], ['?.', 'operator'], ['??', 'operator'], ['g', 'function'], ['1', 'number'], ['// done', 'comment'],
    ]);
    expect(pairs(lexCodeLine('new Map(), null, "a\\"b", \'c\', 0x1f, 1.5e+3, 1_000'))).toEqual([
      ['new', 'keyword'], ['Map', 'function'], ['null', 'constant'], ['"a\\"b"', 'string'], ["'c'", 'string'], ['0x1f', 'number'], ['1.5e+3', 'number'], ['1_000', 'number'],
    ]);
    expect(pairs(lexCodeLine('# a shell comment'))).toEqual([['# a shell comment', 'comment']]);
    expect(pairs(lexCodeLine('Foo bar FOO'))).toEqual([['Foo', 'type']]);
  });

  it('does not make keywords of properties', () => {
    expect(pairs(lexCodeLine('a.default.return(b.c)'))).toEqual([['return', 'function']]);
  });

  it('tells a regular expression from a division', () => {
    expect(pairs(lexCodeLine('x=/["\']/g.test(y)'))).toEqual([['=', 'operator'], ['/["\']/g', 'string'], ['test', 'function']]);
    expect(pairs(lexCodeLine('a=b/c/d;'))).toEqual([['=', 'operator'], ['/', 'operator'], ['/', 'operator']]);
    expect(pairs(lexCodeLine('return /a[/]b/i'))).toEqual([['return', 'keyword'], ['/a[/]b/i', 'string']]);
    expect(pairs(lexCodeLine('(a)/2+"s"'))).toEqual([['/', 'operator'], ['2', 'number'], ['+', 'operator'], ['"s"', 'string']]);
    // No closing slash in reach: it can't have been one.
    expect(pairs(lexCodeLine('x=/ 2'))).toEqual([['=', 'operator'], ['/', 'operator'], ['2', 'number']]);
    expect(pairs(lexCodeLine('</div>'))).toEqual([['<', 'operator'], ['/', 'operator'], ['>', 'operator']]);
  });

  it('nests template literals', () => {
    expect(pairs(lexCodeLine('a=`x${b?`y${c}`:"z"}w`;d()'))).toEqual([
      ['=', 'operator'], ['`', 'string'], ['x', 'string'], ['${', 'operator'], ['?', 'operator'], ['`', 'string'], ['y', 'string'], ['${', 'operator'], ['}', 'operator'],
      ['`', 'string'], ['"z"', 'string'], ['}', 'operator'], ['w`', 'string'], ['d', 'function'],
    ]);
    expect(pairs(lexCodeLine('`${{a:1}.a}`')).slice(0, 3)).toEqual([['`', 'string'], ['${', 'operator'], ['1', 'number']]);
  });

  it('carries comments and templates across lines, and nothing else', () => {
    let s = nextLineState('/* open', LEX_START);
    expect(s).not.toBe(LEX_START);
    expect(pairs(lexCodeLine('still a comment', s))).toEqual([['still a comment', 'comment']]);
    s = nextLineState('still a comment', s);
    expect(pairs(lexCodeLine('end */ code()', s))).toEqual([['end */', 'comment'], ['code', 'function']]);
    expect(nextLineState('end */ code()', s)).toBe(LEX_START);

    expect(nextLineState('"a string that never closes', LEX_START)).toBe(LEX_START);
    expect(nextLineState('const a = 1', LEX_START)).toBe(LEX_START);

    const t = nextLineState('a=`one ${b} two', LEX_START);
    expect(pairs(lexCodeLine('three` + c', t))).toEqual([['three`', 'string'], ['+', 'operator']]);
    const u = nextLineState('a=`one ${', LEX_START);
    expect(pairs(lexCodeLine('foo() } two`', u))).toEqual([['foo', 'function'], ['}', 'operator'], [' two`', 'string']]);
  });

  it('carries a template literal through long lines, as esbuild leaves them in bundles', () => {
    const before = `a=b;throw Error(\`first line${'x'.repeat(5000)}`;
    const between = 'second line';
    const after = `third\`.trim();${'c=d+"e";'.repeat(1000)}f=\`g\`;`;
    const lines = [before, between, after, 'h()'];
    const lexer = new CodeLexer({ lineCount: lines.length, getLine: (i) => lines[i] });
    expect(lexer.scan(never)).toBe(false);
    expect(pairs(lexer.lineTokens(1, between))).toEqual([[between, 'string']]);
    const start = lexer.rangeTokens(2, after, 0, 30, never) as CodeToken[];
    expect(pairs(start).slice(0, 2)).toEqual([['third`', 'string'], ['trim', 'function']]);
    const later = lexer.rangeTokens(2, after, after.length - 4, after.length, never) as CodeToken[];
    expect(later.filter((t) => t.type === 'string').map((t) => t.text).join('')).toBe('`g`');
    expect(pairs(lexer.lineTokens(3, 'h()'))).toEqual([['h', 'function']]);
  });

  it('slices a long line in the pass over the file, and leaves it ready', () => {
    const text = minified(1 << 20);
    const lexer = new CodeLexer({ lineCount: 1, getLine: () => text });
    let slices = 0;
    while (lexer.scan(() => true) && slices < 100_000) slices++;
    expect(slices).toBeGreaterThan(100);
    expect(slices).toBeLessThan(100_000);
    const t0 = performance.now();
    const tokens = lexer.rangeTokens(0, text, 1_000_000, 1_000_300, () => true) as CodeToken[];
    expect(performance.now() - t0).toBeLessThan(5);
    expect(tokens.map((t) => t.text).join('')).toBe(text.slice(1_000_000, 1_000_300));
  });

  it('lexes a window again when the pass finds its line starts somewhere else', () => {
    const long = `x+\`y${'z'.repeat(5000)}\`+w`;
    const lines = ['/* open', long, 'close */'];
    const lexer = new CodeLexer({ lineCount: lines.length, getLine: (i) => lines[i] });
    expect(pairs(lexer.rangeTokens(1, long, 0, 4, never) as CodeToken[])[0]).toEqual(['+', 'operator']);
    lexer.scan(never);
    expect(pairs(lexer.rangeTokens(1, long, 0, 4, never) as CodeToken[])).toEqual([['x+`y', 'comment']]);
  });

  it('labels a range exactly as a whole-line lex does', () => {
    const text = minified(40_000);
    const whole = labelsOf(lexCodeLine(text));
    const lexer = new CodeLexer({ lineCount: 1, getLine: () => text });
    for (const [start, end] of [[0, 200], [3000, 3256], [4096, 8192], [9999, 10_200], [39_900, 40_000], [20_000, 20_001], [100, 150]]) {
      const tokens = lexer.rangeTokens(0, text, start, end, never) as CodeToken[];
      expect(tokens.map((t) => t.text).join('')).toBe(text.slice(start, end));
      expectSameLabels(labelsOf(tokens), whole.slice(start, end), text, start);
    }
  });

  it('resumes anywhere: stopping in the middle changes nothing', () => {
    const text = minified(8000);
    const spansOf = (emit: (e: LexEmit) => void) => {
      const seen = new Array<string>(text.length).fill('plain');
      emit((s, e, t) => {
        for (let i = s; i < e; i++) seen[i] = t;
      });
      return seen;
    };
    const whole = spansOf((e) => lexRange(text, 0, text.length, LEX_START, e));
    for (const step of [1, 7, 64, 1000]) {
      const pieces = spansOf((e) => {
        let at = 0;
        let state = LEX_START;
        while (at < text.length) {
          const r = lexRange(text, at, Math.min(text.length, at + step), state, e);
          expect(r.offset).toBeGreaterThan(at);
          at = r.offset;
          state = r.state;
        }
      });
      expectSameLabels(pieces, whole, text);
    }
  });

  it('does not turn strings inside out past a regular expression, a megabyte in', () => {
    const text = minified(1 << 20);
    const lexer = new CodeLexer({ lineCount: 1, getLine: () => text });
    const start = 1_000_000;
    const tokens = lexer.rangeTokens(0, text, start, start + 400, never) as CodeToken[];
    const strings = tokens.filter((t) => t.type === 'string').map((t) => t.text);
    // Code never ends up labelled as a string: every string here starts with a quote, a backtick or a slash, or is
    // the tail of one cut by the window or part of a template.
    expect(tokens.filter((t) => t.type === 'keyword').length).toBeGreaterThan(0);
    for (const s of strings.slice(1)) expect(s.includes('return')).toBe(false);
  });

  it('is fast enough to run in a frame, and stops when told', () => {
    const text = minified(1 << 20);
    const t0 = performance.now();
    lexRange(text, 0, text.length, LEX_START, null);
    const whole = performance.now() - t0;
    // Cold, on a machine under load. Hot it's closer to 10 ms, and in the viewer it runs in slices anyway.
    expect(whole).toBeLessThan(1500);

    const lexer = new CodeLexer({ lineCount: 1, getLine: () => text });
    expect(lexer.rangeTokens(0, text, 900_000, 900_200, () => true)).toBeNull();
    let checks = 0;
    expect(lexer.rangeTokens(0, text, 900_000, 900_200, () => ++checks > 10)).toBeNull();
    const done = lexer.rangeTokens(0, text, 900_000, 900_200, never) as CodeToken[];
    expect(done.map((t) => t.text).join('')).toBe(text.slice(900_000, 900_200));
    // With the frontier past it, a window is a few kilobytes of work.
    const t1 = performance.now();
    for (let i = 0; i < 100; i++) lexer.rangeTokens(0, text, 800_000 + i * 900, 800_000 + i * 900 + 300, () => true);
    expect(performance.now() - t1).toBeLessThan(50);
  });

  it('finds where lines start inside a comment by a pass over the file', () => {
    const lines = ['a()', '/* open', 'inside', 'close */', 'b()', '`tmpl', 'more`', 'c()'];
    const invalidated: [number, number][] = [];
    const lexer = new CodeLexer({ lineCount: lines.length, getLine: (i) => lines[i], onInvalidate: (a, b) => invalidated.push([a, b]) });
    // Before the pass gets there, a line is assumed plain.
    expect(pairs(lexer.lineTokens(2, 'inside'))).toEqual([]);
    expect(lexer.scan(never)).toBe(false);
    expect(pairs(lexer.lineTokens(2, 'inside'))).toEqual([['inside', 'comment']]);
    expect(pairs(lexer.lineTokens(3, 'close */'))).toEqual([['close */', 'comment']]);
    expect(pairs(lexer.lineTokens(4, 'b()'))).toEqual([['b', 'function']]);
    expect(pairs(lexer.lineTokens(6, 'more`'))).toEqual([['more`', 'string']]);
    expect(invalidated).toEqual([[2, 4], [6, 7]]);
  });

  it('scans in slices', () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `line ${i}`);
    const lexer = new CodeLexer({ lineCount: lines.length, getLine: (i) => lines[i] });
    let slices = 0;
    while (lexer.scan(() => true) && slices < 100_000) slices++;
    expect(slices).toBeGreaterThan(5);
    expect(slices).toBeLessThan(100_000);
  });
});

describe('LineScanner', () => {
  it('finds the widest line and counts cells, in slices', () => {
    const lines = Array.from({ length: 1000 }, (_, i) => 'x'.repeat(i % 50));
    lines[700] = 'x'.repeat(5000);
    lines[701] = '\t\t漢';
    const scanner = new LineScanner({ count: lines.length, get: (i) => lines[i] }, 4, true);
    let slices = 0;
    while (scanner.run(() => true)) slices++;
    expect(slices).toBeGreaterThan(5);
    expect(scanner.maxCells).toBe(5000);
    expect(scanner.cellCounts?.[701]).toBe(10);
  });
});

describe('CodeTokenStore', () => {
  /** A store with a clock and a scheduler the test drives. */
  function setup(produce: Parameters<typeof hostProducer>[0], text = 'const a = 1') {
    const queue: (() => void)[] = [];
    let time = 0;
    const store = new CodeTokenStore({
      produce: hostProducer(produce),
      getText: () => text,
      schedule: (run) => queue.push(run),
      now: () => time,
    });
    return {
      store,
      text,
      tick: (ms = 0) => {
        time += ms;
      },
      flush: () => {
        for (const run of queue.splice(0)) run();
      },
    };
  }

  it('works out tokens once, and cuts them to the window', () => {
    const highlight = vi.fn((text: string) => [{ text, type: 'keyword' as const }]);
    const { store, text } = setup(highlight);
    store.beginFrame(0, 100);
    expect(store.read(1, text, 0, text.length)).toEqual([{ text, type: 'keyword' }]);
    expect(store.read(1, text, 2, 5)).toEqual([{ text: 'nst', type: 'keyword' }]);
    expect(highlight).toHaveBeenCalledTimes(1);
    expect(highlight.mock.calls[0]).toEqual([text, 1, { offset: 0, line: text, partial: false }]);
  });

  it('gives a highlighter a window on a long line, never the line', () => {
    const line = 'x'.repeat(1 << 20);
    const highlight = vi.fn((text: string) => [{ text }]);
    const { store } = setup(highlight, line);
    store.beginFrame(0, 100);
    store.read(0, line, 4096, 4352);
    const [text, index, context] = highlight.mock.calls[0] as unknown as [string, number, { offset: number; partial: boolean }];
    expect(text.length).toBe(256);
    expect(index).toBe(0);
    expect(context.offset).toBe(4096);
    expect(context.partial).toBe(true);
  });

  it('treats null as plain text, and remembers it', () => {
    const highlight = vi.fn(() => null);
    const { store, text } = setup(highlight);
    store.beginFrame(0, 100);
    expect(store.read(1, text, 0, text.length)).toBeNull();
    expect(store.read(1, text, 0, text.length)).toBeNull();
    expect(highlight).toHaveBeenCalledTimes(1);
  });

  it('shows plain text until a promise answers, then bumps the line', async () => {
    let resolve: (tokens: CodeToken[]) => void = () => {};
    const { store, text, flush } = setup(() => new Promise((r) => (resolve = r)));
    const listener = vi.fn();
    store.subscribe(listener);
    store.beginFrame(0, 100);
    expect(store.read(3, text, 0, text.length)).toBeNull();
    expect(store.version(3)).toBe(0);
    resolve([{ text, type: 'string' }]);
    await Promise.resolve();
    await Promise.resolve();
    flush();
    expect(store.version(3)).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.read(3, text, 0, text.length)).toEqual([{ text, type: 'string' }]);
  });

  it('survives a highlighter whose promise rejects', async () => {
    const { store, text } = setup(() => Promise.reject(new Error('no GPU')));
    store.beginFrame(0, 100);
    expect(store.read(3, text, 0, text.length)).toBeNull();
    await Promise.resolve();
    await Promise.resolve();
    expect(store.read(3, text, 0, text.length)).toBeNull();
  });

  it('stops for the frame when highlighting has used its budget, and catches up after', () => {
    const queue: (() => void)[] = [];
    let time = 0;
    const text = 'const a = 1';
    const highlight = vi.fn((t: string) => {
      time += 7; // a slow highlighter
      return [{ text: t }];
    });
    const store = new CodeTokenStore({ produce: hostProducer(highlight), getText: () => text, schedule: (run) => queue.push(run), now: () => time });
    const flush = () => {
      for (const run of queue.splice(0)) run();
    };
    const listener = vi.fn();
    store.subscribe(listener);
    store.beginFrame(0, 100, 6);
    expect(store.read(0, text, 0, text.length)).not.toBeNull();
    expect(store.read(1, text, 0, text.length)).toBeNull();
    expect(highlight).toHaveBeenCalledTimes(1);
    flush();
    expect(highlight).toHaveBeenCalledTimes(2);
    flush();
    expect(store.version(1)).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.read(1, text, 0, text.length)).not.toBeNull();
  });

  it('does not count time spent elsewhere against the budget', () => {
    const highlight = vi.fn((text: string) => [{ text }]);
    const { store, text, tick } = setup(highlight);
    store.beginFrame(0, 100, 6);
    store.read(0, text, 0, text.length);
    tick(100); // rendering other rows, say
    expect(store.read(1, text, 0, text.length)).not.toBeNull();
  });

  it('drops waiting work for lines no longer wanted', () => {
    const highlight = vi.fn((text: string) => [{ text }]);
    const { store, text, flush } = setup(highlight);
    store.beginFrame(0, 100, 0);
    expect(store.read(50, text, 0, text.length)).toBeNull();
    store.beginFrame(200, 300, 100);
    flush();
    expect(highlight).not.toHaveBeenCalled();
  });

  it('runs a long line through the lexer across frames', () => {
    const text = minified(1 << 20);
    const lexer = new CodeLexer({ lineCount: 1, getLine: () => text });
    const queue: (() => void)[] = [];
    let time = 0;
    let calls = 0;
    const produce = lexerProducer(lexer);
    const store = new CodeTokenStore({
      produce: (...args) => {
        calls++;
        time += 10; // every attempt runs out the clock
        return produce(...args);
      },
      getText: () => text,
      schedule: (run) => queue.push(run),
      now: () => time,
    });
    store.beginFrame(0, 1, 5);
    expect(store.read(0, text, 900_000, 900_256)).toBeNull();
    for (let i = 0; i < 2000 && store.read(0, text, 900_000, 900_256) === null; i++) {
      for (const run of queue.splice(0)) run();
      store.beginFrame(0, 1, 1e9);
    }
    const tokens = store.read(0, text, 900_000, 900_256) as CodeToken[];
    expect(tokens.map((t) => t.text).join('')).toBe(text.slice(900_000, 900_256));
    expect(calls).toBeGreaterThanOrEqual(1);
  });

  it('forgets lines when the lexer learns more', () => {
    const lines = ['/* open', 'inside', '*/'];
    const lexer = new CodeLexer({ lineCount: lines.length, getLine: (i) => lines[i] });
    const queue: (() => void)[] = [];
    const store = new CodeTokenStore({ produce: lexerProducer(lexer), getText: (i) => lines[i], schedule: (run) => queue.push(run), now: () => 0 });
    store.beginFrame(0, 3, 100);
    expect(pairs(store.read(1, lines[1], 0, 6) as CodeToken[])).toEqual([]);
    lexer.scan(never);
    store.invalidate(1, 3);
    expect(store.version(1)).toBe(1);
    expect(pairs(store.read(1, lines[1], 0, 6) as CodeToken[])).toEqual([['inside', 'comment']]);
  });
});
