import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { FilterBar, FilterToolbar } from '@/components/ui/filter';
import { FilterInput } from '@/components/ui/filter-input';
import { LogList, LogRowContent, type LogListHandle, type LogRowState } from '@/components/ui/log-list';
import { Slider, SliderThumb, SliderTrack } from '@/components/ui/slider';
import { matchFilters, type Filter, type FilterField } from '@/lib/filter-model';
import { Icon } from '@/lib/icon';
import {
  LOG_LEVELS, countLogLevels, formatLogTime, normalizeLogLevel, nodeText, type LogLevel, type LogRow,
} from '@/lib/log-list-model';
import { usePlaybackClock, usePlaybackState } from '@/lib/playback';
import { BLProvider } from '@/lib/theme';
import { Phone as PhoneFrame } from '../stories/frame';

/* Every row comes from a seeded generator with no clock, so a story draws the same pixels every time. */

const meta: Meta<typeof LogList> = {
  title: 'Organisms/LogList',
  component: LogList,
  argTypes: { rows: { control: false } },
};
export default meta;
type Story = StoryObj<typeof LogList>;

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

const SOURCES = ['app.tsx:42', 'cart.tsx:118', 'router.ts:77', 'api.ts:31', 'store.ts:204', 'checkout/payment-form.tsx:9', 'worker.js:312'];
const TRACE = ['at readPrice (cart.tsx:118:24)', 'at CartRow (cart.tsx:96:12)', 'at renderWithHooks (react-dom.js:15486:18)', 'at beginWork (react-dom.js:19703:16)'].join('\n');

const LINES: { level: LogLevel; text: (n: number) => string; detail?: string }[] = [
  { level: 'log', text: (n) => `Rendered <CartPage> in ${4 + (n % 19)} ms` },
  { level: 'log', text: (n) => `[router] navigated to /products/${n % 400}` },
  { level: 'log', text: (n) => `state update: cart.items (${n % 9} items)` },
  { level: 'log', text: (n) => `fetching /api/cart?user=${n % 80}` },
  { level: 'log', text: (n) => `{ id: ${n}, sku: "A-${n % 977}", qty: ${1 + (n % 4)}, price: ${(n % 90) + 0.99}, tags: ["sale", "new"], warehouse: "ams-1", reserved: false, updatedAt: 17${n}, note: "held for the customer until the payment has gone through" }` },
  { level: 'debug', text: (n) => `cache hit: product:${n % 812}` },
  { level: 'debug', text: (n) => `scheduler: flushed ${1 + (n % 5)} effects` },
  { level: 'info', text: () => 'Service worker ready' },
  { level: 'info', text: (n) => `Hydrated ${80 + (n % 40)} components in ${10 + (n % 30)} ms` },
  { level: 'warn', text: (n) => `Slow response from /api/cart (${1100 + (n % 900)} ms)` },
  { level: 'warn', text: () => 'Warning: Each child in a list should have a unique "key" prop. Check the render method of `CartList`. See https://react.dev/link/warning-keys for more information.' },
  { level: 'error', text: () => "TypeError: Cannot read properties of undefined (reading 'price')", detail: TRACE },
  { level: 'error', text: (n) => `Failed to load resource: the server responded with a status of ${500 + (n % 4)}` },
];
// How often each line comes up, in LINES's order: mostly logs, a few warnings, fewer errors.
const WEIGHTS = [26, 16, 14, 12, 6, 12, 8, 1, 2, 2, 1, 0.5, 0.5];
const WEIGHT_TOTAL = WEIGHTS.reduce((a, b) => a + b, 0);

function makeLogs(count: number, { seed = 7, step = 60 }: { seed?: number; step?: number } = {}): LogRow[] {
  const random = seeded(seed);
  const rows: LogRow[] = new Array(count);
  let time = 0;
  for (let i = 0; i < count; i++) {
    let pick = random() * WEIGHT_TOTAL;
    let line = 0;
    while (pick > WEIGHTS[line] && line < LINES.length - 1) pick -= WEIGHTS[line++];
    const { level, text, detail } = LINES[line];
    time += Math.floor(random() * step * 2);
    const repeat = random();
    rows[i] = {
      id: `log-${i}`,
      level,
      time,
      source: SOURCES[Math.floor(random() * SOURCES.length)],
      message: text(i),
      count: repeat > 0.985 ? 2 + Math.floor(random() * 40) : undefined,
      detail,
    };
  }
  return rows;
}

const SMALL = makeLogs(600);

let hundredThousand: LogRow[] | undefined;
const hundredThousandRows = () => (hundredThousand ??= makeLogs(100_000, { seed: 11, step: 36 }));
const END_OF = (rows: readonly LogRow[]) => rows[rows.length - 1]?.time ?? 0;

/** A full window: what a desktop host gives the list. */
function Desktop({ children, dark }: { children?: ReactNode; dark?: boolean }) {
  return (
    <div className="h-dvh w-full">
      <BLProvider dark={dark}>
        <div className="flex h-full min-h-0 flex-col gap-2 p-3">{children}</div>
      </BLProvider>
    </div>
  );
}

/** A window dragged down to phone size. */
function PhoneWindow({ children, dark }: { children?: ReactNode; dark?: boolean }) {
  return (
    <PhoneFrame w={390} h={844} dark={dark}>
      <div className="flex h-full min-h-0 flex-col gap-2 p-2">{children}</div>
    </PhoneFrame>
  );
}

export const Default: Story = {
  args: { rows: SMALL, currentTime: SMALL[240].time, markerLabel: 'Paused here', density: 'compact', overflow: 'wrap', follow: true, copyable: true },
  render: (args) => <Desktop><LogList aria-label="Console" {...args} className="min-h-0 flex-1" /></Desktop>,
};

export const Dark: Story = {
  render: () => (
    <Desktop dark>
      <LogList aria-label="Console" rows={SMALL} currentTime={SMALL[240].time} markerLabel="Paused here" className="min-h-0 flex-1" />
    </Desktop>
  ),
};

/** Taller rows, for touch. */
export const Comfortable: Story = {
  render: () => <Desktop><LogList aria-label="Console" rows={SMALL} currentTime={SMALL[60].time} density="comfortable" className="min-h-0 flex-1" /></Desktop>,
};

/** `currentId`: the marker goes right after that row, and the row is tinted, as a debugger's current line is. */
export const CurrentRow: Story = {
  render: () => (
    <Desktop>
      <LogList aria-label="Console" rows={SMALL} currentId={SMALL[31].id} markerLabel="Paused here" className="min-h-0 flex-1" />
    </Desktop>
  ),
};

/** 390 wide: time and source go under the message, and long messages wrap across the width they have. */
export const Phone: Story = {
  render: () => (
    <PhoneWindow>
      <LogList aria-label="Console" rows={SMALL} currentTime={SMALL[120].time} markerLabel="Paused here" className="min-h-0 flex-1" />
    </PhoneWindow>
  ),
};

export const PhoneDark: Story = {
  render: () => (
    <PhoneWindow dark>
      <LogList aria-label="Console" rows={SMALL} currentTime={SMALL[120].time} markerLabel="Paused here" className="min-h-0 flex-1" />
    </PhoneWindow>
  ),
};

/** A clock and its transport. The list hears every tick through its handle, so nothing renders per frame but the time
 *  readout, a few times a second. Play it and the marker walks down the list; scroll away and a button offers the way back. */
function Transport({ rows, handle, rate, children }: { rows: readonly LogRow[]; handle: RefObject<LogListHandle | null>; rate: number; children?: ReactNode }) {
  const duration = END_OF(rows) / 1000;
  const clock = usePlaybackClock({ duration, time: duration * 0.4, rate });
  const playing = usePlaybackState(clock, (s) => s.playing);
  const shown = usePlaybackState(clock, (s) => Math.round(s.time * 4) / 4);
  useEffect(() => {
    const tick = () => handle.current?.setCurrentTime(clock.getState().time * 1000);
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
      {children}
    </div>
  );
}

function MovingMarkerDemo({ rows, rate }: { rows: readonly LogRow[]; rate: number }) {
  const handle = useRef<LogListHandle>(null);
  return (
    <>
      <Transport rows={rows} handle={handle} rate={rate} />
      <LogList ref={handle} aria-label="Console" rows={rows} markerLabel="Now" className="min-h-0 flex-1" />
    </>
  );
}

/** Paused until you press Play, so it screenshots the same every time. */
export const MovingMarker: Story = {
  render: () => <Desktop><MovingMarkerDemo rows={SMALL} rate={1} /></Desktop>,
};

/** The marker on the `currentTime` prop, as most hosts will have it: the host re-renders on every tick, the rows don't. */
function ByPropDemo({ rows, rate }: { rows: readonly LogRow[]; rate: number }) {
  const end = END_OF(rows);
  const [time, setTime] = useState(end * 0.4);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return undefined;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      setTime((t) => (t + (now - last) * rate) % end);
      last = now;
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, rate, end]);
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 px-1">
        <Button variant="quiet" size="icon-sm" aria-label={playing ? 'Pause' : 'Play'} data-testid="play" onPress={() => setPlaying((p) => !p)}>
          <Icon name={playing ? 'pause' : 'play'} size={14} />
        </Button>
        <span className="text-caption text-muted-foreground tabular-nums">{formatLogTime(time)}</span>
      </div>
      <LogList aria-label="Console" rows={rows} currentTime={time} markerLabel="Now" onRowPress={(row) => setTime(row.time ?? 0)} className="min-h-0 flex-1" />
    </>
  );
}

export const MarkerByProp: Story = {
  render: () => <Desktop><ByPropDemo rows={hundredThousandRows()} rate={0.5} /></Desktop>,
};

export const MovingMarkerPhone: Story = {
  render: () => <PhoneWindow><MovingMarkerDemo rows={SMALL} rate={1} /></PhoneWindow>,
};

/** 100,000 rows, about an hour of a busy app's console, with the marker moving through them at 10× when played. */
export const HundredThousand: Story = {
  render: () => <Desktop><MovingMarkerDemo rows={hundredThousandRows()} rate={10} /></Desktop>,
};

/** The same 100,000 at phone size, where most rows are two lines and wrapped ones more. */
export const HundredThousandPhone: Story = {
  render: () => <PhoneWindow><MovingMarkerDemo rows={hundredThousandRows()} rate={10} /></PhoneWindow>,
};

/** `overflow="expand"`: one line each until pressed. A chevron marks what's cut off, and errors open onto their trace. */
export const ExpandOnPress: Story = {
  render: () => (
    <Desktop>
      <LogList aria-label="Console" rows={SMALL} overflow="expand" defaultExpandedIds={[SMALL.find((r) => r.detail)?.id ?? '']} className="min-h-0 flex-1" />
    </Desktop>
  ),
};

/** One row of each level, selected, repeated and with a detail, with no marker. */
export const Levels: Story = {
  render: () => {
    const rows: LogRow[] = [
      { id: 1, level: 'log', time: 12, source: 'app.tsx:42', message: 'A log' },
      { id: 2, level: 'info', time: 348, source: 'app.tsx:50', message: 'An info message' },
      { id: 3, level: 'warn', time: 1204, source: 'api.ts:31', message: 'A warning', count: 3 },
      { id: 4, level: 'error', time: 2310, source: 'cart.tsx:118', message: "TypeError: Cannot read properties of undefined (reading 'price')", detail: TRACE },
      { id: 5, level: 'debug', time: 4100, source: 'store.ts:204', message: 'A debug message' },
      { id: 6, level: 'warning', time: 5021, message: 'A level of "warning", as the recording says it, and no source' },
      { id: 7, level: 'log', message: 'No time and no source' },
      { id: 8, level: 'log', time: 7200, source: 'app.tsx:60', message: 'Selected' },
    ];
    return (
      <Desktop>
        <LogList aria-label="Levels" rows={rows} defaultSelectedId={8} defaultExpandedIds={[4]} className="min-h-0 flex-1" />
      </Desktop>
    );
  },
};

const LEVEL_TINT: Record<LogLevel, string> = {
  error: 'text-destructive', warn: 'text-warning', info: 'text-primary', log: 'text-foreground', debug: 'text-muted-foreground',
};

function FilteredDemo() {
  const rows = hundredThousandRows();
  const all = useMemo(() => countLogLevels(rows), [rows]);
  const fields = useMemo<FilterField[]>(() => [
    {
      id: 'level', label: 'Level', kind: 'select',
      options: LOG_LEVELS.map((level) => ({ value: level, label: level, count: all[level] })),
    },
    { id: 'source', label: 'Source', kind: 'text' },
    { id: 'message', label: 'Message', kind: 'text' },
  ], [all]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [hidden, setHidden] = useState<ReadonlySet<LogLevel>>(new Set(['debug']));
  // Filtering is the host's: `rows` is whatever survives. The list holds its place on the row at the top of the view.
  const shown = useMemo(() => {
    const byField = matchFilters(rows, filters, fields, (row, field) =>
      field === 'level' ? normalizeLogLevel(row.level) : field === 'source' ? nodeText(row.source) : nodeText(row.message));
    return byField.filter((row) => !hidden.has(normalizeLogLevel(row.level)));
  }, [rows, filters, fields, hidden]);
  const counts = useMemo(() => countLogLevels(shown), [shown]);
  return (
    <>
      <FilterBar fields={fields} value={filters} onValueChange={setFilters} className="shrink-0">
        <FilterInput placeholder="level error" />
        <FilterToolbar />
      </FilterBar>
      <div className="flex shrink-0 flex-wrap items-center gap-1 px-1" role="group" aria-label="Levels">
        {LOG_LEVELS.map((level) => {
          const on = !hidden.has(level);
          return (
            <Button
              key={level}
              variant="quiet"
              active={on}
              size="sm"
              aria-pressed={on}
              onPress={() => {
                const next = new Set(hidden);
                if (!next.delete(level)) next.add(level);
                setHidden(next);
              }}
              className="h-6 gap-1 rounded-full px-2 text-caption font-medium"
            >
              <span className={LEVEL_TINT[level]}>{level}</span>
              <span className="tabular-nums">{all[level].toLocaleString('en-US')}</span>
            </Button>
          );
        })}
        <span className="ms-auto text-caption text-muted-foreground tabular-nums" role="status">
          {counts.total.toLocaleString('en-US')} of {all.total.toLocaleString('en-US')}
        </span>
      </div>
      <LogList aria-label="Console" rows={shown} emptyState="No messages match the filter" className="min-h-0 flex-1" />
    </>
  );
}

/** Filtering is the host's. This one puts `FilterInput` and `FilterToolbar` over the list, with level buttons that show
 *  `countLogLevels` as you'd want them, and the same counts in the Level filter's options. */
export const FilteredWithCounts: Story = {
  render: () => <Desktop><FilteredDemo /></Desktop>,
};

export const FilteredWithCountsPhone: Story = {
  render: () => <PhoneWindow><FilteredDemo /></PhoneWindow>,
};

/** `message` can be any node, and `renderRow` can add to a row with `LogRowContent`, or draw it all yourself. A press on
 *  a control inside a row doesn't press the row. */
function RichDemo() {
  const rows = useMemo<LogRow[]>(() => makeLogs(200, { seed: 3 }).map((row, i) => (i % 4 ? row : {
    ...row,
    text: `user { id: ${i}, name: "Ada" }`,
    message: (
      <span>
        user{' '}
        <span className="text-muted-foreground">{'{ '}</span>
        id: <span className="text-primary">{i}</span>, name: <span className="text-success">"Ada"</span>
        <span className="text-muted-foreground">{' }'}</span>
      </span>
    ),
  })), []);
  const [pressed, setPressed] = useState('Press a row');
  const renderRow = useCallback((row: LogRow, state: LogRowState) => (
    <>
      <LogRowContent row={row} expanded={state.expanded} cut={state.cut} disclosure={state.disclosure} formatTime={state.formatTime} />
      {state.index % 16 === 0 ? (
        <Button variant="quiet" size="sm" className="-my-0.5 h-5 shrink-0 rounded-md px-1.5 text-caption2" onPress={() => setPressed(`Pressed the button in row ${state.index}`)}>
          Inspect
        </Button>
      ) : null}
    </>
  ), []);
  return (
    <>
      <span className="shrink-0 px-1 text-caption text-muted-foreground" role="status">{pressed}</span>
      <LogList
        aria-label="Console"
        rows={rows}
        renderRow={renderRow}
        onRowPress={(row, index) => setPressed(`Pressed row ${index}: ${nodeText(row.message)}`)}
        className="min-h-0 flex-1"
      />
    </>
  );
}

export const RichMessages: Story = {
  render: () => <Desktop><RichDemo /></Desktop>,
};

/** The shape `ReplayDevtools` keeps its console in (docstream's `ReplayConsoleEntry`), with the list cut at the playhead
 *  as its console pane does: it follows the newest row, a press goes to that time, and the trace opens from the chevron. */
function DevtoolsDemo() {
  const entries = useMemo(() => makeLogs(400, { seed: 19, step: 40 }).map((row, i) => ({
    id: `console-${i}`,
    time: row.time ?? 0,
    level: normalizeLogLevel(row.level),
    message: nodeText(row.message),
    args: [nodeText(row.message)],
    trace: row.detail ? String(row.detail).split('\n') : undefined,
    source: 'console' as const,
  })), []);
  const [at, setAt] = useState(entries[220].time);
  const shown = useMemo(() => {
    const cut = entries.findIndex((entry) => entry.time > at);
    return (cut < 0 ? entries : entries.slice(0, cut)).map((entry) => ({ ...entry, source: undefined, detail: entry.trace?.join('\n') }));
  }, [entries, at]);
  const later = entries.length - shown.length;
  return (
    <>
      <Slider<number> aria-label="Playhead" size="sm" className="shrink-0" minValue={0} maxValue={entries[entries.length - 1].time} value={at} onChange={setAt}>
        <SliderTrack><SliderThumb /></SliderTrack>
      </Slider>
      <LogList
        aria-label="Console messages"
        rows={shown}
        followTail
        onRowPress={(row) => setAt(row.time)}
        footer={later ? `${later} more later in the recording` : undefined}
        emptyState="Nothing logged yet"
        className="min-h-0 flex-1"
      />
    </>
  );
}

export const ReplayDevtoolsData: Story = {
  render: () => <Desktop><DevtoolsDemo /></Desktop>,
};

export const Empty: Story = {
  render: () => <Desktop><LogList aria-label="Console" rows={[]} emptyState="Nothing logged yet" className="min-h-0 flex-1" /></Desktop>,
};
