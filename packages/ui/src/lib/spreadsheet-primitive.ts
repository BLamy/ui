import {
  announce, byCell, byCellRange, createCellRange, createChange, createController, createGridFocus, createInlineEdit,
  createUndoStack, createVirtualizer, css, definePrimitive, isRTL, selects, textToCells,
  type CellBounds, type CellRange, type CellRangeReason, type ChangeDetails, type GridCell, type GridFocusReason, type ResizeDraft,
} from '@ui-sdk/core';
import { createColumnResize, type ColumnResizeReason } from '@/lib/grid-behaviors';
import {
  columnHistogram, columnNumbers, inferColumnType, selectionStats, sortRows, GPU_MIN_ROWS,
  type SelectionStats, type SpreadsheetColumnType, type SpreadsheetEngine, type SpreadsheetHistogram, type SpreadsheetRanOn,
  type SpreadsheetSort, type SpreadsheetSortDirection,
} from '@/lib/spreadsheet-model';

/* ══ The spreadsheet primitive: a virtualized ARIA grid of string cells ══
   Built from UI SDK's behaviors, wired to each other: the active cell is `createGridFocus` (one tab stop; arrows,
   Home/End, Page Up/Down, flipped in right-to-left text), the block of selected cells is `createCellRange` (Shift
   extends, a drag paints, Shift+Space and Ctrl+Space take rows and columns, ⌘A all, and each keyboard change is
   announced), editing in place is `createInlineEdit` (Enter, F2 or typing; Enter and Tab save, Esc cancels), the
   clipboard is `range.text` and `textToCells`, history is `createUndoStack`, column widths are `createColumnResize`
   (UI SDK's resize) and only the rows and columns in view render, from two `createVirtualizer`s on one scroller.
   Sorting and histograms come from lib/spreadsheet-model (WebGPU or the CPU). No React: components/spreadsheet.tsx
   renders it.

   Cells are addressed in view coordinates: `row` counts displayed body rows (after sorting) from 0, `col` columns
   from 0, and row -1 is the title row. A cell part's id is `row:col`, as `byCell` names it. */

/** Why the rows changed: a cell was edited, cells were pasted, cut or cleared, a row was added, history moved, or code. */
export type SpreadsheetValueChangeReason = 'cell-edit' | 'paste' | 'cut' | 'clear' | 'add-row' | 'undo' | 'redo' | 'imperative';
/** Why a column's width changed: its edge was dragged, ⌥← ⌥→ or an arrow on its edge moved it, a double press fit it, or code. */
export type SpreadsheetColumnWidthsChangeReason = ColumnResizeReason;

/** The last sort: which engine ran it and how long it took. */
export interface SpreadsheetSortInfo extends SpreadsheetSort {
  ranOn: SpreadsheetRanOn;
  ms: number;
  rows: number;
}

/** Drives a Spreadsheet from outside it. Pass it as `controller`. Cells are in view coordinates. */
export function createSpreadsheetController() {
  return createController<{
    /** Focuses the active cell, or the first one. */
    focus: () => void;
    /** Selects from `anchor` to `end` (a single cell without `end`) and scrolls it into view. */
    select: (anchor: GridCell, end?: GridCell) => boolean;
    /** Writes one cell's text; row -1 is a column's title. */
    edit: (cell: GridCell, text: string) => boolean;
    /** Pastes tab-separated text at the selection, as ⌘V does. */
    paste: (text: string) => boolean;
    /** Clears the selected cells. */
    clear: () => boolean;
    /** The selected cells as tab-separated text, as ⌘C copies them. */
    copy: () => string;
    /** Sorts the view by a column, or clears the sort with `null`. Without `direction` it steps, as the column's button does. */
    sort: (column: number, direction?: SpreadsheetSortDirection | null) => Promise<boolean>;
    undo: () => boolean;
    redo: () => boolean;
    /** Adds an empty row at the end and moves to it. */
    addRow: () => boolean;
    setColumnWidths: (widths: Readonly<Record<string, number>>) => boolean;
  }>();
}
export type SpreadsheetController = ReturnType<typeof createSpreadsheetController>;

export type SpreadsheetOptions = {
  value?: string[][];
  defaultValue?: string[][];
  onValueChange?: (rows: string[][], details: ChangeDetails<SpreadsheetValueChangeReason>) => void;
  header?: boolean;
  readOnly?: boolean;
  engine?: SpreadsheetEngine;
  gpuMinRows?: number;
  histograms?: boolean;
  onSort?: (info: SpreadsheetSortInfo | null) => void;
  /** Every row's height in px. */
  rowHeight?: number;
  /** Width of an empty column in px. */
  columnWidth?: number;
  columnWidths?: Readonly<Record<string, number>>;
  defaultColumnWidths?: Readonly<Record<string, number>>;
  onColumnWidthsChange?: (widths: Readonly<Record<string, number>>, details: ChangeDetails<SpreadsheetColumnWidthsChangeReason>) => void;
  controller?: SpreadsheetController;
};

type SortState = SpreadsheetSortInfo & { order: Uint32Array };
/** Histograms of the number and date columns that have been in view, for the rows they were tallied from. */
type Bins = { of: string[][] | null; byColumn: ReadonlyMap<number, SpreadsheetHistogram | null> };

export type SpreadsheetState = {
  value: string[][];
  header: boolean;
  readOnly: boolean;
  rowHeight: number;
  histograms: boolean;
  /** The active cell (view coordinates), or `null` before the grid is entered. */
  active: GridCell | null;
  /** The selected block, or `null` for the active cell alone. */
  range: CellRange | null;
  /** The cell being edited, as `row:col`. */
  editing: string | null;
  columnWidths: Readonly<Record<string, number>>;
  /** Live: a column's edge while a pointer drags it. */
  draft: ResizeDraft | null;
  sort: SortState | null;
  sorting: boolean;
  bins: Bins;
};

/** What the cells in view render from: the rows, their order, the titles and the histograms. */
export type SpreadsheetView = Pick<SpreadsheetState, 'value' | 'header' | 'readOnly' | 'rowHeight' | 'histograms' | 'sort' | 'bins'>;

export type SpreadsheetCellState = { active: boolean; selected: boolean; editing: boolean };
export type SpreadsheetHeaderState = { selected: boolean };
export type SpreadsheetColumnState = SpreadsheetHeaderState & { sorted: SpreadsheetSortDirection | undefined; editing: boolean };
export type SpreadsheetFooterState = {
  rows: number;
  columns: number;
  /** The selected block's count, sum and average, while more than one cell is selected. */
  stats: SelectionStats | null;
  sort: SpreadsheetSortInfo | null;
  /** The sorted column's title. */
  sortedBy: string | null;
  sorting: boolean;
};

/** Column letters: 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

export const HEADER_HEIGHT = 30;
export const HISTOGRAM_HEIGHT = 16;
const HISTOGRAM_BINS = 16;
const MIN_WIDTH = 48;
const NO_WIDTHS: Readonly<Record<string, number>> = {};
const NO_BINS: Bins = { of: null, byColumn: new Map() };
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const isNumeric = (type: SpreadsheetColumnType | undefined) => type === 'number' || type === 'date';
const cellKey = ({ row, col }: GridCell) => `${row}:${col}`;
const parseKey = (key: string): GridCell => {
  const at = key.indexOf(':');
  return { row: Number(key.slice(0, at)), col: Number(key.slice(at + 1)) };
};

/** A starting width for a column from its title and first rows' text (an estimate: no layout is read). */
function estimateWidth(rows: readonly (readonly string[])[], column: number, fallback: number, header: boolean) {
  // The title also makes room for its bolder text and the sort button.
  let px = header ? (rows[0]?.[column] ?? '').length * 8 + 46 : 0;
  for (let r = header ? 1 : 0; r < Math.min(rows.length, 60); r++) px = Math.max(px, (rows[r]?.[column] ?? '').length * 7.4 + 22);
  return px > 22 ? clamp(Math.round(px), 64, 320) : fallback;
}

/** What the rows hold: where the body starts, how many rows and columns, and each column's type. */
type Model = { rows: string[][]; header: boolean; base: 0 | 1; body: number; cols: number; types: SpreadsheetColumnType[] };

const ALL: Record<keyof SpreadsheetState, []> = {
  value: [], header: [], readOnly: [], rowHeight: [], histograms: [], active: [], range: [], editing: [],
  columnWidths: [], draft: [], sort: [], sorting: [], bins: [],
};
/** Every key a slot never reads, as `selects` takes them, but for the ones it reads. */
const except = (...reads: (keyof SpreadsheetState)[]) => {
  const out: Partial<Record<keyof SpreadsheetState, []>> = { ...ALL };
  for (const key of reads) delete out[key];
  return out;
};

export const spreadsheet = definePrimitive({
  name: 'spreadsheet',
  options: {
    value: 'value', defaultValue: 'value', onValueChange: 'callback', header: 'boolean', readOnly: 'boolean',
    engine: 'string', gpuMinRows: 'number', histograms: 'boolean', onSort: 'callback', rowHeight: 'number', columnWidth: 'number',
    columnWidths: 'value', defaultColumnWidths: 'value', onColumnWidthsChange: 'callback', controller: 'value',
  },
  controlled: ['value', 'columnWidths'],
  live: ['draft'],
  state: (options: SpreadsheetOptions): SpreadsheetState => ({
    value: options.value ?? options.defaultValue ?? [[]],
    header: options.header ?? true,
    readOnly: options.readOnly ?? false,
    rowHeight: options.rowHeight ?? 28,
    histograms: options.histograms ?? true,
    // The first cell is active from the start, as in other spreadsheets: it shows where typing and arrows begin.
    active: (options.value ?? options.defaultValue ?? [[]]).length > (options.header ?? true ? 1 : 0) ? { row: 0, col: 0 } : null,
    range: null,
    editing: null,
    columnWidths: options.columnWidths ?? options.defaultColumnWidths ?? NO_WIDTHS,
    draft: null,
    sort: null,
    sorting: false,
    bins: NO_BINS,
  }),
  sync: (options) => ({
    header: options.header ?? true,
    readOnly: options.readOnly ?? false,
    rowHeight: options.rowHeight ?? 28,
    histograms: options.histograms ?? true,
    ...(options.value === undefined ? {} : { value: options.value }),
    ...(options.columnWidths === undefined ? {} : { columnWidths: options.columnWidths }),
  }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);

    /* ── The rows as a model ── */
    let model: Model | undefined;
    const modelOf = (state: SpreadsheetView): Model => {
      if (model && model.rows === state.value && model.header === state.header) return model;
      const rows = state.value;
      const base = state.header ? 1 : 0;
      let cols = 1;
      for (const r of rows) if (r.length > cols) cols = r.length;
      // A column's type only changes with its values; an edit elsewhere keeps the ones read before.
      const types = Array.from({ length: cols }, (_, c) => inferColumnType(rows, c, base));
      model = { rows, header: state.header, base, body: Math.max(0, rows.length - base), cols, types };
      return model;
    };
    const now = () => modelOf(store.get());
    /** The sort's order, while it still fits the rows (rows added after a sort show at the end). */
    const orderOf = (state: SpreadsheetView) => (state.sort && state.sort.order.length <= modelOf(state).body ? state.sort : null);
    /** The data row behind a displayed row. */
    const dataRow = (state: SpreadsheetView, view: number) => {
      const sort = orderOf(state);
      return modelOf(state).base + (sort && view < sort.order.length ? sort.order[view] : view);
    };
    const textAt = (state: SpreadsheetView, { row, col }: GridCell) =>
      (row < 0 ? state.value[0]?.[col] : state.value[dataRow(state, row)]?.[col]) ?? '';
    const title = (state: SpreadsheetView, col: number) => (state.header ? state.value[0]?.[col] || columnName(col) : columnName(col));

    /* ── Layout ── */
    let estimates: number[] = [];
    const estimate = (col: number) => {
      const state = store.get();
      return (estimates[col] ??= estimateWidth(state.value, col, context.options().columnWidth ?? 120, state.header));
    };
    const showBars = (state: SpreadsheetView) => state.histograms && modelOf(state).types.some(isNumeric);
    const layout = (state: SpreadsheetView) => {
      const { body } = modelOf(state);
      const head = HEADER_HEIGHT + (showBars(state) ? HISTOGRAM_HEIGHT + 4 : 0);
      return { gutter: Math.max(44, String(body).length * 8 + 22), head, rowHeight: state.rowHeight, bars: showBars(state) };
    };
    let scroller: HTMLElement | undefined;

    const resize = createColumnResize<SpreadsheetState>(context, {
      widths: (state) => state.columnWidths,
      draft: 'draft',
      set: (widths, details) => change('columnWidths', widths, details),
      limits: () => ({ min: MIN_WIDTH }),
      measure: (column) => estimate(Number(column)),
      // A column with no width set is as wide as its estimate, which comes from the rows alone.
      shown: (_state, column) => estimate(Number(column)),
      step: 16,
      largeStep: 64,
    });
    const widthOf = (state: SpreadsheetState, col: number) => resize.width(state, String(col)) ?? estimate(col);

    /* ── Rows and columns in view: one virtualizer down, one across, on the same scroller ── */
    const editingCell = () => {
      const { editing } = store.get();
      return editing ? parseKey(editing) : null;
    };
    const rowsInView = createVirtualizer({
      count: () => now().body,
      estimate: () => store.get().rowHeight,
      overscan: 6,
      // The title row is sticky above the rows.
      get scrollMargin() {
        return layout(store.get()).head;
      },
      // The active row stays rendered while it's scrolled away, so it keeps focus and the tab stop.
      keep: () => {
        const at = store.get().active?.row ?? 0;
        const edit = editingCell();
        return edit && edit.row >= 0 && edit.row !== at ? [at, edit.row] : [at];
      },
    });
    const columnsInView = createVirtualizer({
      count: () => now().cols,
      estimate: (col) => widthOf(store.get(), col),
      horizontal: true,
      overscan: 2,
      // The row numbers are sticky beside the columns.
      get scrollMargin() {
        return layout(store.get()).gutter;
      },
      keep: () => {
        const at = store.get().active?.col ?? 0;
        const edit = editingCell();
        return edit && edit.col !== at ? [at, edit.col] : [at];
      },
    });
    let refreshing = false;
    const refresh = () => {
      if (refreshing) return;
      refreshing = true;
      // After the change that asked for it, which may come in while the page renders.
      queueMicrotask(() => {
        refreshing = false;
        rowsInView.refresh();
        columnsInView.refresh();
        tally();
      });
    };

    /* ── Focus, range and editing ── */
    const grid = createGridFocus<SpreadsheetState>(context, {
      key: 'active',
      rows: () => now().body,
      cols: () => now().cols,
      pageSize: () => {
        const { head, rowHeight } = layout(store.get());
        return scroller?.clientHeight ? Math.max(1, Math.floor((scroller.clientHeight - head) / rowHeight) - 1) : 10;
      },
      reveal: (cell) => {
        rowsInView.scrollToIndex(cell.row);
        columnsInView.scrollToIndex(cell.col);
      },
    });
    const range = createCellRange<SpreadsheetState>(context, {
      key: 'range',
      grid,
      rows: () => now().body,
      cols: () => now().cols,
      reveal: (cell) => {
        rowsInView.scrollToIndex(cell.row);
        columnsInView.scrollToIndex(cell.col);
      },
      set: (next, details) => change('range', next, details),
    });

    /* ── Writing, with history ── */
    // The rows this instance made, so rows that come back through a controlled `value` aren't taken for a new table.
    const own = new WeakSet<string[][]>();
    const history = createUndoStack<string[][]>(store.get().value, { limit: 100 });
    // Work that waits for written rows to reach the state, as controlled rows do after the parent renders.
    let afterWrite: (() => void) | null = null;
    const whenWritten = (run: () => void) => {
      afterWrite = run;
    };

    const commit = (next: string[][], details: { reason: SpreadsheetValueChangeReason; event?: Event }, record = true) => {
      own.add(next);
      const done = change('value', next, details);
      if (done && record) history.record(next);
      return done;
    };

    /** Writes cells (view coordinates; row -1 is the title row), growing the table when a write lands past it. */
    const write = (cells: { row: number; col: number; value: string }[], details: { reason: SpreadsheetValueChangeReason; event?: Event }) => {
      const state = store.get();
      if (state.readOnly || !cells.length) return false;
      const { rows: data, base, body } = modelOf(state);
      const next = data.slice();
      const copied = new Set<number>();
      for (const { row, col, value } of cells) {
        const index = row < 0 ? 0 : row < body ? dataRow(state, row) : base + row;
        while (next.length <= index) next.push([]);
        if (!copied.has(index)) {
          next[index] = next[index].slice();
          copied.add(index);
        }
        const target = next[index];
        while (target.length < col) target.push('');
        target[col] = value;
      }
      return commit(next, details);
    };

    const edit = createInlineEdit<SpreadsheetState>(context, {
      key: 'editing',
      value: (id) => textAt(store.get(), parseKey(id)),
      commit: (id, text, details) => write([{ ...parseKey(id), value: text }], { reason: 'cell-edit', event: details.event }),
      disabled: (id) => {
        const state = store.get();
        const { row } = parseKey(id);
        return state.readOnly || (row < 0 ? !state.header : row >= modelOf(state).body);
      },
    });

    const bounds = (state: SpreadsheetState): CellBounds | null => (modelOf(state).body ? range.bounds(state) : null);
    const cellsIn = (state: SpreadsheetState, b: CellBounds, each: (cell: GridCell, text: string) => void) => {
      const { body } = modelOf(state);
      for (let row = b.top; row <= b.bottom && row < body; row++) {
        const data = state.value[dataRow(state, row)];
        for (let col = b.left; col <= b.right; col++) each({ row, col }, data?.[col] ?? '');
      }
    };
    const clear = (reason: 'clear' | 'cut', event?: Event) => {
      const state = store.get();
      const b = bounds(state);
      if (!b) return false;
      const cells: { row: number; col: number; value: string }[] = [];
      cellsIn(state, b, (cell, text) => {
        if (text) cells.push({ ...cell, value: '' });
      });
      return write(cells, { reason, event });
    };
    const copy = () => {
      const state = store.get();
      return bounds(state) ? range.text(state, (cell) => textAt(state, cell)) : '';
    };
    const paste = (text: string, event?: Event) => {
      const state = store.get();
      if (state.readOnly || !text) return false;
      const block = textToCells(text);
      const b = range.bounds(state) ?? { top: 0, left: 0, bottom: 0, right: 0 };
      const cells: { row: number; col: number; value: string }[] = [];
      // One value pasted into a larger selection fills it, as other spreadsheets do.
      if (block.length === 1 && block[0].length === 1 && (b.bottom > b.top || b.right > b.left)) {
        for (let row = b.top; row <= b.bottom; row++) for (let col = b.left; col <= b.right; col++) cells.push({ row, col, value: block[0][0] });
        return write(cells, { reason: 'paste', event });
      }
      block.forEach((line, i) => line.forEach((value, j) => cells.push({ row: b.top + i, col: b.left + j, value })));
      const done = write(cells, { reason: 'paste', event });
      const width = block.reduce((m, line) => Math.max(m, line.length), 0);
      if (done && (block.length > 1 || width > 1)) {
        whenWritten(() => range.select({ anchor: { row: b.top, col: b.left }, end: { row: b.top + block.length - 1, col: b.left + width - 1 } }, { reason: 'imperative' }));
      }
      return done;
    };
    const undo = (event?: Event) => {
      const prev = history.undo();
      return !!prev && commit(prev, { reason: 'undo', event }, false);
    };
    const redo = (event?: Event) => {
      const next = history.redo();
      return !!next && commit(next, { reason: 'redo', event }, false);
    };
    const select = (anchor: GridCell, end: GridCell = anchor, details: { reason: CellRangeReason; event?: Event } = { reason: 'imperative' }) => {
      const { body, cols } = now();
      if (!body) return false;
      const fit = (cell: GridCell) => ({ row: clamp(cell.row, 0, body - 1), col: clamp(cell.col, 0, cols - 1) });
      const from = fit(anchor);
      const to = fit(end);
      grid.focus(to, { reason: details.reason === 'drag' ? 'item-press' : details.reason });
      range.select(from.row === to.row && from.col === to.col ? null : { anchor: from, end: to }, details);
      return true;
    };
    const addRow = (event?: Event) => {
      const { body } = now();
      const done = write([{ row: body, col: 0, value: '' }], { reason: 'add-row', event });
      if (done) whenWritten(() => select({ row: body, col: 0 }));
      return done;
    };

    /* ── Sorting: a view over the rows, which keep their order ── */
    let sortSeq = 0;
    const sort = async (column: number, direction?: SpreadsheetSortDirection | null) => {
      const state = store.get();
      const { types, base, cols } = modelOf(state);
      if (column < 0 || column >= cols) return false;
      const sorted = orderOf(state);
      const current = sorted?.column === column ? sorted.direction : null;
      const next = direction !== undefined ? direction : current === null ? 'ascending' : current === 'ascending' ? 'descending' : null;
      const seq = ++sortSeq;
      const options = context.options();
      if (!next) {
        store.set({ sort: null, sorting: false });
        options.onSort?.(null);
        announce('Sort cleared');
        return true;
      }
      store.set({ sorting: true });
      const result = await sortRows(state.value, { column, direction: next }, { from: base, type: types[column], engine: options.engine, gpuMinRows: options.gpuMinRows ?? GPU_MIN_ROWS });
      if (seq !== sortSeq) return false;
      const info: SpreadsheetSortInfo = { column, direction: next, ranOn: result.ranOn, ms: result.ms, rows: result.order.length };
      store.set({ sorting: false, sort: { ...info, order: result.order } });
      options.onSort?.(info);
      announce(`Sorted by ${title(store.get(), column)}, ${next}`);
      return true;
    };

    /* ── Histograms of the number and date columns in view, a moment after the rows settle ── */
    let binsTimer: ReturnType<typeof setTimeout> | undefined;
    let binsSeq = 0;
    const tally = () => {
      const state = store.get();
      if (!showBars(state)) return;
      const { rows, types, base } = modelOf(state);
      const fresh = state.bins.of === rows;
      const wanted = columnsInView.items().map((item) => item.index).filter((c) => isNumeric(types[c]) && !(fresh && state.bins.byColumn.has(c)));
      if (!wanted.length) return;
      clearTimeout(binsTimer);
      const seq = ++binsSeq;
      const { engine, gpuMinRows } = context.options();
      // The last bars stay up while an edit's new ones are tallied, so they don't flicker.
      binsTimer = setTimeout(() => {
        void Promise.all(wanted.map(async (c) => [c, await columnHistogram(columnNumbers(rows, c, base, types[c]), HISTOGRAM_BINS, { engine, gpuMinRows })] as const))
          .then((done) => {
            if (seq !== binsSeq) return;
            const prev = store.get().bins;
            const byColumn = new Map(prev.of === rows ? prev.byColumn : []);
            for (const [c, result] of done) byColumn.set(c, result);
            store.set({ bins: { of: rows, byColumn } });
          });
      }, fresh ? 0 : 250);
    };
    context.onDestroy(() => clearTimeout(binsTimer));
    context.onDestroy(columnsInView.subscribe(tally));

    /* ── Following the state ── */
    let seen = store.get();
    context.onDestroy(store.subscribe(() => {
      const state = store.get();
      const before = seen;
      seen = state;
      if (state.value !== before.value) {
        if (afterWrite) {
          const run = afterWrite;
          afterWrite = null;
          queueMicrotask(run);
        }
        queueMicrotask(tally);
      }
      if (state.value !== before.value || state.header !== before.header || state.rowHeight !== before.rowHeight
        || state.histograms !== before.histograms || state.columnWidths !== before.columnWidths || state.draft !== before.draft) refresh();
    }));
    // Rows from outside that this instance didn't make are a new table: its history, sizes and sort start over.
    context.onOptions((options) => {
      const next = options.value;
      if (next === undefined || next === store.get().value || own.has(next)) return;
      own.add(next);
      history.reset(next);
      estimates = [];
      sortSeq++;
      store.set({ sort: null, sorting: false });
    });

    /* ── Presses ── */
    const headerPointerdown = (event: PointerEvent, axis: 'row' | 'col', index: number) => {
      if (event.button !== 0 || (event.target as Element | null)?.closest?.('button,input,[role=separator]')) return;
      event.preventDefault();
      const { body } = now();
      if (!body) return;
      const active = grid.active();
      const from = event.shiftKey && active ? active[axis] : index;
      if (!event.shiftKey || !active) grid.focus(axis === 'row' ? { row: index, col: 0 } : { row: 0, col: index }, { reason: 'item-press', event });
      if (axis === 'row') range.selectRows(from, index, { reason: 'item-press', event });
      else range.selectColumns(from, index, { reason: 'item-press', event });
    };

    const api = {
      focus: () => {
        const active = grid.active();
        grid.focus(active ?? { row: 0, col: 0 }, { reason: 'imperative' });
      },
      select: (anchor: GridCell, end?: GridCell) => select(anchor, end),
      edit: (cell: GridCell, text: string) => write([{ row: cell.row, col: cell.col, value: text }], { reason: 'imperative' }),
      paste: (text: string) => paste(text),
      clear: () => clear('clear'),
      copy,
      sort,
      undo: () => undo(),
      redo: () => redo(),
      addRow: () => addRow(),
      setColumnWidths: (widths: Readonly<Record<string, number>>) => change('columnWidths', widths, { reason: 'imperative' }),
      internal: {
        grid,
        range,
        edit,
        resize,
        rows: rowsInView,
        columns: columnsInView,
        state: () => store.get(),
        modelOf,
        layout,
        orderOf,
        dataRow,
        title,
        /** The selected block's statistics, while more than one cell is selected. */
        stats: (() => {
          let memo: { rows: string[][]; sort: SortState | null; key: string; stats: SelectionStats | null } | undefined;
          return (state: SpreadsheetState) => {
            const b = state.range ? bounds(state) : null;
            const count = b ? (b.bottom - b.top + 1) * (b.right - b.left + 1) : 0;
            if (!b || count <= 1 || count > 1_000_000) return null;
            const key = `${b.top},${b.left},${b.bottom},${b.right}`;
            if (memo && memo.rows === state.value && memo.sort === orderOf(state) && memo.key === key) return memo.stats;
            const cells: string[] = [];
            cellsIn(state, b, (_cell, text) => cells.push(text));
            memo = { rows: state.value, sort: orderOf(state), key, stats: selectionStats(cells) };
            return memo.stats;
          };
        })(),
        headerPointerdown,
        cornerPointerdown(event: PointerEvent) {
          if (event.button !== 0 || !now().body) return;
          event.preventDefault();
          grid.focus(grid.active() ?? { row: 0, col: 0 }, { reason: 'item-press', event });
          range.selectAll({ reason: 'item-press', event });
        },
        cellKeydown(event: KeyboardEvent, cell: GridCell) {
          // The editor's keys bubble through its cell.
          if (event.defaultPrevented || store.get().editing) return;
          const mod = event.metaKey || event.ctrlKey;
          const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
          if (mod && !event.altKey && key === 'z') {
            event.preventDefault();
            if (event.shiftKey) redo(event);
            else undo(event);
            return;
          }
          if (mod && !event.altKey && key === 'y') {
            event.preventDefault();
            redo(event);
            return;
          }
          if ((key === 'Delete' || key === 'Backspace') && !mod) {
            event.preventDefault();
            clear('clear', event);
            return;
          }
          if (event.altKey && !mod && (key === 'ArrowLeft' || key === 'ArrowRight')) {
            event.preventDefault();
            resize.nudge(String(cell.col), key === 'ArrowRight' ? 1 : -1, event.shiftKey, event);
            return;
          }
          // ⌘ or Ctrl with an arrow jumps to the grid's edge, as spreadsheets do; with Shift the range does that.
          if (mod && !event.shiftKey && !event.altKey && ARROWS.has(key)) {
            event.preventDefault();
            const { body, cols } = now();
            const rtl = isRTL(event.target as Element);
            const start = (key === 'ArrowLeft') !== rtl;
            const to = key === 'ArrowUp' ? { row: 0, col: cell.col }
              : key === 'ArrowDown' ? { row: body - 1, col: cell.col }
              : { row: cell.row, col: start ? 0 : cols - 1 };
            grid.focus(to, { reason: 'list-navigation', event });
            range.select(null, { reason: 'list-navigation', event });
            return;
          }
          if (edit.keydown(event, cellKey(cell))) return;
          range.keydown(event);
        },
        cellPointerdown(event: PointerEvent, cell: GridCell) {
          if (store.get().editing !== cellKey(cell)) range.pointerdown(event, cell);
        },
        columnDblclick(event: MouseEvent, col: number) {
          if ((event.target as Element | null)?.closest?.('button,input,[role=separator]')) return;
          edit.dblclick(event, cellKey({ row: -1, col }));
        },
        editorKeydown(event: KeyboardEvent) {
          const editing = store.get().editing;
          const key = event.key;
          if (!editing || !edit.inputKeydown(event) || (key !== 'Enter' && key !== 'Tab')) return;
          const at = parseKey(editing);
          const details = { reason: 'list-navigation' as GridFocusReason, event };
          if (at.row < 0) {
            // A title saved: back to the grid, where focus was.
            if (now().body) grid.focus(grid.active() ?? { row: 0, col: at.col }, details);
            return;
          }
          const step = event.shiftKey ? -1 : 1;
          const next = key === 'Enter' ? { row: at.row + step, col: at.col } : { row: at.row, col: at.col + step };
          if (!grid.focus(next, details)) grid.focus(at, details);
          range.select(null, details);
        },
        copy(event: ClipboardEvent) {
          if (store.get().editing || !bounds(store.get())) return;
          event.clipboardData?.setData('text/plain', copy());
          event.preventDefault();
        },
        cut(event: ClipboardEvent) {
          if (store.get().editing || !bounds(store.get())) return;
          event.clipboardData?.setData('text/plain', copy());
          event.preventDefault();
          clear('cut', event);
        },
        paste(event: ClipboardEvent) {
          const text = event.clipboardData?.getData('text/plain');
          if (store.get().editing || store.get().readOnly || !text) return;
          event.preventDefault();
          paste(text, event);
        },
        resetColumn(event: MouseEvent, col: number) {
          // Fit the column again: a fresh estimate from its text, and no width of its own.
          estimates[col] = estimateWidth(store.get().value, col, context.options().columnWidth ?? 120, store.get().header);
          if (!resize.reset(String(col), event)) refresh();
        },
        addRow: (event?: Event) => addRow(event),
        sortPress: (column: number) => {
          void sort(column);
        },
        connect(el: HTMLElement) {
          scroller = el;
          const offRows = rowsInView.connect(el);
          const offColumns = columnsInView.connect(el);
          // The columns in view may have been read before the scroller joined, with nothing to tell.
          queueMicrotask(tally);
          return () => {
            offRows();
            offColumns();
            if (scroller === el) scroller = undefined;
          };
        },
      },
    };
    return api;
  },
  slots: (slot) => ({
    root: slot<object, SpreadsheetView>({
      selects: selects<SpreadsheetState, unknown, object>(except('value', 'header', 'readOnly', 'rowHeight', 'histograms', 'sort', 'bins')),
      state: (state) => ({
        value: state.value, header: state.header, readOnly: state.readOnly, rowHeight: state.rowHeight,
        histograms: state.histograms, sort: state.sort, bins: state.bins,
      }),
    }),

    grid: slot<object>({
      role: 'grid',
      keys: { none: 'Focus stays on a cell, whose keydown handles them.' },
      selects: selects<SpreadsheetState, unknown, object>(except('value', 'header', 'readOnly', 'rowHeight', 'histograms', 'sorting')),
      attrs: (state, { api }) => {
        const { body, cols } = api.internal.modelOf(state);
        const { gutter, head, rowHeight } = api.internal.layout(state);
        return {
          'aria-rowcount': String(body + 1),
          'aria-colcount': String(cols + 1),
          'aria-multiselectable': 'true',
          'aria-readonly': state.readOnly ? 'true' : undefined,
          'aria-busy': state.sorting ? 'true' : undefined,
          // Focus that scrolls a cell in keeps it clear of the sticky titles and row numbers.
          style: css({
            '--row': `${rowHeight}px`, '--gutter': `${gutter}px`, '--head': `${head}px`, '--hist': `${HISTOGRAM_HEIGHT}px`,
            'scroll-padding-top': `${head}px`, 'scroll-padding-left': `${gutter}px`,
          }),
        };
      },
      on: {
        copy: (event, { api }) => api.internal.copy(event),
        cut: (event, { api }) => api.internal.cut(event),
        paste: (event, { api }) => api.internal.paste(event),
      },
      bind: (el, { api }) => api.internal.connect(el),
    }),

    // The titles' and the body's rows, keyed `head` and `body`.
    rowgroup: slot({ role: 'rowgroup', selects: selects<SpreadsheetState, unknown, object>(ALL) }),

    row: slot<{ row: number }>({
      role: 'row',
      props: { row: 'number' },
      selects: selects<SpreadsheetState, unknown, { row: number }>(ALL),
      attrs: (_state, { props }) => ({ 'aria-rowindex': String(props.row + 2) }),
    }),

    corner: slot({
      role: 'columnheader',
      selects: selects<SpreadsheetState, unknown, object>(ALL),
      attrs: () => ({ 'aria-label': 'Row number' }),
      on: { pointerdown: (event, { api }) => api.internal.cornerPointerdown(event) },
    }),

    // A column's title, its sort button and histogram, and the edge that resizes it.
    // Keyed by its `value`, the column's index as text, as the edge, row number and cell (`"row:col"`) are.
    column: slot<{ value: string; col: number }, SpreadsheetColumnState>({
      role: 'columnheader',
      props: { value: 'string', col: 'number' },
      selects: selects<SpreadsheetState, unknown, { value: string; col: number }>({
        ...except('active', 'range', 'sort', 'value'),
        editing: ({ props }) => [cellKey({ row: -1, col: props.col })],
      }),
      state: (state, { props, api }) => {
        const b = api.internal.modelOf(state).body ? api.internal.range.bounds(state) : null;
        const sort = api.internal.orderOf(state);
        return {
          selected: !!b && props.col >= b.left && props.col <= b.right,
          sorted: sort?.column === props.col ? sort.direction : undefined,
          editing: state.editing === cellKey({ row: -1, col: props.col }),
        };
      },
      attrs: (state, { props, api }) => {
        const b = api.internal.modelOf(state).body ? api.internal.range.bounds(state) : null;
        const sort = api.internal.orderOf(state);
        return {
          'aria-colindex': String(props.col + 2),
          'aria-sort': sort?.column === props.col ? sort.direction : 'none',
          'data-selected': b && props.col >= b.left && props.col <= b.right ? '' : undefined,
        };
      },
      on: {
        pointerdown: (event, { api, props }) => api.internal.headerPointerdown(event, 'col', props.col),
        dblclick: (event, { api, props }) => api.internal.columnDblclick(event, props.col),
      },
    }),

    resizer: slot<{ value: string }>({
      role: 'separator',
      props: { value: 'string' },
      selects: selects<SpreadsheetState, unknown, { value: string }>(except('columnWidths', 'draft', 'value', 'header')),
      attrs: (state, { props, api }) => api.internal.resize.handleAttrs(state, props.value),
      on: {
        pointerdown: (event, { el, api, props }) => {
          if (el) api.internal.resize.pointerdown(event, props.value, el);
        },
        keydown: (event, { api, props }) => {
          api.internal.resize.keydown(event, props.value);
        },
        dblclick: (event, { api, props }) => api.internal.resetColumn(event, Number(props.value)),
      },
    }),

    // A row's number, which selects the row.
    rowheader: slot<{ value: string; row: number }, SpreadsheetHeaderState>({
      role: 'rowheader',
      props: { value: 'string', row: 'number' },
      selects: selects<SpreadsheetState, unknown, { value: string; row: number }>(except('active', 'range', 'value')),
      state: (state, { props, api }) => {
        const b = api.internal.modelOf(state).body ? api.internal.range.bounds(state) : null;
        return { selected: !!b && props.row >= b.top && props.row <= b.bottom };
      },
      attrs: (state, { props, api }) => {
        const b = api.internal.modelOf(state).body ? api.internal.range.bounds(state) : null;
        return { 'aria-colindex': '1', 'data-selected': b && props.row >= b.top && props.row <= b.bottom ? '' : undefined };
      },
      on: { pointerdown: (event, { api, props }) => api.internal.headerPointerdown(event, 'row', props.row) },
    }),

    cell: slot<{ value: string; row: number; col: number }, SpreadsheetCellState>({
      role: 'gridcell',
      props: { value: 'string', row: 'number', col: 'number' },
      focus: 'roving',
      keys: [
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'mod+Home', 'mod+End', 'PageUp', 'PageDown',
        'mod+ArrowUp', 'mod+ArrowDown', 'mod+ArrowLeft', 'mod+ArrowRight',
        'shift+ArrowUp', 'shift+ArrowDown', 'shift+ArrowLeft', 'shift+ArrowRight', 'shift+Home', 'shift+End',
        'mod+shift+ArrowUp', 'mod+shift+ArrowDown', 'mod+shift+ArrowLeft', 'mod+shift+ArrowRight',
        'shift+ ', 'mod+ ', 'mod+a', 'Escape', 'Enter', 'F2', 'Delete', 'Backspace', 'mod+z', 'mod+shift+z', 'mod+y',
        'alt+ArrowLeft', 'alt+ArrowRight', 'typeahead',
      ],
      selects: selects<SpreadsheetState, unknown, { row: number; col: number }>({
        ...except('active', 'range', 'editing'),
        active: byCell,
        range: byCellRange,
        editing: ({ props }) => [cellKey(props)],
      }),
      state: (state, { props, api }) => ({
        active: api.internal.grid.isActive(state, props),
        selected: api.internal.range.contains(state, props),
        editing: state.editing === cellKey(props),
      }),
      attrs: (state, { props, api }) => ({
        tabindex: api.internal.grid.tabIndex(state, props),
        'aria-colindex': String(props.col + 2),
        'data-active': api.internal.grid.isActive(state, props) ? '' : undefined,
        'data-editing': state.editing === cellKey(props) ? '' : undefined,
        ...api.internal.range.cellAttrs(state, props),
      }),
      on: {
        // Focus that reaches a cell some other way, like Tab into the grid or a screen reader's cursor, makes it the active one.
        focus: (event, { el, api, props }) => {
          if (event.target === el && !api.internal.grid.isActive(api.internal.state(), props)) api.internal.grid.focus(props, { reason: 'imperative', event });
        },
        keydown: (event, { api, props }) => api.internal.cellKeydown(event, props),
        pointerdown: (event, { api, props }) => api.internal.cellPointerdown(event, props),
        dblclick: (event, { api, props }) => {
          api.internal.edit.dblclick(event, cellKey(props));
        },
      },
      bind: (el, { api, props }) => api.internal.range.bind(el, props),
    }),

    // The input over a cell or a title while it's edited.
    editor: slot({
      selects: selects<SpreadsheetState, unknown, object>(except('editing')),
      attrs: () => ({ autocomplete: 'off', spellcheck: 'false' }),
      on: {
        keydown: (event, { api }) => api.internal.editorKeydown(event),
        focusout: (event, { api }) => {
          api.internal.edit.end('focus-out', event);
        },
      },
      bind: (el, { api }) => api.internal.edit.bindInput(el as HTMLInputElement),
    }),

    // The status bar: the table's size, the sort, and the selection's sum and average.
    footer: slot<object, SpreadsheetFooterState>({
      selects: selects<SpreadsheetState, unknown, object>(except('value', 'header', 'active', 'range', 'sort', 'sorting')),
      state: (state, { api }) => {
        const { body, cols } = api.internal.modelOf(state);
        const sort = api.internal.orderOf(state);
        return {
          rows: body,
          columns: cols,
          stats: api.internal.stats(state),
          sort: sort ? { column: sort.column, direction: sort.direction, ranOn: sort.ranOn, ms: sort.ms, rows: sort.rows } : null,
          sortedBy: sort ? api.internal.title(state, sort.column) : null,
          sorting: state.sorting,
        };
      },
    }),
  }),
  agent: { actions: ['select', 'edit', 'paste', 'clear', 'copy', 'sort', 'undo', 'redo', 'addRow', 'setColumnWidths'] },
});
