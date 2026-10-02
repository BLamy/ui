import { useMemo, useState } from 'react'
import { FilterBar } from '@/components/ui/filter'
import { matchFilters, serializeFilters, type Filter, type FilterField } from '@/lib/filter'

interface Task {
  title: string
  status: string
  labels: string[]
  blocked: boolean
  created: string
  points: number
}

const NOW = new Date(2026, 0, 14, 15, 30)
const day = (ago: number) => new Date(2026, 0, 14 - ago, 10).toISOString()

const tasks: Task[] = [
  { title: 'Ship the onboarding checklist', status: 'doing', labels: ['growth'], blocked: false, created: day(1), points: 5 },
  { title: 'Fix the flaky upload test', status: 'todo', labels: ['quality'], blocked: true, created: day(3), points: 2 },
  { title: 'Write the migration guide', status: 'todo', labels: ['docs', 'growth'], blocked: false, created: day(9), points: 3 },
  { title: 'Profile the cold start', status: 'doing', labels: ['quality'], blocked: false, created: day(2), points: 8 },
  { title: 'Archive the 2025 roadmap', status: 'done', labels: ['docs'], blocked: false, created: day(40), points: 1 },
  { title: 'Rotate the signing keys', status: 'todo', labels: ['security'], blocked: true, created: day(6), points: 13 },
]

// One field of each kind: select, multiselect, boolean, date, number and text. Each kind has its own operators and
// its own value editor. The string under the list is what `serializeFilters` makes of the filters, safe to put in a URL.
const fields: FilterField[] = [
  { id: 'status', label: 'Status', icon: 'circle', kind: 'select', options: [{ value: 'todo', label: 'To do' }, { value: 'doing', label: 'Doing' }, { value: 'done', label: 'Done' }] },
  { id: 'labels', label: 'Labels', icon: 'tag', kind: 'multiselect', options: [{ value: 'growth', label: 'Growth' }, { value: 'quality', label: 'Quality' }, { value: 'docs', label: 'Docs' }, { value: 'security', label: 'Security' }] },
  { id: 'blocked', label: 'Blocked', icon: 'exclamation-circle', kind: 'boolean' },
  { id: 'created', label: 'Created', icon: 'calendar', kind: 'date' },
  { id: 'points', label: 'Points', icon: 'chart-bar', kind: 'number' },
  { id: 'title', label: 'Title', icon: 'textformat', kind: 'text' },
]

export default function FieldKinds() {
  const [filters, setFilters] = useState<Filter[]>([
    { id: 'a', field: 'points', operator: 'gte', value: 3 },
    { id: 'b', field: 'created', operator: 'in_the_last', value: { type: 'relative', amount: 2, unit: 'week' } },
  ])
  const [match, setMatch] = useState<'all' | 'any'>('all')
  const shown = useMemo(
    () => matchFilters(tasks, filters, fields, (task: Task, field) => task[field as keyof Task], { match, now: NOW }),
    [filters, match],
  )
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3">
      <FilterBar fields={fields} value={filters} onValueChange={setFilters} match={match} onMatchChange={setMatch} showMatch />
      <ul aria-label="Tasks" className="m-0 grid list-none gap-px overflow-hidden rounded-card bg-border p-0">
        {shown.map((task) => (
          <li key={task.title} className="flex items-center gap-3 bg-card px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate text-subhead text-foreground">{task.title}</span>
            <span className="shrink-0 text-footnote text-foreground/70 tabular-nums">{task.points} pts{task.blocked ? ' · blocked' : ''}</span>
          </li>
        ))}
        {shown.length === 0 ? <li className="bg-card px-4 py-8 text-center text-subhead text-foreground/70">No tasks match.</li> : null}
      </ul>
      <p className="m-0 px-1 text-footnote text-foreground/70">{shown.length} of {tasks.length} tasks, matching {match === 'all' ? 'all' : 'any'} of the filters</p>
      <p className="m-0 px-1 font-mono text-caption break-all text-foreground/70">?filters={serializeFilters(filters) || '(none)'}</p>
    </div>
  )
}
