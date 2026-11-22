import { flameData, type FlameLane, type FlameSpanInput } from '@/lib/flame-chart-model'

export const LANES: FlameLane[] = [
  { key: 'web', title: 'web', subtitle: 'browser · Chrome 142' },
  { key: 'gateway', title: 'gateway', subtitle: 'envoy · gw-2' },
  { key: 'orders', title: 'orders', subtitle: 'node · orders-5c8f' },
  { key: 'payments', title: 'payments', subtitle: 'go · pay-1' },
  { key: 'inventory', title: 'inventory', subtitle: 'rust · inv-3' },
]

/** A seeded random number generator, so every load draws the same trace. */
function seeded(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Five checkouts, staggered, about 60 spans each. Client spans wait on the service they call (outlined); one charge in
 *  three is declined and retried after a backoff; receipts are queued and still pending when the trace was taken. */
export function checkoutTrace() {
  const spans: FlameSpanInput[] = []
  let n = 0
  const span = (lane: string, name: string, start: number, end: number, parent?: string, extra: Partial<FlameSpanInput> = {}) => {
    const id = `s${n++}`
    spans.push({ id, parent, lane, name, start, end, ...extra })
    return id
  }
  const random = seeded(7)
  for (let k = 0; k < 5; k++) {
    const t = k * 140 + random() * 30
    const declined = k % 3 === 1
    const click = span('web', 'click "Place order"', t, t + 470 + (declined ? 120 : 0))
    span('web', 'validate form', t + 2, t + 7, click)
    const call = span('web', 'fetch POST /api/checkout', t + 8, t + 440 + (declined ? 120 : 0), click, { waiting: true })
    const gw = span('gateway', 'POST /checkout', t + 12, t + 436 + (declined ? 120 : 0), call)
    span('gateway', 'auth.verify', t + 13, t + 21, gw)
    span('gateway', 'rate-limit', t + 21, t + 23, gw)
    const route = span('gateway', 'route → orders', t + 24, t + 432 + (declined ? 120 : 0), gw, { waiting: true })
    const order = span('orders', 'createOrder', t + 28, t + 428 + (declined ? 120 : 0), route)
    span('orders', 'SELECT cart', t + 30, t + 44, order)
    // N+1 price lookups, each a few hundred microseconds.
    let at = t + 45
    for (let i = 0; i < 14; i++) {
      const d = 0.4 + random() * 0.8
      span('orders', 'SELECT price', at, at + d, order)
      at += d + 0.15
    }
    const reserve = span('orders', 'reserve stock', at + 1, at + 80, order, { waiting: true })
    const inv = span('inventory', 'POST /reserve', at + 4, at + 77, reserve)
    let lock = at + 6
    for (let i = 0; i < 6; i++) {
      const d = 4 + random() * 6
      span('inventory', `lock sku-${1000 + k * 10 + i}`, lock, lock + d, inv)
      lock += d + 0.5
    }
    span('inventory', 'commit reservation', lock + 1, at + 75, inv)
    const chargeStart = at + 84
    const chargeEnd = chargeStart + 210 + (declined ? 120 : 0)
    const charge = span('orders', 'charge card', chargeStart, chargeEnd, order, { waiting: true })
    const pay = span('payments', 'POST /charges', chargeStart + 4, chargeEnd - 4, charge)
    span('payments', 'fraud.check', chargeStart + 6, chargeStart + 38, pay)
    let c = chargeStart + 40
    if (declined) {
      span('payments', 'stripe.charge (attempt 1)', c, c + 60, pay, { error: true })
      span('payments', 'backoff', c + 60, c + 120, pay, { waiting: true })
      c += 120
    }
    const stripe = span('payments', declined ? 'stripe.charge (attempt 2)' : 'stripe.charge', c, c + 140, pay, { waiting: true })
    span('payments', 'tls handshake', c + 1, c + 18, stripe)
    span('payments', 'await response', c + 18, c + 138, stripe, { waiting: true })
    span('payments', 'INSERT payment', c + 142, c + 158, pay)
    const after = chargeEnd + 2
    span('orders', 'INSERT order', after, after + 18, order)
    const publish = span('orders', 'publish order.created', after + 19, after + 22, order)
    // The receipt is a queued job: the consumer picked it up and never finished.
    span('inventory', 'on order.created', after + 40, after + 260 + random() * 80, publish, { pending: true })
    span('payments', 'send receipt', after + 60, after + 330, publish, { pending: true })
    span('gateway', 'access log', t + 436 + (declined ? 120 : 0), t + 438 + (declined ? 120 : 0), gw)
    span('web', 'render confirmation', t + 442 + (declined ? 120 : 0), t + 468 + (declined ? 120 : 0), click, { error: declined && k === 4 })
  }
  return flameData(LANES, spans)
}
