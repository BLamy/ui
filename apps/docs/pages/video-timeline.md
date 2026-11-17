# VideoTimeline

A video editor's timeline. A ruler you scrub sits over one lane per track, each behind a header that hides, mutes or locks it. On a lane are clips, UI SDK spans (`createSpans`): drag one along its track or to another track, drag an edge to trim it, and watch the playhead run over them. The main track is **magnetic**: its clips butt end to end, so trimming or removing one closes the gap, and dragging one makes room among the others. Moves and trims land on frames and snap to clip edges and the playhead. It edits a plain `Timeline` value, a model of pure functions you can also drive from code, and the same value plays live in [VideoPreview](https://blamy.github.io/ui/#/video-preview) and renders with [FFmpeg](https://blamy.github.io/ui/#/ffmpeg). For a strip of frames or a waveform on its own (a media library's thumbnails), use [Filmstrip](https://blamy.github.io/ui/#/filmstrip) or [Waveform](https://blamy.github.io/ui/#/waveform); for one clip's in and out points, a range [Slider](https://blamy.github.io/ui/#/slider) is enough.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/video-timeline.json https://blamy.github.io/ui/r/playback.json https://blamy.github.io/ui/r/video-timeline-model.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { VideoTimeline } from '@/components/ui/video-timeline'
import { usePlaybackClock } from '@/lib/playback'
import { splitClip } from '@/lib/video-timeline-model'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { VideoTimeline } from '@brett_lamy/ui/video-timeline'
import { usePlaybackClock } from '@brett_lamy/ui/lib/playback'
import { splitClip } from '@brett_lamy/ui/lib/video-timeline-model'
```
{% endtab %}
{% endtabs %}

## An edit

The timeline edits a `value` (or `defaultValue`) and calls `onValueChange(value, details)` once per gesture, when the drag ends, and once per key, so each edit is one undo step: keep the old values and you have undo. `details` carries UI SDK's `reason` (`drag`, `move-key`, `remove-press` for Delete, `press` for a track toggle, `imperative`), `source` and `cancel()`, plus `id` (the clip, or the track) and `action` (`move`, `resize`, `delete` or `track`). A playback clock (`usePlaybackClock`) carries the time it shares with a preview and transport controls. `renderClip` draws a clip's content: a [Filmstrip](https://blamy.github.io/ui/#/filmstrip) for video, a [Waveform](https://blamy.github.io/ui/#/waveform) for sound, a title's text. `clipClassName` tints a kind of clip.

{% demo src="video-timeline/editor" %}

```tsx
import { VideoTimeline } from '@/components/ui/video-timeline'
import { usePlaybackClock } from '@/lib/playback'
import { timelineDuration } from '@/lib/video-timeline-model'

const playback = usePlaybackClock()
const [timeline, setTimeline] = useState(start)
useEffect(() => playback.setDuration(timelineDuration(timeline)), [playback, timeline])

<VideoTimeline
  value={timeline}
  onValueChange={setTimeline}
  playback={playback}
  fps={30}
  media={{ beach: { kind: 'video', duration: 12, name: 'Beach' } }}
  renderClip={(clip) => <Filmstrip frames={frames[clip.media]} from={clip.in} to={clip.out} />}
/>
```

`media` gives each media id its length (a trim can't run past the end of the file; stills have no limit) and the name a clip shows. `selectedClips` / `defaultSelectedClips` / `onSelectedClipsChange(ids, details)` (reasons `item-press`, `track-press`, `escape-key`, `remove-press`) and `zoom` / `defaultZoom` / `onZoomChange(zoom, details)` (pixels per second, reason `wheel`) can be controlled; `readOnly` shows the edit without letting anything change it; `fitVideoTimelineZoom(duration, width, { headerWidth })` fits an edit to a width, and `videoTimelineZoomRange` (`{ min: 2, max: 600 }` px a second) is the range a zoom is clamped to, for your own zoom slider or buttons. `onDropMedia(id, details)` reports media dragged in from a library: put `videoTimelineMediaType` on the drag with the media id. `details` has where it landed (`trackId`, `time` and, on a magnetic track, `index`), the drop's `event` and `source`, and `cancel()` to refuse it. ⌘/Ctrl + wheel zooms with `reason: 'wheel'`; a zoom the host refuses leaves the scroll where it was.

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
| Click or drag the ruler | Move the playhead (it pauses playback and marks the clock as scrubbing). The ruler is UI SDK's Slider. |
| Click an empty stretch of a lane | Clear the selection and move the playhead there. |
| Click a clip; ⇧ or ⌘-click | Select it; add it to the selection or take it out. |
| ⌘ or Ctrl + wheel, or pinch | Zoom around the pointer. |

From the keyboard, Tab reaches the ruler and then the clips, which are one Tab stop.

| Key | On |  Does |
| --- | --- | --- |
| ←/→ | ruler | Move the playhead a frame; ⇧ or Page Up/Down a second; Home/End to either end. |
| ←/→ | clip | Move it a frame; on a magnetic track, past its neighbour. |
| ⇧ ←/→ | clip | Move its end a frame (trim). |
| ⌥ ⇧ ←/→ | clip | Move its start a frame (trim). |
| ↑/↓ | clip | Move it to the next unlocked track of its kind. |
| ⌥ + arrow | clip | Focus the clip before or after it, or the nearest one on the track above or below. |
| Home/End | clip | Focus the track's first or last clip. |
| Enter or Space | clip | Select it; ⇧ adds it to the selection. |
| Delete or Backspace | clip | Remove the selection (or this clip). |
| Escape | clip | Clear the selection; during a drag, put the clip back. |

Every edit is announced ("Beach, Main, 0:03.5 to 0:08.5."). A locked track's clips can be selected but not changed.

## From code and agents

The behavior is a UI SDK primitive, `videoTimeline` in `lib/video-timeline-primitive`. Its api (and the agent bridge) offers `select(ids)`, `move(id, { trackId, start, index })`, `trim(id, 'start' | 'end', time)`, `remove(ids)`, `setTrack(id, { hidden, muted, locked })` and `setZoom(zoom)`, each reported with reason `imperative` (`agent` as the source for an agent).

## Rendering

The timeline renders to a file with FFmpeg in the browser: see [Rendering a timeline](https://blamy.github.io/ui/#/ffmpeg) on the FFmpeg page.

## API

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onValueChange(value, details)` | — | The edit; `details` has `reason`, `id`, `action` and `cancel()`. Once per gesture or key. |
| `playback` | required | The shared clock (`usePlaybackClock`) the playhead and the ruler follow. |
| `media` | `{}` | `Record<id, VideoTimelineMedia>`: each media id's `kind`, `duration` and `name` (the same map VideoPreview takes, which reads its `url`). |
| `fps` | `30` | Frames per second: edits land on frames. |
| `selectedClips` / `defaultSelectedClips` / `onSelectedClipsChange` | `[]` | The selection. |
| `zoom` / `defaultZoom` / `onZoomChange` | `60` | Pixels per second. |
| `readOnly` | `false` | Show the edit without changing it. |
| `renderClip(clip, track, { width, selected })` | the clip's name | A clip's content: a `Filmstrip`, a `Waveform`, a title. |
| `clipClassName(clip, track)` | primary for video, success for audio | A clip's tint classes. |
| `trackHeight(track)` | 64 magnetic video, 44 video, 40 audio | Lane height in px. |
| `headerWidth` | 132, or 56 in a compact container | Track header width in px. In a compact container the header is the track's short code (`V1`, `V2`, `A1`, `Main` for the magnetic track) on a button named "{track} options" with the full name in its tooltip, whose menu holds Hide, Mute and Lock. In the full header the toggles are named after their track ("Hide Titles", "Mute Music", "Lock Music"). |
| `onDropMedia(id, details)` | — | Media dragged in with `videoTimelineMediaType`. |
| `aria-label` | "Timeline" | Names the timeline. |
| `className` / `style` | — | On the root. |
| `ref` and a `div`'s other props | — | `id`, `data-*`, event handlers and the rest reach the root. |

The playhead and its handle are `bg-playhead`, the destructive red unless a theme sets `--playhead`.

## Accessibility

The timeline is a group of track groups. Each clip is a button whose name says what it is and where it sits ("Beach, 0:03.5 to 0:08.5"), and `aria-pressed` says whether it's selected; the clips share one Tab stop (UI SDK's roving focus). Moves, trims and removals are announced through UI SDK's live region. The ruler is UI SDK's Slider, named "Playhead", whose value text is the timecode. The track toggles are toggle buttons that show their state in the glyph too (a slashed eye or speaker, a closed lock), and take a 44 px hit area on touch. Thumbnails and waveforms are decorative and hidden from assistive technology.
