import { describe, expect, it } from "vitest"

import { parseMarkdown } from "./parse"
import { serializeMarkdown } from "./serialize"

function codeBlock(markdown: string) {
  const block = parseMarkdown(markdown).children[0]
  if (block?.type !== "code") throw new Error(`expected code block, got ${block?.type}`)
  return block
}

describe("fenced code metadata", () => {
  it("untitled fences have no line numbers by default; titled fences do", () => {
    expect(codeBlock("```ts\nconst value = 1\n```")).toMatchObject({ language: "ts", title: null, lineNumbers: false })
    expect(codeBlock("```\nplain\n```")).toMatchObject({ lineNumbers: false })
    expect(codeBlock("    indented\n    code")).toMatchObject({ lineNumbers: false })
    expect(codeBlock('```ts title="a.ts"\nconst value = 1\n```')).toMatchObject({ lineNumbers: true })
    expect(codeBlock("```ts\nconst value = 1\n```").lineNumbersExplicit).toBeUndefined()
  })

  it('lineNumbers="true" opts an untitled fence in', () => {
    expect(codeBlock('```ts lineNumbers="true"\nconst value = 1\n```')).toMatchObject({ lineNumbers: true, lineNumbersExplicit: true })
    expect(codeBlock('```lineNumbers="true"\nx\n```')).toMatchObject({ language: null, lineNumbers: true })
  })

  it("keeps the line-number attribute byte-stable, including redundant ones", () => {
    for (const md of [
      "```ts\nconst value = 1\n```",
      '```ts lineNumbers="true"\nconst value = 1\n```',
      '```ts lineNumbers="false"\nconst value = 1\n```',
      '```lineNumbers="false"\nno language\n```',
      '```ts title="a.ts"\nconst value = 1\n```',
      '```ts title="a.ts" lineNumbers="false"\nconst value = 1\n```',
      '```ts title="a.ts" lineNumbers="true"\nconst value = 1\n```',
    ]) {
      expect(serializeMarkdown(parseMarkdown(md))).toBe(md + "\n")
    }
  })

  it("serializes programmatic blocks against the default", () => {
    const doc = (lineNumbers: boolean, title: string | null) =>
      serializeMarkdown({ type: "doc", children: [{ type: "code", language: "ts", title, lineNumbers, code: "x" }] })
    expect(doc(false, null)).toBe("```ts\nx\n```\n")
    expect(doc(true, null)).toBe('```ts lineNumbers="true"\nx\n```\n')
    expect(doc(true, "a.ts")).toBe('```ts title="a.ts"\nx\n```\n')
    expect(doc(false, "a.ts")).toBe('```ts title="a.ts" lineNumbers="false"\nx\n```\n')
  })

  it("escapes quotes and backslashes in fence titles", () => {
    const md = '```ts title="say \\"hi\\" C:\\\\dir"\nx\n```'
    expect(codeBlock(md).title).toBe('say "hi" C:\\dir')
    expect(serializeMarkdown(parseMarkdown(md))).toBe(md + "\n")
  })

  it("parses title and line-number opt-out from the info string", () => {
    expect(codeBlock('```ts title="hello.ts" lineNumbers="false"\nconst value = 1\n```')).toMatchObject({
      language: "ts",
      title: "hello.ts",
      lineNumbers: false,
    })
  })

  it("keeps the legacy code wrapper compatible with the new default", () => {
    expect(codeBlock('{% code title="hello.ts" %}\n```ts\nconst value = 1\n```\n{% endcode %}')).toMatchObject({
      title: "hello.ts",
      lineNumbers: true,
    })
  })

  it("serializes metadata on the opening fence", () => {
    const markdown = '```ts title="hello.ts"\nconst value = 1\n```'
    expect(serializeMarkdown(parseMarkdown(markdown))).toBe(markdown + "\n")
  })

  it("round-trips live preview metadata without a wrapper", () => {
    const markdown = '```tsx title="Counter" live="true" entry="/src/main.tsx"\nexport default App\n```'
    const block = codeBlock(markdown)
    expect(block).toMatchObject({ live: true, entry: "/src/main.tsx", lineNumbers: true })
    expect(serializeMarkdown(parseMarkdown(markdown))).toBe(markdown + "\n")
  })

  it("round-trips configurable expandable code line limits", () => {
    const markdown = '```mermaid collapsedCodeLines="4" expandedCodeLines="24"\ngraph TD\n  A --> B\n```'
    expect(codeBlock(markdown)).toMatchObject({
      collapsedCodeLines: 4,
      expandedCodeLines: 24,
    })
    expect(serializeMarkdown(parseMarkdown(markdown))).toBe(markdown + "\n")
  })
})

describe("inline link / emphasis nesting", () => {
  it("round-trips **[x](url)** and [**x**](url) as written", () => {
    for (const md of [
      "See **[the guide](https://example.com)** first.\n",
      "See [**the guide**](https://example.com) first.\n",
      "An _[italic link](https://example.com)_ and ~~[gone](https://example.com)~~.\n",
    ]) {
      expect(serializeMarkdown(parseMarkdown(md))).toBe(md)
    }
  })
})
