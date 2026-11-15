// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AppleMusic from './page';

// happy-dom cancels framer-motion's native animations mid-flight; the morphs aren't under test.
MotionGlobalConfig.skipAnimations = true;

/* Every ResizeObserver reports the size the test sets, so the block can be resized across the compact boundary. */
const observers = new Set<{ cb: ResizeObserverCallback; els: Element[] }>();
let size = { width: 1200, height: 800 };
class FakeResizeObserver {
  entry: { cb: ResizeObserverCallback; els: Element[] };
  constructor(cb: ResizeObserverCallback) { this.entry = { cb, els: [] }; observers.add(this.entry); }
  observe(el: Element) { this.entry.els.push(el); this.fire(el); }
  unobserve() { /* the boxes never change */ }
  disconnect() { observers.delete(this.entry); }
  fire(el: Element) {
    this.entry.cb([entry(el)], this as unknown as ResizeObserver);
  }
}
/** What every observer reports for an element: the size the test set, as each box. */
const entry = (el: Element) => ({ target: el, contentRect: { ...size, x: 0, y: 0, top: 0, left: 0, right: size.width, bottom: size.height }, borderBoxSize: [{ inlineSize: size.width, blockSize: size.height }], contentBoxSize: [{ inlineSize: size.width, blockSize: size.height }] }) as unknown as ResizeObserverEntry;
async function resize(width: number, height = 800) {
  size = { width, height };
  await act(async () => {
    for (const o of [...observers]) for (const el of o.els) o.cb([entry(el)], {} as ResizeObserver);
  });
  await settle();
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

let element: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  // The SplitView reads its size class from its own box's clientWidth.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => size.width });
  size = { width: 1200, height: 800 };
  element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  observers.clear();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
});

const dialog = () => element.querySelector<HTMLElement>('[role="dialog"]');
const albumTitle = () => [...element.querySelectorAll('h1, h2, [data-slot$="title"]')].map((n) => n.textContent).join('|');

it('Now Playing is a modal Dialog: focus moves in, Escape closes it and focus returns to the mini player', async () => {
  await act(async () => root.render(<AppleMusic initialAlbum="velvet-static" />));
  await settle();
  const open = element.querySelector<HTMLElement>('[data-now-playing-open]')!;
  expect(open).toBeTruthy();
  open.focus();
  await act(async () => open.click());
  await settle();

  const d = dialog()!;
  expect(d).toBeTruthy();
  expect(d.getAttribute('aria-modal')).toBe('true');
  expect(document.getElementById(d.getAttribute('aria-labelledby')!)?.textContent).toBe('Now Playing');
  expect(d.contains(document.activeElement)).toBe(true);

  await act(async () => {
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });
  await settle();
  expect(dialog()).toBeNull();
  expect(document.activeElement).toBe(element.querySelector('[data-now-playing-open]'));
});

it('an Escape outside the player (another layer has it) does not close Now Playing', async () => {
  await act(async () => root.render(<AppleMusic initialAlbum="velvet-static" nowPlaying />));
  await settle();
  expect(dialog()).toBeTruthy();
  const outside = document.createElement('input');
  document.body.append(outside);
  outside.focus();
  // A window-wide listener used to close the player on any Escape; the Dialog only hears its own layer stack.
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();
  expect(dialog()).toBeTruthy();
  outside.remove();
});

it('keeps the open album across the compact boundary, both ways', async () => {
  await act(async () => root.render(<AppleMusic initialSection="albums" initialAlbum="neon-tidewater" />));
  await settle();
  // Wide: the SplitView, with the album pushed over Albums on the detail column's NavigationStack.
  const detailPages = () => [...element.querySelectorAll('[data-slot="split-view-detail"] [data-slot="navigation-stack-page"]')];
  expect(detailPages()).toHaveLength(2);
  expect(albumTitle()).toContain('Neon Tidewater');

  // Phone: the same SplitView (nothing remounts), its sidebar now the tab bar, the Library tab current, and the
  // album over Albums over the Library page.
  const split = element.querySelector('[data-slot="split-view"]');
  await resize(390, 844);
  expect(element.querySelector('[data-slot="split-view"]')).toBe(split);
  const tab = element.querySelector('[role="tab"][aria-selected="true"]');
  expect(tab?.textContent).toContain('Library');
  expect(detailPages()).toHaveLength(3);
  expect(albumTitle()).toContain('Neon Tidewater');

  await resize(1200);
  expect(detailPages()).toHaveLength(2);
  expect(element.querySelector('[data-slot="split-view-item"][data-current]')?.textContent).toContain('Albums');
  expect(albumTitle()).toContain('Neon Tidewater');
});
