'use client';
import { useCallback, useRef, useState } from 'react';
import type { ChangeDetails } from '@ui-sdk/core';
import { changeDetails, type ChangeGiven } from '@/lib/change-details';

/**
 * A kit value with UI SDK-shaped change callbacks: `onChange(next, details)` with `reason`, `event`, `source` and
 * `cancel()`, called before anything moves (as UI SDK's `createChange` does). Controlled when `value` is given: then
 * nothing is written here and the consumer decides by what it passes back. Uncontrolled: the value moves unless
 * the consumer canceled. The setter takes a value or an updater (which sees the latest value, even within one tick
 * when uncontrolled) and why (`{ reason, event?, source? }`, default `imperative`); it returns `false` when nothing
 * was asked for (same value) or the change was canceled.
 */
export function useControllableChange<T, Reason extends string>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T, details: ChangeDetails<Reason>) => void,
): [T, (next: T | ((prev: T) => T), given?: ChangeGiven<Reason>) => boolean] {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const latest = useRef(current);
  latest.current = current;
  const notify = useRef(onChange);
  notify.current = onChange;
  const set = useCallback(
    (next: T | ((prev: T) => T), given?: ChangeGiven<Reason>) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(latest.current) : next;
      if (Object.is(resolved, latest.current)) return false;
      const details = changeDetails<Reason>(given ?? { reason: 'imperative' as Reason });
      notify.current?.(resolved, details);
      if (details.canceled) return false;
      if (!controlled) {
        latest.current = resolved;
        setInner(resolved);
      }
      return true;
    },
    [controlled],
  );
  return [current, set];
}
