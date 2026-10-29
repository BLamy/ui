/* Apple Passwords clone — category tiles and shared groups · the item list with search · the detail with
   copyable fields, a password that morphs into view, verification codes with a countdown ring, security
   recommendations, Wi-Fi networks with a QR code, and developer sign-in buttons that run a real device-code login
   (GitHub, Fly.io, Netlify, Replay) and keep the token encrypted with a passkey. Wide: three tiled columns. Tablet: list + detail with the sidebar floating. Phone: one column at
   a time, pushed like iOS. All sample data is invented. */
import { useEffect, useMemo, useState } from 'react';
import { PasskeyEnrollDialog } from '@/components/ui/passkey-enroll-dialog';
import { SplitView, SplitViewDetail, SplitViewSidebar, SplitViewSupplementary, type SplitViewSelection } from '@/components/ui/split-view';
import { Toaster, createToastQueue } from '@/components/ui/toast';
import { BLProvider, useAppearance } from '@/lib/theme';
import type { Tailscale } from '@/lib/tailscale';
import { TailscaleProvider, useOptionalTailscale } from '@/lib/tailscale-react';
import type { Vault as PasskeyVault } from '@/lib/vault';
import { VaultProvider } from '@/lib/vault-react';
import type { CategoryId } from './data';
import { Detail } from './detail';
import { SERVICES, createDeviceAuth, type DeviceAuth, type DeviceGrant, type ServiceId } from './device-auth';
import { ItemList } from './item-list';
import { useClock } from './parts';
import { Sidebar } from './sidebar';
import { SignInCredenza, serviceItemId } from './sign-in';
import { SignInsProvider, useSignInStore } from './sign-ins';
import { passwordsTailnetOptions, tailnetOrProxy } from './tailnet';
import { firstEntry, sectionsFor, useVault, type Selection } from './vault';

/* Other blocks reach the keychain through this entry (blocks import each other's page only): wrap in
   <PasswordsKeychain>, read a token with useKeychainSignIn('github'). */
export { PasswordsKeychain, useKeychainSignIn, type KeychainSignIn, type PasswordsKeychainProps } from './keychain';
export { createDemoDeviceAuth, type DeviceAuth } from './device-auth';

/** Passwords' accent: iOS system blue (light #007AFF, dark #0A84FF). */
const PASSWORDS_TINT = { light: '#007AFF', dark: '#0A84FF' } as const;
/** A new password's tile color until it has a website (iOS system gray). */
const NEW_ITEM_GRAY = '#8E8E93';

export interface ApplePasswordsProps {
  /** Sidebar category (or `group:family`) to open on. Defaults to All. */
  initialCategory?: CategoryId | `group:${string}`;
  /** Item to show in the detail; defaults to the category's first item. */
  initialItem?: string;
  /** Advance the verification-code clock (with Date.now). Pass false for still frames (screenshots). Default true. */
  live?: boolean;
  /** Runs the Developer Sign-In buttons' device flows and checks their tokens. Defaults to the real flows: through the
      tailnet when this tab is signed in to Tailscale with an exit node online, else our CORS proxy.
      `createDeviceAuth({ fetch })` picks the transport, `createDemoDeviceAuth()` fakes it. */
  auth?: DeviceAuth;
  /** The Tailscale controller the sign-ins may use. Default: one sharing the Safari block's saved node (restored without
      a prompt when there is one). `false`: always the CORS proxy. */
  tailscale?: Tailscale | false;
  /** Open the sign-in sheet for this service on load. */
  initialSignIn?: ServiceId;
  /** The passkey vault the sign-ins are encrypted in. Defaults to one named `apple-passwords-sign-ins` in IndexedDB. */
  passkeyVault?: PasskeyVault;
}

const PASSKEY_VAULT = { id: 'apple-passwords-sign-ins', rp: { name: 'Passwords' }, userName: 'Developer sign-ins' };

export default function ApplePasswords({ passkeyVault, tailscale, ...props }: ApplePasswordsProps) {
  const app = (
    <VaultProvider vault={passkeyVault} options={PASSKEY_VAULT}>
      <Passwords {...props} />
    </VaultProvider>
  );
  // A demo auth needs no network; otherwise the sign-ins may go through the tailnet.
  if (tailscale === false || props.auth) return app;
  return tailscale ? <TailscaleProvider tailscale={tailscale}>{app}</TailscaleProvider> : <TailscaleProvider options={passwordsTailnetOptions()}>{app}</TailscaleProvider>;
}

const formatDay = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function Passwords({ initialCategory = 'all', initialItem, live = true, auth: authProp, initialSignIn }: Omit<ApplePasswordsProps, 'passkeyVault' | 'tailscale'>) {
  const tailnet = useOptionalTailscale();
  const auth = useMemo(() => authProp ?? createDeviceAuth({ fetch: tailnetOrProxy(tailnet) }), [authProp, tailnet]);
  const dark = useAppearance() === 'dark';
  const vault = useVault();
  const now = useClock(live);
  const [hud] = useState(createToastQueue);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [signIn, setSignIn] = useState<ServiceId | null>(initialSignIn ?? null);
  const [compact, setCompact] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const signIns = useSignInStore(auth);
  const [selection, setSelection] = useState<SplitViewSelection>(() => ({
    sidebar: initialCategory,
    supplementary: initialItem ?? firstEntry(sectionsFor(initialCategory, vault, '')),
  }));

  const category = (selection.sidebar ?? 'all') as Selection;
  const sections = sectionsFor(category, vault, query);
  const entries = sections.flatMap((s) => s.items);
  const entry = entries.find((e) => e.id === selection.supplementary) ?? null;

  const onSelectionChange = (next: SplitViewSelection) => {
    // A new category starts at its first item, with a fresh search.
    if (next.sidebar !== selection.sidebar) {
      setQuery('');
      next = { ...next, supplementary: firstEntry(sectionsFor(next.sidebar as Selection, vault, '')) };
    }
    if (next.supplementary !== selection.supplementary) setEditing(false);
    setSelection(next);
  };

  const addPassword = () => {
    const id = 'new-' + (vault.accounts.length + 1);
    vault.add({ id, title: 'New Password', username: '', password: '', websites: [''], color: NEW_ITEM_GRAY, modified: 'Today' });
    setQuery('');
    setSelection({ ...selection, supplementary: id });
    setEditing(true);
  };

  // Every kept sign-in is an item (its token in the secret field); signing out removes it.
  const grants = signIns.grants;
  const itemKey = SERVICES.map((s) => `${s.id}:${grants[s.id]?.accessToken ?? ''}:${grants[s.id]?.account ?? ''}`).join('|');
  useEffect(() => {
    for (const s of SERVICES) {
      const g = grants[s.id];
      const id = serviceItemId(s.id);
      if (!g) { vault.drop(id); continue; }
      vault.upsert({
        id, title: s.name, username: g.account, password: g.accessToken, token: true, websites: [s.site], color: s.color,
        modified: formatDay(g.createdAt), notes: `Signed in with a device code${g.scope ? ` · scopes: ${g.scope}` : ''}.`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  const show = (service: ServiceId) => {
    setQuery('');
    setEditing(false);
    setSelection({ ...selection, sidebar: 'all', supplementary: serviceItemId(service) });
  };
  const saveGrant = (service: ServiceId, grant: DeviceGrant) => { signIns.store(service, grant); show(service); };
  // Sets up the passkey vault (the first time) or unlocks it; held sign-ins move into it once it's open.
  const savePasskey = () => {
    if (signIns.passkeys.status === 'empty') setEnrolling(true);
    else if (signIns.passkeys.status === 'locked') void signIns.passkeys.unlock().catch(() => {});
  };

  return (
    <BLProvider dark={dark} tint={PASSWORDS_TINT[dark ? 'dark' : 'light']} className="bg-background">
      {/* The "Copied" HUD: the block's own toast queue, drawn inside the block; copy buttons reach it via useToast. */}
      <SignInsProvider value={{ ...signIns, signIn: setSignIn, savePasskey }}>
      <Toaster queue={hud} inline aria-label="Passwords notifications">
        <SplitView aria-label="Passwords" selection={selection} onSelectionChange={onSelectionChange} defaultCompactColumn="sidebar"
          onWidthClassChange={(wc) => setCompact(wc === 'compact')}>
          <SplitViewSidebar width={296} minWidth={250}>
            <Sidebar vault={vault} onOpenService={show} />
          </SplitViewSidebar>
          <SplitViewSupplementary width={320}>
            <ItemList category={category} sections={sections} query={query} onQuery={setQuery} now={now} onAdd={addPassword} />
          </SplitViewSupplementary>
          <SplitViewDetail>
            <Detail entry={entry} vault={vault} now={now} editing={editing} onEditing={setEditing} />
          </SplitViewDetail>
        </SplitView>
        <SignInCredenza service={signIn} auth={auth} compact={compact} live={live} onClose={() => setSignIn(null)} onSaved={saveGrant}
          onSavePasskey={savePasskey} />
      </Toaster>
      <PasskeyEnrollDialog isOpen={enrolling} onOpenChange={setEnrolling} appName="Passwords"
        protects="the developer sign-in tokens Passwords keeps in this browser" />
      </SignInsProvider>
    </BLProvider>
  );
}
