import { useState } from 'react';
import {
  announce,
  byCell,
  byCellRange,
  cellsToText,
  createCellRange,
  createGridFocus,
  definePrimitive,
  selects,
  textToCells,
  type CellRange,
  type GridCell,
} from '@ui-sdk/core';
import { createParts, usePart, type PartProps } from '@ui-sdk/react/primitive';
import { Button, buttonVariants } from '@/components/ui/button';

type SheetState = { active: GridCell | null; range: CellRange | null; cells: string[][] };
type SheetOptions = { onCopy?: (text: string) => void; onCellsChange?: (cells: string[][]) => void };

const START = [
  ['Tea', '3', '12'],
  ['Coffee', '4', '9'],
  ['Cake', '5', '4'],
  ['', '', ''],
];
const ROWS = START.length;
const COLS = START[0].length;
const HEADERS = ['Item', 'Price', 'Sold'];

/* A small sheet. createGridFocus moves the active cell; createCellRange adds the block on top: drag across cells,
   Shift+arrows, Shift+Space (rows), Control+Space (columns), Control+A, Escape. The grid's own `copy` and `paste`
   events carry the block as tab-separated text, so it round-trips with a spreadsheet: `range.text` writes it,
   `textToCells` reads it back. */
const sheet = definePrimitive({
  name: 'price-sheet',
  options: { onCopy: 'callback', onCellsChange: 'callback' },
  state: (_options: SheetOptions): SheetState => ({ active: null, range: null, cells: START }),
  api: (context) => {
    const { store } = context;
    const grid = createGridFocus<SheetState>(context, { key: 'active', rows: () => ROWS, cols: () => COLS });
    const range = createCellRange<SheetState>(context, { key: 'range', grid, rows: () => ROWS, cols: () => COLS });
    const write = (cells: string[][]) => {
      store.set({ cells });
      context.options().onCellsChange?.(cells);
    };
    return {
      grid,
      range,
      copy(event: ClipboardEvent) {
        const state = store.get();
        if (!range.bounds(state)) return;
        const text = range.text(state, ({ row, col }) => state.cells[row][col]);
        event.preventDefault();
        event.clipboardData?.setData('text/plain', text);
        context.options().onCopy?.(text);
      },
      paste(event: ClipboardEvent) {
        const state = store.get();
        const bounds = range.bounds(state);
        if (!bounds) return;
        event.preventDefault();
        const cells = state.cells.map((row) => [...row]);
        textToCells(event.clipboardData?.getData('text/plain') ?? '').forEach((values, r) =>
          values.forEach((value, c) => {
            const row = bounds.top + r;
            const col = bounds.left + c;
            if (row < ROWS && col < COLS) cells[row][col] = value; // stop at the sheet's edges
          }),
        );
        write(cells);
      },
      /** Every cell, selected or not, through the async Clipboard API. */
      async copyAll() {
        const text = cellsToText(store.get().cells);
        context.options().onCopy?.(text);
        try {
          await navigator.clipboard.writeText(text);
          announce('Sheet copied');
        } catch {
          announce('Copy was blocked', { priority: 'assertive' });
        }
      },
      reset: () => write(START),
    };
  },
  slots: (slot) => ({
    root: slot<object, { cells: string[][]; total: number }>({
      state: (state, { api }) => {
        let total = 0;
        state.cells.forEach((row, r) => {
          const price = Number(row[1]) || 0;
          const sold = Number(row[2]) || 0;
          if (api.range.contains(state, { row: r, col: 1 }) || api.range.contains(state, { row: r, col: 2 })) total += price * sold;
        });
        return { cells: state.cells, total };
      },
    }),
    grid: slot({
      attrs: () => ({ role: 'grid' }),
      on: {
        copy: (event, { api }) => api.copy(event as ClipboardEvent),
        paste: (event, { api }) => api.paste(event as ClipboardEvent),
      },
    }),
    row: slot<{ id: string }>({ props: { id: 'string' }, attrs: () => ({ role: 'row' }) }),
    cell: slot<{ id: string; row: number; col: number }>({
      props: { row: 'number', col: 'number' },
      selects: selects({ active: byCell, range: byCellRange }),
      attrs: (state, { props, api }) => ({
        role: 'gridcell',
        tabindex: api.grid.tabIndex(state, props),
        ...api.range.cellAttrs(state, props),
      }),
      on: {
        keydown: (event, { api }) => api.range.keydown(event),
        pointerdown: (event, { api, props }) => api.range.pointerdown(event, props),
      },
      bind: (el, { api, props }) => api.range.bind(el, props),
    }),
    copyAll: slot({ attrs: () => ({ type: 'button' }), press: ({ api }) => void api.copyAll() }),
  }),
  agent: { actions: ['reset'] },
});

const parts = createParts(sheet, { root: 'div', grid: 'div', row: 'div', copyAll: 'button' });

function Cell({ row, col, ...props }: { row: number; col: number } & PartProps<'div'>) {
  return usePart(sheet, 'cell', { id: `${row}:${col}`, row, col }, props, 'div');
}

export default function CellRangeDemo() {
  const [copied, setCopied] = useState('');
  const [key, setKey] = useState(0);
  return (
    <parts.Root key={key} onCopy={(text) => setCopied(text)} className="mx-auto grid w-full max-w-sm gap-3">
      {({ cells, total }) => (
        <>
          <parts.Grid
            aria-label="Prices"
            className="grid touch-none overflow-hidden rounded-panel bg-card shadow-hairline select-none"
          >
            <div role="row" className="grid grid-cols-3 bg-secondary text-caption font-semibold text-foreground/70">
              {HEADERS.map((h) => (
                <span key={h} role="columnheader" className="px-3 py-1.5">
                  {h}
                </span>
              ))}
            </div>
            {cells.map((values, r) => (
              <parts.Row key={r} id={String(r)} className="grid grid-cols-3">
                {values.map((value, c) => (
                  <Cell
                    key={c}
                    row={r}
                    col={c}
                    className="flex h-row items-center px-3 text-body text-foreground shadow-hairline-b outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:ring-inset data-selected:bg-primary/15"
                  >
                    {value}
                  </Cell>
                ))}
              </parts.Row>
            ))}
          </parts.Grid>
          <div className="flex flex-wrap items-center gap-2">
            <parts.CopyAll className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Copy whole sheet</parts.CopyAll>
            <Button variant="ghost" size="sm" onClick={() => setKey((k) => k + 1)}>
              Reset
            </Button>
          </div>
          <p className="m-0 text-footnote text-foreground/70" aria-live="polite">
            Selected revenue: {total}. {copied ? `Copied ${JSON.stringify(copied)}` : 'Select cells and press Command or Control+C.'}
          </p>
        </>
      )}
    </parts.Root>
  );
}
