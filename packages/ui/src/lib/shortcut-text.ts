import { formatShortcut } from '@ui-sdk/core';

/* ══ Shortcut text — one rendering of `mod+shift+s` for every popup ══
   UI SDK formats a shortcut for the platform (`⌘⇧S` on Apple platforms, `Ctrl+Shift+S` elsewhere) in the order it
   was written. Apple's menus always list modifiers as ⌃⌥⇧⌘, whatever order you type them, so the kit puts the glyph
   form in that order: TooltipShortcut, DropdownMenuShortcut (and an item's `shortcut`) and CommandMenuShortcut all
   read the same. The text form keeps its written order, which is how Windows and Linux spell shortcuts. */

const APPLE_ORDER = '⌃⌥⇧⌘';
const ISOLATES = /[⁦-⁩]/g;

/** The caps of a formatted shortcut: `⇧⌘S` → `['⇧', '⌘', 'S']` (modifiers in Apple's order), `Ctrl+Shift+S` →
    `['Ctrl', 'Shift', 'S']`. Takes UI SDK's formatted text (direction isolates are dropped). */
export function shortcutKeys(text: string): string[] {
  const keys = text.replace(ISOLATES, '');
  const [, modifiers = '', key = ''] = /^([⌃⌥⇧⌘]*)(.*)$/u.exec(keys) ?? [];
  if (modifiers) return [...[...modifiers].sort((a, b) => APPLE_ORDER.indexOf(a) - APPLE_ORDER.indexOf(b)), key].filter(Boolean);
  return keys.split(/\+(?=.)/).filter(Boolean);
}

/** Whether a formatted shortcut is the glyph form (`⌘S`), which reads as one word, not the text form (`Ctrl+S`). */
export function isGlyphShortcut(text: string): boolean {
  return !/\+./.test(text.replace(ISOLATES, ''));
}

/** A formatted shortcut as one string, modifiers in Apple's order on Apple platforms: `⇧⌘S`, `Ctrl+Shift+S`. */
export function shortcutText(text: string): string {
  const caps = shortcutKeys(text);
  return isGlyphShortcut(text) ? caps.join('') : caps.join('+');
}

/** Formats a shortcut written like `mod+shift+s` for this platform, in the kit's order. */
export function formatShortcutText(shortcut: string, apple?: boolean): string {
  return shortcutText(formatShortcut(shortcut, apple));
}
