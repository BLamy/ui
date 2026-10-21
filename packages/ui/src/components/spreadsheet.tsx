'use client';
import {
  useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type ClipboardEvent, type ComponentProps, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref,
} from 'react';
import { Button as AriaButton, Input as AriaInput } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { parseCsv, stringifyCsv } from '@/lib/csv';
import {
  columnHistogram, columnNumbers, inferColumnType, selectionStats, sortRows, GPU_MIN_ROWS,
  type SpreadsheetHistogram, type SpreadsheetEngine, type SpreadsheetRanOn, type SpreadsheetSort, type SpreadsheetSortDirection,
} from '@/lib/spreadsheet';

/* ══ Spreadsheet — a grid of string cells, with the heavy work on the GPU ══
   Rows and columns are virtualized: only the cells in view (plus a few) are in the DOM, so a million-row CSV scrolls
   like a ten-row one. Sorting a number or date column runs as a bitonic sort of exact 64-bit keys in a WebGPU
   compute shader, and each number column's header draws a histogram tallied on the GPU; both fall back to the CPU
   with the same answers (see lib/spreadsheet). The status bar says which one ran and how long it took.

   It's an ARIA grid with one tab stop: the arrow keys move (⇧ extends, ⌘/Ctrl jumps to the edge), Home/End and
   Page Up/Down too; Enter, F2 or typing edits the cell (Enter and Tab commit and move, Esc cancels); Delete clears the
   selection; ⌘C / ⌘X / ⌘V copy, cut and paste tab-separated text (what other spreadsheets put on the clipboard);
   ⌘Z / ⇧⌘Z undo and redo; ⌥← / ⌥→ narrow and widen the column. Drag across cells to select, click a header to
   select its column, a row number its row. Sorting changes the view, not the data: `onChange` keeps the file's order. */

export const spreadsheetVariants = cva(
  'relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground shadow-hairline',
  {
    variants: {
      /** Row height: `compact` (default, 28 px) or `comfortable` (36 px, for touch). */
      density: { compact: '', comfortable: '' },
    },
    defaultVariants: { density: 'compact' },
  },
);

const ROW_HEIGHT = { compact: 28, comfortable: 36 } as const;
const HEADER_HEIGHT = 30;
const HISTOGRAM_HEIGHT = 16;
const HISTOGRAM_BINS = 16;
const OVERSCAN = 6;
const MIN_WIDTH = 48;
const HISTORY = 100;

/** A cell in view coordinates: `row` counts displayed body rows (after sorting), from 0. */
export interface SpreadsheetCell {
  row: number;
  column: number;
}
export interface SpreadsheetSelection {
  anchor: SpreadsheetCell;
  focus: SpreadsheetCell;
}
/** The last sort: which engine ran it and how long it took. */
export interface SpreadsheetSortInfo extends SpreadsheetSort {
  ranOn: SpreadsheetRanOn;
  ms: number;
  rows: number;
}

export interface SpreadsheetHandle {
  focus: () => void;
  /** Selects from `anchor` to `focus` (view coordinates) and scrolls it into view. */
  select: (anchor: SpreadsheetCell, focus?: SpreadsheetCell) => void;
  undo: () => void;
  redo: () => void;
}

export interface SpreadsheetProps
  extends Omit<ComponentProps<'div'>, 'children' | 'onChange' | 'defaultValue' | 'ref'>, VariantProps<typeof spreadsheetVariants> {
  /** Rows of cells (rows may be ragged). With `header`, the first row holds the column titles. */
  value?: string[][];
  defaultValue?: string[][];
  /** Every edit, paste, cut, undo and added row, in the data's own order. */
  onChange?: (rows: string[][]) => void;
  /** The first row is column titles (default `true`); without it the columns are lettered A, B, C… */
  header?: boolean;
  isReadOnly?: boolean;
  /** Where sorting and histograms run (default `auto`, see `SpreadsheetEngine`). */
  engine?: SpreadsheetEngine;
  /** `auto` uses the GPU from this many rows (default 20,000). */
  gpuMinRows?: number;
  /** A histogram under each number or date column's title (default `true`). */
  histograms?: boolean;
  /** Called after each sort with what ran it, or with `null` when the sort is cleared. */
  onSort?: (info: SpreadsheetSortInfo | null) => void;
  /** `false` hides the status bar (row count, selection sum, sort timing, Add Row). */
  footer?: boolean;
  /** Extra controls at the end of the status bar. */
  actions?: ReactNode;
  /** Default column width in px before content is measured (the widest of the title and the first rows, ≤ 320). */
  columnWidth?: number;
  'aria-label'?: string;
  ref?: Ref<SpreadsheetHandle>;
}

/** Column letters: 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

const numberFormat = typeof Intl !== 'undefined' ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }) : null;
const formatNumber = (n: number) => (numberFormat ? numberFormat.format(n) : String(n));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A starting width per column from the title and the first rows' text (an estimate: no layout is read). */
function estimateWidths(rows: readonly (readonly string[])[], columns: number, fallback: number, header: boolean) {
  const out: number[] = [];
  for (let c = 0; c < columns; c++) {
    // The title also makes room for its bolder text and the sort button.
    let px = header ? (rows[0]?.[c] ?? '').length * 8 + 46 : 0;
    for (let r = header ? 1 : 0; r < Math.min(rows.length, 60); r++) px = Math.max(px, (rows[r][c] ?? '').length * 7.4 + 22);
    out.push(px > 22 ? clamp(Math.round(px), 64, 320) : fallback);
  }
  return out;
}

/** The first index whose offset passes `x` (offsets ascending). */
function lowerBound(offsets: readonly number[], x: number) {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid + 1] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function HistogramBars({ histogram, label }: { histogram: SpreadsheetHistogram; label: string }) {
  const bins = histogram.bins;
  let peak = 1;
  for (const b of bins) peak = Math.max(peak, b);
  const w = 100 / bins.length;
  return (
    <svg role="img" aria-label={`${label}: values from ${formatNumber(histogram.min)} to ${formatNumber(histogram.max)}`}
      data-slot="spreadsheet-histogram" data-engine={histogram.ranOn} viewBox={`0 0 100 ${HISTOGRAM_HEIGHT}`} preserveAspectRatio="none"
      className="block h-(--hist) w-full text-primary/55">
      {Array.from(bins, (b, i) => {
        const h = b ? Math.max(1.5, (b / peak) * HISTOGRAM_HEIGHT) : 0;
        return <rect key={i} x={i * w + w * 0.08} width={w * 0.84} y={HISTOGRAM_HEIGHT - h} height={h} fill="currentColor" />;
      })}
    </svg>
  );
}

export function Spreadsheet({
  value: valueProp, defaultValue, onChange, header = true, isReadOnly = false, engine = 'auto', gpuMinRows = GPU_MIN_ROWS,
  histograms = true, onSort, footer = true, actions, columnWidth = 120, density, className, style, ref,
  'aria-label': ariaLabel = 'Spreadsheet', ...props
}: SpreadsheetProps) {
  const id = useId();
  const [inner, setInner] = useState<string[][]>(() => defaultValue ?? [[]]);
  const rows = valueProp ?? inner;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const past = useRef<string[][][]>([]);
  const future = useRef<string[][][]>([]);
  const apply = useCallback((next: string[][]) => {
    if (valueProp === undefined) setInner(next);
    rowsRef.current = next;
    onChange?.(next);
  }, [valueProp, onChange]);
  const commit = useCallback((next: string[][]) => {
    past.current.push(rowsRef.current);
    if (past.current.length > HISTORY) past.current.shift();
    future.current = [];
    apply(next);
  }, [apply]);

  const base = header ? 1 : 0;
  const bodyCount = Math.max(0, rows.length - base);
  const colCount = useMemo(() => {
    let n = 1;
    for (const r of rows) if (r.length > n) n = r.length;
    return n;
  }, [rows]);
  const types = useMemo(() => Array.from({ length: colCount }, (_, c) => inferColumnType(rows, c, base)), [rows, colCount, base]);

  /* ── Columns ── */
  const [widths, setWidths] = useState<number[]>(() => estimateWidths(rows, colCount, columnWidth, header));
  if (widths.length < colCount) setWidths((w) => [...w, ...estimateWidths(rows, colCount, columnWidth, header).slice(w.length)]);
  const offsets = useMemo(() => {
    const out = [0];
    for (let c = 0; c < colCount; c++) out.push(out[c] + (widths[c] ?? columnWidth));
    return out;
  }, [widths, colCount, columnWidth]);
  const totalWidth = offsets[colCount];
  const rowHeight = ROW_HEIGHT[density ?? 'compact'];
  const gutter = Math.max(44, String(bodyCount).length * 8 + 22);
  const showHistograms = histograms && types.some((t) => t === 'number' || t === 'date');
  const headHeight = HEADER_HEIGHT + (showHistograms ? HISTOGRAM_HEIGHT + 4 : 0);

  /* ── Sorting (a view over the data) ── */
  const [sortState, setSortState] = useState<(SpreadsheetSortInfo & { order: Uint32Array }) | null>(null);
  const [sorting, setSorting] = useState(false);
  const order = sortState && sortState.order.length <= bodyCount ? sortState.order : null;
  const sortInfo = order ? sortState : null;
  /** The data row behind a displayed row (rows added after a sort show at the end). */
  const dataRow = useCallback((view: number) => base + (order && view < order.length ? order[view] : view), [base, order]);
  const sortSeq = useRef(0);
  const sortBy = async (column: number) => {
    const current = sortInfo?.column === column ? sortInfo.direction : null;
    const direction: SpreadsheetSortDirection | null = current === null ? 'ascending' : current === 'ascending' ? 'descending' : null;
    const seq = ++sortSeq.current;
    if (!direction) {
      setSortState(null);
      onSort?.(null);
      return;
    }
    setSorting(true);
    const data = rowsRef.current;
    const result = await sortRows(data, { column, direction }, { from: base, type: types[column], engine, gpuMinRows });
    if (seq !== sortSeq.current) return;
    setSorting(false);
    const info = { column, direction, ranOn: result.ranOn, ms: result.ms, rows: result.order.length };
    setSortState({ ...info, order: result.order });
    onSort?.(info);
  };

  /* ── Viewport ── */
  const scroller = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, left: 0, width: 800, height: 400 });
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // Not laid out yet (hidden, or no layout engine): keep the last size rather than render no cells.
    const measure = () => setView((v) => ({ ...v, width: el.clientWidth || v.width, height: el.clientHeight || v.height }));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const frame = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) setView((v) => (v.top === el.scrollTop && v.left === el.scrollLeft ? v : { ...v, top: el.scrollTop, left: el.scrollLeft }));
    });
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const r0 = clamp(Math.floor(view.top / rowHeight) - OVERSCAN, 0, bodyCount);
  const r1 = clamp(Math.ceil((view.top + view.height) / rowHeight) + OVERSCAN, 0, bodyCount);
  const c0 = clamp(lowerBound(offsets, Math.max(0, view.left - gutter)) - 1, 0, colCount - 1);
  const c1 = clamp(lowerBound(offsets, view.left + view.width) + 2, 0, colCount);

  /* ── Histograms: visible number and date columns, recomputed a moment after the data settles ── */
  const [hist, setHist] = useState<{ rows: string[][]; byColumn: Map<number, SpreadsheetHistogram | null> }>({ rows, byColumn: new Map() });
  // The last bars stay up while an edit's new ones are tallied, so they don't flicker.
  const histFresh = hist.rows === rows;
  const histFor = hist.byColumn;
  useEffect(() => {
    if (!showHistograms) return;
    const wanted: number[] = [];
    for (let c = c0; c < c1; c++) if ((types[c] === 'number' || types[c] === 'date') && !(histFresh && histFor.has(c))) wanted.push(c);
    if (!wanted.length) return;
    let live = true;
    const timer = setTimeout(() => {
      void Promise.all(wanted.map(async (c) => [c, await columnHistogram(columnNumbers(rows, c, base, types[c]), HISTOGRAM_BINS, { engine, gpuMinRows })] as const))
        .then((done) => {
          if (!live) return;
          setHist((h) => {
            const byColumn = new Map(h.rows === rows ? h.byColumn : []);
            for (const [c, result] of done) byColumn.set(c, result);
            return { rows, byColumn };
          });
        });
    }, histFresh ? 0 : 250);
    return () => { live = false; clearTimeout(timer); };
  }, [rows, c0, c1, types, showHistograms, histFresh, histFor, base, engine, gpuMinRows]);

  /* ── Selection ── */
  const origin = { row: 0, column: 0 };
  const [sel, setSel] = useState<SpreadsheetSelection>({ anchor: origin, focus: origin });
  const fit = useCallback((cell: SpreadsheetCell): SpreadsheetCell =>
    ({ row: clamp(cell.row, 0, Math.max(0, bodyCount - 1)), column: clamp(cell.column, 0, colCount - 1) }), [bodyCount, colCount]);
  const anchor = fit(sel.anchor);
  const focusCell = fit(sel.focus);
  const rect = {
    top: Math.min(anchor.row, focusCell.row), bottom: Math.max(anchor.row, focusCell.row),
    left: Math.min(anchor.column, focusCell.column), right: Math.max(anchor.column, focusCell.column),
  };
  const selected = (r: number, c: number) => r >= rect.top && r <= rect.bottom && c >= rect.left && c <= rect.right;

  const reveal = useCallback((cell: SpreadsheetCell) => {
    const el = scroller.current;
    if (!el) return;
    const top = cell.row * rowHeight;
    const bodyH = el.clientHeight - headHeight;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + rowHeight > el.scrollTop + bodyH) el.scrollTop = top + rowHeight - bodyH;
    const left = offsets[cell.column];
    const right = offsets[cell.column + 1];
    const bodyW = el.clientWidth - gutter;
    if (left < el.scrollLeft) el.scrollLeft = left;
    else if (right > el.scrollLeft + bodyW) el.scrollLeft = Math.min(left, right - bodyW);
  }, [rowHeight, headHeight, offsets, gutter]);

  const select = useCallback((a: SpreadsheetCell, f: SpreadsheetCell = a) => {
    const next = { anchor: fit(a), focus: fit(f) };
    setSel(next);
    reveal(next.focus);
  }, [fit, reveal]);

  /* ── Editing ── */
  const [editing, setEditingState] = useState<{ row: number; column: number; draft: string } | null>(null);
  // The open edit as of the last change: blur after Enter, Tab or Esc must not commit it a second time.
  const editingRef = useRef(editing);
  const setEditing = (next: typeof editing) => { editingRef.current = next; setEditingState(next); };
  const gridFocus = () => scroller.current?.focus({ preventScroll: true });

  /** Writes cells (view coordinates; `row` -1 is the title row), growing the table when a write lands past it. */
  const write = useCallback((cells: { row: number; column: number; value: string }[]) => {
    if (isReadOnly || !cells.length) return;
    const data = rowsRef.current;
    const next = data.slice();
    const copied = new Set<number>();
    const viewCount = Math.max(0, data.length - base);
    for (const { row, column, value } of cells) {
      const index = row < 0 ? 0 : row < viewCount ? dataRow(row) : base + row;
      while (next.length <= index) next.push([]);
      if (!copied.has(index)) { next[index] = next[index].slice(); copied.add(index); }
      const target = next[index];
      while (target.length < column) target.push('');
      target[column] = value;
    }
    commit(next);
  }, [isReadOnly, base, dataRow, commit]);

  const startEdit = (cell: SpreadsheetCell, draft?: string) => {
    if (isReadOnly) return;
    const text = cell.row < 0 ? rows[0]?.[cell.column] ?? '' : rows[dataRow(cell.row)]?.[cell.column] ?? '';
    setEditing({ ...cell, draft: draft ?? text });
  };
  const finishEdit = (move?: { row: number; column: number }) => {
    const current = editingRef.current;
    if (!current) return;
    const { row, column, draft } = current;
    const before = row < 0 ? rows[0]?.[column] ?? '' : rows[dataRow(row)]?.[column] ?? '';
    setEditing(null);
    if (draft !== before) write([{ row, column, value: draft }]);
    if (row >= 0) {
      const to = move ? { row: row + move.row, column: column + move.column } : { row, column };
      select(to);
    }
    requestAnimationFrame(gridFocus);
  };

  const cellsIn = function* () {
    for (let r = rect.top; r <= rect.bottom && r < bodyCount; r++) {
      const row = rows[dataRow(r)];
      for (let c = rect.left; c <= rect.right; c++) yield row?.[c] ?? '';
    }
  };
  const selectionText = () => {
    const lines: string[][] = [];
    for (let r = rect.top; r <= rect.bottom && r < bodyCount; r++) {
      const row = rows[dataRow(r)];
      const line: string[] = [];
      for (let c = rect.left; c <= rect.right; c++) line.push(row?.[c] ?? '');
      lines.push(line);
    }
    return stringifyCsv(lines, { delimiter: '\t', trailingNewline: false });
  };
  const clearSelection = () => {
    const cells: { row: number; column: number; value: string }[] = [];
    for (let r = rect.top; r <= rect.bottom && r < bodyCount; r++) for (let c = rect.left; c <= rect.right; c++) {
      if (rows[dataRow(r)]?.[c]) cells.push({ row: r, column: c, value: '' });
    }
    write(cells);
  };
  const paste = (text: string) => {
    const block = parseCsv(text.replace(/\r?\n$/, ''), { delimiter: text.includes('\t') ? '\t' : 'auto' }).rows;
    if (!block.length) return;
    const cells: { row: number; column: number; value: string }[] = [];
    // One value pasted into a larger selection fills it, as other spreadsheets do.
    if (block.length === 1 && block[0].length === 1 && (rect.bottom > rect.top || rect.right > rect.left)) {
      for (let r = rect.top; r <= rect.bottom; r++) for (let c = rect.left; c <= rect.right; c++) cells.push({ row: r, column: c, value: block[0][0] });
    } else {
      block.forEach((line, i) => line.forEach((v, j) => cells.push({ row: rect.top + i, column: rect.left + j, value: v })));
      const last = block.reduce((m, l) => Math.max(m, l.length), 0) - 1;
      setSel({ anchor: { row: rect.top, column: rect.left }, focus: { row: rect.top + block.length - 1, column: rect.left + last } });
    }
    write(cells);
  };

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(rowsRef.current);
    apply(prev);
  }, [apply]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(rowsRef.current);
    apply(next);
  }, [apply]);

  useImperativeHandle(ref, () => ({ focus: gridFocus, select, undo, redo }), [select, undo, redo]);

  const addRow = () => {
    write([{ row: bodyCount, column: 0, value: '' }]);
    requestAnimationFrame(() => { select({ row: bodyCount, column: 0 }); gridFocus(); });
  };

  /* ── Keyboard ── */
  const page = Math.max(1, Math.floor((view.height - headHeight) / rowHeight) - 1);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing || e.target !== e.currentTarget) return;
    const mod = e.metaKey || e.ctrlKey;
    const extend = e.shiftKey;
    const from = focusCell;
    let to: SpreadsheetCell | null = null;
    switch (e.key) {
      case 'ArrowUp': to = { row: mod ? 0 : from.row - 1, column: from.column }; break;
      case 'ArrowDown': to = { row: mod ? bodyCount - 1 : from.row + 1, column: from.column }; break;
      case 'ArrowLeft':
      case 'ArrowRight': {
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        if (e.altKey) {
          setWidths((w) => w.map((x, i) => (i === from.column ? Math.max(MIN_WIDTH, x + dir * 16) : x)));
          e.preventDefault();
          return;
        }
        to = { row: from.row, column: mod ? (dir < 0 ? 0 : colCount - 1) : from.column + dir };
        break;
      }
      case 'Home': to = { row: mod ? 0 : from.row, column: 0 }; break;
      case 'End': to = { row: mod ? bodyCount - 1 : from.row, column: colCount - 1 }; break;
      case 'PageUp': to = { row: from.row - page, column: from.column }; break;
      case 'PageDown': to = { row: from.row + page, column: from.column }; break;
      case 'Enter':
      case 'F2':
        if (bodyCount) startEdit(from);
        e.preventDefault();
        return;
      case 'Delete':
      case 'Backspace':
        clearSelection();
        e.preventDefault();
        return;
      case 'Escape':
        if (rect.top !== rect.bottom || rect.left !== rect.right) { select(from); e.preventDefault(); }
        return;
      default:
        if (mod && e.key.toLowerCase() === 'a') { setSel({ anchor: { row: 0, column: 0 }, focus: { row: bodyCount - 1, column: colCount - 1 } }); e.preventDefault(); return; }
        if (mod && e.key.toLowerCase() === 'z') { (e.shiftKey ? redo : undo)(); e.preventDefault(); return; }
        if (mod && e.key.toLowerCase() === 'y') { redo(); e.preventDefault(); return; }
        if (!mod && !e.altKey && e.key.length === 1 && bodyCount && !isReadOnly) { startEdit(from, e.key); e.preventDefault(); }
        return;
    }
    e.preventDefault();
    const next = fit(to);
    if (extend) { setSel({ anchor, focus: next }); reveal(next); }
    else select(next);
  };

  const onCopy = (e: ClipboardEvent<HTMLDivElement>) => {
    if (editing || !bodyCount) return;
    e.clipboardData.setData('text/plain', selectionText());
    e.preventDefault();
  };
  const onCut = (e: ClipboardEvent<HTMLDivElement>) => {
    if (editing || !bodyCount) return;
    onCopy(e);
    clearSelection();
  };
  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (editing || isReadOnly) return;
    const text = e.clipboardData.getData('text/plain');
    if (text) { paste(text); e.preventDefault(); }
  };

  /* ── Pointer ── */
  const dragging = useRef(false);
  const cellAt = (target: EventTarget) => {
    const el = (target as HTMLElement).closest?.('[data-cell]') as HTMLElement | null;
    return el ? { row: Number(el.dataset.row), column: Number(el.dataset.column) } : null;
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const cell = cellAt(e.target);
    if (!cell) return;
    if (editing) finishEdit();
    e.preventDefault();
    gridFocus();
    if (e.shiftKey) setSel({ anchor, focus: cell });
    else setSel({ anchor: cell, focus: cell });
    dragging.current = e.pointerType === 'mouse';
  };
  const onPointerOver = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const cell = cellAt(e.target);
    if (cell) setSel((s) => (s.focus.row === cell.row && s.focus.column === cell.column ? s : { anchor: s.anchor, focus: cell }));
  };
  useEffect(() => {
    const up = () => { dragging.current = false; };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const selectColumn = (column: number, extend: boolean) => {
    gridFocus();
    setSel({ anchor: { row: 0, column: extend ? anchor.column : column }, focus: { row: Math.max(0, bodyCount - 1), column } });
  };
  const selectRow = (row: number, extend: boolean) => {
    gridFocus();
    setSel({ anchor: { row: extend ? anchor.row : row, column: 0 }, focus: { row, column: colCount - 1 } });
  };

  const resizeColumn = (column: number) => (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const start = widths[column] ?? columnWidth;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: globalThis.PointerEvent) => setWidths((w) => w.map((x, i) => (i === column ? Math.max(MIN_WIDTH, start + ev.clientX - startX) : x)));
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  /* ── Status ── */
  const cellCount = (rect.bottom - rect.top + 1) * (rect.right - rect.left + 1);
  const stats = useMemo(
    () => (bodyCount && cellCount > 1 && cellCount <= 1_000_000 ? selectionStats(cellsIn()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the selection rectangle and the data decide.
    [rows, order, rect.top, rect.bottom, rect.left, rect.right, bodyCount],
  );

  /* ── Render ── */
  const cellId = (r: number, c: number) => `${id}-r${r}-c${c}`;
  const title = (c: number) => (header ? rows[0]?.[c] || columnName(c) : columnName(c));
  const visibleRows: ReactNode[] = [];
  for (let r = r0; r < r1; r++) {
    const data = rows[dataRow(r)] ?? [];
    const cells: ReactNode[] = [];
    for (let c = c0; c < c1; c++) {
      const text = data[c] ?? '';
      const numeric = (types[c] === 'number' || types[c] === 'date') && text !== '';
      const on = selected(r, c);
      cells.push(
        <div key={c} id={cellId(r, c)} role="gridcell" aria-colindex={c + 2} aria-selected={on}
          data-cell="" data-row={r} data-column={c} data-selected={on || undefined}
          className={cn('absolute top-0 h-full truncate px-2 leading-(--row) box-border border-0 border-r border-b border-solid border-border data-selected:bg-primary/10',
            numeric && 'text-end tabular-nums')}
          style={{ left: gutter + offsets[c], width: offsets[c + 1] - offsets[c] }}>{text}</div>,
      );
    }
    const rowOn = r >= rect.top && r <= rect.bottom;
    visibleRows.push(
      <div key={r} role="row" aria-rowindex={r + 2} className="absolute left-0" style={{ top: r * rowHeight, height: rowHeight, width: gutter + totalWidth }}>
        <div role="rowheader" data-cell-gutter="" onPointerDown={(e) => { e.preventDefault(); selectRow(r, e.shiftKey); }}
          className={cn('sticky left-0 z-10 flex h-full w-(--gutter) cursor-default items-center justify-end bg-secondary pr-2 text-caption text-muted-foreground tabular-nums box-border border-0 border-r border-b border-solid border-border',
            rowOn && 'bg-secondary-strong text-foreground')}>{r + 1}</div>
        {cells}
      </div>,
    );
  }

  const headerCells: ReactNode[] = [];
  for (let c = c0; c < c1; c++) {
    const sorted = sortInfo?.column === c ? sortInfo.direction : undefined;
    const h = types[c] === 'number' || types[c] === 'date' ? histFor.get(c) : undefined;
    const colOn = c >= rect.left && c <= rect.right;
    const editingTitle = editing?.row === -1 && editing.column === c;
    headerCells.push(
      <div key={c} role="columnheader" aria-colindex={c + 2} aria-sort={sorted ?? 'none'}
        className={cn('group absolute top-0 flex h-full flex-col justify-center bg-secondary px-2 box-border border-0 border-r border-b border-solid border-border', colOn && 'bg-secondary-strong')}
        style={{ left: gutter + offsets[c], width: offsets[c + 1] - offsets[c] }}
        onPointerDown={(e) => { if (e.button === 0 && !(e.target as HTMLElement).closest('button,input')) { e.preventDefault(); selectColumn(c, e.shiftKey); } }}
        onDoubleClick={() => { if (header) startEdit({ row: -1, column: c }); }}>
        <div className="flex min-w-0 items-center gap-1">
          {editingTitle ? null : <span className="min-w-0 flex-1 truncate text-footnote font-semibold" title={title(c)}>{title(c)}</span>}
          <AriaButton aria-label={`Sort by ${title(c)}${sorted === 'ascending' ? ', descending' : sorted === 'descending' ? ', clear sort' : ''}`}
            excludeFromTabOrder onPress={() => { void sortBy(c); }}
            className={cn('-mr-1 grid size-5 shrink-0 cursor-default place-items-center rounded-ctl border-0 bg-transparent p-0 text-muted-foreground outline-none data-hovered:bg-secondary-strong data-hovered:text-foreground data-focus-visible:ring-2 data-focus-visible:ring-ring',
              !sorted && 'opacity-0 group-hover:opacity-100 data-focus-visible:opacity-100', sorted && 'text-primary')}>
            <Icon name={sorted === 'descending' ? 'arrow-down' : sorted === 'ascending' ? 'arrow-up' : 'chevron-up-down'} size={13} weight="semibold" />
          </AriaButton>
        </div>
        {showHistograms ? <div className="mt-0.5 h-(--hist)">{h ? <HistogramBars histogram={h} label={`${title(c)} histogram`} /> : null}</div> : null}
        <div aria-hidden="true" onPointerDown={resizeColumn(c)}
          onDoubleClick={(e) => { e.stopPropagation(); setWidths((w) => w.map((x, i) => (i === c ? estimateWidths(rows, colCount, columnWidth, header)[c] : x))); }}
          className="absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize hover:bg-primary/40" />
      </div>,
    );
  }

  const editBox = editing ? (() => {
    const { row, column } = editing;
    const top = row < 0 ? 0 : row * rowHeight;
    return (
      <AriaInput
        aria-label={row < 0 ? `Title of column ${columnName(column)}` : `${title(column)}, row ${row + 1}`}
        autoFocus
        value={editing.draft}
        onChange={(e) => setEditing({ ...editing, draft: e.target.value })}
        onFocus={(e) => { const end = e.target.value.length; e.target.setSelectionRange(end, end); }}
        onBlur={() => finishEdit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); finishEdit({ row: e.shiftKey ? -1 : 1, column: 0 }); }
          else if (e.key === 'Tab') { e.preventDefault(); finishEdit({ row: 0, column: e.shiftKey ? -1 : 1 }); }
          else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); requestAnimationFrame(gridFocus); }
        }}
        data-slot="spreadsheet-editor"
        className={cn('absolute z-30 m-0 box-border rounded-none border-0 bg-card px-2 text-footnote text-foreground outline-2 -outline-offset-1 outline-primary',
          row < 0 ? 'font-semibold' : '')}
        style={{ top, left: gutter + offsets[column], width: Math.max(offsets[column + 1] - offsets[column], 120), height: row < 0 ? HEADER_HEIGHT : rowHeight }}
      />
    );
  })() : null;

  const ranOn = (r: SpreadsheetRanOn) => (r === 'gpu' ? 'on the GPU' : 'on the CPU');

  return (
    <div
      data-slot="spreadsheet"
      data-density={density ?? 'compact'}
      className={cn(spreadsheetVariants({ density }), className)}
      style={{ '--row': `${rowHeight}px`, '--gutter': `${gutter}px`, '--head': `${headHeight}px`, '--hist': `${HISTOGRAM_HEIGHT}px`, ...style } as CSSProperties}
      {...props}
    >
      <div
        ref={scroller}
        role="grid"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-rowcount={bodyCount + 1}
        aria-colcount={colCount + 1}
        aria-multiselectable="true"
        aria-readonly={isReadOnly || undefined}
        aria-busy={sorting || undefined}
        aria-activedescendant={bodyCount && !editing ? cellId(focusCell.row, focusCell.column) : undefined}
        data-slot="spreadsheet-grid"
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        className="bl-scroll relative min-h-0 flex-1 overflow-auto overscroll-contain text-footnote outline-none select-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
      >
        <div className="relative" style={{ width: gutter + totalWidth, minHeight: '100%' }}>
          <div role="rowgroup" className="sticky top-0 z-20 h-(--head)">
            <div role="row" aria-rowindex={1} className="relative h-full" style={{ width: gutter + totalWidth }}>
              <div role="columnheader" aria-label="Row number" onPointerDown={(e) => { e.preventDefault(); gridFocus(); setSel({ anchor: { row: 0, column: 0 }, focus: { row: bodyCount - 1, column: colCount - 1 } }); }}
                className="sticky left-0 z-10 h-full w-(--gutter) bg-secondary box-border border-0 border-r border-b border-solid border-border" />
              {headerCells}
              {editing?.row === -1 ? editBox : null}
            </div>
          </div>
          <div role="rowgroup" className="relative" style={{ height: bodyCount * rowHeight }} onPointerDown={onPointerDown} onPointerOver={onPointerOver}
            onDoubleClick={(e) => { const cell = cellAt(e.target); if (cell) startEdit(cell); }}>
            {visibleRows}
            {bodyCount ? (
              <div aria-hidden="true" data-slot="spreadsheet-selection" className="pointer-events-none absolute z-5 outline-2 -outline-offset-1 outline-primary"
                style={{ top: rect.top * rowHeight, left: gutter + offsets[rect.left], width: offsets[rect.right + 1] - offsets[rect.left], height: (rect.bottom - rect.top + 1) * rowHeight }} />
            ) : null}
            {editing && editing.row >= 0 ? editBox : null}
          </div>
          {!bodyCount ? <div className="px-4 py-8 text-center text-footnote text-muted-foreground">No rows{isReadOnly ? '' : ' — paste cells or add a row'}</div> : null}
        </div>
      </div>
      {footer ? (
        <div data-slot="spreadsheet-footer" className="flex min-h-9 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-caption text-foreground/70 shadow-hairline-t">
          <span className="tabular-nums">{formatNumber(bodyCount)} {bodyCount === 1 ? 'row' : 'rows'} × {colCount} {colCount === 1 ? 'column' : 'columns'}</span>
          <span aria-live="polite" data-slot="spreadsheet-sort-status" data-engine={sortInfo?.ranOn} className="tabular-nums">
            {sorting ? 'Sorting…' : sortInfo ? `Sorted by ${title(sortInfo.column)} ${ranOn(sortInfo.ranOn)} in ${sortInfo.ms < 10 ? sortInfo.ms.toFixed(1) : Math.round(sortInfo.ms)} ms` : null}
          </span>
          <span className="min-w-0 flex-1" />
          {stats ? (
            <span data-slot="spreadsheet-stats" className="tabular-nums">
              {stats.numbers > 1 ? `Sum ${formatNumber(stats.sum)} · Average ${formatNumber(stats.average)} · ` : ''}Count {formatNumber(stats.count)}
            </span>
          ) : null}
          {actions}
          {isReadOnly ? null : (
            <AriaButton onPress={addRow}
              className="inline-flex h-6 cursor-default items-center gap-1 rounded-ctl border-0 bg-transparent px-1.5 [font-family:inherit] text-caption font-medium text-foreground outline-none data-hovered:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring">
              <Icon name="plus" size={12} weight="semibold" className="text-primary" />Add Row
            </AriaButton>
          )}
        </div>
      ) : null}
    </div>
  );
}
