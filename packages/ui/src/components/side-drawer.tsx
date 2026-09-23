import type { CSSProperties, ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { Icon } from '../lib/icon';
import { cn } from '../lib/utils';

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
    <div className="flex shrink-0 items-center justify-between px-[14px] pt-[13px] pb-1.5">
      <span className="text-[16.5px] font-bold tracking-[-.2px] whitespace-nowrap">{title}</span>
      <AriaButton onPress={onClose} aria-label={'Close ' + title}
        className="bl-btn grid size-7 cursor-pointer place-items-center rounded-full border-0 bg-secondary p-0 text-muted-foreground">
        <Icon name="x" size={14} sw={2.6} />
      </AriaButton>
    </div>
  );
  const col = <>{head}<div className="bl-scroll min-h-0 flex-1 overflow-y-auto">{children}</div></>;
  if (mode === 'fixed') {
    return (
      <div data-slot="side-drawer" aria-hidden={!open}
        className={cn('shrink-0 overflow-hidden bg-background transition-[width] duration-340 ease-ios', open && '[border-left:1px_solid_var(--bl-sep)]', className)}
        style={{ width: open ? width : 0, ...style }}>
        <div className="box-border flex h-full flex-col" style={{ width }}>{col}</div>
      </div>
    );
  }
  return (
    <div data-slot="side-drawer" aria-hidden={!open}
      className={cn('absolute inset-0 z-350', open ? 'pointer-events-auto' : 'pointer-events-none', className)} style={style}>
      <div onClick={onClose} className={cn('absolute inset-0 bg-overlay transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')} />
      <div className={cn(
        'absolute inset-y-0 right-0 flex flex-col [border-left:1px_solid_var(--bl-sep)] bg-background transition-transform duration-340 ease-ios',
        open ? 'shadow-[-16px_0_48px_rgba(0,0,0,.25)]' : 'translate-x-[106%]',
      )} style={{ width: 'min(' + width + 'px, 88%)' }}>{col}</div>
    </div>
  );
}
