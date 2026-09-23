import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/utils';

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
      <div data-slot="split-view" className={cn('flex h-full', className)} style={style}>
        <div className="w-[264px] shrink-0 [border-right:1px_solid_var(--bl-sep)] bg-bl-side transition-[background] duration-250">{sidebar}</div>
        <div className="relative w-[370px] shrink-0 [border-right:1px_solid_var(--bl-sep)] bg-background">{master}</div>
        <div className="relative min-w-0 flex-1 bg-muted">{detail}</div>
      </div>
    );
  }
  return (
    <div data-slot="split-view" className={cn('absolute inset-0 overflow-hidden', className)} style={style}>
      <div className="absolute inset-0">{master}</div>
      <div onClick={onCloseDrawer}
        className={cn('absolute inset-0 z-300 bg-overlay transition-opacity duration-300', drawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0')} />
      <div className={cn(
        'absolute inset-y-0 left-0 z-301 w-[300px] bg-card transition-transform duration-340 ease-ios',
        drawerOpen ? 'translate-x-0 shadow-[12px_0_40px_rgba(0,0,0,.22)]' : '-translate-x-[105%]',
      )}>{sidebar}</div>
    </div>
  );
}
