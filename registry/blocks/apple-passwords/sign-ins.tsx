/* Where device sign-ins live, like the app builder's keychain: encrypted in a passkey vault (AES-GCM in IndexedDB,
   the key wrapped by the passkey's PRF output), so a token survives a reload but can't be read without the passkey.
   Until the vault is set up or unlocked a new sign-in is held for this page only, and moves into the vault the
   moment it opens. Every token is checked against its service when it appears — the app builder's "Ready / Not
   signed in" — and a token the service turns down is shown as such instead of as signed in. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ContextType, type ReactNode } from 'react';
import { useEncryptedState, useVault as usePasskeyVault } from '@/lib/vault-react';
import { TokenRejectedError, type DeviceAuth, type DeviceGrant, type DeviceProfile, type ServiceId } from './device-auth';

type Grants = Partial<Record<ServiceId, DeviceGrant>>;

export type SignInCheck =
  | { state: 'checking'; token: string }
  | { state: 'ok'; token: string; profile: DeviceProfile; at: number }
  | { state: 'rejected'; token: string; message: string }
  | { state: 'error'; token: string; message: string };

export function useSignInStore(auth: DeviceAuth) {
  const passkeys = usePasskeyVault();
  const [saved, setSaved, meta] = useEncryptedState<Grants>('device-sign-ins', {});
  const [session, setSession] = useState<Grants>({});
  const [checks, setChecks] = useState<Partial<Record<ServiceId, SignInCheck>>>({});
  const unlocked = passkeys.status === 'unlocked' && meta.status === 'ready';
  const grants: Grants = { ...saved, ...session };

  const store = useCallback((id: ServiceId, grant: DeviceGrant) => {
    if (unlocked) void setSaved((g) => ({ ...g, [id]: grant }));
    else setSession((g) => ({ ...g, [id]: grant }));
  }, [unlocked, setSaved]);

  // Sign-ins held for the page move into the vault once it's open.
  useEffect(() => {
    if (!unlocked || !Object.keys(session).length) return;
    const moving = session;
    void setSaved((g) => ({ ...g, ...moving })).then((ok) => {
      if (ok) setSession((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !(k in moving))));
    });
  }, [unlocked, session, setSaved]);

  // Check each token once (again after Check Again or a new sign-in); a refreshed token is stored without a re-check.
  const running = useRef(new Map<ServiceId, AbortController>());
  const run = useCallback((id: ServiceId, grant: DeviceGrant) => {
    running.current.get(id)?.abort();
    const ctl = new AbortController();
    running.current.set(id, ctl);
    setChecks((c) => ({ ...c, [id]: { state: 'checking', token: grant.accessToken } }));
    auth.check(id, grant, ctl.signal).then(({ grant: next, profile }) => {
      setChecks((c) => ({ ...c, [id]: { state: 'ok', token: next.accessToken, profile, at: Date.now() } }));
      if (next.accessToken !== grant.accessToken || next.account !== grant.account) store(id, next);
    }).catch((e: unknown) => {
      if (ctl.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      setChecks((c) => ({ ...c, [id]: { state: e instanceof TokenRejectedError ? 'rejected' : 'error', token: grant.accessToken, message } }));
    });
  }, [auth, store]);

  useEffect(() => {
    for (const [id, grant] of Object.entries(grants) as [ServiceId, DeviceGrant][]) {
      if (checks[id]?.token !== grant.accessToken) run(id, grant);
    }
  });
  useEffect(() => () => { for (const c of running.current.values()) c.abort(); }, []);

  const forget = useCallback((id: ServiceId) => {
    running.current.get(id)?.abort();
    setSession((g) => { const { [id]: _, ...rest } = g; return rest; });
    if (unlocked) void setSaved((g) => { const { [id]: _, ...rest } = g; return rest; });
    setChecks((c) => { const { [id]: _, ...rest } = c; return rest; });
  }, [unlocked, setSaved]);

  return {
    grants, checks, store, forget,
    recheck: (id: ServiceId) => { const g = grants[id]; if (g) run(id, g); },
    /** Encrypted in the vault, rather than held for this page. */
    isSaved: (id: ServiceId) => id in saved && !(id in session),
    /** False while an unlocked vault is still decrypting the saved sign-ins. */
    loaded: passkeys.status !== 'unlocked' || meta.status === 'ready' || meta.status === 'error',
    passkeys,
  };
}
export type SignInStore = ReturnType<typeof useSignInStore>;

const Ctx = createContext<(SignInStore & { signIn: (id: ServiceId) => void; savePasskey: () => void }) | null>(null);
export function SignInsProvider({ value, children }: { value: NonNullable<ContextType<typeof Ctx>>; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
/** The nearest keychain's sign-ins, or null outside one (a block that reuses an enclosing keychain when there is one). */
export function useOptionalSignIns() {
  return useContext(Ctx);
}
export function useSignIns() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSignIns needs SignInsProvider');
  return v;
}
