// @vitest-environment happy-dom
import type { ComponentProps } from 'react';
import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuContextTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const settle = (ms = 20) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const rightClick = async (el: Element, at = { clientX: 40, clientY: 60 }) => {
  const event = createEvent.contextMenu(el, { button: 2, ...at });
  fireEvent(el, event);
  await settle();
  return event;
};

function Tile(props: Partial<ComponentProps<typeof DropdownMenu>> & { disabled?: boolean }) {
  const { disabled, ...menu } = props;
  return (
    <DropdownMenu {...menu}>
      <DropdownMenuContextTrigger disabled={disabled} data-testid="area">
        <button type="button">Lisbon</button>
      </DropdownMenuContextTrigger>
      <DropdownMenuContent aria-label="Photo actions">
        <DropdownMenuItem value="copy">Copy</DropdownMenuItem>
        <DropdownMenuCheckboxItem value="star">Favorite</DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="delete" destructive>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenuContextTrigger', () => {
  it('opens on a right-click, in place of the browser menu, and marks its area', async () => {
    const onOpenChange = vi.fn();
    render(<Tile onOpenChange={onOpenChange} />);
    const area = screen.getByTestId('area');
    expect(screen.queryByRole('menu')).toBeNull();
    const event = await rightClick(area);
    expect(event.defaultPrevented).toBe(true);
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
    expect(screen.getByRole('menu', { name: 'Photo actions' })).toBeTruthy();
    expect(area.hasAttribute('data-open')).toBe(true);
  });

  it('runs the chosen item and closes', async () => {
    const onAction = vi.fn();
    const onOpenChange = vi.fn();
    render(<Tile onAction={onAction} onOpenChange={onOpenChange} />);
    await rightClick(screen.getByTestId('area'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await settle();
    expect(onAction).toHaveBeenCalledWith('delete', expect.anything());
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'item-press' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByTestId('area').hasAttribute('data-open')).toBe(false);
  });

  it('opens from the keyboard on what has focus, moves to the first item, and gives focus back on Escape', async () => {
    render(<Tile />);
    const button = screen.getByRole('button', { name: 'Lisbon' });
    button.focus();
    // The menu key and Shift+F10 fire `contextmenu` with no pointer button.
    fireEvent.contextMenu(button, { button: 0 });
    await settle();
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Copy' }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    await settle();
    expect(document.activeElement).toBe(screen.getByRole('menuitemcheckbox', { name: 'Favorite' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await settle();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('opens on Shift+F10 itself, where the platform fires no contextmenu for it (macOS)', async () => {
    const onOpenChange = vi.fn();
    render(<Tile onOpenChange={onOpenChange} />);
    const button = screen.getByRole('button', { name: 'Lisbon' });
    button.focus();
    const event = createEvent.keyDown(button, { key: 'F10', shiftKey: true });
    fireEvent(button, event);
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.anything());
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Copy' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await settle();
    expect(document.activeElement).toBe(button);
    // F10 alone is not the menu key.
    fireEvent.keyDown(button, { key: 'F10' });
    await settle();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('leaves the browser menu alone when disabled', async () => {
    render(<Tile disabled />);
    const event = await rightClick(screen.getByTestId('area'));
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByTestId('area').hasAttribute('data-disabled')).toBe(true);
  });

  it('opens on a held touch, not on a tap', async () => {
    render(<Tile />);
    const area = screen.getByTestId('area');
    const touch = { pointerType: 'touch', pointerId: 1, isPrimary: true, button: 0, clientX: 30, clientY: 30 };
    fireEvent.pointerDown(area, touch);
    fireEvent.pointerUp(area, touch);
    await settle(560);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.pointerDown(area, touch);
    await settle(560);
    expect(screen.getByRole('menu', { name: 'Photo actions' })).toBeTruthy();
  });

  it('gives focus back to its trigger when the same menu is opened by a button, even after a right-click', async () => {
    render(
      <>
        <button type="button">Elsewhere</button>
        <DropdownMenu>
          <DropdownMenuTrigger>More</DropdownMenuTrigger>
          <DropdownMenuContextTrigger data-testid="area"><button type="button">Lisbon</button></DropdownMenuContextTrigger>
          <DropdownMenuContent aria-label="Photo actions">
            <DropdownMenuItem value="copy">Copy</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>,
    );
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    elsewhere.focus();
    await rightClick(screen.getByTestId('area'));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await settle();
    // Opened by a right-click: focus goes back to what had it.
    expect(document.activeElement).toBe(elsewhere);
    const trigger = screen.getByRole('button', { name: 'More' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    await settle();
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await settle();
    // Opened by its button: UI SDK's return to the trigger, not the opener the right-click recorded.
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps an explicit finalFocus', async () => {
    render(
      <>
        <input aria-label="Rename" />
        <DropdownMenu>
          <DropdownMenuContextTrigger data-testid="area"><button type="button">Lisbon</button></DropdownMenuContextTrigger>
          <DropdownMenuContent aria-label="Photo actions" finalFocus={() => screen.getByRole('textbox', { name: 'Rename' })}>
            <DropdownMenuItem value="rename">Rename</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>,
    );
    screen.getByRole('button', { name: 'Lisbon' }).focus();
    await rightClick(screen.getByTestId('area'));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await settle();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Rename' }));
  });
});
