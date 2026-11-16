// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLE } from './example';
import CloudflareStudio, { downloadName, openedStudio } from './page';
import { readSaved } from './studio-files';

let element: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  element = document.createElement('div');
  element.style.cssText = 'position: relative; width: 1200px; height: 700px';
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.unstubAllGlobals();
});

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
const show = async (ui: React.ReactNode) => { await act(async () => root.render(ui)); await settle(); };
const services = () => element.querySelectorAll('[data-slot=cloudflare-service]').length;
const saved = () => readSaved(localStorage.getItem('cloudflare-studio'));
const button = (name: string) => [...document.querySelectorAll<HTMLElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name);
const press = async (name: string) => {
  const target = button(name);
  expect(target, name).toBeTruthy();
  await act(async () => target?.click());
  await settle();
};
const nameField = () => element.querySelector<HTMLInputElement>('input[aria-label="System name"]');
const write = async (input: HTMLInputElement, value: string) => {
  // React tracks an input's value, so it's set the way a person's typing sets it.
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle();
};

/* What the e2e spec (tools/e2e/cloudflare-studio.e2e.mjs) does by hand in a browser, short of dragging a connection: the parts
   of the journey happy-dom can do, so a broken studio fails here first. */
describe('Cloudflare Studio', () => {
  it('opens with the example, starts over with New, and keeps what it has in this browser', async () => {
    await show(<CloudflareStudio />);
    expect(services()).toBe(EXAMPLE.system.services.length);
    // Nothing's written until something changes.
    expect(localStorage.getItem('cloudflare-studio')).toBeNull();
    await press('New');
    expect(services()).toBe(0);
    expect(element.textContent).toContain('No services yet');
    const name = nameField();
    expect(name).toBeTruthy();
    if (name) await write(name, 'File upload');
    expect(saved()).toEqual({ name: 'File upload', system: { services: [], edges: [] } });
    expect(element.querySelector('[data-slot=cloudflare-studio-saved]')?.textContent).toBe('Kept in this browser');
  });

  it('carries on where it was after a reload', async () => {
    localStorage.setItem('cloudflare-studio', JSON.stringify({ name: 'Kept', system: JSON.stringify({ services: [{ id: 'w', kind: 'workers', at: { x: 0, y: 0 } }], edges: [] }) }));
    await show(<CloudflareStudio />);
    expect(nameField()?.value).toBe('Kept');
    expect(services()).toBe(1);
  });

  it('keeps nothing with storageKey null', async () => {
    await show(<CloudflareStudio storageKey={null} />);
    await press('New');
    expect(localStorage.length).toBe(0);
  });

  it('exports its files in a dialog, each with what it still needs', async () => {
    await show(<CloudflareStudio storageKey={null} />);
    await press('Export…');
    const dialog = document.querySelector<HTMLElement>('[role=dialog]');
    expect(dialog?.textContent).toContain(`Export ${EXAMPLE.name}`);
    const paths = [...(dialog?.querySelectorAll('[data-slot=cloudflare-studio-file]') ?? [])].map((el) => el.getAttribute('data-path'));
    expect(paths).toEqual(['system.json', 'api/wrangler.jsonc', 'consumer/wrangler.jsonc', 'machines/room.js']);
    expect(dialog?.querySelector('[data-path="consumer/wrangler.jsonc"] [data-slot=cloudflare-studio-needs]')?.textContent).toMatch(/migration/);
    expect(button('Download all 4')).toBeTruthy();
    expect(button('Download api/wrangler.jsonc')).toBeTruthy();
  });
});

describe('opening a file', () => {
  it('reads a system, named by its file, and a system.json keeps the name it had', () => {
    const text = JSON.stringify(EXAMPLE.system);
    expect(openedStudio('orders.json', text, 'Now')).toEqual({ studio: { name: 'orders', system: EXAMPLE.system }, issues: [] });
    expect(openedStudio('system.json', text, 'Now').studio?.name).toBe('Now');
  });

  it('changes nothing when it isn’t a system, and says why', () => {
    const read = openedStudio('broken.json', '{ not json', 'Now');
    expect(read.studio).toBeNull();
    expect(read.issues[0]?.code).toBe('json');
  });

  it('downloads with the folder in the name, as a browser won’t make folders', () => {
    expect(downloadName('api/wrangler.jsonc')).toBe('api-wrangler.jsonc');
    expect(downloadName('system.json')).toBe('system.json');
  });
});
