// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { checkServer } from '@ui-sdk/core/testing';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, expect, it, vi } from 'vitest';
import { workspace } from '@/lib/workspace-primitive';
import {
  Workspace,
  WorkspaceTab,
  WorkspaceTabClose,
  WorkspaceTabTrigger,
  createWorkspaceController,
  type WorkspaceLayout,
  type WorkspaceLayoutChangeDetails,
  type WorkspaceLayoutInput,
  type WorkspaceProps,
} from './workspace';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;
// happy-dom has no hit testing, which a drag's auto-scroll asks for.
document.elementsFromPoint = () => [];
document.elementFromPoint = () => null;
// One bridge for the file: it has no way to be destroyed.
const agent = createAgent();
/** A tab's close button: hidden from assistive tech, so found by its label. */
const closeButton = (title: string) => document.querySelector<HTMLButtonElement>(`[data-slot=workspace-tab-close][aria-label="Close ${title}"]`);
afterEach(cleanup);

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 30)));

const layout: WorkspaceLayoutInput = {
  version: 1,
  root: {
    type: 'split',
    orientation: 'horizontal',
    children: [
      {
        type: 'tabset',
        id: 'left',
        tabs: [
          { id: 'counter', title: 'Counter', data: null },
          { id: 'log', title: 'Log', data: null },
        ],
      },
      { type: 'tabset', id: 'right', tabs: [{ id: 'notes', title: 'Notes', data: null, disableClose: true }] },
    ],
  },
};

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Count {count}</button>;
}
function content(tab: { id: string }) {
  if (tab.id === 'counter') return <Counter />;
  return tab.id === 'notes' ? <textarea aria-label="Draft" defaultValue="Keep this draft" /> : <p>{tab.id} output</p>;
}

function mount(props: Partial<WorkspaceProps> = {}) {
  const controller = createWorkspaceController();
  const changes: WorkspaceLayoutChangeDetails[] = [];
  const commits = vi.fn();
  render(
    <Workspace
      aria-label="Editor"
      defaultLayout={layout}
      controller={controller}
      renderTabContent={content}
      onLayoutChange={(_next, details) => changes.push(details)}
      onLayoutCommit={commits}
      {...props}
    />,
  );
  return { controller, changes, commits };
}

/** Each strip's tabs, as they show. */
const strips = () => screen.getAllByRole('tablist').map((list) => [...list.querySelectorAll('[role=tab]')].map((tab) => tab.textContent));
const tab = (name: string) => screen.getByRole('tab', { name });
const press = (key: string) => fireEvent.keyDown(document.activeElement ?? document.body, { key });
const heard = () => document.querySelector('[aria-live=assertive]')?.textContent ?? '';

it('names its panes, their tab lists and the handle between them', async () => {
  mount();
  await settle();
  expect(screen.getByRole('group', { name: 'Editor' })).toBeTruthy();
  // A split is the workspace's own named group part, rendered by UI SDK's Resizable (which declares no role): one
  // element, laid out by Resizable, named by the workspace.
  const split = screen.getByRole('group', { name: 'Split 1' });
  expect(split.getAttribute('data-slot')).toBe('workspace-split');
  expect(split.getAttribute('data-orientation')).toBe('horizontal');
  expect(split.querySelector(':scope > [role="separator"]')).toBeTruthy();
  // The tab list is named; the Tabs root around it is a plain element with no name of its own.
  for (const root of document.querySelectorAll('[data-slot="tabs"]')) expect(root.hasAttribute('aria-label')).toBe(false);
  expect(screen.getByRole('tablist', { name: 'Pane 1 tabs' })).toBeTruthy();
  expect(screen.getByRole('group', { name: 'Pane 1' })).toBeTruthy();
  expect(screen.getByRole('group', { name: 'Pane 2' })).toBeTruthy();
  expect(screen.getAllByRole('tablist').map((list) => list.getAttribute('aria-label'))).toEqual(['Pane 1 tabs', 'Pane 2 tabs']);
  expect(screen.getByRole('separator', { name: 'Resize Pane 1' }).getAttribute('aria-valuenow')).toBe('50');
  expect(tab('Counter').getAttribute('aria-selected')).toBe('true');
  expect(tab('Log').getAttribute('aria-selected')).toBe('false');
  // One tab stop per strip, and the close buttons stay out of the tab order.
  expect(strips()[0].map((name) => tab(name!).tabIndex)).toEqual([0, -1]);
  expect(closeButton('Counter')!.tabIndex).toBe(-1);
  // A tablist owns only tabs: the close buttons are hidden from assistive tech (Delete on the tab closes it).
  expect(screen.queryByRole('button', { name: 'Close Counter' })).toBeNull();
  for (const list of screen.getAllByRole('tablist')) {
    const owned = within(list).queryAllByRole(/.*/).filter((el) => el.closest('[role=tab]') === null);
    expect(owned.map((el) => el.getAttribute('role') ?? el.tagName)).toEqual([]);
  }
  // Each tab says how it moves.
  expect(document.getElementById(tab('Counter').getAttribute('aria-describedby')!)?.textContent).toContain('Space or Enter');
});

it('keeps a tab’s state and its elements when it moves to another tabset and onto an edge', async () => {
  const { controller, changes } = mount();
  const counter = screen.getByRole('button', { name: 'Count 0' });
  fireEvent.click(counter);
  const draft = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Draft' });
  fireEvent.change(draft, { target: { value: 'Unsaved work' } });

  act(() => void controller.moveTab('counter', { tabsetId: 'right', region: 'center' }));
  expect(strips()).toEqual([['Log'], ['Notes', 'Counter']]);
  expect(screen.getByRole('button', { name: 'Count 1' })).toBe(counter);

  act(() => void controller.moveTab('notes', { tabsetId: 'right', region: 'bottom' }));
  expect(strips()).toEqual([['Log'], ['Counter'], ['Notes']]);
  expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(draft);
  expect(draft.value).toBe('Unsaved work');
  expect(screen.getByRole('button', { name: 'Count 1' })).toBe(counter);
  expect(changes.map((details) => [details.action, details.reason, details.tab])).toEqual([
    ['move', 'imperative', 'counter'],
    ['move', 'imperative', 'notes'],
  ]);
  expect(controller.getLayout().root).toMatchObject({ children: [{ id: 'left' }, { type: 'split', orientation: 'vertical' }] });
});

it('selects with the arrows, and Space picks a tab up to move it along its strip and to the next pane', async () => {
  const { controller, changes, commits } = mount();
  tab('Counter').focus();
  press('ArrowRight');
  expect(document.activeElement).toBe(tab('Log'));
  expect(changes.at(-1)).toMatchObject({ action: 'select', reason: 'list-navigation', tab: 'log', tabset: 'left' });

  press(' ');
  await waitFor(() => expect(heard()).toBe('Picked up Log, Pane 1, position 2 of 2.'));
  expect(tab('Log').closest('[data-slot=workspace-tab]')?.hasAttribute('data-moving')).toBe(true);

  press('ArrowLeft');
  expect(strips()).toEqual([['Log', 'Counter'], ['Notes']]);
  press('ArrowDown');
  await settle();
  expect(strips()).toEqual([['Counter'], ['Log', 'Notes']]);
  // Nothing is committed until it drops, and focus followed the tab to its new strip.
  expect(controller.getLayout().root).toMatchObject({ children: [{ tabs: [{ id: 'counter' }, { id: 'log' }] }, {}] });
  expect(document.activeElement).toBe(tab('Log'));

  press(' ');
  await settle();
  expect(changes.at(-1)).toMatchObject({ action: 'move', reason: 'move-key', tab: 'log', tabset: 'right' });
  expect(commits).toHaveBeenLastCalledWith(controller.getLayout(), expect.objectContaining({ action: 'move', reason: 'move-key' }));
  expect(controller.getLayout().root).toMatchObject({ children: [{ tabs: [{ id: 'counter' }] }, { selectedId: 'log', tabs: [{ id: 'log' }, { id: 'notes' }] }] });
  expect(document.activeElement).toBe(tab('Log'));
  await waitFor(() => expect(heard()).toBe('Dropped Log in Pane 2, position 1 of 2.'));
  expect(screen.getByText('log output').closest('[role=tabpanel]')?.hasAttribute('hidden')).toBe(false);
});

it('puts a picked-up tab back on Escape, and leaves one that may not move alone', async () => {
  const { changes } = mount({ defaultLayout: { version: 1, root: { type: 'tabset', id: 'only', tabs: [{ id: 'a', title: 'A', data: null }, { id: 'b', title: 'B', data: null, disableDrag: true }] } } });
  tab('A').focus();
  press('Enter');
  press('ArrowRight');
  expect(strips()).toEqual([['B', 'A']]);
  press('Escape');
  await settle();
  expect(strips()).toEqual([['A', 'B']]);
  expect(document.activeElement).toBe(tab('A'));

  press('ArrowRight');
  press(' ');
  press('ArrowLeft');
  // Not picked up, so the arrow moved the selection instead.
  expect(strips()).toEqual([['A', 'B']]);
  expect(changes.map((details) => details.action)).toEqual(['select', 'select']);
});

/** Gives the strips and panels boxes: two panes side by side, 400 wide, tabs 100 wide in a 36 tall strip. */
function place() {
  const box = (el: Element, left: number, top: number, width: number, height: number) => {
    el.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
  };
  document.querySelectorAll('[data-slot=workspace-tabset]').forEach((tabset, pane) => {
    box(tabset.querySelector('[data-slot=workspace-header]')!, pane * 400, 0, 400, 36);
    box(tabset.querySelector('[data-slot=workspace-panels]')!, pane * 400, 36, 400, 364);
    tabset.querySelectorAll('[data-slot=workspace-tab]').forEach((item, index) => box(item, pane * 400 + index * 100, 0, 100, 36));
  });
}
const mouse = { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, bubbles: true, cancelable: true };
async function dragTo(x: number, y: number) {
  place();
  fireEvent.pointerMove(document, { ...mouse, clientX: x, clientY: y });
  await settle();
}

it('drags a tab to a place in another strip, and onto an edge, which splits there', async () => {
  const { controller, changes } = mount();
  place();
  fireEvent.pointerDown(tab('Counter'), { ...mouse, clientX: 50, clientY: 18 });
  await dragTo(60, 18);
  expect(document.querySelector('[data-drag-preview]')?.textContent).toBe('Counter');
  expect(screen.getByRole('group', { name: 'Editor' }).hasAttribute('data-dragging')).toBe(true);

  // Before the middle of Notes it goes first, past it last.
  await dragTo(430, 18);
  expect(strips()).toEqual([['Log'], ['Counter', 'Notes']]);
  await dragTo(560, 18);
  expect(strips()).toEqual([['Log'], ['Notes', 'Counter']]);
  expect(changes).toEqual([]);

  // The middle of the content joins the tabset, an edge shows where a new one would open.
  await dragTo(600, 200);
  expect(document.querySelector('[data-slot=workspace-drop-indicator]')?.getAttribute('data-region')).toBe('center');
  await dragTo(790, 200);
  expect(document.querySelector('[data-slot=workspace-drop-indicator]')?.getAttribute('data-region')).toBe('end');
  expect(strips()).toEqual([['Log'], ['Notes']]);

  fireEvent.pointerUp(document, { ...mouse, buttons: 0, clientX: 790, clientY: 200 });
  await settle();
  expect(strips()).toEqual([['Log'], ['Notes'], ['Counter']]);
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({ action: 'move', reason: 'drag', tab: 'counter' });
  expect(controller.getLayout().root).toMatchObject({ children: [{ id: 'left', size: 50 }, { id: 'right', size: 25 }, { tabs: [{ id: 'counter' }], size: 25 }] });
  expect(document.querySelector('[data-drag-preview]')).toBeNull();
  expect(document.querySelector('[data-slot=workspace-drop-indicator]')).toBeNull();
  await waitFor(() => expect(heard()).toBe('Dropped Counter in a new pane to the right of Pane 2, position 1 of 1.'));
});

it('asks `accepts` before a tab leaves its strip, and nothing moves or closes by hand when disabled', async () => {
  const accepts = vi.fn((_tab, target) => !('region' in target));
  const first = mount({ accepts });
  place();
  fireEvent.pointerDown(tab('Counter'), { ...mouse, clientX: 50, clientY: 18 });
  await dragTo(60, 18);
  await dragTo(790, 200);
  expect(accepts).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'counter' }), { tabsetId: 'right', region: 'end' });
  expect(document.querySelector('[data-slot=workspace-drop-indicator]')).toBeNull();
  // Its own tabset's edge asks too.
  await dragTo(390, 200);
  expect(accepts).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'counter' }), { tabsetId: 'left', region: 'end' });
  expect(document.querySelector('[data-slot=workspace-drop-indicator]')).toBeNull();
  // Back where it came from.
  expect(strips()).toEqual([['Counter', 'Log'], ['Notes']]);
  await dragTo(560, 18);
  expect(strips()).toEqual([['Log'], ['Notes', 'Counter']]);
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.pointerUp(document, { ...mouse, buttons: 0, clientX: 560, clientY: 18 });
  await settle();
  expect(strips()).toEqual([['Counter', 'Log'], ['Notes']]);
  expect(first.changes).toEqual([]);
  cleanup();

  const locked = mount({ disabled: true });
  expect(screen.queryByRole('button', { name: /^Close/ })).toBeNull();
  expect(screen.getByRole('separator').hasAttribute('data-disabled')).toBe(true);
  tab('Counter').focus();
  press(' ');
  press('ArrowRight');
  press('Delete');
  expect(strips()).toEqual([['Counter', 'Log'], ['Notes']]);
  // Tabs still select and panes still maximize.
  expect(locked.changes.map((details) => details.action)).toEqual(['select']);
  fireEvent.click(screen.getAllByRole('button', { name: 'Maximize pane' })[0]);
  expect(locked.controller.getLayout().maximizedTabsetId).toBe('left');
});

it('closes a tab with Delete or its button, moves focus to the tab that takes its place, and protects a tab', async () => {
  const { controller, changes } = mount({
    renderTab: (item) => (
      <WorkspaceTab value={item.id}>
        <WorkspaceTabTrigger />
        <WorkspaceTabClose
          onClick={(event) => {
            if (item.id === 'log') event.preventDefault();
          }}
        />
      </WorkspaceTab>
    ),
  });
  expect(closeButton('Notes')).toBeNull();
  // A handler that prevents the click keeps the tab, like to ask about unsaved changes.
  fireEvent.click(closeButton('Log')!);
  expect(strips()[0]).toEqual(['Counter', 'Log']);

  tab('Counter').focus();
  press('Delete');
  await settle();
  expect(strips()).toEqual([['Log'], ['Notes']]);
  expect(document.activeElement).toBe(tab('Log'));
  expect(changes.at(-1)).toMatchObject({ action: 'close', reason: 'remove-press', tab: 'counter', tabset: 'left' });

  // Delete leaves a protected tab, and the last tab takes its tabset with it.
  tab('Notes').focus();
  press('Delete');
  expect(strips()).toEqual([['Log'], ['Notes']]);
  act(() => void controller.closeTab('log'));
  expect(strips()).toEqual([['Notes']]);
  expect(controller.getLayout().root).toMatchObject({ type: 'tabset', id: 'right' });
  expect(screen.queryByRole('button', { name: 'Maximize pane' })).toBeNull();
});

it('maximizes a pane over the others and restores them, keeping what they hold', async () => {
  const seen: Record<string, boolean> = {};
  const { controller, changes } = mount({
    renderTabContent: (item, state) => {
      seen[item.id] = state.visible;
      return content(item);
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Count 0' }));
  expect(seen).toEqual({ counter: true, log: false, notes: true });

  fireEvent.click(screen.getAllByRole('button', { name: 'Maximize pane' })[1]);
  expect(controller.getLayout().maximizedTabsetId).toBe('right');
  expect(changes.at(-1)).toMatchObject({ action: 'maximize', reason: 'toggle-press', tabset: 'right' });
  expect(strips()).toEqual([['Notes']]);
  expect(seen).toEqual({ counter: false, log: false, notes: true });

  fireEvent.click(screen.getByRole('button', { name: 'Restore pane' }));
  expect(controller.getLayout().maximizedTabsetId).toBeUndefined();
  expect(strips()).toEqual([['Counter', 'Log'], ['Notes']]);
  expect(screen.getByRole('button', { name: 'Count 1' })).toBeTruthy();
});

it('resizes a split from its handle, reporting each step and committing once', async () => {
  const { controller, changes, commits } = mount();
  await settle();
  const handle = screen.getByRole('separator', { name: 'Resize Pane 1' });
  handle.focus();
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(changes.map((details) => [details.action, details.reason])).toEqual([
    ['resize', 'step-key'],
    ['resize', 'step-key'],
  ]);
  fireEvent.keyUp(handle, { key: 'ArrowRight' });
  expect(commits).toHaveBeenCalledTimes(1);
  expect(commits.mock.calls[0][1]).toMatchObject({ action: 'resize', reason: 'step-key' });
  expect(controller.getLayout().root).toMatchObject({ children: [{ id: 'left', size: 52 }, { id: 'right', size: 48 }] });
  expect(handle.getAttribute('aria-valuenow')).toBe('52');
});

it('can be controlled, and a canceled change leaves the layout as it was', () => {
  const cancel = vi.fn((details: WorkspaceLayoutChangeDetails) => details.action === 'close' && details.cancel());
  function Controlled() {
    const [value, setValue] = useState<WorkspaceLayoutInput | WorkspaceLayout>(layout);
    return (
      <Workspace
        aria-label="Editor"
        layout={value}
        renderTabContent={content}
        onLayoutChange={(next, details) => {
          if (details.action !== 'close') setValue(next);
        }}
      />
    );
  }
  render(<Controlled />);
  fireEvent.click(tab('Log'));
  expect(tab('Log').getAttribute('aria-selected')).toBe('true');
  // The parent never passes a close back.
  fireEvent.click(closeButton('Log')!);
  expect(strips()).toEqual([['Counter', 'Log'], ['Notes']]);
  cleanup();

  const { controller } = mount({ onLayoutChange: (_next, details) => void cancel(details) });
  act(() => {
    expect(controller.closeTab('counter')).toBe(false);
    expect(controller.selectTab('log')).toBe(true);
    expect(controller.selectTab('log')).toBe(false);
    expect(controller.addTab({ id: 'new', title: 'New', data: null }, { tabsetId: 'right' })).toBe(true);
    expect(controller.addTab({ id: 'new', title: 'New', data: null })).toBe(false);
  });
  expect(controller.getCurrentTabsetId()).toBe('left');
  expect(strips()).toEqual([['Counter', 'Log'], ['Notes', 'New']]);
  expect(tab('Log').getAttribute('aria-selected')).toBe('true');
});

it('unmounts hidden content when it is not kept, and tracks the pane last used', () => {
  const { controller } = mount({ keepMounted: false });
  expect(screen.queryByText('log output')).toBeNull();
  fireEvent.click(tab('Log'));
  expect(screen.getByText('log output')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Count/ })).toBeNull();

  fireEvent.focusIn(screen.getByRole('textbox', { name: 'Draft' }));
  expect(controller.getCurrentTabsetId()).toBe('right');
  expect(screen.getByRole('group', { name: 'Pane 2' }).hasAttribute('data-current')).toBe(true);
  act(() => void controller.addTab({ id: 'new', title: 'New', data: null }));
  expect(strips()).toEqual([['Counter', 'Log'], ['Notes', 'New']]);
});

it('lets an agent find every part and change the layout', async () => {
  const { controller } = mount();
  const entries = agent.snapshot().filter((entry) => !entry.offPage);
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
  // A Tabs instance is named by its list (the root carries no name of its own); UI SDK names a one-tab Tabs by that
  // tab, so Pane 2's is "Notes".
  expect(entries.map((entry) => entry.label)).toEqual(expect.arrayContaining(['Editor', 'Pane 1 tabs', 'Notes', 'Split 1']));

  let result = await agent.act({ steps: [{ ref: 'Pane 1 tabs', action: 'setValue', args: ['Log'] }] });
  expect(result.ok, result.error?.message).toBe(true);
  expect(controller.getLayout().root).toMatchObject({ children: [{ selectedId: 'log' }, {}] });
  result = await agent.act({ steps: [{ ref: 'Editor', action: 'moveTab', args: ['log', { tabsetId: 'right', index: 0 }] }] });
  expect(result.ok, result.error?.message).toBe(true);
  expect(controller.getLayout().root).toMatchObject({ children: [{ tabs: [{ id: 'counter' }] }, { tabs: [{ id: 'log' }, { id: 'notes' }] }] });
});

it('renders its parts on the server', () => {
  checkServer(
    workspace,
    { defaultLayout: layout },
    `<root><tabset value="left"><header><tab value="counter">Counter<tab-close></tab-close></tab></header><toolbar><maximize></maximize></toolbar><panels><empty></empty><drop-indicator></drop-indicator></panels></tabset></root>`,
  );
});

it('tabSide puts the strips at the start or end, as a vertical tab list, and a tabset can override it', async () => {
  render(
    <Workspace
      aria-label="Editor"
      tabSide="start"
      defaultLayout={{
        version: 1,
        root: {
          type: 'split',
          orientation: 'horizontal',
          children: [
            { type: 'tabset', id: 'a', tabs: [{ id: 'one', title: 'One', data: null }] },
            { type: 'tabset', id: 'b', tabSide: 'end', tabs: [{ id: 'two', title: 'Two', data: null }] },
          ],
        },
      }}
      renderTabContent={(tab) => <p>{tab.id}</p>}
    />,
  );
  await settle();
  const sets = document.querySelectorAll('[data-slot=workspace-tabset]');
  expect(sets[0].getAttribute('data-tab-side')).toBe('start');
  expect(sets[1].getAttribute('data-tab-side')).toBe('end');
  expect(sets[0].className).toContain('flex-row');
  expect(sets[1].className).toContain('flex-row-reverse');
  for (const list of screen.getAllByRole('tablist')) expect(list.getAttribute('aria-orientation')).toBe('vertical');
  // The root draws no card of its own: callers add the chrome they want.
  expect(screen.getByRole('group', { name: 'Editor' }).className).not.toContain('border');
});

it('presentation="tabs" shows every tab in one strip at the bottom, keeps state, and picks the tab in its own tabset', async () => {
  const onLayoutChange = vi.fn();
  render(<Workspace aria-label="Editor" presentation="tabs" defaultLayout={layout} renderTabContent={content} onLayoutChange={onLayoutChange} />);
  await settle();
  const root = screen.getByRole('group', { name: 'Editor' });
  expect(root.getAttribute('data-presentation')).toBe('tabs');
  // One strip with all three tabs; no splits, no drop targets, no maximize.
  expect(screen.getAllByRole('tablist')).toHaveLength(1);
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Counter', 'Log', 'Notes']);
  expect(document.querySelector('[data-slot=workspace-split]')).toBeNull();
  expect(screen.queryByRole('button', { name: /Maximize/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Count 0' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Log' }));
  await settle();
  expect(screen.getByRole('tab', { name: 'Log' }).getAttribute('aria-selected')).toBe('true');
  expect(onLayoutChange).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ action: 'select', tab: 'log', tabset: 'left' }));
  // Notes is already the selected tab of its own tabset: picking it makes that tabset the active one.
  fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
  await settle();
  expect(screen.getByRole('tab', { name: 'Notes' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('textbox', { name: 'Draft' })).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Counter' }));
  await settle();
  // The counter kept its state across the switch.
  expect(screen.getByRole('button', { name: 'Count 1' })).toBeTruthy();
});
