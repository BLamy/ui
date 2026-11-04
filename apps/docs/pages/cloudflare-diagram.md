# CloudflareDiagram

Cloudflare's services on a [Diagram](#/diagram). Each service is a node, with what it can call and receive as ports, from a catalog generated from Cloudflare's own docs, Wrangler's config schema and the Workers types. A connection can only be one the catalog says there is: a Worker to R2 offers R2's real methods, and R2 to D1 says why not.

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

Import the stylesheet once at your app's entry, then the parts from their own entry, which keeps them out of the main one:

```tsx
import '@brett_lamy/ui/styles.css'

import { CloudflareDiagram } from '@brett_lamy/ui/cloudflare'
```
{% endtab %}
{% endtabs %}

{% hint style="info" %}
**No Cloudflare logos.** [Cloudflare's trademark page](https://www.cloudflare.com/trademark/) asks for written permission to use them, so this has none: names in words, the library's own icons, and an `icon` prop for an app that has its own permission. Cloudflare is a trademark of Cloudflare, Inc., which doesn't endorse this library.
{% endhint %}

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

`kind` is the service's id in the catalog. With no `at` on any service, they're laid out by ELK, which is an optional peer. With a place for any of them, they stay where they say, and those without one go in a column to the right. Once something's moved, each has one, which saves as plain data and needs no ELK.

## Connecting

{% demo src="cloudflare-diagram/connect" %}

| What's joined | How it says so | What's on offer |
| --- | --- | --- |
| `env`, on anything that runs code, to a binding | `via`: the binding key, like `r2_buckets` | The methods of its runtime type, from the Workers types |
| Something that sends, to the handler it sends to | `via`: the row of `receives`, like `queue-consumer` | Nothing to choose: it's what the handler's for |
| `events`, on what publishes them, to a Queue | `via: 'events'` | Its event types, and R2's event categories |
| `env` on a Durable Object, to a Container | `via: 'surface:Container'` | The methods of `Container`, reached through `DurableObjectState.container` |

Only something that runs code has an `env`, so only it can have bindings: Workers, Durable Objects, Workflows, Pages, Agents, Dynamic Workers and Workers for Platforms. Anything else says why not, as you drag. The same two can be connected again, under a binding name of its own.

## A system

{% demo src="cloudflare-diagram/system" %}

What's given to it is a system: a small document saying which services there are, what each is called and bound as, which have a machine, and which events cross which connection. It's plain data, and it saves as JSON.

```tsx
import { parseSystem, systemToJson, validateSystem } from '@brett_lamy/ui/cloudflare'

const text = systemToJson(system)
const { system: back, issues } = parseSystem(text)
```

`parseSystem` never throws, as a file can have been edited by hand. What it can't use is left out and said, and what's left can still be drawn. The part draws the problems `validateSystem` finds, with a way to get to each, so a system with something wrong can still be looked at and put right.

| What it says | How much it matters | When |
| --- | --- | --- |
| `edge-not-real` | Wrong, and drawn as wrong | A connection the catalog says there isn't, with why not |
| `edge-end` | Wrong, and listed, as it has nowhere to be drawn | A connection to or from a service that's gone. One that carries events stays when its service is deleted, so that something says a machine's still sending there |
| `event-not-received` | Wrong, and drawn as wrong | An event on a connection that the first machine it reaches has no transition for. It goes past what has no machine, like a Queue, and `*` and `error.*` count as they do in XState |
| `event-no-machine` | Worth a look | An event with no machine past that connection at all |
| `operation` | Wrong, and drawn as wrong | A method that isn't on offer across that connection |
| `binding-name` | Wrong, or with no name yet, worth a look | Something that can't be a name on `env`, or a name used twice on one Worker. A name only has to be its own on each Worker, as each has its own `env` |
| `machine` | Wrong, and drawn as wrong | What XState says about a machine, which is only checked if `xstate` is installed |
| `machine-no-code`, `machine-code` | Worth a look | A machine on something that doesn't run code, or with code in its config, which JSON can't hold |
| `unknown-kind` | Worth a look | A kind that isn't in the catalog, which could only be newer than it |

A service's machine opens in a [StateDiagram](#/state-diagram), over the board, to run and, with `editable`, to change. What's changed there is checked out here as soon as you've made the change, and it's one history with everything else on the board.

A search adds a service. It looks at names first, then at binding keys and what things are for, and every word has to match. It offers services and what's part of one, and not tools or docs pages.

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

## What's in the catalog

It's generated by `tools/cloudflare/catalog.mjs`, pinned to exact upstream versions, and `--check` fails if a rerun would change a byte. It's about 150 KB, or 26 KB gzipped, so it's only in this entry.

| What | How many | From |
| --- | --- | --- |
| Products | 195: 101 services, 52 features, 10 umbrellas, 19 tools and 13 docs pages | `src/content/directory` in Cloudflare's docs, with what each is decided by a rule, and by hand in 44 cases |
| Binding keys | 41: 33 with a runtime type, and 8 named as having none, each with why | Wrangler's `config-schema.json`, and `wrangler types` on a config made from it |
| Methods | 113 across those types, and what they hand back | The Workers types, through the compiler |
| What a Worker can receive | 26 rows, joining handlers to what sends to them | By hand, and every reference in it is checked |

{% demo src="cloudflare-diagram/every-service" %}

Any product can go on a diagram. What has no binding or handler, like Data Loss Prevention, has no ports, and its panel says so. A kind that isn't in the catalog is drawn too, and says that. The catalog's names are as of its pin, as Cloudflare renames things: `CLOUDFLARE_CATALOG.pins.docs.date`.

## API

### `<CloudflareDiagram>`

From `@brett_lamy/ui/cloudflare`.

| Prop | Default | Effect |
| --- | --- | --- |
| `services` | — | `{ id, kind, label?, at?, binding?, resource?, machine? }`. `binding` is what a binding to it is called on `env`, unless its edge says otherwise, and `resource` is what's behind it at Cloudflare, like a bucket's name. |
| `edges` | none | `{ id, from, to, via, binding?, operations?, events? }`. |
| `onChange` | — | `{ services, edges, reason }` after a change. `reason` is what `Diagram` says, or `edit` for what was changed in the panel or a machine. |
| `editable` | `false` | Moving, adding and connecting services, and changing connections and machines. |
| `icon` | the library's own | What to draw for a product, for an app with permission to use Cloudflare's. |
| `direction` | `RIGHT` | Which way a layout runs. |
| `defaultSelection` | nothing | What's selected to begin with. |
| `defaultPanelOpen` | if it fits beside the board | Whether the panel starts open. |
| `defaultMachine` | none | Whose machine is open to begin with, by the service's id. |
| `panelExtra` | — | Something more for the panel, at the top. |
| `minimap`, `background`, `fitPadding`, `camera`, `defaultCamera`, `onCameraChange` | as on `Diagram` | Passed to it. |
| `aria-label` | `Cloudflare services` | The region's name. |
| `className`, `style` | — | Merged onto the root. |

The root carries `data-slot="cloudflare-diagram"`. Under it, a service is `cloudflare-service` with its `data-kind`, with `cloudflare-service-name`, `cloudflare-service-machine` and `cloudflare-port-label`, and the panel is `cloudflare-panel`, with `cloudflare-search`, `cloudflare-issues` and `cloudflare-issue`, `cloudflare-operation`, `cloudflare-binding-name`, `cloudflare-events`, `cloudflare-receivable`, `cloudflare-machine-open`, `cloudflare-machine-add`, `cloudflare-machine-remove`, `cloudflare-machine-receives`, `cloudflare-delete`, `cloudflare-description`, `cloudflare-no-ports`, `cloudflare-unknown` and `cloudflare-attribution` in it. A machine that's open has `cloudflare-machine-bar` and `cloudflare-machine-back`, over the board.

### A system

| Name | What it does |
| --- | --- |
| `systemToJson(system)`, `parseSystem(text)` | As JSON, with its fields in a set order, and back, as `{ system, issues }` |
| `validateSystem(system)` | What's wrong with one, as `{ severity, code, message, service?, edge? }` |
| `checkMachines(xstate, system)` | What XState says about each machine, with XState handed in, as it's an optional peer |
| `searchCatalog(query, limit?)` | What's in the catalog for a search, best first |
| `addService(system, kind)`, `removeServices(system, ids)` | A system with one more, with an id of its own, or some fewer |
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

### `CLOUDFLARE_CATALOG`, and what goes with it

| Name | What it does |
| --- | --- |
| `CLOUDFLARE_CATALOG` | All of it: `products`, `bindings`, `handlers`, `receives`, `runsCode`, the events, the `pins` and the `attribution`, which is the credit to show with its text |
| `SERVICE_PRODUCTS`, `catalogProduct(id)`, `catalogBinding(key)` | Finding things in it |
| `servicePorts(kind)` | A service's ports, with `at`, `side` and `direction` |
| `linkBetween(fromKind, fromPort, toKind, toPort)` | Whether two ports can join, as `{ ok: true, link }` or `{ ok: false, reason }` |
| `linkOf(edge, fromKind, toKind)` | The same, from what an edge says it is |
| `runsCode(kind)`, `bindingName(label, taken)`, `methodSignature(method)`, `serviceIconName(product)` | The small things |
