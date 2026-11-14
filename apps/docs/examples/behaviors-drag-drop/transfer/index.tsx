import { useState } from 'react';
import {
  createChange,
  createRovingFocus,
  createTransfer,
  definePrimitive,
  spatialMove,
  type ChangeDetails,
  type TransferDraft,
  type TransferLists,
  type TransferReason,
} from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';

const NAMES: Record<string, string> = { closet: 'Closet', bag: 'Bag' };

type PackingState = { lists: TransferLists; focused: string | null; moving: TransferDraft | null };
type PackingOptions = {
  defaultLists: TransferLists;
  onListsChange?: (lists: TransferLists, details: ChangeDetails<TransferReason>) => void;
};

/* Two lists, one set of keys. createTransfer drags a copy of the item (the original stays put, marked
   data-dragging), scrolls near edges, and commits on drop. With the keyboard: Space picks an item up, Left and Right
   change lists, Up and Down place it, Space drops it, Escape cancels. Focus moves between the lists by layout
   (spatialMove) while nothing is picked up. */
const packing = definePrimitive({
  name: 'packing',
  options: { defaultLists: 'value', onListsChange: 'callback' },
  state: (options: PackingOptions): PackingState => ({ lists: options.defaultLists, focused: null, moving: null }),
  api: (context) => {
    const change = createChange(context);
    const transfer = createTransfer<PackingState>(context, {
      key: 'lists',
      draft: 'moving',
      set: (value, details) => change('lists', value, details),
      order: () => ['closet', 'bag'],
      listLabel: (list) => NAMES[list],
    });
    return {
      roving: createRovingFocus<PackingState, { value: string }>(context, { slot: 'item', key: 'focused', move: spatialMove() }),
      transfer,
      /** Move an item to a list right away (reason "imperative"). */
      moveItem: (key: string, list: string, index: number) => transfer.move(key, list, index),
    };
  },
  slots: (slot) => ({
    root: slot<object, { lists: TransferLists }>({ state: (state, { api }) => ({ lists: api.transfer.lists(state) }) }),
    list: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: () => ({ role: 'listbox' }),
      bind: (el, { api, key }) => api.transfer.bindList(el, key),
    }),
    item: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: (state, part) => ({
        role: 'option',
        'aria-selected': String(state.moving?.key === part.key),
        tabindex: part.api.roving.tabIndex(state, part),
        'data-grabbed': part.api.transfer.moving(state, part.key) ? '' : undefined,
        'data-dragging': part.api.transfer.dragging(state, part.key) ? '' : undefined,
      }),
      on: {
        keydown: (event, { el, api, key }) => api.transfer.keydown(event, key) || api.roving.keydown(event, el!),
        pointerdown: (event, { api, key }) => api.transfer.pointerdown(event, key),
      },
      bind: (el, part) => {
        const cleanups = [part.api.roving.bind(el, part), part.api.transfer.bindItem(el, part.key)];
        return () => cleanups.forEach((cleanup) => cleanup());
      },
    }),
  }),
  agent: { actions: ['moveItem'] },
});

const parts = createParts(packing, { root: 'div', list: 'div', item: 'div' });

export default function TransferDemo() {
  const [status, setStatus] = useState('');
  return (
    <div className="mx-auto grid w-full max-w-md gap-3">
      <parts.Root
        defaultLists={{ closet: ['Jacket', 'Boots', 'Scarf'], bag: ['Passport', 'Charger'] }}
        onListsChange={(lists, details) =>
          setStatus(`Bag: ${lists.bag.join(', ') || 'empty'} (${details.reason})`)
        }
        className="grid grid-cols-2 gap-3"
      >
        {({ lists }) =>
          Object.entries(lists).map(([list, items]) => (
            <div key={list} className="grid content-start gap-1.5">
              <span className="px-1 text-caption font-semibold text-foreground/70 uppercase">{NAMES[list]}</span>
              <parts.List
                value={list}
                aria-label={NAMES[list]}
                className="grid min-h-32 content-start gap-1.5 rounded-panel bg-secondary p-1.5"
              >
                {items.map((item) => (
                  <parts.Item
                    key={item}
                    value={item}
                    className="flex h-row cursor-grab touch-none items-center rounded-ctl bg-card px-3 text-body text-foreground shadow-hairline outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/45 data-grabbed:ring-2 data-grabbed:ring-primary data-dragging:opacity-40 data-[drag-preview]:shadow-lg"
                  >
                    {item}
                  </parts.Item>
                ))}
              </parts.List>
            </div>
          ))
        }
      </parts.Root>
      <p className="m-0 text-footnote text-foreground/70" aria-live="polite">
        {status || 'Drag an item between the lists, or press Space on one.'}
      </p>
    </div>
  );
}
