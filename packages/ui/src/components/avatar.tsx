import type { CSSProperties } from 'react';
import { cn } from '../lib/utils';

const hue = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };

export interface AvatarProps {
  /** Contact-like record: `f` first name, `l` last name. */
  c: { f: string; l: string };
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Avatar({ c, size, className, style }: AvatarProps) {
  size = size || 40; const h = hue(c.f + c.l);
  return (
    <span data-slot="avatar" className={cn(className)} style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
      background: `linear-gradient(180deg, hsl(${h} 62% 64%), hsl(${h} 55% 47%))`, color: '#fff',
      fontSize: size * 0.38, fontWeight: 600, letterSpacing: '.5px', userSelect: 'none', ...style,
    }}>{c.f[0]}{c.l[0]}</span>
  );
}
