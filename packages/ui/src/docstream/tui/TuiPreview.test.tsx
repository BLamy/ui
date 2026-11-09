// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableIframePageLoading":true}}
import { act, type ReactElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MarkdownContent } from "../docs/DocsRenderer"
import { GitbookStreamdown } from "../streamdown"
import { TuiPreview } from "./TuiPreview"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
let windows: WeakMap<HTMLIFrameElement, Window>

beforeEach(() => {
  // Unit tests drive the runtime protocol explicitly. Happy DOM reports its disabled
  // network navigation as an error event, which is unrelated to runtime failures.
  const dispatch = HTMLIFrameElement.prototype.dispatchEvent
  vi.spyOn(HTMLIFrameElement.prototype, "dispatchEvent").mockImplementation(function (this: HTMLIFrameElement, event: Event) {
    return event.type === "error" ? true : dispatch.call(this, event)
  })
  const report = console.error
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (!args.some((arg) => String(arg).includes("Iframe page loading is disabled"))) report(...args)
  })
  windows = new WeakMap()
  vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockImplementation(function (this: HTMLIFrameElement) {
    if (!windows.has(this)) windows.set(this, { postMessage: vi.fn(), focus: vi.fn() } as unknown as Window)
    return windows.get(this)!
  })
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const mount = (element: ReactElement) => act(() => root.render(element))
const state = () => host.querySelector<HTMLElement>("[data-tui-state]")?.dataset.tuiState
const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find((el) => el.textContent === label)!
const click = (label: string) => act(() => button(label).click())
const terminal = () => host.querySelector("iframe")!.contentWindow!
const send = (source: Window, data: unknown, origin = "null") => act(() => {
  window.dispatchEvent(new MessageEvent("message", { source, origin, data }))
})
function ready(source = terminal()) {
  send(source, { type: "opentui-example:ready" })
  return vi.mocked(source.postMessage).mock.calls.at(-1)?.[0] as { type: string; requestId: string; code: string; language: string }
}

describe("TuiPreview runtime lifecycle", () => {
  it("requires Run and a real correlated rendered message; iframe load and unrelated frames cannot report success", () => {
    const onStatusChange = vi.fn()
    mount(<TuiPreview code="const value = 1" language="tsx" onStatusChange={onStatusChange} />)
    expect(state()).toBe("idle")
    expect(host.querySelector("iframe")).toBeNull()
    expect(host.querySelector("code")?.textContent).toBe("const value = 1")
    click("Run")
    const iframe = host.querySelector("iframe")!
    const child = terminal()
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts")
    expect(iframe.getAttribute("referrerpolicy")).toBe("strict-origin")
    expect(state()).toBe("starting")
    act(() => iframe.dispatchEvent(new Event("load")))
    expect(state()).toBe("starting")
    expect(child.postMessage).not.toHaveBeenCalled()
    send({} as Window, { type: "opentui-example:ready" })
    send(child, { type: "opentui-example:ready" }, "https://blamy.github.io")
    expect(child.postMessage).not.toHaveBeenCalled()
    const request = ready()
    expect(request).toMatchObject({ type: "opentui-example:run", code: "const value = 1", language: "tsx", theme: { mode: "dark", background: "#000000", foreground: "#ededed" } })
    expect(vi.mocked(child.postMessage).mock.calls[0]?.[1]).toBe("*")
    ready()
    expect(child.postMessage).toHaveBeenCalledTimes(1)
    expect(state()).toBe("starting")
    send(child, { type: "opentui-example:status", status: "rendered", requestId: "stale" })
    expect(state()).toBe("starting")
    send(child, { type: "opentui-example:status", status: "rendered", requestId: request.requestId })
    expect(state()).toBe("running")
    click("Focus terminal")
    expect(child.focus).toHaveBeenCalledOnce()
    expect(onStatusChange.mock.calls.map(([value]) => value)).toEqual(["idle", "starting", "running"])
    click("Stop")
    expect(state()).toBe("stopped")
    expect(host.querySelector("iframe")).toBeNull()
    send(child, { type: "opentui-example:status", status: "error", requestId: request.requestId })
    expect(state()).toBe("stopped")
  })

  it("shows errors as text and retries in a fresh iframe with a new request", () => {
    mount(<TuiPreview code="throw new Error('test')" />)
    click("Run")
    const firstFrame = host.querySelector("iframe")!
    const firstChild = terminal()
    const first = ready()
    send(firstChild, { type: "opentui-example:status", status: "error", requestId: first.requestId, message: "<script>bad source</script>" })
    expect(state()).toBe("error")
    expect(host.textContent).toContain("<script>bad source</script>")
    expect(host.querySelector("script, iframe")).toBeNull()
    click("Retry")
    expect(host.querySelector("iframe")).not.toBe(firstFrame)
    const nextChild = terminal()
    send(firstChild, { type: "opentui-example:ready" })
    expect(nextChild.postMessage).not.toHaveBeenCalled()
    const next = ready()
    expect(next.requestId).not.toBe(first.requestId)
    send(nextChild, { type: "opentui-example:status", status: "rendered", requestId: next.requestId })
    expect(state()).toBe("running")
    send(nextChild, { type: "opentui-example:status", status: "error", requestId: next.requestId, message: "Program failed after rendering" })
    expect(state()).toBe("error")
    expect(host.textContent).toContain("Program failed after rendering")
  })

  it("bounds both startup and first-render waits and clears timers and message listeners", () => {
    vi.useFakeTimers()
    const remove = vi.spyOn(window, "removeEventListener")
    mount(<TuiPreview code="test()" startupTimeoutMs={1000} renderTimeoutMs={1000} />)
    click("Run")
    act(() => vi.advanceTimersByTime(1000))
    expect(state()).toBe("error")
    expect(host.textContent).toContain("did not become ready")
    expect(vi.getTimerCount()).toBe(0)
    click("Retry")
    ready()
    act(() => vi.advanceTimersByTime(1000))
    expect(state()).toBe("error")
    expect(host.textContent).toContain("did not render in time")
    expect(vi.getTimerCount()).toBe(0)
    click("Retry")
    expect(vi.getTimerCount()).toBe(1)
    mount(<span>Removed</span>)
    expect(vi.getTimerCount()).toBe(0)
    expect(remove.mock.calls.filter(([type]) => type === "message")).toHaveLength(3)
  })

  it("destroys the old program on source changes and does not restart for an equivalent theme object", () => {
    const theme = { mode: "dark" as const, background: "#111", foreground: "#eee" }
    mount(<TuiPreview code="first()" theme={{ ...theme }} />)
    click("Run")
    const child = terminal()
    const request = ready()
    mount(<TuiPreview code="first()" theme={{ ...theme }} />)
    send(child, { type: "opentui-example:status", status: "rendered", requestId: request.requestId })
    expect(state()).toBe("running")
    mount(<TuiPreview code="second()" theme={theme} />)
    expect(host.querySelector("iframe")).toBeNull()
    expect(state()).toBe("idle")
    send(child, { type: "opentui-example:status", status: "error", requestId: request.requestId })
    expect(state()).toBe("idle")
    click("Run")
    expect(ready().code).toBe("second()")
  })

  it.each(["javascript:alert(1)", "data:text/html,test", "", "ftp://host/test", "https://user:password@example.com/runtime/"])("rejects untrusted URL schemes or credentials: %s", (runtimeUrl) => {
    mount(<TuiPreview code="test()" runtimeUrl={runtimeUrl} />)
    expect(state()).toBe("error")
    expect(button("Run").disabled).toBe(true)
    expect(host.querySelector("iframe")).toBeNull()
  })

  it("accepts a self-hosted runtime URL and bounds terminal height", () => {
    mount(<TuiPreview code="test()" language="tui" runtimeUrl="http://localhost:5173/custom/runtime/" height={20_000} />)
    click("Run")
    expect(host.querySelector("iframe")!.getAttribute("src")).toBe("http://localhost:5173/custom/runtime/")
    expect(host.querySelector<HTMLElement>('[data-slot="tui-preview-terminal"]')!.style.height).toBe("720px")
    expect(ready().language).toBe("typescript")
  })

  it("resolves a deployment-relative runtime URL against the host page", () => {
    mount(<TuiPreview code="test()" runtimeUrl="/opentui/workbench/example/" />)
    click("Run")
    expect(host.querySelector("iframe")!.getAttribute("src")).toBe("http://localhost:3000/opentui/workbench/example/")
    expect(ready().code).toBe("test()")
  })
})

describe("terminal fences in documents and AI responses", () => {
  const markdown = '```typescript tui title="Terminal example"\nconsole.log("hello")\n```'

  it("passes options through nested document blocks and keeps TUI tabs runnable", () => {
    mount(<MarkdownContent markdown={'{% tabs %}\n{% tab title="TUI" %}\n' + markdown + '\n{% endtab %}\n{% endtabs %}'} tui={{ runtimeUrl: "http://localhost:5173/opentui/workbench/example/", height: 240 }} />)
    expect(host.querySelector("[data-tui-state]")).not.toBeNull()
    expect(host.querySelector(".docs-tabs-code")).toBeNull()
    expect(host.textContent).toContain("Terminal example")
    click("Run")
    expect(host.querySelector("iframe")!.getAttribute("src")).toBe("http://localhost:5173/opentui/workbench/example/")
    expect(ready().code).toBe('console.log("hello")')
  })

  it("disables Run until streaming finishes, without automatically executing the completed response", () => {
    mount(<GitbookStreamdown markdown={markdown} isStreaming />)
    expect(button("Run").disabled).toBe(true)
    expect(host.textContent).toContain("Waiting for the response to finish")
    click("Run")
    expect(host.querySelector("iframe")).toBeNull()
    mount(<GitbookStreamdown markdown={markdown} isStreaming={false} />)
    expect(button("Run").disabled).toBe(false)
    expect(host.querySelector("iframe")).toBeNull()
    click("Run")
    expect(ready().code).toBe('console.log("hello")')
    mount(<GitbookStreamdown markdown={markdown + "\nMore response"} isStreaming />)
    expect(host.querySelector("iframe")).toBeNull()
    expect(button("Run").disabled).toBe(true)
  })

  it("keeps a partial fence inert even when the host omits isStreaming, and can disable previews entirely", () => {
    mount(<MarkdownContent markdown={'```tui\nconsole.log("partial")'} />)
    expect(button("Run").disabled).toBe(true)
    mount(<MarkdownContent markdown={markdown} tui={false} />)
    expect(host.querySelector("[data-tui-state]")).toBeNull()
    expect(host.querySelector(".docs-code")?.textContent).toContain('console.log("hello")')
  })
})
