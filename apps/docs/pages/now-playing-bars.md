# NowPlayingBars

The little equaliser that bounces beside the track that's playing. Each bar scales from the bottom on its own slightly different period, so they never fall into step; paused, they settle to a still, uneven skyline. It's drawn in `currentColor` and sized in pixels, so it sits in a list row, a mini player or a tab bar. It shows a media state, not a wait: for "something is loading" use [Spinner](https://blamy.github.io/ui/#/spinner). The two share `speed` (a multiplier, bigger is faster); NowPlayingBars says `playing` where Spinner says `paused`, because a track's natural state is playing or not.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/now-playing-bars.json https://blamy.github.io/ui/r/slider.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { NowPlayingBars } from '@/components/ui/now-playing-bars'
import { Slider } from '@/components/ui/slider'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { NowPlayingBars, Slider } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

```tsx
<NowPlayingBars playing={isPlaying} aria-label={isPlaying ? 'Now playing' : 'Paused'} />
```

Tap a track to play it, tap it again to pause:

{% demo src="now-playing-bars/track-list" %}

## In a mini player

Beside the artwork and a scrubber: the bars mark what is playing, and the [Slider](https://blamy.github.io/ui/#/slider)s use its `variant="on-dark"` for translucent tracks over dark glass (the Slider page documents its variants).

{% demo src="now-playing-bars/media-controls" %}

```tsx
<NowPlayingBars size={16} playing={playing} className="text-white" />
<Slider aria-label="Playback position" variant="on-dark" size="sm" max={duration} value={position} onValueChange={(value) => seek(value)} />
```

## Accessibility

Without an `aria-label` the bars are hidden from assistive tech (the row usually says "Now playing" itself). With one they are an image with that name; change it with the state (`'Now playing'` / `'Paused'`). With `prefers-reduced-motion` the bars stay still while playing too; the row's color and the label still say which track is playing.

## Props

Every `span` attribute (`id`, `title`, `data-*`, `ref`) passes through.

| Prop | Default | Effect |
| --- | --- | --- |
| `playing` | `true` | Bouncing or still. |
| `bars` | `4` | Number of bars. |
| `size` | `14` | Height in px; bar width and gap scale with it. |
| `barWidth` / `gap` | from `size` | Explicit bar width and gap in px. |
| `speed` | `1` | Playback speed, a multiplier like Spinner's (0.25–3): `1` is a 0.7s bounce for the first bar, the others a little slower. |
| `aria-label` | — | Makes it an image with this label. |
