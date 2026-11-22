# ReplayDebugger

A time travel debugger over [Replay](https://replay.io) recordings, with no engine running. A recording is replayed once with Replay's native linker and written down as JSON: every step in the program's own code, where each kind of step goes from it, and the frames, scopes and values there. The page loads that file and steps backwards and forwards through it, sets breakpoints and logpoints, reads the stack and the variables, and evaluates names and paths, all from the JSON.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/replay-debugger.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK and Docstream, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`, `@brett_lamy/ui/docstream/…`). The copied source is yours to edit. Import from your alias:

```tsx
import { ReplayView } from '@/components/ui/replay-debugger'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module (the Replay library's entry, `@brett_lamy/ui/replay`, has them too):

```tsx
import '@brett_lamy/ui/styles.css'

import { ReplayView } from '@brett_lamy/ui/replay-debugger'
```
{% endtab %}
{% endtabs %}

It reads one recording, or a session of several: a page and the services behind it, each recorded on its own and lined up on one clock, joined by the requests between them. A session has a timeline with a lane per recording, a distributed trace as a [FlameChart](https://blamy.github.io/ui/#/flame-chart), and each request a backend answered with its code at the step the playhead is on.

Use [ReplayPreview](https://blamy.github.io/ui/#/replay-preview) to play back what a page looked like (an rrweb recording), and this for what its code did.

## In a document

Docstream opens a `.replay` file in the debugger, the way it opens an `.rrweb` file in the replay player. Embed it:

```markdown
{% embed url="replays/checkout.replay" title="Checkout, a page and four services" %}
```

What it shows comes from the file. One recording opens in the debugger. A session with a page recorded by rrweb opens with the page, the session's timeline and each request's code; a session without one opens the debugger over every recording, on one timeline. The file is fetched, and the debugger loaded, only when the embed nears the viewport. The URL goes through the host's `AssetResolverProvider`, like any embed's.

### One recording

Node running a small shop script: 84 steps in `shop.js`. Step in any direction, press a line's hit count to go through its executions, set a breakpoint and continue to it, or evaluate `cart.items[0].price` in the prompt.

{% embed url="replays/shop.replay" title="shop.js on Node" %}

### A page and four services

A café's shop page in a browser, recorded with rrweb, and the gateway, orders, payments and inventory services behind it, each recorded with Replay and calling each other with W3C trace context. Scrub the timeline and the request points open one after another, each showing its code a line at a time. Under 640 px it's the phone layout: the page floats in a corner, and the timeline is a rail on the edge.

{% embed url="replays/checkout.replay" title="Corner Café checkout" %}

### A browser and its server

A TanStack Start app: the page in Replay Chromium and its server functions in workerd, both replayed, in original TypeScript through their source maps. Press a lane, or pick a recording, to see the other side at the same moment.

{% embed url="replays/tanstack.replay" title="TanStack Start shop" %}

## Drop a file

Drag a `.replay` file onto the frame and it opens in the debugger; drop another on the debugger to swap it. Without one at hand, download a demo under the frame and drag it back in. The frame is a [`FileUploadDropzone`](#/file-upload), so the browse button and keyboard drops come with it, and the file is read in the browser and never uploaded. Gzipped JSON works too.

{% demo src="replay-debugger/drop-a-file" %}

```tsx
const [data, setData] = useState<ReplayFileData>()

<FileUploadDropzone multiple={false} rules={{ accept: ['.replay', '.json', '.gz'] }}
  onFiles={async ([file]) => setData(JSON.parse(await file.text()))}>
  {data ? () => <ReplayView data={data} className="h-[640px]" /> : undefined}
</FileUploadDropzone>
```

## In a component

`ReplayView` takes a file's contents and shows them the same way; `CachedReplayDebugger` is one recording's debugger, and `SessionDebugger`, `FullStackReplay`, `SessionTimeline`, `SessionFlame` and `RequestPoints` are a session's parts.

```tsx
import { ReplayView } from '@brett_lamy/ui/replay'

const data = await fetch('/replays/checkout.replay').then((r) => r.json())

<ReplayView data={data} className="h-[720px]" />
```

Under it is `DebuggerModel`, which knows nothing about where its answers come from: a `DebuggerHost` gives it steps, sources, frames and values. `createCachedHost(cache)` answers from a file; a host with a live engine behind it answers the same questions.

```tsx
import { CachedClock, cachedSummary, createCachedHost, DebuggerModel, ReplayDebugger } from '@brett_lamy/ui/replay'

const model = new DebuggerModel('shop.js', createCachedHost(cache, { onHit: (hit) => model.onEvent(hit) }))
model.ready(cachedSummary(cache), new CachedClock(cache))

<ReplayDebugger model={model} />
```

## The files

A `.replay` file is JSON with a `format`:

| Format | What it holds |
| --- | --- |
| `bl-replay-cache/2` | One recording: its sources with hit counts, each kept step's time, depth, location, frames and where each kind of step goes from it, every line's hits, and the console. Frames, scopes and objects are kept once each in a pool, named by a hash of what they hold, so a value that doesn't change from step to step is stored once. |
| `bl-replay-session/1` | Several recordings on one clock: each one's cache (or, for a page that recorded itself, its rrweb events) and its offset onto the shared clock; the spans joining them as a distributed tracer has them (trace, span and parent IDs, kind, status, attributes such as `http.status_code`, `session.id` and `enduser.id`, and the steps each starts and ends at); each process's CPU and memory samples; and its logs. |

### What one recording looks like

Trimmed to one of each, from `shop.replay`. A step names its frames; the pool holds each frame, scope and object once, under a hash of what it holds, so `item` at the hundred steps it doesn't change is one object.

```json
{
  "format": "bl-replay-cache/2",
  "recording": { "name": "node/recording.dat", "bytes": 42000, "sha256": "fbd7f01f…", "buildId": "macOS-node-20261111-3f00472bf854-d79da1fcf860", "linkerVersion": "linker-macOS-26551-d79da1fcf860", "runtime": "node", "steps": 174 },
  "sources": [
    { "id": "138", "kind": "scriptSource", "url": "shop.js", "contents": "// A small program for exercising the time travel debugger.\n…", "breakableLines": [4, 5, 9, 10, 11], "hitCounts": { "4": 2, "5": 2, "9": 3 } }
  ],
  "steps": [
    {
      "index": 80, "progress": 25, "ms": 36.304, "depth": 3,
      "location": { "sourceId": "138", "line": 10, "column": 4 },
      "frames": ["f-AALEITl-JdM", "fw6L1TflJEiNV", "fLwfNq_k2pybY", "fsKghBRdZwAIT"],
      "nav": [81, 79, 81, 79, 84, 77]
    }
  ],
  "pool": {
    "frames": [
      { "frameId": "f-AALEITl-JdM", "functionName": "add", "displayName": "add", "type": "call", "location": [{ "sourceId": "138", "line": 10, "column": 4 }], "scopeChain": ["sUjxkEanR_cv3", "sl3M8N2THVe1e", "skb6YhkJ1UpQX"] }
    ],
    "scopes": [
      { "scopeId": "sUjxkEanR_cv3", "type": "function", "functionName": "add", "bindings": [{ "name": "item", "object": "o1qvOIP4z9aD5" }] }
    ],
    "objects": [
      { "objectId": "o1qvOIP4z9aD5", "className": "Object", "preview": { "properties": [{ "name": "name", "value": "cheese" }, { "name": "price", "value": 7.8 }, { "name": "qty", "value": 2 }] } }
    ]
  },
  "hits": { "138": { "4": [21, 26], "5": [22, 27] } },
  "console": [{ "step": 114, "ms": 57.655, "level": "log", "text": "Alice pays 2.4", "location": { "sourceId": "138", "line": 42, "column": 10 } }]
}
```

`nav` is where Step into, back, over, back, out and back go from that step, in that order (`-1` for nowhere). `ms` is the recording's own clock.

### What a session looks like

Trimmed from `checkout.replay`. Each recording is a cache like the one above, or a page's rrweb events, with its offset onto the session's clock; a span says which recording ran it and where it began and ended there.

```json
{
  "format": "bl-replay-session/1",
  "name": "Corner Café checkout",
  "origin": { "clock": "host uptime, from performance.timeOrigin + performance.now() in each process; the browser by the wall clock", "ms": 332721283.772 },
  "recordings": [
    { "id": "browser", "role": "browser", "service": "browser", "process": "chromium", "runtime": "chromium (rrweb, not replayed)", "offsetMs": 1592.005, "rrweb": ["…118 rrweb events…"] },
    { "id": "2682e84e8157", "role": "gateway", "service": "gateway", "process": "node", "runtime": "node", "offsetMs": -29.355, "cache": { "format": "bl-replay-cache/2", "…": "…" } }
  ],
  "spans": [
    {
      "id": "c90e41f8286c43e1", "traceId": "98479851ad3967ef7d47b41e9c18e3a4", "parentId": "861961c1399a8920",
      "recording": "019fc4060f99", "service": "payments", "name": "POST /charge", "kind": "server",
      "start": 2667.708, "end": 2668.38, "status": "ok", "startStep": 388, "endStep": 493,
      "attributes": { "http.method": "POST", "http.route": "/charge", "http.status_code": 200, "session.id": "sess_ada", "enduser.id": "ada", "http.request_id": "req_1" }
    }
  ],
  "metrics": [{ "recording": "2682e84e8157", "time": 106.094, "cpuPercent": 5.6, "rss": 131727360, "heapUsed": 6304856 }],
  "logs": [{ "recording": "2682e84e8157", "time": 11.037, "step": 58, "level": "log", "text": "gateway listening on 47101" }]
}
```

`analyzeSession` reads the measurements a tracing product shows from a session: each span's self time (its duration less the union of its children's), each service's busy time with overlaps counted once, P50 and P95 per operation, errors, unfinished spans, and spans that began before the span that caused them.
