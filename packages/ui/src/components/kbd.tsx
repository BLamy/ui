import type { ComponentProps } from 'react';
import { Keyboard } from 'react-aria-components';
import { cn } from '../lib/utils';

/* ══ Kbd — keycap. react-aria's Keyboard, so inside a menu item it becomes the item's shortcut slot. ══ */
export function Kbd({ className, ...props }: ComponentProps<typeof Keyboard>) {
  return (
    <Keyboard
      data-slot="kbd"
      className={cn(
        'pointer-events-none box-border inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-[5px] bg-bl-fill px-1.5 font-ios text-[12px] leading-none font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--bl-sep)] select-none [&_svg]:size-3',
        className,
      )}
      {...props}
    />
  );
}

export function KbdGroup({ className, ...props }: ComponentProps<'span'>) {
  return <span data-slot="kbd-group" className={cn('inline-flex items-center gap-1', className)} {...props} />;
}
