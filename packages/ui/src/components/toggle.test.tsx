// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { definePrimitive } from '@ui-sdk/core';
import { mount } from '@ui-sdk/core/testing';
import { Toggle, ToggleGroup, ToggleGroupItem, ToggleIcon, createToggleController, createToggleGroupController } from '@/components/ui/toggle';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

/** Real key presses on the focused element, as UI SDK's testing helpers send them (Space and Enter click a button
    the way a browser does), from a mount that renders nothing of its own. */
async function press(...keys: string[]) {
  const keyboard = mount(definePrimitive({ name: 'keyboard', state: () => ({}), api: () => ({}), slots: (slot) => ({ root: slot({}) }) }), {}, '<root></root>');
  try {
    await act(() => keyboard.keys(...keys));
  } finally {
    keyboard.unmount();
  }
}

describe('Toggle', () => {
  it('turns with Space and Enter from the keyboard, and says so', async () => {
    const onPressedChange = vi.fn();
    render(<Toggle aria-label="Bold" onPressedChange={onPressedChange}>B</Toggle>);
    const toggle = screen.getByRole('button', { name: 'Bold' });
    act(() => { toggle.focus(); });
    await press('Space');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(onPressedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'press' }));
    await press('Enter');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    await press('Space');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    // UI SDK starts tracking keys at the first press it reports, so that one says "virtual" (see the gaps note);
    // every press after it says "keyboard".
    expect(onPressedChange.mock.calls.slice(1).map(([pressed, details]) => [pressed, details.reason, details.source])).toEqual([
      [false, 'press', 'keyboard'],
      [true, 'press', 'keyboard'],
    ]);
    expect(document.activeElement).toBe(toggle);
  });

  it('is a button that reports whether it is pressed', () => {
    const onPressedChange = vi.fn();
    render(<Toggle aria-label="Bold" onPressedChange={onPressedChange}>B</Toggle>);
    const toggle = screen.getByRole('button', { name: 'Bold' });
    expect(toggle.getAttribute('data-slot')).toBe('toggle');
    expect(toggle.getAttribute('type')).toBe('button');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.hasAttribute('data-pressed')).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.hasAttribute('data-pressed')).toBe(true);
    expect(onPressedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'press' }));
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(onPressedChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'press' }));
  });

  it('starts pressed with defaultPressed, and follows pressed when controlled', () => {
    render(<Toggle defaultPressed>Pin</Toggle>);
    expect(screen.getByRole('button', { name: 'Pin' }).getAttribute('aria-pressed')).toBe('true');
    cleanup();
    const onPressedChange = vi.fn();
    render(<Toggle pressed={false} onPressedChange={onPressedChange}>Mute</Toggle>);
    const toggle = screen.getByRole('button', { name: 'Mute' });
    fireEvent.click(toggle);
    expect(onPressedChange).toHaveBeenCalledWith(true, expect.anything());
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps its state when the change is cancelled', () => {
    render(<Toggle onPressedChange={(_, details) => details.cancel()}>Lock</Toggle>);
    const toggle = screen.getByRole('button', { name: 'Lock' });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('ignores presses while disabled', () => {
    const onPressedChange = vi.fn();
    render(<Toggle disabled defaultPressed onPressedChange={onPressedChange}>Pin</Toggle>);
    const toggle = screen.getByRole('button', { name: 'Pin' }) as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.hasAttribute('data-disabled')).toBe(true);
    fireEvent.click(toggle);
    expect(onPressedChange).not.toHaveBeenCalled();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('is pressed from elsewhere through its controller', () => {
    const controller = createToggleController();
    const onPressedChange = vi.fn();
    render(<Toggle controller={controller} onPressedChange={onPressedChange}>Star</Toggle>);
    act(() => { controller.toggle(); });
    expect(screen.getByRole('button', { name: 'Star' }).getAttribute('aria-pressed')).toBe('true');
    expect(onPressedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'imperative' }));
    expect(controller.isPressed()).toBe(true);
  });

  it('takes the variant classes and hides its icon from the name', () => {
    render(<Toggle variant="outline" size="lg"><ToggleIcon>★</ToggleIcon>Favorite</Toggle>);
    const toggle = screen.getByRole('button', { name: 'Favorite' });
    expect(toggle.className).toContain('shadow-hairline');
    expect(toggle.className).toContain('h-11');
    expect(toggle.hasAttribute('data-has-icon')).toBe(true);
    expect(toggle.querySelector('[data-slot="toggle-icon"]')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('is the quiet toolbar tool with an icon size, and says it is pressed', () => {
    render(<Toggle variant="quiet" size="icon-sm" defaultPressed aria-label="Bookmark"><svg /></Toggle>);
    const toggle = screen.getByRole('button', { name: 'Bookmark' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.className).toContain('text-muted-foreground');
    expect(toggle.className).toContain('data-pressed:bg-secondary');
    expect(toggle.className).toContain('size-7');
  });

  it('draws the solid focus ring Button draws', () => {
    render(<Toggle>Pin</Toggle>);
    expect(screen.getByRole('button', { name: 'Pin' }).className).toContain('focus-visible:ring-ring ');
  });
});

const pressed = () => screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

function Views(props: Partial<React.ComponentProps<typeof ToggleGroup>>) {
  return (
    <ToggleGroup aria-label="View" {...props}>
      <ToggleGroupItem value="list">List</ToggleGroupItem>
      <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
      <ToggleGroupItem value="board">Board</ToggleGroupItem>
    </ToggleGroup>
  );
}

describe('ToggleGroup', () => {
  it('is a named group of toggles with one tab stop', () => {
    render(<Views defaultValue={['grid']} />);
    const group = screen.getByRole('group', { name: 'View' });
    expect(group.getAttribute('data-slot')).toBe('toggle-group');
    const [list, grid, board] = screen.getAllByRole('button');
    expect(pressed()).toEqual(['Grid']);
    expect([list, grid, board].map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });

  it('presses one at a time, and can press none', () => {
    const onValueChange = vi.fn();
    render(<Views defaultValue={['grid']} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(pressed()).toEqual(['Board']);
    expect(onValueChange).toHaveBeenLastCalledWith(['board'], expect.objectContaining({ reason: 'item-press' }));
    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    expect(pressed()).toEqual([]);
    expect(onValueChange).toHaveBeenLastCalledWith([], expect.objectContaining({ reason: 'item-press' }));
  });

  it('keeps one pressed with deselectable={false}', () => {
    const onValueChange = vi.fn();
    render(<Views defaultValue={['grid']} deselectable={false} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    expect(pressed()).toEqual(['Grid']);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('presses several with multiple, in the items’ order', () => {
    const onValueChange = vi.fn();
    render(<Views multiple defaultValue={['board']} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(pressed()).toEqual(['List', 'Board']);
    expect(onValueChange).toHaveBeenLastCalledWith(['list', 'board'], expect.anything());
  });

  it('moves focus with the arrow keys without pressing, and wraps', () => {
    const onValueChange = vi.fn();
    render(<Views defaultValue={['list']} onValueChange={onValueChange} />);
    const [list, grid, board] = screen.getAllByRole('button');
    list.focus();
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(grid);
    fireEvent.keyDown(grid, { key: 'End' });
    expect(document.activeElement).toBe(board);
    fireEvent.keyDown(board, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(list);
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(board);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(pressed()).toEqual(['List']);
  });

  it('follows a controlled value, and a controller changes it', () => {
    const controller = createToggleGroupController();
    const onValueChange = vi.fn();
    render(<Views value={['list']} onValueChange={onValueChange} controller={controller} />);
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    expect(onValueChange).toHaveBeenLastCalledWith(['grid'], expect.objectContaining({ reason: 'item-press' }));
    expect(pressed()).toEqual(['List']);
    act(() => { controller.setValue(['board']); });
    expect(onValueChange).toHaveBeenLastCalledWith(['board'], expect.objectContaining({ reason: 'imperative' }));
  });

  it('keeps disabled toggles reachable but not pressable', () => {
    const onValueChange = vi.fn();
    render(<Views disabled onValueChange={onValueChange} />);
    const list = screen.getByRole('button', { name: 'List' });
    expect(list.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(list);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('gives its items its variant and size', () => {
    render(<Views variant="outline" size="sm" />);
    const list = screen.getByRole('button', { name: 'List' });
    expect(list.className).toContain('h-8');
    expect(list.className).toContain('rounded-none');
    expect(screen.getByRole('group').getAttribute('data-variant')).toBe('outline');
    // Joined items draw their focus ring inside the shared frame, so no neighbour covers it.
    expect(list.className).toContain('focus-visible:ring-inset');
  });

  it('gives its items the quiet look', () => {
    render(<Views variant="quiet" size="icon" />);
    const list = screen.getByRole('button', { name: 'List' });
    expect(list.className).toContain('text-muted-foreground');
    expect(list.className).toContain('size-9');
  });

  it('slides one card behind the pressed item of a segmented group that presses one at a time', async () => {
    const { container } = render(<Views variant="segmented" defaultValue={['grid']} />);
    const indicator = container.querySelector<HTMLElement>('[data-slot="selection-indicator"]')!;
    expect(indicator).toBeTruthy();
    expect(indicator.getAttribute('role')).toBe('presentation');
    expect(indicator.parentElement).toBe(screen.getByRole('group'));
    await tick();
    expect(indicator.style.getPropertyValue('--selection-indicator-width')).toBe('0px');
    // The pressed item draws no card of its own: the indicator is it.
    expect(screen.getByRole('button', { name: 'Grid' }).className).not.toContain('bg-segment');
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    await tick();
    expect(indicator.style.getPropertyValue('--selection-indicator-width')).toBe('');
  });

  it('has no sliding card where several can be pressed, or in the other variants', () => {
    const many = render(<Views variant="segmented" multiple defaultValue={['grid']} />);
    expect(many.container.querySelector('[data-slot="selection-indicator"]')).toBeNull();
    // Each pressed item wears Segmented's card; the others stay bare.
    expect(screen.getByRole('button', { name: 'Grid' }).className).toContain('bg-segment');
    expect(screen.getByRole('button', { name: 'List' }).className).not.toContain('bg-segment');
    many.unmount();
    const outline = render(<Views variant="outline" defaultValue={['grid']} />);
    expect(outline.container.querySelector('[data-slot="selection-indicator"]')).toBeNull();
  });

  it('shows the pressed item in every variant, and draws segments only from the group', () => {
    for (const variant of ['default', 'filled', 'outline', 'quiet'] as const) {
      const r = render(<Views variant={variant} defaultValue={['grid']} />);
      const grid = screen.getByRole('button', { name: 'Grid' });
      expect(grid.getAttribute('aria-pressed')).toBe('true');
      expect(grid.className).toMatch(/data-pressed:bg-/);
      expect(grid.className).not.toContain('bg-segment');
      r.unmount();
    }
    // An item's own variant picks a Toggle look; it never makes a bare segment outside a segmented group.
    render(
      <ToggleGroup aria-label="Mixed" defaultValue={['a']}>
        <ToggleGroupItem value="a" variant="filled">A</ToggleGroupItem>
      </ToggleGroup>,
    );
    expect(screen.getByRole('button', { name: 'A' }).className).toContain('bg-secondary');
  });

  it('joins an outline group along its orientation', () => {
    render(<Views variant="outline" orientation="vertical" />);
    expect(screen.getByRole('group').className).toContain('data-[orientation=vertical]:flex-col');
    const list = screen.getByRole('button', { name: 'List' });
    expect(list.getAttribute('data-orientation')).toBe('vertical');
    expect(list.className).toContain('data-[orientation=vertical]:first:rounded-t-ctl');
    expect(list.className).toContain('data-[orientation=vertical]:not-first:shadow-hairline-t');
  });
});
