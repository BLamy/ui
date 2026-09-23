import type { CSSProperties } from 'react';
import { cn } from '../lib/utils';

export interface SpinnerProps {
  spin?: boolean;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/** iOS activity indicator: eight fading spokes, stepped rotation. */
export function Spinner({ spin, size = 22, className, style }: SpinnerProps) {
  return (
    <svg data-slot="spinner" className={cn('block', spin && 'animate-[blSpin_.75s_steps(8)_infinite]', className)}
      width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x="11.1" y="2.8" width="1.8" height="5.2" rx="0.9" fill="currentColor" opacity={(i + 1) / 8} transform={`rotate(${i * 45} 12 12)`} />
      ))}
    </svg>
  );
}
