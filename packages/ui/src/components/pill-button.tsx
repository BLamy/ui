import type { CSSProperties, ReactNode } from 'react';
import { Button } from './button';

export interface PillButtonProps {
  label: ReactNode;
  onPress?: () => void;
  tone?: 'tint' | 'soft';
  className?: string;
  style?: CSSProperties;
}

/** Full-width iOS action pill — `Button` at `size="pill"`. */
export function PillButton({ label, onPress, tone, className, style }: PillButtonProps) {
  return (
    <Button data-slot="pill-button" size="pill" variant={tone === 'soft' ? 'secondary' : 'default'} onPress={onPress} className={className} style={style}>
      {label}
    </Button>
  );
}
