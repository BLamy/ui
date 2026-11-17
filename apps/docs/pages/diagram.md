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

{% demo src="diagram/statechart-like" %}

{% hint style="info" %}
**One contract for the family** (Diagram, [DiagramFrame](#/diagram-frame), [StateDiagram](#/state-diagram), [CloudflareDiagram](#/cloudflare-diagram)):

- **Read-only means select and read.** Without `editable`, a diagram is a picture you can select in and read: nothing moves, connects or is deleted. `selectable={false}` makes it a picture with no selection.
- **One selection:** `selection` / `defaultSelection` / `onSelectionChange(selection, details)`, whatever the diagram is of.
- **One history:** the diagram's own, or one you hand it as `history` ([below](#one-history)); `DiagramToolbar`'s Undo and Redo and ⌘Z / ⇧⌘Z drive whichever it is.
- **One toolbar:** `DiagramToolbar`, and a fit that leaves room for it, the minimap and a frame's bar.
- **One error:** `error`, an alert under the toolbar's row.
- **One way back** from a cover: `DiagramFrameCoverHeader`. **One field** in a panel: [Field](#/field) and [Input](#/input) with `onValueCommit`.
{% endhint %}

## The idea

A node is a box in board units, and an edge joins two of them. Everything in a diagram is plain data, so it can be saved, sent and diffed:

```tsx
const nodes = [
  { id: 'inbox', title: 'Inbox', x: 0, y: 0, w: 110, h: 36 },
  { id: 'review', kind: 'group', title: 'Review', x: 200, y: -40, w: 280, h: 140 },
  { id: 'read', parent: 'review', title: 'Read', x: 240, y: 0, w: 110, h: 36 },
]
const edges = [{ id: 'open', from: 'inbox', to: 'read', title: 'open' }]

<div className="relative h-96">
  <Diagram nodes={nodes} edges={edges} aria-label="A small workflow" />
</div>
```

Like the library's other containers, it fills the nearest positioned box. With no `viewport` it fits what's on it, and goes on fitting until the view's moved. What has the eye stays in view: what's selected, or else what's `current` (its innermost nodes, and its edges' labels), whichever changed last. When the part of the board nothing covers changes (a panel opening beside it or over it, a toolbar, a bar), or what has the eye changes or moves, the view pans by the least that brings it wholly into that part; something already in view doesn't move, and it never refits. Not while something's dragged.

**A node** has an `id`, a place and a size, and optionally:

| Field | What |
| --- | --- |
| `kind` | What it is: a `node` (the default), a `group` that holds others, a `region` (a lane of a group, with a line between it and the next), the `root` that holds everything (background: it can't be selected), or a small round `marker`. |
| `variant` | Its border: `default`, `dashed` or `double` (a hairline inside the border, in the border's color: quiet, never read as selected or focused). A statechart's final state is a `double` node and its parallel state a `dashed` group: [StateDiagram](#/state-diagram) sets those. |
| `parent` | The node it sits in. Positions are absolute, not relative to it, and it moves with its parent. |
| `title` | The header strip's words. A node with nothing but a title is just its header: small. |
| `icon` | A glyph at the start of the header: any of the kit's [icons](#/icon) by name, or a few characters, `{ text: 'H*' }`. |
| `trailing` | Short words at the end of the header, as a quiet badge (`Worker`, `parallel`). |
| `description` | A quiet paragraph under the header. |
| `sections` | Labelled sections of items under the header. See [The anatomy](#the-anatomy). |
| `entry` | The entry marker: a dot with a curved arrow into the node's corner, for where things start. |
| `tone` | A colored accent on its header: `success`, `warning`, `destructive`, `muted`. |
| `ports` | Named places on its sides, for edges to join. See [Ports](#ports-and-connecting). |
| `data` | Anything of yours, for `renderNode`. |

**An edge** has an `id`, `from` and `to`, and optionally:

| Field | What |
| --- | --- |
| `fromPort`, `toPort` | Which ports it joins. |
| `route` | `elbow`, `straight` or `curve`, when it has no `points`. |
| `points` | A route already worked out, from start to tip. |
| `title`, `icon` | Its label: a pill on the line. |
| `sections` | Items under the title, which make the label a small card. |
| `labelBox` | Where the label sits: a layout puts it on the route, and the line runs into it and out of it. Without it, a place is found on the route. |
| `forkOf` | Another edge's id, whose label this one shares: it has no label of its own, and a layout starts it from that label, along the other's line as far as the turn from which its own target is shortest. One label that forks to several targets (a transition that goes to several at once). Its `title` is still what a screen reader hears. |
| `variant` | Its line: `default`, `dashed`, `dotted` or `strong`. |
| `tone` | `destructive` for something that's wrong with it: the destructive color, and dashed as well, as a color isn't enough on its own. |

The looks say nothing about what a diagram is of. StateDiagram draws an `always` transition `dashed`, an `after` one `dotted` and where a state starts `strong`; CloudflareDiagram draws a connection that can't work `destructive`.

An edge with no `points` works out its route from where its ends are. Edges that leave the same side of a node share it out, in the order of what they lead to, so each end has a point of its own; a fan (one side with more ends than the other) turns next to its crowded end, so each edge's long run, where its label goes, is next to the end it has to itself; a node's self-loops nest, and an edge between a group and its own child runs from the nearest wall. When the ends face away from each other (a port on a card's right to a port on the left of a card to its left), the route goes around the two cards, through the gap between them or past both, never behind them. In a hand-placed diagram of up to 200 nodes and edges, a route that would run under a card, or across a box's header, goes round it instead (square, a little off its sides); not while something's being dragged. Two or more labelled edges between the same two nodes each get a lane and a label of their own (below), and a card's self-loops sit beside it as a layout's do, each with its label on it, the first on its end side, the next on its start side, outward. A card given a size too small for its words is drawn as big as they need, around the same middle (up to 200 nodes): its text never runs past its edge.

A label is an object on its edge, and part of it: pressing it presses the edge, and focus on the edge rings it. A layout puts it on the route. Without one, it goes on the middle of a straight run that holds it with room to spare (the one into its end first, then the one out of its start, then the longest), where that's clear of the nodes, the words on them and the other labels; then elsewhere on the route; then beside the line. It never sits on its own arrowhead.

**Lanes of their own.** Edges between ports (an editable system's rows, `fromPort` / `toPort`), and any hand-placed edge whose plain route would run along another's, are routed together, laid out or hand-placed (up to 120 nodes and edges): each in a lane of its own from end to end (none runs along another for more than a crossing, and none hugs a card), the cheapest by length, turns, crossings and boxes gone through, and with its label on a straight run that only its edge uses, clear of every card, route and label, which the routes after it keep clear of: the search carries whether the label's placed yet, so an edge with no room for its label on the short way goes the way that has room. Edges that share a port leave its dot side by side, a few units apart, in the order of where they go; several orders are tried, and the one with every label clear, then the fewest crossings, then the shortest, is drawn. A port that an item names sits at the end of its row that faces where its edges go (`facePorts`), so a route doesn't go round its own card; one no edge uses stays on its declared side.

{% demo src="diagram/labels" %}

## The anatomy

Everything a statechart or a system of services has to say is drawn with a few generic parts. Nothing in Diagram knows what it's a diagram of: [StateDiagram](#/state-diagram) and [CloudflareDiagram](#/cloudflare-diagram) map their models onto these.

| Part | Data | How it's drawn | A statechart's | A system's |
| --- | --- | --- | --- | --- |
| Header strip | `title`, `icon`, `trailing`, `tone` | A filled strip along the card's top: glyph, title in semibold, a quiet badge at the end | the state's name; a final state's square (`icon: 'stop'`), history's `{ text: 'H*' }` | the service's name, its product as `trailing`, its icon |
| Description | `description` | A quiet paragraph under the header | the state's `description` | a note |
| Sections | `sections: [{ title, variant, items }]` | A quiet caption over a column of items; with `variant: 'inline'`, over a row of chips that wraps at `DIAGRAM_CARD.inlineMax` (560), measured as it's drawn | Entry actions, Exit actions, Invoke, Tags | Exposes, Bindings, Triggers, Settings; what's account-wide, as a row |
| Item | `{ title, description, icon, tone, port }` | A chip (bordered, raised, leading glyph, medium weight), or with `variant: 'list'` / `'code'` a row of text (mono for `code`) | an action (`icon: 'bolt'`), a context key and its type | a handler, a binding (`port` puts its port on the row), a cron schedule |
| Container | `kind: 'group'` / `'root'` / `'region'` + the same header and sections | A frame with the header strip across its top, its sections under it on a hairline, and what it holds below | a compound or parallel state; the machine with its Context | a Worker and its Durable Object classes; the system and what's account-wide |
| Entry marker | `entry: true` | A dot and a curved arrow into the top-start corner | the initial state | where requests, schedules and messages come in |
| Edge label | edge `title`, `icon`, `sections` | A pill for a title alone, a card with the title over its chips: on the route, the line runs into it and out of it, the arrowhead at the target | an event; its actions, guard (`if canRetry`), delay (`after 500ms`, `icon: 'clock'`) | a binding's name and the operations it uses |
| Self-loop | an edge `from === to` | Laid out, a loop out of the card's side into its label beside it, and back under the label into the card's side: the first on its start side, the next on its end side, so two never cross. Unplaced, a loop out of the right side | a self-transition | a service calling itself |

{% demo src="diagram/system-like" %}

A card is sized from its real, measured content: the header, the description, each caption and item, the badge and the glyphs (`nodeSize`, `edgeLabelSize`), so a layout leaves exactly the room it needs and a container's children start under its sections.

**Pressing an item or a label.** In an `editable` diagram with `onAction`, items can be pressed: a press, or Enter on one, calls `onAction({ kind, id, section, item }, { reason, part: 'item' })`, where `section` is the section's `id` (or its index) and `item` the item's `id` (or its title). Its card is selected too. `pressable` makes things pressable read-only too: `true` for every card's chips and every edge's label, or a selection, `{ nodes, edges }`, for the chips of those nodes and the labels of those edges as a whole (a simulation's transitions it can take now). A pressable label has a primary ring two lines thick and a play badge on its corner, so it isn't told by color alone; a press on it calls `onAction({ kind: 'edge', id }, { reason: 'press', part: 'label' })`, and Enter on its edge, which says so to a screen reader when its `describeEdge` does, calls it with `enter-key`. Otherwise items are words, and nothing more is a tab stop.

**Restyling.** `DiagramNodeBody` draws all of it, and takes `className`; for a card laid out your own way, `renderNode` can compose `DiagramNodeHeader`, `DiagramSections` and `DiagramEntryMarker`. The chips are `diagramItemVariants`, the labels `diagramEdgeLabelVariants`, and every part has a `data-slot` to aim a selector at (below).

Lines and arrowheads keep their thickness on screen at any zoom. Text that would be too small to read hides: an edge's label below 40%, and a node's below 25%. It's the same `Canvas` underneath, so scrolling pans, a pinch or ⌘-scroll zooms, and ⌘0 fits.

**Where it opens.** Until the view's moved, a diagram shows all of itself, centered, when that can be read: never past 100%, and never below 87.5%, where a chip's 12 px words are about 11 px and a title's over 11. One that can't be seen whole at that size opens at 87.5% from its **top-start corner**, centered across when its width fits: what a machine or a system says about itself (its name, its Context, what's account-wide) is there, and the rest is a scroll, a drag, ⌘0 or a press on the minimap away. Only on a board too narrow for that to show much (under 420 px: a phone's) does it open with where it starts (its first entry marker) in the middle instead, when the corner would leave that out of view. All of this is worked out in the part of the board nothing covers: clear of a `DiagramToolbar`, the minimap, a `DiagramFrameBar` and a DiagramFrame's drawer, which say how much room they take as they're drawn; and as that changes (a panel opening as a column beside the board, or a drawer over it, and closing), the view follows, until it's moved. What has the eye (below) is kept in that part from the first view on.

**The minimap.** `minimap` puts `CanvasMiniMap` in a corner. `minimap="auto"` (StateDiagram's and CloudflareDiagram's default) puts it there only while a good part of the diagram is out of view at a readable size (a whole fit would be under 70%), on a board with room for it (720 × 600 px or more: not a phone's, nor a docs page's fence), above a frame's bar: the rest of a big diagram is then one press away, on the minimap or on Fit.

## Laying it out

`useDiagramLayout` takes the same nodes without their places and sizes. It measures every part of every card in the real font, and ELK places them in a Web Worker, so even 2,000 nodes don't stop the page. It runs **top to bottom** unless you pass `direction` (`down`, `right`, `up`, `left`): that's what reads on a portrait frame, a phone and a column of docs, and about ten states with their actions fit 800 × 1000 at about 90%. `density` (`compact`, `default`, `comfortable`) sets the room between things, inside every box as on the board: `compact` for big generated graphs. Routes are square with rounded corners and keep off the cards and apart from each other; an edge that goes back up leaves and comes in at the sides, round the rest; labels sit on their routes; an `entry` node comes first in what holds it; a leaf's self-loops sit beside it, their labels on its sides. A box is at least as wide as its own header and sections. An edge from a box to what it holds starts at a dot on the hairline under its sections, so where it comes from is drawn; one from a box with sections to something outside it leaves from the box's side, beside its sections (what it belongs to), not from under what it holds; and one from outside to something in a box comes in under its header and sections, through its side wall, never across them (routed again with its label, in a lane of its own, when ELK had brought it in through the header). An edge with `forkOf` starts from the label it shares (above). Edges between ports that items name (a card's rows) are routed again once ELK has placed everything, in lanes of their own (below). Up to 120 nodes, ELK places them with network simplex, which straightens and balances the most; past that, with its default, as network simplex costs 7 times as much at 300 nodes.

**Filling the board.** `useDiagramLayout` measures its `host` (the board), and fits the drawing to its shape without laying it out again: parts that nothing joins (an environment of its own) go side by side on a wide board and one under the other on a tall one, the biggest first, each from the top; and a long run (a pipeline) wraps into columns where they make it readable whole, or (when nothing can) into as many as fit across at a readable size, so there's one way to scroll. An edge that crosses from one column to the next is routed again between where its two cards ended up, by the shortest of foot to head, side to side and side to foot, in a lane of its own, with its label on the run across (the gap between two columns is as wide as that label needs): it never goes down its column, round the drawing and back up. Each column's head is level with the first's. A phone's board keeps one column, read by scrolling. It wraps again as the board changes size by a good deal (and not for a graph of more than 300 nodes, which is explored rather than read whole). `board: { width, height }` gives a size of your own, and `null` never wraps; `layoutDiagram` and `wrapDiagram(laid, board, direction)` do the same without React.

{% demo src="diagram/layout" %}

```tsx
import { useDiagramLayout } from '@/lib/diagram-layout/react'

function Map({ draft }) {
  const host = useRef(null)
  const laid = useDiagramLayout(draft, { host })
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

`autoSize` sizes each node to its content, around its center, for when you've got your own positions: a hand-placed diagram gets the same cards, rounded routes and labels on them as a laid-out one.

{% demo src="diagram/sized-text" %}

Words are measured by the browser's own text layout, in an element that can't be seen, with the same classes they're drawn with, so long names, names with no spaces and CJK come out right. Past 216 px they wrap. Text is measured again if the words change, a font arrives late, or a hidden tab's shown.

{% hint style="info" %}
**A server can't use the same sizes.** It has no fonts, and can't know which of the stack a browser will pick. `estimateText` goes by typical letter widths, and in a test on 77 labels it was off by a median of 8%, from -4% to +24%. The hydrating client starts from the same estimate, so there's no mismatch, then measures, and only moves things if the sizes came out different. An app that wants no move at all gives nodes fixed sizes and leaves `autoSize` off.
{% endhint %}

## Editing

Give it `editable`, and the pointer selects, moves and deletes, with undo. It's one gesture, a state machine that doesn't care about the view (`@/lib/diagram-gesture`), so a pinch, Space or Escape drops whatever's going on cleanly.

{% demo src="diagram/editing" %}

Shift or ⌘ adds to the selection, and a drag from nothing draws a marquee, which takes a leaf it touches and a group only if all of it's inside. Moving lines up with what's nearby, unless you hold ⌘. Edges keep their shape and stay square as they follow, a group's children go with it, and a group grows when a child's dragged to its wall.

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

`DiagramToolbar` is a floating [Toolbar](#/toolbar) for `overlay`: zoom out, zoom in and fit, and undo and redo when the diagram has a history. Each tool's tooltip names its shortcut, and the toolbar is one tab stop after the board. Put your own `ToolbarButton`s in it as children. It floats at the foot of the board, or at the top in a DiagramFrame (whose foot is the frame's bar), and a fit leaves room for it.

### One history

An `editable` diagram keeps a history of its own data. A diagram drawn from something bigger keeps the history of *that* instead: StateDiagram's machine config, CloudflareDiagram's system, where an edit in a panel is undone by the same ⌘Z as a drag on the board. Hand it to the diagram as `history`, and the diagram keeps none of its own: ⌘Z, ⇧⌘Z and ⌘Y (from the board or its toolbar, not from a field), `DiagramToolbar`'s Undo and Redo, a controller's `undo()` and an agent all drive it.

```tsx
const [config, setConfig] = useState(machine)
const history = useDiagramHistory(config, (to) => setConfig(to))

const rename = (next) => {
  history.record(config, next) // before, after
  setConfig(next)
}

<Diagram nodes={…} edges={…} editable history={history} overlay={<DiagramToolbar />} />
```

`useDiagramHistory(value, onChange, { limit, isEqual })` is a snapshot history of `value`: `record(before, after)` after an edit you made, and undo and redo call `onChange(value, { reason, event })` with the step to show, which can refuse it by returning `false`. A `value` that arrives from outside (neither an edit recorded there nor a step undone to) starts it over. Any object with `canUndo`, `canRedo`, `undo()` and `redo()` will do as a `history`.

### From outside, and for agents

The data, the selection and the history are one primitive, so a controller drives it from anywhere, and an agent sees the same actions:

```tsx
const [diagram] = useState(createDiagramController)

<Button onClick={() => diagram.deleteSelection()}>Delete</Button>
<Diagram controller={diagram} editable … />
```

`select(selection)`, `selectAll()`, `clearSelection()`, `deleteSelection()`, `moveNodes(ids, dx, dy)`, `connect({ from, to, fromPort?, toPort? })` (it returns the reason when `isValidConnection` refuses), `undo()`, `redo()`, `canUndo()`, `canRedo()`, `getData()` and `getSelection()`. Each goes through `onDataChange` or `onSelectionChange`, which can refuse it. Inside the diagram's `overlay`, `useDiagram()` gives `{ diagram, canvas, history, zoom }`: the same methods, the board's view controller, the history that's in charge (or null) and the zoom.

## The keyboard

The diagram is one tab stop, the board, and the keys go from there. The board's description says which keys do what (`aria-describedby`), every node and edge can be reached, and each says what it is and what it connects to, such as "Triage, node. 2 going out: done to Archive, open to Read. 1 coming in: sort from Inbox." `describeNode` and `describeEdge` replace those. The view follows the focus, moving as little as it can.

What has focus, what's selected and what's current are drawn three ways, none of them by color alone (the theme's focus and selection colors are one blue), each the same thickness on screen at any zoom. As in the kit's rows, a selected node has a tint and a line on its edge (a group only the line), and focus is a ring outside it past a gap, so a node that's both has both. A focused edge has a wide band under it; a selected one is drawn thicker in the selection color. What's current has a bar along its start side.

{% demo src="diagram/focus" %}

| Key | Does |
| --- | --- |
| Tab | To the diagram, and on out of it. |
| Arrows | To a neighbour that way, along an edge if one goes that way, or else to whatever's nearest that way. On an edge, to either end. |
| `[` and `]` | Through a node's edges, and from an edge to the next one from the same node. |
| Alt + ↓ and ↑ | Into a card's or an edge label's items, when they can be pressed, and then into what a node holds; out again to what holds it. |
| On an item: arrows, Enter, Escape | To the next or the last item of the same card or label; presses it (`onAction` with `reason: 'enter-key'`); back to its card. Focus stays on the card, the item gets the ring, and it's said aloud ("onPause, Entry actions, in Paused"). |
| Page Down, Page Up | Through every node and edge in turn. |
| Home, End | The first and last node. |
| Enter | Selects what's focused and calls `onAction(item, details)`, as a double click does. |
| Shift + Enter | Adds it to the selection, or takes it out. |
| ⌘ + arrow | Moves the view. ⌘ + − 0 1 zoom, as on `Canvas`. |
| Shift + arrow | Nudges what's selected, or what's focused, by 8. By 1 with Alt. |
| Delete | Deletes what's selected, or what's focused. |
| ⌘Z, ⇧⌘Z (⌘Y) | Undo and redo, of the diagram's history or the one it was handed. |
| ⌘A | Selects everything. |
| C | Starts a connection. See below. |
| Escape | Out of an item, then drops what's going on, then the selection, then goes back to the diagram. |

Those that edit need `editable`. Those that select need `selectable`, which is on unless you turn it off, read-only too. On Windows and Linux, ⌘ is Ctrl, and the board's description says so.

## Ports and connecting

A port is a named place on a node's side, and an edge can join two of them: `at` says how far along the side, as a share of it, or `offset` in board units from its top or left end, for a port that stays where it is however tall its node grows (on a header strip). With `connectable`, which `editable` turns on, a drag from a port draws a connection, which snaps to the nearest port within 24 px on screen, even one under another node. Ports at the same place are one place to connect: the connection is offered between the first of them `isValidConnection` takes, and so is one dropped on a node rather than a port (its first port that's allowed), with the reason the first would have been refused when none is. A node with no ports gets one on each side once it's the only thing selected, and a selected edge has a handle on each end to move it.

{% demo src="diagram/connecting" %}

```tsx
const nodes = [{
  id: 'worker', label: 'Worker', x: 0, y: 0, w: 130, h: 80,
  ports: [{ id: 'db', side: 'right', at: 0.25, kind: 'sql', label: 'DB', direction: 'out' }],
}]

<Diagram editable nodes={nodes} edges={edges} onDataChange={save} isValidConnection={(c) => c.to !== 'locked' || 'That one is locked.'} />
```

`isValidConnection` returns true, false, or the reason in words. While dragging, an invalid target turns the line and the target the destructive color, dashed (so it's never color alone), and says why, and it refuses on release. Without one, `checkConnection` keeps to the ordinary rules: a port can't connect to itself, nothing's connected twice, a connection goes the way its ports' `direction` goes, and ports of a `kind` only join that kind. A self-loop's fine. `createEdge` makes the edge for a new connection, and the default has only its ends and an id.

A port's `side` is `top`, `right`, `bottom` or `left`: physical words, not `start` and `end`, as a board doesn't mirror in a right-to-left language. Its dot is the same size on screen until the board's fitted so far out that dots would crowd their node (a phone's view of a big system); from there it shrinks with the board.

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

Zooming restyles as little as it can. The board doesn't carry the zoom as a CSS variable (its Canvas has `zoomVariable` off), as a variable that changes restyles everything under it, every frame: at 2,000 nodes that was 85 ms a frame of zooming, and it's 8.3 ms. Lines and rings keep their thickness from a zoom that moves in steps of about 9%, and `children` get `--canvas-zoom` the same way, so a Canvas overlay part there is within about 4.5% of its thickness on screen. Measuring a large layout's words, a frame's worth at a time, adds nothing to the page around it.

## A panel beside it

[DiagramFrame](#/diagram-frame) puts a panel beside a board: a column when there's the room, a drawer that doesn't dim the board at medium sizes, and a page pushed over it on a phone, with a bar on the board to open it. It's what `StateDiagram` and `CloudflareDiagram` are made of. In a frame, the toolbar goes to the top by itself, and the first fit (and ⌘0) leaves room for it and for the bar.

```tsx
<DiagramFrame>
  <DiagramFrameBoard>
    <Diagram nodes={nodes} edges={edges} />
    <DiagramFrameBar>{selected?.label}</DiagramFrameBar>
  </DiagramFrameBoard>
  <DiagramFramePanel title="Inspector"><Inspector /></DiagramFramePanel>
</DiagramFrame>
```

## Empty, loading and errors

With no nodes, the shared [EmptyState](#/empty-state) shows over the board ("Nothing here yet"); `emptyState` replaces it (a string is its title, an `<EmptyState>` with an `action` adds a way out, `null` shows nothing). While `loading` (a layout's running), a status says so instead, and there's no empty state. `error` says why it can't be drawn: an alert over the board, under the toolbar's row, in place of the empty state.

## Accessibility

- The root is a `group` named by `aria-label`, with `aria-roledescription="diagram"`; the board inside is the one tab stop, an `application` named "<name> board" and described by its keys.
- Every node and edge is a `button` (out of the tab order: the keys move to it) whose name says what it is and what it connects to. Selected ones have `aria-pressed="true"` when the diagram is `selectable`; current ones `aria-current="true"`.
- Each step of connecting by keyboard, a refusal and its reason, and a delete are announced in a polite status. A refused connection is drawn dashed as well as in the destructive color.
- Focus never falls out: when what has focus is deleted, it goes to what's nearest. Escape drops a gesture, then the selection, then goes back to the board.
- Nothing animates: the view moves when you move it, so there's nothing for reduced motion to turn off.
- Focus, selection and what's current are told apart by shape (a ring past a gap, a tint and a line, a bar), not only by color.
- Dark mode is the theme's tokens: lines are `muted-foreground`, selection `primary`, focus `ring`, problems `destructive`. Node details and edge labels are the foreground at 70%, which passes AA on a card in both appearances.

## Server rendering

`renderToString` draws it all, with no browser, and it hydrates with no mismatch: tested in TanStack Start and Next.js. With `useDiagramLayout`, pass a layout done ahead of time as `initial`, or the server draws nothing until the client's laid it out, as ELK's answer takes a while.

## API

### `<Diagram>`

| Prop | Default | Effect |
| --- | --- | --- |
| `nodes`, `edges`, `onDataChange(data, details)` | — | Controlled data. `details.reason`: `move`, `delete`, `connect`, `reconnect`, `undo`, `redo`; `details.cancel()` refuses it. |
| `defaultNodes`, `defaultEdges` | — | Data left to the diagram. |
| `editable` | `false` | The pointer and the keys move, connect and delete, with undo. |
| `movable` | `editable` | Whether dragging and ⇧ with an arrow move things, for when where they are isn't up to you. |
| `selectable` | `true` | Selecting, one at a time or with a marquee, read-only too. `false` for a picture with no selection. |
| `connectable` | `editable` | Drawing connections, and moving an edge's ends. |
| `history` | its own, when `editable` | A history to drive instead of its own (`useDiagramHistory`): ⌘Z, ⇧⌘Z, ⌘Y, the toolbar, the controller and agents undo and redo it. |
| `portsOnly` | `false` | Connect only from named ports: no places to connect on a node without any, and no moving an edge's ends. |
| `isValidConnection` | `checkConnection` | True, false or the reason. |
| `createEdge` | an id and its ends | The edge for a new connection. |
| `selection`, `defaultSelection`, `onSelectionChange(selection, details)` | nothing | What's selected, as `{ nodes, edges }`. `details.reason`: `press`, `marquee`, `keyboard`, `select-all`, `escape-key`, `delete`, `imperative`. |
| `current` | nothing | Where things are now, apart from what's selected, as `{ nodes, edges }`: where a machine is, and how it got there. Written as `aria-current` and `data-current`. |
| `onAction(item, details)` | — | Enter on what's focused, a double click, or a press on what can be pressed. `item` is `{ kind: 'node' \| 'edge', id }`, with `section` and `item` for an item; `details` (`DiagramActionDetails`) has `reason` (`enter-key`, `double-click` or `press`) and, for a press, `part`: `label` or `item`. Given in an editable diagram, it makes items pressable. |
| `pressable` | chips, when `editable` and `onAction` | What a press acts on, read-only too: `true` for every card's chips and every edge's label, or `{ nodes, edges }` for the chips of those nodes and the labels of those edges as a whole. A pressable label has a primary ring and a play badge. |
| `controller` | — | From `createDiagramController()`: select, delete, connect, move, undo and redo from outside. |
| `emptyState` | `<EmptyState>` | What shows with no nodes. |
| `loading` | `false` | The data isn't here yet: a status, and no empty state. |
| `error` | — | Why it can't be drawn: an alert under the toolbar's row, in place of the empty state. |
| `autoSize` | `false` | Size each node to its content (header, description, sections), around its center. |
| `cull` | above 200 | Draw only what's near the view. |
| `minimap` | `false` | `CanvasMiniMap` in a corner, or its props (`side`, `align`); `'auto'` only while a good part of the diagram is out of view at a readable size, on a board of 720 × 600 px or more. |
| `renderNode` | `DiagramNodeBody` | Draws a node's insides. Keep it stable, as nodes memoize on it. |
| `describeNode`, `describeEdge` | what it connects to | What a screen reader says. |
| `noun` | `node` | What a node is called, in what's said: a state, a service. |
| `viewport`, `defaultViewport`, `onViewportChange(viewport, details)` | where it opens | As on `Canvas`. Left out: all of it when it can be read, else from its top at 87.5% (see "Where it opens"). |
| `fitPadding` | `24` | Air around what's fitted, in px, for where it opens and ⌘0: one number, or `{ top, right, bottom, left }`. The toolbar, the minimap and a frame's bar are added to it. |
| `background`, `panning`, `autoFocus` | as on `Canvas` | Passed to it: `background` is `dots` (the default), `grid` (quiet lines, the board the anatomy demos use) or `none`. A resting cursor is a class: `className="cursor-crosshair"`. |
| `overlay` | — | Over the board in screen space, outside its keys: a `DiagramToolbar`, a status. `useDiagram()` works here. |
| `children` | — | More of the board layer. `useCanvas` works here, and `--canvas-zoom` is set (in steps) for Canvas overlay parts. |
| `aria-label` | "Diagram" | Its name; the board is "<name> board". |
| `className`, `style`, `ref` | — | Merged onto the root. |

### `<DiagramToolbar>`

| Prop | Default | Effect |
| --- | --- | --- |
| `side`, `align` | `bottom` (`top` in a DiagramFrame), `start` | Where it floats over the board. A fit leaves room for it. |
| `variant`, `size` | `floating`, `sm` | As on `Toolbar`. |
| `children` | — | More tools after its own. |
| `aria-label` | "Diagram tools" | Its name. |

### `<DiagramNodeBody>`

How a node looks by its `kind` and `variant`, with its header strip, description and sections: what `renderNode` draws by default. Use it in your own `renderNode` to add to the node rather than replace it.

| Prop | Default | Effect |
| --- | --- | --- |
| `node` | — | The node it draws. |
| `pressable`, `focusedItem` | the diagram's | Whether its items can be pressed, and which one the keys are on (`section\0item`). Inside a Diagram they come from it. |
| `children` | — | More inside the card, after its sections. |
| `className`, `style` | — | Merged onto the body. |

`DiagramNodeHeader` (`node`, `children`, `className`) is the header strip on its own, `DiagramSections` (`sections`, `owner`, `pressable`, `focused`, `className`) the sections, and `DiagramEntryMarker` the marker, for a `renderNode` that arranges a card its own way.

```tsx
const renderNode = (node) => (
  <DiagramNodeBody node={node}>
    {node.data?.failing ? <Badge tone="destructive" size="sm">failing</Badge> : null}
  </DiagramNodeBody>
)
```

### `useDiagramHistory(value, onChange, options)`

| | |
| --- | --- |
| `value` | What the history is of: what's shown now. |
| `onChange(value, details)` | Show the step undone or redone to. `details.reason` is `undo` or `redo`; return `false` to refuse it. |
| `options` | `limit` (100 steps), `isEqual` (`Object.is`: how it tells its own changes from one from outside). |
| returns | `{ canUndo, canRedo, undo(event?), redo(event?), record(before, after), reset() }`, for `<Diagram history>`. |

### Data attributes

The root is `data-slot="diagram"` with `data-editable`, `data-selectable` and `data-empty`. Under it: `diagram-layer` (with `data-zoom`: `near`, `mid`, `far`), `diagram-node` (`data-node`, `data-kind`, `data-variant`, `data-selected`, `data-current`), `diagram-node-body`, `diagram-node-header` (`data-tone`), `diagram-node-icon`, `diagram-node-title`, `diagram-node-trailing`, `diagram-node-description`, `diagram-node-content`, `diagram-sections`, `diagram-section` (`data-section`, `data-variant`), `diagram-section-title`, `diagram-item` (`data-section`, `data-item`, `data-tone`, `data-pressable`, `data-focused`), `diagram-entry`, `diagram-edges`, `diagram-edge` (`data-edge`, `data-variant`, `data-tone`, `data-selected`, `data-current`), `diagram-edge-focus`, `diagram-edge-label` (`data-variant`: `pill` or `card`; `data-selected`, `data-focused`, `data-current`, `data-pressable`, with its badge `[data-part=press]`), `diagram-edge-label-title`, `diagram-divider`, `diagram-port`, `diagram-edge-end`, `diagram-ring` (`data-focused` for the keyboard's, `data-selected`), `diagram-current`, `diagram-connection` (`data-invalid`), `diagram-connection-target`, `diagram-overlay`, `diagram-empty`, `diagram-loading`, `diagram-error`, `diagram-keys` and `diagram-status`.

### `useDiagramLayout(draft, options)`

| Option | Effect |
| --- | --- |
| `host` | A ref to measure text in, and the board to fill: its size decides how the drawing wraps. |
| `board` | `{ width, height }` of your own instead of the host's; `null` never wraps. |
| `direction` | `down` (the default), `right`, `left` or `up`. |
| `density` | `default`, `compact` or `comfortable`: the room between things. |
| `elk` | ELK options, over `DIAGRAM_ELK_OPTIONS`. |
| `worker` | A function that starts the worker yourself. |
| `initial` | A layout done ahead of time, to show until this one's ready. |

It returns `nodes`, `edges`, `bounds`, `status`, `error`, and `engine` and `ms`, which say where it ran and how long it took. `layoutDiagram(draft, options)` takes the same, and `board` too.

### The model

`@/lib/diagram-model` is plain functions on plain data, with nothing to render: `edgeGeometry`, `edgeGeometries`, `connectorPath`, `nodeAt`, `edgeAt`, `edgesAtPoint`, `moveNodes`, `deleteItems`, `checkConnection`, `addConnection`, `moveEdgeEnd`, `indexDiagram`, `labelBox`, `regionDividers` and more; on npm it is `@brett_lamy/ui/lib/diagram-model` (the package root has only the data types Diagram's props take: `DiagramNode`, `DiagramEdge`, `DiagramSelection`…). `@/lib/diagram-keyboard` has `stepFocus`, `viewportToShow`, `describeNode` and `describeEdge`, `@/lib/diagram-gesture` has `stepDiagramGesture` and `hitTestDiagram`, and `@/lib/diagram-primitive` the primitive. Freeform's connectors, Interface Builder's segues and Replay Canvas's segues are drawn by the same model.

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
| `node` (default) | `flex flex-col overflow-hidden rounded-ctl border border-border bg-card text-card-foreground shadow-hairline` |
| `group` | `flex flex-col overflow-hidden rounded-card border border-border bg-secondary/35 text-card-foreground` |
| `region` | `flex flex-col rounded-card text-card-foreground` |
| `root` | `flex flex-col overflow-hidden rounded-card border border-border bg-background/60 text-card-foreground` |
| `marker` | `rounded-full bg-foreground` |

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `dashed` | `border-dashed` |
| `double` | `outline-1 -outline-offset-4 outline-border` |

### `diagramEdgeVariants`

Defined in `@/components/ui/diagram`. Base classes:

```text
fill-none ${LINE}
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `stroke-muted-foreground` |
| `dashed` | `stroke-muted-foreground [stroke-dasharray:calc(5px/var(--diagram-z))_calc(3px/var(--diagram-z))]` |
| `dotted` | `stroke-muted-foreground [stroke-dasharray:calc(1.5px/var(--diagram-z))_calc(3px/var(--diagram-z))] [stroke-linecap:round]` |
| `strong` | `stroke-foreground` |

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `destructive` | `stroke-destructive` |

1 compound variant — see the source.

### `diagramItemVariants`

Defined in `@/components/ui/diagram`. Base classes:

```text
flex max-w-full min-w-0 items-center gap-1.5
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `rounded-md border border-border bg-background px-2 py-0.5 text-foreground shadow-hairline` |
| `list` | `text-foreground` |
| `code` | `text-foreground` |

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `[&_[data-part=glyph]]:text-muted-foreground` |
| `success` | `border-success/40 [&_[data-part=glyph]]:text-success` |
| `warning` | `border-warning/50 [&_[data-part=glyph]]:text-warning` |
| `destructive` | `border-destructive/40 text-destructive [&_[data-part=glyph]]:text-destructive` |
| `muted` | `text-muted-foreground [&_[data-part=glyph]]:text-muted-foreground` |

**`pressable`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `pointer-events-auto cursor-pointer motion-safe:transition-colors hover:bg-accent active:bg-secondary-strong` |
| `false` (default) | — |

1 compound variant — see the source.

### `diagramEdgeLabelVariants`

Defined in `@/components/ui/diagram`. Base classes:

```text
absolute border border-border bg-card text-card-foreground shadow-hairline
```

**`variant`** — default `pill`

| Value | Adds |
| --- | --- |
| `pill` (default) | `flex items-center justify-center gap-1 rounded-full px-2.5 py-1 whitespace-nowrap` |
| `card` | `flex flex-col items-start gap-1.5 rounded-ctl px-2.5 pt-1.5 pb-2` |
