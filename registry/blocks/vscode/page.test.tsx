// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { SizeClassProvider } from '@/lib/container';
import { BLProvider } from '@/lib/theme';
import { createMemoryRuntime } from './memory-runtime';
import VSCode from './page';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

/* happy-dom lays nothing out: the window reports `width` px wide, everything else nothing (unmeasured). */
let width = 0;
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get(this: HTMLElement) { return this.getAttribute('data-slot') === 'vscode' ? width : 0; },
});
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = null;
  width = 0;
});
afterAll(() => { Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth'); });

async function openNewFolder(outer: 'compact' | 'regular') {
  const runtime = createMemoryRuntime({ files: { 'index.js': 'console.log(1)\n' } });
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  const tree = (
    <BLProvider>
      <SizeClassProvider value={outer}>
        <VSCode runtime={runtime} initialView="explorer" />
      </SizeClassProvider>
    </BLProvider>
  );
  await act(async () => { root!.render(tree); await new Promise((r) => setTimeout(r, 0)); });
  const button = document.querySelector<HTMLElement>('[aria-label="New Folder"]');
  expect(button).toBeTruthy();
  await act(async () => { button!.click(); await new Promise((r) => setTimeout(r, 0)); });
  const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.textContent?.includes('New folder'));
  expect(dialog).toBeTruthy();
  return dialog!;
}

describe('VS Code window: a size-class scope', () => {
  it('asks for a folder name in a tray when the window is compact, inside a wide page', async () => {
    width = 420;
    const dialog = await openNewFolder('regular');
    expect(document.querySelector('[data-slot="vscode"]')?.getAttribute('data-size-class')).toBe('compact');
    expect(dialog.getAttribute('data-presentation')).toBe('sheet');
  });

  it('asks in a centred card when the window is wide, inside a compact page', async () => {
    width = 1280;
    const dialog = await openNewFolder('compact');
    expect(dialog.getAttribute('data-presentation')).toBe('dialog');
  });
});

describe('VS Code status bar', () => {
  it("names the runtime's popover by its own title, not by the trigger", async () => {
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    const runtime = createMemoryRuntime({ files: { 'index.js': '' } });
    await act(async () => { root!.render(<BLProvider><VSCode runtime={runtime} /></BLProvider>); await new Promise((r) => setTimeout(r, 0)); });
    const trigger = [...document.querySelectorAll<HTMLElement>('[aria-label$=". Details"]')][0];
    expect(trigger).toBeTruthy();
    await act(async () => { trigger!.click(); await new Promise((r) => setTimeout(r, 0)); });
    const popover = document.querySelector('[role="dialog"]');
    const title = document.getElementById(popover?.getAttribute('aria-labelledby') ?? '');
    expect(popover?.hasAttribute('aria-label')).toBe(false);
    expect(title?.textContent?.trim()).toBeTruthy();
    expect(trigger!.getAttribute('aria-label')).not.toBe(title?.textContent);
  });
});
