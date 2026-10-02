'use client';
import { useEffect, useRef } from 'react';

/* Back-gesture history bridge: on touch devices the system edge-swipe would navigate the page itself away
   (blank screen). While any stack can pop we keep one history sentinel armed; the system gesture then lands
   as popstate and pops OUR stack instead of the page. */

interface PopTarget { depth: number; pop: () => void }

const stacks = new Set<() => PopTarget>();
let armed = false;
let coarse = typeof matchMedia !== 'undefined' && matchMedia('(any-pointer: coarse)').matches;

/** Pushes the history sentinel the system back gesture will land on (touch devices only; once at a time). */
export function armBackHistory() {
  if (!coarse || armed) return;
  try { history.pushState({ blNav: 1 }, ''); armed = true; } catch { coarse = false; }
}

interface Flagged { __tkPopstate?: number }
if (typeof window !== 'undefined' && !(window as Window & Flagged).__tkPopstate) {
  // One listener for the page, even if this module is loaded twice.
  (window as Window & Flagged).__tkPopstate = 1;
  window.addEventListener('popstate', () => {
    if (!armed) return;
    armed = false;
    // The deepest stack that can pop (the last registered, among those with something to go back to).
    let best: PopTarget | null = null;
    stacks.forEach((read) => { const s = read(); if (s.depth > 1) best = s; });
    const target = best as PopTarget | null;
    if (!target) return;
    target.pop();
    setTimeout(() => {
      let can = false;
      stacks.forEach((read) => { if (read().depth > 1) can = true; });
      if (can) armBackHistory();
    }, 80);
  });
}

/** Registers a stack with the bridge for as long as it is mounted. `depth` is its screen count (it can pop above 1). */
export function useBackHistory(depth: number, pop: () => void) {
  const latest = useRef<PopTarget>({ depth, pop });
  latest.current = { depth, pop };
  useEffect(() => {
    const read = () => latest.current;
    stacks.add(read);
    return () => { stacks.delete(read); };
  }, []);
}
