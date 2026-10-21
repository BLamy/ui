/* The docs' answer to a page's `env` frontmatter (docstream's DocstreamEnvHost). A gated example's "Load from Keychain"
   reads the variables from the Passwords block's keychain — the same passkey vault and device sign-ins, so a token signed in
   there is already here — and when one is missing it starts that service's device-code sign-in (GitHub, Fly.io, Netlify,
   Replay), through the tailnet when this tab is on Tailscale with an exit node, else the CORS proxy. Variables no sign-in
   provides are typed once and kept in the same vault. */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DocstreamEnvHost } from '@brett_lamy/docstream';
import { Button } from '@/components/ui/button';
import { Credenza } from '@/components/ui/credenza';
import { Input } from '@/components/ui/input';
import { PasskeyEnrollDialog } from '@/components/ui/passkey-enroll-dialog';
import { BLProvider } from '@/lib/theme';
import { TailscaleProvider, useOptionalTailscale } from '@/lib/tailscale-react';
import { VaultProvider, useEncryptedState } from '@/lib/vault-react';
import { SERVICES, createDeviceAuth, type DeviceGrant, type ServiceId } from '@/components/blocks/apple-passwords/device-auth';
import { SignInCredenza } from '@/components/blocks/apple-passwords/sign-in';
import { SignInsProvider, useSignInStore } from '@/components/blocks/apple-passwords/sign-ins';
import { passwordsTailnetOptions, tailnetOrProxy } from '@/components/blocks/apple-passwords/tailnet';

/** Which device sign-in provides each variable (the names the services' own CLIs read). */
export const ENV_SERVICES: Record<string, ServiceId> = {
  GITHUB_TOKEN: 'github', GH_TOKEN: 'github',
  FLY_API_TOKEN: 'fly', FLY_ACCESS_TOKEN: 'fly',
  NETLIFY_AUTH_TOKEN: 'netlify',
  REPLAY_API_KEY: 'replay', RECORD_REPLAY_API_KEY: 'replay',
};

/** The Passwords block's vault: one keychain for both. */
const KEYCHAIN = { id: 'apple-passwords-sign-ins', rp: { name: 'Passwords' }, userName: 'Developer sign-ins' };

interface Pending {
  names: readonly string[];
  resolve: (values: Record<string, string>) => void;
  reject: (error: Error) => void;
}

/** Wrap the docs in it; `children` receives the host to pass as docstream's `envHost`. */
export function EnvKeychain({ children }: { children: (host: DocstreamEnvHost) => ReactNode }) {
  return (
    <TailscaleProvider options={passwordsTailnetOptions()}>
      <VaultProvider options={KEYCHAIN}>
        <Keychain>{children}</Keychain>
      </VaultProvider>
    </TailscaleProvider>
  );
}

function Keychain({ children }: { children: (host: DocstreamEnvHost) => ReactNode }) {
  const tailnet = useOptionalTailscale();
  const auth = useMemo(() => createDeviceAuth({ fetch: tailnetOrProxy(tailnet) }), [tailnet]);
  const store = useSignInStore(auth);
  const { passkeys } = store;
  const [typedSaved, setTypedSaved, typedMeta] = useEncryptedState<Record<string, string>>('docs-env', {});
  const [typedSession, setTypedSession] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [signIn, setSignIn] = useState<ServiceId | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const unlocking = useRef(false);

  const valueOf = useCallback((name: string) => {
    const service = ENV_SERVICES[name];
    return service ? store.grants[service]?.accessToken : typedSession[name] ?? typedSaved[name];
  }, [store.grants, typedSaved, typedSession]);

  // Works through a request: unlock the keychain once, then sign in (or ask) for each missing variable in turn.
  useEffect(() => {
    if (!pending || signIn || typing) return;
    if (passkeys.status === 'loading') return;
    if (passkeys.status === 'locked' && !unlocking.current) {
      unlocking.current = true;
      // Started from the gate's press (still within its activation). Declined: carry on, holding new values for the page.
      void passkeys.unlock().catch(() => {}).finally(() => { unlocking.current = false; setPending((p) => (p ? { ...p } : p)); });
      return;
    }
    if (unlocking.current) return;
    // Just unlocked: wait for the saved sign-ins and values to decrypt before deciding what's missing.
    if (passkeys.status === 'unlocked' && (!store.loaded || typedMeta.status === 'loading' || typedMeta.status === 'locked')) return;
    const missing = pending.names.filter((n) => !valueOf(n));
    if (!missing.length) {
      pending.resolve(Object.fromEntries(pending.names.map((n) => [n, valueOf(n)!])));
      setPending(null);
      return;
    }
    const service = ENV_SERVICES[missing[0]!];
    if (service) setSignIn(service);
    else setTyping(missing[0]!);
  }, [pending, signIn, typing, passkeys, valueOf, store.loaded, typedMeta.status]);

  const cancel = (message: string) => {
    pending?.reject(new Error(message));
    setPending(null);
  };

  const host = useMemo<DocstreamEnvHost>(() => ({
    label: 'Load from Keychain',
    describe: (name) => {
      const service = SERVICES.find((s) => s.id === ENV_SERVICES[name]);
      return service ? `Sign in with ${service.name}` : 'Saved in your keychain';
    },
    request: (names) => new Promise<Record<string, string>>((resolve, reject) => setPending({ names, resolve, reject })),
  }), []);

  const saveTyped = (name: string, value: string) => {
    if (passkeys.status === 'unlocked') void setTypedSaved((t) => ({ ...t, [name]: value }));
    else setTypedSession((t) => ({ ...t, [name]: value }));
    setTyping(null);
  };

  const savePasskey = () => {
    if (passkeys.status === 'empty') setEnrolling(true);
    else if (passkeys.status === 'locked') void passkeys.unlock().catch(() => {});
  };

  const overlay = signIn !== null || typing !== null || enrolling;
  return (
    <SignInsProvider value={{ ...store, signIn: setSignIn, savePasskey }}>
      {children(host)}
      {/* The sheets need a positioned host over the page; it only takes pointer events while one is open. */}
      <BLProvider className="fixed inset-0 z-50" style={{ pointerEvents: overlay ? 'auto' : 'none', background: 'transparent' }}>
        <SignInCredenza service={signIn} auth={auth} compact={false} live
          onSaved={(id: ServiceId, grant: DeviceGrant) => store.store(id, grant)}
          onSavePasskey={savePasskey}
          onClose={() => {
            const closed = signIn;
            setSignIn(null);
            if (closed && !store.grants[closed] && pending) cancel(`Signing in to ${SERVICES.find((s) => s.id === closed)?.name} was cancelled.`);
          }} />
        <TypeValue name={typing} onSave={saveTyped} onCancel={() => { setTyping(null); cancel('Cancelled.'); }} />
        <PasskeyEnrollDialog isOpen={enrolling} onOpenChange={setEnrolling} appName="Passwords"
          protects="the tokens and variables the docs' examples use" />
      </BLProvider>
    </SignInsProvider>
  );
}

function TypeValue({ name, onSave, onCancel }: { name: string | null; onSave: (name: string, value: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('');
  const last = useRef(name);
  if (name) last.current = name;
  useEffect(() => { if (name) setValue(''); }, [name]);
  const shown = last.current ?? '';
  return (
    <Credenza open={name !== null} onClose={onCancel} title={`Enter ${shown}`} compact={false}>
      <form className="grid gap-3 px-4 pt-1 pb-4" onSubmit={(e) => { e.preventDefault(); if (value) onSave(shown, value); }}>
        <p className="m-0 text-footnote text-muted-foreground">No sign-in provides <code>{shown}</code>. It is kept in your keychain (encrypted with your passkey once one is set up).</p>
        <Input aria-label={shown} type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        <Button size="pill" type="submit" isDisabled={!value}>Save</Button>
      </form>
    </Credenza>
  );
}
