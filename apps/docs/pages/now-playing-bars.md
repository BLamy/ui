# NowPlayingBars

The little equaliser that bounces beside the track that's playing. Each bar scales from the bottom on its own slightly different period, so they never fall into step; paused, they settle to a still, uneven skyline. It's drawn in `currentColor` and sized in pixels, so it sits in a list row, a mini player or a tab bar.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { NowPlayingBars, Slider } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/now-playing-bars.json{% endcommand %}

Adds `@/components/ui/now-playing-bars.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  NowPlayingBars, Slider,
} from '@/components/ui/now-playing-bars'
```
{% endtab %}
{% endtabs %}

## Usage

```tsx
<NowPlayingBars playing={isPlaying} aria-label={isPlaying ? 'Now playing' : 'Paused'} />
```

Tap a track to play it, tap it again to pause:

{% demo src="now-playing-bars/track-list" %}

With `prefers-reduced-motion` the bars stay still while playing too; the row's color and the label still say which track is playing. Without an `aria-label` the bars are hidden from assistive tech (the row usually says so itself).

| Prop | Default | Effect |
| --- | --- | --- |
| `playing` | `true` | Bouncing or still. |
| `bars` | `4` | Number of bars. |
| `size` | `14` | Height in px; bar width and gap scale with it. |
| `barWidth` / `gap` | from `size` | Explicit bar width and gap in px. |
| `speed` | `0.7` | Seconds per bounce of the first bar (the others run a little slower). |
| `aria-label` | — | Makes it an image with this label. |

## Media controls: Slider tones

Controls over artwork or dark glass need translucent tracks rather than the tint on the fill color. `Slider` takes a `tone` — `default`, `onDark` (translucent white, like Music's scrubber and volume) or `onLight` (translucent black) — and `size="sm"` for the scrubber's small thumb that grows while you drag. `trackColor`, `fillColor` and `thumbColor` fine-tune any of them, so there's no need to override the `--bl-*` tokens around a slider.

{% demo src="now-playing-bars/media-controls" %}

```tsx
<Slider aria-label="Playback position" tone="onDark" size="sm" maxValue={duration} value={position} onChange={seek} />
<Slider aria-label="Brightness" fillColor="#FF9F0A" trackColor="rgba(255,159,10,.22)" defaultValue={60} />
```
