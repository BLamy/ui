import { FLAME_ERROR, FLAME_PENDING, FLAME_WAITING, deriveLinks, packRows, type FlameData, type FlameLane } from '@/lib/flame-chart-model'

const SERVICES = ['edge', 'gateway', 'accounts', 'orders', 'search', 'payments', 'inventory', 'notifications']
const OPERATIONS = [
  'GET /api/orders', 'POST /api/cart', 'SELECT orders', 'SELECT cart_items', 'redis GET', 'redis SET', 'grpc Inventory.Reserve',
  'grpc Payments.Charge', 'kafka publish', 'render template', 'serialize JSON', 'auth.verify', 'feature flags', 'http GET /search',
  'UPDATE stock', 'INSERT audit', 'cache miss → origin', 'compress', 'sign JWT', 'resolve DNS',
]

function seeded(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `n` spans as columns: requests arriving every couple of milliseconds, each a tree a few levels deep whose calls hop
 *  to another service a third of the time. Rows are packed by `packRows`, links derived from parents. */
export function millionSpans(n = 1_000_000): FlameData {
  const random = seeded(42)
  const lanes: FlameLane[] = SERVICES.map((key, l) => ({ key, title: key, subtitle: `pod ${key.slice(0, 3)}-${(l * 37) % 9}`, tint: `var(--chart-${(l % 5) + 1})` }))
  const start = new Float64Array(n)
  const end = new Float64Array(n)
  const lane = new Uint16Array(n)
  const parent = new Int32Array(n)
  const name = new Uint32Array(n)
  const color = new Uint16Array(n)
  const flags = new Uint8Array(n)
  let i = 0
  const put = (s: number, e: number, l: number, p: number) => {
    start[i] = s
    end[i] = e
    lane[i] = l
    parent[i] = p
    name[i] = Math.floor(random() * OPERATIONS.length)
    color[i] = l
    const r = random()
    flags[i] = r < 0.004 ? FLAME_ERROR : r < 0.006 ? FLAME_PENDING : 0
    return i++
  }
  // Splits a span's time among a few children, recursing while there's time and budget.
  const grow = (p: number, s: number, e: number, l: number, level: number) => {
    const kids = level > 4 || e - s < 0.05 ? 0 : 1 + Math.floor(random() * 4)
    let at = s + (e - s) * 0.04
    const room = (e - s) * 0.92
    for (let k = 0; k < kids && i < n - 1; k++) {
      const d = (room / kids) * (0.5 + random() * 0.45)
      const hop = random() < 0.33
      const cl = hop ? Math.floor(random() * lanes.length) : l
      if (hop && cl !== l) {
        // A call to another service: the caller waits, and the callee's server span is the child.
        const client = put(at, at + d, l, p)
        flags[client] |= FLAME_WAITING
        const server = put(at + d * 0.03, at + d * 0.97, cl, client)
        grow(server, at + d * 0.03, at + d * 0.97, cl, level + 2)
      } else {
        const child = put(at, at + d, cl, p)
        grow(child, at, at + d, cl, level + 1)
      }
      at += room / kids
    }
  }
  let t = 0
  while (i < n) {
    const l = Math.floor(random() * 2)
    const d = 8 + random() * random() * 400
    const root = put(t, t + d, l, -1)
    grow(root, t, t + d, l, 0)
    t += 0.24 + random() * 0.2
  }
  const depth = packRows(start, end, lane, parent)
  const data: FlameData = { lanes, start, end, lane, depth, parent, name, names: OPERATIONS, color, colors: lanes.map((x) => x.tint as string), flags }
  data.links = deriveLinks(data)
  return data
}
