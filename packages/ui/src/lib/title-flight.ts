import { solveSpring } from '@ui-sdk/core/gesture';
import { springs } from '@/lib/motion';
import { prefersReducedMotion as reducedMotion } from '@/lib/reduced-motion';

/* ══ Header title morph ══
   On push the previous screen's title (large or inline, whichever is showing) flies into the new screen's back
   button; on pop the back label flies back into the title it names. The two real labels hide while a pair of
   copies (one styled as the source, one as the destination) travels between them on the same spring as the
   screens, scaling and cross-fading from one style to the other. An edge swipe scrubs it with the finger: the stack
   reports its swipe (start, progress, end) to `swipe()`. No React in here. */

/** The elements of a screen's header the morph reads. */
export interface TitleParts {
  /** The screen's root; `data-scrolled` says its large title has gone under the bar. */
  el?: HTMLElement | null;
  large?: HTMLElement | null;
  inline?: HTMLElement | null;
  back?: HTMLElement | null;
}

interface Flight { set: (t: number) => void; done: () => void }

/** A flight in progress: `run` is its spring once released. */
export interface ActiveFlight { f: Flight; run?: { stop: () => void } }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The title a screen is showing right now: its large title until it scrolls under the bar, else the inline one. */
export function shownTitle(r: TitleParts | undefined): HTMLElement | null {
  if (!r) return null;
  if (r.large && !r.el?.hasAttribute('data-scrolled')) return r.large;
  if (r.inline && parseFloat(getComputedStyle(r.inline).opacity) > 0.5) return r.inline;
  return null;
}

/** The title that flies out on a push. A large title that has scrolled under the bar leaves nothing to fly from (its
 *  inline stand-in sits at the bar's centre, an odd place for the back label to appear from), so the new screen
 *  just slides in with its own back button. A screen without a large title flies its inline one as usual. */
export function pushedTitle(r: TitleParts | undefined): HTMLElement | null {
  if (r?.large && r.el?.hasAttribute('data-scrolled')) return null;
  return shownTitle(r);
}

/** A screen's back label, when it shows the previous title (not "Back", not nothing). */
export function backLabel(r: TitleParts | undefined): HTMLElement | null {
  return r?.back && r.back.dataset.mode === 'title' ? r.back : null;
}

/** The back chevron beside a back label. It rides in with the new screen, straight through the title that is
 *  travelling to its side, so the flight draws its own copy that fades in where the chevron will rest. */
function backChevron(to: HTMLElement): HTMLElement | SVGElement | null {
  if (!to.dataset.mode) return null; // only a back label (data-mode) has one; a title's sibling is something else
  const c = to.previousElementSibling;
  return c instanceof HTMLElement || c instanceof SVGElement ? c : null;
}

function titleFlight(cont: HTMLElement, from: HTMLElement, to: HTMLElement, toScreen: HTMLElement | null | undefined): Flight | null {
  const cr = cont.getBoundingClientRect(), fr = from.getBoundingClientRect(), tr = to.getBoundingClientRect();
  if (!fr.width || !tr.width) return null;
  // `to` is measured where it will be once its screen settles at the stack's origin.
  const sr = toScreen ? toScreen.getBoundingClientRect() : cr;
  const f = { x: fr.left - cr.left, y: fr.top - cr.top, w: fr.width, h: fr.height };
  const d = { x: tr.left - sr.left, y: tr.top - sr.top, w: tr.width, h: tr.height };
  const fs = getComputedStyle(from), ts = getComputedStyle(to);
  const k = (parseFloat(ts.fontSize) || 17) / (parseFloat(fs.fontSize) || 17);
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.dataset.slot = 'navigation-title-flight';
  Object.assign(layer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '300', overflow: 'hidden' });
  const copy = (src: HTMLElement, cs: CSSStyleDeclaration, r: { w: number; h: number }) => {
    const c = document.createElement('div');
    c.innerHTML = src.innerHTML;
    Object.assign(c.style, {
      position: 'absolute', left: '0', top: '0', width: r.w + 'px', height: r.h + 'px', whiteSpace: 'nowrap', overflow: 'hidden',
      textOverflow: 'ellipsis', transformOrigin: '0 50%', willChange: 'transform, opacity',
      color: cs.color, fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      letterSpacing: cs.letterSpacing, lineHeight: r.h + 'px',
    });
    layer.appendChild(c);
    return c;
  };
  const a = copy(from, fs, f), b = copy(to, ts, d);
  cont.appendChild(layer);
  from.style.visibility = 'hidden'; to.style.visibility = 'hidden';
  // Titles of one size (an inline title into the back label, and back) have no scale change to hide a cross-fade
  // behind, and two half-faded copies of the same words read as a blink. There the source stays solid under the
  // arriving copy and drops out only once that one is opaque.
  const same = Math.abs(k - 1) < 0.05;
  const chevEl = backChevron(to);
  let chev: HTMLElement | null = null;
  if (chevEl) {
    const r = chevEl.getBoundingClientRect();
    chev = chevEl.cloneNode(true) as HTMLElement;
    Object.assign(chev.style, {
      position: 'absolute', left: r.left - sr.left + 'px', top: r.top - sr.top + 'px', margin: '0', opacity: '0',
      width: r.width + 'px', height: r.height + 'px', color: getComputedStyle(chevEl).color,
    });
    layer.appendChild(chev);
    chevEl.style.visibility = 'hidden';
  }
  return {
    set(t) {
      const x = lerp(f.x, d.x, t), cy = lerp(f.y + f.h / 2, d.y + d.h / 2, t);
      a.style.transform = `translate(${x}px, ${cy - f.h / 2}px) scale(${lerp(1, k, t)})`;
      b.style.transform = `translate(${x}px, ${cy - d.h / 2}px) scale(${lerp(1 / k, 1, t)})`;
      a.style.opacity = String(same ? clamp01((0.85 - t) / 0.2) : clamp01(1 - t * 1.8));
      b.style.opacity = String(same ? clamp01(t / 0.6) : clamp01((t - 0.2) / 0.6));
      if (chev) chev.style.opacity = String(clamp01((t - 0.3) / 0.5));
    },
    done() { from.style.visibility = ''; to.style.visibility = ''; if (chevEl) chevEl.style.visibility = ''; layer.remove(); },
  };
}

/** What a stack tells its title flight: how to read a page's header. */
export interface TitleFlightSource {
  /** The header elements of a page element. */
  parts: (page: HTMLElement) => TitleParts;
}

/** A stack's edge swipe as the flight follows it: started on the top page over the one under it, moved to
 *  `progress` (0..1), or ended, having popped the page or not. */
export type TitleFlightSwipe =
  | { phase: 'start'; top: HTMLElement; under: HTMLElement | null }
  | { phase: 'move'; progress: number }
  | { phase: 'end'; popped: boolean };

type Spring = typeof springs.smooth | typeof springs.tray;

/** Runs a 0..1 progress from `from` to `to` on one of the kit's springs (UI SDK's `solveSpring`, sampled every
 *  frame), calling `set` with each value and `done` once it is at rest. Returns what stops it. */
function springTo(from: number, to: number, { stiffness, damping, mass }: Spring, set: (value: number) => void, done: () => void) {
  // The preset in UI SDK's terms: its period (s) and its damping ratio.
  const solver = solveSpring((2 * Math.PI) / Math.sqrt(stiffness / mass), damping / (2 * Math.sqrt(stiffness * mass)), from - to, 0);
  let frame = 0;
  let start: number | undefined;
  const tick = (now: number) => {
    start ??= now;
    const t = now - start;
    // At rest: within a thousandth of the way, and all but still (per ms).
    if (Math.abs(solver.position(t)) < 1e-3 && Math.abs(solver.velocity(t)) < 1e-5) {
      set(to);
      done();
      return;
    }
    set(to + solver.position(t));
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(frame) };
}

/** One stack's title flight, drawn in `cont` (the stack's root, whose children are its pages). One flight runs at a
 *  time: starting another (or `destroy`) ends the one in progress, so a push or pop that lands mid-flight simply
 *  takes over. While a page swipes, the flight from its back label to the title under it scrubs with the swipe's
 *  progress and, once it ends, settles on the tray spring toward where it was let go to. A pop the swipe made has
 *  flown already: the `fly` for it (naming the page that left) is skipped. */
export function createTitleFlight(cont: HTMLElement, source: TitleFlightSource) {
  let current: ActiveFlight | null = null;
  let frame = 0;
  const end = () => {
    cancelAnimationFrame(frame);
    const c = current;
    current = null;
    if (c) { c.run?.stop(); c.f.done(); }
  };
  const settle = (c: ActiveFlight, from: number, to: 0 | 1, spring: Spring) => {
    c.run = springTo(from, to, spring, c.f.set, () => { if (current === c) end(); });
  };

  // The swipe under way, and the page the last committed swipe popped.
  let swiping: { flight: ActiveFlight | null; p: number; top: HTMLElement } | null = null;
  let swiped: HTMLElement | null = null;

  /** Plays a flight on the smooth spring, after a frame (once the new page has laid out its bar). `leaving` is the
   *  page that was on top: a pop a swipe already flew is not flown again. */
  const fly = (pick: () => [HTMLElement | null, HTMLElement | null, HTMLElement | null | undefined], leaving?: HTMLElement | null) => {
    const after = swiped;
    swiped = null;
    if (after && leaving === after) return;
    end();
    if (reducedMotion()) return;
    frame = requestAnimationFrame(() => {
      const [from, to, toScreen] = pick();
      if (!from || !to) return;
      const f = titleFlight(cont, from, to, toScreen);
      if (!f) return;
      f.set(0);
      const c: ActiveFlight = { f };
      current = c;
      settle(c, 0, 1, springs.smooth);
    });
  };

  /** Follows the stack's edge swipe. */
  const swipe = (event: TitleFlightSwipe) => {
    if (event.phase === 'start') {
      end();
      swiped = null;
      const from = backLabel(source.parts(event.top));
      const to = event.under ? shownTitle(source.parts(event.under)) : null;
      const f = !reducedMotion() && from && to ? titleFlight(cont, from, to, event.under) : null;
      let flight: ActiveFlight | null = null;
      if (f) { f.set(0); flight = current = { f }; }
      swiping = { flight, p: 0, top: event.top };
    } else if (event.phase === 'move') {
      if (!swiping) return;
      swiping.p = event.progress;
      if (swiping.flight && current === swiping.flight) swiping.flight.f.set(event.progress);
    } else if (swiping) {
      const { flight, p, top } = swiping;
      swiping = null;
      if (event.popped) swiped = top;
      if (flight && current === flight) settle(flight, p, event.popped ? 1 : 0, springs.tray);
    }
  };

  return {
    fly,
    swipe,
    end,
    destroy() { swiping = null; end(); },
  };
}
