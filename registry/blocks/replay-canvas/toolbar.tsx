'use client';
/* The toolbar's icon buttons (Interface Builder's): a plain button that shows its label as a tooltip, and the same
   button as a UI SDK Toggle (`aria-pressed`) that tints while pressed, for the panes and layers it shows or hides. */
import type { ReactNode } from 'react';
import { PlainButton, PlainToggleButton } from '@/components/ui/plain-button';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

const tool = cn(
  'grid h-8 min-w-8 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent px-1.5 text-muted-foreground outline-none',
  'hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:cursor-default data-disabled:opacity-35',
);

export function ToolButton({ icon, label, onClick, disabled, children, className }: {
  icon?: string; label: string; onClick?: () => void; disabled?: boolean; children?: ReactNode; className?: string;
}) {
  return (
    <PlainButton aria-label={label} title={label} onClick={onClick} disabled={disabled} className={cn(tool, className)}>
      {children ?? <Icon name={icon} size={18} sw={1.9} />}
    </PlainButton>
  );
}

export function ToolToggle({ icon, label, pressed, onPressedChange, disabled, children, className }: {
  icon?: string; label: string; pressed: boolean; onPressedChange: (pressed: boolean) => void; disabled?: boolean; children?: ReactNode; className?: string;
}) {
  return (
    <PlainToggleButton
      aria-label={label} title={label} pressed={pressed} onPressedChange={onPressedChange} disabled={disabled}
      className={cn(tool, 'data-pressed:bg-secondary data-pressed:text-primary', className)}
    >
      {children ?? <Icon name={icon} size={18} sw={1.9} />}
    </PlainToggleButton>
  );
}
