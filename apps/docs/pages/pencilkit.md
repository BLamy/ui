# PencilKit

PencilKit's drawing surface in BL UI's language, built on **[perfect-freehand](https://github.com/steveruizok/perfect-freehand)** by Steve Ruiz — the pressure-to-outline ink engine behind tldraw.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/pencilkit.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { PencilCanvas } from '@/components/ui/pencilkit/pencil-canvas'
import { PencilToolbar } from '@/components/ui/pencilkit/pencil-toolbar'
import {
  usePencilHistory,
} from '@/components/ui/pencilkit/use-pencil-history'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  PencilCanvas, PencilToolbar, usePencilHistory,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

{% demo src="pencilkit/sketch-demo" %}

## The pipeline

1. Pointer events collect `[x, y, pressure]` — real pressure from Apple Pencil, simulated from velocity for mouse and touch. Coalesced events keep fast strokes dense.
2. `getStroke(points, options)` returns an outline polygon for the whole mark.
3. The outline renders as **one filled SVG path** using midpoint quadratic curves — no per-segment strokes, so joins and tapers are geometrically exact.

```js
import { getStroke } from "perfect-freehand"

const outline = getStroke(points, {
  size: 7, thinning: 0.62, smoothing: 0.5, streamline: 0.42,
  simulatePressure: pointerType !== "pen",
})
```

## Tools

| Tool | size | thinning | smoothing | streamline | extras |
| --- | --- | --- | --- | --- | --- |
| Pen | 7 | 0.62 | 0.50 | 0.42 | — |
| Marker | 20 | 0.06 | 0.55 | 0.50 | 50% opacity |
| Pencil | 4.5 | 0.72 | 0.42 | 0.34 | 22px taper, both ends |
| Eraser | — | — | — | — | removes whole strokes it touches |

## Usage

```tsx
import { PencilCanvas } from '@/components/ui/pencilkit/pencil-canvas'

<div style={{ position: 'relative', height: 540 }}>
  <PencilCanvas tool="pen" hint="Draw here" style={{ position: 'absolute', inset: 0 }} />
</div>
```

`PencilCanvas` is the raw surface: mount it inside any themed container. `usePencilHistory` (from `@/components/ui/pencilkit/use-pencil-history`) gives it undo and redo. The full sketch-pad page with the toolbar, colors and demo strokes is the **pencilkit-sketch** [block](https://blamy.github.io/ui/#/blocks) (`npx shadcn add https://blamy.github.io/ui/r/pencilkit-sketch.json`).

## Examples

### Signature pad

A bare `PencilCanvas` with controlled strokes. `ink="currentColor"` draws in the text colour, so the signature flips with light and dark.

{% demo src="pencilkit/signature-pad" %}

### Annotate a screenshot

The canvas is transparent, so it can sit over any content. This toolbar keeps only the marker, pen and eraser, three highlighter inks, and undo/redo from `usePencilHistory`.

{% demo src="pencilkit/annotate-screenshot" %}

### The Composer's image annotator

`PencilKitAnnotator` is the Composer's default image annotator: pressing a pasted image opens this canvas and toolbar over it, and Save flattens the strokes into it — no setup needed. To bring it back under a provider that swapped it out, pass it explicitly. See [Composer](https://blamy.github.io/ui/#/composer).

```tsx
import { Composer, PencilKitAnnotator } from '@brett_lamy/ui'

<Composer annotator={PencilKitAnnotator}>…</Composer>
```

### Save sketches

Strokes are plain data. `StrokePath` renders them anywhere, here as thumbnails fitted to each sketch's bounding box.

{% demo src="pencilkit/sketch-gallery" %}

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `pencilToolButtonVariants`

Defined in `@/components/ui/pencilkit/pencil-toolbar`. Base classes:

```text
grid h-[34px] w-[38px] cursor-pointer place-items-center rounded-[9px] border-0 p-0 data-disabled:cursor-default data-disabled:opacity-[.32]
```

**`active`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `bg-primary text-primary-foreground` |
| `false` (default) | `bg-transparent text-muted-foreground data-selected:bg-primary data-selected:text-primary-foreground` |
