import { useMemo, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/lib/icon';
import type { RowId } from '@/lib/log-list-model';
import { BLProvider } from '@/lib/theme';
import { Phone as PhoneFrame } from '../stories/frame';

/* Every row comes from a seeded generator, so a story draws the same pixels every time. */

const meta: Meta<typeof DataTable> = {
  title: 'Organisms/DataTable',
  component: DataTable,
  argTypes: { rows: { control: false }, columns: { control: false } },
};
export default meta;
type Story = StoryObj<typeof DataTable>;

interface Order { id: string; number: number; customer: string; city: string; items: number; total: number; status: 'Paid' | 'Refunded' | 'Pending'; placed: string }

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson', 'Edsger Dijkstra', 'Barbara Liskov', 'Donald Knuth', 'Margaret Hamilton', 'Ken Thompson', 'Frances Allen'];
const CITIES = ['London', 'New York', 'Manchester', 'Hampton', 'Amsterdam', 'Boston', 'Stanford', 'Paoli', 'Berkeley', 'Peru, NY'];
const STATUSES: Order['status'][] = ['Paid', 'Paid', 'Paid', 'Pending', 'Refunded'];

function makeOrders(count: number, seed = 7): Order[] {
  const random = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const who = Math.floor(random() * NAMES.length);
    const day = 1 + Math.floor(random() * 28);
    return {
      id: `order-${i}`,
      number: 10_400 + i,
      customer: NAMES[who],
      city: CITIES[who],
      items: 1 + Math.floor(random() * 6),
      total: Math.round((8 + random() * 240) * 100) / 100,
      status: STATUSES[Math.floor(random() * STATUSES.length)],
      placed: `2026-10-${String(day).padStart(2, '0')}`,
    };
  });
}

const ORDERS = makeOrders(120);
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const TONE = { Paid: 'success', Pending: 'warning', Refunded: 'secondary' } as const;

const COLUMNS: DataTableColumn<Order>[] = [
  { id: 'number', header: 'Order', width: 84, cell: (o) => `#${o.number}`, sortValue: (o) => o.number, className: 'tabular-nums text-muted-foreground' },
  { id: 'customer', header: 'Customer', flex: 2, minWidth: 140 },
  { id: 'city', header: 'City', flex: 1, minWidth: 100, hideBelow: 'regular' },
  { id: 'status', header: 'Status', width: 96, cell: (o) => <Badge size="sm" variant={TONE[o.status]}>{o.status}</Badge>, sortValue: (o) => o.status },
  { id: 'items', header: 'Items', width: 64, align: 'end' },
  { id: 'total', header: 'Total', width: 96, align: 'end', cell: (o) => money.format(o.total), sortValue: (o) => o.total },
  { id: 'placed', header: 'Placed', width: 104, hideBelow: 'regular', className: 'tabular-nums' },
];

function Desktop({ children, dark }: { children?: ReactNode; dark?: boolean }) {
  return (
    <div className="h-dvh w-full">
      <BLProvider appearance={dark ? 'dark' : 'light'}>
        <div className="flex h-full min-h-0 flex-col gap-2 p-3">{children}</div>
      </BLProvider>
    </div>
  );
}

function PhoneWindow({ children, dark }: { children?: ReactNode; dark?: boolean }) {
  return (
    <PhoneFrame w={390} h={844} appearance={dark ? 'dark' : 'light'}>
      <div className="flex h-full min-h-0 flex-col gap-2 p-2">{children}</div>
    </PhoneFrame>
  );
}

export const Default: Story = {
  render: () => <Desktop><DataTable aria-label="Orders" rows={ORDERS} columns={COLUMNS} defaultValue="order-3" className="min-h-0 flex-1" /></Desktop>,
};

/** `compact` packs the most rows in; `comfortable` suits touch. */
export const Density: Story = {
  render: () => (
    <Desktop>
      <DataTable aria-label="Orders, compact" rows={ORDERS} columns={COLUMNS} density="compact" className="min-h-0 flex-1" />
      <DataTable aria-label="Orders, comfortable" rows={ORDERS} columns={COLUMNS} density="comfortable" className="min-h-0 flex-1" />
    </Desktop>
  ),
};

export const Sorted: Story = {
  render: () => <Desktop><DataTable aria-label="Orders" rows={ORDERS} columns={COLUMNS} defaultSort={{ column: 'total', direction: 'descending' }} className="min-h-0 flex-1" /></Desktop>,
};

/** A summary and actions in the `toolbar`, a line after the last row in the `footer`, and rows that only press. */
function ToolbarDemo() {
  const [opened, setOpened] = useState<RowId | null>(null);
  const rows = useMemo(() => ORDERS.slice(0, 24), []);
  return (
    <DataTable
      aria-label="Orders"
      rows={rows}
      columns={COLUMNS}
      mode="none"
      onAction={(id) => setOpened(id)}
      className="min-h-0 flex-1"
      toolbar={(
        <>
          <span className="min-w-0 flex-1 truncate text-footnote text-muted-foreground" role="status">{opened ? `Opened ${opened}` : '24 orders this week'}</span>
          <Button variant="ghost" size="sm"><Icon name="arrow-down" size={12} /> Export</Button>
        </>
      )}
      footer="Showing this week only"
    />
  );
}

export const WithToolbar: Story = {
  render: () => <Desktop><ToolbarDemo /></Desktop>,
};

export const Empty: Story = {
  render: () => (
    <Desktop>
      <DataTable
        aria-label="Orders"
        rows={[]}
        columns={COLUMNS}
        className="min-h-0 flex-1"
        emptyState={<EmptyState size="sm" icon={<Icon name="cart" size={20} />} title="No orders yet" description="Orders show here as they come in." />}
      />
    </Desktop>
  ),
};

/** A query in flight: placeholder rows at the rows' height, not "No rows", and the grid is `aria-busy`. */
export const Loading: Story = {
  render: () => <Desktop><DataTable aria-label="Orders" rows={[]} columns={COLUMNS} loading className="min-h-0 flex-1" /></Desktop>,
};

export const LoadingDark: Story = {
  render: () => <Desktop dark><DataTable aria-label="Orders" rows={[]} columns={COLUMNS} loading className="min-h-0 flex-1" /></Desktop>,
};

export const LoadingPhone: Story = {
  render: () => <PhoneWindow><DataTable aria-label="Orders" rows={[]} columns={COLUMNS} loading className="min-h-0 flex-1" /></PhoneWindow>,
};

/** `navigation="row"`: the arrow keys move whole rows (← → scroll sideways), for a list of things more than a table of values. */
export const RowNavigation: Story = {
  render: () => <Desktop><DataTable aria-label="Orders" rows={ORDERS} columns={COLUMNS} navigation="row" className="min-h-0 flex-1" /></Desktop>,
};

let many: Order[] | undefined;
const hundredThousand = () => (many ??= makeOrders(100_000, 11));

/** 100,000 rows: only the ones in view are in the page. */
export const HundredThousand: Story = {
  render: () => <Desktop><DataTable aria-label="Orders" rows={hundredThousand()} columns={COLUMNS} density="compact" className="min-h-0 flex-1" /></Desktop>,
};

export const Dark: Story = {
  render: () => <Desktop dark><DataTable aria-label="Orders" rows={ORDERS} columns={COLUMNS} defaultValue="order-3" className="min-h-0 flex-1" /></Desktop>,
};

/** Under 480 px of its own width the rows stack, the first column's cell over the others', and sorting is a menu. */
export const Phone: Story = {
  render: () => <PhoneWindow><DataTable aria-label="Orders" rows={ORDERS} columns={COLUMNS} className="min-h-0 flex-1" /></PhoneWindow>,
};

export const PhoneDark: Story = {
  render: () => <PhoneWindow dark><DataTable aria-label="Orders" rows={ORDERS} columns={COLUMNS} defaultValue="order-1" className="min-h-0 flex-1" /></PhoneWindow>,
};
