import type { CSSProperties } from 'react';
import { Icon } from '../icon';
import { cn } from '../utils';

/* TEMPORARY (2.0 phase 3 removes this file): registry/blocks/discord-clone still imports ChatIcon/chatIconPaths and
   can't be edited until the blocks refactor lands. The geometry now lives in `Icon` (lib/icon-shapes/chat.ts); these
   names only forward to it. Use `<Icon name="…" size={16} sw={1.9} />` instead. */

/** @deprecated Use `Icon` names: hash → `number`, chev → `chevron-right-compact`, x → `xmark-large`, send →
    `arrow-up-compact`, thread → `text-bubble`, menu → `line-3-horizontal`, bell → `bell-simple`, plus → `plus`,
    dm → `bubble-oval`, bolt → `bolt-simple`, spark → `sparkle`, people → `people-simple`. */
export const chatIconPaths = {
  hash: 'number',
  chev: 'chevron-right-compact',
  x: 'xmark-large',
  send: 'arrow-up-compact',
  thread: 'text-bubble',
  menu: 'line-3-horizontal',
  bell: 'bell-simple',
  plus: 'plus',
  dm: 'bubble-oval',
  bolt: 'bolt-simple',
  spark: 'sparkle',
  people: 'people-simple',
} as const;

/** @deprecated Use `Icon`. */
export interface ChatIconProps {
  /** An Icon name (a `chatIconPaths` value). */
  d: string;
  size?: number;
  sw?: number;
  className?: string;
  style?: CSSProperties;
}

/** @deprecated Use `<Icon name size sw={1.9} />` (ChatIcon was an inline svg: 16px, stroke 1.9). */
export function ChatIcon({ d, size, sw, className, style }: ChatIconProps) {
  return <Icon name={d} size={size || 16} sw={sw || 1.9} className={cn('inline', className)} style={style} />;
}
