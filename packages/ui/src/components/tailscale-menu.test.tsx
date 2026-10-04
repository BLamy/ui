// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TailscaleExitNodes, TailscaleMenu, tailscaleExitNodesVariants, tailscaleMenuVariants } from '@/components/ui/tailscale-menu';
import { createTailscale, type Tailscale } from '@/lib/tailscale';
import { createFakeTailscaleClient, type FakeTailscaleOptions } from '@/lib/tailscale-fake';
import { TailscaleProvider } from '@/lib/tailscale-react';

afterEach(cleanup);

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

describe('TailscaleMenu', () => {
  it('shows the tailnet, this device and the detail, and signs out', async () => {
    const { tailscale } = await connected();
    shell(tailscale, <TailscaleMenu detail="3 pages and 9 requests this session." />);
    expect(screen.getByText('Connected to tail1234.ts.net')).toBeTruthy();
    expect(screen.getByText(/^As phone\./)).toBeTruthy();
    expect(screen.getByText('3 pages and 9 requests this session.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out of Tailscale' })).toBeTruthy();
    expect(document.querySelector('[data-slot="tailscale-menu"]')?.getAttribute('data-variant')).toBe('radio');
  });

  it('can leave out the exit nodes and the sign out', async () => {
    const { tailscale } = await connected();
    shell(tailscale, <TailscaleMenu exitNodes={false} signOut={false} />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.queryByRole('button', { name: /Sign out/ })).toBeNull();
  });

  it('exports its recipes', () => {
    expect(tailscaleMenuVariants({ variant: 'networks' })).toContain('gap-2');
    expect(tailscaleExitNodesVariants()).toContain('gap-1.5');
  });
});

describe('TailscaleExitNodes, radio', () => {
  it('lists None and every exit node, marks the offline one, and checks the node in use', async () => {
    const { tailscale } = await connected();
    await act(async () => { await tailscale.setExitNode('node-bretts-macbook-pro'); });
    shell(tailscale, <TailscaleExitNodes />);
    expect(screen.getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(['None: your devices only', 'bretts-macbook-air (offline)', 'bretts-macbook-pro']);
    expect((screen.getByRole('radio', { name: 'bretts-macbook-pro' }) as HTMLInputElement).checked).toBe(true);
  });

  it('chooses a node through onExitNode, showing Connecting… until it settles, and None clears it', async () => {
    const { tailscale } = await connected();
    let done = () => {};
    const onExitNode = vi.fn((id: string | null) => new Promise<void>((resolve) => { done = () => { void tailscale.setExitNode(id).then(resolve); }; }));
    shell(tailscale, <TailscaleExitNodes onExitNode={onExitNode} />);
    fireEvent.click(screen.getByRole('radio', { name: 'bretts-macbook-pro' }));
    await waitFor(() => expect(screen.getByText('Connecting…')).toBeTruthy());
    await waitFor(() => expect(onExitNode).toHaveBeenCalledWith('node-bretts-macbook-pro'));
    await act(async () => { done(); });
    await waitFor(() => expect(screen.queryByText('Connecting…')).toBeNull());
    expect(tailscale.getSnapshot().exitNodeId).toBe('node-bretts-macbook-pro');
    fireEvent.click(screen.getByRole('radio', { name: /None/ }));
    await waitFor(() => expect(onExitNode).toHaveBeenLastCalledWith(null));
  });

  it('shows what a refused change said', async () => {
    const { tailscale } = await connected();
    shell(tailscale, <TailscaleExitNodes onExitNode={() => Promise.reject(new Error('Refused by the client.'))} />);
    fireEvent.click(screen.getByRole('radio', { name: 'bretts-macbook-pro' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Refused by the client.');
  });

  it('says so when the tailnet has no exit node', async () => {
    const { tailscale } = await connected({ exitNodes: [], offlineExitNodes: [] });
    shell(tailscale, <TailscaleExitNodes />);
    expect(screen.getByText(/No exit node on this tailnet/)).toBeTruthy();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});

describe('TailscaleExitNodes, networks', () => {
  const rows = () => within(screen.getByRole('listbox', { name: 'Exit node' })).getAllByRole('option');

  it('is a listbox with None first, the check on the node in use, and the offline node disabled', async () => {
    const { tailscale } = await connected();
    await act(async () => { await tailscale.setExitNode('node-bretts-macbook-pro'); });
    shell(tailscale, <TailscaleExitNodes variant="networks" />);
    const options = rows();
    expect(options.map((o) => o.textContent)).toEqual(['NoneYour devices only', 'bretts-macbook-airOffline', 'bretts-macbook-pro']);
    expect(options.map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
    expect(options[1].getAttribute('aria-disabled')).toBe('true');
    expect(options[0].getAttribute('aria-disabled')).toBeNull();
    expect(document.querySelector('[data-slot="tailscale-exit-nodes"]')?.getAttribute('data-variant')).toBe('networks');
  });

  it('chooses a node, and None, by pressing a row', async () => {
    const { tailscale, fake } = await connected();
    shell(tailscale, <TailscaleExitNodes variant="networks" />);
    fireEvent.click(rows()[2]);
    await waitFor(() => expect(fake.exitNodeId).toBe('node-bretts-macbook-pro'));
    await waitFor(() => expect(rows()[2].getAttribute('aria-selected')).toBe('true'));
    fireEvent.click(rows()[0]);
    await waitFor(() => expect(fake.exitNodeId).toBeNull());
  });

  it('does not choose an offline node', async () => {
    const { tailscale, fake } = await connected();
    const onExitNode = vi.fn();
    shell(tailscale, <TailscaleExitNodes variant="networks" onExitNode={onExitNode} />);
    fireEvent.click(rows()[1]);
    expect(onExitNode).not.toHaveBeenCalled();
    expect(fake.exitNodeId).toBeNull();
  });

  it('shows Connecting… and a spinner on the row being switched to, and takes a glyph of its own', async () => {
    const { tailscale } = await connected();
    let finish = () => {};
    const onExitNode = () => new Promise<void>((resolve) => { finish = resolve; });
    shell(tailscale, <TailscaleExitNodes variant="networks" onExitNode={onExitNode} glyph={(_p, s) => (s.connecting ? <i data-testid="busy" /> : <i data-testid="idle" />)} />);
    fireEvent.click(rows()[2]);
    await waitFor(() => expect(rows()[2].textContent).toContain('Connecting…'));
    expect(within(rows()[2]).getByTestId('busy')).toBeTruthy();
    expect(document.querySelector('[data-slot="tailscale-exit-nodes"]')?.getAttribute('aria-busy')).toBe('true');
    await act(async () => { finish(); });
    await waitFor(() => expect(document.querySelector('[data-slot="tailscale-exit-nodes"]')?.getAttribute('aria-busy')).toBeNull());
  });
});
