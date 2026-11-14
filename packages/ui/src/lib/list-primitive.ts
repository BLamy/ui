import {
  animateIn, animateOut, createChange, createController, createReorder, createSwipeActions, definePrimitive, live,
  type ChangeDetails, type ReorderDraft, type ReorderReason, type SwipeDraft, type SwipeOpen, type SwipeSide,
} from '@ui-sdk/core';

/* ══ The list primitives: a row with swipe actions, and a section that reorders its rows ══
   `listRow` is one iOS table row: content that slides aside on UI SDK's `createSwipeActions` to the actions under
   it (a long swipe runs the outermost one, a destructive one slides the row away and collapses it), Left/Right to
   reach them from the keyboard, Escape to close, Delete for a destructive action. `listSection` is the section
   around rows: a `list` of `listitem`s that can grow in and collapse out (`animateIn`/`animateOut`) and be
   reordered by a grip on UI SDK's `createReorder` (drag it, or Space to pick up, arrows, Space to drop), with
   its announcements. No React: `components/list.tsx` renders both. */

/** The one key a row's swipe behavior keeps: every row is its own instance. */
const ROW = 'row';

/** A swipe action. In `leadingActions` / `trailingActions`, index 0 is the outermost button (nearest the screen
 *  edge): the one a full swipe runs. */
export interface ListRowAction<Icon = unknown> {
  label: string;
  /** An icon name from the kit's set (`trash`, `mail`, `starF`, …) or any node; drawn above the label. */
  icon?: Icon;
  /** Background color (any CSS color). Default: red when destructive, else the tint. */
  tint?: string;
  /** Destructive actions slide the row away and collapse it before `onAction` runs (swipe to delete). */
  destructive?: boolean;
  onAction: (details: ListRowActionDetails) => void;
}

/** How an action ran: its button, a full swipe, or the Delete key on the row. */
export type ListRowActionReason = 'action-press' | 'full-swipe' | 'delete-key';
export type ListRowActionDetails = { reason: ListRowActionReason; event?: Event };

/** Which side may run its outermost action with a long swipe. */
export type ListRowFullSwipe = boolean | 'leading' | 'trailing';

/** Drives a ListRow's actions from outside it. Pass it as `controller`. */
export function createListRowController() {
  return createController<{
    /** Opens the actions on a side; with `focus`, the first one takes focus. */
    show: (side: 'leading' | 'trailing', options?: { focus?: boolean }) => boolean;
    /** Closes the open actions; with `focus`, the row takes focus back. */
    close: (options?: { focus?: boolean }) => boolean;
  }>();
}
export type ListRowController = ReturnType<typeof createListRowController>;

export type ListRowOptions = {
  leadingActions?: ListRowAction[];
  trailingActions?: ListRowAction[];
  fullSwipe?: ListRowFullSwipe;
  /** Edit mode: the row doesn't swipe. */
  edit?: boolean;
  /** Without a press target, a press on the row flips the switch or checkbox inside it. */
  labelToggles?: boolean;
  /** Return true to ignore swipe starts near an edge (under a back-gesture zone). */
  isEdge?: (clientX: number) => boolean;
  /** The row is focusable as a group (it has actions but no press target). */
  group?: boolean;
  controller?: ListRowController;
};

export type ListRowState = {
  open: SwipeOpen | null;
  swiping: SwipeDraft | null;
  /** A destructive action is sliding the row away: where to, and the height it collapses from. */
  removing: { x: number; height: number } | null;
  group: boolean;
  /** It has actions on either side. */
  swipeable: boolean;
};

const sideOf = (side: 'leading' | 'trailing'): SwipeSide => (side === 'leading' ? 'start' : 'end');
/** The rows whose actions are open, in every list on the page: opening one closes the others, as on iOS. */
const openRows = new Set<() => void>();
// Controls in the row and the reorder grip keep their own gestures.
const OWN_GESTURES = '[data-row-control],[data-slot=list-section-handle]';
const TOGGLES = '[data-row-control] input[type=checkbox], [data-row-control] [role=switch]';
const INTERACTIVE = 'button,input,select,textarea,a[href],label,[role=switch],[role=slider],[role=checkbox],[data-slot=slider]';

const synced = (options: ListRowOptions) => ({
  group: !!options.group,
  swipeable: !!(options.leadingActions?.length || options.trailingActions?.length),
});

export const listRow = definePrimitive({
  name: 'list-row',
  options: {
    leadingActions: 'value', trailingActions: 'value', fullSwipe: 'value', edit: 'boolean', labelToggles: 'boolean',
    isEdge: 'value', group: 'boolean', controller: 'value',
  },
  state: (options: ListRowOptions): ListRowState => ({ open: null, swiping: null, removing: null, ...synced(options) }),
  sync: (options) => synced(options),
  live: ['swiping', 'removing'],
  api: (context) => {
    const actions = (side: SwipeSide) =>
      (side === 'start' ? context.options().leadingActions : context.options().trailingActions) ?? [];
    const canFull = (side: SwipeSide) => {
      const f = context.options().fullSwipe ?? true;
      return f === true || (f !== false && sideOf(f) === side);
    };
    let leave = () => {};
    context.onDestroy(() => leave());

    // Slides the row off its side and collapses it (its exit, on `data-ending-style`), then runs the action, which
    // removes the row. With reduced motion nothing transitions, so the action runs at once.
    const dismiss = (side: SwipeSide, action: ListRowAction, details: ListRowActionDetails) => {
      const el = context.element('root');
      const current = swipe.offset(context.store.get(), ROW);
      const sign = Math.sign(current) || (side === 'start' ? 1 : -1);
      context.store.set({ removing: { x: sign * (el?.offsetWidth ?? 320), height: el?.offsetHeight ?? 0 } });
      if (!el) return action.onAction(details);
      // The measured height (live, written above) is where the collapse starts: settle it before the exit begins.
      void getComputedStyle(el).height;
      leave = animateOut(el, () => action.onAction(details));
    };
    const run = (side: SwipeSide, action: ListRowAction, details: ListRowActionDetails) => {
      if (action.destructive) return dismiss(side, action, details);
      action.onAction(details);
      swipe.close({ focus: details.reason !== 'full-swipe' });
    };

    const swipe = createSwipeActions<ListRowState>(context, {
      key: 'open',
      draft: 'swiping',
      fullSwipe: () => 0.55,
      disabled: () => {
        const o = context.options();
        return !!o.edit || !!context.store.get().removing || (!o.leadingActions?.length && !o.trailingActions?.length);
      },
      onFullSwipe: (_key, side, { event }) => {
        const first = actions(side)[0];
        if (!first || !canFull(side)) return false;
        run(side, first, { reason: 'full-swipe', event });
        return true;
      },
    });
    context.onOptions((options) => { if (options.edit) swipe.close(); });

    // A press that swiped, or that landed on an open row (which only closes it), doesn't click what it ends on.
    let swallow = false;
    return {
      swipe,
      canFull,
      show: (side: 'leading' | 'trailing', options?: { focus?: boolean }) => swipe.show(ROW, sideOf(side), options),
      close: (options?: { focus?: boolean }) => swipe.close(options),
      internal: {
        pointerdown(event: PointerEvent, el: HTMLElement) {
          if (event.button) return;
          const target = event.target as HTMLElement;
          if (target.closest(OWN_GESTURES) || context.options().isEdge?.(event.clientX)) return;
          swallow = !!swipe.open() && !target.closest('[data-slot=list-row-actions]');
          swipe.pointerdown(event, ROW, el);
        },
        swiped() { swallow = true; },
        click(event: MouseEvent) {
          if (!swallow) return;
          swallow = false;
          event.preventDefault();
          event.stopPropagation();
        },
        keydown(event: KeyboardEvent, el: HTMLElement) {
          const target = event.target as HTMLElement;
          const self = target === el.querySelector('[data-list-row-focus]');
          if (!self && !target.closest('[data-slot=list-row-actions]')) return;
          if (swipe.keydown(event, ROW)) return;
          if (self && (event.key === 'Delete' || event.key === 'Backspace')) {
            const action = actions('end').find((a) => a.destructive);
            if (!action || context.store.get().removing) return;
            event.preventDefault();
            run('end', action, { reason: 'delete-key', event });
          }
        },
        press(side: SwipeSide, index: number, event?: Event) {
          const action = actions(side)[index];
          if (action) run(side, action, { reason: 'action-press', event });
        },
        // Pressing the row (its label) flips the switch it holds, like a <label>.
        labelClick(event: MouseEvent, el: HTMLElement) {
          if (context.options().labelToggles === false || el.querySelector('[data-list-row-press]')) return;
          if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
          el.querySelector<HTMLElement>(TOGGLES)?.click();
        },
      },
    };
  },
  slots: (slot) => ({
    root: slot({
      // The row's offset, written for the content (which moves) and the action strip (which grows) alike.
      live: live<ListRowState, any, object>((state, { api }) => {
        const content = api.swipe.contentAttrs(state, ROW);
        const x = state.removing ? state.removing.x : api.swipe.offset(state, ROW);
        const side = content['data-swipe'] as SwipeSide | undefined;
        return {
          style: `--swipe-x:${x}px;--list-row-reveal:${Math.abs(x)}px${state.removing ? `;--list-row-h:${state.removing.height}px` : ''}`,
          'data-swipe': state.removing ? (x > 0 ? 'start' : 'end') : side,
          'data-swiping': content['data-swiping'],
          'data-full': state.removing || (content['data-full'] !== undefined && side && api.canFull(side)) ? '' : undefined,
          'data-removing': state.removing ? '' : undefined,
        };
      }),
      // Closing the actions focuses the row (`createSwipeActions`), which hands it on to its focus target below.
      attrs: (state) => ({ tabindex: state.group || state.swipeable ? '-1' : undefined }),
      on: {
        pointerdown: (event, { el, api }) => api.internal.pointerdown(event as PointerEvent, el!),
        keydown: (event, { el, api }) => api.internal.keydown(event as KeyboardEvent, el!),
      },
      bind: (el, { api, store }) => {
        const unbind = api.swipe.bindRow(el, ROW);
        // Closing the actions hands focus to the row: pass it on to the row's own focus target.
        const focus = (event: FocusEvent) => {
          if (event.target === el) el.querySelector<HTMLElement>('[data-list-row-focus]')?.focus({ preventScroll: true });
        };
        const click = (event: MouseEvent) => api.internal.click(event);
        // One row open at a time, however it opened (a swipe, a key, the controller).
        const closeThis = () => api.close();
        let open = false;
        const unsubscribe = store.subscribe(() => {
          const state = store.get();
          if (state.swiping) api.internal.swiped();
          if (!!state.open === open) return;
          open = !!state.open;
          if (!open) return void openRows.delete(closeThis);
          openRows.forEach((close) => close !== closeThis && close());
          openRows.add(closeThis);
        });
        el.addEventListener('focus', focus);
        el.addEventListener('click', click, true);
        return () => {
          unbind(); unsubscribe(); openRows.delete(closeThis);
          el.removeEventListener('focus', focus);
          el.removeEventListener('click', click, true);
        };
      },
    }),
    content: slot({
      role: (state) => (state.group ? 'group' : undefined),
      roles: ['group'],
      attrs: (state) => ({
        tabindex: state.group ? '0' : undefined,
        'data-list-row-focus': state.group ? '' : undefined,
        // NavigationStack finds the rows it returns focus to by this attribute.
        'data-tkrow': state.group ? '' : undefined,
      }),
      on: { click: (event, { el, api }) => api.internal.labelClick(event as MouseEvent, el!) },
    }),
    leading: slot({}),
    body: slot({}),
    control: slot({}),
    // A row has a strip on each side: its side is its `value`, which keys the part, so the two are two parts
    // with props of their own (an unkeyed slot is one part however many elements render it).
    actions: slot<{ value: SwipeSide }>({
      props: { value: 'string' },
      attrs: (state, { api, props }) => api.swipe.actionsAttrs(state, ROW, props.value),
      bind: (el, { api, props }) => api.swipe.bindActions(el, ROW, props.value),
    }),
    action: slot<{ value: string; side: SwipeSide; index: number }>({
      role: 'button',
      focus: 'native',
      props: { value: 'string', side: 'string', index: 'number' },
      attrs: () => ({ type: 'button' }),
      press: ({ api, props }, event) => api.internal.press(props.side, props.index, event),
    }),
  }),
  agent: { actions: ['show', 'close'] },
});

/* ── Section ── */

/** Why a section's order changed: a drag of a row's grip, a key on it, or code. */
export type ListSectionOrderChangeReason = ReorderReason;
/** What `onOrderChange` receives besides the new order: where the row moved from and to. */
export type ListSectionOrderChangeDetails = ChangeDetails<ListSectionOrderChangeReason> & { from: number; to: number };

export type ListSectionOptions = {
  /** The rows' keys, in the order the section shows them. */
  order?: string[];
  onOrderChange?: (order: string[], details: ListSectionOrderChangeDetails) => void;
  /** Rows have a grip that reorders them. */
  reorderable?: boolean;
  /** Rows that are collapsing out (they can't be picked up); each calls `onExited` once it has. */
  leaving?: string[];
  onExited?: (key: string) => void;
};

export type ListSectionState = { order: string[]; moving: ReorderDraft | null; leaving: string[]; reorderable: boolean };

/** Where the one row that moved went: from its old index to its new one. */
function movedRow(before: readonly string[], after: readonly string[]) {
  const i = before.findIndex((k, n) => after[n] !== k);
  if (i < 0) return { from: 0, to: 0 };
  const without = (list: readonly string[], key: string) => list.filter((k) => k !== key).join('\u0000');
  const key = without(before, before[i]) === without(after, before[i]) ? before[i] : after[i];
  return { from: before.indexOf(key), to: after.indexOf(key) };
}

export const listSection = definePrimitive({
  name: 'list-section',
  options: { order: 'list', onOrderChange: 'callback', reorderable: 'boolean', leaving: 'list', onExited: 'callback' },
  controlled: ['order'],
  state: (options: ListSectionOptions): ListSectionState => ({
    order: options.order ?? [], moving: null, leaving: options.leaving ?? [], reorderable: !!options.reorderable,
  }),
  sync: (options) => ({
    ...(options.order ? { order: options.order } : null), leaving: options.leaving ?? [], reorderable: !!options.reorderable,
  }),
  api: (context) => {
    const change = createChange(context);
    const reorder = createReorder<ListSectionState, { value: string; label?: string }>(context, {
      slot: 'item',
      key: 'order',
      draft: 'moving',
      disabled: ({ key }) => !context.store.get().reorderable || context.store.get().leaving.includes(key),
      label: (key) => context.props<{ label?: string }>('item', key)?.label || undefined,
      set: (value, details) => change('order', value, { ...details, ...movedRow(context.store.get().order, value) }),
    });
    return {
      reorder,
      /** Moves a row to an index at once, like a "Move to Top" button. */
      move: (key: string, index: number) => reorder.move(key, index),
      internal: { exited: (key: string) => context.options().onExited?.(key) },
    };
  },
  slots: (slot) => ({
    root: slot<object, { order: string[] }>({
      state: (state, { api }) => ({ order: api.reorder.order(state) }),
    }),
    rows: slot({
      role: 'list',
      attrs: (state) => ({ 'aria-roledescription': state.reorderable ? 'sortable list' : undefined }),
    }),
    item: slot<{ value: string; label?: string; entering?: boolean }, { grabbed: boolean }>({
      role: 'listitem',
      props: { value: 'string', label: 'string', entering: 'boolean' },
      state: (state, { api, key }) => ({ grabbed: api.reorder.moving(state, key) }),
      attrs: (state, { api, key }) => ({
        'data-grabbed': api.reorder.moving(state, key) ? '' : undefined,
        'data-dragging': api.reorder.dragging(state, key) ? '' : undefined,
      }),
      bind: (el, part) => {
        const unbind = part.api.reorder.bind(el, part);
        let stop = part.props.entering ? animateIn(el) : () => {};
        let leaving = false;
        const unsubscribe = part.store.subscribe(() => {
          if (leaving || !part.store.get().leaving.includes(part.key)) return;
          leaving = true;
          stop();
          stop = animateOut(el, () => part.api.internal.exited(part.key));
        });
        return () => { unbind(); unsubscribe(); stop(); };
      },
    }),
    handle: slot<{ value: string }>({
      role: 'button',
      focus: 'native',
      props: { value: { kind: 'string', from: 'item', required: true } },
      attrs: (state, { api, key }) => ({ type: 'button', 'data-grabbed': api.reorder.moving(state, key) ? '' : undefined }),
      keys: [' ', 'Enter', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape'],
      on: {
        keydown: (event, { api, key }) => { api.reorder.keydown(event as KeyboardEvent, key); },
        pointerdown: (event, { api, key }) => api.reorder.pointerdown(event as PointerEvent, key),
      },
      // Space and Enter pick the row up (the keydown above); a click on the grip alone does nothing.
      press: () => {},
    }),
  }),
  agent: { actions: ['move'] },
});
