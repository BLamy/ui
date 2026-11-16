# Waveform

Audio peaks drawn across a stretch of media time: the face of a sound clip on a timeline, or a voice memo's track. Give it peaks (the loudest sample of each slice, 0 to 1), how many slices make a second (`rate`) and the range they stand for (`from` and `to`). It draws one bar per device pixel on a canvas, so it stays crisp at any width and zoom. The peaks usually come from FFmpeg (`useMediaPeaks(file)`, see [FFmpeg](https://blamy.github.io/ui/#/ffmpeg)). For frames of video use [Filmstrip](https://blamy.github.io/ui/#/filmstrip); for a live level meter, a [Progress](https://blamy.github.io/ui/#/progress) bar driven by the current level.

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

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Waveform } from '@brett_lamy/ui/waveform'
```
{% endtab %}
{% endtabs %}

{% demo src="waveform/variants" %}

```tsx
import { Waveform } from '@/components/ui/waveform'
import { useMediaPeaks } from '@/lib/ffmpeg/react'

const peaks = useMediaPeaks(file)
<Waveform peaks={peaks.data?.peaks ?? []} rate={peaks.data?.rate ?? 50} loading={peaks.loading} from={clip.in} to={clip.out} gain={clip.volume} />
```

`gain` scales the bars, so a clip's volume shows. While the peaks are still coming (`loading`, which defaults to "`peaks` is empty"), a flat shimmering band stands where the bars will be (`data-loading` on the canvas; still under reduced motion), as [Filmstrip](https://blamy.github.io/ui/#/filmstrip) shimmers its cells, so an audio clip keeps its look beside a loading video clip. Pass the extraction's own state, `loading={useMediaPeaks(file).loading}`, so a silent file (or an FFmpeg error) settles on an empty strip instead of shimmering forever. Like Filmstrip it fills its box, and it's decorative (`aria-hidden`): label what it sits in.

| Prop | Default | Effect |
| --- | --- | --- |
| `peaks` | required | The loudest sample of each slice, 0 to 1. |
| `rate` | required | Slices per second. |
| `from` / `to` | 0 / the end of the peaks | The media time at the left and right edges. |
| `gain` | `1` | Scales the bars (a clip's volume). |
| `loading` | `peaks` is empty | The loading band instead of bars. `false` with no peaks: empty. |
| `variant` | `mirror` | `mirror` grows from the middle; `bottom` rises from the floor. |
| `tone` | `default` | `default` (the text colour at 70 %), `muted`, or the semantic `success`, `warning` and `destructive`. Any `text-…` class tints it instead (`className="text-primary"`): the bars are drawn in the element's `color`, read again when the appearance changes. |
| `className` / `style` / `ref` | — | On the `<canvas>`. |

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `waveformVariants`

Defined in `@/components/ui/waveform`. Base classes:

```text
relative block h-full w-full
```

**`variant`** — default `mirror`

| Value | Adds |
| --- | --- |
| `mirror` (default) | — |
| `bottom` | — |

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `text-foreground/70` |
| `muted` | `text-muted-foreground/60` |
| `success` | `text-success` |
| `warning` | `text-warning` |
| `destructive` | `text-destructive` |
