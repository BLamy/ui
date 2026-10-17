/* Reminders state: the lists and reminders, completion (a just-toggled reminder stays on screen for a beat, then
   collapses away, as in Reminders), per-list "show completed", search and the open details sheet. The sample lists
   live in memory; lists read from Markdown files write every change back to the file (see markdown-tasks.ts). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { COLORS, LISTS, REMINDERS, type Reminder, type RList, type TaskSource } from './data';
import { fileLists } from './file-lists';
import { addTask, isDone, removeTask, setTaskState, setTaskTitle, type TaskState } from './markdown-tasks';
import { useTaskFiles, type TaskRoot } from './use-task-files';

/** `hold`: just toggled, still shown in place. `leave`: collapsing out of a view it no longer belongs to. */
export type Recent = Record<string, 'hold' | 'leave'>;

export interface RemindersApi {
  items: Reminder[];
  lists: RList[];
  recent: Recent;
  toggle: (id: string) => void;
  /** Any of docstream's task states (right-click a checkbox). Works for subtasks too. */
  setState: (id: string, state: TaskState) => void;
  toggleSubtask: (id: string, sub: string) => void;
  add: (r: Omit<Reminder, 'id'>) => void;
  update: (id: string, patch: Partial<Reminder>) => void;
  remove: (id: string) => void;
  addList: () => string;
  /** Delete the completed reminders of a list. */
  clearCompleted: (list: string) => void;
  showCompleted: Record<string, boolean>;
  setShowCompleted: (list: string, v: boolean) => void;
  query: string;
  setQuery: (q: string) => void;
  details: string | null;
  openDetails: (id: string | null) => void;
  /** Where Markdown task lists come from: this browser and the folders you added (shared with Apple Notes). */
  roots: TaskRoot[];
  addFolder: () => void;
  reconnect: (path: string) => void;
  removeFolder: (path: string) => void;
  canAddFolder: boolean;
  error: string | null;
}

export const RemindersCtx = createContext<RemindersApi | null>(null);
export function useReminders() {
  const s = useContext(RemindersCtx);
  if (!s) throw new Error('useReminders must be used inside <AppleReminders>');
  return s;
}

const HOLD_MS = 1100;
const LEAVE_MS = 460;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useRemindersState(): RemindersApi {
  const disk = useTaskFiles();
  const [local, setItems] = useState<Reminder[]>(REMINDERS);
  const [localLists, setLists] = useState<RList[]>(LISTS);
  const [recent, setRecent] = useState<Recent>({});
  const [showCompleted, setShown] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [details, openDetails] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>[]>>({});
  const seq = useRef(0);

  // A write shows at once: the new text stands in for the file until the watcher reads it back.
  const [pending, setPending] = useState<Record<string, string>>({});
  const pendingRef = useRef(pending); pendingRef.current = pending;
  const files = useMemo(() => {
    const merged = new Map(disk.files);
    for (const [path, body] of Object.entries(pending)) merged.set(path, body);
    return merged;
  }, [disk.files, pending]);
  const filesRef = useRef(files); filesRef.current = files;
  useEffect(() => {
    const settled = Object.keys(pending).filter((path) => disk.files.get(path) === pending[path]);
    if (settled.length) setPending((p) => { const next = { ...p }; for (const path of settled) delete next[path]; return next; });
  }, [disk.files, pending]);

  const writeRef = useRef(disk.write); writeRef.current = disk.write;
  /** Rewrites one file from its latest text (pending edits included), so quick edits in a row build on each other. */
  const edit = useCallback((path: string, change: (body: string) => string) => {
    const body = filesRef.current.get(path);
    if (body === undefined) return;
    let next: string;
    try { next = change(body); } catch (e) { setWriteError(message(e)); return; }
    setWriteError(null);
    setPending((p) => ({ ...p, [path]: next }));
    pendingRef.current = { ...pendingRef.current, [path]: next };
    writeRef.current(path, next).catch((e: unknown) => {
      setWriteError(message(e));
      setPending((p) => { const rest = { ...p }; delete rest[path]; return rest; });
    });
  }, []);

  const fromFiles = useMemo(() => fileLists(files, disk.roots), [files, disk.roots]);
  const items = useMemo(() => [...local, ...fromFiles.items], [local, fromFiles.items]);
  const lists = useMemo(() => [...localLists, ...fromFiles.lists], [localLists, fromFiles.lists]);
  const itemsRef = useRef(items); itemsRef.current = items;

  return useMemo<RemindersApi>(() => {
    const drop = (id: string) => setRecent((r) => { const rest = { ...r }; delete rest[id]; return rest; });
    const hold = (id: string) => {
      (timers.current[id] ?? []).forEach(clearTimeout);
      setRecent((r) => ({ ...r, [id]: 'hold' }));
      timers.current[id] = [
        setTimeout(() => setRecent((r) => (r[id] ? { ...r, [id]: 'leave' } : r)), HOLD_MS),
        setTimeout(() => drop(id), HOLD_MS + LEAVE_MS),
      ];
    };
    const find = (id: string) => itemsRef.current.find((x) => x.id === id);
    /** A reminder or one of its subtasks, by id. */
    const findTask = (id: string): { source?: TaskSource; parent?: Reminder; sub?: string } | null => {
      const r = find(id);
      if (r) return { source: r.source };
      for (const x of itemsRef.current) {
        const s = x.subtasks?.find((t) => t.id === id);
        if (s) return { source: s.source, parent: x, sub: s.id };
      }
      return null;
    };
    const setState = (id: string, state: TaskState) => {
      const task = findTask(id);
      if (!task) return;
      if (task.source) { const src = task.source; edit(src.path, (body) => setTaskState(body, src, state)); }
      else if (task.parent) setItems((xs) => xs.map((x) => (x.id === task.parent!.id ? { ...x, subtasks: x.subtasks?.map((s) => (s.id === task.sub ? { ...s, state, done: isDone(state) } : s)) } : x)));
      else setItems((xs) => xs.map((x) => (x.id === id ? { ...x, state, done: isDone(state) } : x)));
      // Leaving a view (Today → done) waits a beat, as a click does; subtasks stay where they are.
      if (!task.parent && find(id) && isDone(state) !== !!find(id)!.done) hold(id);
    };
    return {
      items, lists, recent, showCompleted, query, setQuery, details, openDetails, setState,
      roots: disk.roots, canAddFolder: disk.canAddFolder, error: writeError ?? disk.error,
      addFolder: () => { void disk.addFolder(); },
      reconnect: (path) => { void disk.reconnect(path); },
      removeFolder: (path) => { void disk.removeFolder(path); },
      toggle(id) {
        const r = find(id);
        if (r) setState(id, r.done ? 'pending' : 'verified');
      },
      toggleSubtask(id, sub) {
        const s = find(id)?.subtasks?.find((t) => t.id === sub);
        if (s) setState(sub, s.done ? 'pending' : 'verified');
      },
      add(r) {
        const list = lists.find((l) => l.id === r.list);
        if (list?.file) { edit(list.file.path, (body) => addTask(body, r.title, r.section)); return; }
        setItems((xs) => [...xs, { ...r, id: `new-${++seq.current}` }]);
      },
      update(id, patch) {
        const r = find(id);
        if (r?.source) {
          // A file holds the title and state; the rest of the details are the sample lists'.
          const src = r.source;
          if (patch.title !== undefined && patch.title.trim() && patch.title !== r.title) edit(src.path, (body) => setTaskTitle(body, src, patch.title!.trim()));
          if (patch.state) setState(id, patch.state);
          return;
        }
        setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch, ...(patch.state ? { done: isDone(patch.state) } : {}) } : x)));
      },
      remove(id) {
        const r = find(id);
        if (r?.source) { const src = r.source; edit(src.path, (body) => removeTask(body, src)); return; }
        setItems((xs) => xs.filter((x) => x.id !== id));
      },
      addList() {
        const id = `list-${++seq.current}`;
        setLists((ls) => [...ls, { id, name: 'New List', color: COLORS[ls.length % COLORS.length]!, glyph: 'list' }]);
        return id;
      },
      clearCompleted(list) {
        // A file's completed tasks stay in the file; Hide Completed covers them.
        if (lists.find((l) => l.id === list)?.file) return;
        setItems((xs) => xs.filter((x) => !(x.done && x.list === list)));
      },
      setShowCompleted(list, v) {
        setShown((s) => ({ ...s, [list]: v }));
      },
    };
  }, [items, lists, recent, showCompleted, query, details, disk, writeError, edit]);
}
