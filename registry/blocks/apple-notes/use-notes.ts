/* Notes state: the notes, the open folder or tag, the selected note, search, list/gallery view, and which
   locked notes are unlocked this session. Shared by every column. */
import { useMemo, useState } from 'react';
import { FOLDERS, NOTES, NOW, dateGroup, title, type Folder, type Note } from './data';

export type NotesView = 'list' | 'gallery';
export interface NoteGroup { title: string; notes: Note[] }

/** Notes written this session are stamped a minute apart after NOW, so they sort to the top of Today. */
let tick = 0;
const stamp = () => new Date(NOW.getTime() + 60_000 * ++tick);

export function useNotes({ folder: initialFolder = 'all', note: initialNote = 'n1' as string | null, view: initialView = 'list' as NotesView } = {}) {
  const [notes, setNotes] = useState<Note[]>(NOTES);
  const [folderId, setFolderId] = useState(initialFolder);
  const [tag, setTag] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialNote);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<NotesView>(initialView);
  const [unlocked, setUnlocked] = useState<Set<string>>(() => new Set());

  const folder: Folder = FOLDERS.find((f) => f.id === folderId) ?? FOLDERS[0];
  const inFolder = (n: Note) => (tag ? n.folder !== 'deleted' && n.body.includes(`#${tag}`) : folder.match ? folder.match(n) : n.folder === folder.id);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter(inFolder)
      .filter((n) => !q || (!n.locked && n.body.toLowerCase().includes(q)) || title(n).toLowerCase().includes(q))
      .sort((a, b) => b.updated.getTime() - a.updated.getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, folderId, tag, query]);

  /** Pinned first, then by date — the sections Notes draws. */
  const groups = useMemo(() => {
    const out: NoteGroup[] = [];
    const pinned = list.filter((n) => n.pinned && n.folder !== 'deleted');
    if (pinned.length) out.push({ title: 'Pinned', notes: pinned });
    for (const n of list) {
      if (pinned.includes(n)) continue;
      const g = dateGroup(n.updated);
      const last = out[out.length - 1];
      if (last && last.title === g) last.notes.push(n);
      else out.push({ title: g, notes: [n] });
    }
    return out;
  }, [list]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const count = (f: Folder) => notes.filter((n) => (f.match ? f.match(n) : n.folder === f.id)).length;
  const patch = (id: string, p: Partial<Note>) => setNotes((all) => all.map((n) => (n.id === id ? { ...n, ...p } : n)));
  const isLocked = (n: Note) => !!n.locked && !unlocked.has(n.id);

  return {
    notes, list, groups, folder, folderId, tag, selected, selectedId, query, view, count, isLocked,
    setQuery,
    openFolder(id: string) {
      setTag(null);
      if (id === folderId) return;
      setFolderId(id); setQuery('');
    },
    openTag(t: string | null) { setTag(t); setQuery(''); },
    select(id: string | null) { setSelectedId(id); },
    setView(v: NotesView) { setView(v); },
    /** Typing in the editor: the note jumps to the top of Today, as it does in Notes. */
    edit(id: string, body: string) { patch(id, { body, updated: stamp() }); },
    create() {
      const target = folder.match || folder.id === 'deleted' || tag ? 'notes' : folder.id;
      const n: Note = { id: `new-${Date.now()}`, folder: target, body: '', updated: stamp() };
      setNotes((all) => [n, ...all]);
      setSelectedId(n.id); setQuery('');
      return n.id;
    },
    togglePin(id: string) {
      const n = notes.find((x) => x.id === id);
      patch(id, { pinned: !n?.pinned });
    },
    toggleLock(id: string) {
      const n = notes.find((x) => x.id === id);
      if (!n) return;
      // Adding a lock leaves the note open until you lock it (Lock Now); removing one is immediate.
      patch(id, { locked: !n.locked });
      setUnlocked((s) => { const x = new Set(s); if (n.locked) x.delete(id); else x.add(id); return x; });
    },
    relock(id: string) {
      setUnlocked((s) => { const x = new Set(s); x.delete(id); return x; });
    },
    unlock(id: string) { setUnlocked((s) => new Set(s).add(id)); },
    /** Deleting moves to Recently Deleted; deleting from there is final. */
    remove(id: string) {
      const n = notes.find((x) => x.id === id);
      if (!n) return;
      if (selectedId === id) {
        const i = list.findIndex((x) => x.id === id);
        const rest = list.filter((x) => x.id !== id);
        setSelectedId(rest[Math.min(Math.max(i, 0), rest.length - 1)]?.id ?? null);
      }
      if (n.folder === 'deleted') setNotes((all) => all.filter((x) => x.id !== id));
      else patch(id, { folder: 'deleted', deletedFrom: n.folder, pinned: false });
    },
    moveTo(id: string, folderTo: string) { patch(id, { folder: folderTo, deletedFrom: undefined }); },
  };
}

export type NotesState = ReturnType<typeof useNotes>;
