import {
  createChange,
  createController,
  definePrimitive,
  type ChangeDetails,
  type ChangeOptions,
} from '@ui-sdk/core';
import { bindSizeClass, type SizeClass, type SizeClassBreakpoints } from '@/lib/size-class';

/* ══ Sidebar — open state and the room its provider has ══
   The provider's root measures its own width with `bindSizeClass` (never the viewport): below `breakpoints.medium` it is
   `compact`, and a Sidebar with `presentation="auto"` shows as a drawer. Crossing the breakpoint resets `open`
   (closed when compact, `defaultOpen` when not), reported as `content-resize`. The trigger toggles whichever
   presentation is mounted; Escape, an outside press, a swipe and a press on one of its rows close the drawer
   (through AdaptivePane's drawer, UI SDK's Drawer), which forwards here. */

/** Why the sidebar opened or closed: its trigger or its `shortcut`, the drawer's dismissals (`escape-key`,
 *  `outside-press`, `swipe`, `close-press`, `action` for a row pressed in it), the provider crossing its breakpoint
 *  (`content-resize`), or a controller (`imperative`). */
export type SidebarOpenChangeReason =
  | 'trigger-press'
  | 'close-press'
  | 'escape-key'
  | 'outside-press'
  | 'swipe'
  | 'back'
  | 'parent-close'
  | 'action'
  | 'shortcut'
  | 'content-resize'
  | 'imperative';

export type SidebarOpenChangeDetails = ChangeDetails<SidebarOpenChangeReason>;

export type SidebarController = {
  isOpen: () => boolean;
  setOpen: (open: boolean, options?: ChangeOptions<SidebarOpenChangeReason>) => boolean;
  toggle: (options?: ChangeOptions<SidebarOpenChangeReason>) => boolean;
};

/** A handle for a sidebar: pass it as `controller` to its provider, then open or close it from anywhere. */
export function createSidebarController() {
  return createController<SidebarController>();
}

export type SidebarOptions = {
  /** Whether it is open, to control it. */
  open?: boolean;
  /** Whether it starts open when uncontrolled, and where it returns when the provider grows out of `compact`.
   *  Default true. */
  defaultOpen?: boolean;
  /** Runs when it wants to open or close; `details.reason` says why and `details.cancel()` stops it. */
  onOpenChange?: (open: boolean, details: SidebarOpenChangeDetails) => void;
  /** Where the provider's own width changes size class, as SplitView's and every size-class scope's: below
   *  `medium` (default 640) it is `compact` (a Sidebar with `presentation="auto"` is a drawer); `regular` defaults to
   *  1024. */
  breakpoints?: SizeClassBreakpoints;
  controller?: SidebarController;
};

type SidebarState = { open: boolean; defaultOpen: boolean; sizeClass: SizeClass; breakpoints: string };

/** The breakpoints as a key, so a new object with the same numbers doesn't measure again. */
const breakpointsKey = (b: SizeClassBreakpoints | undefined) => `${b?.medium ?? 640}/${b?.regular ?? 1024}`;

export const sidebar = definePrimitive({
  name: 'sidebar',
  options: { open: 'boolean', defaultOpen: 'boolean', onOpenChange: 'callback', breakpoints: 'value', controller: 'value' },
  controlled: ['open'],
  state: (options: SidebarOptions): SidebarState => ({
    open: options.open ?? options.defaultOpen ?? true,
    defaultOpen: options.defaultOpen ?? true,
    sizeClass: 'regular',
    breakpoints: breakpointsKey(options.breakpoints),
  }),
  sync: (options) => ({
    defaultOpen: options.defaultOpen ?? true,
    breakpoints: breakpointsKey(options.breakpoints),
    ...(options.open === undefined ? {} : { open: options.open }),
  }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const setOpen = (open: boolean, { reason = 'imperative', event }: ChangeOptions<SidebarOpenChangeReason> = {}) =>
      open !== store.get().open && change('open', open, { reason, event });
    // The first measurement is where the sidebar starts, not a change: a controlled parent hears no close at mount.
    let measured = false;
    return {
      isOpen: () => store.get().open,
      setOpen,
      toggle: (options?: ChangeOptions<SidebarOpenChangeReason>) => setOpen(!store.get().open, options),
      internal: {
        /** The provider measured into another size class. */
        resized(sizeClass: SizeClass) {
          const state = store.get();
          const was = state.sizeClass;
          const compact = sizeClass === 'compact';
          if (!measured) {
            measured = true;
            const starts = context.options().open === undefined && compact ? { open: false } : {};
            store.set({ sizeClass, ...starts });
            return;
          }
          store.set({ sizeClass });
          if ((was === 'compact') !== compact) setOpen(compact ? false : state.defaultOpen, { reason: 'content-resize' });
        },
      },
    };
  },
  slots: (slot) => ({
    // The provider's element: the box that is measured, around the sidebar and its inset.
    provider: slot({
      // What the provider's children render from (the sidebar's context).
      state: (state) => ({ open: state.open, sizeClass: state.sizeClass }),
      attrs: (state) => ({
        'data-size-class': state.sizeClass,
        'data-open': state.open ? '' : undefined,
        'data-closed': state.open ? undefined : '',
      }),
      // Measured against `breakpoints`, and measured again when they change.
      bind: (el, { api, store }) => {
        let bound: string | undefined;
        let stop: (() => void) | undefined;
        const bindSize = () => {
          const { breakpoints } = store.get();
          if (breakpoints === bound) return;
          stop?.();
          bound = breakpoints;
          const [medium, regular] = breakpoints.split('/').map(Number);
          stop = bindSizeClass(el, {
            breakpoints: { medium, regular: Math.max(medium, regular) },
            onChange: (sizeClass) => api.internal.resized(sizeClass),
          });
        };
        bindSize();
        const off = store.subscribe(bindSize);
        return () => {
          off();
          stop?.();
        };
      },
    }),
    // The element that holds the sidebar's children, in whichever presentation: what the trigger controls.
    panel: slot({
      attrs: (_state, { id }) => ({ id: `${id}-panel` }),
    }),
    trigger: slot({
      role: 'button',
      focus: 'native',
      press: ({ api }, event) => api.toggle({ reason: 'trigger-press', event }),
      attrs: (state, { id }) => ({ 'aria-expanded': String(state.open), 'aria-controls': `${id}-panel` }),
    }),
  }),
  agent: { actions: ['setOpen', 'toggle'] },
});

/** The sidebar's api: what its parts and a controller call. */
export type SidebarApi = ReturnType<typeof sidebar>['api'];
