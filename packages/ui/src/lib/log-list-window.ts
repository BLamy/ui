'use client';
import type { KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import {
  RowHeights, RowIdIndex, rowRange, rowsChange, type RowId, type RowRange,
} from '@/lib/log-list-model';

/* ══ RowWindow — mounts the rows in view and places them, for LogList and RequestTable ══
   The part renders `range` as direct children of a sizer, each with `data-index`; this class does everything else
   outside React: it measures rows, writes each one's `translateY` and the sizer's height, keeps what's on screen still
   when a height changes above it, and asks for a new range only as the scroll gets near the edge of what's mounted.
   Rows' props don't include where they are, so scrolling and measuring re-render nothing but the rows coming and going.

   A scroll event renders with `flushSync`, because a range rendered after the frame shows blank rows. Measuring runs
   right after each commit, before paint, so a row is never seen in the wrong place. A ResizeObserver catches what
   changes later (a width, an image, a value opening); it only moves rows, and leaves mounting to the next frame, as
   mounting from inside its callback is what makes it report a loop.

   Why not react-aria's Virtualizer, the library's pattern: GridList on it was measured in Chromium at 100,000 rows. It
   took 1.6 to 2.2 s to mount, about 1 s for one more row in the data, and 460 to 620 ms for every frame of a scrollbar
   jump, since its collection holds a node for every row. */

const NO_VIEW = 480;

const INTERACTIVE = 'a[href],button,input,select,textarea,[role=button],[role=link],[data-no-row-press]';

/** Whether a click on a row is a press of the row: not one on a control inside it, or the end of a drag to select text. */
export function isRowPress(e: { target: EventTarget; currentTarget: EventTarget }): boolean {
  if ((e.target as Element).closest?.(INTERACTIVE)) return false;
  const selection = window.getSelection();
  return !selection || selection.isCollapsed || !(e.currentTarget as Element).contains(selection.anchorNode);
}

/** The elements inside `root` that Tab stops on. */
export function tabbablesIn(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]')]
    .filter((el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled);
}

/** A grid is one tab stop: Tab goes through the active row's own controls and then out of the grid, rather than through
 *  every mounted row's. `e.currentTarget` is the grid, the element with the keydown handler and the tab stop. */
export function tabThroughGrid(e: KeyboardEvent<HTMLElement>, activeRow: HTMLElement | undefined): void {
  const grid = e.currentTarget;
  const stops = activeRow ? tabbablesIn(activeRow) : [];
  const focused = document.activeElement as HTMLElement | null;
  const at = focused === grid ? -1 : stops.indexOf(focused as HTMLElement);
  if (e.shiftKey) {
    if (focused === grid) return;
    (at > 0 ? stops[at - 1] : grid).focus();
    e.preventDefault();
  } else if (at < stops.length - 1) {
    stops[at + 1].focus();
    e.preventDefault();
  } else {
    // The browser's Tab moves on from here, which is past everything in the grid.
    const all = tabbablesIn(grid);
    all[all.length - 1]?.focus({ preventScroll: true });
  }
}

const EMPTY: RowRange = { start: 0, end: 0 };

/** Where in the view `scrollToIndex` puts a row. `nearest` moves only if it's out of view. */
export type RowAlign = 'start' | 'center' | 'end' | 'nearest';

/** How a range change renders. `sync`: right now, in a browser event of ours. `micro`: as soon as the caller is done, for
 *  a public method a host may call from anywhere, an effect included, where `flushSync` isn't allowed. `effect`: left to
 *  the commit that's running, in a layout effect, where a state update flushes before paint anyway. */
export type RowFlush = 'sync' | 'micro' | 'effect';

export interface RowWindowOptions {
  /** A row's height until it's measured. */
  estimate: number;
  /** Px of rows mounted beyond the view on each side. */
  overscan?: number;
  /** Measure rows. Off, every row is `estimate` tall: nothing is read from the DOM. */
  measure?: boolean;
}

export class RowWindow<T extends { id: RowId } = { id: RowId }> {
  readonly heights: RowHeights;
  readonly ids = new RowIdIndex();
  rows: readonly T[] = [];
  range: RowRange = EMPTY;
  overscan: number;
  measure: boolean;
  /** Px of the scroller's view hidden under something sticky, like a header. */
  insetTop = 0;

  /** The part's setter for the rows to render. */
  onRange: (range: RowRange) => void = () => {};
  /** Heights or places changed, so anything placed by a row's offset should move too. */
  onLayout: () => void = () => {};
  /** The scroll position changed. `byUser` is false for this class's own scrolling. */
  onScroll: (byUser: boolean) => void = () => {};
  /** The view's width changed, with the old width. */
  onWidth: (width: number, before: number) => void = () => {};
  /** Applies what the part sets imperatively on a row. Called for each row as it mounts or moves to a new index. */
  decorate: ((el: HTMLElement, index: number) => void) | null = null;

  private scroller: HTMLElement | null = null;
  private sizer: HTMLElement | null = null;
  private mounted = new Map<number, HTMLElement>();
  private placed = new WeakMap<HTMLElement, number>();
  private observer: ResizeObserver | null = null;
  private observed = new Set<HTMLElement>();
  private top = 0;
  private expected = 0;
  private viewHeight = 0;
  private viewWidth = 0;
  private drawnTotal = -1;
  private pin: (() => number) | null = null;
  private pinFrame = 0;
  private frame = 0;
  private hidden = false;

  constructor({ estimate, overscan = 480, measure = true }: RowWindowOptions) {
    this.heights = new RowHeights(0, estimate);
    this.overscan = overscan;
    this.measure = measure;
  }

  /* ── Reading ── */

  /** The scroll position. */
  get scrollTop(): number {
    return this.top;
  }

  /** How much of the rows can be seen. */
  get view(): number {
    return Math.max(0, this.viewHeight - this.insetTop);
  }

  /** The scroller's own height, header included. */
  get height(): number {
    return this.viewHeight;
  }

  /** The last scroll position there is, with whatever comes after the rows. */
  get endTop(): number {
    const el = this.scroller;
    return el ? Math.max(0, el.scrollHeight - el.clientHeight) : this.heights.total;
  }

  /** The mounted row at an index. */
  elementAt(index: number): HTMLElement | undefined {
    return this.mounted.get(index);
  }

  /** Every mounted row. */
  get elements(): ReadonlyMap<number, HTMLElement> {
    return this.mounted;
  }

  /** A row's index in `rows`, for a render: the render that brings new rows is ahead of this window, which hears of them
   *  in its layout effect, so it looks through them itself. */
  indexIn(rows: readonly T[], id: RowId): number {
    return rows === this.rows ? this.ids.indexOf(id) : rows.findIndex((row) => row.id === id);
  }

  /** The row an element is in, or -1. */
  indexFrom(target: EventTarget | null): number {
    const row = (target as Element | null)?.closest?.('[data-index]');
    if (!row || !this.sizer?.contains(row)) return -1;
    return Number(row.getAttribute('data-index'));
  }

  /** Whether a row can be seen, even in part. */
  isVisible(index: number): boolean {
    const y = this.heights.offsetOf(index);
    return y + this.heights.get(index) > this.top && y < this.top + this.view;
  }

  /* ── Connecting ── */

  /** Starts on a scroller and the sizer inside it, whose direct children are the rows. Returns the undo. */
  attach(scroller: HTMLElement, sizer: HTMLElement): () => void {
    this.scroller = scroller;
    this.sizer = sizer;
    this.top = this.expected = scroller.scrollTop;
    this.readView();
    scroller.addEventListener('scroll', this.handleScroll, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(this.handleResize);
      this.observer.observe(scroller);
    }
    this.drawTotal();
    return () => {
      scroller.removeEventListener('scroll', this.handleScroll);
      this.observer?.disconnect();
      this.observer = null;
      this.observed.clear();
      cancelAnimationFrame(this.frame);
      cancelAnimationFrame(this.pinFrame);
      this.frame = 0;
      this.pin = null;
      this.scroller = null;
      this.sizer = null;
    };
  }

  /** The part's new `rows`, in a layout effect. A log that grew or was cut back keeps its measurements. Anything else
   *  starts over, with the scroll position kept on the row at the top of the view (or the next that survived). */
  setRows(next: readonly T[]): void {
    const prev = this.rows;
    if (prev === next) return;
    const change = rowsChange(prev, next);
    if (change === 'replace') {
      const anchor = this.anchor();
      this.pin = null;
      this.ids.update(next, change);
      this.rows = next;
      this.heights.reset(next.length);
      let index = 0;
      let offset = 0;
      for (let i = anchor.index; i < prev.length; i++) {
        const found = this.ids.indexOf(prev[i].id);
        if (found >= 0) {
          index = found;
          if (i === anchor.index) offset = anchor.offset;
          break;
        }
      }
      this.drawTotal();
      this.setTop(this.heights.offsetOf(index) + offset);
    } else {
      this.ids.update(next, change);
      this.rows = next;
      this.heights.resize(next.length);
      this.drawTotal();
      this.readTop();
    }
    this.refreshRange('effect');
  }

  /** Every row is now this tall, keeping the row at the top of the view there. For a part with no measuring. */
  setFixedHeight(height: number): void {
    if (height === this.heights.estimate && !this.heights.measured) return;
    const anchor = this.anchor();
    const scale = height / (this.heights.get(anchor.index) || height);
    this.heights.reset(this.rows.length, height);
    this.drawTotal();
    this.setTop(this.heights.offsetOf(anchor.index) + anchor.offset * scale);
    this.place();
    this.refreshRange('effect');
    this.onLayout();
  }

  /** Forgets every measured height, as they no longer hold (the layout changed), keeping the top row where it is. */
  invalidate(): void {
    const anchor = this.anchor();
    this.heights.reset(this.rows.length);
    for (const [index, el] of this.mounted) this.heights.set(index, el.offsetHeight);
    this.settle(anchor);
    this.place();
    this.onLayout();
  }

  /** After each commit of the part, in a layout effect: finds the rows, measures them and puts them in place. */
  sync(): void {
    const sizer = this.sizer;
    if (!sizer) return;
    const mounted = new Map<number, HTMLElement>();
    for (let el = sizer.firstElementChild as HTMLElement | null; el; el = el.nextElementSibling as HTMLElement | null) {
      const at = el.getAttribute('data-index');
      if (at !== null) mounted.set(Number(at), el);
    }
    const moved = this.mounted;
    this.mounted = mounted;
    if (this.measure && this.observer) {
      const live = new Set(mounted.values());
      for (const el of this.observed) if (!live.has(el)) { this.observer.unobserve(el); this.observed.delete(el); }
      for (const el of live) if (!this.observed.has(el)) { this.observer.observe(el); this.observed.add(el); }
    }
    if (this.measure) {
      let anchor: ReturnType<RowWindow['anchor']> | null = null;
      for (const [index, el] of mounted) {
        const height = el.offsetHeight;
        if (height > 0 && height !== this.heights.get(index)) {
          anchor ??= this.anchor();
          this.heights.set(index, height);
        } else if (height > 0) this.heights.set(index, height);
      }
      if (anchor) this.settle(anchor);
    }
    this.place();
    if (this.decorate) {
      for (const [index, el] of mounted) if (moved.get(index) !== el) this.decorate(el, index);
    }
    this.refreshRange('effect');
    this.onLayout();
  }

  /** Runs `decorate` again on every mounted row. */
  decorateAll(): void {
    if (!this.decorate) return;
    for (const [index, el] of this.mounted) this.decorate(el, index);
  }

  /* ── Scrolling ── */

  /** Scrolls a row into view. It holds that place while the rows around it get measured, until the user scrolls. */
  scrollToIndex(index: number, align: RowAlign = 'nearest', flush: RowFlush = 'sync'): void {
    if (index < 0 || index >= this.heights.count) return;
    this.scrollWith(() => this.topFor(index, align), flush);
  }

  /** Scrolls to wherever `target` says, and goes back there if heights change as the rows around it mount: for the next
   *  two frames, or until the user scrolls. After that a change of height holds the row at the top of the view, like any
   *  other. It's counted in frames and not in time, as a busy machine must still land in the same place. */
  scrollWith(target: () => number, flush: RowFlush = 'sync'): void {
    this.pin = target;
    this.setTop(target());
    this.refreshRange(flush);
    cancelAnimationFrame(this.pinFrame);
    this.pinFrame = requestAnimationFrame(() => {
      this.pinFrame = requestAnimationFrame(() => { this.pin = null; });
    });
  }

  /** Scrolls sideways (the part's own keyboard, as a grid has no column of its own to focus). */
  scrollLeftBy(delta: number): void {
    if (this.scroller) this.scroller.scrollLeft += delta;
  }

  private topFor(index: number, align: RowAlign): number {
    const y = this.heights.offsetOf(index);
    const height = this.heights.get(index);
    const view = this.view;
    if (align === 'start') return y;
    if (align === 'end') return y + height - view;
    if (align === 'center') return y - Math.max(0, view - height) / 2;
    if (y < this.top) return y;
    return y + height > this.top + view ? y + Math.min(height - view, 0) : this.top;
  }

  private anchor(): { index: number; offset: number } {
    const index = this.heights.indexAt(this.top);
    return { index, offset: this.top - this.heights.offsetOf(index) };
  }

  private setTop(next: number): void {
    const el = this.scroller;
    if (!el) return;
    const top = Math.max(0, next);
    if (Math.abs(top - this.top) < 0.5) return;
    el.scrollTop = top;
    this.readTop();
  }

  /** Takes the position from the scroller (the browser clamps it, and a shorter list can move it) as its own doing. */
  private readTop(): void {
    if (this.scroller) this.top = this.expected = this.scroller.scrollTop;
  }

  private readView(): void {
    const el = this.scroller;
    if (!el) return;
    this.viewHeight = el.clientHeight || this.viewHeight || NO_VIEW;
    this.viewWidth = el.clientWidth || this.viewWidth;
  }

  private drawTotal(): void {
    const total = this.heights.total;
    if (total === this.drawnTotal || !this.sizer) return;
    this.drawnTotal = total;
    this.sizer.style.height = `${total}px`;
  }

  private place(): void {
    for (const [index, el] of this.mounted) {
      const y = this.heights.offsetOf(index);
      if (this.placed.get(el) === y) continue;
      this.placed.set(el, y);
      el.style.transform = `translateY(${y}px)`;
    }
    this.drawTotal();
  }

  /** After heights changed: a better estimate if this one was well off, and the view back on the row it was on. */
  private settle(anchor: { index: number; offset: number }): void {
    const { heights } = this;
    if (heights.measured >= 16 && Math.abs(heights.average - heights.estimate) > heights.estimate * 0.2) {
      heights.rebase(Math.round(heights.average));
    }
    this.drawTotal();
    const offset = Math.min(anchor.offset, Math.max(0, heights.get(anchor.index) - 1));
    this.setTop(this.pin ? this.pin() : heights.offsetOf(anchor.index) + offset);
  }

  /** Asks for a new range once what's mounted no longer reaches half the overscan past the view. */
  private refreshRange(flush: RowFlush): void {
    const { heights, range, top } = this;
    const need = rowRange(heights, top, this.view, this.overscan / 2);
    if (need.start >= range.start && need.end <= range.end && range.end <= heights.count) return;
    const next = rowRange(heights, top, this.view, this.overscan);
    if (next.start === range.start && next.end === range.end) return;
    this.range = next;
    if (flush === 'sync') flushSync(() => this.onRange(next));
    else if (flush === 'micro') queueMicrotask(() => flushSync(() => this.onRange(this.range)));
    else this.onRange(next);
  }

  private handleScroll = () => {
    const el = this.scroller;
    if (!el) return;
    const top = el.scrollTop;
    const byUser = Math.abs(top - this.expected) > 1;
    this.top = this.expected = top;
    if (byUser) this.pin = null;
    this.refreshRange('sync');
    this.onScroll(byUser);
  };

  private handleResize = (entries: ResizeObserverEntry[]) => {
    const el = this.scroller;
    if (!el) return;
    let anchor: ReturnType<RowWindow['anchor']> | null = null;
    let changed = false;
    for (const entry of entries) {
      const target = entry.target as HTMLElement;
      if (target === el) {
        if (!el.clientHeight) { this.hidden = true; continue; }
        const before = this.viewWidth;
        const height = this.viewHeight;
        this.readView();
        if (this.hidden) {
          // Coming back from `display: none`, which can lose the scroll position.
          this.hidden = false;
          if (el.scrollTop !== this.top) el.scrollTop = this.top;
        }
        if (this.viewWidth !== before) this.onWidth(this.viewWidth, before);
        changed ||= this.viewHeight !== height;
        continue;
      }
      if (!target.isConnected) continue;
      const at = target.getAttribute('data-index');
      if (at === null) continue;
      const index = Number(at);
      const height = Math.round(entry.borderBoxSize?.[0]?.blockSize ?? target.offsetHeight);
      if (height > 0 && height !== this.heights.get(index)) {
        anchor ??= this.anchor();
        this.heights.set(index, height);
        changed = true;
      }
    }
    if (!changed) return;
    if (anchor) this.settle(anchor);
    this.place();
    this.onLayout();
    if (!this.frame) {
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.refreshRange('sync');
      });
    }
  };
}
