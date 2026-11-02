'use client';
/* The toolbar's icon buttons (Interface Builder's): a plain button that shows its label as a tooltip and its state as
   a tint. */
import type { ReactNode } from 'react';
import { PlainButton } from '@/components/ui/plain-button';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

export function ToolButton({ icon, label, onPress, active, disabled, children, className }: {
  icon?: string; label: string; onPress?: () => void; active?: boolean; disabled?: boolean; children?: ReactNode; className?: string;
}) {
  return (
    <PlainButton
      aria-label={label}
      title={label}
      onPress={onPress}
      isDisabled={disabled}
      aria-pressed={active}
      className={cn(
        'grid h-8 min-w-8 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent px-1.5 text-muted-foreground outline-none',
        'hover:bg-secondary hover:text-foreground data-focus-visible:ring-2 data-focus-visible:ring-ring data-disabled:cursor-default data-disabled:opacity-35',
        active && 'bg-secondary text-primary',
        className,
      )}
    >
      {children ?? <Icon name={icon} size={18} sw={1.9} />}
    </PlainButton>
  );
}
