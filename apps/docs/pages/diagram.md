# Diagram

Nodes, edges, labels and regions on a [Canvas](#/canvas), from plain data. The view, the minimap and `useCanvas` are the canvas's own. It can stay a picture, or with one prop it's an editor: selecting, dragging, deleting, undo, ports and connecting, by pointer and by keyboard, each change asked of you first through `onDataChange(data, details)`. It lays itself out with [ELK](https://eclipse.dev/elk/) if you ask it to, and draws thousands of nodes by only drawing what's near the view.

Use [Canvas](#/canvas) itself for a free board of things you place (cards, notes, frames: the [Freeform](#/blocks/freeform) block), [Tree](#/tree) for a hierarchy that reads top to bottom, and [DataTable](#/data-table) when what matters is the rows, not how they connect. Put a Diagram in a [DiagramFrame](#/diagram-frame) to give it a panel; [StateDiagram](#/state-diagram) is a Diagram of an XState machine, and [CloudflareDiagram](#/cloudflare-diagram) one of Cloudflare services.

{% hint style="info" %}
**Why it's its own component, not a Canvas variant.** A Canvas knows nothing about what's on it; a Diagram is a graph: edges routed between nodes and ports, a keyboard that moves *along* edges, connections that can be refused, and one history of edits. That's a data model and a primitive (`lib/diagram-primitive`) of its own, drawn on a Canvas rather than added to it.
{% endhint %}

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/diagram.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Diagram, DiagramToolbar } from '@/components/ui/diagram'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Diagram, DiagramToolbar } from '@brett_lamy/ui/diagram'
```
{% endtab %}
{% endtabs %}

{% demo src="diagram/machine" %}

## The idea

A node is a box in board units, and an edge joins two of them. Everything in a diagram is plain data, so it can be saved, sent and diffed:

```tsx
const nodes = [
  { id: 'inbox', label: 'Inbox', x: 0, y: 0, w: 110, h: 36 },
  { id: 'review', kind: 'compound', label: 'Review', x: 200, y: -40, w: 280, h: 140 },
  { id: 'read', parent: 'review', label: 'Read', x: 240, y: 0, w: 110, h: 36 },
]
const edges = [{ id: 'open', from: 'inbox', to: 'read', label: 'open' }]

<div className="relative h-96">
  <Diagram nodes={nodes} edges={edges} aria-label="A small workflow" />
</div>
```

Like the library's other containers, it fills the nearest positioned box. With no `viewport` it fits what's on it, and goes on fitting until the view's moved.

**A node** has an `id`, a place and a size, and optionally:

| Field | What |
| --- | --- |
| `kind` | `node`, `final`, `initial`, or something that holds others: `compound`, `parallel`, `region` and `root`. A `root` is background, and can't be selected. |
| `parent` | The node it sits in. Positions are absolute, not relative to it, and it moves with its parent. |
| `label`, `detail` | Its name, and a quieter second line. |
| `ports` | Named places on its sides, for edges to join. See [Ports](#ports-and-connecting). |
| `data` | Anything of yours, for `renderNode`. |

**An edge** has an `id`, `from` and `to`, and optionally:

| Field | What |
| --- | --- |
| `fromPort`, `toPort` | Which ports it joins. |
| `route` | `elbow`, `straight` or `curve`, when it has no `points`. |
| `points` | A route already worked out, from start to tip. |
| `label`, `labelBox` | Its label, and where a layout put it. Without `labelBox` it finds a place beside the line. |
| `kind` | How it looks: `event`, `done`, `invoke`, `always` (dashes), `after` (dots), `initial`, `problem` (dashes in red, for something that's wrong). Anything else looks like `event`. |

An edge with no `points` works out its route from where its ends are. Edges that leave the same side of a node share it out, a node's self-loops nest, and an edge between a compound and its own child runs from the nearest wall.

Lines and arrowheads keep their thickness on screen at any zoom. Text that would be too small to read hides: an edge's label below 40%, and a node's below 25%. It's the same `Canvas` underneath, so scrolling pans, a pinch or ⌘-scroll zooms, and ⌘0 fits.

## Laying it out

`useDiagramLayout` takes the same nodes without their places and sizes. It measures their words in the real font, and ELK places them in a Web Worker, so even 2,000 nodes don't stop the page.

{% demo src="diagram/layout" %}

```tsx
import { useDiagramLayout } from '@/lib/diagram-layout/react'

function Map({ draft }) {
  const host = useRef(null)
  const laid = useDiagramLayout(draft, { host, direction: 'right' })
  return (
    <div ref={host} className="relative h-96">
      <Diagram nodes={laid.nodes} edges={laid.edges} loading={laid.status === 'pending'} />
    </div>
  )
}
```

`host` is where text gets measured, so a `ThemeScope`'s font applies. A new layout stops the one before it, and unmounting stops the worker. `status` says `pending`, `working`, `ready` or `error`, and `error` has what went wrong. `elk` takes ELK options of your own, over the defaults in `DIAGRAM_ELK_OPTIONS`. `layoutDiagram(draft, options)` is the same thing as a promise, and on a server it runs in the process.

{% hint style="warning" %}
**ELK is an optional peer.** It's 442 KB gzipped and licensed EPL-2.0 OR GPL-3.0-or-later, so it's only loaded when a layout's first asked for, and an app with fixed positions never loads it. It's listed on [Attributions](#/attributions). The shadcn item for layout installs it, with `npx shadcn@latest add https://blamy.github.io/ui/r/diagram-layout.json`. With the npm package, run `npm install elkjs`. Without it, a layout fails with an error saying so.
{% endhint %}

The worker is `lib/diagram-layout/layout-worker.js`, started with `new Worker(new URL('./layout-worker.js', import.meta.url), { type: 'module' })`, which your bundler turns into a chunk of its own. If it can't start one, layout runs on the main thread and warns. To start it yourself, pass `worker`.

## Sizes from text

`autoSize` sizes each node to its words, around its center, for when you've got your own positions.

{% demo src="diagram/sized-text" %}

Words are measured by the browser's own text layout, in an element that can't be seen, with the same classes they're drawn with, so long names, names with no spaces and CJK come out right. Past 216 px they wrap. Text is measured again if the words change, a font arrives late, or a hidden tab's shown.

{% hint style="info" %}
**A server can't use the same sizes.** It has no fonts, and can't know which of the stack a browser will pick. `estimateText` goes by typical letter widths, and in a test on 77 labels it was off by a median of 8%, from -4% to +24%. The hydrating client starts from the same estimate, so there's no mismatch, then measures, and only moves things if the sizes came out different. An app that wants no move at all gives nodes fixed sizes and leaves `autoSize` off.
{% endhint %}

## Editing

Give it `editable`, and the pointer selects, moves and deletes, with undo. It's one gesture, a state machine that doesn't care about the view (`@/lib/diagram-gesture`), so a pinch, Space or Escape drops whatever's going on cleanly.

{% demo src="diagram/editing" %}

Shift or ⌘ adds to the selection, and a drag from nothing draws a marquee, which takes a leaf it touches and a compound only if all of it's inside. Moving lines up with what's nearby, unless you hold ⌘. Edges keep their shape and stay square as they follow, a compound's children go with it, and a compound grows when a child's dragged to its wall.

Two edges between the same two ports are one line. A press there selects one, and pressing again goes to the next, and round, as their labels each select their own. A double press opens whichever it's left selected. `edgesAtPoint` gives every edge on the line at a point, and `edgeAt` the last of them.

```tsx
const [data, setData] = useState({ nodes, edges })

<Diagram
  editable
  nodes={data.nodes}
  edges={data.edges}
  onDataChange={(next, details) => {
    if (details.reason === 'delete' && !confirmDeletes) return details.cancel()
    setData(next)
  }}
  overlay={<DiagramToolbar />}
/>
```

Nothing's committed until the pointer comes up. `onDataChange(data, details)` has the new data, and `details.reason` says why: `move`, `delete`, `connect`, `reconnect`, `undo` or `redo`. Undo and redo come this way too, so an app sees every change the same way, and `details.source` says whether a person or an agent did it.

`details.cancel()` refuses a change: the node goes back where it was, and there's nothing to undo. Data that changes for reasons of its own clears undo, as going back would lose whatever changed it. To leave the data to the diagram instead, use `defaultNodes` and `defaultEdges`.

`DiagramToolbar` is a floating [Toolbar](#/toolbar) for `overlay`: zoom out, zoom in and fit, and undo and redo when the diagram keeps its history. Each tool's tooltip names its shortcut, and the toolbar is one tab stop after the board. Put your own `ToolbarButton`s in it as children.

### From outside, and for agents

The data, the selection and the history are one primitive, so a controller drives it from anywhere, and an agent sees the same actions:

```tsx
const [diagram] = useState(createDiagramController)

<Button onClick={() => diagram.deleteSelection()}>Delete</Button>
<Diagram controller={diagram} editable … />
```

`select(selection)`, `selectAll()`, `clearSelection()`, `deleteSelection()`, `moveNodes(ids, dx, dy)`, `connect({ from, to, fromPort?, toPort? })` (it returns the reason when `isValidConnection` refuses), `undo()`, `redo()`, `canUndo()`, `canRedo()`, `getData()` and `getSelection()`. Each goes through `onDataChange` or `onSelectionChange`, which can refuse it. Inside the diagram's `overlay`, `useDiagram()` gives the same methods and the board's view controller.

## The keyboard

The diagram is one tab stop, the board, and the keys go from there. The board's description says which keys do what (`aria-describedby`), every node and edge can be reached, and each says what it is and what it connects to, such as "Triage, node. 2 going out: done to Archive, open to Read. 1 coming in: sort from Inbox." `describeNode` and `describeEdge` replace those. The view follows the focus, moving as little as it can, and what has focus gets a ring in the focus color, the same thickness on screen at any zoom.

| Key | Does |
| --- | --- |
| Tab | To the diagram, and on out of it. |
| Arrows | To a neighbour that way, along an edge if one goes that way, or else to whatever's nearest that way. On an edge, to either end. |
| `[` and `]` | Through a node's edges, and from an edge to the next one from the same node. |
| Alt + ↓ and ↑ | Into what a node holds, and out to what holds it. |
| Page Down, Page Up | Through every node and edge in turn. |
| Home, End | The first and last node. |
| Enter | Selects what's focused and calls `onAction(item, details)`, as a double click does. |
| Shift + Enter | Adds it to the selection, or takes it out. |
| ⌘ + arrow | Moves the view. ⌘ + − 0 1 zoom, as on `Canvas`. |
| Shift + arrow | Nudges what's selected, or what's focused, by 8. By 1 with Alt. |
| Delete | Deletes what's selected, or what's focused. |
| ⌘Z, ⇧⌘Z | Undo and redo. |
| ⌘A | Selects everything. |
| C | Starts a connection. See below. |
| Escape | Drops what's going on, then the selection, then goes back to the diagram. |

Those that edit need `editable`, and those that select need `selectable`, which `editable` turns on. A plain `Diagram` can still be read this way.

## Ports and connecting

A port is a named place on a node's side, and an edge can join two of them. With `connectable`, which `editable` turns on, a drag from a port draws a connection, which snaps to the nearest port within 24 px on screen, even one under another node. A node with no ports gets one on each side once it's the only thing selected, and a selected edge has a handle on each end to move it.

{% demo src="diagram/connecting" %}

```tsx
const nodes = [{
  id: 'worker', label: 'Worker', x: 0, y: 0, w: 130, h: 80,
  ports: [{ id: 'db', side: 'r', at: 0.25, kind: 'sql', label: 'DB', direction: 'out' }],
}]

<Diagram editable nodes={nodes} edges={edges} onDataChange={save} isValidConnection={(c) => c.to !== 'locked' || 'That one is locked.'} />
```

`isValidConnection` returns true, false, or the reason in words. While dragging, an invalid target turns the line and the target the destructive color, dashed (so it's never color alone), and says why, and it refuses on release. Without one, `checkConnection` keeps to the ordinary rules: a port can't connect to itself, nothing's connected twice, a connection goes the way its ports' `direction` goes, and ports of a `kind` only join that kind. A self-loop's fine. `createEdge` makes the edge for a new connection, and the default has only its ends and an id.

By keyboard, C starts from what's focused, or moves the end of a focused edge, with Shift for its start. The arrows choose, P changes port, Enter connects, Escape cancels, and a screen reader's told each step.

## Large diagrams

Above 200 nodes and edges, what's out of view isn't drawn. A window half as big again each way as the view gets drawn, and it only changes when the view leaves it, so most frames of a pan change nothing at all. An edge goes by its route, so one crossing the view with both ends far away still draws. What has focus stays drawn wherever it's gone. `cull` turns this on or off.

`node tools/e2e/diagram-perf.mjs` measures it, and fails if drawing less is ever worse than drawing it all.

It works at 10,000 nodes. These are medians of 3 runs, in headless Chromium on a machine with a load of about 50, and 8.3 ms is the fastest that screen can go:

| 10,000 nodes | First paint | A frame of panning | A frame of zooming | Drawn |
| --- | --- | --- | --- | --- |
| At 100%, drawing what's near the view | 52 ms | 8.3 ms | 8.3 ms | 25 nodes, 375 edges |
| At 100%, drawing it all | 690 ms | 8.3 ms | 9.0 ms | all of it |
| Zoomed all the way out, drawing what's near the view | 236 ms | 16.5 ms | 15.8 ms | 4,351 nodes, 7,977 edges |
| Zoomed all the way out, drawing it all | 612 ms | 16.3 ms | 14.0 ms | all of it |

The view is where it matters: the smallest zoom is 2%, so a board this size doesn't all fit on the screen even then, and what's drawn is what's near it.

## A panel beside it

[DiagramFrame](#/diagram-frame) puts a panel beside a board: a column when there's the room, a drawer that doesn't dim the board at medium sizes, and a page pushed over it on a phone, with a bar on the board to open it. It's what `StateDiagram` and `CloudflareDiagram` are made of.

```tsx
<DiagramFrame>
  <DiagramFrameBoard>
    <Diagram nodes={nodes} edges={edges} />
    <DiagramFrameBar>{selected?.label}</DiagramFrameBar>
  </DiagramFrameBoard>
  <DiagramFramePanel title="Inspector"><Inspector /></DiagramFramePanel>
</DiagramFrame>
```

## Empty and loading

With no nodes, the shared [EmptyState](#/empty-state) shows over the board ("Nothing here yet"); `emptyState` replaces it (a string is its title, an `<EmptyState>` with an `action` adds a way out, `null` shows nothing). While `loading` (a layout's running), a status says so instead, and there's no empty state.

## Accessibility

- The root is a `group` named by `aria-label`, with `aria-roledescription="diagram"`; the board inside is the one tab stop, an `application` named "<name> board" and described by its keys.
- Every node and edge is a `button` (out of the tab order: the keys move to it) whose name says what it is and what it connects to. Selected ones have `aria-pressed="true"` when the diagram is `selectable`; current ones `aria-current="true"`.
- Each step of connecting by keyboard, a refusal and its reason, and a delete are announced in a polite status. A refused connection is drawn dashed as well as in the destructive color.
- Focus never falls out: when what has focus is deleted, it goes to what's nearest. Escape drops a gesture, then the selection, then goes back to the board.
- Nothing animates: the view moves when you move it, so there's nothing for reduced motion to turn off.
- Dark mode is the theme's tokens: lines are `muted-foreground`, selection `primary`, focus `ring`, problems `destructive`. Node details and edge labels are the foreground at 70%, which passes AA on a card in both appearances.

## Server rendering

`renderToString` draws it all, with no browser, and it hydrates with no mismatch: tested in TanStack Start and Next.js. With `useDiagramLayout`, pass a layout done ahead of time as `initial`, or the server draws nothing until the client's laid it out, as ELK's answer takes a while.

## API

### `<Diagram>`

| Prop | Default | Effect |
| --- | --- | --- |
| `nodes`, `edges`, `onDataChange(data, details)` | — | Controlled data. `details.reason`: `move`, `delete`, `connect`, `reconnect`, `undo`, `redo`; `details.cancel()` refuses it. |
| `defaultNodes`, `defaultEdges` | — | Data left to the diagram. |
| `editable` | `false` | The pointer and the keys move and delete, with undo. |
| `movable` | `editable` | Whether dragging and ⇧ with an arrow move things, for when where they are isn't up to you. |
| `selectable` | `editable` | Selecting, one at a time or with a marquee. |
| `connectable` | `editable` | Drawing connections, and moving an edge's ends. |
| `undoable` | `editable` | ⌘Z and ⇧⌘Z, and the toolbar's undo and redo, as the diagram's own history. Off for data with a history of its own. |
| `portsOnly` | `false` | Connect only from named ports: no places to connect on a node without any, and no moving an edge's ends. |
| `isValidConnection` | `checkConnection` | True, false or the reason. |
| `createEdge` | an id and its ends | The edge for a new connection. |
| `selection`, `defaultSelection`, `onSelectionChange(selection, details)` | nothing | What's selected, as `{ nodes, edges }`. `details.reason`: `press`, `marquee`, `keyboard`, `select-all`, `escape-key`, `delete`, `imperative`. |
| `current` | nothing | Where things are now, apart from what's selected, as `{ nodes, edges }`: where a machine is, and how it got there. Written as `aria-current` and `data-current`. |
| `onAction(item, details)` | — | Enter on what's focused, or a double click. `item` is `{ kind: 'node' \| 'edge', id }`; `details.reason` is `enter-key` or `double-click`. |
| `controller` | — | From `createDiagramController()`: select, delete, connect, move, undo and redo from outside. |
| `emptyState` | `<EmptyState>` | What shows with no nodes. |
| `loading` | `false` | The data isn't here yet: a status, and no empty state. |
| `autoSize` | `false` | Size each node to its words, around its center. |
| `cull` | above 200 | Draw only what's near the view. |
| `minimap` | `false` | `CanvasMiniMap` in a corner, or its props (`side`, `align`). |
| `renderNode` | `DiagramNodeBody` | Draws a node's insides. Keep it stable, as nodes memoize on it. |
| `describeNode`, `describeEdge` | what it connects to | What a screen reader says. |
| `noun` | `node` | What a node is called, in what's said: a state, a service. |
| `viewport`, `defaultViewport`, `onViewportChange(viewport, details)` | fits | As on `Canvas`. |
| `fitPadding` | `24` | Air around what's fitted, in px, for the first fit and ⌘0. |
| `background`, `panning`, `autoFocus` | as on `Canvas` | Passed to it. A resting cursor is a class: `className="cursor-crosshair"`. |
| `overlay` | — | Over the board in screen space, outside its keys: a `DiagramToolbar`, a status. `useDiagram()` works here. |
| `children` | — | More of the board layer. `useCanvas` works here. |
| `aria-label` | "Diagram" | Its name; the board is "<name> board". |
| `className`, `style`, `ref` | — | Merged onto the root. |

### `<DiagramToolbar>`

| Prop | Default | Effect |
| --- | --- | --- |
| `side`, `align` | `bottom`, `start` | Where it floats over the board. |
| `variant`, `size` | `floating`, `sm` | As on `Toolbar`. |
| `children` | — | More tools after its own. |
| `aria-label` | "Diagram tools" | Its name. |

### Data attributes

The root is `data-slot="diagram"` with `data-editable`, `data-selectable` and `data-empty`. Under it: `diagram-layer` (with `data-zoom`: `near`, `mid`, `far`), `diagram-node` (`data-node`, `data-kind`, `data-selected`, `data-current`), `diagram-node-body`, `diagram-node-label`, `diagram-node-detail`, `diagram-edges`, `diagram-edge` (`data-edge`, `data-kind`, `data-selected`, `data-current`), `diagram-edge-label`, `diagram-divider`, `diagram-port`, `diagram-edge-end`, `diagram-ring` (`data-focused` for the keyboard's), `diagram-current`, `diagram-connection` (`data-invalid`), `diagram-connection-target`, `diagram-overlay`, `diagram-empty`, `diagram-loading`, `diagram-keys` and `diagram-status`.

### `useDiagramLayout(draft, options)`

| Option | Effect |
| --- | --- |
| `host` | A ref to measure text in. |
| `direction` | `right` (the default), `down`, `left` or `up`. |
| `elk` | ELK options, over `DIAGRAM_ELK_OPTIONS`. |
| `worker` | A function that starts the worker yourself. |
| `initial` | A layout done ahead of time, to show until this one's ready. |

It returns `nodes`, `edges`, `bounds`, `status`, `error`, and `engine` and `ms`, which say where it ran and how long it took.

### The model

`@/lib/diagram-model` is plain functions on plain data, with nothing to render: `edgeGeometry`, `edgeGeometries`, `connectorPath`, `nodeAt`, `edgeAt`, `edgesAtPoint`, `moveNodes`, `deleteItems`, `checkConnection`, `addConnection`, `moveEdgeEnd`, `indexDiagram`, `labelBox`, `regionDividers` and more; the package root exports the ones an app needs (`moveNodes`, `deleteItems`, `checkConnection`, `addConnection`, `moveEdgeEnd`, `indexDiagram`, `diagramBounds`, `NOTHING_SELECTED`). `@/lib/diagram-keyboard` has `stepFocus`, `viewportToShow`, `describeNode` and `describeEdge`, `@/lib/diagram-gesture` has `stepDiagramGesture` and `hitTestDiagram`, and `@/lib/diagram-primitive` the primitive. Freeform's connectors, Interface Builder's segues and Replay Canvas's segues are drawn by the same model.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `diagramNodeVariants`

Defined in `@/components/ui/diagram`. Base classes:

```text
relative size-full
```

**`kind`** — default `node`

| Value | Adds |
| --- | --- |
| `node` (default) | `flex flex-col items-center justify-center rounded-ctl border border-border bg-card px-3 py-2 text-card-foreground shadow-hairline` |
| `final` | `flex flex-col items-center justify-center rounded-ctl border-2 border-foreground bg-card px-3 py-2 text-card-foreground outline-1 -outline-offset-4 outline-for…` |
| `initial` | `rounded-full bg-foreground` |
| `compound` | `rounded-card border border-border bg-secondary` |
| `parallel` | `rounded-card border border-dashed border-border bg-secondary` |
| `region` | `rounded-card` |
| `root` | `rounded-card border border-border` |

### `diagramEdgeVariants`

Defined in `@/components/ui/diagram`. Base classes:

```text
fill-none ${LINE}
```

**`kind`** — default `event`

| Value | Adds |
| --- | --- |
| `event` (default) | `stroke-muted-foreground` |
| `done` | `stroke-muted-foreground` |
| `invoke` | `stroke-muted-foreground` |
| `always` | `stroke-muted-foreground [stroke-dasharray:calc(5px/var(--diagram-z))_calc(3px/var(--diagram-z))]` |
| `after` | `stroke-muted-foreground [stroke-dasharray:calc(1.5px/var(--diagram-z))_calc(3px/var(--diagram-z))] [stroke-linecap:round]` |
| `initial` | `stroke-foreground` |
| `problem` | `stroke-destructive [stroke-dasharray:calc(6px/var(--diagram-z))_calc(3px/var(--diagram-z))]` |
