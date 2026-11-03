import { ObjectValue } from '@/components/ui/object-value'
import { previewFromValue, type ValuePreview } from '@/lib/object-tree-value'
import { ThemeScope } from '@/lib/theme'

const VALUES: [string, ValuePreview][] = [
  ['string', { type: 'string', value: 'hello "world"' }],
  ['number', { type: 'number', value: 42 }],
  ['boolean', { type: 'boolean', value: true }],
  ['null', { type: 'null' }],
  ['undefined', { type: 'undefined' }],
  ['bigint', { type: 'bigint', value: '9007199254740993' }],
  ['symbol', { type: 'symbol', value: 'Symbol(session)' }],
  ['function', { type: 'function', name: 'formatPrice', params: 'amount, currency' }],
  ['class', { type: 'function', name: 'Cart', flavor: 'class' }],
  ['object', { type: 'object', className: 'Cart', properties: [{ name: 'id', value: { type: 'string', value: 'c_81f2' } }, { name: 'owner', value: { type: 'object', className: 'User' } }], overflow: true }],
  ['array', { type: 'array', length: 3, items: [{ type: 'number', value: 1 }, { type: 'string', value: 'two' }, { type: 'object' }] }],
  ['map', { type: 'map', size: 1, entries: [{ key: { type: 'string', value: 'TEA-01' }, value: { type: 'number', value: 12.5 } }] }],
  ['set', { type: 'set', size: 2, items: [{ type: 'string', value: 'x' }, { type: 'string', value: 'y' }] }],
  ['date', { type: 'date', value: '2026-11-03T09:41:00.000Z' }],
  ['regexp', { type: 'regexp', value: '/^evt_[a-z0-9]+$/gi' }],
  ['error', { type: 'error', name: 'TypeError', message: 'Cannot read properties of undefined', stack: 'TypeError: Cannot read properties of undefined\n    at lineTotal (cart.tsx:87:3)\n    at LineItem (cart.tsx:31:3)' }],
  ['getter', { type: 'accessor' }],
  ['unavailable', { type: 'unavailable', label: '<uninitialized>' }],
  ['from a live value', previewFromValue({ a: 1, b: [2, 3], c: new Map([['k', 'v']]) })],
  ['a long string', { type: 'string', value: 'A long note that keeps going past the barn, over the hill and out toward a coast nobody in this story has ever seen. '.repeat(8) }],
]

export default function Values() {
  return (
    <ThemeScope className="mx-auto max-w-2xl rounded-card bg-card p-4 shadow-hairline">
      <dl className="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1">
        {VALUES.map(([name, value]) => (
          <div key={name} className="contents">
            <dt className="text-caption whitespace-nowrap text-muted-foreground">{name}</dt>
            <dd className="m-0 min-w-0"><ObjectValue value={value} /></dd>
          </div>
        ))}
      </dl>
    </ThemeScope>
  )
}
