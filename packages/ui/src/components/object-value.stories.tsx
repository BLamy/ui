import type { Meta, StoryObj } from '@storybook/react-vite';
import { ObjectValue } from '@/components/ui/object-value';
import { previewFromValue, type ValuePreview } from '@/lib/object-tree-value';
import { Phone } from '../stories/frame';

const meta: Meta<typeof ObjectValue> = {
  title: 'Atoms/ObjectValue',
  component: ObjectValue,
};
export default meta;
type Story = StoryObj<typeof ObjectValue>;

/* Fixed data, so the stories look the same on every run. */

const STACK = 'TypeError: Cannot read properties of undefined (reading \'total\')\n    at lineTotal (cart/line-item.tsx:87:3)\n    at LineItem (cart/line-item.tsx:31:3)\n    at renderWithHooks (react-dom-client.development.js:14985:9)';
const LONG_TEXT = 'The quick brown fox jumps over the lazy dog, and keeps on going past the barn, over the hill and out toward a coast nobody in this story has ever seen. '.repeat(30);

const VALUES: [string, ValuePreview][] = [
  ['string', { type: 'string', value: 'hello "world"\nsecond line' }],
  ['number', { type: 'number', value: 42 }],
  ['not a number', { type: 'number', value: 'NaN' }],
  ['negative zero', { type: 'number', value: '-0' }],
  ['boolean', { type: 'boolean', value: true }],
  ['null', { type: 'null' }],
  ['undefined', { type: 'undefined' }],
  ['bigint', { type: 'bigint', value: '9007199254740993' }],
  ['symbol', { type: 'symbol', value: 'Symbol(session)' }],
  ['function', { type: 'function', name: 'formatPrice', params: 'amount, currency' }],
  ['async function', { type: 'function', name: 'reload', flavor: 'async' }],
  ['generator', { type: 'function', name: 'walk', params: 'tree', flavor: 'generator' }],
  ['class', { type: 'function', name: 'Cart', flavor: 'class' }],
  ['object', { type: 'object', properties: [{ name: 'id', value: { type: 'string', value: 'c_81f2' } }, { name: 'total', value: { type: 'number', value: 148.5 } }, { name: 'owner', value: { type: 'object', className: 'User' } }, { name: 'tags', value: { type: 'array', length: 2 } }, { name: 'data-id', value: { type: 'null' } }], overflow: true }],
  ['class instance', { type: 'object', className: 'Cart', properties: [{ name: 'open', value: { type: 'boolean', value: true } }] }],
  ['object, unread', { type: 'object', className: 'HTMLDivElement' }],
  ['empty object', { type: 'object', properties: [] }],
  ['array', { type: 'array', length: 3, items: [{ type: 'number', value: 1 }, { type: 'string', value: 'two' }, { type: 'object' }] }],
  ['long array', { type: 'array', length: 100000, items: [{ type: 'number', value: 0 }, { type: 'number', value: 3 }, { type: 'number', value: 6 }], overflow: true }],
  ['typed array', { type: 'array', className: 'Uint8Array', length: 4, items: [{ type: 'number', value: 1 }, { type: 'number', value: 2 }, { type: 'number', value: 3 }, { type: 'number', value: 4 }] }],
  ['empty array', { type: 'array', items: [] }],
  ['map', { type: 'map', size: 2, entries: [{ key: { type: 'string', value: 'TEA-01' }, value: { type: 'number', value: 12.5 } }, { key: { type: 'string', value: 'MUG-07' }, value: { type: 'object', className: 'Price' } }] }],
  ['set', { type: 'set', size: 2, items: [{ type: 'string', value: 'TEA-01' }, { type: 'string', value: 'MUG-07' }] }],
  ['map entry', { type: 'entry', key: { type: 'string', value: 'TEA-01' }, value: { type: 'number', value: 12.5 } }],
  ['date', { type: 'date', value: '2026-11-03T09:41:00.000Z' }],
  ['regexp', { type: 'regexp', value: '/^evt_[a-z0-9]+$/gi' }],
  ['error', { type: 'error', name: 'TypeError', message: 'Cannot read properties of undefined (reading \'total\')' }],
  ['getter', { type: 'accessor' }],
  ['uninitialized', { type: 'unavailable', label: '<uninitialized>' }],
  ['unavailable', { type: 'unavailable' }],
];

function Table() {
  return (
    <div className="bl-scroll absolute inset-0 overflow-auto bg-card p-3">
      <dl className="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1">
        {VALUES.map(([name, value]) => (
          <div key={name} className="contents">
            <dt className="text-caption2 whitespace-nowrap text-muted-foreground">{name}</dt>
            <dd className="m-0 min-w-0"><ObjectValue value={value} /></dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export const AllTypes: Story = { render: () => <Phone w={760} h={720}><Table /></Phone> };
export const AllTypesDark: Story = { render: () => <Phone w={760} h={720} dark><Table /></Phone> };
export const AllTypesPhone: Story = { name: 'All types, phone', render: () => <Phone w={390} h={760}><Table /></Phone> };
export const AllTypesPhoneDark: Story = { name: 'All types, phone dark', render: () => <Phone w={390} h={760} dark><Table /></Phone> };

function Long() {
  return (
    <div className="bl-scroll absolute inset-0 flex flex-col gap-3 overflow-auto bg-card p-3">
      <ObjectValue value={{ type: 'string', value: LONG_TEXT }} />
      <ObjectValue value={{ type: 'error', name: 'TypeError', message: 'Cannot read properties of undefined (reading \'total\')', stack: STACK }} />
      <div className="text-footnote text-foreground">Console text, unquoted: <ObjectValue value={{ type: 'string', value: 'Saved 3 items' }} quote={false} /></div>
      <ObjectValue value={previewFromValue({ a: 1, b: [2, 3], c: new Map([['k', 'v']]) })} />
    </div>
  );
}

export const LongStrings: Story = { render: () => <Phone w={760} h={360}><Long /></Phone> };
export const LongStringsPhone: Story = { name: 'Long strings, phone', render: () => <Phone w={390} h={420}><Long /></Phone> };
