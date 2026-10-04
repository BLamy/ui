import { describe, expect, it } from 'vitest';
import type { TailscalePeer } from '@/lib/tailscale';
import { exitNodeName, exitNodeOnline, exitNodePeers, pickExitNode } from '@/lib/tailscale-exit';

const peer = (name: string, o: Partial<TailscalePeer> = {}): TailscalePeer => ({ name: `${name}.tail1234.ts.net`, addresses: [], online: true, id: `id-${name}`, exitNode: true, ...o });

describe('pickExitNode', () => {
  it('takes only exit nodes that have an id and are online', () => {
    expect(pickExitNode({ peers: [] })).toBeNull();
    expect(pickExitNode({ peers: [peer('nas', { exitNode: false }), peer('pro', { online: false }), peer('air', { id: null })] })).toBeNull();
    expect(pickExitNode({ peers: [peer('nas', { exitNode: false }), peer('pro')] })).toBe('id-pro');
  });

  it('takes the first by name when nothing is preferred', () => {
    expect(pickExitNode({ peers: [peer('pro'), peer('air'), peer('mini')] })).toBe('id-air');
  });

  it('prefers the node used before, while it is still a candidate', () => {
    const peers = [peer('air'), peer('pro'), peer('mini')];
    expect(pickExitNode({ peers }, { prefer: 'id-pro' })).toBe('id-pro');
    expect(pickExitNode({ peers: [peer('air'), peer('pro', { online: false })] }, { prefer: 'id-pro' })).toBe('id-air');
    expect(pickExitNode({ peers }, { prefer: 'id-gone' })).toBe('id-air');
  });

  it('leaves out what is excluded, even when it is the preferred node', () => {
    const peers = [peer('air'), peer('pro')];
    expect(pickExitNode({ peers }, { exclude: 'id-air' })).toBe('id-pro');
    expect(pickExitNode({ peers }, { exclude: ['id-air', 'id-pro'] })).toBeNull();
    expect(pickExitNode({ peers }, { exclude: 'id-pro', prefer: 'id-pro' })).toBe('id-air');
    expect(pickExitNode({ peers: [peer('air')] }, { exclude: 'id-air' })).toBeNull();
    expect(pickExitNode({ peers }, { exclude: null })).toBe('id-air');
  });

  it('does not reorder the snapshot', () => {
    const peers = [peer('pro'), peer('air')];
    pickExitNode({ peers });
    expect(peers.map(exitNodeName)).toEqual(['pro', 'air']);
  });
});

describe('exit node helpers', () => {
  it('names a peer by its first label', () => {
    expect(exitNodeName({ name: 'bretts-macbook-pro.tail1234.ts.net' })).toBe('bretts-macbook-pro');
    expect(exitNodeName({ name: 'plain' })).toBe('plain');
  });

  it('lists the exit nodes with an id, by name, offline ones too', () => {
    expect(exitNodePeers({ peers: [peer('pro'), peer('nas', { exitNode: false }), peer('air', { online: false }), peer('x', { id: null })] }).map(exitNodeName)).toEqual(['air', 'pro']);
  });

  it('tells whether the exit node in use is up', () => {
    const peers = [peer('air', { online: false }), peer('pro')];
    expect(exitNodeOnline({ peers, exitNodeId: null })).toBe(false);
    expect(exitNodeOnline({ peers, exitNodeId: 'id-air' })).toBe(false);
    expect(exitNodeOnline({ peers, exitNodeId: 'id-pro' })).toBe(true);
    expect(exitNodeOnline({ peers, exitNodeId: 'id-gone' })).toBe(false);
  });
});
