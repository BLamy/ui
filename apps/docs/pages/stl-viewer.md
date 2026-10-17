# StlViewer

A 3D preview of an `.stl` model — the format 3D printers and CAD tools export. Binary and ASCII files both work. It draws with WebGL and has no dependencies: drag to orbit, pinch or ⌘-scroll to zoom (or `+` / `−`), arrow keys to turn, double-click or `0` to reset. The triangle count and the model's size sit under it. The model takes the theme's primary color (any CSS `color` on it or above it), and turns slowly until someone touches it, unless the reader prefers reduced motion.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/stl-viewer.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { StlViewer } from '@/components/ui/stl-viewer'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { StlViewer } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

`StlViewer` lives in [`@brett_lamy/docstream`](https://blamy.github.io/ui/#/docstream) (`@brett_lamy/docstream/stl`, 1.10 and later), where `{% embed url="part.stl" %}` renders it. BL UI keeps a thin re-export, so `@/components/ui/stl-viewer` resolves like every other part.

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
import { AssetResolverProvider } from '@brett_lamy/docstream'

<AssetResolverProvider resolve={(url) => blobUrlFor(url)}>{document}</AssetResolverProvider>
```

`MarkdownEditor` takes the same function as `resolveAsset`, plus `pickFile` for a "Choose file…" button on embeds and `onDropEmbeds` to turn dropped files into embeds.

## The mesh

`parseStl` reads an `ArrayBuffer` into the triangles, normals and bounds the viewer draws — for your own renderer, or to check a model before printing. `isStlUrl` tells you whether a URL names one.

{% demo src="stl-viewer/mesh" %}

```tsx
import { parseStl, isStlUrl } from '@/components/ui/stl-viewer'

const mesh = parseStl(await (await fetch(url)).arrayBuffer())
mesh.triangles        // 5040
mesh.min, mesh.max    // bounds, in the file's units
```

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `src` | — | URL of a binary or ASCII `.stl` file (`blob:` URLs too). |
| `title` | — | A caption above the size line, and the canvas's label. |
| `color` | the inherited `color` | The model's color; any CSS color. |
| `autoRotate` | `true` | Turn slowly until the reader interacts. Off under reduced motion. |
| `className` | — | On the outer `<figure>`. |
