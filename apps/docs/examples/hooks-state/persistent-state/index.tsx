import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { usePersistentState } from '@/lib/persistent-state'

const COUNT_KEY = 'docs-hooks:count'
const COMPACT_KEY = 'docs-hooks:compact'

// An `isValid` guard keeps a stale or hand-edited value out of state: anything
// that is not a number falls back to the initial value.
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export default function PersistentState() {
  const [count, setCount] = usePersistentState(COUNT_KEY, 0, isNumber)
  const [compact, setCompact] = usePersistentState(COMPACT_KEY, false)
  // What localStorage holds right now. This effect is declared after the
  // hook's own, so on an update it runs once the value has been written.
  const [stored, setStored] = useState<string | null>(null)
  useEffect(() => {
    setStored(localStorage.getItem(COUNT_KEY))
  }, [count])

  return (
    <div className="mx-auto grid max-w-sm gap-4">
      <div className="flex items-center justify-between gap-4 rounded-card bg-card p-4 shadow-hairline">
        <div className="grid gap-0.5">
          <span id="ps-count" className="text-body text-foreground tabular-nums">
            Count: {count}
          </span>
          <span className="text-footnote text-foreground">Reload the page: it stays.</span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onPress={() => setCount((c) => c + 1)}>
            Add one
          </Button>
          <Button variant="secondary" size="sm" onPress={() => setCount(0)}>
            Reset
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-card bg-card p-4 shadow-hairline">
        <span id="ps-compact" className="text-body text-foreground">
          Compact rows
        </span>
        <Switch aria-labelledby="ps-compact" checked={compact} onChange={setCompact} />
      </div>
      <p className="m-0 text-footnote text-foreground">
        <code className="font-mono">{COUNT_KEY}</code> in localStorage:{' '}
        <code className="font-mono">{stored ?? 'nothing written yet'}</code>
      </p>
    </div>
  )
}
