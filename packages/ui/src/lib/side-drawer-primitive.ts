import {
  createChange,
  createController,
  definePrimitive,
  type ChangeDetails,
  type ChangeOptions,
} from '@ui-sdk/core';
import { bindBack } from '@/lib/back';
import { bindEdgeSwipe } from '@/lib/edge-swipe';
import { bindSizeClass, type SizeClass } from '@/lib/size-class';
import { createStack, type StackExit } from '@/lib/stack';

/* ══ SideDrawer — one inspector panel, three presentations ══
   `fixed` docks it as a column beside the content; `overlay` slides it over the host from the trailing edge (UI
   SDK's Drawer, rendered by the component, forwards its dismissals here); `push` presents it as a page pushed over
   the host, NavigationStack-style. `auto` (the default) is an overlay that becomes a push while the host is
   compact: the root fills the host and measures it with `bindSizeClass` against `breakpoint`.
   The push is a two-page stack from `createStack`: the host's page, and the drawer on top. Opening pushes it,
   and the back button, Escape, the platform back and an edge swipe (`bindEdgeSwipe`) pop it, each through
   `onOpenChange` with its reason. The page under it parallaxes and follows a swipe from one variable the root writes
   on its host (`--side-drawer-under`, with `data-side-drawer-swiping` / `-settling`): the page opts in with
   `sideDrawerPageClass`, so nothing writes styles on elements the drawer doesn't own. */

export type SideDrawerPresentation = 'fixed' | 'overlay' | 'push' | 'auto';

/** Why the drawer opened or closed: its close or back button (`close-press`), Escape, an outside press, a swipe
 *  (the overlay's toward its edge, or the push's from the leading edge), the platform back, or a controller. */
export type SideDrawerOpenChangeReason =
  | 'close-press'
  | 'trigger-press'
  | 'escape-key'
  | 'outside-press'
  | 'swipe'
  | 'back'
  | 'parent-close'
  | 'action'
  | 'shortcut'
  | 'imperative';

export type SideDrawerOpenChangeDetails = ChangeDetails<SideDrawerOpenChangeReason>;

export type SideDrawerController = {
  isOpen: () => boolean;
  setOpen: (open: boolean, options?: ChangeOptions<SideDrawerOpenChangeReason>) => boolean;
};

/** A handle for a side drawer: pass it as `controller`, then open or close it from anywhere. */
export function createSideDrawerController() {
  return createController<SideDrawerController>();
}

export type SideDrawerOptions = {
  /** Whether it is open, to control it. */
  open?: boolean;
  /** Whether it starts open when uncontrolled. */
  defaultOpen?: boolean;
  /** Runs when it wants to open or close; `details.reason` says why and `details.cancel()` stops it. */
  onOpenChange?: (open: boolean, details: SideDrawerOpenChangeDetails) => void;
  /** How it shows. Default `auto`: an overlay, or a push while the host is compact. */
  presentation?: SideDrawerPresentation;
  /** Host width below which `auto` presents as a push. Default 520. */
  breakpoint?: number;
  controller?: SideDrawerController;
};

type SideDrawerState = {
  open: boolean;
  presentation: SideDrawerPresentation;
  sizeClass: SizeClass;
  pages: string[];
  exiting: StackExit[];
};

/** The presentation that shows now: `auto` resolved against the host's size class. */
export function sideDrawerPresentation(state: Pick<SideDrawerState, 'presentation' | 'sizeClass'>): Exclude<SideDrawerPresentation, 'auto'> {
  if (state.presentation !== 'auto') return state.presentation;
  return state.sizeClass === 'compact' ? 'push' : 'overlay';
}

const pagesOf = (state: Pick<SideDrawerState, 'open' | 'presentation' | 'sizeClass'>) =>
  state.open && sideDrawerPresentation(state) === 'push' ? ['page', 'drawer'] : ['page'];

/** The host attributes that say how far the push covers its page: `--side-drawer-under` (1 pushed, 0 not, the
 *  rest while a swipe scrubs), `data-side-drawer-swiping` while a finger moves it and `data-side-drawer-settling`
 *  from the release until the panel has settled. The page opts in with `sideDrawerPageClass` (the component). */
const UNDER = '--side-drawer-under';
const SWIPING = 'data-side-drawer-swiping';
const SETTLING = 'data-side-drawer-settling';

/** Writes how far the push covers the page under it, on the host. */
function cover(host: HTMLElement | null, amount: number | null) {
  if (!host) return;
  if (amount === null) host.style.removeProperty(UNDER);
  else host.style.setProperty(UNDER, String(amount));
}

/** Clears the swipe's settle attributes once `el`'s transitions have finished. */
function settled(el: HTMLElement, done: () => void) {
  const view = el.ownerDocument.defaultView;
  if (!view) return done();
  view.requestAnimationFrame(() => {
    const running = el.isConnected ? el.getAnimations?.() ?? [] : [];
    void Promise.allSettled(running.map((animation) => animation.finished)).then(done);
  });
}

export const sideDrawer = definePrimitive({
  name: 'side-drawer',
  options: {
    open: 'boolean',
    defaultOpen: 'boolean',
    onOpenChange: 'callback',
    presentation: 'string',
    breakpoint: 'number',
    controller: 'value',
  },
  controlled: ['open'],
  state: (options: SideDrawerOptions): SideDrawerState => {
    const base = { open: options.open ?? options.defaultOpen ?? false, presentation: options.presentation ?? 'auto', sizeClass: 'regular' as SizeClass };
    return { ...base, pages: pagesOf(base), exiting: [] };
  },
  sync: (options) => ({
    presentation: options.presentation ?? 'auto',
    ...(options.open === undefined ? {} : { open: options.open }),
  }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const setOpen = (open: boolean, { reason = 'imperative', event }: ChangeOptions<SideDrawerOpenChangeReason> = {}) =>
      open !== store.get().open && change('open', open, { reason, event });
    const stack = createStack<SideDrawerState, SideDrawerOpenChangeReason>(context, {
      key: 'pages',
      exiting: 'exiting',
      set: (pages, details) => change('open', pages.length > 1, details),
      back: bindBack,
    });
    // The stack follows `open` (and the presentation): it holds the drawer only while it is a pushed page.
    context.onDestroy(
      store.subscribe(() => {
        const state = store.get();
        const pages = pagesOf(state);
        if (pages.length !== state.pages.length) store.set({ pages });
      }),
    );
    return {
      isOpen: () => store.get().open,
      setOpen,
      stack,
      internal: {
        breakpoint: () => context.options().breakpoint ?? 520,
        resized: (sizeClass: SizeClass) => store.set({ sizeClass }),
      },
    };
  },
  slots: (slot) => ({
    root: slot({
      // What the component renders from: the presentation that shows, and the size class it measured.
      state: (state) => ({
        open: state.open,
        presentation: sideDrawerPresentation(state),
        sizeClass: state.presentation === 'auto' ? state.sizeClass : undefined,
      }),
      attrs: (state) => ({
        'data-presentation': sideDrawerPresentation(state),
        'data-size-class': state.presentation === 'auto' ? state.sizeClass : undefined,
        'data-open': state.open ? '' : undefined,
        'data-closed': state.open ? undefined : '',
        // Closed, a fixed column is out of sight: out of the tab order and the accessibility tree too.
        inert: !state.open && sideDrawerPresentation(state) === 'fixed' ? '' : undefined,
      }),
      bind: (el, { api, store }) => {
        // The host's size class, measured only while `auto` needs it.
        let unbindSize: (() => void) | undefined;
        // Whether the page under is covered by a push now.
        let under = false;
        const sync = () => {
          const state = store.get();
          if (state.presentation === 'auto' && !unbindSize) {
            unbindSize = bindSizeClass(el, {
              breakpoints: { medium: api.internal.breakpoint(), regular: Math.max(api.internal.breakpoint(), 1024) },
              onChange: api.internal.resized,
            });
          } else if (state.presentation !== 'auto' && unbindSize) {
            unbindSize();
            unbindSize = undefined;
          }
          // Read again: binding the size class may have just measured the host.
          const now = store.get();
          const want = now.open && sideDrawerPresentation(now) === 'push';
          if (want === under) return;
          under = want;
          cover(el.parentElement, want ? 1 : null);
        };
        sync();
        const stop = store.subscribe(sync);
        return () => {
          stop();
          unbindSize?.();
          cover(el.parentElement, null);
        };
      },
    }),
    dim: slot({
      attrs: () => ({ 'aria-hidden': 'true' }),
    }),
    // The pushed page. Dragged from its leading edge, it follows the finger with the page under it.
    panel: slot({
      present: (state, { api }) => api.stack.present(state, 'drawer'),
      attrs: (state, { api }) => api.stack.pageAttrs(state, 'drawer'),
      bind: (el, { api }) => {
        const unbindPage = api.stack.bindPage(el, 'drawer');
        // The root (dim) and the host (the page under) follow the finger with the panel, then settle on the
        // panel's spring: the stack marks the panel `data-swiping` / `data-swipe-settling`, this marks the others.
        const root = el.parentElement;
        const host = root?.parentElement ?? null;
        const mark = (name: 'swiping' | 'settling', on: boolean) => {
          root?.toggleAttribute(name === 'swiping' ? 'data-swiping' : 'data-swipe-settling', on);
          host?.toggleAttribute(name === 'swiping' ? SWIPING : SETTLING, on);
        };
        const follow = (progress: number) => {
          root?.style.setProperty('--side-drawer-progress', String(progress));
          cover(host, 1 - progress);
        };
        const unbindSwipe = bindEdgeSwipe(el, {
          side: 'start',
          size: 36,
          threshold: 0.32,
          onStart: () => {
            if (!api.stack.swipe.onStart()) return false;
            mark('settling', false);
            mark('swiping', true);
            return true;
          },
          onMove: (progress) => { api.stack.swipe.onMove(progress); follow(progress); },
          onEnd: (committed, details) => {
            // In the same task as the pop, so everything carries on from where the finger let go.
            mark('swiping', false);
            mark('settling', true);
            root?.style.removeProperty('--side-drawer-progress');
            const popped = api.stack.swipe.onEnd(committed, details);
            if (!popped) cover(host, 1);
            settled(el, () => mark('settling', false));
          },
        });
        return () => {
          unbindSwipe();
          unbindPage();
          mark('swiping', false);
          mark('settling', false);
        };
      },
    }),
    bar: slot({}),
    back: slot({
      role: 'button',
      focus: 'native',
      press: ({ api }, event) => api.stack.pop({ reason: 'close-press', event }),
    }),
    close: slot({
      role: 'button',
      focus: 'native',
      press: ({ api }, event) => api.setOpen(false, { reason: 'close-press', event }),
    }),
  }),
  agent: { actions: ['setOpen'] },
});
