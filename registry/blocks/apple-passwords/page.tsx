/* Apple Passwords clone — category tiles and shared groups · the item list with search · the detail with
   copyable fields, a password that morphs into view, verification codes with a countdown ring, security
   recommendations, Wi-Fi networks with a QR code, and developer sign-in buttons that run a device-code login and
   save the token. Wide: three tiled columns. Tablet: list + detail with the sidebar floating. Phone: one column at
   a time, pushed like iOS. All sample data is invented. */
import { useState } from 'react';
import { SplitView, SplitViewDetail, SplitViewSidebar, SplitViewSupplementary, type SplitViewSelection } from '@/components/ui/split-view';
import { Toaster, createToastQueue } from '@/components/ui/toast';
import { BLProvider, useAppearance } from '@/lib/theme';
import type { CategoryId } from './data';
import { Detail } from './detail';
import { SERVICES, demoDeviceAuth, type DeviceAuth, type DeviceGrant, type ServiceId } from './device-auth';
import { ItemList } from './item-list';
import { useClock } from './parts';
import { Sidebar } from './sidebar';
import { SignInCredenza, serviceItemId } from './sign-in';
import { firstEntry, sectionsFor, useVault, type Selection } from './vault';

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
  /** Runs the Developer Sign-In buttons' device flows. Defaults to `demoDeviceAuth` (an invented code that approves
      itself); pass `createDeviceAuth({ fetch: corsProxy(…) })` to sign in for real. */
  auth?: DeviceAuth;
  /** Open the sign-in sheet for this service on load. */
  initialSignIn?: ServiceId;
}

export default function ApplePasswords({ initialCategory = 'all', initialItem, live = true, auth = demoDeviceAuth, initialSignIn }: ApplePasswordsProps) {
  const dark = useAppearance() === 'dark';
  const vault = useVault();
  const now = useClock(live);
  const [hud] = useState(createToastQueue);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [signIn, setSignIn] = useState<ServiceId | null>(initialSignIn ?? null);
  const [compact, setCompact] = useState(false);
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

  // A device sign-in's token is saved (or replaced) as an item and shown under All.
  const saveGrant = (service: ServiceId, grant: DeviceGrant) => {
    const s = SERVICES.find((x) => x.id === service)!;
    const id = serviceItemId(service);
    vault.upsert({
      id, title: s.name, username: grant.account, password: grant.accessToken, token: true, websites: [s.site],
      color: s.color, modified: 'Today', notes: `Signed in with a device code${grant.scope ? ` · scopes: ${grant.scope}` : ''}.`,
    });
    setQuery('');
    setEditing(false);
    setSelection({ ...selection, sidebar: 'all', supplementary: id });
  };

  return (
    <BLProvider dark={dark} tint={PASSWORDS_TINT[dark ? 'dark' : 'light']} className="bg-background">
      {/* The "Copied" HUD: the block's own toast queue, drawn inside the block; copy buttons reach it via useToast. */}
      <Toaster queue={hud} inline aria-label="Passwords notifications">
        <SplitView aria-label="Passwords" selection={selection} onSelectionChange={onSelectionChange} defaultCompactColumn="sidebar"
          onWidthClassChange={(wc) => setCompact(wc === 'compact')}>
          <SplitViewSidebar width={296} minWidth={250}>
            <Sidebar vault={vault} onSignIn={setSignIn} />
          </SplitViewSidebar>
          <SplitViewSupplementary width={320}>
            <ItemList category={category} sections={sections} query={query} onQuery={setQuery} now={now} onAdd={addPassword} />
          </SplitViewSupplementary>
          <SplitViewDetail>
            <Detail entry={entry} vault={vault} now={now} editing={editing} onEditing={setEditing} />
          </SplitViewDetail>
        </SplitView>
        <SignInCredenza service={signIn} auth={auth} compact={compact} live={live} onClose={() => setSignIn(null)} onSaved={saveGrant} />
      </Toaster>
    </BLProvider>
  );
}
