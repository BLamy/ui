import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Haptics, type HapticEvent } from '../lib/haptics';
import { fades, springs } from '../lib/motion';
import { cn } from '../lib/utils';
import { TextMorph } from './text-morph';

export interface HapticIndicatorProps {
  visible?: boolean;
  bottom?: number | string;
  className?: string;
  style?: CSSProperties;
}

/** How long the pill lingers after the last haptic. */
const HOLD_MS = 900;

/** A pill that surfaces each haptic. It rises in on a spring and stays while events keep coming: the same pill
    morphs its label and pulses a ring per event, rather than a new pill popping in for every tick. */
export function HapticIndicator({ visible, bottom, className, style }: HapticIndicatorProps) {
  const [ev, setEv] = useState<HapticEvent | null>(null);
  const [shown, setShown] = useState(false);
  const n = useRef(0);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reduced = useReducedMotion();
  useEffect(() => {
    const off = Haptics.on((m) => {
      n.current++; setEv({ ...m, n: n.current }); setShown(true);
      clearTimeout(hold.current); hold.current = setTimeout(() => setShown(false), HOLD_MS);
    });
    return () => { off(); clearTimeout(hold.current); };
  }, []);
  const eng = Haptics.engine;
  return (
    <AnimatePresence>
      {visible && shown && ev ? (
        <motion.div key="haptic" data-slot="haptic-indicator"
          className={cn(
            'pointer-events-none absolute left-3 z-900 flex items-center gap-[9px] rounded-[99px] bg-card py-1.5 pr-3 pl-2 shadow-[0_6px_24px_--alpha(black/22%),0_0_0_1px_var(--border)]',
            className,
          )}
          style={{ bottom, ...style }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0, transition: fades.out } : { opacity: 0, y: -4, scale: 0.96, transition: fades.out }}
          transition={reduced ? fades.in : { default: springs.snappy, opacity: fades.in }}>
          <span className="relative grid size-[22px] place-items-center">
            {/* Dot size tracks the haptic's weight. */}
            <motion.span className="rounded-full bg-primary" initial={false}
              animate={{ width: 8 + ev.w * 2, height: 8 + ev.w * 2 }} transition={springs.bouncy} />
            <span key={ev.n} className="absolute inset-0 rounded-full [border:2px_solid_var(--primary)] animate-[blRing_.6s_ease-out_forwards] motion-reduce:hidden" />
          </span>
          <span>
            <span className="block [font-family:ui-monospace,Menlo,monospace] text-[11.5px] font-bold text-foreground"><TextMorph>{ev.label}</TextMorph></span>
            <span className="block [font-family:ui-monospace,Menlo,monospace] text-[9.5px] text-tertiary-foreground">{eng}</span>
          </span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
