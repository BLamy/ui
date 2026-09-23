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
    <div key={ev.n} data-slot="haptic-indicator"
      className={cn(
        'pointer-events-none absolute left-3 z-900 flex items-center gap-[9px] rounded-[99px] bg-card py-1.5 pr-3 pl-2 shadow-[0_6px_24px_rgba(0,0,0,.22),0_0_0_1px_var(--bl-sep)] animate-[blHapIn_1.1s_ease_forwards]',
        className,
      )}
      style={{ bottom, ...style }}>
      <span className="relative grid size-[22px] place-items-center">
        {/* Dot size tracks the haptic's weight. */}
        <span className="rounded-full bg-primary" style={{ width: 8 + ev.w * 2, height: 8 + ev.w * 2 }} />
        <span className="absolute inset-0 rounded-full [border:2px_solid_var(--bl-tint)] animate-[blRing_.6s_ease-out_forwards]" />
      </span>
      <span>
        <span className="block [font-family:ui-monospace,Menlo,monospace] text-[11.5px] font-bold text-foreground">{ev.label}</span>
        <span className="block [font-family:ui-monospace,Menlo,monospace] text-[9.5px] text-bl-label3">{eng}</span>
      </span>
    </div>
  );
}
