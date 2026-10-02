import { useState } from 'react'
import { PGliteProvider, useDatabaseStatus, useExec, useQuery } from '@/lib/pglite'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

// Applied once, in order, inside a transaction each. Add new ones at the end.
const migrations = [
  {
    id: '001_notes',
    sql: `create table notes (
      id serial primary key,
      body text not null,
      created_at timestamptz not null default now()
    );
    insert into notes (body) values ('Postgres runs in this tab.'), ('Reload and this is gone: memory:// is not persisted.');`,
  },
]

function Notes() {
  const { rows, isLoading, error } = useQuery<{ id: number; body: string }>(
    'select id, body from notes order by id desc',
  )
  const { run, isPending } = useExec()
  const [draft, setDraft] = useState('')

  return (
    <div className="grid gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const body = draft.trim()
          if (!body) return
          // Parameters go through the extended protocol: no string concatenation.
          void run('insert into notes (body) values ($1)', [body]).then(() => setDraft(''))
        }}
      >
        <Input aria-label="New note" placeholder="Write a note" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button type="submit" isDisabled={isPending || !draft.trim()}>Add</Button>
      </form>
      {error ? <p role="alert" className="text-footnote text-destructive">{error.message}</p> : null}
      <ul className="grid gap-1.5" aria-busy={isLoading}>
        {rows.map((n) => (
          <li key={n.id} className="flex items-center gap-2 rounded-ctl bg-card px-3 py-2 text-subhead shadow-hairline">
            <span className="min-w-0 flex-1 truncate">{n.body}</span>
            <Button variant="ghost" size="sm" aria-label={`Delete note ${n.id}`} onPress={() => void run('delete from notes where id = $1', [n.id])}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Status() {
  const { status, info } = useDatabaseStatus()
  return (
    <p role="status" className="text-caption text-foreground/65">
      {status === 'ready' && info ? `PostgreSQL ${info.serverVersion} · PGlite ${info.pgliteVersion} · ${info.dataDir}` : status}
    </p>
  )
}

// Nothing downloads until this component mounts: the WebAssembly is imported
// lazily by the provider. `fallback` replaces the children while it opens.
export default function Basic() {
  return (
    <div className="mx-auto grid w-full max-w-md gap-3">
      <PGliteProvider
        migrations={migrations}
        fallback={<Skeleton className="h-40 w-full" aria-label="Starting PostgreSQL" role="status" />}
      >
        <Notes />
        <Status />
      </PGliteProvider>
    </div>
  )
}
