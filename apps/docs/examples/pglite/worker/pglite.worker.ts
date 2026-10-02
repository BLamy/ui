import { PGlite } from '@electric-sql/pglite'
import { live } from '@electric-sql/pglite/live'
import { worker } from '@electric-sql/pglite/worker'

// The database lives in this worker. `init` receives what PGliteProvider
// passed (dataDir, loadDataDir, relaxedDurability…); add extensions here.
// Every tab that starts this worker with the same `id` shares ONE database
// through leader election, so several tabs can use it at once — no tab lock.
worker({
  async init(options) {
    return PGlite.create({ ...options, extensions: { live } })
  },
})
