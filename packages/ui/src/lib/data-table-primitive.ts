import {
  createChange, createController, createGridFocus, css, definePrimitive, dispatch, isRTL, live, selects,
  type ChangeDetails, type GridCell, type GridFocusReason, type ResizeDraft,
} from '@ui-sdk/core';
import { createColumnResize, createVirtualRows, isRowPress, type ColumnResizeReason, type RowAlign } from '@/lib/grid-behaviors';
import type { RowId } from '@/lib/log-list-model';
import {
  columnTemplate, fieldSortValue, nextDataTableSort, sortDataTableRows, timeShare,
  type DataTableColumnSize, type DataTableSort, type DataTableSortValue, type DataTableTimeRange,
} from '@/lib/data-table-model';
import { bindSizeClass, type SizeClass, type SizeClassBreakpoints } from '@/lib/size-class';

/* ══ The data-table primitive: rows of one height under headers that sort and resize ══
   One tab stop, as APG's grid has it. The rows in view are rendered (`createVirtualRows`: UI SDK's virtualizer and grid
   focus, by row); with `focus: 'cell'` (the default) focus is on a cell of the active row, which ← → move along it and
   ↑ ↓ carry to the same column of the next row, so one value can be reached and read on its own. `focus: 'row'` keeps it
   on whole rows (stacked rows always are). The column headers are a row of their own on a second grid focus, reached
   with ↑ from the first row. Column widths are UI SDK's
   resize (`createColumnResize`): a drag keeps its width in a live draft, written to the grid's column template with no
   render, and asks for it once on release. The current time (for rows on a timeline) is live state too: its share of
   the time range and the rows after it, written straight to the page. The selected row, the sort and the widths are state
   a host can control.
   The table's own size class (`bindSizeClass`, on the root) decides its layout: stacked rows while it's compact, and
   the columns with a `hideBelow` class gone below it. The rows are given as they come; the primitive sorts them, and
   what to render (the rows in order, the columns shown) is the root's state.
   No React: `components/data-table.tsx` renders it. */

/** What a row needs to be one: an id that stays with it through sorts and new rows. */
export interface DataTableRow {
  id: RowId;
}

/** Why the selected row changed: a row was pressed, or code set it. */
export type DataTableValueChangeReason = 'item-press' | 'imperative';
/** Why the sort changed: a header was pressed (or Enter on it), an item of the sort menu, or code. */
export type DataTableSortChangeReason = 'trigger-press' | 'item-press' | 'imperative';
/** Why a column's width changed: its edge was dragged, a key moved it, a double press put it back, or code. */
export type DataTableColumnWidthsChangeReason = ColumnResizeReason;

/** What `onAction` receives besides the row's id. */
export type DataTableActionDetails<T extends DataTableRow = DataTableRow> = ChangeDetails<'item-press'> & { row: T; index: number };

/** A column as the primitive needs it: its size, whether it sorts, and by what. */
export interface DataTableColumnSpec extends DataTableColumnSize {
  sortable: boolean;
  sortValue?: (row: never) => DataTableSortValue;
}

/** Where the table's size classes start: `medium` (default 480 px) ends the stacked rows of `compact`, and `regular`
 *  (default 760 px) brings back the columns with `hideBelow: 'regular'`. */
export type DataTableBreakpoints = SizeClassBreakpoints;
const BREAKPOINTS = { medium: 480, regular: 760 } as const;
const RANK: Record<SizeClass, number> = { compact: 0, medium: 1, regular: 2 };

/** Drives a DataTable from outside it. Pass it as `controller`. */
export function createDataTableController() {
  return createController<{
    /** Focuses the active row, or the row focus would start on. */
    focus: () => void;
    /** Scrolls to a row by id: centered by default, or `auto` to move only if it's out of view. */
    scrollToId: (id: RowId, options?: { align?: RowAlign }) => void;
    /** Moves the current time with no render at all, for a clock's every tick. The `currentTime` prop takes over when it
     *  next changes. */
    setCurrentTime: (time: number | null) => void;
    /** Selects a row, or none with `null`. */
    setValue: (value: RowId | null) => boolean;
    /** Sorts by a column, or back to the rows' own order with `null`. */
    setSort: (sort: DataTableSort | null) => boolean;
    /** Sets the columns' widths, by id. A column with none keeps its own size. */
    setColumnWidths: (widths: Readonly<Record<string, number>>) => boolean;
  }>();
}

export type DataTableController = ReturnType<typeof createDataTableController>;

export type DataTableOptions<T extends DataTableRow = DataTableRow> = {
  /** The rows, in their own order. The primitive sorts them. */
  rows: readonly T[];
  /** Every column the table can show, in order. The ones shown depend on the table's size class. */
  columns: readonly DataTableColumnSpec[];
  /** A time on `timeRange`, in ms: rows whose `time` is later are the future (`data-future`), and the grid writes its
   *  share of the range (`--data-table-current-time`, `data-current-time`) for an overlay to draw a line at. The controller's
   *  `setCurrentTime` moves it in between changes of this. */
  currentTime?: number | null;
  /** The range the current time moves on, in ms. */
  timeRange?: DataTableTimeRange | null;
  /** `single` (default): a press selects the row. `none`: rows press (`onAction`) but are never selected. */
  mode?: 'single' | 'none';
  /** `cell` (default): the arrow keys move between cells. `row`: focus stays on whole rows, and ← → scroll sideways. */
  focus?: 'cell' | 'row';
  value?: RowId | null;
  defaultValue?: RowId | null;
  onValueChange?: (value: RowId | null, details: ChangeDetails<DataTableValueChangeReason>) => void;
  onAction?: (value: RowId, details: DataTableActionDetails<T>) => void;
  sort?: DataTableSort | null;
  defaultSort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null, details: ChangeDetails<DataTableSortChangeReason>) => void;
  columnWidths?: Readonly<Record<string, number>>;
  defaultColumnWidths?: Readonly<Record<string, number>>;
  onColumnWidthsChange?: (widths: Readonly<Record<string, number>>, details: ChangeDetails<DataTableColumnWidthsChangeReason>) => void;
  /** Every row's height in each layout, in px. */
  rowHeights: { table: number; stacked: number };
  /** The header's height, in px: the rows show below it. */
  headerHeight: number;
  /** Where the table's own size classes start. */
  breakpoints?: DataTableBreakpoints;
  /** `auto` goes to stacked rows while the table is compact; `table` and `stacked` stay as they are. */
  layout?: 'auto' | 'table' | 'stacked';
  controller?: DataTableController;
};

export type DataTableState = {
  /** The rows in the order they show. */
  rows: readonly DataTableRow[];
  count: number;
  value: RowId | null;
  sort: DataTableSort | null;
  columnWidths: Readonly<Record<string, number>>;
  /** The width each column shows in the page, for its separator's value while none is set. */
  measured: Readonly<Record<string, number>>;
  /** The active row. */
  active: GridCell | null;
  /** The active cell's column in the active row, from 0, with `focus: 'cell'`. */
  col: number;
  /** The active column header. */
  header: GridCell | null;
  /** The columns shown, in order. */
  columns: readonly DataTableColumnSpec[];
  /** The table's own size class, once it's measured. */
  sizeClass: SizeClass | null;
  /** Stacked rows: `layout="stacked"`, or `auto` while the table is compact. */
  stacked: boolean;
  /** Live: a column's edge while a pointer drags it, the current time, the range and the view's height. */
  draft: ResizeDraft | null;
  currentTime: number | null;
  range: DataTableTimeRange | null;
  view: number;
  /** Live: a count of the rows' layouts, which places them and sizes their box. */
  layout: number;
};

/** What a row's `render` functions and state-based class names receive. */
export type DataTableRowState = { selected: boolean; active: boolean };

/** What the root's children and class names receive: what the whole table renders from. */
export type DataTableRootState = {
  sort: DataTableSort | null;
  /** The rows in the order they show. */
  rows: readonly DataTableRow[];
  /** The columns shown, in order: the size class has left out the ones with a larger `hideBelow`. */
  columns: readonly DataTableColumnSpec[];
  sizeClass: SizeClass | null;
  /** Stacked rows, which have no column headers. */
  stacked: boolean;
};

const byRow = {
  values: ({ props }: { props: { index: number } }) => [String(props.index)],
  moved(previous: GridCell | null | undefined, next: GridCell | null | undefined, notify: (name: string) => void) {
    if (previous) notify(String(previous.row));
    if (next) notify(String(next.row));
  },
};

/** A cell reads the active row by its own row, so a move reaches the rows it leaves and lands on. */
const byCellRow = {
  values: ({ props }: { props: { row?: number } }) => [String(props.row ?? -1)],
  moved: byRow.moved,
};

/** State a part doesn't read, so a change to it doesn't reach the part. */
const UNPLACED = { rows: [], count: [], value: [], sort: [], columnWidths: [], measured: [], active: [], col: [], header: [], columns: [], sizeClass: [], stacked: [] };
const NOTHING = { ...UNPLACED, draft: [], currentTime: [], range: [], view: [], layout: [] };

const NO_WIDTHS: Readonly<Record<string, number>> = {};
const SCROLL_STEP = 48;

/** The rows in the order a sort says, by the sorted column's own `sortValue` or the row's field of that name. */
function sortBy(rows: readonly DataTableRow[], sort: DataTableSort | null, columns: readonly DataTableColumnSpec[]): readonly DataTableRow[] {
  const by = sort && (columns.find((column) => column.id === sort.column)?.sortValue as ((row: DataTableRow) => DataTableSortValue) | undefined);
  return sortDataTableRows(rows, sort, by ?? fieldSortValue);
}

/** The columns a size class shows: a column with `hideBelow` only from that class up. Before it's measured, all of them. */
function shownColumns(columns: readonly DataTableColumnSpec[], sizeClass: SizeClass | null): readonly DataTableColumnSpec[] {
  if (sizeClass === null) return columns;
  return columns.filter((column) => !column.hideBelow || RANK[sizeClass] >= RANK[column.hideBelow]);
}

export const dataTable = definePrimitive({
  name: 'data-table',
  options: {
    value: 'value', defaultValue: 'value', onValueChange: 'callback', onAction: 'callback',
    sort: 'value', defaultSort: 'value', onSortChange: 'callback',
    columnWidths: 'value', defaultColumnWidths: 'value', onColumnWidthsChange: 'callback',
    rows: 'value', columns: 'value', currentTime: 'value', timeRange: 'value', mode: 'string', focus: 'string', rowHeights: 'value', headerHeight: 'number', breakpoints: 'value', layout: 'string', controller: 'value',
  },
  controlled: ['value', 'sort', 'columnWidths'],
  live: ['draft', 'currentTime', 'range', 'view', 'layout'],
  state: (options: DataTableOptions): DataTableState => {
    const sort = options.sort ?? options.defaultSort ?? null;
    const rows = sortBy(options.rows, sort, options.columns);
    return {
      rows,
      count: rows.length,
      value: options.value ?? options.defaultValue ?? null,
      sort,
      columnWidths: options.columnWidths ?? options.defaultColumnWidths ?? NO_WIDTHS,
      measured: NO_WIDTHS,
      active: null,
      col: 0,
      header: null,
      columns: shownColumns(options.columns, null),
      sizeClass: null,
      stacked: options.layout === 'stacked',
      draft: null,
      currentTime: options.currentTime ?? null,
      range: options.timeRange ?? null,
      view: 0,
      layout: 0,
    };
  },
  sync: (options) => ({
    range: options.timeRange ?? null,
    ...(options.value === undefined ? {} : { value: options.value }),
    ...(options.sort === undefined ? {} : { sort: options.sort }),
    ...(options.columnWidths === undefined ? {} : { columnWidths: options.columnWidths }),
  }),
  api: (context) => {
    const { store, options } = context;
    const change = createChange(context);
    let scroller: HTMLElement | undefined;

    /* ── The layout: the size class, the columns it shows, the rows' height ── */

    const isStacked = (sizeClass: SizeClass | null) => {
      const { layout = 'auto' } = options();
      return layout === 'stacked' || (layout === 'auto' && sizeClass === 'compact');
    };
    const rowHeightOf = (state: Pick<DataTableState, 'stacked'>) => options().rowHeights[state.stacked ? 'stacked' : 'table'];
    let rowHeight = rowHeightOf(store.get());

    const rows = createVirtualRows<DataTableRow, DataTableState>(context, {
      row: { slot: 'row', selector: '[data-slot=data-table-row]' },
      units: '[data-slot=data-table-column]',
      estimate: () => rowHeight,
      overscan: 14,
      scrollMargin: options().headerHeight,
      preferred: (): number[] => {
        const { value } = store.get();
        return [value === null ? -1 : rows.indexOf(value)];
      },
    });
    const { virtual } = rows;
    context.onDestroy(virtual.subscribe(() => store.set({ layout: store.get().layout + 1 })));

    /** What the root renders, from the rows and columns given, the sort and the size class: sorted again only when one of
     *  those changed, and the columns kept as they were while the same ones show. A new sort starts from the selected
     *  row, or the top; new rows' heights keep the row at the top of the view where it is. */
    let sortedFrom: { rows: readonly DataTableRow[]; columns: readonly DataTableColumnSpec[]; sort: DataTableSort | null } = {
      rows: options().rows, columns: options().columns, sort: store.get().sort,
    };
    const refresh = (patch: Partial<Pick<DataTableState, 'sort' | 'sizeClass'>> = {}) => {
      const state = { ...store.get(), ...patch };
      state.stacked = isStacked(state.sizeClass);
      const { rows: given, columns: all } = options();
      const resorted = sortedFrom.rows !== given || sortedFrom.columns !== all || sortedFrom.sort !== state.sort;
      const sortChanged = sortedFrom.sort !== state.sort;
      const next = resorted ? sortBy(given, state.sort, all) : state.rows;
      sortedFrom = { rows: given, columns: all, sort: state.sort };
      const shown = shownColumns(all, state.sizeClass);
      const columns = shown.length === state.columns.length && shown.every((column, i) => column === state.columns[i]) ? state.columns : shown;
      const height = rowHeightOf(state);
      const anchor = height === rowHeight ? undefined : rows.anchor().index;
      rows.setRows(next);
      const at = state.header;
      store.set({
        ...patch,
        stacked: state.stacked,
        rows: next,
        count: next.length,
        columns,
        ...(at && at.col >= columns.length ? { header: columns.length ? { row: 0, col: columns.length - 1 } : null } : {}),
      });
      if (anchor !== undefined) {
        rowHeight = height;
        virtual.reset();
        rows.scrollTo(anchor, 'start');
      }
      if (sortChanged) {
        const { value } = store.get();
        const index = value === null ? -1 : rows.indexOf(value);
        if (index >= 0) rows.scrollTo(index, 'center');
        else rows.scrollTo(0, 'start');
      }
    };
    rows.setRows(store.get().rows);

    /** A new selection from outside comes into view. A press's row is in view already. */
    const reveal = (value: RowId | null) => {
      const index = value === null ? -1 : rows.indexOf(value);
      if (index >= 0 && !rows.isVisible(index)) rows.scrollTo(index, 'center');
    };

    let given = { currentTime: options().currentTime, value: options().value };
    context.onOptions((next, synced) => {
      const was = given;
      given = { currentTime: next.currentTime, value: next.value };
      if (next.currentTime !== was.currentTime) store.set({ currentTime: next.currentTime ?? null });
      refresh(synced && 'sort' in synced ? { sort: synced.sort } : {});
      if (next.value !== was.value && next.value !== undefined) reveal(next.value);
    });

    /** The root's size class, on the table's own breakpoints. */
    let root: HTMLElement | undefined;
    let breakpoints: string | undefined;
    let stopSizeClass: (() => void) | undefined;
    const bindRoot = () => {
      const { medium = BREAKPOINTS.medium, regular = BREAKPOINTS.regular } = options().breakpoints ?? {};
      if (!root || breakpoints === `${medium},${regular}`) return;
      breakpoints = `${medium},${regular}`;
      stopSizeClass?.();
      stopSizeClass = bindSizeClass(root, {
        breakpoints: { medium, regular },
        onChange: (sizeClass) => {
          if (sizeClass !== store.get().sizeClass) refresh({ sizeClass });
        },
      });
    };
    context.onOptions(() => {
      bindRoot();
    });

    /* ── The headers ── */

    const columnAt = (col: number) => store.get().columns[col];
    const header = createGridFocus<DataTableState>(context, {
      key: 'header',
      rows: () => 1,
      cols: () => store.get().columns.length,
    });
    // Stacked rows have no column headers to be on.
    const focusHeader = (event?: Event, col?: number) => {
      const { columns, header: at } = store.get();
      if (store.get().stacked || !columns.length) return false;
      header.focus({ row: 0, col: Math.min(col ?? at?.col ?? 0, columns.length - 1) }, { reason: event ? 'list-navigation' : 'imperative', event });
      return true;
    };

    const resize = createColumnResize<DataTableState>(context, {
      widths: (state) => state.columnWidths,
      draft: 'draft',
      set: (widths, details) => change('columnWidths', widths, details),
      limits: (id) => {
        const column = store.get().columns.find((c) => c.id === id);
        return { min: column?.minWidth ?? 40, max: column?.maxWidth };
      },
      measure: (id) => context.element('column', id)?.getBoundingClientRect().width,
      shown: { key: 'measured' },
    });

    /** Sorts by a column, the other way if it's sorted by it already, and then not at all; `null` for no sort. */
    const setSort = (sort: DataTableSort | null, details: { reason: DataTableSortChangeReason; event?: Event }) => {
      const done = change('sort', sort, details);
      // An uncontrolled sort is the store's now; a controlled one comes back through the options.
      if (store.get().sort !== sortedFrom.sort) refresh();
      return done;
    };
    const sortColumn = (id: string | null, details: { reason: DataTableSortChangeReason; event?: Event }) =>
      setSort(id === null ? null : nextDataTableSort(store.get().sort, id), details);

    /* ── Rows and their cells ── */

    /** Focus is on cells: `focus: 'cell'`, in a table (stacked rows are one cell each) with columns. */
    const cellFocus = (state: Pick<DataTableState, 'stacked' | 'columns'> = store.get()) =>
      (options().focus ?? 'cell') === 'cell' && !state.stacked && state.columns.length > 0;
    /** The active cell's column, kept in the columns shown. */
    const colOf = (state: Pick<DataTableState, 'col' | 'columns'>) => Math.max(0, Math.min(state.col, state.columns.length - 1));
    const cellIn = (row: HTMLElement | undefined, col: number) =>
      row?.querySelector<HTMLElement>(`:scope > [data-slot=data-table-cell][aria-colindex="${col + 1}"]`) ?? undefined;
    /** Moves the active cell to a column of a row: in the active row at once, else through the row's focus, which hands it
     *  on to the cell (`bindRow`). */
    const focusCell = (index: number, col: number, details: { reason: GridFocusReason; event?: Event }) => {
      const { columns, active } = store.get();
      const to = Math.max(0, Math.min(col, columns.length - 1));
      if (store.get().col !== to) store.set({ col: to });
      if (active?.row === index) cellIn(rows.rowElement(index), to)?.focus();
      else rows.focusRow(index, details);
    };

    const press = (index: number, event?: Event) => {
      const row = rows.all[index];
      if (!row) return;
      rows.setActive(index);
      if (options().mode !== 'none') change('value', row.id, { reason: 'item-press', event });
      dispatch(context, 'onAction', row.id, { reason: 'item-press', event, row, index });
    };

    /** The keys on a cell: ← → along the row, ↑ ↓ and Page Up/Down to the same column of another row, Home and End to the
     *  row's ends (with Control or Command, the grid's first and last rows), Enter or Space to press the row. */
    const cellKeydown = (event: KeyboardEvent, index: number, col: number) => {
      if (event.key === 'Tab') {
        rows.tab.keydown(event);
        return;
      }
      if (event.defaultPrevented || event.altKey) return;
      const mod = event.ctrlKey || event.metaKey;
      const last = store.get().columns.length - 1;
      const forward = (event.key === 'ArrowRight') !== isRTL(event.target as Element);
      const nav = { reason: 'list-navigation' as const, event };
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
          if (mod) return;
          focusCell(index, col + (forward ? 1 : -1), nav);
          break;
        case 'Home':
        case 'End':
          if (mod) focusCell(event.key === 'Home' ? 0 : rows.all.length - 1, col, nav);
          else focusCell(index, event.key === 'Home' ? 0 : last, nav);
          break;
        case 'ArrowUp':
          if (mod) return;
          if (index === 0) focusHeader(event, col);
          else focusCell(index - 1, col, nav);
          break;
        case 'ArrowDown':
        case 'PageUp':
        case 'PageDown':
          if (mod) return;
          // The rows' grid focus moves by row (and by a page); the row hands focus on to the cell in this column.
          rows.grid.keydown(event);
          return;
        case 'Enter':
        case ' ':
          if (mod || event.shiftKey) return;
          press(index, event);
          break;
        default:
          return;
      }
      event.preventDefault();
    };

    const headerKeydown = (event: KeyboardEvent, col: number) => {
      const column = columnAt(col);
      if (!column) return;
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
          if (event.altKey) {
            resize.nudge(column.id, (event.key === 'ArrowRight') !== isRTL(event.target as Element) ? 1 : -1, event.shiftKey, event);
            event.preventDefault();
          } else header.keydown(event);
          return;
        case 'Home':
        case 'End':
          header.keydown(event);
          return;
        case 'Enter':
        case ' ':
          if (column.sortable) sortColumn(column.id, { reason: 'trigger-press', event });
          break;
        case 'ArrowDown':
        case 'Escape': {
          if (!rows.all.length) return;
          // Down from a header lands in its column.
          if (cellFocus() && store.get().col !== col) store.set({ col });
          const at = store.get().active?.row;
          if (at !== undefined && cellFocus()) focusCell(at, col, { reason: 'list-navigation', event });
          else rows.focus();
          break;
        }
        default:
          return;
      }
      event.preventDefault();
    };

    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const column = target.closest?.('[data-slot=data-table-column]');
      if (column && !event.defaultPrevented && event.key !== 'Tab') {
        if (target === column) headerKeydown(event, Number(column.getAttribute('aria-colindex')) - 1);
        return;
      }
      if (cellFocus()) {
        const cell = target.closest?.('[data-slot=data-table-cell]') as HTMLElement | null | undefined;
        const index = rows.indexFrom(target);
        if (cell && index >= 0) {
          if (cell === target) cellKeydown(event, index, Number(cell.getAttribute('aria-colindex')) - 1);
          // Escape from a control in a cell goes back to the cell; Tab goes on through the row's controls and out.
          else if (event.key === 'Escape' && !event.defaultPrevented) {
            cell.focus();
            event.preventDefault();
          } else if (event.key === 'Tab') rows.tab.keydown(event);
          return;
        }
      }
      // ↑ from the first row, or in a table with none, goes up to the headers.
      const plain = !event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey;
      if (plain && event.key === 'ArrowUp' && (target === scroller || rows.indexFrom(target) === 0 && target.matches('[data-slot=data-table-row]'))) {
        if (focusHeader(event)) {
          event.preventDefault();
          return;
        }
      }
      const index = rows.keydown(event);
      if (index === undefined || event.altKey || event.metaKey || event.ctrlKey) return;
      switch (event.key) {
        case 'Enter':
        case ' ':
          press(index, event);
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
          scroller?.scrollBy({ left: (event.key === 'ArrowRight') !== isRTL(target) ? SCROLL_STEP : -SCROLL_STEP });
          break;
        default:
          return;
      }
      event.preventDefault();
    };

    /** The view's height, for the current time's line. */
    const measure = (el: HTMLElement) => {
      if (el.clientHeight !== store.get().view) store.set({ view: el.clientHeight });
    };

    return {
      focus: () => rows.focus(),
      scrollToId(id: RowId, { align = 'center' }: { align?: RowAlign } = {}) {
        rows.scrollTo(rows.indexOf(id), align);
      },
      setCurrentTime: (time: number | null) => store.set({ currentTime: time }),
      setValue: (value: RowId | null) => change('value', value, { reason: 'imperative' }),
      setSort: (sort: DataTableSort | null) => setSort(sort, { reason: 'imperative' }),
      setColumnWidths: (widths: Readonly<Record<string, number>>) => change('columnWidths', widths, { reason: 'imperative' }),
      internal: {
        rows,
        resize,
        header,
        rowHeight: (state: DataTableState) => rowHeightOf(state),
        selectable: () => options().mode !== 'none',
        cellFocus,
        /** A cell's `tabindex` with cell focus: `"0"` for the active cell, `"-1"` for the others. Undefined otherwise. */
        cellTabIndex(state: DataTableState, row: number | undefined, col: number): '0' | '-1' | undefined {
          if (!cellFocus(state) || col < 1 || row === undefined) return undefined;
          return state.active?.row === row && colOf(state) === col - 1 ? '0' : '-1';
        },
        /** Joins a rendered row: its grid focus, and with cell focus, focus on the row handed on to the active column's
         *  cell, and a cell focused some other way (a press, a screen reader's cursor) made the active one. */
        bindRow(el: HTMLElement, index: number): () => void {
          const unbind = rows.bindRow(el, index);
          const onFocus = (event: FocusEvent) => {
            if (event.target === el && cellFocus()) cellIn(el, colOf(store.get()))?.focus();
          };
          const onFocusIn = (event: FocusEvent) => {
            const cell = (event.target as Element).closest?.('[data-slot=data-table-cell]');
            if (!cell || cell.parentElement !== el || !cellFocus()) return;
            const col = Number(cell.getAttribute('aria-colindex')) - 1;
            if (store.get().active?.row !== index) rows.setActive(index);
            if (col >= 0 && store.get().col !== col) store.set({ col });
          };
          el.addEventListener('focus', onFocus);
          el.addEventListener('focusin', onFocusIn);
          return () => {
            el.removeEventListener('focus', onFocus);
            el.removeEventListener('focusin', onFocusIn);
            unbind();
          };
        },
        headerHeight: () => options().headerHeight,
        sortBy: sortColumn,
        click(index: number, el: HTMLElement | undefined, event?: Event) {
          if (!el || isRowPress(event, el)) press(index, event);
        },
        /** The column template, from the widths as they show now, the dragged one included. */
        template: (state: DataTableState) => columnTemplate(state.columns, resize.widths(state)),
        currentTimeShare: (state: DataTableState) => (state.range ? timeShare(state.currentTime, state.range) : null),
        keydown,
        connectRoot(el: HTMLElement): () => void {
          root = el;
          bindRoot();
          return () => {
            stopSizeClass?.();
            stopSizeClass = undefined;
            breakpoints = undefined;
            if (root === el) root = undefined;
          };
        },
        connect(el: HTMLElement): () => void {
          scroller = el;
          const disconnect = rows.connect(el);
          measure(el);
          // `defaultValue` only counts here, at the start.
          reveal(store.get().value);
          const Observer = el.ownerDocument.defaultView?.ResizeObserver;
          const sizes = Observer ? new Observer(() => measure(el)) : undefined;
          sizes?.observe(el);
          return () => {
            sizes?.disconnect();
            disconnect();
            if (scroller === el) scroller = undefined;
          };
        },
      },
    };
  },
  slots: (slot) => ({
    root: slot<Record<never, never>, DataTableRootState>({
      selects: selects({ count: [], value: [], columnWidths: [], measured: [], active: [], header: [], draft: [], currentTime: [], range: [], view: [], layout: [] }),
      state: (state) => ({
        sort: state.sort, rows: state.rows, columns: state.columns, sizeClass: state.sizeClass, stacked: state.stacked,
      }),
      attrs: (state) => ({ 'data-layout': state.stacked ? 'stacked' : 'table' }),
      bind: (el, { api }) => api.internal.connectRoot(el),
    }),

    grid: slot({
      role: 'grid',
      keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' ', 'Tab', 'Escape'],
      selects: selects({ rows: [], value: [], sort: [], measured: [], header: [], layout: [] }),
      attrs: (state, { api }) => ({
        'aria-rowcount': String(state.count + 1),
        tabindex: api.internal.rows.gridTabIndex(state, state.count),
      }),
      // The column template follows a dragged edge, and the current time's line moves, with no render.
      live: live((state, { api }) => {
        const { template, minWidth } = api.internal.template(state);
        const share = api.internal.currentTimeShare(state);
        return {
          'data-current-time': share === null ? undefined : '',
          style: css({
            '--data-table-row': `${api.internal.rowHeight(state)}px`,
            '--data-table-header': `${api.internal.headerHeight()}px`,
            '--data-table-cols': template,
            '--data-table-min-width': `${minWidth}px`,
            '--data-table-view': `${state.view}px`,
            '--data-table-current-time': share === null ? undefined : String(share),
          }),
        };
      }),
      on: { keydown: (event, { api }) => api.internal.keydown(event) },
      bind: (el, { api }) => api.internal.connect(el),
    }),

    // The header's row, which stays at the top as the rows scroll.
    head: slot({ role: 'rowgroup', selects: selects(NOTHING) }),
    header: slot({ role: 'row', selects: selects(NOTHING), attrs: () => ({ 'aria-rowindex': '1' }) }),

    // A header and its edge are keyed by their `value`, the column's id.
    column: slot<{ value: string; index: number; sortable: boolean }>({
      role: 'columnheader',
      props: { value: 'string', index: 'number', sortable: 'boolean' },
      selects: selects({ rows: [], count: [], value: [], columnWidths: [], measured: [], active: [], columns: [], sizeClass: [], stacked: [], draft: [], currentTime: [], range: [], view: [], layout: [] }),
      attrs: (state, { props, api }) => {
        const sorted = state.sort?.column === props.value ? state.sort.direction : null;
        return {
          tabindex: '-1',
          'aria-colindex': String(props.index + 1),
          'aria-sort': sorted ?? (props.sortable ? 'none' : undefined),
          'data-column': props.value,
          'data-active': api.internal.header.isActive(state, { row: 0, col: props.index }) ? '' : undefined,
        };
      },
      on: {
        // A press on the column's edge is the resizer's.
        click: (event, { api, props }) => {
          if (!props.sortable || (event.target as Element).closest?.('[data-slot=data-table-resizer]')) return;
          api.internal.sortBy(props.value, { reason: 'trigger-press', event });
        },
      },
      bind: (el, { api, props }) => api.internal.header.bind(el, { row: 0, col: props.index }),
    }),

    resizer: slot<{ value: string }>({
      role: 'separator',
      props: { value: 'string' },
      selects: selects({ rows: [], count: [], value: [], sort: [], active: [], header: [], sizeClass: [], stacked: [], currentTime: [], range: [], view: [], layout: [] }),
      attrs: (state, { props, api }) => api.internal.resize.handleAttrs(state, props.value),
      live: live((state, { props, api }) => ({ 'data-dragging': api.internal.resize.dragging(state, props.value) ? '' : undefined })),
      on: {
        pointerdown: (event, { el, api, props }) => {
          if (el) api.internal.resize.pointerdown(event, props.value, el);
        },
        keydown: (event, { api, props }) => {
          api.internal.resize.keydown(event, props.value);
        },
        dblclick: (event, { api, props }) => {
          api.internal.resize.reset(props.value, event);
        },
      },
      // The width its header shows, for its value while none is set.
      bind: (el, { api, props }) => api.internal.resize.follow(props.value, el.closest<HTMLElement>('[data-slot=data-table-column]')),
    }),

    // The stacked layout's header: a count and the sort menu, with no column to be on.
    heading: slot({ role: 'columnheader', selects: selects(NOTHING) }),

    rows: slot({
      role: 'rowgroup',
      selects: selects({ ...UNPLACED, draft: [], currentTime: [], range: [], view: [] }),
      live: live((_state, { api }) => ({ style: css({ height: `${api.internal.rows.virtual.size()}px` }) })),
    }),

    row: slot<{ index: number; value: RowId; time: number | null }, DataTableRowState>({
      role: 'row',
      props: { index: 'number', value: 'value', time: 'value' },
      selects: selects({
        rows: [], count: [], sort: [], columnWidths: [], measured: [], header: [], columns: [], sizeClass: [], stacked: [], draft: [], range: [], view: [], layout: [],
        value: ({ props }) => [props.value],
        active: byRow,
      }),
      state: (state, { props, api }) => ({
        selected: state.value === props.value,
        active: api.internal.rows.isActive(state, props.index),
      }),
      attrs: (state, { props, api }) => {
        const selected = state.value === props.value;
        return {
          tabindex: api.internal.cellFocus(state) ? '-1' : api.internal.rows.tabIndex(state, props.index),
          'aria-rowindex': String(props.index + 2),
          'aria-selected': api.internal.selectable() ? String(selected) : undefined,
          'data-index': String(props.index),
          'data-selected': selected ? '' : undefined,
          'data-active': api.internal.rows.isActive(state, props.index) ? '' : undefined,
        };
      },
      // Sent after the current time: dimmed as the future, whatever order the rows are sorted in.
      live: live((state, { props }) => ({
        'data-future': state.currentTime !== null && props.time !== null && props.time > state.currentTime ? '' : undefined,
      })),
      press: ({ api, props, el }, event) => api.internal.click(props.index, el, event),
      bind: (el, { api, props }) => api.internal.bindRow(el, props.index),
    }),

    // `col` counts from 1, or is 0 in stacked rows, whose cells aren't columns. `row` is its row's index, from the row.
    cell: slot<{ col: number; row?: number }>({
      role: 'gridcell',
      props: { col: 'number', row: { kind: 'number', from: 'row.index' } },
      // With cell focus, a cell is the tab stop; the grid's keydown moves it. Else focus stays on the row.
      focus: (state, { api }) => (api.internal.cellFocus(state) ? 'roving' : { none: 'Focus stays on the row.' }),
      keys: { none: 'The grid handles the keys, for a cell and its row alike.' },
      selects: selects({
        rows: [], count: [], value: [], sort: [], columnWidths: [], measured: [], header: [], sizeClass: [], draft: [], currentTime: [], range: [], view: [], layout: [],
        active: byCellRow,
      }),
      attrs: (state, { props, api }) => {
        const tabindex = api.internal.cellTabIndex(state, props.row, props.col);
        return {
          'aria-colindex': props.col > 0 ? String(props.col) : undefined,
          tabindex,
          'data-active': tabindex === '0' ? '' : undefined,
        };
      },
    }),

    // Drawn over the rows, sticky to the view, like the current time's line. It's for sighted users only: what it shows
    // has to be said another way too (the dimmed future rows say where the current time is).
    overlay: slot({ selects: selects(NOTHING), attrs: () => ({ 'aria-hidden': 'true' }) }),

    // Above the grid, outside the scroller: a summary, filters, actions.
    toolbar: slot({ selects: selects(NOTHING) }),

    empty: slot({ present: (state) => state.count === 0 }),

    footer: slot({ selects: selects(NOTHING) }),
  }),
  agent: { actions: ['setValue', 'setSort', 'setColumnWidths', 'scrollToId'] },
});
