'use client';
import type { ComponentProps } from 'react';
import { useShortcutHint } from '@ui-sdk/react/shortcuts';
import { cn } from '@/lib/utils';

/* ══ Kbd — keycap ══
   <Kbd>Esc</Kbd>            // a key you spell out
   <Kbd keys="mod+k" />      // a shortcut for the reader's platform: ⌘K on Apple, Ctrl+K elsewhere
   `keys` takes UI SDK's shortcut strings (the ones `useShortcut` and a menu item's `shortcut` take). A menu or
   command item draws its own shortcut from its `shortcut` prop; Kbd is for everywhere else. With `keys`, the glyphs
   are hidden from screen readers and the keys are spelled out for them ("Command K"). */

const SPOKEN: Record<string, string> = { Meta: 'Command', Control: 'Control', Shift: 'Shift', ArrowUp: 'Up Arrow', ArrowDown: 'Down Arrow', ArrowLeft: 'Left Arrow', ArrowRight: 'Right Arrow' };

/** `aria-keyshortcuts` ("Meta+Shift+P") in words a screen reader says well ("Command Shift P"); Alt is Option where
    the glyphs are Apple's. */
function spoken(aria: string, apple: boolean): string {
  return aria
    .split(' ')
    .map((combo) => combo.split('+').map((key) => (key === 'Alt' ? (apple ? 'Option' : 'Alt') : SPOKEN[key] ?? key)).join(' '))
    .join(' or ');
}

/** The shortcut as UI SDK formats it for the platform (the same on the server and the first client render): the
    glyphs for the eye, the keys spelled out for a screen reader, which would otherwise read "⌘" as a symbol name. */
function ShortcutText({ keys }: { keys: string }) {
  const { text, ariaKeyshortcuts } = useShortcutHint(keys);
  return (
    <>
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{spoken(ariaKeyshortcuts, /[⌘⌥⌃⇧]/.test(text))}</span>
    </>
  );
}

export interface KbdProps extends ComponentProps<'kbd'> {
  /** A shortcut like `mod+k` or `shift+enter`, shown for the reader's platform in place of children. */
  keys?: string;
}

export function Kbd({ className, keys, children, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'pointer-events-none box-border inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-sm bg-secondary px-1.5 font-sans text-caption leading-none font-medium text-muted-foreground shadow-hairline-b select-none [&_svg]:size-3',
        className,
      )}
      {...props}
    >
      {keys ? <ShortcutText keys={keys} /> : children}
    </kbd>
  );
}

export function KbdGroup({ className, ...props }: ComponentProps<'span'>) {
  return <span data-slot="kbd-group" className={cn('inline-flex items-center gap-1', className)} {...props} />;
}
