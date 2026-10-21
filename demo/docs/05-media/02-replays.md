---
description: Play rrweb session recordings in the page, with a browser frame, a scrubber that marks clicks, errors and failed requests, a drawn cursor, and a headless stage for building your own player.
---

# Session replays

docstream plays [rrweb](https://github.com/rrweb-io/rrweb) recordings: the DOM of a real session, rebuilt and replayed in the page, without video. Put one in Markdown with an embed of a `.rrweb` file, or render `ReplayPreview` with the events you already hold. The player's code loads the first time a player renders. A page that never shows a recording never downloads rrweb.

{% embed url="/docstream/replays/checkout.rrweb" title="Checkout fails with a 500" %}

```md
{% embed url="/docstream/replays/checkout.rrweb" title="Checkout fails with a 500" %}
```

That recording is a 9-second session on a mock storefront: a shopper adds two products, opens the cart, types an email and a promo code, and "Place order" fails. The rail above the scrubber marks each click, the `POST /api/checkout` 500 and the error that follows. Press a mark to jump to it. Click inside the player and use the keyboard:

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

A request counts as failed when its status is 0 or 400 and up, when it has an `error`, or when its tag says so. The buttons appear only when the recording has messages or requests; `devtools={false}` hides them, and `defaultDevtoolsTab="network"` opens the panel at mount.

## Three ways in

{% tabs %}
{% tab title=".rrweb file" %}
An embed whose URL ends in `.rrweb` renders `ReplayFile`. The file is a JSON array of rrweb events, or an object `{ "events": [...] }`. The URL goes through the host's [asset resolver](06-assets.md), and the file isn't fetched until the player scrolls within 240 px of the viewport, so a page of ten recordings downloads one at a time as you read.

```md
{% embed url="./recordings/signup.rrweb" title="Sign-up flow" %}
```
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
import { ReplayPreview, ReplayFile } from "@brett_lamy/docstream"

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
| `events` / `source` | `ReplayEvent[]` / `ReplaySource` | none | One of the two. |
| `chrome` | `"browser" \| "minimal" \| "none"` | `"browser"` (`"minimal"` for iframes) | Window with traffic lights and URL bar; a rounded card; or no frame, filling the parent. |
| `url` | `string` | the recording's | Address in the URL bar. By default it follows the recording's own navigations, led by path, query and hash. |
| `title` | `string` | `"Session replay"` | Accessible name (the iframe title for page URLs). |
| `trafficLights` | `boolean` | `true` | The macOS window buttons in `browser` chrome. |
| `controls` | `boolean` | `true` | Play/pause, scrubber, speed, fullscreen. `controls={false}` with `chrome="none"` is a still frame at `initialTime`. |
| `autoplay` / `loop` | `boolean` | `false` | Start on load; restart at the end. |
| `initialTime` | `number` | `0` | Where the player starts, in ms. |
| `speeds` | `number[]` | `[1, 2, 4, 0.5]` | What the speed button cycles through. The first is the starting speed. |
| `markers` | `boolean \| ReplayMarker[]` | `true` | `true` reads them from the recording, `false` hides the rail, or pass your own. |
| `markerKinds` | `ReplayMarkerKind[]` | all | Which recorded kinds to show: `click`, `error`, `network`, `navigation`, `custom`. |
| `cursor` | `boolean` | `true` | Draw the recorded pointer and click ripples. |
| `devtools` | `boolean` | `true` | The Console and Network buttons and their panel, when the recording has messages or requests. |
| `defaultDevtoolsTab` | `"console" \| "network"` | none | Open the DevTools panel on this tab at mount. |
| `fit` | `"width" \| "contain"` | `"width"` | `width`: the page scales to the frame's width and sets its height. `contain`: fill a frame you gave a height, letterboxed. |
| `poster` | `ReactNode` | a page-shaped skeleton | Shown until the player is ready, at the frame's final size, so nothing jumps. |
| `lazy` | `boolean` | `true` | Mount the player only when the frame nears the viewport. |
| `active` | `boolean` | `true` | `false` renders an empty placeholder frame and mounts nothing. |
| `playerRef` | `Ref<ReplayPreviewHandle>` | none | `play(offset?)`, `pause(offset?)`, `seek(ms)`, `toggle()`, `getCurrentTime()`. |
| `onTimeUpdate` | `(ms) => void` | none | The playhead. |
| `onPlayingChange` | `(playing) => void` | none | The play state. |
| `onMarkerPress` | `(marker) => void` | none | A pressed rail mark. |
| `className` / `style` | | none | On the root (`.replay-preview`). |

`formatReplayTime(ms)` formats a time the way the player does (`m:ss`).

### Demo events

`replayDemoEvents` is the storefront recording used on this page: 67 events, about 9 s, 1280×800, with fixed timestamps, console messages and the page's requests so every render is identical. Use it for stories, tests and docs. It lives on its own entry, so it never ends up in your main bundle by accident:

```ts lineNumbers="false"
import { replayDemoEvents } from "@brett_lamy/docstream/replay/demo"
```

## Build your own player

Everything the built-in chrome draws comes from pieces you can use yourself, from `@brett_lamy/docstream/replay`:

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
} from "@brett_lamy/docstream/replay"

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
import { isReplayQaUrl, normalizeReplayEmbedUrl, isRrwebUrl } from "@brett_lamy/docstream"

normalizeReplayEmbedUrl("https://app.example.com/projects/p1/explorations/t9")
// "https://app.example.com/p/p1/tasks/t9"
normalizeReplayEmbedUrl("not a url") // null

isReplayQaUrl("https://app.replay.io/recording/abc") // true: *.replay.io
isReplayQaUrl("https://example.com/p/p1/tasks/t9")   // true: a /p/ route
isRrwebUrl("./session.rrweb?v=2")                     // true
```

`normalizeReplayEmbedUrl` rewrites `/projects/:id/(tasks|journeys|test-runs|explorations)/:rid` to `/p/:id/…` (`explorations` becomes `tasks`), leaves other http(s) URLs as they are, and returns `null` for anything that isn't an http(s) URL.

## Styling

The player is plain CSS in `@brett_lamy/docstream/styles.css`, inside the `docstream.replay` cascade layer and behind zero-specificity `:where()` selectors, so your own classes (and utilities such as `w-full`) win. If your utilities layer is declared before this stylesheet, add `@layer docstream.replay;` ahead of it. Colors come from shadcn-style tokens, each with a neutral fallback:

`--card` `--background` `--foreground` `--muted` `--muted-foreground` `--border` `--primary` `--ring` `--destructive` `--success` `--warning` `--tertiary-foreground`

Parts are addressable by `data-slot`: `replay-preview` (with `data-state="loading|paused|playing"` and `data-chrome`), `replay-preview-bar`, `-stage`, `-poster`, `-pointer`, `-controls`, `-scrubber` and `-markers`; the DevTools are `replay-devtools-buttons` (each `replay-devtools-button` has `data-tab`) and the panel `replay-devtools`.

## See also

{% content-ref url="06-assets.md" %}
How `.rrweb` paths resolve: assets and the resolver
{% endcontent-ref %}

{% content-ref url="01-embeds-and-video.md" %}
Every embed rule, in order
{% endcontent-ref %}
