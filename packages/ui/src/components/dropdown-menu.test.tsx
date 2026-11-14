// @vitest-environment happy-dom
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuGroupLabel, DropdownMenuItem,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger, createMenuController, type MenuData,
} from '@/components/ui/dropdown-menu';
import { ThemeScope } from '@/lib/theme';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

/** Lets UI SDK commit what an event started (focus moves and popups settle a tick later). */
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const key = async (name: string) => { fireEvent.keyDown(document.activeElement!, { key: name }); await settle(); };
const press = async (el: Element) => { fireEvent.click(el); await settle(); };

function Actions(props: Partial<ComponentProps<typeof DropdownMenu>> & { onSelect?: (event: Event) => void }) {
  const { onSelect, ...menu } = props;
  return (
    <DropdownMenu {...menu}>
      <DropdownMenuTrigger className={buttonVariants({ variant: 'secondary' })}>Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem value="copy" shortcut="mod+c" onSelect={onSelect}>Copy</DropdownMenuItem>
        <DropdownMenuItem value="share" description="By mail or message">Share</DropdownMenuItem>
        <DropdownMenuItem value="lock" disabled>Lock</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="delete" destructive>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenu', () => {
  it('opens from its trigger, which names the menu', async () => {
    render(<Actions />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
    await press(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu', { name: 'Actions' });
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(
      [expect.stringMatching(/^Copy/), 'ShareBy mail or message', 'Lock', 'Delete'],
    );
    expect(within(menu).getAllByRole('separator')).toHaveLength(1);
    // The row above a separator drops its hairline by the separator's slot, which the styles key on.
    const separator = within(menu).getByRole('separator');
    expect(separator.getAttribute('data-slot')).toBe('menu-separator');
    expect(separator.previousElementSibling?.className).toContain('[&:has(+[data-slot=menu-separator])]:after:hidden');
  });

  it('moves with the arrow keys and runs the highlighted item on Enter, then gives focus back', async () => {
    const onAction = vi.fn();
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(<Actions onAction={onAction} onSelect={onSelect} onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    trigger.focus();
    await key('ArrowDown');
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
    const copy = screen.getByRole('menuitem', { name: /Copy/ });
    expect(document.activeElement).toBe(copy);
    expect(copy.hasAttribute('data-highlighted')).toBe(true);
    await key('ArrowDown');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Share/ }));
    await key('ArrowUp');
    await key('Enter');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('copy', expect.anything());
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'item-press' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on Escape with its reason, and a cancelled close keeps it open', async () => {
    const onOpenChange = vi.fn((open: boolean, details: { reason: string; cancel: () => void }) => {
      if (!open && details.reason === 'escape-key' && guard.on) details.cancel();
    });
    const guard = { on: true };
    render(<Actions defaultOpen onOpenChange={onOpenChange} />);
    await settle();
    screen.getByRole('menuitem', { name: /Copy/ }).focus();
    await key('Escape');
    expect(screen.getByRole('menu')).toBeTruthy();
    guard.on = false;
    await key('Escape');
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps a disabled item reachable but does not run it', async () => {
    const onAction = vi.fn();
    render(<Actions defaultOpen onAction={onAction} />);
    await settle();
    const lock = screen.getByRole('menuitem', { name: 'Lock' });
    expect(lock.getAttribute('aria-disabled')).toBe('true');
    expect(lock.hasAttribute('data-disabled')).toBe(true);
    await press(lock);
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Copy/ }).getAttribute('aria-disabled')).toBeNull();
  });

  it('draws the shortcut, the destructive tint and a link row from UI SDK props', async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>File</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem value="save" shortcut="mod+s">Save</DropdownMenuItem>
          <DropdownMenuItem value="delete" destructive>Delete</DropdownMenuItem>
          <DropdownMenuItem render={<a href="/docs" />}>Docs</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await settle();
    const save = screen.getByRole('menuitem', { name: /Save/ });
    expect(save.getAttribute('aria-keyshortcuts')).toMatch(/\+S$/);
    expect(save.querySelector('[data-slot=menu-shortcut]')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('menuitem', { name: 'Delete' }).hasAttribute('data-destructive')).toBe(true);
    const docs = screen.getByRole('menuitem', { name: 'Docs' });
    expect(docs.tagName).toBe('A');
    expect(docs.getAttribute('href')).toBe('/docs');
  });

  it('toggles checkbox items and keeps the menu open', async () => {
    const onCheckedChange = vi.fn();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>View</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuGroupLabel>Show</DropdownMenuGroupLabel>
            <DropdownMenuCheckboxItem value="photos" defaultChecked>Photos</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem value="videos" onCheckedChange={onCheckedChange}>Videos</DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await settle();
    expect(screen.getByRole('group', { name: 'Show' })).toBeTruthy();
    const [photos, videos] = screen.getAllByRole('menuitemcheckbox');
    expect(photos.getAttribute('aria-checked')).toBe('true');
    expect(videos.getAttribute('aria-checked')).toBe('false');
    // The checkmark's column is there for both; the mark only while checked.
    expect(photos.querySelector('[data-slot=menu-item-indicator]')).toBeTruthy();
    expect(videos.querySelector('[data-slot=menu-item-indicator]')).toBeNull();
    await press(videos);
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'item-press' }));
    expect(videos.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('holds one value in a radio group', async () => {
    const onValueChange = vi.fn();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Sort</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup defaultValue="date" onValueChange={onValueChange}>
            <DropdownMenuGroupLabel>Sort by</DropdownMenuGroupLabel>
            <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="date">Date modified</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await settle();
    const [name, date] = screen.getAllByRole('menuitemradio');
    expect([name, date].map((item) => item.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    await press(name);
    expect(onValueChange).toHaveBeenCalledWith('name', expect.objectContaining({ reason: 'item-press' }));
    expect([name, date].map((item) => item.getAttribute('aria-checked'))).toEqual(['true', 'false']);
  });

  it('opens a submenu with the arrow toward it and closes it with the arrow back', async () => {
    const onAction = vi.fn();
    render(
      <DropdownMenu defaultOpen onAction={onAction}>
        <DropdownMenuTrigger>File</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Open recent</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem value="roadmap">roadmap.md</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await settle();
    const row = screen.getByRole('menuitem', { name: 'Open recent' });
    expect(row.getAttribute('aria-haspopup')).toBe('menu');
    expect(row.getAttribute('aria-expanded')).toBe('false');
    row.focus();
    await key('ArrowRight');
    expect(row.getAttribute('aria-expanded')).toBe('true');
    const item = screen.getByRole('menuitem', { name: 'roadmap.md' });
    expect(document.activeElement).toBe(item);
    await key('ArrowLeft');
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(row);
    await key('ArrowRight');
    await key('Enter');
    expect(onAction).toHaveBeenCalledWith('roadmap', expect.anything());
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('draws a data menu with the same rows', async () => {
    const items: MenuData = [
      { value: 'open', label: 'Open…', shortcut: 'mod+o' },
      { type: 'separator' },
      { type: 'checkbox', value: 'toolbar', label: 'Toolbar', defaultChecked: true },
      { type: 'radio-group', name: 'sort', label: 'Sort by', defaultValue: 'name', items: [{ value: 'name', label: 'Name' }, { value: 'date', label: 'Date' }] },
      { type: 'submenu', label: 'Share', items: ['Copy link'] },
    ];
    const onAction = vi.fn();
    const onValueChange = vi.fn();
    render(
      <DropdownMenu defaultOpen items={items} itemShortcuts={false} onAction={onAction} onValueChange={onValueChange}>
        <DropdownMenuTrigger>File</DropdownMenuTrigger>
        <DropdownMenuContent />
      </DropdownMenu>,
    );
    await settle();
    expect(screen.getAllByRole('menu')).toHaveLength(1);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Toolbar' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('group', { name: 'Sort by' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Share' }).getAttribute('aria-haspopup')).toBe('menu');
    await press(screen.getByRole('menuitemradio', { name: 'Date' }));
    expect(onValueChange).toHaveBeenCalledWith('date', expect.objectContaining({ group: 'sort' }));
    await press(screen.getByRole('menuitem', { name: /Open/ }));
    expect(onAction).toHaveBeenCalledWith('open', expect.anything());
  });

  it('opens and closes from a controller', async () => {
    const controller = createMenuController();
    render(<Actions controller={controller} />);
    await act(async () => { void controller.open(); });
    await settle();
    expect(screen.getByRole('menu')).toBeTruthy();
    await act(async () => { controller.close(); });
    await settle();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('wears the ThemeScope it was opened from', async () => {
    render(<ThemeScope scope="terminal"><Actions defaultOpen /></ThemeScope>);
    await settle();
    expect(screen.getByRole('menu').getAttribute('data-theme-scope')).toBe('terminal');
  });
});
