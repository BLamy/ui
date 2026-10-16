import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROOT_FOLDER, title, type Folder, type Note } from './data';
import { BROWSER_ROOT, FileConflict, fileId, folderId as fileFolderId, useNoteFiles } from './use-note-files';

export type NotesView = 'list' | 'tree';
/** Where a name is edited: its row in the master list (or tree), or the note's title in the toolbar. */
export type RenamePlace = 'list' | 'title';
interface Draft { note: Note; body: string; base: string; saving?: boolean; error?: string; conflict?: string | null }

export function useNotes({ folder: initialFolder = ROOT_FOLDER.id, note: initialNote = null as string | null, view: initialView = 'list' as NotesView } = {}) {
  const files = useNoteFiles();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const draftsRef = useRef(drafts);
  const filesRef = useRef(files); filesRef.current = files;
  const updateDrafts = useCallback((fn: (prev: Record<string, Draft>) => Record<string, Draft>) => {
    const next = fn(draftsRef.current); draftsRef.current = next; setDrafts(next);
  }, []);
  const save = useCallback(async (id: string, keepMine = false) => {
    const draft = draftsRef.current[id];
    if (!draft || draft.saving) return;
    const current = filesRef.current.notes.find((n) => n.id === id);
    const expected = keepMine ? draft.conflict ?? current?.body ?? draft.base : draft.base;
    updateDrafts((prev) => ({ ...prev, [id]: { ...prev[id], saving: true, error: undefined } }));
    try {
      await filesRef.current.write(draft.note, draft.body, expected);
      updateDrafts((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        if (next[id].body === draft.body) delete next[id];
        else next[id] = { ...next[id], base: draft.body, saving: false, conflict: undefined };
        return next;
      });
    } catch (e) {
      updateDrafts((prev) => !prev[id] ? prev : ({ ...prev, [id]: { ...prev[id], saving: false,
        error: e instanceof Error ? e.message : String(e), ...(e instanceof FileConflict ? { conflict: e.disk } : {}) } }));
    }
  }, [updateDrafts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      for (const [id, draft] of Object.entries(draftsRef.current)) if (!draft.saving && !draft.error) void save(id);
    }, 900);
    return () => clearTimeout(timer);
  }, [drafts, save]);

  useEffect(() => {
    if (!Object.keys(drafts).length) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [drafts]);

  const notes = useMemo(() => {
    const result = files.notes.map((n) => drafts[n.id] ? { ...n, body: drafts[n.id].body } : n);
    for (const [id, draft] of Object.entries(drafts)) if (!result.some((n) => n.id === id)) result.push({ ...draft.note, body: draft.body });
    return result;
  }, [files.notes, drafts]);
  const folders = useMemo(() => [ROOT_FOLDER, ...files.folders], [files.folders]);
  const [folderId, setFolderId] = useState(initialFolder);
  const [selectedId, setSelectedId] = useState<string | null>(initialNote);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<NotesView>(initialView);
  const [creating, setCreating] = useState<'file' | 'folder' | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; in: RenamePlace } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  // The master list shows one sidebar location at a time: the one chosen, else the first there is.
  const roots = folders.filter((f) => f.parent === ROOT_FOLDER.id);
  const fallback = roots.find((f) => f.source === 'local' && f.path) ?? roots.find((f) => f.source === 'browser') ?? roots[0];
  const folder = folders.find((f) => f.id === folderId && f.id !== ROOT_FOLDER.id) ?? fallback ?? ROOT_FOLDER;
  const trail: Folder[] = [];
  let ancestor: Folder | undefined = folder;
  while (ancestor && ancestor.id !== ROOT_FOLDER.id) {
    trail.unshift(ancestor);
    const parent: string | undefined = ancestor.parent;
    ancestor = folders.find((f) => f.id === parent);
  }
  const rootFolder = trail[0] ?? null;
  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const count = (f: Folder) => notes.filter((n) => n.folder === f.id || !!f.path && n.file.path.startsWith(`${f.path}/`)).length;
  const within = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  const hasDrafts = (prefix: string) => Object.values(draftsRef.current).some((draft) => within(draft.note.file.path, prefix));

  function contents(f: Folder) {
    const q = query.trim().toLowerCase();
    const list = notes.filter((n) => q
      ? (n.folder === f.id || !!f.path && n.file.path.startsWith(`${f.path}/`)) && `${title(n)}\n${n.body}`.toLowerCase().includes(q)
      : n.folder === f.id).sort((a, b) => a.file.name.localeCompare(b.file.name));
    const children = folders.filter((child) => child.parent === f.id);
    return { list, children: q ? [] : children };
  }

  return {
    notes, folder, folders, roots, trail, rootFolder, selected, selectedId, query, view, count, files, drafts, creating, renaming, deleting,
    folderId: folder.id, sidebarId: rootFolder?.id ?? null,
    list: contents(folder).list, contents, setQuery, save, setView, setCreating, setRenaming, setDeleting,
    /** Starts a new note or folder inside `id` (the current folder by default). */
    isRenaming: (id: string, place: RenamePlace = 'list') => renaming?.id === id && renaming.in === place,
    startCreating(kind: 'file' | 'folder', id = folder.id) {
      if (id !== folder.id) { setFolderId(id); setQuery(''); }
      setRenaming(null); setCreating(kind);
    },
    fileStatus(n: Note) {
      const draft = drafts[n.id];
      if (!draft) return { label: 'Saved · watching for changes', conflict: false, missing: false };
      const disk = files.notes.find((item) => item.id === n.id);
      const conflict = draft.conflict !== undefined || (!draft.saving && (!disk || (disk.body !== draft.base && disk.body !== draft.body)));
      return { label: draft.saving ? 'Saving…' : conflict ? 'File changed outside Notes' : draft.error ?? 'Unsaved changes', conflict, missing: draft.conflict === null || !disk };
    },
    revert(id: string) {
      updateDrafts((prev) => { const next = { ...prev }; delete next[id]; return next; });
      if (!files.notes.some((n) => n.id === id)) setSelectedId(null);
    },
    openFolder(id: string) {
      setFolderId(id); setQuery(''); setCreating(null); setRenaming(null);
      const f = folders.find((item) => item.id === id);
      if (f?.connected === false) void files.run(() => files.reconnect(id));
    },
    /** Selecting a leaf never changes the folder path or pushes a NavigationStack screen. */
    select(id: string | null) { setSelectedId(id); if (id) files.markSeen(id); },
    async addFolder() {
      const id = await files.openFolder();
      if (id) { setFolderId(id); setQuery(''); }
      return id;
    },
    async openFiles() {
      const id = await files.openFiles();
      if (id) setSelectedId(id);
      return id;
    },
    /** Forgets an added folder. Its files stay on disk. */
    async removeFolder(id = rootFolder?.id) {
      const f = folders.find((item) => item.id === id);
      if (!f?.path) return;
      if (hasDrafts(f.path)) throw new Error('Save or discard your edits before removing this folder from Notes.');
      await files.removeFolder(f.path);
      if (selected && within(selected.file.path, f.path)) setSelectedId(null);
      if (within(folder.path ?? '', f.path)) setFolderId(ROOT_FOLDER.id);
    },
    /** Renames a note's file or a folder on disk, keeping it selected and open. */
    async rename(id: string, name: string) {
      const n = notes.find((item) => item.id === id);
      if (n) {
        if (draftsRef.current[id]) await save(id);
        if (draftsRef.current[id]) throw new Error('Save or discard your edits before renaming this note.');
        const next = await files.renameFile(n.file.path, name.trim());
        if (selectedId === id) setSelectedId(next);
        return;
      }
      const f = folders.find((item) => item.id === id);
      if (!f?.path) return;
      if (hasDrafts(f.path)) throw new Error('Save or discard your edits before renaming this folder.');
      const old = f.path;
      await files.renameFolder(old, name.trim());
      const moved = (path: string) => `${old.slice(0, old.lastIndexOf('/'))}/${name.trim()}${path.slice(old.length)}`;
      if (folder.path && within(folder.path, old)) setFolderId(fileFolderId(moved(folder.path)));
      if (selected && within(selected.file.path, old)) setSelectedId(fileId(moved(selected.file.path)));
    },
    /** Deletes a note's file, or a folder and everything in it, from disk. */
    async remove(id: string) {
      const n = notes.find((item) => item.id === id);
      if (n) {
        updateDrafts((prev) => { const next = { ...prev }; delete next[id]; return next; });
        if (n.file.standalone) files.close(n);
        else await files.deleteFile(n.file.path);
        if (selectedId === id) setSelectedId(null);
        return;
      }
      const f = folders.find((item) => item.id === id);
      if (!f?.path) return;
      if (hasDrafts(f.path)) throw new Error('Save or discard your edits before deleting this folder.');
      await files.deleteFolder(f.path);
      if (selected && within(selected.file.path, f.path)) setSelectedId(null);
      if (folder.path && within(folder.path, f.path)) setFolderId(f.parent ?? ROOT_FOLDER.id);
    },
    async duplicate(id: string) {
      const n = notes.find((item) => item.id === id);
      if (!n || n.file.standalone) return;
      if (draftsRef.current[id]) await save(id);
      setSelectedId(await files.duplicate(n.file.path));
    },
    edit(id: string, body: string) {
      const n = notes.find((item) => item.id === id);
      if (!n) return;
      updateDrafts((prev) => ({ ...prev, [id]: { ...prev[id], note: n, body, base: prev[id]?.base ?? n.body, error: undefined } }));
    },
    async create(name: string) {
      const path = folder.path ?? BROWSER_ROOT;
      const id = await files.create(path, name);
      setSelectedId(id); setQuery(''); setCreating(null);
      return id;
    },
    async createFolder(name: string) {
      const id = await files.createFolder(folder.path ?? BROWSER_ROOT, name);
      setFolderId(id); setQuery(''); setCreating(null);
    },
    browserFolderId: fileFolderId(BROWSER_ROOT),
  };
}

export type NotesState = ReturnType<typeof useNotes>;
