import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tree, type TreeNode } from '@/components/ui/tree'

const FILES: TreeNode[] = [{ value: 'src', label: 'src', children: [{ value: 'src/index.ts', label: 'index.ts' }] }, { value: 'README.md', label: 'README.md' }]

// `loading` shows placeholder rows (and makes the tree aria-busy) while there are no rows yet; `emptyState` is what
// shows when there are none: a node, or the title of the kit's EmptyState.
export default function Loading() {
  const [state, setState] = useState<'loading' | 'empty' | 'loaded'>('loading')
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
      <div className="flex gap-1.5">
        {(['loading', 'empty', 'loaded'] as const).map((s) => (
          <Button key={s} size="sm" variant={state === s ? 'default' : 'secondary'} onClick={() => setState(s)}>{s}</Button>
        ))}
      </div>
      <Tree aria-label="Files" items={state === 'loaded' ? FILES : []} loading={state === 'loading'} defaultExpanded="all"
        emptyState="This folder is empty" className="h-40 rounded-panel bg-card shadow-hairline" />
    </div>
  )
}
