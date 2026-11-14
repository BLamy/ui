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
}

/** The container around (a SplitView column), or null: outside every container, or inside a page of a stack. */
export const StackParentContext = createContext<StackParent | null>(null);
