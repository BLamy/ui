// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AppleReminders from './page';

MotionGlobalConfig.skipAnimations = true;

/* A wide box: the SplitView's size class reads `clientWidth` as its ResizeObserver fires. */
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
const buttons = (scope: ParentNode, text: string) => [...scope.querySelectorAll<HTMLElement>('button')].filter((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(text));

it('a reminder’s subtasks open from a Collapsible trigger', async () => {
  await act(async () => root.render(<AppleReminders defaultList="family" />));
  await settle();
  const trigger = buttons(element, 'of 3 subtasks')[0];
  expect(trigger.getAttribute('data-slot')).toBe('collapsible-trigger');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(element.textContent).not.toContain('Pick a time slot');
  await act(async () => trigger.click());
  await settle();
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  const panel = document.getElementById(trigger.getAttribute('aria-controls')!)!;
  expect(panel.textContent).toContain('Pick a time slot');
});

it('Details: the Status menu is named by its trigger, and the date picks fold open with the Date switch', async () => {
  await act(async () => root.render(<AppleReminders defaultList="family" />));
  await settle();
  await act(async () => buttons(element, 'Details for “Book pumpkin patch tickets”')[0].click());
  await settle();
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(dialog).toBeTruthy();

  const status = buttons(dialog, 'Status: ')[0];
  expect(status.textContent).toMatch(/^Status: /);
  await act(async () => status.click());
  await settle();
  const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
  expect(menu.hasAttribute('aria-label')).toBe(false);
  expect(document.getElementById(menu.getAttribute('aria-labelledby')!)).toBe(status);
  await act(async () => { menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
  await settle();

  // Due in 3 days: the Date switch is on and its quick picks show; off, they fold away.
  const date = dialog.querySelector<HTMLElement>('[role="switch"][aria-checked="true"]')!;
  expect(dialog.querySelector('[role="radiogroup"][aria-label="Due date"]')).toBeTruthy();
  await act(async () => date.click());
  await settle();
  expect(dialog.querySelector('[role="radiogroup"][aria-label="Due date"]')).toBeNull();
});
