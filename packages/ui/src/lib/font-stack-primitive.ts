import {
  createChange, createFocusRecovery, createReorder, createRovingFocus, definePrimitive, spatialMove,
  type ChangeDetails, type ReorderDraft, type ReorderReason,
} from '@ui-sdk/core';

/* ══ fontStackList — an ordered list of chips (a font stack), each with a handle that reorders it and a button that
   removes it: UI SDK's `createReorder` (drag a handle, or focus it, press Space or Enter, move with the arrows, and
   Space or Enter again to drop; Escape cancels; every step is announced) over `createRovingFocus` (the handles are one
   Tab stop; the arrows move between them while nothing is picked up). Delete or Backspace on a handle removes its
   chip, and `createFocusRecovery` hands focus to the handle that took its place (else the one before it, else
   `emptyFocus`). The chips
   wrap in rows, so moves and drops follow the grid.
   No React in here: render it with `createParts(fontStackList, { root: 'div', item: 'div', handle: 'button',
   remove: 'button' })`, the items in the root's `order`. ══ */

/** Why the stack changed: a drag or a keyboard move, a remove, or a call from code. */
export type FontStackReason = ReorderReason | 'remove-press' | 'delete-key';

export interface FontStackListOptions {
  /** The families, in order. Pass it to control them. */
  value?: string[];
  /** The families at first, when uncontrolled. */
  defaultValue?: string[];
  /** Runs when the order changes or a family is removed. */
  onValueChange?: (value: string[], details: ChangeDetails<FontStackReason>) => void;
  /** Nothing moves or goes. */
  disabled?: boolean;
  /** Where focus goes when the last family leaves while it holds focus (the list's own field: its "Add" button). */
  emptyFocus?: () => HTMLElement | null | undefined;
}

interface FontStackListState {
  value: string[];
  focused: string | null;
  moving: ReorderDraft | null;
  disabled: boolean;
}

export const fontStackList = definePrimitive({
  name: 'font-stack-list',
  options: { value: 'list', defaultValue: 'list', onValueChange: 'callback', disabled: 'boolean', emptyFocus: 'callback' },
  state: (options: FontStackListOptions): FontStackListState => ({
    value: options.value ?? options.defaultValue ?? [],
    focused: null,
    moving: null,
    disabled: !!options.disabled,
  }),
  sync: (options) => ({ ...(options.value === undefined ? {} : { value: options.value }), disabled: !!options.disabled }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const reorder = createReorder<FontStackListState>(context, {
      slot: 'item',
      key: 'value',
      draft: 'moving',
      set: (value, details) => change('value', value, details),
      orientation: () => 'grid',
      disabled: () => store.get().disabled,
    });
    const roving = createRovingFocus<FontStackListState, { value: string }>(context, {
      slot: 'handle',
      key: 'focused',
      move: spatialMove(),
    });
    // Where the chip that left stood, so focus can go to its neighbour.
    let removedAt = -1;
    const recovery = createFocusRecovery({
      fallback: (lost) => {
        // The list may unmount with its last chip before the store hears of it: leave the lost family out either way.
        const rest = store.get().value.filter((v) => v !== lost.key);
        const next = rest[Math.min(removedAt, rest.length - 1)];
        const handle = next === undefined ? null : context.element('handle', next);
        return handle?.isConnected ? handle : context.options().emptyFocus?.();
      },
    });
    const remove = (key: string, details: { reason: FontStackReason; event?: Event } = { reason: 'imperative' }) => {
      if (store.get().disabled) return false;
      const at = store.get().value.indexOf(key);
      if (at < 0) return false;
      removedAt = at;
      return change('value', store.get().value.filter((v) => v !== key), details);
    };
    return {
      reorder,
      roving,
      recovery,
      /** Takes a family out of the stack. */
      remove,
      /** Moves a family to a place in the stack, from 0. */
      move: (key: string, index: number) => reorder.move(key, index),
      handleKeydown(event: KeyboardEvent, el: HTMLElement, key: string) {
        if (reorder.keydown(event, key)) return;
        if ((event.key === 'Delete' || event.key === 'Backspace') && !store.get().moving) {
          event.preventDefault();
          remove(key, { reason: 'delete-key', event });
          return;
        }
        roving.keydown(event, el);
      },
    };
  },
  slots: (slot) => ({
    root: slot<object, { order: string[]; disabled: boolean }>({
      state: (state, { api }) => ({ order: api.reorder.order(state), disabled: state.disabled }),
      role: 'list',
      attrs: (state) => ({ 'data-disabled': state.disabled ? '' : undefined }),
    }),
    item: slot<{ value: string }, { dragging: boolean; moving: boolean }>({
      props: { value: 'string' },
      state: (state, part) => ({ dragging: part.api.reorder.dragging(state, part.key), moving: part.api.reorder.moving(state, part.key) }),
      role: 'listitem',
      attrs: (state, part) => ({
        'data-dragging': part.api.reorder.dragging(state, part.key) ? '' : undefined,
        'data-grabbed': state.moving?.key === part.key ? '' : undefined,
      }),
      bind: (el, part) => {
        const unbindReorder = part.api.reorder.bind(el, part);
        const unbindRecovery = part.api.recovery.bind(el, part);
        return () => {
          unbindReorder();
          unbindRecovery();
        };
      },
    }),
    handle: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: (state, part) => ({
        type: 'button',
        'aria-roledescription': 'sortable item',
        'aria-pressed': String(state.moving?.key === part.key),
        tabindex: part.api.roving.tabIndex(state, part),
        disabled: state.disabled ? '' : undefined,
        style: 'touch-action:none;user-select:none',
      }),
      on: {
        keydown: (event, { el, api, key }) => api.handleKeydown(event, el as HTMLElement, key),
        pointerdown: (event, { api, key }) => api.reorder.pointerdown(event, key),
      },
      bind: (el, part) => part.api.roving.bind(el, part),
    }),
    remove: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: (state) => ({ type: 'button', tabindex: '-1', disabled: state.disabled ? '' : undefined }),
      on: { pointerdown: (event) => event.preventDefault() },
      press: ({ api, key }, event) => { api.remove(key, { reason: 'remove-press', event }); },
    }),
  }),
  agent: { actions: ['move', 'remove'] },
});
