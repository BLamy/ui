// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PencilKitDemo } from './pencilkit-demo';

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

const fire = (el: Element, type: string, init: PointerEventInit = {}) =>
  act(() => { el.dispatchEvent(new PointerEvent(type, { bubbles: type !== 'pointerenter' && type !== 'pointerleave', pointerType: 'mouse', ...init })); });
const enter = (el: Element, pointerType = 'mouse') => { fire(el, 'pointerover', { pointerType }); fire(el, 'pointerenter', { pointerType }); };
const leave = (el: Element) => { fire(el, 'pointerout'); fire(el, 'pointerleave'); };
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const card = () => document.querySelector<HTMLElement>('[data-slot=hover-card-content]');
const button = (name: string) => [...document.querySelectorAll<HTMLElement>('button')].find((b) => b.getAttribute('aria-label') === name)!;

async function mount() {
  await act(async () => { root.render(<PencilKitDemo />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  vi.useFakeTimers();
}

it('resting on a tool previews its brush; the next tool previews at once; touch never opens it', async () => {
  await mount();
  const tools = document.querySelector('[aria-label=Tool]')!;
  const marker = button('Marker');
  const pencil = button('Pencil');
  // The buttons are still the picker's toggles, now the card's triggers too.
  expect(tools.contains(marker)).toBe(true);
  expect(marker.hasAttribute('title')).toBe(false);

  enter(marker, 'touch');
  wait(1000);
  expect(card()).toBeNull();

  enter(marker);
  wait(200);
  expect(card()).toBeNull();
  wait(600);
  expect(card()!.textContent).toContain('Marker');
  expect(marker.hasAttribute('data-open')).toBe(true);

  // UI SDK's group behavior: with a card open, the next trigger shows without the delay.
  leave(marker);
  enter(pencil);
  wait(50);
  expect(card()!.textContent).toContain('Pencil');

  act(() => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
  wait(50);
  expect(card()).toBeNull();
});

it('a width previews the tool in hand at that width, and pressing it still picks it', async () => {
  await mount();
  const width = button('Bold');
  enter(width);
  wait(800);
  expect(card()!.textContent).toContain('Pen');
  expect(card()!.textContent).toContain('Bold');
  act(() => { width.click(); });
  expect(width.getAttribute('aria-pressed')).toBe('true');
});
