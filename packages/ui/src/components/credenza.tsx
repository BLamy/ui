import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
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
    <AriaButton onPress={fn} aria-label={label}
      className="bl-btn grid size-[30px] shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-secondary p-0 text-muted-foreground">
      <Icon name={icon} size={15} sw={2.6} />
    </AriaButton>
  );
  const card = 'box-border overflow-hidden bg-card text-foreground shadow-[0_24px_80px_rgba(0,0,0,.34),0_0_0_1px_var(--bl-sep)]';
  const m = FM.motion as any, AP = FM.AnimatePresence;
  const spring = { type: 'spring', stiffness: 520, damping: 44, mass: 1 } as const;
  const header = (
    <div className="relative z-2 flex items-center gap-2.5 px-[14px] pt-[14px] pb-1.5">
      <AP initial={false}>{canBack ? (
        <m.div key="bk" initial={{ opacity: 0, scale: .4, width: 0, marginRight: -10 }}
          animate={{ opacity: 1, scale: 1, width: 30, marginRight: 0 }} exit={{ opacity: 0, scale: .4, width: 0, marginRight: -10 }}
          transition={{ duration: .2 }} className="grid shrink-0 place-items-center overflow-hidden">{circle('chevL', onBack, 'Back')}</m.div>
      ) : null}</AP>
      <div className="relative h-[26px] min-w-0 flex-1">
        <AP initial={false}>
          <m.div key={String(title)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .17 }}
            className="absolute top-0 left-0 text-[18px] leading-[26px] font-bold tracking-[-.2px] whitespace-nowrap">{title}</m.div>
        </AP>
      </div>
      {circle('x', onClose, 'Close')}
    </div>
  );
  const body = (
    <m.div initial={false} animate={h == null ? {} : { height: h }} transition={spring} className="relative overflow-hidden">
      <AP initial={false} mode="popLayout">
        <m.div key={String(view)} initial={{ opacity: 0, scale: .97, filter: 'blur(6px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: .97, filter: 'blur(6px)' }} transition={{ duration: .21, ease: 'easeOut' }} className="w-full">
          <MeasureH onH={setH}>{children}</MeasureH>
        </m.div>
      </AP>
    </m.div>
  );
  return (
    <AP>
      {open ? <m.div key="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .24 }}
        className="absolute inset-0 z-400 bg-overlay" /> : null}
      {open ? (compact
        ? <m.div key="tray" data-slot="credenza" className={cn(card, 'absolute inset-x-2.5 bottom-2.5 z-401 touch-none rounded-[28px]', className)} initial={{ y: '112%' }} animate={{ y: '0%' }} exit={{ y: '118%' }} transition={spring}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: .02, bottom: .55 }}
            onDragEnd={(_ev: unknown, inf: any) => { if (inf.offset.y > 120 || inf.velocity.y > 500) { Haptics.impact('light'); closeRef.current(); } }}
            style={style}>
            <div aria-hidden="true" className="absolute top-[7px] left-1/2 z-3 h-[5px] w-[38px] -translate-x-1/2 rounded-[3px] bg-bl-fill2" />
            {header}{body}
          </m.div>
        : <m.div key="dlg" data-slot="credenza"
            className={cn(card, 'absolute top-1/2 left-1/2 z-401 w-[400px] max-w-[calc(100%-44px)] rounded-[24px]', className)} initial={{ x: '-50%', y: '-45%', opacity: 0, scale: .95 }} animate={{ x: '-50%', y: '-50%', opacity: 1, scale: 1 }}
            exit={{ x: '-50%', y: '-48%', opacity: 0, scale: .97 }} transition={spring} style={style}>
            {header}{body}
          </m.div>) : null}
    </AP>
  );
}
