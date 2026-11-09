// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MarkdownContent } from "../docs/DocsRenderer"
import { DOCSTREAM_CLIPBOARD_TYPE, parseDocstreamClipboard } from "./clipboard"
import { DemoViewer, NO_RUNTIME_NOTE, peekDemoSource, prefetchDemoSources } from "./DemoViewer"
import { createDemoVFS } from "./vfs"
import type { DemoFile, DemoResolver } from "./types"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const FILES: DemoFile[] = [
  { path: "index.tsx", content: "export default () => <p>hi</p>\n", language: "tsx" },
  { path: "data.ts", content: "export const rows = 1\n", language: "ts" },
]
const resolver: DemoResolver = {
  list: () => ["button/basic"],
  meta: async () => ({ title: "Basic" }),
  files: async () => FILES,
  load: async () => () => null,
}

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  // No IntersectionObserver: demos count as near the viewport straight away.
  vi.stubGlobal("IntersectionObserver", undefined)
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const flush = async () => {
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

/** `document.execCommand("copy")` as a browser does it: a copy event with a fresh DataTransfer. */
function stubCopyCommand() {
  const transfers: DataTransfer[] = []
  ;(document as { execCommand: unknown }).execCommand = vi.fn((command: string) => {
    if (command !== "copy") return false
    const clipboardData = new DataTransfer()
    transfers.push(clipboardData)
    const target = (document.activeElement as HTMLElement | null) ?? document.body
    target.dispatchEvent(new ClipboardEvent("copy", { clipboardData, bubbles: true, cancelable: true }))
    return true
  })
  return transfers
}

describe("DemoViewer: Copy demo", () => {
  it("writes Markdown with the resolver's files inline plus the docstream payload", async () => {
    const transfers = stubCopyCommand()
    await act(async () => root.render(<DemoViewer src="button/basic" resolver={resolver} />))
    await flush()
    const button = host.querySelector<HTMLButtonElement>("[data-docstream-copy-demo]")!
    expect(button).toBeTruthy()
    await act(async () => button.click())
    await flush()
    expect(transfers).toHaveLength(1)
    const data = transfers[0]
    const text = data.getData("text/plain")
    expect(text).toContain('{% demo src="button/basic" title="Basic" %}')
    expect(text).toContain('```ts title="data.ts"')
    expect(data.getData("text/markdown")).toBe(text)
    const payload = parseDocstreamClipboard(data.getData(DOCSTREAM_CLIPBOARD_TYPE))!
    expect(payload.markdown).toBe('{% demo src="button/basic" %}\n')
    expect(payload.files["button/basic"].map((f) => f.path)).toEqual(["index.tsx", "data.ts"])
    expect(button.getAttribute("aria-label")).toBe("Copied")
  })

  it("falls back to plain-text Markdown when the copy command is unavailable", async () => {
    ;(document as { execCommand: unknown }).execCommand = () => false
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    await act(async () => root.render(<DemoViewer src="button/basic" resolver={resolver} />))
    await flush()
    await act(async () => host.querySelector<HTMLButtonElement>("[data-docstream-copy-demo]")!.click())
    await flush()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("{% enddemo %}"))
  })
})

describe("DemoViewer: the demo VFS", () => {
  it("a src-only block renders the VFS files (Code view + note without a runtime)", async () => {
    const vfs = createDemoVFS({ "pasted/demo": { files: FILES, meta: { title: "Pasted" } } })
    await act(async () => root.render(<MarkdownContent markdown={'{% demo src="pasted/demo" %}\n'} demoVFS={vfs} />))
    await flush()
    const section = host.querySelector("[data-docstream-demo]")!
    expect(section.getAttribute("data-demo-mode")).toBe("inline")
    expect(host.textContent).toContain("Pasted")
    expect(host.textContent).toContain(NO_RUNTIME_NOTE)
    expect(host.textContent).toContain("data.ts")
  })

  it("the host resolver wins when it knows src; a runtime runs VFS files; VFS updates re-render", async () => {
    const vfs = createDemoVFS({ "button/basic": { files: [{ path: "index.tsx", content: "vfs" }] } })
    await act(async () => root.render(<DemoViewer src="button/basic" resolver={resolver} vfs={vfs} />))
    await flush()
    expect(host.querySelector("[data-docstream-demo]")!.getAttribute("data-demo-mode")).toBe("resolver")

    const runtime = vi.fn(() => <span data-runtime="">ran</span>)
    await act(async () => root.render(<DemoViewer key="b" src="late/demo" vfs={vfs} runtime={runtime} />))
    await flush()
    expect(host.querySelector("[data-docstream-demo]")?.getAttribute("data-demo-mode") ?? "none").not.toBe("inline")
    await act(async () => vfs.set("late/demo", FILES, { title: "Late" }))
    await flush()
    expect(host.querySelector("[data-docstream-demo]")!.getAttribute("data-demo-mode")).toBe("inline")
    expect(host.querySelector("[data-runtime]")).toBeTruthy()
    expect(runtime).toHaveBeenCalledWith(expect.objectContaining({ src: "late/demo", title: "Late", entry: "index.tsx" }))
  })

  it("prefetchDemoSources fills the cache peekDemoSource reads synchronously", async () => {
    const r: DemoResolver = { ...resolver, meta: async () => ({ title: "P" }) }
    expect(peekDemoSource(r, "button/basic")).toBeUndefined()
    await prefetchDemoSources(r, ["button/basic"])
    expect(peekDemoSource(r, "button/basic")).toEqual({ files: FILES, meta: { title: "P" } })
  })
})
