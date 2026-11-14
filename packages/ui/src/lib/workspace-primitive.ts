import {
  bindDrag,
  bindDragPreview,
  createAutoScroll,
  createChange,
  createCommit,
  createController,
  createFocusRecovery,
  createTransfer,
  definePrimitive,
  dragThreshold,
  isRTL,
  type ChangeDetails,
  type ChangeOptions,
  type ChangeSource,
  type CommitDetails,
  type DragPreview,
  type PrimitiveOptions,
  type TransferDraft,
  type TransferLists,
} from '@ui-sdk/core';
import {
  addTab,
  closeTab,
  closeTabset,
  findTab,
  findTabset,
  maximizeTabset,
  moveTab,
  normalizeLayout,
  resizeSplit,
  restoreTabset,
  selectTab,
  tabsetOfTab,
  updateTab,
  updateTabset,
  workspaceTabsets,
  type TabDropRegion,
  type TabDropTarget,
  type TabNode,
  type WorkspaceTabSide,
  type TabsetNode,
  type WorkspaceLayout,
  type WorkspaceLayoutInput,
} from '@/lib/workspace-model';

/* ══ Workspace — a dockable layout of tabsets ══
   The primitive owns the layout (lib/workspace-model) and every way it changes: a tab selected, closed, moved
   within a tabset, to another one or onto an edge, which splits there; a split resized; a tabset maximized. The
   view composes UI SDK's Resizable for the splits and its Tabs for each tabset, both controlled from this state,
   and forwards what they report here, so one `onLayoutChange` hears everything with its reason.

   Tabs move through `createTransfer`: each tabset is a list of tab ids, and each edge of a tabset is a list too,
   always empty, so "drop on the right edge" is a move into a list like any other. Space or Enter picks a tab up,
   the arrows move it along its strip and to the next tabset, Space or Enter drops it, Escape puts it back, and a
   screen reader hears each step. A pointer drag follows `bindDrag` with a copy from `bindDragPreview`, and moves
   the same draft, since a strip runs sideways and a drop on a tabset's content has regions. */

/** The ids of every split in a layout, in document order. */
export function splitIdsOf(node: WorkspaceLayout['root'], out: string[] = []): string[] {
  if (node.type === 'split') {
    out.push(node.id);
    for (const child of node.children) splitIdsOf(child, out);
  }
  return out;
}

/** What a change did to the layout. */
export type WorkspaceAction = 'select' | 'add' | 'close' | 'move' | 'resize' | 'maximize' | 'restore' | 'update' | 'set';

/** Why the layout changed: a tab pressed or reached with the arrows (`item-press`, `list-navigation`,
 *  `find-in-page`), a tab closed by its button or Delete (`remove-press`), a tab dragged or moved with the keys
 *  (`drag`, `move-key`), a handle dragged or stepped (`drag`, `step-key`, `collapse`, `resize`), the maximize
 *  button (`toggle-press`), or a controller (`imperative`). */
export type WorkspaceLayoutChangeReason =
  | 'item-press'
  | 'list-navigation'
  | 'find-in-page'
  | 'item-removed'
  | 'remove-press'
  | 'toggle-press'
  | 'drag'
  | 'move-key'
  | 'step-key'
  | 'collapse'
  | 'resize'
  | 'imperative';

type Subject = {
  /** What the change did. */
  action: WorkspaceAction;
  /** The tab it happened to, when it was one. */
  tab?: string;
  /** The tabset it happened in: where a tab landed, which one was resized around, maximized or closed. */
  tabset?: string;
};
/** What `onLayoutChange` receives after the layout. */
export type WorkspaceLayoutChangeDetails = ChangeDetails<WorkspaceLayoutChangeReason> & Subject;
/** What `onLayoutCommit` receives after the layout. */
export type WorkspaceLayoutCommitDetails = CommitDetails<WorkspaceLayoutChangeReason> & Subject;
/** What every write method on a controller takes last. */
export type WorkspaceChangeOptions = ChangeOptions<WorkspaceLayoutChangeReason>;

/** Changes and reads a workspace from outside it. Write methods run `onLayoutChange` like the user's own changes
 *  and return false when nothing changed or the change was canceled. They are not held back by `disabled`,
 *  `disableClose`, `disableDrag` or `accepts`. */
export type WorkspaceController<TabData = unknown, TabsetData = unknown> = {
  getLayout: () => WorkspaceLayout<TabData, TabsetData>;
  /** Replaces the layout. Read what was applied with `getLayout()`. */
  setLayout: (layout: WorkspaceLayoutInput<TabData, TabsetData>, options?: WorkspaceChangeOptions) => boolean;
  /** The tabset the user last used, by pointer or focus. */
  getActiveTabsetId: () => string | undefined;
  /** Adds a tab: to `tabsetId`, else the active tabset, at `index`, else the end, on show unless `select` is false.
   *  A tab whose id is already open is selected instead. Returns whether the tab was added. */
  addTab: (tab: TabNode<TabData>, options?: WorkspaceChangeOptions & { tabsetId?: string; index?: number; select?: boolean }) => boolean;
  closeTab: (tabId: string, options?: WorkspaceChangeOptions) => boolean;
  /** Closes a tabset with its tabs, like one kept when empty. */
  closeTabset: (tabsetId: string, options?: WorkspaceChangeOptions) => boolean;
  /** Moves a tab to a place among a tabset's tabs or to a region of its content: an edge splits there. */
  moveTab: (tabId: string, target: TabDropTarget, options?: WorkspaceChangeOptions) => boolean;
  selectTab: (tabId: string, options?: WorkspaceChangeOptions) => boolean;
  /** Changes a tab's title, data or flags. `data` is replaced, not merged. */
  updateTab: (tabId: string, changes: Partial<Omit<TabNode<TabData>, 'id'>>, options?: WorkspaceChangeOptions) => boolean;
  updateTabset: (
    tabsetId: string,
    changes: Partial<Pick<TabsetNode<TabData, TabsetData>, 'data' | 'keepWhenEmpty' | 'minHeight' | 'minWidth' | 'tabSide'>>,
    options?: WorkspaceChangeOptions,
  ) => boolean;
  /** Lets a tabset cover the others. */
  maximizeTabset: (tabsetId: string, options?: WorkspaceChangeOptions) => boolean;
  restoreTabset: (options?: WorkspaceChangeOptions) => boolean;
};

/** A handle for a workspace: pass it as `controller`, then call it from anywhere. */
export function createWorkspaceController<TabData = unknown, TabsetData = unknown>() {
  return createController<WorkspaceController<TabData, TabsetData>>();
}

export type WorkspaceOptions<TabData = unknown, TabsetData = unknown> = {
  /** The layout, to control the workspace. Pass back what `onLayoutChange` gives you. */
  layout?: WorkspaceLayoutInput<TabData, TabsetData>;
  /** The layout at first, when uncontrolled. */
  defaultLayout?: WorkspaceLayoutInput<TabData, TabsetData>;
  /** Runs when the layout wants to change: every selection, close and move, and every frame of a resize.
   *  `details.action` says what it did, `details.reason` why, and `details.cancel()` stops it. */
  onLayoutChange?: (layout: WorkspaceLayout<TabData, TabsetData>, details: WorkspaceLayoutChangeDetails) => void;
  /** Runs once an interaction that changed the layout ends: a tab dropped, a handle let go. For saving. */
  onLayoutCommit?: (layout: WorkspaceLayout<TabData, TabsetData>, details: WorkspaceLayoutCommitDetails) => void;
  /** Locks the arrangement: nothing resizes, moves or closes by hand. Tabs still select and tabsets maximize. */
  disabled?: boolean;
  /** Whether a tab may go to `target`: another tabset, or an edge of any tabset (its own included), which splits
   *  there. A tab can always go back along its own strip. Defaults to yes. */
  accepts?: (tab: TabNode<TabData>, target: TabDropTarget) => boolean;
  /** What a tabset is called, for screen readers and agents. Defaults to `Pane 1`, `Pane 2`… in reading order. */
  tabsetLabel?: (tabset: TabsetNode<TabData, TabsetData>, index: number) => string;
  /** Where tabs sit around their content, for tabsets that don't say. Defaults to `top`. */
  tabSide?: WorkspaceTabSide;
  /** Drives the workspace from anywhere. Create one with `createWorkspaceController()`. */
  controller?: WorkspaceController<TabData, TabsetData>;
} & PrimitiveOptions;

type Layout = WorkspaceLayout<any, any>;
type Tabset = TabsetNode<any, any>;

type WorkspaceStore = {
  layout: Layout;
  // Every tabset's tab ids, and an empty list for each of its edges: what `createTransfer` moves tabs between.
  lists: TransferLists;
  moving: TransferDraft | null;
  // The tab a pointer is dragging, and the region of a tabset's content it is over.
  dragging: string | null;
  target: { tabsetId: string; region: TabDropRegion } | null;
  // The tabset last used, by pointer or focus.
  active: string | null;
  disabled: boolean;
  tabSide: WorkspaceTabSide;
};

/** What the workspace's root hands a `children` function. */
export type WorkspaceState<TabData = unknown, TabsetData = unknown> = {
  layout: WorkspaceLayout<TabData, TabsetData>;
  /** Each tabset's tab ids in the order to show: a tab that is being moved sits where it would drop. */
  lists: Record<string, string[]>;
  /** The tab picked up, by keys or a pointer. */
  moving: string | null;
  /** Whether a pointer is dragging a tab. */
  dragging: boolean;
  disabled: boolean;
  activeTabsetId: string | null;
};

/** What a tabset's parts hand `render` functions and state-based class names. */
export type WorkspaceTabsetState = {
  /** The user last used this tabset. */
  active: boolean;
  maximized: boolean;
  /** It is the only tabset, so there is nothing to maximize it over. */
  only: boolean;
  empty: boolean;
  selectedTabId: string | null;
  tabSide: WorkspaceTabSide;
};

/** What a tab's parts hand `render` functions and state-based class names. */
export type WorkspaceTabState = {
  /** On show in its tabset. */
  selected: boolean;
  /** On show, and its tabset isn't behind a maximized one. */
  visible: boolean;
  /** Picked up, by keys or a pointer. */
  moving: boolean;
  /** A pointer is dragging it. */
  dragging: boolean;
  /** The user can close it. */
  closable: boolean;
  /** The user can move it. */
  draggable: boolean;
};

const EDGE = '\u001f';
const EDGE_REGIONS = ['left', 'right', 'top', 'bottom'] as const;
const edgeList = (tabsetId: string, region: TabDropRegion) => `${tabsetId}${EDGE}${region}`;
const targetOf = (list: string, index: number): TabDropTarget => {
  const [tabsetId, region] = list.split(EDGE);
  return region ? { tabsetId, region: region as TabDropRegion } : { tabsetId, index };
};

const listed = new WeakMap<Layout, TransferLists>();
function listsOf(layout: Layout) {
  let lists = listed.get(layout);
  if (!lists) {
    lists = {};
    for (const tabset of workspaceTabsets(layout)) {
      lists[tabset.id] = tabset.tabs.map((tab) => tab.id);
      for (const region of EDGE_REGIONS) lists[edgeList(tabset.id, region)] = [];
    }
    listed.set(layout, lists);
  }
  return lists;
}

const EMPTY: WorkspaceLayoutInput = { version: 1, root: { type: 'tabset', tabs: [] } };
const BESIDE: Record<string, string> = { left: 'to the left of', right: 'to the right of', top: 'above', bottom: 'below' };
const FLIPPED: Partial<Record<TabDropRegion, TabDropRegion>> = { left: 'right', right: 'left' };
const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
// Controls inside a tab that keep their own presses, so they neither drag the tab nor pick it up.
const CONTROLS = 'button, a[href], input, select, textarea, [role="button"]';

const visibleTabsets = (layout: Layout) => {
  const tabsets = workspaceTabsets(layout);
  return layout.maximizedTabsetId ? tabsets.filter((tabset) => tabset.id === layout.maximizedTabsetId) : tabsets;
};
const sideOf = (state: WorkspaceStore, tabset: Tabset | undefined) => tabset?.tabSide ?? state.tabSide;
const sideways = (placement: WorkspaceTabSide) => placement === 'top' || placement === 'bottom';
const activeIn = (state: WorkspaceStore) => {
  const tabsets = visibleTabsets(state.layout);
  return (tabsets.find((tabset) => tabset.id === state.active) ?? tabsets[0])?.id ?? null;
};
const listWith = (lists: TransferLists, key: string) => Object.keys(lists).find((list) => lists[list].includes(key));

function tabsetState(state: WorkspaceStore, key: string): WorkspaceTabsetState {
  const tabset = findTabset(state.layout, key);
  return {
    active: activeIn(state) === key,
    maximized: state.layout.maximizedTabsetId === key,
    only: state.layout.root.type === 'tabset',
    empty: !tabset?.tabs.length,
    selectedTabId: tabset?.selectedId ?? null,
    tabSide: sideOf(state, tabset),
  };
}

function tabState(state: WorkspaceStore, key: string): WorkspaceTabState {
  const tabset = tabsetOfTab(state.layout, key);
  const tab = tabset?.tabs.find((candidate) => candidate.id === key);
  const selected = tabset?.selectedId === key;
  const { maximizedTabsetId } = state.layout;
  return {
    selected,
    visible: selected && (!maximizedTabsetId || maximizedTabsetId === tabset?.id),
    moving: state.moving?.key === key,
    dragging: state.dragging === key,
    closable: !!tab && !state.disabled && !tab.disableClose,
    draggable: !!tab && !state.disabled && !tab.disableDrag,
  };
}

const flag = (on: boolean | undefined) => (on ? '' : undefined);

export const workspace = definePrimitive({
  name: 'workspace',
  options: {
    layout: 'value',
    defaultLayout: 'value',
    onLayoutChange: 'callback',
    onLayoutCommit: 'callback',
    disabled: 'boolean',
    accepts: 'action',
    tabsetLabel: 'action',
    tabSide: 'string',
    controller: 'value',
  },
  controlled: ['layout'],
  commits: ['layout'],
  state: (options: WorkspaceOptions<any, any>): WorkspaceStore => {
    const layout = normalizeLayout(options.layout ?? options.defaultLayout ?? EMPTY);
    return {
      layout,
      lists: listsOf(layout),
      moving: null,
      dragging: null,
      target: null,
      active: null,
      disabled: !!options.disabled,
      tabSide: options.tabSide ?? 'top',
    };
  },
  sync: (options) => {
    const layout = options.layout === undefined ? undefined : normalizeLayout(options.layout);
    return {
      disabled: !!options.disabled,
      tabSide: options.tabSide ?? 'top',
      ...(layout ? { layout, lists: listsOf(layout) } : {}),
    };
  },
  api: (context) => {
    const { store, options } = context;
    const change = createChange(context);
    const commit = createCommit(context);
    type Why = { reason: WorkspaceLayoutChangeReason; event?: Event; source?: ChangeSource } & Subject;

    // The lists follow the layout, whoever wrote it. The ones before it say where a closed tab was.
    let seen = store.get().layout;
    let before = store.get().lists;
    context.onDestroy(
      store.subscribe(() => {
        const { layout } = store.get();
        if (layout === seen) return;
        before = listsOf(seen);
        seen = layout;
        store.set({ lists: listsOf(layout) });
      }),
    );

    /** Asks for a layout. `settled` is false for one step of a longer interaction, like a frame of a resize. */
    function apply(next: Layout, why: Why, settled = true) {
      if (next === store.get().layout || !change('layout', next, why)) return false;
      if (settled) commit('layout', next, why);
      return true;
    }
    const imperative = ({ reason = 'imperative', event }: WorkspaceChangeOptions = {}) => ({ reason, event });

    const tabLabel = (key: string) => findTab(store.get().layout, key)?.title ?? key;
    function tabsetLabel(tabsetId: string) {
      const tabsets = workspaceTabsets(store.get().layout);
      const index = tabsets.findIndex((tabset) => tabset.id === tabsetId);
      if (index < 0) return tabsetId;
      return options().tabsetLabel?.(tabsets[index], index) ?? `Pane ${index + 1}`;
    }

    /** Whether a tab may go to `target`. Its own strip always takes it back; its own edge never does when it is
     *  alone there, and otherwise asks `accepts` like any other target. */
    function accepts(key: string, target: TabDropTarget) {
      const { layout } = store.get();
      const home = tabsetOfTab(layout, key);
      const tab = home?.tabs.find((candidate) => candidate.id === key);
      const destination = findTabset(layout, target.tabsetId);
      if (!home || !tab || !destination) return false;
      const splits = 'region' in target && target.region !== 'center';
      if (home === destination && !splits) return true;
      if (home === destination && home.tabs.length < 2) return false;
      return options().accepts?.(tab, 'index' in target ? { ...target, index: Math.min(target.index, destination.tabs.length) } : target) ?? true;
    }

    // A pointer drag's newest event, which its drop reports instead of the key a drop would otherwise be.
    let pointer: PointerEvent | undefined;
    const transfer = createTransfer<WorkspaceStore>(context, {
      key: 'lists',
      draft: 'moving',
      set(_lists, details) {
        const target = targetOf(details.to, details.index);
        const next = moveTab(store.get().layout, details.key, target);
        const subject = { action: 'move' as const, tab: details.key, tabset: tabsetOfTab(next, details.key)?.id };
        return pointer ? apply(next, { reason: 'drag', event: pointer, ...subject }) : apply(next, { reason: details.reason, event: details.event, ...subject });
      },
      order: () => visibleTabsets(store.get().layout).map((tabset) => tabset.id),
      accepts: (key, list) => accepts(key, targetOf(list, Number.MAX_SAFE_INTEGER)),
      disabled: (key) => !tabState(store.get(), key).draggable,
      label: tabLabel,
      listLabel(list) {
        const [tabsetId, region] = list.split(EDGE);
        return region ? `a new pane ${BESIDE[region]} ${tabsetLabel(tabsetId)}` : tabsetLabel(tabsetId);
      },
    });

    const trigger = (key: string) => {
      const el = context.element('tab', key);
      return el?.querySelector<HTMLElement>('[role="tab"]') ?? el;
    };

    const recovery = createFocusRecovery({
      fallback(lost) {
        const { layout } = store.get();
        // Moved, not closed: the same tab, where it is now.
        if (findTab(layout, lost.key)) return context.element('tab', lost.key) ? trigger(lost.key) : undefined;
        const home = listWith(before, lost.key);
        const tabset = (home && findTabset(layout, home)) || findTabset(layout, activeIn(store.get()) ?? '');
        return tabset?.selectedId ? trigger(tabset.selectedId) : undefined;
      },
    });

    /* ── A pointer drags a tab ── */

    const within = (rect: DOMRect, x: number, y: number) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

    /** How many of a strip's other tabs the pointer has passed, which is where the tab would drop among them. */
    function indexAt(tabset: Tabset, key: string, x: number, y: number) {
      const state = store.get();
      const along = sideways(sideOf(state, tabset));
      let index = 0;
      for (const id of transfer.lists(state)[tabset.id] ?? []) {
        const el = id === key ? undefined : context.element('tab', id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const passed = along ? (isRTL(el) ? x < rect.left + rect.width / 2 : x > rect.left + rect.width / 2) : y > rect.top + rect.height / 2;
        if (passed) index += 1;
      }
      return index;
    }

    /** The nearest edge within a quarter of the content, else its middle. */
    function regionAt(rect: DOMRect, x: number, y: number): TabDropRegion {
      const across = (x - rect.left) / (rect.width || 1);
      const down = (y - rect.top) / (rect.height || 1);
      const edges: [TabDropRegion, number][] = [
        ['left', across],
        ['right', 1 - across],
        ['top', down],
        ['bottom', 1 - down],
      ];
      const [region, distance] = edges.reduce((nearest, edge) => (edge[1] < nearest[1] ? edge : nearest));
      return distance < 0.25 ? region : 'center';
    }

    /** What is under a point: a place in a tabset's strip, or a region of its content. */
    function targetAt(key: string, x: number, y: number): TabDropTarget | null {
      for (const tabset of visibleTabsets(store.get().layout)) {
        const header = context.element('header', tabset.id);
        if (header && within(header.getBoundingClientRect(), x, y)) return { tabsetId: tabset.id, index: indexAt(tabset, key, x, y) };
        const panels = context.element('panels', tabset.id);
        const rect = panels?.getBoundingClientRect();
        if (panels && rect && within(rect, x, y)) return { tabsetId: tabset.id, region: regionAt(rect, x, y) };
      }
      return null;
    }

    /** Moves the draft to what the pointer is over, or back where the tab came from when nothing takes it. */
    function track(key: string, origin: { list: string; index: number }, x: number, y: number) {
      const over = targetAt(key, x, y);
      // The middle of its own tabset's content is where it already is.
      const home = over && 'region' in over && over.region === 'center' && over.tabsetId === origin.list;
      if (!over || home || !accepts(key, over)) {
        store.set({ target: null });
        transfer.moveTo(origin.list, origin.index);
        return;
      }
      if ('index' in over) {
        store.set({ target: null });
        transfer.moveTo(over.tabsetId, over.index);
        return;
      }
      store.set({ target: over });
      if (over.region === 'center') {
        transfer.moveTo(over.tabsetId, Number.MAX_SAFE_INTEGER);
        return;
      }
      // Splits are laid out in reading order, so in right-to-left text the left edge is the far one.
      const panels = context.element('panels', over.tabsetId);
      const region = (panels && isRTL(panels) && FLIPPED[over.region]) || over.region;
      transfer.moveTo(edgeList(over.tabsetId, region), 0);
    }

    // The drag in progress: what stops following the pointer, and what takes its copy and its scrolling away.
    let stopDrag: (() => void) | undefined;
    let clearDrag: (() => void) | undefined;
    context.onDestroy(() => {
      stopDrag?.();
      clearDrag?.();
    });

    function pointerdown(event: PointerEvent, key: string, el: HTMLElement | undefined) {
      const state = store.get();
      const home = tabsetOfTab(state.layout, key);
      if (!el || !home || event.button !== 0 || event.defaultPrevented || state.moving || !tabState(state, key).draggable) return;
      const control = event.target instanceof Element ? event.target.closest(CONTROLS) : null;
      if (control && control !== trigger(key) && el.contains(control)) return;
      const origin = { list: home.id, index: home.tabs.findIndex((tab) => tab.id === key) };
      let preview: DragPreview | undefined;
      let started = false;
      const scroll = createAutoScroll({
        ignore: () => preview?.el,
        onScroll: () => pointer && track(key, origin, pointer.clientX, pointer.clientY),
      });
      stopDrag?.();
      clearDrag?.();
      clearDrag = () => {
        scroll.stop();
        preview?.remove();
        preview = undefined;
      };
      stopDrag = bindDrag(el, event, {
        threshold: dragThreshold,
        cancelOnEscape: true,
        onStart() {
          if (!transfer.grab(key)) return false;
          started = true;
          pointer = event;
          preview = bindDragPreview(el, { x: event.clientX, y: event.clientY });
          // The copy is the tab in flight, not the place it would drop.
          preview.el.removeAttribute('data-moving');
          store.set({ dragging: key });
          return true;
        },
        onMove({ x, y, event: move }) {
          move.preventDefault();
          pointer = move;
          preview?.move(x, y);
          scroll.update(x, y);
          track(key, origin, x, y);
        },
        onEnd(_end, canceled) {
          clearDrag?.();
          if (!started) return;
          if (canceled) transfer.cancel();
          else transfer.drop(pointer);
          pointer = undefined;
          store.set({ dragging: null, target: null });
        },
      });
    }

    /* ── Keys on a tab ── */

    function keydown(event: KeyboardEvent, key: string, el: HTMLElement | undefined) {
      // Only the tab itself counts, not a control beside it, like its close button.
      if (event.defaultPrevented || event.target !== trigger(key) || !el) return;
      const state = store.get();
      if (state.dragging) {
        // A pointer has it, so the keys wait.
        event.preventDefault();
        return;
      }
      const modified = event.altKey || event.ctrlKey || event.metaKey;
      const moving = state.moving;
      const list = moving && listWith(moving.lists, moving.key);
      if (moving && list && !modified && ARROWS.has(event.key) && sideways(sideOf(state, findTabset(state.layout, list)))) {
        // A strip that runs sideways: Left and Right move the tab along it and on into the tabset beside it, Up and
        // Down straight to the previous or next tabset.
        event.preventDefault();
        const index = moving.lists[list].indexOf(moving.key);
        const along = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
        const step = along ? ((event.key === 'ArrowRight') === !isRTL(el) ? 1 : -1) : event.key === 'ArrowDown' ? 1 : -1;
        if (along && transfer.moveTo(list, index + step)) return;
        const names = visibleTabsets(state.layout).map((tabset) => tabset.id);
        const place = along ? (step > 0 ? 0 : Number.MAX_SAFE_INTEGER) : index;
        for (let at = names.indexOf(list) + step; at >= 0 && at < names.length; at += step) {
          if (transfer.moveTo(names[at], place)) break;
        }
        return;
      }
      if (transfer.keydown(event, key)) return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && !modified && tabState(state, key).closable) {
        event.preventDefault();
        api.closeTab(key, { reason: 'remove-press', event });
      }
    }

    const api = {
      getLayout: () => store.get().layout,
      setLayout: (layout: WorkspaceLayoutInput<any, any>, o?: WorkspaceChangeOptions) => apply(normalizeLayout(layout), { ...imperative(o), action: 'set' }),
      getActiveTabsetId: () => activeIn(store.get()) ?? undefined,
      addTab(tab: TabNode<any>, { tabsetId, index, select, ...o }: WorkspaceChangeOptions & { tabsetId?: string; index?: number; select?: boolean } = {}) {
        const state = store.get();
        const open = !!findTab(state.layout, tab.id);
        const next = addTab(state.layout, tab, { tabsetId: tabsetId ?? activeIn(state) ?? undefined, index, select });
        const applied = apply(next, { ...imperative(o), action: open ? 'select' : 'add', tab: tab.id, tabset: tabsetOfTab(next, tab.id)?.id });
        return applied && !open;
      },
      closeTab(tabId: string, o?: WorkspaceChangeOptions) {
        const { layout } = store.get();
        return apply(closeTab(layout, tabId), { ...imperative(o), action: 'close', tab: tabId, tabset: tabsetOfTab(layout, tabId)?.id });
      },
      closeTabset: (tabsetId: string, o?: WorkspaceChangeOptions) =>
        apply(closeTabset(store.get().layout, tabsetId), { ...imperative(o), action: 'close', tabset: tabsetId }),
      moveTab(tabId: string, target: TabDropTarget, o?: WorkspaceChangeOptions) {
        const next = moveTab(store.get().layout, tabId, target);
        return apply(next, { ...imperative(o), action: 'move', tab: tabId, tabset: tabsetOfTab(next, tabId)?.id });
      },
      selectTab(tabId: string, o?: WorkspaceChangeOptions) {
        const { layout } = store.get();
        return apply(selectTab(layout, tabId), { ...imperative(o), action: 'select', tab: tabId, tabset: tabsetOfTab(layout, tabId)?.id });
      },
      updateTab: (tabId: string, changes: Partial<Omit<TabNode<any>, 'id'>>, o?: WorkspaceChangeOptions) =>
        apply(updateTab(store.get().layout, tabId, changes), { ...imperative(o), action: 'update', tab: tabId }),
      updateTabset: (
        tabsetId: string,
        changes: Partial<Pick<Tabset, 'data' | 'keepWhenEmpty' | 'minHeight' | 'minWidth' | 'tabSide'>>,
        o?: WorkspaceChangeOptions,
      ) => apply(updateTabset(store.get().layout, tabsetId, changes), { ...imperative(o), action: 'update', tabset: tabsetId }),
      maximizeTabset: (tabsetId: string, o?: WorkspaceChangeOptions) =>
        apply(maximizeTabset(store.get().layout, tabsetId), { ...imperative(o), action: 'maximize', tabset: tabsetId }),
      restoreTabset(o?: WorkspaceChangeOptions) {
        const { layout } = store.get();
        return apply(restoreTabset(layout), { ...imperative(o), action: 'restore', tabset: layout.maximizedTabsetId });
      },
      internal: {
        /** Each tabset's tab ids as they show now, a tab on the move where it would drop. */
        lists: (state: WorkspaceStore) => transfer.lists(state),
        tabsetLabel,
        tabLabel,
        /** What the Tabs of a tabset report: a tab pressed, or reached with the arrows. */
        select(tabId: string, details: { reason: WorkspaceLayoutChangeReason; event?: Event; source?: ChangeSource }) {
          const { layout } = store.get();
          return apply(selectTab(layout, tabId), { ...details, action: 'select', tab: tabId, tabset: tabsetOfTab(layout, tabId)?.id });
        },
        /** What the Resizable of a split reports on every step of a resize. */
        resize(splitId: string, sizes: readonly number[], details: { reason: WorkspaceLayoutChangeReason; event?: Event; source?: ChangeSource }) {
          const next = resizeSplit(store.get().layout, splitId, sizes);
          return next === store.get().layout || apply(next, { ...details, action: 'resize' }, false);
        },
        /** And once the resize ends. */
        resized(splitId: string, sizes: readonly number[], details: { reason: WorkspaceLayoutChangeReason; event?: Event }) {
          commit('layout', resizeSplit(store.get().layout, splitId, sizes), { ...details, action: 'resize' });
        },
        activate(tabsetId: string) {
          if (store.get().active !== tabsetId) store.set({ active: tabsetId });
        },
        toggleMaximized(tabsetId: string, event?: Event) {
          const o = { reason: 'toggle-press' as const, event };
          return store.get().layout.maximizedTabsetId === tabsetId ? api.restoreTabset(o) : api.maximizeTabset(tabsetId, o);
        },
        keydown,
        pointerdown,
        /** Joins a tab to the moves and to focus recovery. Its trigger is what takes focus when it lands. */
        bindTab(el: HTMLElement, part: { key: string; props: object }) {
          const cleanups = [transfer.bindItem(el.querySelector<HTMLElement>('[role="tab"]') ?? el, part.key), recovery.bind(el, part)];
          return () => cleanups.forEach((cleanup) => cleanup());
        },
      },
    };
    return api;
  },
  slots: (slot) => ({
    root: slot<object, WorkspaceState<any, any>>({
      role: 'group',
      state: (state, { api }) => ({
        layout: state.layout,
        lists: api.internal.lists(state),
        moving: state.moving?.key ?? null,
        dragging: state.dragging !== null,
        disabled: state.disabled,
        activeTabsetId: activeIn(state),
      }),
      attrs: (state) => ({
        'data-disabled': flag(state.disabled),
        'data-dragging': flag(state.dragging !== null),
        'data-maximized': flag(!!state.layout.maximizedTabsetId),
      }),
    }),

    // A split's box, around the Resizable that lays its children out: a named group, so agents and screen
    // readers can tell the splits apart ("Split 1", "Split 2", in layout order).
    split: slot<{ value: string }>({
      role: 'group',
      props: { value: 'string' },
      attrs: (state, { key }) => ({ 'aria-label': `Split ${splitIdsOf(state.layout.root).indexOf(key) + 1}` }),
    }),

    tabset: slot<{ value: string }, WorkspaceTabsetState>({
      role: 'group',
      props: { value: 'string' },
      state: (state, { key }) => tabsetState(state, key),
      attrs(state, { key }) {
        const { active, maximized, empty, tabSide } = tabsetState(state, key);
        return {
          'data-active': flag(active),
          'data-maximized': flag(maximized),
          'data-empty': flag(empty),
          'data-tab-side': tabSide,
        };
      },
      // On the element, not through the framework: a tab's content is rendered elsewhere and shown here.
      bind(el, { api, key }) {
        const activate = () => api.internal.activate(key);
        el.addEventListener('focusin', activate);
        el.addEventListener('pointerdown', activate);
        return () => {
          el.removeEventListener('focusin', activate);
          el.removeEventListener('pointerdown', activate);
        };
      },
    }),

    header: slot<{ value?: string }, WorkspaceTabsetState>({
      props: { value: { kind: 'string', from: 'tabset', required: true } },
      state: (state, { key }) => tabsetState(state, key),
      attrs: (state, { key }) => ({ 'data-tab-side': tabsetState(state, key).tabSide }),
    }),

    tab: slot<{ value: string }, WorkspaceTabState>({
      // The tab itself is the Tabs' part inside; this wraps it with what sits beside it, like its close button.
      role: 'none',
      props: { value: 'string' },
      state: (state, { key }) => tabState(state, key),
      attrs(state, { key }) {
        const { selected, moving, dragging, draggable } = tabState(state, key);
        const tabset = tabsetOfTab(state.layout, key);
        return {
          'data-selected': flag(selected),
          'data-moving': flag(moving),
          'data-dragging': flag(dragging),
          'data-draggable': flag(draggable),
          'data-tab-side': sideOf(state, tabset),
        };
      },
      on: {
        keydown: (event, { api, key, el }) => api.internal.keydown(event, key, el),
        pointerdown: (event, { api, key, el }) => api.internal.pointerdown(event, key, el),
      },
      bind: (el, part) => part.api.internal.bindTab(el, part),
    }),

    'tab-close': slot<{ value?: string }>({
      props: { value: { kind: 'string', from: 'tab', required: true } },
      present: (state, { key }) => tabState(state, key).closable,
      focus: { none: 'Delete on the focused tab closes it, so the button stays out of the tab order (tabindex -1).' },
      // A tablist may own only tabs, so the button is for the pointer alone: Delete on the tab (its description says
      // so) is how a keyboard or screen reader closes it, and agents call `closeTab`.
      attrs: (state, { key }) => ({
        type: 'button', tabindex: '-1', 'aria-hidden': 'true', 'aria-label': `Close ${findTab(state.layout, key)?.title ?? key}`,
      }),
      // Keeps the press from picking the tab up.
      on: { pointerdown: (event) => event.preventDefault() },
      press: ({ api, key }, event) => void api.closeTab(key, { reason: 'remove-press', event }),
    }),

    toolbar: slot<{ value?: string }, WorkspaceTabsetState>({
      props: { value: { kind: 'string', from: 'tabset', required: true } },
      state: (state, { key }) => tabsetState(state, key),
    }),

    maximize: slot<{ value?: string }, WorkspaceTabsetState>({
      props: { value: { kind: 'string', from: 'tabset', required: true } },
      present: (state) => state.layout.root.type === 'split',
      state: (state, { key }) => tabsetState(state, key),
      // The name says what a press does next, so it needs no pressed state.
      attrs: (state, { key }) => ({
        type: 'button',
        'aria-label': state.layout.maximizedTabsetId === key ? 'Restore pane' : 'Maximize pane',
        'data-maximized': flag(state.layout.maximizedTabsetId === key),
      }),
      press: ({ api, key }, event) => void api.internal.toggleMaximized(key, event),
    }),

    panels: slot<{ value?: string }, WorkspaceTabsetState>({
      props: { value: { kind: 'string', from: 'tabset', required: true } },
      state: (state, { key }) => tabsetState(state, key),
      attrs: (state, { key }) => ({ 'data-tab-side': tabsetState(state, key).tabSide }),
    }),

    empty: slot<{ value?: string }>({
      props: { value: { kind: 'string', from: 'tabset', required: true } },
      present: (state, { key }) => !findTabset(state.layout, key)?.tabs.length,
    }),

    'drop-indicator': slot<{ value?: string }, { region: TabDropRegion | null }>({
      role: 'presentation',
      props: { value: { kind: 'string', from: 'tabset', required: true } },
      present: (state, { key }) => state.target?.tabsetId === key,
      state: (state, { key }) => ({ region: state.target?.tabsetId === key ? state.target.region : null }),
      attrs: (state, { key }) => ({ 'data-region': state.target?.tabsetId === key ? state.target.region : undefined }),
    }),
  }),
  agent: { actions: ['selectTab', 'closeTab', 'closeTabset', 'moveTab', 'maximizeTabset', 'restoreTabset'] },
});

/** The workspace's api: what its slots and a controller call. */
export type WorkspaceApi = ReturnType<typeof workspace>['api'];
