// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToggleGroup, ToggleGroupItem, createToggleGroupController } from '@/components/ui/toggle-group';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

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
  });

  it('slides one card behind the pressed item of a filled group that presses one at a time', async () => {
    const { container } = render(<Views variant="filled" defaultValue={['grid']} />);
    const indicator = container.querySelector<HTMLElement>('[data-slot="selection-indicator"]')!;
    expect(indicator).toBeTruthy();
    expect(indicator.getAttribute('role')).toBe('presentation');
    expect(indicator.parentElement).toBe(screen.getByRole('group'));
    await tick();
    expect(indicator.style.getPropertyValue('--selection-indicator-width')).toBe('0px');
    // The pressed item draws no card of its own: the indicator is it.
    expect(screen.getByRole('button', { name: 'Grid' }).className).toContain('data-pressed:bg-transparent');
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    await tick();
    expect(indicator.style.getPropertyValue('--selection-indicator-width')).toBe('');
  });

  it('has no sliding card where several can be pressed, or in the other variants', () => {
    const many = render(<Views variant="filled" multiple defaultValue={['grid']} />);
    expect(many.container.querySelector('[data-slot="selection-indicator"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Grid' }).className).toContain('data-pressed:bg-card');
    many.unmount();
    const outline = render(<Views variant="outline" defaultValue={['grid']} />);
    expect(outline.container.querySelector('[data-slot="selection-indicator"]')).toBeNull();
  });
});
