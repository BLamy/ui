// @vitest-environment happy-dom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ReactDemo } from "./ReactCodePreview"

const { createWorkspace } = vi.hoisted(() => ({ createWorkspace: vi.fn() }))
vi.mock("./filesystem", async (original) => ({ ...await original<typeof import("./filesystem")>(), createAlmostNodeWorkspace: createWorkspace }))

const files = { "/src/main.jsx": "document.body.textContent = 'Hello'" }
afterEach(() => { createWorkspace.mockReset() })

describe("virtual preview startup", () => {
  it("waits for service worker control before starting Vite or opening the iframe, without reloading the host", async () => {
    let ready!: () => void
    const control = new Promise<void>((resolve) => { ready = resolve })
    const ensureServiceWorkerReady = vi.fn(() => control)
    const run = vi.fn(async () => ({ exitCode: 0 }))
    const dispose = vi.fn()
    createWorkspace.mockResolvedValue({ container: { run, serverBridge: { ensureServiceWorkerReady, getServerUrl: () => "/docs/__virtual__/4173" } }, dispose })
    const host = document.createElement("div"); document.body.append(host)
    const root = createRoot(host)
    await act(async () => { root.render(<ReactDemo files={files} />) })
    expect(ensureServiceWorkerReady).toHaveBeenCalledWith({ reloadOnFirstControl: false })
    expect(run).not.toHaveBeenCalled()
    expect(host.querySelector("iframe")).toBeNull()
    await act(async () => { ready() })
    expect(run).toHaveBeenCalledOnce()
    expect(host.querySelector("iframe")?.getAttribute("src")).toBe("/docs/__virtual__/4173/")
    await act(async () => { root.unmount() }); host.remove()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it("shows worker setup failures and disposes the workspace instead of opening the host app in an iframe", async () => {
    const run = vi.fn()
    const dispose = vi.fn()
    createWorkspace.mockResolvedValue({ container: { run, serverBridge: { ensureServiceWorkerReady: vi.fn().mockRejectedValue(new Error("Service worker missing")) } }, dispose })
    const host = document.createElement("div"); document.body.append(host)
    const root = createRoot(host)
    await act(async () => { root.render(<ReactDemo files={files} />) })
    expect(host.textContent).toContain("Service worker missing")
    expect(host.querySelector("iframe")).toBeNull()
    expect(run).not.toHaveBeenCalled()
    expect(dispose).toHaveBeenCalledOnce()
    await act(async () => { root.unmount() }); host.remove()
  })
})
