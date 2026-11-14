'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { announce } from '@ui-sdk/core';

/* ══ useCopy — copy text, say so, and show "Copied" for a moment ══
   Writes to the clipboard (or to `write`, for a host with a clipboard of its own), tells screen readers ("Copied"),
   and keeps `copied` set to what was copied for `resetMs`, so a button can show a check or "Copied" meanwhile.
   const { copy, copied } = useCopy<string>();
   <Button onClick={() => copy(text, row.id)}>{copied === row.id ? 'Copied' : 'Copy'}</Button>
   `copy(text)` without a key sets `copied` to `true`. ══ */

export interface UseCopyOptions {
  /** Writes the text instead of `navigator.clipboard`: a host with its own clipboard (an editor's webview, Electron). */
  write?: (text: string) => void | Promise<void>;
  /** How long `copied` stays set, in ms. Default 1200. */
  resetMs?: number;
  /** What screen readers hear after a copy. Default "Copied"; an empty string says nothing. */
  announcement?: string;
}

export interface UseCopy<K> {
  /** Copies the text (or what the promise gives). Resolves `true` once it is on the clipboard. */
  copy: (text: string | Promise<string>, key?: K) => Promise<boolean>;
  /** The key of the last copy (or `true`), until `resetMs` has passed; `null` otherwise. */
  copied: K | true | null;
}

export function useCopy<K = true>({ write, resetMs = 1200, announcement = 'Copied' }: UseCopyOptions = {}): UseCopy<K> {
  const [copied, setCopied] = useState<K | true | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const live = useRef({ write, resetMs, announcement });
  live.current = { write, resetMs, announcement };
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback((text: string | Promise<string>, key?: K): Promise<boolean> => {
    const done = () => {
      if (live.current.announcement) announce(live.current.announcement);
      setCopied(key === undefined ? true : key);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), live.current.resetMs);
      return true;
    };
    const put = (value: string): Promise<boolean> => {
      const own = live.current.write;
      if (!own && !navigator.clipboard) return Promise.resolve(false);
      try {
        return Promise.resolve(own ? own(value) : navigator.clipboard.writeText(value)).then(done, () => false);
      } catch {
        return Promise.resolve(false);
      }
    };
    return typeof text === 'string' ? put(text) : text.then(put, () => false);
  }, []);
  return { copy, copied };
}
