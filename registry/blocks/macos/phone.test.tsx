// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HomeBar } from './phone';

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
  vi.useRealTimers();
  await act(async () => root.unmount());
  element.remove();
  vi.unstubAllGlobals();
});

async function mount() {
  const onHome = vi.fn();
  const onSwitcher = vi.fn();
  await act(async () => { root.render(<HomeBar dark={false} inApp onHome={onHome} onSwitcher={onSwitcher} />); });
  const bar = element.querySelector<HTMLButtonElement>('button[aria-label=Home]')!;
  vi.useFakeTimers();
  return { bar, onHome, onSwitcher };
}

const pointer = (el: Element, type: string, init: PointerEventInit = {}) =>
  act(() => { el.dispatchEvent(new PointerEvent(type, { pointerId: 1, isPrimary: true, pointerType: 'touch', clientX: 10, clientY: 10, button: 0, buttons: type === 'pointerdown' || type === 'pointermove' ? 1 : 0, bubbles: true, cancelable: true, ...init })); });
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const key = (el: Element, type: 'keydown' | 'keyup', k: string) =>
  act(() => { el.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true })); });

it('a tap goes home', async () => {
  const { bar, onHome, onSwitcher } = await mount();
  expect(bar.getAttribute('aria-description')).toMatch(/hold/i);

  await pointer(bar, 'pointerdown');
  await pointer(bar, 'pointerup');
  act(() => { bar.click(); });
  expect(onHome).toHaveBeenCalledTimes(1);
  expect(onSwitcher).not.toHaveBeenCalled();
});

it('a press held past the delay opens the switcher instead, and does not also go home', async () => {
  const { bar, onHome, onSwitcher } = await mount();
  await pointer(bar, 'pointerdown');
  expect(bar.hasAttribute('data-holding')).toBe(true);
  wait(500);
  expect(onSwitcher).toHaveBeenCalledTimes(1);
  await pointer(bar, 'pointerup');
  act(() => { bar.click(); });
  expect(onHome).not.toHaveBeenCalled();
});

it('moving off before the delay cancels the hold (UI SDK tolerance)', async () => {
  const { bar, onSwitcher } = await mount();
  await pointer(bar, 'pointerdown');
  await pointer(bar, 'pointermove', { clientX: 40 });
  wait(600);
  expect(onSwitcher).not.toHaveBeenCalled();
  await pointer(bar, 'pointerup', { clientX: 40 });
});

it('holding Space opens the switcher from the keyboard', async () => {
  const { bar, onHome, onSwitcher } = await mount();
  act(() => { bar.focus(); });
  await key(bar, 'keydown', ' ');
  wait(500);
  expect(onSwitcher).toHaveBeenCalledTimes(1);
  await key(bar, 'keyup', ' ');
  expect(onHome).not.toHaveBeenCalled();
});

it('a hard press opens the switcher at once, and the click that ends it is not a tap', async () => {
  const { bar, onHome, onSwitcher } = await mount();
  await pointer(bar, 'pointerdown', { pressure: 0.9 });
  expect(onSwitcher).toHaveBeenCalledTimes(1);
  wait(500);
  expect(onSwitcher).toHaveBeenCalledTimes(1);
  await pointer(bar, 'pointerup');
  act(() => { bar.click(); });
  expect(onHome).not.toHaveBeenCalled();
});

it('two taps in a row open the switcher', async () => {
  const { bar, onHome, onSwitcher } = await mount();
  for (let i = 0; i < 2; i++) {
    await pointer(bar, 'pointerdown');
    await pointer(bar, 'pointerup');
    act(() => { bar.click(); });
    wait(100);
  }
  expect(onHome).toHaveBeenCalledTimes(2);
  expect(onSwitcher).toHaveBeenCalledTimes(1);
});
