/* The Markdown files Reminders reads task lists from: this browser's private store (OPFS) and folders you add from
   your computer. Both are shared with the Apple Notes block — the same OPFS store and the same remembered folders —
   so a checklist written in Notes is a list here. use-fs watches them (polling), so edits elsewhere show up. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { commonFilters, ensurePermission, getDirectoryPicker, isAbortError, useFs, type FilterFn } from 'use-fs';
import { forgetFolder, loadFolders, rememberFolder, type SavedFolder } from './folder-storage';

/** The OPFS store and root path Apple Notes uses for "In This Browser". */
export const BROWSER_ROOT = 'browser-notes';
const OPFS_NAME = 'apple-notes';

export interface TaskRoot { path: string; name: string; source: 'browser' | 'local'; connected: boolean }

type PermissionHandle = FileSystemDirectoryHandle & { queryPermission?: (options: { mode: 'readwrite' }) => Promise<PermissionState> };
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const markdownOnly: FilterFn = () => ({ shouldIncludeFile: ({ name }) => /\.mdx?$/i.test(name), shouldProcessDirectory: () => true });

export function useTaskFiles() {
  const fs = useFs({ filters: [...commonFilters, markdownOnly], mode: 'readwrite', pollInterval: 800, debounceInterval: 0 });
  const { addOpfsDirectory, addDirectory, isOpfsSupported } = fs;
  const [sources, setSources] = useState<(SavedFolder & { connected: boolean })[]>([]);
  const [browserReady, setBrowserReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounting = useRef<Promise<string> | null>(null);

  useEffect(() => {
    if (!isOpfsSupported) return;
    let active = true;
    mounting.current ??= addOpfsDirectory({ name: OPFS_NAME, path: BROWSER_ROOT });
    void mounting.current.then(() => { if (active) setBrowserReady(true); }, (e) => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, [isOpfsSupported, addOpfsDirectory]);

  // Folders remembered by either app reconnect without asking when the browser still grants access.
  useEffect(() => {
    let active = true;
    void loadFolders().then(async (saved) => {
      if (!active) return;
      setSources(saved.map((s) => ({ ...s, connected: false })));
      for (const source of saved) {
        const handle = source.handle as PermissionHandle;
        const granted = !handle.queryPermission || (await handle.queryPermission({ mode: 'readwrite' })) === 'granted';
        if (!active || !granted) continue;
        await addDirectory(handle, { path: source.path });
        if (active) setSources((prev) => prev.map((s) => (s.path === source.path ? { ...s, connected: true } : s)));
      }
    }).catch((e) => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, [addDirectory]);

  const roots = useMemo<TaskRoot[]>(() => [
    ...sources.map((s) => ({ path: s.path, name: s.name, source: 'local' as const, connected: s.connected })),
    ...(browserReady ? [{ path: BROWSER_ROOT, name: 'In This Browser', source: 'browser' as const, connected: true }] : []),
  ], [sources, browserReady]);

  async function run<T>(action: () => Promise<T>) {
    setError(null);
    try { return await action(); } catch (e) { if (!isAbortError(e)) setError(message(e)); return undefined; }
  }

  return {
    files: fs.files, roots, error: error ?? fs.error?.message ?? null,
    canAddFolder: fs.isBrowserSupported,
    run,
    write: (path: string, body: string) => fs.writeFile(path, body, { create: false }),
    addFolder: () => run(async () => {
      const picker = getDirectoryPicker();
      if (!picker) throw new Error('Adding folders from your computer requires Chrome or Edge.');
      const handle = await picker({ mode: 'readwrite' });
      if (!(await ensurePermission(handle, 'readwrite'))) throw new Error('Write access was not granted.');
      const path = await fs.addDirectory(handle);
      setSources((prev) => [...prev.filter((s) => s.path !== path), { path, name: path, handle, connected: true }]);
      try { await rememberFolder({ path, name: path, handle }); } catch { setError('The folder is open, but this browser could not remember it for next time.'); }
      return path;
    }),
    reconnect: (path: string) => run(async () => {
      const source = sources.find((s) => s.path === path);
      if (!source) return;
      if (!(await ensurePermission(source.handle, 'readwrite'))) throw new Error('Folder access was not granted.');
      await fs.addDirectory(source.handle, { path });
      setSources((prev) => prev.map((s) => (s.path === path ? { ...s, connected: true } : s)));
    }),
    /** Stops showing a folder (in Notes too). Its files stay on disk. */
    removeFolder: (path: string) => run(async () => {
      await forgetFolder(path);
      fs.removeDirectory(path);
      setSources((prev) => prev.filter((s) => s.path !== path));
    }),
  };
}

export type TaskFiles = ReturnType<typeof useTaskFiles>;
