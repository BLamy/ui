/* The Passwords keychain, for other blocks: the same passkey vault (`apple-passwords-sign-ins`) and device sign-ins the
   Passwords block keeps, so a token signed in there — or in the docs' "Load from Keychain" — is already here, and one
   signed in here shows up there. Wrap a block in <PasswordsKeychain> and read a service's token with
   useKeychainSignIn('github'). When an enclosing keychain exists (the docs' EnvKeychain, the Passwords block) it is
   reused, so the vault unlocks once; otherwise this mounts its own vault, sign-in sheet and passkey enrollment.
   Sign-ins go through the tailnet when this tab is on Tailscale with an exit node, else the CORS proxy (tailnet.ts).
   Nothing here prompts by itself: a locked vault stays locked until `unlock()` runs from a press. */
import { useMemo, useState, type ReactNode } from 'react';
import { PasskeyEnrollDialog } from '@/components/ui/passkey-enroll-dialog';
import type { Tailscale } from '@/lib/tailscale';
import { TailscaleProvider, useOptionalTailscale } from '@/lib/tailscale-react';
import type { Vault as PasskeyVault } from '@/lib/vault';
import { VaultProvider } from '@/lib/vault-react';
import { createDeviceAuth, type DeviceAuth, type DeviceGrant, type ServiceId } from './device-auth';
import { SignInCredenza } from './sign-in';
import { SignInsProvider, useOptionalSignIns, useSignInStore, type SignInCheck } from './sign-ins';
import { passwordsTailnetOptions, tailnetOrProxy } from './tailnet';

/** The Passwords block's vault: one keychain for every block that signs in. */
export const PASSWORDS_KEYCHAIN = { id: 'apple-passwords-sign-ins', rp: { name: 'Passwords' }, userName: 'Developer sign-ins' };

export interface PasswordsKeychainProps {
  children: ReactNode;
  /** Sheets as trays (phone) instead of dialogs. */
  compact?: boolean;
  /** Runs the device sign-ins; defaults to the real flows (tailnet or CORS proxy). `createDemoDeviceAuth()` fakes them. */
  auth?: DeviceAuth;
  /** The Tailscale controller sign-ins may use; default one sharing the Safari block's node. `false`: always the proxy. */
  tailscale?: Tailscale | false;
  /** The passkey vault; defaults to the Passwords one in IndexedDB. */
  passkeyVault?: PasskeyVault;
  /** Finishes the enroll dialog's "Protect …" line. */
  protects?: string;
}

export function PasswordsKeychain({ children, tailscale, passkeyVault, ...rest }: PasswordsKeychainProps) {
  const outer = useOptionalSignIns();
  if (outer) return <>{children}</>;
  const app = (
    <VaultProvider vault={passkeyVault} options={PASSWORDS_KEYCHAIN}>
      <Keychain {...rest}>{children}</Keychain>
    </VaultProvider>
  );
  if (tailscale === false || rest.auth) return app;
  return tailscale ? <TailscaleProvider tailscale={tailscale}>{app}</TailscaleProvider> : <TailscaleProvider options={passwordsTailnetOptions()}>{app}</TailscaleProvider>;
}

function Keychain({ children, compact = false, auth: authProp, protects = 'the developer sign-in tokens kept in this browser' }: Omit<PasswordsKeychainProps, 'tailscale' | 'passkeyVault'>) {
  const tailnet = useOptionalTailscale();
  const auth = useMemo(() => authProp ?? createDeviceAuth({ fetch: tailnetOrProxy(tailnet) }), [authProp, tailnet]);
  const store = useSignInStore(auth);
  const [signIn, setSignIn] = useState<ServiceId | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const savePasskey = () => {
    if (store.passkeys.status === 'empty') setEnrolling(true);
    else if (store.passkeys.status === 'locked') void store.passkeys.unlock().catch(() => {});
  };
  return (
    <SignInsProvider value={{ ...store, signIn: setSignIn, savePasskey }}>
      {children}
      <SignInCredenza service={signIn} auth={auth} compact={compact} live onClose={() => setSignIn(null)}
        onSaved={(id: ServiceId, grant: DeviceGrant) => store.store(id, grant)} onSavePasskey={savePasskey} />
      <PasskeyEnrollDialog isOpen={enrolling} onOpenChange={setEnrolling} appName="Passwords" protects={protects} />
    </SignInsProvider>
  );
}

export interface KeychainSignIn {
  /** The token to use: absent when there is none, or when the service turned it down. */
  token?: string;
  account?: string;
  check?: SignInCheck;
  /** No token yet, and the vault is locked (or still decrypting): it may hold one behind the passkey. */
  locked: boolean;
  /** The service rejected the saved token: sign in again. */
  rejected: boolean;
  /** Opens the device sign-in sheet. */
  signIn: () => void;
  /** Prompts for the passkey; call it from a press. */
  unlock: () => Promise<void>;
  /** Drops the sign-in from the keychain. */
  forget: () => void;
}

/** One service's sign-in from the enclosing keychain; null outside one. */
export function useKeychainSignIn(id: ServiceId): KeychainSignIn | null {
  const s = useOptionalSignIns();
  if (!s) return null;
  const grant = s.grants[id];
  const check = s.checks[id];
  const rejected = check?.state === 'rejected' && check.token === grant?.accessToken;
  return {
    token: rejected ? undefined : grant?.accessToken,
    account: grant?.account,
    check,
    locked: !grant && (s.passkeys.status === 'locked' || !s.loaded),
    rejected,
    signIn: () => s.signIn(id),
    unlock: async () => { await s.passkeys.unlock(); },
    forget: () => s.forget(id),
  };
}
