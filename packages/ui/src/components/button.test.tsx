// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

describe('Button', () => {
  it('is a native button that reports each click with how it was pressed', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('data-slot')).toBe('button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][1]).toHaveProperty('source');
  });

  it('takes the variant classes, and the caller’s classes last', () => {
    render(<Button variant="secondary" size="sm" className="rounded-full">Cancel</Button>);
    const button = screen.getByRole('button', { name: 'Cancel' });
    expect(button.className).toContain('bg-secondary');
    expect(button.className).toContain('h-8');
    expect(button.className).toContain('rounded-full');
    expect(button.className).not.toContain('rounded-lg');
  });

  it('does nothing while disabled, and leaves the tab order', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.hasAttribute('data-disabled')).toBe(true);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('stays focusable while disabled when asked to', () => {
    const onClick = vi.fn();
    render(<Button disabled focusableWhenDisabled onClick={onClick}>Publish</Button>);
    const button = screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is pending while the Promise its onClick returns is running, and ignores presses meanwhile', async () => {
    let finish!: () => void;
    const onClick = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<Button onClick={onClick} pendingAnnouncement="">Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(button);
    expect(button.hasAttribute('data-pending')).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    expect(button.hasAttribute('data-pending')).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
  });

  it('renders a link through render, with the button’s look', () => {
    render(<Button variant="link" render={<a href="/docs" />}>Docs</Button>);
    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link.getAttribute('href')).toBe('/docs');
    expect(link.className).toContain('text-link');
  });

  it('draws `link` in the line it sits in, whatever the size, and keeps the size box for `plain`', () => {
    render(<><Button variant="link" size="lg">Inline</Button><Button variant="plain">Cancel</Button></>);
    const link = screen.getByRole('button', { name: 'Inline' }).className.split(' ');
    expect(link).toEqual(expect.arrayContaining(['h-auto', 'p-0', 'text-[length:inherit]', 'font-[weight:inherit]']));
    expect(link).not.toEqual(expect.arrayContaining(['h-11']));
    expect(link).not.toEqual(expect.arrayContaining(['px-5']));
    const plain = screen.getByRole('button', { name: 'Cancel' }).className.split(' ');
    expect(plain).toEqual(expect.arrayContaining(['h-9', 'px-4', 'text-primary', 'bg-transparent']));
  });

  it('is named by its text label, which TextMorph draws, and renders other children as given', () => {
    render(<><Button>Continue</Button><Button aria-label="Add"><svg data-testid="glyph" /></Button></>);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' }).firstElementChild).toBe(screen.getByTestId('glyph'));
  });
});
