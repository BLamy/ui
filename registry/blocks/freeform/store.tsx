/* Freeform's state: the boards, which one is open, the selection, and per-board undo history. One reducer, so every
   edit is a pure function of the items; gestures `begin()` a checkpoint once and then `patch()` freely. */
import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { connectorGeometry } from './geometry';
import { isAttached, newId, type Background, type Board, type Item } from './model';

interface History { past: Item[][]; future: Item[][] }
interface State {
  boards: Board[];
  openId: string | null;
  selection: string[];
  hist: Record<string, History>;
  clipboard: Item[];
}

type Action =
  | { t: 'open'; id: string | null }
  | { t: 'add-board'; board: Board }
  | { t: 'board'; id: string; patch: Partial<Omit<Board, 'id' | 'items'>> }
  | { t: 'delete-board'; id: string }
  | { t: 'select'; ids: string[] }
  | { t: 'begin' }
  | { t: 'items'; fn: (items: Item[]) => Item[]; checkpoint: boolean; selection?: string[] }
  | { t: 'undo' }
  | { t: 'redo' }
  | { t: 'clipboard'; items: Item[] };

const HISTORY_LIMIT = 100;

function withItems(s: State, items: Item[], selection = s.selection): State {
  const boards = s.boards.map((b) => (b.id === s.openId ? { ...b, items, edited: 'Just now' } : b));
  const ids = new Set(items.map((i) => i.id));
  return { ...s, boards, selection: selection.filter((id) => ids.has(id)) };
}

function reduce(s: State, a: Action): State {
  const board = s.boards.find((b) => b.id === s.openId);
  switch (a.t) {
    case 'open': return { ...s, openId: a.id, selection: [] };
    case 'add-board': return { ...s, boards: [a.board, ...s.boards], openId: a.board.id, selection: [] };
    case 'board': return { ...s, boards: s.boards.map((b) => (b.id === a.id ? { ...b, ...a.patch } : b)) };
    case 'delete-board': {
      const hist = Object.fromEntries(Object.entries(s.hist).filter(([id]) => id !== a.id));
      return { ...s, boards: s.boards.filter((b) => b.id !== a.id), hist, openId: s.openId === a.id ? null : s.openId };
    }
    case 'select': return { ...s, selection: a.ids };
    case 'begin': {
      if (!board) return s;
      const h = s.hist[board.id] ?? { past: [], future: [] };
      return { ...s, hist: { ...s.hist, [board.id]: { past: [...h.past, board.items].slice(-HISTORY_LIMIT), future: [] } } };
    }
    case 'items': {
      if (!board) return s;
      let next = s;
      if (a.checkpoint) next = reduce(s, { t: 'begin' });
      const items = a.fn(board.items);
      if (items === board.items) return s;
      return withItems(next, items, a.selection ?? next.selection);
    }
    case 'undo': {
      const h = board && s.hist[board.id];
      if (!board || !h?.past.length) return s;
      const prev = h.past[h.past.length - 1];
      return withItems({ ...s, hist: { ...s.hist, [board.id]: { past: h.past.slice(0, -1), future: [board.items, ...h.future] } } }, prev);
    }
    case 'redo': {
      const h = board && s.hist[board.id];
      if (!board || !h?.future.length) return s;
      return withItems({ ...s, hist: { ...s.hist, [board.id]: { past: [...h.past, board.items], future: h.future.slice(1) } } }, h.future[0]);
    }
    case 'clipboard': return { ...s, clipboard: a.items };
  }
}

/** Copies of `items` with fresh ids, nudged by `offset`. Connectors keep their ends when both are in the copy (or free); otherwise they're left behind. */
export function cloneItems(items: Item[], offset = 24): Item[] {
  const ids = new Map<string, string>();
  const groups = new Map<string, string>();
  for (const i of items) ids.set(i.id, newId());
  const shift = (e: { x: number; y: number }) => ({ x: e.x + offset, y: e.y + offset });
  const out: Item[] = [];
  for (const i of items) {
    const group = i.group ? (groups.get(i.group) ?? groups.set(i.group, newId('g')).get(i.group)) : undefined;
    const base = { ...i, id: ids.get(i.id) as string, group };
    if (i.kind === 'connector') {
      const end = (e: typeof i.from) => (isAttached(e) ? (ids.has(e.id) ? { id: ids.get(e.id) as string, side: e.side } : null) : shift(e));
      const from = end(i.from), to = end(i.to);
      if (from && to) out.push({ ...(base as typeof i), from, to });
    } else if (i.kind === 'stroke') {
      out.push({ ...(base as typeof i), x: i.x + offset, y: i.y + offset, points: i.points.map(([x, y, p]) => [x + offset, y + offset, p]) });
    } else out.push({ ...base, x: i.x + offset, y: i.y + offset } as Item);
  }
  return out;
}

/** The ids of everything that moves with `ids`: their groups, in full. */
export function withGroups(items: Item[], ids: string[]): string[] {
  const groups = new Set(items.filter((i) => ids.includes(i.id) && i.group).map((i) => i.group));
  return groups.size ? items.filter((i) => ids.includes(i.id) || (i.group && groups.has(i.group))).map((i) => i.id) : ids;
}

export type Arrange = 'front' | 'back' | 'forward' | 'backward';

export interface FreeformApi {
  boards: Board[];
  openId: string | null;
  /** The open board. */
  board: Board | null;
  items: Item[];
  byId: Map<string, Item>;
  selection: string[];
  selected: Item[];
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  open: (id: string | null) => void;
  newBoard: () => string;
  renameBoard: (id: string, title: string) => void;
  toggleFavorite: (id: string) => void;
  deleteBoard: (id: string) => void;
  duplicateBoard: (id: string) => void;
  setBackground: (b: Background) => void;
  select: (ids: string[]) => void;
  selectAll: () => void;
  /** Checkpoint for undo: call once before a gesture's first change. */
  begin: () => void;
  /** Change items without a checkpoint (during a gesture). */
  patch: (fn: (items: Item[]) => Item[]) => void;
  /** Checkpoint, then change. */
  commit: (fn: (items: Item[]) => Item[], selection?: string[]) => void;
  add: (items: Item[]) => void;
  update: (ids: string[], patch: Record<string, unknown> | ((i: Item) => Partial<Item>)) => void;
  remove: (ids: string[]) => void;
  arrange: (ids: string[], how: Arrange) => void;
  group: (ids: string[]) => void;
  ungroup: (ids: string[]) => void;
  setLocked: (ids: string[], locked: boolean) => void;
  duplicate: (ids: string[]) => void;
  copy: (ids: string[]) => void;
  cut: (ids: string[]) => void;
  paste: () => void;
  undo: () => void;
  redo: () => void;
}

const Ctx = createContext<FreeformApi | null>(null);

export function useFreeform(): FreeformApi {
  const f = useContext(Ctx);
  if (!f) throw new Error('useFreeform must be used inside <FreeformProvider>');
  return f;
}

export function FreeformProvider({ boards, openId = null, children }: { boards: Board[]; openId?: string | null; children: ReactNode }) {
  const [s, dispatch] = useReducer(reduce, { boards, openId, selection: [], hist: {}, clipboard: [] });

  const api = useMemo<FreeformApi>(() => {
    const board = s.boards.find((b) => b.id === s.openId) ?? null;
    const items = board?.items ?? [];
    const byId = new Map(items.map((i) => [i.id, i]));
    const hist = board ? s.hist[board.id] : undefined;
    const run = (fn: (items: Item[]) => Item[], checkpoint: boolean, selection?: string[]) => dispatch({ t: 'items', fn, checkpoint, selection });
    const pick = (ids: string[]) => ids.filter((id) => byId.has(id) && !byId.get(id)?.locked);

    const duplicateOf = (src: Item[]) => {
      const copies = cloneItems(src);
      run((all) => [...all, ...copies], true, copies.map((c) => c.id));
    };

    return {
      boards: s.boards,
      openId: s.openId,
      board,
      items,
      byId,
      selection: s.selection,
      selected: items.filter((i) => s.selection.includes(i.id)),
      canUndo: !!hist?.past.length,
      canRedo: !!hist?.future.length,
      canPaste: s.clipboard.length > 0,
      open: (id) => dispatch({ t: 'open', id }),
      newBoard: () => {
        const id = newId('board');
        dispatch({ t: 'add-board', board: { id, title: 'Untitled', items: [], favorite: false, edited: 'Just now', background: 'dots' } });
        return id;
      },
      renameBoard: (id, title) => dispatch({ t: 'board', id, patch: { title: title.trim() || 'Untitled' } }),
      toggleFavorite: (id) => dispatch({ t: 'board', id, patch: { favorite: !s.boards.find((b) => b.id === id)?.favorite } }),
      deleteBoard: (id) => dispatch({ t: 'delete-board', id }),
      duplicateBoard: (id) => {
        const src = s.boards.find((b) => b.id === id);
        if (!src) return;
        dispatch({ t: 'add-board', board: { ...src, id: newId('board'), title: `${src.title} copy`, items: cloneItems(src.items, 0), favorite: false, edited: 'Just now' } });
        dispatch({ t: 'open', id: null });
      },
      setBackground: (background) => board && dispatch({ t: 'board', id: board.id, patch: { background } }),
      select: (ids) => dispatch({ t: 'select', ids: withGroups(items, ids) }),
      selectAll: () => dispatch({ t: 'select', ids: items.map((i) => i.id) }),
      begin: () => dispatch({ t: 'begin' }),
      patch: (fn) => run(fn, false),
      commit: (fn, selection) => run(fn, true, selection),
      add: (added) => run((all) => [...all, ...added], true, added.map((i) => i.id)),
      update: (ids, patch) => {
        const set = new Set(ids);
        run((all) => all.map((i) => (set.has(i.id) ? ({ ...i, ...(typeof patch === 'function' ? patch(i) : patch) } as Item) : i)), true);
      },
      remove: (ids) => {
        const gone = new Set(pick(ids));
        if (!gone.size) return;
        run((all) => {
          const map = new Map(all.map((i) => [i.id, i]));
          // A connector glued to a deleted item keeps its place: that end goes free where it was.
          const keep: Item[] = [];
          for (const i of all) {
            if (gone.has(i.id)) continue;
            if (i.kind === 'connector' && ((isAttached(i.from) && gone.has(i.from.id)) || (isAttached(i.to) && gone.has(i.to.id)))) {
              const g = connectorGeometry(i, map);
              keep.push({
                ...i,
                from: isAttached(i.from) && gone.has(i.from.id) ? { x: g.start.x, y: g.start.y } : i.from,
                to: isAttached(i.to) && gone.has(i.to.id) ? { x: g.end.x, y: g.end.y } : i.to,
              });
            } else keep.push(i);
          }
          return keep;
        }, true);
      },
      arrange: (ids, how) => {
        const set = new Set(ids);
        run((all) => {
          const moving = all.filter((i) => set.has(i.id));
          const rest = all.filter((i) => !set.has(i.id));
          if (!moving.length) return all;
          if (how === 'front') return [...rest, ...moving];
          if (how === 'back') return [...moving, ...rest];
          // One step: past the nearest neighbour that overlaps the selection's order.
          const out = [...all];
          const idx = out.map((i, n) => (set.has(i.id) ? n : -1)).filter((n) => n >= 0);
          if (how === 'forward') {
            for (const n of idx.reverse()) if (n < out.length - 1 && !set.has(out[n + 1].id)) [out[n], out[n + 1]] = [out[n + 1], out[n]];
          } else {
            for (const n of idx) if (n > 0 && !set.has(out[n - 1].id)) [out[n], out[n - 1]] = [out[n - 1], out[n]];
          }
          return out;
        }, true);
      },
      group: (ids) => {
        const g = newId('g');
        const set = new Set(ids);
        run((all) => all.map((i) => (set.has(i.id) ? { ...i, group: g } : i)), true);
      },
      ungroup: (ids) => {
        const set = new Set(ids);
        run((all) => all.map((i) => (set.has(i.id) && i.group ? { ...i, group: undefined } : i)), true);
      },
      setLocked: (ids, locked) => {
        const set = new Set(ids);
        run((all) => all.map((i) => (set.has(i.id) ? { ...i, locked: locked || undefined } : i)), true);
      },
      duplicate: (ids) => duplicateOf(items.filter((i) => ids.includes(i.id))),
      copy: (ids) => dispatch({ t: 'clipboard', items: items.filter((i) => ids.includes(i.id)) }),
      cut: (ids) => {
        dispatch({ t: 'clipboard', items: items.filter((i) => ids.includes(i.id) && !i.locked) });
        const gone = new Set(pick(ids));
        if (gone.size) run((all) => all.filter((i) => !gone.has(i.id)), true);
      },
      paste: () => { if (s.clipboard.length) duplicateOf(s.clipboard); },
      undo: () => dispatch({ t: 'undo' }),
      redo: () => dispatch({ t: 'redo' }),
    };
  }, [s]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

