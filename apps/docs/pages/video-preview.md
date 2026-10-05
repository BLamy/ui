# VideoPreview

Plays a video timeline live in the page, with nothing rendered ahead of time. Every clip near the playhead is a `<video>`, `<audio>` or `<img>` of its media, laid out in its frame, with its look as a CSS filter and its fades and dissolves as opacity and volume, bottom track first. A **playback clock** owns the time and the elements follow it. They play along while it runs, re-sync when they drift, and seek as it scrubs; the next clip on each track loads ahead so a cut doesn't stall. A preview and a [VideoTimeline](https://blamy.github.io/ui/#/video-timeline) on the same clock move together.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/video-preview.json https://blamy.github.io/ui/r/playback.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  VideoPreview, PlaybackControls,
} from '@/components/ui/video-preview'
import { usePlaybackClock } from '@/lib/playback'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  VideoPreview, PlaybackControls, usePlaybackClock,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## A composition

`media` maps each media id the clips use to a URL and a kind (`video`, `audio` or `image`): object URLs of the user's files, typically. `renderClip` draws a clip that isn't a file, such as a title or a shape, and returns undefined for the rest. `format` gives the output's width and height; the picture keeps that aspect and is as large as its box allows. `children` go over the picture: guides, a big play button.

{% demo src="video-preview/composition" %}

```tsx
import { PlaybackControls, VideoPreview } from '@/components/ui/video-preview'
import { usePlaybackClock } from '@/lib/playback'

const clock = usePlaybackClock()
useEffect(() => clock.setDuration(timelineDuration(timeline)), [clock, timeline])

<VideoPreview
  timeline={timeline}
  media={{ beach: { url: URL.createObjectURL(file), kind: 'video' } }}
  clock={clock}
  format={{ width: 1280, height: 720 }}
  renderClip={(clip) => (clip.media === 'title' ? <Title clip={clip} /> : undefined)}
/>
<PlaybackControls clock={clock} fps={30} />
```

## The playback clock

`usePlaybackClock()` makes a clock that lives as long as the component, and `createPlayback()` makes one outside React. It has `play`, `pause`, `toggle`, `seek(t)`, `step(seconds)`, `setDuration`, `setRate`, `setLoop` and `setScrubbing`. While playing it advances on animation frames and stops at the end, or loops. It is a small external store: `subscribe` hears every tick, which is how a playhead moves without re-rendering, and `usePlaybackState(clock, (s) => s.playing)` re-renders a component only when the part it selects changes. Its methods work detached (`onPress={clock.toggle}`).

`PlaybackControls` has go to start, previous frame, play/pause, next frame, go to end and the timecode. `PlaybackTimecode` is the timecode alone: `HH:MM:SS:FF` with `fps`, else `M:SS.t`.

## How close is it to the render

The preview draws the same timeline the [render](https://blamy.github.io/ui/#/video-timeline) does, with the browser's tools instead of FFmpeg's, so a few things differ:

- A media element's volume stops at 100 %; a clip at 150 % plays at full volume here and louder in the render.
- Looks are CSS filters, matched to the render's FFmpeg filters by design but not to the pixel.
- The browser decodes what it can play. A file only FFmpeg reads (HEVC in Firefox, say) shows in the render but not here; transcode a proxy with FFmpeg to edit it.
- Elements are re-synced when they drift more than a quarter second, so a slow machine can hitch at a cut where the render won't.
