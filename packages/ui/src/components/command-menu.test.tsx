// @vitest-environment happy-dom
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setPlatform } from '@ui-sdk/core/testing';
import {
  CommandMenu, CommandMenuDialog, CommandMenuDialogContent, CommandMenuEmpty, CommandMenuFooter, CommandMenuGroup,
  CommandMenuGroupLabel, CommandMenuInput, CommandMenuItem, CommandMenuList, CommandMenuPage, CommandMenuShortcut, CommandMenuStatus,
  createCommandMenuController, useCommandMenu, useCommandMenuValue, type CommandMenuData, type CommandMenuProps,
} from '@/components/ui/command-menu';
import { DialogTrigger } from '@/components/ui/dialog';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

beforeEach(() => setPlatform('other'));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

/** Lets UI SDK's microtasks and the next frame run. */
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
const input = () => screen.getByRole('combobox') as HTMLInputElement;
const option = (name: string) => screen.getByRole('option', { name });
const highlighted = () => document.querySelector('[data-slot="command-item"][data-highlighted]')?.getAttribute('data-value') ?? null;
const shown = () => [...document.querySelectorAll<HTMLElement>('[data-slot="command-item"]:not([hidden])')].map((el) => el.dataset.value);
const key = (k: string, init: KeyboardEventInit = {}) => { fireEvent.keyDown(input(), { key: k, ...init }); };
const type = (text: string) => { fireEvent.input(input(), { target: { value: text } }); };

function Palette({ children, ...props }: Partial<CommandMenuProps> & { children?: ReactNode }) {
  return (
    <CommandMenu {...props}>
      <CommandMenuInput placeholder="Search commands…" autoFocus={false} />
      <CommandMenuEmpty>No matching commands</CommandMenuEmpty>
      <CommandMenuList>
        <CommandMenuPage>
          <CommandMenuGroup>
            <CommandMenuGroupLabel>Actions</CommandMenuGroupLabel>
            <CommandMenuItem value="new" icon="square-pencil">New thread</CommandMenuItem>
            <CommandMenuItem value="in" title="New thread in…" page="projects" />
            <CommandMenuItem value="copy" title="Copy thread ID" description="b7578c63" />
            <CommandMenuItem value="prs" title="Show linked pull requests" disabled />
          </CommandMenuGroup>
          <CommandMenuGroup>
            <CommandMenuGroupLabel>Threads</CommandMenuGroupLabel>
            <CommandMenuItem value="fix" title="Fix composer grabber" keywords={['handle']} />
          </CommandMenuGroup>
        </CommandMenuPage>
        <CommandMenuPage value="projects" title="Projects" placeholder="Pick a project…" numbered>
          <CommandMenuItem value="ui" title="ui" />
          <CommandMenuItem value="wasm" title="wasm-vm" />
          <CommandMenuItem value="docs" title="docs-site" />
        </CommandMenuPage>
      </CommandMenuList>
      <CommandMenuFooter />
      {children}
    </CommandMenu>
  );
}

describe('CommandMenu', () => {
  it('is a named combobox over a listbox of grouped options, with the first command highlighted', async () => {
    render(<Palette />);
    await settle();
    expect(input().getAttribute('aria-label')).toBe('Search commands…');
    expect(input().getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id);
    expect(screen.getByRole('group', { name: 'Actions' })).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(5);
    expect(option('Show linked pull requests').getAttribute('aria-disabled')).toBe('true');
    expect(highlighted()).toBe('new');
    expect(input().getAttribute('aria-activedescendant')).toBe(option('New thread').id);
    expect(option('New thread').getAttribute('aria-selected')).toBe('true');
  });

  it('moves the highlight with the arrows, skips disabled commands and wraps', async () => {
    const onValueChange = vi.fn();
    render(<Palette onValueChange={onValueChange} />);
    await settle();
    key('ArrowDown');
    expect(highlighted()).toBe('in');
    expect(onValueChange).toHaveBeenLastCalledWith('in', expect.objectContaining({ reason: 'list-navigation' }));
    key('ArrowDown');
    key('ArrowDown');
    expect(highlighted()).toBe('fix');
    key('ArrowDown');
    expect(highlighted()).toBe('new');
    key('ArrowUp');
    expect(highlighted()).toBe('fix');
  });

  it('filters as you type, marks what matched, and Escape clears the search', async () => {
    const onQueryChange = vi.fn();
    render(<Palette onQueryChange={onQueryChange} />);
    await settle();
    type('thr');
    await settle();
    expect(onQueryChange).toHaveBeenLastCalledWith('thr', expect.objectContaining({ reason: 'input-change' }));
    expect(shown()).toEqual(['new', 'in', 'copy']);
    expect(screen.getByRole('group', { name: 'Actions' }).hidden).toBe(false);
    expect(document.querySelectorAll('[data-slot="command-group"][hidden]')).toHaveLength(1);
    expect(document.querySelector('[data-value="new"] mark')?.textContent).toBe('thr');
    type('handle');
    await settle();
    expect(shown()).toEqual(['fix']);
    expect(highlighted()).toBe('fix');
    type('zzzz');
    await settle();
    expect(shown()).toEqual([]);
    expect(document.querySelector('[data-slot="command-empty"]')?.textContent).toBe('No matching commands');
    key('Escape');
    await settle();
    expect(onQueryChange).toHaveBeenLastCalledWith('', expect.objectContaining({ reason: 'escape-key' }));
    expect(input().value).toBe('');
    expect(shown()).toHaveLength(5);
  });

  it('runs a command with Enter or a press: onSelect, then onAction with its value', async () => {
    const calls: string[] = [];
    render(
      <CommandMenu onAction={(value) => { calls.push(`action ${value}`); }}>
        <CommandMenuInput aria-label="Search" autoFocus={false} />
        <CommandMenuList>
          <CommandMenuItem value="a" title="Alpha" onSelect={() => { calls.push('select a'); }} />
          <CommandMenuItem value="b" title="Beta" onSelect={(event) => { calls.push('select b'); event.preventDefault(); }} />
        </CommandMenuList>
      </CommandMenu>,
    );
    await settle();
    key('Enter');
    expect(calls).toEqual(['select a', 'action a']);
    fireEvent.click(option('Beta'));
    expect(calls).toEqual(['select a', 'action a', 'select b']);
  });

  it('opens a page from a command, and Backspace in the empty field goes back to the row it came from', async () => {
    const onPagesChange = vi.fn();
    render(<Palette onPagesChange={onPagesChange} />);
    await settle();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    type('new');
    await settle();
    key('ArrowDown');
    expect(highlighted()).toBe('in');
    key('Enter');
    await settle();
    expect(onPagesChange).toHaveBeenLastCalledWith(['projects'], expect.objectContaining({ reason: 'item-press' }));
    expect(shown()).toEqual(['ui', 'wasm', 'docs']);
    expect(input().value).toBe('');
    expect(input().placeholder).toBe('Pick a project…');
    expect(document.querySelector('[data-slot="command-page-title"]')?.textContent).toBe('Projects');
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.getByText('Back', { selector: 'span' })).toBeTruthy();
    // Holding Backspace to clear a search stops at empty.
    key('Backspace', { repeat: true });
    await settle();
    expect(shown()).toEqual(['ui', 'wasm', 'docs']);
    key('Backspace');
    await settle();
    expect(onPagesChange).toHaveBeenLastCalledWith([], expect.objectContaining({ reason: 'back' }));
    expect(input().value).toBe('new');
    expect(input().placeholder).toBe('Search commands…');
    expect(highlighted()).toBe('in');
  });

  it('goes back with the back button and with Escape', async () => {
    render(<Palette defaultPages={['projects']} />);
    await settle();
    expect(shown()).toEqual(['ui', 'wasm', 'docs']);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await settle();
    expect(shown()).toHaveLength(5);
    key('ArrowDown');
    key('Enter');
    await settle();
    expect(shown()).toEqual(['ui', 'wasm', 'docs']);
    key('Escape');
    await settle();
    expect(shown()).toHaveLength(5);
    expect(highlighted()).toBe('in');
  });

  it('shows and runs ⌘1–⌘9 on a numbered page', async () => {
    const onAction = vi.fn();
    render(<Palette defaultPages={['projects']} onAction={onAction} />);
    await settle();
    const caps = () => [...document.querySelectorAll('[data-slot="command-shortcut"]')].map((el) => el.textContent);
    expect(caps()).toEqual(['Ctrl1', 'Ctrl2', 'Ctrl3']);
    type('s');
    await settle();
    expect(shown()).toEqual(['wasm', 'docs']);
    expect(caps()).toEqual(['Ctrl1', 'Ctrl2']);
    // Only while focus is in the menu.
    fireEvent.keyDown(document.body, { key: '2', code: 'Digit2', ctrlKey: true });
    expect(onAction).not.toHaveBeenCalled();
    input().focus();
    fireEvent.keyDown(input(), { key: '2', code: 'Digit2', ctrlKey: true });
    expect(onAction).toHaveBeenCalledWith('docs', expect.anything());
    // The run carries the key press, as an item's own shortcut does, so it can be told from a click.
    const [, details] = onAction.mock.calls[0];
    expect(details.event).toBeInstanceOf(KeyboardEvent);
    expect((details.event as KeyboardEvent).key).toBe('2');
    expect(highlighted()).toBe('docs');
  });

  it('lets a page set its own filter and take keys over', async () => {
    const onAction = vi.fn();
    function Result() {
      const { query } = useCommandMenu();
      return <CommandMenuItem value="result" title={query ? `= ${query}` : 'Type an expression'} />;
    }
    render(
      <CommandMenu defaultPages={['calc']} onAction={onAction}>
        <CommandMenuInput autoFocus={false} />
        <CommandMenuList>
          <CommandMenuPage><CommandMenuItem value="calc" title="Calculator" page="calc" /></CommandMenuPage>
          <CommandMenuPage
            value="calc"
            placeholder="Calculate…"
            filter={false}
            onKeyDown={(event, controller) => {
              if (event.key !== '=') return;
              event.preventDefault();
              controller.run('result');
            }}
          >
            <Result />
          </CommandMenuPage>
        </CommandMenuList>
      </CommandMenu>,
    );
    await settle();
    type('12+30');
    await settle();
    expect(shown()).toEqual(['result']);
    expect(option('= 12+30')).toBeTruthy();
    key('=');
    expect(onAction).toHaveBeenCalledWith('result', expect.anything());
  });

  it('follows the layout with the arrows in a columns group', async () => {
    // happy-dom lays nothing out: place three columns of 40px cells below a full-width row.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const cell = Number(this.dataset.cell ?? -1);
      const [x, y] = cell < 0 ? [0, 0] : [(cell % 3) * 40, 40 + Math.floor(cell / 3) * 40];
      const width = cell < 0 ? 120 : 40;
      return { x, y, left: x, top: y, right: x + width, bottom: y + 40, width, height: 40, toJSON: () => ({}) } as DOMRect;
    });
    render(
      <CommandMenu>
        <CommandMenuInput aria-label="Emoji" autoFocus={false} />
        <CommandMenuList>
          <CommandMenuItem value="recent" title="Recent" />
          <CommandMenuGroup columns={3}>
            <CommandMenuGroupLabel>Smileys</CommandMenuGroupLabel>
            {['a', 'b', 'c', 'd', 'e'].map((name, i) => <CommandMenuItem key={name} value={name} label={name} data-cell={i}>{name}</CommandMenuItem>)}
          </CommandMenuGroup>
        </CommandMenuList>
      </CommandMenu>,
    );
    await settle();
    expect(screen.getByRole('group', { name: 'Smileys' }).getAttribute('data-columns')).toBe('3');
    key('ArrowDown');
    expect(highlighted()).toBe('a');
    key('ArrowRight');
    expect(highlighted()).toBe('b');
    key('ArrowDown');
    expect(highlighted()).toBe('e');
    key('ArrowLeft');
    expect(highlighted()).toBe('d');
    key('ArrowUp');
    expect(highlighted()).toBe('a');
    key('ArrowUp');
    expect(highlighted()).toBe('recent');
    key('ArrowUp');
    expect(highlighted()).toBe('e');
    // Past the last row the highlight leaves the grid, here around to the top.
    key('ArrowLeft');
    key('ArrowDown');
    expect(highlighted()).toBe('recent');
  });

  it('reports the highlight, the search text and the pages to parts inside', async () => {
    function Probe() {
      const { query, page, pages } = useCommandMenu();
      const value = useCommandMenuValue();
      return <output>{JSON.stringify({ query, page, depth: pages.length, value })}</output>;
    }
    render(<Palette><Probe /></Palette>);
    await settle();
    const read = () => JSON.parse(document.querySelector('output')?.textContent ?? '{}');
    expect(read()).toEqual({ query: '', page: null, depth: 0, value: 'new' });
    key('ArrowDown');
    expect(read().value).toBe('in');
    key('Enter');
    await settle();
    expect(read()).toEqual({ query: '', page: 'projects', depth: 1, value: 'ui' });
  });

  it('is driven from outside by its controller', async () => {
    const controller = createCommandMenuController();
    const onAction = vi.fn();
    render(<Palette controller={controller} onAction={onAction} />);
    await settle();
    act(() => { controller.push('projects'); });
    await settle();
    expect(shown()).toEqual(['ui', 'wasm', 'docs']);
    act(() => { controller.setQuery('wasm'); });
    await settle();
    expect(input().value).toBe('wasm');
    act(() => { controller.run(); });
    expect(onAction).toHaveBeenCalledWith('wasm', expect.anything());
    act(() => { controller.pop(); });
    await settle();
    expect(controller.getPages()).toEqual([]);
  });

  it('ranks commands given as data and renders them as rows', async () => {
    const items: CommandMenuData = [
      { type: 'group', label: 'Actions', items: [{ value: 'new', label: 'New thread', icon: 'square-pencil' }, { value: 'copy', label: 'Copy thread ID', description: 'b7578c63' }] },
      { type: 'separator' },
      { type: 'group', label: 'Threads', items: [{ value: 'list', label: 'Thread list' }, 'Inbox'] },
    ];
    render(
      <CommandMenu items={items}>
        <CommandMenuInput aria-label="Search" autoFocus={false} />
        <CommandMenuList />
      </CommandMenu>,
    );
    await settle();
    expect(shown()).toEqual(['new', 'copy', 'list', 'Inbox']);
    // The description describes the option; it is not part of its name.
    const copy = option('Copy thread ID');
    expect(document.getElementById(copy.getAttribute('aria-describedby')!)?.textContent).toBe('b7578c63');
    type('thr');
    await settle();
    // The group with the best match leads.
    expect(shown()).toEqual(['list', 'new', 'copy']);
    expect(highlighted()).toBe('list');
  });

  it('shows a shortcut as keycaps for the platform, and reports loading', async () => {
    render(
      <CommandMenu status="loading">
        <CommandMenuInput aria-label="Search" autoFocus={false} />
        <CommandMenuStatus>{(state) => (state.loading ? 'Searching…' : null)}</CommandMenuStatus>
        <CommandMenuList>
          <CommandMenuItem value="file" title="Go to file" trailing={<CommandMenuShortcut shortcut="mod+shift+p" />} />
        </CommandMenuList>
      </CommandMenu>,
    );
    await settle();
    expect([...document.querySelectorAll('[data-slot="command-shortcut"] kbd')].map((el) => el.textContent)).toEqual(['Ctrl', 'Shift', 'P']);
    const status = document.querySelector('[data-slot="command-status"]');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.textContent).toBe('Searching…');
    expect(screen.getByRole('listbox').getAttribute('aria-busy')).toBe('true');
    expect(option('Go to file').hasAttribute('aria-keyshortcuts')).toBe(false);
    act(() => setPlatform('apple'));
    cleanup();
    render(
      <CommandMenu>
        <CommandMenuInput aria-label="Search" autoFocus={false} />
        <CommandMenuList><CommandMenuItem value="file" title="Go to file" trailing={<CommandMenuShortcut shortcut="mod+shift+p" />} /></CommandMenuList>
      </CommandMenu>,
    );
    await settle();
    // Apple's modifier order (⌃⌥⇧⌘), whatever order the shortcut was written in, as one tight run like a menu's.
    expect([...document.querySelectorAll('[data-slot="command-shortcut"] kbd')].map((el) => el.textContent)).toEqual(['⇧⌘P']);
  });

  it('inline, it takes focus as it mounts without scrolling the page, through its own input', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    render(<CommandMenu><CommandMenuInput aria-label="Search" /><CommandMenuList><CommandMenuItem value="a" title="A" /></CommandMenuList></CommandMenu>);
    expect(document.activeElement).toBe(input());
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('inline, the legend offers Esc only to clear a search (there is no dialog to close)', async () => {
    render(<Palette />);
    await settle();
    const legend = () => document.querySelector('[data-slot="command-footer"]')?.textContent ?? '';
    expect(legend()).not.toContain('Esc');
    type('thread');
    await settle();
    expect(legend()).toContain('EscClear');
    expect(legend()).not.toContain('Close');
  });

  it('the back button is the kit Button, found by its name', async () => {
    render(<Palette />);
    await settle();
    fireEvent.click(option('New thread in…'));
    await settle();
    const back = screen.getByRole('button', { name: 'Back' });
    expect(back.getAttribute('data-slot')).toBe('button');
  });
});

describe('CommandMenuDialog', () => {
  function Dialog({ onOpenChange, onAction }: { onOpenChange?: (open: boolean, reason: string) => void; onAction?: (value: string) => void }) {
    const [last, setLast] = useState('');
    return (
      <>
        <CommandMenuDialog onOpenChange={(open, details) => onOpenChange?.(open, details.reason)}>
          <DialogTrigger shortcut="mod+k">Search docs</DialogTrigger>
          <CommandMenuDialogContent aria-label="Search docs">
            <CommandMenu onAction={(value) => { setLast(value); onAction?.(value); }}>
              <CommandMenuInput placeholder="Search pages…" />
              <CommandMenuList>
                <CommandMenuPage>
                  <CommandMenuItem value="intro" title="Introduction" />
                  <CommandMenuItem value="dark" title="Toggle dark mode" closeOnSelect={false} />
                  <CommandMenuItem value="more" title="More…" page="more" />
                </CommandMenuPage>
                <CommandMenuPage value="more"><CommandMenuItem value="motion" title="Motion" shortcut="mod+m" /></CommandMenuPage>
              </CommandMenuList>
            </CommandMenu>
          </CommandMenuDialogContent>
        </CommandMenuDialog>
        <output>{last}</output>
      </>
    );
  }
  const dialog = () => screen.queryByRole('dialog');

  it('opens from its trigger or its shortcut, names the dialog and focuses the field', async () => {
    const onOpenChange = vi.fn();
    render(<Dialog onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Search docs' });
    expect(trigger.getAttribute('aria-keyshortcuts')).toBe('Control+K');
    expect(dialog()).toBeNull();
    fireEvent.keyDown(document.body, { key: 'k', code: 'KeyK', ctrlKey: true });
    await settle();
    expect(onOpenChange).toHaveBeenLastCalledWith(true, 'shortcut');
    expect(dialog()?.getAttribute('aria-label')).toBe('Search docs');
    expect(dialog()?.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(input());
  });

  it('closes when a command runs, unless the command keeps it open or opens a page', async () => {
    const onOpenChange = vi.fn();
    const onAction = vi.fn();
    render(<Dialog onOpenChange={onOpenChange} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search docs' }));
    await settle();
    key('ArrowDown');
    key('Enter');
    await settle();
    expect(onAction).toHaveBeenLastCalledWith('dark');
    expect(dialog()).not.toBeNull();
    key('ArrowDown');
    key('Enter');
    await settle();
    expect(dialog()).not.toBeNull();
    expect(shown()).toEqual(['motion']);
    // A command's own shortcut runs it while the dialog is open.
    fireEvent.keyDown(input(), { key: 'm', code: 'KeyM', ctrlKey: true });
    await settle();
    expect(onAction).toHaveBeenLastCalledWith('motion');
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'action');
    expect(dialog()).toBeNull();
  });

  it('sizes the card against its containing block (a framed host), not the window', async () => {
    render(<Dialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Search docs' }));
    await settle();
    expect(dialog()?.className).toContain('max-h-[min(640px,calc(100%-160px))]');
    expect(dialog()?.className).not.toMatch(/vh|vw/);
  });

  it('steps back with Escape before closing, and returns focus to the trigger', async () => {
    const onOpenChange = vi.fn();
    render(<Dialog onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Search docs' });
    trigger.focus();
    fireEvent.click(trigger);
    await settle();
    type('more');
    await settle();
    key('Enter');
    await settle();
    expect(shown()).toEqual(['motion']);
    key('Escape');
    await settle();
    expect(input().value).toBe('more');
    key('Escape');
    await settle();
    expect(input().value).toBe('');
    expect(dialog()).not.toBeNull();
    key('Escape');
    await settle();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'escape-key');
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
