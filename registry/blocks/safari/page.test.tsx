// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTailscale, type Tailscale } from '@/lib/tailscale';
import { createDemoTailnet } from './data';
import Safari from './page';

let element: HTMLDivElement;
let root: Root;
let tailscale: Tailscale;
beforeEach(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
  tailscale = createTailscale({ ...createDemoTailnet().options, auth: { mode: 'auth-key', authKey: 'demo' } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  await tailscale.dispose();
  element.remove();
  vi.unstubAllGlobals();
});

const settle = (ms = 50) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const gate = () => document.querySelector<HTMLElement>('[role=dialog][aria-modal=true]');
const toolbar = () => document.querySelector<HTMLElement>('[data-slot=safari-toolbar]')!;
const address = () => document.querySelector<HTMLInputElement>('input[role=combobox]')!;
const connected = () => document.querySelector('[data-slot=safari]')?.getAttribute('data-status') === 'connected';

async function signIn() {
  await act(async () => { await tailscale.signIn(); });
  for (let i = 0; i < 40 && !connected(); i++) await settle();
  await settle();
}

it('opens on a modal gate in its own host: the browser behind is inert, and focus is left alone on the first visit', async () => {
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  await act(async () => { root.render(<Safari controller={tailscale} />); });
  await settle();

  const dialog = gate()!;
  expect(dialog).not.toBeNull();
  expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Connect to Tailscale');
  expect(document.getElementById(dialog.getAttribute('aria-describedby')!)!.textContent).toContain('Safari only browses through your tailnet');
  // The gate lives in Safari's BLProvider (a layer host): only the browser beside it turns inert, not the page.
  const host = dialog.closest('[data-layer-host]')!;
  expect(host.getAttribute('data-slot')).toBe('bl-provider');
  expect(toolbar().closest('[inert]')).not.toBeNull();
  expect(outside.closest('[inert]')).toBeNull();
  expect(document.activeElement).toBe(outside);
  // Nothing dismisses it but connecting.
  await act(async () => { dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
  await settle();
  expect(gate()).not.toBeNull();
  outside.remove();
});

it('connecting lifts the gate; signing out brings it back with focus in it', async () => {
  await act(async () => { root.render(<Safari controller={tailscale} />); });
  await settle();
  await signIn();
  expect(gate()).toBeNull();
  expect(toolbar().closest('[inert]')).toBeNull();

  await act(async () => { await tailscale.signOut(); });
  for (let i = 0; i < 20 && !gate(); i++) await settle();
  await settle();
  const dialog = gate()!;
  expect(dialog).not.toBeNull();
  expect(dialog.contains(document.activeElement)).toBe(true);
  expect(document.activeElement?.textContent).toContain('Sign in with Tailscale');
});

it('⌘L, ⌘R, ⌘[ and ⌘] (Ctrl here) are scoped shortcuts: they work while focus is in Safari, not from outside it', async () => {
  const outside = document.createElement('button');
  document.body.append(outside);
  await act(async () => { root.render(<Safari controller={tailscale} />); });
  await settle();
  await signIn();

  const { shortcuts } = await import('@ui-sdk/react/shortcuts');
  // happy-dom is not an Apple platform, so `mod` is Control.
  const press = (target: Element, key: string) => act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true }));
  });
  const menu = [...toolbar().querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Tailscale connection')!;

  outside.focus();
  expect(shortcuts.list().filter((s) => s.scope?.startsWith('safari-'))).toEqual([]);
  await press(outside, 'l');
  expect(document.activeElement).toBe(outside);

  await act(async () => { menu.focus(); });
  expect(shortcuts.list().map((s) => s.keys)).toEqual(expect.arrayContaining(['mod+l', 'mod+r', 'mod+[', 'mod+]']));
  await press(menu, 'l');
  expect(document.activeElement).toBe(address());

  // Focus leaving Safari turns its scope off again.
  await act(async () => { outside.focus(); });
  expect(shortcuts.list().filter((s) => s.scope?.startsWith('safari-'))).toEqual([]);
  outside.remove();
});

it('the tab overview button is a toggle: pressed while the overview is up', async () => {
  await act(async () => { root.render(<Safari controller={tailscale} />); });
  await settle();
  await signIn();
  const button = () => toolbar().querySelector<HTMLElement>('[aria-label^="Show tab overview"]')!;
  const overview = () => document.querySelector('[data-slot=safari-overview]');
  expect(button().getAttribute('aria-pressed')).toBe('false');
  await act(async () => button().click());
  expect(button().getAttribute('aria-pressed')).toBe('true');
  expect(button().hasAttribute('data-pressed')).toBe(true);
  expect(overview()).not.toBeNull();
  await act(async () => button().click());
  expect(button().getAttribute('aria-pressed')).toBe('false');
  expect(overview()).toBeNull();
});
