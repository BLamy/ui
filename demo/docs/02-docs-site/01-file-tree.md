---
description: How DocsSite turns paths, README files, numeric prefixes, frontmatter and SUMMARY.md into pages, titles and a sidebar.
---

# File tree rules

DocsSite reads the paths of the files you give it and nothing else — no config file, no manifest. The rules follow GitBook where GitBook has one, and Docusaurus-style numeric prefixes where it doesn't.

## Which files become pages

Every file ending in `.md`, `.markdown` or `.mdx` is a page. Everything else — images, JSON, `.txt` — is ignored, so you can hand over a whole repository tree. Narrow it further with `treeOptions.include`:

```tsx
<DocsSite files={files} treeOptions={{ include: (path) => !path.startsWith("drafts/") }} />
```

The deepest folder every Markdown path shares is the docs root and is dropped from URLs: `./docs/guides/install.md` becomes `guides/install`. Set `treeOptions.root` to choose it yourself.

## Folders, README and ordering

{% columns %}
{% column %}
```txt title="docs/"
README.md
01-getting-started/
  01-installation.md
  02-quick-start.md
02-guides/
  README.md
  theming.md
  advanced/
    README.md
    plugins.md
```
{% endcolumn %}
{% column %}
```txt title="Sidebar"
Home
Getting started
  Installation
  Quick start
Guides
  Overview
  Theming
  Advanced ▸
    Plugins
```
{% endcolumn %}
{% endcolumns %}

| Rule | Result |
| --- | --- |
| `README.md` (or `index.md`) | Its folder's page. The top-level one is the home page, at `/`. |
| A top-level folder | A sidebar **group** with a heading. Its README, if any, is listed first as "Overview". |
| A deeper folder | A collapsible entry. With a README the entry is that page; without one it's a plain toggle. Folders open themselves around the current page. |
| `01-`, `2_`, `10.` prefixes | Order entries numerically and are removed from URLs and titles: `02-quick-start.md` → `/getting-started/quick-start`. |
| Frontmatter `order: 3` | Overrides the prefix. For a folder, put it in the folder's README. |
| No prefix, no `order` | After the ordered entries, alphabetically by title. |
| Frontmatter `hidden: true` | Out of the sidebar and previous / next — but the URL, links and search still find it. |
| Loose pages at the root | Listed above the groups, after the home page. |

## Titles

A page's sidebar and header title is the first of:

1. its label in `SUMMARY.md`,
2. frontmatter `title`,
3. its first `# heading`,
4. the file name, humanized — `quick-start.md` → "Quick start".

A folder without a README is named after the folder (`01-getting-started` → "Getting started"); pass `treeOptions.folderTitle` to name them differently. A group whose README has a real `# heading` takes that heading — this section is the folder `02-docs-site`, titled by its README's `# Docs sites`.

## SUMMARY.md

When the root has a `SUMMARY.md`, it *is* the sidebar, exactly as in GitBook: `##` headings are groups, list items are pages, indentation nests them, and absolute URLs become external links. The playground on the [overview](README.md) has a **SUMMARY.md** variant to try it.

```md title="docs/SUMMARY.md"
# Table of contents

* [Welcome](README.md)

## Learn

* [Deploy in a minute](guides/quick-start.md)
  * [Domains](guides/domains.md)

## Look up

* [rocket.toml](reference/config.md)
* [Status page](https://status.example.com)
```

- The labels win over page titles, so the sidebar can say "Deploy in a minute" while the page is still "Quick start" on GitHub.
- Pages SUMMARY.md leaves out are not listed and aren't in previous / next, but their URLs still resolve and links to them work.
- The leading `# Table of contents` heading is the file's own title and is skipped. Turn SUMMARY.md off with `treeOptions={{ summary: false }}`.

## The tree, without the site

`buildDocsTree` is the pure function DocsSite uses. Use it for a sitemap, a static build, an `llms.txt`, or your own layout:

```ts title="sitemap.ts"
import { buildDocsTree } from "@brett_lamy/docstream/site"

const tree = buildDocsTree(files)
tree.order.map((page) => `https://docs.example.com/#/${page.slug}`)
```

| `DocsTree` field | What it holds |
| --- | --- |
| `pages` | Every page — listed ones in sidebar order, then the rest. |
| `order` | Listed, non-hidden pages in reading order (previous / next walk this). |
| `nav` | The sidebar: `group`, `page`, `folder` and `link` items, each `page` / `folder` / `group` with `children`. |
| `bySlug`, `byPath` | Lookups by URL slug and by source path. |
| `root` | The folder stripped from the input paths (`"docs/"`). |

Each `DocsPage` carries `path`, `slug`, `title`, `description`, `markdown` (the file as written), `body` (what's rendered), `frontmatter`, `hidden` and `breadcrumbs`. `createDocsSearchIndex(tree)` builds the same search the ⌘K dialog uses.

<details>
<summary>Helpers exported next to it</summary>

| Export | Does |
| --- | --- |
| `slugForPath(path)` | `01-guides/README.md` → `guides` |
| `stripOrderPrefix(name)` | `03-intro` → `{ name: "intro", order: 3 }` |
| `humanize(name)` | `quick-start` → `Quick start` |
| `normalizePath(path)` | `./docs//a/../b.md` → `docs/b.md` |
| `resolveRelativePath(from, href)` | Resolves a link written in `from`; `null` for external URLs |
| `findLinkedPage(tree, page, href)` | The page (and `#hash`) a link points at, or `null` |
| `readFrontmatter(markdown)` | The frontmatter as values, never executing YAML |
| `searchableText(markdown)` | Markdown → plain text, the way search indexes it |

</details>
