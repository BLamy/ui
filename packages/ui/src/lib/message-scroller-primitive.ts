import { animateIn, createStickToBottom, definePrimitive, openAttrs } from '@ui-sdk/core';
import { prefersReducedMotion } from '@/lib/reduced-motion';

/* ══ The message-scroller primitive: a chat transcript that anchors turns and follows the live edge ══
   Following is UI SDK's `createStickToBottom`: it keeps the end in view while the reader is there and lets go on
   scroll intent (wheel or keys up, a touch drag). What this adds is the turn anchor: a spacer under the latest
   turn leaves room for its reply, so a new turn scrolls near the top with a peek of the one before it, and the
   reply grows into that room without moving the view. A thread opens at its last anchor. Inside a composer bump
   resting at its peek (`data-peeking` on `composer-bump-content`), only the bottom edge shows, so the spacer goes
   and the view sits at the live edge. The viewport is a region named "Messages" unless the renderer names it. No
   React: `components/message-scroller.tsx` renders it. */

export type MessageScrollerOptions = {
  /** Every item's id, in order. */
  ids: string[];
  /** The ids of the items that start a turn (a user's message). */
  anchors: string[];
  /** Identifies the thread; a new one opens at its last anchor. */
  threadKey?: string | null;
  /** A reply is streaming: the jump pill says so while the reader is away. */
  streaming?: boolean;
  /** Pixels of the previous turn left showing above a new anchor. Default 52. */
  peek?: number;
};

export type MessageScrollerState = {
  /** New content scrolls into view. */
  following: boolean;
  /** The reader is far enough from the end for the jump pill. */
  away: boolean;
  /** Inside a composer bump resting at its peek. */
  resting: boolean;
  streaming: boolean;
};

/** How far from the end the reader must be before the jump pill shows. */
const AWAY = 160;

export const messageScroller = definePrimitive({
  name: 'message-scroller',
  options: { ids: 'list', anchors: 'list', threadKey: 'value', streaming: 'boolean', peek: 'number' },
  state: (options: MessageScrollerOptions): MessageScrollerState => ({
    following: true,
    away: false,
    resting: false,
    streaming: !!options.streaming,
  }),
  sync: (options) => ({ streaming: !!options.streaming }),
  api: (context) => {
    const { store } = context;
    let viewport: HTMLElement | null = null;
    let bump: Element | null = null;
    let watchBump: MutationObserver | null = null;
    let thread = context.options().threadKey;
    let ids = context.options().ids ?? [];
    const frames = new Set<number>();
    /** Watches the viewport's and the content's sizes while the viewport is connected. */
    let sizes: ResizeObserver | undefined;
    /** The content element, from its own bind (which runs before the viewport's, and before `context.element` has it). */
    let contentEl: HTMLElement | null = null;

    const stick = createStickToBottom({ threshold: 40, onChange: ({ following }) => store.set({ following }) });
    const peek = () => context.options().peek ?? 52;
    const behavior = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth');
    const later = (run: () => void) => {
      const view = viewport?.ownerDocument.defaultView;
      if (!view) return;
      const id = view.requestAnimationFrame(() => { frames.delete(id); run(); });
      frames.add(id);
    };
    const content = () => context.element('content') as HTMLElement | null;
    const spacer = () => context.element('spacer') as HTMLElement | null;
    const measureAway = () => {
      const el = viewport;
      if (el) store.set({ away: el.scrollHeight - el.scrollTop - el.clientHeight > AWAY });
    };

    /** Sizes the spacer so the latest anchor can sit `peek` from the top with its reply below it. */
    const layoutSpacer = () => {
      const el = viewport, c = content(), s = spacer();
      if (!el || !c || !s) return;
      let h = 0;
      const anchors = c.querySelectorAll<HTMLElement>('[data-anchor]');
      const last = anchors[anchors.length - 1];
      if (last && !store.get().resting) {
        const turn = c.scrollHeight - s.offsetHeight - last.offsetTop;
        h = Math.max(0, el.clientHeight - peek() - turn);
      }
      if (Math.abs((parseFloat(s.style.height) || 0) - h) > 1) s.style.height = `${h}px`;
    };

    const toEnd = (smooth: boolean) => stick.scrollToBottom({ behavior: smooth ? behavior() : 'auto' });

    /** Scrolls a turn near the top. A turn short enough for the spacer to hold its reply is the end of the
     *  thread, so that follows (`'end'`); a longer one leaves the reader at its start (`'top'`). */
    const anchorTop = (id: string, smooth: boolean): 'end' | 'top' | false => {
      const el = viewport;
      const row = el?.querySelector<HTMLElement>(`[data-mid="${CSS.escape(id)}"]`);
      if (!el || !row) return false;
      const top = Math.max(0, row.offsetTop - peek());
      if (top >= el.scrollHeight - el.clientHeight - 1) {
        toEnd(smooth);
        return 'end';
      }
      el.scrollTo({ top, behavior: smooth ? behavior() : 'auto' });
      stick.release();
      return 'top';
    };

    /** While a thread opens, its turns may still be at their placeholder size (`content-visibility: auto` lays
     *  off-screen ones out as 48px): until they have their real size, or the reader scrolls, a resize opens it
     *  again, so it ends at its last anchor rather than at the end the placeholders made of it. */
    let opening = false;
    /** Opens the thread at its last anchor, or at the end without one. */
    const open = () => {
      layoutSpacer();
      const anchors = context.options().anchors ?? [];
      const last = anchors[anchors.length - 1];
      const at = store.get().resting || !last ? false : anchorTop(last, false);
      if (!at) toEnd(false);
      opening = at === 'end';
      measureAway();
    };
    const settle = () => { opening = false; };

    /** Hosts can move the transcript onto a composer bump after it mounts, so this looks again on every change. */
    const findBump = () => {
      const next = viewport?.closest('[data-slot="composer-bump-content"]') ?? null;
      if (next === bump) return;
      watchBump?.disconnect();
      watchBump = null;
      bump = next;
      const read = () => {
        const resting = !!bump?.hasAttribute('data-peeking');
        if (resting === store.get().resting) return;
        store.set({ resting });
        open();
      };
      const MO = viewport?.ownerDocument.defaultView?.MutationObserver;
      if (bump && MO) {
        watchBump = new MO(read);
        watchBump.observe(bump, { attributes: true, attributeFilter: ['data-peeking'] });
      }
      read();
    };

    context.onOptions((options) => {
      findBump();
      if (options.threadKey !== thread) {
        thread = options.threadKey;
        ids = options.ids ?? [];
        layoutSpacer();
        later(open);
        return;
      }
      const next = options.ids ?? [];
      if (next.join('\n') === ids.join('\n')) return;
      const added = new Set(next.filter((id) => !ids.includes(id)));
      ids = next;
      opening = false;
      layoutSpacer();
      const anchor = (options.anchors ?? []).filter((id) => added.has(id)).pop();
      if (anchor) {
        later(() => {
          layoutSpacer();
          // Resting, the reader sees the bottom edge: follow the live edge instead of anchoring the turn.
          if (store.get().resting) toEnd(true);
          else anchorTop(anchor, true);
        });
      }
    });

    context.onDestroy(() => {
      watchBump?.disconnect();
      const view = viewport?.ownerDocument.defaultView;
      frames.forEach((id) => view?.cancelAnimationFrame(id));
    });

    return {
      /** Scrolls to the newest message and follows it again. */
      scrollToEnd: () => toEnd(true),
      internal: {
        connect(el: HTMLElement) {
          viewport = el;
          const disconnect = stick.connect(el);
          const view = el.ownerDocument.defaultView;
          sizes = view?.ResizeObserver
            ? new view.ResizeObserver(() => {
              if (opening) open();
              else layoutSpacer();
              measureAway();
            })
            : undefined;
          sizes?.observe(el);
          // The content may bind before or after the viewport: whichever comes second starts watching it.
          const c = contentEl ?? content();
          if (c) sizes?.observe(c);
          el.addEventListener('scroll', measureAway, { passive: true });
          // The reader's own scroll ends the opening.
          for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) el.addEventListener(type, settle, { passive: true });
          findBump();
          layoutSpacer();
          later(open);
          return () => {
            disconnect();
            sizes?.disconnect();
            sizes = undefined;
            el.removeEventListener('scroll', measureAway);
            for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) el.removeEventListener(type, settle);
            watchBump?.disconnect();
            watchBump = null;
            bump = null;
            if (viewport === el) viewport = null;
          };
        },
        /** The content's size changes (a reply growing, a turn laid out at its real size) re-lay the thread. */
        watchContent(el: HTMLElement) {
          contentEl = el;
          sizes?.observe(el);
          return () => {
            sizes?.unobserve(el);
            if (contentEl === el) contentEl = null;
          };
        },
      },
    };
  },
  slots: (slot) => ({
    root: slot({}),
    viewport: slot({
      role: 'region',
      attrs: (state) => ({
        'aria-label': 'Messages',
        tabindex: '0',
        'data-resting': state.resting ? '' : undefined,
      }),
      bind: (el, { api }) => api.internal.connect(el),
    }),
    content: slot({
      role: 'log',
      bind: (el, { api }) => api.internal.watchContent(el),
      attrs: (state) => ({
        'aria-relevant': 'additions',
        'aria-busy': String(state.streaming),
        'data-resting': state.resting ? '' : undefined,
      }),
    }),
    item: slot<{ value: string; anchor?: boolean; arriving?: boolean }>({
      props: { value: 'string', anchor: 'boolean', arriving: 'boolean' },
      attrs: (_state, { key, props }) => ({ 'data-mid': key, 'data-anchor': props.anchor ? '' : undefined }),
      // A turn that arrives while the thread is open rises in; the ones it opened with are just there.
      bind: (el, { props }) => {
        const body = el.firstElementChild;
        return props.arriving && body instanceof HTMLElement ? animateIn(body) : undefined;
      },
    }),
    spacer: slot({ attrs: () => ({ 'aria-hidden': 'true' }) }),
    // The pill stays mounted and fades out when it isn't needed; inert, so Tab skips it.
    jump: slot({
      attrs: (state) => {
        const shown = state.away || (state.streaming && !state.following);
        return { ...openAttrs(shown), inert: shown ? undefined : '' };
      },
    }),
    'jump-button': slot({
      role: 'button',
      focus: 'native',
      attrs: (state) => ({
        type: 'button',
        // The visible "Streaming" starts the name, so a voice user can say what they see.
        'aria-label': state.streaming ? 'Streaming, jump to latest' : 'Jump to latest',
        'data-streaming': state.streaming ? '' : undefined,
      }),
      press: ({ api }) => api.scrollToEnd(),
    }),
  }),
  agent: { actions: ['scrollToEnd'] },
});
