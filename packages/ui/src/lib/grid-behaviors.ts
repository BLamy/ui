import {
  createFocusRecovery, createGridFocus, createResize, createVirtualizer, isFocusFromKeyboard, isRTL,
  type Attrs, type GridCell, type GridFocusReason, type PrimitiveContext, type ResizeDraft, type VirtualAlign, type VirtualItem,
} from '@ui-sdk/core';
import { RowIdIndex, rowsChange, type RowId, type RowsChange } from '@/lib/log-list-model';

/* ══ Behaviors the data grids share: DataTable (and its presets, RequestTable and the SQL console's results) and LogList ══
   Each is shaped like UI SDK's own: call it once in a primitive's `api`, keep it on the api, and wire it from the slots.

   - `createTabStop` keeps a grid one tab stop when its rows or cells hold controls of their own (a link, a Copy button).
   - `createVirtualRows` is a long list of rows that take focus: UI SDK's virtualizer and grid focus, wired to each other.
   - `createColumnResize` sizes columns from separators, on UI SDK's resize.
   No React: the primitives in `lib/*-primitive.ts` use them, and the parts only render. */

/* ── Presses ── */

const CONTROLS = 'a[href],button,input,select,textarea,[role=button],[role=link],[data-no-row-press]';

/** Whether a click inside `row` presses the row: not one on a control inside it, nor the end of a drag that selected text. */
export function isRowPress(event: Event | undefined, row: Element): boolean {
  const control = (event?.target as Element | null | undefined)?.closest?.(CONTROLS);
  if (control && control !== row && row.contains(control)) return false;
  const selection = row.ownerDocument.defaultView?.getSelection();
  return !selection || selection.isCollapsed || !row.contains(selection.anchorNode);
}

/* ── One tab stop ── */

/** The elements inside `root` that Tab stops on. */
export function tabbablesIn(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]')]
    .filter((el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled);
}

const PRECEDING = 2;
const FOLLOWING = 4;

export interface TabStopOptions {
  /** Selects the parts that take focus: the rows of a list, the cells of a table. */
  units: string;
  /** The unit with the tab stop, if it's in the page. */
  active: () => HTMLElement | undefined;
  /** Moves focus to where it starts, when none is active yet. */
  enter: () => void;
}

/** Keeps a grid one tab stop though its units hold controls of their own. Tab goes from the unit with focus through its
 *  own controls, then past every other unit's and on out; keyboard focus that lands on another unit's control, as Tab
 *  into the grid from outside does, goes to the active unit instead. The browser still moves focus: this only picks
 *  where it moves from. Controls in the grid but in no unit, like a header's menu, keep their own stops. */
export function createTabStop({ units, active, enter }: TabStopOptions) {
  let grid: HTMLElement | undefined;
  let leaving = false;
  const unitOf = (el: Element | null) => {
    const unit = el?.closest?.(units) as HTMLElement | null | undefined;
    return unit && grid?.contains(unit) ? unit : null;
  };
  /** Starts the browser's own Tab from `el`, so it lands on whatever is past the grid. */
  const leaveFrom = (el: HTMLElement | undefined) => {
    if (!el) return;
    leaving = true;
    el.focus({ preventScroll: true });
    leaving = false;
  };
  return {
    /** Handles Tab pressed in the grid. Returns whether the key was Tab. */
    keydown(event: KeyboardEvent): boolean {
      if (event.key !== 'Tab') return false;
      const focused = grid?.ownerDocument.activeElement as HTMLElement | null | undefined;
      const unit = unitOf(focused ?? null);
      if (!grid || !focused || !unit) return true;
      const own = tabbablesIn(unit);
      const at = own.indexOf(focused);
      const all = tabbablesIn(grid);
      const loose = all.filter((el) => !unitOf(el));
      if (event.shiftKey) {
        // From a control, the browser goes back to the one before it, or to the unit.
        if (focused !== unit) return true;
        const before = loose.filter((el) => unit.compareDocumentPosition(el) & PRECEDING).pop();
        if (before) {
          before.focus();
          event.preventDefault();
        } else if (all[0] !== unit) leaveFrom(all[0]);
      } else if (at === own.length - 1) {
        const after = loose.find((el) => unit.compareDocumentPosition(el) & FOLLOWING);
        if (after) {
          after.focus();
          event.preventDefault();
        } else if (all[all.length - 1] !== focused) leaveFrom(all[all.length - 1]);
      }
      return true;
    },
    /** Joins the grid's scroller. Return its cleanup from the slot's `bind`. */
    bind(el: HTMLElement): () => void {
      grid = el;
      const onFocusIn = (event: FocusEvent) => {
        if (leaving || !isFocusFromKeyboard()) return;
        const target = event.target as HTMLElement;
        if (target === el) {
          enter();
          return;
        }
        const unit = unitOf(target);
        if (!unit || unit === target || unit === active() || unit.contains(event.relatedTarget as Node | null)) return;
        const to = active();
        if (to) to.focus();
        else enter();
      };
      el.addEventListener('focusin', onFocusIn);
      return () => {
        el.removeEventListener('focusin', onFocusIn);
        if (grid === el) grid = undefined;
      };
    },
  };
}

/* ── Rows that take focus, in a long list ── */

/** Where `scrollToId` puts a row, as UI SDK's virtualizer names it. `auto` moves only as far as it takes to show it. */
export type RowAlign = VirtualAlign;

export interface VirtualRowsOptions {
  /** The slot of a row, whose parts are keyed by their index, and what selects its elements, like `[data-slot=log-list-row]`. */
  row: { slot: string; selector: string };
  /** Selects the other parts of the grid that take focus, like column headers: Tab from one of them leaves the grid too. */
  units?: string;
  /** A row's height until it's measured, or for good in a list that doesn't measure. */
  estimate: () => number;
  /** Rows rendered past each edge. */
  overscan?: number;
  /** Px of the scroller above the rows that stay in view, like a sticky header. */
  scrollMargin?: number;
  /** Keeps a measured height with its row when the list sorts or filters. Leave it out for rows of one height. */
  keyed?: boolean;
  /** Rows to start on when focus comes in and none is active, the first of them in view: the selected row, the current one. */
  preferred?: () => readonly number[];
  /** Runs when the scroll position changes. `byUser` is false for this behavior's own scrolling. */
  onScroll?: (byUser: boolean) => void;
}

const NO_ROWS: readonly number[] = [];
const VERTICAL = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown']);

/** A long list of rows as one tab stop: UI SDK's virtualizer renders the rows in view, its grid focus moves between
 *  them by index (so to rows that aren't rendered yet), and the active row stays rendered while it holds focus. Rows
 *  are data with an `id`: the active row follows its id when the list changes, and a list that is replaced, by a filter
 *  or a sort, keeps the row at the top of the view where it is. */
export function createVirtualRows<Row extends { id: RowId }, State extends { active: GridCell | null }>(
  context: Pick<PrimitiveContext<object, State, string>, 'store' | 'options' | 'element'>,
  options: VirtualRowsOptions,
) {
  const { store } = context;
  const margin = options.scrollMargin ?? 0;
  const ids = new RowIdIndex();
  const bound = new WeakMap<HTMLElement, number>();
  let rows: readonly Row[] = [];
  let activeId: RowId | null = null;
  let scroller: HTMLElement | undefined;
  let expected = -1;

  const virtual = createVirtualizer({
    count: () => rows.length,
    estimate: () => options.estimate(),
    key: options.keyed ? (index) => String(rows[index]?.id ?? index) : undefined,
    overscan: options.overscan,
    scrollMargin: margin,
    keep: () => {
      const { active } = store.get();
      return active ? [active.row] : NO_ROWS;
    },
  });

  const top = () => scroller?.scrollTop ?? 0;
  const view = () => Math.max(0, (scroller?.clientHeight ?? 0) - margin);
  const item = (index: number): VirtualItem | undefined => virtual.items().find((it) => it.index === index);
  const isVisible = (index: number) => {
    const it = item(index);
    return !!it && it.start + it.size > top() && it.start < top() + view();
  };
  /** The row at the top of the view, and how far the view is into it. */
  const anchor = () => {
    const at = top();
    for (const it of virtual.items()) if (it.start + it.size > at) return { index: it.index, offset: Math.max(0, at - it.start) };
    return { index: 0, offset: 0 };
  };
  const cell = (row: number): GridCell => ({ row, col: 0 });
  const setActive = (row: number | null) => {
    activeId = row === null ? null : rows[row]?.id ?? null;
    store.set({ active: row === null ? null : cell(row) } as Partial<State>);
  };
  const rowElement = (index: number | undefined) => (index === undefined ? undefined : context.element(options.row.slot, String(index)));

  /** Sets the scroll position as this behavior's own, and has the virtualizer read it before the next paint. */
  const setTop = (next: number) => {
    if (!scroller || Math.abs(next - scroller.scrollTop) < 0.5) return;
    scroller.scrollTop = Math.max(0, next);
    expected = scroller.scrollTop;
    virtual.refresh();
  };
  const scrollTo = (index: number, align: RowAlign = 'auto') => {
    if (index < 0 || index >= rows.length) return;
    virtual.scrollToIndex(index, { align });
    if (scroller) expected = scroller.scrollTop;
  };

  const grid = createGridFocus<State>(context, {
    key: 'active',
    rows: () => rows.length,
    cols: () => 1,
    pageSize: () => Math.max(1, virtual.items().filter((it) => isVisible(it.index)).length - 1),
    reveal: ({ row }) => scrollTo(row),
    onMove: ({ row }) => {
      activeId = rows[row]?.id ?? null;
    },
  });
  const focusRow = (index: number, details: { reason: GridFocusReason; event?: Event } = { reason: 'imperative' }) => {
    if (index >= 0 && index < rows.length) grid.focus(cell(index), details);
  };
  /** Where focus starts when no row is active: a preferred row in view, else the row at the top of it. */
  const enter = () => {
    if (!rows.length) return;
    const { active } = store.get();
    focusRow(active?.row ?? options.preferred?.().find((index) => index >= 0 && isVisible(index)) ?? anchor().index);
  };

  const recovery = createFocusRecovery({ fallback: () => scroller });
  const tab = createTabStop({
    units: options.units ? `${options.row.selector},${options.units}` : options.row.selector,
    active: () => rowElement(store.get().active?.row),
    enter,
  });

  return {
    virtual,
    grid,
    tab,
    /** The rows as last given to `setRows`. */
    get all(): readonly Row[] {
      return rows;
    },
    /** A row's index by id, or -1. */
    indexOf: (id: RowId) => ids.indexOf(id),
    item,
    isVisible,
    top,
    view,
    anchor,
    setTop,
    scrollTo,
    focusRow,
    setActive,
    rowElement,
    /** The index of the row an element is in, or -1. */
    indexFrom(target: EventTarget | null): number {
      const row = (target as Element | null)?.closest?.(options.row.selector) as HTMLElement | null | undefined;
      return (row && bound.get(row)) ?? -1;
    },
    /** Focuses the active row, or where focus starts. */
    focus: enter,
    /** `"0"` for the active row, `"-1"` for the others: with none active yet, the scroller holds the tab stop. */
    tabIndex: (state: State, index: number): '0' | '-1' => (state.active ? grid.tabIndex(state, cell(index)) : '-1'),
    /** The scroller's `tabindex`: the tab stop until a row is active, then only focusable from code. */
    gridTabIndex: (state: State, count: number): '0' | '-1' => (state.active || !count ? '-1' : '0'),
    isActive: (state: State, index: number) => grid.isActive(state, cell(index)),

    /** The new rows. A list that grew or was cut back keeps its place; one that was replaced keeps the row at the top of
     *  the view there, or the next that survived. Call it when the rows change, once the page shows them. */
    setRows(next: readonly Row[]): RowsChange {
      const prev = rows;
      const change = rowsChange(prev, next);
      if (prev === next) return 'same';
      const held = change === 'replace' && scroller ? anchor() : null;
      const hadFocus = !!scroller && rowElement(store.get().active?.row) === scroller.ownerDocument.activeElement;
      ids.update(next, change);
      rows = next;
      if (change !== 'same') virtual.refresh();
      if (held) {
        for (let i = held.index; i < prev.length; i++) {
          const found = ids.indexOf(prev[i].id);
          if (found < 0) continue;
          scrollTo(found, 'start');
          if (i === held.index) setTop(top() + held.offset);
          break;
        }
      }
      const { active } = store.get();
      if (active && activeId !== null && rows[active.row]?.id !== activeId) {
        const at = ids.indexOf(activeId);
        if (at < 0) setActive(null);
        else if (hadFocus) focusRow(at);
        else setActive(at);
      }
      return change;
    },

    /** Joins the scroller. Return its cleanup from the slot's `bind`. */
    connect(el: HTMLElement): () => void {
      scroller = el;
      expected = el.scrollTop;
      const onScroll = () => {
        const byUser = Math.abs(el.scrollTop - expected) > 1;
        expected = el.scrollTop;
        options.onScroll?.(byUser);
      };
      // After the virtualizer's own listener, so `onScroll` reads the rows it rendered for this position.
      const disconnect = virtual.connect(el);
      el.addEventListener('scroll', onScroll, { passive: true });
      const unbind = tab.bind(el);
      return () => {
        el.removeEventListener('scroll', onScroll);
        unbind();
        disconnect();
        if (scroller === el) scroller = undefined;
      };
    },
    /** Joins a rendered row, measuring it when `measure` is set. Return its cleanup from the slot's `bind`. */
    bindRow(el: HTMLElement, index: number, measure = false): () => void {
      bound.set(el, index);
      // Focus that reaches a row some other way, like a click or a screen reader's cursor, makes it the active one.
      const onFocus = () => {
        if (store.get().active?.row !== index) setActive(index);
      };
      el.addEventListener('focus', onFocus);
      const cleanups = [
        grid.bind(el, cell(index)),
        recovery.bind(el, { key: String(index), props: {} }),
        measure ? virtual.measure(index, el) : undefined,
      ];
      return () => {
        el.removeEventListener('focus', onFocus);
        for (const cleanup of cleanups) cleanup?.();
      };
    },
    /** Handles the keys every list of rows shares: Tab through the active row's controls and out, Escape from a control
     *  back to its row, and Up, Down, Home, End, Page Up and Page Down between rows. Returns the row the key was pressed
     *  on when it's left for the part: one this didn't handle, pressed on the row itself. */
    keydown(event: KeyboardEvent): number | undefined {
      if (event.defaultPrevented || tab.keydown(event)) return undefined;
      const target = event.target as HTMLElement;
      const index = bound.get(target);
      if (index === undefined) {
        const row = target.closest?.(options.row.selector) as HTMLElement | null | undefined;
        if (row && bound.has(row) && event.key === 'Escape') {
          row.focus();
          event.preventDefault();
        }
        return undefined;
      }
      if (event.altKey) return index;
      if (event.key === 'Home' || event.key === 'End') {
        focusRow(event.key === 'Home' ? 0 : rows.length - 1, { reason: 'list-navigation', event });
        event.preventDefault();
        return undefined;
      }
      if (event.metaKey || event.ctrlKey) return index;
      if (VERTICAL.has(event.key)) {
        grid.keydown(event);
        return undefined;
      }
      return index;
    },
  };
}

/* ── Column widths ── */

/** Why a column's width changed: its edge was dragged, an arrow key moved it, a double press put it back, or code did. */
export type ColumnResizeReason = 'drag' | 'resize-key' | 'handle-press' | 'imperative';

export interface ColumnResizeOptions<State extends object> {
  /** The widths set so far, in px by column id. A column with none keeps its own size. */
  widths: (state: State) => Readonly<Record<string, number>>;
  /** The state key that holds the draft while a pointer drags. Start it at `null`, and list it in `live`. */
  draft: keyof State & string;
  /** Asks for new widths and returns whether they went through: the primitive's change. */
  set: (widths: Readonly<Record<string, number>>, details: { reason: ColumnResizeReason; event?: Event }) => boolean;
  /** The narrowest and widest a column gets, in px. */
  limits: (column: string) => { min: number; max?: number };
  /** A column's width in the page, for one that has none set yet. */
  measure: (column: string) => number | undefined;
  /**
   * The width a column shows while it has none set, read from state so the attrs stay pure: a separator takes focus,
   * so it always has a value. A table whose columns size themselves keeps a record by column in state (start it at
   * `{}`) and fills it with `follow` from each separator's `bind`; one that knows its widths without the page reads
   * them from state here.
   */
  shown: { key: keyof State & string } | ((state: State, column: string) => number | undefined);
  /** How far an arrow key moves an edge, in px, and with Shift. Default 12 and 48. */
  step?: number;
  largeStep?: number;
}

/** Sizes columns from the separators at their edges, on UI SDK's resize: a drag keeps its width in the draft and asks
 *  for it once on release, arrow keys on the separator ask a step at a time, and a double press puts the column back to
 *  its own size. A column is a box that only has a width. */
export function createColumnResize<State extends object>(
  context: Pick<PrimitiveContext<object, State, string>, 'store' | 'onDestroy'>,
  options: ColumnResizeOptions<State>,
) {
  const { store } = context;
  const step = options.step ?? 12;
  const largeStep = options.largeStep ?? 48;
  // The column being resized, at the width it has in the page: it may have none set yet.
  let pending: { column: string; width: number } | null = null;
  const start = (column: string) => {
    const set = options.widths(store.get())[column];
    pending = { column, width: set ?? Math.round(options.measure(column) ?? options.limits(column).min) };
  };
  const draft = (state: State) => state[options.draft] as ResizeDraft | null;
  const { shown } = options;
  const shownWidth = (state: State, column: string) => {
    const width = typeof shown === 'function' ? shown(state, column) : (state[shown.key] as Readonly<Record<string, number>>)[column];
    return width === undefined ? undefined : Math.round(width);
  };

  const resize = createResize<State>(context, {
    boxes: (state) => {
      const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
      const widths = options.widths(state);
      for (const column of Object.keys(widths)) boxes[column] = { x: 0, y: 0, width: widths[column], height: 1 };
      if (pending && !(pending.column in boxes)) boxes[pending.column] = { x: 0, y: 0, width: pending.width, height: 1 };
      return boxes;
    },
    draft: options.draft,
    set: (boxes, details) => {
      const column = pending?.column;
      if (!column || !boxes[column]) return false;
      return options.set({ ...options.widths(store.get()), [column]: Math.round(boxes[column].width) }, details);
    },
    min: (column) => ({ width: options.limits(column).min, height: 1 }),
    max: (column) => {
      const { max } = options.limits(column);
      return max === undefined ? undefined : { width: max, height: 1 };
    },
  });

  /** Widens a column by `px` (narrows it, below zero). Its edge is on the left in right-to-left text. */
  const grow = (column: string, rtl: boolean, px: number, event?: Event) => {
    start(column);
    return resize.resizeBy(column, rtl ? 'w' : 'e', rtl ? -px : px, 0, { reason: 'resize-key', event });
  };

  return {
    /** A column's width as it shows now: the draft's while a pointer drags it, else the one set, if any. */
    width(state: State, column: string): number | undefined {
      const dragged = draft(state);
      return dragged?.key === column ? dragged.box.width : options.widths(state)[column];
    },
    /** Every width as it shows now, the dragged one included. */
    widths(state: State): Readonly<Record<string, number>> {
      const dragged = draft(state);
      const widths = options.widths(state);
      return dragged ? { ...widths, [dragged.key]: dragged.box.width } : widths;
    },
    /** Whether a pointer is dragging a column's edge. */
    dragging: (state: State, column: string) => draft(state)?.key === column,
    /** A separator's attributes: its value and limits, its cursor, and no touch scrolling. */
    handleAttrs(state: State, column: string): Attrs {
      const { min, max } = options.limits(column);
      const width = options.widths(state)[column] ?? shownWidth(state, column);
      return {
        ...resize.handleAttrs('e'),
        tabindex: '-1',
        'aria-orientation': 'vertical',
        'aria-valuenow': width === undefined ? undefined : String(width),
        'aria-valuemin': String(min),
        'aria-valuemax': max === undefined ? undefined : String(max),
      };
    },
    /** Keeps the width `el` (the column a separator sits in) shows in the `shown` record, as it changes. Call it from
     *  the separator's `bind` and return what it returns. */
    follow(column: string, el: HTMLElement | null | undefined): (() => void) | undefined {
      const Observer = el?.ownerDocument.defaultView?.ResizeObserver;
      if (!el || typeof shown === 'function') return undefined;
      const write = () => {
        const width = Math.round(el.getBoundingClientRect().width);
        const record = store.get()[shown.key] as Readonly<Record<string, number>>;
        if (record[column] !== width) store.set({ [shown.key]: { ...record, [column]: width } } as unknown as Partial<State>);
      };
      write();
      if (!Observer) return undefined;
      const observer = new Observer(write);
      observer.observe(el);
      return () => observer.disconnect();
    },
    /** Starts a drag of a column's edge. */
    pointerdown(event: PointerEvent, column: string, el: HTMLElement): void {
      start(column);
      resize.pointerdown(event, column, isRTL(el) ? 'w' : 'e', el);
    },
    /** Left and Right on a separator move its column's edge a step, or a large one with Shift. Returns whether it
     *  handled the key. */
    keydown(event: KeyboardEvent, column: string): boolean {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return false;
      const rtl = isRTL(event.target as Element);
      grow(column, rtl, ((event.key === 'ArrowRight') !== rtl ? 1 : -1) * (event.shiftKey ? largeStep : step), event);
      event.preventDefault();
      return true;
    },
    /** Widens (`1`) or narrows (`-1`) a column a step, as an arrow key on its separator does, from another part's key. */
    nudge: (column: string, direction: 1 | -1, large: boolean, event?: Event) =>
      grow(column, isRTL(event?.target as Element | undefined), direction * (large ? largeStep : step), event),
    /** Puts a column back to its own size. */
    reset(column: string, event?: Event): boolean {
      const widths = { ...options.widths(store.get()) };
      if (!(column in widths)) return false;
      delete widths[column];
      return options.set(widths, { reason: event ? 'handle-press' : 'imperative', event });
    },
    /** Sets a column's width. */
    resizeTo(column: string, width: number): boolean {
      const { min, max } = options.limits(column);
      return options.set({ ...options.widths(store.get()), [column]: Math.round(Math.max(min, Math.min(max ?? Infinity, width))) }, { reason: 'imperative' });
    },
  };
}
