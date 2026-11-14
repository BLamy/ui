// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StrudelStudio from './page';

/* The block's box is as wide as the test says: BLProvider's size class reads `clientWidth` as its ResizeObserver fires. */
let width = 1280;
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
class FakeResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe(el: Element) { this.cb([{ target: el } as ResizeObserverEntry], this as unknown as ResizeObserver); }
  unobserve() { /* the boxes never change */ }
  disconnect() { /* nothing to stop */ }
}

let element: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
  element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.unstubAllGlobals();
  if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
});

it.each([[1280, 'regular'], [800, 'medium']])('splits the panes from its own size class, not the viewport (%ipx: %s)', async (w, sizeClass) => {
  width = w;
  await act(async () => root.render(<StrudelStudio />));
  const provider = element.querySelector<HTMLElement>('[data-slot="bl-provider"]')!;
  expect(provider.getAttribute('data-size-class')).toBe(sizeClass);
  expect(provider.classList.contains('group/studio')).toBe(true);
  const panes = element.querySelector('[role="tablist"]')!.closest('.grid')!;
  expect(panes.className).toContain('group-data-[size-class=regular]/studio:grid-cols-');
  expect(panes.className).not.toMatch(/(^|\s)lg:/);
});

it('the code is a UI SDK Textarea that rewrites the song as you type', async () => {
  await act(async () => root.render(<StrudelStudio />));
  const code = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="Strudel code"]')!;
  expect(code.getAttribute('data-slot')).toBe('textarea');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(code, 'setcps(1)\n');
    code.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(code.value).toBe('setcps(1)\n');
});
