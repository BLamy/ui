import {
  announce, byCell, createChange, createGridFocus, css, definePrimitive, live, selects,
  type ChangeDetails, type GridCell, type ResizeDraft,
} from '@ui-sdk/core';
import { createColumnResize, createTabStop, type ColumnResizeReason } from '@/lib/grid-behaviors';

/* ══ The result-table primitive: a grid of query results, one cell at a time ══
   One tab stop on UI SDK's grid focus: the arrow keys move between cells (the headers are its first row), Home and End
   go to a row's ends, and with Ctrl or ⌘ to the grid's corners. `createTabStop` keeps it one stop though cells hold an
   expand button: Tab goes from a cell through its button and on out of the grid, and Escape from the button comes back
   to its cell. Column widths are UI SDK's resize (`createColumnResize`). No React: `components/result-table.tsx`
   renders it. */

/** Why a column's width changed: its edge was dragged, a key moved it, a double press put it back, or code. */
export type ResultTableColumnWidthsChangeReason = ColumnResizeReason;

export type ResultTableOptions = {
  /** Rows shown, not counting the headers. */
  rows: number;
  cols: number;
  /** Lets column edges resize. */
  resizable?: boolean;
  columnWidths?: Readonly<Record<string, number>>;
  defaultColumnWidths?: Readonly<Record<string, number>>;
  onColumnWidthsChange?: (widths: Readonly<Record<string, number>>, details: ChangeDetails<ResultTableColumnWidthsChangeReason>) => void;
  /** The result shown, and how long its query took: a new one (by identity) is read out as `summary`. */
  result?: object;
  durationMs?: number;
  /** What a screen reader hears when a new result arrives ("12 rows · 4 ms"). The first result is only shown. */
  summary?: string;
};

export type ResultTableState = {
  rows: number;
  cols: number;
  /** The active cell. Row 0 is the headers. */
  active: GridCell | null;
  columnWidths: Readonly<Record<string, number>>;
  /** Live: a column's edge while a pointer drags it. */
  draft: ResizeDraft | null;
  /** The width each column shows in the page, for the separators' value while none is set. */
  measured: Readonly<Record<string, number>>;
};

const NO_WIDTHS: Readonly<Record<string, number>> = {};
const UNITS = '[data-slot=result-table-cell],[data-slot=result-table-column]';
const NOTHING = { rows: [], cols: [], active: [], columnWidths: [], draft: [], measured: [] };

/** A cell's key, as `byCell` names it. */
const keyOf = ({ row, col }: GridCell) => `${row}:${col}`;

export const resultTable = definePrimitive({
  name: 'result-table',
  options: {
    rows: 'number', cols: 'number', resizable: 'boolean',
    columnWidths: 'value', defaultColumnWidths: 'value', onColumnWidthsChange: 'callback',
    result: 'value', durationMs: 'number', summary: 'string',
  },
  controlled: ['columnWidths'],
  live: ['draft'],
  state: (options: ResultTableOptions): ResultTableState => ({
    rows: options.rows,
    cols: options.cols,
    active: null,
    columnWidths: options.columnWidths ?? options.defaultColumnWidths ?? NO_WIDTHS,
    draft: null,
    measured: NO_WIDTHS,
  }),
  sync: (options) => ({
    rows: options.rows,
    cols: options.cols,
    ...(options.columnWidths === undefined ? {} : { columnWidths: options.columnWidths }),
  }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const grid = createGridFocus<ResultTableState>(context, {
      key: 'active',
      rows: () => store.get().rows + 1,
      cols: () => store.get().cols,
    });
    const elementOf = (cell: GridCell) => context.element(cell.row === 0 ? 'column' : 'cell', keyOf(cell));
    const tab = createTabStop({
      units: UNITS,
      active: () => {
        const { active } = store.get();
        return active ? elementOf(active) : undefined;
      },
      enter: () => grid.focus(store.get().active ?? { row: 0, col: 0 }, { reason: 'imperative' }),
    });
    const resize = createColumnResize<ResultTableState>(context, {
      widths: (state) => state.columnWidths,
      draft: 'draft',
      set: (widths, details) => change('columnWidths', widths, details),
      limits: () => ({ min: 48 }),
      measure: (column) => context.element('column', `0:${column}`)?.getBoundingClientRect().width,
      shown: { key: 'measured' },
    });

    // A new result is read out through UI SDK's announcer; the one the table starts with is just shown.
    let spoken = { result: context.options().result, durationMs: context.options().durationMs };
    context.onOptions(({ result, durationMs, summary }) => {
      if (result === spoken.result && durationMs === spoken.durationMs) return;
      spoken = { result, durationMs };
      if (summary) announce(summary);
    });

    return {
      setColumnWidths: (widths: Readonly<Record<string, number>>) => change('columnWidths', widths, { reason: 'imperative' }),
      internal: {
        grid,
        resize,
        keydown(event: KeyboardEvent) {
          if (event.defaultPrevented || tab.keydown(event)) return;
          const target = event.target as HTMLElement;
          const unit = target.closest?.(UNITS) as HTMLElement | null | undefined;
          if (!unit) return;
          const cell = { row: Number(unit.getAttribute('data-row')), col: Number(unit.getAttribute('data-col')) };
          if (unit !== target) {
            // From the expand button, back to its cell.
            if (event.key === 'Escape') {
              grid.focus(cell, { reason: 'list-navigation', event });
              event.preventDefault();
            }
            return;
          }
          const { col } = cell;
          if (event.altKey && unit.matches('[data-slot=result-table-column]') && context.options().resizable && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            resize.nudge(String(col), event.key === 'ArrowRight' ? 1 : -1, event.shiftKey, event);
            event.preventDefault();
            return;
          }
          grid.keydown(event);
        },
        connect: (el: HTMLElement) => tab.bind(el),
      },
    };
  },
  slots: (slot) => ({
    root: slot({ selects: selects(NOTHING) }),

    grid: slot({
      role: 'grid',
      keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Tab', 'Escape'],
      selects: selects({ active: [], columnWidths: [], draft: [], measured: [] }),
      attrs: (state) => ({ 'aria-rowcount': String(state.rows + 1), 'aria-colcount': String(state.cols) }),
      on: { keydown: (event, { api }) => api.internal.keydown(event) },
      bind: (el, { api }) => api.internal.connect(el),
    }),

    row: slot<{ row: number }>({
      role: 'row',
      props: { row: 'number' },
      selects: selects(NOTHING),
      attrs: (_state, { props }) => ({ 'aria-rowindex': String(props.row + 1) }),
    }),

    // A header. It's the grid's row 0, so ↑ from the first row reaches it.
    // Header cells and cells are keyed by their `value`, `"row:col"`, which `byCell` and `elementOf` read back.
    column: slot<{ value: string; row: number; col: number }>({
      role: 'columnheader',
      props: { value: 'string', row: 'number', col: 'number' },
      focus: 'roving',
      selects: selects({ rows: [], cols: [], active: byCell, measured: [] }),
      attrs: (state, { props, api }) => ({
        tabindex: api.internal.grid.tabIndex(state, props),
        'aria-colindex': String(props.col + 1),
        'data-row': String(props.row),
        'data-col': String(props.col),
        'data-active': api.internal.grid.isActive(state, props) ? '' : undefined,
      }),
      // A width that's set, the dragged one included, holds the column to it.
      live: live((state, { props, api }) => {
        const width = api.internal.resize.width(state, String(props.col));
        return { style: css({ width: width === undefined ? undefined : `${width}px`, 'max-width': width === undefined ? undefined : 'none' }) };
      }),
      on: { pointerdown: (event, { api, props }) => api.internal.grid.focus(props, { reason: 'item-press', event }) },
      bind: (el, { api, props }) => api.internal.grid.bind(el, props),
    }),

    // Keyed by the column it resizes.
    resizer: slot<{ value: string }>({
      role: 'separator',
      props: { value: 'string' },
      selects: selects({ rows: [], cols: [], active: [] }),
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
      // The width its header cell shows, for its value while none is set.
      bind: (el, { api, props }) => api.internal.resize.follow(props.value, el.closest<HTMLElement>('[data-slot=result-table-column]')),
    }),

    cell: slot<{ value: string; row: number; col: number }>({
      role: 'gridcell',
      props: { value: 'string', row: 'number', col: 'number' },
      focus: 'roving',
      selects: selects({ rows: [], cols: [], active: byCell, columnWidths: [], draft: [], measured: [] }),
      attrs: (state, { props, api }) => ({
        tabindex: api.internal.grid.tabIndex(state, props),
        'aria-colindex': String(props.col + 1),
        'data-row': String(props.row),
        'data-col': String(props.col),
        'data-active': api.internal.grid.isActive(state, props) ? '' : undefined,
      }),
      on: { pointerdown: (event, { api, props }) => api.internal.grid.focus(props, { reason: 'item-press', event }) },
      bind: (el, { api, props }) => api.internal.grid.bind(el, props),
    }),
  }),
  agent: { actions: ['setColumnWidths'] },
});
