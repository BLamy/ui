import { useState } from 'react'
import { ObjectTree } from '@/components/ui/object-tree'
import { nodeFromValue, type ObjectTreeNode } from '@/lib/object-tree-model'
import { previewText } from '@/lib/object-tree-value'
import { ThemeScope } from '@/lib/theme'

const circular: Record<string, unknown> = { name: 'loop' }
circular.self = circular

const RESPONSE = {
  id: 'evt_123',
  ok: true,
  attempts: 3,
  retryAfter: null,
  received: new Date(Date.UTC(2026, 10, 3, 9, 41)),
  pattern: /^evt_[a-z0-9]+$/gi,
  headers: new Map([['content-type', 'application/json'], ['x-request-id', 'req_9']]),
  tags: new Set(['billing', 'retry']),
  lines: [{ sku: 'TEA-01', qty: 2 }, { sku: 'MUG-07', qty: 1 }],
  get summary() { return '2 lines' },
  circular,
}

const ROOT = nodeFromValue(RESPONSE, { defaultExpanded: true })

// `nodeFromValue` needs no loader: children are worked out as rows open, so a value can be huge or point back at itself.
// With `onSelect` a press selects, and the chevron or a double press opens. ⌘C copies the focused value as JSON.
export default function Json() {
  const [selected, setSelected] = useState<ObjectTreeNode | null>(null)
  return (
    <ThemeScope className="mx-auto flex h-96 max-w-2xl flex-col overflow-hidden rounded-card bg-card shadow-hairline">
      <ObjectTree aria-label="A response" root={ROOT} onSelect={setSelected} className="min-h-0 flex-1 py-1" />
      <div className="shrink-0 truncate px-3 py-2 text-footnote text-muted-foreground shadow-hairline-t">
        {selected?.value ? `${selected.name}: ${previewText(selected.value)}` : 'Nothing selected'}
      </div>
    </ThemeScope>
  )
}
