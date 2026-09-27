/* SF Symbols-style glyphs for the Settings icons, drawn on a 24px grid. `f` fills a shape; everything else is
   a round-capped stroke. <Tile> is the colored rounded square every Settings row leads with. */
import type { CSSProperties } from 'react';
import { cn } from '@brett_lamy/ui';

type Shape = { d?: string; c?: [number, number, number]; f?: 1 };

const G = {
  airplane: [{ d: 'M10.4 3.6c0-1 .7-1.6 1.6-1.6s1.6.6 1.6 1.6v5.6l7.4 4.4v2l-7.4-2.3v4.9l2 1.5V21l-3.6-1-3.6 1v-1.3l2-1.5v-4.9L3 15.6v-2l7.4-4.4z', f: 1 }],
  wifi: [{ d: 'M3.2 9.2a12.5 12.5 0 0 1 17.6 0' }, { d: 'M6.3 12.4a8 8 0 0 1 11.4 0' }, { d: 'M9.4 15.6a3.6 3.6 0 0 1 5.2 0' }, { c: [12, 18.8, 1.3], f: 1 }],
  bluetooth: [{ d: 'M7 7.5l10 9-5 4.5V3l5 4.5-10 9' }],
  cellular: [{ c: [12, 10.4, 1.7], f: 1 }, { d: 'M12 12.6V21' }, { d: 'M8.6 7a5 5 0 0 0 0 6.8' }, { d: 'M15.4 7a5 5 0 0 1 0 6.8' }, { d: 'M5.6 4a9 9 0 0 0 0 12.8' }, { d: 'M18.4 4a9 9 0 0 1 0 12.8' }],
  hotspot: [{ d: 'M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.9-2.9a3.6 3.6 0 0 0-5.1-5.1l-1.2 1.2' }, { d: 'M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.9 2.9a3.6 3.6 0 0 0 5.1 5.1l1.2-1.2' }],
  battery: [{ d: 'M2.8 8.2c0-.8.6-1.4 1.4-1.4h13.2c.8 0 1.4.6 1.4 1.4v7.6c0 .8-.6 1.4-1.4 1.4H4.2c-.8 0-1.4-.6-1.4-1.4z' }, { d: 'M21.2 10.4v3.2' }, { d: 'M5 9h8.5v6H5z', f: 1 }],
  vpn: [{ c: [12, 12, 8.6] }, { d: 'M3.6 12h16.8' }, { d: 'M12 3.4c2.4 2.4 3.4 5.3 3.4 8.6s-1 6.2-3.4 8.6c-2.4-2.4-3.4-5.3-3.4-8.6s1-6.2 3.4-8.6z' }],
  gear: [{ c: [12, 12, 2.9] }, { d: 'M10.3 3.4h3.4l.5 2.4 1.7.9 2.3-.8 1.7 2.9-1.8 1.7v1.9l1.8 1.7-1.7 2.9-2.3-.8-1.7.9-.5 2.4h-3.4l-.5-2.4-1.7-.9-2.3.8-1.7-2.9 1.8-1.7v-1.9L4.1 8.8l1.7-2.9 2.3.8 1.7-.9z' }],
  accessibility: [{ c: [12, 4.6, 1.9], f: 1 }, { d: 'M4.8 8.4c2.4.8 4.8 1.2 7.2 1.2s4.8-.4 7.2-1.2' }, { d: 'M12 9.8v5l-3.2 6' }, { d: 'M12 14.8l3.2 6' }],
  camera: [{ d: 'M3.5 8.6c0-.8.6-1.4 1.4-1.4h2.4l1.5-2.2h6.4l1.5 2.2h2.4c.8 0 1.4.6 1.4 1.4v9c0 .8-.6 1.4-1.4 1.4H4.9c-.8 0-1.4-.6-1.4-1.4z', f: 1 }, { c: [12, 12.8, 3.4] }],
  controls: [{ d: 'M7.5 4.6h9a3.6 3.6 0 0 1 0 7.2h-9a3.6 3.6 0 0 1 0-7.2z' }, { c: [16.5, 8.2, 2], f: 1 }, { d: 'M7.5 12.8h9a3.6 3.6 0 0 1 0 7.2h-9a3.6 3.6 0 0 1 0-7.2z' }, { c: [7.5, 16.4, 2], f: 1 }],
  sun: [{ c: [12, 12, 4.2], f: 1 }, { d: 'M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M5.4 18.6l1.4-1.4M17.2 6.8l1.4-1.4' }],
  sunSmall: [{ c: [12, 12, 3], f: 1 }, { d: 'M12 5.6v1.2M12 17.2v1.2M5.6 12h1.2M17.2 12h1.2M7.5 7.5l.8.8M15.7 15.7l.8.8M7.5 16.5l.8-.8M15.7 8.3l.8-.8' }],
  grid: [{ d: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z', f: 1 }],
  search: [{ c: [10.6, 10.6, 6] }, { d: 'M15.2 15.2l5 5' }],
  siri: [{ d: 'M4 12h1.5M7.3 8.5v7M10.6 5v14M13.9 7.5v9M17.2 9.8v4.4M20 12h.5' }],
  standby: [{ d: 'M3.5 7.5c0-.8.6-1.4 1.4-1.4h14.2c.8 0 1.4.6 1.4 1.4v9c0 .8-.6 1.4-1.4 1.4H4.9c-.8 0-1.4-.6-1.4-1.4z' }, { d: 'M7 12h3.5M13.5 10v4M16.5 10v4' }],
  flower: [{ c: [12, 7.4, 3], f: 1 }, { c: [12, 16.6, 3], f: 1 }, { c: [7.4, 12, 3], f: 1 }, { c: [16.6, 12, 3], f: 1 }],
  bell: [{ d: 'M12 3.6a5.9 5.9 0 0 1 5.9 5.9c0 3 .9 4.6 2 5.6H4.1c1.1-1 2-2.6 2-5.6A5.9 5.9 0 0 1 12 3.6z', f: 1 }, { d: 'M9.8 18.6a2.3 2.3 0 0 0 4.4 0', f: 1 }],
  speaker: [{ d: 'M3.8 9.2h3.6l4.8-4v13.6l-4.8-4H3.8z', f: 1 }, { d: 'M15.4 9a4.2 4.2 0 0 1 0 6' }, { d: 'M18.2 6.4a8 8 0 0 1 0 11.2' }],
  speakerLow: [{ d: 'M6 9.6h3l4-3.4v11.6l-4-3.4H6z', f: 1 }],
  moon: [{ d: 'M19.6 14.6A8.2 8.2 0 1 1 9.4 4.4a6.6 6.6 0 0 0 10.2 10.2z', f: 1 }],
  hourglass: [{ d: 'M6.5 3.5h11M6.5 20.5h11' }, { d: 'M8 3.5c0 4.2 4 5.4 4 8.5s-4 4.3-4 8.5M16 3.5c0 4.2-4 5.4-4 8.5s4 4.3 4 8.5' }, { d: 'M9.6 19.2c.6-1.8 1.4-2.6 2.4-3.2 1 .6 1.8 1.4 2.4 3.2z', f: 1 }],
  faceid: [{ d: 'M4 8.4V6c0-1.1.9-2 2-2h2.4M15.6 4H18c1.1 0 2 .9 2 2v2.4M20 15.6V18c0 1.1-.9 2-2 2h-2.4M8.4 20H6c-1.1 0-2-.9-2-2v-2.4' }, { d: 'M9 9.2v1.4M15 9.2v1.4M12.2 9.2v3.8h-1M9.6 15.8c1.4 1.1 3.4 1.1 4.8 0' }],
  sos: [{ d: 'M8.2 9.3c-.3-.5-.9-.8-1.6-.8-.9 0-1.6.6-1.6 1.4 0 1.8 3.4 1.2 3.4 3.1 0 .9-.8 1.5-1.8 1.5-.8 0-1.4-.3-1.8-.9M12 8.5c1.2 0 2 1.2 2 3.25S13.2 15 12 15s-2-1.2-2-3.25.8-3.25 2-3.25zM19 9.3c-.3-.5-.9-.8-1.6-.8-.9 0-1.6.6-1.6 1.4 0 1.8 3.4 1.2 3.4 3.1 0 .9-.8 1.5-1.8 1.5-.8 0-1.4-.3-1.8-.9' }],
  hand: [{ d: 'M8.2 12.6V6.4a1.3 1.3 0 0 1 2.6 0V11M10.8 11V4.9a1.3 1.3 0 0 1 2.6 0V11M13.4 11V5.9a1.3 1.3 0 0 1 2.6 0V12M16 12V8.6a1.3 1.3 0 0 1 2.6 0v5.2c0 4-2.5 6.7-6.2 6.7-2.6 0-4.1-1.3-5.4-3.4l-2.3-3.8a1.3 1.3 0 0 1 2.2-1.4l1.3 1.9' }],
  key: [{ c: [8, 12, 3.8] }, { d: 'M11.8 12h8.6v3M17.2 12v2.4' }],
  appstore: [{ d: 'M9.6 5.2l5.6 9.8M14.4 5.2L7 17.8M5.4 15h8.2M16.6 15h2.2M16.6 15l1.6 2.8' }],
  wallet: [{ d: 'M4 7.4c0-1 .8-1.8 1.8-1.8h12.4c1 0 1.8.8 1.8 1.8v9.2c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8z' }, { d: 'M4 9.6h16M4 12.4h16', f: 1 }, { d: 'M14.6 14.6h3' }],
  person: [{ c: [12, 8.4, 3.6], f: 1 }, { d: 'M4.8 20c.6-3.6 3.4-6 7.2-6s6.6 2.4 7.2 6z', f: 1 }],
  cloud: [{ d: 'M7.2 18.6h10.4a4.1 4.1 0 0 0 .7-8.1 6.1 6.1 0 0 0-11.8-1.1 4.6 4.6 0 0 0 .7 9.2z', f: 1 }],
  lock: [{ d: 'M6.2 11h11.6v9.2H6.2z', f: 1 }, { d: 'M8.6 11V8.2a3.4 3.4 0 0 1 6.8 0V11' }],
  lockSmall: [{ d: 'M7.4 11.4h9.2v7.4H7.4z', f: 1 }, { d: 'M9.4 11.4V9a2.6 2.6 0 0 1 5.2 0v2.4' }],
  info: [{ c: [12, 12, 8.8] }, { d: 'M12 11v5.4' }, { c: [12, 7.8, .6], f: 1 }],
  update: [{ d: 'M19 12a7 7 0 1 1-2.1-5M19.2 4.2v3.6h-3.6' }],
  airdrop: [{ c: [12, 12, 1.6], f: 1 }, { d: 'M8.6 15.4a4.8 4.8 0 1 1 6.8 0M6 18a8.5 8.5 0 1 1 12 0' }],
  calendar: [{ d: 'M4.2 6.6c0-.9.7-1.6 1.6-1.6h12.4c.9 0 1.6.7 1.6 1.6v11.8c0 .9-.7 1.6-1.6 1.6H5.8c-.9 0-1.6-.7-1.6-1.6z' }, { d: 'M4.2 9.6h15.6M8.4 3v3.6M15.6 3v3.6' }],
  keyboard: [{ d: 'M3 7c0-.8.6-1.4 1.4-1.4h15.2c.8 0 1.4.6 1.4 1.4v10c0 .8-.6 1.4-1.4 1.4H4.4c-.8 0-1.4-.6-1.4-1.4z' }, { d: 'M6.6 9.4h.1M10 9.4h.1M13.4 9.4h.1M16.8 9.4h.1M6.6 12.4h.1M10 12.4h.1M13.4 12.4h.1M16.8 12.4h.1M8.4 15.4h7.2' }],
  globe: [{ c: [12, 12, 8.6] }, { d: 'M3.6 12h16.8M12 3.4c2.4 2.4 3.4 5.3 3.4 8.6s-1 6.2-3.4 8.6c-2.4-2.4-3.4-5.3-3.4-8.6s1-6.2 3.4-8.6z' }],
  storage: [{ d: 'M4 6.5c0-1 .8-1.8 1.8-1.8h12.4c1 0 1.8.8 1.8 1.8v11c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8z' }, { d: 'M4 13.6h16' }, { c: [16.4, 16.5, .9], f: 1 }],
  location: [{ d: 'M20 4L3.8 11l7 2.2L13 20z', f: 1 }],
  chart: [{ d: 'M5 20V13M10 20V7M15 20v-9M20 20V4' }],
  phone: [{ d: 'M7.1 3.8c.8-.8 2-.7 2.7.2l1.2 1.6c.6.8.5 1.9-.2 2.6l-.7.7c.4 1.2 2.1 2.9 3.3 3.3l.7-.7c.7-.7 1.8-.8 2.6-.2l1.6 1.2c.9.7 1 2 .2 2.7l-1 1c-.8.8-2 1.1-3.1.7-2-.7-4.2-2.2-5.9-3.9-1.7-1.7-3.2-3.9-3.9-5.9-.4-1.1-.1-2.3.7-3.1z', f: 1 }],
  message: [{ d: 'M12 3.8c4.8 0 8.6 3.2 8.6 7.1S16.8 18 12 18c-.9 0-1.8-.1-2.6-.3l-3.9 1.7.9-3.1c-1.5-1.3-2.4-3.2-2.4-5.4 0-3.9 3.2-7.1 8-7.1z', f: 1 }],
  mail: [{ d: 'M3.4 6.2h17.2v11.6H3.4z', f: 1 }, { d: 'M4.4 7.2l7.6 5.8 7.6-5.8' }],
  music: [{ d: 'M9 17.5V5.6l10-2v11.6' }, { c: [6.8, 17.6, 2.3], f: 1 }, { c: [16.8, 15.4, 2.3], f: 1 }],
  photos: [{ c: [12, 7.2, 3], f: 1 }, { c: [16.4, 10.4, 3], f: 1 }, { c: [14.8, 15.6, 3], f: 1 }, { c: [9.2, 15.6, 3], f: 1 }, { c: [7.6, 10.4, 3], f: 1 }],
  headphones: [{ d: 'M4.5 16v-3.5a7.5 7.5 0 0 1 15 0V16' }, { d: 'M4.5 14.4h3v5.2h-1.6c-.8 0-1.4-.6-1.4-1.4zM19.5 14.4h-3v5.2h1.6c.8 0 1.4-.6 1.4-1.4z', f: 1 }],
  watch: [{ d: 'M8.4 6.4h7.2c1.1 0 2 .9 2 2v7.2c0 1.1-.9 2-2 2H8.4c-1.1 0-2-.9-2-2V8.4c0-1.1.9-2 2-2z' }, { d: 'M9 6.4l.6-3h4.8l.6 3M9 17.6l.6 3h4.8l.6-3' }],
  car: [{ d: 'M4 15.6v-3l1.8-4.8c.2-.6.8-1 1.4-1h9.6c.6 0 1.2.4 1.4 1l1.8 4.8v3z' }, { d: 'M5.4 15.6v2.2M18.6 15.6v2.2M4.4 12.4h15.2' }, { c: [7.6, 13.8, .9], f: 1 }, { c: [16.4, 13.8, .9], f: 1 }],
  laptop: [{ d: 'M5 6.2c0-.7.5-1.2 1.2-1.2h11.6c.7 0 1.2.5 1.2 1.2V15H5z' }, { d: 'M2.8 18.4h18.4' }],
  bed: [{ d: 'M3.5 18V7M3.5 14.5h17V18M20.5 14.5V12c0-1.4-1.1-2.5-2.5-2.5h-7v5' }, { c: [7.2, 11.2, 1.8], f: 1 }],
  work: [{ d: 'M3.8 8.8c0-.8.6-1.4 1.4-1.4h13.6c.8 0 1.4.6 1.4 1.4v9c0 .8-.6 1.4-1.4 1.4H5.2c-.8 0-1.4-.6-1.4-1.4z', f: 1 }, { d: 'M9 7.4V5.6c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v1.8' }],
  check: [{ d: 'M5.5 12.6l4.3 4.3 8.7-9.3' }],
  chevron: [{ d: 'M9 5.5l6.5 6.5L9 18.5' }],
  chevronLeft: [{ d: 'M15 5.5L8.5 12l6.5 6.5' }],
  chevronUpDown: [{ d: 'M8 9.5l4-4 4 4M8 14.5l4 4 4-4' }],
} satisfies Record<string, Shape[]>;

export type GlyphName = keyof typeof G;
export const isGlyph = (s: string): s is GlyphName => s in G;

export function Glyph({ name, size = 20, sw = 1.9, className, style }: { name: GlyphName; size?: number; sw?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={cn('block shrink-0', className)} style={style}>
      {(G[name] as Shape[]).map((s, i) => s.c
        ? <circle key={i} cx={s.c[0]} cy={s.c[1]} r={s.c[2]} fill={s.f ? 'currentColor' : 'none'} stroke={s.f ? 'none' : 'currentColor'} strokeWidth={sw} />
        : <path key={i} d={s.d} fill={s.f ? 'currentColor' : 'none'} stroke={s.f ? 'none' : 'currentColor'} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}

/** Wi-Fi strength: three arcs, the missing bars dimmed. */
export function WifiBars({ bars, size = 17 }: { bars: 1 | 2 | 3; size?: number }) {
  const on = (n: number) => (bars >= n ? 1 : 0.28);
  return (
    <svg aria-label={`${bars} of 3 bars`} role="img" width={size} height={size} viewBox="0 0 24 24" className="block shrink-0" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <path d="M3.2 9.2a12.5 12.5 0 0 1 17.6 0" opacity={on(3)} />
      <path d="M6.3 12.4a8 8 0 0 1 11.4 0" opacity={on(2)} />
      <circle cx={12} cy={17.6} r={2} fill="currentColor" stroke="none" />
    </svg>
  );
}

/** The colored rounded square (squircle-ish radius) with a white glyph. `color` may be a gradient. */
export function Tile({ glyph, color, size = 29, className }: { glyph: GlyphName; color: string; size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('grid shrink-0 place-items-center text-white', className)}
      style={{ width: size, height: size, borderRadius: size * 0.235, background: color }}>
      <Glyph name={glyph} size={size * 0.66} sw={2.1} />
    </span>
  );
}
