// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator, ToolbarText } from '@/components/ui/toolbar';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
afterEach(cleanup);

const button = (name: string) => screen.getByRole('button', { name });

function EditToolbar({ count, onFavorite, onDelete }: { count: number; onFavorite?: () => void; onDelete?: () => void }) {
  return (
    <Toolbar variant="bar" aria-label="Edit">
      <ToolbarButton disabled={!count} onClick={onFavorite}>Favorite</ToolbarButton>
      <ToolbarText aria-live="polite">{count ? `${count} selected` : 'Select items'}</ToolbarText>
      <ToolbarButton tone="destructive" disabled={!count} onClick={onDelete}>Delete</ToolbarButton>
    </Toolbar>
  );
}

describe('Toolbar', () => {
  it('is a named toolbar with one tab stop; arrows, Home and End move between its buttons and skip its text', () => {
    render(
      <Toolbar aria-label="Formatting">
        <ToolbarButton>Undo</ToolbarButton>
        <ToolbarButton>Redo</ToolbarButton>
        <ToolbarSeparator />
        <ToolbarText>100%</ToolbarText>
        <ToolbarGroup aria-label="Insert">
          <ToolbarButton size="icon-sm" aria-label="Insert link">+</ToolbarButton>
        </ToolbarGroup>
      </Toolbar>,
    );
    const bar = screen.getByRole('toolbar', { name: 'Formatting' });
    expect(bar.getAttribute('data-variant')).toBe('plain');
    expect(bar.getAttribute('data-size')).toBe('default');
    const [undo, redo, link] = [button('Undo'), button('Redo'), button('Insert link')];
    expect([undo, redo, link].filter((b) => b.tabIndex === 0)).toHaveLength(1);
    act(() => undo.focus());
    fireEvent.keyDown(undo, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(redo);
    fireEvent.keyDown(redo, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(link);
    fireEvent.keyDown(link, { key: 'Home' });
    expect(document.activeElement).toBe(undo);
    fireEvent.keyDown(undo, { key: 'End' });
    expect(document.activeElement).toBe(link);
    expect(screen.getByRole('separator').getAttribute('data-orientation')).toBe('vertical');
    expect(screen.getByRole('group', { name: 'Insert' })).toBeTruthy();
  });

  it('bar: the edit-mode composition runs its actions and announces its status', () => {
    const onFavorite = vi.fn();
    const onDelete = vi.fn();
    const { rerender } = render(<EditToolbar count={2} onFavorite={onFavorite} onDelete={onDelete} />);
    const bar = screen.getByRole('toolbar', { name: 'Edit' });
    expect(bar.getAttribute('data-variant')).toBe('bar');
    expect(bar.getAttribute('data-side')).toBe('bottom');
    expect(bar.textContent).toContain('2 selected');
    expect(bar.querySelector('[data-slot="toolbar-text"]')?.getAttribute('aria-live')).toBe('polite');
    fireEvent.click(button('Favorite'));
    fireEvent.click(button('Delete'));
    expect(onFavorite).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    rerender(<EditToolbar count={0} onFavorite={onFavorite} onDelete={onDelete} />);
    expect(bar.textContent).toContain('Select items');
  });

  it('a disabled button stays reachable, says so, and ignores presses', async () => {
    const onFavorite = vi.fn();
    const onDelete = vi.fn();
    render(<EditToolbar count={0} onFavorite={onFavorite} onDelete={onDelete} />);
    for (const name of ['Favorite', 'Delete']) {
      const b = button(name);
      expect(b.getAttribute('aria-disabled')).toBe('true');
      expect(b.hasAttribute('data-disabled')).toBe(true);
      fireEvent.click(b);
    }
    expect(onFavorite).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect([button('Favorite'), button('Delete')].filter((b) => b.tabIndex === 0)).toHaveLength(1);
  });

  it('size reaches the buttons; a button keeps its own size, variant and className', () => {
    render(
      <Toolbar aria-label="Tools" size="sm" variant="floating" className="extra">
        <ToolbarButton>Small</ToolbarButton>
        <ToolbarButton size="icon" aria-label="Icon">*</ToolbarButton>
        <ToolbarButton variant="default" className={(s) => (s.disabled ? 'off' : 'on')}>Primary</ToolbarButton>
      </Toolbar>,
    );
    const bar = screen.getByRole('toolbar', { name: 'Tools' });
    expect(bar.className).toContain('extra');
    expect(bar.className).toContain('rounded-panel');
    expect(button('Small').className).toContain('h-8');
    expect(button('Icon').className).toContain('size-9');
    expect(button('Icon').className).toContain('rounded-ctl');
    expect(button('Primary').className).toContain('bg-primary');
    expect(button('Primary').className).toContain('on');
  });

  it('vertical: Up and Down move, and separators run across', () => {
    render(
      <Toolbar aria-label="Tools" orientation="vertical">
        <ToolbarButton>Pen</ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton>Eraser</ToolbarButton>
      </Toolbar>,
    );
    const pen = button('Pen');
    act(() => pen.focus());
    fireEvent.keyDown(pen, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(button('Eraser'));
    expect(screen.getByRole('separator').getAttribute('data-orientation')).toBe('horizontal');
  });
});
