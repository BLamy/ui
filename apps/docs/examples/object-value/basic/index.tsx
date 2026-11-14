import { ObjectValue } from '@/components/ui/object-value'
import { previewFromValue, type ValuePreview } from '@/lib/object-tree-value'

const VALUES: [string, ValuePreview][] = [
  ['string', { type: 'string', value: 'hello "world"' }],
  ['number', { type: 'number', value: 42 }],
  ['boolean', { type: 'boolean', value: true }],
  ['null', { type: 'null' }],
  ['function', { type: 'function', name: 'formatPrice', params: 'amount, currency' }],
  ['object', { type: 'object', className: 'Cart', properties: [{ name: 'id', value: { type: 'string', value: 'c_81f2' } }, { name: 'total', value: { type: 'number', value: 148.5 } }], overflow: true }],
  ['array', { type: 'array', length: 3, items: [{ type: 'number', value: 1 }, { type: 'string', value: 'two' }, { type: 'object' }] }],
  ['map', { type: 'map', size: 1, entries: [{ key: { type: 'string', value: 'TEA-01' }, value: { type: 'number', value: 12.5 } }] }],
  ['date', { type: 'date', value: '2026-11-03T09:41:00.000Z' }],
  ['error', { type: 'error', name: 'TypeError', message: 'Cannot read properties of undefined', stack: 'TypeError: Cannot read properties of undefined\n    at lineTotal (cart.tsx:87:3)\n    at LineItem (cart.tsx:31:3)' }],
  ['from a live value', previewFromValue({ a: 1, b: [2, 3], c: new Map([['k', 'v']]) })],
  ['a long string', { type: 'string', value: 'A long note that keeps going past the barn, over the hill and out toward a coast nobody in this story has ever seen. '.repeat(4) }],
]

// Each value tinted by its type, as DevTools shows it. A long string and an error's stack get Show more and Copy.
export default function Basic() {
  return (
    <div className="mx-auto max-w-xl rounded-card bg-card p-4 shadow-hairline">
      <dl className="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5">
        {VALUES.map(([name, value]) => (
          <div key={name} className="contents">
            <dt className="text-caption whitespace-nowrap text-muted-foreground">{name}</dt>
            <dd className="m-0 min-w-0"><ObjectValue value={value} /></dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
