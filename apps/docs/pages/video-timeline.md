# VideoTimeline

A video editor's timeline. A ruler you scrub sits over one lane per track, each behind a header that hides, mutes or locks it. On a lane are clips: drag one along its track or to another track, drag an edge to trim it, and watch the playhead run over them. The main track is **magnetic**: its clips butt end to end, so trimming or removing one closes the gap, and dragging one makes room among the others. Moves and trims land on frames and snap to clip edges and the playhead. It edits a plain `Timeline` value, a model of pure functions you can also drive from code, and the same value plays live in [VideoPreview](https://blamy.github.io/ui/#/video-preview) and renders with [FFmpeg](https://blamy.github.io/ui/#/ffmpeg).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/video-timeline.json https://blamy.github.io/ui/r/playback.json https://blamy.github.io/ui/r/video-timeline-model.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { VideoTimeline } from '@/components/ui/video-timeline'
import { usePlaybackClock } from '@/lib/playback'
import { splitClip } from '@/lib/video-timeline'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  VideoTimeline, usePlaybackClock, splitClip,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## An edit

The timeline is controlled. It draws `timeline` and calls `onChange` once per gesture, when the drag ends, so each edit is one undo step: keep the old values and you have undo. A playback clock (`usePlaybackClock`) carries the time it shares with a preview and transport controls. `renderClip` draws a clip's content: a [Filmstrip](https://blamy.github.io/ui/#/filmstrip) for video, a [Waveform](https://blamy.github.io/ui/#/waveform) for sound, a title's text. `clipClassName` tints a kind of clip.

{% demo src="video-timeline/editor" %}

```tsx
import { VideoTimeline } from '@/components/ui/video-timeline'
import { usePlaybackClock } from '@/lib/playback'
import { timelineDuration } from '@/lib/video-timeline'

const clock = usePlaybackClock()
const [timeline, setTimeline] = useState(start)
useEffect(() => clock.setDuration(timelineDuration(timeline)), [clock, timeline])

<VideoTimeline
  timeline={timeline}
  onChange={setTimeline}
  clock={clock}
  fps={30}
  media={{ beach: { kind: 'video', duration: 12, name: 'Beach' } }}
  renderClip={(clip) => <Filmstrip frames={frames[clip.media]} from={clip.in} to={clip.out} />}
/>
```

`media` gives each media id its length (a trim can't run past the end of the file; stills have no limit) and the name a clip shows. `selection` / `onSelectionChange` and `zoom` / `onZoomChange` (pixels per second) can be controlled; `fitTimelineZoom(duration, width)` fits an edit to a width. `onDropMedia(id, { trackId, time, index })` reports media dragged in from a library: put `timelineMediaType` on the drag with the media id.

## The model

A `Timeline` is `tracks`, and the first video track draws on top. A track has a `kind` (`video` or `audio`), `clips`, and `magnetic`, `muted`, `hidden` and `locked` flags. A clip plays part of a media file:

| Field | Meaning |
| --- | --- |
| `media` | The id of the file it plays (yours to resolve: a File for a render, a URL for the preview). |
| `start` | Where it starts on the timeline, in seconds (worked out for you on a magnetic track). |
| `in`, `out` | The part of the file it plays, in seconds of the source. |
| `speed` | Playback rate: at 2 the clip lasts (out − in) / 2. |
| `volume`, `muted` | Gain, 0–2, and silence. |
| `fadeIn`, `fadeOut` | Seconds of fade from and to nothing: black, or the tracks below, and silence. |
| `transition` | On a magnetic track, seconds this clip dissolves in over the one before it (it starts that much earlier). |
| `frame` | Where the picture sits, as fractions of the frame (picture in picture). |
| `fit` | `contain` letterboxes the picture into its frame; `cover` fills it and crops. |
| `look` | A colour look: `mono`, `noir`, `sepia`, `vintage`, `vivid` or `fade`. |
| `label`, `data` | A name, and anything your app keeps with the clip (a title's text). |

Edits are pure: each takes a timeline and returns a new one. `splitClip(tl, id, time)`, `trimClip(tl, id, 'start' | 'end', time, { mediaDuration })`, `moveClip(tl, id, { trackId, start, index })`, `insertClip`, `removeClips`, `updateClip`, `updateTrack` and `sliceTimeline(tl, from, to)` (a range moved to 0, for exporting part of an edit). Lay a magnetic track out with `layoutTrack`; edits do it for you. To measure, use `clipDuration`, `clipEnd`, `sourceTime(clip, t)`, `timelineDuration` and `clipsAt(tl, t)`. To snap, `snapTargets` and `snapTime`; for time, `quantize(t, fps)`, `formatTimecode(t, fps)` (`00:01:02:15`) and `parseTimecode`.

## Editing

| Do | To |
| --- | --- |
| Drag a clip | Move it: along a free track, among a magnetic track's clips (they make room), or to another track of its kind. |
| Drag a clip's edge | Trim it. On a magnetic track the clips after it follow; the playhead follows the edge, so a preview shows that frame. |
| Hold ⌥ (Alt) while dragging | Place without snapping. |
| Click or drag the ruler | Move the playhead (it pauses playback and marks the clock as scrubbing). |
| Click a clip; ⇧ or ⌘-click | Select it; add it to the selection or take it out. |
| ⌘ or Ctrl + wheel, or pinch | Zoom around the pointer. |

From the keyboard, Tab reaches the ruler (a slider: ←/→ a frame, ⇧ a second, Home/End, Page Up/Down ten seconds) and the clips. On a clip, ←/→ nudges it a frame (⇧ a second) or moves it among magnetic clips. Delete removes the selection, Enter selects, Escape clears. A locked track's clips can be selected but not changed.

## Rendering

`renderTimeline(ffmpeg, timeline, media, { width, height, fps }, { container, quality })` renders the timeline to a file with [FFmpeg](https://blamy.github.io/ui/#/ffmpeg) and returns a Blob, reporting progress as it goes. `buildRender` returns the command without running it. Each clip is an input, seeked to its in point and cut to its length. Each picture is fitted into its frame, given its look and fades, and laid over the background at its time, bottom track first, so a transition is the incoming clip's fade-in over the outgoing one. Each sound is retimed (`atempo`), levelled, faded, delayed to its start and mixed.

| `container` | Holds | Plays |
| --- | --- | --- |
| `webm` | VP8 and Opus | in every browser |
| `mp4` | MPEG-4 Part 2 and AAC | in QuickTime, VLC, phones and editors, but not in Chrome or Firefox (H.264 needs an encoder this LGPL build doesn't have) |
| `gif` | A palette per render, up to 480 px wide at 15 fps | everywhere, without sound |
| `mp3`, `wav` | The soundtrack | everywhere |

## Accessibility

The timeline is a group of track groups. Each clip is a button whose name says what it is and where it sits ("Beach, 0:03.5 to 0:08.5"), and `aria-pressed` says whether it's selected. The ruler is a slider whose value text is the timecode. The track toggles are toggle buttons. Thumbnails and waveforms are decorative and hidden from assistive technology.
