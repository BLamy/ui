// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { definePrimitive } from '@ui-sdk/core';
import { mount } from '@ui-sdk/core/testing';
import { Toggle, ToggleIcon, createToggleController } from '@/components/ui/toggle';

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
});
