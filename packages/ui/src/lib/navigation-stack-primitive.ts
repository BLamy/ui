import {
  createChange,
  createController,
  definePrimitive,
  type ChangeDetails,
} from '@ui-sdk/core';
import { bindBack } from '@/lib/back';
import { bindEdgeSwipe } from '@/lib/edge-swipe';
import { bindPullToRefresh } from '@/lib/pull-to-refresh';
import { bindScrollEdge } from '@/lib/scroll-edge';
import { bindSizeClass, type SizeClass } from '@/lib/size-class';
import { createPageStack, type PageStackExit, type PageStackReason } from '@/lib/stack';

/* ══ navigationStack — iOS's UINavigationController as a primitive ══
   A stack of pages, bottom to top, kept in `pages` (a list of page keys) by `createPageStack` (`lib/stack`): a pushed page
   slides in over the others, covered pages are inert, focus goes into a pushed page and back to what pushed it on a
   pop, and Escape, the platform back (`bindBack`) and a swipe from the leading edge (`bindEdgeSwipe`) pop the top
   page, the innermost stack first. Each page has a bar (back button, title, leading and trailing items), a scrolling
   content area with an optional large title and pull to refresh (`bindPullToRefresh`), and a shade that dims it
   while it is covered. Scrolling past the large title marks the page `data-scrolled` (the bar fades in its
   background and inline title); scrolling down hides the bar, scrolling up or reaching the top brings it back, and
   the top page's bar reports that through `onBarHiddenChange` so shared chrome can follow. The root measures its
   own size class (`bindSizeClass`) and keeps it in state, so the renderer can provide it to what is inside.
   A swipe released past or short of the commit point settles the two pages with `data-swipe-settling`. Scrolling
   is followed with `bindScrollEdge` (lib/scroll-edge, shared with SplitView's panes); the edge swipe is reported
   to `internal.onSwipe` listeners, which the title flight scrubs with.
   No React in here: render it with `createParts(navigationStack, { root: 'div', page: 'section', … })`. ══ */

/** Why the pages changed: Escape, the platform back, an edge swipe, a back or push button, or code. */
export type NavigationStackReason = PageStackReason | 'trigger-press';

/** What `onPagesChange` receives besides the new pages. `cancel()` keeps the pages as they were. */
export type NavigationStackChangeDetails = ChangeDetails<NavigationStackReason>;

/** What every change method takes last. */
export interface NavigationStackChangeOptions {
  reason?: NavigationStackReason;
  event?: Event;
}

/** Drives a stack from anywhere: create one with `createNavigationStackController()` and pass it as `controller`. */
export type NavigationStackController = {
  /** Puts a page on top. False when it is in the stack already, or the change was canceled. */
  push: (page: string, options?: NavigationStackChangeOptions) => boolean;
  /** Takes the top page off. False on the first page. */
  pop: (options?: NavigationStackChangeOptions) => boolean;
  /** Takes off every page above `page`. False when it is on top or not in the stack. */
  popTo: (page: string, options?: NavigationStackChangeOptions) => boolean;
  /** Swaps the top page for another, which enters like a push. */
  replace: (page: string, options?: NavigationStackChangeOptions) => boolean;
  /** Runs the pull-to-refresh of a page (the top one by default), as if it had been pulled. */
  refresh: (page?: string) => void;
  /** The pages now, bottom to top. */
  getPages: () => string[];
};

/** A handle for a stack: pass it as `controller`, then call it from anywhere. */
export function createNavigationStackController() {
  return createController<NavigationStackController>();
}

export interface NavigationStackOptions {
  /** The pages, bottom to top, by key. Pass it to control the stack. */
  pages?: string[];
  /** The pages it starts with, when `pages` is left out. */
  defaultPages?: string[];
  /** Asks for new pages: a push, a pop (back button, Escape, platform back, edge swipe) or a controller call. */
  onPagesChange?: (pages: string[], details: NavigationStackChangeDetails) => void;
  /** Drives the stack from outside. */
  controller?: NavigationStackController;
  /** The back button of the first page, when there is something around the stack to go back to (a collapsed
   *  SplitView's previous column). The first page shows a back button only while this is set. */
  onRootBack?: (details: { event?: Event }) => void;
  /** The top page's bar hid (scrolling down) or came back. */
  onBarHiddenChange?: (hidden: boolean) => void;
}

/** The primitive's state (what its parts render from). */
export interface NavigationStackState {
  pages: string[];
  exiting: PageStackExit[];
  /** The root's own size class, once measured. */
  sizeClass: SizeClass | undefined;
  /** Pages scrolled past their large title (or a few px without one). */
  scrolled: string[];
  /** Pages whose bar scrolling has hidden. */
  hidden: string[];
  /** Pages with a large title. */
  large: string[];
  /** Pages with a refresh under way. */
  refreshing: string[];
}

/** What each page's parts render from. */
export interface NavigationStackPageState {
  /** The page's place in the stack, from 0 at the bottom; a page leaving keeps the place it had. */
  depth: number;
  /** Under the top page (or leaving under the page that replaced it). */
  covered: boolean;
  /** Animating out. */
  leaving: boolean;
  /** The key of the page under it, which its back button goes back to; null on the first page. */
  previous: string | null;
  scrolled: boolean;
  hidden: boolean;
  large: boolean;
  refreshing: boolean;
}

/** What a swipe that pops the top page tells its listeners (the title flight): it started with the top page and
 *  the one under it, it moved to `progress` (0..1), or it ended, popping the page or springing back. */
export type NavigationStackSwipe =
  | { phase: 'start'; top: HTMLElement; under: HTMLElement | null }
  | { phase: 'move'; progress: number }
  | { phase: 'end'; popped: boolean };

/** Edge swipe: how wide the leading strip is (px) and how far, as a fraction of the stack's width, a swipe commits. */
const EDGE = 36;
const COMMIT = 0.32;
/** The pull (px) that refreshes, which the content then holds at, and the least time a refresh is shown. */
const PULL = 52;
const HOLD_MS = 1100;
/** The top of the content that counts as not scrolled, with and without a large title (px). */
const SCROLLED_LARGE = 44;
const SCROLLED = 8;
/** Rows the arrow keys move between. */
const ROW = '[data-tkrow]';
/** Where Up and Down belong to what has focus: text entry, a select, and the widgets whose value or cursor they move. */
const OWNS_ARROWS =
  'input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=slider],[role=spinbutton],[role=listbox],[role=menu],[role=grid],[role=tree],[role=radiogroup],[role=combobox]';

const toggled = (list: string[], key: string, on: boolean) =>
  on === list.includes(key) ? list : on ? [...list, key] : list.filter((k) => k !== key);

const pagePart = { value: { kind: 'string', from: 'page.value', required: true } } as const;

export const navigationStack = definePrimitive({
  name: 'navigation-stack',
  options: {
    pages: 'list',
    defaultPages: 'list',
    onPagesChange: 'callback',
    controller: 'value',
    onRootBack: 'action',
    onBarHiddenChange: 'callback',
  },
  controlled: ['pages'],
  state: (options: NavigationStackOptions): NavigationStackState => ({
    pages: options.pages ?? options.defaultPages ?? [],
    exiting: [],
    sizeClass: undefined,
    scrolled: [],
    hidden: [],
    large: [],
    refreshing: [],
  }),
  sync: (options) => (options.pages === undefined ? {} : { pages: options.pages }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const stack = createPageStack<NavigationStackState, NavigationStackReason>(context, {
      key: 'pages',
      exiting: 'exiting',
      set: (value, details) => change('pages', value, details),
      back: bindBack,
    });
    const pullers = new Map<string, () => void>();
    // The stack's own swipe handlers, also reported to whoever follows the swipe.
    const swipers = new Set<(swipe: NavigationStackSwipe) => void>();
    const tell = (swipe: NavigationStackSwipe) => swipers.forEach((fn) => fn(swipe));
    const swipe = {
      onStart() {
        if (!stack.swipe.onStart()) return false;
        const [under, top] = store.get().pages.slice(-2);
        const el = (key: string | undefined) => (key === undefined ? null : context.element('page', key) ?? null);
        const topEl = el(top);
        if (topEl) tell({ phase: 'start', top: topEl, under: el(under) });
        return true;
      },
      onMove(progress: number) {
        stack.swipe.onMove(progress);
        tell({ phase: 'move', progress });
      },
      onEnd(committed: boolean, details: { event: Event }) {
        tell({ phase: 'end', popped: stack.swipe.onEnd(committed, details) });
      },
    };
    const toggle = (key: 'scrolled' | 'hidden' | 'large' | 'refreshing', page: string, on: boolean) => {
      const list = store.get()[key];
      const next = toggled(list, page, on);
      if (next !== list) store.set({ [key]: next });
    };

    // The top page's bar speaks for the shared chrome. A first page at rest has nothing to say (it would only
    // un-hide another stack's chrome); once it has spoken, every change of the top page or its bar is reported,
    // and leaving hands the chrome back.
    let published: boolean | undefined;
    const publish = () => {
      const { pages, hidden } = store.get();
      const top = pages.at(-1);
      const now = top !== undefined && hidden.includes(top);
      if (now === published || (published === undefined && pages.length < 2 && !now)) return;
      published = now;
      context.options().onBarHiddenChange?.(now);
    };
    context.onDestroy(store.subscribe(publish));
    context.onDestroy(() => {
      if (published) context.options().onBarHiddenChange?.(false);
    });

    const pageState = (state: NavigationStackState, key: string): NavigationStackPageState => {
      const index = state.pages.indexOf(key);
      const exit = stack.exitOf(state, key);
      const covered = exit ? exit.covered : index !== state.pages.length - 1;
      return {
        depth: index === -1 ? state.pages.length - (exit?.covered ? 1 : 0) : index,
        covered,
        leaving: !!exit,
        previous: index > 0 ? state.pages[index - 1] : index === -1 && !exit?.covered ? state.pages.at(-1) ?? null : null,
        scrolled: state.scrolled.includes(key),
        hidden: state.hidden.includes(key),
        large: state.large.includes(key),
        refreshing: state.refreshing.includes(key),
      };
    };

    const api = {
      stack,
      push: (page: string, { reason = 'imperative', event }: NavigationStackChangeOptions = {}) =>
        stack.push(page, { reason, event }),
      pop: ({ reason = 'imperative', event }: NavigationStackChangeOptions = {}) => stack.pop({ reason, event }),
      popTo: (page: string, { reason = 'imperative', event }: NavigationStackChangeOptions = {}) =>
        stack.popTo(page, { reason, event }),
      replace: (page: string, { reason = 'imperative', event }: NavigationStackChangeOptions = {}) =>
        stack.replace(page, { reason, event }),
      refresh: (page?: string) => {
        const key = page ?? store.get().pages.at(-1);
        if (key !== undefined) pullers.get(key)?.();
      },
      getPages: () => store.get().pages,
      pageState,
      internal: {
        /** What the root's edge swipe runs: the stack's swipe, reported to `onSwipe` listeners. */
        swipe,
        /** Follows the edge swipe (the title flight scrubs with it). Returns the unsubscribe. */
        onSwipe(fn: (swipe: NavigationStackSwipe) => void) {
          swipers.add(fn);
          return () => { swipers.delete(fn); };
        },
        /** The root's size class changed. */
        resized: (sizeClass: SizeClass) => store.set({ sizeClass }),
        /** A back button: the page under it, or what is around the stack from its first page. */
        back(event?: Event) {
          if (stack.pop({ reason: 'trigger-press', event })) return;
          context.options().onRootBack?.({ event });
        },
        /** Follows a page's scroller: past the large title, and the bar's hide on scroll. */
        bindScroll(el: HTMLElement, page: string) {
          const off = bindScrollEdge(el, {
            threshold: () => (store.get().large.includes(page) ? SCROLLED_LARGE : SCROLLED),
            onChange: (scrolled) => toggle('scrolled', page, scrolled),
            onScroll: (y, dy) => {
              const bar = context.element('bar', page);
              const hides = !!bar && context.props<{ hideOnScroll?: boolean }>('bar', page)?.hideOnScroll !== false;
              if (!hides || pageState(store.get(), page).covered) toggle('hidden', page, false);
              else if (y < (bar?.offsetHeight ?? 52) * 0.7) toggle('hidden', page, false);
              else if (dy > 5) toggle('hidden', page, true);
              else if (dy < -5) toggle('hidden', page, false);
            },
          });
          return () => {
            off();
            toggle('scrolled', page, false);
            toggle('hidden', page, false);
          };
        },
        /** Pull to refresh on a page's scroller, held for a moment at least, however fast it settles. */
        bindPull(el: HTMLElement, page: string) {
          const onRefresh = () => context.props<{ onRefresh?: () => unknown }>('content', page)?.onRefresh;
          const pull = bindPullToRefresh(el, {
            threshold: PULL,
            disabled: () => !onRefresh() || store.get().refreshing.includes(page),
            onRefresh: () => {
              toggle('refreshing', page, true);
              const held = new Promise((done) => setTimeout(done, HOLD_MS));
              const work = Promise.resolve().then(() => onRefresh()?.());
              return Promise.allSettled([held, work]).then(() => toggle('refreshing', page, false));
            },
          });
          pullers.set(page, pull.refresh);
          return () => {
            if (pullers.get(page) === pull.refresh) pullers.delete(page);
            toggle('refreshing', page, false);
            pull();
          };
        },
        markLarge(page: string) {
          toggle('large', page, true);
          return () => toggle('large', page, false);
        },
        /** Up and Down move between the rows of the page (each its own tab stop), as on a hardware keyboard.
         *  A walk over the DOM on purpose, not `createRovingFocus`: the rows are other components' parts (ListRow,
         *  a block's own rows) marked `data-tkrow`, not parts of this primitive, and each keeps its own tab stop
         *  (iOS's full keyboard access), so there is no group tab stop to manage. Document order is row order. */
        rowKeys(event: KeyboardEvent, page: HTMLElement) {
          if (event.defaultPrevented || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
          // A field, or a control that moves with the arrows itself, keeps them.
          if (event.target instanceof Element && event.target.closest(OWNS_ARROWS)) return;
          const rows = [...page.querySelectorAll<HTMLElement>(ROW)].filter(
            (r) => r.offsetParent && r.closest('[data-slot=navigation-stack-page]') === page,
          );
          const i = rows.indexOf(page.ownerDocument.activeElement as HTMLElement);
          const n = event.key === 'ArrowDown'
            ? (i < 0 ? 0 : Math.min(i + 1, rows.length - 1))
            : (i < 0 ? rows.length - 1 : Math.max(i - 1, 0));
          if (rows[n]) {
            rows[n].focus();
            event.preventDefault();
          }
        },
      },
    };
    return api;
  },
  slots: (slot) => ({
    root: slot<object, { pages: string[]; exiting: PageStackExit[]; sizeClass: SizeClass | undefined }>({
      state: (state) => ({ pages: state.pages, exiting: state.exiting, sizeClass: state.sizeClass }),
      bind: (el, { api }) => {
        const offSwipe = bindEdgeSwipe(el, { size: EDGE, threshold: COMMIT, ...api.internal.swipe });
        const offSize = bindSizeClass(el, { onChange: api.internal.resized });
        return () => {
          offSwipe();
          offSize();
        };
      },
    }),
    page: slot<{ value: string }, NavigationStackPageState>({
      props: { value: 'string' },
      // In the stack, animating out, or popped by a controlled `pages` the stack is about to hear of.
      present: (state, { api, key }) => api.stack.present(state, key),
      state: (state, { api, key }) => api.pageState(state, key),
      attrs: (state, { api, key }) => ({
        ...api.stack.pageAttrs(state, key),
        'data-value': key,
        'data-scrolled': state.scrolled.includes(key) ? '' : undefined,
      }),
      // A push lands on the page itself, so the keyboard continues from its top.
      bind: (el, { api, key }) => api.stack.bindPage(el, key, { initialFocus: () => el }),
      on: { keydown: (event, { api, el }) => el && api.internal.rowKeys(event, el) },
    }),
    bar: slot<{ value?: string; hideOnScroll?: boolean }, NavigationStackPageState>({
      props: { ...pagePart, hideOnScroll: 'boolean' },
      state: (state, { api, props }) => api.pageState(state, props.value ?? ''),
      attrs: (state, { props }) => ({ 'data-hidden': state.hidden.includes(props.value ?? '') ? '' : undefined }),
    }),
    title: slot<{ value?: string; showOnScroll?: boolean }, NavigationStackPageState>({
      props: { ...pagePart, showOnScroll: 'boolean' },
      state: (state, { api, props }) => api.pageState(state, props.value ?? ''),
    }),
    back: slot<{ value?: string }, NavigationStackPageState>({
      props: pagePart,
      state: (state, { api, props }) => api.pageState(state, props.value ?? ''),
      attrs: () => ({ type: 'button' }),
      press: ({ api }, event) => api.internal.back(event),
    }),
    leading: slot<{ value?: string }>({ props: pagePart }),
    trailing: slot<{ value?: string }>({ props: pagePart }),
    content: slot<{ value?: string; onRefresh?: () => unknown }, NavigationStackPageState>({
      props: { ...pagePart, onRefresh: 'action' },
      state: (state, { api, props }) => api.pageState(state, props.value ?? ''),
      bind: (el, { api, props }) => {
        const offScroll = api.internal.bindScroll(el, props.value ?? '');
        const offPull = api.internal.bindPull(el, props.value ?? '');
        return () => {
          offScroll();
          offPull();
        };
      },
    }),
    'large-title': slot<{ value?: string }>({
      props: pagePart,
      bind: (_el, { api, props }) => api.internal.markLarge(props.value ?? ''),
    }),
    subheader: slot<{ value?: string }>({ props: pagePart }),
    'refresh-indicator': slot<{ value?: string }, NavigationStackPageState>({
      props: pagePart,
      state: (state, { api, props }) => api.pageState(state, props.value ?? ''),
      attrs: () => ({ 'aria-hidden': 'true' }),
    }),
    shade: slot<{ value?: string }>({
      props: pagePart,
      attrs: () => ({ 'aria-hidden': 'true' }),
    }),
  }),
  agent: { actions: ['push', 'pop', 'popTo', 'replace', 'refresh'] },
});
