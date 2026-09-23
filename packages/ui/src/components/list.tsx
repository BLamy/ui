import {
  use, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { Haptics } from '../lib/haptics';
import { Icon } from '../lib/icon';
import { chromeOffset, BLStickyCtx, useChromeHidden } from '../lib/theme';
import { cn } from '../lib/utils';

/* ══ List primitives (prototype BLList / BLSection / BLRow) ══
   A list works out its own sticky offset: whatever chrome sits above it (nav bar, none, …) plus its own
   header if it has one. `stickyTop` overrides both. */

export interface ListProps {
  children?: ReactNode;
  inset?: boolean;
  header?: ReactNode;
  stickyTop?: number;
  className?: string;
  style?: CSSProperties;
}

function ListBase({ children, inset, header, stickyTop, className, style }: ListProps) {
  const hRef = useRef<HTMLDivElement | null>(null);
  const [hh, setHh] = useState(0);
  const above = use(BLStickyCtx);
  const chromeHid = useChromeHidden();
  useLayoutEffect(() => {
    const el = hRef.current;
    if (!el) { setHh(0); return; }
    const m = () => setHh(el.offsetHeight); m();
    if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect(); }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header]);
  const top = stickyTop != null ? stickyTop : above + (header ? hh : 0);
  return (
    <BLStickyCtx.Provider value={top}>
      <div data-slot="list" className={cn(inset ? 'px-4 py-0' : 'p-0', className)} style={style}>
        {header ? (
          <div ref={hRef} className="sticky z-24 bg-bl-stick backdrop-blur-[10px] transition-[top] duration-280 ease-ios"
            style={{ top: chromeOffset(above, chromeHid) }}>{header}</div>
        ) : null}
        {children}
      </div>
    </BLStickyCtx.Provider>
  );
}

export interface ListSectionProps {
  title?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  sticky?: boolean;
  innerRef?: (el: HTMLDivElement | null) => void;
  stickyTop?: number;
  className?: string;
  style?: CSSProperties;
}

export function ListSection({ title, footer, children, sticky, innerRef, stickyTop, className, style }: ListSectionProps) {
  const ctxTop = use(BLStickyCtx);
  const top = chromeOffset(stickyTop != null ? stickyTop : ctxTop, useChromeHidden());
  return (
    <div ref={innerRef} data-slot="list-section" className={cn(className)} style={style}>
      {title != null ? (sticky
        ? <div className="sticky z-20 bg-bl-stick px-4 py-[3px] text-[13.5px] font-semibold text-foreground backdrop-blur-[10px] transition-[top] duration-280 ease-ios"
            style={{ top }}>{title}</div>
        : <div className="px-4 pt-1 pb-[7px] text-[12.5px] font-medium tracking-[.4px] text-muted-foreground uppercase">{title}</div>) : null}
      <div className={cn('overflow-hidden', sticky ? 'rounded-none' : 'rounded-[12px]')}>{children}</div>
      {footer ? <div className="px-4 pt-[7px] pb-0 text-[12.8px] leading-[1.45] text-muted-foreground">{footer}</div> : null}
      <div className={sticky ? 'h-0' : 'h-[22px]'} />
    </div>
  );
}

const openRows = new Set<() => void>();

export interface ListRowProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  accessory?: 'chevron' | 'check';
  checked?: boolean;
  selected?: boolean;
  /** When defined (true/false), the row is in edit mode and reserves/animates the checkmark gutter. */
  edit?: boolean;
  onPress?: () => void;
  onDelete?: () => void;
  divider?: boolean;
  center?: boolean;
  destructive?: boolean;
  rowRole?: string;
  /** Return true to ignore swipe starts near an edge (e.g. under a back-gesture zone). */
  isEdge?: (clientX: number) => boolean;
  className?: string;
  style?: CSSProperties;
}

export function ListRow(p: ListRowProps) {
  const [px, setPx] = useState(0);
  const [anim, setAnim] = useState(true);
  const [dead, setDead] = useState(false);
  const el = useRef<any>(null); const g = useRef<any>(null); const me = useRef<any>(null);
  useEffect(() => { const close = () => setPx(0); me.current = close; openRows.add(close); return () => { openRows.delete(close); }; }, []);
  const closeOthers = () => openRows.forEach((f) => { if (f !== me.current) f(); });
  const del = () => {
    setAnim(true); setPx(-(el.current ? el.current.offsetWidth : 300)); setDead(true);
    Haptics.notification('warning'); setTimeout(() => p.onDelete && p.onDelete(), 300);
  };
  const start = (e: React.PointerEvent) => {
    if (!p.onDelete || p.edit || e.button) return;
    if (p.isEdge && p.isEdge(e.clientX)) return;
    g.current = { x0: e.clientX, y0: e.clientY, base: px, on: false, fired: false, nx: px };
  };
  const mv = (e: React.PointerEvent) => {
    const d = g.current; if (!d) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.on) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        d.on = true; closeOthers(); setAnim(false);
        try { el.current.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      } else if (Math.abs(dy) > 12) { g.current = null; return; }
      else return;
    }
    const w = el.current.offsetWidth;
    let nx = Math.min(0, d.base + dx); if (nx < -w * 0.92) nx = -w * 0.92;
    const commit = nx < -w * 0.55;
    if (commit && !d.fired) { d.fired = true; Haptics.impact('medium'); }
    else if (!commit && d.fired) { d.fired = false; Haptics.impact('light'); }
    d.nx = nx; setPx(nx);
  };
  const end = () => {
    const d = g.current; if (!d) return; g.current = null; if (!d.on) return;
    setAnim(true); const w = el.current.offsetWidth;
    if (d.nx < -w * 0.55) del();
    else if (d.nx < -64) setPx(-88);
    else setPx(0);
  };
  const press = () => {
    if (g.current && g.current.on) return;
    if (px < 0) { setPx(0); return; }
    p.onPress && p.onPress();
  };
  const inEdit = p.edit !== undefined && p.edit !== null;
  return (
    <div data-slot="list-row"
      className={cn('relative overflow-hidden [transition:max-height_.32s_ease,opacity_.28s]', dead ? 'max-h-0 opacity-0' : 'max-h-[200px] opacity-100', p.className)}
      style={p.style}>
      {p.onDelete && px < 0 ? (
        // The action strip and its label track the swipe offset.
        <div className="absolute inset-y-0 right-0 flex overflow-hidden" style={{ width: -px }}>
          <AriaButton onPress={del}
            className="bl-btn flex flex-1 cursor-pointer items-center justify-start border-0 bg-destructive [font-family:inherit] text-[15px] font-semibold text-white"
            style={{ paddingLeft: Math.max(14, (-px - 88) / 2 + 14) }}>Delete</AriaButton>
        </div>
      ) : null}
      <button ref={el} data-tkrow type="button" role={p.rowRole as any} aria-selected={p.rowRole ? (p.selected || p.checked || false) : undefined}
        className={cn(
          'bl-btn relative box-border flex min-h-[46px] w-full touch-pan-y items-center gap-3 border-0 px-4 py-0 text-left [font-family:inherit] text-[17px]',
          p.onPress && 'bl-hl',
          p.destructive ? 'text-destructive' : 'text-foreground',
          p.selected ? 'bg-accent' : 'bg-card',
          (p.onPress || p.onDelete) ? 'cursor-pointer' : 'cursor-default',
          anim ? '[transition:transform_.3s_cubic-bezier(.32,.72,0,1),background_.15s]' : '[transition:background_.15s]',
        )}
        onPointerDown={start} onPointerMove={mv} onPointerUp={end} onPointerCancel={end} onClick={press}
        // Swipe offset, driven by the gesture above.
        style={{ transform: `translateX(${px}px)` }}>
        {inEdit ? (
          <span aria-hidden="true" className={cn(
            'flex shrink-0 items-center overflow-hidden [transition:width_.25s_cubic-bezier(.32,.72,0,1),opacity_.2s,margin-right_.25s]',
            p.edit ? 'mr-0 w-[30px] opacity-100' : '-mr-3 w-0 opacity-0',
          )}>
            <span className={cn(
              'box-border grid size-[22px] shrink-0 place-items-center rounded-[50%] [transition:background_.15s]',
              p.checked ? 'border-none bg-primary' : '[border:1.6px_solid_var(--bl-label3)] bg-transparent',
            )}>
              {p.checked ? <Icon name="check" size={13} sw={3} className="text-white" /> : null}
            </span>
          </span>
        ) : null}
        {p.leading || null}
        <div className={cn(
          'flex min-h-[46px] min-w-0 flex-1 items-center gap-2.5 px-0 py-[7px]',
          p.divider !== false && '[box-shadow:inset_0_-1px_0_var(--bl-sep)]',
          p.center ? 'justify-center' : 'justify-start',
        )}>
          <div className={cn('min-w-0', p.center ? 'flex-none' : 'flex-1')}>
            <div className="truncate leading-[1.3]">{p.title}</div>
            {p.subtitle ? <div className="mt-px truncate text-[13px] text-muted-foreground">{p.subtitle}</div> : null}
          </div>
          {p.trailing || null}
          {p.accessory === 'chevron' ? <Icon name="chev" size={15} sw={2.6} className="text-bl-label3" />
            : p.accessory === 'check' ? <span className="w-[22px] shrink-0">{p.checked ? <Icon name="check" size={20} sw={2.4} className="text-primary" /> : null}</span>
            : null}
        </div>
      </button>
    </div>
  );
}

/** Compound list API: `List`, `List.Section`, `List.Row` (also exported flat as ListSection / ListRow). */
export const List = Object.assign(ListBase, { Section: ListSection, Row: ListRow });
