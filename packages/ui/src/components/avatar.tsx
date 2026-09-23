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
    <span data-slot="avatar"
      className={cn('grid shrink-0 place-items-center rounded-full font-semibold tracking-[.5px] text-white select-none', className)}
      // Size and the name-hashed gradient are computed per render.
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(180deg, hsl(${h} 62% 64%), hsl(${h} 55% 47%))`, ...style }}
    >{c.f[0]}{c.l[0]}</span>
  );
}
