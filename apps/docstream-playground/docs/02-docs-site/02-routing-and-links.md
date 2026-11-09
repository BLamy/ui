---
description: Hash, history or in-memory routing; relative Markdown links that navigate in place; anchors for every heading.
---

# Routing and links

{% tabs title="Three routers" sync="docs-routing" %}
{% tab title="hash (default)" %}
```tsx
<DocsSite files={files} />
```

Pages live in the URL hash — `/#/guides/install`, `/#/guides/install#npm` for a section. Any static host serves it with no rewrites (this site is on GitHub Pages). Old single-word hashes such as `#streaming` are looked up as page slugs, so links to a previous one-page layout keep working.
{% endtab %}

{% tab title="history" %}
```tsx
<DocsSite files={files} routing="history" basePath="/docs" />
```

Real paths — `/docs/guides/install#npm` — through the History API. Your server must answer every path under `basePath` with the app (a single-page fallback).
{% endtab %}

{% tab title="memory" %}
```tsx
<DocsSite files={files} routing="memory" initialPath="guides/install" height={560} />
```

No URL at all, for a site embedded in another page — a preview pane, a playground, a modal. Theme changes stay on the site element, `document.title` is left alone, and ⌘K only answers while the site has focus. The playground on the [overview](README.md#five-lines) runs this way.
{% endtab %}
{% endtabs %}

`onNavigate(page, hash)` is called after every navigation, in every mode — for analytics, or to sync your own state.

## Write links the way GitHub reads them

Link between pages with relative paths to the `.md` files. They work on GitHub, in your editor, and on the site:

```md
See [installation](../01-getting-started/01-installation.md), the [theming tokens](../07-reference/01-theming.md#tokens),
or [this page's anchors](#anchors).
```

After a page renders, DocsSite finds every link that resolves to one of its pages and gives it a real route `href` — this page's links above point at `#/getting-started/installation` and so on. A plain click navigates in place; ⌘-click, middle-click and "Copy link" behave like any link. What resolves:

| You write | It finds |
| --- | --- |
| `install.md`, `./install.md`, `../guides/install.md` | The file, relative to the current page |
| `/guides/install.md` | The file, relative to the docs root |
| `guides/` or `guides` | The folder's `README.md` / `index.md` |
| `guides/install` | A page by slug |
| `#anchors` | A heading on this page |
| `https://…`, `mailto:…`, `//cdn…` | Left alone |

Links inside `{% demo %}` previews belong to the demo and are never rewritten. A link to a file that doesn't exist is left exactly as written; a test can catch those before they ship — see [Checking a docs folder](04-loading-files.md#checking-a-docs-folder).

{% hint style="info" %}
[Content refs](../03-writing/04-layout.md) and card-table links go through the same rewrite, so `{% content-ref url="01-file-tree.md" %}` is an in-site card.
{% endhint %}

## Anchors

Every Markdown heading gets an `id` — the same slug `documentOutline` reports (`"Anchors"` → `anchors`, `"Write links the way GitHub reads them"` → `write-links-the-way-github-reads-them`), so `#anchors` links straight to this section. Titled tab sets (`{% tabs title="…" %}`) are anchored too; **Three routers** at the top of this page is one.

The outline on the right lists a page's `##` and `###` headings and highlights the one you're reading. It hides below 1240px of site width; the sidebar becomes a drawer below 900px. Both follow the **site's** width (container queries), not the window's, so an embedded site lays itself out for the space it has.
