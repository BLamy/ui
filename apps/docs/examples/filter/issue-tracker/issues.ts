import type { FilterField } from '@/lib/filter'

export interface Issue {
  id: string
  title: string
  status: 'open' | 'in_progress' | 'done' | 'canceled'
  priority: 'urgent' | 'high' | 'medium' | 'low'
  assignee: 'alice' | 'bob' | 'carol'
  labels: string[]
  created: string
}

/** "Now" for the demo's date presets, so the data and the screenshots never drift. */
export const NOW = new Date(2026, 0, 14, 15, 30)

const day = (ago: number) => new Date(2026, 0, 14 - ago, 10).toISOString()

export const issues: Issue[] = [
  { id: 'BL-101', title: 'Crash when saving a draft offline', status: 'open', priority: 'urgent', assignee: 'bob', labels: ['bug'], created: day(0) },
  { id: 'BL-102', title: 'Dark mode flashes white on first paint', status: 'in_progress', priority: 'high', assignee: 'alice', labels: ['bug', 'design'], created: day(1) },
  { id: 'BL-103', title: 'Add keyboard shortcuts to the inbox', status: 'open', priority: 'medium', assignee: 'carol', labels: ['feature'], created: day(2) },
  { id: 'BL-104', title: 'Document the sync conflict rules', status: 'open', priority: 'low', assignee: 'alice', labels: ['docs'], created: day(3) },
  { id: 'BL-105', title: 'Search ignores accents', status: 'in_progress', priority: 'medium', assignee: 'bob', labels: ['bug'], created: day(5) },
  { id: 'BL-106', title: 'Redesign the empty states', status: 'done', priority: 'low', assignee: 'carol', labels: ['design'], created: day(8) },
  { id: 'BL-107', title: 'Export to CSV drops the header row', status: 'done', priority: 'high', assignee: 'bob', labels: ['bug'], created: day(10) },
  { id: 'BL-108', title: 'Support multiple workspaces', status: 'open', priority: 'high', assignee: 'alice', labels: ['feature'], created: day(12) },
  { id: 'BL-109', title: 'Old onboarding survey', status: 'canceled', priority: 'low', assignee: 'carol', labels: [], created: day(30) },
  { id: 'BL-110', title: 'Login loop on Safari private mode', status: 'open', priority: 'urgent', assignee: 'carol', labels: ['bug'], created: day(4) },
  { id: 'BL-111', title: 'Refresh the API reference', status: 'in_progress', priority: 'medium', assignee: 'alice', labels: ['docs'], created: day(6) },
  { id: 'BL-112', title: 'Tooltip delay feels sluggish', status: 'done', priority: 'low', assignee: 'bob', labels: ['design'], created: day(20) },
]

export const priorityColor = {
  urgent: 'var(--destructive)',
  high: 'var(--primary)',
  medium: 'var(--muted-foreground)',
  low: 'var(--muted-foreground)',
}

/** What can be filtered. Options carry the colors and counts the picker shows. */
export const fields: FilterField[] = [
  {
    id: 'status', label: 'Status', icon: 'circle', kind: 'select',
    options: [
      { value: 'open', label: 'Open', color: 'var(--primary)' },
      { value: 'in_progress', label: 'In progress', color: 'var(--success, var(--primary))' },
      { value: 'done', label: 'Done', color: 'var(--muted-foreground)' },
      { value: 'canceled', label: 'Canceled', color: 'var(--muted-foreground)' },
    ].map((o) => ({ ...o, count: issues.filter((i) => i.status === o.value).length })),
  },
  {
    id: 'priority', label: 'Priority', icon: 'flag', kind: 'select',
    options: (['urgent', 'high', 'medium', 'low'] as const).map((p) => ({
      value: p, label: p[0].toUpperCase() + p.slice(1), color: priorityColor[p], count: issues.filter((i) => i.priority === p).length,
    })),
  },
  {
    id: 'assignee', label: 'Assignee', icon: 'person', kind: 'select',
    options: [
      { value: 'alice', label: 'Alice' },
      { value: 'bob', label: 'Bob' },
      { value: 'carol', label: 'Carol' },
    ],
  },
  {
    id: 'labels', label: 'Labels', icon: 'tag', kind: 'multiselect',
    options: [
      { value: 'bug', label: 'Bug', color: 'var(--destructive)' },
      { value: 'feature', label: 'Feature', color: 'var(--primary)' },
      { value: 'docs', label: 'Docs', color: 'var(--success, var(--primary))' },
      { value: 'design', label: 'Design', color: 'var(--muted-foreground)' },
    ],
  },
  { id: 'created', label: 'Created', icon: 'calendar', kind: 'date' },
]
