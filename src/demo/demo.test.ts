import { describe, expect, it } from "vitest"
import { parseMarkdown, trimPartialInlineToken } from "../gitbook/parse"
import { serializeMarkdown } from "../gitbook/serialize"
import { createGlobDemoResolver, demoFromSearch, demoHref } from "./glob"
import { fenceFor, resolveDemosToMarkdown } from "./markdown"
import type { DemoResolver } from "./types"

describe("{% demo %} syntax", () => {
  it("parses every attribute and round-trips", () => {
    const markdown =
      '{% demo src="button/sizes" title="Sizes" description="All three sizes" height="420" layout="multi" variants="full:Full,compact:Compact" viewport="tablet" %}\n'
    const doc = parseMarkdown(markdown)
    expect(doc.children).toEqual([
      {
        type: "demo",
        src: "button/sizes",
        title: "Sizes",
        description: "All three sizes",
        height: "420",
        layout: "multi",
        variants: [
          { id: "full", label: "Full" },
          { id: "compact", label: "Compact" },
        ],
        viewport: "tablet",
      },
    ])
    expect(serializeMarkdown(doc)).toBe(markdown)
  })

  it("needs only src, and serializes minimally", () => {
    const doc = parseMarkdown('{% demo src="card/basic" %}')
    expect(doc.children).toEqual([{ type: "demo", src: "card/basic" }])
    expect(serializeMarkdown(doc)).toBe('{% demo src="card/basic" %}\n')
  })

  it("accepts the self-closing form and a trailing enddemo", () => {
    const doc = parseMarkdown('Intro\n\n{% demo src="a/b" /%}\n\n{% demo src="c/d" %}\n{% enddemo %}\n\nOutro')
    expect(doc.children.map((b) => b.type)).toEqual(["paragraph", "demo", "demo", "paragraph"])
    expect(doc.children[1]).toEqual({ type: "demo", src: "a/b" })
  })

  it("drops unknown layout/viewport values and keeps bare variant ids", () => {
    const node = parseMarkdown('{% demo src="a/b" layout="grid" viewport="watch" variants="one, two:Two" %}').children[0]
    expect(node).toEqual({ type: "demo", src: "a/b", variants: [{ id: "one", label: "one" }, { id: "two", label: "Two" }] })
    expect(serializeMarkdown({ type: "doc", children: [node] })).toBe('{% demo src="a/b" variants="one,two:Two" %}\n')
  })

  it("never shows a partially streamed tag as text", () => {
    const partials = ["{", "{%", "{% de", '{% demo src="butt', '{% demo src="button/sizes" %', '{% demo src="button/sizes" title="Si']
    for (const tail of partials) {
      const md = trimPartialInlineToken(`# Buttons\n\nSome text.\n\n${tail}`)
      const doc = parseMarkdown(md)
      expect(doc.children.map((b) => b.type)).toEqual(["heading", "paragraph"])
      expect(JSON.stringify(doc)).not.toContain("{%")
    }
    // A finished tag renders as soon as it closes.
    const done = parseMarkdown(trimPartialInlineToken('Text\n\n{% demo src="button/sizes" %}'))
    expect(done.children.at(-1)).toEqual({ type: "demo", src: "button/sizes" })
  })

  it("leaves template syntax inside an open code fence alone while streaming", () => {
    const md = "```md\n{% demo src=\"a"
    expect(trimPartialInlineToken(md)).toBe(md)
  })
})

describe("{% tabs sync %}", () => {
  it("parses and round-trips the sync key", () => {
    const markdown = '{% tabs sync="pm" %}\n{% tab title="npm" %}\n```sh\nnpm install x\n```\n{% endtab %}\n\n{% tab title="pnpm" %}\n```sh\npnpm add x\n```\n{% endtab %}\n{% endtabs %}\n'
    const doc = parseMarkdown(markdown)
    expect(doc.children[0]).toMatchObject({ type: "tabs", sync: "pm" })
    expect(serializeMarkdown(doc)).toBe(markdown)
  })

  it("omits sync when absent", () => {
    const doc = parseMarkdown('{% tabs %}\n{% tab title="A" %}\nx\n{% endtab %}\n{% endtabs %}')
    expect(doc.children[0]).not.toHaveProperty("sync")
  })
})

const Index = () => null
const Other = () => null

function fixture() {
  return createGlobDemoResolver({
    root: "./examples",
    modules: {
      "./examples/button/sizes/index.tsx": async () => ({ default: Index }),
      "./examples/card/basic/index.tsx": { default: Other },
      "./examples/card/custom/App.tsx": async () => ({ App: Other }),
    },
    sources: {
      "./examples/button/sizes/index.tsx": async () => "export default function Sizes() {}\n",
      "./examples/button/sizes/Button.tsx": async () => "export function Button() {}\n",
      "./examples/button/sizes/styles.css": async () => ".b { color: red }\n",
      "./examples/button/sizes/parts/Icon.tsx": async () => "export const Icon = 1\n",
      "./examples/button/sizes/meta.json": async () => "{}",
      "./examples/button/sizes-extra/index.tsx": async () => "nope",
      "./examples/card/basic/index.tsx": "export default () => null\n",
      "./examples/card/custom/App.tsx": "export const App = () => null\n",
      "./examples/card/custom/data.json": "{\"a\":1}\n",
    },
    metas: {
      "./examples/button/sizes/meta.json": {
        title: "Button sizes",
        variants: [{ id: "sm", label: "Small" }],
      },
      "./examples/card/custom/meta.json": { default: { entry: "App.tsx", layout: "single" } },
    },
  })
}

describe("createGlobDemoResolver", () => {
  it("lists <page>/<example> folders that have an entry module", () => {
    expect(fixture().list!()).toEqual(["button/sizes", "card/basic", "card/custom"])
  })

  it("reads meta (eager, or a module with default)", async () => {
    const resolver = fixture()
    await expect(resolver.meta("button/sizes")).resolves.toMatchObject({ title: "Button sizes" })
    await expect(resolver.meta("card/custom")).resolves.toEqual({ entry: "App.tsx", layout: "single" })
    await expect(resolver.meta("card/basic")).resolves.toBeUndefined()
  })

  it("returns the folder's files entry first, without meta.json or sibling folders", async () => {
    const files = await fixture().files("button/sizes")
    expect(files.map((f) => f.path)).toEqual(["index.tsx", "Button.tsx", "styles.css", "parts/Icon.tsx"])
    expect(files[0]).toEqual({ path: "index.tsx", content: "export default function Sizes() {}\n", language: "tsx" })
    expect(files[2].language).toBe("css")
  })

  it("honours meta.entry for ordering and loading", async () => {
    const resolver = fixture()
    expect((await resolver.files("card/custom")).map((f) => f.path)).toEqual(["App.tsx", "data.json"])
    await expect(resolver.load("card/custom")).resolves.toBe(Other)
  })

  it("loads lazy and eager entry modules", async () => {
    const resolver = fixture()
    await expect(resolver.load("button/sizes")).resolves.toBe(Index)
    await expect(resolver.load("card/basic")).resolves.toBe(Other)
    await expect(resolver.load("missing/demo")).rejects.toThrow(/No demo module/)
  })

  it("infers ids from the last two folders when no root is given", async () => {
    const resolver = createGlobDemoResolver({
      modules: { "../../content/demos/tabs/basic/index.tsx": async () => ({ default: Index }) },
      sources: { "../../content/demos/tabs/basic/index.tsx": async () => "x" },
    })
    expect(resolver.list!()).toEqual(["tabs/basic"])
    expect((await resolver.files("tabs/basic")).map((f) => f.path)).toEqual(["index.tsx"])
  })

  it("supports an exclude filter and deep links", async () => {
    const resolver = createGlobDemoResolver({
      root: "./examples/",
      modules: { "./examples/a/b/index.tsx": async () => ({ default: Index }) },
      sources: {
        "./examples/a/b/index.tsx": async () => "x",
        "./examples/a/b/index.test.tsx": async () => "t",
      },
      exclude: (path) => path.includes(".test."),
      href: (src) => demoHref(src, { base: "/docs/" }),
    })
    expect((await resolver.files("a/b")).map((f) => f.path)).toEqual(["index.tsx"])
    expect(resolver.href!("a/b")).toBe("/docs/?demo=a/b")
    expect(demoFromSearch("?demo=a/b&variant=dark")).toEqual({ src: "a/b", variant: "dark" })
    expect(demoFromSearch("?x=1")).toBeNull()
  })
})

describe("resolveDemosToMarkdown", () => {
  it("replaces demo tags with titled fences of the real files, leaving the rest byte-identical", async () => {
    const markdown = "# Button\n\nIntro.\n\n{% demo src=\"button/sizes\" %}\n\n## API\n\n| a | b |\n| --- | --- |\n"
    const out = await resolveDemosToMarkdown(markdown, fixture())
    expect(out.startsWith("# Button\n\nIntro.\n\n**Example — Button sizes**\n\n")).toBe(true)
    expect(out).toContain('Variants (the `variant` prop): `sm` (Small).')
    expect(out).toContain('```tsx title="button/sizes/index.tsx"\nexport default function Sizes() {}\n```')
    expect(out).toContain('```css title="button/sizes/styles.css"\n.b { color: red }\n```')
    expect(out).not.toContain("meta.json")
    expect(out.indexOf("index.tsx")).toBeLessThan(out.indexOf("Button.tsx"))
    expect(out.endsWith("\n\n## API\n\n| a | b |\n| --- | --- |\n")).toBe(true)
    expect(out).not.toContain("{% demo")
  })

  it("uses the tag's own title and consumes a trailing enddemo", async () => {
    const out = await resolveDemosToMarkdown('{% demo src="card/basic" title="Basic card" %}\n{% enddemo %}\nafter', fixture())
    expect(out).toBe('**Example — Basic card**\n\n```tsx title="card/basic/index.tsx"\nexport default () => null\n```\nafter')
  })

  it("ignores demo tags inside code fences", async () => {
    const markdown = '````md\n{% demo src="button/sizes" %}\n````\n'
    await expect(resolveDemosToMarkdown(markdown, fixture())).resolves.toBe(markdown)
  })

  it("notes unresolvable demos instead of leaking tag syntax", async () => {
    const failing: DemoResolver = {
      meta: async () => undefined,
      files: async () => {
        throw new Error("gone")
      },
      load: async () => Index,
    }
    await expect(resolveDemosToMarkdown('{% demo src="x/y" %}', failing)).resolves.toBe("> Live demo `x/y` could not be resolved: gone")
    await expect(resolveDemosToMarkdown('{% demo src="x/y" %}', undefined)).resolves.toBe("> Live demo `x/y` (interactive on the docs site).")
  })

  it("lengthens fences around files that contain fences", async () => {
    expect(fenceFor("no ticks")).toBe("```")
    expect(fenceFor("```ts\nx\n```")).toBe("````")
    const resolver: DemoResolver = {
      meta: async () => ({ title: "Docs" }),
      files: async () => [{ path: "README.md", content: "```sh\nnpm i\n```\n" }],
      load: async () => Index,
    }
    const out = await resolveDemosToMarkdown('{% demo src="a/b" %}', resolver)
    expect(out).toContain('````markdown title="a/b/README.md"\n```sh\nnpm i\n```\n````')
  })

  it("supports custom rendering", async () => {
    const out = await resolveDemosToMarkdown('{% demo src="card/basic" %}', fixture(), {
      render: ({ title, files }) => `${title}: ${files.map((f) => f.path).join(",")}`,
    })
    expect(out).toBe("basic: index.tsx")
  })
})
