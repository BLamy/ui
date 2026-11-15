// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TextMorph } from './text-morph';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
afterEach(cleanup);

/* happy-dom has no layout. Give it a tiny one: every character is 10px wide, and a root with `px-2` adds 8px of
   padding on each side. An inline `width: Npx` on the root wins, as it would in a browser. */
const CH = 10;
const padOf = (el: Element) => (el.classList.contains('px-2') ? 8 : 0);
const rootOf = (n: Node | null): HTMLElement | null => {
  let el = n instanceof HTMLElement ? n : n?.parentElement ?? null;
  while (el && el.dataset.slot !== 'text-morph') el = el.parentElement;
  return el;
};
const runText = (root: HTMLElement) => root.firstElementChild?.textContent ?? '';
const naturalWidth = (root: HTMLElement) => runText(root).length * CH + 2 * padOf(root);
const rect = (left: number, width: number) =>
  ({ left, top: 0, right: left + width, bottom: 20, width, height: 20, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;

const saved: Record<string, PropertyDescriptor | undefined> = {};
beforeAll(() => {
  // happy-dom's Web Animations reject `finished` on cancel; framer-motion falls back to its JS driver without them.
  saved.animate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
  delete (Element.prototype as unknown as Record<string, unknown>).animate;
  saved.offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  saved.elRect = Object.getOwnPropertyDescriptor(Element.prototype, 'getBoundingClientRect');
  saved.rangeRect = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect');
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      if (this.dataset.slot !== 'text-morph') return 0;
      const pinned = /^([\d.]+)px$/.exec(this.style.width);
      return pinned ? Number(pinned[1]) : naturalWidth(this);
    },
  });
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLElement) { return rect(0, this.offsetWidth ?? 0); },
  });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: Range) {
      const root = rootOf(this.startContainer);
      return rect((root ? padOf(root) : 0) + this.startOffset * CH, (this.endOffset - this.startOffset) * CH);
    },
  });
});
afterAll(() => {
  if (saved.animate) Object.defineProperty(Element.prototype, 'animate', saved.animate);
  for (const [key, target] of [['offsetWidth', HTMLElement.prototype], ['elRect', Element.prototype], ['rangeRect', Range.prototype]] as const) {
    const name = key === 'offsetWidth' ? 'offsetWidth' : 'getBoundingClientRect';
    if (saved[key]) Object.defineProperty(target, name, saved[key]);
    else delete (target as unknown as Record<string, unknown>)[name];
  }
});

const settle = () => act(() => new Promise((r) => setTimeout(r, 1000)));
const root = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-slot=text-morph]')!;

describe('TextMorph', () => {
  it('renders plain text with no inline width at rest', () => {
    const { container } = render(<TextMorph>Continue</TextMorph>);
    expect(root(container).textContent).toBe('Continue');
    expect(root(container).style.width).toBe('');
    expect(root(container).hasAttribute('data-morphing')).toBe(false);
  });

  it('pins the width only while a morph runs, and releases it when the morph ends', async () => {
    const { container, rerender } = render(<TextMorph>Continue</TextMorph>);
    rerender(<TextMorph>Sent</TextMorph>);
    expect(root(container).hasAttribute('data-morphing')).toBe(true);
    expect(root(container).style.width).toMatch(/px$/);
    await settle();
    expect(root(container).hasAttribute('data-morphing')).toBe(false);
    expect(root(container).style.width).toBe('');
    expect(root(container).textContent).toBe('Sent');
  });

  it('pins the border box of a padded root, not the text run', async () => {
    const { container, rerender } = render(<TextMorph className="px-2">Continue</TextMorph>);
    rerender(<TextMorph className="px-2">Sent</TextMorph>);
    // The morph starts from the old box: 8 letters + 16px padding.
    expect(root(container).style.width).toBe(`${8 * CH + 16}px`);
    await settle();
    expect(root(container).style.width).toBe('');
  });

  it('releases the width when a morph is interrupted by another one', async () => {
    const { container, rerender } = render(<TextMorph>Continue</TextMorph>);
    rerender(<TextMorph>Confirm</TextMorph>);
    await act(() => new Promise((r) => setTimeout(r, 200)));
    rerender(<TextMorph>Sending…</TextMorph>);
    expect(root(container).hasAttribute('data-morphing')).toBe(true);
    await settle();
    expect(root(container).hasAttribute('data-morphing')).toBe(false);
    expect(root(container).style.width).toBe('');
  });

  it('keeps a width the caller set once the morph ends', async () => {
    const { container, rerender } = render(<TextMorph style={{ width: 200 }}>Continue</TextMorph>);
    rerender(<TextMorph style={{ width: 200 }}>Sent</TextMorph>);
    await settle();
    expect(root(container).style.width).toBe('200px');
  });

  it('swaps at once, with no width, for multi-line text', () => {
    const { container, rerender } = render(<TextMorph>Continue</TextMorph>);
    rerender(<TextMorph>{'Two\nlines'}</TextMorph>);
    expect(root(container).hasAttribute('data-morphing')).toBe(false);
    expect(root(container).style.width).toBe('');
  });
});
