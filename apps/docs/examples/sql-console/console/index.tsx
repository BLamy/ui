import { PGliteProvider } from '@/lib/pglite'
import { SqlConsole } from '@/components/ui/sql-console'
import { seed, starter } from './seed'

// A console over an in-memory database seeded by a migration. Everything lazy:
// the WebAssembly downloads when this mounts. Click a table in the Schema tab to
// paste `select * from …`; run several statements at once for a result each.
export default function Console() {
  return (
    <PGliteProvider migrations={seed}>
      <SqlConsole defaultValue={starter} historyKey="bl-docs-sql-history" />
    </PGliteProvider>
  )
}
