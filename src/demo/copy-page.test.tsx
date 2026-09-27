/* Acceptance test for 1.2.0: "Copy page" gives Markdown that renders back to the same page. */
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
// @ts-ignore react-dom's types aren't installed; only this function is needed.
import { renderToString as untypedRenderToString } from "react-dom/server"
import type { ReactElement } from "react"
import { MarkdownContent } from "../docs/DocsRenderer"
import { preloadDemos } from "./DemoViewer"
import { resolveDemosToMarkdown } from "./markdown"
import type { DemoResolver, InlineDemoRuntime } from "./types"

const renderToString = untypedRenderToString as (element: ReactElement) => string
const page = readFileSync(new URL("../gitbook/__fixtures__/docs-page.md", import.meta.url), "utf8")

const FILES: Record<string, { path: string; content: string; language?: string }[]> = {
  "button/sizes": [
    { path: "index.tsx", content: 'import { Button } from "@brett_lamy/ui"\n\nexport default function Sizes({ variant }: { variant?: string }) {\n  return <Button size={variant}>Save</Button>\n}\n', language: "tsx" },
    { path: "sizes.css", content: ".row { display: flex }\n", language: "css" },
  ],
  "button/ghost": [{ path: "index.tsx", content: "export default () => <button>Ghost</button>\n", language: "tsx" }],
}

function makeResolver(): DemoResolver {
  return {
    list: () => Object.keys(FILES),
    meta: async (src) => (src === "button/ghost" ? { title: "Ghost button", height: 240, variants: [{ id: "a", label: "A" }] } : undefined),
    files: async (src) => {
      if (!FILES[src]) throw new Error(`unknown ${src}`)
      return FILES[src]
    },
    load: async () => () => null,
  }
}

/** A runtime stand-in: the preview frame renders, whatever runs inside it. */
const runtime: InlineDemoRuntime = () => null

/**
 * The rendered page with the incidental differences between "component from the resolver" and
 * "the same files run from the Markdown" removed: React ids, where the preview comes from, and
 * the resolver-only deep link.
 */
function normalize(html: string): string {
  return html
    .replace(/ (id|aria-labelledby|aria-controls|for)="[^"]*"/g, "")
    .replace(/ data-demo-mode="[^"]*"/g, "")
    .replace(/<a class="docs-demo-icon-btn"[^>]*>.*?<\/a>/g, "")
    .replace(/ style="[^"]*"/g, "")
}

async function renderBoth(resolver: DemoResolver | undefined) {
  const copied = await resolveDemosToMarkdown(page, makeResolver())
  const original = makeResolver()
  await preloadDemos(original, Object.keys(FILES))
  if (resolver) await preloadDemos(resolver, Object.keys(FILES))
  const before = renderToString(<MarkdownContent markdown={page} demoResolver={original} demoRuntime={runtime} />)
  const after = renderToString(<MarkdownContent markdown={copied} demoResolver={resolver} demoRuntime={runtime} />)
  return { copied, before, after }
}

describe("Copy page → paste into docstream", () => {
  it("is valid docstream that keeps every demo, install box, tab set and heading", async () => {
    const { copied } = await renderBoth(undefined)
    expect(copied).not.toContain("**Example —")
    expect(copied).toContain('{% tabs title="Installation" sync="install-method" %}')
    expect(copied).toContain("{% command %}npm install @brett_lamy/ui{% endcommand %}")
    expect(copied.match(/\{% demo /g)?.length).toBe(page.match(/\{% demo /g)?.length)
    expect(copied.match(/\{% enddemo %\}/g)?.length).toBe(3)
    // The Code view (a hidden tab, so not in the server HTML) gets exactly the resolver's files.
    const { parseMarkdown } = await import("../gitbook/parse")
    const inline = (src: string) => {
      const find = (blocks: import("../gitbook/ast").Block[]): import("../gitbook/ast").DemoNode | undefined => {
        for (const b of blocks) {
          if (b.type === "demo" && b.src === src) return b
          if (b.type === "tabs") for (const t of b.tabs) { const hit = find(t.children); if (hit) return hit }
        }
      }
      return find(parseMarkdown(copied).children)?.files?.map((f) => [f.path, f.content])
    }
    for (const src of Object.keys(FILES)) {
      expect(inline(src)).toEqual(FILES[src].map((f) => [f.path, f.content.replace(/\n+$/, "")]))
    }
  })

  it("renders the same page with the resolver", async () => {
    const { before, after } = await renderBoth(makeResolver())
    expect(normalize(after)).toBe(normalize(before))
  })

  it("renders the same page without any resolver (demos run from their inline files)", async () => {
    const { before, after } = await renderBoth(undefined)
    expect(normalize(after)).toBe(normalize(before))
    expect(after).toContain('data-demo-mode="inline"')
    expect(after).not.toContain('data-demo-mode="resolver"')
  })

  it("would catch a lossy copy (control: the plain/LLM format does not render the same page)", async () => {
    const { before } = await renderBoth(undefined)
    expect(before).toContain("Ghost button")
    expect(before).toContain('class="docs-tabs-section-title">Installation</h2>')
    const plain = await resolveDemosToMarkdown(page, makeResolver(), { format: "plain" })
    const rendered = renderToString(<MarkdownContent markdown={plain} demoRuntime={runtime} />)
    expect(normalize(rendered)).not.toBe(normalize(before))
    expect(rendered).not.toContain("docs-demo")
  })
})
