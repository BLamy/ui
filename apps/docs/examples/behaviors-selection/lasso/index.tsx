import { useState } from 'react';
import { createChange, createLasso, definePrimitive, live, type ChangeDetails, type LassoDraft } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';

type ShapesState = { selected: string[]; lasso: LassoDraft | null };
type ShapesOptions = {
  onSelectedChange?: (selected: string[], details: ChangeDetails<'lasso' | 'imperative'>) => void;
};

/* Rectangle selection on a canvas. createLasso tracks a drag that starts on empty space, previews the shapes it
   touches (`touches`, written as data-lassoed through a live binding, so a pointer move re-renders nothing), and
   commits once on release with reason "lasso". Shift adds to the selection; Escape cancels the drag. */
const shapes = definePrimitive({
  name: 'lasso-canvas',
  options: { onSelectedChange: 'callback' },
  state: (_options: ShapesOptions): ShapesState => ({ selected: [], lasso: null }),
  live: ['lasso'],
  api: (context) => {
    const change = createChange(context);
    return {
      lasso: createLasso<ShapesState>(context, {
        slot: 'shape',
        draft: 'lasso',
        selected: () => context.store.get().selected,
        set: (keys, details) => change('selected', keys, details),
        message: (count) => `${count} ${count === 1 ? 'shape' : 'shapes'} selected`,
      }),
      setSelected: (keys: string[]) => change('selected', keys, { reason: 'imperative' }),
    };
  },
  slots: (slot) => ({
    root: slot({
      attrs: () => ({ role: 'group' }),
      on: { pointerdown: (event, { el, api }) => event.target === el && api.lasso.pointerdown(event, el!) },
    }),
    shape: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: (state, { key }) => ({ role: 'img', 'data-selected': state.selected.includes(key) ? '' : undefined }),
      live: live<ShapesState, any, { value: string }>((state, { key, api }) => ({
        'data-lassoed': api.lasso.touches(state, key) ? '' : undefined,
      })),
    }),
    band: slot({
      attrs: () => ({ 'aria-hidden': 'true' }),
      live: live<ShapesState, any, object>((state, { api }) => ({ style: api.lasso.style(state) })),
    }),
  }),
  agent: { actions: ['setSelected'] },
});

const parts = createParts(shapes, { root: 'div', shape: 'div', band: 'div' });

const ITEMS = [
  { key: 'Circle', x: 24, y: 24, round: true },
  { key: 'Square', x: 134, y: 36, round: false },
  { key: 'Dot', x: 70, y: 124, round: true },
  { key: 'Tile', x: 206, y: 112, round: false },
];

export default function LassoDemo() {
  const [status, setStatus] = useState('Drag from empty space.');
  return (
    <div className="mx-auto grid w-fit gap-3">
      <parts.Root
        aria-label="Shapes"
        onSelectedChange={(selected, details) => setStatus(`Selected (${details.reason}): ${selected.join(', ') || 'none'}`)}
        className="relative h-48 w-72 touch-none overflow-hidden rounded-panel bg-card shadow-hairline select-none"
      >
        {ITEMS.map((item) => (
          <parts.Shape
            key={item.key}
            value={item.key}
            aria-label={item.key}
            style={{ left: item.x, top: item.y }}
            className={`absolute size-12 bg-secondary-strong ${item.round ? 'rounded-full' : 'rounded-ctl'} data-lassoed:ring-2 data-lassoed:ring-ring/45 data-selected:bg-primary`}
          />
        ))}
        <parts.Band className="pointer-events-none absolute rounded-ctl bg-primary/15 ring-1 ring-primary" />
      </parts.Root>
      <p className="m-0 text-footnote text-foreground/70" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
