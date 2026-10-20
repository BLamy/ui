import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MarkdownContent } from "../docs/DocsRenderer"
import { parseMarkdown } from "../gitbook/parse"
import { serializeMarkdown } from "../gitbook/serialize"
import { isStrudelFile, isStrudelLanguage } from "./url"

describe("Strudel", () => {
  it("renders a ```strudel fence as a player, keeping the code", () => {
    const md = '```strudel\nnote("c e g").s("piano")\n```\n'
    expect(serializeMarkdown(parseMarkdown(md))).toBe(md)
    const html = renderToStaticMarkup(<MarkdownContent markdown={md} />)
    expect(html).toContain("docstream-strudel")
    expect(html).toContain('aria-label="Play Strudel pattern"')
    expect(html).not.toContain("<iframe")
  })

  it("uses a fence title as the track name", () => {
    const md = '{% code title="Night drive" %}\n```strudel\ns("bd sd")\n```\n{% endcode %}\n'
    expect(renderToStaticMarkup(<MarkdownContent markdown={md} />)).toContain("Play Night drive")
  })

  it("renders {% embed %} of a .strudel file as a player", () => {
    const md = '{% embed url="music/loop.strudel" %}\n'
    const html = renderToStaticMarkup(<MarkdownContent markdown={md} />)
    expect(html).toContain("docstream-strudel")
    expect(html).toContain("Play loop.strudel")
  })

  it("detects files and fence languages", () => {
    expect(isStrudelFile("a/b.strudel?v=2")).toBe(true)
    expect(isStrudelFile("a/b.strudel.md")).toBe(false)
    expect(isStrudelLanguage("Strudel")).toBe(true)
    expect(isStrudelLanguage("js")).toBe(false)
  })
})
