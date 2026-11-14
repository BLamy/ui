'use client';
import * as React from 'react';
import { animateIn, animateOut } from '@ui-sdk/core';

/* ══ Presence — parts that come and go, on UI SDK's animateIn / animateOut ══
   An element that appears plays its enter from `data-starting-style` (written for its first frame); one that
   leaves gets `data-ending-style` (and `inert`) and stays mounted until its CSS transitions have finished. The
   motion itself is CSS on those attributes, so it can be interrupted and honours reduced motion in the
   stylesheet. Nothing plays on first paint unless `appear` asks for it.

     const toast = usePresence<HTMLDivElement>(shown);
     return toast.mounted ? <div ref={toast.ref} className="transition-opacity data-starting-style:opacity-0
       data-ending-style:opacity-0" /> : null;

   For keyed children (tiles, glyphs, cards), `usePresenceList` keeps the ones that left in place while they
   exit, and each child plays its own enter and exit with `useEnterExit`. */

export interface PresenceOptions {
  /** Play the enter on first paint too (default `false`: only what appears later animates in). */
  appear?: boolean;
  /** Come and go at once, playing nothing, while true: a container that hasn't measured itself yet, whose first
   *  measurement is where it starts rather than a change. Default `false`. */
  instant?: boolean;
}

/** What one run of the effect started: an enter or an exit, and whether its effect was cleaned up. */
type Run = { present: boolean; stop: () => void; dropped: boolean; ended: boolean };
const end = (run: Run) => {
  if (run.ended) return;
  run.ended = true;
  run.stop();
};

/**
 * Plays `ref`'s enter when `present` turns true (and on its first paint with `appear`), and its exit when
 * `present` turns false, then calls `exited`. For an element whose mounting someone else manages, like an
 * entry of `usePresenceList`.
 */
export function useEnterExit(
  ref: React.RefObject<HTMLElement | null>,
  present: boolean,
  { appear = false, instant = false, exited }: PresenceOptions & { exited?: () => void } = {},
) {
  const latest = React.useRef(exited);
  latest.current = exited;
  // The `present` the last run saw: null before the first, so a re-run (Strict Mode) is not taken for a change.
  const last = React.useRef<boolean | null>(null);
  const running = React.useRef<Run | null>(null);
  React.useLayoutEffect(() => {
    const was = last.current;
    last.current = present;
    const kept = running.current;
    // Strict Mode cleans an effect up and runs it again at once: what the first run started carries on.
    if (kept && kept.dropped && !kept.ended && kept.present === present) {
      kept.dropped = false;
      return release(kept);
    }
    if (kept) end(kept);
    running.current = null;
    const el = ref.current;
    if (!el) return;
    let stop: () => void;
    if (!present) {
      if (instant) return void latest.current?.();
      stop = animateOut(el, () => latest.current?.());
    } else if (instant || (was === null ? !appear : was)) {
      return;
    } else {
      stop = animateIn(el);
    }
    const run: Run = { present, stop, dropped: false, ended: false };
    running.current = run;
    return release(run);
  }, [present]);
  // A real change or unmount stops it; Strict Mode's re-run comes before this microtask and keeps it.
  function release(run: Run) {
    return () => {
      run.dropped = true;
      queueMicrotask(() => {
        if (!run.dropped) return;
        end(run);
        if (running.current === run) running.current = null;
      });
    };
  }
}

export interface Presence<E extends HTMLElement> {
  /** Render the element: it is shown, or still playing its exit. */
  mounted: boolean;
  /** It is playing its exit. */
  leaving: boolean;
  /** Put it on the element that enters and leaves. */
  ref: React.RefObject<E | null>;
}

/** One element that renders while `present`, and through its exit after. */
export function usePresence<E extends HTMLElement = HTMLElement>(present: boolean, options: PresenceOptions = {}): Presence<E> {
  const [mounted, setMounted] = React.useState(present);
  if (present && !mounted) setMounted(true);
  const ref = React.useRef<E | null>(null);
  const exited = React.useCallback(() => setMounted(false), []);
  useEnterExit(ref, present, { appear: options.appear, instant: options.instant, exited });
  return { mounted: present || mounted, leaving: !present && mounted, ref };
}

/** One entry of `usePresenceList`: an item in the list, or one that left and is still playing its exit. */
export interface PresenceEntry<T> {
  key: string;
  item: T;
  /** Still in the list. */
  present: boolean;
  /** It arrived after the list's first paint, so its enter plays (pass it to `useEnterExit`'s `appear`). */
  appear: boolean;
  /** Call once the exit has played: the entry unmounts. `useEnterExit` calls it for you. */
  exited: () => void;
}

/**
 * The items, plus the ones that left and are still animating out, each at the place it left from. A key that
 * comes back while leaving is present again.
 */
export function usePresenceList<T>(items: readonly T[], keyOf: (item: T) => string): PresenceEntry<T>[] {
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);
  const leaving = React.useRef(new Map<string, { item: T; index: number }>());
  const previous = React.useRef<{ key: string; item: T }[]>([]);
  const painted = React.useRef(false);
  const current = items.map((item) => ({ key: keyOf(item), item }));
  const keys = new Set(current.map((c) => c.key));
  previous.current.forEach((p, index) => {
    if (!keys.has(p.key) && !leaving.current.has(p.key)) leaving.current.set(p.key, { item: p.item, index });
  });
  keys.forEach((key) => leaving.current.delete(key));
  React.useLayoutEffect(() => {
    previous.current = current;
    painted.current = true;
  });
  const appear = painted.current;
  const entries: PresenceEntry<T>[] = current.map(({ key, item }) => ({ key, item, present: true, appear, exited: () => {} }));
  leaving.current.forEach(({ item, index }, key) => {
    const exited = () => {
      if (leaving.current.delete(key)) rerender();
    };
    entries.splice(Math.min(index, entries.length), 0, { key, item, present: false, appear, exited });
  });
  return entries;
}
