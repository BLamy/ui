import { ObjectTree } from '@/components/ui/object-tree'
import type { ObjectTreeNode } from '@/lib/object-tree'
import { ThemeScope } from '@/lib/theme'

const ROOT: ObjectTreeNode[] = [
  {
    id: 'samples', name: 'samples', hasChildren: true, defaultExpanded: true,
    value: { type: 'array', length: 100000, items: [0, 3, 6, 9, 12].map((value) => ({ type: 'number', value })), overflow: true },
  },
]

// All 100,000 children arrive at once, and the tree groups them: ten ranges of 10,000, each a hundred of 100, each a
// hundred values. `length` stays outside the ranges. Only the rows on screen are in the DOM.
function loadChildren(): ObjectTreeNode[] {
  const nodes: ObjectTreeNode[] = []
  for (let i = 0; i < 100000; i++) nodes.push({ id: String(i), name: String(i), value: { type: 'number', value: i * 3 } })
  nodes.push({ id: 'length', name: 'length', value: { type: 'number', value: 100000 }, dim: true })
  return nodes
}

export default function Large() {
  return (
    <ThemeScope className="mx-auto h-96 max-w-2xl overflow-hidden rounded-card bg-card py-1 shadow-hairline">
      <ObjectTree aria-label="A large array" root={ROOT} loadChildren={loadChildren} />
    </ThemeScope>
  )
}
