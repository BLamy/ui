'use client';
import { useEffect, useState, type RefObject } from 'react';
import { onFontsLoaded } from '@/lib/diagram-text';

/** Goes up each time fonts finish loading: put it in the deps of whatever measures text. */
export function useFontVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => onFontsLoaded(() => setVersion((v) => v + 1)), []);
  return version;
}

/** Goes up each time an element goes from not being drawn, in a `display: none` tab say, to being drawn. Nothing can be
 *  measured in an element that isn't drawn, so put it in the deps of whatever measures in one. */
export function useShownVersion(element: RefObject<Element | null> | undefined): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const el = element?.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let drawn = el.getClientRects().length > 0;
    const ro = new ResizeObserver(() => {
      const now = el.getClientRects().length > 0;
      if (now && !drawn) setVersion((v) => v + 1);
      drawn = now;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [element]);
  return version;
}
