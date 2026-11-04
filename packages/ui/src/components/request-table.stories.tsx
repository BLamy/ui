import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { RequestLink, RequestTable, type RequestColumn, type RequestTableHandle } from '@/components/ui/request-table';
import { Slider, SliderThumb, SliderTrack } from '@/components/ui/slider';
import { Icon } from '@/lib/icon';
import { formatLogTime, type RowId } from '@/lib/log-list-model';
import { usePlaybackClock, usePlaybackState } from '@/lib/playback';
import { requestTimeRange, type RequestRow, type RequestTone } from '@/lib/request-table-model';
import { BLProvider } from '@/lib/theme';
import { Phone as PhoneFrame } from '../stories/frame';

/* Every row comes from a seeded generator with no clock, so a story draws the same pixels every time. */

const meta: Meta<typeof RequestTable> = {
  title: 'Organisms/RequestTable',
  component: RequestTable,
  argTypes: { rows: { control: false } },
};
export default meta;
type Story = StoryObj<typeof RequestTable>;

/** mulberry32: the same numbers from the same seed. */
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

const ROUTES: { url: (n: number) => string; method: string; type: string; size: number }[] = [
  { url: (n) => `https://shop.example.com/api/cart?user=${n % 80}`, method: 'GET', type: 'fetch', size: 1840 },
  { url: (n) => `https://shop.example.com/api/products/${n % 400}`, method: 'GET', type: 'fetch', size: 5200 },
  { url: () => 'https://shop.example.com/api/checkout', method: 'POST', type: 'fetch', size: 420 },
  { url: (n) => `https://shop.example.com/_serverFn/getSession?v=${n % 9}`, method: 'POST', type: 'xhr', size: 310 },
  { url: (n) => `https://cdn.example.com/assets/chunk-${(n * 2654435761 % 4096).toString(16)}.js`, method: 'GET', type: 'script', size: 88_000 },
  { url: (n) => `https://cdn.example.com/img/product-${n % 300}.webp`, method: 'GET', type: 'img', size: 240_000 },
  { url: () => 'https://cdn.example.com/fonts/inter-var.woff2', method: 'GET', type: 'font', size: 96_000 },
  { url: () => 'https://shop.example.com/styles/app.css', method: 'GET', type: 'css', size: 34_000 },
];

const TONES: Record<string, RequestTone> = { fetch: 'primary', xhr: 'primary', script: 'warning', img: 'success', font: 'accent', css: 'accent' };

function makeRequests(count: number, { seed = 5, step = 120 }: { seed?: number; step?: number } = {}): RequestRow[] {
  const random = seeded(seed);
  const rows: RequestRow[] = new Array(count);
  let time = 0;
  for (let i = 0; i < count; i++) {
    const route = ROUTES[Math.floor(random() * ROUTES.length)];
    time += Math.floor(random() * step * 2);
    const roll = random();
    const status = roll > 0.97 ? 500 : roll > 0.94 ? 404 : roll > 0.92 ? 0 : roll > 0.88 ? 304 : 200;
    rows[i] = {
      id: `request-${i}`,
      url: route.url(i),
      method: route.method,
      status,
      type: route.type,
      size: status === 0 ? undefined : Math.floor(route.size * (0.4 + random())),
      time,
      duration: Math.floor(8 + random() * random() * 900),
      tone: TONES[route.type],
    };
  }
  return rows;
}

const SMALL = makeRequests(400);
const SMALL_RANGE = requestTimeRange(SMALL);

function Desktop({ children, dark }: { children?: ReactNode; dark?: boolean }) {
  return (
    <div className="h-dvh w-full">
      <BLProvider dark={dark}>
        <div className="flex h-full min-h-0 flex-col gap-2 p-3">{children}</div>
      </BLProvider>
    </div>
  );
}

function PhoneWindow({ children, dark }: { children?: ReactNode; dark?: boolean }) {
  return (
    <PhoneFrame w={390} h={844} dark={dark}>
      <div className="flex h-full min-h-0 flex-col gap-2 p-2">{children}</div>
    </PhoneFrame>
  );
}

const PLAYHEAD = SMALL[60].time;

export const Default: Story = {
  args: { rows: SMALL, playhead: PLAYHEAD, timeRange: [0, SMALL[120].time ?? 1], defaultSelectedId: 'request-52', density: 'compact', layout: 'auto' },
  render: (args) => <Desktop><RequestTable aria-label="Requests" {...args} className="min-h-0 flex-1" /></Desktop>,
};

/** Taller rows, for touch. */
export const Comfortable: Story = {
  render: () => <Desktop><RequestTable aria-label="Requests" rows={SMALL} playhead={PLAYHEAD} timeRange={[0, SMALL[120].time ?? 1]} density="comfortable" className="min-h-0 flex-1" /></Desktop>,
};

export const Dark: Story = {
  render: () => <Desktop dark><RequestTable aria-label="Requests" rows={SMALL} playhead={PLAYHEAD} timeRange={[0, SMALL[120].time ?? 1]} defaultSelectedId="request-52" className="min-h-0 flex-1" /></Desktop>,
};

/** Under 480 px of its own width: two-line rows, with sorting in a menu. */
export const Phone: Story = {
  render: () => <PhoneWindow><RequestTable aria-label="Requests" rows={SMALL} playhead={PLAYHEAD} timeRange={[0, SMALL[120].time ?? 1]} className="min-h-0 flex-1" /></PhoneWindow>,
};

export const PhoneDark: Story = {
  render: () => <PhoneWindow dark><RequestTable aria-label="Requests" rows={SMALL} playhead={PLAYHEAD} timeRange={[0, SMALL[120].time ?? 1]} className="min-h-0 flex-1" /></PhoneWindow>,
};

/** Driven by the table's own width and not the viewport's: in a side panel on a wide window it stacks too. */
export const SidePanel: Story = {
  render: () => (
    <Desktop>
      <div className="flex min-h-0 flex-1 gap-2">
        <div className="grid min-w-0 flex-1 place-items-center rounded-panel bg-card text-footnote text-muted-foreground shadow-hairline">Preview</div>
        <RequestTable aria-label="Requests" rows={SMALL} playhead={PLAYHEAD} timeRange={[0, SMALL[120].time ?? 1]} className="w-[360px] shrink-0" />
      </div>
    </Desktop>
  ),
};

function Transport({ rows, handle, rate }: { rows: readonly RequestRow[]; handle: RefObject<RequestTableHandle | null>; rate: number }) {
  const duration = requestTimeRange(rows)[1] / 1000;
  const clock = usePlaybackClock({ duration, time: duration * 0.4, rate });
  const playing = usePlaybackState(clock, (s) => s.playing);
  const shown = usePlaybackState(clock, (s) => Math.round(s.time * 4) / 4);
  useEffect(() => {
    const tick = () => handle.current?.setPlayhead(clock.getState().time * 1000);
    tick();
    return clock.subscribe(tick);
  }, [clock, handle]);
  return (
    <div className="flex shrink-0 items-center gap-2 px-1">
      <Button variant="quiet" size="icon-sm" aria-label={playing ? 'Pause' : 'Play'} data-testid="play" onPress={clock.toggle}>
        <Icon name={playing ? 'pause' : 'play'} size={14} />
      </Button>
      <Slider<number> aria-label="Time" size="sm" className="min-w-0 flex-1" minValue={0} maxValue={duration} step={0.01} value={shown} onChange={(t) => clock.seek(t)}>
        <SliderTrack><SliderThumb /></SliderTrack>
      </Slider>
      <span className="shrink-0 text-caption text-muted-foreground tabular-nums">{formatLogTime(shown * 1000)}</span>
    </div>
  );
}

function PlayheadDemo({ rows, rate }: { rows: readonly RequestRow[]; rate: number }) {
  const handle = useRef<RequestTableHandle>(null);
  return (
    <>
      <Transport rows={rows} handle={handle} rate={rate} />
      <RequestTable ref={handle} aria-label="Requests" rows={rows} className="min-h-0 flex-1" />
    </>
  );
}

/** Paused until you press Play, so it screenshots the same every time. */
export const MovingPlayhead: Story = {
  render: () => <Desktop><PlayheadDemo rows={SMALL} rate={1} /></Desktop>,
};

export const MovingPlayheadPhone: Story = {
  render: () => <PhoneWindow><PlayheadDemo rows={SMALL} rate={1} /></PhoneWindow>,
};

let tenThousand: RequestRow[] | undefined;
const tenThousandRows = () => (tenThousand ??= makeRequests(10_000, { seed: 13, step: 180 }));

/** 10,000 requests, with sorting, a playhead and resizable columns. */
export const TenThousand: Story = {
  render: () => <Desktop><PlayheadDemo rows={tenThousandRows()} rate={10} /></Desktop>,
};

export const TenThousandPhone: Story = {
  render: () => <PhoneWindow><PlayheadDemo rows={tenThousandRows()} rate={10} /></PhoneWindow>,
};

type PairRow = RequestRow & { other?: RowId; otherLabel?: string };

/** A pair of recordings: the browser's request and the server function that answered it. Each row links to the other
 *  end of its call, and following a link selects that row and brings it into view. */
const PAIR: PairRow[] = (() => {
  const random = seeded(29);
  const functions = ['getSession', 'getCart', 'listProducts', 'addToCart', 'checkout', 'getCart', 'getUser', 'listOrders'];
  const rows: PairRow[] = [];
  let at = 40;
  for (let i = 0; i < 90; i++) {
    const fn = functions[Math.floor(random() * functions.length)];
    const took = 40 + Math.floor(random() * random() * 900);
    const status = fn === 'checkout' && random() > 0.6 ? 500 : 200;
    const browser = `b${i}`;
    const server = `s${i}`;
    rows.push({
      id: browser, url: `https://shop.example.com/_serverFn/${fn}`, method: 'POST', status, type: 'fetch', size: 300 + Math.floor(random() * 2000),
      time: at, duration: took, tone: 'primary', other: server, otherLabel: 'Server function',
    });
    rows.push({
      id: server, url: `server:${fn}`, name: `${fn}()`, method: 'FN', status, type: 'function',
      time: at + 14, duration: took - 28, tone: 'accent', other: browser, otherLabel: 'Browser call',
    });
    at += 60 + Math.floor(random() * 500);
  }
  return rows;
})();

function PairDemo() {
  const [selected, setSelected] = useState<RowId | null>('s8');
  const [seekedTo, setSeekedTo] = useState('Press a row to seek to it');
  const renderLink = useCallback((row: PairRow) => (
    row.other ? <RequestLink onPress={() => setSelected(row.other ?? null)}>{row.otherLabel}</RequestLink> : null
  ), []);
  return (
    <>
      <span className="shrink-0 px-1 text-caption text-muted-foreground" role="status">{seekedTo}</span>
      <RequestTable<PairRow>
        aria-label="Requests and server functions"
        rows={PAIR}
        columns={['name', 'method', 'status', 'type', 'duration', 'waterfall']}
        selectedId={selected}
        onSelectionChange={setSelected}
        onRowPress={(row) => setSeekedTo(`Seek to ${formatLogTime(row.time ?? 0)}`)}
        renderLink={renderLink}
        playhead={PAIR[40].time}
        className="min-h-0 flex-1"
      />
    </>
  );
}

export const LinkedPair: Story = {
  render: () => <Desktop><PairDemo /></Desktop>,
};

export const LinkedPairPhone: Story = {
  render: () => <PhoneWindow><PairDemo /></PhoneWindow>,
};

/** Columns of your own, beside the built-ins: an IPC channel, where it went, and a status in words. */
const IPC: (RequestRow & { from: string; to: string })[] = [
  { id: 1, url: 'cart:add', method: 'invoke', status: 'ok', type: 'ipc', time: 12, duration: 3, from: 'renderer', to: 'main', tone: 'accent' },
  { id: 2, url: 'cart:list', method: 'invoke', status: 'ok', type: 'ipc', time: 44, duration: 8, from: 'renderer', to: 'main', tone: 'accent' },
  { id: 3, url: 'window:focus', method: 'send', status: 'sent', type: 'ipc-to-renderer', time: 80, from: 'main', to: 'renderer', tone: 'neutral' },
  { id: 4, url: 'files:read', method: 'invoke', status: 'threw', failed: true, type: 'ipc', time: 130, duration: 22, from: 'renderer-2', to: 'main', error: 'ENOENT: no such file', tone: 'accent' },
  { id: 5, url: 'updates:check', method: 'invoke', pending: true, type: 'ipc', time: 180, from: 'renderer', to: 'main', tone: 'accent' },
];
const IPC_COLUMNS: (RequestColumn<(typeof IPC)[number]> | 'status' | 'duration' | 'waterfall')[] = [
  { id: 'url', title: 'Channel', flex: 2, minWidth: 140 },
  { id: 'from', title: 'From', width: 90 },
  { id: 'to', title: 'To', width: 70 },
  'status',
  'duration',
  'waterfall',
];

export const CustomColumns: Story = {
  render: () => <Desktop><RequestTable aria-label="IPC" rows={IPC} columns={IPC_COLUMNS} className="min-h-0 flex-1" /></Desktop>,
};

/** The shape `ReplayDevtools` keeps its network in (docstream's `ReplayRequest` and `pending`), with no size column and
 *  the columns it hides beside an open request. */
function DevtoolsDemo() {
  const rows = useMemo(() => makeRequests(60, { seed: 23 }).map((row, i): RequestRow => ({
    id: `request-${i}`,
    url: row.url,
    name: row.url.split('/').pop() ?? row.url,
    method: row.method,
    status: row.status,
    type: row.type,
    time: row.time,
    duration: row.duration,
    failed: row.status === 0 || (row.status as number) >= 400,
    pending: i > 44 && i < 52,
  })), []);
  const [selected, setSelected] = useState<RowId | null>(null);
  const open = selected !== null;
  return (
    <div className="flex min-h-0 flex-1 gap-2">
      <RequestTable
        aria-label="Network"
        rows={rows}
        columns={open ? ['name', 'status'] : ['name', 'status', 'method', 'type', 'duration', 'waterfall']}
        selectedId={selected}
        onRowPress={(row) => setSelected(row.id === selected ? null : row.id)}
        layout={open ? 'table' : 'auto'}
        className={open ? 'w-72 shrink-0' : 'min-h-0 flex-1'}
      />
      {open ? <div className="grid min-w-0 flex-1 place-items-center rounded-panel bg-card text-footnote text-muted-foreground shadow-hairline">Headers, payload and response of {String(selected)}</div> : null}
    </div>
  );
}

export const ReplayDevtoolsData: Story = {
  render: () => <Desktop><DevtoolsDemo /></Desktop>,
};

export const Sorted: Story = {
  render: () => <Desktop><RequestTable aria-label="Requests" rows={SMALL} timeRange={SMALL_RANGE} defaultSort={{ column: 'duration', direction: 'descending' }} className="min-h-0 flex-1" /></Desktop>,
};

export const Empty: Story = {
  render: () => <Desktop><RequestTable aria-label="Requests" rows={[]} emptyState="No requests yet" className="min-h-0 flex-1" /></Desktop>,
};
