---
description: Point DocsSite at a folder of Markdown and get a GitBook-style site — sidebar from the file tree, search, outline, routing and live demos.
---

# Docs sites

`DocsSite` turns a set of files into a complete documentation site. Give it everything you have — a Vite glob, a repo tree fetched from GitHub, an in-memory VFS — and it keeps the Markdown, builds the sidebar from the folders (or a GitBook `SUMMARY.md`), and renders every page through docstream.

**This site is one.** It is the `demo/docs/` folder of the docstream repo, passed to `DocsSite` in a dozen lines. Everything you see — the sidebar, ⌘K search, the "On this page" outline, breadcrumbs, previous / next, "Copy page", "Edit this page" — comes from the component.

{% demo src="docs-site/playground" %}

## Five lines

{% command %}npm install @brett_lamy/docstream react react-dom{% endcommand %}

```tsx title="main.tsx"
import { createRoot } from "react-dom/client"
import { DocsSite } from "@brett_lamy/docstream/site"
import "@brett_lamy/docstream/styles.css"

const files = import.meta.glob("./docs/**/*.md", { query: "?raw", import: "default", eager: true })

createRoot(document.getElementById("root")!).render(<DocsSite files={files} title="Acme" />)
```

That is a whole site: drop `docs/README.md`, `docs/01-guides/01-install.md` and friends next to it and they appear, ordered, titled and searchable. The site's styles are part of docstream's `styles.css`, so the one import covers the chrome and the content. (Importing `@brett_lamy/docstream/site/styles.css` alone gives just the chrome.)

## What you get

<table data-view="cards"><thead><tr><th></th><th></th></tr></thead><tbody>
<tr><td><strong>A sidebar from your files</strong></td><td>Top-level folders become groups, deeper folders nest and fold, <code>README.md</code> is a folder's page, numeric prefixes order things. Or write a <code>SUMMARY.md</code> and it wins. <a href="01-file-tree.md">File tree rules →</a></td></tr>
<tr><td><strong>Links that just work</strong></td><td>Write <code>[Install](../guides/install.md#npm)</code> like you would on GitHub; DocsSite rewrites it to a route that navigates in place and still opens in a new tab. <a href="02-routing-and-links.md">Routing →</a></td></tr>
<tr><td><strong>⌘K search</strong></td><td>Full text over every page, split at headings, ranked title → heading → body, with highlighted snippets. Jumps straight to the section.</td></tr>
<tr><td><strong>On this page</strong></td><td>An outline of each page's <code>##</code> / <code>###</code> headings and titled tab sections, with scroll-spy.</td></tr>
<tr><td><strong>Everything docstream renders</strong></td><td>Demos, live code, source refs, Mermaid, math, embeds, OpenAPI, citations — pass the same renderer props you'd give <code>MarkdownContent</code>.</td></tr>
<tr><td><strong>Yours to brand</strong></td><td>Logo, header links, accent color, light / dark, or your own tokens. Page actions, edit links, footers, a wrapper per page. <a href="03-customizing.md">Customizing →</a></td></tr>
</tbody></table>

## The page model

Each Markdown file is one page. A page reads like any GitBook or GitHub page:

````md title="docs/01-guides/01-install.md"
---
description: Get the CLI on your machine.
---

# Installing

{% command %}npm install -g rocket-cli{% endcommand %}

Then read the [configuration reference](../02-reference/config.md).
````

- The leading `# heading` is the page title. DocsSite renders it in the page header — with the breadcrumb above it and the `description` below as a lede — and removes it from the body, so it isn't shown twice.
- Frontmatter with only site keys (`title`, `description`, `order`, `hidden`, `icon`) is site metadata and isn't shown. Any other key turns it into a page property sheet, exactly as `MarkdownContent` shows frontmatter. See [Properties and tasks](../03-writing/08-properties-and-tasks.md).
- "Copy page" copies the page as Markdown — title, lede and body, demos inline — so it pastes into an AI chat or another docstream renderer intact.

## Not just Vite

`files` is a plain `{ [path]: markdown }` object (or `[{ path, content }]`), so the source can be anything. [Loading files](04-loading-files.md) shows Vite, a GitHub repository fetched at runtime, and a Node build step. The tree builder is a pure function, `buildDocsTree(files)`, if you want the pages and the sidebar without the React shell — for a static build, a sitemap, or your own layout.

{% content-ref url="01-file-tree.md" %}
File tree rules — how folders, README, SUMMARY.md and frontmatter become the sidebar
{% endcontent-ref %}
