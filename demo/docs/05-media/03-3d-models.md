---
description: Embed an .stl file and readers get a WebGL model they can orbit and zoom. Binary or ASCII STL, no 3D library, and a parser you can call yourself.
---

# 3D models

An embed whose URL ends in `.stl` renders an interactive model viewer: drag to orbit, pinch or ⌘-scroll to zoom, double-click to reset. It is about 300 lines of plain WebGL with no three.js, so it costs almost nothing until a page uses it. The caption links to the file and shows its triangle count and bounding box.

{% embed url="/docstream/models/bracket.stl" title="Mounting bracket" %}

```md
{% embed url="/docstream/models/bracket.stl" title="Mounting bracket" %}
```

The bracket is a 40-triangle ASCII STL. Binary STL works the same way. This geodesic dome is a 320-triangle binary file (16 KB):

{% embed url="/docstream/models/geodesic.stl" title="Geodesic dome (binary STL)" %}

## Controls

| Input | Does |
| --- | --- |
| Drag (mouse, pen or touch) | Orbit |
| Pinch, or ⌘ / Ctrl + scroll | Zoom. A plain scroll keeps scrolling the page, so a model never traps the reader. |
| `←` `→` `↑` `↓` | Orbit (focus the model first) |
| `+` / `-` | Zoom |
| `0`, double-click, or **Reset** | Back to the starting view |

The model turns slowly until the first interaction. It stays still for readers who prefer reduced motion. The canvas is focusable and labelled ("Mounting bracket: 3D model. Drag or use arrow keys to rotate…"), so it works from the keyboard and with screen readers.

## What it does with the file

1. **Fetches** the URL as an `ArrayBuffer`. A failed request shows "Couldn't load *name*: *status*" in the frame.
2. **Detects the format by size**, not by the `solid` keyword. Binary is 84 + 50 bytes per triangle. Some binary exporters start their header with `solid`, which would fool a keyword check.
3. **Recomputes every face normal** from the winding order. Stored normals are often zero or wrong, and the winding is what slicers trust.
4. **Fits the model**: centers it, scales it to a unit sphere, and turns STL's Z-up into the screen's Y-up.
5. **Lights it** with a key, a fill and a sky term, plus a little specular. Back faces are lit too, so meshes with flipped triangles still read.

The model color defaults to the element's CSS `color` (the theme's primary). It re-reads that color when the document's `class`, `data-theme` or `style` changes, so the model follows a theme switch without a reload.

## Relative paths

The `.stl` URL goes through the host's [asset resolver](06-assets.md), like an image. A document from a repo can write `models/part.stl` next to itself, and a desktop app can map that path to a `blob:` URL of the local file. While an async resolver is working, the embed holds a pending frame, and the caption keeps the file name as written even when the resolved URL is a blob.

## StlViewer

The embed renders `StlViewer`, which you can use directly. It takes a URL, so a mesh you build in the browser goes in as a `blob:` URL. This demo generates three shapes in `mesh.ts`, writes them as binary STL, reads them back with `parseStl` for the stats, and hands the blob to the viewer:

{% demo src="media-3d/generated" %}

```tsx title="PartPreview.tsx"
import { StlViewer } from "@brett_lamy/docstream"
// or: import { StlViewer } from "@brett_lamy/docstream/stl"

export function PartPreview({ url }: { url: string }) {
  return <StlViewer src={url} title="Bracket v3" color="oklch(0.7 0.15 250)" autoRotate={false} />
}
```

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `src` | `string` | required | URL of a binary or ASCII `.stl`. Used as given; the component doesn't call the asset resolver (the embed does). |
| `title` | `string` | the file name | Caption and accessible label. |
| `color` | `string` | the element's `color` | Any CSS color (`oklch()`, `var()`, named…). |
| `autoRotate` | `boolean` | `true` | Turn until the reader interacts. Read once, on mount. |
| `className` | `string` | none | Added to the `figure.docstream-stl` root. |

The root carries `data-state="loading" | "error" | "ready"`. Its parts are `.docstream-stl__stage`, `__canvas`, `__status`, `__reset` and `__caption`.

## parseStl and isStlUrl

```ts title="inspect.ts"
import { parseStl, isStlUrl, type StlMesh } from "@brett_lamy/docstream"

isStlUrl("parts/bracket.STL?v=3") // true: the path ends in .stl, any case
isStlUrl("parts/bracket.step")    // false

const mesh: StlMesh = parseStl(await file.arrayBuffer())
mesh.triangles  // 40
mesh.positions  // Float32Array: 9 numbers per triangle, ready for drawArrays
mesh.normals    // Float32Array: the face normal, repeated per vertex
mesh.min        // [x, y, z] bounding-box corner
mesh.max
```

`parseStl` throws `"Not an STL file"` when the data is neither binary STL nor text starting with `solid`, and `"Malformed ASCII STL"` when the text has facets but no readable vertices. Call it to check an upload before you show it.

{% hint style="info" %}
STL has no units. The viewer's caption and `parseStl` report the bounding box in whatever units the file uses, usually millimetres.
{% endhint %}

## See also

{% content-ref url="06-assets.md" %}
Resolving model paths from a repo or a local folder
{% endcontent-ref %}

{% content-ref url="01-embeds-and-video.md" %}
Every embed rule, in order
{% endcontent-ref %}
