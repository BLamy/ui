# Flame Chart

A distributed trace on a canvas, the way an APM's trace view draws one. Each lane is a process or a service, and each span sits under the span that caused it. Where the cause was in another lane, a curve joins the two. A solid bar ran in that lane, an outlined bar was waiting on something somewhere else, a dashed outline never finished, and red failed. A minimap of the whole trace sits over a ruler, and a playhead runs through it all. The playhead is the same `value` as [TraceTimeline](https://blamy.github.io/ui/#/trace-timeline)'s, so a debugger can follow it. A million spans draw in a few milliseconds.

Use a sibling instead when what happened is marks on a long session rather than spans with causes ([TraceTimeline](https://blamy.github.io/ui/#/trace-timeline)), or when the rows themselves are what matters ([LogList](https://blamy.github.io/ui/#/log-list)).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/flame-chart.json https://blamy.github.io/ui/r/flame-chart-model.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import { FlameChart } from '@/components/ui/flame-chart'
import {
  flameData, criticalPath, familyOf,
} from '@/lib/flame-chart-model'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { FlameChart } from '@brett_lamy/ui/flame-chart'
import {
  flameData, criticalPath, familyOf,
} from '@brett_lamy/ui/lib/flame-chart-model'
```
{% endtab %}
{% endtabs %}

## Usage

Give it `data`: spans as columns of typed arrays, one index per span. `flameData(lanes, spans)` packs plain objects into that shape. It finds each span's parent by id, works out each span's row (under its parent, otherwise as high as it fits) and adds a link wherever a parent is in another lane. Times are numbers on one clock, in milliseconds as far as the ruler and the default formatting go.

```tsx
const lanes = [
  { key: 'browser', title: 'Browser', subtitle: 'Safari 19' },
  { key: 'api', title: 'API', subtitle: 'api-7d9f · pid 41' },
]
const data = useMemo(() => flameData(lanes, [
  { id: 'click', lane: 'browser', name: 'click "Save"', start: 0, end: 212 },
  { id: 'fetch', parent: 'click', lane: 'browser', name: 'fetch PUT /api/notes/42', start: 4, end: 188, waiting: true },
  { id: 'handler', parent: 'fetch', lane: 'api', name: 'PUT /api/notes/:id', start: 9, end: 184 },
  { id: 'db', parent: 'handler', lane: 'api', name: 'UPDATE notes', start: 64, end: 151, error: true },
]), [])

<FlameChart
  data={data}
  selected={selected}
  onSelectedChange={(index, { reason }) => setSelected(index)}
  onSpanActivate={(index) => openInDebugger(data.ids[index])}
  value={time}
  onValueChange={setTime}
/>
```

{% demo src="flame-chart/small" %}

A press on a span selects it, and a double press or Enter "activates" it (`onSpanActivate(index, details)`), which is where a debugger opens the span. A press on empty space moves the playhead there, and so does a press or a drag on the ruler. `onValueChange(time, details)` carries UI SDK's change details (`reason` is `track-press`, `drag`, `step-key`, `escape-key` or `imperative`), and `onValueCommit` runs once when the press or drag is done. A playhead that moves out of the view through `value` brings the view along with it.

## A distributed trace

Five checkouts through a browser, a gateway, orders, payments and inventory. Each client span waits (outlined) on the server span it called in the next service, and a curve joins the two. One charge in three is declined and retried after a backoff. Each receipt is a queued job that was still running when the trace was taken.

{% demo src="flame-chart/distributed" %}

Everything lit is `highlight`: the spans it holds stay lit and the rest dim. The demo puts three things in it:

```tsx
const highlight = query
  ? matches                                  // a search
  : critical
    ? criticalPath(data, selected)           // what the selected span waited on
    : selected >= 0 ? familyOf(data, selected) : null   // what led to it and what it set off

<FlameChart data={data} highlight={highlight} showLinks={links} … />
```

Errors in the highlight are drawn over everything else, so a failed span a fraction of a pixel wide still shows red. The curves come from `data.links`, or from parents in other lanes when there are none. Each curve starts where the caller was when the callee started and ends at that start, so a flat curve is a call picked up at once and a long slanted one is a message that waited. The selected span's curves are drawn strongest. Press a lane's header in the gutter to collapse it to a strip of its top row, and press it again to open it (`collapsedLanes`, `onCollapsedLanesChange`).

## Over a debugger, from recordings

A real distributed trace: a shop page and four Node services (gateway, orders, payments, inventory) that call each other over HTTP with W3C trace context, each recorded with Replay, replayed once with the linker and written to JSON. Each service is a lane, each span sits under the span that caused it with a curve from the caller in another lane, the 402 from a declined card is red, and under each server span are the calls the code made while answering it, read from the recording's own steps, which no tracer has. The playhead is the debugger's: press a span to go to it, double-click to open its service's recording where it began, and step from there.

{% demo src="blocks/replay-debugger" variants="tracing:Distributed trace" title="Replay Debugger · a flame chart of four services over the debugger" %}

It's the [Replay Debugger](https://blamy.github.io/ui/#/blocks/replay-debugger) block's `SessionFlame` on a `ReplaySession` (several recordings extracted once with Replay's linker), whose spans carry what the Replay inspector's session analytics read; `analyzeSession` gives self time, busy time, P50 and P95 per operation from the same data.

## A million spans

{% demo src="flame-chart/million" %}

The stress demo builds 1,000,000 spans across eight services as typed arrays. `packRows` places them in rows and `deriveLinks` adds the links. It draws the way every view does:

- **Only what's visible.** Each lane's rows keep their spans sorted by start, beside the furthest end so far (`flameIndex`). A binary search finds the first span still showing, even a long one that started far to the left, and another finds the last one to start in the view. Lanes scrolled out of view cost nothing.
- **At most one fill per device pixel per row.** A span at least a device pixel wide is a bar of its own. Narrower spans join a run of neighbouring pixels of the same colour, and after the first span in a pixel a gallop jumps straight past every other span that starts in that pixel. A row of a million spans takes a few thousand steps.
- **Labels only where they fit.** A name is measured once per font, and its shortened forms are kept. Labels stay at the plot's left edge while their bar runs off it.
- **Two canvases.** The data layer is drawn again only when the view, the scroll, the data, the selection or the highlight changes. The playhead, the hover line and the hovered span's outline go on an overlay that costs almost nothing.
- **Links in view only.** Links are sorted by when they arrive, so a view finds its own by binary search. Past 1,500 of them they're sampled evenly and drawn fainter.

`onDraw({ layer, ms, spans, bars, runs, labels, links })` reports what each redraw took. Pass `data` and keep it stable: the index, the tree and the minimap are built once per data object.

## Data

| Column | What it holds |
| --- | --- |
| `lanes` | `[{ key, title, subtitle, tint }]`. `tint` is any CSS colour, variables included. The default is a chart colour by position. |
| `start`, `end` | `Float64Array`, ms on the shared clock. |
| `lane` | `Uint16Array`, an index into `lanes`. |
| `depth` | `Uint16Array`, the row within the lane (0 is the top). `packRows(start, end, lane, parent)` works it out. |
| `parent` | `Int32Array`, the span that caused this one, or -1. It may be in another lane. |
| `name`, `names` | `Uint32Array` into `string[]`. |
| `color`, `colors` | `Uint16Array` into CSS colours: per service, per operation, whatever you like. |
| `flags` | `Uint8Array`: `FLAME_ERROR` (1), `FLAME_PENDING` (2), `FLAME_WAITING` (4). |
| `links` | Optional `{ from, to }` of `Int32Array`. By default, from each parent in another lane. |
| `ids` | What `flameData` was given, by index. |

A span index is the same everywhere: `selected`, `highlight`, `onSpanActivate`, `reveal` and every model function take it.

| Function | Answers |
| --- | --- |
| `flameData(lanes, spans)` | Columns from objects, with rows, parents and links. |
| `selfTime(data, i)` / `selfTimes(data)` | Duration minus the union of the children's intervals, clipped to the span. |
| `criticalPath(data, i)` | The chain a span waited on: the child that finished last, what that child waited on, and so on back to its start. Pending children never finished, so they're left out. |
| `familyOf(data, i)` | The span, its ancestors and its descendants, across lanes. |
| `pathTo(data, i)` | From the root down to the span. |
| `spanAt(flameIndex(data), lane, row, time, slop)` | Hit testing. |
| `percentile(values, p)`, `unionMs(intervals)` | Numbers for a panel beside the chart, such as an operation's p95. |
| `formatDuration(ms)` | `850 µs`, `12.4 ms`, `1.25 s`, `2m 05s`. |

## Interaction

| | Effect |
| --- | --- |
| **Wheel** | Zooms around the pointer. So do Ctrl or ⌘ with the wheel (a trackpad pinch) and two fingers. |
| **Shift or a sideways wheel** | Pans. |
| **Wheel over the gutter** | Scrolls the lanes. |
| **Drag on the body** | Pans the time and scrolls the lanes. Escape puts both back. |
| **Press a span / double press** | Selects it / activates it. |
| **Press empty space, or press or drag on the ruler** | Moves the playhead. Escape during a ruler drag puts it back. |
| **Press or drag the minimap** | Moves the view window. |
| **Press a lane's header** | Collapses or opens the lane. |

Hovering shows a card with the span's name, lane, duration, self time and state. `renderTooltip(index)` replaces its content.

## From code

`ref` gives you `fit()`, `setView(view)`, `reveal(index, { zoom })`, `redraw()` and `focus()`. `reveal` opens the span's lane, scrolls to its row and pans to it, or with `zoom` fits the view to it.

`onViewChange(view, details)` says why the view moved in `details.reason`:

| Reason | Cause |
| --- | --- |
| `wheel` | The wheel, or a trackpad pinch. |
| `pinch` | Two fingers. |
| `zoom-key` | The `+`, `-` and `0` keys. |
| `pan-key` | Shift with an arrow key. |
| `drag` | A drag on the body. |
| `minimap` | A press or drag on the minimap. |
| `follow` | The selection or the playhead left the view. |
| `escape-key` | Escape put a drag back. |
| `range-change` | A new `range`, when you don't hold `view`. |
| `imperative` | `fit`, `setView`, `reveal`, or an agent. |

`details.cancel()` keeps the view where it is. The playhead, the view, the selection and the collapsed lanes are the flame-chart primitive's state. Through UI SDK's agent bridge, an agent can `setValue`, `setView`, `fit`, `select`, `activate`, `toggleLane` and `setCollapsedLanes`.

## Accessibility

The root is an `application` with `aria-roledescription="flame chart"`, named by `aria-label` ("Flame chart" by default) or `aria-labelledby`. A hidden description says what's selected, and each selection made by key is announced: its name, lane, duration, and whether it failed, was pending or was waiting. The canvases are hidden from assistive technology.

| Key | Effect |
| --- | --- |
| ←, → | The previous or next span under the same parent, or else its neighbour in the row. With nothing selected, the first span. |
| ↑, ↓ | The parent, or the first child. |
| Shift+←, Shift+→ | Pan by a tenth of the view. |
| `+`, `-` | Zoom in or out around the selected span, or else the playhead. |
| `0` | Fit the whole range. |
| Home, End | Move the playhead to the start or the end. |
| PageUp, PageDown | Scroll the lanes a page. |
| Enter | Activate the selected span. |
| Escape | Clear the selection (left to the page when nothing is selected). |

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `data` | required | The spans, as columns. Keep it stable. |
| `range` | the data's extent | The whole stretch of time the chart covers. |
| `view` / `defaultView` / `onViewChange(view, details)` | all of `range` | The stretch on show. |
| `value` / `defaultValue` / `onValueChange(time, details)` / `onValueCommit` | start of `range` | The playhead. |
| `selected` / `defaultSelected` / `onSelectedChange(index, details)` | `-1` | The selected span. `reason` is `item-press`, `list-navigation`, `escape-key` or `imperative`. |
| `onSpanActivate(index, details)` | none | A double press or Enter. `reason` is `double-press`, `enter-key` or `imperative`. |
| `highlight` | `null` | Spans kept lit while the rest dim: an array, a typed array or a `Set` of indices. |
| `showLinks` | `true` | Curves between lanes. |
| `collapsedLanes` / `defaultCollapsedLanes` / `onCollapsedLanesChange(keys, details)` | none | Lanes shown as their header alone. |
| `minimap` | `true` | The overview strip with the view window. |
| `formatTime(time, resolution)` | the offset from the start | How the ruler and hover line print a time. |
| `renderTooltip(index)` | name, lane, duration, self time, state | The hover card's content. |
| `rowHeight` | `18` | A row's height, px. |
| `gutter` | `148` | The lane label width, px. It's at most a third of the chart's width. |
| `minSpan` | `1e-5` | The shortest stretch of time the view can show. |
| `frame` | `none` | `card` adds the card radius and a hairline. |
| `onDraw(stats)` | none | Called after each redraw with what it took. |
| `ref` | none | `fit`, `setView`, `reveal`, `redraw`, `focus`. |
| `className` / `style` | none | On the root, last. The default height fits the lanes, up to 560 px. Use `h-[480px]` or `h-full` to set your own. |

## Styling

The root is `data-slot="flame-chart"`, with `data-spans` and `data-selected`. It holds `flame-chart-canvas` (the data layer), `flame-chart-overlay` (the playhead and hover) and `flame-chart-card`.

Colours come from the theme's tokens, read from its CSS variables and read again when the appearance or an ancestor's class or style changes (a `ThemeScope`). Lanes default to `--chart-1` through `--chart-5`. The playhead and the minimap's window use `--primary`, and failures use `--destructive`. Each label's colour is whichever of the theme's foreground and background reads better on its bar.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `flameChartVariants`

Defined in `@/components/ui/flame-chart`. Base classes:

```text
relative block h-(--fc-height) w-full touch-none overflow-hidden font-sans select-none -outline-offset-2 [outline:2px_solid_transparent] focus-visible:[outline:2px_solid_var(--primary)]
```

**`frame`** — default `none`

| Value | Adds |
| --- | --- |
| `none` (default) | `bg-background` |
| `card` | `rounded-card bg-background shadow-hairline` |
