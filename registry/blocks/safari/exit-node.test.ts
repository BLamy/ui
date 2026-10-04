import { describe, expect, it, vi } from 'vitest';
import { createTailscale, type TailscalePeer, type TailscaleSnapshot } from '@/lib/tailscale';
import { LoadError } from './loader';
import { EXIT_NODE_ID, PUBLIC_SITE, createDemoTailnet } from './data';
import { createExitNodes, exitNodeProblem, exitNodesFor, publicHostOf } from './exit-node';

const peer = (name: string, o: Partial<TailscalePeer> = {}): TailscalePeer => ({ name: `${name}.tail1234.ts.net`, addresses: [], online: true, id: `id-${name}`, exitNode: true, ...o });

/** A controller stand-in: a snapshot that `setExitNode` updates, as the real one does. */
function control(peers: TailscalePeer[], exitNodeId: string | null = null, status: TailscaleSnapshot['status'] = 'connected') {
  const snapshot = { status, peers, exitNodeId } as TailscaleSnapshot;
  const setExitNode = vi.fn(async (id: string | null) => { snapshot.exitNodeId = id; });
  return { snapshot, setExitNode, tailscale: { getSnapshot: () => snapshot, setExitNode } };
}

const SITE = 'https://youtube.com/watch?v=1';
const TAILNET = 'http://nas.tail1234.ts.net/';

describe('which addresses need an exit node', () => {
  it('is a public name, not a tailnet host, an address or localhost', () => {
    expect(publicHostOf(SITE)).toBe('youtube.com');
    expect(publicHostOf('http://www.example.com/')).toBe('example.com');
    for (const url of [TAILNET, 'http://nas/', 'http://100.64.0.1/', 'http://localhost:3000/', 'not a url']) expect(publicHostOf(url)).toBeNull();
  });
});

describe('auto-pick', () => {
  it('selects the first online exit node by name before a public page, and not for a tailnet page', async () => {
    const c = control([peer('pro'), peer('air', { online: false }), peer('mini')]);
    const exit = createExitNodes(c.tailscale);
    await exit.prepare(TAILNET);
    expect(c.setExitNode).not.toHaveBeenCalled();
    await exit.prepare(SITE);
    expect(c.setExitNode).toHaveBeenCalledExactlyOnceWith('id-mini');
  });

  it('does nothing when an exit node is set, when none is online, or when Tailscale is not connected', async () => {
    const set = control([peer('pro')], 'id-pro');
    await createExitNodes(set.tailscale).prepare(SITE);
    expect(set.setExitNode).not.toHaveBeenCalled();
    const asleep = control([peer('pro', { online: false })]);
    await createExitNodes(asleep.tailscale).prepare(SITE);
    expect(asleep.setExitNode).not.toHaveBeenCalled();
    const down = control([peer('pro')], null, 'needs-login');
    await createExitNodes(down.tailscale).prepare(SITE);
    expect(down.setExitNode).not.toHaveBeenCalled();
  });

  it('shares one selection between pages that load at once', async () => {
    const c = control([peer('pro')]);
    const exit = createExitNodes(c.tailscale);
    await Promise.all([exit.prepare(SITE), exit.prepare('https://example.org/')]);
    expect(c.setExitNode).toHaveBeenCalledTimes(1);
  });

  it('never rejects: a refused selection leaves the load to fail with its own error', async () => {
    const c = control([peer('pro')]);
    c.setExitNode.mockRejectedValueOnce(new Error('refused'));
    await expect(createExitNodes(c.tailscale).prepare(SITE)).resolves.toBeUndefined();
  });

  it('uses the node it used last when the person comes back to it', async () => {
    const c = control([peer('air'), peer('pro')]);
    const exit = createExitNodes(c.tailscale);
    await exit.choose('id-pro');
    c.snapshot.exitNodeId = null; // dropped elsewhere, not through the menu
    await exit.prepare(SITE);
    expect(c.setExitNode).toHaveBeenLastCalledWith('id-pro');
  });
});

describe('the menu', () => {
  it('remembers None and does not pick again until a node is chosen', async () => {
    const c = control([peer('pro')], 'id-pro');
    const exit = createExitNodes(c.tailscale);
    await exit.choose(null);
    expect(exit.optedOut).toBe(true);
    expect(c.snapshot.exitNodeId).toBeNull();
    c.setExitNode.mockClear();
    await exit.prepare(SITE);
    expect(c.setExitNode).not.toHaveBeenCalled();
    await exit.choose('id-pro');
    expect(exit.optedOut).toBe(false);
    expect(c.snapshot.exitNodeId).toBe('id-pro');
  });

  it('forgets the opt-out on reset (signed out)', async () => {
    const c = control([peer('pro')]);
    const exit = createExitNodes(c.tailscale);
    await exit.choose(null);
    exit.reset();
    expect(exit.optedOut).toBe(false);
    await exit.prepare(SITE);
    expect(c.snapshot.exitNodeId).toBe('id-pro');
  });
});

describe('what is wrong with the exit node', () => {
  const online = [peer('air'), peer('pro')];
  it('is none, offline or failing for a public site, and nothing for anything else', () => {
    expect(exitNodeProblem({ peers: online, exitNodeId: null }, SITE, new LoadError('unreachable', 'x'))).toBe('none');
    expect(exitNodeProblem({ peers: [peer('air', { online: false })], exitNodeId: 'id-air' }, SITE, new LoadError('unreachable', 'x'))).toBe('offline');
    expect(exitNodeProblem({ peers: online, exitNodeId: 'id-air' }, SITE, new LoadError('unreachable', 'x'))).toBe('failing');
    expect(exitNodeProblem({ peers: online, exitNodeId: 'id-air' }, SITE, new LoadError('status', 'x', 502))).toBe('failing');
    expect(exitNodeProblem({ peers: online, exitNodeId: 'id-air' }, SITE, new LoadError('status', 'x', 404))).toBeNull();
    expect(exitNodeProblem({ peers: online, exitNodeId: null }, TAILNET, new LoadError('unreachable', 'x'))).toBeNull();
    expect(exitNodeProblem({ peers: online, exitNodeId: null }, SITE, new LoadError('offline', 'x'))).toBeNull();
  });
});

describe('Try Again', () => {
  it('picks an exit node when a public site failed for having none, clearing the opt-out', async () => {
    const c = control([peer('pro')], 'id-pro');
    const exit = createExitNodes(c.tailscale);
    await exit.choose(null);
    c.setExitNode.mockClear();
    expect(await exit.retry(SITE, new LoadError('unreachable', 'x'))).toBe(true);
    expect(exit.optedOut).toBe(false);
    expect(c.setExitNode).toHaveBeenCalledExactlyOnceWith('id-pro');
  });

  it('swaps an offline exit node for an online one', async () => {
    const c = control([peer('air', { online: false }), peer('pro')], 'id-air');
    expect(await createExitNodes(c.tailscale).retry(SITE, new LoadError('unreachable', 'x'))).toBe(true);
    expect(c.snapshot.exitNodeId).toBe('id-pro');
  });

  it('avoids the node that just failed when another is online, and gives it another chance when it is the only one', async () => {
    const two = control([peer('air'), peer('pro')], 'id-air');
    await createExitNodes(two.tailscale).retry(SITE, new LoadError('unreachable', 'x'));
    expect(two.snapshot.exitNodeId).toBe('id-pro');
    const one = control([peer('air')], 'id-air');
    expect(await createExitNodes(one.tailscale).retry(SITE, new LoadError('unreachable', 'x'))).toBe(true);
    expect(one.setExitNode).toHaveBeenCalledExactlyOnceWith('id-air');
  });

  it('does nothing without a problem or without an online node (the caller just reloads)', async () => {
    const fine = control([peer('air')], 'id-air');
    expect(await createExitNodes(fine.tailscale).retry(SITE, new LoadError('status', 'x', 404))).toBe(false);
    expect(await createExitNodes(fine.tailscale).retry(TAILNET, new LoadError('unreachable', 'x'))).toBe(false);
    expect(fine.setExitNode).not.toHaveBeenCalled();
    const asleep = control([peer('air', { online: false })]);
    expect(await createExitNodes(asleep.tailscale).retry(SITE, new LoadError('unreachable', 'x'))).toBe(false);
    expect(asleep.setExitNode).not.toHaveBeenCalled();
  });

  it('never rejects', async () => {
    const c = control([peer('pro')]);
    c.setExitNode.mockRejectedValueOnce(new Error('refused'));
    await expect(createExitNodes(c.tailscale).retry(SITE, new LoadError('unreachable', 'x'))).resolves.toBe(false);
  });
});

describe('shared by everything that chooses for a controller', () => {
  it('is one per controller: a None chosen through one is honoured by the other, and forgotten when the controller disconnects', async () => {
    const listeners = new Set<() => void>();
    const c = control([peer('pro')], 'id-pro');
    const t = { ...c.tailscale, subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); } } as unknown as Parameters<typeof exitNodesFor>[0];
    expect(exitNodesFor(t)).toBe(exitNodesFor(t));
    await exitNodesFor(t).choose(null);
    await exitNodesFor(t).prepare(SITE);
    expect(c.setExitNode).toHaveBeenCalledExactlyOnceWith(null);
    expect(exitNodesFor(t).optedOut).toBe(true);
    c.snapshot.status = 'idle';
    listeners.forEach((l) => l());
    expect(exitNodesFor(t).optedOut).toBe(false);
  });
});

describe('on the simulated tailnet', () => {
  it('selects the real controller’s exit node', async () => {
    const demo = createDemoTailnet();
    const t = createTailscale({ ...demo.options, auth: { mode: 'auth-key', authKey: 'k' } });
    const off = t.activate();
    await t.signIn();
    const end = Date.now() + 3000;
    while (t.getSnapshot().status !== 'connected' && Date.now() < end) await new Promise((r) => setTimeout(r, 10));
    const exit = createExitNodes(t);
    await exit.prepare(`http://${PUBLIC_SITE}/`);
    expect(t.getSnapshot().exitNodeId).toBe(EXIT_NODE_ID);
    expect(demo.fake.exitNodeId).toBe(EXIT_NODE_ID);
    off();
    await t.dispose();
  });
});
