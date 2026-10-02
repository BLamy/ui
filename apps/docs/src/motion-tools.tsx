import { useEffect, useState } from 'react';

/* Motion dev tools: slow every animation down to see it, and pretend the user asked for reduced motion.
   ⌥M shows and hides the panel; `?motion=0.25` (or 0.5, 0.1) and `?reduce=1` set the starting state, so a link can
   carry a slowed demo. Nothing is installed until a speed other than 1× is chosen.

   The kit's motion comes from two engines, and each is slowed its own way:
   - framer-motion springs (title flights, sheets, morphs) read `performance.now()` once per frame, so the tool swaps in
     a clock that runs at the chosen fraction of real time. It is re-anchored on every change, so time never jumps.
   - CSS transitions and animations (the `--ease-spring-*` curves, `animate-bl-*`) are Web Animations: each one gets the
     chosen speed as its `playbackRate` as it starts, and the running ones are updated when the speed changes.
   "Reduce motion" answers `matchMedia('(prefers-reduced-motion: reduce)')`, which is what the kit's JS checks. CSS
   `motion-reduce:` variants are a media query only the browser can flip: for those use DevTools → Rendering →
   Emulate CSS media feature prefers-reduced-motion. */

export const SPEEDS = [1, 0.5, 0.25, 0.1] as const;

let scale = 1;
let clockInstalled = false;
let realNow: () => number;
let anchorReal = 0;
let anchorFake = 0;

function installClock() {
  if (clockInstalled) return;
  clockInstalled = true;
  realNow = performance.now.bind(performance);
  anchorReal = anchorFake = realNow();
  performance.now = () => anchorFake + (realNow() - anchorReal) * scale;
  // Animations that start later, in any element.
  for (const type of ['transitionrun', 'animationstart'] as const) {
    document.addEventListener(type, (e) => {
      if (scale === 1) return;
      (e.target as Element).getAnimations?.({ subtree: true }).forEach((a) => { a.playbackRate = scale; });
    }, true);
  }
}

/** Runs animations at `speed` × real time (1 = normal). */
export function setMotionSpeed(speed: number) {
  if (speed === 1 && !clockInstalled) return;
  installClock();
  // Re-anchor first, so the fake clock continues from where it is instead of jumping to the new rate.
  const r = realNow();
  anchorFake += (r - anchorReal) * scale;
  anchorReal = r;
  scale = speed;
  document.getAnimations().forEach((a) => { a.playbackRate = speed; });
}

/* ── prefers-reduced-motion ── */

let reduced = false;
let matchMediaPatched = false;
const listeners = new Set<() => void>();

function patchMatchMedia() {
  if (matchMediaPatched || typeof window.matchMedia !== 'function') return;
  matchMediaPatched = true;
  const real = window.matchMedia.bind(window);
  window.matchMedia = (query: string) => {
    const mql = real(query);
    if (!/prefers-reduced-motion\s*:\s*reduce/.test(query)) return mql;
    // A stand-in the kit's checks (and framer's useReducedMotion) read and subscribe to.
    const change = new Set<(e: MediaQueryListEvent) => void>();
    const notify = () => change.forEach((fn) => fn({ matches: reduced || mql.matches, media: query } as MediaQueryListEvent));
    listeners.add(notify);
    mql.addEventListener('change', notify);
    return {
      get matches() { return reduced || mql.matches; },
      media: mql.media,
      onchange: null,
      addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => { change.add(fn); },
      removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => { change.delete(fn); },
      addListener: (fn: (e: MediaQueryListEvent) => void) => { change.add(fn); },
      removeListener: (fn: (e: MediaQueryListEvent) => void) => { change.delete(fn); },
      dispatchEvent: () => true,
    } as MediaQueryList;
  };
}

/** Makes the kit's JS see `prefers-reduced-motion: reduce` (or stop doing so). */
export function setReducedMotion(on: boolean) {
  reduced = on;
  listeners.forEach((fn) => fn());
}

/** Call once, before anything renders: framer caches its reduced-motion query on first use, so the `matchMedia` stand-in
 *  has to be in place before then (it forwards the real answer unless "Reduce" is on). Applies the starting state from
 *  the URL (`?motion=0.25&reduce=1`); true when either was given. */
export function initMotionTools(search = window.location.search): boolean {
  patchMatchMedia();
  const p = new URLSearchParams(search);
  const speed = Number(p.get('motion'));
  if (speed > 0 && speed <= 1) setMotionSpeed(speed);
  const reduce = p.get('reduce') === '1';
  if (reduce) setReducedMotion(true);
  return (speed > 0 && speed <= 1) || reduce;
}

/** The panel: ⌥M toggles it (it starts open when the URL set a speed or reduced motion). */
export default function MotionTools({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [speed, setSpeed] = useState<number>(scale);
  const [reduce, setReduce] = useState(reduced);
  useEffect(() => {
    // `code`, not `key`: ⌥M types "µ" on a Mac.
    const on = (e: KeyboardEvent) => { if (e.altKey && e.code === 'KeyM') { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  if (!open) return null;
  const pill = (active: boolean) =>
    `cursor-pointer rounded-md border px-2 py-1 text-[12px] font-medium ${active ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-background text-foreground'}`;
  return (
    <div
      data-slot="motion-tools"
      role="group"
      aria-label="Motion tools"
      className="fixed bottom-3 left-3 z-[2147483000] flex items-center gap-2 rounded-xl border border-border bg-popover p-2 text-[12px] text-foreground shadow-lg"
    >
      <span className="px-1 font-semibold">Motion</span>
      {SPEEDS.map((s) => (
        <button key={s} type="button" aria-pressed={speed === s} className={pill(speed === s)} onClick={() => { setMotionSpeed(s); setSpeed(s); }}>
          {s === 1 ? '1×' : `${s}×`}
        </button>
      ))}
      <label className="ml-1 flex cursor-pointer items-center gap-1.5 px-1" title="JS checks only — CSS motion-reduce needs DevTools → Rendering">
        <input type="checkbox" checked={reduce} onChange={(e) => { setReducedMotion(e.target.checked); setReduce(e.target.checked); }} />
        Reduce
      </label>
    </div>
  );
}
