import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { Icon } from '@/lib/icon';
import { fades, springs, useMotion } from '@/lib/motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { MeasureH } from '@/components/ui/measure-h';

/** The card: a centered dialog, or (`compact`) a bottom tray you can drag down. */
export const credenzaVariants = cva(
  'z-401 box-border overflow-hidden bg-card text-foreground shadow-[0_24px_80px_--alpha(black/34%),0_0_0_1px_var(--border)] outline-none',
  {
    variants: {
      compact: {
        true: 'absolute inset-x-2.5 bottom-2.5 touch-none rounded-[28px]',
        false: 'absolute top-1/2 left-1/2 w-[400px] max-w-[calc(100%-44px)] rounded-[24px]',
      },
    },
    defaultVariants: { compact: false },
  },
);

/* ══ Credenza — responsive dialog ⇄ tray with Family-style state morphing ══
   Desktop: centered dialog. Compact: floating bottom tray, drag-down to dismiss. The card springs its height to
   each view (tray spring); views travel in the direction of the flow — a new view arrives from the right, going
   back returns from the left — blurred through the middle; titles follow the same direction and the back
   chevron grows in and out of the header. Direction comes from the view history (a view seen before is "back").
   It is modal: opening moves focus onto the sheet (or onto a descendant marked `data-autofocus`), Tab cycles
   inside it, Escape closes only the Credenza (the key is stopped so a SplitView / NavigationStack behind it
   doesn't also pop), and closing returns focus to whatever had it before. */

const TABBABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

/** Open Credenzas, oldest first — only the last one traps focus. */
const STACK: object[] = [];

function tabbables(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter((el) => el.getClientRects().length > 0 && !el.closest('[inert],[aria-hidden="true"]'));
}

export interface CredenzaProps extends VariantProps<typeof credenzaVariants> {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  canBack?: boolean;
  /** Key of the current morphing view — changing it cross-fades and re-measures the body. */
  view?: string;
  title?: ReactNode;
  compact?: boolean | null;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Credenza({ open, onClose, onBack, canBack, view, title, compact, children, className, style }: CredenzaProps) {
  const FM = useMotion();
  const [h, setH] = useState<number | null>(null);
  const reduced = FM.useReducedMotion();
  // Direction of travel between views: revisiting a view in the trail is going back.
  const trail = useRef<string[]>([String(view)]);
  const dirRef = useRef<{ view: string; dir: number }>({ view: String(view), dir: 0 });
  if (dirRef.current.view !== String(view)) {
    const v = String(view), at = trail.current.indexOf(v);
    if (at >= 0) { trail.current = trail.current.slice(0, at + 1); dirRef.current = { view: v, dir: -1 }; }
    else { trail.current = [...trail.current, v]; dirRef.current = { view: v, dir: 1 }; }
  }
  const dir = reduced ? 0 : dirRef.current.dir;
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Modal focus. The Credenza is modal to its host (the positioned element it and its scrim fill), so focus
  // moves in on open, focus that lands elsewhere in the host is pulled back, and closing returns it to the
  // opener. Only the most recently opened Credenza enforces this. Escape or Tab while focus has fallen to
  // <body> (e.g. the focused row left with its view) still closes / re-enters. An instance mounted already open
  // (a page-load demo) only takes focus when the user was already working inside its host.
  const wasClosed = useRef(!open);
  useEffect(() => {
    if (!open) { wasClosed.current = true; return; }
    const token = {};
    STACK.push(token);
    const top = () => STACK[STACK.length - 1] === token;
    const opener = document.activeElement as HTMLElement | null;
    const host = () => sheetRef.current?.parentElement ?? null;
    const lost = (n: EventTarget | null) => !(n instanceof Node) || n === document.body || n === document.documentElement || n === document;
    const inside = (n: EventTarget | null) => n instanceof Node && !!sheetRef.current?.contains(n);
    const into = () => {
      const el = sheetRef.current;
      if (el) (el.querySelector<HTMLElement>('[data-autofocus]') ?? el).focus({ preventScroll: true });
    };
    // A view change unmounts the focused control, dropping focus to <body> — put it back on the sheet.
    const refocus = new MutationObserver(() => { if (top() && lost(document.activeElement) && sheetRef.current?.isConnected) into(); });
    let took = false;
    const raf = requestAnimationFrame(() => {
      took = wasClosed.current || !!(opener && host()?.contains(opener));
      if (took) into();
      if (took && sheetRef.current) refocus.observe(sheetRef.current, { childList: true, subtree: true });
    });
    const onFocusIn = (e: FocusEvent) => {
      if (top() && !inside(e.target) && e.target instanceof Node && host()?.contains(e.target)) into();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!top() || e.defaultPrevented || inside(e.target) || !(lost(e.target) || (e.target instanceof Node && host()?.contains(e.target)))) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(); }
      else if (e.key === 'Tab') { e.preventDefault(); into(); }
    };
    document.addEventListener('focusin', onFocusIn);
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      refocus.disconnect();
      STACK.splice(STACK.indexOf(token), 1);
      document.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('keydown', onKey);
      const active = document.activeElement;
      if (opener?.isConnected && !inside(opener) && (lost(active) || inside(active))) opener.focus({ preventScroll: true });
    };
  }, [open]);
  const onSheetKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(); return; }
    if (e.key !== 'Tab') return;
    const list = tabbables(e.currentTarget);
    if (!list.length) { e.preventDefault(); return; }
    const first = list[0], last = list[list.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || a === e.currentTarget)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  };
  const a11y = {
    ref: sheetRef, role: 'dialog', 'aria-modal': true, 'aria-labelledby': titleId, tabIndex: -1, onKeyDown: onSheetKeyDown,
  } as const;
  const circle = (icon: string, fn: (() => void) | undefined, label: string) => (
    <AriaButton onPress={fn} aria-label={label}
      className="bl-btn grid size-[30px] shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-secondary p-0 text-muted-foreground">
      <Icon name={icon} size={15} sw={2.6} />
    </AriaButton>
  );
  const m = FM.motion as any, AP = FM.AnimatePresence;
  const spring = reduced ? { duration: 0 } : springs.tray;
  const header = (
    <div className="relative z-2 flex items-center gap-2.5 px-[14px] pt-[14px] pb-1.5">
      <AP initial={false}>{canBack ? (
        <m.div key="bk" initial={{ opacity: 0, scale: .4, width: 0, marginRight: -10 }}
          animate={{ opacity: 1, scale: 1, width: 30, marginRight: 0 }} exit={{ opacity: 0, scale: .4, width: 0, marginRight: -10, transition: { ...springs.snappy, opacity: fades.out } }}
          transition={{ default: springs.snappy, opacity: fades.in }} className="grid shrink-0 place-items-center overflow-hidden">{circle('chevL', onBack, 'Back')}</m.div>
      ) : null}</AP>
      <div id={titleId} className="relative h-[26px] min-w-0 flex-1">
        <AP initial={false} custom={dir}>
          <m.div key={String(title)} custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 18, filter: 'blur(3px)' }),
              center: { opacity: 1, x: 0, filter: 'blur(0px)' },
              exit: (d: number) => ({ opacity: 0, x: d * -18, filter: 'blur(3px)', transition: { ...fades.out, x: springs.snappy } }),
            }}
            initial="enter" animate="center" exit="exit" transition={{ default: fades.in, x: springs.snappy }}
            className="absolute top-0 left-0 text-[18px] leading-[26px] font-bold tracking-[-.2px] whitespace-nowrap">{title}</m.div>
        </AP>
      </div>
      {circle('x', onClose, 'Close')}
    </div>
  );
  const body = (
    <m.div initial={false} animate={h == null ? {} : { height: h }} transition={spring} className="relative overflow-hidden">
      <AP initial={false} mode="popLayout" custom={dir}>
        <m.div key={String(view)} custom={dir}
          variants={{
            enter: (d: number) => ({ opacity: 0, x: d * 40, scale: d ? 1 : .97, filter: 'blur(6px)' }),
            center: { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' },
            exit: (d: number) => ({ opacity: 0, x: d * -40, scale: d ? 1 : .97, filter: 'blur(6px)', transition: { ...fades.out, x: springs.smooth } }),
          }}
          initial="enter" animate="center" exit="exit" transition={{ default: fades.in, x: springs.smooth, scale: springs.smooth }} className="w-full">
          <MeasureH onH={setH}>{children}</MeasureH>
        </m.div>
      </AP>
    </m.div>
  );
  return (
    <AP>
      {open ? <m.div key="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: .24 } }} transition={fades.in}
        className="absolute inset-0 z-400 bg-overlay" /> : null}
      {open ? (compact
        ? <m.div key="tray" data-slot="credenza" {...a11y} className={cn(credenzaVariants({ compact: true }), className)} initial={{ y: '112%' }} animate={{ y: '0%' }} exit={{ y: '118%' }} transition={spring}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: .02, bottom: .55 }}
            onDragEnd={(_ev: unknown, inf: any) => { if (inf.offset.y > 120 || inf.velocity.y > 500) closeRef.current(); }}
            style={style}>
            <div aria-hidden="true" className="absolute top-[7px] left-1/2 z-3 h-[5px] w-[38px] -translate-x-1/2 rounded-[3px] bg-secondary-strong" />
            {header}{body}
          </m.div>
        : <m.div key="dlg" data-slot="credenza" {...a11y}
            className={cn(credenzaVariants({ compact: false }), className)} initial={{ x: '-50%', y: '-45%', opacity: 0, scale: .95 }} animate={{ x: '-50%', y: '-50%', opacity: 1, scale: 1 }}
            exit={{ x: '-50%', y: '-48%', opacity: 0, scale: .97 }} transition={spring} style={style}>
            {header}{body}
          </m.div>) : null}
    </AP>
  );
}
