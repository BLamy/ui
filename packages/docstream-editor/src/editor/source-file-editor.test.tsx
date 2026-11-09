// @vitest-environment happy-dom
/* SourceFileEditor reads its file when the file changes, not on every host re-render: an inline
   onError or an equal-but-new reference object must not re-read (and drop unsaved edits). */
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
