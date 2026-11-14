'use client';
import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createVirtualizer, type VirtualAlign, type VirtualItem } from '@ui-sdk/core';

/* ══ useVirtualRows — UI SDK's virtualizer for a long list of rows that share one height: only the rows in view (and a
   few past each edge) are in the DOM. Put `scrollerRef` on the element that scrolls, give the box inside it
   `height: size`, and render `items`, each at `top: item.start`.
   const { scrollerRef, items, size } = useVirtualRows({ rows, count: rows.length, rowHeight: 24, keyOf: (i) => rows[i].id });
   Rows named by `keep` stay rendered wherever the scroller is: pass the row that holds focus, so scrolling it away
   doesn't drop focus to the page. ══ */

export interface VirtualRowsOptions {
  /** How many rows the list has. */
  count: number;
  /** Every row's height in px. */
  rowHeight: number;
  /** A stable key for a row. Default: its index. */
  keyOf?: (index: number) => string;
  /** Whatever the rows come from (their array): when it changes, the list reads its rows again. */
  rows?: unknown;
  /** Rows rendered past each edge. Default 4. */
  overscan?: number;
  /** Rows that stay rendered wherever the scroller is, like the one with focus. */
  keep?: () => readonly number[];
}

export interface VirtualRows {
  /** For the element that scrolls. */
  scrollerRef: (el: HTMLElement | null) => (() => void) | undefined;
  /** The rows to render now: `index`, `key`, and `start` (px from the top). */
  items: readonly VirtualItem[];
  /** The height of every row together, for the box the rows sit in. */
  size: number;
  /** Scrolls so a row shows. `auto` (the default) scrolls only as far as it takes. */
  scrollToIndex: (index: number, options?: { align?: VirtualAlign; behavior?: ScrollBehavior }) => void;
}

export function useVirtualRows({ count, rowHeight, keyOf, rows, overscan, keep }: VirtualRowsOptions): VirtualRows {
  const live = useRef({ count, rowHeight, keyOf, keep });
  live.current = { count, rowHeight, keyOf, keep };
  const virtual = useMemo(
    () =>
      createVirtualizer({
        count: () => live.current.count,
        estimate: () => live.current.rowHeight,
        key: (index) => live.current.keyOf?.(index) ?? String(index),
        keep: () => live.current.keep?.() ?? [],
        ...(overscan === undefined ? {} : { overscan }),
      }),
    [overscan],
  );
  const items = useSyncExternalStore(virtual.subscribe, virtual.items, virtual.items);
  // The rows changed without a scroll: read them again before the browser paints.
  useLayoutEffect(() => {
    virtual.refresh();
  }, [virtual, count, rowHeight, rows]);
  const scrollerRef = useCallback((el: HTMLElement | null) => (el ? virtual.connect(el) : undefined), [virtual]);
  return { scrollerRef, items, size: count * rowHeight, scrollToIndex: virtual.scrollToIndex };
}
