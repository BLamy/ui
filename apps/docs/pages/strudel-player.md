# StrudelPlayer

An audio player for [Strudel](https://strudel.cc), the live-coding music language: give it pattern code or a `.strudel` file and it plays in the page, with play/stop, a scrolling piano roll of the notes around the playhead, the code, and an equipment rack generated from that code. Strudel itself (`@strudel/web`, AGPL-3.0) loads on the first play, and the Tidal dirt-samples come with it, so `s("bd sd")` works exactly as it does on strudel.cc. One pattern plays at a time: starting a player stops whichever was playing.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/strudel-player.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { StrudelPlayer } from '@/components/ui/strudel-player'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { StrudelPlayer } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

`StrudelPlayer` lives in [`@brett_lamy/docstream`](https://blamy.github.io/ui/#/docstream) (`@brett_lamy/docstream/strudel`, 1.10 and later), where a ` ```strudel ` fence or a `{% embed url="song.strudel" %}` renders it. BL UI keeps a thin re-export, so `@/components/ui/strudel-player` resolves like every other part.

## Inline code

{% demo src="strudel-player/inline" %}

```tsx
<StrudelPlayer code={code} title="Four on the floor" />
```

Browsers start audio only after a press, so nothing plays until someone presses play. The piano roll draws two cycles centred on the playhead: notes by pitch, samples on a lane each.

## A .strudel file

`src` fetches a file and plays its text. `showCode` opens the code under the player.

{% demo src="strudel-player/file" %}

```tsx
<StrudelPlayer src="/strudel/night-drive.strudel" title="Night drive" showCode />
```

## In Markdown

Any docstream page plays Strudel the same way — a fence or an embed:

````md
```strudel
note("c e g b").s("triangle").fast(2)
```

{% embed url="music/night-drive.strudel" title="Night drive" %}
````

## Playback without the player

The functions the player is built on drive the one shared Strudel runtime from your own controls. Each takes an owner id; another owner starting stops yours.

```tsx
import { playStrudel, updateStrudel, stopStrudel, subscribeStrudel, getStrudelSnapshot } from '@/components/ui/strudel-player'

await playStrudel('my-app', code)    // from a press: loads Strudel, evaluates, plays
await updateStrudel('my-app', next)  // swap the pattern without stopping (live edits)
await stopStrudel('my-app')
subscribeStrudel(() => getStrudelSnapshot()) // { owner, status: 'idle' | 'loading' | 'playing' }
```

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `code` | — | Strudel code to play. |
| `src` | — | URL of a `.strudel` file, used when `code` is absent. |
| `title` | the file name, or "Strudel pattern" | The track name, and the play button's label. |
| `showCode` | `false` | Open the code under the player. |
| `rack` | `true` | Offer the equipment rack behind the sliders button. |
| `showRack` | `false` | Open the rack from the start. |
| `onCodeChange` | — | Called with the code after each rack edit. |
| `samples` | dirt-samples | Sample banks to load before the first play. |
