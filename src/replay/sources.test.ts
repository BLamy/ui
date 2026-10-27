import { describe, expect, it } from "vitest"
import { getReplayDevtools } from "./devtools"
import { getReplayInspections } from "./inspections"
import { consoleLogToReplayEvents, harToReplayEvents, mergeReplaySources } from "./sources"
import type { ReplayEvent } from "./types"

const T = Date.parse("2026-06-12T21:01:30.000Z")
const iso = (ms: number) => new Date(T + ms).toISOString()
const recording: ReplayEvent[] = [
  { type: 4, timestamp: T, data: { href: "https://a.test/", width: 800, height: 600 } },
  { type: 2, timestamp: T + 5, data: {} },
  { type: 3, timestamp: T + 10_000, data: { source: 2, type: 2 } },
]

const har = {
  log: {
    version: "1.2",
    entries: [
      {
        startedDateTime: iso(2000), time: 300, _requestId: "2465.48", _resourceType: "fetch",
        request: { method: "GET", url: "https://a.test/api/search?q=tea", headers: [{ name: "Accept", value: "application/json" }] },
        response: { status: 200, statusText: "OK", headers: [{ name: "content-type", value: "application/json" }], content: { mimeType: "application/json", text: btoa('{"results":[1]}'), encoding: "base64" } },
      },
      {
        startedDateTime: iso(4000), time: 50, _error: "net::ERR_FAILED",
        request: { method: "POST", url: "https://a.test/api/save", headers: [], postData: { mimeType: "application/json", text: '{"a":1}' } },
        response: { status: 0, headers: [], content: {} },
      },
      // Before the recording started: lands on its first moment.
      { startedDateTime: iso(-60_000), time: 20, request: { method: "GET", url: "https://a.test/" }, response: { status: 200, content: {} } },
    ],
    _inspections: [{ at: iso(2500), request: "2465.48", label: "q=tea answered" }],
  },
}

describe("harToReplayEvents", () => {
  it("reads entries as requests (headers, bodies, failures) and log._inspections as inspections", () => {
    const tools = getReplayDevtools(mergeReplaySources(recording, { har: JSON.stringify(har) }))
    expect(tools.network.map((r) => [r.method, r.name, r.status, r.time, r.duration, r.failed, r.key])).toEqual([
      ["GET", "a.test", 200, 0, 20, false, undefined],
      ["GET", "search?q=tea", 200, 2000, 300, false, "2465.48"],
      ["POST", "save", 0, 4000, 50, true, undefined],
    ])
    const search = tools.network[1]!
    expect(search.requestHeaders).toEqual({ Accept: "application/json" })
    expect(search.responseHeaders).toEqual({ "content-type": "application/json" })
    expect(search.responseBody).toBe('{"results":[1]}')
    expect(tools.network[2]!.requestBody).toBe('{"a":1}')
    expect(tools.network[2]!.error).toBe("net::ERR_FAILED")
    expect(getReplayInspections(mergeReplaySources(recording, { har }))).toEqual([
      { id: undefined, time: 2500, tab: undefined, request: "2465.48", message: undefined, label: "q=tea answered" },
    ])
  })

  it("ignores what isn't a HAR", () => {
    expect(harToReplayEvents("not json")).toEqual([])
    expect(harToReplayEvents({ log: {} })).toEqual([])
    expect(mergeReplaySources(recording, { har: "{}" })).toBe(recording)
  })
})

describe("consoleLogToReplayEvents", () => {
  it("reads `<ISO> [level] message` lines, with indented lines continuing the message", () => {
    const log = [
      `${iso(1000)} [info] storefront ready`,
      `${iso(3000)} [warning] slow response`,
      `${iso(6000)} [error] Uncaught TypeError: x is undefined`,
      "  at applyPromo (checkout.ts:88)",
      "",
      "not a log line",
    ].join("\n")
    const tools = getReplayDevtools(mergeReplaySources(recording, { consoleLog: log }))
    expect(tools.console.map((m) => [m.time, m.level, m.message])).toEqual([
      [1000, "info", "storefront ready"],
      [3000, "warn", "slow response"],
      [6000, "error", "Uncaught TypeError: x is undefined\nat applyPromo (checkout.ts:88)"],
    ])
    expect(consoleLogToReplayEvents("")).toEqual([])
  })

  it("puts what's after the recording on its last moment", () => {
    const tools = getReplayDevtools(mergeReplaySources(recording, { consoleLog: `${iso(99_000)} [log] late` }))
    expect(tools.console.map((m) => m.time)).toEqual([10_000])
  })
})
