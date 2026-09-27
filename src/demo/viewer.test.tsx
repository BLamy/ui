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

describe("DemoViewer look: tag attributes, then meta.json", () => {
  const ONE = [{ path: "index.tsx", content: "export default function Demo() { return null }", language: "tsx" }]
  const withMeta = (meta: Record<string, unknown>): DemoResolver => ({
    list: () => ["look/demo"],
    meta: async () => meta,
    files: async () => ONE,
    load: async () => () => null,
  })

  it("honours tag attributes with no resolver (status, variantsWidth)", () => {
    const md = '{% demo src="pasted/demo" title="Say \\"hi\\"" status="Needs network" variants="a:A,b:B" variantsWidth="220" bleed="true" %}\n```tsx title="index.tsx"\nexport default function Demo() { return null }\n```\n{% enddemo %}'
    const html = renderToString(<MarkdownContent markdown={md} />)
    expect(html).toContain('<span class="docs-demo-status">Needs network</span>')
    expect(html).toContain("width:220px")
    expect(html).toContain("Say &quot;hi&quot;")
  })

  it("tag attributes override meta.json where both exist; meta fills the rest", async () => {
    const { preloadDemos } = await import("./DemoViewer")
    const resolver = withMeta({ status: "From meta", variants: [{ id: "a", label: "A" }], variantsWidth: 100, title: "Meta title" })
    await preloadDemos(resolver, ["look/demo"])
    const fromMeta = renderToString(<DemoViewer src="look/demo" resolver={resolver} />)
    expect(fromMeta).toContain('<span class="docs-demo-status">From meta</span>')
    expect(fromMeta).toContain("width:100px")
    const overridden = renderToString(<DemoViewer src="look/demo" resolver={resolver} status="From tag" variantsWidth="12rem" />)
    expect(overridden).toContain('<span class="docs-demo-status">From tag</span>')
    expect(overridden).toContain("width:12rem")
    expect(overridden).toContain("Meta title")
  })

  it("single-file previews carry no min-height unless a height is given", async () => {
    const { preloadDemos } = await import("./DemoViewer")
    const resolver = withMeta({})
    await preloadDemos(resolver, ["look/demo"])
    const html = renderToString(<DemoViewer src="look/demo" resolver={resolver} />)
    expect(html).toContain("docs-demo-single-preview")
    expect(html).not.toContain("min-height")
    expect(renderToString(<DemoViewer src="look/demo" resolver={resolver} height={200} />)).toContain("min-height:200px")
  })
})

describe("surface: meta.json object ⇄ tag declarations", () => {
  it("converts both ways", async () => {
    const { cssToSurface, surfaceToCss } = await import("./surface")
    expect(surfaceToCss({ background: "var(--brand-50)", "--demo-gap": "12px", padding: 8 })).toBe("background: var(--brand-50); --demo-gap: 12px; padding: 8")
    expect(cssToSurface('background: url("a;b.png"); --demo-gap: 12px; padding: 8; border-radius: 4px; ')).toEqual({
      background: 'url("a;b.png")',
      "--demo-gap": "12px",
      padding: 8,
      borderRadius: "4px",
    })
  })

  it("inlineDemoMarkdown folds meta.json's look into the tag; the tag's own values win", async () => {
    const { inlineDemoMarkdown } = await import("./markdown")
    const meta = { status: "Live", bleed: true, className: "c", surface: { background: "red" }, variantsWidth: 180 }
    expect(inlineDemoMarkdown({ type: "demo", src: "a/b" }, ONE_FILE, meta)).toBe(
      '{% demo src="a/b" status="Live" bleed="true" className="c" surface="background: red" variantsWidth="180" %}\n```tsx title="index.tsx"\nx\n```\n{% enddemo %}',
    )
    expect(inlineDemoMarkdown({ type: "demo", src: "a/b", status: "Beta", bleed: false }, ONE_FILE, meta)).toContain('status="Beta" bleed="false"')
  })
})

const ONE_FILE = [{ path: "index.tsx", content: "x\n", language: "tsx" }]
