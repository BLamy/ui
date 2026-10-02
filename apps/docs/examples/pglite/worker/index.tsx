import { useState } from 'react'
import { PGliteProvider, useDatabaseStatus, useExec, useLiveQuery } from '@/lib/pglite'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const migrations = [
  { id: '001_clicks', sql: 'create table clicks (id serial primary key, at timestamptz not null default now())' },
]

const newWorker = () => new Worker(new URL('./pglite.worker.ts', import.meta.url), { type: 'module' })

function Clicks() {
  // Live: another tab on the same worker writing shows up here too.
  const { rows } = useLiveQuery<{ n: number }>('select count(*)::int as n from clicks')
  const { exec } = useExec()
  const { info } = useDatabaseStatus()
  return (
    <div className="grid gap-3">
      <p className="text-subhead">
        <strong data-testid="click-count" className="tabular-nums">{rows[0]?.n ?? 0}</strong> clicks, shared by every tab that has this page open.
      </p>
      <Button variant="secondary" onPress={() => void exec('insert into clicks default values')}>Click</Button>
      <p role="status" className="text-caption text-foreground/65">
        {info ? `${info.dataDir} · ${info.worker ? 'Web Worker' : 'main thread'} · PostgreSQL ${info.serverVersion}` : 'Opening…'}
      </p>
    </div>
  )
}

// The same worker file serves IndexedDB and the origin private file system;
// only the dataDir differs. OPFS needs a worker (it uses synchronous file handles).
export default function WorkerExample() {
  const [storage, setStorage] = useState<'idb' | 'opfs-ahp'>('idb')
  return (
    <div className="mx-auto grid w-full max-w-md gap-3">
      <div className="flex gap-2" role="group" aria-label="Storage">
        <Button size="sm" variant="secondary" className={storage === 'idb' ? 'bg-foreground text-background' : undefined} onPress={() => setStorage('idb')}>IndexedDB</Button>
        <Button size="sm" variant="secondary" className={storage === 'opfs-ahp' ? 'bg-foreground text-background' : undefined} onPress={() => setStorage('opfs-ahp')}>OPFS</Button>
      </div>
      <PGliteProvider
        key={storage}
        dataDir={`${storage}://bl-docs-worker`}
        worker={newWorker}
        migrations={migrations}
        fallback={<Skeleton className="h-24 w-full" aria-label="Starting PostgreSQL" role="status" />}
      >
        <Clicks />
      </PGliteProvider>
    </div>
  )
}
