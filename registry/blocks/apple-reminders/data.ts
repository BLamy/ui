/* Reminders data: lists (name, color, icon, sections), reminders (due day as an offset from "today", time, notes,
   flag, priority, subtasks) and the smart lists that filter them. "Today" is pinned so the data never goes stale. */
import type { IconName } from '@brett_lamy/ui';

export const TODAY = new Date(2026, 8, 28); // Monday, September 28, 2026

export interface Subtask { id: string; title: string; done?: boolean }
export interface Reminder {
  id: string;
  list: string;
  title: string;
  notes?: string;
  /** Days from today (negative: overdue). */
  due?: number;
  time?: string;
  flagged?: boolean;
  /** 0 none · 1 low (!) · 2 medium (!!) · 3 high (!!!) */
  priority?: 0 | 1 | 2 | 3;
  done?: boolean;
  section?: string;
  url?: string;
  tags?: string[];
  subtasks?: Subtask[];
}
export interface RList { id: string; name: string; color: string; glyph: IconName; sections?: string[] }

export const COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#32ADE6', '#007AFF', '#5856D6', '#FF2D55', '#AF52DE', '#A2845E'];

export const LISTS: RList[] = [
  { id: 'reminders', name: 'Reminders', color: '#007AFF', glyph: 'list' },
  { id: 'family', name: 'Family', color: '#FF9500', glyph: 'house-fill' },
  { id: 'work', name: 'Work', color: '#AF52DE', glyph: 'briefcase-fill', sections: ['This Week', 'Launch', 'Someday'] },
  { id: 'groceries', name: 'Groceries', color: '#34C759', glyph: 'cart', sections: ['Produce', 'Dairy & Eggs', 'Bakery', 'Pantry'] },
  { id: 'lisbon', name: 'Lisbon Trip', color: '#32ADE6', glyph: 'airplane', sections: ['Before We Go', 'Packing'] },
  { id: 'reading', name: 'Reading List', color: '#A2845E', glyph: 'book' },
];

let n = 0;
const r = (list: string, title: string, extra: Omit<Partial<Reminder>, 'id' | 'list' | 'title'> = {}): Reminder => ({ id: `r${++n}`, list, title, ...extra });
const subs = (...titles: (string | [string, true])[]): Subtask[] =>
  titles.map((t, i) => (Array.isArray(t) ? { id: `s${n}-${i}`, title: t[0], done: true } : { id: `s${n}-${i}`, title: t }));

export const REMINDERS: Reminder[] = [
  r('reminders', 'Renew passport', { due: -2, notes: 'Photos are in the desk drawer. Form DS-82.', flagged: true, priority: 3, url: 'travel.state.gov' }),
  r('reminders', 'Call Dr. Patel’s office', { due: 0, time: '9:30 AM', notes: 'Reschedule the annual checkup to October.' }),
  r('reminders', 'Pay water bill', { due: 0, time: '5:00 PM', priority: 2 }),
  r('reminders', 'Return library books', { due: 2, tags: ['errands'] }),
  r('reminders', 'Back up the MacBook', { due: 5, time: '8:00 PM' }),
  r('reminders', 'Order new contact lenses', { done: true }),
  r('reminders', 'Cancel the old gym membership', { done: true }),

  r('family', 'Pick up Maya from soccer', { due: 0, time: '4:30 PM', flagged: true }),
  r('family', 'Book pumpkin patch tickets', { due: 3, notes: 'Saturday morning, 4 tickets, before they sell out.', subtasks: subs(['Check weather', true], 'Pick a time slot', 'Buy tickets') }),
  r('family', 'Mom’s birthday gift', { due: 11, priority: 2, notes: 'She mentioned the ceramics class at the community studio.', tags: ['gifts'] }),
  r('family', 'Schedule HVAC service', { due: 7 }),
  r('family', 'Sign permission slip for field trip', { done: true }),

  r('work', 'Review Q4 roadmap draft', { section: 'This Week', due: 0, time: '11:00 AM', flagged: true, priority: 2, notes: 'Leave comments on the pricing section before the sync.' }),
  r('work', 'Send invoice to Northwind', { section: 'This Week', due: -1, priority: 3 }),
  r('work', '1:1 notes for Priya', { section: 'This Week', due: 1, time: '10:00 AM' }),
  r('work', 'Write launch announcement', { section: 'Launch', due: 4, subtasks: subs(['Outline', true], 'First draft', 'Legal review', 'Schedule post') }),
  r('work', 'Record the demo video', { section: 'Launch', due: 6, flagged: true }),
  r('work', 'Update press kit screenshots', { section: 'Launch' }),
  r('work', 'Learn the new design tokens', { section: 'Someday', url: 'blamy.github.io/ui' }),
  r('work', 'Clean up the shared drive', { section: 'Someday' }),
  r('work', 'Book the offsite venue', { section: 'This Week', done: true }),

  r('groceries', 'Avocados', { section: 'Produce', notes: '4, ripe for Wednesday' }),
  r('groceries', 'Lemons', { section: 'Produce' }),
  r('groceries', 'Baby spinach', { section: 'Produce' }),
  r('groceries', 'Honeycrisp apples', { section: 'Produce', done: true }),
  r('groceries', 'Oat milk', { section: 'Dairy & Eggs' }),
  r('groceries', 'Greek yogurt', { section: 'Dairy & Eggs' }),
  r('groceries', 'Eggs (dozen)', { section: 'Dairy & Eggs', done: true }),
  r('groceries', 'Sourdough loaf', { section: 'Bakery' }),
  r('groceries', 'Coffee beans', { section: 'Pantry', notes: 'Ethiopia Guji from Sightglass', flagged: true }),
  r('groceries', 'Olive oil', { section: 'Pantry' }),
  r('groceries', 'Pasta', { section: 'Pantry', done: true }),

  r('lisbon', 'Check passport expiry dates', { section: 'Before We Go', due: 1, priority: 3 }),
  r('lisbon', 'Book the Sintra day trip', { section: 'Before We Go', due: 9, url: 'getyourguide.com' }),
  r('lisbon', 'Order euros', { section: 'Before We Go', due: 14 }),
  r('lisbon', 'Reserve dinner at Prado', { section: 'Before We Go', done: true }),
  r('lisbon', 'Travel adapters', { section: 'Packing' }),
  r('lisbon', 'Walking shoes', { section: 'Packing' }),
  r('lisbon', 'Sunscreen', { section: 'Packing', done: true }),

  r('reading', 'Tomorrow, and Tomorrow, and Tomorrow', { notes: 'Gabrielle Zevin' }),
  r('reading', 'The Design of Everyday Things', { notes: 'Don Norman — revised edition' }),
  r('reading', 'Piranesi', { notes: 'Susanna Clarke' }),
];

export type SmartId = 'today' | 'scheduled' | 'all' | 'flagged' | 'completed';
export interface Smart { id: SmartId; name: string; color: string; glyph: IconName | 'today'; match: (r: Reminder) => boolean }
export const SMART: Smart[] = [
  { id: 'today', name: 'Today', color: '#007AFF', glyph: 'today', match: (x) => !x.done && x.due != null && x.due <= 0 },
  { id: 'scheduled', name: 'Scheduled', color: '#FF3B30', glyph: 'calendar-fill', match: (x) => !x.done && x.due != null },
  { id: 'all', name: 'All', color: '#5B5B60', glyph: 'tray-fill', match: (x) => !x.done },
  { id: 'flagged', name: 'Flagged', color: '#FF9500', glyph: 'flag-fill', match: (x) => !x.done && !!x.flagged },
  { id: 'completed', name: 'Completed', color: '#8E8E93', glyph: 'check', match: (x) => !!x.done },
];
export const isSmart = (id: string): id is SmartId => SMART.some((s) => s.id === id);

/* ── Dates ── */
const day = (offset: number) => new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + offset);
export function dueLabel(x: Pick<Reminder, 'due' | 'time'>) {
  if (x.due == null) return '';
  const d = x.due === 0 ? 'Today' : x.due === 1 ? 'Tomorrow' : x.due === -1 ? 'Yesterday'
    : day(x.due).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return x.time ? `${d}, ${x.time}` : d;
}
export const dayHeading = (offset: number) =>
  offset < 0 ? 'Overdue' : offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow'
    : day(offset).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
export const TODAY_NUMBER = TODAY.getDate();
