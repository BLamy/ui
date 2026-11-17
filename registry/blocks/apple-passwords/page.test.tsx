// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createVault } from '@/lib/vault';
import { memoryStorage } from '@/lib/vault-storage';
import { createFakeAuthenticator } from '../../../packages/ui/test/fake-authenticator';
import ApplePasswords, { createDemoDeviceAuth } from './page';

MotionGlobalConfig.skipAnimations = true;

/* Every box is as wide as the test says (the SplitView's size class reads `clientWidth` as its ResizeObserver fires). */
let width = 1200;
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
class FakeResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe(el: Element) {
    const box = { width, height: 800, x: 0, y: 0, top: 0, left: 0, right: width, bottom: 800 };
    this.cb([{ target: el, contentRect: box, borderBoxSize: [{ inlineSize: width, blockSize: 800 }], contentBoxSize: [{ inlineSize: width, blockSize: 800 }] } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() { /* the boxes never change */ }
  disconnect() { /* nothing to stop */ }
}

let element: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  width = 1200;
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
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

async function mount(props: Parameters<typeof ApplePasswords>[0]) {
  const auth = createFakeAuthenticator();
  const vault = createVault({ id: 'passwords-test', rp: { name: 'Passwords' }, storage: memoryStorage(), env: auth.env, channel: false });
  await act(async () => root.render(<ApplePasswords passkeyVault={vault} tailscale={false} auth={createDemoDeviceAuth()} live={false} {...props} />));
  await settle();
}
const byName = (role: string, name: string) =>
  [...document.querySelectorAll<HTMLElement>(`[role="${role}"], ${role === 'button' ? 'button' : 'x'}`)].find((el) => (el.getAttribute('aria-label') ?? el.textContent)?.includes(name));

it('the Wi-Fi password reveal is a toggle, and the QR code is a Collapsible', async () => {
  await mount({ defaultCategory: 'wifi' });
  const eye = byName('button', 'Show password')!;
  expect(eye.getAttribute('aria-pressed')).toBe('false');
  await act(async () => eye.click());
  expect(eye.getAttribute('aria-pressed')).toBe('true');
  expect(eye.hasAttribute('data-pressed')).toBe(true);
  // The label stays put; the pressed state says whether it shows.
  expect(eye.getAttribute('aria-label')).toBe('Show password');

  const qr = byName('button', 'Network QR Code')!;
  expect(qr.getAttribute('data-slot')).toBe('collapsible-trigger');
  expect(qr.getAttribute('aria-expanded')).toBe('false');
  expect(document.querySelector('[data-slot="collapsible-panel"]')).toBeNull();
  await act(async () => qr.click());
  await settle();
  expect(qr.getAttribute('aria-expanded')).toBe('true');
  const panel = document.querySelector<HTMLElement>('[data-slot="collapsible-panel"]')!;
  expect(qr.getAttribute('aria-controls')).toBe(panel.id);
  expect(panel.textContent).toContain('Point another device');
});

async function openSignIn() {
  const button = byName('button', 'Sign in to GitHub')!;
  expect(button).toBeTruthy();
  await act(async () => button.click());
  await settle();
  return document.querySelector<HTMLElement>('[role="dialog"]')!;
}

it('the sign-in dialog follows the SplitView: a card beside several columns', async () => {
  await mount({});
  expect((await openSignIn()).getAttribute('data-presentation')).toBe('dialog');
});

it('the sign-in dialog follows the SplitView: a tray in one column', async () => {
  width = 390;
  await mount({});
  expect(document.querySelector('[data-slot="split-view"]')?.getAttribute('data-size-class')).toBe('compact');
  expect((await openSignIn()).getAttribute('data-presentation')).toBe('sheet');
});
