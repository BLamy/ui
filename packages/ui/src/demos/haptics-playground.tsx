import { useRef, useState, type CSSProperties } from 'react';
import { Haptics } from '../lib/haptics';
import { Icon } from '../lib/icon';
import { cn } from '../lib/utils';
import { List, ListRow, ListSection } from '../components/list';
import { Switch } from '../components/switch';

/* ══ Haptics Playground — haptics setting, brightness, haptic slider, slide-to-unlock, timer wheels. Every surface
   calls Haptics inside the live gesture. On Android each detent vibrates; iOS/macOS Safari can only tick on a tap,
   a key press or a native range's input events, so the pointer-driven drags are silent there (see lib/haptics). ══ */

const sq = (color: string, icon: string) => (
  <span className="grid size-[29px] shrink-0 place-items-center rounded-[7px]" style={{ background: color }}>
    <Icon name={icon} size={17} sw={2} className="text-white" />
  </span>
);

export function Sun({ size, color }: { size?: number; color?: string }) {
  return (
    <svg width={size || 20} height={size || 20} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" /></svg>
  );
}

/** The user's haptics setting: flips `Haptics.enabled`, which persists on this device. */
export function HapticsEnabledRow() {
  const [on, setOn] = useState(() => Haptics.enabled);
  const toggle = (v: boolean) => {
    // The Switch ticks before this runs, so turning off still ticks once; turning on confirms with one tick.
    Haptics.enabled = v; setOn(v);
    if (v) Haptics.impact('light');
  };
  return (
    <ListRow leading={sq('#BF5AF2', 'wave')} title="Haptics" divider={false}
      subtitle={on ? 'On for this device · Haptics.enabled' : 'Off — no ticks, no events'}
      trailing={<Switch checked={on} onChange={toggle} aria-label="Haptics" />} />
  );
}

/** @deprecated The polyfill overlay it revealed is gone; this is now {@link HapticsEnabledRow}. */
export const ShowMagicRow = HapticsEnabledRow;

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
      className="relative h-[64px] cursor-ew-resize touch-none overflow-hidden rounded-[18px] bg-bl-fill2">
      <div className="absolute inset-y-0 left-0 bg-[rgba(255,255,255,.94)]" style={{ width: (v * 100) + '%' }} />
      <span className="absolute top-1/2 left-4 grid -translate-y-1/2 text-[rgba(60,60,67,.62)]"><Sun size={22} /></span>
    </div>
  );
}

export function HapticSlider() {
  const [v, setV] = useState(0.5);
  const last = useRef(0);
  return (
    <div className="flex items-center gap-3.5">
      <input type="range" className="bl-range flex-1" min="0" max="1" step="0.01" value={v} aria-label="Haptic slider"
        style={{ '--bl-range-fill': (v * 100) + '%' } as CSSProperties}
        onChange={(e) => {
          setV(+e.target.value);
          const now = performance.now(); if (now - last.current > 16) { last.current = now; Haptics.selection(); }
        }} />
      <span className="w-[36px] shrink-0 text-right [font-family:ui-monospace,Menlo,monospace] text-[14.5px] text-muted-foreground">{v.toFixed(2)}</span>
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
    <div ref={ref} className="relative h-[56px] overflow-hidden rounded-[28px] bg-secondary shadow-[inset_0_1px_3px_rgba(0,0,0,.12)]">
      <span aria-hidden="true"
        className={cn('absolute inset-0 grid place-items-center text-[17px] tracking-[.4px]', done ? 'font-semibold text-success' : 'bl-shimmer font-normal')}
        // The hint fades as the knob travels.
        style={{ opacity: done ? 1 : Math.max(0, 1 - x * 1.7) }}>
        {done ? 'unlocked' : 'slide to unlock'}</span>
      <button aria-label="Slide to unlock"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); }}
        onPointerMove={(e) => { if (drag) move(e); }}
        onPointerUp={up} onPointerCancel={up}
        className={cn(
          'bl-btn absolute top-1 grid size-[48px] cursor-grab touch-none place-items-center rounded-[24px] border-0 bg-card p-0 shadow-[0_2px_6px_rgba(0,0,0,.22)]',
          done ? 'text-success' : 'text-muted-foreground',
          !drag && 'transition-[left] duration-spring-smooth ease-spring-smooth',
        )}
        // Knob position follows the drag.
        style={{ left: 4 + x * travel() }}>
        <Icon name={done ? 'check' : 'chev'} size={22} sw={2.4} /></button>
    </div>
  );
}

export function WheelDrum({ n, init, label }: { n: number; init?: number; label: string }) {
  const H = 34; // row height; the drum shows 5 rows (170px) with the selection band at 68px
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
    <div className="flex min-w-0 flex-1 items-center justify-center gap-[7px]">
      <div role="spinbutton" aria-label={label} aria-valuenow={st.current.det} tabIndex={0}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onWheel={(e) => { e.preventDefault(); const d = e.deltaY > 0 ? 1 : -1; settle(clampHard((Math.round(-off / H) + d) * -H)); }}
        onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { settle(clampHard((Math.round(-off / H) + (e.key === 'ArrowDown' ? 1 : -1)) * -H)); e.preventDefault(); } }}
        className="relative h-[170px] w-[52px] shrink-0 cursor-ns-resize touch-none overflow-hidden">
        <div className="absolute -inset-x-1 top-[68px] h-[34px] rounded-[9px] bg-secondary" />
        <div className={cn('absolute inset-x-0 top-[68px]', anim && 'transition-transform duration-spring-snappy ease-spring-snappy')}
          // Drum offset follows the drag / momentum.
          style={{ transform: 'translateY(' + off + 'px)' }}>
          {Array.from({ length: n }, (_, i) => {
            const dist = Math.min(2.6, Math.abs(i - idx));
            return (
              <div key={i} className="grid h-[34px] place-items-center text-[21px] text-foreground tabular-nums"
                style={{ opacity: Math.max(0.16, 1 - dist * 0.34) }}>{i}</div>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[47.6px] bg-[linear-gradient(var(--bl-card),transparent)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[47.6px] bg-[linear-gradient(transparent,var(--bl-card))]" />
      </div>
      <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

export function HapticsPlayground() {
  return (
    <List inset>
      <div className="px-1 pt-0.5 pb-3.5 text-[15px] leading-[1.5] text-muted-foreground">
        Tap, slide and spin. On Android every detent vibrates. In Safari on an iPhone, or a Mac with a Force Touch trackpad, taps tick and so does the native haptic slider. <span className="text-bl-label3">(iOS can't tick mid-drag, so the custom drags are silent there.)</span></div>
      <div className="px-1 pt-0 pb-4 [font-family:ui-monospace,Menlo,monospace] text-[12px] text-bl-label3">engine: {Haptics.engine}</div>
      <ListSection><HapticsEnabledRow /></ListSection>
      <ListSection title="Brightness">
        <div className="rounded-[12px] bg-card p-3.5"><BrightnessSlider /></div>
      </ListSection>
      <ListSection title="Haptic slider" footer="A native range input: Safari can tick on its input events.">
        <div className="rounded-[12px] bg-card px-3.5 py-2.5"><HapticSlider /></div>
      </ListSection>
      <ListSection title="Slide to unlock">
        <div className="rounded-[12px] bg-card p-2.5"><SlideToUnlock /></div>
      </ListSection>
      <ListSection title="Timer" footer="A selection tick per detent — Haptics.selection(), the same call the A–Z index scrubber makes. Flick a wheel: on Android the ticks ride the momentum.">
        <div className="flex gap-0.5 rounded-[12px] bg-card px-2.5 py-2">
          <WheelDrum n={24} init={1} label="hours" />
          <WheelDrum n={60} init={30} label="min" />
          <WheelDrum n={60} init={15} label="sec" />
        </div>
      </ListSection>
    </List>
  );
}
