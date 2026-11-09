---
description: Mount a deterministic, seekable VizEngine animation in a document with VizEmbed, an optional entry that needs @brett_lamy/viz-engine.
---

# VizEngine scenes

A video of an explainer is a dead end: readers can't pause on a frame and inspect it, and the clip drifts from the code that made it. [VizEngine](https://www.npmjs.com/package/@brett_lamy/viz-engine) (`@brett_lamy/viz-engine`) describes the animation instead, as a **timeline** of tweened channels and a **render function** that draws SVG for any moment. `VizEmbed` mounts that scene in a docstream document. The reader gets a player they can pause and scrub, and every seek redraws exactly the frame the timeline defines.

{% hint style="info" %}
This page shows code only. VizEngine is an optional peer dependency, and this demo site doesn't install it. Every other media player in this section runs live.
{% endhint %}

## Install

`VizEmbed` lives on its own entry, so the root entry never imports VizEngine. Install the peer next to docstream:

{% command %}npm install @brett_lamy/docstream @brett_lamy/viz-engine{% endcommand %}

```tsx lineNumbers="false"
import { VizEmbed } from "@brett_lamy/docstream/viz"
import "@brett_lamy/docstream/styles.css"
```

The entry imports `@brett_lamy/viz-engine/styles.css` itself, so the player's own styles come with it.

## A scene

A scene is `{ timeline, render }`. Channels hold numbers over time, tweens move them, and `render` reads them for the current moment:

```tsx title="pulse-scene.tsx"
import { Timeline, colors, ease, type VideoScene } from "@brett_lamy/viz-engine"

const timeline = new Timeline()
const radius = timeline.channel("radius", 0)
const label = timeline.channel("label", 0)
timeline.tween(radius, 80, { at: 0, dur: 1, ease: ease.enter })
timeline.tween(label, 1, { at: 0.6, dur: 0.4 })

export const pulseScene: VideoScene = {
  timeline,
  render: (state) => (
    <svg viewBox="0 0 1280 720">
      <circle cx={640} cy={360} r={state.get(radius)} fill={colors.ACCENT} />
      <text x={640} y={500} textAnchor="middle" opacity={state.get(label)}>
        one append, one offset
      </text>
    </svg>
  ),
}
```

```tsx title="EventLogPage.tsx"
import { VizEmbed } from "@brett_lamy/docstream/viz"
import { pulseScene } from "./pulse-scene"

export function EventLogPage() {
  return <VizEmbed scene={pulseScene} title="A reader resumes from its bookmark" />
}
```

Seeking samples the timeline at that time, so the same moment always draws the same picture. You can link to a frame, test it, or render a clip from it later.

## Props

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `scene` | `VideoScene` | required | `{ timeline, render }` from VizEngine. |
| `audio` | `PlayerAudio` | none | Narration to follow: `{ url, cues? }`. The timeline then keeps time with the audio, and `cues` retime the captions. |
| `title` | `string` | none | Rendered as the figure's `<figcaption>`. |
| `autoplay` | `boolean` | `true` | Start playing when mounted. |
| `loop` | `boolean` | `true` | Restart at the end. |
| `showCaptions` | `boolean` | `false` | Show the scene's captions. |
| `className` | `string` | none | Added to the `figure.docstream-viz` root. The player inside has `.docstream-viz__player`. |

Note that `autoplay` and `loop` default to **on** here, unlike `VideoEmbed`: a scene is usually a short explainer meant to run as the reader arrives.

## Not a Markdown tag

There's no `{% viz %}` tag. This is on purpose: a scene is code (a timeline and a render function), so you choose it in your app and mount it where you want it. When the same explanation also needs to work in plain Markdown, such as a README or a copied page, render the scene to a clip and embed the file. A muted, looping `.mp4` reads like the live scene:

```md
{% embed url="/generated/event-log/offsets.mp4" title="A reader resumes from its bookmark" autoplay="true" loop="true" muted="true" controls="false" %}
```

See [Embeds and video](01-embeds-and-video.md) for the video attributes.

## See also

{% content-ref url="../01-getting-started/03-package-entries.md" %}
Package entries and their optional peers
{% endcontent-ref %}
