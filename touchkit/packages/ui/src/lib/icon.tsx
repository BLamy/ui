import type { CSSProperties } from 'react';
import { cn } from './utils';

type IconShape = { d?: string; c?: number[]; f?: number; bg?: number; rx?: number };

/* ══ Icons ══ */
export const IC: Record<string, IconShape[]> = {
  chev: [{ d: 'M9 5.5l6.5 6.5L9 18.5' }],
  chevL: [{ d: 'M15 5l-7 7 7 7' }],
  sidebar: [{ d: 'M3.5 5.5h17v13h-17z', rx: 1 }, { d: 'M9.5 5.5v13' }],
  search: [{ c: [11, 11, 6.2] }, { d: 'M15.7 15.7L20.3 20.3' }],
  person: [{ c: [12, 12, 8.6] }, { c: [12, 9.8, 2.9] }, { d: 'M6.9 18.3c1-2.5 2.9-3.8 5.1-3.8s4.1 1.3 5.1 3.8' }],
  person2: [{ c: [9, 8.8, 3] }, { d: 'M3.6 18.6c.9-2.7 3-4.1 5.4-4.1s4.5 1.4 5.4 4.1' }, { c: [16.8, 9.6, 2.4] }, { d: 'M16.4 14.7c2.1.2 3.6 1.4 4.3 3.4' }],
  sliders: [{ d: 'M4 8h4.6' }, { d: 'M13.4 8H20' }, { c: [11, 8, 2.2] }, { d: 'M4 16h8.6' }, { d: 'M17.4 16H20' }, { c: [15, 16, 2.2] }],
  star: [{ d: 'M12 3.8l2.34 4.98 5.26.66-3.87 3.74 1 5.42L12 15.98 7.27 18.6l1-5.42L4.4 9.44l5.26-.66L12 3.8z' }],
  starF: [{ d: 'M12 3.8l2.34 4.98 5.26.66-3.87 3.74 1 5.42L12 15.98 7.27 18.6l1-5.42L4.4 9.44l5.26-.66L12 3.8z', f: 1 }],
  clock: [{ c: [12, 12, 8.4] }, { d: 'M12 7.2V12l3.1 1.9' }],
  phone: [{ d: 'M6.9 3.9c.8-.8 2-.7 2.7.2l1.2 1.6c.6.8.5 1.9-.2 2.6l-.7.7c.4 1.2 2.1 2.9 3.3 3.3l.7-.7c.7-.7 1.8-.8 2.6-.2l1.6 1.2c.9.7 1 2 .2 2.7l-1 1c-.8.8-2 1.1-3.1.7-2-.7-4.2-2.2-5.9-3.9-1.7-1.7-3.2-3.9-3.9-5.9-.4-1.1-.1-2.3.7-3.1l1-1z', f: 1 }],
  message: [{ d: 'M12 3.8c4.8 0 8.6 3.2 8.6 7.1s-3.8 7.1-8.6 7.1c-.9 0-1.8-.1-2.6-.3l-3.9 1.7.9-3.1c-1.5-1.3-2.4-3.2-2.4-5.4 0-3.9 3.2-7.1 8-7.1z', f: 1 }],
  mail: [{ d: 'M3 5.8h18v12.4H3z', rx: 1 }, { d: 'M4.5 7.5l7.5 5.5 7.5-5.5' }],
  video: [{ d: 'M3 6.8h11.5v10.4H3z', rx: 1 }, { d: 'M14.8 10.7l4.7-2.8v8.2l-4.7-2.8z', f: 1 }],
  trash: [{ d: 'M5 7h14' }, { d: 'M9.3 7V5.4c0-.8.6-1.4 1.4-1.4h2.6c.8 0 1.4.6 1.4 1.4V7' }, { d: 'M7 7l.9 11.1c.1 1.1 1 1.9 2.1 1.9h4c1.1 0 2-.8 2.1-1.9L17 7' }, { d: 'M10.2 10.5v5.2' }, { d: 'M13.8 10.5v5.2' }],
  check: [{ d: 'M5.5 12.6l4.3 4.3 8.7-9.3' }],
  xcirc: [{ c: [12, 12, 9], f: 1 }, { d: 'M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6', bg: 1 }],
  x: [{ d: 'M6.8 6.8l10.4 10.4M17.2 6.8L6.8 17.2' }],
  moon: [{ d: 'M19.8 14.3A8.3 8.3 0 1 1 9.7 4.2a6.8 6.8 0 0 0 10.1 10.1z' }],
  layers: [{ d: 'M12 3.6l8.2 4.6L12 12.8 3.8 8.2 12 3.6z' }, { d: 'M4.6 12.4L12 16.6l7.4-4.2' }],
  wave: [{ d: 'M4.5 10.2v3.6' }, { d: 'M8.25 7.5v9' }, { d: 'M12 4.8v14.4' }, { d: 'M15.75 7.5v9' }, { d: 'M19.5 10.2v3.6' }],
  info: [{ c: [12, 12, 8.6] }, { d: 'M12 11v5.2' }, { d: 'M12 7.9v.01' }],
  pulse: [{ c: [12, 12, 3], f: 1 }, { c: [12, 12, 8] }],
  drop: [{ d: 'M12 3.5c3.2 3.9 6 7 6 10.2a6 6 0 1 1-12 0C6 10.5 8.8 7.4 12 3.5z' }],
  bell: [{ d: 'M12 4.2a5.8 5.8 0 0 1 5.8 5.8c0 2.9.9 4.4 1.9 5.4H4.3c1-1 1.9-2.5 1.9-5.4A5.8 5.8 0 0 1 12 4.2z' }, { d: 'M10.1 19.2a2 2 0 0 0 3.8 0' }],
};

export type IconName = keyof typeof IC;

export interface IconProps {
  name: IconName | (string & {});
  size?: number;
  sw?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size, sw, className, style }: IconProps) {
  size = size || 22; sw = sw || 1.8;
  const els = IC[name] || IC['info'];
  return (
    <svg data-slot="icon" className={cn(className)} width={size} height={size} viewBox="0 0 24 24"
      style={{ display: 'block', flexShrink: 0, ...style }} aria-hidden="true">
      {els.map((e, i) => e.c
        ? <circle key={i} cx={e.c[0]} cy={e.c[1]} r={e.c[2]} fill={e.f ? 'currentColor' : 'none'} stroke={e.f ? 'none' : 'currentColor'} strokeWidth={sw} />
        : <path key={i} d={e.d} fill={e.f ? 'currentColor' : 'none'} stroke={e.f ? 'none' : (e.bg ? 'var(--tk-bg,#fff)' : 'currentColor')} strokeWidth={e.bg ? 2 : sw} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}
