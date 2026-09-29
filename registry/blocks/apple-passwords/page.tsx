/* Apple Passwords clone — category tiles and shared groups · the item list with search · the detail with
   copyable fields, a password that morphs into view, verification codes with a countdown ring, security
   recommendations, and Wi-Fi networks with a QR code. Wide: three tiled columns. Tablet: list + detail with
   the sidebar floating. Phone: one column at a time, pushed like iOS. All sample data is invented. */
import { useState } from 'react';
import {
  BLProvider, SplitView, SplitViewDetail, SplitViewSidebar, SplitViewSupplementary, Toaster, createToastQueue, useAppearance,
  type SplitViewSelection,
} from '@brett_lamy/ui';
import type { CategoryId } from './data';
import { Detail } from './detail';
import { ItemList } from './item-list';
import { useClock } from './parts';
import { Sidebar } from './sidebar';
import { firstEntry, sectionsFor, useVault, type Selection } from './vault';

export interface ApplePasswordsProps {
  /** Sidebar category (or `group:family`) to open on. Defaults to All. */
  initialCategory?: CategoryId | `group:${string}`;
  /** Item to show in the detail; defaults to the category's first item. */
  initialItem?: string;
  /** Advance the verification-code clock (with Date.now). Pass false for still frames (screenshots). Default true. */
  live?: boolean;
}

export default function ApplePasswords({ initialCategory = 'all', initialItem, live = true }: ApplePasswordsProps) {
  const dark = useAppearance() === 'dark';
  const vault = useVault();
  const now = useClock(live);
  const [hud] = useState(createToastQueue);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
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
    vault.add({ id, title: 'New Password', username: '', password: '', websites: [''], color: '#8E8E93', modified: 'Today' });
    setQuery('');
    setSelection({ ...selection, supplementary: id });
    setEditing(true);
  };

  return (
    <BLProvider dark={dark} tint={dark ? '#0A84FF' : '#007AFF'} className="bg-bl-bg">
      {/* The "Copied" HUD: the block's own toast queue, drawn inside the block; copy buttons reach it via useToast. */}
      <Toaster queue={hud} inline aria-label="Passwords notifications">
        <SplitView aria-label="Passwords" selection={selection} onSelectionChange={onSelectionChange} defaultCompactColumn="sidebar">
          <SplitViewSidebar width={296} minWidth={250}>
            <Sidebar vault={vault} />
          </SplitViewSidebar>
          <SplitViewSupplementary width={320}>
            <ItemList category={category} sections={sections} query={query} onQuery={setQuery} now={now} onAdd={addPassword} />
          </SplitViewSupplementary>
          <SplitViewDetail>
            <Detail entry={entry} vault={vault} now={now} editing={editing} onEditing={setEditing} />
          </SplitViewDetail>
        </SplitView>
      </Toaster>
    </BLProvider>
  );
}
