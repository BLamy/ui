/* What a list shows: its title, color and reminders grouped the way Reminders groups them — a list by its
   sections, Today into Overdue / Today, Scheduled by day, All / Flagged / Completed / search by list. */
import { SMART, dayHeading, isSmart, type Reminder, type RList, type Smart } from './data';
import type { Recent } from './store';

export interface Group { key: string; title?: string; color?: string; section?: string; items: Reminder[] }
export interface View {
  id: string; title: string; color: string; list?: RList; smart?: Smart; groups: Group[];
  /** Incomplete reminders in the view. */
  open: number;
  /** Completed reminders a user list is hiding (or showing). */
  completed: number;
  /** Rows on screen only because they were just toggled — they collapse away. */
  leaving: (r: Reminder) => boolean;
}

export function buildView(id: string, items: Reminder[], lists: RList[], recent: Recent, shown: Record<string, boolean>, query: string): View {
  const listOf = (lid: string) => lists.find((l) => l.id === lid);
  const byList = (xs: Reminder[]): Group[] => lists
    .map((l) => ({ key: l.id, title: l.name, color: l.color, items: xs.filter((x) => x.list === l.id) }))
    .filter((g) => g.items.length);

  if (id === 'search') {
    const q = query.trim().toLowerCase();
    const hits = items.filter((x) => (x.title + ' ' + (x.notes ?? '')).toLowerCase().includes(q));
    return { id, title: 'Results', color: '#8E8E93', groups: byList(hits), open: hits.filter((x) => !x.done).length, completed: 0, leaving: () => false };
  }

  const smart = isSmart(id) ? SMART.find((s) => s.id === id) : undefined;
  const list = smart ? undefined : listOf(id) ?? lists[0];
  const base = smart ? smart.match : (x: Reminder) => x.list === list!.id && (!x.done || !!shown[list!.id]);
  const visible = items.filter((x) => base(x) || recent[x.id]);
  const leaving = (x: Reminder) => recent[x.id] === 'leave' && !base(x);

  let groups: Group[];
  if (list) {
    const secs = list.sections ?? [];
    const loose = visible.filter((x) => !x.section || !secs.includes(x.section));
    groups = [
      ...(loose.length || !secs.length ? [{ key: '_', items: loose }] : []),
      ...secs.map((s) => ({ key: s, title: s, section: s, items: visible.filter((x) => x.section === s) })),
    ];
  } else if (id === 'today') {
    groups = [
      { key: 'overdue', title: 'Overdue', items: visible.filter((x) => (x.due ?? 0) < 0) },
      { key: 'today', title: 'Today', items: visible.filter((x) => (x.due ?? 0) >= 0) },
    ].filter((g) => g.items.length);
  } else if (id === 'scheduled') {
    const days = [...new Set(visible.map((x) => Math.max(-1, x.due ?? 0)))].sort((a, b) => a - b);
    groups = days.map((d) => ({ key: 'd' + d, title: dayHeading(d), items: visible.filter((x) => Math.max(-1, x.due ?? 0) === d).sort((a, b) => (a.due ?? 0) - (b.due ?? 0)) }));
  } else {
    groups = byList(visible);
  }

  const scope = list ? items.filter((x) => x.list === list.id) : items;
  return {
    id, title: smart?.name ?? list!.name, color: smart?.color ?? list!.color, list, smart, groups, leaving,
    open: smart ? items.filter(smart.match).length : scope.filter((x) => !x.done).length,
    completed: list ? scope.filter((x) => x.done).length : 0,
  };
}

/** Counts for the sidebar. */
export const countFor = (id: string, items: Reminder[]) => {
  const s = SMART.find((x) => x.id === id);
  return s ? items.filter(s.match).length : items.filter((x) => x.list === id && !x.done).length;
};
