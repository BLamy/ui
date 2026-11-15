// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

describe('Badge', () => {
  it('is a span with the size and variant classes, merging className last', () => {
    render(<Badge size="sm" variant="warning" className="ml-auto" aria-label="3 expiring">3</Badge>);
    const badge = screen.getByLabelText('3 expiring');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.getAttribute('data-slot')).toBe('badge');
    expect(badge.className).toContain('h-[18px]');
    expect(badge.className).toContain('bg-warning');
    expect(badge.className).toContain('ml-auto');
  });

  it('renders another element with `render`', () => {
    render(<Badge render={<a href="#failures" />} variant="destructive">View 3 failures</Badge>);
    const link = screen.getByRole('link', { name: 'View 3 failures' });
    expect(link.getAttribute('data-slot')).toBe('badge');
    expect(link.className).toContain('bg-destructive');
  });

  it('puts black text on the light fills (success, warning) and white only where it clears 3:1', () => {
    render(<><Badge variant="success">Live</Badge><Badge variant="warning">Beta</Badge></>);
    expect(screen.getByText('Live').className).toContain('text-black');
    expect(screen.getByText('Beta').className).toContain('text-black');
    expect(screen.getByText('Live').className).not.toContain('text-white');
  });
});
