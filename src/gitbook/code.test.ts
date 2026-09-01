import { describe, expect, it } from "vitest"

import { parseMarkdown } from "./parse"
import { serializeMarkdown } from "./serialize"

function codeBlock(markdown: string) {
  const block = parseMarkdown(markdown).children[0]
  if (block?.type !== "code") throw new Error(`expected code block, got ${block?.type}`)
  return block
}

describe("fenced code metadata", () => {
  it("shows line numbers by default", () => {
    expect(codeBlock("```ts\nconst value = 1\n```" )).toMatchObject({
      language: "ts",
      title: null,
      lineNumbers: true,
    })
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
