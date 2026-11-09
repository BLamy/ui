import { describe, expect, it } from "vitest"
import { parseMarkdown } from "../gitbook/parse"
import { serializeMarkdown } from "../gitbook/serialize"
import { isTuiCodeBlock } from "./fence"

describe("terminal fence metadata", () => {
  it.each(["typescript tui", "tsx tui", "js tui", "tui", 'typescript tui title="Keyboard demo" lineNumbers="true"', 'tsx  tui  title="Source"']) ("round-trips and detects %s without changing other metadata", (info) => {
    const markdown = `\`\`\`${info}\nconst text = "hello"\n\`\`\`\n`
    const doc = parseMarkdown(markdown)
    const block = doc.children[0]!
    expect(block.type).toBe("code")
    if (block.type !== "code") throw new Error("Expected a code block")
    expect(isTuiCodeBlock(block)).toBe(true)
    expect(serializeMarkdown(doc)).toBe(markdown)
    block.code = "const changed = true"
    expect(serializeMarkdown(doc)).toContain(`\`\`\`${info}\nconst changed = true`)
  })

  it.each(['typescript title="A tui example"', 'tsx example', 'ts intuitive', 'typescript title="tui"']) ("does not opt ordinary source into execution: %s", (info) => {
    const block = parseMarkdown(`\`\`\`${info}\nsource()\n\`\`\``).children[0]!
    expect(block.type).toBe("code")
    if (block.type === "code") expect(isTuiCodeBlock(block)).toBe(false)
  })

  it("keeps the runnable marker when another fence setting is edited", () => {
    const doc = parseMarkdown('```typescript tui title="Before"\nsource()\n```\n')
    const block = doc.children[0]!
    if (block.type !== "code") throw new Error("Expected a code block")
    block.title = "After"
    block.lineNumbers = false
    const markdown = serializeMarkdown(doc)
    expect(markdown).toContain('typescript tui title="After"')
    const edited = parseMarkdown(markdown).children[0]!
    if (edited.type !== "code") throw new Error("Expected a code block")
    expect(isTuiCodeBlock(edited)).toBe(true)
  })
})
