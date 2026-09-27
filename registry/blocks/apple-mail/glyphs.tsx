/* SF Symbols-style glyphs for Mail, drawn on a 24px grid with round caps so they sit with the library's Icon set. */
import type { ReactNode } from 'react';

const dot = (cx: number) => <circle cx={cx} cy="12" r="1.25" fill="currentColor" stroke="none" />;

const GLYPHS = {
  tray: <><path d="M3.5 13.5l2.4-7.2a1.5 1.5 0 0 1 1.4-1.1h9.4a1.5 1.5 0 0 1 1.4 1.1l2.4 7.2v4.3a1.5 1.5 0 0 1-1.5 1.5h-14a1.5 1.5 0 0 1-1.5-1.5z" /><path d="M3.5 13.5h4.6l1.3 2.3h5.2l1.3-2.3h4.6" /></>,
  star: <path d="M12 3.8l2.34 4.98 5.26.66-3.87 3.74 1 5.42L12 15.98 7.27 18.6l1-5.42L4.4 9.44l5.26-.66L12 3.8z" />,
  flag: <><path d="M5.5 21V4.6" /><path d="M5.5 4.8c2.2-1.2 4.2-1.2 6.3 0s4.1 1.2 6.4 0v8.6c-2.3 1.2-4.3 1.2-6.4 0s-4.1-1.2-6.3 0" /></>,
  flagFill: <><path d="M5.5 21V4.6" /><path d="M5.5 4.8c2.2-1.2 4.2-1.2 6.3 0s4.1 1.2 6.4 0v8.6c-2.3 1.2-4.3 1.2-6.4 0s-4.1-1.2-6.3 0z" fill="currentColor" /></>,
  doc: <><path d="M7 3.8h6.6l4.4 4.4v12H7z" /><path d="M13.4 3.8v4.6H18" /></>,
  paperplane: <><path d="M20.5 3.5L3.5 10.6l6.6 2.8 2.8 6.6z" /><path d="M20.5 3.5l-10.4 9.9" /></>,
  junk: <><path d="M3.5 5h17v4h-17z" /><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9" /><path d="M10 12.5l4 4M14 12.5l-4 4" /></>,
  trash: <><path d="M5 7h14" /><path d="M9.3 7V5.4c0-.8.6-1.4 1.4-1.4h2.6c.8 0 1.4.6 1.4 1.4V7" /><path d="M7 7l.9 11.1c.1 1.1 1 1.9 2.1 1.9h4c1.1 0 2-.8 2.1-1.9L17 7" /></>,
  archive: <><path d="M3.5 5h17v4h-17z" /><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9" /><path d="M10 13h4" /></>,
  folder: <path d="M3.8 7.2c0-.9.7-1.6 1.6-1.6h4.1l1.9 2h7.2c.9 0 1.6.7 1.6 1.6v8.6c0 .9-.7 1.6-1.6 1.6H5.4c-.9 0-1.6-.7-1.6-1.6z" />,
  gear: <><circle cx="12" cy="12" r="2.8" /><path d="M10.3 3.6h3.4l.5 2.3 1.6.9 2.2-.8 1.7 2.9-1.8 1.6v1.9l1.8 1.6-1.7 2.9-2.2-.8-1.6.9-.5 2.3h-3.4l-.5-2.3-1.6-.9-2.2.8-1.7-2.9 1.8-1.6v-1.9L4.3 8.9 6 6l2.2.8 1.6-.9z" /></>,
  clock: <><circle cx="12" cy="12" r="8.4" /><path d="M12 7.2V12l3.1 1.9" /></>,
  envelope: <><path d="M3.5 6.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" /><path d="M4 7l8 6 8-6" /></>,
  envelopeOpen: <><path d="M3.5 10l8.5-5.8 8.5 5.8v8.5a1.5 1.5 0 0 1-1.5 1.5h-14a1.5 1.5 0 0 1-1.5-1.5z" /><path d="M3.8 10.3l8.2 5.4 8.2-5.4" /></>,
  envelopeBadge: <><path d="M13 5.5H4.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1V12" /><path d="M4 7l8 6 3.2-2.4" /><circle cx="18.5" cy="6.5" r="2.6" fill="currentColor" stroke="none" /></>,
  paperclip: <path d="M19.5 11.2l-7.6 7.6a4.6 4.6 0 0 1-6.5-6.5l8.1-8.1a3.1 3.1 0 0 1 4.4 4.4l-8 8a1.55 1.55 0 0 1-2.2-2.2l7.3-7.3" />,
  reply: <><path d="M9.5 7.5L4.5 12l5 4.5" /><path d="M4.8 12H14a5.5 5.5 0 0 1 5.5 5.5V19" /></>,
  replyAll: <><path d="M12.5 7.5L8 12l4.5 4.5" /><path d="M7.5 7.5L3 12l4.5 4.5" /><path d="M8.3 12H15a5 5 0 0 1 5 5v1.5" /></>,
  forward: <><path d="M14.5 7.5l5 4.5-5 4.5" /><path d="M19.2 12H10a5.5 5.5 0 0 0-5.5 5.5V19" /></>,
  compose: <><path d="M11.5 4.5H6.2c-.9 0-1.7.8-1.7 1.7v11.6c0 .9.8 1.7 1.7 1.7h11.6c.9 0 1.7-.8 1.7-1.7v-5.3" /><path d="M17.6 3.9a1.9 1.9 0 0 1 2.6 2.6L12.4 14.3l-3.5.9.9-3.5z" /></>,
  filter: <><circle cx="12" cy="12" r="8.6" /><path d="M8 9.3h8M9.6 12.3h4.8M11 15.3h2" /></>,
  filterFill: <><circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" /><path d="M8 9.3h8M9.6 12.3h4.8M11 15.3h2" stroke="var(--bl-bg,#fff)" /></>,
  ellipsis: <><circle cx="12" cy="12" r="8.6" />{dot(8.2)}{dot(12)}{dot(15.8)}</>,
  up: <path d="M6 14.5l6-6 6 6" />,
  down: <path d="M6 9.5l6 6 6-6" />,
  send: <><circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none" /><path d="M12 16.6V7.8M8.3 11.4L12 7.7l3.7 3.7" stroke="var(--bl-on-tint,#fff)" strokeWidth="2.2" /></>,
  image: <><path d="M3.8 5.8h16.4v12.4H3.8z" /><circle cx="9" cy="10" r="1.6" /><path d="M4.5 17l5.2-4.6 3.6 3.1 2.4-2.1 4 3.6" /></>,
  zip: <><path d="M7 3.8h6.6l4.4 4.4v12H7z" /><path d="M11 5v2M11 9v2M11 13v2" /></>,
  pdf: <><path d="M7 3.8h6.6l4.4 4.4v12H7z" /><path d="M13.4 3.8v4.6H18" /><path d="M9.6 13h5M9.6 16h3.4" /></>,
} satisfies Record<string, ReactNode>;

export type GlyphName = keyof typeof GLYPHS;

export function G({ name, size = 22, sw = 1.8, className }: { name: GlyphName; size?: number; sw?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" className={className} style={{ flexShrink: 0, display: 'block' }}>
      {GLYPHS[name]}
    </svg>
  );
}
