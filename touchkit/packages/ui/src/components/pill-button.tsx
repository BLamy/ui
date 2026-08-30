import type { CSSProperties, ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { cn } from '../lib/utils';

export interface PillButtonProps {
  label: ReactNode;
  onPress?: () => void;
  tone?: 'tint' | 'soft';
  className?: string;
  style?: CSSProperties;
}

/** Full-width pill action button (prototype `PillBtn`). */
export function PillButton({ label, onPress, tone, className, style }: PillButtonProps) {
  return (
    <Button data-slot="pill-button" className={cn('tk-btn', className)} onPress={onPress} style={{
      width: '100%', border: 0, borderRadius: 14, padding: '13px 12px', fontSize: 16, fontWeight: 600,
      fontFamily: 'inherit', cursor: 'pointer', background: tone === 'soft' ? 'var(--tk-fill)' : 'var(--tk-tint)',
      color: tone === 'soft' ? 'var(--tk-label)' : '#fff', boxSizing: 'border-box', ...style,
    }}>{label}</Button>
  );
}
