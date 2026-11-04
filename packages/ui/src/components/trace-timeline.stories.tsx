import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { List, ListRow, ListSection } from '@/components/ui/list';
import { Slider } from '@/components/ui/slider';
import { ThemeScope } from '@/lib/theme';
import { cn } from '@/lib/utils';
import {
  TraceTimeline,
  type TraceDrawStats, type TraceFetchActivity, type TraceTimelineHandle, type TraceTimelineProps, type TraceValueInfo,
} from '@/components/ui/trace-timeline';
import {
  lowerBound, stopAxis, stripHeight,
  type TraceAxis, type TraceKey, type TraceLane, type TraceRange, type TraceRequest, type TraceStop, type TraceTone,
} from '@/lib/trace-timeline-model';
import { Phone } from '../stories/frame';

/* ── A one-hour session: three lanes, about 400,000 marks and 300 stops. Seeded, with no clock, so every run draws the
   same. Activity comes in bursts with idle time between them, as a real session's does. ── */

const HOUR = 3_600_000;
const RANGE: TraceRange = { start: 0, end: HOUR };

function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` sorted times in bursts, and how deep the stack was at each. */
function bursts(seed: number, n: number, count: number, offset = 0): { times: Float64Array; depths: Uint16Array } {
  const random = seeded(seed);
  const starts = Float64Array.from({ length: count }, () => offset + random() * (HOUR - offset - 90_000)).sort();
  const weights = Array.from(starts, () => -Math.log(1 - random() * 0.999));
  const total = weights.reduce((a, b) => a + b, 0);
  const times = new Float64Array(n);
  const depths = new Uint16Array(n);
  let k = 0;
  starts.forEach((start, i) => {
    const samples = i === starts.length - 1 ? n - k : Math.min(n - k, Math.round((n * weights[i]) / total));
    const room = (i + 1 < starts.length ? starts[i + 1] : HOUR) - start;
    const width = Math.min(room * 0.9, 3_000 + random() * 70_000);
    const spacing = width / Math.max(1, samples);
    let t = start;
    let depth = 2;
    for (let j = 0; j < samples; j++) {
      t += spacing * (0.2 + 1.6 * random());
      if (random() < 0.004) depth = 1 + Math.floor(random() * 4);
      depth = Math.max(1, Math.min(48, depth + Math.round(random() * 3 - 1.45)));
      times[k] = Math.min(HOUR, t);
      depths[k] = depth;
      k++;
    }
  });
  return { times, depths };
}

/** Every `every`-th sample, near enough: marks tend to land where things are happening. */
function pick(seed: number, from: Float64Array, count: number): Float64Array {
  const random = seeded(seed);
  const out = new Float64Array(count);
  for (let i = 0; i < count; i++) out[i] = from[Math.floor(random() * from.length)];
  return out.sort();
}

const NAVIGATIONS = ['/', '/orders', '/orders/8841', '/checkout', '/checkout/payment', '/orders/8842'];
const CONSOLE = ['Cart recalculated', 'Rendered <OrderList>', 'Cache miss for session', 'Socket heartbeat', 'Hydration finished', 'Retrying after 429', 'Layout shift 0.03', 'Feature flag read'];
const REQUESTS = ['GET /api/orders', 'POST /api/cart', 'GET /api/session', 'GET /api/inventory', 'POST /api/checkout'];
const REQUEST_COLORS = ['var(--chart-1)', 'var(--chart-5)', 'var(--chart-3)', 'var(--chart-2)'];

function hourSession() {
  const browser = bursts(11, 230_000, 90);
  const server = bursts(23, 110_000, 70, 40_000);
  const worker = bursts(37, 50_000, 40, 120_000);

  const threadTimes: Record<string, Array<{ id: TraceKey; times: Float64Array }>> = {
    browser: [{ id: 1, times: bursts(41, 24_000, 90).times }, { id: 7, times: bursts(43, 6_000, 60).times }],
    server: [{ id: 1, times: bursts(47, 12_000, 70, 40_000).times }],
    worker: [{ id: 1, times: bursts(53, 8_000, 40, 120_000).times }],
  };

  const random = seeded(101);
  const stops: Array<TraceStop<string>> = [];
  const requests: TraceRequest[] = [];
  const at = () => browser.times[Math.floor(random() * browser.times.length)];
  // One error, six navigations, forty requests, and the rest console messages.
  stops.push({ key: 'error', time: at(), tone: 'error', level: 1, caption: 'TypeError: order is undefined', preview: 'at renderTotals (orders.tsx:88), while rendering /checkout/payment' });
  NAVIGATIONS.forEach((path, i) => {
    stops.push({ key: `nav-${i}`, time: 40_000 + (i * (HOUR - 200_000)) / NAVIGATIONS.length + random() * 90_000, tone: 'info', level: 1, caption: `Navigated to ${path}`, preview: 'A full page load, with its own document request' });
  });
  for (let i = 0; i < 40; i++) {
    const name = REQUESTS[i % REQUESTS.length];
    const time = at();
    const status = i % 13 === 7 ? 500 : 200;
    const latency = 20 + random() * 160;
    stops.push({ key: `req-${i}`, time, tone: status === 500 ? 'warning' : 'default', level: 2, caption: name, preview: `${status} in ${Math.round(latency * 3)} ms` });
    requests.push({ id: `req-${i}`, time, from: time + latency, to: time + latency + 30 + random() * 400, color: REQUEST_COLORS[i % REQUEST_COLORS.length] });
  }
  while (stops.length < 300) {
    const i = stops.length;
    stops.push({ key: `log-${i}`, time: at(), level: 3, dim: i % 7 === 0, caption: CONSOLE[i % CONSOLE.length], preview: `console.log, from chunk-${(i * 31) % 97}.js:${(i * 17) % 400}` });
  }
  stops.sort((a, b) => a.time - b.time);

  const lane = (key: string, title: string, seed: number, data: { times: Float64Array; depths: Uint16Array }, marks: { breakpoints: number; logpoints: number; console: number }, offset = 0): TraceLane => ({
    key,
    title,
    offset,
    diamonds: { label: 'checkpts', times: Float64Array.from({ length: 48 }, (_, i) => (i + 0.5) * (HOUR / 48)) },
    density: { label: 'JS', ...data },
    marks: [
      { key: 'breakpoints', label: 'Breakpoints', times: pick(seed + 1, data.times, marks.breakpoints), shape: 'bar', tone: 'warning' },
      { key: 'logpoints', label: 'Logpoints', times: pick(seed + 2, data.times, marks.logpoints), shape: 'bar', color: 'var(--chart-5)' },
      { key: 'console', label: 'Console', times: pick(seed + 3, data.times, marks.console), shape: 'dot', tone: 'info' },
    ],
    threads: threadTimes[key].map(({ id }) => ({ id, label: `T${id}` })),
  });

  const lanes: TraceLane[] = [
    lane('browser', 'Browser', 200, browser, { breakpoints: 18, logpoints: 140, console: 6_000 }),
    lane('server', 'Server', 300, server, { breakpoints: 6, logpoints: 60, console: 2_600 }),
    lane('worker', 'Worker', 400, worker, { breakpoints: 0, logpoints: 20, console: 1_200 }),
  ];

  // What a real host fetches over IPC: counts per bucket. The bucket edges come in the lane's own time.
  const fetchActivity: TraceFetchActivity = async (laneKey, edges) => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    return (threadTimes[laneKey] ?? []).map(({ id, times }) => {
      const counts = new Uint32Array(edges.length - 1);
      let lo = lowerBound(times, edges[0]);
      for (let b = 0; b < counts.length; b++) {
        const hi = lowerBound(times, edges[b + 1], lo);
        counts[b] = hi - lo;
        lo = hi;
      }
      return { id, counts };
    });
  };

  const markCount = lanes.reduce((n, l) => n + (l.density?.times.length ?? 0) + (l.marks ?? []).reduce((m, s) => m + s.times.length, 0), 0);
  const firstError = stops.find((s) => s.tone === 'error') as TraceStop<string>;
  return { lanes, stops, requests, fetchActivity, markCount, firstError, stopAxis: stopAxis(stops, RANGE) };
}

let cachedHour: ReturnType<typeof hourSession> | null = null;
const hour = () => (cachedHour ??= hourSession());

/* ── The non-linear axis the Recording Inspector uses for JS: a quarter of the length goes to time, and the rest in equal
   shares to steps, so a drag doesn't jump over the moments JS was running. It's just an object with two functions. ── */
function jsAxis(anchors: Float64Array, range: TraceRange, timeShare = 0.25): TraceAxis {
  const span = range.end - range.start;
  const stepFraction = (k: number) => (timeShare * (anchors[k] - range.start)) / span + ((1 - timeShare) * k) / anchors.length;
  return {
    fraction(t) {
      const timeFraction = (t - range.start) / span;
      const k = lowerBound(anchors, t + Number.MIN_VALUE) - 1;
      if (k < 0) return timeShare * timeFraction;
      const next = k + 1 < anchors.length ? anchors[k + 1] : range.end;
      const within = next > anchors[k] ? Math.min(1, (t - anchors[k]) / (next - anchors[k])) : 0;
      return timeShare * timeFraction + ((1 - timeShare) * (k + within)) / anchors.length;
    },
    timeAt(f) {
      const at = Math.max(0, Math.min(1, f));
      let lo = 0;
      let hi = anchors.length - 1;
      let k = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (stepFraction(mid) <= at) {
          k = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (k < 0) {
        const first = stepFraction(0);
        return first > 0 ? range.start + (at / first) * (anchors[0] - range.start) : anchors[0];
      }
      const from = stepFraction(k);
      const hasNext = k + 1 < anchors.length;
      const to = hasNext ? stepFraction(k + 1) : 1;
      const nextTime = hasNext ? anchors[k + 1] : range.end;
      return to > from ? anchors[k] + ((at - from) / (to - from)) * (nextTime - anchors[k]) : anchors[k];
    },
  };
}

/* ── Story pieces ── */

/** A thumbnail of the moment, in tokens: a page whose content changes with the time. */
function Thumbnail({ time }: { time: number }) {
  const n = Math.floor(time / 45_000);
  return (
    <div className="flex h-[74px] w-[132px] flex-col gap-[5px] overflow-hidden rounded-ctl bg-muted p-[8px] shadow-hairline">
      <div className="h-[6px] rounded-full bg-primary" style={{ width: `${30 + (n * 7) % 60}%` }} />
      <div className="h-[4px] rounded-full bg-secondary-strong" style={{ width: `${40 + (n * 13) % 55}%` }} />
      <div className="h-[4px] rounded-full bg-secondary-strong" style={{ width: `${25 + (n * 29) % 70}%` }} />
      <div className="mt-auto h-[18px] rounded-[3px] bg-secondary" style={{ width: `${45 + (n * 19) % 50}%` }} />
    </div>
  );
}

/* Hooks for scripts that drive these stories in a real browser and time them. They do nothing unless a script sets them. */
interface TraceHooks {
  __traceDraw?: (s: TraceDrawStats) => void;
  __traceValue?: (time: number, info: TraceValueInfo<string>) => void;
  __traceView?: (view: TraceRange) => void;
}
const hooks = globalThis as TraceHooks;
const reportDraw = (stats: TraceDrawStats) => hooks.__traceDraw?.(stats);

type HourProps = Partial<TraceTimelineProps<string>> & { axisKind?: 'time' | 'stops' | 'js'; startAt?: number; startView?: TraceRange };

/** The session, wired up like a host would: it holds the playhead, the lane in focus and what's selected. */
function HourTimeline({ axisKind = 'time', startAt = 1_512_000, startView, ...props }: HourProps) {
  const session = hour();
  const [time, setTime] = useState(startAt);
  const [focused, setFocused] = useState<string>('browser');
  const [thread, setThread] = useState<TraceKey | null>(1);
  const [request, setRequest] = useState<TraceKey | null>('req-7');
  const js = useMemo(() => (axisKind === 'js' ? jsAxis(session.lanes[0].density?.times as Float64Array, RANGE) : undefined), [axisKind, session]);
  return (
    <TraceTimeline
      range={RANGE}
      axis={axisKind === 'stops' ? session.stopAxis : js}
      lanes={session.lanes}
      stops={session.stops}
      requests={session.requests}
      fetchActivity={session.fetchActivity}
      value={time}
      onValueChange={(t, info) => {
        setTime(t);
        hooks.__traceValue?.(t, info);
      }}
      onViewChange={(v) => hooks.__traceView?.(v)}
      defaultView={startView}
      focusedLane={focused}
      onFocusLane={setFocused}
      selectedThread={thread}
      onSelectThread={setThread}
      selectedRequest={request}
      onSelectRequest={setRequest}
      renderPreview={(t) => <Thumbnail time={t} />}
      onDraw={reportDraw}
      {...props}
    />
  );
}

const CONSOLE_ROWS = [
  { title: 'Cart recalculated', subtitle: 'cart.ts:42', time: '24:58' },
  { title: 'Rendered <OrderList>', subtitle: 'orders.tsx:120', time: '25:03' },
  { title: 'Cache miss for session', subtitle: 'session.ts:17', time: '25:04' },
  { title: 'GET /api/orders', subtitle: '200 in 84 ms', time: '25:06' },
  { title: 'Hydration finished', subtitle: 'entry.client.tsx:9', time: '25:07' },
  { title: 'Socket heartbeat', subtitle: 'socket.ts:61', time: '25:12' },
  { title: 'Layout shift 0.03', subtitle: 'vitals.ts:30', time: '25:12' },
  { title: 'POST /api/cart', subtitle: '200 in 132 ms', time: '25:15' },
  { title: 'Feature flag read', subtitle: 'flags.ts:12', time: '25:20' },
  { title: 'Retrying after 429', subtitle: 'fetch.ts:77', time: '25:31' },
  { title: 'GET /api/inventory', subtitle: '200 in 61 ms', time: '25:33' },
  { title: 'Cart recalculated', subtitle: 'cart.ts:42', time: '25:40' },
  { title: 'Rendered <Totals>', subtitle: 'totals.tsx:88', time: '25:41' },
  { title: 'Socket heartbeat', subtitle: 'socket.ts:61', time: '25:42' },
];

/** A debugger's console, as the thing a rail sits over. A left rail has no inset to publish, as rows have no trailing
 *  accessory on that side, so what's under it makes its own room. */
function FakePanel({ title = 'Console', clearLeft }: { title?: string; clearLeft?: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-card">
      <div className="flex h-toolbar shrink-0 items-center px-4 text-body font-semibold text-foreground shadow-hairline-b">{title}</div>
      <div className={cn('bl-scroll min-h-0 flex-1 overflow-y-auto', clearLeft && 'pl-11')}>
        <List>
          <ListSection>
            {CONSOLE_ROWS.map((row, i) => (
              <ListRow key={i} title={row.title} subtitle={row.subtitle} trailing={<span className="text-footnote text-muted-foreground tabular-nums">{row.time}</span>} accessory="chevron" onPress={() => {}} />
            ))}
          </ListSection>
        </List>
      </div>
    </div>
  );
}

function PhoneRail({ dark, clearLeft, children }: { dark?: boolean; clearLeft?: boolean; children?: ReactNode }) {
  return (
    <Phone w={390} h={844} dark={dark}>
      <FakePanel clearLeft={clearLeft} />
      {children}
    </Phone>
  );
}

/** A desktop-width frame, as tall as the strip's rows want. */
function Desktop({ dark, children, h }: { dark?: boolean; children?: ReactNode; h?: number }) {
  return (
    <Phone w={1280} h={h ?? stripHeight(hour().lanes, { requests: true, stops: true })} dark={dark}>
      <div className="absolute inset-0 overflow-hidden">{children}</div>
    </Phone>
  );
}

/* ── Stories ── */

const meta: Meta<typeof TraceTimeline> = {
  title: 'Organisms/TraceTimeline',
  component: TraceTimeline,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof TraceTimeline>;

/** The desktop strip: one hour, three lanes, about 400,000 marks. Press or drag to seek, wheel to zoom, shift or a sideways
 *  wheel to pan; `0` fits. */
export const Strip: Story = {
  render: () => <Desktop><HourTimeline /></Desktop>,
};

export const StripDark: Story = {
  render: () => <Desktop dark><HourTimeline /></Desktop>,
};

/** Zoomed in to a minute, where a burst opens up. */
export const StripZoomed: Story = {
  render: () => <Desktop><HourTimeline startView={{ start: 1_480_000, end: 1_560_000 }} /></Desktop>,
};

/** Zoomed in to a few seconds around one request: its dot, its band and the line between them, selected. */
export const StripRequests: Story = {
  render: () => {
    const request = hour().requests[7];
    return <Desktop><HourTimeline startAt={request.time + 1_400} startView={{ start: request.time - 1_800, end: request.time + 2_400 }} /></Desktop>;
  },
};

/** The Recording Inspector's JS axis fits the same `axis` prop. It isn't uniform, so ticks are evenly spaced and say what
 *  time they landed on. */
export const StripJsAxis: Story = {
  render: () => <Desktop><HourTimeline axisKind="js" /></Desktop>,
};

/** The rail, over a panel, in a phone-size window. Its dashes are `stops`, and its columns the lanes. Rows keep clear of it
 *  through `--bl-index-bar-inset`. */
export const Rail: Story = {
  render: () => <PhoneRail><HourTimeline orientation="vertical" top={60} bottom={16} /></PhoneRail>,
};

export const RailDark: Story = {
  render: () => <PhoneRail dark><HourTimeline orientation="vertical" top={60} bottom={16} /></PhoneRail>,
};

export const RailLeft: Story = {
  render: () => <PhoneRail clearLeft><HourTimeline orientation="vertical" side="left" top={60} bottom={16} /></PhoneRail>,
};

/** `stopAxis`: an axis by what happened. Stops sit evenly, bursts open out and idle time closes up. */
export const RailByWhatHappened: Story = {
  render: () => <PhoneRail><HourTimeline orientation="vertical" axisKind="stops" top={60} bottom={16} /></PhoneRail>,
};

/** Zoomed in, where more stops fit. The thin bar on the outer edge is where the view sits on the whole hour. */
export const RailZoomed: Story = {
  render: () => <PhoneRail><HourTimeline orientation="vertical" top={60} bottom={16} startView={{ start: 1_400_000, end: 1_640_000 }} /></PhoneRail>,
};

const pressRail = async (canvasElement: HTMLElement, steps: Array<{ x: number; y: number }>) => {
  const rail = canvasElement.querySelector<HTMLElement>('[data-slot=trace-timeline]');
  if (!rail) return;
  const r = rail.getBoundingClientRect();
  const init = (x: number, y: number) => ({ bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, clientX: r.right - x, clientY: r.top + y });
  rail.dispatchEvent(new PointerEvent('pointerdown', init(steps[0].x, steps[0].y)));
  for (const step of steps.slice(1)) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    rail.dispatchEvent(new PointerEvent('pointermove', init(step.x, step.y)));
  }
};

/** Mid-drag at full speed, with the card beside the pointer. */
export const RailScrubbing: Story = {
  render: () => <PhoneRail><HourTimeline orientation="vertical" top={60} bottom={16} /></PhoneRail>,
  play: async ({ canvasElement }) => pressRail(canvasElement, [{ x: 20, y: 300 }, { x: 20, y: 340 }, { x: 22, y: 380 }]),
};

/** Pulled away to a slower speed: the playhead stays where it was as the speed changes, and the card says the speed. */
export const RailPulledOut: Story = {
  render: () => <PhoneRail><HourTimeline orientation="vertical" top={60} bottom={16} /></PhoneRail>,
  play: async ({ canvasElement }) => pressRail(canvasElement, [{ x: 20, y: 300 }, { x: 20, y: 380 }, { x: 110, y: 380 }, { x: 200, y: 392 }, { x: 240, y: 410 }]),
};

/* Thousands of stops: a burst of 5,000 console lines around four errors and a dozen navigations. */
function thousandStops(): Array<TraceStop<string>> {
  const random = seeded(7);
  const out: Array<TraceStop<string>> = [];
  for (let i = 0; i < 5_000; i++) {
    const tone: TraceTone = i % 1250 === 600 ? 'error' : i % 90 === 17 ? 'warning' : 'default';
    out.push({ key: `s${i}`, time: random() * HOUR, tone, level: tone === 'error' ? 1 : i % 400 === 3 ? 1 : i % 40 === 3 ? 2 : 3, caption: tone === 'error' ? 'Unhandled rejection' : i % 400 === 3 ? 'Navigation' : 'console.log', preview: `Stop ${i}` });
  }
  return out;
}
let cachedThousands: Array<TraceStop<string>> | null = null;

/** 5,000 stops on a rail: the lowest level first, then neighbours merged into a cluster with a count and the most severe
 *  tone. Hover one to see its count; zoom in and more fit. */
export const RailThousandsOfStops: Story = {
  render: () => <PhoneRail><HourTimeline orientation="vertical" stops={(cachedThousands ??= thousandStops())} top={60} bottom={16} /></PhoneRail>,
};

/** The same timeline either side of a threshold: drag the width across 600 px, or press a button. The zoom and the playhead
 *  stay, since `view` and `value` are held here and only `orientation` changes. */
function AcrossTheThreshold() {
  const session = hour();
  const [width, setWidth] = useState(1100);
  const [time, setTime] = useState(1_512_000);
  const [view, setView] = useState<TraceRange>({ start: 1_400_000, end: 1_640_000 });
  const handle = useRef<TraceTimelineHandle>(null);
  const narrow = width < 600;
  return (
    <ThemeScope className="flex flex-col gap-3 p-4 font-sans">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" onPress={() => setWidth(1100)}>Desktop</Button>
        <Button size="sm" variant="secondary" onPress={() => setWidth(390)}>Phone</Button>
        <Button size="sm" variant="secondary" onPress={() => handle.current?.fit()}>Fit</Button>
        <Slider aria-label="Frame width" className="w-60" minValue={360} maxValue={1200} value={width} onChange={(v) => setWidth(v as number)} />
        <span data-testid="frame-width" className="text-footnote text-muted-foreground tabular-nums">{width} px, {narrow ? 'rail' : 'strip'}</span>
      </div>
      <Phone w={width} h={narrow ? 720 : 560}>
        <div className="absolute inset-0 flex flex-col">
          <TraceTimeline
            ref={handle}
            range={RANGE}
            lanes={session.lanes}
            stops={session.stops}
            requests={session.requests}
            fetchActivity={session.fetchActivity}
            value={time}
            onValueChange={(t, info) => {
              setTime(t);
              hooks.__traceValue?.(t, info);
            }}
            view={view}
            onViewChange={(v) => {
              setView(v);
              hooks.__traceView?.(v);
            }}
            focusedLane="browser"
            orientation={narrow ? 'vertical' : 'horizontal'}
            top={60}
            bottom={16}
            className={narrow ? undefined : 'shrink-0'}
            onDraw={reportDraw}
          />
          <div className="relative min-h-0 flex-1"><FakePanel /></div>
        </div>
      </Phone>
    </ThemeScope>
  );
}

export const Threshold: Story = {
  render: () => <AcrossTheThreshold />,
};

/** One lane and nothing else: a single recording, with a time axis and its threads. */
export const OneLane: Story = {
  render: () => {
    const session = hour();
    const lanes = [{ ...session.lanes[0], title: undefined, marks: undefined }];
    return (
      <Desktop h={stripHeight(lanes)}>
        <TraceTimeline range={RANGE} lanes={lanes} fetchActivity={session.fetchActivity} defaultValue={2_000_000} selectedThread={7} />
      </Desktop>
    );
  },
};

/** A host's own colours for its lanes and threads: any CSS colour, including variables. */
export const LaneColors: Story = {
  render: () => {
    const session = hour();
    const lanes = session.lanes.map((lane, i) => ({
      ...lane,
      color: ['var(--success)', 'var(--destructive)', 'var(--foreground)'][i],
      threads: lane.threads?.map((t) => ({ ...t, color: ['var(--success)', 'var(--destructive)', 'var(--foreground)'][i] })),
    }));
    return (
      <Desktop h={stripHeight(lanes)}>
        <TraceTimeline range={RANGE} lanes={lanes} fetchActivity={session.fetchActivity} defaultValue={2_000_000} focusedLane="server" />
      </Desktop>
    );
  },
};
