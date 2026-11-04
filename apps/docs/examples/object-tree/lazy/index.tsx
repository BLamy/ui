import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ObjectTree } from '@/components/ui/object-tree'
import type { ObjectTreeNode } from '@/lib/object-tree-model'
import { ThemeScope } from '@/lib/theme'

const later = <T,>(ms: number, make: () => T) => new Promise<T>((resolve, reject) => {
  setTimeout(() => {
    try { resolve(make()) } catch (error) { reject(error) }
  }, ms)
})

// Open `state`, then press Step a few times, quickly. Each new root drops the answer on its way and asks again; the old
// children stay, faded, until the new ones land, so stepping doesn't flicker. `flaky` fails the first time: Retry asks again.
export default function Lazy() {
  const [step, setStep] = useState(1)
  const failed = useRef(false)
  const root = useMemo<ObjectTreeNode<number>[]>(() => [
    {
      id: 'state', name: 'state', hasChildren: true, data: step,
      value: { type: 'object', className: 'State', properties: [{ name: 'step', value: { type: 'number', value: step } }] },
    },
    { id: 'flaky', name: 'flaky', hasChildren: true, value: { type: 'object', className: 'Socket' } },
  ], [step])

  const loadChildren = (node: ObjectTreeNode<number>) => later<ObjectTreeNode<number>[]>(700, () => {
    if (node.id === 'flaky') {
      if (!failed.current) {
        failed.current = true
        throw new Error('The engine has no object 8813')
      }
      return [{ id: 'url', name: 'url', value: { type: 'string', value: 'wss://shop.example/live' } }]
    }
    return [
      { id: 'step', name: 'step', value: { type: 'number', value: node.data ?? 0 } },
      { id: 'doubled', name: 'doubled', value: { type: 'number', value: (node.data ?? 0) * 2 } },
    ]
  })

  return (
    <ThemeScope className="mx-auto flex h-64 max-w-2xl flex-col overflow-hidden rounded-card bg-card shadow-hairline">
      <div className="flex shrink-0 items-center gap-3 p-2 shadow-hairline-b">
        <Button size="sm" variant="secondary" onPress={() => setStep((s) => s + 1)}>Step</Button>
        <span className="text-footnote text-muted-foreground">Step {step}</span>
      </div>
      <ObjectTree aria-label="State at this step" root={root} loadChildren={loadChildren} className="min-h-0 flex-1" />
    </ThemeScope>
  )
}
