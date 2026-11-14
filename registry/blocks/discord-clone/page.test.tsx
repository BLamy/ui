// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { useSizeClassScope } from '@/lib/container';
import { ChatShell, ChatShellNav, ChatShellNavTrigger, ChatShellPanel } from './components/chat-shell';
import DiscordClone from './page';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

/* happy-dom lays nothing out: the shell measures `width` px, everything else keeps happy-dom's zero box. */
let width = 0;
const rect = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
  const box = rect.call(this);
  return this.getAttribute('data-slot') === 'chat-shell' ? ({ ...box.toJSON(), width, height: 700 } as DOMRect) : box;
};
afterAll(() => { HTMLElement.prototype.getBoundingClientRect = rect; });
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = null;
  width = 0;
});
async function show(node: React.ReactNode, px: number) {
  width = px;
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root!.render(node); await new Promise((r) => setTimeout(r, 0)); });
}

function Scope() {
  return <output data-testid="scope">{useSizeClassScope()}</output>;
}

describe('ChatShell', () => {
  it('is a size-class scope: compact below its breakpoint', async () => {
    await show(<ChatShell breakpoint={880}><Scope /></ChatShell>, 600);
    expect(document.querySelector('[data-slot="chat-shell"]')?.getAttribute('data-size-class')).toBe('compact');
    expect(document.querySelector('[data-testid="scope"]')?.textContent).toBe('compact');
  });

  it('is medium from its breakpoint, regular from 1024px', async () => {
    await show(<ChatShell breakpoint={880}><Scope /></ChatShell>, 900);
    expect(document.querySelector('[data-testid="scope"]')?.textContent).toBe('medium');
    await act(async () => root?.unmount());
    root = null;
    await show(<ChatShell breakpoint={880}><Scope /></ChatShell>, 1200);
    expect(document.querySelector('[data-testid="scope"]')?.textContent).toBe('regular');
  });
});

describe('ChatShell change details', () => {
  const trigger = () => document.querySelector<HTMLElement>('button[aria-label="Channels"]')!;
  const drawerOpen = () => trigger().getAttribute('aria-expanded') === 'true';

  it('the compact drawer reports why it opened, and a cancel keeps it shut', async () => {
    const onNavOpenChange = vi.fn();
    await show(<ChatShell onNavOpenChange={onNavOpenChange}><ChatShellNav>nav</ChatShellNav><ChatShellNavTrigger /></ChatShell>, 600);
    await act(async () => trigger().click());
    expect(onNavOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-press', event: expect.any(Event), cancel: expect.any(Function) }));
    expect(drawerOpen()).toBe(true);
    await act(async () => root?.unmount());
    root = null;

    await show(<ChatShell onNavOpenChange={(_open, details) => details.cancel()}><ChatShellNav>nav</ChatShellNav><ChatShellNavTrigger /></ChatShell>, 600);
    await act(async () => trigger().click());
    expect(drawerOpen()).toBe(false);
  });

  it("the panel hands on its AdaptivePane's details", async () => {
    const onOpenChange = vi.fn();
    await show(<ChatShell><ChatShellPanel open onOpenChange={onOpenChange}>thread</ChatShellPanel></ChatShell>, 1400);
    const close = [...document.querySelectorAll<HTMLElement>('button')].find((b) => /close/i.test(b.getAttribute('aria-label') ?? ''));
    expect(close).toBeTruthy();
    await act(async () => close!.click());
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'close-press', cancel: expect.any(Function) }));
  });
});

describe('Discord clone', () => {
  it("gives each message's action bar one Tab stop, as a named toolbar", async () => {
    await show(<DiscordClone />, 1400);
    const bars = [...document.querySelectorAll('[role="toolbar"][aria-label="Message actions"]')];
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      const buttons = [...bar.querySelectorAll('button')];
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    }
  });

  it('draws the member list switch as a toggle', async () => {
    await show(<DiscordClone />, 1400);
    const members = document.querySelector<HTMLElement>('button[aria-label="Members"]');
    expect(members?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-slot="chat-shell-aside"]')).toBeTruthy();
    await act(async () => { members!.click(); await new Promise((r) => setTimeout(r, 0)); });
    expect(members?.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('[data-slot="chat-shell-aside"]')).toBeNull();
  });
});
