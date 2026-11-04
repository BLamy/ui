import { lowerBound, type TraceLane, type TraceRange, type TraceRequest, type TraceStop } from '@/lib/trace-timeline-model'
import type { TraceFetchActivity } from '@/components/ui/trace-timeline'

/* A one-hour session on one clock: three lanes, about 400,000 marks and 300 stops, in bursts with idle time between them.
   Seeded, so it's the same every time. In an app these come from wherever your recording lives. */

const HOUR = 3_600_000
export const RANGE: TraceRange = { start: 0, end: HOUR }

function seeded(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `n` sorted times in bursts, and how deep the stack was at each. */
function bursts(seed: number, n: number, count: number) {
  const random = seeded(seed)
  const starts = Float64Array.from({ length: count }, () => random() * (HOUR - 90_000)).sort()
  const weights = Array.from(starts, () => -Math.log(1 - random() * 0.999))
  const total = weights.reduce((a, b) => a + b, 0)
  const times = new Float64Array(n)
  const depths = new Uint16Array(n)
  let k = 0
  starts.forEach((start, i) => {
    const samples = i === starts.length - 1 ? n - k : Math.min(n - k, Math.round((n * weights[i]) / total))
    const room = (i + 1 < starts.length ? starts[i + 1] : HOUR) - start
    const spacing = Math.min(room * 0.9, 3_000 + random() * 70_000) / Math.max(1, samples)
    let t = start
    let depth = 2
    for (let j = 0; j < samples; j++) {
      t += spacing * (0.2 + 1.6 * random())
      depth = Math.max(1, Math.min(48, depth + Math.round(random() * 3 - 1.45)))
      times[k] = Math.min(HOUR, t)
      depths[k++] = depth
    }
  })
  return { times, depths }
}

/** Some of those times, sorted: marks land where things are happening. */
function pick(seed: number, from: Float64Array, count: number) {
  const random = seeded(seed)
  return Float64Array.from({ length: count }, () => from[Math.floor(random() * from.length)]).sort()
}

const NAVIGATIONS = ['/', '/orders', '/orders/8841', '/checkout', '/checkout/payment', '/orders/8842']
const CONSOLE = ['Cart recalculated', 'Rendered <OrderList>', 'Cache miss for session', 'Socket heartbeat', 'Hydration finished', 'Retrying after 429']
const REQUESTS = ['GET /api/orders', 'POST /api/cart', 'GET /api/session', 'POST /api/checkout']

function build() {
  const browser = bursts(11, 230_000, 90)
  const server = bursts(23, 110_000, 70)
  const worker = bursts(37, 50_000, 40)
  const threads: Record<string, Array<{ id: number; times: Float64Array }>> = {
    browser: [{ id: 1, times: bursts(41, 24_000, 90).times }, { id: 7, times: bursts(43, 6_000, 60).times }],
    server: [{ id: 1, times: bursts(47, 12_000, 70).times }],
    worker: [{ id: 1, times: bursts(53, 8_000, 40).times }],
  }
  const lane = (key: string, title: string, seed: number, data: typeof browser, marks: [number, number, number]): TraceLane => ({
    key,
    title,
    diamonds: { label: 'checkpts', times: Float64Array.from({ length: 48 }, (_, i) => (i + 0.5) * (HOUR / 48)) },
    density: { label: 'JS', ...data },
    marks: [
      { key: 'breakpoints', times: pick(seed + 1, data.times, marks[0]), shape: 'bar', tone: 'warning' },
      { key: 'logpoints', times: pick(seed + 2, data.times, marks[1]), shape: 'bar', color: 'var(--chart-5)' },
      { key: 'console', times: pick(seed + 3, data.times, marks[2]), shape: 'dot', tone: 'info' },
    ],
    threads: threads[key].map(({ id }) => ({ id, label: `T${id}` })),
  })
  const lanes = [
    lane('browser', 'Browser', 200, browser, [18, 140, 6_000]),
    lane('server', 'Server', 300, server, [6, 60, 2_600]),
    lane('worker', 'Worker', 400, worker, [0, 20, 1_200]),
  ]

  const random = seeded(101)
  const at = () => browser.times[Math.floor(random() * browser.times.length)]
  const stops: Array<TraceStop<string>> = [
    { key: 'error', time: at(), tone: 'error', level: 1, caption: 'TypeError: order is undefined', preview: 'at renderTotals (orders.tsx:88)' },
  ]
  const requests: TraceRequest[] = []
  NAVIGATIONS.forEach((path, i) => {
    stops.push({ key: `nav-${i}`, time: 40_000 + (i * (HOUR - 200_000)) / NAVIGATIONS.length + random() * 90_000, tone: 'info', level: 1, caption: `Navigated to ${path}`, preview: 'A full page load' })
  })
  for (let i = 0; i < 40; i++) {
    const time = at()
    const latency = 20 + random() * 160
    stops.push({ key: `req-${i}`, time, level: 2, caption: REQUESTS[i % REQUESTS.length], preview: `200 in ${Math.round(latency * 3)} ms` })
    requests.push({ id: `req-${i}`, time, from: time + latency, to: time + latency + 30 + random() * 400, color: `var(--chart-${(i % 4) + 1})` })
  }
  while (stops.length < 300) {
    const i = stops.length
    stops.push({ key: `log-${i}`, time: at(), level: 3, dim: i % 7 === 0, caption: CONSOLE[i % CONSOLE.length] })
  }
  stops.sort((a, b) => a.time - b.time)

  // What a real host fetches from wherever its data is: a count per bucket per thread. Edges come in the lane's own time.
  const fetchActivity: TraceFetchActivity = async (laneKey, edges) =>
    (threads[laneKey] ?? []).map(({ id, times }) => {
      const counts = new Uint32Array(edges.length - 1)
      let lo = lowerBound(times, edges[0])
      for (let b = 0; b < counts.length; b++) {
        const hi = lowerBound(times, edges[b + 1], lo)
        counts[b] = hi - lo
        lo = hi
      }
      return { id, counts }
    })

  return { lanes, stops, requests, fetchActivity }
}

let built: ReturnType<typeof build> | null = null
/** Built once, the first time it's asked for. */
export const session = () => (built ??= build())
