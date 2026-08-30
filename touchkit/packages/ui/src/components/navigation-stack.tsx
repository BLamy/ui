import {
  use, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { Haptics } from '../lib/haptics';
import { Icon } from '../lib/icon';
import { chromeStore, TKSafeCtx, TKStickyCtx } from '../lib/theme';
import { cn, BARH, EASE } from '../lib/utils';
import { Spinner } from './spinner';

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
type Reg = (key: string, part: { el?: HTMLDivElement | null; dim?: HTMLDivElement | null }) => void;

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
}

export function ScreenWrap({ sc, depth, top, ghost, entering, nav, backTitle, reg, defIns, z }: ScreenWrapProps) {
  const started = useRef(false);
  const [in_, setIn] = useState(!entering);
  const [out, setOut] = useState(false);
  const [scr, setScr] = useState(false);
  const [hid, setHid] = useState(false);
  const safeTop = use(TKSafeCtx);
  const lastY = useRef(0);
  const scroller = useRef<any>(null); const inner = useRef<any>(null); const spin = useRef<any>(null);
  const pl = useRef<any>(null); const [refr, setRefr] = useState(false);
  useLayoutEffect(() => {
    if (entering && !started.current) {
      started.current = true; setIn(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setIn(true)));
    }
  }, [entering]);
  useEffect(() => { if (ghost) requestAnimationFrame(() => setOut(true)); }, [ghost]);
  const isUnder = !ghost && depth < top;
  const tx = ghost ? (out ? '103%' : '0%') : (!in_ ? '103%' : isUnder ? '-28%' : '0%');
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
    if (armed && !d.armed) { d.armed = true; Haptics.impact('light'); }
    if (!armed && d.armed) d.armed = false;
  };
  const pEnd = () => {
    const d = pl.current; if (!d) return; pl.current = null; if (!d.on) return;
    const c = inner.current, sp = spin.current;
    if (d.armed) {
      setRefr(true); Haptics.impact('medium');
      if (c) { c.style.transition = 'transform .25s ease'; c.style.transform = 'translateY(52px)'; }
      if (sp) { sp.style.opacity = '1'; sp.style.transform = 'translateX(-50%)'; }
      setTimeout(() => {
        setRefr(false);
        if (c) { c.style.transition = 'transform .4s ' + EASE; c.style.transform = 'translateY(0)'; }
        if (sp) sp.style.opacity = '0';
        sc.onRefresh && sc.onRefresh();
        setTimeout(() => { if (c) { c.style.transition = ''; c.style.transform = ''; } }, 420);
      }, 1100);
    } else {
      if (c) {
        c.style.transition = 'transform .3s ' + EASE; c.style.transform = 'translateY(0)';
        setTimeout(() => { if (c) { c.style.transition = ''; c.style.transform = ''; } }, 320);
      }
      if (sp) sp.style.opacity = '0';
    }
  };
  return (
    <div ref={(el) => reg(sc.key, { el })} data-slot="screen" data-screen-label={typeof sc.title === 'string' ? sc.title : sc.key}
      style={{
        position: 'absolute', inset: 0, zIndex: 10 + z, background: sc.grouped ? 'var(--tk-bg2)' : 'var(--tk-bg)',
        transform: `translateX(${tx})`, transition: `transform .42s ${EASE}`, willChange: 'transform', overflow: 'hidden',
        boxShadow: depth > 0 ? '-10px 0 30px rgba(0,0,0,.16)' : 'none', pointerEvents: ghost ? 'none' : 'auto',
      }}>
      <div ref={scroller} className="tk-scroll" onScroll={onScroll} onKeyDown={onKey}
        onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pEnd} onPointerCancel={pEnd}
        style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' } as CSSProperties}>
        <div ref={inner} style={{ maxWidth: sc.maxW || 'none', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          {sc.largeTitle
            ? <div style={{ padding: (barH + 2) + 'px 16px 6px' }}>
                <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.5px', lineHeight: 1.15 }}>{sc.title}</div>
                {sc.subheader ? <div style={{ marginTop: 10 }}>{sc.subheader}</div> : null}
              </div>
            : <div style={{ height: barH }} />}
          <TKStickyCtx.Provider value={barH}>{sc.content}</TKStickyCtx.Provider>
          <div style={{ height: ins + 28 }} />
        </div>
      </div>
      {sc.onRefresh ? (
        <div ref={spin} style={{
          position: 'absolute', top: barH + 8, left: '50%', transform: 'translateX(-50%)', opacity: 0,
          color: 'var(--tk-label2)', zIndex: 5, pointerEvents: 'none', transition: 'opacity .2s',
        }}><Spinner spin={refr} /></div>
      ) : null}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: barH, zIndex: 30, display: 'flex', alignItems: 'flex-end', padding: '0 6px', boxSizing: 'border-box',
        paddingTop: safeTop, transform: hid ? 'translateY(' + (-(barH - safeTop)) + 'px)' : 'none', transition: 'transform .3s ' + EASE,
      }}>
        <div style={{
          position: 'absolute', inset: 0, background: 'var(--tk-bar)', backdropFilter: 'blur(18px) saturate(1.7)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.7)', borderBottom: '1px solid var(--tk-sep)', opacity: scr ? 1 : 0, transition: 'opacity .25s',
        }} />
        {/* Under-island strip: stays put while the bar slides away, so content never runs under the camera. */}
        {safeTop ? (
          <div style={{
            position: 'absolute', left: 0, right: 0, top: 0, height: safeTop, background: 'var(--tk-bar)',
            backdropFilter: 'blur(18px) saturate(1.7)', WebkitBackdropFilter: 'blur(18px) saturate(1.7)',
            transform: hid ? 'translateY(' + (barH - safeTop) + 'px)' : 'none', transition: 'transform .3s ' + EASE, opacity: scr || hid ? 1 : 0,
          }} />
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: BARH, opacity: hid ? 0 : 1, transition: 'opacity .2s' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 44, zIndex: 1 }}>
            {(depth > 0 || ghost)
              ? <button className="tk-btn" onClick={nav.canPop ? nav.pop : undefined} style={{
                  display: 'flex', alignItems: 'center', border: 0, background: 'none',
                  color: 'var(--tk-tint)', fontSize: 17, fontFamily: 'inherit', padding: '6px 8px 6px 0', cursor: 'pointer', maxWidth: 160,
                }}>
                  <Icon name="chevL" size={24} sw={2.4} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeof backTitle === 'string' && backTitle.length <= 12 ? backTitle : 'Back'}</span>
                </button>
              : (sc.leading || null)}
          </div>
          <div style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)', maxWidth: '52%', fontSize: 17, fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: showTitle ? 1 : 0, transition: 'opacity .2s', pointerEvents: 'none', color: 'var(--tk-label)',
          }}>{sc.title}</div>
          <div style={{ position: 'relative', marginLeft: 'auto', display: 'flex', alignItems: 'center', zIndex: 1 }}>{sc.trailing || null}</div>
        </div>
      </div>
      {sc.overlay || null}
      <div ref={(el) => reg(sc.key, { dim: el })} style={{
        position: 'absolute', inset: 0, background: '#000', opacity: isUnder ? .12 : 0,
        transition: 'opacity .42s', pointerEvents: 'none', zIndex: 200,
      }} />
    </div>
  );
}

/* Back-gesture history bridge: on touch devices the system edge-swipe would navigate the page itself away
   (blank screen). While any stack can pop we keep one history sentinel armed; the system gesture then lands
   as popstate and pops OUR stack instead of the page. */
const NavPops = new Set<() => { depth: number; pop: () => void }>();
let tkArmed = false;
let tkCoarse = typeof matchMedia !== 'undefined' && matchMedia('(any-pointer: coarse)').matches;
function armHistory() {
  if (!tkCoarse || tkArmed) return;
  try { history.pushState({ tkNav: 1 }, ''); tkArmed = true; } catch (e) { tkCoarse = false; }
}
if (typeof window !== 'undefined' && !(window as any).__tkPopstate) {
  (window as any).__tkPopstate = 1;
  window.addEventListener('popstate', () => {
    if (!tkArmed) return; tkArmed = false;
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
  /** Safe-area top override for this stack (px). Usually inherited from TouchKitProvider instead. */
  safeTop?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function NavigationStack({ screens, onPop, defIns, safeTop, className, style }: NavigationStackProps) {
  const contRef = useRef<any>(null);
  const regMap = useRef<Record<string, any>>({});
  const reg: Reg = (k, part) => { regMap.current[k] = { ...regMap.current[k], ...part }; };
  const [anim, setAnim] = useState<{ enter: string | null; exit: Screen[] | null }>({ enter: null, exit: null });
  const prevRef = useRef(screens);
  const skipRef = useRef(false);
  const tRef = useRef<any>(null);
  const onPopRef = useRef(onPop); onPopRef.current = onPop;
  const drag = useRef<any>(null);
  const keysJ = screens.map((s) => s.key).join('¦');
  useLayoutEffect(() => {
    const old = prevRef.current; prevRef.current = screens;
    const ok = old.map((s) => s.key), nk = screens.map((s) => s.key);
    if (ok.join('¦') === keysJ) return;
    clearTimeout(tRef.current);
    const pref = (a: string[], b: string[]) => a.every((k, i) => b[i] === k);
    if (nk.length > ok.length && pref(ok, nk)) {
      setAnim({ enter: nk[nk.length - 1], exit: null });
      armHistory();
      tRef.current = setTimeout(() => setAnim({ enter: null, exit: null }), 460);
    } else if (nk.length < ok.length && pref(nk, ok)) {
      if (skipRef.current) { skipRef.current = false; setAnim({ enter: null, exit: null }); return; }
      setAnim({ enter: null, exit: old.slice(nk.length) });
      tRef.current = setTimeout(() => setAnim({ enter: null, exit: null }), 460);
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
    if (e.clientX - rect.left > 36) return;
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
      if (raw > 8 && raw > Math.abs(dy) * 1.2) d.on = true;
      else { if (Math.abs(dy) > 14) drag.current = null; return; }
    }
    const dx = Math.max(0, raw); d.moved = true; d.dx = dx;
    d.vel = (e.clientX - d.last) / Math.max(1, performance.now() - d.lt); d.last = e.clientX; d.lt = performance.now();
    const p = dx / d.w;
    try {
      d.topR.el.style.transition = 'none'; d.topR.el.style.transform = `translateX(${dx}px)`;
      d.undR.el.style.transition = 'none'; d.undR.el.style.transform = `translateX(${-28 * (1 - p)}%)`;
      if (d.undR.dim) { d.undR.dim.style.transition = 'none'; d.undR.dim.style.opacity = String(.12 * (1 - p)); }
    } catch (err) { drag.current = null; }
  };
  const up = () => {
    const d = drag.current; if (!d) return; drag.current = null;
    if (!d.moved || !d.on) { clean(d); return; }
    const p = (d.dx || 0) / d.w;
    const commit = p > .32 || d.vel > .55;
    const ease = 'transform .26s ease-out';
    if (commit) {
      Haptics.impact('light');
      d.topR.el.style.transition = ease; d.topR.el.style.transform = 'translateX(104%)';
      d.undR.el.style.transition = ease; d.undR.el.style.transform = 'translateX(0%)';
      if (d.undR.dim) { d.undR.dim.style.transition = 'opacity .26s'; d.undR.dim.style.opacity = '0'; }
      skipRef.current = true;
      setTimeout(() => { onPopRef.current && onPopRef.current(); requestAnimationFrame(() => clean(d)); }, 250);
    } else {
      d.topR.el.style.transition = ease; d.topR.el.style.transform = 'translateX(0px)';
      d.undR.el.style.transition = ease; d.undR.el.style.transform = 'translateX(-28%)';
      if (d.undR.dim) { d.undR.dim.style.transition = 'opacity .26s'; d.undR.dim.style.opacity = '.12'; }
      setTimeout(() => clean(d), 290);
    }
  };
  const clean = (d: any) => [d.topR, d.undR].forEach((r) => {
    try {
      if (r && r.el) { r.el.style.transition = ''; r.el.style.transform = ''; }
      if (r && r.dim) { r.dim.style.transition = ''; r.dim.style.opacity = ''; }
    } catch (e) { /* noop */ }
  });
  const topIdx = screens.length - 1;
  const rendered = [
    ...screens.map((sc, i) => ({ sc, i, ghost: false })),
    ...ghosts.map((sc, j) => ({ sc, i: screens.length + j, ghost: true })),
  ];
  const total = rendered.length - 1;
  const inner = (
    <div ref={contRef} data-slot="navigation-stack" className={cn(className)}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', touchAction: 'pan-y', ...style }}>
      {rendered.map((r) => (
        <ScreenWrap key={r.sc.key} sc={r.sc} depth={r.i} top={r.ghost ? total : topIdx} ghost={r.ghost}
          entering={!r.ghost && anim.enter === r.sc.key && r.i === topIdx}
          nav={{ pop: () => onPopRef.current && onPopRef.current(), canPop: canPop && !r.ghost }}
          backTitle={r.i > 0 ? (r.ghost ? (screens[screens.length - 1] && screens[screens.length - 1].title) : screens[r.i - 1].title) : null}
          reg={reg} defIns={defIns} z={r.i} />
      ))}
    </div>
  );
  return safeTop != null ? <TKSafeCtx.Provider value={parseFloat(String(safeTop)) || 0}>{inner}</TKSafeCtx.Provider> : inner;
}
