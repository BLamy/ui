import { expect, it } from 'vitest';
import { createVault } from '@/lib/vault';
import { memoryStorage } from '@/lib/vault-storage';
import {
  createVaultOpenCodeCredentialStore,
  createVaultOpenCodeConnectionStore,
} from './open-code-keychain';
import { createFakeAuthenticator } from '../../test/fake-authenticator';

it('encrypts synthetic credentials, restores after reload, blocks locked access and persists logout', async () => {
  const auth = createFakeAuthenticator();
  const storage = memoryStorage();
  const options = {
    id: 'apple-passwords-sign-ins',
    rp: { name: 'Passwords' },
    storage,
    env: auth.env,
    channel: false as const,
  };
  const vault = createVault(options);
  await vault.enroll();
  const store = createVaultOpenCodeCredentialStore(vault);
  const synthetic = [
    {
      id: 'synthetic-provider',
      value: { access: 'synthetic-access', refresh: 'synthetic-refresh' },
    },
  ];
  await store.save(synthetic);
  expect(await store.load()).toEqual(synthetic);
  const bytes = (
    await Promise.all((await storage.keys('')).map((key) => storage.get(key)))
  ).join('');
  expect(bytes).not.toContain('synthetic-access');
  expect(bytes).not.toContain('synthetic-refresh');
  let notifications = 0;
  const off = store.subscribe(() => notifications++);
  vault.lock();
  expect(store.unlocked()).toBe(false);
  expect(notifications).toBeGreaterThan(0);
  await expect(store.load()).rejects.toThrow();
  await expect(store.save(synthetic)).rejects.toThrow();
  off();
  vault.dispose();

  const restoredVault = createVault(options);
  await restoredVault.init();
  expect(restoredVault.status).toBe('locked');
  await restoredVault.unlock();
  const restored = createVaultOpenCodeCredentialStore(restoredVault);
  expect(await restored.load()).toEqual(synthetic);
  await restored.save([]);
  restoredVault.dispose();
  const reloaded = createVault(options);
  await reloaded.init();
  await reloaded.unlock();
  expect(await createVaultOpenCodeCredentialStore(reloaded).load()).toEqual([]);
  reloaded.dispose();
});

it('restores both encrypted slots after refresh and keeps Tailscale sign-out separate from provider sign-ins', async () => {
  const auth = createFakeAuthenticator();
  const storage = memoryStorage();
  const options = {
    id: 'apple-passwords-sign-ins',
    rp: { name: 'Passwords' },
    storage,
    env: auth.env,
    channel: false as const,
  };
  const vault = createVault(options);
  await vault.enroll();
  const credentials = [
    { id: 'synthetic-provider', value: { access: 'synthetic-access' } },
  ];
  const connection = {
    v: 1,
    type: 'tailscale',
    session: {
      v: 1,
      hostname: 'opencode-browser',
      state: { _machinekey: 'synthetic-private-node-key' },
      exitNodeId: 'exit-node',
    },
  };
  await createVaultOpenCodeCredentialStore(vault).save(credentials);
  await createVaultOpenCodeConnectionStore(vault).save(connection);
  const bytes = (
    await Promise.all((await storage.keys('')).map((key) => storage.get(key)))
  ).join('');
  expect(bytes).not.toContain('synthetic-private-node-key');
  expect(bytes).not.toContain('synthetic-access');
  vault.dispose();

  const refreshed = createVault(options);
  await refreshed.init();
  const restored = createVaultOpenCodeConnectionStore(refreshed);
  expect(restored.unlocked()).toBe(false);
  await expect(restored.load()).rejects.toThrow();
  await expect(restored.save(connection)).rejects.toThrow();
  await refreshed.unlock();
  expect(await restored.load()).toEqual(connection);
  expect(await createVaultOpenCodeCredentialStore(refreshed).load()).toEqual(
    credentials,
  );
  await restored.save({ v: 1, type: 'offline', session: null });
  refreshed.dispose();

  const signedOut = createVault(options);
  await signedOut.init();
  await signedOut.unlock();
  expect(await createVaultOpenCodeConnectionStore(signedOut).load()).toEqual({
    v: 1,
    type: 'offline',
    session: null,
  });
  expect(await createVaultOpenCodeCredentialStore(signedOut).load()).toEqual(
    credentials,
  );
  signedOut.dispose();
});
