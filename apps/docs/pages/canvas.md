# Canvas

An infinite, pannable, zoomable surface, built on UI SDK's `createViewport`. `Canvas` owns navigation: scroll pans, pinch or ⌘-scroll zooms, holding Space (or the middle button) drags the view, + / − / 0 and ⌘ + / − / 0 / 1 zoom in, out, fit and 100%, arrow keys you don't use pan, focus brings a board item into view, find in page pans to its match, and a dotted or ruled background follows the view. Everything else is yours. The canvas hands you the pointer with its position already in board coordinates, so selecting, dragging, drawing and connecting can be one state machine that never thinks about the view. Use it for whiteboards, diagrams and storyboards; [Freeform](https://blamy.github.io/ui/#/blocks) is built on it. For freehand ink use [PencilCanvas](https://blamy.github.io/ui/#/pencilkit): on its own it is a drawing surface, and inside a `Canvas` it becomes the board's drawing layer. For boxes joined by edges (flowcharts, state machines, architecture maps) use [Diagram](https://blamy.github.io/ui/#/diagram), which is drawn on a Canvas. To show one image or document that zooms, a plain scroll view is enough.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/canvas.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Canvas, CanvasFrame, useCanvas } from '@/components/ui/canvas'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Canvas, CanvasFrame, useCanvas } from '@brett_lamy/ui/canvas'
```
{% endtab %}
{% endtabs %}

## The idea

The view is UI SDK's `Viewport`, `{ x, y, zoom }`: a board point is on screen at `board * zoom + (x, y)`. Children of `Canvas` live in the **board layer**, one element moved and scaled by the view, so you position them in board units (px at 100% zoom). The `overlay` prop draws in screen space on top (an empty state, a minimap). `Canvas` fills its positioned parent (`absolute inset-0`), like a map or a video: give it a `relative` box with a height.

```tsx
const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })

<div className="relative h-[420px]">
<Canvas
  viewport={viewport}
  onViewportChange={(next, details) => setViewport(next)}
  onCanvasPointerDown={(e, { board }) => startDrag(board)}
  onCanvasPointerMove={(e, { board }) => drag(board)}
  onCanvasPointerUp={endDrag}
>
  {cards.map((c) => <Card key={c.id} style={{ left: c.x, top: c.y }} />)}
</Canvas>
</div>
```

Control the view with `viewport` and `onViewportChange`, or leave it to the canvas with `defaultViewport`. `onViewportChange(viewport, details)` says why it moved in `details.reason`: `wheel`, `drag`, `pinch`, `zoom-key`, `move-key` (an arrow key), `focus-in`, `find-in-page`, `track-press` (a press on the minimap) or `imperative` (a controller); `details.cancel()` keeps the view where it is.

### Moving the view from outside

Zoom buttons, a "Zoom to Fit" menu item or a search that jumps to a result live outside the canvas. Give it a controller and call its methods; they go through `onViewportChange` like a gesture, with the reason `imperative` unless you pass one:

```tsx
const [canvas] = useState(() => createCanvasController())

<Button onClick={() => canvas.zoomBy(1.25)}>Zoom In</Button>
<Button onClick={() => canvas.fit(unionRect(cards))}>Zoom to Fit</Button>
<Canvas controller={canvas} viewport={viewport} onViewportChange={setViewport}>…</Canvas>
```

| Method | Does |
| --- | --- |
| `fit(rect?, { padding, maxZoom = 1 }?, options?)` | Shows a board rect whole and centered (default the `fit` prop); `null` centers the origin at 100%. `padding` defaults to the `fitPadding` prop, else 72. |
| `zoomBy(factor, at?, options?)` / `zoomTo(zoom, at?, options?)` | Zooms about a client point (default the canvas's center). |
| `panBy(dx, dy, options?)` | Pans by screen pixels. |
| `reveal(rect, { padding = 24 }?, options?)` | Pans the least that brings a board rect into view. |
| `setViewport(viewport, options?)` / `getViewport()` | Sets or reads the view. |
| `toCanvas(clientX, clientY)` / `toScreen(point)` / `visible()` | A client point in board units, a board point on screen, the board rect in view. |

`options` is `{ reason, event }`, passed on to `onViewportChange`. Inside the canvas, `useCanvas()` has the same methods.

{% demo src="canvas/cards" %}

## What the canvas takes, and what it gives you

The canvas handles these itself and does not pass them on:

| Input | Does | `details.reason` |
| --- | --- | --- |
| Scroll, two-finger drag | Pans. | `wheel` |
| ⌘/Ctrl-scroll, trackpad pinch | Zooms about the pointer. | `wheel` |
| Two-finger pinch on touch | Zooms and pans together. | `pinch` |
| Space held, middle button, or `panning` | Drags the view (the cursor becomes a hand). | `drag` |
| + / − (or ⌘ + / ⌘ −) | Zooms about the center, and says the new zoom to screen readers (`message` words it). | `zoom-key` |
| 0 | Back to 100%. | `zoom-key` |
| ⌘ 0 | Fits the view to the `fit` rectangle you pass (the bounds of your content). | `zoom-key` |
| ⌘ 1 | Back to 100%. | `zoom-key` |
| Arrow keys you leave alone (Shift: four times as far) | Pans. | `move-key` |
| Focus moving to an element on the board | Brings it into view. | `focus-in` |
| Find in page (⌘F) matching text on the board | Pans to the match. | `find-in-page` |

**What find in page finds.** The board sits in a pane (`canvas-pane`) that the canvas keeps scrolled to a resting place and turns every scroll of into a pan (UI SDK's `bindFindable`). The pane's overflow is `hidden`: a scroller nobody scrolls by hand (the canvas pans on the wheel and the keys instead), which keeps an accessibility checker from asking for a tab stop inside it, and which focus, find in page and a link to an id still scroll, as a `hidden` box is a scroll container that can be scrolled programmatically (`clip` can't, and find skips it). Checked in Chromium with the find bar's own machinery, a text fragment link (`#:~:text=`): a chip off the bottom of the board pans into view, with the pane `hidden` as with `scroll`, and doesn't with `clip`. What's found is text that's in the page: everything on a board you draw yourself; on a [Diagram](https://blamy.github.io/ui/#/diagram) above 200 nodes and edges, only what's near the view (it draws the rest as you get to it, so a match far away isn't there to be found until the view is near it); and nothing drawn while zoomed so far out that words aren't drawn.

Keys typed into a field or an editable element on the board stay with it. Everything else reaches you: `onCanvasPointerDown`, `onCanvasPointerMove` (including hover, with no button down), `onCanvasPointerUp`, `onCanvasDoubleClick` and `onCanvasKeyDown`, each with the DOM event. Each pointer callback also gets `{ screen, board, viewport }`: the pointer in the canvas's own pixels, in board units, and the view it was computed with. An arrow key you handle (`preventDefault()`) doesn't pan, so arrows can nudge a selection and pan when nothing is selected. `onNavigationStart` fires when a second finger turns a press into a pinch, so you can drop a gesture of your own that was in progress.

The canvas is a focusable `role="application"` region (`aria-roledescription="canvas"`): give it an `aria-label`, and set `autoFocus` so keys work before the first click. Keyboard focus draws a ring inside its edge, above the board.

### Pointer layers

A child can take presses before your handlers: `useCanvas().addPointerLayer({ onPointerDown, onPointerMove, onPointerUp, onCancel })` returns its cleanup. `onPointerDown(event, info)` returns `true` to take the press; that pointer's moves and release then go to the layer instead of `onCanvasPointerMove` / `onCanvasPointerUp`, and `onCancel` runs if a second finger turns it into a pinch. Navigation presses (Space, the middle button, `panning`) never reach a layer. `PencilCanvas` is the layer you will usually want. A press that does not start a pan has the pointer captured on the canvas already. Zoom is clamped to `minZoom`–`maxZoom` (0.02–4 by default: far enough out for a map of a hundred screens).

## Overlay parts

A selection outline that is 1px at 100% zoom is 0.1px at 10%. These parts divide by the zoom, so their lines keep the same thickness on screen. Put them in the board layer (as children of `Canvas`).

| Part | Draws |
| --- | --- |
| `CanvasFrame` | An outline around a (rotated) frame; `variant="dashed"` for a locked item (or `default`, solid), `offset` for the air around it. |
| `CanvasHandles` | Resize and rotate handles. |
| `CanvasMarquee` | The rubber band of a drag-select. |
| `CanvasGuides` | Alignment guides from `snapMove`. |

Each takes `className` and `style`, merged after its own, so a locked item's handles or a connector's ends can take another color (`className="border-warning"`); `data-handle` names each handle.

### MiniMap

`CanvasMiniMap` goes in `overlay` instead: the whole board in a corner, every item a mark and the view an outline. Press or drag on it to move the view there (the map holds its scale while you drag, so it doesn't rescale under the pointer), and press Escape during a drag to put the view back. Pass the items' rects in board units; a `className` per item fills its mark (`fill-primary` for the selection). `side` (`top` or `bottom`, default `bottom`) and `align` (`start` or `end`, default `end`, so the trailing corner in either text direction) place it, `width` and `height` size it (184 × 120).

```tsx
<Canvas overlay={<CanvasMiniMap items={cards.map((c) => ({ id: c.id, x: c.x, y: c.y, w: c.w, h: c.h }))} />}>…</Canvas>
```

`useCanvas()` returns the view, its zoom, the canvas size, the conversions (`toBoard(e)` and `local(e)` for a pointer event, `toLocal(p)` for a board point in the canvas's own pixels, its partner; and the controller's `toCanvas(clientX, clientY)` and `toScreen(p)`, which speak client pixels) and the controller's methods (`fit`, `zoomBy`, `panBy` …) to anything rendered inside.

## The math

The geometry is plain functions on plain data in `@/lib/canvas-math`, so it works with any item model. Panning, zooming and fitting are the canvas's (through the controller); the math is everything else. A **frame** is `{ x, y, w, h, rot }`, with `rot` in degrees about the center.

```ts
import { frameHandles, handleCursor, resizeFrame, rotateFrame, snapMove, inFrame, unionRect } from '@/lib/canvas-math'

const handles = frameHandles(frame, viewport.zoom)                  // eight resize handles and a rotate handle
const next = resizeFrame(frame, 'se', pointerDown, pointer, shift) // the opposite side stays put, whatever the rotation
const rot = rotateFrame(frame, pointer, !shift)                    // snaps to 15° steps and right angles
const { dx, dy, guides } = snapMove(movingBox, others, 6 / z)      // line up edges and centers with neighbours
inFrame(point, frame, 4 / z)                                       // hit test a rotated frame
```

| Function | Does |
| --- | --- |
| `toBoard(viewport, sx, sy)` / `toScreen(viewport, p)` | Convert between the canvas's own px and board units, for a view you hold (render-time math). |
| `cornersOf`, `rectOf`, `unionRect`, `intersects` | Bounds and overlap, with rotation applied. |
| `inFrame`, `distToSegment`, `distToPolyline` | Hit testing for boxes and thin things such as strokes and lines. |
| `frameHandles`, `handleCursor` | Handle positions, and which resize cursor fits a handle on a turned frame. |
| `resizeFrame`, `rotateFrame` | The frame after dragging a handle. |
| `snapMove` | Alignment snapping for a move, and the guide lines to draw. |

A frame never resizes below 24 (`MIN_SIZE`).

## API

### `<Canvas>`

| Prop | Default | Effect |
| --- | --- | --- |
| `viewport` / `defaultViewport` / `onViewportChange(viewport, details)` | origin at 100% | Controlled or uncontrolled view; `details` has `reason`, `source`, `event` and `cancel()`. |
| `controller` | — | From `createCanvasController()`: move the view from outside. |
| `background` | `dots` | `dots`, `grid` or `none`; the pattern follows the view. |
| `panning` | `false` | Drag the view with the primary button (a hand tool). |
| `fit` | — | The rectangle ⌘0 and `fit()` show (your content's bounds). |
| `fitPadding` | `72` | Screen pixels of air ⌘0 and `fit()` leave around that rectangle. |
| `minZoom` / `maxZoom` | 0.02 / 4 | How far out and in it zooms. |
| `message` | "Zoom 150%" | What a screen reader hears after a zoom key: `(zoom) => string`. |
| `autoFocus` | `false` | Focus the canvas on mount. |
| `zoomVariable` | `true` | Whether the board writes its zoom as `--canvas-zoom`, which the overlay parts divide by. A change to it restyles everything on the board, every frame of a zoom: a board of thousands of items turns it off and sets `--canvas-zoom` itself around the parts that use it, in steps (as `Diagram` does). |
| `overlay` | — | Drawn over the canvas in screen space. |
| `aria-label` | "Canvas" | The region's name. |
| `aria-describedby` | — | What the canvas's keys do, read after its name: a component that adds its own keys points it at their description (as `Diagram` does). |
| `className` / `style` | — | Merged onto the canvas element. The resting cursor is yours (`cursor-crosshair`, or `style={{ cursor }}` for one that changes); the open and closed hand win while the view is dragged. |
| `ref` | — | The canvas element. |
| a `div`'s other props | — | `id`, `data-*`, `title`, event handlers and the rest reach the canvas element. |

The canvas carries `data-slot="canvas"` (with `data-panning` while Space is held and `data-grabbing` while the view is dragged), the scrolling pane find in page uses `canvas-pane`, the board layer `data-slot="canvas-board"` (with the zoom as `--canvas-zoom`, unless `zoomVariable` is off), and the overlay parts `canvas-frame`, `canvas-handle`, `canvas-marquee`, `canvas-guide` and `canvas-minimap` (its view outline `canvas-minimap-view`).

## Accessibility and motion

A canvas is a pointer-first surface, so give people another way to do what they can do on it: keyboard commands through `onCanvasKeyDown` (arrow keys to nudge, Delete to remove, as Freeform does), and a real list or inspector for the same content. The view itself has a keyboard path (+ − 0, ⌘0, arrows), says each zoom aloud, and follows focus, so Tab through focusable items on the board brings each into view. Panning and zooming are direct manipulation and do not animate, so there is no reduced-motion variant to turn off.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `canvasFrameVariants`

Defined in `@/components/ui/canvas`. Base classes:

```text
pointer-events-none absolute rounded-(--canvas-frame-radius) outline-(length:--canvas-frame-line) outline-offset-(--canvas-frame-offset) outline-primary
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `outline-solid` |
| `dashed` | `outline-dashed` |
