# Waveform

Audio peaks drawn across a stretch of media time: the face of a sound clip on a timeline, or a voice memo's track. Give it peaks (the loudest sample of each slice, 0 to 1), how many slices make a second (`rate`) and the range they stand for (`from` and `to`). It draws one bar per device pixel on a canvas, so it stays crisp at any width and zoom. The peaks usually come from FFmpeg (`useMediaPeaks(file)`, see [FFmpeg](https://blamy.github.io/ui/#/ffmpeg)).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/waveform.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Waveform } from '@/components/ui/waveform'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Waveform } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

{% demo src="waveform/variants" %}

```tsx
import { Waveform } from '@/components/ui/waveform'
import { useMediaPeaks } from '@/lib/ffmpeg/react'

const peaks = useMediaPeaks(file)
{peaks.data ? <Waveform peaks={peaks.data.peaks} rate={peaks.data.rate} from={clip.in} to={clip.out} gain={clip.volume} /> : null}
```

`variant` is `mirror` (growing from the middle, the default) or `bottom` (rising from the floor). `tone` picks the colour (`default`, `primary`, `success`, `muted`), or set any text colour with a `text-…` class: the bars are drawn in the element's `color`. `gain` scales the bars, so a clip's volume shows. Like Filmstrip it fills its box, and it's decorative.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `waveformVariants`

Defined in `@/components/ui/waveform`. Base classes:

```text
relative block h-full w-full
```

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `text-foreground/55` |
| `primary` | `text-primary` |
| `success` | `text-success` |
| `muted` | `text-muted-foreground` |
