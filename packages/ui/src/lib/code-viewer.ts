/* CodeViewer's logic: everything that doesn't need a DOM.

   A line is laid out on a grid of cells, not measured. An ordinary character is one cell wide, a tab reaches the next
   tab stop, East Asian wide characters and emoji are two, and combining marks belong to the cell before them. That is
   what lets the viewer answer "which part of a megabyte line is on screen" with arithmetic: x = cell * cellWidth.

   Lines are numbered from 1 in the viewer's props, as an editor shows them; `lineIndex` is from 0. Columns count UTF-16
   code units from 0, as the JS engines' source positions do. */

/* ── Cells ── */

/** Every character here is exactly one cell and one UTF-16 code unit, and safe to leave in a run of text: the mono font
    has these, so nothing drifts off the grid. Controls, soft hyphens and combining marks are not in it. */
const PLAIN_LINE = /^[\x20-\x7e\xa0-\xac\xae-\u02ff\u0370-\u0482\u048a-\u052f]*$/;

const WIDE_CHAR =
  /[\p{Emoji_Presentation}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}\p{Script=Yi}\u2e80-\u303e\u3200-\u33ff\ufe10-\ufe19\ufe30-\ufe6f\uff01-\uff60\uffe0-\uffe6]/u;
const ZERO_WIDTH_CHAR = /[\p{Mn}\p{Me}\p{Emoji_Modifier}\u200c\u200d]/u;

const ZWJ = 0x200d;
const isRegional = (cp: number) => cp >= 0x1f1e6 && cp <= 0x1f1ff;

const cellMemo = new Map<number, number>();

/** How many cells a code point takes on its own: 0 for marks that sit on the cell before, 1, or 2. A tab has no fixed
    width, so callers handle it first. */
export function codePointCells(cp: number): number {
  if (cp < 0x300) return 1;
  if (cp >= 0x4e00 && cp <= 0x9fff) return 2;
  let cells = cellMemo.get(cp);
  if (cells === undefined) {
    const ch = String.fromCodePoint(cp);
    cells = ZERO_WIDTH_CHAR.test(ch) ? 0 : WIDE_CHAR.test(ch) ? 2 : 1;
    cellMemo.set(cp, cells);
  }
  return cells;
}

function codePointAt(text: string, i: number): number {
  const c = text.charCodeAt(i);
  if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
    const d = text.charCodeAt(i + 1);
    if (d >= 0xdc00 && d <= 0xdfff) return ((c - 0xd800) << 10) + (d - 0xdc00) + 0x10000;
  }
  return c;
}

/** One visual unit of a line: a base character and the marks and joined code points that draw on it. */
function clusterEnd(text: string, i: number): number {
  const first = codePointAt(text, i);
  let next = i + (first > 0xffff ? 2 : 1);
  const length = text.length;
  if (isRegional(first) && next < length && isRegional(codePointAt(text, next))) next += 2;
  while (next < length) {
    const c = text.charCodeAt(next);
    if (c < 0x300) break;
    const cp = codePointAt(text, next);
    if (codePointCells(cp) !== 0) break;
    next += cp > 0xffff ? 2 : 1;
    if (cp === ZWJ && next < length) next += codePointAt(text, next) > 0xffff ? 2 : 1;
  }
  return next;
}

/** A cluster's width at `cell`. It is never zero: a mark with nothing before it still has to be drawn somewhere. */
function clusterCells(text: string, i: number, cell: number, tabSize: number): number {
  const c = text.charCodeAt(i);
  if (c === 9) return tabSize - (cell % tabSize);
  if (c < 0x300) return 1;
  const cp = codePointAt(text, i);
  return isRegional(cp) ? 2 : codePointCells(cp) || 1;
}

const MARK_EVERY = 1024;

/** A line's grid: where each code unit lands. A line of plain characters needs no storage at all; anything else keeps
    a mark per kilobyte, so any position is found by a binary search and a short walk, on a megabyte line too. */
export class LineMetrics {
  readonly text: string;
  readonly tabSize: number;
  /** Every code unit is one cell, so offset and cell are the same number. */
  readonly plain: boolean;
  /** Cells across the whole line. */
  readonly cells: number;
  /** Pairs of [offset, cell], at cluster starts. */
  private marks: Int32Array | null = null;
  private markCount = 0;

  constructor(text: string, tabSize: number = DEFAULT_TAB_SIZE) {
    this.text = text;
    this.tabSize = tabSize;
    this.plain = PLAIN_LINE.test(text);
    if (this.plain) {
      this.cells = text.length;
      return;
    }
    const marks = new Int32Array(2 * (Math.floor(text.length / MARK_EVERY) + 2));
    let count = 0;
    let offset = 0;
    let cell = 0;
    let nextMark = 0;
    const length = text.length;
    while (offset < length) {
      if (offset >= nextMark) {
        marks[count * 2] = offset;
        marks[count * 2 + 1] = cell;
        count++;
        nextMark = offset + MARK_EVERY;
      }
      cell += clusterCells(text, offset, cell, tabSize);
      offset = clusterEnd(text, offset);
    }
    this.marks = marks;
    this.markCount = count;
    this.cells = cell;
  }

  /** The last mark at or before `value` in the pair's `field` (0: offset, 1: cell). */
  private markBefore(value: number, field: 0 | 1): number {
    const marks = this.marks as Int32Array;
    let lo = 0;
    let hi = this.markCount - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (marks[mid * 2 + field] <= value) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** The cell a code unit starts in. An offset inside a cluster gives the cluster's first cell. */
  cellAt(offset: number): number {
    if (offset <= 0) return 0;
    if (this.plain) return Math.min(offset, this.text.length);
    if (offset >= this.text.length) return this.cells;
    const marks = this.marks as Int32Array;
    const mark = this.markBefore(offset, 0);
    let at = marks[mark * 2];
    let cell = marks[mark * 2 + 1];
    for (;;) {
      const end = clusterEnd(this.text, at);
      if (end > offset) return cell;
      cell += clusterCells(this.text, at, cell, this.tabSize);
      at = end;
    }
  }

  /** The start of the cluster covering `cell`; the line's length past its end. Always a cluster boundary, so a window
      cut here never splits a surrogate pair from itself or a mark from its base. */
  offsetAt(cell: number): number {
    if (cell <= 0) return 0;
    if (this.plain) return Math.min(cell, this.text.length);
    if (cell >= this.cells) return this.text.length;
    const marks = this.marks as Int32Array;
    const mark = this.markBefore(cell, 1);
    let at = marks[mark * 2];
    let c = marks[mark * 2 + 1];
    for (;;) {
      const width = clusterCells(this.text, at, c, this.tabSize);
      if (c + width > cell) return at;
      c += width;
      at = clusterEnd(this.text, at);
    }
  }

  /** The cluster boundary nearest to a position on the grid: where a click lands. `cell` can be fractional. */
  nearest(cell: number): number {
    if (cell <= 0) return 0;
    if (this.plain) return Math.min(Math.round(cell), this.text.length);
    if (cell >= this.cells) return this.text.length;
    const start = this.offsetAt(Math.floor(cell));
    const end = clusterEnd(this.text, start);
    const from = this.cellAt(start);
    const to = this.cellAt(end);
    return cell - from < (to - from) / 2 ? start : end;
  }

  /** The next cluster boundary after `offset`. */
  after(offset: number): number {
    return offset >= this.text.length ? this.text.length : this.plain ? offset + 1 : clusterEnd(this.text, this.offsetAt(this.cellAt(offset)));
  }

  /** The cluster boundary before `offset`. */
  before(offset: number): number {
    if (offset <= 0) return 0;
    if (this.plain) return offset - 1;
    const cell = this.cellAt(Math.min(offset, this.text.length));
    const start = this.offsetAt(cell);
    return start < offset ? start : this.offsetAt(cell - 1);
  }
}

export const DEFAULT_TAB_SIZE = 2;

/** A control or invisible character drawn as something you can see: a replacement for display, never for copying. */
function controlSymbol(c: number): string {
  if (c < 0x20) return String.fromCharCode(0x2400 + c);
  return c === 0x7f ? '\u2421' : '\u00b7';
}

const isInvisible = (c: number) =>
  c < 0x20 || (c >= 0x7f && c < 0xa0) || c === 0xad || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) ||
  (c >= 0x2060 && c <= 0x206f) || c === 0xfeff;

/** What the DOM gets for a range of a line. A string is a run of text; a box is held to its cells, because a fallback
    font's idea of a character's width isn't the grid's. */
export type DisplayPiece = string | { text: string; cells: number; control?: boolean; rtl?: boolean };

const RTL_CHAR = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}\p{Script=Adlam}]/u;
const rtlMemo = new Map<number, boolean>();

function isRtl(cp: number): boolean {
  if (cp < 0x590) return false;
  let rtl = rtlMemo.get(cp);
  if (rtl === undefined) {
    rtl = RTL_CHAR.test(String.fromCodePoint(cp));
    rtlMemo.set(cp, rtl);
  }
  return rtl;
}

/** The end of a right-to-left run starting at `i`: its letters, and the spaces and punctuation between them. */
function rtlRunEnd(text: string, i: number, limit: number): number {
  let end = clusterEnd(text, i);
  let at = end;
  while (at < limit) {
    const c = text.charCodeAt(at);
    if (c === 32 || c === 0x2c || c === 0x2e || c === 0x3a || c === 0x21 || c === 0x3f || c === 0x2d || c === 0x60c || c === 0x61b || c === 0x61f) {
      at++;
      continue;
    }
    if (!isRtl(codePointAt(text, at))) break;
    at = clusterEnd(text, at);
    end = at;
  }
  return Math.min(end, limit);
}

/** The text to draw for `[start, end)`: tabs as the spaces they span from where they are on the line, and anything that
    could leave the grid in a box. `start` and `end` are offsets at cluster boundaries. */
export function displayPieces(metrics: LineMetrics, start: number, end: number): DisplayPiece[] {
  const { text, tabSize } = metrics;
  if (start >= end) return [];
  if (metrics.plain) return [text.slice(start, end)];
  const out: DisplayPiece[] = [];
  const finish = end;
  let run = '';
  let at = start;
  let cell = metrics.cellAt(start);
  while (at < end) {
    const c = text.charCodeAt(at);
    // A right-to-left run stays one piece, so the browser can shape it and put it in its own order: the grid holds its
    // place on the line, but not the place of each letter inside it.
    if (c >= 0x590 && isRtl(codePointAt(text, at))) {
      if (run) out.push(run);
      run = '';
      const end = rtlRunEnd(text, at, finish);
      const cells = metrics.cellAt(end) - cell;
      out.push({ text: text.slice(at, end), cells, rtl: true });
      cell += cells;
      at = end;
      continue;
    }
    const next = clusterEnd(text, at);
    const width = clusterCells(text, at, cell, tabSize);
    if (c === 9) run += ' '.repeat(width);
    else if (isInvisible(c)) {
      if (run) out.push(run);
      run = '';
      out.push({ text: controlSymbol(c), cells: width, control: true });
    } else if (c < 0x530 && !(c >= 0x300 && c < 0x370)) run += text.slice(at, next);
    else {
      if (run) out.push(run);
      run = '';
      out.push({ text: text.slice(at, next), cells: width });
    }
    cell += width;
    at = next;
  }
  if (run) out.push(run);
  return out;
}

/* ── Windows ── what to render, as rows and cells. Everything is kept on a coarse grid with room to spare, so most
   scroll frames only move what's already there, and a window that changes changes few rows. */

/** Horizontal windows start and end on multiples of this many cells. */
export const TILE_CELLS = 128;
/** Cells kept past each edge of what's visible. */
const CELL_MARGIN = 32;
/** Rows kept past each edge of what's visible. */
export const ROW_OVERSCAN = 8;

export interface Span {
  /** First, inclusive. */
  start: number;
  /** Last, exclusive. */
  end: number;
}

export function visibleRows(scrollY: number, height: number, lineHeight: number, rowCount: number): Span {
  const start = Math.max(0, Math.min(rowCount, Math.floor(scrollY / lineHeight)));
  const end = Math.max(start, Math.min(rowCount, Math.ceil((scrollY + height) / lineHeight)));
  return { start, end };
}

/** The rows to render: the same as before while everything visible is still in it. */
export function nextRowWindow(current: Span | null, visible: Span, rowCount: number, overscan: number = ROW_OVERSCAN): Span {
  if (current && visible.start >= current.start && visible.end <= current.end && current.end <= rowCount) return current;
  return { start: Math.max(0, visible.start - overscan), end: Math.min(rowCount, visible.end + overscan) };
}

export function visibleCells(scrollX: number, width: number, cellWidth: number): Span {
  const start = Math.max(0, Math.floor(scrollX / cellWidth));
  return { start, end: start + Math.max(1, Math.ceil(width / cellWidth) + 1) };
}

/** The cells to render on every long line: the same as before while everything visible is still in it. */
export function nextCellWindow(current: Span | null, visible: Span): Span {
  if (current && visible.start >= current.start && visible.end <= current.end) return current;
  return {
    start: Math.max(0, Math.floor((visible.start - CELL_MARGIN) / TILE_CELLS) * TILE_CELLS),
    end: Math.ceil((visible.end + CELL_MARGIN) / TILE_CELLS) * TILE_CELLS,
  };
}

/** Where to put the DOM's zero: rows and cells are drawn relative to a multiple of `every`, so the numbers in the DOM
    stay small however far down the file you are, and only change once in a long while. */
export const originOf = (value: number, every: number) => Math.floor(value / every) * every;

/* ── Scroll range ── Browsers cap an element's size (Firefox near 17.8M px, Chromium and Safari near 33.5M), so a scroll
   range past this is compressed: the scrollbar covers everything, and a pixel of it is more than a pixel of code. */

export const MAX_SCROLL_SIZE = 16_000_000;

export const physicalSize = (virtual: number) => Math.min(virtual, MAX_SCROLL_SIZE);

/** Physical scroll position to virtual, exact at both ends of the range. */
export function toVirtualScroll(physical: number, virtualSize: number, client: number): number {
  if (virtualSize <= MAX_SCROLL_SIZE) return physical;
  const room = MAX_SCROLL_SIZE - client;
  return room > 0 ? (physical / room) * (virtualSize - client) : 0;
}

export function toPhysicalScroll(virtual: number, virtualSize: number, client: number): number {
  if (virtualSize <= MAX_SCROLL_SIZE) return virtual;
  const room = virtualSize - client;
  return room > 0 ? (virtual / room) * (MAX_SCROLL_SIZE - client) : 0;
}

export type CodeViewerAlign = 'start' | 'center' | 'end' | 'nearest';

/** Where to scroll to put `[position, position + size)` at `align` in a view of `client` px. `margin` keeps `nearest`
    off the very edge. */
export function alignedScroll(position: number, size: number, client: number, current: number, align: CodeViewerAlign, margin = 0): number {
  switch (align) {
    case 'start':
      return position;
    case 'end':
      return position + size - client;
    case 'center':
      return position + size / 2 - client / 2;
    default: {
      if (position - margin < current) return position - margin;
      if (position + size + margin > current + client) return position + size + margin - client;
      return current;
    }
  }
}

/** Where to scroll to bring something into view for a reader following along: nowhere if it's already well inside, and
    otherwise a third of the way into the view, so what comes next is visible too. */
export function revealScroll(position: number, size: number, client: number, current: number, margin: number): number {
  if (position >= current + margin && position + size <= current + client - margin) return current;
  return position - client / 3;
}

/* ── Rows ── With wrapping off a row is a line. With it on, a line is as many rows as it takes at `cols` cells each, and
   this keeps the running count, so a row finds its line by binary search. */

export interface RowLocation {
  /** Index of the line. */
  line: number;
  /** Which of the line's rows, from 0. */
  part: number;
}

export interface RowMap {
  readonly rowCount: number;
  rowOfLine(line: number): number;
  locate(row: number): RowLocation;
}

export function identityRowMap(lineCount: number): RowMap {
  return { rowCount: lineCount, rowOfLine: (line) => line, locate: (row) => ({ line: row, part: 0 }) };
}

/** The rows of lines with `cellCounts[i]` cells at `cols` cells to a row. An unknown line (0 cells) is one row. */
export function wrapRowMap(cellCounts: Uint32Array, cols: number): RowMap {
  const width = Math.max(1, cols);
  const count = cellCounts.length;
  const starts = new Float64Array(count + 1);
  for (let i = 0; i < count; i++) starts[i + 1] = starts[i] + Math.max(1, Math.ceil(cellCounts[i] / width));
  return {
    rowCount: starts[count],
    rowOfLine: (line) => starts[Math.max(0, Math.min(count, line))],
    locate(row) {
      let lo = 0;
      let hi = Math.max(0, count - 1);
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= row) lo = mid;
        else hi = mid - 1;
      }
      return { line: lo, part: Math.max(0, row - starts[lo]) };
    },
  };
}

/** The part of a line a wrapped row shows. A wide character that doesn't fit stays on the row it started on. */
export function wrappedSpan(metrics: LineMetrics, part: number, cols: number): Span {
  const boundary = (cell: number) => {
    const offset = metrics.offsetAt(cell);
    return metrics.cellAt(offset) < cell ? metrics.after(offset) : offset;
  };
  return { start: boundary(part * cols), end: boundary((part + 1) * cols) };
}

/* ── Selection ── The viewer's own: two positions in the document, whatever is or isn't in the DOM. */

export interface CodePosition {
  /** Index of the line. */
  line: number;
  /** UTF-16 code units from the start of the line. */
  offset: number;
}

export interface CodeSelection {
  anchor: CodePosition;
  focus: CodePosition;
}

export const comparePositions = (a: CodePosition, b: CodePosition) => a.line - b.line || a.offset - b.offset;

export function orderedSelection(selection: CodeSelection): { from: CodePosition; to: CodePosition } {
  return comparePositions(selection.anchor, selection.focus) <= 0
    ? { from: selection.anchor, to: selection.focus }
    : { from: selection.focus, to: selection.anchor };
}

export const isCollapsed = (selection: CodeSelection) => comparePositions(selection.anchor, selection.focus) === 0;

/** Copy stops here. Past it a clipboard write stalls the browser, and a string this long is rarely what anyone wanted. */
export const MAX_COPY_LENGTH = 64 * 1024 * 1024;

/** The selected text, as the source has it: tabs stay tabs, and lines join with `\n`. */
export function selectionText(
  selection: CodeSelection,
  getLine: (index: number) => string,
  limit: number = MAX_COPY_LENGTH,
): { text: string; truncated: boolean } {
  const { from, to } = orderedSelection(selection);
  if (from.line === to.line) {
    const text = getLine(from.line).slice(from.offset, to.offset);
    return text.length > limit ? { text: text.slice(0, limit), truncated: true } : { text, truncated: false };
  }
  const parts: string[] = [];
  let size = 0;
  for (let line = from.line; line <= to.line; line++) {
    const text = getLine(line);
    const piece = line === from.line ? text.slice(from.offset) : line === to.line ? text.slice(0, to.offset) : text;
    if (size + piece.length > limit) {
      parts.push(piece.slice(0, Math.max(0, limit - size)));
      return { text: parts.join('\n'), truncated: true };
    }
    parts.push(piece);
    size += piece.length + 1;
  }
  return { text: parts.join('\n'), truncated: false };
}

export type SelectionKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

/** Where the moving end of a selection goes for a key: by clusters along a line and across its ends, and to the same
    place on the grid up and down. */
export function movePosition(position: CodePosition, key: SelectionKey, metricsOf: (line: number) => LineMetrics, lineCount: number): CodePosition {
  const { line, offset } = position;
  const metrics = metricsOf(line);
  switch (key) {
    case 'Home':
      return { line, offset: 0 };
    case 'End':
      return { line, offset: metrics.text.length };
    case 'ArrowLeft':
      if (offset > 0) return { line, offset: metrics.before(offset) };
      return line > 0 ? { line: line - 1, offset: metricsOf(line - 1).text.length } : position;
    case 'ArrowRight':
      if (offset < metrics.text.length) return { line, offset: metrics.after(offset) };
      return line < lineCount - 1 ? { line: line + 1, offset: 0 } : position;
    case 'ArrowUp':
      return line > 0 ? { line: line - 1, offset: metricsOf(line - 1).nearest(metrics.cellAt(offset)) } : { line, offset: 0 };
    default:
      return line < lineCount - 1 ? { line: line + 1, offset: metricsOf(line + 1).nearest(metrics.cellAt(offset)) } : { line, offset: metrics.text.length };
  }
}

/** The cells a selection covers on a line, with one more if it runs on past the line's end. */
export function selectionCells(ordered: { from: CodePosition; to: CodePosition }, line: number, metrics: LineMetrics): Span | null {
  const { from, to } = ordered;
  if (line < from.line || line > to.line) return null;
  const start = line === from.line ? metrics.cellAt(from.offset) : 0;
  const end = line === to.line ? metrics.cellAt(to.offset) : metrics.cells + 1;
  return end > start ? { start, end } : null;
}

export type SelectionGranularity = 'char' | 'word' | 'line';

/** A selection as a drag extends it: by characters from a point, or by whole words or lines from what the double or triple
    click selected. */
export function extendSelection(
  base: CodeSelection,
  to: CodePosition,
  granularity: SelectionGranularity,
  getLine: (index: number) => string,
  lineCount: number,
): CodeSelection {
  if (granularity === 'char') return { anchor: base.anchor, focus: to };
  const { from: start, to: end } = orderedSelection(base);
  const backward = comparePositions(to, start) < 0;
  if (!backward && comparePositions(to, end) <= 0) return { anchor: start, focus: end };
  if (granularity === 'word') {
    const word = wordAt(getLine(to.line), to.offset);
    return backward
      ? { anchor: end, focus: { line: to.line, offset: word.start } }
      : { anchor: start, focus: { line: to.line, offset: word.end } };
  }
  if (backward) return { anchor: end, focus: { line: to.line, offset: 0 } };
  const last = to.line >= lineCount - 1;
  return { anchor: start, focus: last ? { line: to.line, offset: getLine(to.line).length } : { line: to.line + 1, offset: 0 } };
}

const isWordCode = (c: number) =>
  (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || c === 0x5f || c === 0x24 || c >= 0x80;

/** The word, or run of spaces, or single other character at `offset`: what a double click selects. */
export function wordAt(text: string, offset: number): Span {
  if (!text.length) return { start: 0, end: 0 };
  const at = Math.min(offset, text.length - 1);
  const code = text.charCodeAt(at);
  const space = code === 32 || code === 9;
  const test = space ? (c: number) => c === 32 || c === 9 : isWordCode(code) ? isWordCode : null;
  if (!test) return { start: at, end: at + 1 };
  let start = at;
  let end = at + 1;
  while (start > 0 && test(text.charCodeAt(start - 1))) start--;
  while (end < text.length && test(text.charCodeAt(end))) end++;
  return { start, end };
}

/* ── Markers ── */

const sortedByColumn = new WeakMap<readonly { column: number }[], readonly { column: number }[]>();

/** The markers with a column in `[start, end)`: a line of a bundle can have tens of thousands, so the window's few are
    found by binary search. `end` past the line's length includes markers past its end. */
export function markersInRange<T extends { column: number }>(markers: readonly T[], start: number, end: number): readonly T[] {
  if (!markers.length) return markers;
  let sorted = sortedByColumn.get(markers) as readonly T[] | undefined;
  if (!sorted) {
    const inOrder = markers.every((m, i) => i === 0 || markers[i - 1].column <= m.column);
    sorted = inOrder ? markers : [...markers].sort((a, b) => a.column - b.column);
    sortedByColumn.set(markers, sorted);
  }
  const lowerBound = (column: number) => {
    let lo = 0;
    let hi = (sorted as readonly T[]).length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((sorted as readonly T[])[mid].column < column) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const from = lowerBound(start);
  const to = lowerBound(end);
  return from === 0 && to === sorted.length ? sorted : sorted.slice(from, to);
}

/* ── Tokens ── */

/** The library's token colors: the same labels as SyntaxHighlighting's (`SyntaxTokenType`), so its tokens fit here. Spelled
    out rather than imported, so that this module doesn't bring lib/syntax and gpu-lexer along. */
export type CodeTokenType = 'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'type' | 'function' | 'constant' | 'operator';

/** A labelled piece of text. The pieces of a highlighted range, joined, are that range. */
export interface CodeToken {
  text: string;
  /** Colors it through the library's `bl-tok-*` classes (`--bl-syntax-*`). */
  type?: CodeTokenType;
  className?: string;
}

/** The part of `tokens` (which start at offset `base`) inside `[start, end)`. */
export function clipTokens(tokens: readonly CodeToken[], base: number, start: number, end: number): CodeToken[] {
  const out: CodeToken[] = [];
  let at = base;
  for (const token of tokens) {
    const next = at + token.text.length;
    if (next > start && at < end) {
      out.push(at >= start && next <= end ? token : { ...token, text: token.text.slice(Math.max(0, start - at), end - at) });
    }
    at = next;
    if (at >= end) break;
  }
  return out;
}

/* ── The default lexer ── C-family and script shaped, like the library's fallback in lib/syntax.ts, with the same labels
   but not its regular expression: this one can stop anywhere and carry on from there, so a window in the middle of a
   megabyte line is lexed exactly as if the whole line had been, for the cost of the kilobytes before it. It tells a
   regular expression from a division, without which one `/["']/` in a bundle turns every string after it inside out. */

const MODE_CODE = 0;
const MODE_COMMENT = 1;
const MODE_HTML_COMMENT = 2;
const MODE_SINGLE = 3;
const MODE_DOUBLE = 4;
const MODE_TEMPLATE = 5;

/** Where the lexer is. Plain data: copied to resume at a checkpoint or at a line that starts inside a comment. */
export interface LexState {
  mode: number;
  /** A `/` here would start a regular expression. */
  regexAllowed: boolean;
  /** For each `${` still open, how many braces were open inside it before the current one. */
  templates: readonly number[];
  /** Braces open inside the current `${`. */
  depth: number;
}

export const LEX_START: LexState = { mode: MODE_CODE, regexAllowed: true, templates: [], depth: 0 };

const isPlainState = (s: LexState) => s.mode === MODE_CODE && s.templates.length === 0;

const KEYWORDS = new Set(
  ('as async await break case catch class const continue debugger def default delete do elif else enum export extends ' +
    'finally fn for from func function go if impl implements import in instanceof interface let match mod module mut new ' +
    'of package pass private protected pub public raise readonly return static struct super switch then this throw ' +
    'trait try type typeof use var void where while with yield fi done esac local echo').split(' '),
);
const CONSTANTS = new Set('true false null undefined nil None True False NaN Infinity self'.split(' '));
const BEFORE_REGEX = new Set('return typeof instanceof in of new delete void throw case do else yield await'.split(' '));
const LONGEST_WORD = 10;

const isDigit = (c: number) => c >= 0x30 && c <= 0x39;
const isWordStart = (c: number) => (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || c === 0x5f || c === 0x24 || c >= 0x80;
const isWordPart = (c: number) => isWordStart(c) || isDigit(c);
// = < > ! + - * % & | ^ ~ ? :
const isOperator = (c: number) =>
  c === 0x3d || c === 0x3c || c === 0x3e || c === 0x21 || c === 0x2b || c === 0x2d || c === 0x2a || c === 0x25 ||
  c === 0x26 || c === 0x7c || c === 0x5e || c === 0x7e || c === 0x3f || c === 0x3a;

/** How far ahead a `/` looks for the end of a regular expression before deciding it's a division. */
const REGEX_LOOKAHEAD = 1024;

/** The end of the regular expression starting at `start` (a `/`), flags included, or -1 if there doesn't seem to be one. */
function regexEnd(text: string, start: number): number {
  const stop = Math.min(text.length, start + REGEX_LOOKAHEAD);
  let inClass = false;
  for (let i = start + 1; i < stop; i++) {
    const c = text.charCodeAt(i);
    if (c === 0x5c) i++;
    else if (c === 0x5b) inClass = true;
    else if (c === 0x5d) inClass = false;
    else if (c === 0x2f && !inClass) {
      let end = i + 1;
      while (end < text.length && isWordPart(text.charCodeAt(end))) end++;
      return end;
    }
  }
  return -1;
}

/** Where a string ends, past its closing quote; or, bitwise negated, where it stopped without one: at `to` or the end of
    the line. */
function stringEnd(text: string, from: number, to: number, quote: number): number {
  let end = from;
  while (end < text.length) {
    const c = text.charCodeAt(end);
    if (c === 0x5c) end += 2;
    else if (c === quote) return end + 1;
    else if (end >= to) return ~end;
    else end++;
  }
  return ~Math.min(end, text.length);
}

export type LexEmit = (start: number, end: number, type: CodeTokenType) => void;

/** Lexes `text` from `from` until at least `to`, starting in `state`, and returns where it stopped and the state there.
    It stops at `to` exactly inside a comment or string, and at the end of the token otherwise. `emit` gets every labelled
    span; nothing is emitted for plain text. */
export function lexRange(text: string, from: number, to: number, state: LexState, emit: LexEmit | null): { offset: number; state: LexState } {
  const length = text.length;
  let i = from;
  let mode = state.mode;
  let regexAllowed = state.regexAllowed;
  let templates = state.templates;
  let depth = state.depth;

  while (i < to && i < length) {
    if (mode === MODE_CODE) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 9) {
        i++;
      } else if (isWordStart(c)) {
        let end = i + 1;
        while (end < length && isWordPart(text.charCodeAt(end))) end++;
        const member = text.charCodeAt(i - 1) === 0x2e;
        let type: CodeTokenType = 'plain';
        const short = end - i <= LONGEST_WORD;
        const word = short ? text.slice(i, end) : '';
        regexAllowed = short && !member && BEFORE_REGEX.has(word);
        if (short && !member && KEYWORDS.has(word)) type = 'keyword';
        else if (short && !member && CONSTANTS.has(word)) type = 'constant';
        else {
          let next = end;
          while (next < length && next < end + 4 && text.charCodeAt(next) === 32) next++;
          if (text.charCodeAt(next) === 0x28) type = 'function';
          else {
            const second = text.charCodeAt(i + 1);
            if (c >= 0x41 && c <= 0x5a && second >= 0x61 && second <= 0x7a) type = 'type';
          }
        }
        if (type !== 'plain') emit?.(i, end, type);
        i = end;
      } else if (isDigit(c) || (c === 0x2e && isDigit(text.charCodeAt(i + 1)))) {
        let end = i + 1;
        const radix = c === 0x30 && (text.charCodeAt(i + 1) | 0x20);
        if (radix === 0x78 || radix === 0x6f || radix === 0x62) {
          end = i + 2;
          while (end < length && isWordPart(text.charCodeAt(end))) end++;
        } else {
          while (end < length) {
            const d = text.charCodeAt(end);
            if (isWordPart(d) || d === 0x2e) {
              // An exponent can take a sign.
              if ((d | 0x20) === 0x65) {
                const sign = text.charCodeAt(end + 1);
                if ((sign === 0x2b || sign === 0x2d) && isDigit(text.charCodeAt(end + 2))) end += 2;
              }
              // `1.toString` doesn't exist, but `1..toString` and a range's `1..2` do: a second dot ends the number.
              if (d === 0x2e && !isDigit(text.charCodeAt(end + 1))) break;
              end++;
            } else break;
          }
        }
        emit?.(i, end, 'number');
        regexAllowed = false;
        i = end;
      } else if (c === 0x22 || c === 0x27) {
        const end = stringEnd(text, i + 1, to, c);
        mode = end < 0 ? (c === 0x22 ? MODE_DOUBLE : MODE_SINGLE) : MODE_CODE;
        emit?.(i, end < 0 ? ~end : end, 'string');
        regexAllowed = false;
        i = end < 0 ? ~end : end;
      } else if (c === 0x60) {
        mode = MODE_TEMPLATE;
        emit?.(i, i + 1, 'string');
        i++;
      } else if (c === 0x2f) {
        const d = text.charCodeAt(i + 1);
        if (d === 0x2f) {
          emit?.(i, length, 'comment');
          i = length;
        } else if (d === 0x2a) {
          mode = MODE_COMMENT;
          emit?.(i, i + 2, 'comment');
          i += 2;
        } else {
          const end = regexAllowed && text.charCodeAt(i - 1) !== 0x3c ? regexEnd(text, i) : -1;
          if (end > 0) {
            emit?.(i, end, 'string');
            regexAllowed = false;
            i = end;
          } else {
            const op = d === 0x3d ? 2 : 1;
            emit?.(i, i + op, 'operator');
            regexAllowed = true;
            i += op;
          }
        }
      } else if (c === 0x23) {
        const d = text.charCodeAt(i + 1);
        if (i + 1 >= length || d === 32 || d === 9 || d === 0x21) {
          emit?.(i, length, 'comment');
          i = length;
        } else i++;
      } else if (c === 0x3c && text.startsWith('<!--', i)) {
        mode = MODE_HTML_COMMENT;
        emit?.(i, i + 4, 'comment');
        i += 4;
      } else if (isOperator(c)) {
        let end = i + 1;
        while (end < length && isOperator(text.charCodeAt(end))) end++;
        // `?.` is one operator, unless a digit follows: then it's `? .5`.
        if (text.charCodeAt(end - 1) === 0x3f && text.charCodeAt(end) === 0x2e && !isDigit(text.charCodeAt(end + 1))) end++;
        // A lone colon stays plain.
        if (!(end === i + 1 && c === 0x3a)) emit?.(i, end, 'operator');
        const crement = end === i + 2 && (c === 0x2b || c === 0x2d) && text.charCodeAt(i + 1) === c;
        regexAllowed = !crement;
        i = end;
      } else if (c === 0x2e) {
        let end = i + 1;
        while (end < length && end < i + 3 && text.charCodeAt(end) === 0x2e) end++;
        if (end > i + 1) emit?.(i, end, 'operator');
        regexAllowed = end > i + 1;
        i = end;
      } else if (c === 0x7b) {
        if (templates.length) depth++;
        regexAllowed = true;
        i++;
      } else if (c === 0x7d) {
        if (templates.length && depth === 0) {
          depth = templates[templates.length - 1];
          templates = templates.slice(0, -1);
          emit?.(i, i + 1, 'operator');
          mode = MODE_TEMPLATE;
        } else {
          if (templates.length) depth--;
          regexAllowed = false;
        }
        i++;
      } else {
        // ( [ , ; allow a regular expression after them; ) ] and anything else don't.
        regexAllowed = c === 0x28 || c === 0x5b || c === 0x2c || c === 0x3b;
        i++;
      }
    } else if (mode === MODE_COMMENT || mode === MODE_HTML_COMMENT) {
      const close = mode === MODE_COMMENT ? '*/' : '-->';
      const found = text.indexOf(close, i);
      // A close that starts before `to` finishes it, so a stop can't fall between its characters.
      if (found >= 0 && found < to) {
        emit?.(i, found + close.length, 'comment');
        i = found + close.length;
        mode = MODE_CODE;
        regexAllowed = true;
      } else {
        const stop = Math.min(to, length);
        emit?.(i, stop, 'comment');
        i = stop;
      }
    } else if (mode === MODE_SINGLE || mode === MODE_DOUBLE) {
      // Only reached when a string was cut off at `to` last time.
      const end = stringEnd(text, i, to, mode === MODE_SINGLE ? 0x27 : 0x22);
      if (end >= 0) mode = MODE_CODE;
      emit?.(i, end < 0 ? ~end : end, 'string');
      regexAllowed = false;
      i = end < 0 ? ~end : end;
    } else {
      // A template literal, up to its end or its next `${`.
      let end = i;
      let opened = false;
      while (end < length && end < to) {
        const d = text.charCodeAt(end);
        if (d === 0x5c) end += 2;
        else if (d === 0x60) {
          end++;
          mode = MODE_CODE;
          regexAllowed = false;
          break;
        } else if (d === 0x24 && text.charCodeAt(end + 1) === 0x7b) {
          opened = true;
          break;
        } else end++;
      }
      end = Math.min(end, length);
      if (end > i) emit?.(i, end, 'string');
      i = end;
      if (opened) {
        emit?.(i, i + 2, 'operator');
        templates = [...templates, depth];
        depth = 0;
        mode = MODE_CODE;
        regexAllowed = true;
        i += 2;
      }
    }
  }
  return { offset: Math.max(i, from), state: { mode, regexAllowed, templates, depth } };
}

/** Lines past this length are "long": highlighted a window at a time. */
export const LONG_LINE = 4096;

/** The pass over a file stops after this much text: what starts inside a comment that far down is assumed not to. */
const MAX_SCAN_CHARS = 64 * 1024 * 1024;

/** What a state at the end of a line leaves for the next. Comments and template literals carry on, and bundlers do leave
    template literals across lines, even in minified code. A string can't cross a line. */
function endOfLine(state: LexState): LexState {
  const mode = state.mode === MODE_SINGLE || state.mode === MODE_DOUBLE ? MODE_CODE : state.mode;
  return mode === MODE_CODE && state.templates.length === 0 ? LEX_START : { ...state, mode, regexAllowed: true };
}

/** The state a line leaves for the next. */
export function nextLineState(text: string, state: LexState): LexState {
  if (isPlainState(state) && !text.includes('/*') && !text.includes('`') && !text.includes('<!--')) return LEX_START;
  return endOfLine(lexRange(text, 0, text.length, state, null).state);
}

function sameState(a: LexState, b: LexState): boolean {
  return a.mode === b.mode && a.depth === b.depth && a.templates.length === b.templates.length && a.templates.every((t, i) => t === b.templates[i]);
}

function spansToTokens(text: string, spans: readonly number[], types: readonly CodeTokenType[], start: number, end: number): CodeToken[] {
  const out: CodeToken[] = [];
  let at = start;
  for (let k = 0; k < types.length; k++) {
    const from = Math.max(spans[k * 2], start);
    const to = Math.min(spans[k * 2 + 1], end);
    if (to <= from) continue;
    if (from > at) out.push({ text: text.slice(at, from) });
    out.push({ text: text.slice(from, to), type: types[k] });
    at = to;
  }
  if (at < end) out.push({ text: text.slice(at, end) });
  return out;
}

/** Tokens for a single line on its own: for hosts who want the default labels without the viewer's state. */
export function lexCodeLine(text: string, state: LexState = LEX_START): CodeToken[] {
  const spans: number[] = [];
  const types: CodeTokenType[] = [];
  lexRange(text, 0, text.length, state, (s, e, t) => {
    spans.push(s, e);
    types.push(t);
  });
  return spansToTokens(text, spans, types, 0, text.length);
}

const CHECKPOINT_EVERY = 4096;
const LONG_LINES_KEPT = 64;

/** Where the lexer has got to on one long line. */
interface LongLine {
  text: string;
  offsets: number[];
  states: LexState[];
  frontier: number;
  frontierState: LexState;
}

/** Brings a long line's frontier up to `offset`, leaving checkpoints. False if `deadline()` said stop first; every call
    gets a stretch done, so slices always add up to the whole line. */
function advance(entry: LongLine, offset: number, deadline: () => boolean): boolean {
  while (entry.frontier < offset) {
    const result = lexRange(entry.text, entry.frontier, Math.min(offset, entry.frontier + CHECKPOINT_EVERY), entry.frontierState, null);
    entry.frontier = result.offset;
    entry.frontierState = result.state;
    entry.offsets.push(result.offset);
    entry.states.push(result.state);
    if (entry.frontier < offset && deadline()) return false;
  }
  return true;
}

export interface CodeLexerOptions {
  lineCount: number;
  getLine: (index: number) => string;
  /** A span of lines turned out to start in a different state than was assumed when they were drawn. */
  onInvalidate?: (from: number, to: number) => void;
}

/** The default lexer as the viewer uses it: any range of any line, right, in about the time it takes to read a few
    kilobytes. Multi-line comments and template literals are found by `scan`, a pass over the file that runs in slices. */
export class CodeLexer {
  private lineCount: number;
  private getLine: (index: number) => string;
  private onInvalidate?: (from: number, to: number) => void;
  /** Line-start states as runs: `runStarts[k]` is the first line with `runStates[k]`. */
  private runStarts: number[] = [0];
  private runStates: LexState[] = [LEX_START];
  /** Lines up to and including this have a known start state. */
  private scanned = 0;
  private scannedChars = 0;
  private scanState: LexState = LEX_START;
  /** The first line of a stretch that doesn't start plain, while the pass is inside one. */
  private pendingRun = -1;
  private longLines = new Map<number, LongLine>();

  constructor({ lineCount, getLine, onInvalidate }: CodeLexerOptions) {
    this.lineCount = lineCount;
    this.getLine = getLine;
    this.onInvalidate = onInvalidate;
  }

  /** Advances the pass over the file until `deadline()` says stop. True while there is more to do. */
  scan(deadline: () => boolean): boolean {
    let checked = 0;
    while (this.scanned < this.lineCount && this.scannedChars < MAX_SCAN_CHARS) {
      const line = this.scanned;
      const text = this.getLine(line);
      let next: LexState;
      if (text.length > LONG_LINE) {
        // Long enough to need slicing, and the checkpoints left behind are what windows on it start from.
        const entry = this.longLine(line, text);
        if (!advance(entry, text.length, deadline)) return true;
        next = endOfLine(entry.frontierState);
      } else {
        if (++checked % 64 === 0 && deadline()) return true;
        next = nextLineState(text, this.scanState);
      }
      this.scannedChars += text.length;
      this.scanned = line + 1;
      if (!sameState(next, this.scanState)) {
        this.scanState = next;
        this.runStarts.push(line + 1);
        this.runStates.push(next);
        if (isPlainState(next)) this.closeRun(line + 1);
        else if (this.pendingRun < 0) this.pendingRun = line + 1;
      }
    }
    this.closeRun(this.lineCount);
    return false;
  }

  private closeRun(end: number) {
    if (this.pendingRun < 0) return;
    this.onInvalidate?.(this.pendingRun, end);
    this.pendingRun = -1;
  }

  /** The state a line starts in, as far as the pass has got: past that, it's assumed to start plain. */
  stateAtLine(line: number): LexState {
    if (line > this.scanned) return LEX_START;
    const starts = this.runStarts;
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= line) lo = mid;
      else hi = mid - 1;
    }
    return this.runStates[lo];
  }

  /** Tokens for a whole short line. */
  lineTokens(line: number, text: string): CodeToken[] {
    return lexCodeLine(text, this.stateAtLine(line));
  }

  private longLine(line: number, text: string): LongLine {
    const start = this.stateAtLine(line);
    let entry = this.longLines.get(line);
    if (!entry || entry.text !== text || !sameState(entry.states[0], start)) {
      entry = { text, offsets: [0], states: [start], frontier: 0, frontierState: start };
    } else this.longLines.delete(line);
    this.longLines.set(line, entry);
    if (this.longLines.size > LONG_LINES_KEPT) this.longLines.delete(this.longLines.keys().next().value as number);
    return entry;
  }

  /** Tokens for `[start, end)` of a long line, or `null` if `deadline()` said stop before the lexer got that far. */
  rangeTokens(line: number, text: string, start: number, end: number, deadline: () => boolean): CodeToken[] | null {
    const entry = this.longLine(line, text);
    if (!advance(entry, start, deadline)) return null;
    const { offsets, states } = entry;
    let lo = 0;
    let hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= start) lo = mid;
      else hi = mid - 1;
    }
    const spans: number[] = [];
    const types: CodeTokenType[] = [];
    lexRange(text, offsets[lo], end, states[lo], (s, e, t) => {
      if (e > start && s < end) {
        spans.push(s, e);
        types.push(t);
      }
    });
    return spansToTokens(text, spans, types, start, end);
  }
}

/* ── Highlighting ── */

export interface CodeHighlightContext {
  /** Where `text` starts in the line: 0 unless the line is long. */
  offset: number;
  /** The whole line. It's only a reference, but it can be a megabyte: don't walk it on every call. */
  line: string;
  /** `text` is a window on a long line, not all of it. */
  partial: boolean;
}

/** Labels a line, or the part of a long line that's on screen. It can answer later, with a promise; the text shows plain
    until then. `null` means leave it plain. */
export type CodeHighlight = (
  text: string,
  lineIndex: number,
  context: CodeHighlightContext,
) => readonly CodeToken[] | Promise<readonly CodeToken[] | null | undefined> | null | undefined;

/** Not worked out yet: an answer on its way, or a deadline got in the way. */
const PENDING = Symbol('pending');
type Produced = readonly CodeToken[] | null;
const TOKENS_KEPT = 4096;

/** What a store asks for tokens. `undefined` means "out of time, ask me again". */
export type TokenProducer = (
  lineIndex: number,
  text: string,
  start: number,
  end: number,
  deadline: () => boolean,
) => readonly CodeToken[] | Promise<readonly CodeToken[] | null | undefined> | null | undefined;

export function hostProducer(highlight: CodeHighlight): TokenProducer {
  return (lineIndex, text, start, end) => {
    const partial = start > 0 || end < text.length;
    const slice = partial ? text.slice(start, end) : text;
    return highlight(slice, lineIndex, { offset: start, line: text, partial }) ?? null;
  };
}

export function lexerProducer(lexer: CodeLexer): TokenProducer {
  return (lineIndex, text, start, end, deadline) =>
    text.length > LONG_LINE ? lexer.rangeTokens(lineIndex, text, start, end, deadline) ?? undefined : lexer.lineTokens(lineIndex, text);
}

/** How long a frame may spend highlighting before the rest shows plain and catches up in the next one. */
export const HIGHLIGHT_BUDGET_MS = 6;

export interface CodeTokenStoreOptions {
  produce: TokenProducer;
  getText: (lineIndex: number) => string;
  /** Run this soon, and not during this frame's rendering if it can be helped. */
  schedule: (run: () => void) => void;
  now?: () => number;
}

/** Tokens by line, worked out as rows ask for them, and never for longer than a frame can spare. */
export class CodeTokenStore {
  private produce: TokenProducer;
  private getText: (lineIndex: number) => string;
  private schedule: (run: () => void) => void;
  private now: () => number;
  private cache = new Map<number | string, Produced | typeof PENDING>();
  private versions = new Map<number, number>();
  private listeners = new Set<() => void>();
  private queue = new Map<string, { line: number; start: number; end: number }>();
  private inflight = 0;
  private scheduled = false;
  private notifying = false;
  private dirty = false;
  /** Time highlighting may still take in this frame, and when the current piece of work started. */
  private budget = Infinity;
  private workStart = 0;
  private working = false;
  private keepFrom = 0;
  private keepTo = Infinity;

  constructor({ produce, getText, schedule, now }: CodeTokenStoreOptions) {
    this.produce = produce;
    this.getText = getText;
    this.schedule = schedule;
    this.now = now ?? (() => performance.now());
  }

  /** How much is waiting to be worked out, or for an answer. */
  get pending() {
    return this.queue.size + this.inflight;
  }

  /** Starts the time a frame may spend, and says which lines still matter to work that's waiting. */
  beginFrame(keepFrom: number, keepTo: number, budget: number = HIGHLIGHT_BUDGET_MS) {
    this.budget = budget;
    this.keepFrom = keepFrom;
    this.keepTo = keepTo;
  }

  private outOfTime = () => (this.working ? this.now() - this.workStart : 0) >= this.budget;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Changes when this line's tokens do. */
  version = (line: number) => this.versions.get(line) ?? 0;

  private bump(line: number) {
    this.versions.set(line, this.version(line) + 1);
    this.dirty = true;
    if (this.versions.size > TOKENS_KEPT * 2) this.versions.delete(this.versions.keys().next().value as number);
  }

  private flushSoon() {
    if (this.notifying) return;
    this.notifying = true;
    this.schedule(() => {
      this.notifying = false;
      if (!this.dirty) return;
      this.dirty = false;
      for (const listener of this.listeners) listener();
    });
  }

  private remember(key: number | string, value: Produced | typeof PENDING) {
    this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > TOKENS_KEPT) this.cache.delete(this.cache.keys().next().value as number | string);
  }

  /** Works out one entry now, if it can. */
  private fill(key: number | string, line: number, text: string, start: number, end: number): Produced | typeof PENDING | undefined {
    this.workStart = this.now();
    this.working = true;
    const result = this.produce(line, text, start, end, this.outOfTime);
    this.working = false;
    this.budget -= this.now() - this.workStart;
    if (result === undefined) return undefined;
    if (result && 'then' in result) {
      this.remember(key, PENDING);
      this.inflight++;
      const settle = (tokens: Produced) => {
        this.inflight--;
        this.dirty = true;
        if (this.cache.get(key) === PENDING) {
          this.remember(key, tokens);
          this.bump(line);
        }
        this.flushSoon();
      };
      result.then((tokens) => settle(tokens ?? null), () => settle(null));
      return PENDING;
    }
    const value = (result as Produced) ?? null;
    this.remember(key, value);
    return value;
  }

  /** The tokens for `[start, end)`. `null`: draw it plain for now (if there's more coming, the line's version changes). */
  read(line: number, text: string, start: number, end: number): readonly CodeToken[] | null {
    const long = text.length > LONG_LINE;
    const key = long ? `${line}:${start}:${end}` : line;
    let value = this.cache.get(key);
    if (value === undefined) {
      const from = long ? start : 0;
      const to = long ? end : text.length;
      if (this.budget > 0) value = this.fill(key, line, text, from, to);
      if (value === undefined) {
        this.queue.set(`${line}:${from}:${to}`, { line, start: from, end: to });
        this.pumpSoon();
        return null;
      }
    }
    if (value === PENDING || value === null) return null;
    return long ? value : start === 0 && end >= text.length ? value : clipTokens(value, 0, start, end);
  }

  private pumpSoon() {
    if (this.scheduled) return;
    this.scheduled = true;
    this.schedule(() => {
      this.scheduled = false;
      this.pump();
    });
  }

  /** Does waiting work for one slice of time. */
  pump(budget: number = HIGHLIGHT_BUDGET_MS) {
    this.budget = budget;
    for (const [id, { line, start, end }] of this.queue) {
      if (line < this.keepFrom || line >= this.keepTo) {
        this.queue.delete(id);
        continue;
      }
      if (this.budget <= 0) break;
      const text = this.getText(line);
      const long = text.length > LONG_LINE;
      const key = long ? `${line}:${start}:${end}` : line;
      if (this.cache.get(key) === undefined) {
        const value = this.fill(key, line, text, start, end);
        if (value === undefined) break;
        if (value !== PENDING) this.bump(line);
      }
      this.queue.delete(id);
    }
    this.dirty = true;
    this.flushSoon();
    if (this.queue.size) this.pumpSoon();
  }

  /** Forgets what was worked out for these lines, for rows that are up now. */
  invalidate(from: number, to: number) {
    for (const key of [...this.cache.keys()]) {
      const line = typeof key === 'number' ? key : Number(key.slice(0, key.indexOf(':')));
      if (line >= from && line < to) this.cache.delete(key);
    }
    const first = Math.max(from, this.keepFrom);
    const last = Math.min(to, this.keepTo);
    for (let line = first; line < last; line++) this.bump(line);
    this.flushSoon();
  }
}

/* ── Lines ── */

export interface LineSource {
  count: number;
  /** The text of a line, by index. */
  get: (index: number) => string;
}

const LINES_KEPT = 2048;

/** A line's text and grid, kept for the lines in use: a host's `getLine` might be doing work, and a long line's grid is. */
export class LineCache {
  readonly source: LineSource;
  readonly tabSize: number;
  private metrics = new Map<number, LineMetrics>();

  constructor(source: LineSource, tabSize: number) {
    this.source = source;
    this.tabSize = tabSize;
  }

  text(line: number): string {
    return this.get(line).text;
  }

  get(line: number): LineMetrics {
    const hit = this.metrics.get(line);
    if (hit) {
      this.metrics.delete(line);
      this.metrics.set(line, hit);
      return hit;
    }
    const metrics = new LineMetrics(this.source.get(line) ?? '', this.tabSize);
    this.metrics.set(line, metrics);
    if (this.metrics.size > LINES_KEPT) this.metrics.delete(this.metrics.keys().next().value as number);
    return metrics;
  }
}

/** Cells on a line, without keeping its grid. */
export function lineCells(text: string, tabSize: number): number {
  return PLAIN_LINE.test(text) ? text.length : new LineMetrics(text, tabSize).cells;
}

/** A source's lines, split where JS engines count a new line: not only at `\\n`. */
export function splitCodeLines(source: string): string[] {
  return /[\r\u2028\u2029]/.test(source) ? source.split(/\r\n?|\n|\u2028|\u2029/) : source.split('\n');
}

/** A pass over the file for what can't be known from the lines on screen: the widest line, for the scrollbar, and with
    wrapping on, how many rows each line takes. It runs in slices. */
export class LineScanner {
  private source: LineSource;
  private tabSize: number;
  /** Cells per line, when something needs them all: wrapping. */
  readonly cellCounts: Uint32Array | null;
  private next = 0;
  private chars = 0;
  /** The widest line so far. */
  maxCells = 0;

  constructor(source: LineSource, tabSize: number, keepCounts: boolean) {
    this.source = source;
    this.tabSize = tabSize;
    this.cellCounts = keepCounts ? new Uint32Array(source.count) : null;
  }

  /** Advances until `deadline()` says stop. True while there is more to do. */
  run(deadline: () => boolean): boolean {
    const { count } = this.source;
    let checked = 0;
    while (this.next < count) {
      if (++checked % 64 === 0 && deadline()) return true;
      const text = this.source.get(this.next) ?? '';
      // Wider lines than this far down get noticed when they come into view.
      if (!this.cellCounts && this.chars > MAX_SCAN_CHARS * 4) return false;
      this.chars += text.length;
      const cells = lineCells(text, this.tabSize);
      if (cells > this.maxCells) this.maxCells = cells;
      if (this.cellCounts) this.cellCounts[this.next] = cells;
      this.next++;
    }
    return false;
  }
}
