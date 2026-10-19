/* Everything the three columns share: the projects a source reported, which worktree and file are open, whether the
   rail shows Files or Changes, file lists, contents and diffs as they load, and the worktrees waiting on the delete
   confirmation. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FileContent, FileEntry, Location, Project, RemoveResult, ScanProgress, Worktree, WorktreeDiff, WorktreeSource } from './types';

/** The rail: browse the checkout, or see what it changes against main. */
export type AtlasView = 'files' | 'changes';

export type Load<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; error: string };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Loads `key` once and keeps it until `clear` (a rescan) or `refresh`. Results from before a clear are dropped. */
function useCache<T>(key: string | null, load: (key: string, signal: AbortSignal) => Promise<T>) {
  const [cache, setCache] = useState(() => new Map<string, Load<T>>());
  const generation = useRef(0);
  const inflight = useRef(new Set<AbortController>());
  useEffect(() => {
    if (key == null || cache.has(key)) return;
    const gen = generation.current;
    const controller = new AbortController();
    inflight.current.add(controller);
    const put = (v: Load<T>) => { if (generation.current === gen) setCache((c) => new Map(c).set(key, v)); };
    put({ status: 'loading' });
    load(key, controller.signal)
      .then((value) => put({ status: 'ready', value }))
      .catch((e) => { if (!controller.signal.aborted) put({ status: 'error', error: message(e) }); })
      .finally(() => inflight.current.delete(controller));
  }, [key, cache, load]);
  useEffect(() => () => { for (const c of inflight.current) c.abort(); }, []);
  const clear = useCallback(() => { generation.current++; setCache(new Map()); }, []);
  const refresh = useCallback((k: string) => setCache((c) => { const next = new Map(c); next.delete(k); return next; }), []);
  return { get: (k: string | null) => (k == null ? undefined : cache.get(k)), clear, refresh };
}

export function useAtlas(source: WorktreeSource, initial: { worktree?: string | null; view?: AtlasView } = {}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [scanned, setScanned] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [worktreeId, setWorktreeId] = useState<string | null>(initial.worktree ?? null);
  const [view, setView] = useState<AtlasView>(initial.view ?? 'changes');
  /** The file open in the detail (Files), or the one the diff scrolled to (Changes). */
  const [filePath, setFilePath] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Worktree[] | null>(null);
  const [locations, setLocations] = useState<Location[]>(() => source.locations?.() ?? []);
  const run = useRef(0);

  const all = useMemo(() => projects.flatMap((p) => p.worktrees), [projects]);
  const selected = all.find((w) => w.id === worktreeId) ?? null;
  const project = projects.find((p) => p.id === selected?.projectId) ?? null;
  const byId = useRef(new Map<string, Worktree>());
  byId.current = new Map(all.map((w) => [w.id, w]));
  const worktree = useCallback((id: string) => {
    const w = byId.current.get(id);
    if (!w) throw new Error('Scan again: this worktree is no longer known.');
    return w;
  }, []);

  const readable = selected && !selected.unreachable ? selected.id : null;
  const diffs = useCache<WorktreeDiff>(view === 'changes' ? readable : null,
    useCallback((id, signal) => source.diff(worktree(id), signal), [source, worktree]));
  const fileLists = useCache<FileEntry[]>(view === 'files' ? readable : null,
    useCallback((id, signal) => source.files(worktree(id), signal), [source, worktree]));
  const fileKey = view === 'files' && readable && filePath ? `${readable}\n${filePath}` : null;
  const contents = useCache<FileContent>(fileKey,
    useCallback((key) => { const [id, path] = key.split('\n'); return source.read(worktree(id), path); }, [source, worktree]));

  const { clear: clearDiffs } = diffs, { clear: clearFiles } = fileLists, { clear: clearContents } = contents;
  const scan = useCallback(async () => {
    const id = ++run.current;
    setProgress({ at: '', found: 0 });
    setError(null);
    try {
      const next = await source.scan((p) => { if (run.current === id) setProgress(p); });
      if (run.current !== id) return;
      setProjects(next);
      clearDiffs(); clearFiles(); clearContents();
      setScanned(true);
    } catch (e) {
      if (run.current === id) setError(message(e));
    } finally {
      if (run.current === id) setProgress(null);
      setLocations(source.locations?.() ?? []);
    }
  }, [source, clearDiffs, clearFiles, clearContents]);

  useEffect(() => { void scan(); }, [scan]);

  /** Reload whatever the open view shows. */
  const reload = () => {
    if (!selected) return;
    if (view === 'changes') diffs.refresh(selected.id);
    else { fileLists.refresh(selected.id); if (fileKey) contents.refresh(fileKey); }
  };

  const open = (id: string | null) => { if (id !== worktreeId) { setWorktreeId(id); setFilePath(null); } };
  const showView = (v: AtlasView) => { if (v !== view) { setView(v); setFilePath(null); } };

  const deletable = (w: Worktree) => !w.primary;

  /** Deleted worktrees leave the sidebar; when the open one goes, the selection clears. */
  const applyRemoved = (results: RemoveResult[]) => {
    const gone = new Set(results.filter((r) => r.ok).map((r) => r.id));
    if (!gone.size) return;
    setProjects((ps) => ps.map((p) => ({ ...p, worktrees: p.worktrees.filter((w) => !gone.has(w.id)) })));
    if (worktreeId && gone.has(worktreeId)) open(null);
  };

  return {
    source, projects, scanned, scanning: progress !== null, progress, error, scan, locations,
    all, worktreeId, selected, project, open,
    view, showView, filePath, openFile: setFilePath,
    diff: diffs.get(view === 'changes' ? readable : null),
    files: fileLists.get(view === 'files' ? readable : null),
    content: contents.get(fileKey),
    reload,
    deletable,
    pendingDelete, requestDelete: (ws: Worktree[]) => setPendingDelete(ws.filter(deletable)), cancelDelete: () => setPendingDelete(null),
    applyRemoved,
    async addLocation() { if (await source.addLocation?.()) await scan(); },
    async reconnect(id: string) { if (await source.reconnect?.(id)) await scan(); },
    async removeLocation(id: string) { await source.removeLocation?.(id); await scan(); },
  };
}

export type AtlasState = ReturnType<typeof useAtlas>;
