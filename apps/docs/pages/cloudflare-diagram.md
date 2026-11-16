# CloudflareDiagram

Cloudflare's services on a [Diagram](#/diagram), for drawing, checking and editing a system built on Workers: a Worker and the buckets, queues, databases and Durable Objects it binds. Each service is a node with what it can call and receive as ports, from a catalog generated from Cloudflare's own docs, Wrangler's config schema and the Workers types. A connection can only be one the catalog says there is: a Worker to R2 offers R2's real methods, and R2 to D1 is refused, with why.

**When to use something else.** Use a [Diagram](#/diagram) for boxes and lines that aren't Cloudflare's services: it has no catalog, so it allows any connection and says nothing about what crosses it. Use a [StateDiagram](#/state-diagram) for one XState machine on its own. CloudflareDiagram is a Diagram with the catalog's rules, a panel that explains each service and connection, and a StateDiagram for any service's machine, over the board. It isn't a `variant` of Diagram, as what it adds is data and rules (the catalog, a system, what's wrong with it), not a look.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/cloudflare-diagram.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { CloudflareDiagram } from '@brett_lamy/ui/cloudflare-diagram'
```
{% endtab %}
{% endtabs %}

On npm, everything on this page is also on one entry, `@brett_lamy/ui/cloudflare`: the diagram, the catalog, a system, `wrangler.jsonc` and workerd. Nothing Cloudflare's is in the main entry, `@brett_lamy/ui`, as the catalog is about 150 KB (26 KB gzipped): an app that doesn't draw Cloudflare's services never gets it. `tools/cloudflare/check-package.mjs` checks both, in the built package.

{% hint style="info" %}
**No Cloudflare logos or artwork.** [Cloudflare's trademark page](https://www.cloudflare.com/trademark/) asks for written permission to use their logos and product icons, so this has none: services are named in words, drawn with the library's own icons, and an `icon` prop lets an app that has its own permission draw Cloudflare's. The same check looks for any of Cloudflare's images, by hash and by SVG path, in the package, the registry and these demos. Cloudflare is a trademark of Cloudflare, Inc., which doesn't endorse this library.
{% endhint %}

## The catalog, a system, `wrangler.jsonc` and a workerd config

Four things, and how they fit:

| What | Is | Where it comes from |
| --- | --- | --- |
| **The catalog**, `CLOUDFLARE_CATALOG` | What Cloudflare has, and what can reach what: 195 products, 41 binding keys with their runtime types and methods, the handlers a Worker can export | Generated from pinned upstream versions; you don't write it |
| **A system**, `{ services, edges }` | Your services, what each is bound as, which have a machine, and which events cross which connection. Plain data, saved as JSON | You, on the board, or read from one of the two below |
| **`wrangler.jsonc`** | One Worker's config | `readWrangler` reads it into a system; `writeWrangler` writes a system's bindings back to it, changing only what changed |
| **A workerd `config.capnp`** | A whole workerd process: its Workers and what they bind | `readWorkerdConfig` reads it into a system; it's only read |

The diagram draws a system, and checks it against the catalog. `kind` on a service is a product's id in the catalog, and `via` on an edge is a binding key or a row of what a Worker can receive.

## A system's services

{% demo src="cloudflare-diagram/upload" %}

```tsx
const services = [
  { id: 'api', kind: 'workers', label: 'API' },
  { id: 'files', kind: 'r2', label: 'Files' },
]
const edges = [
  { id: 'upload', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put', 'get'] },
]

<div className="relative h-96">
  <CloudflareDiagram services={services} edges={edges} />
</div>
```

It's **read-only** unless it's `editable`, the same prop as Diagram's and StateDiagram's: a picture to inspect, where selecting a service or a connection shows what it is in the panel, and nothing moves, connects or is deleted. With no `at` on any service they're laid out by ELK, an optional peer. With a place for any of them, they stay where they say, and those without one go in a column to the right. Once something's moved, each has one, which saves as plain data and needs no ELK.

## Editing

{% demo src="cloudflare-diagram/connect" %}

```tsx
// Uncontrolled: the diagram keeps the system, and says what it is after each change.
<CloudflareDiagram editable defaultServices={services} defaultEdges={edges} onDataChange={(system, details) => save(system)} />

// Controlled: what you pass back is what it shows.
const [system, setSystem] = useState({ services, edges })
<CloudflareDiagram editable services={system.services} edges={system.edges} onDataChange={setSystem} />
```

With `editable`, the panel has a search of the catalog (a Combobox: type, then pick, or press Enter for the first), and the toolbar over the board has undo and redo, with ⌘Z and ⇧⌘Z on the board. Drag from a port on the right of one service to a port on the left of another to connect them. `onDataChange(system, details)` has the whole system and `details.reason`: Diagram's `move`, `delete`, `connect`, `reconnect`, `undo` and `redo`, or `edit` for the panel and a machine, and `add` for the search. `details.cancel()` refuses a change when uncontrolled. Undo covers the board, the panel and the machines together; a new system from outside starts its history over.

| What's joined | How it says so | What's on offer |
| --- | --- | --- |
| `env`, on anything that runs code, to a binding | `via`: the binding key, like `r2_buckets` | The methods of its runtime type, from the Workers types |
| Something that sends, to the handler it sends to | `via`: the row of `receives`, like `queue-consumer` | Nothing to choose: it's what the handler's for |
| `events`, on what publishes them, to a Queue | `via: 'events'` | Its event types, and R2's event categories |
| `env` on a Durable Object, to a Container | `via: 'surface:Container'` | The methods of `Container`, reached through `DurableObjectState.container` |

Only something that runs code has an `env`, so only it can have bindings: Workers, Durable Objects, Workflows, Pages, Agents, Dynamic Workers and Workers for Platforms. Anything else is refused as you drag, and the reason is said where you let go. The same two can be connected again, under a binding name of its own. A binding name is checked as you commit it: one that can't be on `env`, or that's already on that Worker, is refused, with why, and nothing changes.

## A system, and what's wrong with it

{% demo src="cloudflare-diagram/system" %}

```tsx
import { parseSystem, systemToJson, validateSystem } from '@brett_lamy/ui/cloudflare'

const text = systemToJson(system)
const { system: back, issues } = parseSystem(text)
```

`parseSystem` never throws, as a file can have been edited by hand. What it can't use is left out and said, and what's left can still be drawn. The diagram lists what `validateSystem` finds in its panel, each with a way to it, and draws what's wrong in the destructive color, so a system with something wrong can still be looked at and put right.

| What it says | How much it matters | When |
| --- | --- | --- |
| `edge-not-real` | Wrong, and drawn as wrong | A connection the catalog says there isn't, with why not |
| `edge-end` | Wrong, and listed, as it has nowhere to be drawn | A connection to or from a service that's gone. One that carries events stays when its service is deleted, so that something says a machine's still sending there |
| `event-not-received` | Wrong, and drawn as wrong | An event on a connection that the first machine it reaches has no transition for. It goes past what has no machine, like a Queue, and `*` and `error.*` count as they do in XState |
| `event-no-machine` | A note | An event with no machine past that connection at all |
| `operation` | Wrong, and drawn as wrong | A method that isn't on offer across that connection |
| `binding-name` | Wrong, or a note when there's no name yet | Something that can't be a name on `env`, or a name used twice on one Worker. A name only has to be its own on each Worker, as each has its own `env` |
| `machine` | Wrong, and drawn as wrong | What XState says about a machine, which is only checked if `xstate` is installed |
| `machine-no-code`, `machine-code` | A note | A machine on something that doesn't run code, or with code in its config, which JSON can't hold |
| `unknown-kind` | A note | A kind that isn't in the catalog, which could only be newer than it |

A service's machine opens in a [StateDiagram](#/state-diagram), over the board, to run and, with `editable`, to change. What's changed there is checked here as soon as you've made the change, and it's one history with everything else.

{% demo src="cloudflare-diagram/two-systems" %}

Two systems can have a service in common. Each is a document of its own, so taking it out of one, or changing its machine there, leaves the other as it was, and `sharedServices(a, b)` says what they share, and whether their machines agree.

## A system and `wrangler.jsonc`

{% demo src="cloudflare-diagram/wrangler" %}

It reads a Worker's config into a system, writes a system's bindings back to that file, and says where the two differ. It's files only: nothing's deployed, and no account comes into it. From the registry it's an item of its own, `cloudflare-wrangler`, as not every app wants `jsonc-parser`.

```tsx
import { compareWrangler, readWrangler, writeWrangler } from '@brett_lamy/ui/cloudflare'

const read = readWrangler(text)
if (read.ok) {
  // read.system, read.worker, read.envs, read.settings, read.notes
}

const compared = compareWrangler(text, system)
// compared.differences: { kind, key, name, was?, now?, message }[]

const written = writeWrangler(text, system)
// written.text, written.differences, written.needs, written.skipped
```

**Writing changes only what changed.** It edits the file's text, and doesn't print a copy of what it read, so the rest of the file, its comments and how it's laid out stay as they are, byte for byte. A config with nothing to change comes back identical, line endings, tabs, trailing commas and all. A comment only goes if it was inside what's been taken out.

| What's in the config | What it is in a system |
| --- | --- |
| The Worker, from `name` | A service of kind `workers`, or `pages` with `pages_build_output_dir` |
| A binding the catalog says reaches something | A service for what's behind it, with its name as `resource`, and an edge with its name as `binding`. Two bindings to one bucket are one service, with two edges |
| A consumer, in `queues.consumers` | An edge from the queue to the Worker, `via: 'queue-consumer'` |
| `vars`, `assets`, `ratelimits` and what else is a Worker's own | Not drawn, as they don't reach anything. They're in `read.settings`, by name, and stay in the file |
| A binding the catalog doesn't know | Not drawn, as it isn't anything to guess at. It's in `read.notes`, by name, and stays in the file |

- **`env` sections.** Bindings aren't inherited, so `{ env: 'staging' }` reads and writes that section and nothing else. Without one it's the top level, and `read.notes` says what wasn't read.
- **A new binding** gets what a system can say. What it has to have that a system doesn't, like a Vectorize index's name, or a migration for a new Durable Object's class, is in `written.needs`, for you to fill in.
- **A connection that isn't real** isn't written, and it's in `written.skipped`, with why. What a config doesn't hold, like a machine, or where things are on the board, is left out of it.
- **A label's only what it's called on a diagram.** It's `resource` that says which bucket it is.
- **A config for one Worker.** With more than one in the system, `{ worker }` says which, and it says so if it can't tell.
- **TOML.** `wrangler.toml` is refused, by name, and nothing changes: this writes to the text of a file, and it won't guess at another format. Wrangler takes the same keys in `wrangler.jsonc`.

## A workerd config

{% demo src="cloudflare-diagram/workerd" %}

`readWorkerdConfig` reads the Cap'n Proto text of a workerd config, `config.capnp`, into the same system `readWrangler` makes from a `wrangler.jsonc`. It only reads: nothing's run, nothing's fetched, and an `embed "worker.js"` stays a name. `placeInLayers` gives each service a place, in layers by what reaches what, so it's drawn at once and the same every time, without a layout engine.

```tsx
import { CloudflareDiagram, placeInLayers, readWorkerdConfig } from '@brett_lamy/ui/cloudflare'

const read = readWorkerdConfig(text)
if (read.ok) {
  const { services, edges } = placeInLayers(read.system)
  // <CloudflareDiagram services={services} edges={edges} />, and read.notes, read.sockets
} else {
  // read.reason, with the line and column
}
```

| What's in the config | What it is in a system |
| --- | --- |
| A service with a `worker` | A service of kind `workers`, called by the service's name |
| A class in `durableObjectNamespaces` | A `durable-objects` service, `<worker>.<class>` |
| A `durableObjectNamespace` binding | An edge to the class, `via: 'durable_objects'`, from its own Worker or `serviceName`'s |
| A `service` binding to another Worker | An edge to it, `via: 'services'` |
| A `kvNamespace`, `r2Bucket` or `queue` binding | A `kv`, `r2` or `queues` service called by the service that answers for it, and an edge to it. A queue's Worker is drawn getting its messages, `via: 'queue-consumer'` |
| A `wrapped` D1 binding, a `hyperdrive` | A `d1` or `hyperdrive` service, and an edge to it |
| A `disk`, `external` or `network` service, a socket, a `text`, `json` or `data` value | Not drawn, and said in `read.notes`. Sockets are in `read.sockets` too |

In docs, a `capnp` fence that's a workerd config draws itself, read-only, with the notes under it and the source a press away, and other Cap'n Proto stays code. The diagram and the catalog load by dynamic import when the first one is on a page, so a page without one never gets them:

```capnp
using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [ (name = "main", worker = .main) ],
  sockets = [ (name = "http", address = "*:8080", http = (), service = "main") ],
);

const main :Workerd.Worker = (
  modules = [ (name = "worker.js", esModule = embed "worker.js") ],
  compatibilityDate = "2026-01-01",
  bindings = [ (name = "ROOMS", durableObjectNamespace = "Room"), (name = "CACHE", kvNamespace = "cache") ],
  durableObjectNamespaces = [ (className = "Room", uniqueKey = "rooms", enableSql = true) ],
  durableObjectStorage = (inMemory = ()),
);
```

And a config file can be embedded, as `{% embed url="workerd/event-log.capnp" %}`:

{% embed url="workerd/event-log.capnp" %}

## What's in the catalog

It's generated by `tools/cloudflare/catalog.mjs`, pinned to exact upstream versions, and `--check` fails if a rerun would change a byte. It also stops, rather than guessing, if Cloudflare's docs and Wrangler disagree (as they once did about R2's events).

| What | How many | From |
| --- | --- | --- |
| Products | 195: 101 services, 52 features, 10 umbrellas, 19 tools and 13 docs pages | `src/content/directory` in Cloudflare's docs, with what each is decided by a rule, and by hand in 44 cases |
| Binding keys | 41: 33 with a runtime type, and 8 named as having none, each with why | Wrangler's `config-schema.json`, and `wrangler types` on a config made from it |
| Methods | 113 across those types, and what they hand back | The Workers types, through the compiler |
| What a Worker can receive | 26 rows, joining handlers to what sends to them | By hand, and every reference in it is checked |

{% demo src="cloudflare-diagram/every-service" %}

Any product can go on a diagram. What has no binding or handler, like Data Loss Prevention, has no ports, and its panel says so. A kind that isn't in the catalog is drawn too, and says that. The catalog's names are as of its pin, as Cloudflare renames things: `CLOUDFLARE_CATALOG.pins.docs.date`. Their sources and licenses are on [Attributions](#/attributions).

## API

### `<CloudflareDiagram>`

| Prop | Default | Effect |
| --- | --- | --- |
| `services`, `edges` | — | The system, controlled. `services`: `{ id, kind, label?, at?, binding?, resource?, machine? }`; `binding` is what a binding to it is called on `env`, unless its edge says otherwise, and `resource` is what's behind it at Cloudflare, like a bucket's name. `edges`: `{ id, from, to, via, binding?, operations?, events? }` |
| `defaultServices`, `defaultEdges` | none | The system, left to the diagram |
| `onDataChange` | — | `(system, details)` after a change; `details.reason` is `move`, `delete`, `connect`, `reconnect`, `undo`, `redo`, `edit` or `add` |
| `editable` | `false` | Moving, adding, connecting and deleting services, and changing connections and machines. Without it, it's read-only |
| `selection`, `defaultSelection`, `onSelectionChange` | nothing | What's selected, `{ nodes, edges }`, as on Diagram |
| `panelOpen`, `defaultPanelOpen`, `onPanelOpenChange` | open when it's a column | The panel, as on DiagramFrame |
| `panelPresentation` | `auto` | `column` beside the board when there's room, a `drawer` at medium, a `push`ed page at a phone's size |
| `openMachine`, `defaultOpenMachine`, `onOpenMachineChange` | none | Whose machine is open over the board, by the service's id, or `null` |
| `direction` | `right` | Which way a layout runs: `right`, `down`, `left` or `up` |
| `icon` | the library's own | What to draw for a product, for an app with permission to use Cloudflare's |
| `emptyState` | an `EmptyState` | What an empty system shows. Editable, it says to search the catalog |
| `children` | — | More for the top of the panel: a name field, an app's own actions |
| `minimap`, `background`, `fitPadding`, `viewport`, `defaultViewport`, `onViewportChange` | as on Diagram | Passed to it |
| `aria-label` | `Cloudflare services` | The diagram's name |
| `className`, `style` | — | Merged onto the frame |

### Parts

| Part | What it is |
| --- | --- |
| `CloudflareServiceNode` | A service's card, for a plain Diagram's `renderNode`: its icon, name, what it is, a `machine` badge and its ports named. `tone` (`default`, `destructive`) overrides what its data says |
| `cloudflareServiceVariants` | That card's recipe |
| `serviceNode(service)` | A service as a Diagram node: its size and ports from the catalog, and its place if it has one |
| `CloudflareServiceSearch` | The catalog search, for a toolbar of your own: `onAction(product, details)` when one's chosen |

```tsx
// Cloudflare's services on a plain Diagram, drawn the same way, with your own rules.
<Diagram nodes={services.map((s) => ({ ...serviceNode(s), x: 0, y: 0 }))} renderNode={(node) => <CloudflareServiceNode node={node} />} />
```

### A system

| Name | What it does |
| --- | --- |
| `systemToJson(system)`, `parseSystem(text)` | As JSON, with its fields in a set order, and back, as `{ system, issues }` |
| `validateSystem(system)` | What's wrong with one, as `{ severity, code, message, service?, edge? }` |
| `checkMachines(xstate, system)` | What XState says about each machine, with XState handed in, as it's an optional peer |
| `searchCatalog(query, limit?)` | What's in the catalog for a search, best first |
| `addService(system, kind)`, `removeServices(system, ids)` | A system with one more, with an id of its own, or some fewer |
| `placeInLayers(system)` | Each service a place, in layers by what reaches what, and the same every time |
| `sharedServices(a, b)` | What two systems have in common |
| `machineEvents(config)`, `machineReceives(config, event)`, `machinesPast(system, edge)` | What a machine has transitions for, and which an edge's events reach |
| `serviceName(service)`, `edgeBinding(edge, to)`, `newEdge(services, edges, connection)` | The small things |

### A system and `wrangler.jsonc`

| Name | What it does |
| --- | --- |
| `readWrangler(text, { env? })` | A config, as `{ ok: true, system, worker, envs, settings, notes }`, or `{ ok: false, kind, reason }` |
| `compareWrangler(text, system, { env?, worker? })` | Where they differ, by name, as `{ ok: true, differences, notes, skipped }` |
| `writeWrangler(text, system, { env?, worker? })` | The config with the system's bindings for that Worker written to it, as `{ ok: true, text, differences, needs, skipped }` |
| `WRANGLER_RESOURCE_FIELDS` | Which field of each binding says what's behind it |

### A workerd config

| Name | What it does |
| --- | --- |
| `readWorkerdConfig(text)` | `{ ok: true, system, sockets, notes }`, or `{ ok: false, reason }` with the line and column |
| `looksLikeWorkerdConfig(text)` | Whether some Cap'n Proto is a workerd config, as the docs' fence asks |
| `parseCapnp(text)` | The consts in Cap'n Proto's text format, as values |

### `CLOUDFLARE_CATALOG`, and what goes with it

| Name | What it does |
| --- | --- |
| `CLOUDFLARE_CATALOG` | All of it: `products`, `bindings`, `handlers`, `receives`, `runsCode`, the events, the `pins` and the `attribution`, which is the credit to show with its text |
| `SERVICE_PRODUCTS`, `catalogProduct(id)`, `catalogBinding(key)` | Finding things in it |
| `servicePorts(kind)` | A service's ports, with `at`, `side` and `direction` |
| `linkBetween(fromKind, fromPort, toKind, toPort)` | Whether two ports can join, as `{ ok: true, link }` or `{ ok: false, reason }` |
| `linkOf(edge, fromKind, toKind)` | The same, from what an edge says it is |
| `runsCode(kind)`, `bindingName(label, taken)`, `methodSignature(method)`, `serviceIconName(product)` | The small things |

## Data attributes

The frame carries `data-cloudflare-diagram` beside DiagramFrame's own. Elements of its own have a `data-slot`; the kit's parts it uses keep theirs, and are told apart with `data-action` (buttons), `data-field` (the panel's fields) and `data-part`.

| Where | Attributes |
| --- | --- |
| A service | `data-slot="cloudflare-service"` with `data-kind` and `data-problem`; in it `cloudflare-service-name`, `cloudflare-port-label` (`data-side="start"` or `"end"`) and a `data-part="machine"` badge |
| The bar | `cloudflare-status` |
| The panel | `cloudflare-panel`, with `cloudflare-search`, `cloudflare-hint`, `cloudflare-issues` and `cloudflare-issue` (`data-severity`, `data-code`, `data-edge`, `data-service`), `cloudflare-description`, `cloudflare-reached-by`, `cloudflare-reaches-with`, `cloudflare-no-ports`, `cloudflare-unknown`, `cloudflare-binding-name`, `cloudflare-refusal`, `cloudflare-edge-problem`, `cloudflare-events`, `cloudflare-event-problem`, `cloudflare-receivable`, `cloudflare-machine-receives`, `cloudflare-machine-problem`, `cloudflare-attribution` |
| Operations | `data-part="operations"` (editable) or `cloudflare-operations` (read-only); each row has `data-operation`, and `data-used` when read-only |
| Fields | `data-field`: `label`, `binding-name`, `events` |
| Buttons | `data-action`: `delete`, `show-issue`, `remove-edge`, `add-machine`, `open-machine`, `remove-machine`, `machine-back`, and the toolbar's `undo` and `redo` |
| An open machine | `cloudflare-machine-bar`, in DiagramFrame's cover |

## Accessibility

- The diagram is a group named by `aria-label`, and every service and connection can be reached with the keyboard and says what it connects to, as on Diagram. A screen reader calls a node a "service".
- The panel's problems are a polite live region, and each says what's wrong in words, with a "Wrong" or "Note" badge, so color isn't the only sign. A refused binding name and a connection that isn't real are alerts.
- The search is a Combobox: arrow keys move through what matches, Enter adds the highlighted one, and focus stays in the search for another.
- Undo and redo are toolbar buttons with their shortcuts in their tooltips, and ⌘Z / ⇧⌘Z (⌘Y) on the board; a field in the panel keeps its own.
- Opening a machine moves focus to its back button, and going back returns it to the button that opened it.
- No product's image is drawn, so nothing's announced but its name.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `cloudflareServiceVariants`

Defined in `@/components/ui/cloudflare-diagram`. Base classes:

```text
absolute inset-0 overflow-hidden rounded-ctl border bg-card text-card-foreground
```

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `border-border` |
| `destructive` | `border-destructive` |
