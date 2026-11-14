/* ══ bindBack — the platform's way back, as a callback ══
   Android's back button or gesture, and the swipe from the screen's edge on a phone without one. Bind it only while
   there is somewhere to go back to (a page pushed on a stack) and clean up once there isn't: while nothing is bound
   a back leaves the page as it always did, and on a desktop (a fine pointer) nothing listens at all, since Escape
   goes through UI SDK's layers instead.

   One coordinator per window, shared by every copy of this module on the page (`Symbol.for`): the newest binding
   hears a back first, and returning `false` passes it to the one bound before it.
     Android    one `CloseWatcher` while anything is bound, made again after each back. A watcher also hears a
                keyboard's Escape, which UI SDK's layers already handled, so a close within 100ms of an Escape
                keydown is skipped. The next watcher is made in the spent one's `close` handler, without user
                activation. The close-watcher anti-abuse rules group such a watcher with the newest one only when
                the page already has more groups than user activations; every push and every popup open comes from
                a press, so it gets a group of its own and one back never both closes a popup and pops a page.
                Making it later, on the next press, would leave a second back in a row to the page. (Not testable
                without a device: check on Android when the popup layer changes.)
     iOS etc.   one history entry of our own on top of the page's, while a back is wanted. Going back off it lands
                at the same address, which no router needs to hear, so that `popstate` stops here (capture phase,
                `stopImmediatePropagation`). Any other move through history is the page's; the entry is re-armed
                once it lands. ══ */

export interface BindBackOptions {
  /** Runs when the user goes back. Return `false` when there is nothing to go back to here after all (a view
   *  covered by another), and the binding made before this one hears it instead. */
  onBack: (event: Event) => boolean | void;
}

interface Backs {
  /** Who asked for the next back, oldest first. The newest hears it first. */
  asked: BindBackOptions[];
  /** Starts hearing the platform's back, or stops and leaves it to the page. */
  hear: (wanted: boolean) => void;
}

type CloseWatcherLike = EventTarget & { destroy: () => void };

const KEY = Symbol.for('bl-ui.back@1');
/** Marks the history entry that stands in for a back. */
const MARKER = '__blBack';
/** A close this soon after an Escape keydown is that Escape, ms. */
const ESCAPE_WINDOW = 100;

function backsOf(view: Window): Backs {
  const holder = view as unknown as { [KEY]?: Backs };
  if (!holder[KEY]) {
    const asked: BindBackOptions[] = [];
    const back = (event: Event) => {
      for (const { onBack } of [...asked].reverse()) if (onBack(event) !== false) return;
    };
    holder[KEY] = { asked, hear: hearBack(view, back) };
  }
  return holder[KEY];
}

function hearBack(view: Window, back: (event: Event) => void): Backs['hear'] {
  const Watcher = (view as unknown as { CloseWatcher?: new () => CloseWatcherLike }).CloseWatcher;
  if (Watcher && /Android/.test(view.navigator.userAgent)) return watchClose(view, Watcher, back);
  if (view.matchMedia?.('(pointer: coarse)').matches) return holdEntry(view, back);
  return () => {};
}

/** A watcher is spent once it hears a close, so each back makes the next one. */
function watchClose(view: Window, Watcher: new () => CloseWatcherLike, back: (event: Event) => void): Backs['hear'] {
  let watcher: CloseWatcherLike | undefined;
  let wanted = false;
  let lastEscape = -Infinity;
  view.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') lastEscape = view.performance.now();
  }, true);
  const settle = () => {
    if (!wanted) {
      watcher?.destroy();
      watcher = undefined;
      return;
    }
    if (watcher) return;
    try {
      watcher = new Watcher();
    } catch {
      return;
    }
    watcher.addEventListener('close', (event) => {
      watcher = undefined;
      if (view.performance.now() - lastEscape >= ESCAPE_WINDOW) back(event);
      settle();
    });
  };
  return (next) => {
    wanted = next;
    settle();
  };
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

/** The state our entry carries: the page's own keys beside the marker when its state is a plain object (a router
 *  reading it keeps working), otherwise the page's state wrapped, so a string or an array is never torn apart. */
const markedState = (state: unknown) => (isPlainObject(state) ? { ...state, [MARKER]: true } : { [MARKER]: true, state });

function holdEntry(view: Window, back: (event: Event) => void): Backs['hear'] {
  const { history } = view;
  let wanted = false;
  // Whether the current entry is ours, its address, and whether our own way back off it is still to land.
  let held = false;
  let href = '';
  let leaving = false;
  const isOurs = () => isPlainObject(history.state) && history.state[MARKER] === true;
  const settle = () => {
    if (leaving || wanted === held) return;
    held = wanted;
    if (wanted) {
      history.pushState(markedState(history.state), '');
      href = view.location.href;
    } else if (isOurs()) {
      leaving = true;
      history.back();
    }
  };
  view.addEventListener('popstate', (event) => {
    const left = held && !isOurs() && view.location.href === href;
    if (!leaving && !left) {
      // Somewhere else in history. A back is asked for again once it lands.
      held &&= isOurs();
      view.setTimeout(settle);
      return;
    }
    event.stopImmediatePropagation();
    held = false;
    if (leaving) leaving = false;
    else back(event);
    settle();
  }, true);
  return (next) => {
    wanted = next;
    settle();
  };
}

/** Hears the platform's back for `el`'s window until the returned cleanup runs. With several bound, the newest
 *  hears a back first.
 *
 *  ```ts
 *  const stop = bindBack(el, { onBack: (event) => api.pop({ reason: 'back', event }) })
 *  ``` */
export function bindBack(el: HTMLElement, options: BindBackOptions): () => void {
  const view = el.ownerDocument.defaultView;
  if (!view) return () => {};
  const backs = backsOf(view);
  // Our own entry, so one options object bound twice is two bindings.
  const entry: BindBackOptions = { onBack: (event) => options.onBack(event) };
  backs.asked.push(entry);
  backs.hear(true);
  return () => {
    const index = backs.asked.indexOf(entry);
    if (index === -1) return;
    backs.asked.splice(index, 1);
    backs.hear(backs.asked.length > 0);
  };
}
