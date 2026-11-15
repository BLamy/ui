// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { mount, tick } from "../__fixtures__/dom"
import { MarkdownContent } from "./DocsRenderer"
import { HighlightedCode } from "./HighlightedCode"
import { FALLBACK_MAX_LENGTH, fallbackSpans } from "./fallback-lexer"

/* gpu-lexer, three ways: the real module (no WebGPU in happy-dom, so its parse() rejects), a parse() that rejects
   outright, and one that resolves with its own spans. */
const gpu = vi.hoisted(() => ({ mode: "actual" as "actual" | "reject" | "resolve", calls: 0 }))
vi.mock("gpu-lexer", async (importActual) => {
  const actual = await importActual<typeof import("gpu-lexer")>()
  return {
    parse: (code: string) => {
      gpu.calls++
      if (gpu.mode === "reject") return Promise.reject(new Error("WebGPU buffer limit"))
      if (gpu.mode === "resolve") return Promise.resolve([{ type: "function", start: 0, end: code.indexOf(" ") }])
      return actual.parse(code)
    },
  }
})

afterEach(() => {
  gpu.mode = "actual"
  gpu.calls = 0
})

const TS = 'import { useState } from "react"\n// the count\nexport const count: number = 42\nfunction App() { return useState(count) }'

/** The colored tokens, as `type:text`. */
const tokens = (root: ParentNode) =>
  [...root.querySelectorAll(".docs-tok")].map((el) => `${el.className.replace("docs-tok docs-tok-", "")}:${el.textContent}`)

describe("HighlightedCode without WebGPU", () => {
  it("colors a fence through the fallback when WebGPU is absent", async () => {
    expect("gpu" in navigator).toBe(false)
    const view = await mount(<pre><HighlightedCode code={TS} language="ts" /></pre>)
    await tick(20)
    const code = view.host.querySelector("code")!
    expect(code.getAttribute("data-highlighter")).toBe("fallback")
    expect(gpu.calls).toBe(1)
    expect(tokens(code)).toEqual(expect.arrayContaining([
      "keyword:import", "keyword:from", 'string:"react"', "comment:// the count", "keyword:export", "keyword:const",
      "type:number", "number:42", "keyword:function", "function:App", "function:useState",
    ]))
    // Punctuation and operators share the operator color; the text is untouched.
    expect(tokens(code)).toContain("operator:=")
    expect(code.textContent).toBe(TS)
    await view.unmount()
  })

  it("keeps the fallback's colors when parse() rejects", async () => {
    gpu.mode = "reject"
    const view = await mount(<pre><HighlightedCode code={TS} language="tsx" /></pre>)
    await tick(20)
    const code = view.host.querySelector("code")!
    expect(gpu.calls).toBe(1)
    expect(code.getAttribute("data-highlighter")).toBe("fallback")
    expect(tokens(code)).toEqual(expect.arrayContaining(["keyword:import", 'string:"react"', "number:42", "comment:// the count"]))
    await view.unmount()
  })

  it("colors on the server, before any effect, so the first paint is highlighted", () => {
    const html = renderToStaticMarkup(<HighlightedCode code={'SELECT id FROM users WHERE name = \'x\''} language="sql" />)
    expect(html).toContain('data-highlighter="fallback"')
    expect(html).toContain('<span class="docs-tok docs-tok-keyword">SELECT</span>')
    expect(html).toContain(`<span class="docs-tok docs-tok-string">'x'</span>`)
  })

  it("cuts multi-line tokens at line breaks when lines are numbered", async () => {
    gpu.mode = "reject"
    const view = await mount(<pre><HighlightedCode code={"/* one\ntwo */\nconst x = 1"} language="js" lineNumbers /></pre>)
    const lines = [...view.host.querySelectorAll(".docs-code-line")]
    expect(lines.map((line) => tokens(line))).toEqual([["comment:/* one"], ["comment:two */"], ["keyword:const", "operator:=", "number:1"]])
    await view.unmount()
  })

  it("lets gpu-lexer's spans replace the fallback's when it resolves", async () => {
    gpu.mode = "resolve"
    const view = await mount(<pre><HighlightedCode code={TS} language="ts" /></pre>)
    await tick(20)
    const code = view.host.querySelector("code")!
    expect(code.getAttribute("data-highlighter")).toBe("gpu")
    expect(tokens(code)).toEqual(["function:import"])
    await view.unmount()
  })

  it("leaves plain-text fences plain", async () => {
    const view = await mount(<pre><HighlightedCode code={"just words 42"} language="text" /></pre>)
    await tick(20)
    expect(view.host.querySelector("code")!.getAttribute("data-highlighter")).toBe("none")
    expect(tokens(view.host)).toEqual([])
    await view.unmount()
  })

  it("highlights markdown code fences end to end", async () => {
    const view = await mount(<MarkdownContent markdown={"```python\ndef run(n: int) -> None:\n    return None  # done\n```"} />)
    await tick(20)
    expect(tokens(view.host.querySelector(".docs-code")!)).toEqual(expect.arrayContaining([
      "keyword:def", "function:run", "type:int", "constant:None", "keyword:return", "comment:# done",
    ]))
    await view.unmount()
  })
})

/** `type:text` for each span the fallback finds. */
const lex = (code: string, language: string | null) => fallbackSpans(code, language).map((s) => `${s.type}:${code.slice(s.start, s.end)}`)

describe("fallbackSpans", () => {
  it("returns sorted, non-overlapping spans (touching spans of one type merge)", () => {
    for (const [code, language] of [[TS, "tsx"], ["a { color: red }", "css"], ["<p>x</p>", "html"], ["# x\n```js\nlet a\n```", "md"]] as const) {
      const spans = fallbackSpans(code, language)
      spans.forEach((s, i) => {
        expect(s.end).toBeGreaterThan(s.start)
        if (i) expect(s.start).toBeGreaterThanOrEqual(spans[i - 1]!.end)
      })
    }
  })

  it("json: keys, strings, numbers, constants and punctuation", () => {
    expect(lex('{"name": "docstream", "n": -2.5, "ok": true, "x": null}', "json")).toEqual([
      "operator:{", 'keyword:"name"', "operator::", 'string:"docstream"', "operator:,", 'keyword:"n"', "operator::", "number:-2.5",
      "operator:,", 'keyword:"ok"', "operator::", "constant:true", "operator:,", 'keyword:"x"', "operator::", "constant:null", "operator:}",
    ])
  })

  it("css: at-rules, selectors, pseudo-classes, properties, values, functions and comments", () => {
    const out = lex("/* c */\n@media (min-width: 600px) {\n  .card:hover, #main { color: #fff; margin: 0 auto; background: var(--x) !important; }\n}", "css")
    expect(out).toEqual(expect.arrayContaining([
      "comment:/* c */", "keyword:@media", "number:600px", "type:.card", "keyword::hover", "type:#main", "type:color", "number:#fff",
      "type:margin", "number:0", "function:var", "constant:--x", "keyword:!important",
    ]))
    expect(out).not.toContain("keyword:auto")
  })

  it("html: tags, attributes, values, entities, comments, and script and style bodies", () => {
    expect(lex('<!-- hi -->\n<div class="a">A &amp; B</div><script>const x = 1</script>', "html")).toEqual([
      "comment:<!-- hi -->", "operator:<", "keyword:div", "type:class", "operator:=", 'string:"a"', "operator:>", "constant:&amp;",
      "operator:</", "keyword:div", "operator:><", "keyword:script", "operator:>", "keyword:const", "operator:=", "number:1",
      "operator:</", "keyword:script", "operator:>",
    ])
  })

  it("bash: comments, prompts, commands, keywords, strings and variables", () => {
    expect(lex('# install\n$ npm install docstream && echo "done $HOME"\nexport NODE_ENV=production\nif [ -f x ]; then cat x | grep -v y; fi', "bash")).toEqual([
      "comment:# install", "operator:$", "function:npm", "operator:&&", "function:echo", 'string:"done $HOME"', "keyword:export",
      "constant:NODE_ENV", "operator:=", "keyword:if", "operator:[", "operator:];", "keyword:then", "function:cat", "operator:|",
      "function:grep", "operator:;", "keyword:fi",
    ])
  })

  it("python: decorators, classes, defs, docstrings, constants and comments", () => {
    expect(lex('@dataclass\nclass Foo(Base):\n    """Doc."""\n    def run(self) -> None:  # go\n        return 3', "python")).toEqual([
      "function:@dataclass", "keyword:class", "type:Foo", "operator:(", "type:Base", "operator:):", 'string:"""Doc."""', "keyword:def",
      "function:run", "operator:(", "constant:self", "operator:)", "operator:->", "constant:None", "operator::", "comment:# go",
      "keyword:return", "number:3",
    ])
  })

  it("sql: keywords in any case, tables, types, functions, strings and comments", () => {
    expect(lex("-- top\nselect count(*) from users where name = 'bob''s';\nCREATE TABLE t (id INTEGER NOT NULL);", "sql")).toEqual([
      "comment:-- top", "keyword:select", "function:count", "operator:(*)", "keyword:from", "type:users", "keyword:where", "operator:=",
      "string:'bob''s'", "operator:;", "keyword:CREATE", "keyword:TABLE", "type:t", "operator:(", "type:INTEGER", "keyword:NOT",
      "constant:NULL", "operator:);",
    ])
  })

  it("markdown: headings, emphasis, code, links, list markers, and fences in their own language", () => {
    expect(lex("# Title\n\nSome **bold** and `code` and [a link](https://x.dev).\n- item\n```ts\nconst a = 1\n```", "md")).toEqual([
      "keyword:# Title", "constant:**bold**", "string:`code`", "operator:[", "function:](https://x.dev)", "operator:-", "comment:```ts",
      "keyword:const", "operator:=", "number:1", "comment:```",
    ])
  })

  it("other languages get the C-family default; plain text and huge sources get nothing", () => {
    expect(lex('fn main() { let x = 5; println!("{}", x); }', "rust")).toEqual(expect.arrayContaining(["keyword:fn", "function:main", "keyword:let", "number:5", 'string:"{}"']))
    expect(lex("const a = 1", null)).toEqual(["keyword:const", "operator:=", "number:1"])
    expect(lex("const a = 1", "text")).toEqual([])
    expect(fallbackSpans("x".repeat(FALLBACK_MAX_LENGTH + 1), "ts")).toEqual([])
  })
})
