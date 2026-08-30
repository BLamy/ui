import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Haptics } from '../lib/haptics';
import { Icon } from '../lib/icon';
import { EASE } from '../lib/utils';
import { List, ListRow, ListSection } from '../components/list';
import { Switch } from '../components/switch';

/* ══ Haptics Playground — the vibrator.dev homepage set: magic toggle, brightness, haptic slider,
   slide-to-unlock, timer wheels. Every surface calls Haptics/navigator.vibrate inside the live gesture. ══ */

const sq = (color: string, icon: string) => (
  <span style={{ width: 29, height: 29, borderRadius: 7, background: color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
    <Icon name={icon} size={17} sw={2} style={{ color: '#fff' }} />
  </span>
);

export function Sun({ size, color }: { size?: number; color?: string }) {
  return (
    <svg width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" /></svg>
  );
}

let vibModule: any = null;
const VIB_URL: string = 'https://cdn.jsdelivr.net/npm/ios-vibrator-pro-max@3.0.3/+esm';

export function ShowMagicRow() {
  const [on, setOn] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const toggle = async (v: boolean) => {
    setOn(v); Haptics.impact('light');
    try {
      const m = vibModule || (vibModule = await import(/* @vite-ignore */ VIB_URL));
      if (m.enableDebugMode) { m.enableDebugMode(v); setNote(v ? 'Overlay switches are now visible' : null); }
      else setNote('debug API missing in this build');
    } catch (e) { setNote('polyfill only loads in Safari'); }
  };
  return (
    <ListRow leading={sq('#BF5AF2', 'wave')} title="Show the magic!" divider={false}
      subtitle={note || 'Reveal the hidden switch overlays the polyfill drives'}
      trailing={<Switch checked={on} onChange={toggle} aria-label="Show the magic" />} />
  );
}

export function BrightnessSlider() {
  const [v, setV] = useState(0.55);
  const ref = useRef<any>(null); const det = useRef(9);
  const move = (e: React.PointerEvent | React.MouseEvent) => {
    const r = ref.current.getBoundingClientRect();
    const nv = Math.min(1, Math.max(0, ((e as React.PointerEvent).clientX - r.left) / r.width)); setV(nv);
    const d = Math.round(nv * 16); if (d !== det.current) { det.current = d; Haptics.selection(); }
  };
  return (
    <div ref={ref} role="slider" aria-label="Brightness" aria-valuenow={Math.round(v * 100)} tabIndex={0}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={(e) => { if (e.buttons) move(e); }}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { setV((x) => Math.min(1, Math.max(0, x + (e.key === 'ArrowRight' ? 0.0625 : -0.0625)))); Haptics.selection(); e.preventDefault(); } }}
      style={{ position: 'relative', height: 64, borderRadius: 18, background: 'var(--tk-fill2)', overflow: 'hidden', touchAction: 'none', cursor: 'ew-resize' }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: (v * 100) + '%', background: 'rgba(255,255,255,.94)' }} />
      <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(60,60,67,.62)', display: 'grid' }}><Sun size={22} /></span>
    </div>
  );
}

export function HapticSlider() {
  const [v, setV] = useState(0.5);
  const last = useRef(0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <input type="range" className="tk-range" min="0" max="1" step="0.01" value={v} aria-label="Haptic slider"
        style={{ flex: 1, '--tk-range-fill': (v * 100) + '%' } as CSSProperties}
        onChange={(e) => {
          setV(+e.target.value);
          const now = performance.now(); if (now - last.current > 16) { last.current = now; Haptics.selection(); }
        }} />
      <span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 14.5, color: 'var(--tk-label2)', width: 36, textAlign: 'right', flexShrink: 0 }}>{v.toFixed(2)}</span>
    </div>
  );
}

export function SlideToUnlock() {
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef<any>(null); const xr = useRef(0); const det = useRef(0);
  const travel = () => { const r = ref.current && ref.current.getBoundingClientRect(); return r ? r.width - 8 - 48 : 220; };
  const move = (e: React.PointerEvent) => {
    if (done) return;
    const r = ref.current.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (e.clientX - r.left - 28) / travel()));
    xr.current = nx; setX(nx);
    const d = Math.round(nx * 12); if (d !== det.current) { det.current = d; Haptics.selection(); }
  };
  const up = () => {
    setDrag(false);
    if (done) return;
    if (xr.current > 0.92) {
      setDone(true); xr.current = 1; setX(1); Haptics.notification('success');
      setTimeout(() => { setDone(false); xr.current = 0; setX(0); det.current = 0; }, 1500);
    } else { xr.current = 0; setX(0); det.current = 0; }
  };
  return (
    <div ref={ref} style={{
      position: 'relative', height: 56, borderRadius: 28, background: 'var(--tk-fill)',
      boxShadow: 'inset 0 1px 3px rgba(0,0,0,.12)', overflow: 'hidden',
    }}>
      <span aria-hidden="true" className={done ? '' : 'tk-shimmer'} style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        fontSize: 17, letterSpacing: '.4px', color: done ? 'var(--tk-green)' : undefined, fontWeight: done ? 600 : 400, opacity: done ? 1 : Math.max(0, 1 - x * 1.7),
      }}>
        {done ? 'unlocked' : 'slide to unlock'}</span>
      <button className="tk-btn" aria-label="Slide to unlock"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); }}
        onPointerMove={(e) => { if (drag) move(e); }}
        onPointerUp={up} onPointerCancel={up}
        style={{
          position: 'absolute', top: 4, left: 4 + x * travel(), width: 48, height: 48, borderRadius: 24, border: 0, padding: 0,
          background: 'var(--tk-card)', boxShadow: '0 2px 6px rgba(0,0,0,.22)', cursor: 'grab', touchAction: 'none',
          display: 'grid', placeItems: 'center', color: done ? 'var(--tk-green)' : 'var(--tk-label2)',
          transition: drag ? 'none' : 'left .38s ' + EASE,
        }}>
        <Icon name={done ? 'check' : 'chev'} size={22} sw={2.4} /></button>
    </div>
  );
}

export function WheelDrum({ n, init, label }: { n: number; init?: number; label: string }) {
  const H = 34, VIS = 5;
  const [off, setOff] = useState(-(init || 0) * H);
  const [anim, setAnim] = useState(false);
  const st = useRef<any>({ drag: false, y0: 0, off0: 0, y: 0, t: 0, v: 0, raf: 0, det: init || 0 });
  const clampHard = (o: number) => Math.min(0, Math.max(-(n - 1) * H, o));
  const tick = (o: number) => { const d = Math.max(0, Math.min(n - 1, Math.round(-o / H))); if (d !== st.current.det) { st.current.det = d; Haptics.selection(); } };
  const settle = (o: number) => { const t = clampHard(Math.round(o / H) * H); setAnim(true); setOff(t); tick(t); };
  const down = (e: React.PointerEvent) => {
    cancelAnimationFrame(st.current.raf);
    e.currentTarget.setPointerCapture(e.pointerId);
    st.current = { ...st.current, drag: true, y0: e.clientY, off0: off, y: e.clientY, t: performance.now(), v: 0 };
    setAnim(false);
  };
  const move = (e: React.PointerEvent) => {
    const s = st.current; if (!s.drag) return;
    const now = performance.now();
    if (now - s.t > 4) { s.v = (e.clientY - s.y) / (now - s.t); s.y = e.clientY; s.t = now; }
    let o = s.off0 + (e.clientY - s.y0);
    const c = clampHard(o); if (o !== c) o = c + (o - c) * 0.32;
    setOff(o); tick(o);
  };
  const up = () => {
    const s = st.current; if (!s.drag) return; s.drag = false;
    let o = off, v = s.v * 16;
    if (Math.abs(v) < 1.2) { settle(o); return; }
    const glide = () => {
      o += v; v *= 0.93;
      if (o > 0 || o < -(n - 1) * H) { o = clampHard(o); v = 0; }
      setOff(o); tick(o);
      if (Math.abs(v) > 0.6) st.current.raf = requestAnimationFrame(glide); else settle(o);
    };
    st.current.raf = requestAnimationFrame(glide);
  };
  const idx = -off / H;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0, justifyContent: 'center' }}>
      <div role="spinbutton" aria-label={label} aria-valuenow={st.current.det} tabIndex={0}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onWheel={(e) => { e.preventDefault(); const d = e.deltaY > 0 ? 1 : -1; settle(clampHard((Math.round(-off / H) + d) * -H)); }}
        onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { settle(clampHard((Math.round(-off / H) + (e.key === 'ArrowDown' ? 1 : -1)) * -H)); e.preventDefault(); } }}
        style={{ position: 'relative', height: H * VIS, width: 52, overflow: 'hidden', touchAction: 'none', cursor: 'ns-resize', flexShrink: 0 }}>
        <div style={{ position: 'absolute', left: -4, right: -4, top: (VIS - 1) / 2 * H, height: H, borderRadius: 9, background: 'var(--tk-fill)' }} />
        <div style={{
          position: 'absolute', left: 0, right: 0, top: (VIS - 1) / 2 * H, transform: 'translateY(' + off + 'px)',
          transition: anim ? 'transform .3s cubic-bezier(.25,.8,.25,1)' : 'none',
        }}>
          {Array.from({ length: n }, (_, i) => {
            const dist = Math.min(2.6, Math.abs(i - idx));
            return (
              <div key={i} style={{
                height: H, display: 'grid', placeItems: 'center', fontSize: 21,
                color: 'var(--tk-label)', opacity: Math.max(0.16, 1 - dist * 0.34), fontVariantNumeric: 'tabular-nums',
              }}>{i}</div>
            );
          })}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H * 1.4, background: 'linear-gradient(var(--tk-card), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: H * 1.4, background: 'linear-gradient(transparent, var(--tk-card))', pointerEvents: 'none' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tk-label2)' }}>{label}</span>
    </div>
  );
}

export function HapticsPlayground() {
  const [, bump] = useState(0);
  useEffect(() => {
    const h = () => setTimeout(() => bump((x) => x + 1), 40);
    window.addEventListener('tk-vib', h);
    const t = setInterval(() => bump((x) => x + 1), 1200);
    const stop = setTimeout(() => clearInterval(t), 10000);
    return () => { window.removeEventListener('tk-vib', h); clearInterval(t); clearTimeout(stop); };
  }, []);
  return (
    <List inset>
      <div style={{ padding: '2px 4px 14px', fontSize: 15, lineHeight: 1.5, color: 'var(--tk-label2)' }}>
        The playground from <span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 13.5 }}>vibrator.dev</span> — on an iPhone or MacBook, in Safari, you'll feel haptic feedback as you slide these elements. <span style={{ color: 'var(--tk-label3)' }}>(If you don't feel anything, drag slower.)</span></div>
      <div style={{ padding: '0 4px 16px', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12, color: 'var(--tk-label3)' }}>engine: {Haptics.engine}</div>
      <ListSection><ShowMagicRow /></ListSection>
      <ListSection title="Brightness">
        <div style={{ background: 'var(--tk-card)', borderRadius: 12, padding: 14 }}><BrightnessSlider /></div>
      </ListSection>
      <ListSection title="Haptic slider">
        <div style={{ background: 'var(--tk-card)', borderRadius: 12, padding: '10px 14px' }}><HapticSlider /></div>
      </ListSection>
      <ListSection title="Slide to unlock">
        <div style={{ background: 'var(--tk-card)', borderRadius: 12, padding: 10 }}><SlideToUnlock /></div>
      </ListSection>
      <ListSection title="Timer" footer="A selection tick per detent — Haptics.selection(), the same call the A–Z index scrubber makes. Flick a wheel: ticks ride the momentum. Playground set recreated from vibrator.dev — ios-vibrator-pro-max by @samdenty (MIT).">
        <div style={{ background: 'var(--tk-card)', borderRadius: 12, padding: '8px 10px', display: 'flex', gap: 2 }}>
          <WheelDrum n={24} init={1} label="hours" />
          <WheelDrum n={60} init={30} label="min" />
          <WheelDrum n={60} init={15} label="sec" />
        </div>
      </ListSection>
    </List>
  );
}
