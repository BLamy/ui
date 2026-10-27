import { describe, expect, it } from "vitest"
import { getReplayDevtools } from "./devtools"
import { getReplayInspections, replayInspectionAt, resolveReplayInspections } from "./inspections"
import { getReplayMarkers } from "./markers"
import type { ReplayEvent } from "./types"

const T = 1_000_000
const at = (ms: number, type: number, data: unknown): ReplayEvent => ({ type, data, timestamp: T + ms })

const events: ReplayEvent[] = [
  at(0, 4, { href: "https://a.test/", width: 800, height: 600 }),
  at(100, 5, { tag: "network", payload: { requestId: "2465.47", method: "GET", url: "https://a.test/api/search?q=te", status: 200, duration: 1400 } }),
  at(110, 5, { tag: "network", payload: { requestId: "2465.48", method: "GET", url: "https://a.test/api/search?q=tea", status: 200, duration: 1200 } }),
  at(4000, 5, { tag: "network", payload: { method: "GET", url: "https://a.test/api/search?q=tea", status: 200 } }),
  at(200, 5, { tag: "console", payload: { id: "msg-1", level: "warn", message: "stale response for te" } }),
  at(1500, 5, { tag: "inspect", payload: { request: "2465.47", label: "The list shows q=te's results" } }),
  at(2500, 5, { tag: "inspect", payload: { tab: "console", message: "stale response", label: "Warned about it" } }),
]

describe("inspections", () => {
  it("reads `inspect` custom events, which also mark the rail as checkpoints", () => {
    expect(getReplayInspections(events)).toEqual([
      { id: undefined, time: 1500, tab: undefined, request: "2465.47", message: undefined, label: "The list shows q=te's results" },
      { id: undefined, time: 2500, tab: "console", request: undefined, message: "stale response", label: "Warned about it" },
    ])
    expect(getReplayMarkers(events).filter((m) => m.kind === "custom" && m.time >= 1500).map((m) => [m.time, m.label])).toEqual([
      [1500, "The list shows q=te's results"],
      [2500, "Warned about it"],
    ])
  })

  it("finds requests by the recording's id, else by URL (nearest in time) or path; messages by id or text", () => {
    const tools = getReplayDevtools(events)
    const id = (i: number) => tools.network[i]!.id
    const resolved = resolveReplayInspections(
      [
        { time: 1500, request: "2465.47" },
        { time: 300, request: "https://a.test/api/search?q=tea" },
        { time: 3900, request: "/api/search?q=tea" },
        { time: 2500, message: "msg-1" },
        { time: 2600, message: "stale", tab: "console", id: "mine" },
        { time: 50, request: "nowhere" },
      ],
      tools,
    )
    expect(tools.network.map((r) => r.key)).toEqual(["2465.47", "2465.48", undefined])
    expect(resolved.map((r) => [r.id, r.time, r.tab, r.requestId, r.messageId])).toEqual([
      ["inspect-5", 50, "network", undefined, undefined],
      ["inspect-1", 300, "network", id(1), undefined],
      ["inspect-0", 1500, "network", id(0), undefined],
      ["inspect-3", 2500, "console", undefined, "console-0"],
      ["mine", 2600, "console", undefined, "console-0"],
      ["inspect-2", 3900, "network", id(2), undefined],
    ])
  })

  it("the current inspection is the latest at or before the playhead", () => {
    const resolved = resolveReplayInspections(getReplayInspections(events), getReplayDevtools(events))
    expect(replayInspectionAt(resolved, 1499)).toBeUndefined()
    expect(replayInspectionAt(resolved, 1500)?.id).toBe("inspect-0")
    expect(replayInspectionAt(resolved, 2499)?.id).toBe("inspect-0")
    expect(replayInspectionAt(resolved, 9000)?.id).toBe("inspect-1")
  })
})
