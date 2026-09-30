/* Sample notes for the Apple Notes clone: iCloud and On My Mac folders, Recently Deleted, tags, and notes
   written in Markdown (the first line is the title, as in Notes; checklists and tables included). Dates are
   relative to a fixed "now" so the date groups read the same on every render. */

import { type IconName } from '@/lib/icon';

/** The clock the block reads: Sunday, September 27 2026, 9:41 AM. */
export const NOW = new Date(2026, 8, 27, 9, 41);
const at = (daysAgo: number, h: number, m: number) => new Date(2026, 8, 27 - daysAgo, h, m);

export interface Note {
  id: string;
  folder: string;
  /** Markdown. The first line is the title. */
  body: string;
  updated: Date;
  pinned?: boolean;
  locked?: boolean;
  /** Recently Deleted: the folder it came from. */
  deletedFrom?: string;
}

export interface Folder {
  id: string;
  title: string;
  /** Smart folders gather notes from several folders. */
  match?: (n: Note) => boolean;
  icon?: IconName;
}

const live = (n: Note) => n.folder !== 'deleted';
export const ICLOUD: Folder[] = [
  { id: 'all', title: 'All iCloud', icon: 'folder-badge-gear', match: (n) => live(n) && !n.folder.startsWith('mac') },
  { id: 'notes', title: 'Notes' },
  { id: 'recipes', title: 'Recipes' },
  { id: 'travel', title: 'Travel' },
  { id: 'work', title: 'Work' },
  { id: 'deleted', title: 'Recently Deleted', icon: 'trash' },
];
export const ON_MY_MAC: Folder[] = [
  { id: 'mac-notes', title: 'Notes' },
  { id: 'mac-journal', title: 'Journal' },
];
export const FOLDERS = [...ICLOUD, ...ON_MY_MAC];
export const TAGS = ['design', 'recipes', 'travel', 'weekend'];
/** Folders a note can be created in or moved to. */
export const MOVE_TARGETS = FOLDERS.filter((f) => !f.match && f.id !== 'deleted');

export const NOTES: Note[] = [
  {
    id: 'n1', folder: 'travel', pinned: true, updated: at(0, 8, 55),
    body: `# Tokyo, Sep 28 – Oct 3

Flight UA 837 leaves SFO at 11:25 AM. Hotel Gracery Shinjuku, confirmation 48F-22917. #travel

## Packing

- [x] Passport
- [x] Pocket Wi-Fi pickup at NRT
- [ ] Suica card on the phone
- [ ] Adapter (Type A works, bring one anyway)
- [ ] Rain jacket

## Plan

| Day | Morning | Evening |
| --- | --- | --- |
| Mon | Land 2:40 PM | Omoide Yokocho |
| Tue | Tsukiji outer market | Shibuya Sky |
| Wed | teamLab Planets | Golden Gai |
| Thu | Day trip to Kamakura | Izakaya with Hana |`,
  },
  {
    id: 'n2', folder: 'notes', pinned: true, updated: at(1, 18, 20),
    body: `# Groceries

- [ ] Oat milk
- [ ] Lemons
- [x] Sourdough flour
- [ ] Basil
- [ ] Parmesan
- [ ] Coffee beans (Hayes Valley)
- [x] Eggs`,
  },
  {
    id: 'n3', folder: 'work', updated: at(0, 9, 30),
    body: `# SplitView review notes

Thursday, with Wei and Anya. #design

- Columns persist between size classes — nothing remounts
- Divider hit area is too small on touch; widen to 10 px
- Esc closes the overlay sidebar before popping the stack

## Follow-ups

- [x] Record a half-speed pass
- [ ] Hairline token for dark sidebars
- [ ] Write the migration note`,
  },
  {
    id: 'n4', folder: 'recipes', updated: at(0, 7, 12),
    body: `# Sourdough schedule

Weekend loaf, 75% hydration. #recipes

| Time | Step |
| --- | --- |
| Fri 9 PM | Feed starter |
| Sat 9 AM | Autolyse, 1 hr |
| Sat 10 AM | Mix, then 4 sets of folds |
| Sat 3 PM | Shape, cold proof overnight |
| Sun 8 AM | Bake 250 °C, 20 min lid on, 25 off |`,
  },
  {
    id: 'n5', folder: 'notes', locked: true, updated: at(1, 21, 4),
    body: `# Gift ideas

Mom — the ceramic class at the community studio, and a print of the porch photo from Grandma's party.

Maya — the blue Le Creuset she keeps looking at.`,
  },
  {
    id: 'n6', folder: 'work', updated: at(2, 16, 45),
    body: `# Weekly planning

- [x] Ship SplitView to the docs
- [ ] Mail and Notes blocks
- [ ] Review Luca's haptics numbers
- [ ] 1:1 with Hana — offsite agenda`,
  },
  {
    id: 'n7', folder: 'notes', updated: at(3, 22, 10),
    body: `# Books to read

1. The Shape of Design — Frank Chimero
2. Designing Fluid Interfaces (the WWDC talk, again)
3. Piranesi — Susanna Clarke
4. How Buildings Learn — Stewart Brand`,
  },
  {
    id: 'n8', folder: 'travel', updated: at(5, 12, 0),
    body: `# Cabin weekend

Lost Lake, Oct 9 – 11. Sam has groceries; we bring the stove and the kettle. #weekend

- [ ] Camp stove + fuel
- [ ] The good kettle
- [ ] Board games
- [ ] Headlamps`,
  },
  {
    id: 'n9', folder: 'recipes', updated: at(9, 19, 30),
    body: `# Miso-glazed salmon

2 tbsp white miso, 1 tbsp mirin, 1 tbsp maple, 1 tsp soy. Brush on, broil 8 minutes, rest 2. Serve with rice and quick-pickled cucumbers. #recipes`,
  },
  {
    id: 'n10', folder: 'notes', updated: at(14, 10, 5),
    body: `# Apartment measurements

| Room | Width | Length |
| --- | --- | --- |
| Living room | 4.2 m | 5.6 m |
| Bedroom | 3.4 m | 3.9 m |
| Office nook | 1.8 m | 2.1 m |

Sofa must be under 2.2 m to fit the wall between the windows.`,
  },
  {
    id: 'n11', folder: 'work', updated: at(21, 15, 0),
    body: `# 1:1 with Hana

- Motion review went well; confetti stays silly
- She wants a Notes clone for the docs #design
- Next: spring presets in CSS`,
  },
  {
    id: 'n12', folder: 'notes', updated: at(38, 20, 0),
    body: `# Summer reading notes

"A place is a story happening many times." Keep coming back to this one.`,
  },
  {
    id: 'n13', folder: 'notes', locked: true, updated: at(52, 9, 0),
    body: `# Wi-Fi passwords

Studio: correct-horse-battery-staple
Cabin: ask Sam`,
  },
  {
    id: 'm1', folder: 'mac-journal', updated: at(0, 6, 40),
    body: `# Morning pages

Slept well. The Mail clone needs swipe actions that feel right — overshoot a little, then settle. Walk before standup.`,
  },
  {
    id: 'm2', folder: 'mac-journal', updated: at(4, 6, 55),
    body: `# Morning pages

Rain. Wrote for twenty minutes about continuity: things that persist should stay put and morph.`,
  },
  {
    id: 'm3', folder: 'mac-notes', updated: at(11, 13, 20),
    body: `# Draft: Why split views win

A list, a detail, and a way to move between them that respects where you came from.`,
  },
  {
    id: 'd1', folder: 'deleted', deletedFrom: 'notes', updated: at(6, 11, 0),
    body: `# Old packing list

Superseded by the Tokyo note.`,
  },
];

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysAgo = (d: Date) => Math.round((startOfDay(NOW) - startOfDay(d)) / DAY);

/** Notes' list date: a time today, "Yesterday", a weekday this week, else a short date. */
export function shortDate(d: Date) {
  const n = daysAgo(d);
  if (n <= 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (n === 1) return 'Yesterday';
  if (n < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

/** The editor's header date. */
export const longDate = (d: Date) =>
  `${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

/** The date section a note falls in: Today, Yesterday, Previous 7 Days, Previous 30 Days, a month, a year. */
export function dateGroup(d: Date) {
  const n = daysAgo(d);
  if (n <= 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n < 7) return 'Previous 7 Days';
  if (n < 30) return 'Previous 30 Days';
  if (d.getFullYear() === NOW.getFullYear()) return d.toLocaleDateString('en-US', { month: 'long' });
  return String(d.getFullYear());
}

const strip = (l: string) => l.replace(/^#+\s*/, '').replace(/^[-*]\s+\[[ x]\]\s*/, '').replace(/^[-*]\s+|^\d+\.\s+/, '')
  .replace(/\|/g, ' ').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();

export function title(n: Note) {
  const first = n.body.split('\n').find((l) => l.trim());
  return first ? strip(first) || 'New Note' : 'New Note';
}

/** The line after the title, as plain text (table rules and blank lines skipped). */
export function snippet(n: Note) {
  const lines = n.body.split('\n').filter((l) => l.trim() && !/^\s*\|?\s*-{3}/.test(l));
  return lines.slice(1).map(strip).find(Boolean) ?? 'No additional text';
}
