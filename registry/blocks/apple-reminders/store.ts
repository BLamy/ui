/* Reminders state: the lists and reminders, completion (a just-toggled reminder stays on screen for a beat, then
   collapses away, as in Reminders), per-list "show completed", search and the open details sheet. */
import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { COLORS, LISTS, REMINDERS, type Reminder, type RList } from './data';

/** `hold`: just toggled, still shown in place. `leave`: collapsing out of a view it no longer belongs to. */
export type Recent = Record<string, 'hold' | 'leave'>;

export interface RemindersApi {
  items: Reminder[];
  lists: RList[];
  recent: Recent;
  toggle: (id: string) => void;
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
}

export const RemindersCtx = createContext<RemindersApi | null>(null);
export function useReminders() {
  const s = useContext(RemindersCtx);
  if (!s) throw new Error('useReminders must be used inside <AppleReminders>');
  return s;
}

const HOLD_MS = 1100;
const LEAVE_MS = 460;

export function useRemindersState(): RemindersApi {
  const [items, setItems] = useState<Reminder[]>(REMINDERS);
  const [lists, setLists] = useState<RList[]>(LISTS);
  const [recent, setRecent] = useState<Recent>({});
  const [showCompleted, setShown] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [details, openDetails] = useState<string | null>(null);
  const itemsRef = useRef(items); itemsRef.current = items;
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>[]>>({});
  const seq = useRef(0);

  return useMemo<RemindersApi>(() => {
    const drop = (id: string) => setRecent((r) => { const rest = { ...r }; delete rest[id]; return rest; });
    return {
      items, lists, recent, showCompleted, query, setQuery, details, openDetails,
      toggle(id) {
        const done = !itemsRef.current.find((x) => x.id === id)?.done;
        setItems((xs) => xs.map((x) => (x.id === id ? { ...x, done } : x)));
        (timers.current[id] ?? []).forEach(clearTimeout);
        setRecent((r) => ({ ...r, [id]: 'hold' }));
        timers.current[id] = [
          setTimeout(() => setRecent((r) => (r[id] ? { ...r, [id]: 'leave' } : r)), HOLD_MS),
          setTimeout(() => drop(id), HOLD_MS + LEAVE_MS),
        ];
      },
      toggleSubtask(id, sub) {
        setItems((xs) => xs.map((x) => (x.id === id ? { ...x, subtasks: x.subtasks?.map((s) => (s.id === sub ? { ...s, done: !s.done } : s)) } : x)));
      },
      add(r) {
        setItems((xs) => [...xs, { ...r, id: `new-${++seq.current}` }]);
      },
      update(id, patch) {
        setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      },
      remove(id) {
        setItems((xs) => xs.filter((x) => x.id !== id));
      },
      addList() {
        const id = `list-${++seq.current}`;
        setLists((ls) => [...ls, { id, name: 'New List', color: COLORS[ls.length % COLORS.length], glyph: 'list' }]);
        return id;
      },
      clearCompleted(list) {
        setItems((xs) => xs.filter((x) => !(x.done && x.list === list)));
      },
      setShowCompleted(list, v) {
        setShown((s) => ({ ...s, [list]: v }));
      },
    };
  }, [items, lists, recent, showCompleted, query, details]);
}
