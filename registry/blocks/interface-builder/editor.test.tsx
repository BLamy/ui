// @vitest-environment happy-dom
import { MotionGlobalConfig } from 'framer-motion';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InterfaceBuilder from './page';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
MotionGlobalConfig.skipAnimations = true;

let host: HTMLDivElement;
let root: Root;
let width = 1280;
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // The builder measures its own box for its size class; happy-dom lays nothing out.
  width = 1280;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) { return this.dataset.slot === 'interface-builder' ? width : 0; },
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
  vi.unstubAllGlobals();
});

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
const builder = () => host.querySelector<HTMLElement>('[data-slot="interface-builder"]')!;
const button = (name: string) => host.querySelector<HTMLElement>(`button[aria-label="${name}"]`)!;
const player = () => document.querySelector<HTMLElement>('[data-ib-player]');
const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => { (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })); });
/** ⌘ on Apple platforms, Ctrl elsewhere: presses the platform's (the other one matches nothing). */
const both = async (key: string, init: KeyboardEventInit = {}) => {
  const apple = /Mac|iPhone|iPad/.test(navigator.platform);
  await press(key, { ...init, metaKey: apple, ctrlKey: !apple });
};
/** Whether an element is out of reach: it, or something around it, is `inert`. */
const inert = (el: Element | null) => {
  for (let e = el as HTMLElement | null; e; e = e.parentElement) if (e.inert) return true;
  return false;
};

async function open() {
  await act(async () => root.render(<InterfaceBuilder appearance="light" />));
  await settle();
}

describe('InterfaceBuilder preview', () => {
  it('runs as a dialog over the storyboard: named, focused, modal to the storyboard only, and Escape stops it', async () => {
    await open();
    const run = button('Run');
    act(() => run.focus());
    await act(async () => run.click());
    await settle();
    const dialog = player()!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    const title = document.getElementById(dialog.getAttribute('aria-labelledby')!);
    expect(title?.textContent).toMatch(/^Running .+ on /);
    expect(dialog.contains(document.activeElement)).toBe(true);
    // The storyboard under it is out of reach; the inspector beside it stays live (edits show up while it runs).
    // (UI SDK keeps live regions, like a calendar's heading in a scene, announceable, so it inerts around them.)
    expect(inert(host.querySelector('[data-ib-scene-frame=main] [role=tab]'))).toBe(true);
    expect(inert(host.querySelector('[aria-label="Inspectors"]'))).toBe(false);
    expect(inert(button('Stop'))).toBe(false);
    expect(dialog.parentElement!.hasAttribute('data-layer-host')).toBe(true);
    // The toolbar's button is Stop now, and it is the same element focus returns to.
    expect(run.getAttribute('aria-label')).toBe('Stop');
    await press('Escape');
    await settle();
    expect(player()).toBeNull();
    expect(document.activeElement).toBe(run);
    expect(run.getAttribute('aria-label')).toBe('Run');
  });

  it('⌘R runs it from inside the builder, ⌘. and its Stop button stop it', async () => {
    await open();
    act(() => host.querySelector<HTMLElement>('button[aria-label^="Undo"]')!.closest('header')!.querySelector<HTMLElement>('button')!.focus());
    await both('r');
    await settle();
    expect(player()).not.toBeNull();
    await both('.');
    await settle();
    expect(player()).toBeNull();
    await both('r');
    await settle();
    const stop = [...player()!.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Stop')!;
    await act(async () => stop.click());
    await settle();
    expect(player()).toBeNull();
  });

  it('keeps its own menus working inside it: the animation speed', async () => {
    await open();
    await act(async () => button('Run').click());
    await settle();
    const speed = player()!.querySelector<HTMLElement>('[aria-label^="Animation speed"]')!;
    await act(async () => speed.click());
    await settle();
    const slow = [...document.querySelectorAll<HTMLElement>('[role=menuitemradio]')].find((el) => el.textContent?.startsWith('0.5×'))!;
    expect(slow).toBeDefined();
    await act(async () => slow.click());
    await settle();
    expect(player()).not.toBeNull();
    expect(speed.textContent).toContain('Slow 0.5×');
  });

  it('leaves ⌘R alone while focus is outside the builder', async () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    await open();
    act(() => outside.focus());
    await both('r');
    await settle();
    expect(player()).toBeNull();
    outside.remove();
  });
});

describe('InterfaceBuilder inspector', () => {
  it('⌥⌘1…n pick a tab while focus is in this builder, and the tabs announce their keys', async () => {
    await open();
    const tabs = () => [...host.querySelectorAll<HTMLElement>('[aria-label="Inspectors"] [role=tab]')];
    expect(tabs().length).toBeGreaterThan(1);
    expect(tabs()[1].getAttribute('aria-keyshortcuts')).toMatch(/^(Alt\+Meta|Alt\+Control|Meta\+Alt|Control\+Alt)\+2$|Alt|2/);
    act(() => button('Run').focus());
    // On a Mac, Option changes the typed character; the shortcut matches the digit key.
    await both('™', { code: 'Digit2', altKey: true });
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
  });

  it('does not switch tabs for ⌥⌘2 pressed outside the builder', async () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    await open();
    const second = () => host.querySelectorAll<HTMLElement>('[aria-label="Inspectors"] [role=tab]')[1];
    act(() => outside.focus());
    await both('2', { code: 'Digit2', altKey: true });
    expect(second().getAttribute('aria-selected')).not.toBe('true');
    outside.remove();
  });
});

describe('InterfaceBuilder panes', () => {
  it('docks the panes when regular, and below 900px shows them as drawers that leave the canvas usable', async () => {
    width = 800;
    await open();
    expect(builder().getAttribute('data-size-class')).toBe('medium');
    // Closed at first below regular (a closed drawer stays mounted, hidden, in its contained host).
    const tabs = host.querySelector('[aria-label="Inspectors"]');
    expect(!tabs || !!tabs.closest('[hidden]')).toBe(true);
    const toggle = button('Inspector');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await act(async () => toggle.click());
    await settle();
    const drawer = document.querySelector<HTMLElement>('[data-variant=panel][aria-label="Inspector"]')!;
    expect(drawer).not.toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const controlled = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(!!controlled && (controlled.contains(drawer) || drawer.contains(controlled))).toBe(true);
    expect(drawer.contains(document.activeElement)).toBe(true);
    // Not modal: no scrim, nothing inert.
    expect(document.querySelector('[data-slot=drawer-backdrop]')).toBeNull();
    expect(inert(host.querySelector('[data-slot=canvas]'))).toBe(false);
    await press('Escape');
    await settle();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('drops the toolbar’s labels when compact', async () => {
    width = 600;
    await open();
    expect(builder().getAttribute('data-size-class')).toBe('compact');
    expect(button('Timeline')).toBeNull();
    width = 1280;
  });
});
