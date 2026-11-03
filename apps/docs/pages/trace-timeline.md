# Trace Timeline

A long session on one clock, for a time-travel debugger or anything else that records up to an hour of what happened. `orientation="horizontal"` is a strip: a ruler over rows of diamonds, density with marks over it, thread activity and requests, on several lanes with a shared clock. `orientation="vertical"` is the same timeline as a rail for narrow windows: a thin overlay on the window's edge, in the style of [IndexBar](https://blamy.github.io/ui/#/index-bar)'s wave, with each lane a column and landmarks as dashes that swell around the pointer. It takes plain data and knows nothing about what made it. Where [VideoTimeline](https://blamy.github.io/ui/#/video-timeline) edits clips on DOM lanes, this draws hundreds of thousands of marks on a canvas, at most one thing per device pixel.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/trace-timeline.json https://blamy.github.io/ui/r/trace-timeline-model.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { TraceTimeline } from '@/components/ui/trace-timeline'
import { linearAxis, stopAxis } from '@/lib/trace-timeline'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { TraceTimeline, linearAxis, stopAxis } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Give it a `range`, some `lanes` and the playhead. Times are numbers on one clock, in milliseconds as far as the ruler and the default formatting go. Everything a lane holds is sorted arrays, typed arrays for preference, and a lane's `offset` puts its own times on the shared clock.

```tsx
const lanes = [{
  key: 'browser',
  title: 'Browser',
  offset: 0,
  diamonds: { label: 'checkpts', times: checkpointTimes },
  density: { label: 'JS', times: stepTimes, depths: stepDepths },
  marks: [
    { key: 'breakpoints', times: hitTimes, shape: 'bar', tone: 'warning' },
    { key: 'console', times: messageTimes, shape: 'dot', tone: 'info' },
  ],
  threads: [{ id: 1, label: 'T1' }],
}]

<TraceTimeline
  range={{ start: 0, end: 3_600_000 }}
  lanes={lanes}
  stops={stops}
  value={time}
  onValueChange={(t, { phase, stop }) => setTime(t)}
/>
```

{% demo src="trace-timeline/one-lane" %}

`onValueChange(time, { phase, stop })` says `start` on a press, `move` at most once a frame while dragging, and `end` on release; a key press is one `end`. `stop` is the stop the value snapped to, or `null`. Hold `value` yourself or leave it to `defaultValue`.

## A strip and a rail

They are one component with one model, so a host swaps `orientation` when its width crosses a threshold and the playhead, the zoom and everything else stay where they are. Hold `view` as well if the timeline moves in your tree when it swaps. Drag this frame's handle narrower than 600 px, or pick the phone viewport.

{% demo src="trace-timeline/session" %}

```tsx
const [view, setView] = useState(range)

<TraceTimeline
  range={range} lanes={lanes} stops={stops} value={time} onValueChange={setTime}
  view={view} onViewChange={setView}
  orientation={width < 600 ? 'vertical' : 'horizontal'}
  side="right" top={8} bottom={8}
/>
```

The strip fills the width of its parent and is as tall as its rows want, unless you give it a height: thread rows share what's there, from 4 to 14 px each. The rail is positioned like IndexBar: absolute on an edge of the nearest positioned ancestor, with `side`, `top` and `bottom`, so put it next to your scroller and not inside it. A right-hand rail publishes how far list rows run under it as `--bl-index-bar-inset` on its parent, with the same meaning as IndexBar's, so `ListRow`s keep their accessories clear of it (`insetContent={false}` opts out).

| On a strip | On a rail |
| --- | --- |
| A row per thing, with labels in a gutter | Each lane a thin column, tinted if it's in focus, with no labels |
| Density, with a deeper stack reaching further down the row, and marks over it | Density as opacity alone, and `bar` marks; `dot` marks are left to the stops |
| `diamonds`, thread rows, requests | Not shown; hover or press to see the time, and put what matters in `stops` |
| `stops` as a row of ticks | `stops` as dashes that swell around the pointer, with a card beside it |
| A hover line with its time in the ruler | A hover line, and the card |
| A playhead with a head | A line across the rail and a small time pill on the inner side |

## Lanes

| Field | What it draws |
| --- | --- |
| `key`, `title` | Its name, and a title row when there are several lanes. |
| `offset` | Added to the lane's own times to put them on the shared clock. |
| `color` | Any CSS colour for its density. Default: a chart token by position (a tint or gray on a rail). |
| `diamonds` | `{ label, times, color }`: a row of diamonds, each with a faint guide down to the end of the lane. |
| `density` | `{ label, times, depths, color }`: per pixel, how many (opacity) and how deep the deepest was (reach). `depths` run parallel to `times`, which have to be sorted. |
| `marks` | `[{ key, times, shape, tone, color }]`: over the density row. A `bar` runs its full height and a `dot` sits along its far edge. Unsorted `times` are sorted once and remembered. |
| `threads` | `[{ id, label, color }]`: a row of activity each, from `fetchActivity`. |

Requests are for the whole timeline, on the shared clock: `requests={[{ id, time, from, to, color, tone }]}` draws a dot at `time`, a band over `from`…`to` (a range, when that's all that's known) and a line between them. Press one to select it (`selectedRequest`, `onSelectRequest`). Pressing a row focuses its lane (`focusedLane`, `onFocusLane`) and a thread row selects its thread (`selectedThread`, `onSelectThread`), and the gutter picks without seeking. These are all yours to hold.

**Activity** is fetched for the view, not stored up front. `fetchActivity(laneKey, edges, signal)` runs once per lane with bucket edges in that lane's own time, one bucket per 2 px, and answers with `[{ id, counts }]`, a count per bucket per thread. It waits for the view to rest for `activityDebounce` (60 ms), and an answer that's out of date is dropped and its `signal` aborted. Until the new answer comes the old one stays on screen, moved to where its times now are, so zooming stays smooth.

{% hint style="info" %}
Keep `axis`, `stops` and `requests` stable between renders, with `useMemo` or at module level. `lanes` can be rebuilt every render: it's compared by what it holds, and each array by identity, so pass a new array when the data changes instead of changing one in place.
{% endhint %}

## Stops

Landmarks: an [IndexBar](https://blamy.github.io/ui/#/index-bar) item plus a time. `{ key, time, caption, preview, tone, level, trailing, dim }`. Each is a dash on the rail's inner side at its place on the axis, with the same proportions, raised-cosine swell and card as IndexBar's wave, and a soft snap as you drag past. PageUp and PageDown go from one to the next.

There can be thousands of them. `selectStops(stops, { axis, win, length, minGap })`, which you can call yourself, chooses what's shown for the view and the rail's length: the lowest `level` first, then the rest, each merging into the nearest dash already placed if it would land less than `minGap` (10 px) from it. A cluster wears its most severe member's `tone` (`error`, then `warning`, `info`, `success`), stands for its lowest-level stop, and its card says how many more are there. Zooming in spreads them out, so more fit.

## Axes

An axis is any object with `fraction(time)` and `timeAt(fraction)`, inverses of each other and both clamped.

- **`linearAxis(range)`** is plain time, and the default. It sets `uniform`, so the ruler can land on round times.
- **`stopAxis(stops, range)`** is an axis by what happened. Each gap between consecutive stops gets an equal share of the length, so stops sit evenly like IndexBar's, bursts open out and idle time closes up, while the timeline stays continuous between them. Duplicate times count once, and it stays strictly increasing.

{% demo src="trace-timeline/session" viewport="phone" title="Trace Timeline · a rail by what happened" variants="stops:By what happened,time:By time" %}

Any other shape fits the same prop. Here a quarter of the length goes to time, and the rest in equal shares to steps, so a drag doesn't jump over the moments code was running. With no `uniform`, ruler ticks are evenly spaced and say what time they landed on.

```tsx
const stepAxis = (times, range, timeShare = 0.25) => ({
  fraction: (t) => timeShare * timeFraction(t) + (1 - timeShare) * stepFraction(t),
  timeAt: (f) => /* binary search for the step, then interpolate */,
})

<TraceTimeline axis={useMemo(() => stepAxis(times, range), [times, range])} … />
```

`advanceAlong(axis, time, elapsed, range)` is where a playhead ends up after `elapsed` of playing, at an even rate along the axis.

## Scrubbing and zooming

| | Strip | Rail |
| --- | --- | --- |
| **Press** | Jumps to the pointer | Jumps to the pointer |
| **Drag along** | Seeks | Scrubs, with a soft snap to a stop within about 6 px of pointer travel |
| **Drag away** | Nothing changes | Slows: full speed within about 40 px of the rail, then a quarter, a sixteenth and a sixty-fourth further out, all inside 340 px. The card says the speed in words |
| **Past the view's edge** | The view comes along | The view comes along |
| **Wheel** | Zooms around the pointer | Pans when zoomed, and otherwise is left to the page |
| **Shift or a sideways wheel** | Pans | Pans when zoomed |
| **Ctrl and wheel (a trackpad pinch), or two fingers** | Zooms around the pointer | Zooms around the pointer |
| **Double press** | Two seeks | Resets the zoom |

A speed change never moves the playhead: the scrub starts again from where the playhead is, at the new speed. Without this a 600 px rail over an hour moves 6 s a pixel; at the slowest speed it moves about 94 ms. A second finger coming down takes back the first finger's jump, so a pinch leaves the playhead alone. All of it is pointer events, so a mouse, a pen and touch all work.

The preview card appears beside the pointer while hovering or dragging on a rail, showing the stop's `caption` and `preview`, or else the time. On a strip it appears over a stop in the stops row. `renderPreview(time, stop)` puts a slot at the top of the card for a thumbnail of that moment, and then a strip shows it wherever you hover.

## From code

`ref` gives you `fit()`, `setView(view)`, `redraw()`, `focus()` and `pixelTimes()`, the time at each CSS pixel of the plot: the times a drag can land on, worth reading ahead, and worth asking for again after `onViewChange` or a resize. When the playhead moves out of the view through `value`, as it does playing or stepping, the view goes to it.

`onDraw({ layer, ms, columns })` reports what each canvas redraw took: `data` for the rows, when the view or the data changed, and `overlay` for the playhead and the hover line.

## Accessibility

The root is a `slider`, with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and `aria-valuetext` (the time, and the stop's caption when it's on one). `label` names it.

| Key | Effect |
| --- | --- |
| Arrows | Nudge the playhead by `step`, or else a pixel's worth. With Shift, ten times that. Time runs down a rail, so down is later there; on a strip, right and up are later. |
| PageUp, PageDown | The previous or next stop. On a rail the card shows it for a moment. |
| Home, End | The start or the end. |
| `+`, `-` | Zoom in or out around the playhead. |
| `0` | Fit the whole range. |

Picking a lane, a thread or a request takes a pointer, so offer them in a list as well if they matter to keyboard users. The canvases are hidden from assistive technology. Motion follows `prefers-reduced-motion`: the dashes stop easing and the card stops moving.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `range` | required | The whole timeline, on the shared clock. |
| `lanes` / `requests` / `stops` | none | What's on it. |
| `value` / `defaultValue` / `onValueChange` | start of `range` | The playhead. |
| `view` / `defaultView` / `onViewChange` | all of `range` | The stretch of time on show. |
| `axis` | `linearAxis(range)` | Turns times into positions. |
| `orientation` | `horizontal` | `horizontal` is the strip, `vertical` the rail. |
| `side` | `right` | Rail: the edge it sits on. Its stops and card are on the inner side. |
| `top` / `bottom` | `0` | Rail: insets from its parent. Numbers are px. |
| `railWidth` | `44` | Rail: its width in px. |
| `insetContent` | `true` | Rail: publish `--bl-index-bar-inset` on its parent (right side only). |
| `gutter` | `64` | Strip: the width of the label gutter, 0 for none. |
| `requestsLabel` / `stopsLabel` | `requests` / `stops` | Strip: the gutter's labels for those rows. |
| `focusedLane` / `onFocusLane` | none | The lane in focus. A single lane always is. |
| `selectedThread` / `onSelectThread` | none | The selected thread, in the focused lane. |
| `selectedRequest` / `onSelectRequest` | none | The selected request. |
| `fetchActivity` / `activityDebounce` | none / `60` | Thread activity for the view, and how long it has to rest first, in ms. |
| `step` | a pixel's worth | What an arrow key moves the playhead by. |
| `minSpan` | `1e-5` | The shortest stretch of time the view can show. |
| `formatTime` | `formatTraceTime` | `(time, resolution) => string`, where `resolution` is how far apart the times worth telling apart are. |
| `renderPreview` | none | `(time, stop) => node`: a slot at the top of the preview card. |
| `previewLines` / `previewWidth` | `2` / `260` | The card: lines of `preview` shown, and its widest in px. |
| `label` | `Timeline` | The slider's accessible name. |
| `onDraw` | none | Called after each canvas redraw with what it took. |
| `ref` | none | `fit`, `setView`, `pixelTimes`, `redraw`, `focus`. |
| `className` / `style` | none | On the root, last. |

## Styling

The root is `data-slot="trace-timeline"`, with `data-orientation` and `data-side`, and holds `trace-timeline-canvas` (the rows), `trace-timeline-overlay` (the playhead and hover), and on a rail `trace-timeline-stop` for each dash, `trace-timeline-pill` and `trace-timeline-card`.

Colours come from the theme's tokens, read from its CSS variables through hidden elements and read again when a class or style changes on an ancestor or the system's appearance does. Density and threads use `--chart-1` to `--chart-5`, the playhead `--primary`, and tones `--destructive`, `--warning` and `--success`. Any `color` you pass can be any CSS colour, variables included. The strip's height comes from `--tt-height`, so a `className` such as `h-full` takes over.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `traceTimelineVariants`

Defined in `@/components/ui/trace-timeline`. Base classes:

```text
font-sans touch-none select-none
```

**`orientation`** — default `horizontal`

| Value | Adds |
| --- | --- |
| `horizontal` (default) | `relative block h-(--tt-height) w-full cursor-crosshair bg-background -outline-offset-2 [outline:2px_solid_transparent] focus-visible:[outline:2px_solid_var(--p…` |
| `vertical` | `absolute top-(--tt-top) bottom-(--tt-bottom) z-80 w-(--tt-width) cursor-pointer rounded-lg -outline-offset-2 [outline:2px_solid_transparent] focus-visible:[out…` |

**`side`** — default `right`

| Value | Adds |
| --- | --- |
| `right` (default) | — |
| `left` | — |

2 compound variants — see the source.
