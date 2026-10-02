import { PGliteProvider } from '@/lib/pglite'
import { SingleTabGate } from '@/lib/tab-lock'
import { SqlConsole } from '@/components/ui/sql-console'
import { Button } from '@/components/ui/button'

const migrations = [
  {
    id: '001_notes',
    sql: `create table notes (id serial primary key, body text not null);
          insert into notes (body) values ('Stored in IndexedDB: reload and it is still here.');`,
  },
]

// idb:// persists across reloads; the lock keeps a second tab from opening the
// same database. Export a SQL dump from the header, then import it into another
// database (the console's Import… button applies a dump to the open database).
export default function Persistent() {
  return (
    <SingleTabGate
      name="idb://bl-docs-console"
      blocked={({ takeover }) => (
        <div role="status" className="grid gap-3 rounded-panel bg-card p-4 shadow-hairline">
          <p className="text-subhead">This database is open in another tab.</p>
          <Button variant="secondary" onPress={takeover}>Use it here instead</Button>
        </div>
      )}
    >
      <PGliteProvider dataDir="idb://bl-docs-console" migrations={migrations}>
        <SqlConsole defaultValue="select * from notes;" />
      </PGliteProvider>
    </SingleTabGate>
  )
}
