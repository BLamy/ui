# PencilKit

Freehand drawing in the manner of Apple's PencilKit: a surface that turns pointer samples into pressure-shaped ink, the tool palette that goes with it, an undo history, and an image annotator built from the three. Use it for sketches, signatures and marking up screenshots. The ink comes from **[perfect-freehand](https://github.com/steveruizok/perfect-freehand)** by Steve Ruiz, the pressure-to-outline engine behind tldraw.

| You need | Use |
| --- | --- |
| A drawing pad, a signature, ink over any content | `PencilCanvas` + `PencilToolbar` + `usePencilHistory` (this page) |
| Ink on a board of movable items (stickies, shapes, connectors) | a [Canvas](https://blamy.github.io/ui/#/canvas) with a `PencilCanvas` inside: it becomes the board's drawing layer |
| Mark up an image and get a PNG back | `ImageAnnotator` (below; [Composer](https://blamy.github.io/ui/#/composer) opens one on a pasted image) |
| A row of tool buttons that has nothing to do with drawing | the kit's [Toolbar](https://blamy.github.io/ui/#/toolbar) |

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/pencilkit.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  PencilCanvas, PencilToolbar, usePencilHistory,
} from '@/components/ui/pencilkit'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  PencilCanvas, PencilToolbar, usePencilHistory,
} from '@brett_lamy/ui/pencilkit'
```
{% endtab %}
{% endtabs %}

{% demo src="pencilkit/sketch-demo" %}

```tsx
const history = usePencilHistory()
const [tool, setTool] = useState<PencilTool>('pen')
const [ink, setInk] = useState('#0A84FF')

<div className="relative h-96">
  <PencilCanvas tool={tool} ink={ink} strokes={history.strokes} onStrokesChange={history.onStrokesChange} />
  <PencilToolbar
    className="absolute inset-x-3 bottom-3 mx-auto"
    trailing={
      <>
        <ToolbarSeparator />
        <PencilActions onUndo={history.undo} onRedo={history.redo} onClear={history.clear}
          canUndo={history.canUndo} canRedo={history.canRedo} canClear={history.canClear} />
      </>
    }
  >
    <PencilToolPicker value={tool} onValueChange={setTool} />
    <ToolbarSeparator />
    <PencilInkPicker value={ink} onValueChange={setInk} />
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
| `widthScale` | `1` | Multiplies the tool's nib, so it is a scale, not px (`0.6`, `1`, `1.7`, `2.6` are the palette's widths: what `PencilWidthPicker` picks). |
| `strokes` / `defaultStrokes` | — | The strokes, controlled or not. A stroke is `{ tool, ink, widthScale, pressure, points, complete }`: the same `ink` and `widthScale` the canvas took when it was drawn (its drawn width is `pencilTools[tool].options.size * widthScale`). |
| `onStrokesChange` | — | `(strokes, details)`, with `details.reason` `draw` or `erase`. |
| `emptyState` | — | Shown centered while there are no strokes (`data-empty` is on the root then). |
| `variant` | `"freehand"` | `plain` draws the raw polylines instead of the pressure outlines. |
| `disabled` | `false` | Takes no presses: a read-only drawing. |
| `aria-label` | `"Drawing"` | The drawing's name. |
| `ref`, `className`, `style`, a div's props | — | On the root `div`. |

### On a Canvas

Inside a [Canvas](https://blamy.github.io/ui/#/canvas), `PencilCanvas` is the board's drawing layer. It draws in board units under the canvas's pan and zoom, takes presses before the canvas's own `onCanvasPointerDown` (through `useCanvas().addPointerLayer`), and leaves Space-drag, the middle button, pinch and the wheel to the canvas. `disabled` hands the presses back, for when another tool is in hand. There it renders only its `svg` (a board item has no box): `ref`, `className`, `style`, `id`, `aria-*` and `data-*` reach the svg, and `children` and `emptyState` don't apply.

```tsx
<Canvas className="cursor-crosshair">
  {items.map((it) => <Card key={it.id} … />)}
  <PencilCanvas disabled={tool !== 'draw'} tool={pen} ink={ink} strokes={strokes} onStrokesChange={setStrokes} />
</Canvas>
```

A board that keeps strokes in its own model, to stack them with its other items, passes `strokes={[]}` and adds the drawn stroke from `onStrokesChange` (`next.at(-1)`). The [Freeform block](https://blamy.github.io/ui/#/blocks) does this.

## The toolbar

`PencilToolbar` is the kit's [Toolbar](https://blamy.github.io/ui/#/toolbar) (`variant="floating"` by default, named "Drawing tools"): Tab enters it once, and Left and Right move across the pickers (toggle groups join the toolbar's navigation) into `PencilActions`. Separate groups with the kit's `ToolbarSeparator`. It sits in the flow, so place it yourself (`absolute inset-x-3 bottom-3 mx-auto` over a canvas).

**On a phone.** When its groups don't fit the room it has (a phone, a narrow pane, the annotator's footer), the toolbar folds the ink and width pickers into one round button showing the current ink, named "Ink and width: Blue". It opens both rows in a popover above the bar; the popover stays open while you pick (the button follows at once), and an outside press or Escape closes it. Every tool and the toolbar's `trailing` content (undo, redo, clear) stay in view. It measures its own fit, never the viewport, and unfolds once its box is wide enough again. Anything that still doesn't fit scrolls sideways under an edge fade.

| Part | Props | Notes |
| --- | --- | --- |
| `PencilToolbar` | Toolbar's (`variant`, `size`, `aria-label`, `orientation`…), `trailing` | `children` are the tools, which scroll when they don't fit; `trailing` (undo, redo, clear, usually after a `ToolbarSeparator`) stays in view at the end. `variant="plain"` drops the card, for a bar inside another surface. `data-compact` is on it while it is folded. |
| `PencilToolPicker` | `value`, `defaultValue` (`"pen"`), `onValueChange(tool, details)`, `tools`, `hoverCard` | Each tool is named (Pen, Marker, Pencil, Eraser) and shows its name in a tooltip. |
| `PencilInkPicker` | `value`, `defaultValue` (the first ink), `onValueChange(ink, details)`, `inks`, `presentation` | `value` is the ink's color. `inks` is `{ value, label }[]`; the default six are Black and White (both follow the theme), Blue, Green, Yellow and Pink. |
| `PencilWidthPicker` | `value`, `defaultValue` (`1`), `onValueChange(scale, details)`, `widths`, `hoverCard`, `presentation` | `value` is the width's scale. `widths` is `{ scale, dot, label }[]` (Fine, Regular, Bold, Heavy). |
| `PencilActions` | `onUndo`, `onRedo`, `onClear`, `canUndo`, `canRedo`, `canClear` (default `canUndo`) | A `ToolbarGroup` named "History". Undo, Redo and Clear stay reachable while they can't run, with `aria-disabled`. |

`presentation` on the ink and width pickers is `auto` (fold when the toolbar runs out of room), `inline` (always the row) or `popover` (always one button that opens the row, named "Ink: Blue" or "Width: Bold"). Inside the popover each row is a small toolbar of its own: the arrow keys move across its swatches and stay there.

To preview a brush before it is picked, give `PencilToolPicker` or `PencilWidthPicker` a `hoverCard` controller (`createHoverCardController<PencilTool>()` / `<number>()`) and render one `<HoverCard controller={…}>` for it: every button becomes a trigger handing the card its tool or width scale as the payload, with the hover card's own delays, safe path into the card and Escape. The sketch pad block does this.

## History

`usePencilHistory(initial?)` keeps snapshots: every change (a stroke drawn, strokes erased, a clear) is one step, so Undo always reverses the last thing that happened, an erase included. Wire `strokes` and `onStrokesChange` to the canvas and the rest to `PencilActions`.

| Returns | |
| --- | --- |
| `strokes`, `onStrokesChange` | For `PencilCanvas`. |
| `undo`, `redo`, `clear` | `clear` is undoable. |
| `canUndo`, `canRedo`, `canClear` | For `PencilActions`. |

## The image annotator

`ImageAnnotator` is a lightbox (UI SDK's Dialog) that draws on an image and saves it flattened into one PNG. It opens with the image flying out of the thumbnail it was pressed on (`origin`) and closes back into it; the tools sit under the image so they never cover it. By default the drawing comes from `PencilKitAnnotator`: a `PencilCanvas` over the image and a plain `PencilToolbar` under it, with literal black and white inks (the paper is the user's image, not the theme's background, so "Black" always draws black). The [Composer](https://blamy.github.io/ui/#/composer) opens one when an image attachment is pressed (its `annotator` prop picks the engine).

{% demo src="pencilkit/image-annotator" %}

```tsx
<ImageAnnotator src={png} open={open} onOpenChange={setOpen} origin={() => thumb.current} onSave={(url) => setPng(url)} />
```

| Prop | Default | Effect |
| --- | --- | --- |
| `src` | required | The image, a URL or a data URL. |
| `alt` | — | What the image shows (a file name, a caption): the image's alt text and the lightbox's name, "Annotate: {alt}". Without it the image is presentational and the lightbox is "Annotate image". The Composer passes the attachment's file name. |
| `open` / `defaultOpen` / `onOpenChange(open, details)` / `onOpenChangeComplete(open)` | — | UI SDK's open state. Cancel closes with reason `close-press` and `returnValue` `"cancel"`; Escape and an outside press with theirs. |
| `onSave(dataUrl, details)` | — | Save pressed: the image with the strokes flattened, at the image's own resolution. The lightbox then closes with reason `action` and `returnValue` `"save"`. |
| `engine` | the nearest `ImageAnnotatorProvider`'s, else `PencilKitAnnotator` | The drawing engine. `null` makes the lightbox a plain preview (the image and Close). |
| `appearance` | `"auto"` | The appearance the drawing surface wears: the image's. `auto` measures the image (a light screenshot is `light`; an image the page can't read, cross-origin without CORS, counts as light). The lightbox itself is always dark. |
| `origin` | — | `() => HTMLElement \| null`: the element the image flies out of on open and back into on close. Without it the image scales in. |

**Engines.** An engine is a component that calls its `children({ canvas, toolbar?, title? })` and returns the result: `canvas` is stretched over the image, `toolbar` goes in a bar under it, `title` heads the lightbox (default "Markup"). On save, the first `<svg>` of `canvas` is flattened into the image, with any theme-following color (`var(--foreground)`) baked in as the image's appearance draws it. `<ImageAnnotatorProvider engine={…}>` swaps the engine for a subtree (every Composer inside included); `engine={null}` there turns annotation off. A fixed surface is a one-line engine:

```tsx
const Circled: ImageAnnotatorEngine = ({ children }) =>
  children({ canvas: <svg className="absolute inset-0 size-full">…</svg> })

<ImageAnnotator src={png} engine={Circled} onSave={save} />
```

| Export | What it is |
| --- | --- |
| `ImageAnnotator` | The lightbox. |
| `ImageAnnotatorProvider` | `engine` for every annotator and Composer below it. |
| `PencilKitAnnotator` | The default engine, on this page's parts. |
| `ImageAnnotatorEngine`, `ImageAnnotatorEngineProps`, `ImageAnnotatorSurface` | The engine contract's types. |

## Examples

### Signature pad

A bare `PencilCanvas` with controlled strokes. The default ink follows the theme, so the signature flips with light and dark.

{% demo src="pencilkit/signature-pad" %}

### Annotate a screenshot

The canvas is transparent, so it can sit over any content. This toolbar keeps only the marker, pen and eraser, three highlighter inks of its own, and undo/redo from `usePencilHistory`.

{% demo src="pencilkit/annotate-screenshot" %}

### Save sketches

Strokes are plain data. `StrokePath` renders one anywhere (`<StrokePath stroke={s} />` inside an `<svg>` in the strokes' coordinates), here as thumbnails fitted to each sketch's bounding box.

{% demo src="pencilkit/sketch-gallery" %}
