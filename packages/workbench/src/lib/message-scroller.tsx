import * as React from 'react';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Button } from './press';
import { cn } from './util';
import { tick } from './haptics';
import { WIcon } from './icons';

/* ══ MessageScroller — shadcn message-scroller semantics ══
   Anchors new turns near the top (peek of the previous item), follows the live edge only while the
   reader is there, releases on scroll intent, jump-to-latest button, opens threads at last anchor. */
export interface MessageScrollerItem {
  id: string;
  anchor?: boolean;
  node: React.ReactNode;
}
export interface MessageScrollerProps {
  items: MessageScrollerItem[];
  streaming?: boolean;
  threadKey?: string | null;
  peek?: number;
  className?: string;
  style?: React.CSSProperties;
}
export function MessageScroller({ items, streaming, threadKey, peek: peekProp, className, style }: MessageScrollerProps) {
  const peek = peekProp == null ? 52 : peekProp;
  const vp = useRef<HTMLDivElement>(null);
  const ct = useRef<HTMLDivElement>(null);
  const sp = useRef<HTMLDivElement>(null);
  const st = useRef<{ follow: boolean; prog: number; ids: string; thread: string | null | undefined }>({
    follow: true,
    prog: 0,
    ids: '',
    thread: undefined,
  });
  const [canDown, setCanDown] = useState(false);
  const gap = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight;
  const markProg = (ms: number) => {
    st.current.prog = performance.now() + ms;
  };
  const layoutSpacer = () => {
    const el = vp.current,
      c = ct.current,
      s = sp.current;
    if (!el || !c || !s) return;
    let h = 0;
    const anchors = c.querySelectorAll<HTMLElement>('[data-anchor="1"]');
    const last = anchors[anchors.length - 1];
    if (last) {
      const turnH = c.scrollHeight - s.offsetHeight - last.offsetTop;
      h = Math.max(0, el.clientHeight - peek - turnH);
    }
    if (Math.abs((parseFloat(s.style.height) || 0) - h) > 1) s.style.height = h + 'px';
  };
  const toEnd = (smooth?: boolean) => {
    const el = vp.current;
    if (!el) return;
    st.current.follow = true;
    markProg(smooth ? 800 : 90);
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };
  const anchorTop = (id: string, smooth?: boolean) => {
    const el = vp.current;
    if (!el) return false;
    const row = el.querySelector<HTMLElement>('[data-mid="' + CSS.escape(id) + '"]');
    if (!row) return false;
    markProg(smooth ? 800 : 90);
    el.scrollTo({ top: Math.max(0, row.offsetTop - peek), behavior: smooth ? 'smooth' : 'auto' });
    return true;
  };
  useLayoutEffect(() => {
    const s = st.current;
    const ids = items.map((i) => i.id).join(',');
    const prev = s.ids;
    s.ids = ids;
    layoutSpacer();
    if (s.thread !== threadKey) {
      s.thread = threadKey;
      requestAnimationFrame(() => {
        layoutSpacer();
        const anchors = items.filter((i) => i.anchor);
        if (!(anchors.length && anchorTop(anchors[anchors.length - 1].id, false))) toEnd(false);
        const el = vp.current;
        if (el) {
          s.follow = gap(el) < 40;
          setCanDown(gap(el) > 160);
        }
      });
      return;
    }
    if (prev && ids !== prev) {
      const prevArr = prev.split(',');
      const added = items.filter((i) => !prevArr.includes(i.id));
      const newAnchor = added.filter((i) => i.anchor).pop();
      if (newAnchor)
        requestAnimationFrame(() => {
          layoutSpacer();
          anchorTop(newAnchor.id, true);
          st.current.follow = true;
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, threadKey]);
  useEffect(() => {
    const el = vp.current,
      c = ct.current;
    if (!el || !c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      layoutSpacer();
      const s = st.current;
      if (s.follow && performance.now() > s.prog && gap(el) > 2) el.scrollTop = el.scrollHeight;
      setCanDown(gap(el) > 160);
    });
    ro.observe(c);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const intent = () => {
    const el = vp.current;
    if (el && gap(el) > 40) st.current.follow = false;
  };
  const onScroll = () => {
    const el = vp.current;
    if (!el) return;
    if (gap(el) < 40 && performance.now() > st.current.prog) st.current.follow = true;
    setCanDown(gap(el) > 160);
  };
  const showBtn = canDown || (streaming && !st.current.follow);
  return (
    <div data-slot="message-scroller" className={cn('relative min-h-0 flex-1', className)} style={style}>
      <div
        ref={vp}
        className="wb-scroll absolute inset-0 overflow-y-auto overscroll-contain outline-none"
        role="region"
        aria-label="Messages"
        tabIndex={0}
        onScroll={onScroll}
        onWheel={(e) => {
          if (e.deltaY < 0) intent();
        }}
        onTouchMove={intent}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home') intent();
        }}
      >
        <div
          ref={ct}
          role="log"
          aria-relevant="additions"
          aria-busy={!!streaming}
          className="mx-auto box-border max-w-[780px] px-[22px] pt-4 pb-1"
        >
          {items.map((it) => (
            <div
              key={it.id}
              data-mid={it.id}
              data-anchor={it.anchor ? '1' : undefined}
              className="[contain-intrinsic-size:auto_48px] [content-visibility:auto]"
            >
              {it.node}
            </div>
          ))}
          <div ref={sp} aria-hidden="true" />
        </div>
      </div>
      {showBtn ? (
        <Button
          data-slot="message-scroller-jump"
          className={cn(
            'wb-btn absolute bottom-3 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-[7px] rounded-[99px] border border-wb-sep bg-wb-card text-[12.5px] font-semibold text-wb-label shadow-[0_4px_16px_var(--wb-shadow,rgba(0,0,0,.35))]',
            streaming ? 'px-[13px] py-1.5' : 'p-[7px]',
          )}
          onPress={() => {
            toEnd(true);
            tick();
          }}
          aria-label="Jump to latest"
        >
          {streaming ? <span className="size-[7px] animate-[wbPulse_1.1s_infinite] rounded-[50%] bg-wb-tint" /> : null}
          {streaming ? 'Streaming' : null}
          <WIcon name="chevD" size={15} sw={2.2} />
        </Button>
      ) : null}
    </div>
  );
}
