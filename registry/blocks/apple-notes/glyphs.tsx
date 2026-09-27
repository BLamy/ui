/* SF Symbols-style glyphs for Notes, drawn on a 24px grid with round caps so they sit with the library's Icon set. */
import type { ReactNode } from 'react';

const GLYPHS = {
  folder: <path d="M3.8 7.2c0-.9.7-1.6 1.6-1.6h4.1l1.9 2h7.2c.9 0 1.6.7 1.6 1.6v8.6c0 .9-.7 1.6-1.6 1.6H5.4c-.9 0-1.6-.7-1.6-1.6z" />,
  folderGear: <><path d="M11 18.8H5.4c-.9 0-1.6-.7-1.6-1.6V7.2c0-.9.7-1.6 1.6-1.6h4.1l1.9 2h7.2c.9 0 1.6.7 1.6 1.6v2.3" /><circle cx="17.2" cy="16.4" r="1.6" /><path d="M17.2 12.6v1.2M17.2 19v1.2M13.4 16.4h1.2M19.8 16.4H21M14.5 13.7l.8.8M19.1 18.3l.8.8M14.5 19.1l.8-.8M19.1 14.5l.8-.8" /></>,
  folderPlus: <><path d="M3.8 7.2c0-.9.7-1.6 1.6-1.6h4.1l1.9 2h7.2c.9 0 1.6.7 1.6 1.6v8.6c0 .9-.7 1.6-1.6 1.6H5.4c-.9 0-1.6-.7-1.6-1.6z" /><path d="M12 10.6v5.6M9.2 13.4h5.6" /></>,
  trash: <><path d="M5 7h14" /><path d="M9.3 7V5.4c0-.8.6-1.4 1.4-1.4h2.6c.8 0 1.4.6 1.4 1.4V7" /><path d="M7 7l.9 11.1c.1 1.1 1 1.9 2.1 1.9h4c1.1 0 2-.8 2.1-1.9L17 7" /></>,
  compose: <><path d="M11.5 4.5H6.2c-.9 0-1.7.8-1.7 1.7v11.6c0 .9.8 1.7 1.7 1.7h11.6c.9 0 1.7-.8 1.7-1.7v-5.3" /><path d="M17.6 3.9a1.9 1.9 0 0 1 2.6 2.6L12.4 14.3l-3.5.9.9-3.5z" /></>,
  list: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.8" cy="6.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="4.8" cy="12" r="1.1" fill="currentColor" stroke="none" /><circle cx="4.8" cy="17.5" r="1.1" fill="currentColor" stroke="none" /></>,
  gallery: <><rect x="4" y="4" width="7" height="7" rx="1.6" /><rect x="13" y="4" width="7" height="7" rx="1.6" /><rect x="4" y="13" width="7" height="7" rx="1.6" /><rect x="13" y="13" width="7" height="7" rx="1.6" /></>,
  format: <><path d="M3 18.5L7.6 6.5h.8l4.6 12M4.6 14.4h6.8" /><path d="M20.6 18.5v-5.6a2.6 2.6 0 0 0-5-1M15.2 15.9c0-1.5 1.4-2.2 3.3-2.2h2.1v1.5a2.5 2.5 0 0 1-2.6 2.4c-1.6 0-2.8-.5-2.8-1.7z" /></>,
  checklist: <><circle cx="6" cy="7" r="2.4" /><path d="M4.9 7.1l.8.8 1.5-1.6" /><circle cx="6" cy="17" r="2.4" /><path d="M11 7h9.5M11 17h9.5" /></>,
  table: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M3.5 14.5h17M9.2 9.5v10M14.8 9.5v10" /></>,
  lock: <><rect x="5.5" y="10.6" width="13" height="9.4" rx="2" /><path d="M8.4 10.6V7.8a3.6 3.6 0 0 1 7.2 0v2.8" /></>,
  lockOpen: <><rect x="5.5" y="10.6" width="13" height="9.4" rx="2" /><path d="M8.4 10.6V7.8a3.6 3.6 0 0 1 6.9-1.4" /></>,
  lockFill: <><rect x="5.5" y="10.6" width="13" height="9.4" rx="2" fill="currentColor" /><path d="M8.4 10.6V7.8a3.6 3.6 0 0 1 7.2 0v2.8" /></>,
  share: <><path d="M12 3.8v11" /><path d="M8.2 7.4L12 3.6l3.8 3.8" /><path d="M8.5 10.5H7c-.9 0-1.6.7-1.6 1.6v6.6c0 .9.7 1.6 1.6 1.6h10c.9 0 1.6-.7 1.6-1.6v-6.6c0-.9-.7-1.6-1.6-1.6h-1.5" /></>,
  pin: <><path d="M9 3.8h6M10.2 4v5.2L7.4 12.6v1.6h9.2v-1.6l-2.8-3.4V4" /><path d="M12 14.2v6" /></>,
  pinFill: <><path d="M9 3.8h6M10.2 4v5.2L7.4 12.6v1.6h9.2v-1.6l-2.8-3.4V4z" fill="currentColor" /><path d="M12 14.2v6" /></>,
  pinSlash: <><path d="M9 3.8h6M10.2 4v5.2L7.4 12.6v1.6h9.2v-1.6l-2.8-3.4V4" /><path d="M12 14.2v6M4 4l16 16" /></>,
  ellipsis: <><circle cx="12" cy="12" r="8.6" /><circle cx="8.2" cy="12" r="1.25" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" /><circle cx="15.8" cy="12" r="1.25" fill="currentColor" stroke="none" /></>,
  link: <><path d="M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.9-2.9a3.6 3.6 0 0 0-5.1-5.1l-1.2 1.2" /><path d="M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.9 2.9a3.6 3.6 0 0 0 5.1 5.1l1.2-1.2" /></>,
  mail: <><path d="M3.5 6.5a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" /><path d="M4 7l8 6 8-6" /></>,
  people: <><circle cx="9" cy="8.8" r="3" /><path d="M3.6 18.6c.9-2.7 3-4.1 5.4-4.1s4.5 1.4 5.4 4.1" /><circle cx="16.8" cy="9.6" r="2.4" /><path d="M16.4 14.7c2.1.2 3.6 1.4 4.3 3.4" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  tag: <><path d="M3.8 12.6V4.8a1 1 0 0 1 1-1h7.8l7.6 7.6a1 1 0 0 1 0 1.4l-7.8 7.8a1 1 0 0 1-1.4 0z" /><circle cx="8.4" cy="8.4" r="1.4" /></>,
  note: <><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></>,
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
