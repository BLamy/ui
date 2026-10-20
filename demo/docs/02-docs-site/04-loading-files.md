---
description: Feed DocsSite from a Vite glob, a GitHub repository at runtime, a Node build step, or files your app creates.
---

# Loading files

`files` is a plain object — `{ "docs/guides/install.md": "# Installing…" }` — or an array of `{ path, content }`. Anything that can produce paths and text can feed a site.

{% tabs title="Sources" sync="docs-source" %}
{% tab title="Vite" %}
```tsx title="main.tsx"
const files = import.meta.glob("./docs/**/*.md", { query: "?raw", import: "default", eager: true })

<DocsSite files={files} />
```

`eager: true` inlines every page into the bundle, so search works offline and navigation never waits. Text compresses well; this site's ~40 pages add about as much as one image. In dev, Vite's hot reload updates a page the moment you save it.
{% endtab %}

{% tab title="GitHub" %}
```tsx title="RepoDocs.tsx"
import { useEffect, useState } from "react"
import { DocsSite, isMarkdownPath, type DocsFiles } from "@brett_lamy/docstream/site"

async function loadRepo(owner: string, repo: string, ref = "main") {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`)
  const { tree } = (await res.json()) as { tree: { path: string; type: string }[] }
  const paths = tree.filter((f) => f.type === "blob" && f.path.startsWith("docs/") && isMarkdownPath(f.path))
  return Promise.all(
    paths.map(async ({ path }) => ({
      path,
      content: await (await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`)).text(),
    })),
  )
}

export function RepoDocs() {
  const [files, setFiles] = useState<DocsFiles | null>(null)
  useEffect(() => void loadRepo("acme", "acme").then(setFiles), [])
  return files ? <DocsSite files={files} title="Acme" /> : <p>Loading…</p>
}
```

The whole repository tree comes back in one request; only the Markdown files are fetched. The GitHub API allows 60 unauthenticated requests an hour per IP, so cache the result (or build it ahead of time) for anything public.
{% endtab %}

{% tab title="Node" %}
```ts title="scripts/docs.ts"
import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { buildDocsTree } from "@brett_lamy/docstream/site"

const root = "docs"
const files = readdirSync(root, { recursive: true, encoding: "utf8" })
  .filter((p) => p.endsWith(".md"))
  .map((p) => ({ path: p, content: readFileSync(join(root, p), "utf8") }))

const tree = buildDocsTree(files)
// e.g. an llms.txt index of every page, in reading order
console.log(tree.order.map((p) => `- [${p.title}](https://docs.acme.dev/#/${p.slug}): ${p.description ?? ""}`).join("\n"))
```

`buildDocsTree` has no React or DOM dependencies, so the same rules power build scripts, sitemaps and link checkers.
{% endtab %}

{% tab title="Your app" %}
```tsx title="NotesHelp.tsx"
const [files, setFiles] = useState({ "README.md": "# Notes\n\nStart typing." })

<DocsSite files={files} routing="memory" height={600} />
```

Files your app creates — notes, generated reports, an AI agent's output, a user's uploads — work the same way. The tree rebuilds when `files` changes (keep the object stable between renders), as the [playground](README.md) shows.
{% endtab %}
{% endtabs %}

## Images and other files

Non-Markdown files are ignored by the tree, but your pages can still show them. Relative image and embed paths go through docstream's asset resolver: call `setAssetBase` or wrap the site in an `AssetResolverProvider` to point them at your files. See [Assets](../05-media/06-assets.md).

## Checking a docs folder

Because the tree builder is pure, a test can hold your docs to the same rules the site uses. This repo runs one over `demo/docs/`: every page parses and round-trips byte for byte, every relative link resolves to a page, and every `{% demo %}` has a folder behind it.

```ts title="docs.test.ts"
import { buildDocsTree, findLinkedPage } from "@brett_lamy/docstream/site"

const tree = buildDocsTree(files)
for (const page of tree.pages) {
  for (const [, href] of page.body.matchAll(/\]\(([^)\s]+\.md[^)\s]*)\)/g)) {
    expect(findLinkedPage(tree, page, href), `${page.path} → ${href}`).not.toBeNull()
  }
}
```
