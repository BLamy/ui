// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { IndexBar, indexBarAlphabetItems } from './index-bar';

beforeAll(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
});
afterEach(cleanup);

const items = [
  { value: 'a', caption: 'Alpha' },
  { value: 'b', caption: 'Bravo' },
  { value: 'c', caption: 'Charlie' },
];

describe('IndexBar', () => {
  it('is a named listbox of stops that keeps focus', () => {
    const { getByRole, getAllByRole } = render(<IndexBar items={items} aria-label="Jump to turn" id="rail" data-testid="rail" />);
    const rail = getByRole('listbox', { name: 'Jump to turn' });
    expect(rail.getAttribute('tabindex')).toBe('0');
    expect(rail.getAttribute('aria-orientation')).toBe('vertical');
    expect(rail.id).toBe('rail');
    expect(rail.getAttribute('data-testid')).toBe('rail');
    expect(getAllByRole('option').map((o) => o.getAttribute('aria-label'))).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('moves through the stops with the keys, pointing aria-activedescendant at the stop, and jumps', () => {
    const onJump = vi.fn();
    const { getByRole, getAllByRole } = render(<IndexBar items={items} onJump={onJump} />);
    const rail = getByRole('listbox');
    act(() => rail.focus());
    fireEvent.keyDown(rail, { key: 'ArrowDown' });
    const options = getAllByRole('option');
    expect(rail.getAttribute('aria-activedescendant')).toBe(options[0].id);
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(onJump).toHaveBeenLastCalledWith('a', expect.objectContaining({ index: 0, item: items[0], reason: 'list-navigation' }));
    fireEvent.keyDown(rail, { key: 'ArrowDown' });
    expect(onJump).toHaveBeenLastCalledWith('b', expect.objectContaining({ index: 1 }));
    fireEvent.keyDown(rail, { key: 'End' });
    expect(rail.getAttribute('aria-activedescendant')).toBe(options[2].id);
    expect(onJump).toHaveBeenLastCalledWith('c', expect.objectContaining({ index: 2 }));
    fireEvent.keyDown(rail, { key: 'Home' });
    expect(onJump).toHaveBeenLastCalledWith('a', expect.objectContaining({ index: 0 }));
    // It doesn't wrap past either end.
    const calls = onJump.mock.calls.length;
    fireEvent.keyDown(rail, { key: 'ArrowUp' });
    expect(onJump.mock.calls.length).toBe(calls);
    act(() => rail.blur());
    expect(rail.getAttribute('aria-activedescendant')).toBeNull();
  });

  it('indexBarAlphabetItems: the A–Z rail, letters not in use disabled but still reachable', () => {
    const onJump = vi.fn();
    const { getByRole, getAllByRole } = render(<IndexBar items={indexBarAlphabetItems(['a', 'C'])} onJump={onJump} />);
    const options = getAllByRole('option');
    expect(options).toHaveLength(26);
    expect(options.filter((o) => o.getAttribute('aria-disabled') === 'true').map((o) => o.getAttribute('aria-label')).join('')).toBe('BDEFGHIJKLMNOPQRSTUVWXYZ');
    const rail = getByRole('listbox', { name: 'Jump to section' });
    act(() => rail.focus());
    fireEvent.keyDown(rail, { key: 'End' });
    expect(onJump).toHaveBeenLastCalledWith('Z', expect.objectContaining({ index: 25, reason: 'list-navigation', item: expect.objectContaining({ disabled: true }) }));
    expect(indexBarAlphabetItems().every((i) => !i.disabled)).toBe(true);
  });

  it('marks the current stop and sits on the start or end side', () => {
    const { getByRole, getAllByRole, rerender } = render(<IndexBar items={items} current="b" variant="wave" side="start" />);
    expect(getAllByRole('option').map((o) => o.getAttribute('aria-current'))).toEqual([null, 'true', null]);
    const rail = getByRole('listbox');
    expect(rail.getAttribute('data-side')).toBe('start');
    expect(rail.className).toContain('start-0');
    rerender(<IndexBar items={items} className="top-14 bottom-2" />);
    expect(rail.getAttribute('data-side')).toBe('end');
    expect(rail.className).toContain('end-0');
    expect(rail.className).toContain('top-14');
    expect(rail.className).not.toContain('top-0');
  });

  it('publishes the row inset on its parent from the end side only, and clears it', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const { rerender, unmount } = render(<IndexBar items={items} />, { container: host });
    expect(host.style.getPropertyValue('--bl-index-bar-inset')).not.toBe('');
    rerender(<IndexBar items={items} side="start" />);
    return new Promise<void>((resolve) => requestAnimationFrame(() => {
      expect(host.style.getPropertyValue('--bl-index-bar-inset')).toBe('');
      unmount();
      host.remove();
      resolve();
    }));
  });

  it('jumps to the stop under a press', () => {
    const onJump = vi.fn();
    const { getByRole } = render(<IndexBar items={items} onJump={onJump} />);
    const rail = getByRole('listbox');
    const track = rail.querySelector<HTMLElement>('[data-slot="index-bar-track"]')!;
    const box = { top: 0, left: 0, right: 22, bottom: 30, width: 22, height: 30, x: 0, y: 0, toJSON: () => ({}) };
    rail.getBoundingClientRect = () => box as DOMRect;
    track.getBoundingClientRect = () => box as DOMRect;
    fireEvent.pointerDown(rail, { button: 0, clientX: 10, clientY: 25, pointerId: 1, isPrimary: true });
    expect(onJump).toHaveBeenLastCalledWith('c', expect.objectContaining({ index: 2, reason: 'drag' }));
    fireEvent.pointerUp(rail, { pointerId: 1 });
  });

  it('draws its focus ring from :focus-visible, so a press does not, and sizes the wave panel by the rail', () => {
    const { getByRole, container } = render(<IndexBar items={items} variant="wave" panel />);
    const rail = getByRole('listbox');
    act(() => rail.focus());
    // The ring is only the focus-visible variant: nothing in the class list depends on JS focus state.
    expect(rail.className).toContain('focus-visible:[outline:2px_solid_var(--primary)]');
    expect(rail.className.split(' ')).not.toContain('[outline:2px_solid_var(--primary)]');
    const panel = container.querySelector<HTMLElement>('[data-slot="index-bar-panel"]')!;
    expect(panel.className).toContain('max-h-full');
    expect(container.innerHTML).not.toContain('vh]');
  });
});
