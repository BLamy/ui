// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { IndexBar } from './index-bar';

beforeAll(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
});
afterEach(cleanup);

const items = [
  { key: 'a', caption: 'Alpha' },
  { key: 'b', caption: 'Bravo' },
  { key: 'c', caption: 'Charlie' },
];

describe('IndexBar', () => {
  it('is a named listbox of stops that keeps focus', () => {
    const { getByRole, getAllByRole } = render(<IndexBar items={items} label="Jump to turn" />);
    const rail = getByRole('listbox', { name: 'Jump to turn' });
    expect(rail.getAttribute('tabindex')).toBe('0');
    expect(rail.getAttribute('aria-orientation')).toBe('vertical');
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
    expect(onJump).toHaveBeenLastCalledWith('a', expect.objectContaining({ key: 'a' }), 0, expect.objectContaining({ reason: 'list-navigation' }));
    fireEvent.keyDown(rail, { key: 'ArrowDown' });
    expect(onJump).toHaveBeenLastCalledWith('b', expect.anything(), 1, expect.anything());
    fireEvent.keyDown(rail, { key: 'End' });
    expect(rail.getAttribute('aria-activedescendant')).toBe(options[2].id);
    expect(onJump).toHaveBeenLastCalledWith('c', expect.anything(), 2, expect.anything());
    fireEvent.keyDown(rail, { key: 'Home' });
    expect(onJump).toHaveBeenLastCalledWith('a', expect.anything(), 0, expect.anything());
    // It doesn't wrap past either end.
    const calls = onJump.mock.calls.length;
    fireEvent.keyDown(rail, { key: 'ArrowUp' });
    expect(onJump.mock.calls.length).toBe(calls);
    act(() => rail.blur());
    expect(rail.getAttribute('aria-activedescendant')).toBeNull();
  });

  it('falls back to the A–Z rail and reports letters', () => {
    const onLetter = vi.fn();
    const { getByRole, getAllByRole } = render(<IndexBar avail={new Set(['A'])} onLetter={onLetter} />);
    expect(getAllByRole('option')).toHaveLength(26);
    const rail = getByRole('listbox', { name: 'Jump to section' });
    act(() => rail.focus());
    fireEvent.keyDown(rail, { key: 'End' });
    expect(onLetter).toHaveBeenLastCalledWith('Z', expect.objectContaining({ reason: 'list-navigation' }));
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
    expect(onJump).toHaveBeenLastCalledWith('c', expect.anything(), 2, expect.objectContaining({ reason: 'drag' }));
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
