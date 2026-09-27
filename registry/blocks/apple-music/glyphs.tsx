/* SF Symbols-style glyphs drawn for this block (24px grid). Transport glyphs are filled; the rest stroke. */
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@brett_lamy/ui';

const F = { fill: 'currentColor', stroke: 'none' } as const;

const PATHS: Record<string, ReactNode> = {
  play: <path {...F} d="M7.2 4.6c0-1 1.1-1.6 1.9-1.1l11 6.9c.8.5.8 1.7 0 2.2l-11 6.9c-.8.5-1.9-.1-1.9-1.1z" />,
  pause: <><rect {...F} x="5.6" y="4" width="4.4" height="16" rx="1.2" /><rect {...F} x="14" y="4" width="4.4" height="16" rx="1.2" /></>,
  forward: <><path {...F} d="M2.6 6.6c0-.8.9-1.3 1.6-.9l7.6 5.4c.6.4.6 1.3 0 1.8l-7.6 5.4c-.7.4-1.6-.1-1.6-.9z" /><path {...F} d="M12 6.6c0-.8.9-1.3 1.6-.9l7.6 5.4c.6.4.6 1.3 0 1.8l-7.6 5.4c-.7.4-1.6-.1-1.6-.9z" /></>,
  backward: <><path {...F} d="M21.4 6.6c0-.8-.9-1.3-1.6-.9l-7.6 5.4c-.6.4-.6 1.3 0 1.8l7.6 5.4c.7.4 1.6-.1 1.6-.9z" /><path {...F} d="M12 6.6c0-.8-.9-1.3-1.6-.9l-7.6 5.4c-.6.4-.6 1.3 0 1.8l7.6 5.4c.7.4 1.6-.1 1.6-.9z" /></>,
  shuffle: <><path d="M3.5 7h3.2c2.2 0 3.4 1 4.6 3l1.4 2.4c1.2 2 2.4 3 4.6 3h3.2M3.5 17h3.2c1.4 0 2.4-.4 3.2-1.2M13.5 8.2c.8-.8 1.8-1.2 3.2-1.2h3.2" /><path d="m18 4.6 2.4 2.4-2.4 2.4M18 13 20.4 15.4 18 17.8" /></>,
  repeat: <><path d="M4 11V9.6A2.6 2.6 0 0 1 6.6 7h12.6M20 13v1.4a2.6 2.6 0 0 1-2.6 2.6H4.8" /><path d="m16.8 4.4 2.6 2.6-2.6 2.6M7.2 19.6 4.6 17l2.6-2.6" /></>,
  lyrics: <><path d="M4.4 5.6c0-1 .8-1.8 1.8-1.8h11.6c1 0 1.8.8 1.8 1.8v8.8c0 1-.8 1.8-1.8 1.8H11l-4.2 3.6v-3.6h-.6c-1 0-1.8-.8-1.8-1.8z" /><path d="M9.6 8.2c-.9 0-1.4.6-1.4 1.3s.5 1.2 1.2 1.2c.4 0 .5.6-.6 1.4M14.4 8.2c-.9 0-1.4.6-1.4 1.3s.5 1.2 1.2 1.2c.4 0 .5.6-.6 1.4" /></>,
  queue: <><path d="M4 6.5h10M4 11.5h10M4 16.5h6" /><path {...F} d="M15.2 13.6c0-.5.5-.8 1-.5l4.2 2.6c.4.3.4.9 0 1.1l-4.2 2.6c-.5.3-1-.1-1-.6z" /></>,
  airplay: <><path d="M6.6 16.4H5a1.6 1.6 0 0 1-1.6-1.6V6a1.6 1.6 0 0 1 1.6-1.6h14A1.6 1.6 0 0 1 20.6 6v8.8a1.6 1.6 0 0 1-1.6 1.6h-1.6" /><path {...F} d="M11.3 13.4c.4-.5 1-.5 1.4 0l4 4.8c.4.5 0 1.2-.7 1.2H8c-.7 0-1.1-.7-.7-1.2z" /></>,
  volLow: <><path {...F} d="M4 9.6c0-.6.4-1 1-1h2.6L11.4 5c.6-.5 1.6-.1 1.6.8v12.4c0 .9-1 1.3-1.6.8l-3.8-3.6H5c-.6 0-1-.4-1-1z" /><path d="M16 9.4a3.8 3.8 0 0 1 0 5.2" /></>,
  volHigh: <><path {...F} d="M2.6 9.6c0-.6.4-1 1-1h2.6L10 5c.6-.5 1.6-.1 1.6.8v12.4c0 .9-1 1.3-1.6.8l-3.8-3.6H3.6c-.6 0-1-.4-1-1z" /><path d="M14.6 9.4a3.8 3.8 0 0 1 0 5.2M17.4 6.8a7.6 7.6 0 0 1 0 10.4M20 4.4a11 11 0 0 1 0 15.2" /></>,
  more: <><circle {...F} cx="5.5" cy="12" r="1.7" /><circle {...F} cx="12" cy="12" r="1.7" /><circle {...F} cx="18.5" cy="12" r="1.7" /></>,
  listen: <><circle cx="12" cy="12" r="8.6" /><path {...F} d="M10 8.6c0-.6.6-.9 1.1-.6l5 3.4c.4.3.4.9 0 1.2l-5 3.4c-.5.3-1.1 0-1.1-.6z" /></>,
  browse: <><rect x="4" y="4" width="7" height="7" rx="1.6" /><rect x="13" y="4" width="7" height="7" rx="1.6" /><rect x="4" y="13" width="7" height="7" rx="1.6" /><rect x="13" y="13" width="7" height="7" rx="1.6" /></>,
  radio: <><circle {...F} cx="12" cy="12" r="2" /><path d="M8.2 15.8a5.4 5.4 0 0 1 0-7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 18.6a9.4 9.4 0 0 1 0-13.2M18.6 5.4a9.4 9.4 0 0 1 0 13.2" /></>,
  library: <><path d="M5 4.5v15M9 4.5v15" /><path d="m13 5.2 3.6-1 3.8 14.6-3.6 1z" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.2" /><path d="m15.5 15.5 4.7 4.7" /></>,
  clock: <><circle cx="12" cy="12" r="8.4" /><path d="M12 7.4V12l3 1.8" /></>,
  mic: <><rect x="9" y="3.6" width="6" height="10.4" rx="3" /><path d="M6 11.4a6 6 0 0 0 12 0M12 17.4v3" /></>,
  album: <><rect x="4" y="4" width="16" height="16" rx="2.4" /><circle cx="12" cy="12" r="3.6" /><circle {...F} cx="12" cy="12" r="1" /></>,
  note: <><path d="M9 17.6V6.2l10-2v11.2" /><circle cx="6.6" cy="17.6" r="2.4" /><circle cx="16.6" cy="15.4" r="2.4" /></>,
  playlist: <><path d="M4 6.5h10M4 11h10M4 15.5h6" /><path d="M18 5v10.4" /><circle cx="15.8" cy="15.6" r="2.2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  heart: <path d="M12 19.3s-7.3-4.4-7.3-9.6A4.1 4.1 0 0 1 12 7.1a4.1 4.1 0 0 1 7.3 2.6c0 5.2-7.3 9.6-7.3 9.6z" />,
  heartFill: <path {...F} d="M12 19.3s-7.3-4.4-7.3-9.6A4.1 4.1 0 0 1 12 7.1a4.1 4.1 0 0 1 7.3 2.6c0 5.2-7.3 9.6-7.3 9.6z" />,
  chevron: <path d="m9 5.5 6.5 6.5L9 18.5" />,
  chevronDown: <path d="m5.5 9 6.5 6.5L18.5 9" />,
  back: <path d="M15 5l-7 7 7 7" />,
  explicit: <><rect {...F} x="4" y="4" width="16" height="16" rx="3" /><path d="M14.4 8H9.8v8h4.6M9.8 12h4" stroke="var(--bl-bg,#fff)" strokeWidth="2" /></>,
  download: <><circle cx="12" cy="12" r="8.6" /><path d="M12 7.6v8.4M8.6 12.8 12 16.2l3.4-3.4" /></>,
};

export type GlyphName = keyof typeof PATHS;

export function Glyph({ name, size = 20, sw = 1.9, className, style }: {
  name: GlyphName; size?: number; sw?: number; className?: string; style?: CSSProperties;
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" className={cn('block shrink-0', className)} style={style}>
      {PATHS[name]}
    </svg>
  );
}

/** The "now playing" equalizer bars that bounce beside the current track (still when paused). */
export function Bars({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-flex h-3.5 items-end gap-[2px]', className)}>
      {[0.9, 0.5, 0.75, 0.35].map((h, i) => (
        <span key={i} className="w-[3px] rounded-[1px] bg-current"
          style={{
            height: `${h * 100}%`,
            animation: playing ? `am-eq ${0.7 + i * 0.13}s ease-in-out ${i * -0.2}s infinite alternate` : undefined,
            transformOrigin: 'bottom',
          }} />
      ))}
      <style>{'@keyframes am-eq{from{transform:scaleY(.25)}to{transform:scaleY(1)}}@media (prefers-reduced-motion:reduce){[style*="am-eq"]{animation:none!important}}'}</style>
    </span>
  );
}
