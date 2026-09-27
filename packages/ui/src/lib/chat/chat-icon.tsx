import type { CSSProperties } from 'react';
import { cn } from '../utils';

export interface ChatIconProps {
  d: string;
  size?: number;
  sw?: number;
  className?: string;
  style?: CSSProperties;
}

export function ChatIcon({ d, size, sw, className, style }: ChatIconProps) {
  return (
    <svg
      data-slot="chat-icon"
      className={cn(className)}
      width={size || 16}
      height={size || 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw || 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d={d} />
    </svg>
  );
}

export const chatIconPaths = {
  hash: 'M9 4L7 20M17 4l-2 16M4 9h17M3 15h17',
  chev: 'M9 6l6 6-6 6',
  x: 'M6 6l12 12M18 6L6 18',
  send: 'M12 19V5M6 11l6-6 6 6',
  thread: 'M7 8h10M7 12h6M5 4h14v12H9l-4 4z',
  menu: 'M4 6.5h16M4 12h16M4 17.5h16',
  bell: 'M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 004 0',
  plus: 'M12 5v14M5 12h14',
  dm: 'M12 4.5c4.7 0 8.5 3 8.5 6.8s-3.8 6.8-8.5 6.8c-1 0-1.9-.1-2.8-.4L5 19.5l1.1-3.4C4.5 14.9 3.5 13.2 3.5 11.3c0-3.8 3.8-6.8 8.5-6.8z',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6z',
  spark: 'M12 3l2.2 6.2L20 12l-5.8 2.8L12 21l-2.2-6.2L4 12l5.8-2.8z',
  people:
    'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5M16 4.6a3.5 3.5 0 010 6.8M18 15c2.1.7 3.5 2.2 3.5 5',
} as const;
