'use client';
import { useEffect, useRef, useState } from 'react';

/* ══ usePaced — the latest value, taken at a pace React can keep up with ══
   At once when things are quiet; while new values keep coming (a playhead dragged through thousands of steps) the
   newest every so often, skipping those in between. The wait starts after the last one has committed, so a slow
   render makes it take fewer. Without it, a new value every frame hits React's limit on nested updates.
   const frames = usePaced(framesProp); ══ */

/** How long to wait, after one value has finished going in, before taking the next. */
const PACE_MS = 16;

export function usePaced<T>(value: T, paceMs = PACE_MS): T {
  const [paced, setPaced] = useState({ value, quiet: true });
  const latest = useRef(value);
  latest.current = value;
  let current = paced;
  if (current.quiet && !Object.is(current.value, value)) {
    current = { value, quiet: false };
    setPaced(current);
  }
  useEffect(() => {
    if (current.quiet) return undefined;
    const timer = setTimeout(() => {
      setPaced((p) => (Object.is(p.value, latest.current) ? { value: p.value, quiet: true } : { value: latest.current, quiet: false }));
    }, paceMs);
    return () => clearTimeout(timer);
  }, [current, paceMs]);
  return current.value;
}
