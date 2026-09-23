import {
  use, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { Haptics } from '../lib/haptics';
import { Icon } from '../lib/icon';
import { chromeOffset, BLStickyCtx, useChromeHidden } from '../lib/theme';
import { cn, EASE } from '../lib/utils';

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
      <div data-slot="list" className={cn(className)} style={{ padding: inset ? '0 16px' : 0, ...style }}>
        {header ? (
          <div ref={hRef} style={{
            position: 'sticky', top: chromeOffset(above, chromeHid), zIndex: 24, background: 'var(--bl-stick)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', transition: 'top .28s ' + EASE,
          }}>{header}</div>
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
        ? <div style={{
            position: 'sticky', top, zIndex: 20, padding: '3px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--bl-label)',
            background: 'var(--bl-stick)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', transition: 'top .28s ' + EASE,
          }}>{title}</div>
        : <div style={{ padding: '4px 16px 7px', fontSize: 12.5, fontWeight: 500, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--bl-label2)' }}>{title}</div>) : null}
      <div style={{ borderRadius: sticky ? 0 : 12, overflow: 'hidden' }}>{children}</div>
      {footer ? <div style={{ padding: '7px 16px 0', fontSize: 12.8, lineHeight: 1.45, color: 'var(--bl-label2)' }}>{footer}</div> : null}
      <div style={{ height: sticky ? 0 : 22 }} />
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
    <div data-slot="list-row" className={cn(p.className)} style={{ position: 'relative', overflow: 'hidden', maxHeight: dead ? 0 : 200, opacity: dead ? 0 : 1, transition: 'max-height .32s ease, opacity .28s', ...p.style }}>
      {p.onDelete && px < 0 ? (
        <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: -px, display: 'flex', overflow: 'hidden' }}>
          <button className="bl-btn" onClick={del} style={{
            flex: 1, border: 0, background: 'var(--bl-red)', color: '#fff', fontSize: 15, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: Math.max(14, (-px - 88) / 2 + 14),
          }}>Delete</button>
        </div>
      ) : null}
      <button ref={el} data-tkrow type="button" role={p.rowRole as any} aria-selected={p.rowRole ? (p.selected || p.checked || false) : undefined}
        className={'bl-btn' + (p.onPress ? ' bl-hl' : '')}
        onPointerDown={start} onPointerMove={mv} onPointerUp={end} onPointerCancel={end} onClick={press}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 46, padding: '0 16px', border: 0, textAlign: 'left',
          fontFamily: 'inherit', fontSize: 17, color: p.destructive ? 'var(--bl-red)' : 'var(--bl-label)',
          background: p.selected ? 'var(--bl-press)' : 'var(--bl-card)', cursor: (p.onPress || p.onDelete) ? 'pointer' : 'default',
          transform: `translateX(${px}px)`, transition: (anim ? 'transform .3s ' + EASE + ', ' : '') + 'background .15s',
          touchAction: 'pan-y', position: 'relative', boxSizing: 'border-box',
        }}>
        {inEdit ? (
          <span aria-hidden="true" style={{
            width: p.edit ? 30 : 0, marginRight: p.edit ? 0 : -12, opacity: p.edit ? 1 : 0, overflow: 'hidden',
            display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'width .25s ' + EASE + ', opacity .2s, margin-right .25s',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', boxSizing: 'border-box', flexShrink: 0,
              border: p.checked ? 'none' : '1.6px solid var(--bl-label3)', background: p.checked ? 'var(--bl-tint)' : 'transparent',
              display: 'grid', placeItems: 'center', transition: 'background .15s',
            }}>
              {p.checked ? <Icon name="check" size={13} sw={3} style={{ color: '#fff' }} /> : null}
            </span>
          </span>
        ) : null}
        {p.leading || null}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, minHeight: 46, padding: '7px 0',
          boxShadow: p.divider === false ? 'none' : 'inset 0 -1px 0 var(--bl-sep)', justifyContent: p.center ? 'center' : 'flex-start',
        }}>
          <div style={{ flex: p.center ? 'none' : 1, minWidth: 0 }}>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3 }}>{p.title}</div>
            {p.subtitle ? <div style={{ fontSize: 13, color: 'var(--bl-label2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{p.subtitle}</div> : null}
          </div>
          {p.trailing || null}
          {p.accessory === 'chevron' ? <Icon name="chev" size={15} sw={2.6} style={{ color: 'var(--bl-label3)' }} />
            : p.accessory === 'check' ? <span style={{ width: 22, flexShrink: 0 }}>{p.checked ? <Icon name="check" size={20} sw={2.4} style={{ color: 'var(--bl-tint)' }} /> : null}</span>
            : null}
        </div>
      </button>
    </div>
  );
}

/** Compound list API: `List`, `List.Section`, `List.Row` (also exported flat as ListSection / ListRow). */
export const List = Object.assign(ListBase, { Section: ListSection, Row: ListRow });
