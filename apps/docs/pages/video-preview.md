# VideoPreview

Plays a video timeline live in the page, with nothing rendered ahead of time. Every clip near the playhead is a `<video>`, `<audio>` or `<img>` of its media, laid out in its frame, with its look as a CSS filter and its fades and dissolves as opacity and volume, bottom track first. A **playback clock** owns the time and the elements follow it. They play along while it runs, re-sync when they drift, and seek as it scrubs; the next clip on each track loads ahead so a cut doesn't stall. A preview and a [VideoTimeline](https://blamy.github.io/ui/#/video-timeline) on the same clock move together. Use it to preview an edit while it is being made; to play one finished file, a plain `<video controls>` is enough, and to export the edit, render it with [FFmpeg](https://blamy.github.io/ui/#/ffmpeg).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/video-preview.json https://blamy.github.io/ui/r/playback.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  VideoPreview, VideoPreviewControls,
} from '@/components/ui/video-preview'
import { usePlaybackClock } from '@/lib/playback'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  VideoPreview, VideoPreviewControls,
} from '@brett_lamy/ui/video-preview'
import { usePlaybackClock } from '@brett_lamy/ui/lib/playback'
```
{% endtab %}
{% endtabs %}

## A composition

`media` maps each media id the clips use to a `VideoTimelineMedia`, `{ kind, url?, duration?, name? }`: the preview reads the `kind` (`video`, `audio` or `image`) and the `url` (object URLs of the user's files, typically). It is the same map a [VideoTimeline](https://blamy.github.io/ui/#/video-timeline) on the same clock takes, which reads `duration` and `name`, so build it once. `renderClip` draws a clip that isn't a file, such as a title or a shape, and returns undefined for the rest. `format` gives the output's width and height; the picture keeps that aspect and is as large as its box allows. `children` go over the picture: guides, a big play button.

{% demo src="video-preview/composition" %}

```tsx
import { VideoPreviewControls, VideoPreview } from '@/components/ui/video-preview'
import { usePlaybackClock } from '@/lib/playback'

const playback = usePlaybackClock()
useEffect(() => playback.setDuration(timelineDuration(timeline)), [playback, timeline])

<VideoPreview
  timeline={timeline}
  media={{ beach: { url: URL.createObjectURL(file), kind: 'video' } }}
  playback={playback}
  format={{ width: 1280, height: 720 }}
  renderClip={(clip) => (clip.media === 'title' ? <Title clip={clip} /> : undefined)}
/>
<VideoPreviewControls playback={playback} fps={30} />
```

## The playback clock

`usePlaybackClock()` makes a clock that lives as long as the component, and `createPlayback()` makes one outside React. It has `play`, `pause`, `toggle`, `seek(t)`, `step(seconds)`, `setDuration`, `setRate`, `setLoop` and `setScrubbing`. While playing it advances on animation frames and stops at the end, or loops. It is a small external store: `subscribe` hears every tick, which is how a playhead moves without re-rendering, and `usePlaybackState(clock, (s) => s.playing)` re-renders a component only when the part it selects changes. Its methods work detached (`onClick={clock.toggle}`).

`VideoPreviewControls` has go to start, previous frame, play/pause, next frame, go to end and the timecode. It is the kit's [Toolbar](https://blamy.github.io/ui/#/toolbar) (`variant="plain"`, `size="sm"`) named "Playback": one Tab stop, ←/→ between the buttons, Home/End to the first and last. `VideoPreviewTimecode` is the timecode alone: `HH:MM:SS:FF` with `fps`, else `M:SS.t`.

## API

### `<VideoPreview>`

| Prop | Default | Effect |
| --- | --- | --- |
| `timeline` | required | The `Timeline` to play. |
| `media` | required | `Record<id, VideoTimelineMedia>`: each media id's `kind` (`video`, `audio`, `image`) and `url` (a clip whose media has no `url` is not drawn). |
| `playback` | required | The shared clock (`usePlaybackClock`) the picture follows. |
| `format` | required | The output's `width` and `height`; only the aspect matters here. |
| `renderClip(clip, track)` | — | Draws a clip that isn't a file (a title); return undefined for the rest. |
| `preload` | `2` | Seconds ahead a clip starts loading. |
| `children` | — | Over the picture: guides, a play button. |
| `aria-label` | "Preview" | Names the preview's group, to tell a source monitor from a program monitor. |
| `className`, `style`, other `div` props | — | On the root. |

### `<VideoPreviewControls>`

| Prop | Default | Effect |
| --- | --- | --- |
| `playback` | required | The clock the buttons drive. |
| `fps` | `30` | Frames per second, for the frame steps and the timecode. |
| `timecode` | `true` | Show the timecode after the buttons. |
| Toolbar props | `size="sm"`, `aria-label="Playback"` | `variant`, `size`, `className`… |

### `<VideoPreviewTimecode>`

| Prop | Default | Effect |
| --- | --- | --- |
| `playback` | required | The clock it shows. |
| `fps` | — | Show `HH:MM:SS:FF` instead of `M:SS.t`. |
| `showDuration` | `false` | Also show the length. |

## How close is it to the render

The preview draws the same timeline the [render](https://blamy.github.io/ui/#/video-timeline) does, with the browser's tools instead of FFmpeg's, so a few things differ:

- A media element's volume stops at 100 %; a clip at 150 % plays at full volume here and louder in the render.
- Looks are CSS filters, matched to the render's FFmpeg filters by design but not to the pixel.
- The browser decodes what it can play. A file only FFmpeg reads (HEVC in Firefox, say) shows in the render but not here; transcode a proxy with FFmpeg to edit it.
- Elements are re-synced when they drift more than a quarter second, so a slow machine can hitch at a cut where the render won't.
