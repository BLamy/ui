// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

describe('Card', () => {
  it('lays the header out in two columns only when it has an action', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <CardDescription>48 GB used</CardDescription>
          <CardAction><span>Pro</span></CardAction>
        </CardHeader>
      </Card>,
    );
    const header = container.querySelector('[data-slot="card-header"]')!;
    expect(header.className).toContain('has-data-[slot=card-action]:grid-cols-[1fr_auto]');
    expect(container.querySelector('[data-slot="card-action"]')!.className).toContain('col-start-2');
    expect(screen.getByRole('heading', { level: 3, name: 'Storage' })).toBeTruthy();
  });

  it('renders another element with `render`: a whole-card link, another heading level', () => {
    render(
      <Card render={<a href="/notes" />} variant="elevated" className="mt-2">
        <CardHeader><CardTitle render={<h2 />}>Release notes</CardTitle></CardHeader>
      </Card>,
    );
    const link = screen.getByRole('link', { name: 'Release notes' });
    expect(link.getAttribute('data-slot')).toBe('card');
    expect(link.getAttribute('href')).toBe('/notes');
    expect(link.className).toContain('shadow-raised');
    expect(link.className).toContain('mt-2');
    expect(screen.getByRole('heading', { level: 2, name: 'Release notes' }).getAttribute('data-slot')).toBe('card-title');
  });

  it('rings avatars in its own colour', () => {
    const { container } = render(<Card />);
    expect(container.firstElementChild!.className).toContain('[--avatar-ring:var(--card)]');
  });
});
