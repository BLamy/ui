// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IconSwap } from './icon-swap';
import { ContentSwap } from './animated-height';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
afterEach(cleanup);

/* happy-dom runs no CSS transitions, so every exit would finish at once. Give each element a 30 ms transition, as a
   browser would report it, so the tests see the exit while it plays. */
function fakeTransitions() {
  const style = document.createElement('style');
  style.textContent = '* { transition-duration: 0.03s; transition-delay: 0s; animation-duration: 0s; animation-delay: 0s; animation-iteration-count: 1 }';
  document.head.append(style);
  const original = HTMLElement.prototype.getAnimations;
  HTMLElement.prototype.getAnimations = function () {
    const finished = new Promise<void>((resolve) => setTimeout(resolve, 30));
    return [{ transitionProperty: 'opacity', finished, finish: () => undefined, effect: { getComputedTiming: () => ({ endTime: 30, localTime: 0 }) } }] as unknown as Animation[];
  };
  return () => {
    HTMLElement.prototype.getAnimations = original;
    style.remove();
  };
}
let restore: () => void = () => {};
beforeEach(() => {
  restore = fakeTransitions();
});
afterEach(() => restore());

const frames = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 150)); });
const glyphs = () => Array.from(document.querySelectorAll('[data-slot="icon-swap-glyph"]'));

describe('IconSwap', () => {
  it('shows one glyph at rest, without an enter on first paint', () => {
    render(<IconSwap id="copy">C</IconSwap>);
    expect(glyphs()).toHaveLength(1);
    expect(glyphs()[0].hasAttribute('data-starting-style')).toBe(false);
  });

  it('stacks the old glyph leaving (data-ending-style) over the new one arriving (data-starting-style)', async () => {
    const { rerender } = render(<IconSwap id="copy">C</IconSwap>);
    rerender(<IconSwap id="check">✓</IconSwap>);
    const [old, next] = glyphs();
    expect(old.textContent).toBe('C');
    expect(old.hasAttribute('data-ending-style')).toBe(true);
    expect(next.textContent).toBe('✓');
    expect(next.hasAttribute('data-starting-style')).toBe(true);
    await frames();
    expect(glyphs().map((g) => g.textContent)).toEqual(['✓']);
  });
});

describe('ContentSwap', () => {
  it('lifts the leaving view out of the flow while the new one arrives, in the direction of travel', async () => {
    const { rerender, container } = render(
      <ContentSwap id={1} direction={1}>
        one
      </ContentSwap>,
    );
    rerender(
      <ContentSwap id={2} direction={1}>
        two
      </ContentSwap>,
    );
    const root = container.querySelector<HTMLElement>('[data-slot="content-swap"]')!;
    expect(root.style.getPropertyValue('--swap-enter')).toBe('36px');
    expect(root.style.getPropertyValue('--swap-exit')).toBe('-36px');
    const views = Array.from(root.querySelectorAll('[data-slot="content-swap-view"]'));
    expect(views.map((v) => v.textContent)).toEqual(['one', 'two']);
    expect(views[0].hasAttribute('data-ending-style')).toBe(true);
    expect(views[1].hasAttribute('data-starting-style')).toBe(true);
    await frames();
    expect(root.querySelectorAll('[data-slot="content-swap-view"]')).toHaveLength(1);
  });
});
