// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EmptyState, renderEmptyState } from '@/components/ui/empty-state';

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

  it('keeps every size AA: titles are foreground and descriptions foreground/70, never the tertiary label', () => {
    for (const size of ['sm', 'default', 'lg'] as const) {
      cleanup();
      render(<EmptyState size={size} title="No rows" description="Try a different search." />);
      expect(screen.getByText('No rows').className).toMatch(/(^| )text-foreground( |$)/);
      expect(screen.getByText('Try a different search.').className).toContain('text-foreground/70');
      expect(screen.getByText('Try a different search.').className).not.toContain('tertiary');
    }
  });
});

describe('renderEmptyState', () => {
  const show = (value: Parameters<typeof renderEmptyState>[0]) =>
    render(<div data-testid="host">{renderEmptyState(value, { title: 'No items', description: 'Add one.' })}</div>);

  it('draws the default as a small EmptyState status', () => {
    show(undefined);
    const status = screen.getByRole('status');
    expect(status.getAttribute('data-slot')).toBe('empty-state');
    expect(status.getAttribute('data-size')).toBe('sm');
    expect(status.textContent).toBe('No itemsAdd one.');
  });

  it('reads a string as the title (without the default description)', () => {
    show('No orders');
    expect(screen.getByRole('status').textContent).toBe('No orders');
  });

  it('draws nothing for null, false and the empty string', () => {
    for (const value of [null, false, '']) {
      cleanup();
      show(value);
      expect(screen.getByTestId('host').childElementCount).toBe(0);
    }
  });

  it('keeps a node, giving an EmptyState the status role and wrapping anything else in one', () => {
    show(<EmptyState size="sm" title="No files" />);
    expect(screen.getByRole('status').getAttribute('data-slot')).toBe('empty-state');
    cleanup();
    show(<EmptyState size="sm" role="note" title="Custom role" />);
    expect(screen.queryByRole('status')).toBeNull();
    cleanup();
    show(<p>Nothing yet</p>);
    expect(screen.getByRole('status').textContent).toBe('Nothing yet');
  });
});
