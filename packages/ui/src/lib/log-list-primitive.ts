import {
  announce, createChange, createController, createStickToBottom, css, definePrimitive, dispatch, isRTL, live, selects,
  type ChangeDetails, type GridCell,
} from '@ui-sdk/core';
import { createVirtualRows, isRowPress, tabbablesIn, type RowAlign } from '@/lib/grid-behaviors';
import { bindSizeClass } from '@/lib/size-class';
import { RowTimes, followTop, formatLogTime, logRowText, rowsChange, type LogRow, type RowId } from '@/lib/log-list-model';

/* ══ The log-list primitive: a treegrid of rows of any height, with a marker that moves through them ══
   One tab stop, and the rows in view rendered (`createVirtualRows`: UI SDK's virtualizer and grid focus). The selected
   row and the open rows are state a host can control; where the marker is, which rows are after it and where they sit
   are live state, written straight to the rows and the marker, so a marker that follows a playhead renders nothing.
   Following the newest row is UI SDK's `createStickToBottom`; following the marker is `followTop` from the model, as
   it rides the edge of the view rather than the end of the list. With `overflow="expand"` each mounted row's message
   is watched by one ResizeObserver, and a cut one is state (`clipped`), so the row can say it opens. The list's own
   size class (`bindSizeClass`) tells it when the layout flips, under 480 px. No React: `components/log-list.tsx`
   renders it. */

/** Why the selected row changed: a row was pressed, or code set it. */
export type LogListValueChangeReason = 'item-press' | 'imperative';
/** Why rows opened or closed: a chevron, a press on the row, Left or Right on it, or code. */
export type LogListExpandedChangeReason = 'trigger-press' | 'item-press' | 'list-navigation' | 'imperative';
/** Why the view started or stopped following: the user scrolled, the way-back button was pressed, or code asked. */
export type LogListFollowingChangeReason = 'scroll' | 'trigger-press' | 'imperative';

/** What `onAction` receives besides the row's id. */
export type LogListActionDetails<T extends LogRow = LogRow> = ChangeDetails<'item-press'> & { row: T; index: number };

/** Drives a LogList from outside it. Pass it as `controller`. */
export function createLogListController() {
  return createController<{
    /** Focuses the active row, or the row focus would start on. */
    focus: () => void;
    /** Scrolls to a row by id: centered by default, or `auto` to move only if it's out of view. */
    scrollToId: (id: RowId, options?: { align?: RowAlign }) => void;
    /** Takes the view back to the marker (or the newest row, with `followTail`) and follows it again. */
    followPosition: () => void;
    /** Moves the marker to a time with no render at all, for a clock's every tick. `currentId` and `currentTime` take
     *  over again when they next change. */
    setCurrentTime: (time: number | null) => void;
    /** Selects a row, or none with `null`. */
    setValue: (value: RowId | null) => boolean;
    /** Opens exactly these rows. */
    setExpanded: (expanded: RowId[]) => boolean;
  }>();
}

export type LogListController = ReturnType<typeof createLogListController>;

export type LogListOptions<T extends LogRow = LogRow> = {
  rows: readonly T[];
  /** The row that's "now": the marker goes right after it. */
  currentId?: RowId | null;
  /** The time that's "now": the marker goes before the first row logged later. */
  currentTime?: number | null;
  value?: RowId | null;
  defaultValue?: RowId | null;
  onValueChange?: (value: RowId | null, details: ChangeDetails<LogListValueChangeReason>) => void;
  expanded?: RowId[];
  defaultExpanded?: RowId[];
  onExpandedChange?: (expanded: RowId[], details: ChangeDetails<LogListExpandedChangeReason>) => void;
  onAction?: (value: RowId, details: LogListActionDetails<T>) => void;
  follow?: boolean;
  followTail?: boolean;
  onFollowingChange?: (following: boolean, details: ChangeDetails<LogListFollowingChangeReason>) => void;
  overflow?: 'wrap' | 'expand';
  expandOnPress?: boolean;
  copyable?: boolean;
  getRowText?: (row: T) => string;
  onRowCopy?: (text: string, row: T) => void;
  formatTime?: (ms: number) => string;
  /** A row's height until it's measured. */
  rowHeight?: number;
  controller?: LogListController;
};

export type LogListState = {
  count: number;
  value: RowId | null;
  expanded: RowId[];
  active: GridCell | null;
  /** The row under a mouse, which gets the Copy button. */
  hovered: number | null;
  following: boolean;
  /** Which way the marker (or the newest row) is, while it's out of view. */
  away: 'above' | 'below' | null;
  /** With `overflow="expand"`: the rows whose message is cut, by id. Such a row can open even with no detail. */
  clipped: readonly RowId[];
  /** Live: the first row after the marker, the row that is "now", and a count of the rows' layouts. */
  boundary: number | null;
  current: number;
  layout: number;
};

/** What a row's `render` functions and state-based class names receive. */
export type LogListRowState = {
  selected: boolean;
  expanded: boolean;
  active: boolean;
  /** Whether this is the row the Copy button belongs on: the one under a mouse, else the active one. */
  actions: boolean;
};

type RowProps = { index: number; value: RowId; level: string; detail: boolean };

/** A change to the active row reaches the row it leaves and the one it lands on. */
const byRow = {
  values: ({ props }: { props: { index: number } }) => [String(props.index)],
  moved(previous: GridCell | null | undefined, next: GridCell | null | undefined, notify: (name: string) => void) {
    if (previous) notify(String(previous.row));
    if (next) notify(String(next.row));
  },
};

/** State a part doesn't read, so a change to it doesn't reach the part. `NOTHING` is for parts that read none at all. */
const UNPLACED = { count: [], value: [], expanded: [], active: [], hovered: [], following: [], away: [], clipped: [], boundary: [], current: [] };
const NO_IDS: readonly RowId[] = [];
const NOTHING = { ...UNPLACED, layout: [] };

const WRAP_BELOW = 480;

export const logList = definePrimitive({
  name: 'log-list',
  options: {
    rows: 'value', currentId: 'value', currentTime: 'value', value: 'value', defaultValue: 'value', onValueChange: 'callback', expanded: 'value', defaultExpanded: 'value',
    onExpandedChange: 'callback', onAction: 'callback', follow: 'boolean', followTail: 'boolean', onFollowingChange: 'callback',
    overflow: 'string', expandOnPress: 'boolean', copyable: 'boolean', getRowText: 'value', onRowCopy: 'callback', formatTime: 'value',
    rowHeight: 'number', controller: 'value',
  },
  controlled: ['value', 'expanded'],
  live: ['boundary', 'current', 'layout'],
  state: (options: LogListOptions): LogListState => ({
    count: options.rows.length,
    value: options.value ?? options.defaultValue ?? null,
    expanded: options.expanded ?? options.defaultExpanded ?? [],
    active: null,
    hovered: null,
    following: true,
    away: null,
    clipped: NO_IDS,
    boundary: null,
    current: -1,
    layout: 0,
  }),
  sync: (options) => ({
    count: options.rows.length,
    ...(options.value === undefined ? {} : { value: options.value }),
    ...(options.expanded === undefined ? {} : { expanded: options.expanded }),
  }),
  api: (context) => {
    const { store, options } = context;
    const change = createChange(context);
    const times = new RowTimes();
    let position: { id: RowId | null; time: number | null } = { id: options().currentId ?? null, time: options().currentTime ?? null };
    /** The options last seen for what the shell passes on every render: a new one moves the marker or reveals a row. */
    let given = { id: position.id, time: position.time, value: options().value, overflow: options().overflow };
    let scroller: HTMLElement | undefined;
    let stopTail: (() => void) | undefined;

    const rows = createVirtualRows<LogRow, LogListState>(context, {
      row: { slot: 'row', selector: '[data-slot=log-list-row]' },
      estimate: () => options().rowHeight ?? 24,
      overscan: 12,
      keyed: true,
      preferred: () => preferred(),
      onScroll: (byUser) => {
        if (byUser) keepInView(true);
      },
    });
    const virtual = rows.virtual;
    /** Where focus starts, if it's in view: the selected row, or the current one. */
    function preferred(): number[] {
      const { value, current } = store.get();
      return [value === null ? -1 : rows.indexOf(value), current];
    }

    /* ── The marker ── */

    /** The top of a row among the rows, if it's rendered; for the row count, their end. */
    const offsetOf = (index: number): number | null => {
      const count = rows.all.length;
      if (!count) return null;
      if (index >= count) return virtual.size();
      const item = rows.item(index);
      if (item) return item.start;
      const before = rows.item(index - 1);
      return before ? before.start + before.size : null;
    };
    const inView = (y: number | null) => y !== null && y >= rows.top() - 1 && y <= rows.top() + rows.view() + 1;

    const resolve = (): Pick<LogListState, 'boundary' | 'current'> => {
      const { id, time } = position;
      if (id !== null) {
        const at = rows.indexOf(id);
        if (at >= 0) return { boundary: at + 1, current: at };
      }
      if (time === null) return { boundary: null, current: -1 };
      const boundary = times.firstAfter(time);
      return { boundary, current: boundary > 0 && rows.all[boundary - 1].time === time ? boundary - 1 : -1 };
    };

    /** Puts a row's top edge in the middle of the view. */
    const centerOn = (index: number) => {
      rows.scrollTo(Math.min(index, rows.all.length - 1), 'start');
      const y = offsetOf(index);
      if (y !== null) rows.setTop(y - rows.view() / 2);
    };

    /** Where the view was when it opened or the position last moved, until the reader acts on the list: while
     *  the rows trade their estimated heights for measured ones, the marker is placed from here again, so it lands
     *  where real heights put it (a far one centered, a near one at the edge of the band). */
    let opening: number | null = null;
    let replace = 0;

    /** Follows the marker, unless the user has scrolled it out of view (`byUser`, when that's what just happened). It
     *  picks up again when the marker comes back into view, whichever of them moved. */
    function keepInView(byUser = false): void {
      const { boundary } = store.get();
      if (boundary === null) {
        if (!stopTail) store.set({ away: null });
        return;
      }
      if (!rows.all.length || !scroller) {
        store.set({ away: null });
        return;
      }
      const y = offsetOf(boundary);
      const seen = inView(y);
      if (byUser || seen) change('following', seen, { reason: byUser ? 'scroll' : 'imperative' });
      if (store.get().following && !byUser && options().follow !== false) {
        if (y === null) centerOn(boundary);
        else rows.setTop(followTop({ y, top: opening ?? rows.top(), view: rows.view(), total: virtual.size() }));
      }
      const now = offsetOf(boundary);
      store.set({ away: inView(now) ? null : (now === null ? boundary <= rows.anchor().index : now < rows.top()) ? 'above' : 'below' });
    }

    /* ── The newest row ── */

    const stick = createStickToBottom({
      onChange: ({ following }) => {
        if (!stopTail) return;
        change('following', following, { reason: 'scroll' });
        store.set({ away: following ? null : 'below' });
      },
    });
    /** Follows the end of the list while `followTail` is set and there's no marker to follow instead. */
    const syncTail = () => {
      const on = !!scroller && !!options().followTail && store.get().boundary === null;
      if (on === !!stopTail) return;
      if (stopTail) {
        stopTail();
        stopTail = undefined;
        return;
      }
      // Connecting scrolls to the end: the rows there render now, and the browser's own scroll event reaches `stick`.
      stopTail = stick.connect(scroller as HTMLElement);
      virtual.refresh();
      store.set({ away: stick.get().following ? null : 'below' });
    };

    const moved = () => {
      opening = scroller ? rows.top() : null;
      store.set(resolve());
      syncTail();
      keepInView();
    };
    /** The rows' places changed: their box and the marker follow, with no render. */
    const laidOut = () => store.set({ layout: store.get().layout + 1 });

    const setRows = (next: readonly LogRow[]) => {
      const prev = rows.all;
      if (prev === next) return;
      times.update(next, rowsChange(prev, next));
      rows.setRows(next);
      laidOut();
    };
    setRows(options().rows);
    moved();
    context.onOptions((next) => {
      const was = given;
      given = { id: next.currentId ?? null, time: next.currentTime ?? null, value: next.value, overflow: next.overflow };
      const rowsChanged = rows.all !== next.rows;
      if (given.id !== was.id || given.time !== was.time) position = { id: given.id, time: given.time };
      setRows(next.rows);
      if (rowsChanged || given.id !== was.id || given.time !== was.time) moved();
      syncTail();
      if (given.overflow !== was.overflow && given.overflow !== 'expand') store.set({ clipped: NO_IDS });
      // The rows on the page show the new list now: what's cut in it is read once, not on every render.
      else if (rowsChanged || given.overflow !== was.overflow) measureClips(watched.keys());
      // A new selection from outside comes into view. A press's row is in view already.
      if (given.value !== was.value && given.value !== undefined) reveal(given.value);
    });
    context.onDestroy(virtual.subscribe(laidOut));
    // A frame later, so a scroll of the reader's that caused this change has ended the opening first.
    context.onDestroy(virtual.subscribe(() => {
      if (opening === null || replace || typeof requestAnimationFrame === 'undefined') return;
      replace = requestAnimationFrame(() => {
        replace = 0;
        if (opening !== null) keepInView();
      });
    }));
    context.onDestroy(() => { if (replace) cancelAnimationFrame(replace); });

    /* ── Rows ── */

    const isOpen = (id: RowId) => store.get().expanded.includes(id);
    /** Whether a row has more to show: a detail, or a message that's cut. An open row can always close. */
    const canExpand = (index: number) => {
      const row = rows.all[index];
      return row.detail != null || isOpen(row.id) || store.get().clipped.includes(row.id);
    };
    const toggle = (id: RowId, details: { reason: LogListExpandedChangeReason; event?: Event }) => {
      opening = null;
      const { expanded } = store.get();
      return change('expanded', expanded.includes(id) ? expanded.filter((other) => other !== id) : [...expanded, id], details);
    };
    const press = (index: number, event?: Event) => {
      const row = rows.all[index];
      if (!row) return;
      rows.setActive(index);
      change('value', row.id, { reason: 'item-press', event });
      if ((options().expandOnPress ?? options().overflow === 'expand') && canExpand(index)) toggle(row.id, { reason: 'item-press', event });
      dispatch(context, 'onAction', row.id, { reason: 'item-press', event, row, index });
    };

    /** Puts a row's text on the clipboard (and says "Copied" to screen readers), and tells the host either way, as a host
     *  may have a clipboard of its own. */
    const copy = (index: number): Promise<boolean> => {
      const row = rows.all[index];
      if (!row) return Promise.resolve(false);
      const { getRowText, onRowCopy, formatTime } = options();
      const text = getRowText?.(row) ?? logRowText(row, formatTime ?? formatLogTime);
      onRowCopy?.(text, row);
      const clipboard = globalThis.navigator?.clipboard;
      if (!clipboard) return Promise.resolve(false);
      return clipboard.writeText(text).then(() => { announce('Copied'); return true; }, () => false);
    };

    /* ── Cut messages ── */

    /** The mounted rows, each with the id it shows now (a row element is reused for another row as the list changes). */
    const watched = new Map<HTMLElement, () => RowId>();
    let clips: ResizeObserver | undefined;
    /** With `overflow="expand"`: which of these rows' messages are cut, reading them all before writing once. */
    function measureClips(els: Iterable<HTMLElement>): void {
      if (options().overflow !== 'expand') return;
      const reads = [...els].flatMap((el) => {
        const id = watched.get(el)?.();
        if (id === undefined) return [];
        const message = el.querySelector('[data-slot=log-list-message]');
        return [[id, !!message && message.scrollWidth > message.clientWidth] as const];
      });
      const was = store.get().clipped;
      let next = was;
      for (const [id, cut] of reads) {
        if (cut === next.includes(id)) continue;
        next = cut ? [...next, id] : next.filter((other) => other !== id);
      }
      if (next !== was) store.set({ clipped: next });
    }
    /** Watches a row's size (and so its message's), for as long as it's mounted. */
    const watchClip = (el: HTMLElement, id: () => RowId): (() => void) => {
      const Observer = el.ownerDocument.defaultView?.ResizeObserver;
      clips ??= Observer ? new Observer((entries) => measureClips(new Set(entries.map((entry) => entry.target as HTMLElement)))) : undefined;
      watched.set(el, id);
      if (clips) clips.observe(el);
      else measureClips([el]);
      return () => {
        clips?.unobserve(el);
        watched.delete(el);
      };
    };
    context.onDestroy(() => clips?.disconnect());

    /** A row by id comes into view, if it isn't. */
    const reveal = (value: RowId | null) => {
      const index = value === null ? -1 : rows.indexOf(value);
      if (index < 0 || rows.isVisible(index)) return;
      rows.scrollTo(index, 'center');
      keepInView(true);
    };

    return {
      focus: () => rows.focus(),
      scrollToId(id: RowId, { align = 'center' }: { align?: RowAlign } = {}) {
        rows.scrollTo(rows.indexOf(id), align);
        keepInView(true);
      },
      followPosition(event?: Event) {
        const { boundary } = store.get();
        if (boundary === null) {
          if (!stopTail) return;
          stick.scrollToBottom();
          virtual.refresh();
          return;
        }
        change('following', true, { reason: event ? 'trigger-press' : 'imperative', event });
        centerOn(boundary);
        store.set({ away: null });
      },
      setCurrentTime(time: number | null) {
        position = { id: null, time };
        moved();
      },
      setValue: (value: RowId | null) => change('value', value, { reason: 'imperative' }),
      setExpanded: (expanded: RowId[]) => change('expanded', expanded, { reason: 'imperative' }),
      internal: {
        rows,
        copy,
        offsetOf,
        watchClip,
        hover: (index: number | null) => store.set({ hovered: index }),
        /** A click in a row: its chevron opens it, anything else that isn't a control presses it. */
        click(index: number, el: HTMLElement | undefined, event?: Event) {
          const row = rows.all[index];
          if (!row) return;
          if ((event?.target as Element | null)?.closest?.('[data-row-toggle]')) {
            rows.setActive(index);
            toggle(row.id, { reason: 'trigger-press', event });
          } else if (!el || isRowPress(event, el)) press(index, event);
        },
        keydown(event: KeyboardEvent) {
          const index = rows.keydown(event);
          const row = index === undefined ? undefined : rows.all[index];
          if (index === undefined || !row || event.altKey) return;
          if (event.metaKey || event.ctrlKey) {
            // With text selected, the browser copies that.
            const selection = scroller?.ownerDocument.defaultView?.getSelection();
            if (event.key.toLowerCase() !== 'c' || options().copyable === false || (selection && !selection.isCollapsed)) return;
            void copy(index);
            event.preventDefault();
            return;
          }
          const forward = (event.key === 'ArrowRight') !== isRTL(event.target as Element);
          switch (event.key) {
            case 'Enter':
            case ' ':
              press(index, event);
              break;
            case 'ArrowLeft':
            case 'ArrowRight': {
              const el = rows.rowElement(index);
              if (forward && !isOpen(row.id) && canExpand(index)) toggle(row.id, { reason: 'list-navigation', event });
              else if (forward) (el && tabbablesIn(el)[0])?.focus();
              else if (isOpen(row.id)) toggle(row.id, { reason: 'list-navigation', event });
              break;
            }
            default:
              return;
          }
          event.preventDefault();
        },
        connect(el: HTMLElement): () => void {
          scroller = el;
          const disconnect = rows.connect(el);
          // The layout flips at 480 px (its `@[480px]:` classes), so the heights measured on the other side no longer hold.
          let flipped = false;
          const stopSizeClass = bindSizeClass(el, {
            breakpoints: { medium: WRAP_BELOW, regular: Number.POSITIVE_INFINITY },
            onChange: () => {
              if (flipped) virtual.reset();
              flipped = true;
            },
          });
          syncTail();
          opening = rows.top();
          // The reader's own scroll or press ends the opening (a scroll alone may be the browser keeping its place).
          const settle = () => { opening = null; };
          const intents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
          for (const type of intents) el.addEventListener(type, settle, { passive: true });
          keepInView();
          // `defaultValue` only counts here, at the start.
          reveal(store.get().value);
          return () => {
            for (const type of intents) el.removeEventListener(type, settle);
            stopSizeClass();
            stopTail?.();
            stopTail = undefined;
            disconnect();
            if (scroller === el) scroller = undefined;
          };
        },
      },
    };
  },
  slots: (slot) => ({
    root: slot({ selects: selects(NOTHING) }),

    // A row can open to show more, and aria-expanded on a row is only allowed in a treegrid.
    grid: slot({
      role: 'treegrid',
      keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' ', 'Tab', 'Escape', 'mod+c'],
      selects: selects({ value: [], expanded: [], hovered: [], following: [], away: [], clipped: [], boundary: [], current: [], layout: [] }),
      attrs: (state, { api }) => ({
        'aria-rowcount': String(state.count),
        tabindex: api.internal.rows.gridTabIndex(state, state.count),
      }),
      on: {
        keydown: (event, { api }) => api.internal.keydown(event),
        pointerover: (event, { api }) => {
          if (event.pointerType === 'touch') return;
          const index = api.internal.rows.indexFrom(event.target);
          api.internal.hover(index < 0 ? null : index);
        },
        pointerleave: (_event, { api }) => api.internal.hover(null),
      },
      bind: (el, { api }) => api.internal.connect(el),
    }),

    // The box the rows are placed in, as tall as all of them, which is what gives the scroller its scrollbar.
    rows: slot({
      role: 'rowgroup',
      selects: selects(UNPLACED),
      live: live((_state, { api }) => ({ style: css({ height: `${api.internal.rows.virtual.size()}px` }) })),
    }),

    row: slot<RowProps, LogListRowState>({
      role: 'row',
      props: { index: 'number', value: 'value', level: 'string', detail: 'boolean' },
      selects: selects({
        count: [],
        following: [],
        away: [],
        layout: [],
        value: ({ props }) => [props.value],
        expanded: ({ props }) => [props.value],
        clipped: ({ props }) => [props.value],
        active: byRow,
        // With no row under a mouse, the active row has the Copy button.
        hovered: ({ props }) => [props.index, null],
      }),
      state: (state, { props, api }) => {
        const active = api.internal.rows.isActive(state, props.index);
        return {
          selected: state.value === props.value,
          expanded: state.expanded.includes(props.value),
          active,
          actions: state.hovered === null ? active : state.hovered === props.index,
        };
      },
      attrs: (state, { props, api }) => {
        const selected = state.value === props.value;
        const expanded = state.expanded.includes(props.value);
        // A cut message with no detail can open too.
        const clipped = state.clipped.includes(props.value);
        return {
          tabindex: api.internal.rows.tabIndex(state, props.index),
          'aria-rowindex': String(props.index + 1),
          'aria-selected': String(selected),
          'aria-expanded': props.detail || expanded || clipped ? String(expanded) : undefined,
          'data-index': String(props.index),
          'data-level': props.level,
          'data-selected': selected ? '' : undefined,
          'data-active': api.internal.rows.isActive(state, props.index) ? '' : undefined,
          'data-expanded': expanded ? '' : undefined,
          'data-has-detail': props.detail ? '' : undefined,
          'data-clipped': clipped ? '' : undefined,
        };
      },
      live: live((state, { props }) => ({
        'data-future': state.boundary !== null && props.index >= state.boundary ? '' : undefined,
        'data-current': props.index === state.current ? '' : undefined,
        'aria-current': props.index === state.current ? 'true' : undefined,
      })),
      press: ({ api, props, el }, event) => api.internal.click(props.index, el, event),
      bind: (el, part) => {
        const unbind = part.api.internal.rows.bindRow(el, part.props.index, true);
        const unwatch = part.api.internal.watchClip(el, () => part.props.value);
        return () => {
          unwatch();
          unbind();
        };
      },
    }),

    cell: slot({ role: 'gridcell', focus: { none: 'Focus stays on the row.' }, selects: selects(NOTHING) }),

    // The Copy button's cell, in the one row that has it.
    actions: slot({
      role: 'gridcell',
      focus: { none: 'Focus goes to the button inside.' },
      selects: selects(NOTHING),
      attrs: () => ({ 'data-no-row-press': '' }),
    }),

    // The "you are here" line. It's drawn for sighted users: the current row says the same with aria-current.
    marker: slot({
      attrs: () => ({ 'aria-hidden': 'true' }),
      live: live((state, { api }) => {
        const y = state.boundary === null ? null : api.internal.offsetOf(state.boundary);
        return { style: css({ display: y === null ? 'none' : undefined, transform: y === null ? undefined : `translateY(${y}px)` }) };
      }),
    }),

    'marker-label': slot({ selects: selects(NOTHING) }),

    // The way back to the marker, while it's out of view.
    jump: slot<Record<never, never>, { away: 'above' | 'below' | null; marker: boolean }>({
      present: (state) => state.away !== null,
      state: (state) => ({ away: state.away, marker: state.boundary !== null }),
      attrs: (state) => ({ 'data-side': state.away ?? undefined }),
    }),

    empty: slot({ present: (state) => state.count === 0 }),

    footer: slot({ selects: selects(NOTHING) }),
  }),
  agent: { actions: ['setValue', 'setExpanded', 'scrollToId', 'followPosition'] },
});
