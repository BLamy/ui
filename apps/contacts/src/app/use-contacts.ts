/* The Contacts app's state: which list is open, the search query, favorites, deletions, ringtones, and the
   multi-select edit mode. Columns read it; nothing here knows about layout. */
import { useState } from 'react';
import { Haptics } from '@brett_lamy/ui';
import { AL, CONTACTS, GROUPS, RECENTS, type Contact } from './data';

/** Sidebar lists: the three library lists, then one per group. */
export const LISTS = [
  { id: 'all', title: 'All Contacts', icon: 'person2' },
  { id: 'fav', title: 'Favorites', icon: 'star' },
  { id: 'rec', title: 'Recents', icon: 'clock' },
] as const;

export function listTitle(id: string) {
  return LISTS.find((l) => l.id === id)?.title ?? id;
}

export function useContacts() {
  const [listId, setListId] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [favs, setFavs] = useState(() => new Set(CONTACTS.filter((c) => c.fav).map((c) => c.id)));
  const [deleted, setDeleted] = useState(() => new Set<string>());
  const [ringtones, setRingtones] = useState<Record<string, string>>({});
  const [editing, setEditingState] = useState(false);
  const [checked, setChecked] = useState(() => new Set<string>());

  const alive = CONTACTS.filter((c) => !deleted.has(c.id));
  const inList = (c: Contact, id: string) =>
    id === 'all' ? true : id === 'fav' ? favs.has(c.id) : id === 'rec' ? RECENTS.has(c.id) : c.g === id;
  const q = query.trim().toLowerCase();
  const matches = (c: Contact) => !q || `${c.f} ${c.l} ${c.com} ${c.role}`.toLowerCase().includes(q);
  const visible = alive.filter((c) => inList(c, listId) && matches(c));
  const sections = AL.map((letter) => ({ letter, items: visible.filter((c) => c.l[0].toUpperCase() === letter) })).filter(
    (s) => s.items.length,
  );
  const count = (id: string) => alive.filter((c) => inList(c, id)).length;
  const selected = (selectedId && alive.find((c) => c.id === selectedId)) || null;

  const remove = (ids: Iterable<string>) => {
    const gone = new Set(ids);
    setDeleted((d) => new Set([...d, ...gone]));
    if (selectedId && gone.has(selectedId)) setSelectedId(null);
  };
  const setFavorite = (ids: string[], on: boolean) =>
    setFavs((f) => {
      const n = new Set(f);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });
  const setEditing = (on: boolean) => {
    setEditingState(on);
    setChecked(new Set());
  };

  return {
    listId, setListId, selectedId, setSelectedId, selected, query, setQuery,
    sections, visible, count, groups: GROUPS, deletedCount: deleted.size,
    isFavorite: (id: string) => favs.has(id),
    setFavorite,
    ringtone: (id: string) => ringtones[id] ?? 'Reflection',
    setRingtone: (id: string, tone: string) => setRingtones((r) => ({ ...r, [id]: tone })),
    remove,
    restore: () => {
      if (!deleted.size) return;
      setDeleted(new Set());
      Haptics.notification('success');
    },
    editing, setEditing, checked,
    toggleChecked: (id: string) => {
      setChecked((c) => {
        const n = new Set(c);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
      Haptics.selection();
    },
    favoriteChecked: () => {
      const ids = [...checked];
      setFavorite(ids, !ids.every((id) => favs.has(id)));
      Haptics.impact('light');
    },
    deleteChecked: () => {
      remove(checked);
      setChecked(new Set());
      Haptics.notification('warning');
    },
  };
}

export type ContactsState = ReturnType<typeof useContacts>;
