'use client';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/* State that survives a reload: `useState` backed by localStorage as JSON. A missing, unparseable or invalid stored
   value falls back to the initial one, and storage that throws (private mode, quota, disabled) is ignored: the state
   just doesn't persist. Pass `null` for the key to turn persistence off and get plain `useState`. */

/** Reads a JSON value from localStorage, or `undefined` when it is missing, malformed or storage is unavailable. */
export function loadJSON(key: string): unknown {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Writes a JSON value to localStorage; storage that throws is ignored. */
export function saveJSON(key: string, value: unknown): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or quota: not persisted */
  }
}

export function usePersistentState<T>(
  key: string | null,
  initial: T | (() => T),
  /** Returns true for a stored value that is the right shape; anything else is ignored. */
  isValid: (value: unknown) => value is T = (value): value is T => value !== undefined,
): [T, Dispatch<SetStateAction<T>>] {
  const read = (k: string | null): T => {
    const stored = k ? loadJSON(k) : undefined;
    return stored !== undefined && isValid(stored) ? stored : initial instanceof Function ? initial() : initial;
  };
  const [state, setState] = useState<T>(() => read(key));
  // A different key is a different record: load it (the initial value when nothing valid is stored) instead of
  // writing the old key's state over it.
  const [loadedKey, setLoadedKey] = useState(key);
  if (loadedKey !== key) {
    setLoadedKey(key);
    setState(read(key));
  }
  const first = useRef(true);
  const savedKey = useRef(key);
  useEffect(() => {
    // Not on mount: reading a value and writing it straight back would only churn storage.
    if (first.current) { first.current = false; return; }
    // Nor on a key change: the state was just loaded from that key.
    if (savedKey.current !== key) { savedKey.current = key; return; }
    if (key) saveJSON(key, state);
  }, [key, state]);
  return [state, setState];
}
