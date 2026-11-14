// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EditBar } from '@/components/ui/edit-bar';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
afterEach(cleanup);

const bar = () => screen.getByRole('toolbar', { name: 'Edit' });
const button = (name: string) => screen.getByRole('button', { name });

describe('EditBar', () => {
  it('is a named toolbar with one tab stop and arrow keys between its two actions', () => {
    render(<EditBar count={2} onFav={() => {}} onDelete={() => {}} />);
    const fav = button('Favorite');
    const del = button('Delete');
    expect([fav, del].filter((b) => b.tabIndex === 0)).toHaveLength(1);
    act(() => fav.focus());
    fireEvent.keyDown(fav, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(del);
    fireEvent.keyDown(del, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(fav);
    expect(bar().textContent).toContain('2 selected');
  });

  it('runs Favorite / Unfavorite and Delete on click', () => {
    const onFav = vi.fn();
    const onDelete = vi.fn();
    const { rerender } = render(<EditBar count={1} onFav={onFav} onDelete={onDelete} />);
    fireEvent.click(button('Favorite'));
    fireEvent.click(button('Delete'));
    expect(onFav).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    rerender(<EditBar count={1} allFav onFav={onFav} onDelete={onDelete} />);
    expect(button('Unfavorite')).toBeTruthy();
  });

  it('with nothing selected, both actions are disabled but stay reachable, and say so', async () => {
    const onFav = vi.fn();
    const onDelete = vi.fn();
    render(<EditBar count={0} onFav={onFav} onDelete={onDelete} />);
    expect(bar().textContent).toContain('Select items');
    for (const name of ['Favorite', 'Delete']) {
      const b = button(name);
      expect(b.getAttribute('aria-disabled')).toBe('true');
      expect(b.hasAttribute('data-disabled')).toBe(true);
      fireEvent.click(b);
    }
    expect(onFav).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    // Still one tab stop (the roving focus settles a tick later): the toolbar keeps disabled items focusable.
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect([button('Favorite'), button('Delete')].filter((b) => b.tabIndex === 0)).toHaveLength(1);
  });
});
