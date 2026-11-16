---
description: Play rrweb session recordings in the page, with a browser frame, a scrubber that marks clicks, errors and failed requests, a drawn cursor, and a headless stage for building your own player.
---

# Session replays

docstream plays [rrweb](https://github.com/rrweb-io/rrweb) recordings: the DOM of a real session, rebuilt and replayed in the page, without video. Put one in Markdown with an embed of a `.rrweb` file, or render `ReplayPreview` with the events you already hold. The player's code loads the first time a player renders. A page that never shows a recording never downloads rrweb.

{% embed url="/docstream/replays/checkout.rrweb" title="Checkout fails with a 500" %}

```md
{% embed url="/docstream/replays/checkout.rrweb" title="Checkout fails with a 500" %}
```

That recording is a 9-second session on a mock storefront: a shopper adds two products, opens the cart, types an email and a promo code, and "Place order" fails. The seek bar is plain by default; with `markers`, a rail above it marks each click, the `POST /api/checkout` 500 and the error that follows, and pressing a mark jumps to it. Click inside the player and use the keyboard:

| Key | Action |
| --- | --- |
| `Space` / `K` | Play / pause |
| `←` / `→` | Back / forward 5 s |
| `J` / `L` | Back / forward 10 s |
| `<` / `>` | Slower / faster |
| `F` | Fullscreen |
| `Home` / `End` | Jump to the start / end |

## DevTools

The top bar's Console and Network buttons show what had happened by the playhead. Network shows how many requests had been sent, and in red how many had failed. Console shows how many errors (red) and warnings (amber) had been logged. Press one to open a DevTools panel over the page, docked at the bottom like Chrome's:

- **Console** lists the messages logged so far. Warnings and errors sit on tinted rows, and a message with a stack trace expands to show it. Filter by text or level.
- **Network** lists the requests sent so far, with status, method, type, time and a waterfall. A request still waiting for its response at the playhead shows as pending. Select a row to see its headers, payload and response.

Scrub backwards and both lists shrink to what DevTools showed at that moment. Press a message's time, or "Go to" on a request, to move the player there. Drag the panel's top edge to resize it; Esc closes it. Without the browser chrome (`chrome="minimal"` or `"none"`), the buttons sit in the controls row.

The panel reads two kinds of event:

| Source | What it adds |
| --- | --- |
| rrweb's console plugin (`rrweb/console@1`) | Messages with their level and stack trace. |
| rrweb's network plugin (`rrweb/network@1`) | Requests with status, timing, headers and bodies. |
| Custom event `network` (also `request`, `fetch`, `xhr`, `network.error`, `request.failed`, `fetch.failed`) | A request: `{ method, url, status, duration?, requestHeaders?, requestBody?, responseHeaders?, responseBody? }`. |
| Custom event `error` (also `exception`, `console.error`, `uncaught`) | An uncaught error in the console: `{ label, message, stack? }`. |
| Custom event `console` (also `log`, `warn`, `info`, `debug`) | A message: `{ level, message }` or `{ level, args }`. |

A request counts as failed when its status is 0 or 400 and up, when it has an `error`, or when its tag says so. The buttons appear only when the recording has messages, requests or inspections. `disableDevtools` removes them, the panel and the inspections; `defaultDevtoolsTab="network"` opens the panel at mount.

## Inspections

An inspection is a moment where someone looked at a request or a console message: "at 0:07.6 we inspected `POST /api/checkout`, and it answered 500". The player follows them by default. As the playhead reaches one, DevTools opens on its tab with that request (or message) selected and marked. Playback doesn't stop. With `markers`, each inspection is also a checkpoint on the rail, labelled with what was found.

{% demo src="media-replay/inspect" %}

The current inspection is the latest one at or before the playhead. Seeking never closes the panel: going to another request, earlier or later, leaves it open. A panel an inspection opened leaves keyboard focus where it was, and closes by itself after 5 s of playback with no new request, console message or inspection (`autoCloseDevtools`, in ms, or `false`); paused, it stays. Close it yourself and it stays closed until the next inspection; click or scroll in it and it's yours, so it never closes by itself. Inspections close together slow playback down, so each stays up at least 2.5 s before the next replaces it (`inspectionDwell`, in ms, or `false`); the chosen speed comes back once they spread out. `playerRef.current.inspect(id)` jumps to an inspection and opens it, for a chronology beside the player.

```tsx
<ReplayPreview
  events={events}
  inspections={[
    { time: 6800, request: "/api/promo/validate?code=FALL25", label: "FALL25 validates" },
    { time: 7600, request: "2465.48", label: "Checkout answers 500" },
    { time: 7900, tab: "console", message: "Uncaught TypeError", label: "applyPromo crashes" },
  ]}
/>
```

| Field | What it does |
| --- | --- |
| `time` | When, in ms from the start of the recording. |
| `request` | The request to select: the recording's id for it (a request's `requestId` or `id`, such as a Replay request id), else its URL or path. A URL that was requested more than once picks the request sent nearest `time`. |
| `message` | The console message to select: a custom console event's `id`, else text it contains (the last such message by `time`). |
| `element` | A CSS selector: the page shows that element highlighted, as DevTools' element picker does, without opening or switching the panel. **Elements** opens on it selected. |
| `tab` | `"network"`, `"console"` or `"elements"`. Defaults to `network` for a `request`, `console` for a `message`, else `elements`. |
| `label` | What was found: the checkpoint's label on the marker rail (with `markers`). |
| `id` | For `inspect(id)`. Defaults to `inspect-<n>`. |

A recording can carry its own: a custom event tagged `inspect` with the same fields as its payload (`record.addCustomEvent("inspect", { request, label })`), so an `.rrweb` file embedded in a page brings its inspections with it. They join any passed as `inspections`. `getReplayInspections(events)`, `resolveReplayInspections(inspections, getReplayDevtools(events))` and `replayInspectionAt(resolved, ms)` give you the same for your own UI.

## Elements

The **Elements** tab shows the replayed page's DOM at the playhead as a collapsible tree, Chrome's panel in miniature: tags, attributes and short text inline, a breadcrumb of the selected element's ancestors underneath. An inspection with an `element` selector highlights that element on the page whatever the panel shows, and the tab opens on it (its ancestors expanded). While the tab is open the selected element, or the one under the pointer in the tree, is highlighted on the page with DevTools' blue box and a tag-and-size label. Click any node to select it. The tree reads the live page, so it changes as the recording plays.

## Sources and screenshots

A debugger's evidence (`evidence`, or `evidence=` on a `.rrweb` embed: an object or a JSON file) adds two things. **Sources**, a DevTools tab: the source it read, each line with its hit count and the lines it was looking at highlighted, and its logpoints, a breakpoint on the line and, beside it, the watch value at the playhead, flashing blue as each new hit lands. A logpoint's first hit, or an excerpt read at a time, opens Sources there. And **screenshots**: as playback reaches one, the stage flashes and the shot shrinks to a thumbnail in the bottom-left corner, as macOS takes a screenshot, while the page plays on.

```json
{
  "sources": [{ "path": "src/Profile.jsx", "lines": [{ "line": 61, "text": "setVersion(updated)", "hits": 1 }], "focus": [61] }],
  "logpoints": [{ "path": "src/Profile.jsx", "line": 61, "expression": "res.status", "hits": [{ "at": "2026-10-19T21:02:08.807Z", "value": "409" }] }],
  "screenshots": [{ "at": "2026-10-19T21:02:09.100Z", "src": "/shots/saved.jpg", "label": "Saved! toast" }]
}
```

Times are ISO strings on the recording's clock, or ms from its start. `resolveReplayEvidence(evidence, start, duration)` reads it for your own UI.

## HAR and console logs

DevTools can also read what was recorded beside the rrweb events: a HAR (the network log a browser or proxy exports) and a console log. Their requests and messages join the Network and Console lists on their own timestamps, so a HAR captured during the same session lines up with the replay. Anything stamped before the recording starts shows at its first moment, anything after at its last.

```md
{% embed url="./recording.rrweb" har="./network.har" log="./console.log" %}
```

```tsx
<ReplayPreview events={events} har={harJson} consoleLog={logText} />
```

The console log is one message per line, an ISO time, the level in brackets and the text; indented lines continue the message above:

```
2026-06-12T21:01:35.297Z [info] storefront ready
2026-06-12T21:01:38.420Z [error] Uncaught TypeError: Cannot read properties of undefined (reading 'total')
  at applyPromo (checkout.ts:88)
```

A HAR entry's `_requestId` is the id an inspection can name, and `log._inspections` (`{ at, request | message, label }`) carries inspections with the HAR. `harToReplayEvents`, `consoleLogToReplayEvents` and `mergeReplaySources(events, { har, consoleLog })` do the same reading for your own UI.

## Captions

`captions` (WebVTT text), or `captions=` on a `.rrweb` embed (a `.vtt` file beside it), puts a caption over the page while the playhead is in a cue: an agent's narration, or the steps of a walkthrough. Cue times are on the recording's clock (from its first event), and a time window doesn't shift them. The caption sits at the bottom of the page, at the top while DevTools is open, and a **CC** button in the controls turns captions off and on. Cue settings, `STYLE` and `REGION` blocks are ignored; voice spans keep their text.

```markdown
{% embed url="./recording.rrweb" captions="./captions.vtt" %}
```

```
WEBVTT

00:00:01.500 --> 00:00:04.000
Step 1: Open the cart

00:00:04.000 --> 00:00:09.200
Step 2: Apply WELCOME10 and pay
```

`parseWebVTT(text)` and `replayCaptionsAt(cues, ms)` give you the cues for your own player.

## Time window

A long recording often matters for a few seconds of it. `timeWindow={[start, end]}` (ms) marks that segment: the player opens at its start with the segment highlighted on the scrubber, and Play plays it and stops at its end. Play again replays it; with `loop` it goes round. The rest of the recording is still there: scrub or seek outside the segment and playback runs on to the end of the recording, and moving back inside makes the segment hold again.

{% demo src="media-replay/time-window" %}

```tsx
<ReplayPreview events={events} timeWindow={[6200, 8000]} />
```

An `.rrweb` embed takes its window from the URL: `{% embed url="./checkout.rrweb#t=6.2,8" %}`.

## A stage of your own

The player doesn't have to play rrweb. `stage` puts anything with a playhead in its place, such as pictures of a page, with the same frame, scrubber, keys and markers. rrweb is never loaded. A stage is a component the player drives through a `ReplayStageHandle` on its ref, and it reports the time after every move, whoever made it.

{% demo src="media-replay/custom-stage" %}

```tsx
const stage: ReplayCustomStage = { component: FramesStage, duration, width, height, href }

<ReplayPreview
  stage={stage}
  devtools={{ console: messages, network: requests }}
  elements={{ getDocument: () => rebuilt, getElementRect: (el) => boxes.get(el) ?? null }}
/>
```

With no events to read, the rest comes as data. `devtools` takes `ReplayDevtools`' two lists, in time order, with times in ms from the start, and is used as it is in place of what `getReplayDevtools` would read from a recording. Markers come from it too, with `markers`. `elements` says where the **Elements** tab reads from: a `Document`, which can be one rebuilt from a recording in a hidden iframe, and `getElementRect`, for where each element really was, since the layout of a rebuilt page means nothing. A stage with no document has no Elements tab, and `elements={false}` takes it away from one that has.

These are for code that hosts a player, so they're props and not attributes of an embed: a `.rrweb` embed has `har=`, `log=`, `evidence=` and `captions=` for what's recorded beside it.

Both lists can be an hour long, so the top bar's counts come from `replayDevtoolsCountsAt`, a few binary searches, and the panel builds its lists only when it's open and `replayDevtoolsCutAt` says they've changed. The panel has no windowing, so it lays out the latest 2,000 rows of each list and says how many more there are. A console that has to hold a whole hour belongs in a virtualized list of your own.

## Three ways in

{% tabs %}
{% tab title=".rrweb file" %}
An embed whose URL ends in `.rrweb` renders `ReplayFile`. The file is a JSON array of rrweb events, or an object `{ "events": [...] }`. The URL goes through the host's [asset resolver](06-assets.md), and the file isn't fetched until the player scrolls within 240 px of the viewport, so a page of ten recordings downloads one at a time as you read.

```md
{% embed url="./recordings/signup.rrweb" title="Sign-up flow" %}
```

A media fragment on the URL sets the [time window](#time-window), in seconds: `./recordings/signup.rrweb#t=4.7,7.4` opens at 0:04.7 and plays to 0:07.4; `#t=12` runs from 0:12 to the end.
{% endtab %}

{% tab title="Replay / Loop QA URL" %}
A public Replay or Loop QA URL renders as an iframe of its chrome-free embed route (rule 1 on [Embeds and video](01-embeds-and-video.md)). A project URL is rewritten to the public route for you:

```md
{% embed url="https://app.example.com/projects/p1/journeys/j1" %}
```

renders `https://app.example.com/p/p1/journeys/j1`. This path never loads rrweb. The replay service owns auth and public access; docstream only reshapes the route.
{% endtab %}

{% tab title="React" %}
```tsx
import { ReplayPreview, ReplayFile } from "@brett_lamy/ui/docstream"

<ReplayPreview events={events} />                                      // events you hold
<ReplayPreview source={{ kind: "events-url", url: "/api/replays/42" }} />  // fetch, then play
<ReplayPreview source="https://app.replay.io/…" />                     // a page URL: iframe
<ReplayFile url="./recordings/signup.rrweb" />                          // what the .rrweb embed renders
```
{% endtab %}
{% endtabs %}

## ReplayPreview

`ReplayPreview` is the full player. `ReplayEmbed` is the same component under a name that reads better in document renderers. The buttons and readout below are this demo's own code, driving the player through `playerRef`, `onTimeUpdate` and `onMarkerPress`. Switch variants to compare the three `chrome` styles.

{% demo src="media-replay/player" %}

Pass **either** `events` (the player API) **or** `source` (the embed API). They render the same player. `source` takes several shapes:

| `source` | What happens |
| --- | --- |
| `string` | A page URL, normalized with `normalizeReplayEmbedUrl` and shown in an iframe (`chrome` defaults to `"minimal"`). |
| `ReplayEvent[]` | Played with the full player. |
| `{ kind: "url", url, title? }` | The explicit form of a page URL. |
| `{ kind: "events", events }` | The explicit form of an event list. |
| `{ kind: "events-url", url, fetchInit? }` | Fetched with `fetch(url, fetchInit)`. The response must be an event array or `{ events }`; anything else shows an error in the frame. |

### Props

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `events` / `source` / `stage` | `ReplayEvent[]` / `ReplaySource` / `ReplayCustomStage` | none | One of the three. `stage` plays something other than rrweb. |
| `chrome` | `"browser" \| "minimal" \| "none"` | `"browser"` (`"minimal"` for iframes) | Window with traffic lights and URL bar; a rounded card; or no frame, filling the parent. |
| `url` | `string` | the recording's | Address in the URL bar. By default it follows the recording's own navigations, led by path, query and hash. |
| `title` | `string` | `"Session replay"` | Accessible name (the iframe title for page URLs). |
| `trafficLights` | `boolean` | `true` | The macOS window buttons in `browser` chrome. |
| `controls` | `boolean` | `true` | Play/pause, scrubber, speed, fullscreen. `controls={false}` with `chrome="none"` is a still frame at `initialTime`. |
| `autoplay` / `loop` | `boolean` | `false` | Start on load; restart at the end. |
| `initialTime` | `number` | `0`, or the window's start | Where the player starts, in ms. |
| `timeWindow` | `[number, number]` | none | The segment that matters, in ms: highlighted on the scrubber, where the player opens, and where playing from inside it stops. Scrubbing outside it plays on. |
| `speeds` | `number[]` | `[1, 2, 4, 0.5]` | What the speed button cycles through. The first is the starting speed. |
| `markers` | `boolean \| ReplayMarker[]` | `false` | A marker rail above the seek bar: `true` reads them from the recording, or pass your own. Off by default since 1.26. |
| `markerKinds` | `ReplayMarkerKind[]` | all | Which recorded kinds to show: `click`, `error`, `network`, `navigation`, `custom`. |
| `cursor` | `boolean` | `true` | Draw the recorded pointer and click ripples. |
| `disableDevtools` | `boolean` | `false` | Remove the Console and Network buttons, their panel and the inspections. (`devtools={false}` does the same.) |
| `devtools` | `boolean \| ReplayDevtools` | what the events say | What DevTools shows, as data, in place of what's read from the events. |
| `elements` | `ReplayElementsSource \| false` | the stage's document | Where the Elements tab reads from: `{ getDocument, getElementRect }`. |
| `defaultDevtoolsTab` | `"console" \| "network"` | none | Open the DevTools panel on this tab at mount. |
| `evidence` | `ReplayEvidence \| string` | none | A debugger's source excerpts, logpoints and screenshots: the Sources tab and screenshot captures. |
| `captions` | `string` | none | WebVTT captions on the recording's clock, shown over the page; a CC button toggles them. |
| `har` / `consoleLog` | `object \| string` / `string` | none | A HAR and a console log recorded alongside; their requests and messages join DevTools. |
| `autoCloseDevtools` | `number \| false` | `5000` | An inspection-opened DevTools panel closes after this many ms of playback with no new request, message or inspection. |
| `inspectionDwell` | `number \| false` | `2500` | Each inspection stays up at least this many ms of wall time: playback slows between inspections closer than that. |
| `inspections` | `ReplayInspection[]` | none | Requests and messages to open DevTools on as playback reaches them, added to the recording's own `inspect` events. |
| `fit` | `"width" \| "contain"` | `"width"` | `width`: the page scales to the frame's width and sets its height. `contain`: fill a frame you gave a height, letterboxed. |
| `poster` | `ReactNode` | a page-shaped skeleton | Shown until the player is ready, at the frame's final size, so nothing jumps. |
| `lazy` | `boolean` | `true` | Mount the player only when the frame nears the viewport. |
| `active` | `boolean` | `true` | `false` renders an empty placeholder frame and mounts nothing. |
| `playerRef` | `Ref<ReplayPreviewHandle>` | none | `play(offset?)`, `pause(offset?)`, `seek(ms)`, `toggle()`, `getCurrentTime()`, `inspect(id)`. |
| `onTimeUpdate` | `(ms) => void` | none | The playhead. |
| `onPlayingChange` | `(playing) => void` | none | The play state. |
| `onMarkerPress` | `(marker) => void` | none | A pressed rail mark. |
| `className` / `style` | | none | On the root (`.replay-preview`). |

`formatReplayTime(ms)` formats a time the way the player does (`m:ss`).

### Demo events

`replayDemoEvents` is the storefront recording used on this page: 67 events, about 9 s, 1280×800, with fixed timestamps, console messages and the page's requests so every render is identical. Use it for stories, tests and docs. It lives on its own entry, so it never ends up in your main bundle by accident:

```ts lineNumbers="false"
import { replayDemoEvents } from "@brett_lamy/ui/docstream/replay/demo"
```

## Build your own player

Everything the built-in chrome draws comes from pieces you can use yourself, from `@brett_lamy/ui/docstream/replay`:

- **`ReplayStage`**: the recorded page fitted to its box, with no controls. Drive it through a ref and callbacks.
- **Timeline helpers**: pure functions over the event list. They don't need rrweb, so a scrubber can render before the player loads.

This demo has its own dark frame, scrubber, colored marker ticks, speed button and a pointer that pulses on each click:

{% demo src="media-replay/custom-chrome" %}

### ReplayStage

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `events` | `ReplayEvent[]` | required | Events appended later are fed to the running player, so a live session can stream in. |
| `autoplay` / `loop` | `boolean` | `false` | |
| `speed` | `number` | `1` | Playback rate. |
| `skipInactive` | `boolean` | `true` | Fast-forward idle stretches longer than 5 s. |
| `initialTime` | `number` | `0` | Where the paused player starts (ms). |
| `fit` | `"width" \| "contain"` | `"width"` | As on `ReplayPreview`. |
| `showMouse` | `boolean` | `true` | rrweb's own cursor. Turn it off when you draw your own. |
| `overlay` | `ReactNode` | none | Drawn over the page in **recorded-viewport pixels**, scaled with it. `var(--replay-scale)` holds the scale, so an element can counter-scale to keep its on-screen size. |
| `fallback` | `ReactNode` | `null` | Shown while the rrweb chunk loads. |
| `onReady` | `({ duration, width, height }) => void` | none | |
| `onTimeUpdate` | `(ms) => void` | none | Every frame while playing, and after each seek or pause. |
| `onPlayingChange` / `onFinish` | | none | |
| `onLayout` | `({ width, height, scale, offsetX, offsetY }) => void` | none | Where the scaled page sits in the box. |

The ref (`ReplayStageHandle`) has `play(offset?)`, `pause(offset?)`, `seek(ms)`, `toggle()`, `getCurrentTime()`, `getDuration()` and `isPlaying()`. Call `preloadReplayStage()` to start downloading rrweb before the first stage renders, for example on hover.

### Timeline helpers

```ts title="timeline.ts"
import {
  getReplayMeta,
  getReplayMarkers,
  getReplayPointerTrack,
  replayPointerAt,
  getReplayDevtools,
  replayDevtoolsAt,
} from "@brett_lamy/ui/docstream/replay"

const meta = getReplayMeta(events)
// { start, end, duration, width, height, href?, playable }
// playable is false without a full DOM snapshot: rrweb can't play such a list.

const markers = getReplayMarkers(events)
// [{ id: "click-0", kind: "click", time: 1770, label, detail?, x?, y? }, …]
// kinds: click, error (console errors), network (failed requests), navigation, custom

const track = getReplayPointerTrack(events) // { moves, clicks }, in viewport px
replayPointerAt(track, 4200)                 // { x, y } between recorded points, or null

const tools = getReplayDevtools(events)
// { console: [{ id, time, level, message, args, trace?, source }], network: [{ id, time, duration?, method, url, name, status?, type, failed, … }] }
replayDevtoolsAt(tools, 4200)
// { console, network (each with pending), counts: { requests, failed, errors, warnings, laterMessages, laterRequests } }
```

The module also exports the event enums `ReplayEventType`, `ReplayIncrementalSource` and `ReplayMouseInteraction`, and `sanitizeReplayEvent`, the cleanup the player applies to each event before replaying it.

## URL helpers

```ts
import { isReplayQaUrl, normalizeReplayEmbedUrl, isRrwebUrl, splitReplayFragment } from "@brett_lamy/ui/docstream"

normalizeReplayEmbedUrl("https://app.example.com/projects/p1/explorations/t9")
// "https://app.example.com/p/p1/tasks/t9"
normalizeReplayEmbedUrl("not a url") // null

isReplayQaUrl("https://app.replay.io/recording/abc") // true: *.replay.io
isReplayQaUrl("https://example.com/p/p1/tasks/t9")   // true: a /p/ route
isRrwebUrl("./session.rrweb?v=2")                     // true
splitReplayFragment("./session.rrweb#t=4.7,7.4")      // { file: "./session.rrweb", segment: [4700, 7400] }
```

`normalizeReplayEmbedUrl` rewrites `/projects/:id/(tasks|journeys|test-runs|explorations)/:rid` to `/p/:id/…` (`explorations` becomes `tasks`), leaves other http(s) URLs as they are, and returns `null` for anything that isn't an http(s) URL.

## Styling

The player is plain CSS in `@brett_lamy/ui/docstream/styles.css`, inside the `docstream.replay` cascade layer and behind zero-specificity `:where()` selectors, so your own classes (and utilities such as `w-full`) win. If your utilities layer is declared before this stylesheet, add `@layer docstream.replay;` ahead of it. Colors come from shadcn-style tokens, each with a neutral fallback:

`--card` `--background` `--foreground` `--muted` `--muted-foreground` `--border` `--primary` `--ring` `--destructive` `--success` `--warning` `--tertiary-foreground`

The big play disc sits over a recorded page of any color, so it doesn't take the page's tokens: it follows the color-scheme, a light disc with a dark icon on light pages and a dark one with a white icon on dark pages, with at least 8:1 between icon and disc over any page. Retheme it with `--replay-play-background`, `--replay-play-foreground` and `--replay-play-ring`. On touch screens every button in the control bar is at least 44px, and the disc is 56px.

Parts are addressable by `data-slot`: `replay-preview` (with `data-state="loading|paused|playing"` and `data-chrome`), `replay-preview-bar`, `-stage`, `-poster`, `-pointer`, `-controls`, `-scrubber` and `-markers`; the DevTools are `replay-devtools-buttons` (each `replay-devtools-button` has `data-tab`) and the panel `replay-devtools`.

## See also

{% content-ref url="06-assets.md" %}
How `.rrweb` paths resolve: assets and the resolver
{% endcontent-ref %}

{% content-ref url="01-embeds-and-video.md" %}
Every embed rule, in order
{% endcontent-ref %}
