import { ObjectTree } from '@/components/ui/object-tree'
import type { ObjectTreeNode } from '@/lib/object-tree-model'
import type { ValuePreview } from '@/lib/object-tree-value'
import { ThemeScope } from '@/lib/theme'

const str = (value: string): ValuePreview => ({ type: 'string', value })
const num = (value: number): ValuePreview => ({ type: 'number', value })
const leaf = (name: string, value: ValuePreview): ObjectTreeNode<string> => ({ id: name, name, value })

// What a debugger would ask its engine for: here, a table by the handle each node carries in `data`.
const HELD: Record<string, ObjectTreeNode<string>[]> = {
  local: [
    {
      id: 'cart', name: 'cart', hasChildren: true, data: 'cart',
      value: {
        type: 'object', className: 'Cart',
        properties: [
          { name: 'id', value: str('c_81f2') },
          { name: 'items', value: { type: 'array', length: 2 } },
          { name: 'total', value: num(148.5) },
        ],
      },
    },
    leaf('quantity', num(2)),
    leaf('sku', str('TEA-01')),
    leaf('discount', { type: 'null' }),
    leaf('total', { type: 'unavailable', label: '<uninitialized>' }),
    leaf('note', str('A long note, the kind that never fits a row: it keeps going past the barn, over the hill and out toward a coast nobody in this story has ever seen.')),
  ],
  cart: [
    leaf('id', str('c_81f2')),
    { id: 'items', name: 'items', hasChildren: true, data: 'items', value: { type: 'array', length: 2, items: [str('TEA-01'), str('MUG-07')] } },
    leaf('total', num(148.5)),
    { id: 'count', name: 'count', value: { type: 'accessor' } },
  ],
  items: [leaf('0', str('TEA-01')), leaf('1', str('MUG-07')), { ...leaf('length', num(2)), dim: true }],
  closure: [
    leaf('MAX_ITEMS', num(50)),
    leaf('formatPrice', { type: 'function', name: 'formatPrice', params: 'amount, currency' }),
    { id: 'prices', name: 'prices', hasChildren: true, data: 'prices', value: { type: 'map', size: 2, entries: [{ key: str('TEA-01'), value: num(12.5) }, { key: str('MUG-07'), value: num(18) }] } },
  ],
  prices: [
    { id: '0', name: '0', value: { type: 'entry', key: str('TEA-01'), value: num(12.5) } },
    { id: '1', name: '1', value: { type: 'entry', key: str('MUG-07'), value: num(18) } },
  ],
  global: [
    leaf('document', { type: 'object', className: 'HTMLDocument' }),
    leaf('performance', { type: 'object', className: 'Performance' }),
  ],
}

const SCOPES: ObjectTreeNode<string>[] = [
  { id: 'local', name: 'addItem (local)', section: true, data: 'local' },
  { id: 'closure', name: 'useCart (closure)', section: true, data: 'closure' },
  { id: 'global', name: 'Global', section: true, defaultExpanded: false, data: 'global' },
]

// Sections open by default and load like anything else. Press a row or use the arrow keys to open and close it; press
// (...) to call a getter; press the cut-off note, or its … button, to read all of it; ⌘C copies the focused value.
export default function Scopes() {
  return (
    <ThemeScope className="mx-auto h-96 max-w-2xl overflow-hidden rounded-card bg-card py-1 shadow-hairline">
      <ObjectTree
        aria-label="Scopes"
        root={SCOPES}
        loadChildren={async (node) => HELD[node.data ?? ''] ?? []}
        onInvokeGetter={async () => ({ value: num(2) })}
      />
    </ThemeScope>
  )
}
