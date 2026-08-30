import * as React from 'react';
import { cn } from './util';

/* ══ icons ══ */
const WIC: Record<string, { d: string }[]> = {
  sidebar: [{ d: 'M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5z' }, { d: 'M9 5.5v13' }],
  panelR: [{ d: 'M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5z' }, { d: 'M15 5.5v13' }],
  panelB: [{ d: 'M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5z' }, { d: 'M2.5 13.5h19' }],
  compose: [{ d: 'M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5' }, { d: 'M17.3 4.2a1.9 1.9 0 0 1 2.7 2.7l-7.6 7.6-3.4.7.7-3.4z' }],
  search: [{ d: 'M10.8 4a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6z' }, { d: 'M15.9 15.9L20.5 20.5' }],
  folder: [{ d: 'M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9.5V17A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z' }],
  folderP: [{ d: 'M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9.5V17A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z' }, { d: 'M12 11.2v4M10 13.2h4' }],
  plus: [{ d: 'M12 5v14M5 12h14' }],
  chevD: [{ d: 'M6 9.5l6 6 6-6' }],
  chevR: [{ d: 'M9.5 6l6 6-6 6' }],
  chevU: [{ d: 'M6 14.5l6-6 6 6' }],
  x: [{ d: 'M6 6l12 12M18 6L6 18' }],
  gear: [{ d: 'M12 8.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8z' }, { d: 'M12 2.8l.9 2.4a7 7 0 0 1 2.1.9l2.4-1 1.5 1.5-1 2.4c.4.6.7 1.3.9 2.1l2.4.9v2l-2.4.9a7 7 0 0 1-.9 2.1l1 2.4-1.5 1.5-2.4-1a7 7 0 0 1-2.1.9l-.9 2.4h-2l-.9-2.4a7 7 0 0 1-2.1-.9l-2.4 1-1.5-1.5 1-2.4a7 7 0 0 1-.9-2.1l-2.4-.9v-2l2.4-.9c.2-.8.5-1.5.9-2.1l-1-2.4L6.1 5l2.4 1a7 7 0 0 1 2.1-.9l.9-2.4z' }],
  term: [{ d: 'M4 5h16a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 4 5z' }, { d: 'M6.5 9l3 3-3 3M12 15h5' }],
  globe: [{ d: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z' }, { d: 'M3 12h18M12 3c2.6 2.3 4 5.5 4 9s-1.4 6.7-4 9c-2.6-2.3-4-5.5-4-9s1.4-6.7 4-9z' }],
  files: [{ d: 'M8 7.5V5.4A1.4 1.4 0 0 1 9.4 4h9.2A1.4 1.4 0 0 1 20 5.4v9.2a1.4 1.4 0 0 1-1.4 1.4h-2.1' }, { d: 'M4 9.4A1.4 1.4 0 0 1 5.4 8h9.2A1.4 1.4 0 0 1 16 9.4v9.2a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 18.6z' }],
  diff: [{ d: 'M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5z' }, { d: 'M13.5 3.5V8.5h5M9.4 12h5.2M12 15.8h-2.6' }],
  bot: [{ d: 'M7 9.5h10A2.5 2.5 0 0 1 19.5 12v4A2.5 2.5 0 0 1 17 18.5H7A2.5 2.5 0 0 1 4.5 16v-4A2.5 2.5 0 0 1 7 9.5z' }, { d: 'M12 9.5V6.2M12 6a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zM9 13.3v1.4M15 13.3v1.4' }],
  expand: [{ d: 'M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5L14 10M4.5 19.5L10 14' }],
  restore: [{ d: 'M9.5 4v5.5H4M14.5 20v-5.5H20M9.5 9.5L4 4M14.5 14.5L20 20' }],
  up: [{ d: 'M12 19V5M6 11l6-6 6 6' }],
  stop: [{ d: 'M8 8h8v8H8z' }],
  branch: [{ d: 'M7 4.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM7 15.9a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM17 6.1a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z' }, { d: 'M7 8.1v7.8M17 9.7c0 3.2-3.4 3.5-6 4.1a4.3 4.3 0 0 0-2.7 1.5' }],
  trash: [{ d: 'M5 7h14M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M7 7l.8 12a1.4 1.4 0 0 0 1.4 1.3h5.6a1.4 1.4 0 0 0 1.4-1.3L17 7' }],
  split: [{ d: 'M5 4.5h14A1.5 1.5 0 0 1 20.5 6v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5z' }, { d: 'M12 4.5v15' }],
  check: [{ d: 'M4.5 12.5l5 5 10-11' }],
  checkC: [{ d: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z' }, { d: 'M8.2 12.4l2.6 2.6 5-5.6' }],
  clock: [{ d: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z' }, { d: 'M12 7.5V12l3.2 2' }],
  lock: [{ d: 'M7 10.5V8a5 5 0 0 1 10 0v2.5' }, { d: 'M6.5 10.5h11A1.5 1.5 0 0 1 19 12v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18v-6a1.5 1.5 0 0 1 1.5-1.5z' }],
  spark: [{ d: 'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9' }],
  doc: [{ d: 'M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5z' }, { d: 'M13.5 3.5V8.5h5' }],
  msg: [{ d: 'M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 3.5z' }],
  dl: [{ d: 'M12 4v11M7 10.5l5 5 5-5M5 19.5h14' }],
  at: [{ d: 'M12 8a4 4 0 1 0 4 4v-4' }, { d: 'M16 12a4 4 0 1 1-1.2-2.9' }, { d: 'M12 3a9 9 0 1 0 6.4 15.3' }],
  hamburger: [{ d: 'M4 6.5h16M4 12h16M4 17.5h16' }],
  play: [{ d: 'M8 5.5l11 6.5-11 6.5z' }],
};

export type WIconName = keyof typeof WIC | (string & {});

export interface WIconProps {
  name: WIconName;
  size?: number;
  sw?: number;
  style?: React.CSSProperties;
}
export function WIcon({ name, size, sw, style }: WIconProps) {
  const s = size || 20;
  const w = sw || 1.7;
  const els = WIC[name as string] || WIC['doc'];
  return (
    <svg
      data-slot="wicon"
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {els.map((e, i) => (
        <path key={i} d={e.d} />
      ))}
    </svg>
  );
}

export interface IconBtnProps {
  name: WIconName;
  label: string;
  onPress?: () => void;
  size?: number;
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function IconBtn({ name, label, onPress, size, active, className, style }: IconBtnProps) {
  return (
    <button
      type="button"
      data-slot="icon-btn"
      className={cn('wb-btn wb-hl', className)}
      onClick={onPress}
      aria-label={label}
      title={label}
      style={{
        border: 0,
        background: active ? 'var(--wb-fill)' : 'none',
        color: active ? 'var(--wb-label)' : 'var(--wb-label2)',
        cursor: 'pointer',
        borderRadius: 7,
        padding: 5,
        display: 'grid',
        placeItems: 'center',
        ...style,
      }}
    >
      <WIcon name={name} size={size || 18} />
    </button>
  );
}
