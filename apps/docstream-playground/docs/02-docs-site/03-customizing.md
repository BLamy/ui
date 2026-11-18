---
description: Branding, theme and colors, page actions, edit links, footers, per-page wrappers, and every renderer option.
---

# Customizing

## Branding and header

```tsx title="main.tsx"
<DocsSite
  files={files}
  title="Acme"
  logo={<img src="/logo.svg" width={24} height={24} alt="" />}
  links={[
    { label: "GitHub", href: "https://github.com/acme/acme" },
    { label: "Discord", href: "https://discord.gg/acme" },
  ]}
  tint="#e8590c"
/>
```

`title` shows in the header and the browser tab (`"Install — Acme"`). `tint` (a CSS color) recolors links, the current sidebar item, the breadcrumb, the outline marker and focus rings. Header links open in a new tab; with an `icon`, narrow layouts show the icon alone.

## Sections in the header

`tabs` puts the site's sections in the header, like GitBook's spaces. Each tab owns the pages under its `path` (`""` takes every page no other tab claims). The sidebar lists only the current tab's pages, Previous / Next stay inside it, and ⌘K search still covers everything. On a narrow screen the tabs move to the top of the navigation drawer.

```tsx
<DocsSite
  files={files}
  tabs={[
    { title: "Components", path: "" },
    { title: "Blocks", path: "blocks" },
  ]}
/>
```

A tab goes to its first page in reading order; set `slug` to send it somewhere else. A page with frontmatter `layout: wide` gets the full width (up to `--ds-site-wide-w`, 1240px) and no outline — for galleries and full-size demos.

## Under your own bar

A site mounted inside an app that already has a top bar would stack a second bar under it. `header={false}` leaves the site's header out, so the site starts at its sidebar and page, and the app's bar is the only one. Two controls lived only in that header, so they move to your bar as parts: `DocsSiteSearchTrigger` and `DocsSiteNavigationTrigger`. A controller connects them to the site, the way UI SDK's dialog controller connects a trigger to a dialog elsewhere on the page.

```tsx title="app.tsx"
import { useState } from "react"
import { DocsSite, DocsSiteNavigationTrigger, DocsSiteSearchTrigger, createDocsSiteController } from "@brett_lamy/ui/docstream/site"

export function App() {
  const [docs] = useState(createDocsSiteController)
  return (
    <>
      <header className="app-bar">
        <DocsSiteNavigationTrigger controller={docs} />
        <a href="/">Acme</a>
        <DocsSiteSearchTrigger controller={docs} />
      </header>
      <DocsSite files={files} title="Acme docs" header={false} controller={docs} height="calc(100dvh - 56px)" />
    </>
  )
}
```

| API | Default | What it does |
| --- | --- | --- |
| `header` (on `DocsSite`) | `true` | `false` leaves out the site's header: brand, tabs, search button, links, appearance switch and the phone's menu button. |
| `controller` (on `DocsSite`) | its own | The connection to triggers written outside the site. Give the site and each trigger the same one. |
| `createDocsSiteController()` | — | Makes a controller. Call it once (`useState(createDocsSiteController)` or at module scope), not on every render. It also has `openSearch()` and `openNavigation()`, to open either from code. |
| `<DocsSiteSearchTrigger controller>` | — | The button that opens the site's search. It is the search dialog's own trigger: focus returns to it when the dialog closes, and it announces the shortcut. Its content is a magnifier, "Search…" and the shortcut in a `<kbd>`; children replace it. |
| `<DocsSiteNavigationTrigger controller>` | — | The button that opens the navigation drawer. It renders only while the site is narrow enough to fold its sidebar away, so write it unconditionally. Its content is a menu glyph; children replace it. |

Both triggers are UI SDK trigger parts: they take `render` for your own button, `className`, `aria-label` and the rest of a button's props. Outside the site they are unstyled, so style them like the rest of your bar:

```tsx
<DocsSiteSearchTrigger controller={docs} aria-label="Search Acme docs" render={<Button variant="outline" />}>
  <SearchIcon /> Search… <Kbd keys="mod+k" />
</DocsSiteSearchTrigger>
```

What stays the same without the header:

- ⌘K (and `/`) still open search, whether or not you place the trigger. `search={false}` still turns search off; write the trigger only for a site that has it.
- `title` still names the browser tab, and with `logo` it heads the navigation drawer.
- `tabs` still scope the sidebar and Previous / Next, and still sit at the top of the drawer. Link to each section from your bar; `tabForSlug(tabs, slug)` tells you which one a page is in, to mark it current.
- The outline and the sidebar stick directly under your bar. Set `height` to the room under it, as above.

What you take over: `links` and the appearance switch are not drawn, so put any link your bar doesn't already have somewhere else (`sidebarFooter` works), and control the theme with `appearance`.

{% hint style="info" %}
One controller serves one mounted site at a time. A router that swaps sites under the same bar can give them all the same controller: the triggers follow whichever one is mounted.
{% endhint %}

Why these are a prop and two parts, not something you compose from what was there: `search={false}` removes search itself, ⌘K included, and hiding the header with CSS leaves a narrow site with no way to open its navigation. The triggers are the same parts the site's own header draws, so a site on its own and a site under your bar behave alike.

## Light, dark and your own tokens

The built-in palette has a light and a dark set. The header's switch flips them and remembers the choice in `localStorage`; `?theme=dark` in the URL wins for one visit (handy for screenshots).

| Prop | Default | Effect |
| --- | --- | --- |
| `defaultAppearance` | `"auto"` | The starting appearance when the reader hasn't chosen: `light`, `dark`, or `auto` (the OS setting). |
| `appearance` / `onAppearanceChange` | — | Control it yourself. |
| `appearanceToggle` | `true` | Show the switch. |
| `appearanceStorageKey` | `"docstream-site-theme"` | Where the choice is kept; `false` to not persist. |
| `applyAppearanceTo` | `"document"` | Also set `data-theme` on `<html>`, so the rest of your page follows. `"site"` keeps it on the site element (the default for `routing="memory"`). |
| `palette` | `true` | Use docstream's colors. Set `false` when your app defines shadcn-style tokens. |

With `palette={false}` the site reads the same tokens docstream's content does — `--background`, `--foreground`, `--card`, `--muted`, `--muted-foreground`, `--border`, `--accent`, `--primary` — from wherever your app defines them. A Tailwind / shadcn app is themed with no extra CSS. See [Theming](../07-reference/01-theming.md) for the full token list.

Layout sizes are CSS variables on `.ds-site`:

```css
.ds-site {
  --ds-site-header-h: 56px;
  --ds-site-sidebar-w: 284px;
  --ds-site-toc-w: 224px;
  --ds-site-content-w: 768px;
}
```

## Page actions and edit links

Every page header has docstream's **Copy page ▾** menu — copy as Markdown, view as Markdown, open in ChatGPT or Claude ([Page actions](../06-ai/03-page-actions.md)). The copied Markdown is the whole page: title, lede and body, with each demo's files inline.

```tsx
<DocsSite
  files={files}
  // per page — here, a footer pointing back at the live page
  pageActions={(page) => ({ transform: (md) => `${md}\n\nSource: https://docs.acme.dev/#/${page.slug}\n` })}
  editUrl={(page) => `https://github.com/acme/acme/edit/main/docs/${page.path}`}
/>
```

`pageActions={false}` removes the menu; an options object configures it for every page. `editUrl` adds "Edit this page" above the previous / next cards — `page.path` is the source path inside the docs root.

## Around the content

| Prop | Renders |
| --- | --- |
| `sidebarFooter` | Pinned under the sidebar (this site's "rendered by DocsSite" line). |
| `footer` | Below every page, after previous / next. |
| `renderPage(page, content)` | Wrap or extend a page — add a banner to drafts, a feedback widget, anything per page. |
| `notFound(path)` | The page for an unknown URL. |
| `header={false}` | No header, for a site [under your own bar](#under-your-own-bar). |
| `search={false}` | No search button, no ⌘K. |
| `toc={false}` | No outline. |
| `documentTitle` | `false` to leave `document.title` alone, or `(page, siteTitle) => string`. |
| `height` | The site's height (default `100dvh`); it scrolls inside. Give an embedded site a fixed height. |

```tsx title="Drafts get a banner"
<DocsSite
  files={files}
  renderPage={(page, content) => (
    <>
      {page.frontmatter.status === "draft" ? <p className="banner">This page is a draft.</p> : null}
      {content}
    </>
  )}
/>
```

## Everything docstream renders

DocsSite takes the renderer options `MarkdownContent` takes and hands them to every page:

| Prop | For |
| --- | --- |
| `demoResolver` | `{% demo src="…" %}` folders — see [Demos](../04-interactive/01-demos.md) |
| `demoRuntime`, `demoDependencies`, `demoVFS` | Inline-file demos run in the browser — see [Inline demos](../04-interactive/02-inline-demos.md) |
| `liveRenderer` | ` ```jsx live="true" ` fences — see [Live code](../04-interactive/03-live-code.md) |
| `sourceRenderer` | `{% source-ref %}` blocks — see [Source files](../04-interactive/04-source-files.md) |
| `documentProperties` | Show or hide frontmatter property sheets |
| `onTaskStateChange` | Make task checkboxes interactive |

Context providers wrap the site like any docstream renderer — this site wraps it in `DocstreamRefContext` for citation previews ([References and citations](../06-ai/02-references-and-citations.md)) — and `AssetResolverProvider` resolves relative images and embeds ([Assets](../05-media/06-assets.md)).

## This site's setup

The docstream site you're reading, in full:

```tsx title="demo/src/main.tsx"
const files = import.meta.glob("../docs/**/*.md", { query: "?raw", import: "default", eager: true })

<DocstreamRefContext.Provider value={{ resolveCitationPreview: citationPreviews }}>
  <DocsSite
    files={files}
    title="docstream"
    logo={<Logo />}
    links={[{ label: "GitHub", href: GITHUB }, { label: "npm", href: NPM }]}
    appearanceStorageKey="docstream-demo-theme"
    liveRenderer={liveRenderer}
    sourceRenderer={sourceRenderer}
    demoResolver={demoResolver}
    demoRuntime={demoRuntime}
    pageActions={(page) => ({ transform: (md) => `${md.trim()}\n\n---\n\nSource: ${SITE}#/${page.slug}\n` })}
    editUrl={(page) => `${GITHUB}/edit/main/demo/docs/${page.path}`}
  />
</DocstreamRefContext.Provider>
```
