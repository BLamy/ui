# StlViewer

A 3D preview of an `.stl` model, the format 3D printers and CAD tools export. Use it wherever a file list or a note shows a model, so the reader can turn it before printing. Binary and ASCII files both work. It draws with WebGL, with no 3D library: drag to orbit, pinch or ⌘-scroll to zoom (or `+` / `−`), arrow keys to turn, double-click or `0` to reset. The triangle count and the model's size sit under it. The model takes the theme's primary color (any CSS `color` on it or above it), or the CSS color you pass as `tint`, and turns slowly until someone touches it, unless the reader prefers reduced motion.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/stl-viewer.json{% endcommand %}

Adds one module to your project's `components/ui/` and installs `@brett_lamy/ui`, whose Docstream it imports by the package's name. The module only re-exports the widget, so there is nothing in it to edit; it gives the widget your alias. Import from your alias:

```tsx
import { StlViewer } from '@/components/ui/stl-viewer'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheets once at your app's entry (the kit's, then docstream's, which this part renders with), then the parts from their module (the Markdown library's entry, `@brett_lamy/ui/markdown`, has them too):

```tsx
import '@brett_lamy/ui/styles.css'
import '@brett_lamy/ui/docstream/styles.css'

import { StlViewer } from '@brett_lamy/ui/stl-viewer'
```
{% endtab %}
{% endtabs %}

{% hint style="info" %}
`StlViewer` lives in docstream, the library's Markdown renderer (`@brett_lamy/ui/docstream/stl`), where `{% embed url="part.stl" %}` renders it. Docstream isn't copied by the registry: the registry item adds `@brett_lamy/ui` for it, and a one-line module that re-exports the viewer and its props type. The mesh reader below comes straight from `@brett_lamy/ui/docstream/stl`.
{% endhint %}

## A model by URL

{% demo src="stl-viewer/basic" %}

```tsx
<StlViewer src="/models/torus-knot.stl" title="Torus knot" />
```

## A file from your computer

A `blob:` URL works as `src`, so a chosen or dropped file shows without leaving the browser.

{% demo src="stl-viewer/local-file" %}

```tsx
const url = URL.createObjectURL(file)
<StlViewer src={url} title={file.name} />
```

## In Markdown

Any docstream page embeds a model the same way. A relative path resolves against the page's asset base — or through your own resolver, which is how the [Apple Notes block](https://blamy.github.io/ui/#/blocks) shows models from a folder on your Mac:

```md
{% embed url="./case/stl/display_half_back.stl" %}
```

```tsx
import { AssetResolverProvider } from '@brett_lamy/ui/docstream'

<AssetResolverProvider resolve={(url) => blobUrlFor(url)}>{document}</AssetResolverProvider>
```

`MarkdownEditor` takes the same function as `resolveAsset`, plus `pickFile` for a "Choose file…" button on embeds and `onDropEmbeds` to turn dropped files into embeds.

## The mesh

`parseStl` reads an `ArrayBuffer` into the triangles, normals and bounds the viewer draws — for your own renderer, or to check a model before printing. `isStlUrl` tells you whether a URL names one.

{% demo src="stl-viewer/mesh" %}

```tsx
import { parseStl, isStlUrl } from '@brett_lamy/ui/docstream/stl'

const mesh = parseStl(await (await fetch(url)).arrayBuffer())
mesh.triangles        // 5040
mesh.min, mesh.max    // bounds, in the file's units
```

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `src` | — | URL of a binary or ASCII `.stl` file (`blob:` URLs too). |
| `title` | — | A caption above the size line, and the canvas's label. |
| `tint` | the inherited `color` | The model's color: any CSS color. |
| `autoRotate` | `true` | Turn slowly until the reader interacts. Off under reduced motion. |
| `className` · `style` · `ref` | — | On the outer `<figure>`. |
| `id`, `data-*`, `aria-describedby`… | — | The rest of a `<figure>`'s props reach the root. |
| `aria-label` | `title` | Names the figure and its canvas, when the title isn't the name you want. |

## Accessibility

- The root is a `figure`, named by `aria-label` when you pass one; otherwise its caption, the file link, names it.
- The canvas is the control: one Tab stop named "<name>: 3D model" (`aria-roledescription="3D viewer"`), described by how to use it. Drag, or ←/→ and ↑/↓, turn the model; `+` and `-` zoom; `0` puts it back. A pinch or ⌘/Ctrl-scroll zooms, and a double-click goes home; plain scrolling scrolls the page.
- **Reset** is a button named "Reset view". On a touch screen its hit area reaches 44px while the pill keeps its size.
- While the file loads the stage is a polite `status` ("Loading bracket.stl…"); a file that can't be read is an `alert` that says why.
- `autoRotate` stops at the first interaction, and never starts under `prefers-reduced-motion`.

## Data attributes

| Attribute | On | Values |
| --- | --- | --- |
| `data-state` | the root `figure` (`.docstream-stl`) | `loading`, `ready`, `error` |
