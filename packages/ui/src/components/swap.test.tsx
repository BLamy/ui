// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { Swap } from './swap';

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
const views = (root: ParentNode = document) => Array.from(root.querySelectorAll('[data-slot="swap-view"]'));

describe('Swap effect="pop"', () => {
  it('shows one view at rest, without an enter on first paint, inline by default', () => {
    const { container } = render(<Swap effect="pop" value="copy">C</Swap>);
    const root = container.querySelector<HTMLElement>('[data-slot="swap"]')!;
    expect(root.tagName).toBe('SPAN');
    expect(root.dataset.effect).toBe('pop');
    expect(root.style.getPropertyValue('--swap-scale')).toBe('0.4');
    expect(views()).toHaveLength(1);
    expect(views()[0].hasAttribute('data-starting-style')).toBe(false);
  });

  it('stacks the old view leaving (data-ending-style) over the new one arriving (data-starting-style)', async () => {
    const { rerender } = render(<Swap effect="pop" value="copy">C</Swap>);
    rerender(<Swap effect="pop" value="check">✓</Swap>);
    const [old, next] = views();
    expect(old.textContent).toBe('C');
    expect(old.hasAttribute('data-ending-style')).toBe(true);
    expect(next.textContent).toBe('✓');
    expect(next.hasAttribute('data-starting-style')).toBe(true);
    await frames();
    expect(views().map((g) => g.textContent)).toEqual(['✓']);
  });

  it('does not travel even when a direction is passed', () => {
    const { container } = render(<Swap effect="pop" value={1} direction={1}>a</Swap>);
    const root = container.querySelector<HTMLElement>('[data-slot="swap"]')!;
    expect(root.style.getPropertyValue('--swap-enter')).toBe('0px');
    expect(root.hasAttribute('data-direction')).toBe(false);
  });
});

describe('Swap effect="slide"', () => {
  it('keeps the leaving view where it stood inside a padded root, not at its padding corner', () => {
    const top = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop')!;
    const left = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft')!;
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', { configurable: true, get: () => 16 });
    Object.defineProperty(HTMLElement.prototype, 'offsetLeft', { configurable: true, get: () => 16 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 200 });
    try {
      const { rerender } = render(<Swap value={1} className="p-4">one</Swap>);
      rerender(<Swap value={2} className="p-4">two</Swap>);
      const old = views()[0] as HTMLElement;
      expect(old.style.getPropertyValue('--swap-top')).toBe('16px');
      expect(old.style.getPropertyValue('--swap-left')).toBe('16px');
      expect(old.style.getPropertyValue('--swap-width')).toBe('200px');
      expect(old.className).toContain('data-ending-style:top-[var(--swap-top,0px)]');
    } finally {
      Object.defineProperty(HTMLElement.prototype, 'offsetTop', top);
      Object.defineProperty(HTMLElement.prototype, 'offsetLeft', left);
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', width);
    }
  });

  it('lifts the leaving view out of the flow while the new one arrives, in the direction of travel', async () => {
    const { rerender, container } = render(<Swap value={1} direction={1}>one</Swap>);
    rerender(<Swap value={2} direction={1}>two</Swap>);
    const root = container.querySelector<HTMLElement>('[data-slot="swap"]')!;
    expect(root.tagName).toBe('DIV');
    expect(root.dataset.direction).toBe('1');
    expect(root.style.getPropertyValue('--swap-enter')).toBe('36px');
    expect(root.style.getPropertyValue('--swap-exit')).toBe('-36px');
    expect(views(root).map((v) => v.textContent)).toEqual(['one', 'two']);
    expect(views(root)[0].hasAttribute('data-ending-style')).toBe(true);
    expect(views(root)[1].hasAttribute('data-starting-style')).toBe(true);
    await frames();
    expect(views(root)).toHaveLength(1);
  });

  it('takes a distance and a blur (the dialog title morph) and scales only when it does not travel', () => {
    const { container, rerender } = render(<Swap value="a" direction={-1} distance={40} blur={6}>A</Swap>);
    const root = container.querySelector<HTMLElement>('[data-slot="swap"]')!;
    expect(root.style.getPropertyValue('--swap-enter')).toBe('-40px');
    expect(root.style.getPropertyValue('--swap-blur')).toBe('6px');
    expect(root.style.getPropertyValue('--swap-scale')).toBe('1');
    rerender(<Swap value="a" direction={0}>A</Swap>);
    expect(root.style.getPropertyValue('--swap-scale')).toBe('0.96');
  });

  it('hides the leaving view from assistive technology and focus while it exits', async () => {
    const { rerender, container } = render(
      <Swap value="menu">
        <h2>Menu</h2>
        <button type="button">Open</button>
      </Swap>,
    );
    const root = container.querySelector<HTMLElement>('[data-slot="swap"]')!;
    expect(views(root)[0].hasAttribute('aria-hidden')).toBe(false);
    expect(views(root)[0].hasAttribute('inert')).toBe(false);
    rerender(
      <Swap value="done">
        <h2>Done</h2>
      </Swap>,
    );
    const [leaving, arriving] = views(root);
    expect(leaving.getAttribute('aria-hidden')).toBe('true');
    expect(leaving.hasAttribute('inert')).toBe(true);
    expect(arriving.hasAttribute('aria-hidden')).toBe(false);
    expect(arriving.hasAttribute('inert')).toBe(false);
    await frames();
    expect(views(root).map((v) => v.textContent)).toEqual(['Done']);
  });

  it('renders an inline slide as a span', () => {
    const { container } = render(<Swap value="a" inline>A</Swap>);
    expect(container.querySelector('[data-slot="swap"]')!.tagName).toBe('SPAN');
  });
});

describe('Swap root', () => {
  it('passes DOM props, className, style and ref through', () => {
    const ref = createRef<HTMLElement>();
    const { container } = render(
      <Swap ref={ref} value="a" id="title" aria-live="polite" data-test="x" className="extra" style={{ color: 'red' }}>A</Swap>,
    );
    const root = container.querySelector<HTMLElement>('[data-slot="swap"]')!;
    expect(ref.current).toBe(root);
    expect(root.id).toBe('title');
    expect(root.getAttribute('aria-live')).toBe('polite');
    expect(root.dataset.test).toBe('x');
    expect(root.className).toContain('extra');
    expect(root.style.color).toBe('red');
    expect(root.style.getPropertyValue('--swap-blur')).toBe('4px');
  });
});
