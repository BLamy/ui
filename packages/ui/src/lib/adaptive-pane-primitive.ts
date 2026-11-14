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
import { bindEdgeSwipe } from '@/lib/edge-swipe';

/* ══ AdaptivePane — one region, four presentations ══
   The host picks the presentation from its own room: `column` docks the pane beside its siblings, `drawer` moves it
   over the host (UI SDK's Drawer, rendered by the component, forwards its dismissals to `open` here), `cover` fills
   the host, `hidden` takes it off screen. Its children stay mounted through every change.
   A column or a drawer can be resizable: a separator on the edge it shares with the page drags its width
   (`createResize`), steps it with the arrow keys (Shift for more), goes to its limits with Home and End, and returns
   to the host's width with Enter or a double-click. Widths are kept per presentation. A closed drawer can also open
   by a swipe from the host's edge (`swipeToOpen`, `bindEdgeSwipe`), past a third of the host or with a flick.
   `side` is UI SDK's: `start` and `end` follow the reading direction. */

/** The edge a pane sits on. `start` and `end` follow the reading direction. */
export type AdaptivePaneSide = Extract<Side, 'start' | 'end' | 'left' | 'right'>;

export type AdaptivePanePresentation = 'column' | 'drawer' | 'cover' | 'hidden';

/** The widths the user resized the pane to, per presentation; unset means the host's own width applies. */
export type AdaptivePaneWidths = { column?: number; drawer?: number };

/** Why the widths changed: a drag of the separator, its arrow, Home or End keys (`resize-key`), Enter or a
 *  double-click back to the host's width (`size-reset`), or a controller. */
export type AdaptivePaneWidthsChangeReason = 'drag' | 'resize-key' | 'size-reset' | 'imperative';
export type AdaptivePaneWidthsChangeDetails = ChangeDetails<AdaptivePaneWidthsChangeReason>;

/** Why the drawer opened or closed: the Drawer's dismissals, a swipe from the edge, or a controller. */
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

/** A handle for a pane: pass it as `controller`, then open its drawer or set its widths from anywhere. */
export function createAdaptivePaneController() {
  return createController<AdaptivePaneController>();
}

export type AdaptivePaneOptions = {
  presentation: AdaptivePanePresentation;
  /** Whether the drawer is open, to control it. Only the `drawer` presentation reads it. */
  open?: boolean;
  defaultOpen?: boolean;
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
  presentation: AdaptivePanePresentation;
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
};

/** Width a resized pane leaves for what is beside it. */
const KEEP = { column: 240, drawer: 48 } as const;
const STEP = 16;

/** The separator's handle: the pane's inner edge on screen. */
const handleOf = (state: Pick<AdaptivePaneState, 'side' | 'rtl'>) =>
  state.side === 'left' || (state.side === 'start' && !state.rtl) || (state.side === 'end' && state.rtl) ? 'e' : 'w';

/** The box an absolutely placed element is laid out in: its offset parent, else its nearest positioned ancestor. */
const containingBox = (el: HTMLElement): HTMLElement => {
  if (el.offsetParent instanceof HTMLElement) return el.offsetParent;
  const view = el.ownerDocument.defaultView;
  for (let p = el.parentElement; p && view; p = p.parentElement) if (/^(relative|absolute|fixed|sticky)$/.test(view.getComputedStyle(p).position)) return p;
  return el;
};

const resizing = (state: Pick<AdaptivePaneState, 'presentation'>) =>
  state.presentation === 'column' || state.presentation === 'drawer' ? state.presentation : null;

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
  state: (options: AdaptivePaneOptions): AdaptivePaneState => ({
    presentation: options.presentation,
    side: options.side ?? 'start',
    rtl: false,
    open: options.open ?? options.defaultOpen ?? false,
    widths: options.widths ?? options.defaultWidths ?? {},
    box: { x: 0, y: 0, width: 0, height: 1 },
    host: Infinity,
    draft: null,
  }),
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
      // What the component renders from: the presentation, and whether a resize is being dragged. The width
      // itself is only a variable here, so a drag repaints the pane without re-rendering what is in it.
      state: (state) => ({ presentation: state.presentation, side: state.side, open: state.open, dragging: !!state.draft }),
      attrs: (state, { api }) => {
        const width = api.internal.width(state);
        return {
          'data-presentation': state.presentation,
          'data-side': state.side,
          'data-open': state.presentation === 'drawer' && state.open ? '' : undefined,
          'data-dragging': state.draft ? '' : undefined,
          hidden: state.presentation === 'hidden' ? '' : undefined,
          // The width the user resized to (the draft's while dragging); unset, the host's own width applies.
          style: css({ '--adaptive-pane-w': width === undefined ? undefined : `${width}px` }),
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
  }),
  agent: { actions: ['setOpen', 'setWidths'] },
});

/** The pane's api: what its parts and a controller call. */
export type AdaptivePaneApi = ReturnType<typeof adaptivePane>['api'];
