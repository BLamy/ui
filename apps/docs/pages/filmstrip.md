# Filmstrip

A row of video frames standing for a stretch of media time: the face of a clip on a timeline, or a scrubber's track. Give it frames (`{ time, src }`) and the range they stand for (`from` and `to`, a clip's in and out points). It tiles its width with frame-shaped cells, each showing the frame nearest the time it covers, so it reads right at any width: trim a clip and the strip shows less of the file, zoom out and the frames thin out. The frames usually come from FFmpeg (`useMediaFrames(file)`, see [FFmpeg](https://blamy.github.io/ui/#/ffmpeg)).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/filmstrip.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Filmstrip } from '@/components/ui/filmstrip'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Filmstrip } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

{% demo src="filmstrip/range" %}

```tsx
import { Filmstrip } from '@/components/ui/filmstrip'
import { useMediaFrames } from '@/lib/ffmpeg/react'

const frames = useMediaFrames(file, { count: 24, height: 64 })
<div className="h-14">
  <Filmstrip frames={frames.data ?? []} from={clip.in} to={clip.out} />
</div>
```

The strip fills its box: give the box a height. Cells keep the media's aspect, measured from the first frame unless you pass `aspect`. It's decorative and hidden from assistive technology; label what it sits in (a timeline clip names itself).
