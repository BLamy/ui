# ReplayPreview

A session replay in a browser window. `ReplayPreview` plays an [rrweb](https://github.com/rrweb-io/rrweb) recording with docstream's headless `ReplayStage` and wraps it in browser chrome: a URL bar that follows the recording's navigations, play/pause, a scrubber with the recording's moments on a rail above it, a speed control, fullscreen, and a drawn cursor whose clicks ripple. Until the player is ready, a page-shaped skeleton holds the frame at the recording's aspect ratio, so nothing jumps when the page appears.

`ReplayPreview` lives in [`@brett_lamy/docstream`](https://blamy.github.io/ui/#/docstream) (1.7.0, `@brett_lamy/docstream/replay`), next to the rrweb stage and the marker helpers it is built on. BL UI keeps a thin re-export, so `@/components/ui/replay-preview` (and the package root) resolves like every other part. The registry item adds `@brett_lamy/docstream` as its one npm dependency.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/replay-preview.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { ReplayPreview } from '@/components/ui/replay-preview'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { ReplayPreview } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

Import docstream's stylesheet once. The player is plain CSS in `@layer docstream.replay` under zero-specificity selectors, so your utilities and rules override it, and it reads your shadcn tokens (`--card`, `--border`, `--primary`, `--muted-foreground`, `--destructive`, `--success`, `--warning`, `--tertiary-foreground`, `--ring`) with neutral fallbacks:

```tsx
import '@brett_lamy/docstream/styles.css'
```

Using docstream directly is the same component: `import { ReplayPreview } from '@brett_lamy/docstream/replay'`.


## Browser frame

The rail marks what happened: clicks as small ticks, then console errors, failed requests, navigations and custom events (checkpoints) as coloured dots. Press one to jump there. Everything is driven by the playhead (the cursor, the ripples, the URL), so scrubbing backwards replays it all.

{% demo src="replay-preview/browser-frame" %}

```tsx
<ReplayPreview events={events} initialTime={6400} />
```

Keys work anywhere inside the player: **Space** / **K** play and pause, **←** **→** seek 5 s, **J** / **L** 10 s, **<** **>** change speed, **F** full screen, **Home** / **End** jump to the ends. rrweb and its stylesheet load the first time a player mounts, and with `lazy` (the default) that happens only once the frame nears the viewport.

## Driving it from outside

`playerRef` hands you `play`, `pause`, `seek`, `toggle` and `getCurrentTime`; `onTimeUpdate` reports the playhead every frame while playing, and after each seek. Here the recording's own markers (`getReplayMarkers`) become a chronology that seeks the player and dims the steps still ahead.

{% demo src="replay-preview/chronology" %}

```tsx
const player = useRef<ReplayPreviewHandle>(null)
const steps = getReplayMarkers(events).filter((m) => m.kind !== 'click')

<ReplayPreview events={events} playerRef={player} onTimeUpdate={setTime} />
{steps.map((m) => <Button onPress={() => player.current?.seek(m.time)}>{m.label}</Button>)}
```

## Still frames

With `chrome="none"` and `controls={false}` the player is a still frame of the page at `initialTime`, with the pointer and any click ripple. Loop QA uses these as a bug's screenshot evidence: they are the page itself, not an image of it.

{% demo src="replay-preview/evidence-frames" %}

```tsx
<ReplayPreview events={events} chrome="none" controls={false} initialTime={8350} />
```

## Your own markers

Pass `markers` to put your own moments on the rail (an agent's findings, a test's assertions), or `markerKinds` to filter the recorded ones (`['error', 'network']`). `url` fixes the address shown in the URL bar, and `trafficLights={false}` drops the window buttons.

{% demo src="replay-preview/custom-markers" %}

```tsx
<ReplayPreview events={events} markers={findings} url="https://shop.example/checkout" trafficLights={false}
  onMarkerPress={(m) => console.log(m.label)} />
```

## Recordings

Record with rrweb (`record({ emit })`) and pass the events. To embed instead of hold the recording, pass `source`: a public Loop QA URL, `{ kind: 'events-url', url }` for an events endpoint, or an event array. `events` and `source` are alternatives; both render the same player. Local and private-network assets in a recording (`localhost`, `10.x`, `192.168.x`…) are swapped for blanks before playback, so a replay never makes the viewer's browser fetch from their own network. Custom events become markers by tag (`record.addCustomEvent(tag, payload)`): `error` and `network` map to those kinds, `navigation` to a navigation, anything else is a checkpoint labelled by `payload.label`. The helpers read a recording without loading rrweb:

| Helper | Returns |
| --- | --- |
| `getReplayMeta(events)` | `{ duration, width, height, href, playable, start, end }` |
| `getReplayMarkers(events)` | `ReplayMarker[]`: clicks, console errors (rrweb console plugin), failed requests (network plugin, status 0 or ≥ 400), navigations, custom events |
| `getReplayPointerTrack(events)` · `replayPointerAt(track, ms)` | The recorded pointer path and clicks; the pointer's position at a time |
| `formatReplayTime(ms)` | `m:ss` |

`replayDemoEvents`, from `@brett_lamy/docstream/replay/demo` (also re-exported by `@/components/ui/replay-preview`), is a small synthetic recording (58 events, 20 KB): a shopper on a mock storefront whose checkout fails with a promo code.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `events` | — | The rrweb recording (`ReplayEvent[]`). Give `events` or `source`. |
| `source` | — | The embed form: a Loop QA URL, `{ kind: 'events-url', url }`, or an event array. |
| `active` | `true` | Keep a placeholder frame until true, e.g. until an editor block is visible. |
| `chrome` | `browser` | `browser` (window, URL bar), `minimal` (a card), `none` (no frame). |
| `trafficLights` | `true` | The window buttons in the browser chrome. |
| `url` | the recording's | Address in the URL bar. |
| `title` | `Session replay` | The player's accessible name. |
| `controls` | `true` | Play/pause, scrubber, speed and fullscreen. |
| `autoplay` · `loop` | `false` | Start playing on load; restart at the end. |
| `initialTime` | `0` | Where the player starts (ms). |
| `speeds` | `[1, 2, 4, 0.5]` | What the speed button cycles through; the first is the initial speed. |
| `markers` | `true` | `true` reads them from the recording, `false` hides the rail, or pass `ReplayMarker[]`. |
| `markerKinds` | all | Which recorded kinds to show. |
| `cursor` | `true` | Draw the recorded pointer and click ripples. |
| `fit` | `width` | `width`: the page sets the frame's height. `contain`: fill a sized frame and letterbox the page. |
| `poster` | page skeleton | Shown until the player is ready. |
| `lazy` | `true` | Mount the player once the frame nears the viewport. |
| `playerRef` | — | `{ play, pause, seek, toggle, getCurrentTime }`. |
| `onTimeUpdate` · `onPlayingChange` · `onMarkerPress` | — | Playhead (ms), play state, a pressed marker. |

## Styling

The root is `data-slot="replay-preview"` with `data-state` (`loading` · `paused` · `playing`) and `data-chrome`. Its parts are `replay-preview-bar`, `-stage`, `-poster`, `-pointer`, `-controls`, `-scrubber` and `-markers`, plus `-url`, `-center`, `-play`, `-time`, `-speed` and `-fullscreen`. Style them with `[data-slot=…]` selectors or utilities on `className`. Since the move to docstream the scrubber is a native range input, marker tooltips are `title` attributes, the icons are lucide, and the old `replayPreviewVariants` and `replayMarkerVariants` recipes are gone; the look is plain CSS on the tokens above.
