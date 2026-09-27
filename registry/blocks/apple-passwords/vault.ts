/* Vault state (edits, deletes, recoveries) and what each sidebar category lists. */
import { useState } from 'react';
import { ACCOUNTS, DELETED, GROUPS, SEVERITY, WIFI, type Account, type CategoryId, type Severity, type WifiNetwork } from './data';

export function useVault() {
  const [accounts, setAccounts] = useState(ACCOUNTS);
  const [deleted, setDeleted] = useState(DELETED);
  return {
    accounts,
    deleted,
    wifi: WIFI,
    update: (id: string, patch: Partial<Account>) =>
      setAccounts((list) => list.map((a) => (a.id === id ? { ...a, ...patch, modified: 'Today' } : a))),
    add: (account: Account) => setAccounts((list) => [...list, account]),
    remove: (id: string) => {
      const a = accounts.find((x) => x.id === id);
      if (!a) return;
      setAccounts((list) => list.filter((x) => x.id !== id));
      setDeleted((list) => [{ ...a, deleted: '30 days remaining' }, ...list]);
    },
    recover: (id: string) => {
      const a = deleted.find((x) => x.id === id);
      if (!a) return;
      setDeleted((list) => list.filter((x) => x.id !== id));
      setAccounts((list) => [...list, { ...a, deleted: undefined }]);
    },
    purge: (id: string) => setDeleted((list) => list.filter((x) => x.id !== id)),
  };
}
export type Vault = ReturnType<typeof useVault>;

export type Selection = CategoryId | `group:${string}`;

export interface Entry {
  id: string;
  kind: 'account' | 'wifi' | 'deleted';
  title: string;
  subtitle: string;
  account?: Account;
  wifi?: WifiNetwork;
  severity?: Severity;
}
export interface EntrySection { title?: string; items: Entry[] }

const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);
const accountEntry = (a: Account, kind: Entry['kind'] = 'account'): Entry => ({
  id: a.id, kind, title: a.title, subtitle: a.issue && kind === 'account' ? a.issue.kind : a.username, account: a, severity: a.issue?.severity,
});
const matches = (q: string, ...fields: (string | undefined)[]) => fields.some((f) => f?.toLowerCase().includes(q));

export function categoryTitle(sel: Selection) {
  if (sel.startsWith('group:')) return GROUPS.find((g) => 'group:' + g.id === sel)?.name ?? 'Group';
  return { all: 'All', passkeys: 'Passkeys', codes: 'Codes', wifi: 'Wi-Fi', security: 'Security', deleted: 'Recently Deleted' }[sel as CategoryId];
}

export function sectionsFor(sel: Selection, v: Vault, query: string): EntrySection[] {
  const q = query.trim().toLowerCase();
  const keep = (a: Account) => !q || matches(q, a.title, a.username, ...a.websites);
  const accounts = v.accounts.filter(keep).sort(byTitle);
  switch (sel) {
    case 'passkeys': return [{ items: accounts.filter((a) => a.passkey).map((a) => accountEntry(a)) }];
    case 'codes': return [{ items: accounts.filter((a) => a.otp).map((a) => accountEntry(a)) }];
    case 'deleted': return [{ items: v.deleted.filter(keep).map((a) => accountEntry(a, 'deleted')) }];
    case 'wifi':
      return [{
        items: v.wifi.filter((n) => !q || matches(q, n.ssid)).map((n) => ({ id: n.id, kind: 'wifi', title: n.ssid, subtitle: n.security, wifi: n })),
      }];
    case 'security': {
      const issues = accounts.filter((a) => a.issue).sort((a, b) => SEVERITY[a.issue!.severity].rank - SEVERITY[b.issue!.severity].rank);
      return [
        { title: 'High Priority', items: issues.filter((a) => a.issue!.severity === 'high').map((a) => accountEntry(a)) },
        { title: 'Other Recommendations', items: issues.filter((a) => a.issue!.severity !== 'high').map((a) => accountEntry(a)) },
      ].filter((s) => s.items.length);
    }
    case 'all': return [{ items: accounts.map((a) => ({ ...accountEntry(a), subtitle: a.username })) }];
    default: {
      const id = sel.slice('group:'.length);
      return [{ items: accounts.filter((a) => a.group === id).map((a) => ({ ...accountEntry(a), subtitle: a.username })) }];
    }
  }
}

export function counts(v: Vault): Record<CategoryId, number> {
  return {
    all: v.accounts.length,
    passkeys: v.accounts.filter((a) => a.passkey).length,
    codes: v.accounts.filter((a) => a.otp).length,
    wifi: v.wifi.length,
    security: v.accounts.filter((a) => a.issue).length,
    deleted: v.deleted.length,
  };
}

export const firstEntry = (sections: EntrySection[]) => sections[0]?.items[0]?.id ?? null;
