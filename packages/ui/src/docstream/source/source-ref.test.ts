import { describe, expect, it } from "vitest"
import { parseMarkdown } from "../gitbook/parse"
import { serializeMarkdown } from "../gitbook/serialize"
import { createBundledSourceClient } from "./client"

describe("source references", () => {
  it("round-trips component provenance without embedding its implementation", () => {
    const markdown = '{% source-ref mount="ui" path="Button.tsx" export="Button" kind="component" title="Primary button" %}\n'
    const parsed = parseMarkdown(markdown)

    expect(parsed.children).toEqual([
      {
        type: "source-ref",
        mount: "ui",
        path: "Button.tsx",
        exportName: "Button",
        kind: "component",
        title: "Primary button",
      },
    ])
    expect(serializeMarkdown(parsed)).toBe(markdown)
  })

  it("supports concise component and story aliases", () => {
    expect(parseMarkdown('{% component src="Card.tsx" export="Card" %}').children[0]).toMatchObject({
      type: "source-ref",
      kind: "component",
      path: "Card.tsx",
      exportName: "Card",
    })
    expect(parseMarkdown('{% story src="Card.stories.tsx" export="Empty" %}').children[0]).toMatchObject({
      type: "source-ref",
      kind: "story",
      path: "Card.stories.tsx",
      exportName: "Empty",
    })
  })

  it("loads production source previews from eager and lazy bundled modules", async () => {
    const eager = { Button: () => null }
    const lazy = { Primary: { args: { label: "Primary" } } }
    const client = createBundledSourceClient({
      "demo:Button.tsx": eager,
      "Button.stories.tsx": async () => lazy,
    })

    await expect(client.importModule({
      type: "source-ref",
      mount: "demo",
      path: "Button.tsx",
      exportName: "Button",
      kind: "component",
    })).resolves.toBe(eager)
    await expect(client.importModule({
      type: "source-ref",
      mount: "demo",
      path: "Button.stories.tsx",
      exportName: "Primary",
      kind: "story",
    })).resolves.toBe(lazy)
  })
})
