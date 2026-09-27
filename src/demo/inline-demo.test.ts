import { describe, expect, it } from "vitest"
import type { DemoNode } from "../gitbook/ast"
import { parseMarkdown, trimPartialInlineToken } from "../gitbook/parse"
import { serializeMarkdown } from "../gitbook/serialize"
import { createInlineDemoProject } from "../playground/filesystem"
import { inlineDemoMarkdown, resolveDemosToMarkdown } from "./markdown"
import type { DemoResolver } from "./types"

const BLOCK = [
  '{% demo src="composer/scroll-fab" title="Scroll → FAB" height="380" variants="full:Full,compact:Compact" %}',
  '```tsx title="index.tsx"',
  'import { items } from "./data"',
  "",
  'export default function ScrollFab({ variant }: { variant?: string }) {',
  "  return <ul data-variant={variant}>{items.map((i) => <li key={i}>{i}</li>)}</ul>",
  "}",
  "```",
  '```ts title="data.ts"',
  'export const items = ["a", "b"]',
  "```",
  "{% enddemo %}",
].join("\n")

const demoOf = (markdown: string) => parseMarkdown(markdown).children.find((b): b is DemoNode => b.type === "demo")

describe("{% demo %} with inline files", () => {
  it("parses fences into files (path from title) and keeps the attributes", () => {
    const node = demoOf(BLOCK)!
    expect(node).toMatchObject({
      type: "demo",
      src: "composer/scroll-fab",
      title: "Scroll → FAB",
      height: "380",
      variants: [{ id: "full", label: "Full" }, { id: "compact", label: "Compact" }],
    })
    expect(node.files).toEqual([
      {
        path: "index.tsx",
        language: "tsx",
        content: 'import { items } from "./data"\n\nexport default function ScrollFab({ variant }: { variant?: string }) {\n  return <ul data-variant={variant}>{items.map((i) => <li key={i}>{i}</li>)}</ul>\n}',
      },
      { path: "data.ts", language: "ts", content: 'export const items = ["a", "b"]' },
    ])
    expect(node).not.toHaveProperty("open")
  })

  it("serializes byte-stably", () => {
    const markdown = `Intro\n\n${BLOCK}\n\nOutro\n`
    expect(serializeMarkdown(parseMarkdown(markdown))).toBe(markdown)
  })

  it("lengthens a fence around file content that contains fences, and round-trips it", () => {
    const node: DemoNode = {
      type: "demo",
      src: "docs/readme",
      files: [
        { path: "README.md", language: "md", content: "Run:\n\n```sh\nnpm start\n```" },
        { path: "NOTES.md", content: "````\nfour\n````\n{% enddemo %}\n{% endtab %}" },
      ],
    }
    const markdown = serializeMarkdown({ type: "doc", children: [node] })
    expect(markdown).toBe(
      '{% demo src="docs/readme" %}\n````md title="README.md"\nRun:\n\n```sh\nnpm start\n```\n````\n````` title="NOTES.md"\n````\nfour\n````\n{% enddemo %}\n{% endtab %}\n`````\n{% enddemo %}\n',
    )
    expect(parseMarkdown(markdown).children).toEqual([node])
    // …also nested in tabs, where the file's `{% endtab %}` must not close the tab.
    const tabs = `{% tabs %}\n{% tab title="Demo" %}\n${markdown.trimEnd()}\n{% endtab %}\n{% endtabs %}\n`
    const doc = parseMarkdown(tabs)
    expect(doc.children[0]).toMatchObject({ type: "tabs", tabs: [{ title: "Demo", children: [node] }] })
    expect(serializeMarkdown(doc)).toBe(tabs)
  })

  it("honours entry and keeps a fence without a language", () => {
    const markdown = '{% demo src="a/b" entry="App.tsx" %}\n``` title="notes.txt"\nhi\n```\n```tsx title="App.tsx"\nexport const App = () => null\n```\n{% enddemo %}\n'
    const node = demoOf(markdown)!
    expect(node.entry).toBe("App.tsx")
    expect(node.files?.[0]).toEqual({ path: "notes.txt", content: "hi" })
    expect(serializeMarkdown(parseMarkdown(markdown))).toBe(markdown)
  })

  it("keeps pre-1.2 documents meaning the same", () => {
    // Self-closing, then (after a blank line) an ordinary code block: not demo files.
    const loose = parseMarkdown('{% demo src="a/b" %}\n\n```ts\nconst x = 1\n```\n\nText')
    expect(loose.children.map((b) => b.type)).toEqual(["demo", "code", "paragraph"])
    expect(loose.children[0]).toEqual({ type: "demo", src: "a/b" })
    // `/%}` never takes a body, even with a fence right after it.
    const closed = parseMarkdown('{% demo src="a/b" /%}\n```ts\nconst x = 1\n```')
    expect(closed.children.map((b) => b.type)).toEqual(["demo", "code"])
    // Blank lines before the fences are fine when {% enddemo %} closes the block.
    const spaced = demoOf('{% demo src="a/b" %}\n\n```ts title="x.ts"\nconst x = 1\n```\n\n{% enddemo %}')
    expect(spaced?.files).toEqual([{ path: "x.ts", language: "ts", content: "const x = 1" }])
  })

  it("ends a block without {% enddemo %} at the first non-fence line", () => {
    const doc = parseMarkdown('{% demo src="a/b" %}\n```tsx title="index.tsx"\nx\n```\nAfter the demo.')
    expect(doc.children.map((b) => b.type)).toEqual(["demo", "paragraph"])
    expect(doc.children[0]).not.toHaveProperty("open")
  })

  it("streams: a partial block is an open demo, never stray text", () => {
    const full = `# Page\n\n${BLOCK}\n\nAfter.`
    for (let n = "# Page\n\n".length + 1; n <= full.length; n++) {
      const doc = parseMarkdown(trimPartialInlineToken(full.slice(0, n)))
      const types = doc.children.map((b) => b.type)
      expect(types[0]).toBe("heading")
      expect(JSON.stringify(doc.children.filter((b) => b.type !== "demo"))).not.toContain("{%")
      const demo = doc.children.find((b): b is DemoNode => b.type === "demo")
      if (!demo) continue
      const complete = full.slice(0, n).includes("{% enddemo %}")
      expect(demo.open === true).toBe(!complete && full.slice(0, n).includes("\n```"))
      expect(types.filter((t) => t === "code")).toEqual([])
    }
    const mid = demoOf(`${BLOCK.slice(0, BLOCK.indexOf("data.ts") + 20)}`)!
    expect(mid.open).toBe(true)
    expect(mid.files?.map((f) => f.path)).toEqual(["index.tsx", "data.ts"])
  })
})

const Noop = () => null

function resolver(): DemoResolver {
  const files: Record<string, { path: string; content: string; language?: string }[]> = {
    "button/sizes": [
      { path: "index.tsx", content: "export default function Sizes() {}\n", language: "tsx" },
      { path: "README.md", content: "```sh\nnpm i\n```\n" },
    ],
    "card/basic": [{ path: "App.tsx", content: "export const App = () => null\n", language: "tsx" }],
  }
  return {
    list: () => Object.keys(files),
    meta: async (src) =>
      src === "button/sizes"
        ? { title: "Button sizes", height: 320, variants: [{ id: "sm", label: "Small" }], bleed: true }
        : src === "card/basic"
          ? { entry: "App.tsx" }
          : undefined,
    files: async (src) => {
      if (!files[src]) throw new Error(`unknown ${src}`)
      return files[src]
    },
    load: async () => Noop,
  }
}

describe("resolveDemosToMarkdown (default: renderable)", () => {
  it("embeds the files after the tag, folding in meta defaults; the rest is byte-identical", async () => {
    const markdown = '# Button\n\n{% demo src="button/sizes" viewport="tablet" %}\n\n## API\n\n| a | b |\n| --- | --- |\n'
    const out = await resolveDemosToMarkdown(markdown, resolver())
    expect(out).toBe(
      '# Button\n\n{% demo src="button/sizes" title="Button sizes" height="320" variants="sm:Small" viewport="tablet" bleed="true" %}\n```tsx title="index.tsx"\nexport default function Sizes() {}\n```\n````markdown title="README.md"\n```sh\nnpm i\n```\n````\n{% enddemo %}\n\n## API\n\n| a | b |\n| --- | --- |\n',
    )
    const node = demoOf(out)!
    expect(node.files?.map((f) => [f.path, f.content])).toEqual([
      ["index.tsx", "export default function Sizes() {}"],
      ["README.md", "```sh\nnpm i\n```"],
    ])
    // The copy is itself a docstream page: resolving it again changes nothing.
    await expect(resolveDemosToMarkdown(out, resolver())).resolves.toBe(out)
  })

  it("keeps the author's tag line when meta adds nothing, and consumes a trailing enddemo", async () => {
    const out = await resolveDemosToMarkdown('{% demo   src="card/basic" title="Basic" /%}\n{% enddemo %}\nafter', resolver())
    expect(out).toBe('{% demo   src="card/basic" title="Basic" %}\n```tsx title="App.tsx"\nexport const App = () => null\n```\n{% enddemo %}\nafter')
  })

  it("leaves demos it cannot resolve, and blocks that already carry files, exactly as written", async () => {
    const markdown = `{% demo src="x/y" %}\n\n${BLOCK}\n\n\`\`\`md\n{% demo src="button/sizes" %}\n\`\`\`\n`
    await expect(resolveDemosToMarkdown(markdown, resolver())).resolves.toBe(markdown)
    await expect(resolveDemosToMarkdown(markdown, undefined)).resolves.toBe(markdown)
  })

  it("keeps the indentation of nested demos", async () => {
    const out = await resolveDemosToMarkdown('- Item\n\n  {% demo src="card/basic" %}\n', resolver())
    expect(out).toBe('- Item\n\n  {% demo src="card/basic" %}\n  ```tsx title="App.tsx"\n  export const App = () => null\n  ```\n  {% enddemo %}\n')
  })

  it("plain format uses resolver files first, inline files otherwise", async () => {
    const out = await resolveDemosToMarkdown(BLOCK, undefined, { format: "plain" })
    expect(out).toBe(
      '**Example — Scroll → FAB**\n\nVariants (the `variant` prop): `full` (Full), `compact` (Compact).\n\n```tsx title="composer/scroll-fab/index.tsx"\nimport { items } from "./data"\n\nexport default function ScrollFab({ variant }: { variant?: string }) {\n  return <ul data-variant={variant}>{items.map((i) => <li key={i}>{i}</li>)}</ul>\n}\n```\n\n```ts title="composer/scroll-fab/data.ts"\nexport const items = ["a", "b"]\n```',
    )
  })

  it("inlineDemoMarkdown builds a pasteable block from viewer state", () => {
    const md = inlineDemoMarkdown({ type: "demo", src: "card/basic" }, [{ path: "App.tsx", content: "x\n" }], { entry: "App.tsx", title: "Card" })
    expect(md).toBe('{% demo src="card/basic" title="Card" %}\n```tsx title="App.tsx"\nx\n```\n{% enddemo %}')
  })
})

describe("createInlineDemoProject", () => {
  it("puts the files under /src/demo and wraps the entry so ?variant= reaches the component", () => {
    const project = createInlineDemoProject(
      [
        { path: "index.tsx", content: "export default function Demo() { return null }" },
        { path: "parts/Card.tsx", content: "export const Card = 1" },
        { path: "package.json", content: '{ "dependencies": { "clsx": "^2.1.0" } }' },
      ],
      { dependencies: { "@brett_lamy/ui": "^1.2.0" } },
    )
    expect(project.wrapped).toBe(true)
    expect(project.entry).toBe("/src/__docstream_demo_entry.js")
    expect(Object.keys(project.files).sort()).toEqual([
      "/index.html",
      "/package.json",
      "/src/__docstream_demo_entry.js",
      "/src/demo/index.tsx",
      "/src/demo/package.json",
      "/src/demo/parts/Card.tsx",
    ])
    const wrapper = String(project.files[project.entry])
    expect(wrapper).toContain('import * as demo from "./demo/index.tsx"')
    expect(wrapper).toContain('get("variant")')
    expect(JSON.parse(String(project.files["/package.json"])).dependencies).toEqual({
      react: "^19.0.0",
      "react-dom": "^19.0.0",
      clsx: "^2.1.0",
      "@brett_lamy/ui": "^1.2.0",
    })
    expect(String(project.files["/index.html"])).toContain('src="./src/__docstream_demo_entry.js"')
  })

  it("uses a self-mounting entry directly, and honours entry", () => {
    const project = createInlineDemoProject(
      [
        { path: "App.tsx", content: "export default () => null" },
        { path: "main.tsx", content: 'import { createRoot } from "react-dom/client"\ncreateRoot(root).render(null)' },
      ],
      { entry: "main.tsx" },
    )
    expect(project).toMatchObject({ wrapped: false, entry: "/src/demo/main.tsx" })
  })
})
