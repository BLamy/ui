import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Haptics, type HapticEvent } from '../lib/haptics';
import { cn } from '../lib/utils';

export interface HapticIndicatorProps {
  visible?: boolean;
  bottom?: number | string;
  className?: string;
  style?: CSSProperties;
}

export function HapticIndicator({ visible, bottom, className, style }: HapticIndicatorProps) {
  const [ev, setEv] = useState<HapticEvent | null>(null);
  const n = useRef(0);
  useEffect(() => Haptics.on((m) => { n.current++; setEv({ ...m, n: n.current }); }), []);
  if (!visible || !ev) return null;
  const eng = Haptics.engine;
  return (
    <div key={ev.n} data-slot="haptic-indicator" className={cn(className)} style={{
      position: 'absolute', left: 12, bottom, zIndex: 900, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 9, padding: '6px 12px 6px 8px', borderRadius: 99,
      background: 'var(--tk-card)', boxShadow: '0 6px 24px rgba(0,0,0,.22), 0 0 0 1px var(--tk-sep)',
      animation: 'tkHapIn 1.1s ease forwards', ...style,
    }}>
      <span style={{ position: 'relative', width: 22, height: 22, display: 'grid', placeItems: 'center' }}>
        <span style={{ width: 8 + ev.w * 2, height: 8 + ev.w * 2, borderRadius: '50%', background: 'var(--tk-tint)' }} />
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--tk-tint)', animation: 'tkRing .6s ease-out forwards' }} />
      </span>
      <span>
        <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--tk-label)', fontFamily: 'ui-monospace,Menlo,monospace' }}>{ev.label}</span>
        <span style={{ display: 'block', fontSize: 9.5, color: 'var(--tk-label3)', fontFamily: 'ui-monospace,Menlo,monospace' }}>{eng}</span>
      </span>
    </div>
  );
}
