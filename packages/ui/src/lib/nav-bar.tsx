'use client';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Icon } from '@/lib/icon';

/* ══ The iOS navigation bar's pieces, once ══
   NavigationStackBar (a stack's pages) and SplitViewHeader (a column that doesn't push) draw the same bar: a back
   button that names what it goes back to, a centered title that fades in once the content scrolls, and a large title
   at the top of the content. Both render these classes and this back label, so the two bars can't drift apart.

   The back label follows UIKit: the previous title when all of it fits beside the centered title (never cut with an
   ellipsis), else "Back", else the chevron alone. Its accessible name is always "Back to <title>" (or "Back"), whatever
   the label shows. ══ */

/** A bar button that goes back: the chevron hugs the leading edge, the label follows. */
export const barBackButton = [
  'bl-btn flex cursor-pointer items-center border-0 bg-transparent py-1.5 pe-2 ps-0 [font-family:inherit] text-body text-primary outline-none',
  'focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring',
].join(' ');

/** The bar's centered title. */
export const barTitle =
  'pointer-events-none absolute left-1/2 max-w-[52%] -translate-x-1/2 truncate text-body font-semibold text-foreground';
/** The title (and the bar's hairline) coming and going with the scroll: in on the enter tween, out on the quick exit.
 *  Add `barTitleHidden` while it is away. */
export const barTitleFade = 'transition-opacity duration-220 ease-enter motion-reduce:transition-none';
export const barTitleHidden = 'opacity-0 duration-exit ease-exit';

/** iOS's large title (34px, heavy, tight), at the top of the content until it scrolls under the bar. */
export const largeTitleText = 'm-0 truncate text-large-title leading-[1.15] font-extrabold tracking-[-.5px]';

/** What the back label shows. */
export type BackMode = 'title' | 'back' | 'none';

/** The accessible name of a back button whose label is `title`. */
export function backName(title: ReactNode): string {
  return typeof title === 'string' && title && title !== 'Back' ? `Back to ${title}` : 'Back';
}

/** Room for the back label beside a centered title: half the row beside it, less the chevron (24), the button's
 *  end padding (8) and a gap (8). */
export const centeredRoom = (row: number, title: number) => Math.floor((row - title) / 2 - 40);

export interface BackFit {
  mode: BackMode;
  /** The label's max width, px. */
  width: number;
  /** Off-screen rulers for the full label and for "Back": render them inside the (relative) bar row. */
  rulers: ReactNode;
}

/** Measures what the back label can show: `row` is the bar's row, `title` finds its title element (none: the whole
 *  row counts), `room` turns their widths into the room the label has. */
export function useBackFit(
  row: RefObject<HTMLElement | null>,
  label: ReactNode,
  title: () => HTMLElement | null | undefined,
  room: (row: number, title: number) => number = centeredRoom,
): BackFit {
  const full = useRef<HTMLSpanElement | null>(null);
  const back = useRef<HTMLSpanElement | null>(null);
  const find = useRef(title);
  find.current = title;
  const measure = useRef(room);
  measure.current = room;
  const [fit, setFit] = useState<{ mode: BackMode; width: number }>({ mode: 'title', width: 160 });
  useLayoutEffect(() => {
    const r = row.current, f = full.current, b = back.current;
    if (!r || !f || !b) return undefined;
    const m = () => {
      const t = find.current();
      const avail = measure.current(r.clientWidth, t ? t.offsetWidth : 0);
      const fw = f.offsetWidth, bw = b.offsetWidth;
      const mode: BackMode = fw > 0 && avail >= fw ? 'title' : avail >= bw && bw > 0 ? 'back' : 'none';
      setFit((o) => (o.mode === mode && o.width === avail ? o : { mode, width: Math.max(0, avail) }));
    };
    m();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(m);
    [r, f, b].forEach((e) => ro.observe(e));
    const t = find.current();
    if (t) ro.observe(t);
    return () => ro.disconnect();
  }, [row, label]);
  const rulers = (
    <span aria-hidden="true" className="pointer-events-none invisible absolute top-0 left-0 flex text-body whitespace-nowrap">
      <span ref={full}>{label}</span><span ref={back}>Back</span>
    </span>
  );
  return { ...fit, rulers };
}

/** The back button's content: the chevron and, room permitting, the label (`data-mode` says which; the title
 *  flight reads it). */
export function BackLabel({ fit, label }: { fit: BackFit; label: ReactNode }) {
  return (
    <>
      <Icon name="chevL" size={24} sw={2.4} className="shrink-0 rtl:-scale-x-100" />
      {fit.mode !== 'none' ? (
        <span data-mode={fit.mode} className="max-w-(--back-w) min-w-0 truncate" style={{ '--back-w': fit.width + 'px' } as CSSProperties}>
          {fit.mode === 'title' ? label : 'Back'}
        </span>
      ) : null}
    </>
  );
}
