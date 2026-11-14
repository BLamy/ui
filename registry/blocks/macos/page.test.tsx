// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDemoTailnet } from '../safari/data';
import MacOS from './page';

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

const settle = (ms = 50) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const alfred = () => element.querySelector<HTMLElement>('[data-slot=macos-alfred]');
const input = () => alfred()?.querySelector<HTMLInputElement>('input[role=combobox]') ?? null;
const escape = (el: Element) => act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });

it('Alfred comes and goes through the kit presence: Escape plays its exit and unmounts it, the hint brings it back focused', async () => {
  await act(async () => { root.render(<MacOS record={false} tailscale={createDemoTailnet().options} />); });
  await settle();
  expect(alfred()).not.toBeNull();
  expect(document.activeElement).toBe(input());

  await escape(input()!);
  // Leaving: inert while its exit plays, then gone.
  await settle(400);
  expect(alfred()).toBeNull();

  const hint = [...element.querySelectorAll('button')].find((b) => /show Alfred/.test(b.textContent ?? ''))!;
  await act(async () => { hint.click(); });
  await settle();
  expect(alfred()).not.toBeNull();
  expect(alfred()!.inert).toBe(false);
  expect(document.activeElement).toBe(input());
});
