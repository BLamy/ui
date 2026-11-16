import { describe, expect, it } from "vitest"
import { replayDemoEvents } from "./demo"
import { getReplayDevtools, replayDevtoolsAt, requestName } from "./devtools"
import { getReplayMarkers } from "./markers"
import type { ReplayEvent } from "./types"

const T = 1_000_000
const at = (ms: number, type: number, data: unknown): ReplayEvent => ({ type, data, timestamp: T + ms })

describe("getReplayDevtools", () => {
  it("reads rrweb's console and network plugins", () => {
    const tools = getReplayDevtools([
      at(0, 4, { href: "https://a.test/", width: 800, height: 600 }),
      at(100, 6, { plugin: "rrweb/console@1", payload: { level: "warn", trace: ["f (a.js:1)"], payload: ['"slow"', '{"ms":120}', "3"] } }),
      at(900, 6, {
        plugin: "rrweb/network@1",
        payload: { requests: [
          { url: "https://a.test/api/items?page=2", method: "get", status: 200, initiatorType: "fetch", startTime: 10, endTime: 310, responseHeaders: { "content-type": "application/json" }, responseBody: { ok: true } },
          { url: "https://a.test/app.js", status: 0, initiatorType: "script", startTime: 20, endTime: 120 },
        ] },
      }),
    ])
    expect(tools.console).toEqual([
      { id: "console-0", time: 100, level: "warn", message: 'slow {"ms":120} 3', args: ["slow", '{"ms":120}', "3"], trace: ["f (a.js:1)"], source: "console" },
    ])
    expect(tools.network.map((r) => [r.name, r.method, r.status, r.time, r.duration, r.failed, r.type])).toEqual([
      ["items?page=2", "GET", 200, 600, 300, false, "fetch"],
      ["app.js", "GET", 0, 610, 100, true, "script"],
    ])
    expect(tools.network[0]!.responseBody).toBe('{"ok":true}')
  })

  it("reads custom network, error and console events", () => {
    const tools = getReplayDevtools([
      at(0, 5, { tag: "network", payload: { method: "POST", status: 500, url: "/api/checkout", label: "POST /api/checkout 500" } }),
      at(5, 5, { tag: "request.failed", payload: { url: "/api/ping" } }),
      at(10, 5, { tag: "error", payload: { label: "TypeError", message: "x is undefined", stack: "at a (a.ts:1)\n at b (b.ts:2)" } }),
      at(20, 5, { tag: "console", payload: { level: "info", message: "hello" } }),
      at(30, 5, { tag: "checkpoint", payload: { label: "ignored" } }),
    ])
    expect(tools.network.map((r) => [r.method, r.url, r.status, r.failed])).toEqual([["POST", "/api/checkout", 500, true], ["GET", "/api/ping", undefined, true]])
    expect(tools.console.map((c) => [c.level, c.message, c.trace])).toEqual([
      ["error", "Uncaught TypeError: x is undefined", ["at a (a.ts:1)", "at b (b.ts:2)"]],
      ["info", "hello", undefined],
    ])
  })

  it("names requests like DevTools' Name column", () => {
    expect(requestName("https://a.test/api/items?page=2#x")).toBe("items?page=2")
    expect(requestName("https://a.test/")).toBe("a.test")
    expect(requestName("/api/checkout")).toBe("checkout")
  })
})

describe("replayDevtoolsAt", () => {
  const tools = getReplayDevtools(replayDemoEvents)

  it("the demo recording has the page's requests and console", () => {
    expect(tools.network).toHaveLength(8)
    expect(tools.console.map((c) => c.level)).toEqual(["log", "info", "info", "warn", "error"])
  })

  it("counts what had happened by the playhead; a request in flight is pending, not failed", () => {
    expect(replayDevtoolsAt(tools, 2000).counts).toEqual({ requests: 5, failed: 0, errors: 0, warnings: 0, laterMessages: 3, laterRequests: 3 })
    const sending = replayDevtoolsAt(tools, 7600)
    expect(sending.counts).toMatchObject({ requests: 8, failed: 0, warnings: 1, errors: 0 })
    expect(sending.network.at(-1)).toMatchObject({ url: "/api/checkout", pending: true })
    expect(replayDevtoolsAt(tools, 8000).counts).toMatchObject({ requests: 8, failed: 1, errors: 1, warnings: 1, laterMessages: 0, laterRequests: 0 })
    expect(replayDevtoolsAt(tools, 0).network.map((r) => r.type)).toEqual(["document"]) // the page itself
  })

  it("the added console and network events don't change the demo's timeline markers", () => {
    expect(getReplayMarkers(replayDemoEvents).filter((m) => m.kind === "network" || m.kind === "error").map((m) => m.label)).toEqual(["POST /api/checkout 500", "TypeError"])
  })
})
