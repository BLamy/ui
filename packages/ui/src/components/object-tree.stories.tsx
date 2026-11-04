import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { ObjectTree } from '@/components/ui/object-tree';
import { nodeFromValue, type ObjectTreeGetterResult, type ObjectTreeNode } from '@/lib/object-tree-model';
import type { ValuePreview } from '@/lib/object-tree-value';
import { Phone } from '../stories/frame';

const meta: Meta<typeof ObjectTree> = {
  title: 'Organisms/ObjectTree',
  component: ObjectTree,
};
export default meta;
type Story = StoryObj<typeof ObjectTree>;

/* Everything here is fixed data, so the stories look the same on every run. */

const leaf = (name: string, value: ValuePreview, dim?: boolean): ObjectTreeNode => ({ id: name, name, value, ...(dim ? { dim } : {}) });
const str = (value: string): ValuePreview => ({ type: 'string', value });
const num = (value: number | string): ValuePreview => ({ type: 'number', value });

const cartValue: ValuePreview = {
  type: 'object',
  className: 'Cart',
  properties: [
    { name: 'id', value: str('c_81f2') },
    { name: 'items', value: { type: 'array', length: 3 } },
    { name: 'total', value: num(148.5) },
    { name: 'owner', value: { type: 'object', className: 'User' } },
  ],
};
const itemsValue: ValuePreview = {
  type: 'array',
  length: 3,
  items: [{ type: 'object', className: 'LineItem' }, { type: 'object', className: 'LineItem' }, { type: 'object', className: 'LineItem' }],
};

const LONG_TEXT = 'The quick brown fox jumps over the lazy dog, and keeps on going past the barn, over the hill, through a long winding valley and out toward a coast nobody in this story has ever seen. '.repeat(40);

/** What the stories' pretend engine holds, by the handle a node carries. */
const HELD: Record<string, ObjectTreeNode[]> = {
  cart: [
    leaf('id', str('c_81f2')),
    { id: 'items', name: 'items', value: itemsValue, hasChildren: true, data: 'items' },
    leaf('total', num(148.5)),
    { id: 'owner', name: 'owner', value: { type: 'object', className: 'User', properties: [{ name: 'name', value: str('Ada') }, { name: 'admin', value: { type: 'boolean', value: true } }] }, hasChildren: true, data: 'user' },
    { id: 'count', name: 'count', value: { type: 'accessor' }, data: 'getter:count' },
    { id: 'proto', name: '[[Prototype]]', value: { type: 'object', className: 'Object' }, dim: true, hasChildren: true, data: 'proto' },
  ],
  items: [
    { id: '0', name: '0', value: { type: 'object', className: 'LineItem', properties: [{ name: 'sku', value: str('TEA-01') }, { name: 'qty', value: num(2) }] }, hasChildren: true, data: 'empty' },
    { id: '1', name: '1', value: { type: 'object', className: 'LineItem', properties: [{ name: 'sku', value: str('MUG-07') }, { name: 'qty', value: num(1) }] }, hasChildren: true, data: 'empty' },
    { id: '2', name: '2', value: { type: 'object', className: 'LineItem', properties: [{ name: 'sku', value: str('POT-03') }, { name: 'qty', value: num(1) }] }, hasChildren: true, data: 'empty' },
    leaf('length', num(3), true),
  ],
  user: [leaf('name', str('Ada')), leaf('admin', { type: 'boolean', value: true })],
  proto: [
    leaf('constructor', { type: 'function', name: 'Object', params: '' }, true),
    leaf('toString', { type: 'function', name: 'toString', params: '' }, true),
  ],
  empty: [],
  local: [
    { id: 'cart', name: 'cart', value: cartValue, hasChildren: true, data: 'cart' },
    leaf('quantity', num(2)),
    leaf('sku', str('TEA-01')),
    leaf('discount', { type: 'null' }),
    leaf('coupon', { type: 'undefined' }),
    leaf('isGift', { type: 'boolean', value: false }),
    leaf('nextId', { type: 'bigint', value: '9007199254740993' }),
    leaf('total', { type: 'unavailable', label: '<uninitialized>' }),
    leaf('note', str(LONG_TEXT)),
  ],
  closure: [
    leaf('MAX_ITEMS', num(50)),
    leaf('formatPrice', { type: 'function', name: 'formatPrice', params: 'amount, currency' }),
    leaf('reload', { type: 'function', name: 'reload', params: '', flavor: 'async' }),
    leaf('Cart', { type: 'function', name: 'Cart', flavor: 'class' }),
    { id: 'seen', name: 'seen', value: { type: 'set', size: 2, items: [str('TEA-01'), str('MUG-07')] }, hasChildren: true, data: 'empty' },
    { id: 'prices', name: 'prices', value: { type: 'map', size: 2, entries: [{ key: str('TEA-01'), value: num(12.5) }, { key: str('MUG-07'), value: num(18) }] }, hasChildren: true, data: 'empty' },
  ],
  global: [
    leaf('document', { type: 'object', className: 'HTMLDocument' }),
    leaf('location', { type: 'object', className: 'Location', properties: [{ name: 'href', value: str('https://shop.example/cart') }], overflow: true }),
    leaf('performance', { type: 'object', className: 'Performance' }),
    leaf('undefined', { type: 'undefined' }, true),
  ],
};

const SCOPES: ObjectTreeNode[] = [
  { id: 'this', name: 'this', value: { type: 'object', className: 'CartView', properties: [{ name: 'el', value: { type: 'object', className: 'div.cart' } }, { name: 'open', value: { type: 'boolean', value: true } }] }, hasChildren: true, data: 'empty' },
  { id: 'local', name: 'addItem (local)', section: true, data: 'local' },
  { id: 'closure', name: 'useCart (closure)', section: true, data: 'closure' },
  { id: 'global', name: 'Global', section: true, defaultExpanded: false, data: 'global' },
];

const loadHeld = (node: ObjectTreeNode) => HELD[String(node.data)] ?? [];
const answerGetter = (): ObjectTreeGetterResult => ({ value: num(4) });

function Frame({ w = 760, h = 560, dark, children }: { w?: number; h?: number; dark?: boolean; children?: React.ReactNode }) {
  return <Phone w={w} h={h} dark={dark}><div className="absolute inset-0 bg-card py-2">{children}</div></Phone>;
}

function Scopes({ selectable }: { selectable?: boolean }) {
  const [selected, setSelected] = useState('');
  return (
    <div className="flex h-full flex-col">
      <ObjectTree aria-label="Scopes" root={SCOPES} loadChildren={loadHeld} onInvokeGetter={answerGetter} onSelect={selectable ? (n) => setSelected(n?.name ?? '') : undefined} />
      {selectable ? <div className="shrink-0 px-3 py-2 text-caption text-muted-foreground shadow-hairline-t">Selected: {selected || 'nothing'}</div> : null}
    </div>
  );
}

export const ScopesDesktop: Story = { render: () => <Frame><Scopes /></Frame> };
export const ScopesDark: Story = { render: () => <Frame dark><Scopes /></Frame> };
export const ScopesPhone: Story = { name: 'Scopes, phone', render: () => <Frame w={390} h={720}><Scopes /></Frame> };
export const ScopesPhoneDark: Story = { name: 'Scopes, phone dark', render: () => <Frame w={390} h={720} dark><Scopes /></Frame> };
export const Selection: Story = { render: () => <Frame><Scopes selectable /></Frame> };

/* ── Lazy children: one answers, one never does, one fails ── */

const LAZY_ROOT: ObjectTreeNode[] = [
  { id: 'answers', name: 'answers', value: { type: 'object', properties: [{ name: 'ok', value: { type: 'boolean', value: true } }] }, hasChildren: true, defaultExpanded: true, data: 'answers' },
  { id: 'waiting', name: 'waiting', value: { type: 'object', className: 'Response' }, hasChildren: true, defaultExpanded: true, data: 'waiting' },
  { id: 'fails', name: 'fails', value: { type: 'object', className: 'Socket' }, hasChildren: true, defaultExpanded: true, data: 'fails' },
  { id: 'nothing', name: 'nothing', value: { type: 'object', properties: [] }, hasChildren: true, defaultExpanded: true, data: 'nothing' },
  { id: 'after', name: 'after', value: num(7) },
];

const NEVER = new Promise<ObjectTreeNode[]>(() => {});

function loadLazy(node: ObjectTreeNode): Promise<ObjectTreeNode[]> {
  switch (node.data) {
    case 'answers': return Promise.resolve([leaf('ok', { type: 'boolean', value: true }), leaf('status', num(200))]);
    case 'waiting': return NEVER;
    case 'fails': return Promise.reject(new Error('The engine has no object 8813'));
    default: return Promise.resolve([]);
  }
}

export const LazyChildren: Story = { render: () => <Frame h={320}><ObjectTree aria-label="Lazy children" root={LAZY_ROOT} loadChildren={loadLazy} /></Frame> };
export const LazyChildrenPhone: Story = { name: 'Lazy children, phone', render: () => <Frame w={390} h={320}><ObjectTree aria-label="Lazy children" root={LAZY_ROOT} loadChildren={loadLazy} /></Frame> };

/* ── A new root drops what was on its way ── */

function SteppingDemo() {
  const [step, setStep] = useState(1);
  const root = useMemo<ObjectTreeNode[]>(() => [
    { id: 'state', name: 'state', value: { type: 'object', className: 'State', properties: [{ name: 'step', value: num(step) }] }, hasChildren: true, defaultExpanded: true, data: step },
  ], [step]);
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 p-2 shadow-hairline-b">
        <Button size="sm" variant="secondary" onPress={() => setStep((s) => s + 1)}>Step</Button>
        <span className="text-caption text-muted-foreground">Answers take 600 ms. Step while one is on its way: only the last step's answer shows.</span>
      </div>
      <ObjectTree
        aria-label="State at this step"
        root={root}
        loadChildren={(node) => new Promise((resolve) => { setTimeout(() => resolve([leaf('step', num(node.data as number)), leaf('doubled', num((node.data as number) * 2))]), 600); })}
      />
    </div>
  );
}
export const NewRootDropsOldAnswers: Story = { render: () => <Frame h={320}><SteppingDemo /></Frame> };

/* ── Getters ── */

const GETTERS: ObjectTreeNode[] = [
  { id: 'size', name: 'size', value: { type: 'accessor' }, data: 'number' },
  { id: 'owner', name: 'owner', value: { type: 'accessor' }, data: 'object' },
  { id: 'broken', name: 'broken', value: { type: 'accessor' }, data: 'throws' },
  { id: 'slow', name: 'slow', value: { type: 'accessor' }, data: 'slow' },
];

function invokeGetter(node: ObjectTreeNode): Promise<ObjectTreeGetterResult> {
  switch (node.data) {
    case 'number': return Promise.resolve({ value: num(4) });
    case 'object': return Promise.resolve({ value: { type: 'object', className: 'User', properties: [{ name: 'name', value: str('Ada') }] }, hasChildren: true, data: 'user' });
    case 'slow': return new Promise((resolve) => { setTimeout(() => resolve({ value: str('took a while') }), 1500); });
    default: return Promise.reject(new Error('Getter threw: not ready'));
  }
}

export const Getters: Story = { render: () => <Frame h={240}><ObjectTree aria-label="Getters" root={GETTERS} loadChildren={loadHeld} onInvokeGetter={invokeGetter} /></Frame> };

/* ── Large collections: `loadChildren` hands over all 100,000 nodes at once ── */

const HUNDRED_THOUSAND: ObjectTreeNode = {
  id: 'samples',
  name: 'samples',
  value: { type: 'array', length: 100000, items: [num(0), num(3), num(6), num(9), num(12)], overflow: true },
  hasChildren: true,
  defaultExpanded: true,
};
const HUNDRED_THOUSAND_ROOT: ObjectTreeNode[] = [HUNDRED_THOUSAND, leaf('after', str('still here'))];

function loadHundredThousand(): ObjectTreeNode[] {
  const nodes: ObjectTreeNode[] = [];
  for (let i = 0; i < 100000; i++) nodes.push({ id: String(i), name: String(i), value: num(i * 3) });
  nodes.push(leaf('length', num(100000), true));
  return nodes;
}

export const HundredThousand: Story = { render: () => <Frame><ObjectTree aria-label="A large array" root={HUNDRED_THOUSAND_ROOT} loadChildren={loadHundredThousand} /></Frame> };
export const HundredThousandPhone: Story = { name: 'Hundred thousand, phone', render: () => <Frame w={390} h={720}><ObjectTree aria-label="A large array" root={HUNDRED_THOUSAND_ROOT} loadChildren={loadHundredThousand} /></Frame> };

/* ── Deep and long: the indent stops, and names and values share what's left ── */

function deep(level: number): ObjectTreeNode {
  const value: ValuePreview = { type: 'object', className: `Level${level}`, properties: [{ name: 'depth', value: num(level) }, { name: 'label', value: str(`level ${level}`) }] };
  return {
    id: `level-${level}`,
    name: level % 3 === 0 ? `aVeryLongPropertyNameThatKeepsGoingAtLevel${level}` : `child${level}`,
    value,
    defaultExpanded: true,
    children: level === 14 ? [leaf('deepest', str('a value at the bottom that is long enough to need the whole row, and then some more')), leaf('n', num(14))] : [deep(level + 1)],
  };
}
const DEEP = [deep(1)];

export const DeepNesting: Story = { render: () => <Frame h={480}><ObjectTree aria-label="Deeply nested" root={DEEP} /></Frame> };
export const DeepNestingPhone: Story = { name: 'Deep nesting, phone', render: () => <Frame w={390} h={480}><ObjectTree aria-label="Deeply nested" root={DEEP} /></Frame> };

/* ── Any JSON-like data, no loader needed ── */

const circular: Record<string, unknown> = { name: 'loop' };
circular.self = circular;

const DATA = {
  id: 'evt_123',
  ok: true,
  count: 3,
  nothing: null,
  missing: undefined,
  when: new Date(Date.UTC(2026, 10, 3, 9, 41)),
  pattern: /^evt_[a-z0-9]+$/gi,
  big: 12345678901234567890n,
  tag: Symbol('session'),
  failure: Object.assign(new RangeError('Index out of range'), { stack: 'RangeError: Index out of range\n    at read (reader.js:12:9)\n    at main (index.js:3:1)' }),
  lookup: new Map<unknown, unknown>([['a', 1], ['b', { nested: true }]]),
  unique: new Set(['x', 'y', 'z']),
  bytes: new Uint8Array([1, 2, 3, 4]),
  list: [1, 'two', { three: 3 }, [4]],
  format: function format(value: unknown, width: number) { return String(value).padStart(width); },
  get computed() { return 42; },
  circular,
};

export const JsonData: Story = { render: () => <Frame h={560}><ObjectTree aria-label="Any data" root={nodeFromValue(DATA, { defaultExpanded: true })} /></Frame> };
export const JsonDataPhone: Story = { name: 'JSON data, phone', render: () => <Frame w={390} h={560}><ObjectTree aria-label="Any data" root={nodeFromValue(DATA, { defaultExpanded: true })} /></Frame> };
