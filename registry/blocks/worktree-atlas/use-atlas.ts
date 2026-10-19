/* Everything the three columns share: the projects a source reported, which project and worktree are open, the
   list's search and edit mode, diffs as they load, and the worktrees waiting on the delete confirmation. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Location, Project, RemoveResult, ScanProgress, Worktree, WorktreeDiff, WorktreeSource } from './types';

/** The sidebar's "All Worktrees" item. */
export const ALL = 'all';

export type DiffState = { status: 'loading' } | { status: 'ready'; diff: WorktreeDiff } | { status: 'error'; error: string };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useAtlas(source: WorktreeSource, initial: { project?: string; worktree?: string | null } = {}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [scanned, setScanned] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(initial.project ?? ALL);
  const [worktreeId, setWorktreeId] = useState<string | null>(initial.worktree ?? null);
  const [query, setQuery] = useState('');
  const [editing, setEditingState] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [diffs, setDiffs] = useState<Map<string, DiffState>>(new Map());
  const [pendingDelete, setPendingDelete] = useState<Worktree[] | null>(null);
  const [locations, setLocations] = useState<Location[]>(() => source.locations?.() ?? []);
  const run = useRef(0);

  const scan = useCallback(async () => {
    const id = ++run.current;
    setProgress({ at: '', found: 0 });
    setError(null);
    try {
      const next = await source.scan((p) => { if (run.current === id) setProgress(p); });
      if (run.current !== id) return;
      setProjects(next);
      setDiffs(new Map());
      setScanned(true);
    } catch (e) {
      if (run.current === id) setError(message(e));
    } finally {
      if (run.current === id) setProgress(null);
      setLocations(source.locations?.() ?? []);
    }
  }, [source]);

  useEffect(() => { void scan(); }, [scan]);

  const all = useMemo(() => projects.flatMap((p) => p.worktrees), [projects]);
  const project = projects.find((p) => p.id === projectId) ?? null;
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = projectId === ALL ? all : project?.worktrees ?? [];
    return q ? rows.filter((w) => [w.name, w.branch ?? '', w.path].some((s) => s.toLowerCase().includes(q))) : rows;
  }, [all, project, projectId, query]);
  const selected = all.find((w) => w.id === worktreeId) ?? null;

  // Load the open worktree's diff once; a rescan clears the cache.
  const loading = useRef(new Map<string, AbortController>());
  useEffect(() => {
    if (!selected || diffs.has(selected.id) || selected.unreachable) return;
    const wt = selected;
    const controller = new AbortController();
    loading.current.set(wt.id, controller);
    setDiffs((d) => new Map(d).set(wt.id, { status: 'loading' }));
    source.diff(wt, controller.signal)
      .then((diff) => setDiffs((d) => new Map(d).set(wt.id, { status: 'ready', diff })))
      .catch((e) => { if (!controller.signal.aborted) setDiffs((d) => new Map(d).set(wt.id, { status: 'error', error: message(e) })); })
      .finally(() => loading.current.delete(wt.id));
  }, [selected, diffs, source]);
  useEffect(() => () => { for (const c of loading.current.values()) c.abort(); }, []);

  const refreshDiff = (id: string) => setDiffs((d) => { const next = new Map(d); next.delete(id); return next; });

  const setEditing = (on: boolean) => { setEditingState(on); if (!on) setChecked(new Set()); };
  const deletable = (w: Worktree) => !w.primary;
  const toggleChecked = (id: string) => setChecked((c) => { const next = new Set(c); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const candidates = list.filter(deletable);
  const checkAll = () => setChecked((c) => (c.size === candidates.length ? new Set() : new Set(candidates.map((w) => w.id))));

  const openProject = (id: string) => { setProjectId(id); setQuery(''); setChecked(new Set()); };

  /** Deleted worktrees leave the list; when the open one goes, the selection clears. */
  const applyRemoved = (results: RemoveResult[]) => {
    const gone = new Set(results.filter((r) => r.ok).map((r) => r.id));
    if (!gone.size) return;
    setProjects((ps) => ps.map((p) => ({ ...p, worktrees: p.worktrees.filter((w) => !gone.has(w.id)) })));
    setChecked((c) => new Set([...c].filter((id) => !gone.has(id))));
    if (worktreeId && gone.has(worktreeId)) setWorktreeId(null);
  };

  return {
    source, projects, scanned, scanning: progress !== null, progress, error, scan, locations,
    projectId, project, openProject, list, all,
    worktreeId, selected, open: setWorktreeId,
    query, setQuery,
    editing, setEditing, checked, toggleChecked, checkAll, candidates, deletable,
    diffs, refreshDiff,
    pendingDelete, requestDelete: (ws: Worktree[]) => setPendingDelete(ws.filter(deletable)), cancelDelete: () => setPendingDelete(null),
    applyRemoved,
    async addLocation() { if (await source.addLocation?.()) await scan(); },
    async reconnect(id: string) { if (await source.reconnect?.(id)) await scan(); },
    async removeLocation(id: string) { await source.removeLocation?.(id); await scan(); },
  };
}

export type AtlasState = ReturnType<typeof useAtlas>;
