import { bindDrag, createListbox, definePrimitive } from '@ui-sdk/core';
import { bindRowInset } from '@/lib/wave-rail';

/* ══ The index-bar primitive: a jump rail of stops along one edge ══
   The rail is a listbox that keeps focus and points `aria-activedescendant` at the highlighted stop (UI SDK's
   `createListbox` with virtual focus): the arrows, PageUp and PageDown move the highlight, Home and End go to either
   end, and every move jumps there. A press on the rail jumps to the stop under it and a drag scrubs through the
   stops (`bindDrag`); a mouse resting on the rail only peeks at a stop. Where the pointer is along the rail, in
   stops, is state too, for the wave's swell. A rail on the end side also publishes how far list rows run under it as
   `--bl-index-bar-inset` on the element it overlays (`bindRowInset`, shared with TraceTimeline's rail in
   lib/wave-rail). No React: `components/index-bar.tsx` renders it. */

/** Why the rail jumped: a press or a scrub across the stops, a key, a stop clicked (assistive tech, the panel),
 *  or code. */
export type IndexBarJumpReason = 'drag' | 'list-navigation' | 'item-press' | 'imperative';

export type IndexBarOptions = {
  /** How many stops the rail has. */
  count: number;
  /** Which edge it sits on. Only an `end` rail publishes `--bl-index-bar-inset`. */
  side?: 'start' | 'end';
  /** Publish `--bl-index-bar-inset` on the parent. */
  insetContent?: boolean;
  /** Called with the stop's index each time the rail lands on another one. */
  onJump?: (index: number, details: { reason: IndexBarJumpReason; event?: Event }) => void;
};

/** Where the rail and its track sit, measured when a gesture starts or the pointer enters. */
export type IndexBarGeometry = { rTop: number; tTop: number; tH: number };

export type IndexBarState = {
  /** The stop the keyboard highlight is on, as its index in a string. */
  highlighted: string | null;
  /** A press or drag is scrubbing the rail. */
  scrubbing: boolean;
  /** The stop under the press or drag, -1 for none. */
  scrub: number;
  /** The stop a mouse rests on without pressing, -1 for none. */
  peek: number;
  /** Where the pointer is along the track, in stops (0 at the top edge, `count` at the bottom). */
  pointer: number | null;
  /** The pointer is over the rail or its panel. */
  inside: boolean;
  /** The rail has focus. */
  focused: boolean;
  geometry: IndexBarGeometry | null;
};

const TRACK = '[data-slot="index-bar-track"]';
const PANEL = '[data-slot="index-bar-panel"]';

export const indexBar = definePrimitive({
  name: 'index-bar',
  options: { count: 'number', side: 'string', insetContent: 'boolean', onJump: 'callback' },
  state: (_options: IndexBarOptions): IndexBarState => ({
    highlighted: null, scrubbing: false, scrub: -1, peek: -1, pointer: null, inside: false, focused: false, geometry: null,
  }),
  api: (context) => {
    const { store } = context;
    const listbox = createListbox<IndexBarState>(context, { key: 'highlighted', focus: 'virtual', loop: () => false });
    let rail: HTMLElement | null = null;
    let last = -1;
    let stopDrag: (() => void) | undefined;
    let resync: (() => void) | undefined;
    context.onDestroy(() => stopDrag?.());
    // A new side or insetContent re-publishes the inset.
    context.onOptions(() => { resync?.(); });

    const measure = () => {
      const track = rail?.querySelector<HTMLElement>(TRACK);
      if (!rail || !track) return null;
      const rb = rail.getBoundingClientRect(), tb = track.getBoundingClientRect();
      const geometry = { rTop: rb.top, tTop: tb.top, tH: tb.height };
      store.set({ geometry });
      return geometry;
    };
    const count = () => context.options().count;
    /** The stop at a client y, clamped to the rail. */
    const at = (y: number) => {
      const g = store.get().geometry ?? measure();
      if (!g || !g.tH || !count()) return -1;
      return Math.max(0, Math.min(count() - 1, Math.floor((y - g.tTop) / g.tH * count())));
    };
    const along = (y: number) => {
      const g = store.get().geometry;
      if (!g || !g.tH) return null;
      return Math.max(0, Math.min(count(), (y - g.tTop) / g.tH * count()));
    };
    const report = (index: number, reason: IndexBarJumpReason, event?: Event) => {
      if (index < 0 || index >= count()) return;
      last = index;
      context.options().onJump?.(index, { reason, event });
    };
    /** During a scrub only a new stop counts, so a slow drag doesn't jump again and again. */
    const scrubTo = (y: number, event: Event) => {
      const index = at(y);
      store.set({ scrub: index, pointer: along(y) });
      if (index !== last) report(index, 'drag', event);
    };
    const inPanel = (event: Event) => !!(event.target as Element | null)?.closest?.(PANEL);

    return {
      listbox,
      /** Jumps to a stop by index, as a press on it would. */
      jump(index: number) {
        report(index, 'imperative');
      },
      internal: {
        bindRail(el: HTMLElement) {
          rail = el;
          // With no rows to measure, the inset is the rail's own width.
          const inset = bindRowInset(el, {
            enabled: () => {
              const { insetContent = true, side = 'end' } = context.options();
              return insetContent && side === 'end';
            },
            fallback: () => el.offsetWidth,
          });
          resync = inset.sync;
          return () => {
            if (rail === el) { rail = null; resync = undefined; }
            inset.cleanup();
          };
        },
        pointerdown(event: PointerEvent, el: HTMLElement) {
          if (event.button || inPanel(event)) return;
          stopDrag?.();
          measure();
          last = -1;
          store.set({ scrubbing: true, peek: -1 });
          scrubTo(event.clientY, event);
          stopDrag = bindDrag(el, event, {
            onMove: ({ y, event: move }) => scrubTo(y, move),
            onEnd: () => {
              stopDrag = undefined;
              last = -1;
              store.set({ scrubbing: false, scrub: -1, pointer: null });
            },
          });
        },
        pointermove(event: PointerEvent) {
          if (store.get().scrubbing || event.pointerType === 'touch') return;
          if (inPanel(event)) { store.set({ peek: -1, pointer: null }); return; }
          if (!store.get().geometry) measure();
          store.set({ peek: at(event.clientY), pointer: along(event.clientY) });
        },
        pointerenter() {
          store.set({ inside: true });
          if (!store.get().scrubbing) measure();
        },
        pointerleave() {
          store.set(store.get().scrubbing ? { inside: false, peek: -1 } : { inside: false, peek: -1, pointer: null });
        },
        keydown(event: KeyboardEvent) {
          if (!count()) return;
          if (!store.get().geometry) measure();
          const before = store.get().highlighted;
          let moved: string | undefined;
          if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            listbox.move(event.key === 'Home' ? 'first' : 'last', event);
            moved = store.get().highlighted ?? undefined;
          } else {
            moved = listbox.keydown(event);
          }
          // At either end the highlight stays put, and so does the scroller.
          if (moved != null && moved !== before) report(Number(moved), 'list-navigation', event);
        },
        focus() {
          store.set({ focused: true });
        },
        blur() {
          store.set({ focused: false, highlighted: null });
        },
        /** A stop clicked with no pointer press before it (assistive tech), or a panel row. */
        press(index: number, event?: Event) {
          if (event instanceof MouseEvent && event.detail > 0 && !inPanel(event)) return;
          report(index, 'item-press', event);
        },
      },
    };
  },
  slots: (slot) => ({
    root: slot<object, IndexBarState>({
      role: 'listbox',
      focus: 'tab-stop',
      keys: ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'],
      state: (state) => state,
      attrs: (state, { api }) => ({
        tabindex: '0',
        'aria-orientation': 'vertical',
        'aria-activedescendant': api.listbox.activeId(state),
        'data-scrubbing': state.scrubbing ? '' : undefined,
      }),
      on: {
        pointerdown: (event, { el, api }) => api.internal.pointerdown(event as PointerEvent, el!),
        pointermove: (event, { api }) => api.internal.pointermove(event as PointerEvent),
        pointerenter: (_event, { api }) => api.internal.pointerenter(),
        pointerleave: (_event, { api }) => api.internal.pointerleave(),
        keydown: (event, { api }) => api.internal.keydown(event as KeyboardEvent),
        focus: (_event, { api }) => api.internal.focus(),
        blur: (_event, { api }) => api.internal.blur(),
      },
      bind: (el, { api }) => api.internal.bindRail(el),
    }),
    track: slot({}),
    option: slot<{ value: string }>({
      role: 'option',
      focus: 'active-descendant',
      props: { value: 'string' },
      attrs: (state, part) => ({
        ...part.api.listbox.attrs(state, part),
        'aria-selected': String(state.highlighted === part.key),
      }),
      press: ({ api, key }, event) => api.internal.press(Number(key), event),
      bind: (el, part) => part.api.listbox.bind(el, part),
    }),
  }),
  agent: { actions: ['jump'] },
});
