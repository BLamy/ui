import type { OpenCodeKeychainStore } from '@/lib/open-code-host';
import type { Vault } from '@/lib/vault';

export const OPENCODE_CREDENTIAL_SLOT = 'opencode-provider-credentials';
export const OPENCODE_CONNECTION_SLOT = 'opencode-connection';

type Keychain = Pick<Vault, 'status' | 'get' | 'put' | 'subscribe'>;

/** Reuses the Passwords passkey-PRF/AES-GCM vault. Never prompts, enrolls or falls back to plaintext storage. */
export function createVaultOpenCodeCredentialStore(
  vault: Keychain,
): OpenCodeKeychainStore {
  return createStore(vault, OPENCODE_CREDENTIAL_SLOT, []);
}

/** Saves the runtime's connection choice, Tailscale node keys and exit node in a separate encrypted slot. */
export function createVaultOpenCodeConnectionStore(
  vault: Keychain,
): OpenCodeKeychainStore {
  return createStore(vault, OPENCODE_CONNECTION_SLOT, null);
}

function createStore(
  vault: Keychain,
  slot: string,
  initial: unknown,
): OpenCodeKeychainStore {
  return {
    version: 1,
    unlocked: () => vault.status === 'unlocked',
    load: async () => (await vault.get(slot)) ?? initial,
    save: (entries) => vault.put(slot, entries),
    subscribe: (listener) => vault.subscribe(listener),
  };
}
