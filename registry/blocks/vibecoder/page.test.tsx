// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { createVault } from '@/lib/vault';
import { memoryStorage } from '@/lib/vault-storage';
import {
  createVaultOpenCodeCredentialStore,
  createVaultOpenCodeConnectionStore,
} from '@/lib/open-code-keychain';
import type { OpenCodeHostBridge, OpenCodeRuntime } from '@/lib/open-code-host';
import { createFakeAuthenticator } from '../../../packages/ui/test/fake-authenticator';
import {
  PasswordsKeychain,
  createDemoDeviceAuth,
} from '../apple-passwords/page';
import Vibecoder from './page';

const element = document.createElement('div');
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
document.body.append(element);
const root = createRoot(element);
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.unstubAllGlobals();
});
const button = (name: string) =>
  Array.from(element.querySelectorAll('button')).find(
    (node) => node.textContent === name,
  );

it('loads both saved connections after refreshing and unlocking the shared Passwords keychain', async () => {
  const auth = createFakeAuthenticator();
  const storage = memoryStorage();
  const options = {
    id: 'vibecoder-test',
    rp: { name: 'Passwords' },
    storage,
    env: auth.env,
    channel: false as const,
  };
  const first = createVault(options);
  await first.enroll();
  const credentials = [
    { id: 'synthetic-provider', value: { access: 'synthetic-access' } },
  ];
  const connection = {
    v: 1,
    type: 'tailscale',
    session: {
      v: 1,
      hostname: 'opencode-browser',
      state: { key: 'synthetic-key' },
      exitNodeId: 'saved-exit',
    },
  };
  await createVaultOpenCodeCredentialStore(first).save(credentials);
  await createVaultOpenCodeConnectionStore(first).save(connection);
  first.dispose();

  const vault = createVault(options);
  await vault.init();
  const loaded: unknown[] = [];
  const dispose = vi.fn();
  const mount = vi.fn<OpenCodeRuntime['mount']>(
    async ({ credentialStore, connectionStore }) => {
      if (credentialStore?.unlocked() && connectionStore?.unlocked()) {
        loaded.push({
          credentials: await credentialStore.load(),
          connection: await connectionStore.load(),
        });
      }
      return { dispose };
    },
  );
  const runtime: OpenCodeRuntime = {
    capabilities: { credentialStore: 1, connectionStore: 1 },
    mount,
  };
  const host: OpenCodeHostBridge = {
    id: 'vibecoder-test',
    directory: '/workspace',
    workspaceBridge: {
      exists: () => false,
      mkdir: () => {},
      readFile: () => undefined,
      writeFile: () => {},
      readdir: () => [],
      stat: () => undefined,
    },
    processBridge: { exec: async () => ({ code: 0, stdout: '', stderr: '' }) },
  };
  await act(async () =>
    root.render(
      <PasswordsKeychain
        passkeyVault={vault}
        tailscale={false}
        auth={createDemoDeviceAuth()}
      >
        <Vibecoder host={host} loadRuntime={async () => runtime} />
      </PasswordsKeychain>,
    ),
  );
  await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(1));
  expect(loaded).toEqual([]);
  await act(async () => {
    button('Unlock Passwords keychain')?.click();
    await vi.waitFor(() => expect(vault.status).toBe('unlocked'));
  });
  await vi.waitFor(() => expect(loaded).toEqual([{ credentials, connection }]));
  expect(mount).toHaveBeenCalledTimes(2);
  expect(dispose).toHaveBeenCalledTimes(1);
  await act(async () => button('Lock Passwords keychain')?.click());
  await vi.waitFor(() => expect(dispose).toHaveBeenCalledTimes(2));
  expect(button('Start OpenCode')).toBeTruthy();
  await act(async () => {
    await vault.unlock();
  });
  await vi.waitFor(() => expect(loaded).toHaveLength(2));
  expect(loaded[1]).toEqual({ credentials, connection });
});
