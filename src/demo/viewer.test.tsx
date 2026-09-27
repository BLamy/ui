// react-dom is installed (a peer of our deps) but its types are not; the test only needs this one function.
// @ts-ignore
import { renderToString as untypedRenderToString } from "react-dom/server"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { MarkdownContent } from "../docs/DocsRenderer"
import { DemoViewer, NO_RUNTIME_NOTE } from "./DemoViewer"
import type { DemoResolver, InlineDemoRuntimeProps } from "./types"

const renderToString = untypedRenderToString as (element: ReactElement) => string

const FILES = [
  { path: "index.tsx", content: "export default function Demo() { return null }", language: "tsx" },
  { path: "data.ts", content: "export const rows = 1", language: "ts" },
]

const known: DemoResolver = {
  list: () => ["a/b"],
  meta: async () => undefined,
  files: async () => [],
  load: async () => () => null,
}

describe("DemoViewer sources", () => {
  it("inline files without a runtime: opens on the code with a note, never an empty preview", () => {
    const html = renderToString(<DemoViewer src="pasted/demo" title="Pasted" files={FILES} />)
    expect(html).toContain('data-demo-mode="inline"')
    expect(html).toContain(NO_RUNTIME_NOTE)
    expect(html).toContain("docs-demo-code")
    expect(html).toContain("index.tsx")
    expect(html).not.toContain("docs-demo-stage")
  })

  it("inline files with a runtime: a preview stage, no note", () => {
    const calls: InlineDemoRuntimeProps[] = []
    const runtime = (props: InlineDemoRuntimeProps) => {
      calls.push(props)
      return <span>runtime</span>
    }
    const html = renderToString(<DemoViewer src="pasted/demo" files={FILES} runtime={runtime} />)
    expect(html).toContain('data-demo-mode="inline"')
    expect(html).toContain("docs-demo-stage")
    expect(html).not.toContain(NO_RUNTIME_NOTE)
  })

  it("a resolver that knows src wins over inline files; one that doesn't falls back to them", () => {
    expect(renderToString(<DemoViewer src="a/b" files={FILES} resolver={known} />)).toContain('data-demo-mode="resolver"')
    expect(renderToString(<DemoViewer src="x/y" files={FILES} resolver={known} />)).toContain('data-demo-mode="inline"')
  })

  it("renders a pasted block from Markdown with no resolver at all", () => {
    const md = '{% demo src="pasted/demo" title="Pasted" %}\n```tsx title="index.tsx"\nexport default function Demo() { return null }\n```\n{% enddemo %}'
    const html = renderToString(<MarkdownContent markdown={md} />)
    expect(html).toContain('data-demo-mode="inline"')
    expect(html).toContain("Pasted")
    expect(html).toContain(NO_RUNTIME_NOTE)
  })
})
