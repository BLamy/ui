import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { EASE } from './util';
import { vib, tick } from './haptics';

/* ══ SnapSheet — vaul-style bottom drawer (drag handle, snap points, velocity release) ══ */
export interface SnapSheetProps {
  open: boolean;
  onClose: () => void;
  snaps?: number[];
  children?: React.ReactNode;
  bg?: string;
  className?: string;
  style?: React.CSSProperties;
}
export function SnapSheet({ open, onClose, snaps: snapsProp, children, bg, className, style }: SnapSheetProps) {
  const snaps = snapsProp || [0.55, 0.94];
  const maxS = Math.max(...snaps);
  const [vis, setVis] = useState(false);
  const [snap, setSnap] = useState(0);
  const [ty, setTy] = useState<number | null>(null); // px translate while dragging; null = settled on snap
  const [anim, setAnim] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);
  const st = useRef({ drag: false, y0: 0, ty0: 0, y: 0, t: 0, v: 0 });
  const ch = () => (wrap.current ? wrap.current.offsetHeight : 700);
  const restTy = (idx: number) => ch() * (maxS - snaps[idx]);
  useEffect(() => {
    if (open) {
      setVis(true);
      setSnap(0);
      setAnim(false);
      setTy(ch() * maxS);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setAnim(true);
          setTy(null);
        })
      );
    } else if (vis) {
      setAnim(true);
      setTy(ch() * maxS);
      const t = setTimeout(() => {
        setVis(false);
        setTy(null);
      }, 430);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open && !vis) return null;
  const curTy = ty != null ? ty : restTy(snap);
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    st.current = { drag: true, y0: e.clientY, ty0: curTy, y: e.clientY, t: performance.now(), v: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    setAnim(false);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = st.current;
    if (!s.drag) return;
    const now = performance.now();
    if (now - s.t > 4) {
      s.v = (e.clientY - s.y) / (now - s.t);
      s.y = e.clientY;
      s.t = now;
    }
    let t = s.ty0 + (e.clientY - s.y0);
    const top = restTy(snaps.indexOf(maxS));
    if (t < top) t = top - Math.pow(top - t, 0.72);
    setTy(Math.max(0, t));
  };
  const up = () => {
    const s = st.current;
    if (!s.drag) return;
    s.drag = false;
    const proj = curTy + s.v * 200;
    const H = ch();
    let best = -1,
      bd = Infinity;
    snaps.forEach((f, i) => {
      const d = Math.abs(proj - H * (maxS - f));
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (Math.abs(proj - H * maxS) < bd || proj > H * (maxS - Math.min(...snaps)) + H * 0.12) {
      vib([6]);
      onClose();
      return;
    }
    setAnim(true);
    setSnap(best);
    setTy(null);
    tick();
  };
  const visFrac = maxS - (curTy / ch()) * 1;
  return (
    <div ref={wrap} data-slot="snap-sheet" className={className} style={{ position: 'absolute', inset: 0, zIndex: 70, overflow: 'hidden', ...style }}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,.45)',
          opacity: Math.min(1, Math.max(0, visFrac / maxS)),
          transition: anim ? 'opacity .42s ' + EASE : 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: maxS * 100 + '%',
          transform: 'translateY(' + curTy + 'px)',
          transition: anim ? 'transform .42s ' + EASE : 'none',
          background: bg || 'var(--wb-card)',
          borderRadius: '16px 16px 0 0',
          border: '1px solid var(--wb-sep)',
          borderBottom: 0,
          boxShadow: '0 -12px 40px rgba(0,0,0,.5)',
          display: 'flex',
          flexDirection: 'column',
          touchAction: 'none',
        }}
      >
        <div
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          style={{ padding: '8px 0 4px', cursor: 'grab', flexShrink: 0, touchAction: 'none' }}
        >
          <div style={{ width: 38, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.22)', margin: '0 auto' }} />
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      </div>
    </div>
  );
}
