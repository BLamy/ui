// @vitest-environment happy-dom
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TailscaleExitNodes, TailscaleLoginButton, TailscaleStatusBadge, TailscaleSummary } from '@/components/ui/tailscale-controls';
import { createTailscale, memoryTailscalePersistence, type Tailscale } from '@/lib/tailscale';
import { createFakeTailscaleClient, type FakeTailscaleOptions } from '@/lib/tailscale-fake';
import { TailscaleProvider, useTailscaleFetch, useTailscaleStatus } from '@/lib/tailscale-react';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

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
    const busy = screen.getByRole('button', { name: 'Signing in… Press to cancel.' });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(busy.hasAttribute('data-pending')).toBe(true);
    expect(screen.getByRole('link', { name: 'Continue to Tailscale' }).getAttribute('href')).toMatch(/^https:\/\/login\.tailscale\.example\//);

    act(() => fake.approve());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign out of Tailscale' })).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Sign out of Tailscale' }).hasAttribute('data-pending')).toBe(false);
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

  it('shows the error and retries, with a name that says what is retried', async () => {
    const { tailscale } = make({ failStart: 'boom' });
    render(<Shell tailscale={tailscale} />);
    act(() => screen.getByRole('button').click());
    const retry = await screen.findByRole('button', { name: 'Try again to sign in to Tailscale' });
    expect(retry.textContent).toBe('Try again');
    expect(screen.getByRole('status').textContent).toContain('boom');
  });

  it('is the kit Button: its variants and sizes, contrast and 36px by default, and the variant kept on error', () => {
    render(
      <>
        <TailscaleLoginButton status="idle" />
        <TailscaleLoginButton status="error" variant="outline" size="sm" labels={{ retryName: 'Retry Tailscale' }} />
      </>,
    );
    const idle = screen.getByRole('button', { name: 'Sign in with Tailscale' });
    expect(idle.className).toContain('bg-foreground');
    expect(idle.className).toContain('h-9');
    const failed = screen.getByRole('button', { name: 'Retry Tailscale' });
    expect(failed.className).toContain('shadow-hairline');
    expect(failed.className).toContain('h-8');
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
    expect(b.getAttribute('data-slot')).toBe('button');
    act(() => b.click());
    expect(onSignOut).toHaveBeenCalled();
    expect(screen.getByRole('status').getAttribute('data-status')).toBe('connected');
  });

  it('takes its busy hint from labels', () => {
    render(<TailscaleLoginButton status="starting" labels={{ connecting: 'Verbinden…', cancelHint: 'Zum Abbrechen drücken.' }} />);
    expect(screen.getByRole('button', { name: 'Verbinden… Zum Abbrechen drücken.' })).toBeTruthy();
  });

  it('renders on the server as idle', () => {
    const { tailscale } = make();
    const html = renderToString(<Shell tailscale={tailscale} />);
    expect(html).toContain('Sign in with Tailscale');
    expect(html).toContain('data-status="idle"');
  });
});

describe('TailscaleStatusBadge', () => {
  it('shows the details inline, stacked, or the pill alone', () => {
    const { rerender } = render(<TailscaleStatusBadge status="connected" tailnet="corp.ts.net" />);
    expect(screen.getByRole('status').textContent).toBe('Connectedcorp.ts.net');
    rerender(<TailscaleStatusBadge status="connected" tailnet="corp.ts.net" variant="stacked" />);
    expect(screen.getByRole('status').className).toContain('flex-col');
    rerender(<TailscaleStatusBadge status="connected" tailnet="corp.ts.net" variant="pill" />);
    expect(screen.getByRole('status').textContent).toBe('Connected');
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

/* ── the connection panel parts ── */

/** A connected controller on the fake tailnet: an online exit node, an offline one, and a plain device. */
async function connected(opts: FakeTailscaleOptions = {}) {
  const fake = createFakeTailscaleClient({
    startMs: 1, tailnet: 'tail1234.ts.net', exitNodes: ['bretts-macbook-pro'], offlineExitNodes: ['bretts-macbook-air'], routes: { nas: () => new Response('ok') }, ...opts,
  });
  const tailscale = createTailscale({ client: () => fake.client, auth: { mode: 'auth-key', authKey: 'k' }, hostname: 'phone', env: { open: () => null, locks: null } });
  await act(async () => { await tailscale.signIn(); });
  await waitFor(() => expect(tailscale.getSnapshot().status).toBe('connected'));
  return { fake, tailscale };
}

const shell = (tailscale: Tailscale, ui: React.ReactNode) => render(<TailscaleProvider tailscale={tailscale}>{ui}</TailscaleProvider>);

describe('TailscaleSummary', () => {
  it('shows the tailnet, this device and the detail', async () => {
    const { tailscale } = await connected();
    shell(tailscale, <TailscaleSummary detail="3 pages and 9 requests this session." />);
    expect(screen.getByText('Connected to tail1234.ts.net')).toBeTruthy();
    expect(screen.getByText(/^As phone\./)).toBeTruthy();
    expect(screen.getByText('3 pages and 9 requests this session.')).toBeTruthy();
  });
});

describe('TailscaleExitNodes', () => {
  const rows = () => within(screen.getByRole('listbox', { name: 'Exit node' })).getAllByRole('option');

  it('is a listbox named by its heading, with None first, the check on the node in use, and the offline node disabled', async () => {
    const { tailscale } = await connected();
    await act(async () => { await tailscale.setExitNode('node-bretts-macbook-pro'); });
    shell(tailscale, <TailscaleExitNodes />);
    const options = rows();
    expect(options.map((o) => o.textContent)).toEqual(['NoneYour devices only', 'bretts-macbook-airOffline', 'bretts-macbook-pro']);
    expect(options.map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
    expect(options[1].getAttribute('aria-disabled')).toBe('true');
    expect(options[0].getAttribute('aria-disabled')).toBeNull();
  });

  it('chooses a node, and None, by pressing a row', async () => {
    const { tailscale, fake } = await connected();
    shell(tailscale, <TailscaleExitNodes />);
    fireEvent.click(rows()[2]);
    await waitFor(() => expect(fake.exitNodeId).toBe('node-bretts-macbook-pro'));
    await waitFor(() => expect(rows()[2].getAttribute('aria-selected')).toBe('true'));
    fireEvent.click(rows()[0]);
    await waitFor(() => expect(fake.exitNodeId).toBeNull());
  });

  it('switches through onAction, showing Connecting… until it settles, and tells onValueChange first', async () => {
    const { tailscale } = await connected();
    let done = () => {};
    const onAction = vi.fn((id: string | null) => new Promise<void>((resolve) => { done = () => { void tailscale.setExitNode(id).then(resolve); }; }));
    const onValueChange = vi.fn();
    shell(tailscale, <TailscaleExitNodes onAction={onAction} onValueChange={onValueChange} />);
    fireEvent.click(rows()[2]);
    expect(onValueChange).toHaveBeenCalledWith('node-bretts-macbook-pro', expect.objectContaining({ reason: expect.any(String) }));
    await waitFor(() => expect(rows()[2].textContent).toContain('Connecting…'));
    await waitFor(() => expect(onAction).toHaveBeenCalledWith('node-bretts-macbook-pro'));
    await act(async () => { done(); });
    await waitFor(() => expect(screen.queryByText('Connecting…')).toBeNull());
    expect(tailscale.getSnapshot().exitNodeId).toBe('node-bretts-macbook-pro');
    fireEvent.click(rows()[0]);
    await waitFor(() => expect(onAction).toHaveBeenLastCalledWith(null));
  });

  it('does not switch when onValueChange cancels, and shows a controlled value', async () => {
    const { tailscale, fake } = await connected();
    const onAction = vi.fn();
    shell(tailscale, <TailscaleExitNodes value="node-bretts-macbook-pro" onAction={onAction} onValueChange={(_, details) => details.cancel()} />);
    expect(rows()[2].getAttribute('aria-selected')).toBe('true');
    fireEvent.click(rows()[0]);
    expect(onAction).not.toHaveBeenCalled();
    expect(fake.exitNodeId).toBeNull();
  });

  it('moves with the arrow keys without switching, and switches on Enter', async () => {
    const { tailscale, fake } = await connected();
    const onAction = vi.fn((id: string | null) => tailscale.setExitNode(id));
    shell(tailscale, <TailscaleExitNodes onAction={onAction} />);
    const none = rows()[0];
    expect(none.getAttribute('tabindex')).toBe('0');
    none.focus();
    fireEvent.keyDown(none, { key: 'ArrowDown' });
    // The offline device is skipped; landing on a device does not make it the exit node.
    await waitFor(() => expect(document.activeElement).toBe(rows()[2]));
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.keyDown(rows()[2], { key: 'Enter' });
    await waitFor(() => expect(fake.exitNodeId).toBe('node-bretts-macbook-pro'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not choose an offline node', async () => {
    const { tailscale, fake } = await connected();
    const onAction = vi.fn();
    shell(tailscale, <TailscaleExitNodes onAction={onAction} />);
    fireEvent.click(rows()[1]);
    expect(onAction).not.toHaveBeenCalled();
    expect(fake.exitNodeId).toBeNull();
  });

  it('shows Connecting… and a spinner on the row being switched to, and takes a glyph of its own', async () => {
    const { tailscale } = await connected();
    let finish = () => {};
    const onAction = () => new Promise<void>((resolve) => { finish = resolve; });
    shell(tailscale, <TailscaleExitNodes onAction={onAction} glyph={(_p, s) => (s.connecting ? <i data-testid="busy" /> : <i data-testid="idle" />)} />);
    fireEvent.click(rows()[2]);
    await waitFor(() => expect(rows()[2].textContent).toContain('Connecting…'));
    expect(within(rows()[2]).getByTestId('busy')).toBeTruthy();
    expect(document.querySelector('[data-slot="tailscale-exit-nodes"]')?.getAttribute('aria-busy')).toBe('true');
    await act(async () => { finish(); });
    await waitFor(() => expect(document.querySelector('[data-slot="tailscale-exit-nodes"]')?.getAttribute('aria-busy')).toBeNull());
  });

  it('shows what a refused change said, in the error colour', async () => {
    const { tailscale } = await connected();
    shell(tailscale, <TailscaleExitNodes onAction={() => Promise.reject(new Error('Refused by the client.'))} />);
    fireEvent.click(rows()[2]);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Refused by the client.');
    expect(alert.className).toContain('text-destructive');
  });

  it('says so when the tailnet has no exit node', async () => {
    const { tailscale } = await connected({ exitNodes: [], offlineExitNodes: [] });
    shell(tailscale, <TailscaleExitNodes />);
    expect(screen.getByText(/No exit node on this tailnet/)).toBeTruthy();
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
