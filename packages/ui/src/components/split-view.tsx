import type { CSSProperties, ReactNode } from 'react';
import { cn, EASE } from '../lib/utils';

export interface SplitViewProps {
  /** Width class: 'regular' shows all columns; anything else collapses to master + drawer. */
  wc: 'regular' | 'medium' | 'compact' | (string & {});
  sidebar?: ReactNode;
  master?: ReactNode;
  detail?: ReactNode;
  drawerOpen?: boolean;
  onCloseDrawer?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function SplitView({ wc, sidebar, master, detail, drawerOpen, onCloseDrawer, className, style }: SplitViewProps) {
  if (wc === 'regular') {
    return (
      <div data-slot="split-view" className={cn(className)} style={{ display: 'flex', height: '100%', ...style }}>
        <div style={{ width: 264, flexShrink: 0, borderRight: '1px solid var(--tk-sep)', background: 'var(--tk-side)', transition: 'background .25s' }}>{sidebar}</div>
        <div style={{ width: 370, flexShrink: 0, borderRight: '1px solid var(--tk-sep)', position: 'relative', background: 'var(--tk-bg)' }}>{master}</div>
        <div style={{ flex: 1, position: 'relative', background: 'var(--tk-bg2)', minWidth: 0 }}>{detail}</div>
      </div>
    );
  }
  return (
    <div data-slot="split-view" className={cn(className)} style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>
      <div style={{ position: 'absolute', inset: 0 }}>{master}</div>
      <div onClick={onCloseDrawer} style={{
        position: 'absolute', inset: 0, background: 'var(--tk-scrim)', opacity: drawerOpen ? 1 : 0,
        pointerEvents: drawerOpen ? 'auto' : 'none', transition: 'opacity .3s', zIndex: 300,
      }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, width: 300, background: 'var(--tk-card)', zIndex: 301,
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-105%)', transition: 'transform .34s ' + EASE,
        boxShadow: drawerOpen ? '12px 0 40px rgba(0,0,0,.22)' : 'none',
      }}>{sidebar}</div>
    </div>
  );
}
