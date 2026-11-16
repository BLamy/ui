// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MarkdownContent } from "./DocsRenderer"
import { TsCircuitPreview, DEFAULT_TSCIRCUIT_RUNTIME_URL } from "../tscircuit"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let host: HTMLDivElement
let root: Root
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks() })
async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await act(() => new Promise((r) => setTimeout(r, 20)))
  expect(check()).toBe(true)
}
const machine = JSON.stringify({ initial: "idle", states: { idle: { on: { START: "running" } }, running: {} } })

describe("diagram fences", () => {
  it("renders XState, updates the diagram, shows an inline error and recovers", async () => {
    const show = (code: string) => act(() => root.render(<MarkdownContent markdown={`\`\`\`xstate\n${code}\n\`\`\``} />))
    show(machine)
    await until(() => !!host.querySelector("[data-docstream-xstate] .docs-mermaid svg"))
    expect(host.querySelector(".docs-split-source")?.textContent).toContain("START")
    show(machine.replaceAll("running", "finished"))
    await until(() => !!host.querySelector(".docs-mermaid svg")?.textContent?.includes("finished"))
    show("{")
    await until(() => !!host.querySelector('[role="alert"]'))
    show(machine)
    await until(() => !!host.querySelector(".docs-mermaid svg"))
    expect(host.querySelector('[role="alert"]')).toBeNull()
  })

  it("keeps diagram-only tabs as rendered cards and leaves ordinary TSX as code", async () => {
    act(() => root.render(<MarkdownContent markdown={`{% tabs %}\n{% tab title="State" %}\n\`\`\`xstate\n${machine}\n\`\`\`\n{% endtab %}\n{% tab title="Circuit" %}\n\`\`\`tscircuit\ncircuit.add(<resistor resistance="1k" />)\n\`\`\`\n{% endtab %}\n{% endtabs %}`} />))
    expect(host.querySelector("[data-docstream-xstate]")).not.toBeNull()
    act(() => root.render(<MarkdownContent markdown={'```tsx\n<resistor />\n```'} />))
    expect(host.querySelector("iframe")).toBeNull()
    expect(host.querySelector('.docs-code[data-language="tsx"]')).not.toBeNull()
  })

  it("embeds tscircuit fences in a sandboxed frame", () => {
    act(() => root.render(<MarkdownContent markdown={'```tscircuit\ncircuit.add(<resistor resistance="1k" />)\n```'} />))
    expect(host.querySelector("[data-docstream-tscircuit] .docs-split-source")?.textContent).toContain("resistor")
    expect(host.querySelector("iframe")?.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin")
  })
})

describe("circuit runtime bridge", () => {
  it("can restart the runtime after its compiler worker fails to fetch", () => {
    act(() => root.render(<TsCircuitPreview code="circuit.add(<resistor />)" />))
    const frame = host.querySelector("iframe")!
    const origin = new URL(DEFAULT_TSCIRCUIT_RUNTIME_URL).origin
    const message = (data: unknown) => act(() => window.dispatchEvent(new MessageEvent("message", { source: frame.contentWindow as Window, origin, data })))
    message({ runframe_type: "runframe_ready_to_receive" })
    message({ type: "runframe_event", runframe_event: { type: "error", error_message: "Failed to fetch" } })
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Failed to fetch")
    const retry = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "Retry circuit preview")!
    expect(retry).toBeDefined()
    act(() => retry.click())
    expect(host.querySelector("iframe")).not.toBe(frame)
    expect(host.querySelector('[role="alert"]')).toBeNull()
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Loading circuit preview")
  })

  it("checks both frame and origin, sends the newest code when ready and updates without navigation", () => {
    act(() => root.render(<TsCircuitPreview code="first" />))
    const frame = host.querySelector("iframe")!
    const send = vi.spyOn(frame.contentWindow!, "postMessage")
    const origin = new URL(DEFAULT_TSCIRCUIT_RUNTIME_URL).origin
    const message = (source: Window | null, eventOrigin: string, data: unknown) => act(() => window.dispatchEvent(new MessageEvent("message", { source, origin: eventOrigin, data })))
    message(frame.contentWindow as Window, "https://wrong.example", { runframe_type: "runframe_ready_to_receive" })
    message(window, origin, { runframe_type: "runframe_ready_to_receive" })
    expect(send).not.toHaveBeenCalled()
    act(() => root.render(<TsCircuitPreview code="latest" />))
    message(frame.contentWindow as Window, origin, { runframe_type: "runframe_ready_to_receive" })
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ runframe_props: expect.objectContaining({ evalVersion: "0.0.1675", evalWebWorkerBlobUrl: expect.stringMatching(/^data:application\/javascript/), fsMap: { "main.tsx": "latest" }, defaultActiveTab: "schematic" }) }), origin)
    act(() => root.render(<TsCircuitPreview code="edited" />))
    expect(host.querySelector("iframe")).toBe(frame)
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ runframe_props: { fsMap: { "main.tsx": "edited" } } }), origin)
    message(frame.contentWindow as Window, origin, { type: "runframe_event", runframe_event: { type: "error", error_message: "<bad TSX>" } })
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("<bad TSX>")
    act(() => root.render(<TsCircuitPreview code="fixed" />))
    expect(host.querySelector('[role="alert"]')).toBeNull()
  })
})
