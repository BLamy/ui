// @vitest-environment happy-dom
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TailscaleLoginButton, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button';
import { createTailscale, memoryTailscalePersistence, type Tailscale } from '@/lib/tailscale';
import { createFakeTailscaleClient } from '@/lib/tailscale-fake';
import { TailscaleProvider, useTailscaleFetch, useTailscaleStatus } from '@/lib/tailscale-react';

afterEach(cleanup);

function make(opts: Parameters<typeof createFakeTailscaleClient>[0] = {}) {
  const fake = createFakeTailscaleClient({ startMs: 1, approveAfterMs: false, ...opts });
  const tailscale = createTailscale({ client: () => fake.client, env: { open: () => null, locks: null } });
  return { fake, tailscale };
}

const Shell = ({ tailscale }: { tailscale: Tailscale }) => (
  <TailscaleProvider tailscale={tailscale}>
    <TailscaleLoginButton />
    <TailscaleStatusBadge />
  </TailscaleProvider>
);

describe('TailscaleLoginButton', () => {
  it('walks sign in → signing in (with the link) → connected → signed out', async () => {
    const { fake, tailscale } = make({ tailnet: 'tail1234.ts.net' });
    render(<Shell tailscale={tailscale} />);
    const button = screen.getByRole('button', { name: 'Sign in with Tailscale' });
    expect(button.getAttribute('data-status')).toBe('idle');
    expect(screen.getByRole('status').textContent).toContain('Not connected');

    act(() => button.click());
    await waitFor(() => expect(screen.getByRole('link', { name: 'Continue to Tailscale' })).toBeTruthy());
    const busy = screen.getByRole('button', { name: /Signing in….*cancel/ });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('link', { name: 'Continue to Tailscale' }).getAttribute('href')).toMatch(/^https:\/\/login\.tailscale\.example\//);

    act(() => fake.approve());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign out of Tailscale' })).toBeTruthy());
    expect(screen.getByRole('status').textContent).toContain('Connected');
    expect(screen.getByRole('status').textContent).toContain('tail1234.ts.net');

    act(() => screen.getByRole('button', { name: 'Sign out of Tailscale' }).click());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in with Tailscale' })).toBeTruthy());
    await tailscale.dispose();
  });

  it('cancels a sign-in when pressed while busy', async () => {
    const { tailscale } = make();
    render(<Shell tailscale={tailscale} />);
    act(() => screen.getByRole('button').click());
    await waitFor(() => expect(screen.getByRole('button').getAttribute('data-status')).toBe('signing-in'));
    await waitFor(() => expect(screen.getByRole('link')).toBeTruthy());
    act(() => screen.getByRole('button').click());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in with Tailscale' })).toBeTruthy());
    await tailscale.dispose();
  });

  it('shows the error and retries', async () => {
    const { tailscale } = make({ failStart: 'boom' });
    render(<Shell tailscale={tailscale} />);
    act(() => screen.getByRole('button').click());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy());
    expect(screen.getByRole('status').textContent).toContain('boom');
  });

  it('works without a provider from props, with custom labels and handlers', () => {
    const onSignOut = vi.fn();
    render(
      <>
        <TailscaleLoginButton status="connected" onSignOut={onSignOut} labels={{ signOut: 'Disconnect' }} className="w-full" />
        <TailscaleStatusBadge status="connected" tailnet="corp.ts.net" />
      </>,
    );
    const b = screen.getByRole('button', { name: 'Disconnect' });
    expect(b.className).toContain('w-full');
    expect(b.getAttribute('data-slot')).toBe('tailscale-login-button');
    act(() => b.click());
    expect(onSignOut).toHaveBeenCalled();
    expect(screen.getByRole('status').getAttribute('data-status')).toBe('connected');
  });

  it('renders on the server as idle', () => {
    const { tailscale } = make();
    const html = renderToString(<Shell tailscale={tailscale} />);
    expect(html).toContain('Sign in with Tailscale');
    expect(html).toContain('data-status="idle"');
  });
});

describe('TailscaleProvider and hooks', () => {
  it('creates a controller from options once, restores a saved session under StrictMode with one client start', async () => {
    const fake = createFakeTailscaleClient({ startMs: 1 });
    const persistence = memoryTailscalePersistence();
    await persistence.save({ v: 1, hostname: 'kiosk', state: { k: 'v' } });
    const { result, unmount } = renderHook(() => useTailscaleStatus(), {
      wrapper: ({ children }) => (
        <StrictMode>
          <TailscaleProvider options={{ client: () => fake.client, persistence, env: { open: () => null, locks: null } }}>{children}</TailscaleProvider>
        </StrictMode>
      ),
    });
    await waitFor(() => expect(result.current.status).toBe('connected'));
    expect(result.current.selfName).toBe('kiosk.example-tailnet.ts.net');
    expect(fake.starts).toBe(1);
    unmount();
  });

  it('useTailscaleFetch is stable', () => {
    const { tailscale } = make();
    const { result, rerender } = renderHook(() => useTailscaleFetch(), { wrapper: ({ children }) => <TailscaleProvider tailscale={tailscale}>{children}</TailscaleProvider> });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('throws outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useTailscaleStatus())).toThrow(/TailscaleProvider/);
  });
});
