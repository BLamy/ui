// @vitest-environment happy-dom
/* SourceFileEditor reads its file when the file changes, not on every host re-render: an inline
   onError or an equal-but-new reference object must not re-read (and drop unsaved edits). Its Save
   button is UI SDK's, pending while it writes. */
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
import type { SourceReferenceClient } from "@brett_lamy/docstream/source"
import type { SourceRefNode } from "@brett_lamy/docstream/gitbook"
import { SourceFileEditor } from "./SourceFileEditor"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it("re-reads only when the referenced file changes", async () => {
  const read = vi.fn(async (r: { path: string }) => ({ content: `// ${r.path}`, provenance: { mount: "m", path: r.path, exportName: "default", kind: "component" as const } }))
  const client = { read, write: vi.fn(), importModule: vi.fn(async () => ({})) } as unknown as SourceReferenceClient
  const ref = (path: string): SourceRefNode => ({ type: "source-ref", mount: "m", path, exportName: "default", kind: "component" })
  const host = document.createElement("div")
  const root = createRoot(host)
  const render = (path: string) =>
    act(async () => root.render(<SourceFileEditor client={client} reference={ref(path)} preview={false} onError={() => {}} />))
  await render("a.tsx")
  await render("a.tsx")
  await render("a.tsx")
  expect(read).toHaveBeenCalledTimes(1)
  await render("b.tsx")
  expect(read).toHaveBeenCalledTimes(2)
  act(() => root.unmount())
})

it("Save is a UI SDK button: focusable while there's nothing to save, pending while it writes, and keeps its name", async () => {
  let finish!: () => void
  const write = vi.fn(
    (r: { path: string }, content: string) =>
      new Promise((resolve) => {
        finish = () => resolve({ content, provenance: { mount: "m", path: r.path, exportName: "default", kind: "component" as const } })
      }),
  )
  const read = vi.fn(async (r: { path: string }) => ({ content: "// a", provenance: { mount: "m", path: r.path, exportName: "default", kind: "component" as const } }))
  const client = { read, write, importModule: vi.fn(async () => ({})) } as unknown as SourceReferenceClient
  const onSaved = vi.fn()
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  await act(async () =>
    root.render(<SourceFileEditor client={client} reference={{ type: "source-ref", mount: "m", path: "a.tsx", exportName: "default", kind: "component" }} preview={false} onSaved={onSaved} />),
  )
  const button = host.querySelector<HTMLButtonElement>('[data-slot="button"]')!
  expect(button.textContent?.trim()).toBe("Save file")
  // Nothing to save: disabled, but focusable (aria-disabled, not the native attribute).
  expect(button.disabled).toBe(false)
  expect(button.getAttribute("aria-disabled")).toBe("true")
  const textarea = host.querySelector<HTMLTextAreaElement>("textarea")!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "// b")
    textarea.dispatchEvent(new Event("input", { bubbles: true }))
  })
  expect(button.hasAttribute("aria-disabled")).toBe(false)
  await act(async () => { button.focus(); button.click() })
  expect(write).toHaveBeenCalledWith(expect.objectContaining({ path: "a.tsx" }), "// b")
  // Writing: pending and disabled, still named "Save file" (screen readers hear "Saving"), focus kept.
  expect(button.hasAttribute("data-pending")).toBe(true)
  expect(button.getAttribute("aria-disabled")).toBe("true")
  expect(button.textContent?.trim()).toBe("Save file")
  expect(document.activeElement).toBe(button)
  await act(async () => { finish() })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
  expect(onSaved).toHaveBeenCalledOnce()
  expect(button.hasAttribute("data-pending")).toBe(false)
  expect(button.getAttribute("aria-disabled")).toBe("true")
  act(() => root.unmount())
  host.remove()
})
