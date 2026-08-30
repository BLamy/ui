import type { CSSProperties } from 'react';
import { cn } from '../lib/utils';

export interface SpinnerProps {
  spin?: boolean;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Spinner({ spin, size, className, style }: SpinnerProps) {
  size = size || 22;
  return (
    <svg data-slot="spinner" className={cn(className)} width={size} height={size} viewBox="0 0 24 24"
      style={{ display: 'block', animation: spin ? 'tkSpin .75s steps(8) infinite' : 'none', ...style }} aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x="11.1" y="2.8" width="1.8" height="5.2" rx="0.9" fill="currentColor" opacity={(i + 1) / 8} transform={`rotate(${i * 45} 12 12)`} />
      ))}
    </svg>
  );
}
