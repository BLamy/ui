import { useId, useState } from 'react';
import {
  createChange,
  createReorder,
  createRovingFocus,
  definePrimitive,
  type ChangeDetails,
  type ReorderDraft,
  type ReorderReason,
} from '@brett_lamy/ui/sdk/core';
import { createParts } from '@brett_lamy/ui/sdk/react/primitive';

type RankingState = { value: string[]; focused: string | null; moving: ReorderDraft | null };
type RankingOptions = {
  defaultValue: string[];
  onValueChange?: (value: string[], details: ChangeDetails<ReorderReason>) => void;
};

/* A sortable list. createReorder keeps a draft while an item moves and commits it once, on drop: drag a row, or
   focus one, press Space or Enter to pick it up, move it with the arrows (Home/End for the ends), and press Space
   or Enter again to drop it. Escape cancels; screen readers hear the pickup, each move and the drop. The arrows
   only reach roving focus while nothing is picked up, because the reorder handler runs first. */
const ranking = definePrimitive({
  name: 'ranking',
  options: { defaultValue: 'list', onValueChange: 'callback' },
  state: (options: RankingOptions): RankingState => ({ value: options.defaultValue, focused: null, moving: null }),
  api: (context) => {
    const change = createChange(context);
    const reorder = createReorder<RankingState>(context, {
      slot: 'item',
      key: 'value',
      draft: 'moving',
      set: (value, details) => change('value', value, details),
    });
    return {
      roving: createRovingFocus<RankingState, { value: string }>(context, { slot: 'item', key: 'focused' }),
      reorder,
      /** Move an item to an index right away (reason "imperative"): for a menu's "Move to top", or an agent. */
      moveItem: (key: string, index: number) => reorder.move(key, index),
    };
  },
  slots: (slot) => ({
    root: slot<object, { order: string[] }>({
      state: (state, { api }) => ({ order: api.reorder.order(state) }),
      attrs: () => ({ role: 'listbox', 'aria-roledescription': 'sortable list' }),
    }),
    item: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: (state, part) => ({
        role: 'option',
        'aria-roledescription': 'sortable item',
        'aria-selected': String(state.moving?.key === part.key),
        tabindex: part.api.roving.tabIndex(state, part),
        'data-grabbed': state.moving?.key === part.key ? '' : undefined,
        'data-dragging': part.api.reorder.dragging(state, part.key) ? '' : undefined,
      }),
      on: {
        keydown: (event, { el, api, key }) => api.reorder.keydown(event, key) || api.roving.keydown(event, el!),
        pointerdown: (event, { api, key }) => api.reorder.pointerdown(event, key),
      },
      bind: (el, part) => {
        const cleanups = [part.api.roving.bind(el, part), part.api.reorder.bind(el, part)];
        return () => cleanups.forEach((cleanup) => cleanup());
      },
    }),
  }),
  agent: { actions: ['moveItem'] },
});

const parts = createParts(ranking, { root: 'div', item: 'div' });

export default function SortableDemo() {
  const [status, setStatus] = useState('');
  const help = useId();
  return (
    <div className="mx-auto grid w-full max-w-xs gap-3">
      <parts.Root
        aria-label="Favorite seasons"
        defaultValue={['Spring', 'Summer', 'Autumn', 'Winter']}
        onValueChange={(value, details) => setStatus(`${value.join(', ')} (${details.reason})`)}
        className="grid gap-1.5"
      >
        {({ order }) =>
          order.map((season, index) => (
            <parts.Item
              key={season}
              value={season}
              aria-describedby={help}
              className="flex h-row cursor-grab touch-none items-center gap-3 rounded-ctl bg-card px-4 text-body text-foreground shadow-hairline outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/45 data-grabbed:relative data-grabbed:z-10 data-grabbed:translate-x-(--drag-x) data-grabbed:translate-y-(--drag-y) data-grabbed:bg-secondary data-dragging:cursor-grabbing"
            >
              <span aria-hidden className="w-4 text-footnote text-foreground/70 tabular-nums">{index + 1}</span>
              {season}
            </parts.Item>
          ))
        }
      </parts.Root>
      <p id={help} className="m-0 text-footnote text-foreground/70">
        Drag a season, or press Space to pick it up, the arrows to move it and Space to drop it.
      </p>
      <p className="m-0 text-footnote text-foreground/70" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
