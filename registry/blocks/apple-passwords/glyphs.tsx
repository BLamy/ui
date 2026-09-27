/* SF Symbols-style glyphs drawn for this block (24px grid, stroked with currentColor), plus the site tile
   that stands in for a favicon: the site's first letter on its brand color. */
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@brett_lamy/ui';

const PATHS: Record<string, ReactNode> = {
  key: (
    <>
      <circle cx="8" cy="12" r="4.2" />
      <circle cx="7.2" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <path d="M12.2 12h8.3M17.6 12v3.2M20.5 12v2.4" />
    </>
  ),
  passkey: (
    <>
      <circle cx="9" cy="7.8" r="3.4" />
      <path d="M3.2 19.2c.7-3.4 3.1-5.3 5.8-5.3 1.2 0 2.3.3 3.2.9" />
      <circle cx="17.2" cy="12.4" r="2.2" />
      <path d="M17.2 14.6v5.6M17.2 17.6h1.8M17.2 19.6h1.4" />
    </>
  ),
  codes: (
    <>
      <path d="M19.6 12a7.6 7.6 0 1 1-2.2-5.4" />
      <path d="M17.8 3.4v3.4h-3.4" />
      <rect x="9.1" y="11" width="5.8" height="4.6" rx="1" fill="currentColor" stroke="none" />
      <path d="M10.4 11V9.9a1.6 1.6 0 0 1 3.2 0V11" />
    </>
  ),
  wifi: (
    <>
      <path d="M3.4 9.4a12.2 12.2 0 0 1 17.2 0" />
      <path d="M6.5 12.6a7.8 7.8 0 0 1 11 0" />
      <path d="M9.6 15.7a3.4 3.4 0 0 1 4.8 0" />
      <circle cx="12" cy="18.6" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.3 19 6v5.4c0 4.3-2.9 7.7-7 9.3-4.1-1.6-7-5-7-9.3V6z" />
      <path d="M12 8v5" />
      <circle cx="12" cy="16" r=".4" fill="currentColor" />
    </>
  ),
  trash: (
    <>
      <path d="M4.8 6.8h14.4M9.4 6.6V5a1.2 1.2 0 0 1 1.2-1.2h2.8A1.2 1.2 0 0 1 14.6 5v1.6" />
      <path d="m6.6 6.8.9 12a1.6 1.6 0 0 0 1.6 1.4h5.8a1.6 1.6 0 0 0 1.6-1.4l.9-12M10.2 10.4v6M13.8 10.4v6" />
    </>
  ),
  group: (
    <>
      <circle cx="9" cy="8.6" r="3" />
      <path d="M3.6 18.6c.8-2.9 2.9-4.3 5.4-4.3s4.6 1.4 5.4 4.3" />
      <circle cx="16.9" cy="9.4" r="2.4" />
      <path d="M16.3 14.4c2.3.1 3.8 1.5 4.4 3.7" />
    </>
  ),
  copy: (
    <>
      <rect x="8.2" y="8.2" width="11.6" height="11.6" rx="2.2" />
      <path d="M15.6 5.8V5.6a1.8 1.8 0 0 0-1.8-1.8H5.6a1.8 1.8 0 0 0-1.8 1.8v8.2a1.8 1.8 0 0 0 1.8 1.8h.2" />
    </>
  ),
  check: <path d="m5.2 12.6 4.4 4.4 9.2-9.8" />,
  eye: (
    <>
      <path d="M2.4 12s3.5-6.4 9.6-6.4 9.6 6.4 9.6 6.4-3.5 6.4-9.6 6.4S2.4 12 2.4 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M9.6 5.9A9.8 9.8 0 0 1 12 5.6c6.1 0 9.6 6.4 9.6 6.4a17 17 0 0 1-2.6 3.4M6.3 7.5C3.9 9.2 2.4 12 2.4 12s3.5 6.4 9.6 6.4c1.6 0 3-.4 4.2-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3.8 3.8l16.4 16.4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M3.8 12h16.4M12 3.6c2.3 2.3 3.4 5.1 3.4 8.4s-1.1 6.1-3.4 8.4c-2.3-2.3-3.4-5.1-3.4-8.4S9.7 5.9 12 3.6z" />
    </>
  ),
  warning: (
    <>
      <path d="M10.4 4.6a1.8 1.8 0 0 1 3.2 0l7 12.6a1.8 1.8 0 0 1-1.6 2.7H5a1.8 1.8 0 0 1-1.6-2.7z" fill="currentColor" stroke="none" />
      <path d="M12 9.2v4.4" stroke="var(--pw-on-warn,#fff)" strokeWidth="2" />
      <circle cx="12" cy="16.6" r="1.1" fill="var(--pw-on-warn,#fff)" stroke="none" />
    </>
  ),
  qr: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1.2" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" />
      <path d="M14 14h2.4v2.4M20 14v.1M18.2 18.2H20V20M14 20h2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="m15.5 15.5 4.7 4.7" />
    </>
  ),
  note: (
    <>
      <rect x="5" y="3.8" width="14" height="16.4" rx="2.2" />
      <path d="M8.6 8.6h6.8M8.6 12h6.8M8.6 15.4h4" />
    </>
  ),
  recover: (
    <>
      <path d="M4.6 12a7.4 7.4 0 1 0 2.2-5.2" />
      <path d="M6.4 3.6v3.6H10" />
    </>
  ),
  lock: (
    <>
      <rect x="5.6" y="10.4" width="12.8" height="9.8" rx="2" />
      <path d="M8.4 10.4V8a3.6 3.6 0 0 1 7.2 0v2.4" />
    </>
  ),
  chevron: <path d="m9 5.5 6.5 6.5L9 18.5" />,
};

export type GlyphName = keyof typeof PATHS;

export function Glyph({ name, size = 20, sw = 1.8, className, style }: {
  name: GlyphName; size?: number; sw?: number; className?: string; style?: CSSProperties;
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" className={cn('block shrink-0', className)} style={style}>
      {PATHS[name]}
    </svg>
  );
}

/** A site's tile: its initial on its color, with the soft top light Apple's generated icons have. */
export function SiteTile({ title, color, size = 32, className }: { title: string; color: string; size?: number; className?: string }) {
  return (
    <span aria-hidden="true"
      className={cn('grid shrink-0 place-items-center font-semibold text-white shadow-[inset_0_0_0_.5px_rgba(0,0,0,.12)]', className)}
      style={{
        width: size, height: size, borderRadius: size * 0.24, fontSize: size * 0.46,
        background: `linear-gradient(180deg, color-mix(in oklab, ${color} 78%, white), ${color})`,
      }}>
      {title[0]}
    </span>
  );
}
