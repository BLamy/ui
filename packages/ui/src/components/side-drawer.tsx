import type { CSSProperties, ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '../lib/icon';
import { cn } from '../lib/utils';
import { EdgeDrawer } from './edge-drawer';

/* ══ SideDrawer — one panel, three hosts ══
   mode="fixed": docks as a column beside the detail view (extra-wide). mode="overlay": shadcn-style sheet from
   the right, scrim click dismisses (desktop/tablet) — an EdgeDrawer configuration. On phones, compose the same
   content as a pushed screen. */

/** The fixed column (its width springs between 0 and `width`). The overlay host is an EdgeDrawer. */
export const sideDrawerVariants = cva('', {
  variants: {
    mode: {
      fixed: 'w-(--side-drawer-w) shrink-0 overflow-hidden bg-background transition-[width] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
      overlay: 'absolute inset-0 z-350 pointer-events-none',
    },
  },
});

export interface SideDrawerProps extends VariantProps<typeof sideDrawerVariants> {
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
      <div data-slot="side-drawer" data-mode="fixed" aria-hidden={!open}
        className={cn(sideDrawerVariants({ mode }), open ? '[border-left:1px_solid_var(--border)]' : 'w-0', className)}
        style={{ '--side-drawer-w': width + 'px', ...style } as CSSProperties}>
        <div className="box-border flex h-full w-(--side-drawer-w) flex-col">{col}</div>
      </div>
    );
  }
  return (
    <div data-slot="side-drawer" data-mode="overlay" className={cn(sideDrawerVariants({ mode }), className)} style={style}>
      <EdgeDrawer side="right" open={open} onClose={onClose} zIndex={0} width={`min(${width}px, 88%)`}
        scrimClassName="bg-overlay"
        className={cn(
          'flex flex-col [border-left:1px_solid_var(--border)] bg-background data-[open=false]:translate-x-[106%]',
          open && 'shadow-[-16px_0_48px_black] shadow-black/25',
        )}>
        {col}
      </EdgeDrawer>
    </div>
  );
}
