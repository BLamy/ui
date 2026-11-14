'use client';
import { useState } from 'react';
import type { PencilStroke } from '@/components/ui/pencilkit/constants';
import type { PencilStrokesChangeDetails } from '@/components/ui/pencilkit/pencil-canvas';

export interface PencilHistory {
  strokes: PencilStroke[];
  /** Wire to PencilCanvas `onStrokesChange`: every change (a stroke drawn, strokes erased) is one undo step. */
  onStrokesChange: (next: PencilStroke[], details: PencilStrokesChangeDetails) => void;
  /** Reverses the last change: a drawn stroke goes, erased strokes come back, a clear is restored. */
  undo: () => void;
  redo: () => void;
  /** Removes every stroke, as one undoable step. */
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
}

interface Snapshots {
  past: PencilStroke[][];
  present: PencilStroke[];
  future: PencilStroke[][];
}

/** Undo / redo / clear for PencilCanvas strokes, as snapshots: each step keeps the strokes as they were before it. */
export function usePencilHistory(initial: PencilStroke[] = []): PencilHistory {
  const [h, setH] = useState<Snapshots>(() => ({ past: [], present: initial, future: [] }));

  const push = (next: PencilStroke[]) =>
    setH((s) => (next === s.present ? s : { past: [...s.past, s.present], present: next, future: [] }));
  const undo = () =>
    setH((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s));
  const redo = () =>
    setH((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  const clear = () => setH((s) => (s.present.length ? { past: [...s.past, s.present], present: [], future: [] } : s));

  return {
    strokes: h.present,
    onStrokesChange: (next) => push(next),
    undo,
    redo,
    clear,
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
    canClear: h.present.length > 0,
  };
}
