import { byCell, createGridFocus, definePrimitive, selects, type GridCell } from '@brett_lamy/ui/sdk/core';
import { createParts, usePart, type PartProps } from '@brett_lamy/ui/sdk/react/primitive';

type SeatMapState = { active: GridCell | null };
type SeatMapOptions = { rows: number; cols: number; taken: string[] };

const LETTERS = 'ABCD';
const seatName = ({ row, col }: GridCell) => `${LETTERS[row]}${col + 1}`;

/* A grid with one tab stop. createGridFocus moves the active cell with the arrows, Home/End (row ends),
   Control/Command+Home/End (corners) and Page Up/Down, skips the taken seats, and keeps the active seat marked
   (`isActive`) after focus leaves, so Tab back in lands where you were. */
const seatMap = definePrimitive({
  name: 'seat-map',
  options: { rows: 'number', cols: 'number', taken: 'list' },
  state: (_options: SeatMapOptions): SeatMapState => ({ active: null }),
  api: (context) => {
    const taken = (cell: GridCell) => context.options().taken.includes(seatName(cell));
    return {
      taken,
      grid: createGridFocus<SeatMapState>(context, {
        key: 'active',
        rows: () => context.options().rows,
        cols: () => context.options().cols,
        disabled: taken,
      }),
    };
  },
  slots: (slot) => ({
    root: slot<object, { active: GridCell | null }>({
      state: (state) => ({ active: state.active }),
    }),
    grid: slot({ attrs: () => ({ role: 'grid' }) }),
    row: slot<{ id: string }>({ props: { id: 'string' }, attrs: () => ({ role: 'row' }) }),
    seat: slot<{ id: string; row: number; col: number }>({
      props: { row: 'number', col: 'number' },
      selects: selects({ active: byCell }),
      attrs: (state, { props, api }) => ({
        role: 'gridcell',
        tabindex: api.grid.tabIndex(state, props),
        'aria-disabled': api.taken(props) ? 'true' : undefined,
        'data-disabled': api.taken(props) ? '' : undefined,
        'data-highlighted': api.grid.isActive(state, props) ? '' : undefined,
      }),
      on: {
        keydown: (event, { api }) => api.grid.keydown(event),
        pointerdown: (event, { api, props }) => api.grid.focus(props, { reason: 'item-press', event }),
      },
      bind: (el, { api, props }) => api.grid.bind(el, props),
    }),
  }),
  // Focus only: choosing a seat is the page's business.
  agent: { actions: [] },
});

const parts = createParts(seatMap, { root: 'div', grid: 'div', row: 'div' });

function Seat({ row, col, ...props }: { row: number; col: number } & PartProps<'div'>) {
  return usePart(seatMap, 'seat', { id: `${row}:${col}`, row, col }, props, 'div');
}

const TAKEN = ['A3', 'B2', 'B3', 'C5'];

export default function SeatGridDemo() {
  return (
    <parts.Root rows={3} cols={6} taken={TAKEN} className="mx-auto grid w-fit gap-3">
      {({ active }) => (
        <>
          <parts.Grid aria-label="Seats" className="grid gap-1.5 rounded-panel bg-card p-3 shadow-hairline">
            {[0, 1, 2].map((row) => (
              <parts.Row key={row} id={String(row)} className="flex gap-1.5">
                {[0, 1, 2, 3, 4, 5].map((col) => {
                  const name = seatName({ row, col });
                  return (
                    <Seat
                      key={col}
                      row={row}
                      col={col}
                      aria-label={TAKEN.includes(name) ? `Seat ${name}, taken` : `Seat ${name}`}
                      className="grid size-9 cursor-pointer place-items-center rounded-ctl bg-secondary text-footnote font-semibold text-secondary-foreground outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/45 data-disabled:cursor-default data-disabled:bg-transparent data-disabled:text-tertiary-foreground data-disabled:line-through data-highlighted:bg-primary data-highlighted:text-primary-foreground"
                    >
                      {name}
                    </Seat>
                  );
                })}
              </parts.Row>
            ))}
          </parts.Grid>
          <p className="m-0 text-footnote text-foreground/70" aria-live="polite">
            {active ? `Active seat: ${seatName(active)}` : 'Tab into the grid.'}
          </p>
        </>
      )}
    </parts.Root>
  );
}
