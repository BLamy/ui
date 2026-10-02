'use client';
import { useState } from 'react';

/** State that is either controlled (`value` given) or held here, starting at `defaultValue`. The setter updates
 *  the internal copy only when uncontrolled and always calls `onChange`, so a controlled parent decides. */
export function useControllableState<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void,
): [T, (next: T) => void] {
  const [internal, setInternal] = useState(defaultValue);
  const set = (next: T) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };
  return [value === undefined ? internal : value, set];
}
