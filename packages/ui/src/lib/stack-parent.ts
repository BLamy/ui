'use client';
import { createContext } from 'react';

/* ══ The container around a NavigationStack ══
   A NavigationStack can sit in something that has its own way back: a collapsed SplitView column goes back to the
   column before it. The container provides a `StackParent`; the stack at its root reads it, names its first page in
   it (the label of the next column's back button) and draws the parent's back button on its first page. The stack
   provides `null` inside its own pages, so a stack nested in a page, or anything else drawn in one, gets nothing:
   the way back from a pushed page is the stack's own. This keeps NavigationStack free of SplitView (and SplitView
   free of NavigationStack): they meet here. ══ */

/** What a container offers the stack at its root. */
export interface StackParent {
  /** The way back from the stack's first page, labelled with what it goes back to; null while there's none (a
   *  SplitView column that is tiled, or the first column). */
  back: { title: string; onClick: () => void } | null;
  /** The first page's title, for what comes after the container (a collapsed SplitView's next column labels its
   *  back button with it). `undefined` takes it back. */
  setTitle: (title: string | undefined) => void;
  /** Listens for the container's place being picked again while it shows (the selected tab of a SplitView tab bar
   *  or of a Tabs `bar` / `rail`, pressed again): a stack pops to its first page, or scrolls that page to the top when it is there already, as
   *  iOS does. Returns the way to stop listening. */
  onReselect?: (listener: () => void) => () => void;
}

/** A container's "picked again" signal, by place (a SplitView column, a Tabs panel's value): what feeds
 *  `StackParent.onReselect`. SplitView's tab bar and Tabs `bar` / `rail` both emit it when their selected tab is
 *  pressed again, so a NavigationStack under either pops to its first page, then scrolls it to the top. */
export interface Reselect<K = string> {
  emit: (place: K) => void;
  on: (place: K, listener: () => void) => () => void;
}

export function createReselect<K = string>(): Reselect<K> {
  const listeners = new Map<K, Set<() => void>>();
  return {
    emit: (place) => listeners.get(place)?.forEach((l) => l()),
    on(place, listener) {
      const set = listeners.get(place) ?? new Set();
      listeners.set(place, set);
      set.add(listener);
      return () => { set.delete(listener); };
    },
  };
}

/** Scrolls a page's content back to its top: smoothly, unless the reader asked for reduced motion. */
export function scrollToTop(el: Element | null | undefined) {
  if (!(el instanceof HTMLElement) || el.scrollTop === 0) return;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  else el.scrollTop = 0;
}

/** The container around (a SplitView column), or null: outside every container, or inside a page of a stack. */
export const StackParentContext = createContext<StackParent | null>(null);
