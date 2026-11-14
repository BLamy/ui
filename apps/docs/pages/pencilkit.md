# PencilKit

Freehand drawing in the manner of Apple's PencilKit: a surface that turns pointer samples into pressure-shaped ink, and the tool palette that goes with it. Use it for sketches, signatures and annotations. It is built on **[perfect-freehand](https://github.com/steveruizok/perfect-freehand)** by Steve Ruiz, the pressure-to-outline engine behind tldraw. For a board of movable items (stickies, shapes, connectors) use [Canvas](https://blamy.github.io/ui/#/canvas), and put a `PencilCanvas` inside it to draw on the board.

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
{% endtab %{% demo src="pencilkit/sketch-demo" %}

```tsx
const history = usePencilHistory()
const [tool, setTool] = useState<PencilTool>('pen')

<div className="relative h-96">
  <PencilCanvas tool={tool} strokes={history.strokes} onStrokesChange={history.onStrokesChange} />
  <PencilToolbar className="absolute inset-x-0 bottom-3 mx-auto">
    <PencilToolPicker value={tool} onValueChange={setTool} />
    <ToolbarSeparator />
    <PencilInkPicker defaultValue="#0A84FF" />
    <PencilToolbarPinned>
      <ToolbarSeparator />
      <PencilActions onUndo={history.undo} onRedo={history.redo} onClear={history.clear}
        canUndo={history.canUndo} canRedo={history.canRedo} canClear={history.canClear} />
    </PencilToolbarPinned>
  </PencilToolbar>
</div>
```

## The pipeline

1. Pointer events collect `[x, y, pressure]`: real pressure from Apple Pencil, simulated from velocity for mouse and touch. Coalesced events keep fast strokes dense.
2. `getStroke(points, options)` returns an outline polygon for the whole mark.
3. The outline renders as **one filled SVG path** using midpoint quadratic curves: no per-segment strokes, so joins and tapers are geometrically exact.

| Tool | size | thinning | smoothing | streamline | extras |
| --- | --- | --- | --- | --- | --- |
| Pen | 7 | 0.62 | 0.50 | 0.42 | — |
| Marker | 20 | 0.06 | 0.55 | 0.50 | 50% opacity |
| Pencil | 4.5 | 0.72 | 0.42 | 0.34 | 22px taper, both ends |
| Eraser | — | — | — | — | removes whole strokes it touches |

## PencilCanvas

The drawing surface. On its own it fills its positioned parent (`absolute inset-0`), its points are in its own pixels, and a stroke follows the pointer with UI SDK's `bindDrag`, so it keeps going outside the canvas until the pointer lifts. `onStrokesChange(strokes, details)` reports each drawn or erased stroke with `details.reason` (`draw` or `erase`) before anything moves; on an uncontrolled canvas `details.cancel()` keeps the strokes as they were. It is named "Drawing" for assistive tech (an image); pass `aria-label` to say what it holds.

| Prop | Default | Effect |
| --- | --- | --- |
| `tool` | `"pen"` | `pen`, `marker`, `pencil` or `eraser` (removes whole strokes it touches). |
| `ink` | the theme's black | Any CSS color. The default, `var(--foreground)`, draws black on light paper and white on dark, as PencilKit's black does. |
| `width` | `1` | Scales the tool's nib (`0.6`, `1`, `1.7`, `2.6` are the palette's widths). |
| `strokes` / `defaultStrokes` | — | The strokes, controlled or not. A stroke is `{ tool, color, width, pressure, points, complete }`. |
| `onStrokesChange` | — | `(strokes, details)`, with `details.reason` `draw` or `erase`. |
| `emptyState` | — | Shown centered while there are no strokes (`data-empty` is on the root then). |
| `variant` | `"freehand"` | `plain` draws the raw polylines instead of the pressure outlines. |
| `disabled` | `false` | Takes no presses: a read-only drawing. |
| `aria-label` | `"Drawing"` | The drawing's name. |

### On a Canvas

Inside a [Canvas](https://blamy.github.io/ui/#/canvas), `PencilCanvas` is the board's drawing layer. It draws in board units under the canvas's pan and zoom, takes presses before the canvas's own `onCanvasPointerDown` (through `useCanvas().addPointerLayer`), and leaves Space-drag, the middle button, pinch and the wheel to the canvas. `disabled` hands the presses back, for when another tool is in hand.

```tsx
<Canvas className="cursor-crosshair">
  {items.map((it) => <Card key={it.id} … />)}
  <PencilCanvas disabled={tool !== 'draw'} tool={pen} ink={ink} strokes={strokes} onStrokesChange={setStrokes} />
</Canvas>
```

A board that keeps strokes in its own model, to stack them with its other items, passes `strokes={[]}` and adds the drawn stroke from `onStrokesChange` (`next.at(-1)`). The [Freeform block](https://blamy.github.io/ui/#/blocks) does this.

## The toolbar

`PencilToolbar` is the kit's [Toolbar](https://blamy.github.io/ui/#/toolbar) (`variant="floating"` by default, named "Drawing tools"): Tab enters it once, and Left and Right move across the pickers (toggle groups join the toolbar's navigation) into `PencilActions`. Separate groups with the kit's `ToolbarSeparator`. It sits in the flow, so place it yourself (`absolute inset-x-0 bottom-3 mx-auto` over a canvas). When its groups don't fit, they scroll sideways under an edge fade, and whatever is in `PencilToolbarPinned` stays at the trailing end.

| Part | Props | Notes |
| --- | --- | --- |
| `PencilToolbar` | Toolbar's (`variant`, `size`, `aria-label`, `orientation`…) | `variant="plain"` drops the card, for a bar inside another surface. |
| `PencilToolbarPinned` | a `div`'s | A direct child of `PencilToolbar`; its content stays in view. |
| `PencilToolPicker` | `value`, `defaultValue` (`"pen"`), `onValueChange(tool, details)`, `tools`, `hoverCard` | Each tool is named (Pen, Marker, Pencil, Eraser) and shows its name in a tooltip. |
| `PencilInkPicker` | `value`, `defaultValue` (the first ink), `onValueChange(ink, details)`, `inks` | `value` is the ink's color. `inks` is `{ value, label }[]`; the default six are Black and White (both follow the theme), Blue, Green, Yellow and Pink. |
| `PencilWidthPicker` | `value`, `defaultValue` (`1`), `onValueChange(scale, details)`, `widths`, `hoverCard` | `value` is the width's scale. `widths` is `{ scale, dot, label }[]` (Fine, Regular, Bold, Heavy). |
| `PencilActions` | `onUndo`, `onRedo`, `onClear`, `canUndo`, `canRedo`, `canClear` (default `canUndo`) | A `ToolbarGroup` named "History". Undo, Redo and Clear stay reachable while they can't run, with `aria-disabled`. |

To preview a brush before it is picked, give `PencilToolPicker` or `PencilWidthPicker` a `hoverCard` controller (`createHoverCardController<PencilTool>()` / `<number>()`) and render one `<HoverCard controller={…}>` for it: every button becomes a trigger handing the card its tool or width scale as the payload, with the hover card's own delays, safe path into the card and Escape. The sketch pad block does this.

## History

`usePencilHistory(initial?)` keeps snapshots: every change (a stroke drawn, strokes erased, a clear) is one step, so Undo always reverses the last thing that happened, an erase included. Wire `strokes` and `onStrokesChange` to the canvas and the rest to `PencilActions`.

| Returns | |
| --- | --- |
| `strokes`, `onStrokesChange` | For `PencilCanvas`. |
| `undo`, `redo`, `clear` | `clear` is undoable. |
| `canUndo`, `canRedo`, `canClear` | For `PencilActions`. |

## Examples

### Signature pad

A bare `PencilCanvas` with controlled strokes. The default ink follows the theme, so the signature flips with light and dark.

{% demo src="pencilkit/signature-pad" %}

### Annotate a screenshot

The canvas is transparent, so it can sit over any content. This toolbar keeps only the marker, pen and eraser, three highlighter inks of its own, and undo/redo from `usePencilHistory`.

{% demo src="pencilkit/annotate-screenshot" %}

### The image annotator

`PencilKitAnnotator` is the default drawing engine of the image annotator that Composer opens on a pasted image: this canvas and toolbar over it, and Save flattens the strokes into the image. See [Composer](https://blamy.github.io/ui/#/composer).

### Save sketches

Strokes are plain data. `StrokePath` renders one anywhere (`<StrokePath stroke={s} />` inside an `<svg>` in the strokes' coordinates), here as thumbnails fitted to each sketch's bounding box.

{% demo src="pencilkit/sketch-gallery" %}

i/#/composer).

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
| `false` (default) | `bg-transparent text-muted-foreground data-pressed:bg-primary data-pressed:text-primary-foreground` |
