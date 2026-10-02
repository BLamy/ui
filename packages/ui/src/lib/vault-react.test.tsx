// @vitest-environment happy-dom
/* eslint-disable @typescript-eslint/no-non-null-assertion -- test code: fixtures are known to exist */
import { StrictMode, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasskeyError } from '@/lib/passkey';
import { createVault, VaultError, type Vault, type VaultOptions } from '@/lib/vault';
import { memoryStorage } from '@/lib/vault-storage';
import { VaultProvider, useEncryptedState, usePasskey, useVault, useVaultState, useWebAuthnSupport } from '@/lib/vault-react';
import { createFakeAuthenticator } from '../../test/fake-authenticator';

afterEach(cleanup);

function setup(extra?: Partial<VaultOptions>) {
  const auth = createFakeAuthenticator();
  const storage = memoryStorage();
  const make = (more?: Partial<VaultOptions>) => createVault({ id: 'react', rp: { name: 'Test' }, storage, env: auth.env, channel: false, ...extra, ...more });
  return { auth, storage, make };
}
const wrapperFor = (vault: Vault) => ({ children }: { children: ReactNode }) => <VaultProvider vault={vault}>{children}</VaultProvider>;

describe('useWebAuthnSupport', () => {
  it('is null first (and on the server), then what the browser reports', async () => {
    const auth = createFakeAuthenticator({ capability: false });
    const { result } = renderHook(() => useWebAuthnSupport(auth.env));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toMatchObject({ webauthn: true, prf: 'no', secureContext: true });
  });
  it('renders on the server without touching the browser', () => {
    function Probe() { return <p>{String(useWebAuthnSupport())}</p>; }
    expect(renderToString(<Probe />)).toContain('null');
  });
});

describe('usePasskey', () => {
  const salt = new TextEncoder().encode('s');
  it('walks idle → pending → success and hands back secrets without keeping them', async () => {
    const auth = createFakeAuthenticator();
    const { result } = renderHook(() => usePasskey(auth.env));
    expect(result.current.status).toBe('idle');
    let created: Awaited<ReturnType<typeof result.current.create>> = null;
    await act(async () => { created = await result.current.create({ rpName: 'x', userName: 'u', salt }); });
    expect(created!.secret).toHaveLength(32);
    expect(result.current.status).toBe('success');
    let got: Awaited<ReturnType<typeof result.current.getSecret>> = null;
    await act(async () => { got = await result.current.getSecret([created!.credentialId], salt); });
    expect(got!.secret).toEqual(created!.secret);
    expect(JSON.stringify(Object.values(result.current))).not.toContain(String(created!.secret));
  });
  it('resolves null and exposes a typed error when the user cancels', async () => {
    const auth = createFakeAuthenticator();
    const { result } = renderHook(() => usePasskey(auth.env));
    auth.failNext();
    let out: unknown = 'unset';
    await act(async () => { out = await result.current.create({ rpName: 'x', userName: 'u', salt }); });
    expect(out).toBeNull();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeInstanceOf(PasskeyError);
    expect(result.current.error!.reason).toBe('cancelled');
    act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });
  it('cancel() aborts the open prompt', async () => {
    const auth = createFakeAuthenticator();
    const { result } = renderHook(() => usePasskey(auth.env));
    let release!: () => void;
    auth.delayNext(new Promise<void>((r) => { release = r; }));
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.create({ rpName: 'x', userName: 'u', salt }); });
    await waitFor(() => expect(result.current.status).toBe('pending'));
    act(() => result.current.cancel());
    release();
    await act(async () => { await pending; });
    expect(result.current.error!.reason).toBe('cancelled');
  });
  it('aborts the request on unmount', async () => {
    const auth = createFakeAuthenticator();
    const { result, unmount } = renderHook(() => usePasskey(auth.env));
    let release!: () => void;
    auth.delayNext(new Promise<void>((r) => { release = r; }));
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.create({ rpName: 'x', userName: 'u', salt }); });
    unmount();
    release();
    await expect(pending).resolves.toBeNull();
  });
});

describe('VaultProvider and useVault', () => {
  it('creates the vault from options, initialises it, and re-renders on status changes', async () => {
    const { auth, storage } = setup();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <VaultProvider options={{ id: 'p', rp: { name: 'x' }, storage, env: auth.env, channel: false }}>{children}</VaultProvider>
    );
    const { result } = renderHook(() => useVault(), { wrapper });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('empty'));
    await act(async () => { await result.current.enroll(); });
    expect(result.current.status).toBe('unlocked');
    act(() => result.current.lock());
    expect(result.current.status).toBe('locked');
  });
  it('useVaultState returns the immutable snapshot', async () => {
    const { make } = setup();
    const vault = make();
    const { result } = renderHook(() => useVaultState(), { wrapper: wrapperFor(vault) });
    await waitFor(() => expect(result.current.status).toBe('empty'));
    const before = result.current;
    await act(async () => { await vault.enroll(); });
    expect(result.current).not.toBe(before);
    expect(before.status).toBe('empty');
  });
  it('throws a helpful error outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useVault())).toThrow(/VaultProvider/);
    spy.mockRestore();
  });
  it('works under StrictMode (mount, unmount, mount) and ends initialised', async () => {
    const { make } = setup();
    const vault = make();
    const { result } = renderHook(() => useVault(), { wrapper: ({ children }) => <StrictMode><VaultProvider vault={vault}>{children}</VaultProvider></StrictMode> });
    await waitFor(() => expect(result.current.status).toBe('empty'));
  });
  it('locks the vault on unmount (dispose)', async () => {
    const { make } = setup();
    const vault = make();
    await vault.init();
    await vault.enroll();
    const { unmount } = renderHook(() => useVault(), { wrapper: wrapperFor(vault) });
    expect(vault.status).toBe('unlocked');
    unmount();
    expect(vault.status).toBe('locked');
  });
  it('restarts the auto-lock timer on page activity', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    try {
      const { make } = setup();
      const vault = make({ autoLockMs: 1000 });
      await vault.init();
      await vault.enroll();
      renderHook(() => useVault(), { wrapper: wrapperFor(vault) });
      await vi.advanceTimersByTimeAsync(800);
      act(() => { document.dispatchEvent(new Event('pointerdown')); });
      await vi.advanceTimersByTimeAsync(800);
      expect(vault.status).toBe('unlocked');
      await vi.advanceTimersByTimeAsync(300);
      expect(vault.status).toBe('locked');
    } finally {
      vi.useRealTimers();
    }
  });
  it('renders loading on the server', () => {
    const { make } = setup();
    function Probe() { return <p>{useVault().status}</p>; }
    expect(renderToString(<VaultProvider vault={make()}><Probe /></VaultProvider>)).toContain('loading');
  });
});

describe('useEncryptedState', () => {
  async function ready() {
    const s = setup();
    const vault = s.make();
    await vault.init();
    await vault.enroll();
    return { ...s, vault, wrapper: wrapperFor(vault) };
  }

  it('starts at the initial value, loads what is stored, and persists changes encrypted', async () => {
    const { vault, storage, wrapper } = await ready();
    await vault.put('draft', 'saved earlier');
    const { result } = renderHook(() => useEncryptedState('draft', ''), { wrapper });
    await waitFor(() => expect(result.current[0]).toBe('saved earlier'));
    expect(result.current[2].status).toBe('ready');
    let ok = false;
    await act(async () => { ok = await result.current[1]('new text'); });
    expect(ok).toBe(true);
    expect(result.current[0]).toBe('new text');
    expect(await vault.get('draft')).toBe('new text');
    expect(JSON.stringify([...(await storage.keys('')).map(String)])).not.toContain('draft');
  });
  it('uses the initial value (lazy initialisers too) when nothing is stored', async () => {
    const { wrapper } = await ready();
    const init = vi.fn(() => ({ n: 1 }));
    const { result } = renderHook(() => useEncryptedState('fresh', init), { wrapper });
    await waitFor(() => expect(result.current[2].status).toBe('ready'));
    expect(result.current[0]).toEqual({ n: 1 });
  });
  it('supports functional updates against the latest value', async () => {
    const { wrapper } = await ready();
    const { result } = renderHook(() => useEncryptedState('count', 0), { wrapper });
    await waitFor(() => expect(result.current[2].status).toBe('ready'));
    await act(async () => { await Promise.all([result.current[1]((n) => n + 1), result.current[1]((n) => n + 1), result.current[1]((n) => n + 1)]); });
    expect(result.current[0]).toBe(3);
  });
  it('clears the value from state when the vault locks, and loads it again on unlock', async () => {
    const { vault, wrapper } = await ready();
    await vault.put('secret', 'hunter2');
    const { result } = renderHook(() => useEncryptedState('secret', 'none'), { wrapper });
    await waitFor(() => expect(result.current[0]).toBe('hunter2'));
    act(() => vault.lock());
    expect(result.current[0]).toBe('none');
    expect(result.current[2].status).toBe('locked');
    await act(async () => { await vault.unlock(); });
    await waitFor(() => expect(result.current[0]).toBe('hunter2'));
  });
  it('is locked from the first render when the vault is locked, and reads nothing', async () => {
    const { vault, wrapper } = await ready();
    await vault.put('k', 'v');
    vault.lock();
    const spy = vi.spyOn(vault, 'get');
    const { result } = renderHook(() => useEncryptedState('k', 'initial'), { wrapper });
    expect(result.current[0]).toBe('initial');
    expect(result.current[2].status).toBe('locked');
    expect(spy).not.toHaveBeenCalled();
  });
  it('refuses to set while locked: nothing is kept in state', async () => {
    const { vault, wrapper } = await ready();
    vault.lock();
    const { result } = renderHook(() => useEncryptedState('k', 'initial'), { wrapper });
    let ok = true;
    await act(async () => { ok = await result.current[1]('typed secret'); });
    expect(ok).toBe(false);
    expect(result.current[0]).toBe('initial');
    expect(result.current[2].error).toBeInstanceOf(VaultError);
  });
  it('reverts to the stored value when a write fails', async () => {
    const { vault, wrapper } = await ready();
    await vault.put('k', 'stored');
    const { result } = renderHook(() => useEncryptedState('k', ''), { wrapper });
    await waitFor(() => expect(result.current[0]).toBe('stored'));
    vi.spyOn(vault, 'put').mockRejectedValueOnce(new Error('disk full'));
    let ok = true;
    await act(async () => { ok = await result.current[1]('lost'); });
    expect(ok).toBe(false);
    expect(result.current[0]).toBe('stored');
    expect(result.current[2]).toMatchObject({ status: 'error' });
    await act(async () => { ok = await result.current[1]('kept'); });
    expect(ok).toBe(true);
    expect(result.current[2].status).toBe('ready');
  });
  it('follows changes made elsewhere (another hook, another tab) but not its own writes', async () => {
    const { vault, wrapper } = await ready();
    const { result } = renderHook(() => useEncryptedState('shared', 'a'), { wrapper });
    await waitFor(() => expect(result.current[2].status).toBe('ready'));
    await act(async () => { await vault.put('shared', 'b'); });
    await waitFor(() => expect(result.current[0]).toBe('b'));
    const spy = vi.spyOn(vault, 'get');
    await act(async () => { await result.current[1]('c'); });
    expect(spy).not.toHaveBeenCalled();
    expect(result.current[0]).toBe('c');
  });
  it('two hooks on one name stay in step', async () => {
    const { wrapper } = await ready();
    const { result } = renderHook(() => ({ a: useEncryptedState('pair', 0), b: useEncryptedState('pair', 0) }), { wrapper });
    await waitFor(() => expect(result.current.b[2].status).toBe('ready'));
    await act(async () => { await result.current.a[1](5); });
    await waitFor(() => expect(result.current.b[0]).toBe(5));
  });
  it('shows an authentication failure as an error state, with the initial value', async () => {
    const { vault, storage, wrapper } = await ready();
    await vault.put('k', 'v');
    const [key] = await storage.keys('react/r/');
    await storage.set(key, JSON.stringify({ v: 1, iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }));
    const { result } = renderHook(() => useEncryptedState('k', 'initial'), { wrapper });
    await waitFor(() => expect(result.current[2].status).toBe('error'));
    expect(result.current[0]).toBe('initial');
    expect((result.current[2].error as VaultError).reason).toBe('corrupt');
  });
  it('renders in a component tree and updates the DOM', async () => {
    const { vault, wrapper: Wrapper } = await ready();
    function Notes() {
      const [text, setText, meta] = useEncryptedState('notes', 'empty');
      return <button onClick={() => void setText('typed')}>{meta.status}:{text}</button>;
    }
    render(<Wrapper><Notes /></Wrapper>);
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('ready:empty'));
    await act(async () => { screen.getByRole('button').click(); });
    expect(screen.getByRole('button').textContent).toBe('ready:typed');
    await waitFor(async () => expect(await vault.get('notes')).toBe('typed'));
  });
});
