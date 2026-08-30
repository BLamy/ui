import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Haptics } from '../lib/haptics';
import { Icon } from '../lib/icon';
import { useMotion } from '../lib/motion';
import { cn } from '../lib/utils';
import { MeasureH } from './measure-h';

/* ══ Credenza — responsive dialog ⇄ tray with Family-style state morphing ══
   Desktop: centered dialog. Compact: floating bottom tray, drag-down to dismiss. The card spring-animates its
   height to each view; views cross through with scale + blur; titles and the back chevron morph in place. */

export interface CredenzaProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  canBack?: boolean;
  /** Key of the current morphing view — changing it cross-fades and re-measures the body. */
  view?: string;
  title?: ReactNode;
  compact?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Credenza({ open, onClose, onBack, canBack, view, title, compact, children, className, style }: CredenzaProps) {
  const FM = useMotion();
  const [h, setH] = useState<number | null>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open]);
  const circle = (icon: string, fn: (() => void) | undefined, label: string) => (
    <button className="tk-btn" onClick={fn} aria-label={label}
      style={{
        width: 30, height: 30, borderRadius: '50%', border: 0, background: 'var(--tk-fill)', color: 'var(--tk-label2)',
        display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0, padding: 0,
      }}><Icon name={icon} size={15} sw={2.6} /></button>
  );
  const card: CSSProperties = {
    background: 'var(--tk-card)', color: 'var(--tk-label)', overflow: 'hidden', boxSizing: 'border-box',
    boxShadow: '0 24px 80px rgba(0,0,0,.34), 0 0 0 1px var(--tk-sep)', ...style,
  };
  const trayPos: CSSProperties = { position: 'absolute', left: 10, right: 10, bottom: 10, borderRadius: 28, zIndex: 401 };
  const dlgPos: CSSProperties = { position: 'absolute', left: '50%', top: '50%', width: 400, maxWidth: 'calc(100% - 44px)', borderRadius: 24, zIndex: 401 };
  const m = FM.motion as any, AP = FM.AnimatePresence;
  const spring = { type: 'spring', stiffness: 520, damping: 44, mass: 1 } as const;
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px 6px', position: 'relative', zIndex: 2 }}>
      <AP initial={false}>{canBack ? (
        <m.div key="bk" initial={{ opacity: 0, scale: .4, width: 0, marginRight: -10 }}
          animate={{ opacity: 1, scale: 1, width: 30, marginRight: 0 }} exit={{ opacity: 0, scale: .4, width: 0, marginRight: -10 }}
          transition={{ duration: .2 }} style={{ display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>{circle('chevL', onBack, 'Back')}</m.div>
      ) : null}</AP>
      <div style={{ position: 'relative', flex: 1, height: 26, minWidth: 0 }}>
        <AP initial={false}>
          <m.div key={String(title)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .17 }}
            style={{ position: 'absolute', left: 0, top: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-.2px', whiteSpace: 'nowrap', lineHeight: '26px' }}>{title}</m.div>
        </AP>
      </div>
      {circle('x', onClose, 'Close')}
    </div>
  );
  const body = (
    <m.div initial={false} animate={h == null ? {} : { height: h }} transition={spring} style={{ overflow: 'hidden', position: 'relative' }}>
      <AP initial={false} mode="popLayout">
        <m.div key={String(view)} initial={{ opacity: 0, scale: .97, filter: 'blur(6px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: .97, filter: 'blur(6px)' }} transition={{ duration: .21, ease: 'easeOut' }} style={{ width: '100%' }}>
          <MeasureH onH={setH}>{children}</MeasureH>
        </m.div>
      </AP>
    </m.div>
  );
  return (
    <AP>
      {open ? <m.div key="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .24 }}
        style={{ position: 'absolute', inset: 0, background: 'var(--tk-scrim)', zIndex: 400 }} /> : null}
      {open ? (compact
        ? <m.div key="tray" data-slot="credenza" className={cn(className)} initial={{ y: '112%' }} animate={{ y: '0%' }} exit={{ y: '118%' }} transition={spring}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: .02, bottom: .55 }}
            onDragEnd={(_ev: unknown, inf: any) => { if (inf.offset.y > 120 || inf.velocity.y > 500) { Haptics.impact('light'); closeRef.current(); } }}
            style={{ ...card, ...trayPos, touchAction: 'none' }}>
            <div aria-hidden="true" style={{ position: 'absolute', top: 7, left: '50%', transform: 'translateX(-50%)', width: 38, height: 5, borderRadius: 3, background: 'var(--tk-fill2)', zIndex: 3 }} />
            {header}{body}
          </m.div>
        : <m.div key="dlg" data-slot="credenza" className={cn(className)} initial={{ x: '-50%', y: '-45%', opacity: 0, scale: .95 }} animate={{ x: '-50%', y: '-50%', opacity: 1, scale: 1 }}
            exit={{ x: '-50%', y: '-48%', opacity: 0, scale: .97 }} transition={spring} style={{ ...card, ...dlgPos }}>
            {header}{body}
          </m.div>) : null}
    </AP>
  );
}
