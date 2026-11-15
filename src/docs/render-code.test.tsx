// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { mount } from "../__fixtures__/dom"
import { GitbookStreamdown } from "../streamdown"
import { CodeRenderContext, type CodeBlockRenderer } from "./code-render"
import { MarkdownContent } from "./DocsRenderer"

vi.mock("gpu-lexer", () => ({ parse: () => Promise.reject(new Error("WebGPU unavailable")) }))

const FENCE = '```ts title="tray.ts"\nexport const tray = 1\n```'
const TABS = '{% tabs %}\n{% tab title="npm" %}\n```bash\nnpm i docstream\n```\n{% endtab %}\n{% tab title="pnpm" %}\n```bash\npnpm add docstream\n```\n{% endtab %}\n{% endtabs %}'

describe("renderCode", () => {
  it("draws a fence the host's way, with the block and docstream's highlighted code", () => {
    const renderCode = vi.fn<CodeBlockRenderer>((block, { placement, highlighted }) => (
      <figure data-host-code={block.language ?? ""} data-placement={placement} title={block.title ?? undefined}>
        <pre>{highlighted}</pre>
      </figure>
    ))
    const html = renderToStaticMarkup(<MarkdownContent markdown={`Intro\n\n${FENCE}`} renderCode={renderCode} />)
    expect(renderCode).toHaveBeenCalledTimes(1)
    const [block, details] = renderCode.mock.calls[0]!
    expect(block).toMatchObject({ type: "code", language: "ts", title: "tray.ts", code: "export const tray = 1" })
    expect(details.placement).toBe("block")
    expect(html).toContain('<figure data-host-code="ts" data-placement="block" title="tray.ts">')
    // The host's figure replaces docstream's chrome; the highlighted code inside it is docstream's.
    expect(html).not.toContain("docs-code-header")
    expect(html).toContain('<span class="docs-tok docs-tok-keyword">export</span>')
  })

  it("falls back to docstream's rendering when it returns null or undefined", () => {
    for (const result of [null, undefined]) {
      const html = renderToStaticMarkup(<MarkdownContent markdown={FENCE} renderCode={() => result} />)
      expect(html).toContain('class="docs-code"')
      expect(html).toContain("docs-code-header")
    }
  })

  it("never receives widget fences", () => {
    const renderCode = vi.fn<CodeBlockRenderer>(() => <div data-host-code="" />)
    renderToStaticMarkup(<MarkdownContent markdown={"```mermaid\nflowchart TD\n  A --> B\n```\n\n```strudel\ns(\"bd\")\n```"} renderCode={renderCode} />)
    expect(renderCode).not.toHaveBeenCalled()
  })

  it("draws a code-only tab set's panels and keeps docstream's tab strip and copy button", async () => {
    const renderCode = vi.fn<CodeBlockRenderer>((block, { placement }) => <div data-host-code={placement}>{block.code}</div>)
    const view = await mount(<MarkdownContent markdown={TABS} renderCode={renderCode} />)
    expect(renderCode.mock.calls.map(([block, details]) => [block.code, details.placement])).toEqual([
      ["npm i docstream", "tab"],
      ["pnpm add docstream", "tab"],
    ])
    expect(view.host.querySelectorAll('[role="tab"]')).toHaveLength(2)
    expect(view.host.querySelector(".docs-tabs-code-head .docs-copy")).not.toBeNull()
    expect(view.host.querySelector('[data-host-code="tab"]')!.textContent).toBe("npm i docstream")
    await view.unmount()
  })

  it("is a GitbookStreamdown prop too, and nested markdown inherits it", () => {
    const html = renderToStaticMarkup(
      <GitbookStreamdown markdown={FENCE} renderCode={(block) => <pre data-host-code="">{block.code}</pre>} />,
    )
    expect(html).toContain('<pre data-host-code="">export const tray = 1</pre>')
    // A renderer nested in one (an OpenAPI description, a demo's markdown) draws its fences the same way.
    const nested = renderToStaticMarkup(
      <CodeRenderContext.Provider value={(block) => <pre data-host-code="">{block.code}</pre>}>
        <MarkdownContent markdown={FENCE} />
      </CodeRenderContext.Provider>,
    )
    expect(nested).toContain('<pre data-host-code="">export const tray = 1</pre>')
  })
})
