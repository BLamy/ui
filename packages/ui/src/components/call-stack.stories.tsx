import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CallStack } from '@/components/ui/call-stack';
import type { CallStackFrame } from '@/lib/call-stack';
import { Phone } from '../stories/frame';

const meta: Meta<typeof CallStack> = {
  title: 'Organisms/CallStack',
  component: CallStack,
};
export default meta;
type Story = StoryObj<typeof CallStack>;

/* Fixed data, so the stories look the same on every run. */

const REACT_DOM = 'https://shop.example/_next/static/chunks/node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js';

const react = (id: string, functionName: string, line: number): CallStackFrame => ({
  id, functionName, kind: 'framework', label: 'React', location: { file: REACT_DOM, line, column: 9 },
});
const app = (id: string, functionName: string, file: string, line: number, column = 3): CallStackFrame => ({
  id, functionName, location: { file: `/Users/ada/projects/shop/src/${file}`, line, column },
});

const CHECKOUT: CallStackFrame[] = [
  app('a', 'formatPrice', 'lib/money.ts', 42, 11),
  { id: 'long', functionName: 'CheckoutSummaryProvider.useMemoizedShippingEstimateCalculationForRegion', location: { file: '/Users/ada/projects/shop/src/features/checkout/shipping/generated/shipping-estimate-calculation.generated.bundle.js', line: 18234, column: 12 } },
  app('b', 'lineTotal', 'cart/line-item.tsx', 87),
  app('c', 'LineItem', 'cart/line-item.tsx', 31),
  react('r1', 'renderWithHooks', 14985),
  react('r2', 'updateFunctionComponent', 17356),
  react('r3', 'beginWork', 19073),
  app('d', 'CartPage', 'app/cart/page.tsx', 18),
  { id: 'await-1', kind: 'async', label: 'await loadCart' },
  app('e', 'loadCart', 'cart/load.ts', 9),
  { id: 'lib-1', functionName: 'fetchJson', kind: 'library', location: { file: '/Users/ada/projects/shop/node_modules/ky/distribution/index.js', line: 203, column: 5 } },
  { id: 'lib-2', functionName: 'request', kind: 'library', location: { file: '/Users/ada/projects/shop/node_modules/ky/distribution/index.js', line: 88, column: 3 } },
  { id: 'timeout-1', kind: 'async', label: 'setTimeout' },
  app('f', 'scheduleRefresh', 'cart/refresh.ts', 54),
  { id: 'anon', location: { file: '/Users/ada/projects/shop/src/cart/refresh.ts', line: 12, column: 1 } },
  { id: 'native', functionName: 'MessagePort.performWork', kind: 'library' },
];

function Frame({ w = 760, h = 560, dark, children }: { w?: number; h?: number; dark?: boolean; children?: React.ReactNode }) {
  return <Phone w={w} h={h} dark={dark}><div className="absolute inset-0 bg-card py-2">{children}</div></Phone>;
}

function Stack({ frames, initial }: { frames: readonly CallStackFrame[]; initial: string }) {
  const [selected, setSelected] = useState(initial);
  return <CallStack frames={frames} selectedId={selected} onSelect={(f) => setSelected(f.id)} />;
}

export const Desktop: Story = { render: () => <Frame><Stack frames={CHECKOUT} initial="a" /></Frame> };
export const SelectedBelowTheTop: Story = { render: () => <Frame><Stack frames={CHECKOUT} initial="d" /></Frame> };
export const Dark: Story = { render: () => <Frame dark><Stack frames={CHECKOUT} initial="d" /></Frame> };
export const PhoneWidth: Story = { name: 'Phone', render: () => <Frame w={390} h={720}><Stack frames={CHECKOUT} initial="d" /></Frame> };
export const PhoneDark: Story = { name: 'Phone, dark', render: () => <Frame w={390} h={720} dark><Stack frames={CHECKOUT} initial="d" /></Frame> };
export const Empty: Story = { render: () => <Frame h={200}><CallStack frames={[]} emptyMessage="No JS is on the stack at this point." /></Frame> };

/** A stopped frame, a thousand rounds of recursion through app and React frames, and two async boundaries. */
function recursiveStack(rounds: number): CallStackFrame[] {
  const out: CallStackFrame[] = [app('top', 'visit', 'tree/walk.ts', 12, 7)];
  for (let i = 0; i < rounds; i++) {
    out.push(app(`walk-${i}`, 'walk', 'tree/walk.ts', 40 + (i % 3)));
    if (i % 50 === 0) {
      out.push(react(`r-${i}-1`, 'renderWithHooks', 14985), react(`r-${i}-2`, 'updateFunctionComponent', 17356), react(`r-${i}-3`, 'beginWork', 19073));
      out.push(app(`tree-${i}`, 'TreeNode', 'tree/node.tsx', 22));
    }
    if (i === Math.floor(rounds / 2)) out.push({ id: 'await-walk', kind: 'async', label: 'await loadChildren' });
    if (i === Math.floor(rounds / 4)) out.push({ id: 'timer-walk', kind: 'async', label: 'requestAnimationFrame' });
  }
  out.push(app('main', 'main', 'index.ts', 3, 1));
  return out;
}
const RECURSIVE = recursiveStack(1000);

export const Recursive: Story = { render: () => <Frame><Stack frames={RECURSIVE} initial="top" /></Frame> };
export const RecursivePhone: Story = { name: 'Recursive, phone', render: () => <Frame w={390} h={720}><Stack frames={RECURSIVE} initial="top" /></Frame> };
export const SelectedDeep: Story = { render: () => <Frame><Stack frames={RECURSIVE} initial="walk-640" /></Frame> };
export const AllFramesOpen: Story = { render: () => <Frame><CallStack frames={CHECKOUT} collapseRuns={false} defaultSelectedId="b" /></Frame> };
export const OpenRun: Story = { render: () => <Frame><CallStack frames={CHECKOUT} defaultExpandedRuns={['r1']} defaultSelectedId="r2" /></Frame> };
export const OpenRunPhone: Story = { name: 'Open run, phone', render: () => <Frame w={390} h={720}><CallStack frames={CHECKOUT} defaultExpandedRuns={['r1']} defaultSelectedId="r2" /></Frame> };
