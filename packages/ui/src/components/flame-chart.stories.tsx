import { useMemo, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FlameChart, type FlameChartProps } from '@/components/ui/flame-chart';
import {
  FLAME_ERROR, FLAME_PENDING, FLAME_WAITING, criticalPath, deriveLinks, familyOf, flameData, packRows,
  type FlameData, type FlameLane, type FlameSpanInput,
} from '@/lib/flame-chart-model';
import { Phone } from '../stories/frame';

/* ── A checkout through five services, and a synthetic load of any size. Seeded, with no clock, so every run draws the
   same. ── */

const LANES: FlameLane[] = [
  { key: 'web', title: 'web', subtitle: 'browser' },
  { key: 'gateway', title: 'gateway', subtitle: 'gw-2' },
  { key: 'orders', title: 'orders', subtitle: 'orders-5c8f' },
  { key: 'payments', title: 'payments', subtitle: 'pay-1' },
  { key: 'inventory', title: 'inventory', subtitle: 'inv-3' },
];

function checkout(): FlameData {
  const spans: FlameSpanInput[] = [];
  let n = 0;
  const span = (lane: string, name: string, start: number, end: number, parent?: string, extra: Partial<FlameSpanInput> = {}) => {
    const id = `s${n++}`;
    spans.push({ id, parent, lane, name, start, end, ...extra });
    return id;
  };
  const click = span('web', 'click "Place order"', 0, 600);
  const call = span('web', 'fetch POST /api/checkout', 6, 560, click, { waiting: true });
  const gw = span('gateway', 'POST /checkout', 10, 556, call);
  span('gateway', 'auth.verify', 11, 20, gw);
  const route = span('gateway', 'route → orders', 22, 552, gw, { waiting: true });
  const order = span('orders', 'createOrder', 26, 548, route);
  span('orders', 'SELECT cart', 28, 44, order);
  for (let i = 0; i < 12; i++) span('orders', 'SELECT price', 45 + i * 1.1, 45.8 + i * 1.1, order);
  const reserve = span('orders', 'reserve stock', 60, 140, order, { waiting: true });
  const inv = span('inventory', 'POST /reserve', 64, 136, reserve);
  for (let i = 0; i < 6; i++) span('inventory', `lock sku-${100 + i}`, 66 + i * 10, 74 + i * 10, inv);
  const charge = span('orders', 'charge card', 144, 480, order, { waiting: true });
  const pay = span('payments', 'POST /charges', 148, 476, charge);
  span('payments', 'fraud.check', 150, 182, pay);
  span('payments', 'stripe.charge (attempt 1)', 184, 244, pay, { error: true });
  span('payments', 'backoff', 244, 304, pay, { waiting: true });
  span('payments', 'stripe.charge (attempt 2)', 304, 452, pay);
  span('payments', 'INSERT payment', 454, 470, pay);
  span('orders', 'INSERT order', 482, 500, order);
  const publish = span('orders', 'publish order.created', 501, 504, order);
  span('inventory', 'on order.created', 520, 760, publish, { pending: true });
  span('web', 'render confirmation', 562, 596, click);
  return flameData(LANES, spans);
}

function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` spans: requests every few tenths of a millisecond, trees a few levels deep that hop service a third of the time. */
function load(n: number): FlameData {
  const random = seeded(3);
  const lanes = LANES;
  const start = new Float64Array(n);
  const end = new Float64Array(n);
  const lane = new Uint16Array(n);
  const parent = new Int32Array(n);
  const name = new Uint32Array(n);
  const color = new Uint16Array(n);
  const flags = new Uint8Array(n);
  const names = ['GET /api/orders', 'SELECT orders', 'redis GET', 'grpc Charge', 'kafka publish', 'render', 'auth.verify', 'UPDATE stock'];
  let i = 0;
  const put = (s: number, e: number, l: number, p: number) => {
    start[i] = s;
    end[i] = e;
    lane[i] = l;
    parent[i] = p;
    name[i] = Math.floor(random() * names.length);
    color[i] = l;
    const r = random();
    flags[i] = r < 0.005 ? FLAME_ERROR : r < 0.008 ? FLAME_PENDING : 0;
    return i++;
  };
  const grow = (p: number, s: number, e: number, l: number, level: number) => {
    const kids = level > 4 ? 0 : 1 + Math.floor(random() * 4);
    let at = s + (e - s) * 0.04;
    const room = (e - s) * 0.92;
    for (let k = 0; k < kids && i < n - 1; k++) {
      const d = (room / kids) * (0.5 + random() * 0.45);
      const cl = random() < 0.33 ? Math.floor(random() * lanes.length) : l;
      if (cl !== l) {
        const client = put(at, at + d, l, p);
        flags[client] |= FLAME_WAITING;
        grow(put(at + d * 0.03, at + d * 0.97, cl, client), at + d * 0.03, at + d * 0.97, cl, level + 2);
      } else {
        grow(put(at, at + d, l, p), at, at + d, l, level + 1);
      }
      at += room / kids;
    }
  };
  for (let t = 0; i < n; t += 0.3 + random() * 0.2) {
    const d = 8 + random() * random() * 300;
    grow(put(t, t + d, 0, -1), t, t + d, 0, 0);
  }
  const depth = packRows(start, end, lane, parent);
  const data: FlameData = { lanes, start, end, lane, depth, parent, name, names, color, colors: lanes.map((_, l) => `var(--chart-${l + 1})`), flags };
  data.links = deriveLinks(data);
  return data;
}

/** A desktop-width frame. */
function Desktop({ dark, children, h = 520 }: { dark?: boolean; children?: ReactNode; h?: number }) {
  return (
    <Phone w={1280} h={h} appearance={dark ? 'dark' : 'light'}>
      <div className="absolute inset-0 overflow-hidden p-3">{children}</div>
    </Phone>
  );
}

/** A host that holds the selection and lights the selected span's family, as a trace view does. */
function Checkout(props: Partial<FlameChartProps> & { lightPath?: boolean }) {
  const { lightPath, ...rest } = props;
  const data = useMemo(checkout, []);
  const [selected, setSelected] = useState(rest.defaultSelected ?? -1);
  const highlight = useMemo(
    () => (selected < 0 ? null : lightPath ? criticalPath(data, selected) : familyOf(data, selected)),
    [data, selected, lightPath],
  );
  return <FlameChart data={data} frame="card" selected={selected} onSelectedChange={setSelected} highlight={highlight} {...rest} />;
}

/* ── Stories ── */

const meta: Meta<typeof FlameChart> = {
  title: 'Organisms/FlameChart',
  component: FlameChart,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof FlameChart>;

/** A checkout through five services: links between them, a declined charge that retried, a consumer still running.
 *  Press a span to light its family; wheel to zoom, shift-wheel to pan, `0` fits. */
export const Distributed: Story = {
  render: () => <Desktop><Checkout /></Desktop>,
};

export const DistributedDark: Story = {
  render: () => <Desktop dark><Checkout /></Desktop>,
};

/** The selected span's critical path lit: what made the root take as long as it did. */
export const CriticalPath: Story = {
  render: () => <Desktop><Checkout defaultSelected={0} lightPath /></Desktop>,
};

/** Zoomed in on the retry, with the payments lane's links strongest from the selected charge. */
export const Zoomed: Story = {
  render: () => <Desktop><Checkout defaultView={{ start: 140, end: 320 }} defaultSelected={14} /></Desktop>,
};

/** Two lanes collapsed to a strip of their top row. */
export const CollapsedLanes: Story = {
  render: () => <Desktop><Checkout defaultCollapsedLanes={['gateway', 'inventory']} /></Desktop>,
};

/** No minimap and no links: just the lanes. */
export const Plain: Story = {
  render: () => <Desktop><Checkout minimap={false} showLinks={false} /></Desktop>,
};

/** A phone's width: the gutter gives up room to the plot. */
export const Narrow: Story = {
  render: () => (
    <Phone w={390} h={600}>
      <div className="absolute inset-0 overflow-hidden p-2"><Checkout /></div>
    </Phone>
  ),
};

/** 200,000 spans: wheel to zoom from the whole load down to one query. */
export const TwoHundredThousand: Story = {
  render: () => {
    const Many = () => {
      const data = useMemo(() => load(200_000), []);
      return <FlameChart data={data} frame="card" className="h-[480px]" />;
    };
    return <Desktop><Many /></Desktop>;
  },
};
