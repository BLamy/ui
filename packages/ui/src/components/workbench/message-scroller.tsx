import * as React from 'react';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Button } from '../../lib/workbench/press';
import { cn, wbPress } from '../../lib/workbench/util';
import { Icon } from '../../lib/icon';
import { AnimatePresence, animate, motion, type AnimationPlaybackControls } from 'framer-motion';
import { prefersReducedMotion, springs } from '../../lib/workbench/motion';

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
  // On a bump resting at its peek, only the bottom edge of the thread shows: drop the anchor spacer and sit at
  // the live edge, so the peek is the newest reply rather than the blank room below it.
  // (Read from the DOM: hosts portal the transcript onto the bump, so it isn't under the bump's context.)
  const [resting, setResting] = useState(false);
  const restingRef = useRef(resting);
  restingRef.current = resting;
  // The host can move the transcript onto a bump after it mounts, so look for the bump after every render.
  const watched = useRef<{ body: Element | null; mo: MutationObserver | null }>({ body: null, mo: null });
  useEffect(() => {
    const body = vp.current?.closest('[data-slot="composer-bump-content"]') ?? null;
    const w = watched.current;
    if (body === w.body) return;
    w.mo?.disconnect();
    w.body = body;
    w.mo = null;
    if (!body || typeof MutationObserver === 'undefined') {
      setResting(false);
      return;
    }
    const read = () => setResting(body.hasAttribute('data-peeking'));
    read();
    w.mo = new MutationObserver(read);
    w.mo.observe(body, { attributes: true, attributeFilter: ['data-peeking'] });
  });
  useEffect(() => () => watched.current.mo?.disconnect(), []);
  // Messages that arrive while the thread is open rise in; the ones it opened with are just there.
  const known = useRef<{ thread: string | null | undefined; ids: Set<string> }>({ thread: undefined, ids: new Set() });
  if (known.current.thread !== threadKey) known.current = { thread: threadKey, ids: new Set(items.map((i) => i.id)) };
  useEffect(() => {
    for (const i of items) known.current.ids.add(i.id);
  }, [items]);
  const scrollAnim = useRef<AnimationPlaybackControls | null>(null);
  /** Scrolls on a spring (interruptible: any scroll intent from the reader stops it). */
  const glide = (top: number) => {
    const el = vp.current;
    if (!el) return;
    scrollAnim.current?.stop();
    if (prefersReducedMotion()) {
      el.scrollTop = top;
      return;
    }
    scrollAnim.current = animate(el.scrollTop, top, {
      ...springs.smooth,
      restDelta: 0.5,
      onUpdate: (v) => {
        el.scrollTop = v;
      },
    });
  };
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
    if (last && !restingRef.current) {
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
    if (smooth) glide(el.scrollHeight - el.clientHeight);
    else el.scrollTop = el.scrollHeight;
  };
  const anchorTop = (id: string, smooth?: boolean) => {
    const el = vp.current;
    if (!el) return false;
    const row = el.querySelector<HTMLElement>('[data-mid="' + CSS.escape(id) + '"]');
    if (!row) return false;
    markProg(smooth ? 800 : 90);
    const top = Math.max(0, row.offsetTop - peek);
    if (smooth) glide(top);
    else el.scrollTop = top;
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
          // Peeking, the reader sees the bottom edge: follow the live edge instead of anchoring the turn.
          if (restingRef.current) toEnd(true);
          else anchorTop(newAnchor.id, true);
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
  const wasResting = useRef(resting);
  useLayoutEffect(() => {
    // Only a change of state re-lays the thread; how it opens is the thread effect's job.
    if (wasResting.current === resting) return;
    wasResting.current = resting;
    layoutSpacer();
    if (resting) {
      toEnd(false);
      return;
    }
    // Opened: back to the thread's layout, with the latest turn anchored near the top.
    const anchors = items.filter((i) => i.anchor);
    if (!(anchors.length && anchorTop(anchors[anchors.length - 1].id, false))) toEnd(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resting]);
  const intent = () => {
    scrollAnim.current?.stop();
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
        data-resting={resting || undefined}
        className="wb-scroll absolute inset-0 flex flex-col overflow-y-auto overscroll-contain outline-none"
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
          className={cn(
            'mx-auto box-border w-full max-w-[780px] shrink-0 px-[22px] pt-4 pb-1',
            // Peeking, a short thread sits on the bottom edge (the part that shows), not at the top.
            resting && 'mt-auto',
          )}
        >
          {items.map((it) => {
            const arriving = !known.current.ids.has(it.id);
            return (
              <div
                key={it.id}
                data-mid={it.id}
                data-anchor={it.anchor ? '1' : undefined}
                className="[contain-intrinsic-size:auto_48px] [content-visibility:auto]"
              >
                {/* A new turn rises into place (a sent message up from the composer, a reply under it). */}
                <motion.div
                  initial={arriving ? { opacity: 0, y: it.anchor ? 18 : 10, scale: it.anchor ? 0.98 : 1 } : false}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ ...springs.smooth, opacity: { duration: 0.22 } }}
                  className={it.anchor ? 'origin-bottom-right' : 'origin-top-left'}
                >
                  {it.node}
                </motion.div>
              </div>
            );
          })}
          <div ref={sp} aria-hidden="true" />
        </div>
      </div>
      {/* The jump pill rises in when the reader is away from the latest, and widens to say a reply is streaming. */}
      <AnimatePresence initial={false}>
        {showBtn ? (
          <motion.div
            key="jump"
            className="absolute bottom-3 left-1/2 z-2"
            initial={{ opacity: 0, y: 14, scale: 0.85, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: 10, scale: 0.9, x: '-50%' }}
            transition={springs.snappy}
          >
            <Button
              data-slot="message-scroller-jump"
              className={cn(wbPress, 'flex cursor-pointer items-center overflow-hidden rounded-[99px] border border-border bg-card p-[7px] text-[12.5px] font-semibold text-foreground shadow-[0_4px_16px_black] shadow-black/8 dark:shadow-black/35')}
              onPress={() => {
                toEnd(true);
              }}
              aria-label="Jump to latest"
            >
              <AnimatePresence initial={false}>
                {streaming ? (
                  <motion.span
                    key="streaming"
                    className="flex items-center gap-[7px] overflow-hidden whitespace-nowrap"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={springs.snappy}
                  >
                    <span className="ml-1.5 size-[7px] shrink-0 animate-[wbPulse_1.1s_infinite] rounded-[50%] bg-primary motion-reduce:animate-none" />
                    <span className="pr-[7px]">Streaming</span>
                  </motion.span>
                ) : null}
              </AnimatePresence>
              <Icon name="chevron-down-wide" size={15} sw={2.2} />
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
