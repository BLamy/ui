---
description: One tag, seven players. How the embed tag decides what a URL becomes, every attribute it takes, and the VideoEmbed component behind its videos.
---

# Embeds and video

`{% embed url="…" %}` is the one tag for media. docstream looks at the URL and picks the right player: a YouTube iframe, a native `<video>`, a session-replay player, a WebGL model viewer, a Strudel music player, or a plain link card when nothing matches. The author never names the player.

{% embed url="https://www.youtube.com/watch?v=aqz-KE-bpKQ" title="Big Buck Bunny" %}

```md
{% embed url="https://www.youtube.com/watch?v=aqz-KE-bpKQ" title="Big Buck Bunny" %}
```

## How a URL picks its player

The renderer tries these rules in order and stops at the first match:

| # | When the URL… | It renders | Page |
| --- | --- | --- | --- |
| 1 | is a Replay / Loop QA URL: a host ending in `.replay.io`, or a path that is (or normalizes to) `/p/…` | `ReplayPreview`, an iframe of the public embed route | [Session replays](02-replays.md) |
| 2 | ends in `.rrweb` | `ReplayFile`: the rrweb recording, played in the page | [Session replays](02-replays.md) |
| 3 | ends in `.stl` | `StlViewer`: an interactive WebGL model | [3D models](03-3d-models.md) |
| 4 | ends in `.strudel` | `StrudelPlayer`: a live-coded music pattern | [Music](04-music.md) |
| 5 | is `youtube.com/watch?v=ID` or `youtu.be/ID` | `VideoEmbed` with `https://www.youtube.com/embed/ID` (an iframe) | this page |
| 6 | ends in `.mp4`, `.webm` or `.ogg` | `VideoEmbed` as a native `<video playsinline>` | this page |
| 7 | anything else | a link card that opens the URL in a new tab | this page |

File extensions are matched on the path only: `clip.mp4?v=2` and `model.stl#top` still count. Matching is case-insensitive.

{% hint style="warning" %}
Rule 1 runs first and matches *any* host whose path starts with `/p/`. A URL such as `https://example.com/p/pricing` becomes a replay iframe, not a link card. Link to such pages with a normal Markdown link or a `{% content-ref %}` instead.
{% endhint %}

{% columns %}
{% column %}
**Becomes a player**

- `https://www.youtube.com/watch?v=aqz-KE-bpKQ`
- `https://youtu.be/aqz-KE-bpKQ`
- `https://cdn.example.com/clip.webm?sig=abc`
- `./models/part.stl`
- `https://app.replay.io/recording/…`
{% endcolumn %}

{% column %}
**Becomes a link card**

- `https://www.youtube.com/embed/aqz-KE-bpKQ` (an *embed* URL; use the watch URL)
- `https://www.youtube.com/shorts/…`
- `https://vimeo.com/76979871`
- `https://example.com/clip.mov`
{% endcolumn %}
{% endcolumns %}

## Attributes

| Attribute | Applies to | Meaning |
| --- | --- | --- |
| `url` | all | What to embed. Required. |
| `title` | video, `.rrweb`, `.stl`, `.strudel` | Accessible title; the caption for models and music. Videos default to the URL, files to their file name. Replay URL embeds always use "Replay preview". |
| `poster` | direct video | Image shown before playback. Resolved with `resolveAsset`, so repo-relative paths work once the host calls `setAssetBase`. |
| `autoplay` | direct video | Start playing on load. Browsers only allow this when `muted` is also on. |
| `loop` | direct video | Restart at the end. |
| `muted` | direct video | Start muted. |
| `controls` | direct video | Native controls. On unless you write `controls="false"`. |

Booleans are written with a value: `autoplay="true"`, `controls="false"`. Any value other than `"false"` counts as on, so `muted="yes"` mutes. A bare `muted` with no `="…"` is ignored. Write the whole tag on one line, because a tag can't span lines. A trailing `{% endembed %}` is optional; if you write one, it survives a round trip.

## Videos

### A direct file

Any `.mp4`, `.webm` or `.ogg` URL plays in a native `<video>` with `playsinline`, so it stays in the page on iOS. This one is a CC0 clip from MDN, with a poster frame served from this site:

{% embed url="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" title="A flower opening" poster="/docstream/media/flower-poster.jpg" %}

```md
{% embed url="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" title="A flower opening" poster="/docstream/media/flower-poster.jpg" %}
```

### A silent, looping clip

For a short animation that should feel like a GIF, turn on `autoplay`, `loop` and `muted` and turn off `controls`:

{% embed url="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm" title="Looping clip, no controls" autoplay="true" loop="true" muted="true" controls="false" %}

```md
{% embed url="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm" title="Looping clip, no controls" autoplay="true" loop="true" muted="true" controls="false" %}
```

{% hint style="info" %}
The playback attributes only reach a native `<video>`. A YouTube iframe ignores `autoplay`, `loop`, `muted`, `controls` and `poster`. Use YouTube's own player settings for those.
{% endhint %}

### YouTube

Write the URL you would copy from the address bar (`watch?v=` or `youtu.be/`). docstream rewrites it to the embed URL and lazy-loads the iframe at 16:9, sending a `strict-origin-when-cross-origin` referrer with fullscreen allowed:

{% embed url="https://youtu.be/aqz-KE-bpKQ" title="Big Buck Bunny (short link)" %}

## The link card

Everything that isn't a known player falls back to a card with the URL, so an unknown embed still works as a link and never shows up blank:

{% embed url="https://github.com/BLamy/ui/tree/main/packages/docstream" %}

## The VideoEmbed component

The video rules (5 and 6) render `VideoEmbed`, which you can also use directly. It decides by file extension: `.mp4`, `.webm` or `.ogg` gets a `<video>`, and anything else gets an iframe, so you can hand it any player URL (YouTube embed URLs included, since you're past the Markdown rewrite here).

{% demo src="media-video/controls" %}

```tsx title="Hero.tsx"
import { VideoEmbed } from "@brett_lamy/docstream"
// or, without the rest of the root entry: import { VideoEmbed } from "@brett_lamy/docstream/video"

export function Hero() {
  return (
    <VideoEmbed
      src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
      title="A flower opening"
      autoplay
      muted
      loop
      controls={false}
    />
  )
}
```

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `src` | `string` | required | A direct media file or a player URL. |
| `title` | `string` | `"Video"` | Accessible title (`<video title>` / `<iframe title>`). |
| `className` | `string` | none | Added after `video-embed__media`. |
| `aspectRatio` | `CSSProperties["aspectRatio"]` | `"16 / 9"` | Iframe only. A `<video>` keeps the file's own ratio. |
| `controls` | `boolean` | `true` | Video only. |
| `autoplay` | `boolean` | `false` | Video only. Pair with `muted`. |
| `loop` | `boolean` | `false` | Video only. |
| `muted` | `boolean` | `false` | Video only. |
| `poster` | `string` | none | Video only. Used as given. The component doesn't resolve assets. |
| `allowFullScreen` | `boolean` | `true` | Iframe only. |

<details>
<summary>Relative video paths</summary>

The embed's `url` reaches `VideoEmbed` as written. Unlike images, models and music, a video URL doesn't go through the asset resolver, so `./clip.mp4` resolves against the page's address, the way the browser resolves any relative URL. Use an absolute or root-relative URL (`/docstream/media/clip.mp4`) for videos in docs that live at nested routes. The `poster` attribute *is* resolved with `resolveAsset`. See [Assets and relative paths](06-assets.md).

</details>

## See also

{% content-ref url="02-replays.md" %}
Session replays: rrweb recordings and Replay URLs
{% endcontent-ref %}

{% content-ref url="06-assets.md" %}
Assets and relative paths
{% endcontent-ref %}
