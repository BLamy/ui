'use client';
import {
  use, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { Icon } from '@/lib/icon';
import { chromeStore, BLSafeCtx, BLStickyCtx } from '@/lib/theme';
import { cn, BARH } from '@/lib/utils';
import { springCss } from '@/lib/motion';
import { armBackHistory, useBackHistory } from '@/lib/back-history';
import { useEdgeSwipe } from '@/lib/edge-swipe';
import { usePullToRefresh } from '@/lib/pull-to-refresh';
import { backLabel, shownTitle, useTitleFlight, type ActiveFlight, type TitleParts } from '@/lib/title-flight';
import { Spinner } from '@/components/ui/spinner';
import { useSplitViewBack } from '@/components/ui/split-view';

/** Screen descriptor consumed by NavigationStack. */
export interface Screen {
  key: string;
  title?: ReactNode;
  largeTitle?: boolean;
  grouped?: boolean;
  content?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  overlay?: ReactNode;
  subheader?: ReactNode;
  maxW?: number | string;
  bottomInset?: number;
  onRefresh?: () => void | Promise<unknown>;
  titleOnScroll?: boolean;
  hideChromeOnScroll?: boolean;
}

interface NavHandle { pop: () => void; canPop: boolean }
/** Elements a screen hands the stack: its root and dimmer (edge swipe), and its titles (header morph). */
interface ScreenParts extends TitleParts {
  el?: HTMLDivElement | null;
  dim?: HTMLDivElement | null;
  scroller?: HTMLElement | null;
}
type Reg = (key: string, part: ScreenParts) => void;

/** Back label: the previous title (ellipsized when tight), "Back" when even that has no room, else nothing. */
type BackMode = 'title' | 'back' | 'none';

/** A back button on the root screen (there is nothing of the stack's own to pop): its label and action. */
export interface NavigationStackRootBack {
  title?: ReactNode;
  onPress: () => void;
}

export interface ScreenWrapProps {
  sc: Screen;
  depth: number;
  top: number;
  ghost: boolean;
  entering: boolean;
  nav: NavHandle;
  backTitle?: ReactNode | null;
  reg: Reg;
  defIns?: number;
  z: number;
  /** Shown on the root screen only (depth 0). */
  rootBack?: NavigationStackRootBack | null;
}

/** How NavigationStack pushes and pops, shared with anything that should feel like one (SideDrawer's compact push):
 *  where the leaving/entering screen waits, where the one underneath parallaxes to and how far it dims, and the
 *  edge swipe's zone, commit distance (fraction of the width) and flick velocity (px/ms). The motion itself is the
 *  `smooth` spring (the `tray` spring when a swipe is released). */
export const navigationPush = {
  off: '103%',
  under: '-28%',
  underPct: -28,
  dim: 0.12,
  edge: 36,
  commit: 0.32,
  flick: 0.55,
  settleMs: 580,
} as const;

export function ScreenWrap({ sc, depth, top, ghost, entering, nav, backTitle: prevTitle, reg, defIns, z, rootBack: rootBackProp }: ScreenWrapProps) {
  const rootBack = depth === 0 && !ghost ? rootBackProp : null;
  const backTitle = rootBack ? rootBack.title ?? 'Back' : prevTitle;
  const started = useRef(false);
  const [in_, setIn] = useState(!entering);
  const [out, setOut] = useState(false);
  const [scr, setScr] = useState(false);
  const [hid, setHid] = useState(false);
  const safeTop = use(BLSafeCtx);
  const lastY = useRef(0);
  const scroller = useRef<HTMLDivElement | null>(null); const inner = useRef<HTMLDivElement | null>(null); const spin = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null); const titleRef = useRef<HTMLDivElement | null>(null);
  const measFull = useRef<HTMLSpanElement | null>(null); const measBack = useRef<HTMLSpanElement | null>(null);
  const [bk, setBk] = useState<{ mode: BackMode; w: number }>({ mode: 'title', w: 160 });
  const hasBack = depth > 0 || ghost || !!rootBack;
  // Measured: the back label gets whatever the centered title leaves on its side of the bar.
  useLayoutEffect(() => {
    const row = rowRef.current, t = titleRef.current, f = measFull.current, b = measBack.current;
    if (!hasBack || !row || !f || !b) return undefined;
    const m = () => {
      const tw = sc.title != null && t ? t.offsetWidth : 0;
      // Half the row beside the title, less the chevron (24), the button's end padding (8) and a gap (8).
      const avail = Math.floor((row.clientWidth - tw) / 2 - 40);
      const fw = f.offsetWidth, bw = b.offsetWidth;
      const mode: BackMode = fw > 0 && (avail >= fw || avail >= bw + 14) ? 'title' : avail >= bw ? 'back' : 'none';
      setBk((o) => (o.mode === mode && o.w === avail ? o : { mode, w: Math.max(0, avail) }));
    };
    m();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(m); [row, f, b].forEach((e) => ro.observe(e)); if (t) ro.observe(t);
    return () => ro.disconnect();
  }, [hasBack, backTitle, sc.title]);
  useLayoutEffect(() => {
    if (entering && !started.current) {
      started.current = true; setIn(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setIn(true)));
    }
  }, [entering]);
  useEffect(() => { if (ghost) requestAnimationFrame(() => setOut(true)); }, [ghost]);
  const isUnder = !ghost && depth < top;
  const { off, under } = navigationPush;
  const tx = ghost ? (out ? off : '0%') : (!in_ ? off : isUnder ? under : '0%');
  const ins = sc.bottomInset != null ? sc.bottomInset : (defIns || 0);
  const barH = safeTop + BARH;
  const hideChrome = sc.hideChromeOnScroll !== false;
  useEffect(() => () => chromeStore.set(false), []);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop; const s = y > (sc.largeTitle ? 44 : 8); if (s !== scr) setScr(s);
    if (hideChrome && !ghost) {
      const dy = y - lastY.current;
      if (y < barH * 0.7) { if (hid) { setHid(false); chromeStore.set(false); } }
      else if (dy > 5) { if (!hid) { setHid(true); chromeStore.set(true); } }
      else if (dy < -5) { if (hid) { setHid(false); chromeStore.set(false); } }
    }
    lastY.current = y;
  };
  const showTitle = sc.titleOnScroll ? scr : (sc.largeTitle ? scr : true);
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && nav.canPop && depth > 0) { nav.pop(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-tkrow]')].filter((r) => r.offsetParent);
      const i = rows.indexOf(document.activeElement as HTMLElement);
      const n = e.key === 'ArrowDown' ? (i < 0 ? 0 : Math.min(i + 1, rows.length - 1)) : (i < 0 ? rows.length - 1 : Math.max(i - 1, 0));
      if (rows[n]) { rows[n].focus(); e.preventDefault(); }
    }
  };
  const pull = usePullToRefresh({ onRefresh: sc.onRefresh, scroller, content: inner, spinner: spin });
  return (
    // Slide position, depth, and bar geometry are per-render values, fed in as CSS variables; the edge-swipe writes
    // transform/transition inline during a drag and clears them back to these classes.
    // A covered or leaving screen is inert: its controls take no focus and aren't read out behind the one on top. The
    // screen itself takes focus (tabIndex -1) when a push lands on it, so the keyboard continues from its top.
    <div ref={(el) => reg(sc.key, { el })} data-slot="screen" data-screen-key={sc.key} data-screen-label={typeof sc.title === 'string' ? sc.title : sc.key}
      tabIndex={-1} inert={isUnder || ghost || undefined} onKeyDown={onKey}
      className={cn(
        'outline-none absolute inset-0 z-(--screen-z) overflow-hidden will-change-transform [transform:translateX(var(--screen-x))] transition-transform duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
        sc.grouped ? 'bg-muted' : 'bg-background',
        depth > 0 && 'shadow-[-10px_0_30px_black] shadow-black/16',
        ghost ? 'pointer-events-none' : 'pointer-events-auto',
      )}
      data-scrolled={scr ? '' : undefined}
      style={{
        '--screen-z': 10 + z, '--screen-x': tx, '--screen-bar-h': barH + 'px', '--screen-safe-top': safeTop + 'px',
        '--screen-max-w': sc.maxW == null || sc.maxW === 0 || sc.maxW === '' ? 'none' : typeof sc.maxW === 'number' ? sc.maxW + 'px' : sc.maxW,
        '--screen-inset': ins + 28 + 'px',
      } as CSSProperties}>
      <div ref={(e) => { scroller.current = e; reg(sc.key, { scroller: e }); }} className="bl-scroll absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]" onScroll={onScroll}
        {...pull.bind}>
        <div ref={inner} className="mx-auto box-border w-full max-w-(--screen-max-w)">
          {sc.largeTitle
            ? <div className="px-4 pt-[calc(var(--screen-bar-h)+2px)] pb-1.5">
                <div className="text-[34px] leading-[1.15] font-extrabold tracking-[-.5px]">
                  <span ref={(e) => reg(sc.key, { large: e })}>{sc.title}</span>
                </div>
                {sc.subheader ? <div className="mt-2.5">{sc.subheader}</div> : null}
              </div>
            : <div className="h-(--screen-bar-h)" />}
          <BLStickyCtx.Provider value={barH}>{sc.content}</BLStickyCtx.Provider>
          <div className="h-(--screen-inset)" />
        </div>
      </div>
      {sc.onRefresh ? (
        <div ref={spin}
          className="pointer-events-none absolute top-[calc(var(--screen-bar-h)+8px)] left-1/2 z-5 [transform:translateX(-50%)] text-muted-foreground opacity-0 transition-opacity duration-spring-snappy ease-spring-snappy"><Spinner spin={pull.refreshing} /></div>
      ) : null}
      <div className={cn(
        'absolute inset-x-0 top-0 z-30 box-border flex h-(--screen-bar-h) items-end px-1.5 pt-(--screen-safe-top) transition-transform duration-spring-smooth ease-spring-smooth',
        hid ? '[transform:translateY(calc(var(--screen-safe-top)-var(--screen-bar-h)))]' : '[transform:none]',
      )}>
        <div className={cn(
          'absolute inset-0 [border-bottom:1px_solid_var(--border)] bg-bar backdrop-blur-[18px] backdrop-saturate-[1.7] transition-opacity duration-spring-snappy ease-spring-snappy',
          scr ? 'opacity-100' : 'opacity-0',
        )} />
        {/* Under-island strip: stays put while the bar slides away, so content never runs under the camera. */}
        {safeTop ? (
          <div className={cn(
            'absolute inset-x-0 top-0 h-(--screen-safe-top) bg-bar backdrop-blur-[18px] backdrop-saturate-[1.7] transition-transform duration-spring-smooth ease-spring-smooth',
            scr || hid ? 'opacity-100' : 'opacity-0',
            hid ? '[transform:translateY(calc(var(--screen-bar-h)-var(--screen-safe-top)))]' : '[transform:none]',
          )} />
        ) : null}
        <div ref={rowRef} className={cn('flex h-toolbar w-full items-center transition-opacity duration-spring-snappy ease-spring-snappy', hid ? 'opacity-0' : 'opacity-100')}>
          <div className="relative z-1 flex min-w-[44px] items-center">
            {hasBack
              ? <AriaButton className="bl-btn flex cursor-pointer items-center border-0 bg-transparent py-1.5 pr-2 pl-0 [font-family:inherit] text-body text-primary"
                  aria-label={bk.mode === 'none' ? 'Back' : undefined}
                  onPress={rootBack ? rootBack.onPress : nav.canPop ? nav.pop : undefined}>
                  <Icon name="chevL" size={24} sw={2.4} />
                  {bk.mode !== 'none' ? (
                    <span ref={(e) => reg(sc.key, { back: e })} data-mode={bk.mode}
                      className="max-w-(--back-w) truncate" style={{ '--back-w': bk.w + 'px' } as CSSProperties}>{bk.mode === 'title' ? backTitle : 'Back'}</span>
                  ) : null}
                </AriaButton>
              : (sc.leading || null)}
            {hasBack ? (
              // Off-screen rulers for the full previous title and for "Back".
              <span aria-hidden="true" className="pointer-events-none invisible absolute top-0 left-0 flex text-body whitespace-nowrap">
                <span ref={measFull}>{backTitle}</span><span ref={measBack}>Back</span>
              </span>
            ) : null}
          </div>
          <div ref={(e) => { titleRef.current = e; reg(sc.key, { inline: e }); }} className={cn(
            'pointer-events-none absolute left-1/2 max-w-[52%] -translate-x-1/2 truncate text-body font-semibold text-foreground transition-opacity duration-spring-snappy ease-spring-snappy',
            showTitle ? 'opacity-100' : 'opacity-0',
          )}>{sc.title}</div>
          <div className="relative z-1 ml-auto flex items-center">{sc.trailing || null}</div>
        </div>
      </div>
      {sc.overlay || null}
      <div ref={(el) => reg(sc.key, { dim: el })}
        className={cn('pointer-events-none absolute inset-0 z-200 bg-black transition-opacity duration-spring-smooth ease-spring-smooth', isUnder ? 'opacity-12' : 'opacity-0')} />
    </div>
  );
}

/** Push/pop settle time: the smooth spring (--duration-spring-smooth) plus a frame. */
const SETTLE_MS = navigationPush.settleMs;

export interface NavigationStackProps {
  screens: Screen[];
  onPop?: () => void;
  /** Default bottom inset applied to screens that don't set `bottomInset`. */
  defIns?: number;
  /** Safe-area top override for this stack (px). Usually inherited from BLProvider instead. */
  safeTop?: number | string;
  /** A back button on the root screen, for a stack that sits under something else to go back to. Inside a
   *  collapsed SplitView column it defaults to the previous column (the sidebar), labelled with its title;
   *  `false` turns that off. */
  rootBack?: NavigationStackRootBack | false;
  className?: string;
  style?: CSSProperties;
}

/** What an edge swipe moves: the top screen, the one under it, and the title flight scrubbing along. */
interface SwipeCtx {
  top: ScreenParts & { el: HTMLDivElement };
  under: ScreenParts & { el: HTMLDivElement };
  flight: ActiveFlight | null;
}

export function NavigationStack({ screens, onPop, defIns, safeTop, rootBack: rootBackProp, className, style }: NavigationStackProps) {
  const rootTitle = screens[0]?.title;
  const split = useSplitViewBack(typeof rootTitle === 'string' ? rootTitle : undefined);
  const rootBack = rootBackProp === false ? null : rootBackProp ?? (split ? { title: split.title, onPress: split.back } : null);
  const contRef = useRef<HTMLDivElement | null>(null);
  const regMap = useRef<Record<string, ScreenParts>>({});
  const reg: Reg = (k, part) => { regMap.current[k] = { ...regMap.current[k], ...part }; };
  const [anim, setAnim] = useState<{ enter: string | null; exit: Screen[] | null }>({ enter: null, exit: null });
  const prevRef = useRef(screens);
  const skipRef = useRef(false);
  const tRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onPopRef = useRef(onPop); onPopRef.current = onPop;
  const titles = useTitleFlight(contRef);
  // The control that had focus in each screen, so a pop can hand it back (the row that pushed).
  const lastFocus = useRef<Record<string, HTMLElement>>({});
  // Focus moves with a push or pop only when it is in the stack (or nowhere): never pulled from something else.
  const focusIsOurs = () => !document.activeElement || document.activeElement === document.body || !!contRef.current?.contains(document.activeElement);
  const keysJ = screens.map((s) => s.key).join('¦');
  useLayoutEffect(() => {
    const old = prevRef.current; prevRef.current = screens;
    const ok = old.map((s) => s.key), nk = screens.map((s) => s.key);
    if (ok.join('¦') === keysJ) return;
    clearTimeout(tRef.current);
    const pref = (a: string[], b: string[]) => a.every((k, i) => b[i] === k);
    if (nk.length > ok.length && pref(ok, nk)) {
      setAnim({ enter: nk[nk.length - 1], exit: null });
      const fromK = ok[ok.length - 1], toK = nk[nk.length - 1];
      titles.fly(() => [shownTitle(regMap.current[fromK]), backLabel(regMap.current[toK]), regMap.current[toK]?.el]);
      armBackHistory();
      if (focusIsOurs()) requestAnimationFrame(() => regMap.current[toK]?.el?.focus({ preventScroll: true }));
      tRef.current = setTimeout(() => setAnim({ enter: null, exit: null }), SETTLE_MS);
    } else if (nk.length < ok.length && pref(nk, ok)) {
      if (skipRef.current) { skipRef.current = false; setAnim({ enter: null, exit: null }); return; }
      setAnim({ enter: null, exit: old.slice(nk.length) });
      const fromK = ok[ok.length - 1], toK = nk[nk.length - 1];
      titles.fly(() => [backLabel(regMap.current[fromK]), shownTitle(regMap.current[toK]), regMap.current[toK]?.el]);
      if (focusIsOurs()) {
        requestAnimationFrame(() => {
          const back = lastFocus.current[toK];
          (back?.isConnected ? back : regMap.current[toK]?.el)?.focus({ preventScroll: true });
        });
      }
      tRef.current = setTimeout(() => setAnim({ enter: null, exit: null }), SETTLE_MS);
    } else setAnim({ enter: null, exit: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysJ]);
  const ghosts = anim.exit || [];
  const canPop = screens.length > 1;
  useBackHistory(screens.length, () => onPopRef.current?.());

  const clean = (c: SwipeCtx) => [c.top, c.under].forEach((r) => {
    r.el.style.transition = ''; r.el.style.transform = '';
    if (r.dim) { r.dim.style.transition = ''; r.dim.style.opacity = ''; }
  });
  // The edge swipe: the top screen follows the finger while the one under it parallaxes in and un-dims, and the back
  // label scrubs toward the title it names.
  const swipe = useEdgeSwipe<SwipeCtx>({
    target: () => contRef.current,
    edge: navigationPush.edge, commit: navigationPush.commit, flick: navigationPush.flick,
    begin: () => {
      if (anim.enter || anim.exit || screens.length < 2) return null;
      const top = regMap.current[screens[screens.length - 1].key];
      const under = regMap.current[screens[screens.length - 2].key];
      if (!top?.el || !under?.el) return null;
      return { top: top as SwipeCtx['top'], under: under as SwipeCtx['under'], flight: null };
    },
    engage: (c) => { c.flight = titles.scrub(backLabel(c.top), shownTitle(c.under), c.under.el); },
    move: (c, p, dx) => {
      c.top.el.style.transition = 'none'; c.top.el.style.transform = `translateX(${dx}px)`;
      c.under.el.style.transition = 'none'; c.under.el.style.transform = `translateX(${navigationPush.underPct * (1 - p)}%)`;
      if (c.under.dim) { c.under.dim.style.transition = 'none'; c.under.dim.style.opacity = String(navigationPush.dim * (1 - p)); }
      if (titles.isCurrent(c.flight)) c.flight.f.set(p);
    },
    release: (c, { p, commit }) => {
      // Release continues on the tray spring from wherever the finger let go (the CSS spring retargets).
      const ease = springCss('transform', 'tray');
      titles.release(c.flight, p, commit ? 1 : 0);
      if (commit) {
        c.top.el.style.transition = ease; c.top.el.style.transform = 'translateX(104%)';
        c.under.el.style.transition = ease; c.under.el.style.transform = 'translateX(0%)';
        if (c.under.dim) { c.under.dim.style.transition = springCss('opacity', 'tray'); c.under.dim.style.opacity = '0'; }
        skipRef.current = true;
        setTimeout(() => { onPopRef.current?.(); requestAnimationFrame(() => clean(c)); }, 380);
      } else {
        c.top.el.style.transition = ease; c.top.el.style.transform = 'translateX(0px)';
        c.under.el.style.transition = ease; c.under.el.style.transform = `translateX(${navigationPush.under})`;
        if (c.under.dim) { c.under.dim.style.transition = springCss('opacity', 'tray'); c.under.dim.style.opacity = String(navigationPush.dim); }
        setTimeout(() => clean(c), 430);
      }
    },
    abort: clean,
  });
  const topIdx = screens.length - 1;
  // A push is known during render, before the effect below records it: the new screen mounts already off to the
  // right, so nothing (a layout read in a child's effect, say) can catch it at rest and cancel its slide.
  const prevKeys = prevRef.current.map((s) => s.key);
  const pendingEnter = screens.length > prevKeys.length && prevKeys.every((k, i) => screens[i] && screens[i].key === k)
    ? screens[topIdx].key : null;
  const rendered = [
    ...screens.map((sc, i) => ({ sc, i, ghost: false })),
    ...ghosts.map((sc, j) => ({ sc, i: screens.length + j, ghost: true })),
  ];
  const total = rendered.length - 1;
  const inner = (
    <div ref={contRef} data-slot="navigation-stack" {...swipe.bind}
      onFocusCapture={(e) => {
        const key = (e.target as Element).closest('[data-slot=screen]')?.getAttribute('data-screen-key');
        if (key && e.target !== e.currentTarget && (e.target as Element).getAttribute('data-slot') !== 'screen') lastFocus.current[key] = e.target as HTMLElement;
      }}
      className={cn('absolute inset-0 touch-pan-y overflow-hidden', className)} style={style}>
      {rendered.map((r) => (
        <ScreenWrap key={r.sc.key} sc={r.sc} depth={r.i} top={r.ghost ? total : topIdx} ghost={r.ghost}
          entering={!r.ghost && (anim.enter === r.sc.key || pendingEnter === r.sc.key) && r.i === topIdx}
          nav={{ pop: () => onPopRef.current?.(), canPop: canPop && !r.ghost }}
          backTitle={r.i > 0 ? (r.ghost ? (screens[screens.length - 1] && screens[screens.length - 1].title) : screens[r.i - 1].title) : null}
          reg={reg} defIns={defIns} z={r.i} rootBack={rootBack} />
      ))}
    </div>
  );
  return safeTop != null ? <BLSafeCtx.Provider value={parseFloat(String(safeTop)) || 0}>{inner}</BLSafeCtx.Provider> : inner;
}
