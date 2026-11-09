import { constants, runInNewContext } from "node:vm"
import { expect, it, vi } from "vitest"
import { TSCIRCUIT_COMPILER_WORKER_URL } from "./worker"

it("loads a large UTF-8 compiler module without Blob or FileReader APIs and replays queued requests", async () => {
  const scope = Object.assign(new EventTarget(), { postMessage: vi.fn() })
  // Match the real bundle's size and put multibyte source across chunk boundaries.
  const module = `/*${" ".repeat(24572)}λ😀漢字${" ".repeat(19_000_000)}*/
    if ("λ😀漢字" !== String.fromCodePoint(955, 128512, 28450, 23383)) throw new Error("Corrupt UTF-8");
    export {};
  `
  const bytes = new TextEncoder().encode(module)
  const source = decodeURIComponent(TSCIRCUIT_COMPILER_WORKER_URL.slice(TSCIRCUIT_COMPILER_WORKER_URL.indexOf(",") + 1))
  const startup = runInNewContext(`(async () => { ${source} })()`, {
    self: scope, fetch: async () => ({ ok: true, arrayBuffer: async () => bytes.buffer }),
    AbortController, MessageEvent, setTimeout, clearTimeout, btoa,
    // Opaque-origin workers cannot use these APIs reliably on Safari.
    Blob: () => { throw new Error("Blob is unavailable") },
    FileReaderSync: () => { throw new Error("FileReaderSync is unavailable") },
  }, { importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER }) as Promise<void>
  const requests = vi.fn()
  scope.addEventListener("message", requests)
  scope.dispatchEvent(new MessageEvent("message", { data: { id: "queued", type: "APPLY", path: ["version"] } }))
  expect(requests).not.toHaveBeenCalled()
  await startup
  expect(scope.postMessage).not.toHaveBeenCalled()
  expect(requests).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ data: expect.objectContaining({ id: "queued" }) }))
})

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
