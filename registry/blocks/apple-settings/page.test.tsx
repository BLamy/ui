// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AppleSettings from './page';

MotionGlobalConfig.skipAnimations = true;

/* Wide enough for the macOS layout: the SplitView's size class reads `clientWidth` as its ResizeObserver fires. */
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
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1280 });
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
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

it('the macOS pop-up button is a Select named by its row, holding the value', async () => {
  await act(async () => root.render(<AppleSettings initialPath={['wifi']} />));
  await settle();
  const trigger = element.querySelector<HTMLElement>('[role="combobox"][aria-label="Ask to Join Networks"]')!;
  expect(trigger).toBeTruthy();
  expect(trigger.textContent).toContain('Notify');

  await act(async () => trigger.click());
  await settle();
  const listbox = document.querySelector<HTMLElement>('[role="listbox"]')!;
  expect(listbox).toBeTruthy();
  const selected = listbox.querySelector('[role="option"][aria-selected="true"]');
  expect(selected?.textContent).toContain('Notify');
  const ask = [...listbox.querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent?.includes('Ask'))!;
  await act(async () => ask.click());
  await settle();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(trigger.textContent).toContain('Ask');
  expect(document.activeElement).toBe(trigger);
});

it('turning Wi-Fi off folds the network sections away (a Collapsible the switch drives)', async () => {
  await act(async () => root.render(<AppleSettings initialPath={['wifi']} />));
  await settle();
  expect(element.textContent).toContain('NETGEAR-4F2C');
  const wifi = [...element.querySelectorAll<HTMLElement>('[role="switch"]')].find((s) => (s.getAttribute('aria-label') ?? s.closest('[data-slot]')?.textContent ?? '').includes('Wi-Fi'))!;
  expect(wifi).toBeTruthy();
  await act(async () => wifi.click());
  await settle();
  expect(element.textContent).not.toContain('NETGEAR-4F2C');
  await act(async () => wifi.click());
  await settle();
  expect(element.querySelector('[data-slot="collapsible-panel"]')?.textContent).toContain('Lamy Home 5G');
});
