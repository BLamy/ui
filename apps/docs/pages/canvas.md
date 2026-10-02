# Canvas

An infinite, pannable, zoomable surface. `Canvas` owns navigation: scroll pans, pinch or ⌘-scroll zooms, holding Space (or the middle button) drags the view, ⌘ + / − / 0 / 1 zoom in, out, fit and 100%, and a dotted or ruled background follows the camera. Everything else is yours. The canvas hands you the pointer with its position already in board coordinates, so selecting, dragging, drawing and connecting can be one state machine that never thinks about the camera. [Freeform](https://blamy.github.io/ui/#/blocks) is built on it.

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

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Canvas, CanvasFrame, useCanvas } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## The idea

A camera is `{ x, y, z }`: a screen point is `board * z + (x, y)`. Children of `Canvas` live in the **board layer**, a div translated and scaled by the camera, so you position them in board units (px at 100% zoom). The `overlay` prop draws in screen space on top (an empty state, a minimap).

```tsx
const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 })

<Canvas
  camera={camera}
  onCameraChange={setCamera}
  onCanvasPointerDown={(e, { board }) => startDrag(board)}
  onCanvasPointerMove={(e, { board }) => drag(board)}
  onCanvasPointerUp={endDrag}
>
  {cards.map((c) => <Card key={c.id} style={{ left: c.x, top: c.y }} />)}
</Canvas>
```

The camera is controlled with `camera` and `onCameraChange`, or left to the canvas with `defaultCamera`. The updater the canvas uses always sees the latest camera, so a pinch's pan and zoom in the same event compose.

{% demo src="canvas/cards" %}

## What the canvas takes, and what it gives you

The canvas handles these itself and does not pass them on:

| Input | Does |
| --- | --- |
| Scroll, two-finger drag | Pans. |
| ⌘/Ctrl-scroll, trackpad pinch | Zooms about the pointer. |
| Two-finger pinch on touch | Zooms and pans together. |
| Space held, middle button, or `panning` | Drags the view (the cursor becomes a hand). |
| ⌘ + / − | Zooms about the center. |
| ⌘ 0 | Fits the view to the `fit` rectangle you pass (the bounds of your content). |
| ⌘ 1 | Back to 100%. |

Everything else reaches you: `onCanvasPointerDown`, `onCanvasPointerMove` (including hover, with no button down), `onCanvasPointerUp`, `onCanvasDoubleClick` and `onCanvasKeyDown`. Each pointer callback gets the React event and `{ screen, board, camera }`: the pointer in the canvas's own pixels, in board units, and the camera it was computed with. `onNavigationStart` fires when a two-finger pinch begins, so you can drop a gesture of your own that was in progress.

The canvas is a focusable `role="application"` region: give it an `aria-label`, and set `autoFocus` so keys work before the first click. A press that does not start a pan has the pointer captured on the canvas already.

## Overlay parts

A selection outline that is 1px at 100% zoom is 0.1px at 10%. These parts divide by the zoom, so their lines keep the same thickness on screen. Put them in the board layer (as children of `Canvas`).

| Part | Draws |
| --- | --- |
| `CanvasFrame` | An outline around a (rotated) frame; `dashed` for a locked item, `offset` for the air around it. |
| `CanvasHandles` | Resize and rotate handles. |
| `CanvasMarquee` | The rubber band of a drag-select. |
| `CanvasGuides` | Alignment guides from `snapMove`. |

`useCanvas()` returns the zoom, the canvas size and the conversions (`toBoard(e)`, `toScreen(p)`, `local(e)`) to anything rendered inside, and `update(fn)` to move the camera yourself.

## The math

The geometry is plain functions on plain data in `@/lib/canvas-math`, so it works with any item model. A **frame** is `{ x, y, w, h, rot }`, with `rot` in degrees about the center.

```ts
import { frameHandles, handleCursor, resizeFrame, rotateFrame, snapMove, inFrame, fitCamera, unionRect } from '@/lib/canvas-math'

const handles = frameHandles(frame, camera.z)                    // eight resize handles and a rotate handle
const next = resizeFrame(frame, 'se', pointerDown, pointer, shift) // the opposite side stays put, whatever the rotation
const rot = rotateFrame(frame, pointer, !shift)                    // snaps to 15° steps and right angles
const { dx, dy, guides } = snapMove(movingBox, others, 6 / z)      // line up edges and centers with neighbours
inFrame(point, frame, 4 / z)                                       // hit test a rotated frame
```

| Function | Does |
| --- | --- |
| `toBoard(camera, sx, sy)` / `toScreen(camera, p)` | Convert between screen px and board units. |
| `zoomAt(camera, factor, sx, sy)` | Zoom keeping the board point under the screen point where it is. |
| `fitCamera(rect, size, pad?)` | A camera showing `rect` centered, zoomed in no further than 100%. |
| `cornersOf`, `rectOf`, `unionRect`, `intersects` | Bounds and overlap, with rotation applied. |
| `inFrame`, `distToSegment`, `distToPolyline` | Hit testing for boxes and thin things such as strokes and lines. |
| `frameHandles`, `handleCursor` | Handle positions, and which resize cursor fits a handle on a turned frame. |
| `resizeFrame`, `rotateFrame` | The frame after dragging a handle. |
| `snapMove` | Alignment snapping for a move, and the guide lines to draw. |

Zoom is clamped to 0.1–4 (`MIN_ZOOM`, `MAX_ZOOM`) and a frame never resizes below 24 (`MIN_SIZE`).

## API

### `<Canvas>`

| Prop | Default | Effect |
| --- | --- | --- |
| `camera` / `defaultCamera` / `onCameraChange` | origin at 100% | Controlled or uncontrolled camera. |
| `background` | `dots` | `dots`, `grid` or `none`; the pattern follows the camera. |
| `panning` | `false` | Drag the view with the primary button (a hand tool). |
| `fit` | — | The rectangle ⌘0 fits to (your content's bounds). |
| `cursor` | `default` | The cursor when not dragging the view. |
| `autoFocus` | `false` | Focus the canvas on mount. |
| `overlay` | — | Drawn over the canvas in screen space. |
| `aria-label` | "Canvas" | The region's name. |
| `className` / `style` | — | Merged onto the canvas element. |

The canvas carries `data-slot="canvas"`, the board layer `data-slot="canvas-board"`, and the overlay parts `canvas-frame`, `canvas-handle`, `canvas-marquee` and `canvas-guide`.

## Accessibility and motion

A canvas is a pointer-first surface, so give people another way to do what they can do on it: keyboard commands through `onCanvasKeyDown` (arrow keys to nudge, Delete to remove, as Freeform does), and a real list or inspector for the same content. Panning and zooming are direct manipulation and do not animate, so there is no reduced-motion variant to turn off.
