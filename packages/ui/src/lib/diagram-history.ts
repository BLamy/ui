'use client';
import { useEffect, useRef, useState } from 'react';

/* ══ Diagram history — undo and redo, for a diagram or for whatever it's drawn from ══
   A Diagram that's `editable` keeps a history of its own data. A component that draws a diagram from something bigger
   (a machine's config, a system of services) keeps the history of that instead, and hands it to `<Diagram history>`:
   then the diagram's ⌘Z / ⇧⌘Z / ⌘Y, DiagramToolbar's Undo and Redo, a controller and an agent all drive that one. */

/** Undo and redo for something with a history: what DiagramToolbar's buttons and ⌘Z / ⇧⌘Z / ⌘Y drive. */
export interface DiagramHistory {
  canUndo: boolean;
  canRedo: boolean;
  undo: (event?: Event) => void;
  redo: (event?: Event) => void;
}

export interface DiagramHistoryChangeDetails {
  reason: 'undo' | 'redo';
  event?: Event;
}

export interface DiagramHistoryOptions<T> {
  /** How many steps undo reaches back (default 100). */
  limit?: number;
  /** Whether two values are the same one (default `Object.is`): how the history tells its own changes from one from outside. */
  isEqual?: (a: T, b: T) => boolean;
}

export interface UseDiagramHistory<T> extends DiagramHistory {
  /** After an edit you made: the value before it, and after it. */
  record: (before: T, after: T) => void;
  /** Forgets every step. It also happens by itself when `value` becomes something that's neither an edit recorded here
   *  nor a step undone or redone to: what comes from outside starts over. */
  reset: () => void;
}

interface Steps<T> { past: T[]; future: T[] }

const DIAGRAM_HISTORY_LIMIT = 100;

/** A snapshot history of `value`, for `<Diagram history>`. `onChange` shows the value a step undoes or redoes to, and
 *  can refuse it by returning `false`, which leaves the history where it was. */
export function useDiagramHistory<T>(
  value: T,
  onChange: (value: T, details: DiagramHistoryChangeDetails) => boolean | void,
  { limit = DIAGRAM_HISTORY_LIMIT, isEqual = Object.is }: DiagramHistoryOptions<T> = {},
): UseDiagramHistory<T> {
  const [steps, setSteps] = useState<Steps<T>>({ past: [], future: [] });
  // The value this history last put there or heard of: anything else that turns up came from outside.
  const expected = useRef(value);
  const same = useRef(isEqual);
  same.current = isEqual;
  useEffect(() => {
    if (same.current(value, expected.current)) return;
    expected.current = value;
    setSteps((s) => (s.past.length || s.future.length ? { past: [], future: [] } : s));
  }, [value]);

  const step = (reason: 'undo' | 'redo', event?: Event) => {
    const from = reason === 'undo' ? steps.past : steps.future;
    const to = from[from.length - 1];
    if (from.length === 0) return;
    if (onChange(to as T, { reason, event }) === false) return;
    expected.current = to as T;
    setSteps((s) => (reason === 'undo'
      ? { past: s.past.slice(0, -1), future: [...s.future, value] }
      : { past: [...s.past, value], future: s.future.slice(0, -1) }));
  };

  return {
    canUndo: steps.past.length > 0,
    canRedo: steps.future.length > 0,
    undo: (event) => step('undo', event),
    redo: (event) => step('redo', event),
    record: (before, after) => {
      expected.current = after;
      setSteps((s) => ({ past: [...s.past.slice(-(limit - 1)), before], future: [] }));
    },
    reset: () => setSteps({ past: [], future: [] }),
  };
}
