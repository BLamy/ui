import { useMemo, useState } from 'react'
import { FilterBar } from '@/components/ui/filter'
import { matchFilters, type Filter } from '@/lib/filter'
import { NOW, fields, issues, priorityColor, type Issue } from './issues'

// A FilterBar owns the chips; the list is derived from them with matchFilters. The Status filter below is the
// starting state: edit it in place, add another with the Filter button (or press F), remove one with ×, Backspace or Delete.
export default function IssueTracker() {
  const [filters, setFilters] = useState<Filter[]>([
    { id: 'status', field: 'status', operator: 'is_any_of', value: ['open', 'in_progress'] },
  ])
  const shown = useMemo(
    () => matchFilters(issues, filters, fields, (issue: Issue, field) => issue[field as keyof Issue], { now: NOW }),
    [filters],
  )
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3">
      <FilterBar fields={fields} value={filters} onValueChange={setFilters} hotkey="f" />
      <ul aria-label="Issues" className="m-0 grid list-none gap-px overflow-hidden rounded-card bg-border p-0">
        {shown.map((issue) => (
          <li key={issue.id} className="flex items-center gap-3 bg-card px-4 py-2.5">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-(--c)" style={{ '--c': priorityColor[issue.priority] } as React.CSSProperties} />
            <span className="w-16 shrink-0 font-mono text-footnote text-foreground/70">{issue.id}</span>
            <span className="min-w-0 flex-1 truncate text-subhead text-foreground">{issue.title}</span>
            <span className="shrink-0 text-footnote text-foreground/70 capitalize">{issue.assignee}</span>
          </li>
        ))}
        {shown.length === 0 ? <li className="bg-card px-4 py-8 text-center text-subhead text-foreground/70">No issues match these filters.</li> : null}
      </ul>
      <p className="m-0 px-1 text-footnote text-foreground/70" aria-live="polite">{shown.length} of {issues.length} issues</p>
    </div>
  )
}
