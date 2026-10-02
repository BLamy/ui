'use client';
import { useEffect, useRef, type RefObject } from 'react';
import { animate, type AnimationPlaybackControls } from 'framer-motion';
import { springs } from '@/lib/motion';

/* ══ Header title morph ══
   On push the previous screen's title (large or inline, whichever is showing) flies into the new screen's back
   button; on pop the back label flies back into the title it names. The two real labels hide while a pair of
   copies (one styled as the source, one as the destination) travels between them on the same spring as the
   screens, scaling and cross-fading from one style to the other. An edge swipe scrubs it with the finger. */

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
export interface ActiveFlight { f: Flight; run?: AnimationPlaybackControls }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The title a screen is showing right now: its large title until it scrolls under the bar, else the inline one. */
export function shownTitle(r: TitleParts | undefined): HTMLElement | null {
  if (!r) return null;
  if (r.large && !r.el?.hasAttribute('data-scrolled')) return r.large;
  if (r.inline && parseFloat(getComputedStyle(r.inline).opacity) > 0.5) return r.inline;
  return null;
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

/** Owns the stack's one flight at a time: starting another (or unmounting) ends the one in progress, so a push or
 *  pop that lands mid-flight simply takes over. `cont` is the element the flight layer is drawn in. */
export function useTitleFlight(cont: RefObject<HTMLElement | null>) {
  const current = useRef<ActiveFlight | null>(null);
  const end = () => {
    const c = current.current;
    current.current = null;
    if (c) { c.run?.stop(); c.f.done(); }
  };
  const isCurrent = (c: ActiveFlight | null | undefined): c is ActiveFlight => !!c && current.current === c;
  const settle = (c: ActiveFlight, from: number, to: 0 | 1, spring: typeof springs.smooth | typeof springs.tray) => {
    c.run = animate(from, to, { ...spring, onUpdate: c.f.set, onComplete: () => { if (current.current === c) end(); } });
  };

  /** Plays a flight on the smooth spring, after a frame (once the new screen has laid out its bar). */
  const fly = (pick: () => [HTMLElement | null, HTMLElement | null, HTMLElement | null | undefined]) => {
    end();
    if (reducedMotion()) return;
    requestAnimationFrame(() => {
      const [from, to, toScreen] = pick();
      if (!from || !to || !cont.current) return;
      const f = titleFlight(cont.current, from, to, toScreen);
      if (!f) return;
      f.set(0);
      const c: ActiveFlight = { f };
      current.current = c;
      settle(c, 0, 1, springs.smooth);
    });
  };

  /** Starts a flight the finger drives (an edge swipe): `set(p)` on the result follows the drag, and `release` hands
   *  it to the tray spring from wherever it was let go. Null when there is nothing to fly or motion is reduced. */
  const scrub = (from: HTMLElement | null, to: HTMLElement | null, toScreen: HTMLElement | null | undefined) => {
    end();
    const f = !reducedMotion() && from && to && cont.current ? titleFlight(cont.current, from, to, toScreen) : null;
    if (!f) return null;
    f.set(0);
    current.current = { f };
    return current.current;
  };
  const release = (c: ActiveFlight | null | undefined, p: number, to: 0 | 1) => {
    if (isCurrent(c)) settle(c, p, to, springs.tray);
  };

  useEffect(() => end, []);
  return { fly, scrub, release, end, isCurrent };
}
