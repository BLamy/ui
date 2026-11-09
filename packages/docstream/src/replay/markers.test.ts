import { describe, expect, it } from 'vitest'
import { getReplayMarkers, getReplayMeta, getReplayPointerTrack, replayPointerAt } from './markers'
import { sanitizeReplayEvent } from './sanitize'
import type { ReplayEvent } from './types'

const T = 1_700_000_000_000
const events: ReplayEvent[] = [
  { type: 4, timestamp: T, data: { href: 'https://shop.test/', width: 1280, height: 800 } },
  { type: 2, timestamp: T + 1, data: { node: { type: 0, childNodes: [] }, initialOffset: { top: 0, left: 0 } } },
  { type: 3, timestamp: T + 500, data: { source: 1, positions: [{ x: 10, y: 20, id: 1, timeOffset: -100 }, { x: 100, y: 200, id: 1, timeOffset: 0 }] } },
  { type: 3, timestamp: T + 900, data: { source: 2, type: 2, id: 4, x: 300, y: 400 } },
  { type: 6, timestamp: T + 1200, data: { plugin: 'rrweb/console@1', payload: { level: 'error', payload: ['"TypeError: x is undefined"'], trace: [] } } },
  { type: 6, timestamp: T + 1300, data: { plugin: 'rrweb/network@1', payload: { requests: [{ url: '/api/cart', method: 'POST', status: 500 }, { url: '/ok', status: 200 }] } } },
  { type: 5, timestamp: T + 1500, data: { tag: 'network', payload: { method: 'GET', status: 404, url: '/api/promo' } } },
  { type: 5, timestamp: T + 1600, data: { tag: 'checkpoint', payload: { label: 'Checkout opened' } } },
  { type: 4, timestamp: T + 2000, data: { href: 'https://shop.test/checkout', width: 1280, height: 800 } },
]

describe('replay helpers', () => {
  it('reads the recording meta', () => {
    expect(getReplayMeta(events)).toEqual({ start: T, end: T + 2000, duration: 2000, width: 1280, height: 800, href: 'https://shop.test/', playable: true })
    expect(getReplayMeta([]).playable).toBe(false)
  })

  it('finds clicks, errors, failed requests, navigations and custom markers', () => {
    const markers = getReplayMarkers(events)
    expect(markers.map((m) => [m.kind, m.time, m.label])).toEqual([
      ['click', 900, 'Click'],
      ['error', 1200, 'Console error'],
      ['network', 1300, 'POST 500'],
      ['network', 1500, 'GET 404'],
      ['custom', 1600, 'Checkout opened'],
      ['navigation', 2000, 'Navigated'],
    ])
    expect(markers[1]!.detail).toBe('TypeError: x is undefined')
    expect(markers[2]!.detail).toBe('/api/cart')
    expect(new Set(markers.map((m) => m.id)).size).toBe(markers.length)
  })

  it('builds a pointer track and interpolates it', () => {
    const track = getReplayPointerTrack(events)
    expect(track.moves.map((p) => p.time)).toEqual([400, 500, 900])
    expect(track.clicks).toEqual([{ time: 900, x: 300, y: 400 }])
    expect(replayPointerAt(track, 100)).toBeNull()
    expect(replayPointerAt(track, 450)).toEqual({ x: 55, y: 110 })
    expect(replayPointerAt(track, 5000)).toEqual({ x: 300, y: 400 })
  })

  it('sanitizes private-network assets without rrweb', () => {
    const event = sanitizeReplayEvent({
      type: 2,
      timestamp: T,
      data: { node: { attributes: { src: 'http://localhost:3000/a.png', style: 'background:url(http://10.0.0.2/x.png)' }, childNodes: [] } },
    })
    const attrs = (event.data as { node: { attributes: Record<string, string> } }).node.attributes
    expect(attrs.src).toMatch(/^data:image\/gif/)
    expect(attrs.style).not.toContain('10.0.0.2')
  })
})
