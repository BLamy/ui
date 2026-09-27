/* Focused conversions for the docstream 1.2 AST shapes: inline demo files, command boxes, titled tabs, linkInner. */
import { describe, expect, it } from "vitest"
import { parseMarkdown, serializeMarkdown, type DocumentNode } from "@brett_lamy/docstream/gitbook"
import { astToTiptap, markdownPasteContent, serializeEditorMarkdown, tiptapToAst, type PMNode } from "./convert"
import { getGitbookSchema } from "./extensions"

const schema = getGitbookSchema()

/** Through the real ProseMirror schema, as in the live editor. */
function throughEditor(markdown: string): string {
  const doc = parseMarkdown(markdown)
  const node = schema.nodeFromJSON(astToTiptap(doc))
  node.check()
  const ast: DocumentNode = tiptapToAst(node.toJSON() as PMNode)
  if (doc.citations?.length) ast.citations = doc.citations
  return serializeEditorMarkdown(ast)
}

const first = (markdown: string) => astToTiptap(parseMarkdown(markdown)).content![0]!

describe("{% demo %} with inline files", () => {
  const block = [
    '{% demo src="composer/scroll-fab" title="Scroll" height="380" variants="full:Full,compact" entry="App.tsx" %}',
    '```tsx title="index.tsx"',
    'export { default } from "./App"',
    "```",
    '```tsx title="App.tsx"',
    "export default function App() {",
    "  return <p>hi</p>",
    "}",
    "```",
    '````md title="README.md"',
    "```sh",
    "npm start",
    "```",
    "````",
    '``` title="notes"',
    "no language",
    "```",
    "{% enddemo %}",
    "",
  ].join("\n")

  it("round-trips byte-for-byte (entry, nested fences, files without a language)", () => {
    expect(throughEditor(block)).toBe(block)
  })

  it("keeps every file on the gbDemo node, in order", () => {
    const pm = first(block)
    expect(pm.attrs?.entry).toBe("App.tsx")
    expect(pm.attrs?.files).toEqual([
      { path: "index.tsx", content: 'export { default } from "./App"', language: "tsx" },
      { path: "App.tsx", content: "export default function App() {\n  return <p>hi</p>\n}", language: "tsx" },
      { path: "README.md", content: "```sh\nnpm start\n```", language: "md" },
      { path: "notes", content: "no language" },
    ])
  })

  it("edits to files serialize as the block form; removing every file gives the tag form", () => {
    const pm = astToTiptap(parseMarkdown(block))
    const demo = pm.content![0]!
    demo.attrs = { ...demo.attrs, files: [{ path: "index.tsx", content: "export default () => null", language: "tsx" }], entry: null }
    expect(serializeEditorMarkdown(tiptapToAst(pm))).toBe(
      '{% demo src="composer/scroll-fab" title="Scroll" height="380" variants="full:Full,compact" %}\n```tsx title="index.tsx"\nexport default () => null\n```\n{% enddemo %}\n'
    )
    demo.attrs = { ...demo.attrs, files: null }
    expect(serializeEditorMarkdown(tiptapToAst(pm))).toBe(
      '{% demo src="composer/scroll-fab" title="Scroll" height="380" variants="full:Full,compact" %}\n'
    )
  })

  it("never serializes the streaming-only `open` flag", () => {
    const streaming = block.replace("{% enddemo %}\n", "")
    const doc = parseMarkdown(streaming)
    const out = serializeEditorMarkdown(tiptapToAst(astToTiptap(doc)))
    expect(out).not.toContain("open")
  })
})

describe("{% command %}", () => {
  it.each([
    "{% command %}npm install @brett_lamy/ui{% endcommand %}\n",
    "{% command %}\nnpm install -D vitest\nnpm run test -- --watch\n{% endcommand %}\n",
    '{% command pnpm="pnpm dlx shadcn@latest add button" %}npx shadcn@latest add https://example.com/r/button.json{% endcommand %}\n',
    '{% command pnpm="pnpm add x" yarn="yarn add x" bun="bun add x" sync="install" %}npm install x{% endcommand %}\n',
  ])("round-trips %s", (markdown) => {
    expect(throughEditor(markdown)).toBe(markdown)
  })

  it("is an atom gbCommand node carrying the command, overrides and sync", () => {
    expect(first('{% command yarn="yarn add y" sync="install" %}npm i y{% endcommand %}\n')).toEqual({
      type: "gbCommand",
      attrs: { command: "npm i y", overrides: { yarn: "yarn add y" }, sync: "install" },
    })
    expect(first("{% command %}npm i y{% endcommand %}\n").attrs).toEqual({ command: "npm i y", overrides: null, sync: null })
  })

  it("inside a titled tab set", () => {
    const markdown = '{% tabs title="Install" %}\n{% tab title="npm" %}\n{% command %}npm i x{% endcommand %}\n{% endtab %}\n{% endtabs %}\n'
    expect(throughEditor(markdown)).toBe(markdown)
  })
})

describe("titled tabs", () => {
  it.each([
    '{% tabs title="Installation" sync="install-method" %}\n{% tab title="npm" %}\nA\n{% endtab %}\n\n{% tab title="CLI" %}\nB\n{% endtab %}\n{% endtabs %}\n',
    '{% tabs title="Setup" level="3" %}\n{% tab title="A" %}\na\n{% endtab %}\n{% endtabs %}\n',
    '{% tabs title="Deep" level="4" sync="pm" %}\n{% tab title="A" %}\na\n{% endtab %}\n{% endtabs %}\n',
  ])("round-trips %s", (markdown) => {
    expect(throughEditor(markdown)).toBe(markdown)
  })

  it("keeps title and level on gbTabs", () => {
    expect(first('{% tabs title="Setup" level="3" %}\n{% tab title="A" %}\na\n{% endtab %}\n{% endtabs %}\n').attrs).toEqual({
      title: "Setup",
      level: 3,
    })
  })
})

describe("links inside emphasis (linkInner)", () => {
  it.each([
    "**[x](https://a.dev)** and [**x**](https://a.dev)\n",
    "_[y](https://a.dev)_ vs [_y_](https://a.dev), ~~[z](https://a.dev)~~ vs [~~z~~](https://a.dev)\n",
    "A **bold** [**link**](https://a.dev) and a [plain](https://a.dev) one.\n",
  ])("round-trips %s", (markdown) => {
    expect(throughEditor(markdown)).toBe(markdown)
  })

  it("matches docstream's own parse → serialize where that isn't byte-stable either", () => {
    // docstream serializes a link inside a longer emphasis run per text node; the editor adds nothing.
    const markdown = "A **bold [link](https://a.dev) inside** run.\n"
    expect(throughEditor(markdown)).toBe(serializeMarkdown(parseMarkdown(markdown)))
  })

  it("marks the inner form on the link mark only", () => {
    const [inner, , outer] = first("**[x](https://a.dev)** [**x**](https://a.dev)\n").content!
    expect(inner!.marks).toContainEqual({ type: "link", attrs: { href: "https://a.dev", inner: true } })
    expect(outer!.marks).toContainEqual({ type: "link", attrs: { href: "https://a.dev" } })
  })
})

describe("other lossless details", () => {
  it.each([
    '```ts collapsedCodeLines="3" expandedCodeLines="20"\nconst a = 1\n```\n',
    '{% content-ref url="card.md" %}\n[Card](card.md)\n{% endcontent-ref %}\n',
    '{% content-ref url="card.md" %}\nCard\n{% endcontent-ref %}\n',
  ])("round-trips %s", (markdown) => {
    expect(throughEditor(markdown)).toBe(markdown)
  })
})

describe("pasting Markdown", () => {
  it("turns block Markdown into editor blocks", () => {
    const pasted = markdownPasteContent("## Install\n\n{% command %}npm i x{% endcommand %}\n\n[^1]: https://a.dev \"A\"\n")
    expect(pasted?.content.map((n) => n.type)).toEqual(["heading", "gbCommand"])
    expect(pasted?.citations).toEqual([{ id: "1", url: "https://a.dev", label: "A" }])
  })

  it("leaves plain prose to the default paste", () => {
    expect(markdownPasteContent("just a sentence with a * star")).toBeNull()
    expect(markdownPasteContent("   ")).toBeNull()
  })
})
