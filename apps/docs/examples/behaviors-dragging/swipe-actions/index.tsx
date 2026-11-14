import { useState } from 'react';
import {
  createRovingFocus,
  createSwipeActions,
  definePrimitive,
  live,
  selects,
  type SwipeDraft,
  type SwipeOpen,
  type SwipeSide,
} from '@ui-sdk/core';
import { createParts, usePart, type PartProps } from '@ui-sdk/react/primitive';
import { Button } from '@/components/ui/button';

type RowsState = { open: SwipeOpen | null; swiping: SwipeDraft | null; focused: string | null };

/* Mail-style rows. createSwipeActions slides a row's content aside to reveal the actions behind it, keeps one row
   open at a time, waits for a horizontal move so vertical scrolling still works, and settles open or closed on
   release (a flick counts). From the keyboard, Left on a focused row opens its end actions and focuses the first;
   Escape closes it and returns focus to the row. Hidden actions are inert. */
const rows = definePrimitive({
  name: 'swipe-rows',
  state: (): RowsState => ({ open: null, swiping: null, focused: null }),
  live: ['swiping'],
  api: (context) => {
    const swipe = createSwipeActions<RowsState>(context, { key: 'open', draft: 'swiping' });
    return {
      roving: createRovingFocus<RowsState, { value: string }>(context, { slot: 'row', key: 'focused' }),
      swipe,
      /** Reveal a row's actions, or close the open row. */
      showActions: (key: string) => swipe.show(key, 'end'),
      closeActions: () => swipe.close(),
    };
  },
  slots: (slot) => ({
    root: slot({ attrs: () => ({ role: 'list' }) }),
    row: slot<{ value: string }>({
      props: { value: 'string' },
      selects: selects({ focused: ({ key }) => [key, null] }),
      attrs: (state, part) => ({
        role: 'listitem',
        tabindex: part.api.roving.tabIndex(state, part),
        'data-open': state.open?.key === part.key ? state.open.side : undefined,
      }),
      on: {
        pointerdown: (event, { el, api, key }) => api.swipe.pointerdown(event, key, el!),
        keydown: (event, { el, api, key }) =>
          api.swipe.keydown(event, key) || (event.target === el && api.roving.keydown(event, el!)),
      },
      bind: (el, part) => {
        const cleanups = [part.api.roving.bind(el, part), part.api.swipe.bindRow(el, part.key)];
        return () => cleanups.forEach((cleanup) => cleanup());
      },
    }),
    content: slot<{ value: string }>({
      props: { value: 'string' },
      live: live<RowsState, any, { value: string }>((state, { api, key }) => api.swipe.contentAttrs(state, key)),
    }),
    actions: slot<{ id: string; row: string; side: SwipeSide }>({
      props: { row: 'string', side: 'string' },
      attrs: (state, { props, api }) => api.swipe.actionsAttrs(state, props.row, props.side),
      bind: (el, { props, api }) => api.swipe.bindActions(el, props.row, props.side),
    }),
  }),
  agent: { actions: ['showActions', 'closeActions'] },
});

const parts = createParts(rows, { root: 'div', row: 'div', content: 'div' });

function Actions({ row, side, ...props }: { row: string; side: SwipeSide } & PartProps<'div'>) {
  return usePart(rows, 'actions', { id: `${row}-${side}`, row, side }, props, 'div');
}

const START = ['Team lunch on Friday', 'Your invoice is ready', 'New comment on the docs', 'Weekly digest'];

export default function SwipeActionsDemo() {
  const [items, setItems] = useState(START);
  return (
    <div className="mx-auto grid w-full max-w-sm gap-3">
      <parts.Root aria-label="Messages" className="grid overflow-hidden rounded-panel bg-card shadow-hairline">
        {items.map((item) => (
          <parts.Row
            key={item}
            value={item}
            className="relative touch-pan-y overflow-hidden shadow-hairline-b outline-none last:shadow-none focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:ring-inset"
          >
            <parts.Content
              value={item}
              className="relative z-10 flex h-row translate-x-[var(--swipe-x,0px)] items-center bg-card px-4 text-body text-foreground transition-transform duration-spring-snappy ease-spring-snappy select-none data-swiping:transition-none motion-reduce:transition-none"
            >
              {item}
            </parts.Content>
            <Actions row={item} side="end" className="absolute inset-y-0 end-0 flex">
              <Button
                variant="destructive"
                tabIndex={-1}
                onClick={() => setItems((list) => list.filter((other) => other !== item))}
                className="h-full rounded-none px-5"
              >
                Delete
              </Button>
            </Actions>
          </parts.Row>
        ))}
        {items.length ? null : <p className="m-0 px-4 py-3 text-footnote text-foreground/70">No messages.</p>}
      </parts.Root>
      <p className="m-0 text-footnote text-foreground/70">Swipe a row left, or focus it and press Left.</p>
    </div>
  );
}
