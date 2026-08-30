import { useState } from 'react';
import { Haptics } from '@touchkit/ui';
import type { PencilStroke } from './constants';
import type { PencilStrokesChangeSource } from './pencil-canvas';

export interface PencilHistory {
  strokes: PencilStroke[];
  /** Wire to PencilCanvas `onStrokesChange`. A committed draw clears the redo stack. */
  onStrokesChange: (next: PencilStroke[], source: PencilStrokesChangeSource) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/** Undo / redo / clear stack for PencilCanvas strokes, with the prototype's haptics. */
export function usePencilHistory(initial: PencilStroke[] = []): PencilHistory {
  const [strokes, setStrokes] = useState<PencilStroke[]>(initial);
  const [redoStack, setRedoStack] = useState<PencilStroke[]>([]);

  const onStrokesChange = (next: PencilStroke[], source: PencilStrokesChangeSource) => {
    setStrokes(next);
    if (source === 'draw') setRedoStack([]);
  };
  const undo = () => {
    if (!strokes.length) return;
    Haptics.impact('light');
    setRedoStack([...redoStack, strokes[strokes.length - 1]]);
    setStrokes(strokes.slice(0, -1));
  };
  const redo = () => {
    if (!redoStack.length) return;
    Haptics.impact('light');
    setStrokes([...strokes, redoStack[redoStack.length - 1]]);
    setRedoStack(redoStack.slice(0, -1));
  };
  const clear = () => {
    if (!strokes.length) return;
    Haptics.impact('medium');
    setStrokes([]);
    setRedoStack([]);
  };

  return { strokes, onStrokesChange, undo, redo, clear, canUndo: strokes.length > 0, canRedo: redoStack.length > 0 };
}
