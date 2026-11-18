# Dragging and resizing

UI SDK's direct-manipulation behaviors handle the pointer work for things you grab and move: `createMove` places objects anywhere on a surface, `createResize` drags the edges and corners of a box, and `createSwipeActions` slides a row aside to reveal actions. `bindHold` acts once a press has lasted, and `bindRepeat` keeps stepping while a button is held. For values rather than objects there are `createArea` (a point on a 2D pad), `createSpans` (ranges on tracks, like bookings) and `createPreview` (try a choice before committing it). Every one of them has a keyboard route and announces its result. They are listed with the other behaviors in the [behaviors overview](https://blamy.github.io/ui/#/behaviors); the upstream reference is [Dragging and Resizing](https://ui-sdk.dev/docs/core/behaviors/direct-manipulation).

Nothing to install: they come from UI SDK's core, which ships inside the package as `@brett_lamy/ui/sdk/core`. Sorting and moving items between lists is [Drag and drop](https://blamy.github.io/ui/#/behaviors-drag-drop). The kit's own `bindEdgeSwipe` (swipe in from an edge to go back) and `bindPullToRefresh`, from `@/lib/edge-swipe` and `@/lib/pull-to-refresh`, are on [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit).

```ts
import {
  createMove, createResize, createSwipeActions, bindHold, bindRepeat,
  createArea, createSpans, createPreview, createChange, live, css,
} from '@brett_lamy/ui/sdk/core'
```

## Already done for you

| Need | Use |
| --- | --- |
| Resizable panes | UI SDK's Resizable, as in [`Workspace`](https://blamy.github.io/ui/#/workspace). |
| Resizable table columns | [`DataTable`](https://blamy.github.io/ui/#/data-table) (and so [`RequestTable`](https://blamy.github.io/ui/#/request-table)): `createResize` on the header's column handles, through `createColumnResize` in `lib/grid-behaviors.ts`. |
| A slider, a 2D color pad | [`Slider`](https://blamy.github.io/ui/#/slider) and [`ColorPicker`](https://blamy.github.io/ui/#/color-picker), on UI SDK's own parts. |

Each behavior keeps a **draft** while the pointer moves and commits once, on release, through the `set` you connect to `createChange`, so `on…Change(value, details)` fires once with `details.reason` (`drag` for the pointer, `move-key` or `resize-key` for the keyboard, `imperative` from code). Put the draft key in the primitive's `live` list: the behavior's live binding then writes the offset (`translate`, CSS variables) without a React render per pointer move.

## Moving objects

Keep positions in a `Record<string, MovePoint>` and a `MoveDraft | null` beside it:

```ts
const move = createMove(context, {
  key: 'positions',
  draft: 'moving',
  set: (value, details) => change('positions', value, details),
  step: () => 8,                                            // the grid a drop snaps to, and Alt+arrow's distance
  bounds: () => ({ minX: 0, minY: 0, maxX: 256, maxY: 128 }), // clamps committed positions
})
```

The slot sets the committed `left` and `top` (runtime values, so `style` is right here), and a live binding adds the drag: `live((state, { api, key }) => ({ 'data-dragging': api.move.dragging(state, key) ? '' : undefined, style: api.move.style(state, key) }))`. Call `move.keydown(event, key)` before roving focus, so plain arrows still move focus, and `move.pointerdown(event, key, el)` on a press.

{% demo src="behaviors-dragging/move" %}

Verified in happy-dom with the example above (UI SDK strict mode on):

- **Alt+ArrowRight** moves Ideas one step, from 16,16 to 24,16 (`reason: 'move-key'`). **Alt+Shift+ArrowDown** moves it ten steps (80 px).
- **Bounds.** Alt+ArrowLeft three times from x 24 stops at 0.

From the types and upstream: `group(key)` moves a selection together; `scale()` divides pointer distance on a zoomed canvas; `disabled(key)` pins an item; `moveTo(key, point)` and `moveBy(keys, dx, dy)` move from code (they apply `bounds` but not the grid). Escape during a drag puts the item back. A pointer drag's preview may leave `bounds` before release; the committed position never does.

## Resizing boxes

A box is `{ x, y, width, height }`. `createResize(context, { boxes, draft, set, min, max, bounds, step, aspect })` takes the handle by compass name (`n`, `e`, `s`, `w`, `ne`, `nw`, `se`, `sw`, and `move` for the whole box). Render each handle as a **named button**: `resize.handleAttrs(handle)` adds only the cursor and `touch-action`, not a label or focusability.

```ts
handle: slot<{ id: string; handle: ResizeHandle }>({
  props: { handle: 'string' },
  attrs: (_state, { props, api }) => ({ type: 'button', ...api.resize.handleAttrs(props.handle) }),
  on: {
    pointerdown: (event, { el, api, props }) => api.resize.pointerdown(event, 'frame', props.handle, el!),
    keydown: (event, { api, props }) => api.resize.keydown(event, 'frame', props.handle),
  },
}),
```

The box reads its committed size from `boxStyle(state, key)` and its live draft from `style(state, key)`.

{% demo src="behaviors-dragging/resize" %}

Verified in happy-dom:

- `handleAttrs('se')` writes `cursor: nwse-resize; touch-action: none` and `data-resize-handle="se"`.
- **ArrowRight** on "Resize bottom right" widens the box by one step (136 → 140, `reason: 'resize-key'`); **Shift+ArrowDown** adds ten steps (96 → 136).
- **An edge handle moves along its own axis only.** ArrowUp on "Resize left" changes nothing.
- **`min`.** Forty Shift+ArrowRight presses on "Resize left" stop at the minimum width, 64, with the left edge moved to x 168.

`aspect: () => 16 / 9` keeps a ratio (Shift during a corner drag keeps the starting ratio), `scale` and `disabled` work as for move, and `resizeTo(key, box)` / `resizeBy(key, handle, dx, dy)` change a box from code (`resizeBy` applies the limits, `resizeTo` does not). To show a live size label, read `resize.box(state, key)`, which returns the draft during a drag.

## Swipe actions

`createSwipeActions(context, { key: 'open', draft: 'swiping' })` keeps one row open at a time (`SwipeOpen | null`). Each row has content that moves and an action group behind it on its `start` or `end` side:

- Row: `bindRow(el, key)`, `pointerdown(event, key, el)`, `keydown(event, key)`; give it `relative overflow-hidden touch-pan-y`, so vertical scrolling still works.
- Content: a live binding of `contentAttrs(state, key)`, which writes `--swipe-x`, `data-swipe` and `data-swiping`. Style it with `translate-x-[var(--swipe-x,0px)]`, and turn transitions off while the pointer moves with `data-swiping:transition-none`.
- Actions: `actionsAttrs(state, row, side)` (makes hidden actions `inert`) and `bindActions(el, row, side)`. Their width comes from your layout.

{% demo src="behaviors-dragging/swipe-actions" %}

Verified in happy-dom (with the action group's width stubbed at 80 px, since happy-dom has no layout):

- The Delete action starts `inert`.
- **ArrowLeft** on a focused row opens its `end` actions (`data-open="end"` on the row), removes `inert` and moves focus to Delete.
- **Escape** closes the row and returns focus to it; ArrowDown then moves to the next row.

The pointer gesture itself (half the actions' width keeps them open, a flick counts) is from the upstream docs. `start` actions appear when swiping toward the end of the row, and the sides swap in right-to-left text. `onFullSwipe(key, side)` with `fullSwipe: () => 0.5` performs an action on a long swipe (the content gets `data-full` while release would trigger it); `show(key, side, { focus })` and `close({ focus })` open and close from code.

## Hold and repeat

`bindHold(el, { delay, onHold, onEnd })` and `bindRepeat(el, { delay, repeat, onStep })` bind straight to a button; no primitive is needed. Call them in an effect and return their cleanup. Both work with a mouse, a finger, a pen, and Space or Enter, and write `data-holding` while pressed and `data-held` once held.

- **`bindRepeat`** steps as a mouse or key goes down (a finger or pen steps on release or once held, so a scroll that starts on the button never steps), then again every `repeat` ms after `delay` (defaults 60 and 400). Return `false` from `onStep` to stop, as at a bound. There is no click handler: the click that follows the press does not step again.
- **`bindHold`** runs `onHold` once the press has lasted `delay` (default 500 ms) and writes `--hold-delay` on the button, so a fill can run for exactly that long (`group-data-holding:duration-(--hold-delay)`). A press is canceled by moving more than `tolerance` px, scrolling, Escape, or focus leaving; a canceled press doesn't click. Say that the button needs holding in its label or description.

{% demo src="behaviors-dragging/hold-repeat" %}

Verified in happy-dom:

- **A mouse press** on Zoom in steps at once (100 → 105%) and sets `data-holding`. **Held for 800 ms** it reaches 135%: six more steps after the 400 ms delay, at 80 ms each, with `data-held`. The click after release adds nothing.
- **A Space tap** steps once.
- **Reset zoom** writes `--hold-delay: 1200ms`. Released after 400 ms it does nothing; held for 1.3 s it resets to 100%.

## Values on a pad, ranges on tracks, previews

These three build controls rather than move objects. The kit's `Slider` and `ColorPicker` already cover the common cases; reach for these for a control of your own.

**`createArea`** maps a surface to two values, for a pad like a color's saturation and brightness. The surface starts tracking (`area.pointerdown(event, el)`), and the thumb is the one focusable slider (`area.thumbAttrs(state)`, `area.thumbStyle(state)`, `area.keydown(event)`). Unlike a move, it calls `set` throughout the gesture (`track-press`, `drag`, `step-key`) and `onCommit` once at the end. The y axis runs bottom to top; x follows the text direction.

```ts
const area = createArea(context, {
  value: (state) => ({ x: state.mix.warmth, y: state.mix.energy }),
  set: (value, details) => change('mix', { warmth: value.x, energy: value.y }, details),
  x: () => ({ min: 0, max: 100, step: 1, label: 'Warmth' }),
  y: () => ({ min: 0, max: 100, step: 1, label: 'Energy' }),
})
```

**`createSpans`** edits `{ id, track, start, end }` ranges on tracks: room bookings across a day, events down a week. Dragging an empty stretch draws a span (with `create`), dragging a span moves it, dragging an element marked `data-span-edge="start"` or `"end"` resizes it; `step` snaps, `overlap: false` refuses overlaps, and arrows, Shift+arrows and Delete edit the focused span. `update(id, patch)` and `remove(id)` change it from code.

**`createPreview`** lets someone try a value before choosing it, like pressing a font and sliding over the others. Keep a `preview: string | null` beside the chosen value and render `preview ?? value`; `show(key)`, `choose(key)` and `clear()` drive it, Enter and Space choose, Escape clears, and a pointer scrub across the options previews each one and chooses on release.
