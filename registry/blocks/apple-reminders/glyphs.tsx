/* SF Symbols-style glyphs for Reminders on a 24px grid (`f` fills, the rest are round-capped strokes), and the
   colored circle every list and smart list leads with. */
import type { CSSProperties } from 'react';
import { cn } from '@brett_lamy/ui';
import { TODAY_NUMBER } from './data';

type Shape = { d?: string; c?: [number, number, number]; f?: 1 };

const G = {
  bullets: [{ c: [5.5, 7, 1.5], f: 1 }, { c: [5.5, 12, 1.5], f: 1 }, { c: [5.5, 17, 1.5], f: 1 }, { d: 'M10 7h9.5M10 12h9.5M10 17h9.5' }],
  house: [{ d: 'M3.6 11.4L12 4l8.4 7.4', }, { d: 'M6 9.6v9.2c0 .7.5 1.2 1.2 1.2h3.3v-5.4h3v5.4h3.3c.7 0 1.2-.5 1.2-1.2V9.6', f: 1 }],
  briefcase: [{ d: 'M3.8 8.8c0-.8.6-1.4 1.4-1.4h13.6c.8 0 1.4.6 1.4 1.4v9c0 .8-.6 1.4-1.4 1.4H5.2c-.8 0-1.4-.6-1.4-1.4z', f: 1 }, { d: 'M9 7.4V5.6c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v1.8' }],
  cart: [{ d: 'M3 4h2.4l2.2 10.4c.1.6.7 1 1.3 1h8.6c.6 0 1.1-.4 1.3-1L20.4 8H6.4' }, { c: [9.5, 19, 1.5], f: 1 }, { c: [17, 19, 1.5], f: 1 }],
  airplane: [{ d: 'M10.4 3.6c0-1 .7-1.6 1.6-1.6s1.6.6 1.6 1.6v5.6l7.4 4.4v2l-7.4-2.3v4.9l2 1.5V21l-3.6-1-3.6 1v-1.3l2-1.5v-4.9L3 15.6v-2l7.4-4.4z', f: 1 }],
  book: [{ d: 'M12 6.4C10.2 5 7.8 4.4 4.4 4.6v13.2c3.4-.2 5.8.4 7.6 1.8 1.8-1.4 4.2-2 7.6-1.8V4.6c-3.4-.2-5.8.4-7.6 1.8zM12 6.4v13.2' }],
  gift: [{ d: 'M4 9.4h16v3.2H4zM5.4 12.6h13.2v7H5.4zM12 9.4v10.2' }, { d: 'M12 9.4c-1-3-4.8-4-5-1.8-.1 1.4 2 1.8 5 1.8zM12 9.4c1-3 4.8-4 5-1.8.1 1.4-2 1.8-5 1.8z' }],
  heart: [{ d: 'M12 19.6s-7.6-4.6-7.6-10a4.3 4.3 0 0 1 7.6-2.7 4.3 4.3 0 0 1 7.6 2.7c0 5.4-7.6 10-7.6 10z', f: 1 }],
  star: [{ d: 'M12 3.8l2.4 5 5.4.7-4 3.8 1 5.4L12 16l-4.8 2.7 1-5.4-4-3.8 5.4-.7z', f: 1 }],
  calendar: [{ d: 'M4.2 6.6c0-.9.7-1.6 1.6-1.6h12.4c.9 0 1.6.7 1.6 1.6v11.8c0 .9-.7 1.6-1.6 1.6H5.8c-.9 0-1.6-.7-1.6-1.6z', f: 1 }, { d: 'M8.4 3v3.4M15.6 3v3.4' }],
  calendarDay: [{ d: 'M4.2 6.6c0-.9.7-1.6 1.6-1.6h12.4c.9 0 1.6.7 1.6 1.6v11.8c0 .9-.7 1.6-1.6 1.6H5.8c-.9 0-1.6-.7-1.6-1.6z' }, { d: 'M4.2 9.4h15.6', f: 1 }],
  tray: [{ d: 'M3.6 13.4l2.2-7.6c.2-.6.7-1 1.3-1h9.8c.6 0 1.1.4 1.3 1l2.2 7.6v4.8c0 .8-.6 1.4-1.4 1.4H5c-.8 0-1.4-.6-1.4-1.4z', f: 1 }],
  flag: [{ d: 'M5.6 21V4.2', }, { d: 'M5.6 4.2h11.8l-2.4 4.4 2.4 4.4H5.6z', f: 1 }],
  flagOutline: [{ d: 'M5.6 21V4.2h11.8l-2.4 4.4 2.4 4.4H5.6' }],
  check: [{ d: 'M5.4 12.6l4.3 4.3 8.9-9.4' }],
  info: [{ c: [12, 12, 8.8] }, { d: 'M12 11v5.4' }, { c: [12, 7.8, .7], f: 1 }],
  plus: [{ d: 'M12 5v14M5 12h14' }],
  plusCircle: [{ c: [12, 12, 9.4], f: 1 }],
  ellipsis: [{ c: [12, 12, 9.4] }, { c: [7.8, 12, 1.2], f: 1 }, { c: [12, 12, 1.2], f: 1 }, { c: [16.2, 12, 1.2], f: 1 }],
  clock: [{ c: [12, 12, 8.4] }, { d: 'M12 7.4V12l3.2 2' }],
  link: [{ d: 'M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.9-2.9a3.6 3.6 0 0 0-5.1-5.1l-1.2 1.2M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.9 2.9a3.6 3.6 0 0 0 5.1 5.1l1.2-1.2' }],
  exclaim: [{ d: 'M12 4.5v10' }, { c: [12, 19, 1.4], f: 1 }],
  chevron: [{ d: 'M9 5.5l6.5 6.5L9 18.5' }],
  search: [{ c: [10.6, 10.6, 6] }, { d: 'M15.2 15.2l5 5' }],
} satisfies Record<string, Shape[]>;

export type GlyphName = keyof typeof G;

export function Glyph({ name, size = 20, sw = 1.9, className, style }: { name: GlyphName; size?: number; sw?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={cn('block shrink-0', className)} style={style}>
      {(G[name] as Shape[]).map((s, i) => s.c
        ? <circle key={i} cx={s.c[0]} cy={s.c[1]} r={s.c[2]} fill={s.f ? 'currentColor' : 'none'} stroke={s.f ? 'none' : 'currentColor'} strokeWidth={sw} />
        : <path key={i} d={s.d} fill={s.f ? 'currentColor' : 'none'} stroke={s.f ? 'none' : 'currentColor'} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />)}
      {name === 'calendarDay'
        ? <text x="12" y="17.6" textAnchor="middle" fontSize="8.4" fontWeight="700" fill="currentColor" fontFamily="system-ui, -apple-system, sans-serif">{TODAY_NUMBER}</text>
        : null}
    </svg>
  );
}

/** A list's icon: a colored circle with a white glyph. */
export function ListIcon({ glyph, color, size = 30, className }: { glyph: GlyphName; color: string; size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('grid shrink-0 place-items-center rounded-full text-white', className)} style={{ width: size, height: size, background: color }}>
      <Glyph name={glyph} size={size * 0.58} sw={2.2} />
    </span>
  );
}
