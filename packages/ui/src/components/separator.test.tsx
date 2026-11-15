// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Separator } from '@/components/ui/separator';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

describe('Separator', () => {
  it('is a horizontal separator by default', () => {
    render(<Separator />);
    const rule = screen.getByRole('separator');
    expect(rule.getAttribute('data-slot')).toBe('separator');
    expect(rule.getAttribute('aria-orientation')).toBe('horizontal');
    expect(rule.getAttribute('data-orientation')).toBe('horizontal');
    expect(rule.className).toContain('h-px');
    expect(rule.hasAttribute('tabindex')).toBe(false);
  });

  it('runs vertically, and indents like a list separator when inset', () => {
    const { rerender } = render(<Separator orientation="vertical" />);
    const rule = screen.getByRole('separator');
    expect(rule.getAttribute('aria-orientation')).toBe('vertical');
    expect(rule.className).toContain('w-px');
    rerender(<Separator inset className="my-2" />);
    expect(screen.getByRole('separator').className).toContain('ms-4');
    expect(screen.getByRole('separator').className).toContain('my-2');
  });

  it('is skipped by screen readers when decorative', () => {
    const { container } = render(<Separator decorative orientation="vertical" />);
    expect(screen.queryByRole('separator')).toBeNull();
    const rule = container.querySelector('[data-slot="separator"]')!;
    expect(rule.getAttribute('role')).toBe('none');
    expect(rule.hasAttribute('aria-orientation')).toBe(false);
    expect(rule.getAttribute('data-orientation')).toBe('vertical');
  });
});
