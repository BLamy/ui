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
  accentColor="#e8590c"
/>
```

`title` shows in the header and the browser tab (`"Install — Acme"`). `accentColor` recolors links, the active sidebar item, the breadcrumb, the outline marker and focus rings. Header links open in a new tab; with an `icon`, narrow layouts show the icon alone.

## Light, dark and your own tokens

The built-in palette has a light and a dark set. The header's switch flips them and remembers the choice in `localStorage`; `?theme=dark` in the URL wins for one visit (handy for screenshots).

| Prop | Default | Effect |
| --- | --- | --- |
| `defaultTheme` | `"system"` | Starting theme when the reader hasn't chosen: `light`, `dark`, or the OS setting. |
| `theme` / `onThemeChange` | — | Control it yourself. |
| `themeToggle` | `true` | Show the switch. |
| `themeStorageKey` | `"docstream-site-theme"` | Where the choice is kept; `false` to not persist. |
| `applyThemeTo` | `"document"` | Also set `data-theme` on `<html>`, so the rest of your page follows. `"site"` keeps it on the site element (the default for `routing="memory"`). |
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
    themeStorageKey="docstream-demo-theme"
    liveRenderer={liveRenderer}
    sourceRenderer={sourceRenderer}
    demoResolver={demoResolver}
    demoRuntime={demoRuntime}
    pageActions={(page) => ({ transform: (md) => `${md.trim()}\n\n---\n\nSource: ${SITE}#/${page.slug}\n` })}
    editUrl={(page) => `${GITHUB}/edit/main/demo/docs/${page.path}`}
  />
</DocstreamRefContext.Provider>
```
