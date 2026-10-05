/* Dragging a component from the library onto the canvas. The library item keeps the pointer (pointer capture), so the
   drag is published here and the canvas, which can't see those events, reads where it is and draws where the item
   would land. Pointer events rather than HTML drag and drop: it works with touch and shows our own preview. */
import { useSyncExternalStore } from 'react';
import type { LibraryItem } from './catalog';

export interface LibraryDrag {
  item: LibraryItem;
  /** The pointer, in client px. */
  x: number;
  y: number;
}

type DropHandler = (drag: LibraryDrag) => boolean;

let current: LibraryDrag | null = null;
const listeners = new Set<() => void>();
let onDrop: DropHandler | null = null;

const emit = () => listeners.forEach((l) => l());

export const libraryDrag = {
  start(item: LibraryItem, x: number, y: number) { current = { item, x, y }; emit(); },
  move(x: number, y: number) { if (current) { current = { ...current, x, y }; emit(); } },
  /** Ends the drag; true when the canvas took the item. */
  end(): boolean {
    const d = current;
    current = null;
    const taken = !!(d && onDrop?.(d));
    emit();
    return taken;
  },
  cancel() { current = null; emit(); },
  /** The canvas registers what a drop does. */
  setDropHandler(fn: DropHandler | null) { onDrop = fn; },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  get: () => current,
};

export function useLibraryDrag(): LibraryDrag | null {
  return useSyncExternalStore(libraryDrag.subscribe, libraryDrag.get, () => null);
}
