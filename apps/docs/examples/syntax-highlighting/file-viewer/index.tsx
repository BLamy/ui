import { SyntaxHighlighting } from '@/components/ui/syntax-highlighting'

const queue = `import type { Adapter, JobRecord } from './adapters/types'
import { defaultRetry, type RetryPolicy } from './retry'

export class Queue {
  constructor(private adapter: Adapter) {}

  /** Claim up to \`limit\` jobs that are due, skipping locked rows. */
  async claim(limit = 10): Promise<JobRecord[]> {
    const rows = await this.adapter.claim({ limit, now: new Date() })
    return rows.map((row) => ({ ...row, attempts: row.attempts + 1 }))
  }

  retry(job: JobRecord, policy: RetryPolicy = defaultRetry) {
    if (job.attempts >= policy.maxAttempts) return this.adapter.fail(job.id)
    return this.adapter.reschedule(job.id, policy.delay(job.attempts))
  }
}`

export default function FileViewer() {
  return (
    <SyntaxHighlighting
      code={queue}
      language="ts"
      title="src/queue.ts"
      showCopy
      lineNumbers
      highlightLines={[[8, 11]]}
    />
  )
}
