import {
  use, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { animate, type AnimationPlaybackControls } from 'framer-motion';
import { Icon } from '../lib/icon';
import { chromeStore, BLSafeCtx, BLStickyCtx } from '../lib/theme';
import { cn, BARH } from '../lib/utils';
import { springCss, springs } from '../lib/motion';
import { Spinner } from './spinner';
import { useSplitViewBack } from './split-view';

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
  onRefresh?: () => void;
  titleOnScroll?: boolean;
  hideChromeOnScroll?: boolean;
}

interface NavHandle { pop: () => void; canPop: boolean }
/** Elements a screen hands the stack: its root and dimmer (edge swipe), and its titles (header morph). */
interface ScreenParts {
  el?: HTMLDivElement | null;
  dim?: HTMLDivElement | null;
  large?: HTMLElement | null;
  inline?: HTMLElement | null;
  back?: HTMLElement | null;
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
  const scroller = useRef<any>(null); const inner = useRef<any>(null); const spin = useRef<any>(null);
  const pl = useRef<any>(null); const [refr, setRefr] = useState(false);
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
  // pull-to-refresh
  const pDown = (e: React.PointerEvent) => {
    if (!sc.onRefresh || refr || e.button) return;
    if (scroller.current.scrollTop > 2) return;
    pl.current = { y0: e.clientY, x0: e.clientX, on: false, armed: false };
  };
  const pMove = (e: React.PointerEvent) => {
    const d = pl.current; if (!d) return;
    const dy = e.clientY - d.y0, dx = e.clientX - d.x0;
    if (!d.on) {
      if (dy > 10 && dy > Math.abs(dx) * 1.3 && scroller.current.scrollTop <= 1) {
        d.on = true;
        try { scroller.current.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      } else if (dy < -6) { pl.current = null; return; }
      else return;
    }
    const t = Math.min(110, 56 * Math.log1p(Math.max(0, dy - 10) / 40)); d.t = t;
    const c = inner.current, sp = spin.current;
    if (c) { c.style.transition = 'none'; c.style.transform = `translateY(${t}px)`; }
    if (sp) { sp.style.opacity = String(Math.min(1, t / 58)); sp.style.transform = `translateX(-50%) rotate(${t * 3.2}deg) scale(${Math.min(1, .5 + t / 90)})`; }
    const armed = t > 54;
    d.armed = armed;
  };
  const pEnd = () => {
    const d = pl.current; if (!d) return; pl.current = null; if (!d.on) return;
    const c = inner.current, sp = spin.current;
    if (d.armed) {
      setRefr(true);
      if (c) { c.style.transition = springCss('transform', 'snappy'); c.style.transform = 'translateY(52px)'; }
      if (sp) { sp.style.opacity = '1'; sp.style.transform = 'translateX(-50%)'; }
      setTimeout(() => {
        setRefr(false);
        if (c) { c.style.transition = springCss('transform', 'smooth'); c.style.transform = 'translateY(0)'; }
        if (sp) sp.style.opacity = '0';
        sc.onRefresh && sc.onRefresh();
        setTimeout(() => { if (c) { c.style.transition = ''; c.style.transform = ''; } }, 560);
      }, 1100);
    } else {
      if (c) {
        c.style.transition = springCss('transform', 'snappy'); c.style.transform = 'translateY(0)';
        setTimeout(() => { if (c) { c.style.transition = ''; c.style.transform = ''; } }, 400);
      }
      if (sp) sp.style.opacity = '0';
    }
  };
  return (
    // Slide position, depth, and bar geometry are per-render values, fed in as CSS variables; the edge-swipe writes
    // transform/transition inline during a drag and clears them back to these classes.
    <div ref={(el) => reg(sc.key, { el })} data-slot="screen" data-screen-label={typeof sc.title === 'string' ? sc.title : sc.key}
      className={cn(
        'absolute inset-0 z-(--screen-z) overflow-hidden will-change-transform [transform:translateX(var(--screen-x))] transition-transform duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
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
      <div ref={(e) => { scroller.current = e; reg(sc.key, { scroller: e }); }} className="bl-scroll absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]" onScroll={onScroll} onKeyDown={onKey}
        onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pEnd} onPointerCancel={pEnd}>
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
          className="pointer-events-none absolute top-[calc(var(--screen-bar-h)+8px)] left-1/2 z-5 [transform:translateX(-50%)] text-muted-foreground opacity-0 transition-opacity duration-spring-snappy ease-spring-snappy"><Spinner spin={refr} /></div>
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
              ? <AriaButton className="bl-btn flex cursor-pointer items-center border-0 bg-transparent py-1.5 pr-2 pl-0 [font-family:inherit] text-[17px] text-primary"
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
              <span aria-hidden="true" className="pointer-events-none invisible absolute top-0 left-0 flex text-[17px] whitespace-nowrap">
                <span ref={measFull}>{backTitle}</span><span ref={measBack}>Back</span>
              </span>
            ) : null}
          </div>
          <div ref={(e) => { titleRef.current = e; reg(sc.key, { inline: e }); }} className={cn(
            'pointer-events-none absolute left-1/2 max-w-[52%] -translate-x-1/2 truncate text-[17px] font-semibold text-foreground transition-opacity duration-spring-snappy ease-spring-snappy',
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

/* ══ Header title morph ══
   On push the previous screen's title (large or inline, whichever is showing) flies into the new screen's back
   button; on pop the back label flies back into the title it names. The two real labels hide while a pair of
   copies (one styled as the source, one as the destination) travels between them on the same spring as the
   screens, scaling and cross-fading from one style to the other. An edge swipe scrubs it with the finger. */

interface Flight { set: (t: number) => void; done: () => void }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The title a screen is showing right now: its large title until it scrolls under the bar, else the inline one. */
function shownTitle(r: ScreenParts | undefined): HTMLElement | null {
  if (!r) return null;
  if (r.large && !r.el?.hasAttribute('data-scrolled')) return r.large;
  if (r.inline && parseFloat(getComputedStyle(r.inline).opacity) > 0.5) return r.inline;
  return null;
}
function backLabel(r: ScreenParts | undefined): HTMLElement | null {
  return r?.back && r.back.dataset.mode === 'title' ? r.back : null;
}

function titleFlight(cont: HTMLElement, from: HTMLElement, to: HTMLElement, toScreen: HTMLElement | null | undefined): Flight | null {
  const cr = cont.getBoundingClientRect(), fr = from.getBoundingClientRect(), tr = to.getBoundingClientRect();
  if (!fr.width || !tr.width) return null;
  // `to` is measured where it will be once its screen settles at the stack's origin.
  const sr = toScreen ? toScreen.getBoundingClientRect() : cr;
  const f = { x: fr.left - cr.left, y: fr.top - cr.top, w: fr.width, h: fr.height };
  const d = { x: tr.left - sr.left, y: tr.top - sr.top, w: tr.width, h: tr.height };
  const fs = getComputedStyle(from), ts = getComputedStyle(to);
  const k = (parseFloat(ts.fontSize) || 17) / (parseFloat(fs.fontSize) || 17);
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.dataset.slot = 'navigation-title-flight';
  Object.assign(layer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '300', overflow: 'hidden' });
  const copy = (src: HTMLElement, cs: CSSStyleDeclaration, r: { w: number; h: number }) => {
    const c = document.createElement('div');
    c.innerHTML = src.innerHTML;
    Object.assign(c.style, {
      position: 'absolute', left: '0', top: '0', width: r.w + 'px', height: r.h + 'px', whiteSpace: 'nowrap', overflow: 'hidden',
      textOverflow: 'ellipsis', transformOrigin: '0 50%', willChange: 'transform, opacity',
      color: cs.color, fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      letterSpacing: cs.letterSpacing, lineHeight: r.h + 'px',
    });
    layer.appendChild(c);
    return c;
  };
  const a = copy(from, fs, f), b = copy(to, ts, d);
  cont.appendChild(layer);
  from.style.visibility = 'hidden'; to.style.visibility = 'hidden';
  return {
    set(t) {
      const x = lerp(f.x, d.x, t), cy = lerp(f.y + f.h / 2, d.y + d.h / 2, t);
      a.style.transform = `translate(${x}px, ${cy - f.h / 2}px) scale(${lerp(1, k, t)})`;
      b.style.transform = `translate(${x}px, ${cy - d.h / 2}px) scale(${lerp(1 / k, 1, t)})`;
      a.style.opacity = String(clamp01(1 - t * 1.8));
      b.style.opacity = String(clamp01((t - 0.2) / 0.6));
    },
    done() { from.style.visibility = ''; to.style.visibility = ''; layer.remove(); },
  };
}

/** Push/pop settle time: the smooth spring (--duration-spring-smooth) plus a frame. */
const SETTLE_MS = navigationPush.settleMs;

/* Back-gesture history bridge: on touch devices the system edge-swipe would navigate the page itself away
   (blank screen). While any stack can pop we keep one history sentinel armed; the system gesture then lands
   as popstate and pops OUR stack instead of the page. */
const NavPops = new Set<() => { depth: number; pop: () => void }>();
let blArmed = false;
let blCoarse = typeof matchMedia !== 'undefined' && matchMedia('(any-pointer: coarse)').matches;
function armHistory() {
  if (!blCoarse || blArmed) return;
  try { history.pushState({ blNav: 1 }, ''); blArmed = true; } catch (e) { blCoarse = false; }
}
if (typeof window !== 'undefined' && !(window as any).__tkPopstate) {
  (window as any).__tkPopstate = 1;
  window.addEventListener('popstate', () => {
    if (!blArmed) return; blArmed = false;
    let best: { depth: number; pop: () => void } | null = null;
    NavPops.forEach((g) => { const s = g(); if (s.depth > 1) best = s; });
    if (best) {
      (best as { pop: () => void }).pop();
      setTimeout(() => {
        let can = false; NavPops.forEach((g) => { if (g().depth > 1) can = true; }); if (can) armHistory();
      }, 80);
    }
  });
}

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

export function NavigationStack({ screens, onPop, defIns, safeTop, rootBack: rootBackProp, className, style }: NavigationStackProps) {
  const rootTitle = screens[0]?.title;
  const split = useSplitViewBack(typeof rootTitle === 'string' ? rootTitle : undefined);
  const rootBack = rootBackProp === false ? null : rootBackProp ?? (split ? { title: split.title, onPress: split.back } : null);
  const contRef = useRef<any>(null);
  const regMap = useRef<Record<string, any>>({});
  const reg: Reg = (k, part) => { regMap.current[k] = { ...regMap.current[k], ...part }; };
  const [anim, setAnim] = useState<{ enter: string | null; exit: Screen[] | null }>({ enter: null, exit: null });
  const prevRef = useRef(screens);
  const skipRef = useRef(false);
  const tRef = useRef<any>(null);
  const onPopRef = useRef(onPop); onPopRef.current = onPop;
  const drag = useRef<any>(null);
  const flight = useRef<{ f: Flight; run?: AnimationPlaybackControls } | null>(null);
  const endFlight = () => { const c = flight.current; flight.current = null; if (c) { c.run?.stop(); c.f.done(); } };
  const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Fly a title between two screens (after a frame, once the new screen has laid out its bar). */
  const fly = (pick: () => [HTMLElement | null, HTMLElement | null, HTMLElement | null | undefined]) => {
    endFlight();
    if (reducedMotion()) return;
    requestAnimationFrame(() => {
      const [from, to, toScreen] = pick();
      if (!from || !to || !contRef.current) return;
      const f = titleFlight(contRef.current, from, to, toScreen);
      if (!f) return;
      f.set(0);
      const c: { f: Flight; run?: AnimationPlaybackControls } = { f };
      flight.current = c;
      c.run = animate(0, 1, { ...springs.smooth, onUpdate: f.set, onComplete: () => { if (flight.current === c) endFlight(); } });
    });
  };
  useEffect(() => endFlight, []);
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
      fly(() => [shownTitle(regMap.current[fromK]), backLabel(regMap.current[toK]), regMap.current[toK]?.el]);
      armHistory();
      tRef.current = setTimeout(() => setAnim({ enter: null, exit: null }), SETTLE_MS);
    } else if (nk.length < ok.length && pref(nk, ok)) {
      if (skipRef.current) { skipRef.current = false; setAnim({ enter: null, exit: null }); return; }
      setAnim({ enter: null, exit: old.slice(nk.length) });
      const fromK = ok[ok.length - 1], toK = nk[nk.length - 1];
      fly(() => [backLabel(regMap.current[fromK]), shownTitle(regMap.current[toK]), regMap.current[toK]?.el]);
      tRef.current = setTimeout(() => setAnim({ enter: null, exit: null }), SETTLE_MS);
    } else setAnim({ enter: null, exit: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysJ]);
  const ghosts = anim.exit || [];
  const canPop = screens.length > 1;
  const depthRef = useRef(0); depthRef.current = screens.length;
  useEffect(() => {
    const g = () => ({ depth: depthRef.current, pop: () => onPopRef.current && onPopRef.current() });
    NavPops.add(g); return () => { NavPops.delete(g); };
  }, []);
  const down = (e: React.PointerEvent) => {
    if (e.button || anim.enter || anim.exit || screens.length < 2) return;
    const rect = contRef.current.getBoundingClientRect();
    if (e.clientX - rect.left > navigationPush.edge) return;
    const topR = regMap.current[screens[screens.length - 1].key];
    const undR = regMap.current[screens[screens.length - 2].key];
    if (!topR || !topR.el || !undR || !undR.el) return;
    drag.current = { x0: e.clientX, y0: e.clientY, w: rect.width, topR, undR, last: e.clientX, lt: performance.now(), vel: 0, moved: false, on: false };
    try { contRef.current.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const raw = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.on) {  // slop: engage only on a clearly horizontal rightward drag
      if (raw > 8 && raw > Math.abs(dy) * 1.2) {
        d.on = true;
        // The back label scrubs toward the title it names, with the finger.
        endFlight();
        const from = backLabel(d.topR), to = shownTitle(d.undR);
        const f = !reducedMotion() && from && to ? titleFlight(contRef.current, from, to, d.undR.el) : null;
        if (f) { f.set(0); flight.current = { f }; d.flight = flight.current; }
      } else { if (Math.abs(dy) > 14) drag.current = null; return; }
    }
    const dx = Math.max(0, raw); d.moved = true; d.dx = dx;
    d.vel = (e.clientX - d.last) / Math.max(1, performance.now() - d.lt); d.last = e.clientX; d.lt = performance.now();
    const p = dx / d.w;
    try {
      d.topR.el.style.transition = 'none'; d.topR.el.style.transform = `translateX(${dx}px)`;
      d.undR.el.style.transition = 'none'; d.undR.el.style.transform = `translateX(${navigationPush.underPct * (1 - p)}%)`;
      if (d.undR.dim) { d.undR.dim.style.transition = 'none'; d.undR.dim.style.opacity = String(navigationPush.dim * (1 - p)); }
      if (d.flight && flight.current === d.flight) d.flight.f.set(p);
    } catch (err) { drag.current = null; }
  };
  const up = () => {
    const d = drag.current; if (!d) return; drag.current = null;
    if (!d.moved || !d.on) { clean(d); return; }
    const p = (d.dx || 0) / d.w;
    const commit = p > navigationPush.commit || d.vel > navigationPush.flick;
    // Release continues on the tray spring from wherever the finger let go (the CSS spring retargets).
    const ease = springCss('transform', 'tray');
    const c = d.flight && flight.current === d.flight ? d.flight : null;
    if (c) c.run = animate(p, commit ? 1 : 0, { ...springs.tray, onUpdate: c.f.set, onComplete: () => { if (flight.current === c) endFlight(); } });
    if (commit) {
      d.topR.el.style.transition = ease; d.topR.el.style.transform = 'translateX(104%)';
      d.undR.el.style.transition = ease; d.undR.el.style.transform = 'translateX(0%)';
      if (d.undR.dim) { d.undR.dim.style.transition = springCss('opacity', 'tray'); d.undR.dim.style.opacity = '0'; }
      skipRef.current = true;
      setTimeout(() => { onPopRef.current && onPopRef.current(); requestAnimationFrame(() => clean(d)); }, 380);
    } else {
      d.topR.el.style.transition = ease; d.topR.el.style.transform = 'translateX(0px)';
      d.undR.el.style.transition = ease; d.undR.el.style.transform = `translateX(${navigationPush.under})`;
      if (d.undR.dim) { d.undR.dim.style.transition = springCss('opacity', 'tray'); d.undR.dim.style.opacity = String(navigationPush.dim); }
      setTimeout(() => clean(d), 430);
    }
  };
  const clean = (d: any) => [d.topR, d.undR].forEach((r) => {
    try {
      if (r && r.el) { r.el.style.transition = ''; r.el.style.transform = ''; }
      if (r && r.dim) { r.dim.style.transition = ''; r.dim.style.opacity = ''; }
    } catch (e) { /* noop */ }
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
    <div ref={contRef} data-slot="navigation-stack"
      // Capture phase: the edge swipe may start on the back button, whose react-aria press handling stops
      // pointerdown from bubbling.
      onPointerDownCapture={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      className={cn('absolute inset-0 touch-pan-y overflow-hidden', className)} style={style}>
      {rendered.map((r) => (
        <ScreenWrap key={r.sc.key} sc={r.sc} depth={r.i} top={r.ghost ? total : topIdx} ghost={r.ghost}
          entering={!r.ghost && (anim.enter === r.sc.key || pendingEnter === r.sc.key) && r.i === topIdx}
          nav={{ pop: () => onPopRef.current && onPopRef.current(), canPop: canPop && !r.ghost }}
          backTitle={r.i > 0 ? (r.ghost ? (screens[screens.length - 1] && screens[screens.length - 1].title) : screens[r.i - 1].title) : null}
          reg={reg} defIns={defIns} z={r.i} rootBack={rootBack} />
      ))}
    </div>
  );
  return safeTop != null ? <BLSafeCtx.Provider value={parseFloat(String(safeTop)) || 0}>{inner}</BLSafeCtx.Provider> : inner;
}
