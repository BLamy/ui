// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { definePrimitive } from '@brett_lamy/ui/sdk/core';
import { mount } from '@brett_lamy/ui/sdk/core/testing';
import { MotionGlobalConfig } from 'framer-motion';
import { BLProvider } from '@/lib/theme';
import { ThreadGroup, ThreadItem } from './components/thread-sidebar';
import { ModelPicker } from './components/workbench/model-picker';
import { WORKBENCH_MODELS, WORKBENCH_PROVIDERS } from './components/workbench/models';
import {
  WorkbenchContent,
  WorkbenchDock,
  WorkbenchDockTrigger,
  WorkbenchHeader,
  WorkbenchMain,
  WorkbenchPanelFullscreen,
  WorkbenchShell,
  WorkbenchSidebar,
  WorkbenchSidebarTrigger,
  WorkbenchTab,
  WorkbenchTabBar,
} from './components/workbench/workbench-shell';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
// framer-motion's WAAPI animations cancel with an AbortError in happy-dom.
MotionGlobalConfig.skipAnimations = true;

/* happy-dom lays nothing out: the shell reports 1300px wide (regular), each resizable panel (and the dock in one)
   300px tall. */
let shellWidth = 1300;
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get(this: HTMLElement) { return this.getAttribute('data-slot') === 'workbench-shell' ? shellWidth : 0; },
});
const rect = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
  if (['resizable-panel', 'workbench-dock'].includes(this.getAttribute('data-slot') ?? '')) return { x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 300, width: 800, height: 300, toJSON: () => ({}) } as DOMRect;
  return rect.call(this);
};
afterAll(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
  HTMLElement.prototype.getBoundingClientRect = rect;
});
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = null;
});
function render(tree: ReactNode) {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  act(() => root!.render(tree));
}

/* Accessible-name lookups: aria-labelledby, then aria-label, then text. */
const ROLE_SELECTOR: Record<string, string> = { button: 'button,[role="button"]', option: '[role="option"]', dialog: '[role="dialog"]', separator: '[role="separator"]', group: '[role="group"]' };
function nameOf(el: Element) {
  const by = el.getAttribute('aria-labelledby');
  if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
  return el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '';
}
const screen = {
  queryByRole(role: string, opts: { name?: string | RegExp } = {}) {
    const all = [...document.querySelectorAll<HTMLElement>(ROLE_SELECTOR[role])];
    return all.find((el) => opts.name === undefined || (typeof opts.name === 'string' ? nameOf(el) === opts.name : opts.name.test(nameOf(el)))) ?? null;
  },
  getByRole(role: string, opts: { name?: string | RegExp } = {}) {
    const el = screen.queryByRole(role, opts);
    if (!el) throw new Error(`no ${role} named ${String(opts.name)}`);
    return el;
  },
  getAllByRole(role: string) {
    return [...document.querySelectorAll<HTMLElement>(ROLE_SELECTOR[role])];
  },
};
const fireEvent = { click: (el: HTMLElement) => act(() => el.click()) };

/** Real key presses on the focused element, as UI SDK's testing helpers send them. */
async function press(...keys: string[]) {
  const keyboard = mount(definePrimitive({ name: 'keyboard', state: () => ({}), api: () => ({}), slots: (slot) => ({ root: slot({}) }) }), {}, '<root></root>');
  try {
    await act(() => keyboard.keys(...keys));
  } finally {
    keyboard.unmount();
  }
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 0)));

function Shell() {
  return (
    <BLProvider>
      <WorkbenchShell defaultDockOpen>
        <WorkbenchSidebar>threads</WorkbenchSidebar>
        <WorkbenchMain>
          <WorkbenchHeader>
            <WorkbenchSidebarTrigger />
            <WorkbenchDockTrigger />
          </WorkbenchHeader>
          <WorkbenchContent>chat</WorkbenchContent>
          <WorkbenchDock>terminal</WorkbenchDock>
        </WorkbenchMain>
      </WorkbenchShell>
    </BLProvider>
  );
}

describe('WorkbenchDock', () => {
  it('resizes through UI SDK Resizable: a named separator between the content and the dock, with window-splitter keys', async () => {
    render(<Shell />);
    await settle();
    const handle = screen.getByRole('separator', { name: 'Resize dock' });
    expect(handle.getAttribute('aria-orientation')).toBe('horizontal');
    expect(handle.getAttribute('tabindex')).toBe('0');
    const now = () => Number(handle.getAttribute('aria-valuenow'));
    const start = now();
    act(() => handle.focus());
    // ArrowUp moves the edge up: the content (the primary pane) shrinks, the dock grows.
    await press('ArrowUp');
    expect(now()).toBeLessThan(start);
    // Home: the primary pane at its smallest, so the dock at its max (520px of 600).
    await press('Home');
    expect(now()).toBe(Number(handle.getAttribute('aria-valuemin')));
    await press('End');
    expect(now()).toBe(Number(handle.getAttribute('aria-valuemax')));
  });

  it('keeps the height a resize ended at when the dock closes and opens again', async () => {
    render(<Shell />);
    await settle();
    const dockPanel = () => document.querySelector('[data-slot="workbench-dock"]')?.closest<HTMLElement>('[data-slot="resizable-panel"]');
    expect(dockPanel()?.style.flex).toContain('190px');
    act(() => screen.getByRole('separator', { name: 'Resize dock' }).focus());
    await press('ArrowUp');
    const toggle = screen.getByRole('button', { name: 'Terminal' });
    fireEvent.click(toggle);
    await settle();
    expect(screen.queryByRole('separator', { name: 'Resize dock' })).toBeNull();
    fireEvent.click(toggle);
    await settle();
    // The stubbed panel box is 300px tall: that is what the commit read and the reopened dock starts at.
    expect(dockPanel()?.style.flex).toContain('300px');
  });
});

describe('Header toggles', () => {
  it('expose their state (aria-pressed, or aria-expanded for a pane) and change the shell', async () => {
    render(<Shell />);
    await settle();
    const terminal = screen.getByRole('button', { name: 'Terminal' });
    expect(terminal.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(terminal);
    await settle();
    expect(terminal.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('[data-slot="workbench-dock"]')).toBeNull();

    // A pane's trigger says whether its pane shows (AdaptivePaneTrigger).
    const sidebar = screen.getByRole('button', { name: 'Sidebar' });
    expect(sidebar.getAttribute('aria-expanded')).toBe('true');
    expect(sidebar.getAttribute('aria-controls')).toBeTruthy();
    fireEvent.click(sidebar);
    await settle();
    expect(sidebar.getAttribute('aria-expanded')).toBe('false');
  });

  it('full screen is a toggle with one name, on its own too', () => {
    const onClick = vi.fn();
    render(<WorkbenchPanelFullscreen pressed onClick={onClick} />);
    const toggle = screen.getByRole('button', { name: 'Full screen' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('ModelPicker', () => {
  const picker = (props: Partial<React.ComponentProps<typeof ModelPicker>> = {}) =>
    render(
      <BLProvider>
        <ModelPicker models={WORKBENCH_MODELS} providers={WORKBENCH_PROVIDERS} defaultValue="claude-opus-5-5" {...props} />
      </BLProvider>,
    );
  const trigger = () => screen.getByRole('button', { name: /^Model:/ });

  it('passes UI SDK change details through: the Popover reasons, and a pick with its event', async () => {
    const onOpenChange = vi.fn();
    const onValueChange = vi.fn();
    picker({ onOpenChange, onValueChange });
    fireEvent.click(trigger());
    await settle();
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
    // Named by its title, not by the trigger's "Model: …".
    expect(screen.getByRole('dialog', { name: 'Choose a model' })).toBeTruthy();
    const option = screen.getAllByRole('option').find((o) => o.getAttribute('aria-current') !== 'true')!;
    fireEvent.click(option);
    await settle();
    expect(onValueChange).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ reason: 'item-press', event: expect.any(Event) }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'imperative' }));
    expect(trigger().getAttribute('aria-label')).not.toContain('Opus 5.5');
  });

  it('keeps the model and stays open when the consumer cancels a pick', async () => {
    picker({ onValueChange: (_id, details) => details.cancel() });
    const before = trigger().getAttribute('aria-label');
    fireEvent.click(trigger());
    await settle();
    fireEvent.click(screen.getAllByRole('option').find((o) => o.getAttribute('aria-current') !== 'true')!);
    await settle();
    expect(trigger().getAttribute('aria-label')).toBe(before);
    expect(screen.getByRole('dialog', { name: 'Choose a model' })).toBeTruthy();
  });

  it('reports Escape as the reason it closed', async () => {
    const onOpenChange = vi.fn();
    picker({ onOpenChange });
    fireEvent.click(trigger());
    await settle();
    await press('Escape');
    await settle();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
  });
});

describe('WorkbenchTabBar', () => {
  const bar = (onValueChange: React.ComponentProps<typeof WorkbenchTabBar>['onValueChange'], value = 'chat') =>
    render(
      <WorkbenchTabBar value={value} onValueChange={onValueChange}>
        <WorkbenchTab value="chat" icon="bubble-left">Chat</WorkbenchTab>
        <WorkbenchTab value="diff" icon="doc">Diff</WorkbenchTab>
      </WorkbenchTabBar>,
    );

  it("passes the ToggleGroup's change details through", () => {
    const onValueChange = vi.fn();
    bar(onValueChange);
    fireEvent.click(screen.getByRole('button', { name: 'Diff' }));
    expect(onValueChange).toHaveBeenCalledWith('diff', expect.objectContaining({ reason: 'item-press', event: expect.any(Event), cancel: expect.any(Function) }));
  });

  it('in a compact shell, opens the panel page unless the consumer cancels', async () => {
    shellWidth = 500;
    try {
      for (const cancel of [true, false]) {
        render(
          <BLProvider>
            <WorkbenchShell>
              <WorkbenchMain><WorkbenchContent>chat</WorkbenchContent></WorkbenchMain>
              <WorkbenchTabBar value="diff" onValueChange={(_id, details) => { if (cancel) details.cancel(); }}>
                <WorkbenchTab value="chat" icon="bubble-left">Chat</WorkbenchTab>
                <WorkbenchTab value="diff" icon="doc">Diff</WorkbenchTab>
              </WorkbenchTabBar>
            </WorkbenchShell>
          </BLProvider>,
        );
        await settle();
        const diff = screen.getByRole('button', { name: 'Diff' });
        expect(diff.getAttribute('aria-pressed')).toBe('false');
        fireEvent.click(diff);
        await settle();
        expect(screen.getByRole('button', { name: 'Diff' }).getAttribute('aria-pressed')).toBe(cancel ? 'false' : 'true');
        await act(async () => root?.unmount());
        host?.remove();
        root = host = null;
      }
    } finally {
      shellWidth = 1300;
    }
  });
});

describe('ThreadGroup', () => {
  it('is a group named by its label', () => {
    render(
      <ThreadGroup label="Active">
        <ThreadItem>fix the build</ThreadItem>
      </ThreadGroup>,
    );
    expect(screen.getByRole('group', { name: 'Active' })).toBeTruthy();
  });
});
