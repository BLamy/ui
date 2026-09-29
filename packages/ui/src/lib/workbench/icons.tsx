import * as React from 'react';
import { cva } from 'class-variance-authority';
import { Button } from './press';
import { cn, wbPress } from './util';
import { Icon, type IconName } from '../icon';

/** Square icon button: transparent until hovered, filled while `active`. */
export const iconBtnVariants = cva(cn(wbPress, 'grid cursor-pointer place-items-center rounded-[7px] border-0 p-[5px] hover:bg-secondary!'), {
  variants: {
    active: {
      true: 'bg-secondary text-foreground',
      false: 'bg-transparent text-muted-foreground',
    },
  },
  defaultVariants: { active: false },
});

export interface IconBtnProps {
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
export function IconBtn({ name, label, onPress, size, active, className, style }: IconBtnProps) {
  return (
    <Button
      data-slot="icon-btn"
      className={cn(iconBtnVariants({ active: !!active }), className)}
      onPress={onPress}
      aria-label={label}
      title={label}
      style={style}
    >
      <Icon name={name} size={size || 18} sw={1.7} />
    </Button>
  );
}
