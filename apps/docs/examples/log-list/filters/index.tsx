import { useMemo, useState } from 'react'
import { FilterBar, FilterToolbar } from '@/components/ui/filter'
import { FilterInput } from '@/components/ui/filter-input'
import { LogList } from '@/components/ui/log-list'
import { matchFilters, type Filter, type FilterField } from '@/lib/filter-model'
import { LOG_LEVELS, countLogLevels, nodeText, normalizeLogLevel, type LogLevel, type LogRow } from '@/lib/log-list-model'

const SOURCES = ['app.tsx:42', 'cart.tsx:118', 'api.ts:31', 'store.ts:204']
const LEVELS: LogLevel[] = ['log', 'log', 'debug', 'log', 'info', 'log', 'warn', 'log', 'debug', 'log', 'log', 'error']

const ROWS: LogRow[] = Array.from({ length: 3000 }, (_, i) => {
  const level = LEVELS[(i * 7 + (i >> 2)) % LEVELS.length]
  return {
    id: i,
    level,
    time: i * 83,
    source: SOURCES[(i * 3 + (i >> 4)) % SOURCES.length],
    message: level === 'error' ? `Failed to load /api/cart/${i}` : level === 'warn' ? `Slow response from /api/cart/${i}` : `Rendered row ${i}`,
  }
})

const COUNTS = countLogLevels(ROWS)

// The filter is the host's: LogList shows whatever rows it's given. The Level field's options carry the counts, and
// typing "level error" and pressing Enter fills the bar in from a sentence.
const FIELDS: FilterField[] = [
  { id: 'level', label: 'Level', kind: 'select', options: LOG_LEVELS.map((level) => ({ value: level, label: level, count: COUNTS[level] })) },
  { id: 'source', label: 'Source', kind: 'text' },
  { id: 'message', label: 'Message', kind: 'text' },
]

const valueOf = (row: LogRow, field: string) => (field === 'level' ? normalizeLogLevel(row.level) : nodeText(field === 'source' ? row.source : row.message))

export default function Filters() {
  const [filters, setFilters] = useState<Filter[]>([])
  const shown = useMemo(() => matchFilters(ROWS, filters, FIELDS, valueOf), [filters])
  const counts = useMemo(() => countLogLevels(shown), [shown])
  return (
    <div className="flex h-[480px] w-full flex-col gap-2">
      <FilterBar fields={FIELDS} value={filters} onValueChange={setFilters} className="shrink-0">
        <FilterInput placeholder="level error" />
        <FilterToolbar />
      </FilterBar>
      <div role="status" className="flex shrink-0 flex-wrap gap-3 px-1 text-caption text-muted-foreground tabular-nums">
        {LOG_LEVELS.map((level) => <span key={level}>{counts[level].toLocaleString('en-US')} {level}</span>)}
      </div>
      <LogList aria-label="Console" rows={shown} emptyState="No messages match the filter" className="min-h-0 flex-1" />
    </div>
  )
}
