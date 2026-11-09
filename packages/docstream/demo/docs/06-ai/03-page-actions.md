---
description: Copy a page as Markdown that still renders — demos and their files included — view it as plain text, open it in ChatGPT or Claude, or export it for LLM prompts and llms.txt.
---

# Page actions

`pageActions` on `MarkdownContent`, `DocsRenderer` or `GitbookStreamdown` renders a **Copy page ▾** split button above the content. Its menu has four entries:

| Action | Does |
| --- | --- |
| **Copy as Markdown** | Copies the page with every `{% demo %}` resolved to carry its real files inline. |
| **View as Markdown** | Opens the same text in a new tab — your `markdownUrl` if given, else a `blob:` URL. |
| **Open in ChatGPT** | Opens `chatgpt.com` with a prompt that references the page. |
| **Open in Claude** | Opens `claude.ai/new` with the same prompt. |

The button at the top right of this page is one. Copy the page and paste it into any docstream renderer: you get this page back, demos included.

```tsx
<MarkdownContent markdown={page} demoResolver={demoResolver} pageActions />

<MarkdownContent
  markdown={page}
  pageActions={{
    markdownUrl: `/md/${slug}.md`,
    actions: ["copy", "view", "claude"],
    transform: (md) => `${md.trim()}\n\n---\n\nSource: https://example.com/docs/${slug}\n`,
  }}
/>
```

On `GitbookStreamdown`, page actions stay hidden while `isStreaming` is set — a half-received answer is never copied — and appear when it ends.

## Live: what gets copied

The demo below exports a small page — a src-only `{% demo %}` and a titled install box — through `resolveDemosToMarkdown` with this site's resolver. **Inline** is what Copy page writes; **Plain** is the LLM-prompt form. The **Copy page** button inside it uses the same `demoOptions`, a `transform` that appends a footer, and a custom `prompt`:

{% demo src="ai-page-actions/export-preview" %}

## DocPageActions

The menu is a component, `DocPageActions`, if you want it somewhere else — a header, a sidebar, a chat message:

```tsx
import { DocPageActions } from "@brett_lamy/docstream"

<DocPageActions markdown={() => loadPageSource(slug)} pageUrl={`https://example.com/docs/${slug}`} />
```

| Prop | Type | Purpose |
| --- | --- | --- |
| `markdown` | `string \| () => string \| Promise<string>` | The page source, or a function producing it on demand (only called on use). Required on the component; the renderers pass their own. |
| `markdownUrl` | `string` | Public URL of the page as Markdown. **View** opens it, and the AI prompts reference it. |
| `pageUrl` | `string` | What the AI prompts reference when there is no `markdownUrl`. Defaults to the current location. |
| `prompt` | `(url: string) => string` | The question handed to ChatGPT / Claude. Default: `Read <url>, I want to ask questions about it.` |
| `actions` | `("copy" \| "view" \| "chatgpt" \| "claude")[]` | Which entries to show, in order. Defaults to all four. |
| `transform` | `(markdown: string) => string` | A final touch on the copied / viewed Markdown, e.g. a "Source:" footer. |
| `demoOptions` | `ResolveDemosOptions` | How demos are resolved — `format`, `filePath`, `render` (below). |
| `resolver` | `DemoResolver` | Overrides the resolver from context. |
| `className` | `string` | Appended to `docs-page-actions`. |

The main button copies directly; the caret opens the menu (arrow keys, Home / End, Esc and Tab work as in a native menu).

## resolveDemosToMarkdown

The resolution behind Copy page is a pure async function, so build scripts, servers and agents can use it too:

```ts
import { resolveDemosToMarkdown } from "@brett_lamy/docstream"

const md = await resolveDemosToMarkdown(page, demoResolver)                          // renderable docstream
const prompt = await resolveDemosToMarkdown(page, demoResolver, { format: "plain" }) // prose + fences
```

{% tabs %}
{% tab title="inline (default)" %}
Every src-only `{% demo src=… %}` keeps its tag and gains its files as inline fences, with the folder's `meta.json` folded into the tag (title, description, height, layout, variants, entry, status, bleed, className, surface, variantsWidth) — so the block renders the same **without** the resolver. If `meta.json` adds nothing, the author's tag line is kept byte for byte.

Blocks that already carry inline files, and demos the resolver can't resolve, are left exactly as written: they are valid docstream already.
{% endtab %}
{% tab title="plain" %}
For LLM prompts and plain-Markdown tools. Each demo becomes a bold **Example — Title** line, its description, a note listing its variants (the `variant` prop), and one titled fence per file (titled `<src>/<path>` by default). `{% command %}` boxes become npm `sh` fences, and titled tab sets become a heading plus one bold-labelled part per tab (`flattenForPlainMarkdown`).

Unresolvable demos become a one-line quote instead of tag syntax other tools wouldn't understand. The output is no longer renderable as docstream.
{% endtab %}
{% endtabs %}

Either way, everything outside demo blocks comes back byte for byte, and tags inside code fences are left alone.

| Option | Purpose |
| --- | --- |
| `format` | `"inline"` (default) or `"plain"`. |
| `filePath` | `"plain"` only: `(src, file) => string`, the title on each file fence. |
| `render` | `(demo: ResolvedDemo) => string` — your own Markdown for each demo with files, replacing the whole block in either format. `ResolvedDemo` is `{ node, meta, files, title }`. |

Related building blocks, all exported from the root: `inlineDemoMarkdown(node, files, meta?)` (one block in inline form), `defaultDemoMarkdown(demo, filePath?)` (one block in plain form), and `flattenForPlainMarkdown(doc)` (the command / titled-tabs flattening on a parsed document).

## Exporting Markdown files

Because the resolver interface is just four methods, a build script can export every page without a browser. `resolveDemosToMarkdown` only calls `meta` and `files`, so a Node resolver over the examples folder is enough — a sketch:

```ts title="scripts/export-md.mts"
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { resolveDemosToMarkdown, sortDemoFiles, type DemoResolver } from "@brett_lamy/docstream"

const root = "src/examples"
/** Every file under `dir`, relative to `base`. */
async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full, base)))
    else out.push(path.relative(base, full))
  }
  return out
}

const nodeResolver: DemoResolver = {
  async meta(src) {
    try { return JSON.parse(await readFile(path.join(root, src, "meta.json"), "utf8")) } catch { return undefined }
  },
  async files(src) {
    const paths = (await walk(path.join(root, src))).filter((p) => !p.endsWith("meta.json"))
    const files = await Promise.all(paths.map(async (p) => ({ path: p, content: await readFile(path.join(root, src, p), "utf8") })))
    return sortDemoFiles(files)
  },
  load: () => Promise.reject(new Error("not needed for export")),
}

await mkdir("dist/md", { recursive: true })
for (const page of ["demos", "streaming"]) {
  const source = await readFile(`docs/${page}.md`, "utf8")
  await writeFile(`dist/md/${page}.md`, await resolveDemosToMarkdown(source, nodeResolver))
}
```

Serve those files and pass `markdownUrl` — **View as Markdown** then opens the static file, and the ChatGPT / Claude prompts point at a URL the model can fetch. The same loop with `{ format: "plain" }` produces prompt-ready text, and concatenating the plain pages (with `resolver.list()` naming every demo) is a natural way to build an `llms.txt`-style bundle.

{% hint style="info" %}
`DemoResolver.list()` exists for this kind of tooling: it names every demo the resolver knows, so a generator can check that every demo is referenced, or export them all.
{% endhint %}

{% content-ref url="01-streaming.md" %}
Streaming — render AI answers while they arrive
{% endcontent-ref %}
