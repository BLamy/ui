import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROOT_FOLDER, title, type Folder, type Note } from './data';
import { BROWSER_ROOT, FileConflict, folderId as fileFolderId, useNoteFiles } from './use-note-files';

export type NotesView = 'list' | 'tree';
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
  const folder = folders.find((f) => f.id === folderId) ?? ROOT_FOLDER;
  const trail: Folder[] = [];
  let ancestor: Folder | undefined = folder;
  while (ancestor) {
    trail.unshift(ancestor);
    const parent: string | undefined = ancestor.parent;
    ancestor = folders.find((f) => f.id === parent);
  }
  const rootFolder = trail[1] ?? null;
  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const count = (f: Folder) => notes.filter((n) => n.folder === f.id || !!f.path && n.file.path.startsWith(`${f.path}/`)).length;

  function contents(f: Folder) {
    const q = query.trim().toLowerCase();
    const list = notes.filter((n) => q
      ? (f.id === ROOT_FOLDER.id || n.folder === f.id || !!f.path && n.file.path.startsWith(`${f.path}/`)) && `${title(n)}\n${n.body}`.toLowerCase().includes(q)
      : n.folder === f.id).sort((a, b) => a.file.name.localeCompare(b.file.name));
    const children = folders.filter((child) => child.parent === f.id && (f.id !== ROOT_FOLDER.id || child.source === 'local' || count(child) > 0));
    return { list, children: q ? [] : children };
  }

  return {
    notes, folder, folders, trail, rootFolder, selected, selectedId, query, view, count, files, drafts, creating,
    folderId: folder.id, sidebarId: rootFolder?.id ?? ROOT_FOLDER.id,
    list: contents(folder).list, contents, setQuery, save, setView, setCreating,
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
      setFolderId(id); setQuery(''); setCreating(null);
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
    async removeFolder() {
      if (!rootFolder?.path) return;
      const prefix = `${rootFolder.path}/`;
      if (Object.values(drafts).some((draft) => draft.note.file.path.startsWith(prefix))) throw new Error('Save or discard your edits before removing this folder from Notes.');
      await files.removeFolder(rootFolder.path);
      if (selected?.file.path.startsWith(prefix)) setSelectedId(null);
      setFolderId(ROOT_FOLDER.id);
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
