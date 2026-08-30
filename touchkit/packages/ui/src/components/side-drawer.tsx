import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../lib/icon';
import { cn, EASE } from '../lib/utils';

/* ══ SideDrawer — one panel, three hosts ══
   mode="fixed": docks as a column beside the detail view (extra-wide). mode="overlay": shadcn-style sheet from
   the right, scrim click dismisses (desktop/tablet). On phones, compose the same content as a pushed screen. */

export interface SideDrawerProps {
  mode: 'fixed' | 'overlay';
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  width?: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function SideDrawer({ mode, open, onClose, title, width, children, className, style }: SideDrawerProps) {
  width = width || 320;
  const head = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px 6px', flexShrink: 0 }}>
      <span style={{ fontSize: 16.5, fontWeight: 700, letterSpacing: '-.2px', whiteSpace: 'nowrap' }}>{title}</span>
      <button className="tk-btn" onClick={onClose} aria-label={'Close ' + title} style={{
        border: 0, background: 'var(--tk-fill)', width: 28, height: 28,
        borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--tk-label2)', padding: 0,
      }}><Icon name="x" size={14} sw={2.6} /></button>
    </div>
  );
  const col = <>{head}<div className="tk-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{children}</div></>;
  if (mode === 'fixed') {
    return (
      <div data-slot="side-drawer" className={cn(className)} aria-hidden={!open} style={{
        width: open ? width : 0, flexShrink: 0, overflow: 'hidden', transition: 'width .34s ' + EASE,
        borderLeft: open ? '1px solid var(--tk-sep)' : 'none', background: 'var(--tk-bg)', ...style,
      }}>
        <div style={{ width, height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>{col}</div>
      </div>
    );
  }
  return (
    <div data-slot="side-drawer" className={cn(className)} aria-hidden={!open} style={{ position: 'absolute', inset: 0, zIndex: 350, pointerEvents: open ? 'auto' : 'none', ...style }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--tk-scrim)', opacity: open ? 1 : 0, transition: 'opacity .3s' }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, right: 0, width: 'min(' + width + 'px, 88%)', display: 'flex', flexDirection: 'column',
        background: 'var(--tk-bg)', borderLeft: '1px solid var(--tk-sep)', boxShadow: open ? '-16px 0 48px rgba(0,0,0,.25)' : 'none',
        transform: open ? 'none' : 'translateX(106%)', transition: 'transform .34s ' + EASE,
      }}>{col}</div>
    </div>
  );
}
