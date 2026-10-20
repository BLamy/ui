---
description: Live, file-backed React examples in a Markdown page — the component runs in place, and the code the reader sees is the real file on disk.
---

# Folder demos

A docs page should be **one Markdown document**. `{% demo %}` puts a live example into it: the component renders in-page, and the Code view shows the real files from your repo — never a copy pasted into the Markdown. Change the file and the page changes with it.

{% hint style="info" %}
Every demo on this page is a single Markdown line. Use **Copy page** (top right) and paste the result into any docstream renderer: each `{% demo %}` keeps its tag and carries its real source files inline, so the copy renders back as this same page, with or without this site's resolver.
{% endhint %}

## One file: the compact card

A folder with one source file gets the compact card — the preview, then a collapsible, line-numbered code panel. The switch in the header hands the component a `variant` prop.

{% demo src="demos/badges" %}

```md
{% demo src="demos/badges" %}
```

A block-level root lays out exactly as it would on a page. This one is `max-width: 480px; margin: 0 auto`, so it keeps its width and centres. Without a `height`, a single-file preview sizes to its content.

{% demo src="demos/signup" %}

## Two or more files: the gallery viewer

More than one file switches to the gallery viewer:

- **Preview | Code** tabs. The Code view lists every file as a tree (entry first, then root files, then folders), each with its own copy button and a draggable file-list width.
- **Viewport buttons** — desktop (fills the stage), tablet (768px), phone (390px) — and a **resize handle** with a live width readout (minimum 280px).
- **Fullscreen** opens a native modal dialog (focus-trapped, Esc closes) that keeps the variant switch.
- **Open in new tab** appears when the resolver supplies a deep link (see [Deep links](#deep-links-and-fullscreen)).
- **Copy demo** writes the demo to the clipboard with its files, ready to paste into another page or a docstream editor (see [Inline demos](02-inline-demos.md#the-docstream-clipboard)).

{% demo src="demos/pricing" viewport="desktop" %}

Preview frames are **size containers**, so a demo written with container queries reacts to the viewport buttons and the resize handle exactly as it would to a phone. This one is full-bleed (`"bleed": true` in its `meta.json`), keeps its parts in a nested folder, and opens at tablet width:

{% demo src="demos/inbox" viewport="tablet" %}

{% hint style="info" %}
Demos load lazily: a viewer fetches its component and files only once it comes within 400px of the viewport, so a page with twenty demos costs nothing until the reader scrolls.
{% endhint %}

## Anatomy of a demo folder

Each `<page>/<example>` folder under the examples root holds an entry, any number of other files (nested folders are fine), and an optional `meta.json`:

```txt
examples/
  demos/
    pricing/
      index.tsx        ← entry: default export = the component, receives { variant }
      PricingCard.tsx
      plans.ts
      pricing.css
      meta.json        ← optional defaults for the tag (hidden from the Code view)
```

The entry's **default export** is the component (failing that, its first exported function). It receives one prop, `variant`, when the demo declares variants — design one file to show several looks:

```tsx title="examples/demos/badges/index.tsx"
export default function Badges({ variant = "soft" }: { variant?: string }) {
  const look = ["soft", "solid", "outline"].includes(variant) ? variant : "soft"
  return <div className={`badges badges-${look}`}>…</div>
}
```

### meta.json

Every field is optional, and every field can be overridden by the tag.

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | `string` | Header title. Defaults to the folder name. |
| `description` | `string` | Header text; inline Markdown (`code`, **bold**, _em_, links) is rendered. |
| `height` | `number \| string` | Pixels or any CSS length. A **minimum** for single-file cards (they grow with content); the stage height for the gallery and for inline-demo iframes. |
| `variants` | `{ id, label }[]` | The variant switch. The first is the default. |
| `entry` | `string` | Entry file relative to the folder. Defaults to `index.tsx`. |
| `layout` | `"auto" \| "single" \| "multi"` | `auto` picks `multi` for 2+ files. |
| `bleed` | `boolean` | Drop the padded canvas for full-bleed app UIs. |
| `className` | `string` | Extra class on the preview canvas. |
| `surface` | `Record<string, string \| number>` | Inline style for the canvas — plain properties or CSS custom properties. |
| `status` | `string` | A small label in the header ("Live", "Needs network"). |
| `variantsWidth` | `number \| string` | Width of the variant switch; its options share it equally. |

```json title="examples/demos/pricing/meta.json"
{
  "title": "Pricing table",
  "description": "Four files — the entry, a card component, the plan data and a stylesheet.",
  "height": 500,
  "variants": [
    { "id": "monthly", "label": "Monthly" },
    { "id": "yearly", "label": "Yearly" }
  ]
}
```

## Tag attributes

```md
{% demo src="<page>/<example>" title="…" description="…" height="420" layout="auto" variants="full:Full,compact:Compact" viewport="desktop" %}
```

| Attribute | Default | Meaning |
| --- | --- | --- |
| `src` | — | The `<page>/<example>` folder, resolved by the host. |
| `title`, `description` | `meta.json` | Header text (the description renders inline Markdown). |
| `height` | `meta.height`, else 480 (gallery) / auto (single) | Pixels (`420`) or any CSS length (`60vh`). |
| `layout` | `auto` | `auto`, `single` or `multi`. |
| `variants` | `meta.variants` | `id:Label` pairs, comma-separated; a bare `id` is its own label. |
| `viewport` | `desktop` | Initial width of the gallery: `desktop`, `tablet` or `phone`. |
| `entry` | `meta.entry`, else the first inline file | Entry among the files. |
| `status` | `meta.status` | Header label. |
| `bleed` | `meta.bleed`, else `false` | `true` drops the canvas padding. |
| `className` | `meta.className` | Extra class on the preview canvas. |
| `surface` | `meta.surface` | Canvas style as CSS declarations: `background: var(--brand-50); --demo-gap: 12px`. |
| `variantsWidth` | `meta.variantsWidth` | Width of the variant switch. |

Precedence is **field by field**: a tag attribute wins over `meta.json`, which wins over the default. In attribute values, write a double quote as `\"`, a backslash as `\\`, and `%}` as `%\}` — the serializer does this for you.

### Overrides, live

The same folder, restyled from the tag alone — a dark `surface`, only two of its three variants (so `solid` becomes the default), a new title and status:

{% demo src="demos/badges" title="Badges on a dark surface" description="Same folder: `surface`, `variants`, `title` and `status` come from the tag." surface="background: #0f172a; color: #e2e8f0" variants="solid:Solid,outline:Outline" status="Overridden" %}

```md
{% demo src="demos/badges" title="Badges on a dark surface" surface="background: #0f172a; color: #e2e8f0" variants="solid:Solid,outline:Outline" status="Overridden" %}
```

`layout="multi"` forces the gallery for a one-file demo — handy when you want the viewport buttons and resize handle:

{% demo src="demos/signup" layout="multi" height="300" viewport="phone" %}

```md
{% demo src="demos/signup" layout="multi" height="300" viewport="phone" %}
```

## Wiring a resolver

The host tells docstream where demos live with a `DemoResolver`. With Vite, `createGlobDemoResolver` builds one from three `import.meta.glob` maps — this is this site's whole resolver:

```ts title="demos.ts"
import { createGlobDemoResolver, demoHref } from "@brett_lamy/docstream"

export const demoResolver = createGlobDemoResolver({
  root: "./examples",
  modules: import.meta.glob("./examples/*/*/index.tsx"),
  sources: import.meta.glob("./examples/*/*/**/*.{ts,tsx,css,json}", { query: "?raw", import: "default" }),
  metas: import.meta.glob("./examples/*/*/meta.json", { eager: true, import: "default" }),
  href: (src) => demoHref(src, { base: import.meta.env.BASE_URL }),
})
```

```tsx title="Page.tsx"
<MarkdownContent markdown={page} demoResolver={demoResolver} pageActions />
```

| Option | Purpose |
| --- | --- |
| `modules` | Entry modules, lazy (the `import.meta.glob` default) or eager. Demo ids come from these paths. |
| `sources` | Raw file text for the Code view. A `?raw` glob with or without `import: "default"` works. |
| `metas` | `meta.json` per folder (optional). |
| `root` | Glob prefix the ids are relative to (`"./examples"` → `demos/pricing`). Without it, an id is the last two folders of the entry path. |
| `entry` | Default entry file name (default `index.tsx`); a folder's `meta.entry` wins. |
| `exclude` | `(path, src) => boolean` — hide files from the Code view (`meta.json` is always hidden). |
| `href` | Deep link for one demo, enabling **Open in new tab**. |

The resolver travels through React context (`DocstreamDemoContext`), so demos inside tabs, hints, steppers, nested renderers — and Markdown rendered *by a demo* — all resolve. `createGlobDemoResolver` caches `meta`, `files` and `load` per `src`.

## Writing your own resolver

`createGlobDemoResolver` is a convenience; a resolver is any object with these methods. Fetch from a CMS, a database, or a registry API — docstream only calls them:

```ts title="types.ts"
interface DemoResolver {
  list?(): string[]                              // known ids (tooling, llms.txt, VFS layering)
  meta(src: string): Promise<DemoMeta | undefined>
  files(src: string): Promise<DemoFile[]>         // entry first — exactly what the Code view shows
  load(src: string): Promise<DemoComponent>       // the component rendered in-page
  href?(src: string, options?: { variant?: string }): string | undefined
}
```

The demo below renders a nested `MarkdownContent` with an in-memory resolver (open **Code** and read `memoryResolver.ts`). The `demoResolver` prop overrides the site's resolver for everything inside it:

{% demo src="interactive-demos/custom-resolver" %}

{% hint style="warning" %}
`list()` matters when a block also carries inline files: if the resolver lists ids and `src` is not among them, the viewer skips the resolver and uses the inline files straight away. Without `list()`, the resolver is always asked first.
{% endhint %}

## Deep links and fullscreen

When the resolver has `href`, the gallery shows **Open in new tab**. The conventional link is `?demo=<src>` (plus `&variant=<id>`), built by `demoHref` and read back by `demoFromSearch`. The host routes it to `<DemoFullscreen>`, which renders one demo filling the viewport:

```tsx title="main.tsx"
import { DemoFullscreen, demoFromSearch } from "@brett_lamy/docstream"

function Root() {
  const deepLink = demoFromSearch() // { src, variant? } | null, from location.search
  return deepLink
    ? <div data-docstream=""><DemoFullscreen src={deepLink.src} variant={deepLink.variant} resolver={demoResolver} /></div>
    : <App />
}
```

Try it: [the pricing table alone, yearly](https://blamy.github.io/ui/?demo=docstream:demos/pricing&variant=yearly).

| Function | Signature | Notes |
| --- | --- | --- |
| `demoHref` | `(src, { base?, variant?, param? }) => string` | `base` defaults to `location.pathname`; `param` defaults to `"demo"`. Slashes in `src` stay readable. |
| `demoFromSearch` | `(search?, param = "demo") => { src, variant? } \| null` | Reads `location.search` by default. |
| `DemoFullscreen` | `{ src, resolver?, variant?, className?, style? }` | Without `variant`, the demo's first declared variant is used. |

## Rendering demos without Markdown

The viewer is a component too. `DemoViewer` takes the same fields as the tag (`canvasClassName` stands in for `className`, which goes on the outer element), plus `resolver`, `files`, `runtime`, `dependencies` and `vfs` overrides; `DemoBlock` renders a parsed `DemoNode`:

```tsx
import { DemoViewer } from "@brett_lamy/docstream"

<DemoViewer src="demos/pricing" resolver={demoResolver} viewport="phone" variants={[{ id: "yearly", label: "Yearly" }]} />
```

## Preloading for SSR and static export

Viewers resolve asynchronously, so a server render shows loading states. Resolve ahead of time and the first render is complete:

```ts
import { preloadDemos, prefetchDemoSources, peekDemoSource } from "@brett_lamy/docstream"

await preloadDemos(demoResolver, ["demos/pricing", "demos/inbox"])  // meta + files + component
await prefetchDemoSources(demoResolver, ["demos/badges"])            // meta + files only
peekDemoSource(demoResolver, "demos/badges")                         // { files, meta } synchronously, or undefined
```

`preloadDemos` remembers failures too, so a block's inline files take over immediately instead of after a failed request. `peekDemoSource` is what a synchronous copy handler uses to put a demo's files on the clipboard.

## Where the preview comes from

| The block has… | and there is… | Preview | Code view |
| --- | --- | --- | --- |
| `src` only | a resolver that knows `src` | the component, in-page | the resolver's files |
| inline files | a resolver that knows `src` | the component, in-page | the resolver's files (they win) |
| inline files | no resolver, or one that doesn't list `src` | the `demoRuntime` runs the files | the inline files |
| inline files | no runtime either | a one-line note | the inline files, shown first |
| `src` only | a demo VFS holding `src` | the `demoRuntime` runs the VFS files | the VFS files |
| `src` only | no resolver | a placeholder chip | — |

The inline and VFS rows are the subject of the next page.

{% content-ref url="02-inline-demos.md" %}
Inline demos — self-contained demos that carry their files, the almost-node runtime, the demo VFS and the clipboard
{% endcontent-ref %}
