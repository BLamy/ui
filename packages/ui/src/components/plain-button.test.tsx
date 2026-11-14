// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button } from '@ui-sdk/react/button';
import { Toggle } from '@ui-sdk/react/toggle';
import { PlainButton, PlainToggleButton } from '@/components/ui/plain-button';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

describe('PlainButton', () => {
  it('is UI SDK’s own Button and Toggle, not a wrapper around them', () => {
    expect(PlainButton).toBe(Button);
    expect(PlainToggleButton).toBe(Toggle);
  });

  it('is UI SDK’s button with only the classes it is given, and keeps its title', () => {
    const onClick = vi.fn();
    render(<PlainButton title="Search" aria-label="Search" className="size-8" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Search' });
    expect(button.getAttribute('title')).toBe('Search');
    expect(button.className).toBe('size-8');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', () => {
    const onClick = vi.fn();
    render(<PlainButton disabled onClick={onClick}>Go</PlainButton>);
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button.hasAttribute('data-disabled')).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('PlainToggleButton', () => {
  it('stays pressed, and says why it changed', () => {
    const onPressedChange = vi.fn();
    render(<PlainToggleButton aria-label="Star" onPressedChange={onPressedChange} />);
    const toggle = screen.getByRole('button', { name: 'Star' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.hasAttribute('class')).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.hasAttribute('data-pressed')).toBe(true);
    expect(onPressedChange).toHaveBeenCalledTimes(1);
    expect(onPressedChange.mock.calls[0][0]).toBe(true);
    expect(onPressedChange.mock.calls[0][1].reason).toBe('press');
  });
});
