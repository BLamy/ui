'use client';
import {
  createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode,
} from 'react';
import {
  PasskeyError, createPasskey, detectPasskeySupport, getPrfSecret,
  type CreatePasskeyOptions, type CreatePasskeyResult, type GetPrfSecretOptions, type PasskeyCredentialRef, type PasskeyEnv, type PasskeySupport, type PrfSecret,
} from '@/lib/passkey';
import { VaultError, createVault, type Vault, type VaultOptions, type VaultState } from '@/lib/vault';

/* ══ vault-react — hooks over passkey.ts and vault.ts ══
   <VaultProvider options={{ id: 'notes', rp: { name: 'Notes' } }}>
     <App />                              // useVault(), useEncryptedState('draft', '')
   </VaultProvider>

   Nothing is cached outside React: a vault is an object you create (the provider does, once), its snapshot is read
   with `useSyncExternalStore`, and `useEncryptedState` clears its value from component state the moment the vault
   locks. Server rendering shows `status: 'loading'`; the browser is probed in an effect. */

const VaultContext = createContext<Vault | null>(null);

export interface VaultProviderProps {
  /** An existing vault (created with `createVault`). Takes precedence over `options`. */
  vault?: Vault;
  /** Options for a vault the provider creates once, on first render. Later changes are ignored; pass `key` to restart. */
  options?: VaultOptions;
  /** Restart the auto-lock timer on pointer and key activity anywhere on the page (default true; a no-op without `autoLockMs`). */
  trackActivity?: boolean;
  children?: ReactNode;
}

/** Provides a vault to the tree and runs its lifecycle: `init()` on mount, `dispose()` (which locks it) on unmount. */
export function VaultProvider({ vault, options, trackActivity = true, children }: VaultProviderProps) {
  const [owned] = useState<Vault | null>(() => {
    if (vault) return null;
    if (!options) throw new Error('VaultProvider needs a `vault` or `options`.');
    return createVault(options);
  });
  const active = vault ?? owned;
  if (!active) throw new Error('VaultProvider needs a `vault` or `options`.');

  useEffect(() => {
    active.init().catch(() => { /* surfaced as status: 'unsupported' where it matters */ });
    return () => active.dispose();
  }, [active]);

  useEffect(() => {
    if (!trackActivity) return;
    let last = 0;
    const touch = () => {
      const now = Date.now();
      if (now - last > 1000) { last = now; active.touch(); }
    };
    const events = ['pointerdown', 'keydown'] as const;
    for (const e of events) document.addEventListener(e, touch, { capture: true, passive: true });
    return () => { for (const e of events) document.removeEventListener(e, touch, { capture: true }); };
  }, [active, trackActivity]);

  return <VaultContext.Provider value={active}>{children}</VaultContext.Provider>;
}

/** The nearest provider's vault (or `override`), without subscribing. */
function useVaultInstance(override?: Vault): Vault {
  const ctx = useContext(VaultContext);
  const vault = override ?? ctx;
  if (!vault) throw new Error('useVault must be used inside <VaultProvider> (or be given a vault).');
  return vault;
}

/** The vault's current snapshot; re-renders on every change. */
export function useVaultState(vault?: Vault): VaultState {
  const v = useVaultInstance(vault);
  return useSyncExternalStore(v.subscribe, v.getState, v.getServerState);
}

/** The vault, with the component subscribed to its status: `useVault().status`, `.enroll()`, `.put()`… Pass a vault to skip the provider. */
export function useVault(vault?: Vault): Vault {
  const v = useVaultInstance(vault);
  useSyncExternalStore(v.subscribe, v.getState, v.getServerState);
  return v;
}

/* ── messages ── */

/** A sentence for the person using the app, for anything the vault or a passkey throws. Never includes secrets. Replace it to localise. */
export function vaultErrorMessage(error: unknown): string {
  if (error instanceof PasskeyError) {
    switch (error.reason) {
      case 'cancelled': return 'The passkey prompt was closed or timed out. Nothing was changed.';
      case 'no-prf': return "That passkey can't protect data: it doesn't support the PRF extension. Try your device's built-in passkey or a different security key.";
      case 'not-allowed': return 'Your browser blocked the passkey request for this page.';
      case 'excluded': return 'That authenticator already holds a passkey for this vault. Use a different one.';
      case 'insecure-context': return 'Passkeys only work on HTTPS (or localhost).';
      case 'unsupported': return "This browser or authenticator doesn't support what passkey protection needs.";
      default: return 'Something went wrong with the passkey. Try again.';
    }
  }
  if (error instanceof VaultError) {
    switch (error.reason) {
      case 'wrong-key': return "That passkey doesn't open this vault. Try another one, or use your recovery key.";
      case 'wrong-recovery-key': return "That recovery key doesn't open the vault. Check it for typos.";
      case 'invalid-recovery-key': return 'A recovery key is 32 letters and digits in 8 groups of 4.';
      case 'busy': return 'Another operation is in progress. Try again in a moment.';
      case 'corrupt': return 'Some stored data is damaged. It was kept, not deleted.';
      case 'storage': return "This browser isn't letting the app save data.";
      case 'newer-version': return 'This data was saved by a newer version of the app.';
      default: return error.message;
    }
  }
  return 'Something went wrong. Try again.';
}

/* ── support ── */

/** What this browser can do for passkeys: `null` on the server and until the check finishes (it never prompts). */
export function useWebAuthnSupport(env?: PasskeyEnv): PasskeySupport | null {
  const [support, setSupport] = useState<PasskeySupport | null>(null);
  const envRef = useRef(env);
  useEffect(() => {
    let alive = true;
    detectPasskeySupport(envRef.current).then((s) => { if (alive) setSupport(s); });
    return () => { alive = false; };
  }, []);
  return support;
}

/* ── passkey ── */

export interface UsePasskey {
  support: PasskeySupport | null;
  status: 'idle' | 'pending' | 'success' | 'error';
  /** The last failure; branch on `error.reason`. Cleared when a new request starts. */
  error: PasskeyError | null;
  /** Create a passkey and, if the authenticator evaluates it at creation, its PRF secret. Resolves `null` on failure (see `error`). */
  create: (options: Omit<CreatePasskeyOptions, 'signal' | 'env'>) => Promise<CreatePasskeyResult | null>;
  /** Ask for the PRF secret of one of `credentials`. Resolves `null` on failure (see `error`). */
  getSecret: (credentials: ReadonlyArray<string | PasskeyCredentialRef>, salt: BufferSource, options?: Omit<GetPrfSecretOptions, 'signal' | 'env'>) => Promise<PrfSecret | null>;
  /** Abort the request in flight (the prompt closes; `error.reason` becomes `cancelled`). */
  cancel: () => void;
  reset: () => void;
}

/** Passkey ceremonies as state: pending while the prompt is open, the typed error afterwards, aborted on unmount. Secrets
 *  come back through the promises and are never kept in state. For app data use `useVault`; this is for custom schemes. */
export function usePasskey(env?: PasskeyEnv): UsePasskey {
  const support = useWebAuthnSupport(env);
  const [status, setStatus] = useState<UsePasskey['status']>('idle');
  const [error, setError] = useState<PasskeyError | null>(null);
  const controller = useRef<AbortController | null>(null);
  const envRef = useRef(env);

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(async <T,>(fn: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setStatus('pending');
    setError(null);
    try {
      const result = await fn(ac.signal);
      if (controller.current === ac) setStatus('success');
      return result;
    } catch (e) {
      if (controller.current === ac) {
        setError(e instanceof PasskeyError ? e : new PasskeyError('failed', e instanceof Error ? e.message : 'The passkey request failed.', e));
        setStatus('error');
      }
      return null;
    }
  }, []);

  const create = useCallback<UsePasskey['create']>((options) => run((signal) => createPasskey({ ...options, signal, env: envRef.current })), [run]);
  const getSecret = useCallback<UsePasskey['getSecret']>((credentials, salt, options) => run((signal) => getPrfSecret(credentials, salt, { ...options, signal, env: envRef.current })), [run]);
  const cancel = useCallback(() => controller.current?.abort(), []);
  const reset = useCallback(() => { setStatus('idle'); setError(null); }, []);

  return { support, status, error, create, getSecret, cancel, reset };
}

/* ── encrypted state ── */

export interface EncryptedStateMeta {
  /** `locked` (value is `initial`; nothing is in memory), `loading`, `ready` or `error`. */
  status: 'locked' | 'loading' | 'ready' | 'error';
  error: Error | null;
}

export type EncryptedStateSetter<T> = (next: T | ((prev: T) => T)) => Promise<boolean>;

/** `useState` that lives in the vault. While the vault is locked the value is `initial` and nothing is read or kept;
 *  on unlock it loads; `set` updates the screen at once and writes encrypted in the background (resolves `false` and sets
 *  `meta.error` if the write failed). Changes from other tabs arrive on their own. */
export function useEncryptedState<T>(name: string, initial: T | (() => T), vault?: Vault): [T, EncryptedStateSetter<T>, EncryptedStateMeta] {
  const v = useVault(vault);
  const unlocked = v.status === 'unlocked';
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const resolveInitial = (): T => {
    const i = initialRef.current;
    return typeof i === 'function' ? (i as () => T)() : i;
  };
  const [value, setValue] = useState<T>(resolveInitial);
  const valueRef = useRef(value);
  const [meta, setMeta] = useState<EncryptedStateMeta>({ status: 'locked', error: null });
  const persisted = useRef(value);
  const writing = useRef(0);

  const commit = useCallback((next: T) => { valueRef.current = next; setValue(next); }, []);

  useEffect(() => {
    if (!unlocked) {
      // Locked: drop whatever was decrypted out of component state.
      const empty = resolveInitial();
      valueRef.current = persisted.current = empty;
      setValue(empty);
      setMeta({ status: 'locked', error: null });
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const stored = await v.get<T>(name);
        if (!alive) return;
        const loaded = stored === undefined ? resolveInitial() : stored;
        persisted.current = loaded;
        commit(loaded);
        setMeta({ status: 'ready', error: null });
      } catch (e) {
        if (alive) setMeta({ status: 'error', error: e instanceof Error ? e : new Error(String(e)) });
      }
    };
    setMeta((m) => (m.status === 'ready' ? m : { status: 'loading', error: null }));
    void load();
    // Reload on changes from elsewhere (other tabs, other hooks on the same name) but not on our own writes.
    const off = v.watch(name, () => { if (writing.current === 0) void load(); });
    return () => { alive = false; off(); };
    // `resolveInitial` reads a ref, so it is stable by construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, name, unlocked, commit]);

  const set = useCallback<EncryptedStateSetter<T>>(async (next) => {
    if (v.status !== 'unlocked') {
      // Never hold a value that cannot be saved: while locked nothing is kept in component state either.
      setMeta({ status: 'error', error: new VaultError('locked', 'The vault is locked.') });
      return false;
    }
    const resolved = typeof next === 'function' ? (next as (p: T) => T)(valueRef.current) : next;
    commit(resolved);
    writing.current++;
    try {
      await v.put(name, resolved);
      persisted.current = resolved;
      setMeta((m) => (m.status === 'error' ? { status: 'ready', error: null } : m));
      return true;
    } catch (e) {
      commit(persisted.current); // the write failed: show what is actually stored
      setMeta({ status: 'error', error: e instanceof Error ? e : new Error(String(e)) });
      return false;
    } finally {
      writing.current--;
    }
  }, [v, name, commit]);

  return [value, set, meta];
}
