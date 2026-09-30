import { describe, expect, it } from 'vitest';
import { cn } from './utils';

/* cn() is tailwind-merge configured with the theme's tokens (generated from tokens.css): a size and a color don't
   conflict, two of the same kind collapse to the last. Without the registration `text-footnote` would be read as a
   color and swallow (or be swallowed by) `text-foreground`. */
describe('cn with the theme tokens', () => {
  it('keeps a token size next to a token color', () => {
    expect(cn('text-footnote text-foreground')).toBe('text-footnote text-foreground');
    expect(cn('text-foreground text-footnote')).toBe('text-foreground text-footnote');
  });
  it('collapses two token sizes', () => expect(cn('text-footnote text-body')).toBe('text-body'));
  it('collapses two token colors, including BL extras', () => {
    expect(cn('text-foreground text-tertiary-foreground')).toBe('text-tertiary-foreground');
    expect(cn('bg-card bg-bar')).toBe('bg-bar');
  });
  it('collapses radius, shadow and size tokens', () => {
    expect(cn('rounded-ctl rounded-card')).toBe('rounded-card');
    expect(cn('shadow-hairline shadow-hairline-b')).toBe('shadow-hairline-b');
    expect(cn('h-row h-toolbar')).toBe('h-toolbar');
  });
  it('lets a later padding utility win', () => expect(cn('px-4 py-2 pl-7')).toBe('px-4 py-2 pl-7'));
});
