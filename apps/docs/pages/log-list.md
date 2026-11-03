# LogList

A console for a recording: a virtualized list of log rows that stays smooth at 100,000 rows, with a marker that says where you are. Rows are plain data, so it doesn't know what produced them. Long messages wrap or open on press, the rows after the marker are dimmed as the future, and the marker can move on every frame without rendering a single row. Its partner for requests is [RequestTable](https://blamy.github.io/ui/#/request-table).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/log-list.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { LogList } from '@/components/ui/log-list'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { LogList } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Give it rows and a sized parent. A row needs an `id` and a `message`. `currentTime`, in ms, draws the marker, and `onRowPress` is where a press goes.

```tsx
const rows: LogRow[] = [
  { id: 1, level: 'log', time: 1204, source: 'app.tsx:42', message: 'Rendered <CartPage> in 12 ms' },
  { id: 2, level: 'warn', time: 2310, source: 'api.ts:58', message: 'Slow response from /api/cart', count: 3 },
]

<LogList aria-label="Console" rows={rows} currentTime={time} onRowPress={(row) => seek(row.time)} className="h-96" />
```

{% demo src="log-list/playhead" %}

## The position marker

`currentTime` puts the marker before the first row logged later. `currentId` puts it right after that row and tints the row, as a debugger's current line is. Give both when the list can be filtered: if the row with `currentId` is filtered out, `currentTime` decides. Rows don't have to be in time order, and a row with no time belongs with the row before it. `markerLabel` adds a small label, like "Paused here".

**It stays in view as it moves.** It rides near the edge of the view, so rows go by it, and a jump far away centers it. If the user scrolls it out of view the list stops following and a button offers the way back, pointing the right way. Pressing that, or scrolling back to the marker, picks up following again. `follow={false}` turns following off, and `onFollowChange` says when it changes.

**Moving it renders nothing.** The prop stops at the list's shell, and the marker is moved by writing a transform and a few attributes. So `currentTime` can change on every frame, as long as `rows`, `renderRow` and `formatTime` stay the same. If you'd rather not render your own component on every tick either, the handle moves it with no React at all:

```tsx
const list = useRef<LogListHandle>(null)

useEffect(() => clock.subscribe(() => list.current?.setCurrentTime(clock.getState().time * 1000)), [clock])

<LogList ref={list} rows={rows} />
```

**Following the newest row.** With no marker, `followTail` stays on the last row as rows arrive, and stops when the user scrolls up, for a console that grows as it's logged to. `footer` goes after the last row, for something like "12 more later in the recording".

## Rows

`level` is `log`, `info`, `warn`, `error` or `debug`, each with an icon, and warnings and errors tint the row. Other console names are mapped: `warning` is `warn`, `assert` is `error`, and `trace` is `debug`. `count` shows a badge when a message repeated. `message` can be any node, so a host can put rich values in it, but keep their state outside: a row unmounts when it scrolls away. A press on a control inside a row doesn't press the row.

Rows are as tall as they need to be. They're measured as they mount, and what's on screen holds still while the rows above it are learned. `overflow="wrap"`, the default, wraps long messages. `overflow="expand"` cuts them to one line until the row is opened, by a press or from the chevron that marks what's cut off. `detail` is more to show in an open row, like a stack trace, and always gets a chevron; `expandOnPress` makes a press open it too. Open rows are held by id, so they're still open when you scroll back.

{% demo src="log-list/open-rows" %}

`renderRow` draws a row's content yourself. `LogRowContent` is the usual content, to add to or to leave out. Keep the function stable with `useCallback`, as a new one renders every mounted row again.

```tsx
const renderRow = useCallback((row: LogRow, state: LogRowState) => (
  <>
    <LogRowContent row={row} expanded={state.expanded} cut={state.cut} disclosure={state.disclosure} formatTime={state.formatTime} />
    <Button variant="quiet" size="sm" onPress={() => inspect(row)}>Inspect</Button>
  </>
), [])
```

A row has `data-future` and `data-current` while it is those, so custom content can follow with `group-data-future/row:`.

## Filtering

Filtering is the host's: LogList shows the rows it's given and holds its place on the row at the top of the view, or the next one that survived. `countLogLevels` counts a list by level for your buttons or a [FilterBar](https://blamy.github.io/ui/#/filter) field's options, and [FilterInput](https://blamy.github.io/ui/#/filter-input) can fill the bar in from a sentence.

{% demo src="log-list/filters" %}

## Narrow windows

Under 480 px of the list's own width, time and source drop under the message rather than squeezing it. It uses a container query, so it works in a side panel too, and it's why the list's root must get its width from its parent and not from its content. Dragging across that width keeps the row at the top of the view, the selection and the open rows.

## How big it can get

Only the rows in view, and a few hundred px more, are in the page. Mounting and scrolling 100,000 rows cost about the same as 600, and the rows themselves are the only per-row memory. Heights are kept in typed arrays, so finding a row's offset is O(log n) rather than a walk.

The limit is the browser's: the list's full height has to fit in an element, which is about 33 million px in Chromium, or about 1.3 million rows of one line. A message that is itself huge costs when it mounts: a 1 MB string takes about 50 ms to lay out.

## Keyboard

| Key | Effect |
| --- | --- |
| `↑` `↓` | Move the active row. |
| `Page Up` `Page Down` `Home` `End` | Move a screen, or to the first or last row. |
| `Enter` `Space` | Press the active row. |
| `→` `←` | Open and close it. On a row that's open, or has nothing to open, `→` goes into its own controls. |
| `⌘C` `Ctrl+C` | Copy the active row, unless text is selected. |
| `Tab` | Go through the active row's own controls, then out of the list. |
| `Esc` | From a control in a row, back to the list. |

## Accessibility

It's an ARIA grid with one tab stop, and the active row is `aria-activedescendant`, as in [Spreadsheet](https://blamy.github.io/ui/#/spreadsheet), so focus can't be lost when a row scrolls out and unmounts. `aria-rowcount` gives the full length and each row has `aria-rowindex`. The current row has `aria-current`, and a row with more to show has `aria-expanded`. The marker's line is drawn for sighted users and hidden from assistive technology.

A row isn't a react-aria element, for scale: giving each its own hooks is what adds up at this size. A press on a row is the grid's own click, so touch, mouse and a screen reader's click all reach it, and dragging across text to select it isn't a press. The Copy and way-back buttons are real react-aria buttons. Copy is a single button that moves to the row under the pointer, or the active row, which is how touch and keys get to it.

## Props

### LogList

| Prop | Default | Effect |
| --- | --- | --- |
| `rows` | required | The rows. Keep the array stable between renders when nothing changed. |
| `currentTime` / `currentId` | none | Where "now" is. |
| `markerLabel` | none | A small label on the marker. |
| `follow` | `true` | Keep the marker in view as it moves. |
| `followTail` | `false` | With no marker, stay on the newest row. |
| `jumpLabel` | "Back to current" or "Back to latest" | The way-back button's text. |
| `onFollowChange` | none | Whether the view is following. |
| `overflow` | `wrap` | `wrap` long messages, or cut them to a line until opened (`expand`). |
| `expandOnPress` | on with `expand` | A press also opens or closes the row. |
| `expandedIds` / `defaultExpandedIds` / `onExpandedChange` | none open | The open rows. |
| `selectedId` / `defaultSelectedId` / `onSelectionChange` | none | The selected row. A new one that's out of view is scrolled to. |
| `onRowPress` | none | A press, or Enter or Space on the active row. |
| `copyable` | `true` | The Copy button, and ⌘C. |
| `getRowText` / `onRowCopy` | `logRowText` / none | What's copied, and hearing about it, with the text, for a host with a clipboard of its own. |
| `renderRow` | `LogRowContent` | A row's content. Must be stable. |
| `formatTime` | `formatLogTime` | How times read. Must be stable. |
| `density` | `compact` | `comfortable` for touch. |
| `estimatedRowHeight` | one line | A row's height until it's measured. |
| `emptyState` / `footer` | "No messages" / none | Shown with no rows, and after the last row. |

### A row

| Field | Effect |
| --- | --- |
| `id` | Unique in the list: rows and open and selected state follow it. |
| `level` | `log` by default. |
| `time` | When it was logged, in ms from the start. |
| `source` | Where it came from, like `app.js:42`. |
| `message` | A string or any node. |
| `count` | How many times it repeated. |
| `text` | The row as plain text, for copying a rich `message`. |
| `detail` | More to show when open. |

### The handle

| Method | Effect |
| --- | --- |
| `focus()` | Focuses the list. |
| `scrollToId(id, align?)` | Scrolls to a row: `center` by default, or `start`, `end`, `nearest`. |
| `followPosition()` | The way back, from your own button. |
| `setCurrentTime(time)` | Moves the marker with no React. The props take over when they next change. |

### Helpers

`countLogLevels(rows)`, `normalizeLogLevel(level)`, `formatLogTime(ms)`, `logRowText(row)`, `nodeText(node)` and `LOG_LEVELS`, most severe first.

## Styling

The root is `data-slot="log-list"`, inside it `log-list-grid`, `log-list-rows`, `log-list-marker`, `log-list-marker-label`, `log-list-jump`, `log-list-empty` and `log-list-footer`. A row is `log-list-row`, with `data-level`, and has `log-list-toggle`, `log-list-icon`, `log-list-message`, `log-list-count`, `log-list-meta`, `log-list-source`, `log-list-time`, `log-list-detail` and `log-list-actions`. It takes its colors from the theme, on the surface [ResultTable](https://blamy.github.io/ui/#/result-table) and Spreadsheet use.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `logListVariants`

Defined in `@/components/ui/log-list`. Base classes:

```text
@container relative flex h-full max-h-dvh w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground after:pointer-events-none after:absolute after:inset-0 after:z-3 after:rounded-[inherit] after:shadow-hairline after:content-['']
```

**`density`** — default `compact`

| Value | Adds |
| --- | --- |
| `compact` (default) | `[--log-pad:3px]` |
| `comfortable` | `[--log-pad:7px]` |
