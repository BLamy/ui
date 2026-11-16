import {
  createChange,
  createController,
  createResize,
  css,
  definePrimitive,
  isRTL,
  type ChangeDetails,
  type ChangeOptions,
  type ResizeBox,
  type ResizeDraft,
  type Side,
} from '@ui-sdk/core';
import { bindBack } from '@/lib/back';
import { bindEdgeSwipe } from '@/lib/edge-swipe';
import { createPageStack, type PageStackExit } from '@/lib/stack';

/* ══ AdaptivePane — one region, five presentations ══
   `column` docks the pane beside its siblings, `drawer` moves it over the host from its side (UI SDK's Drawer,
   rendered by the component as a contained Sheet, forwards its dismissals to `open` here), `push` presents it as a
   page pushed over the host from the trailing edge, NavigationStack-style, `cover` fills the host, `hidden` takes it
   off screen. `open` says whether it shows in any of them. The component resolves `auto` before it gets here.
   Its children stay mounted through every change.

   A column or a drawer can be resizable: a separator on the edge it shares with the page drags its width
   (`createResize`), steps it with the arrow keys (Shift for more), goes to its limits with Home and End, and returns
   to the host's width with Enter or a double-click. Widths are kept per presentation. A closed drawer can also open
   by a swipe from the host's edge (`swipeToOpen`, `bindEdgeSwipe`), past a third of the host or with a flick.

   The push is a two-page stack from `createPageStack`: the host's page, and the pane on top. Opening pushes it, and the
   close part, Escape, the platform back and a swipe from its leading edge pop it, each through `onOpenChange` with
   its reason. While it covers the page, the host's other children are inert, and the page parallaxes and follows a
   swipe from one variable the root writes on its host (`--adaptive-pane-under`, with `data-adaptive-pane-swiping` /
   `-settling`): the page opts in with `adaptivePanePageClass`, so nothing writes styles on elements the pane doesn't
   own. `side` is UI SDK's: `start` and `end` follow the reading direction. */

/** The edge a pane sits on: `start` or `end`, which follow the reading direction. */
export type AdaptivePaneSide = Extract<Side, 'start' | 'end'>;

/** How the pane shows. `auto` (the component's default) picks one of the others from the size-class scope. */
export type AdaptivePanePresentation = 'column' | 'drawer' | 'push' | 'cover' | 'hidden' | 'auto';

/** A presentation that shows: `auto` resolved. */
export type AdaptivePaneShown = Exclude<AdaptivePanePresentation, 'auto'>;

/** The widths the user resized the pane to, per presentation; unset means the host's own width applies. */
export type AdaptivePaneWidths = { column?: number; drawer?: number };

/** Why the widths changed: a drag of the separator, its arrow, Home or End keys (`resize-key`), Enter or a
 *  double-click back to the host's width (`size-reset`), or a controller. */
export type AdaptivePaneWidthsChangeReason = 'drag' | 'resize-key' | 'size-reset' | 'imperative';
export type AdaptivePaneWidthsChangeDetails = ChangeDetails<AdaptivePaneWidthsChangeReason>;

/** Why the pane opened or closed: its close part (`close-press`), the drawer's dismissals (Escape, the scrim, a
 *  swipe toward its edge), a swipe (from the host's edge to open, from a pushed page's leading edge to pop), the
 *  platform back, or a controller. */
export type AdaptivePaneOpenChangeReason =
  | 'trigger-press'
  | 'close-press'
  | 'outside-press'
  | 'escape-key'
  | 'parent-close'
  | 'back'
  | 'action'
  | 'shortcut'
  | 'swipe'
  | 'imperative';
export type AdaptivePaneOpenChangeDetails = ChangeDetails<AdaptivePaneOpenChangeReason>;

export type AdaptivePaneController = {
  isOpen: () => boolean;
  setOpen: (open: boolean, options?: ChangeOptions<AdaptivePaneOpenChangeReason>) => boolean;
  getWidths: () => AdaptivePaneWidths;
  setWidths: (widths: AdaptivePaneWidths, options?: ChangeOptions<AdaptivePaneWidthsChangeReason>) => boolean;
};

/** A handle for a pane: pass it as `controller`, then open it or set its widths from anywhere. */
export function createAdaptivePaneController() {
  return createController<AdaptivePaneController>();
}

export type AdaptivePaneOptions = {
  /** The presentation that shows now (the component resolves `auto`). */
  presentation: AdaptivePaneShown;
  /** Whether the pane shows, to control it. */
  open?: boolean;
  /** Whether it starts open when uncontrolled. Default false. */
  defaultOpen?: boolean;
  /** Runs when it wants to open or close; `details.reason` says why and `details.cancel()` stops it. */
  onOpenChange?: (open: boolean, details: AdaptivePaneOpenChangeDetails) => void;
  /** The resized widths, to control them. */
  widths?: AdaptivePaneWidths;
  defaultWidths?: AdaptivePaneWidths;
  /** Runs when a resize settles (a drag let go, a key, a reset), with every presentation's width. */
  onWidthsChange?: (widths: AdaptivePaneWidths, details: AdaptivePaneWidthsChangeDetails) => void;
  /** The edge the pane sits on. Default `start`. */
  side?: AdaptivePaneSide;
  /** Narrowest a resized pane gets, px. Default 160. */
  minWidth?: number;
  /** Widest a resized pane gets, px. A column never takes the last 240px of its host, a drawer the last 48px. */
  maxWidth?: number;
  /** A closed drawer opens by a swipe from the host's edge. */
  swipeToOpen?: boolean;
  controller?: AdaptivePaneController;
};

type AdaptivePaneState = {
  presentation: AdaptivePaneShown;
  side: AdaptivePaneSide;
  /** Whether the pane reads right to left, measured with the separator. */
  rtl: boolean;
  open: boolean;
  widths: AdaptivePaneWidths;
  /** The pane as measured when a resize starts: the box `createResize` changes. */
  box: ResizeBox;
  /** The host's width, measured when a resize starts (Infinity before). */
  host: number;
  draft: ResizeDraft | null;
  /** The push's stack: the host's page, and the pane while it is pushed. */
  pages: string[];
  exiting: PageStackExit[];
};

/** Width a resized pane leaves for what is beside it. */
const KEEP = { column: 240, drawer: 48 } as const;
const STEP = 16;

/** The separator's handle: the pane's inner edge on screen. */
const handleOf = (state: Pick<AdaptivePaneState, 'side' | 'rtl'>) => ((state.side === 'start') !== state.rtl ? 'e' : 'w');

/** The box an absolutely placed element is laid out in: its offset parent, else its nearest positioned ancestor. */
const containingBox = (el: HTMLElement): HTMLElement => {
  if (el.offsetParent instanceof HTMLElement) return el.offsetParent;
  const view = el.ownerDocument.defaultView;
  for (let p = el.parentElement; p && view; p = p.parentElement) if (/^(relative|absolute|fixed|sticky)$/.test(view.getComputedStyle(p).position)) return p;
  return el;
};

const resizing = (state: Pick<AdaptivePaneState, 'presentation'>) =>
  state.presentation === 'column' || state.presentation === 'drawer' ? state.presentation : null;

const pushed = (state: Pick<AdaptivePaneState, 'open' | 'presentation'>) => state.open && state.presentation === 'push';
const pagesOf = (state: Pick<AdaptivePaneState, 'open' | 'presentation'>) => (pushed(state) ? ['page', 'pane'] : ['page']);

/** Whether the pane is on screen as a box of the host's layout (a column or a cover), rather than a layer. */
const inLayout = (state: Pick<AdaptivePaneState, 'presentation'>) => state.presentation === 'column' || state.presentation === 'cover';

/** The host attributes that say how far a push covers its page: `--adaptive-pane-under` (1 pushed, 0 not, the rest
 *  while a swipe scrubs), `data-adaptive-pane-swiping` while a finger moves it and `data-adaptive-pane-settling`
 *  from the release until the page has settled. The page opts in with `adaptivePanePageClass` (the component). */
const UNDER = '--adaptive-pane-under';
const SWIPING = 'data-adaptive-pane-swiping';
const SETTLING = 'data-adaptive-pane-settling';

/** Writes how far the push covers the page under it, on the host. */
function cover(host: HTMLElement | null, amount: number | null) {
  if (!host) return;
  if (amount === null) host.style.removeProperty(UNDER);
  else host.style.setProperty(UNDER, String(amount));
}

/** Makes the host's other children inert while a push covers them (and gives back only what it took). */
function inertSiblings(root: HTMLElement): () => void {
  const host = root.parentElement;
  if (!host) return () => undefined;
  const taken: HTMLElement[] = [];
  for (const child of host.children) {
    if (child === root || !(child instanceof HTMLElement) || child.hasAttribute('inert')) continue;
    child.setAttribute('inert', '');
    taken.push(child);
  }
  return () => { for (const child of taken) child.removeAttribute('inert'); };
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

export const adaptivePane = definePrimitive({
  name: 'adaptive-pane',
  options: {
    presentation: 'string',
    open: 'boolean',
    defaultOpen: 'boolean',
    onOpenChange: 'callback',
    widths: 'value',
    defaultWidths: 'value',
    onWidthsChange: 'callback',
    side: 'string',
    minWidth: 'number',
    maxWidth: 'number',
    swipeToOpen: 'boolean',
    controller: 'value',
  },
  controlled: ['open', 'widths'],
  state: (options: AdaptivePaneOptions): AdaptivePaneState => {
    const base = { presentation: options.presentation, open: options.open ?? options.defaultOpen ?? false };
    return {
      ...base,
      side: options.side ?? 'start',
      rtl: false,
      widths: options.widths ?? options.defaultWidths ?? {},
      box: { x: 0, y: 0, width: 0, height: 1 },
      host: Infinity,
      draft: null,
      pages: pagesOf(base),
      exiting: [],
    };
  },
  sync: (options) => ({
    presentation: options.presentation,
    side: options.side ?? 'start',
    ...(options.open === undefined ? {} : { open: options.open }),
    ...(options.widths === undefined ? {} : { widths: options.widths }),
  }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const limits = (state: Pick<AdaptivePaneState, 'presentation' | 'host'> = store.get()) => {
      const { minWidth = 160, maxWidth = Infinity } = context.options();
      const which = resizing(state) ?? 'column';
      return { min: minWidth, max: Math.max(minWidth, Math.min(maxWidth, state.host - KEEP[which])) };
    };
    const resize = createResize<AdaptivePaneState>(context, {
      boxes: (state) => ({ pane: state.box }),
      draft: 'draft',
      set: (value, details) => {
        const which = resizing(store.get());
        if (!which) return false;
        const done = change('widths', { ...store.get().widths, [which]: Math.round(value.pane.width) }, details);
        if (done) store.set({ box: value.pane });
        return done;
      },
      min: () => ({ width: limits().min, height: 1 }),
      max: () => ({ width: limits().max, height: 1 }),
      label: () => 'Pane',
    });
    const handle = () => handleOf(store.get());
    const setOpen = (open: boolean, { reason = 'imperative', event }: ChangeOptions<AdaptivePaneOpenChangeReason> = {}) =>
      open !== store.get().open && change('open', open, { reason, event });
    const setWidths = (widths: AdaptivePaneWidths, { reason = 'imperative', event }: ChangeOptions<AdaptivePaneWidthsChangeReason> = {}) =>
      change('widths', widths, { reason, event });
    const stack = createPageStack<AdaptivePaneState, AdaptivePaneOpenChangeReason>(context, {
      key: 'pages',
      exiting: 'exiting',
      set: (pages, details) => change('open', pages.length > 1, details),
      back: bindBack,
    });
    // The stack follows `open` and the presentation: it holds the pane only while it is a pushed page.
    context.onDestroy(
      store.subscribe(() => {
        const state = store.get();
        const pages = pagesOf(state);
        if (pages.length !== state.pages.length) store.set({ pages });
      }),
    );
    /** Measures the pane (the separator's parent), its host and its direction, so a resize starts from what is on
     *  screen. */
    const measure = (separator: HTMLElement) => {
      const pane = separator.parentElement;
      if (!pane) return;
      store.set({
        rtl: isRTL(separator),
        host: pane.parentElement?.clientWidth || Infinity,
        box: { x: 0, y: 0, width: pane.getBoundingClientRect().width, height: 1 },
      });
    };
    const reset = (event?: Event) => {
      const which = resizing(store.get());
      if (!which || store.get().widths[which] === undefined) return false;
      return change('widths', { ...store.get().widths, [which]: undefined }, { reason: 'size-reset', event });
    };
    return {
      isOpen: () => store.get().open,
      setOpen,
      getWidths: () => store.get().widths,
      setWidths,
      resize,
      stack,
      internal: {
        swipeToOpen: () => !!context.options().swipeToOpen,
        limits,
        /** The width to show for the presentation now: the draft's while dragging, else the resized one. */
        width(state: AdaptivePaneState): number | undefined {
          const which = resizing(state);
          if (!which) return undefined;
          return state.draft ? Math.round(state.draft.box.width) : state.widths[which];
        },
        measure,
        reset,
        /** The close part: a pushed page pops (back), any other presentation closes. */
        close(event?: Event) {
          if (pushed(store.get())) return stack.pop({ reason: 'close-press', event });
          return setOpen(false, { reason: 'close-press', event });
        },
        keydown(event: KeyboardEvent, el: HTMLElement) {
          if (!resizing(store.get()) || event.altKey || event.metaKey || event.ctrlKey) return;
          measure(el);
          const why = { reason: 'resize-key' as const, event };
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            // The arrows move the separator's edge on screen; Shift moves it three steps.
            resize.resizeBy('pane', handle(), (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 3 : 1) * STEP, 0, why);
          } else if (event.key === 'Home' || event.key === 'End') {
            const { min, max } = limits();
            resize.resizeTo('pane', { ...store.get().box, width: event.key === 'Home' ? min : max }, why, handle());
          } else if (event.key === 'Enter') {
            reset(event);
          } else return;
          event.preventDefault();
        },
      },
    };
  },
  slots: (slot) => ({
    root: slot({
      // What the component renders from: the presentation, whether it shows, and whether a resize is being
      // dragged. The width itself is only a variable here, so a drag repaints the pane without re-rendering what
      // is in it.
      state: (state) => ({ presentation: state.presentation, side: state.side, open: state.open, dragging: !!state.draft }),
      attrs: (state, { api }) => {
        const width = api.internal.width(state);
        return {
          'data-presentation': state.presentation,
          'data-side': state.side,
          'data-open': state.open ? '' : undefined,
          'data-closed': state.open ? undefined : '',
          'data-dragging': state.draft ? '' : undefined,
          // Out of sight, out of the tab order and the accessibility tree too. A closed drawer or push stays
          // rendered (its panel animates out and keeps the children's dock).
          hidden: state.presentation === 'hidden' || (inLayout(state) && !state.open) ? '' : undefined,
          // The width the user resized to (the draft's while dragging); unset, the host's own width applies.
          style: css({ '--adaptive-pane-w': width === undefined ? undefined : `${width}px` }),
        };
      },
      bind: (el, { store }) => {
        // Whether a push covers the page under it now.
        let under = false;
        let release: (() => void) | undefined;
        const sync = () => {
          const want = pushed(store.get());
          if (want === under) return;
          under = want;
          cover(el.parentElement, want ? 1 : null);
          release?.();
          release = want ? inertSiblings(el) : undefined;
        };
        sync();
        const stop = store.subscribe(sync);
        return () => {
          stop();
          release?.();
          cover(el.parentElement, null);
        };
      },
    }),
    // The divider on the pane's inner edge.
    resizer: slot({
      role: 'separator',
      focus: 'tab-stop',
      keys: ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'],
      attrs: (state, { api }) => {
        const { min, max } = api.internal.limits(state);
        return {
          ...api.resize.handleAttrs(handleOf(state)),
          tabindex: '0',
          'aria-orientation': 'vertical',
          'aria-valuenow': String(Math.round(api.resize.box(state, 'pane')?.width ?? 0)),
          'aria-valuemin': String(min),
          'aria-valuemax': Number.isFinite(max) ? String(Math.round(max)) : undefined,
          'data-dragging': state.draft ? '' : undefined,
          // A drag here resizes the pane rather than the drawer around it.
          'data-drawer-no-drag': '',
        };
      },
      on: {
        pointerdown: (event, { el, api, store }) => {
          if (!el) return;
          api.internal.measure(el);
          api.resize.pointerdown(event, 'pane', handleOf(store.get()), el);
        },
        keydown: (event, { el, api }) => { if (el) api.internal.keydown(event, el); },
        dblclick: (event, { api }) => { api.internal.reset(event); },
      },
      bind: (el, { api }) => {
        api.internal.measure(el);
        return () => undefined;
      },
    }),
    // A strip along the host's edge that a swipe opens the closed drawer from. The swipe is measured on the host
    // the strip is placed in, so it commits past a third of the host's width or with a flick,
    // not as soon as it leaves the strip.
    edge: slot({
      present: (state, { api }) => state.presentation === 'drawer' && !state.open && !!api.internal.swipeToOpen(),
      attrs: () => ({ 'aria-hidden': 'true' }),
      bind: (el, { api, store }) =>
        bindEdgeSwipe(containingBox(el), {
          side: store.get().side,
          size: el.offsetWidth || 16,
          onEnd: (committed, { event }) => { if (committed) api.setOpen(true, { reason: 'swipe', event }); },
        }),
    }),
    // The dim over the page under a push.
    dim: slot({
      attrs: () => ({ 'aria-hidden': 'true' }),
    }),
    // The pushed page. Dragged from its leading edge, it follows the finger with the page under it.
    page: slot({
      present: (state, { api }) => api.stack.present(state, 'pane'),
      attrs: (state, { api }) => api.stack.pageAttrs(state, 'pane'),
      bind: (el, { api }) => {
        const unbindPage = api.stack.bindPage(el, 'pane');
        // The root (dim) and the host (the page under) follow the finger with the page, then settle on the page's
        // spring: the stack marks the page `data-swiping` / `data-swipe-settling`, this marks the others.
        const root = el.parentElement;
        const host = root?.parentElement ?? null;
        const mark = (name: 'swiping' | 'settling', on: boolean) => {
          root?.toggleAttribute(name === 'swiping' ? 'data-swiping' : 'data-swipe-settling', on);
          host?.toggleAttribute(name === 'swiping' ? SWIPING : SETTLING, on);
        };
        const follow = (progress: number) => {
          root?.style.setProperty('--adaptive-pane-progress', String(progress));
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
            root?.style.removeProperty('--adaptive-pane-progress');
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
    // Closes the pane: the × of a column, a drawer or a cover, the back button of a pushed page.
    close: slot({
      role: 'button',
      focus: 'native',
      press: ({ api }, event) => api.internal.close(event),
    }),
  }),
  agent: { actions: ['setOpen', 'setWidths'] },
});

/** The pane's api: what its parts and a controller call. */
export type AdaptivePaneApi = ReturnType<typeof adaptivePane>['api'];
