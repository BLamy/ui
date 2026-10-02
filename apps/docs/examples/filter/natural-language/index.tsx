import { useMemo, useState } from 'react'
import { FilterBar, FilterToolbar } from '@/components/ui/filter'
import { FilterInput } from '@/components/ui/filter-input'
import { matchFilters, type Filter } from '@/lib/filter'
import { NOW, fields, issues, type Issue } from './issues'

// FilterInput sits inside the FilterBar and applies into it. Type a sentence — "urgent bugs assigned to bob",
// "open issues created in the last 3 days" — and read the preview: it lists what was understood, what was dropped and
// anything it assumed. Enter applies; the chips are then ordinary filters you can edit. It is a small experimental
// model, so some phrasings come out wrong or empty; that is what the preview is for.
export default function NaturalLanguage() {
  const [filters, setFilters] = useState<Filter[]>([])
  const shown = useMemo(
    () => matchFilters(issues, filters, fields, (issue: Issue, field) => issue[field as keyof Issue], { now: NOW }),
    [filters],
  )
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-3">
      <FilterBar fields={fields} value={filters} onValueChange={setFilters}>
        <FilterInput query={{ now: NOW }} />
        <FilterToolbar />
      </FilterBar>
      <ul aria-label="Issues" className="m-0 grid list-none gap-px overflow-hidden rounded-card bg-border p-0">
        {shown.map((issue) => (
          <li key={issue.id} className="flex items-center gap-3 bg-card px-4 py-2.5">
            <span className="w-16 shrink-0 font-mono text-footnote text-foreground/70">{issue.id}</span>
            <span className="min-w-0 flex-1 truncate text-subhead text-foreground">{issue.title}</span>
            <span className="shrink-0 text-footnote text-foreground/70 capitalize">{issue.priority} · {issue.assignee}</span>
          </li>
        ))}
        {shown.length === 0 ? <li className="bg-card px-4 py-8 text-center text-subhead text-foreground/70">No issues match.</li> : null}
      </ul>
      <p className="m-0 px-1 text-footnote text-foreground/70" aria-live="polite">{shown.length} of {issues.length} issues</p>
    </div>
  )
}
