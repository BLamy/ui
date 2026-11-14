// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/ui/empty-state';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

describe('EmptyState', () => {
  it('renders the title, description and action, and hides the glyph from screen readers', () => {
    const { container } = render(
      <EmptyState
        icon={<svg data-testid="glyph" />}
        title="No messages"
        description="Messages you receive will appear here."
        action={<button type="button">Compose</button>}
      />,
    );
    const root = container.querySelector('[data-slot="empty-state"]')!;
    expect(root.getAttribute('data-size')).toBe('default');
    expect(root.className).toContain('h-full');
    expect(screen.getByText('No messages').getAttribute('data-slot')).toBe('empty-state-title');
    expect(screen.getByText('Messages you receive will appear here.').getAttribute('data-slot')).toBe('empty-state-description');
    expect(screen.getByRole('button', { name: 'Compose' }).closest('[data-slot="empty-state-action"]')).not.toBeNull();
    expect(screen.getByTestId('glyph').closest('[data-slot="empty-state-icon"]')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('leaves out the parts it is not given', () => {
    const { container } = render(<EmptyState size="sm" title="No rows" />);
    const root = container.querySelector('[data-slot="empty-state"]')!;
    expect(root.getAttribute('data-size')).toBe('sm');
    expect(root.className).toContain('py-6');
    expect(root.querySelector('[data-slot="empty-state-icon"]')).toBeNull();
    expect(root.querySelector('[data-slot="empty-state-description"]')).toBeNull();
    expect(root.querySelector('[data-slot="empty-state-action"]')).toBeNull();
  });

  it('passes DOM props through, merges className last and renders another element with `render`', () => {
    const { container } = render(
      <EmptyState title="Nothing here" id="empty" role="status" className="py-10" render={<section />} />,
    );
    const root = container.querySelector('section')!;
    expect(root.getAttribute('data-slot')).toBe('empty-state');
    expect(root.id).toBe('empty');
    expect(root.getAttribute('role')).toBe('status');
    expect(root.className).toContain('py-10');
    expect(screen.getByRole('status').textContent).toBe('Nothing here');
  });
});
