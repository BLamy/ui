import { runInNewContext } from "node:vm"
import { expect, it, vi } from "vitest"
import { TSCIRCUIT_COMPILER_WORKER_URL } from "./worker"

it("reports compiler download failure to queued and subsequent runtime requests", async () => {
  const scope = Object.assign(new EventTarget(), { postMessage: vi.fn() })
  let rejectFetch!: (error: Error) => void
  const download = new Promise((_resolve, reject) => { rejectFetch = reject })
  const source = decodeURIComponent(TSCIRCUIT_COMPILER_WORKER_URL.slice(TSCIRCUIT_COMPILER_WORKER_URL.indexOf(",") + 1))
  const startup = runInNewContext(`(async () => { ${source} })()`, {
    self: scope, fetch: () => download, AbortController, MessageEvent, setTimeout, clearTimeout,
  }) as Promise<void>
  scope.dispatchEvent(new MessageEvent("message", { data: { id: "queued", type: "APPLY", path: ["version"] } }))
  expect(scope.postMessage).not.toHaveBeenCalled()
  rejectFetch(new Error("offline"))
  await startup
  expect(scope.postMessage).toHaveBeenCalledWith(expect.objectContaining({
    id: "queued", type: "HANDLER", name: "throw",
    value: expect.objectContaining({ isError: true, value: expect.objectContaining({ message: expect.stringContaining("offline") }) }),
  }))
  scope.dispatchEvent(new MessageEvent("message", { data: { id: "later", type: "APPLY", path: ["version"] } }))
  expect(scope.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ id: "later", name: "throw" }))
})
