// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SplitViewRemindersDemo } from './demos';

let element: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.unstubAllGlobals();
});
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

it('the Reminders demo’s rows are the kit’s Checkbox, named by their text and checked by the row', async () => {
  await act(async () => root.render(<SplitViewRemindersDemo />));
  await settle();
  const boxes = [...element.querySelectorAll<HTMLElement>('[role="checkbox"]')];
  expect(boxes.length).toBeGreaterThan(0);
  expect(element.querySelector('input.sr-only')).toBeNull();
  const box = boxes[0];
  const row = box.closest('label')!;
  expect(box.getAttribute('aria-checked')).toBe('false');
  // Pressing the row's text checks it, as a label does.
  await act(async () => row.querySelector<HTMLElement>('span.truncate')!.click());
  expect(box.getAttribute('aria-checked')).toBe('true');
  expect(box.hasAttribute('data-checked')).toBe(true);
  await act(async () => box.click());
  expect(box.getAttribute('aria-checked')).toBe('false');
});
