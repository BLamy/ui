// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import LoopQA from './page';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

/* happy-dom lays nothing out: the block reports `width` px wide, everything else nothing (unmeasured). */
let width = 0;
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get(this: HTMLElement) { return this.getAttribute('data-slot') === 'loop-qa' ? width : 0; },
});
afterAll(() => { Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth'); });
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = null;
  width = 0;
});

async function mount(px: number) {
  width = px;
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root!.render(<LoopQA defaultProject="northwind" defaultTab="bugs" askOpen={false} />); await new Promise((r) => setTimeout(r, 0)); });
}

async function share() {
  const button = document.querySelector<HTMLElement>('[aria-label="Share"]');
  expect(button).toBeTruthy();
  await act(async () => { button!.click(); await new Promise((r) => setTimeout(r, 0)); });
  const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.textContent?.includes('Share project'));
  expect(dialog).toBeTruthy();
  return dialog!;
}

describe('Loop QA', () => {
  it('opens its dialogs in a tray on a phone-sized block and in a card on a wide one', async () => {
    await mount(420);
    expect((await share()).getAttribute('data-presentation')).toBe('sheet');
    await act(async () => root?.unmount());
    root = null;
    await mount(1300);
    expect((await share()).getAttribute('data-presentation')).toBe('dialog');
  });

  it("captions the bug list's columns without an orphan row", async () => {
    await mount(1300);
    expect(document.querySelector('[role="row"]')).toBeNull();
    const columns = document.querySelector('[data-slot="loop-qa-bug-columns"]');
    expect(columns?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('ul[aria-label="Bugs"] li')).toBeTruthy();
  });
});
