import { PGliteProvider, useDatabaseStatus, useExec, useQuery } from '@/lib/pglite'
import { SingleTabGate } from '@/lib/tab-lock'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const migrations = [
  { id: '001_visits', sql: 'create table visits (id serial primary key, at timestamptz not null default now())' },
]

function Visits() {
  const { rows } = useQuery<{ n: number }>('select count(*)::int as n from visits')
  const { exec } = useExec()
  const { info } = useDatabaseStatus()
  const n = rows[0]?.n ?? 0
  return (
    <div className="grid gap-3">
      <p className="text-subhead">
        This database has <strong data-testid="visit-count" className="tabular-nums">{n}</strong> {n === 1 ? 'visit' : 'visits'}. Reload the page: they stay.
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" onPress={() => void exec('insert into visits default values')}>Record a visit</Button>
        <Button variant="secondary" onPress={() => void exec('truncate visits')}>Clear</Button>
      </div>
      <p role="status" className="text-caption text-foreground/65">
        {info ? `${info.dataDir} · PostgreSQL ${info.serverVersion}` : 'Opening…'}
      </p>
    </div>
  )
}

// A database on the main thread has one writer: open it in one tab at a time.
// SingleTabGate takes a Web Lock named after the database; a second tab shows
// `blocked` until the first one closes or hands it over.
export default function Persistent() {
  return (
    <div className="mx-auto w-full max-w-md">
      <SingleTabGate
        name="idb://bl-docs-visits"
        pending={<Skeleton className="h-24 w-full" aria-label="Checking other tabs" role="status" />}
        blocked={({ takeover }) => (
          <div role="status" className="grid gap-3 rounded-panel bg-card p-4 shadow-hairline">
            <p className="text-subhead">This database is open in another tab. Two tabs writing to it would corrupt it.</p>
            <Button variant="secondary" onPress={takeover}>Use it here instead</Button>
          </div>
        )}
      >
        <PGliteProvider dataDir="idb://bl-docs-visits" migrations={migrations} fallback={<Skeleton className="h-24 w-full" aria-label="Starting PostgreSQL" role="status" />}>
          <Visits />
        </PGliteProvider>
      </SingleTabGate>
    </div>
  )
}
