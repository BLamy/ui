import * as React from 'react';
import { cva } from 'class-variance-authority';
import { PlainButton } from './plain-button';
import { cn, pressable } from '../lib/utils';
import { Icon, type IconName } from '../lib/icon';

/** Square icon button: transparent until hovered, filled while `active`. */
export const iconButtonVariants = cva(cn(pressable, 'grid cursor-pointer place-items-center rounded-[7px] border-0 p-[5px] hover:bg-secondary!'), {
  variants: {
    active: {
      true: 'bg-secondary text-foreground',
      false: 'bg-transparent text-muted-foreground',
    },
  },
  defaultVariants: { active: false },
});

export interface IconButtonProps {
  /** An `Icon` name. */
  name: IconName | (string & {});
  label: string;
  onPress?: () => void;
  /** Glyph size in px. Default 18. */
  size?: number;
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function IconButton({ name, label, onPress, size, active, className, style }: IconButtonProps) {
  return (
    <PlainButton
      data-slot="icon-button"
      className={cn(iconButtonVariants({ active: !!active }), className)}
      onPress={onPress}
      aria-label={label}
      title={label}
      style={style}
    >
      <Icon name={name} size={size || 18} sw={1.7} />
    </PlainButton>
  );
}
