import { animateIn, animateOut, bindLayer, sourceOf, type PrimitiveContext } from '@ui-sdk/core';

/* ══ createStack — a stack of pages where the newest covers the rest ══
   The screens of an app's navigation, for any primitive: pages enter and leave with their animations
   (`animateIn`/`animateOut`, so `data-starting-style`/`data-ending-style`), the pages under the top one are inert
   and `data-covered`, focus goes into a pushed page and back to what had it once the page pops, and Escape, the
   platform back and a swipe from the edge pop the top page. The stack owns no state: it reads the page keys and
   the exits from the primitive's store, and asks for every change through `set` (the primitive's `createChange`),
   so `on<Key>Change` hears and can cancel it, and controlled pages work whatever changed them.

   Escape goes through UI SDK's layers: while the stack can pop it is a `bindLayer` layer that contains nothing (so
   presses pass through and popups never nest under it) and is live (its `when`) only while it pops, so a popup open in the
   page closes first, a stack under a covered page lets Escape go on, and with stacks nested the innermost visible
   one goes first. Stacks find each other through one registry per page (`Symbol.for`), so two copies of the
   library cooperate. `active` (an option) switches the stack off while its pages stay: a split view whose columns
   are a stack only while compact; `persistent` is for pages that never unmount and are moved by the layout's CSS
   (the same split view's columns): they keep their own `inert` and play no enter or exit. A swipe release keeps `data-swipe-settling` on the two pages it moved until their
   transitions finish, so CSS can settle them on a different spring than a push or a pop. ══ */

/** Why a stack changed its own pages: Escape, the platform back, an edge swipe, or code. */
export type StackReason = 'escape-key' | 'back' | 'swipe' | 'imperative';

/** A page that left and is animating out, kept in state under `StackOptions.exiting`. */
export interface StackExit {
  /** The key the page had. */
  key: string;
  /** It leaves under the page that took its place (after `replace` or a push), rather than over the one it uncovers. */
  covered: boolean;
}

/** What every change method takes last. */
export interface StackChangeOptions<Reason extends string = StackReason> {
  reason?: Reason | StackReason;
  event?: Event;
}

export interface StackOptions<State extends object, Reason extends string = StackReason> {
  /** The state key holding the page keys, a `string[]` from the first page to the top one. */
  key: keyof State & string;
  /** The state key holding the `StackExit` of each page animating out. Start it at `[]`. */
  exiting: keyof State & string;
  /** Asks for new pages; returns whether they went through. Pass `(value, details) => change('pages', value, details)`. */
  set: (value: string[], details: { reason: Reason | StackReason; event?: Event }) => boolean;
  /** `bindBack`, so the platform's back pops the stack too. Passed in, so a stack without it doesn't carry it. */
  back?: (el: HTMLElement, options: { onBack: (event: Event) => boolean | void }) => () => void;
  /** Whether it is a stack right now. While false the pages stay as they are but nothing pops (no layer, no back,
   *  swipes refused), and a change of pages moves no focus and plays no exit. Read on every store change.
   *  Default: always. */
  active?: () => boolean;
  /** The pages are never unmounted: the layout's CSS moves them (a split view's columns). Then a page that leaves
   *  records no exit and plays no `animateIn`/`animateOut` (those would clear the `inert` the page's own attrs keep),
   *  and only focus moves with the pages. Default false. */
  persistent?: boolean;
}

interface Page {
  el: HTMLElement;
  initialFocus?: () => HTMLElement | null | undefined | void;
}

interface Poppable {
  top: () => HTMLElement | undefined;
  pops: () => boolean;
}

const REGISTRY = Symbol.for('bl-ui.stacks@1');
/** The stacks with a page to go back to, so one inside another's top page goes back first. One set per page. */
function registry(): Set<Poppable> {
  const holder = globalThis as unknown as { [REGISTRY]?: Set<Poppable> };
  return (holder[REGISTRY] ??= new Set());
}

const TABBABLE =
  'a[href],area[href],button,input:not([type=hidden]),select,textarea,iframe,audio[controls],video[controls],summary,[contenteditable]:not([contenteditable=false]),[tabindex]';
/** The first element Tab reaches inside `el`, in document order. */
function firstTabbable(el: HTMLElement): HTMLElement | undefined {
  for (const node of el.querySelectorAll<HTMLElement>(TABBABLE)) {
    if (node.tabIndex < 0 || (node as HTMLButtonElement).disabled || node.closest('[inert],[hidden]')) continue;
    return node;
  }
  return undefined;
}

/** The focused element, through shadow roots; undefined when nothing has focus. */
function focusedIn(doc: Document): HTMLElement | undefined {
  let active = doc.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active instanceof HTMLElement && active !== doc.body ? active : undefined;
}

const focus = (el: HTMLElement) => el.focus({ preventScroll: true });

/** Keeps a stack of pages in a primitive. Call it once in `api`, keep it on the api, and wire the page slot:
 *
 *  ```ts
 *  page: slot<{ value: string }>({
 *    props: { value: 'string' },
 *    present: (state, { api, key }) => api.stack.present(state, key),
 *    attrs: (state, { api, key }) => api.stack.pageAttrs(state, key),
 *    bind: (el, { api, key }) => api.stack.bindPage(el, key),
 *  })
 *  ``` */
export function createStack<State extends object, Reason extends string = StackReason>(
  context: Pick<PrimitiveContext<any, State, any>, 'store' | 'onDestroy'>,
  options: StackOptions<State, Reason>,
) {
  type Details = StackChangeOptions<Reason>;
  const { store } = context;
  const pagesOf = (state: State) => state[options.key] as string[];
  const exitsOf = (state: State) => state[options.exiting] as StackExit[];
  const pages = () => pagesOf(store.get());
  const isActive = () => options.active?.() ?? true;
  const bound = new Map<string, Page>();
  // What had focus before each page was pushed, which takes it back when the page pops.
  const openers = new Map<string, HTMLElement>();
  // What stops each exit under way.
  const exits = new Map<string, () => void>();
  // The page pushed last, until it binds, and whether focus goes in with it.
  let entering: { key: string; focus: boolean } | undefined;
  // Pages that bound before the stack heard of them: with controlled pages, the render that adds a page comes
  // before the store does, so the page is already bound when the push is heard, and enters then.
  const unheard = new Set<string>();
  let release: (() => void) | undefined;
  // The pages the stack last committed to: a page still here renders until its exit is recorded.
  let shown = pages();
  // The pages a swipe is moving: the top one and the one under it.
  let swiping: HTMLElement[] = [];

  const topElement = () => bound.get(pages().at(-1) ?? '')?.el;
  const anyElement = () => topElement() ?? bound.values().next().value?.el;
  const self: Poppable = {
    top: topElement,
    // Whether Escape, a back or a swipe pops it now: it is a stack now, not under a covered page of a stack around
    // it, and no stack in its top page goes back first.
    pops() {
      const el = topElement();
      return (
        isActive() &&
        pages().length > 1 &&
        !!el &&
        !el.closest('[inert]') &&
        ![...registry()].some((inner) => inner !== self && el.contains(inner.top() ?? null) && inner.pops())
      );
    },
  };

  const ask = (value: string[], { reason = 'imperative', event }: Details) => options.set(value, { reason, event });

  // Where focus lands in a page: on the page for a finger, so no on-screen keyboard opens, as for a popup.
  const focusTarget = ({ el, initialFocus }: Page) => {
    if (sourceOf() === 'touch') return el;
    return initialFocus ? initialFocus() : firstTabbable(el) ?? el;
  };

  function arrive(key: string, page: Page, animates: boolean) {
    const moves = entering?.focus;
    entering = undefined;
    const stop = animates && !options.persistent ? animateIn(page.el) : undefined;
    if (moves) {
      // After the commit that rendered the page, so what's inside it has bound.
      queueMicrotask(() => {
        const target = page.el.isConnected && focusTarget(page);
        if (target && pages().at(-1) === key) focus(target);
      });
    }
    return stop;
  }

  function finishExit(key: string) {
    exits.delete(key);
    const left = exitsOf(store.get()).filter((exit) => exit.key !== key);
    store.set({ [options.exiting]: left } as Partial<State>);
  }

  function leave(key: string, el: HTMLElement, covered: boolean) {
    // Ahead of the render, so an exit keyed on it is running when it's read.
    el.toggleAttribute('data-covered', covered);
    let done = false;
    const stop = animateOut(el, () => {
      done = true;
      finishExit(key);
    });
    if (!done) exits.set(key, stop);
  }

  // The page's document, or the global one while no page is bound yet (a side drawer's first push).
  const focusedElement = () => {
    const doc = anyElement()?.ownerDocument ?? (typeof document === 'undefined' ? undefined : document);
    return doc ? focusedIn(doc) : undefined;
  };

  // A page that's back in the stack stops leaving.
  function resume(next: string[]) {
    for (const [key, stop] of exits) {
      if (next.includes(key)) {
        stop();
        exits.delete(key);
      }
    }
    const exiting = exitsOf(store.get());
    const kept = exiting.filter(({ key }) => !next.includes(key));
    if (kept.length !== exiting.length) store.set({ [options.exiting]: kept } as Partial<State>);
  }

  // The pages changed: by a call here, the primitive's own change or a controlled option.
  function moved(previous: string[], next: string[]) {
    resume(next);
    const early = unheard.has(next.at(-1) ?? '');
    for (const key of next) unheard.delete(key);
    if (!isActive()) {
      // Not a stack right now: the pages are only remembered. Nothing animates and focus stays where it is.
      entering = undefined;
      for (const key of previous) if (!next.includes(key)) openers.delete(key);
      return;
    }
    const from = previous.at(-1);
    const to = next.at(-1);
    const turned = from !== undefined && to !== undefined && from !== to;
    const forward = turned && !previous.includes(to);
    const focused = focusedElement();
    // Focus follows the pages from inside the stack, or from nowhere. A top page that isn't bound (a key with no
    // element of its own, like a side drawer's host page) may hold it, so it follows from there too.
    const follows =
      !focused ||
      [...bound.values()].some(({ el }) => el.contains(focused)) ||
      (from !== undefined && !bound.has(from));
    // Before any write, since a write can render the page, which binds it.
    entering = forward ? { key: to, focus: follows } : undefined;
    if (turned) {
      const stays = next.includes(from);
      const left = stays || options.persistent ? undefined : bound.get(from);
      if (left) {
        store.set({ [options.exiting]: [...exitsOf(store.get()), { key: from, covered: forward }] } as Partial<State>);
      }
      if (forward) {
        // A page that takes another's place goes back where that one would have.
        const opener = stays ? focused : openers.get(from);
        if (opener) openers.set(to, opener);
        const page = bound.get(to);
        if (page && entering) arrive(to, page, early);
      } else if (follows) {
        refocus(to, openers.get(previous[previous.indexOf(to) + 1]));
      }
      if (left) leave(from, left.el, forward);
    }
    for (const key of previous) if (!next.includes(key)) openers.delete(key);
  }

  const usable = (el: HTMLElement | undefined): el is HTMLElement => !!el?.isConnected && !el.closest('[inert]');

  // Focus goes back to what had it before the page above was pushed, or into the page when that's gone. The page
  // under needn't be bound (a side drawer's host page is only a key): the opener still takes focus back.
  function refocus(key: string, opener: HTMLElement | undefined) {
    const page = bound.get(key);
    // Ahead of the render that lifts it, so focus can land in it now.
    if (page) page.el.inert = false;
    const target = usable(opener) ? opener : page && focusTarget(page);
    if (target) return focus(target);
    if (!opener?.isConnected) return;
    // The opener is under something inert the render is about to lift: once it has committed, unless focus has
    // found a place of its own by then.
    queueMicrotask(() => {
      const now = focusedIn(opener.ownerDocument);
      if (usable(opener) && (!now || now.closest('[inert]'))) focus(opener);
    });
  }

  // While there's a page to go back to, the stack is a layer, for Escape, and hears the platform's back.
  function sync() {
    const el = anyElement();
    const wanted = isActive() && pages().length > 1 && !!el;
    if (wanted === !!release) return;
    if (!wanted || !el) {
      release?.();
      release = undefined;
      return;
    }
    // A layer that contains nothing: presses pass through and popups never nest under it.
    const marker = el.ownerDocument.createElement('div');
    const offLayer = bindLayer(marker, {
      when: self.pops,
      onDismiss: (reason, event) => {
        if (reason === 'escape-key') api.pop({ reason: 'escape-key', event });
      },
    });
    const offBack = options.back?.(el, {
      onBack(event) {
        if (!self.pops()) return false;
        api.pop({ reason: 'back', event });
        return true;
      },
    });
    registry().add(self);
    release = () => {
      offLayer();
      offBack?.();
      registry().delete(self);
    };
  }

  context.onDestroy(
    store.subscribe(() => {
      const next = pages();
      if (next !== shown) {
        const previous = shown;
        shown = next;
        moved(previous, next);
      }
      // Also when only `active` changed (a split view turning compact).
      sync();
    }),
  );
  context.onDestroy(() => {
    release?.();
    release = undefined;
  });

  /** The two pages a swipe moved settle on their own spring, until their transitions finish. */
  function settle(els: HTMLElement[]) {
    const view = els[0]?.ownerDocument.defaultView;
    const done = () => els.forEach((el) => el.removeAttribute('data-swipe-settling'));
    if (!view) return done();
    view.requestAnimationFrame(() => {
      const running = els.flatMap((el) => (el.isConnected ? el.getAnimations?.() ?? [] : []));
      void Promise.allSettled(running.map((animation) => animation.finished)).then(done);
    });
  }

  /** A page leaving that the stack hasn't heard of yet: with controlled pages, the render that drops it comes
   *  before the store does. It leaves as it will once heard: covered when the new top is a page it never had.
   *  Deliberately not a pure function of `state`: it also reads which pages are bound and the pages the stack last
   *  committed to (`shown`), so `present`/`pageAttrs` keep a controlled pop's page mounted for its exit in the
   *  same render. The renderer reads them again on that render; on the server nothing is bound, so it is
   *  undefined there, which is the right answer. */
  const unheardExit = (state: State, key: string): StackExit | undefined => {
    const next = pagesOf(state);
    if (options.persistent || next.includes(key) || !shown.includes(key) || !bound.has(key) || !isActive()) return undefined;
    const top = next.at(-1);
    return { key, covered: top !== undefined && !shown.includes(top) };
  };

  const api = {
    /** The exit of a page that is leaving (recorded, or about to be), else undefined. */
    exitOf(state: State, key: string): StackExit | undefined {
      return exitsOf(state).find((exit) => exit.key === key) ?? unheardExit(state, key);
    },
    /** The page slot's `present`: the page is in the stack, or leaving (animating out, or popped by controlled
     *  pages the stack is about to hear of). */
    present(state: State, key: string) {
      return pagesOf(state).includes(key) || !!api.exitOf(state, key);
    },
    /** The page slot's `attrs`: `data-covered` and `inert` under the top page (while it is a stack), and
     *  `tabindex="-1"`, so the page can take focus when nothing in it can. */
    pageAttrs(state: State, key: string) {
      const exit = api.exitOf(state, key);
      const covered = exit ? exit.covered : isActive() && pagesOf(state).at(-1) !== key;
      return { tabindex: '-1', inert: covered ? '' : undefined, 'data-covered': covered ? '' : undefined };
    },
    /** Joins a page's element, to animate it in and out and move focus with it; return its cleanup from the page
     *  slot's `bind`. `initialFocus` names where focus goes on a push (default: the first element Tab reaches, or
     *  the page); returning nothing leaves focus where it is. */
    bindPage(el: HTMLElement, key: string, config: { initialFocus?: () => HTMLElement | null | undefined | void } = {}) {
      const page: Page = { el, initialFocus: config.initialFocus };
      bound.set(key, page);
      if (!pages().includes(key)) unheard.add(key);
      const stop = entering?.key === key ? arrive(key, page, !options.persistent) : undefined;
      sync();
      return () => {
        stop?.();
        if (exits.has(key)) {
          exits.get(key)?.();
          finishExit(key);
        }
        if (bound.get(key) === page) {
          bound.delete(key);
          unheard.delete(key);
        }
        sync();
      };
    },
    /** Whether Escape, a back or a swipe would pop it now. */
    pops: () => self.pops(),
    /** Puts a page on top. False when it is in the stack already, or the change was canceled. */
    push(key: string, details: Details = {}) {
      const current = pages();
      return !current.includes(key) && ask([...current, key], details);
    },
    /** Takes the top page off. False on the first page, or when the change was canceled. */
    pop(details: Details = {}) {
      const current = pages();
      return current.length > 1 && ask(current.slice(0, -1), details);
    },
    /** Takes off every page above `key`; only the top one animates out. False when `key` is on top or not there. */
    popTo(key: string, details: Details = {}) {
      const current = pages();
      const index = current.indexOf(key);
      return index !== -1 && index < current.length - 1 && ask(current.slice(0, index + 1), details);
    },
    /** Swaps the top page for another, which enters like a push. False when it is in the stack already. */
    replace(key: string, details: Details = {}) {
      const current = pages();
      return !current.includes(key) && ask([...current.slice(0, -1), key], details);
    },
    /** What `bindEdgeSwipe` takes to pop the top page with a swipe: `bindEdgeSwipe(el, { ...api.stack.swipe })`.
     *  While it moves, the top page and the one under it have `data-swiping` and `--stack-progress` (0..1); once
     *  released, `data-swipe-settling` until their transitions finish. Refused while the stack can't pop.
     *  `onEnd` returns whether the swipe popped (committed, and the change wasn't canceled). */
    swipe: {
      onStart() {
        if (!self.pops()) return false;
        swiping = pages().slice(-2).flatMap((key) => bound.get(key)?.el ?? []);
        for (const el of swiping) {
          el.removeAttribute('data-swipe-settling');
          el.setAttribute('data-swiping', '');
        }
        return true;
      },
      onMove(progress: number) {
        for (const el of swiping) el.style.setProperty('--stack-progress', String(progress));
      },
      onEnd(committed: boolean, details: { event: Event }) {
        const moved = swiping;
        swiping = [];
        // In the same task as the pop, so the transitions start from where the finger let go, on the settle spring.
        for (const el of moved) {
          el.removeAttribute('data-swiping');
          el.style.removeProperty('--stack-progress');
          el.setAttribute('data-swipe-settling', '');
        }
        const popped = committed && api.pop({ reason: 'swipe', event: details.event });
        settle(moved);
        return popped;
      },
    },
  };
  return api;
}

/** What `createStack` returns. */
export type Stack = ReturnType<typeof createStack>;
