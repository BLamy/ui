# StrudelPlayer

[Strudel](https://strudel.cc) is a live-coding music language. `StrudelPlayer` plays a pattern in the page: give it Strudel code or a `.strudel` file and it shows play/stop, a scrolling piano roll of the notes around the playhead, the code, and an equipment rack generated from that code. Use it to put a playable piece of music in a page or an app. For recorded audio, draw a [Waveform](https://blamy.github.io/ui/#/waveform) or edit clips on a [VideoTimeline](https://blamy.github.io/ui/#/video-timeline) instead.

Strudel itself (`@strudel/web`, AGPL-3.0) loads on the first press of play, and the Tidal dirt-samples come with it, so `s("bd sd")` works exactly as it does on strudel.cc. One pattern plays at a time: starting a player stops whichever was playing.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/strudel-player.json{% endcommand %}

Adds one module to your project's `components/ui/` and installs `@brett_lamy/ui`, whose Docstream it imports by the package's name. The module only re-exports the widget, so there is nothing in it to edit; it gives the widget your alias. Import from your alias:

```tsx
import { StrudelPlayer } from '@/components/ui/strudel-player'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheets once at your app's entry (the kit's, then docstream's, which this part renders with), then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'
import '@brett_lamy/ui/docstream/styles.css'

import { StrudelPlayer } from '@brett_lamy/ui/strudel-player'
```
{% endtab %}
{% endtabs %}

{% hint style="info" %}
The player lives in docstream, the library's Markdown renderer (`@brett_lamy/ui/docstream/strudel`), where a ` ```strudel ` fence or a `{% embed url="song.strudel" %}` renders it. Docstream isn't copied by the registry: the registry item adds `@brett_lamy/ui` for it, and a one-line module that re-exports the player and the playback functions below. The rack, its hardware and the syntax tree come straight from `@brett_lamy/ui/docstream/strudel/rack`, the entry that brings their parser (acorn): the player itself loads the rack only when a reader opens it.
{% endhint %}

## Inline code

{% demo src="strudel-player/inline" %}

```tsx
<StrudelPlayer code={code} title="Four on the floor" />
```

Browsers start audio only after a press, so nothing plays until someone presses play. The piano roll draws two cycles centred on the playhead: notes by pitch, samples on a lane each.

## A .strudel file

`src` fetches a file and plays its text. `defaultCodeOpen` opens the code under the player.

{% demo src="strudel-player/file" %}

```tsx
<StrudelPlayer src="/strudel/night-drive.strudel" title="Night drive" defaultCodeOpen />
```

## In Markdown

Any docstream page plays Strudel the same way, with a fence or an embed:

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
| `codeOpen` · `defaultCodeOpen` · `onCodeOpenChange` | `false` | Whether the code panel under the player is open: controlled, uncontrolled, and `(open, details)` when it opens or closes (`details.reason`: `trigger-press`, `find-in-page` or `imperative`; `details.cancel()` keeps it as it is). |
| `rack` | `true` | Offer the equipment rack behind the sliders button; `false` leaves the button out. |
| `rackOpen` · `defaultRackOpen` · `onRackOpenChange` | `false` | The same for the rack panel. |
| `onCodeChange` | — | `(code, details)` after each rack edit and after Revert. `details` is UI SDK's `ChangeDetails`: `reason` is `rack-edit` or `revert`, `details.cancel()` keeps the code as it was, and for a rack edit `details.rack` says which control made it. |
| `samples` | dirt-samples | Sample banks to load before the first play. |
| `className` · `style` · `ref` | — | On the root `<figure>`. |
| `aria-label` | `title` | The figure's accessible name; defaults to the title, then the file name, then "Strudel pattern". |

```tsx
const [rackOpen, setRackOpen] = useState(false)
<StrudelPlayer code={code} title="Four on the floor" rackOpen={rackOpen} onRackOpenChange={setRackOpen} onCodeChange={(next, { reason }) => save(next, reason)} />
```

## The rack

The player's sliders button opens `StrudelRack`: studio hardware generated from the code's syntax tree. A master strip carries a BPM readout and tempo and output knobs; then comes a module per track, with a status LED, backlit mute and solo pads, a channel fader for its gain, LCDs for its synth and key, TR-style step keys for its mini-notation and an LED-ring knob for every effect it uses, with a socket to add more. Every control rewrites only the characters it owns, so the code stays the source of truth: what you turn is what you would have typed. Render it on its own (as the [Strudel Studio block](https://blamy.github.io/ui/#/blocks) does) from docstream:

```tsx
import { StrudelRack } from '@brett_lamy/ui/docstream/strudel/rack'
```

The master strip's **Rack | Grid** switch moves the modules onto a masonry grid: drag a module by its title to move it, drag its corner to resize it. On the keyboard, the move handle takes arrows and Home/End and the corner takes arrows. `defaultVariant="grid"` starts there, and `persistKey` remembers the arrangement.

{% demo src="strudel-player/rack-grid" %}

```tsx
const [code, setCode] = useState(song)
<StrudelRack value={code} onValueChange={setCode} onPlayableChange={setPlayable} defaultVariant="grid" persistKey="night-drive" />
```

The rack is controlled: `value` in, the edited code out through `onValueChange(code, details)`, where `details` says which control edited it (`details.control`: `gain`, `effect`, `tempo`, `sound`, `steps`…, with `track` and `param`) and how (`details.reason`). Mute and solo don't edit the code; they change what plays, which `onPlayableChange` reports (the code with the silenced tracks replaced by `silence`).

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | — | The Strudel code. |
| `onValueChange` | — | `(code, details)` with the edited code and what edited it. |
| `onPlayableChange` | — | Called with the code to play under the current mute/solo mix. |
| `defaultVariant` | `"rack"` | The look it opens in: `"grid"` puts the modules on the masonry grid. The reader can switch, and `persistKey` remembers their choice. |
| `persistKey` | — | Remember the mode, order and sizes in localStorage. |

### What becomes what

| In the code | On the rack |
| --- | --- |
| `setcps(.5)` / `setcpm(30)` | The BPM LCD and the tempo knob (cps × 240 = BPM). |
| `stack(a, b, …)` or `$:` / `name:` lines | One module per track; `_$:` lines start muted. |
| `.postgain(…)` on the stack | The master output knob. |
| `.gain(.8)` | The channel fader. |
| `.s("sawtooth")`, `.scale("G2:minor")` | The sound and key LCDs. |
| The first mini-notation string | Step keys: rows for `,` layers, nested keys for `[ ]`, framed alternatives for `< >`, badges for `*2 (3,8) ? !`. |
| `.lpf .hpf .lpq .room .size .delay .delaytime .delayfeedback .pan .attack .decay .sustain .release .vib .vibmod .shape .distort .crush .coarse .speed` | A knob each (cutoffs are logarithmic; pan and speed light from the centre). |
| An effect given a pattern, `.lpf(sine.range(300, 900))` | A locked knob showing ∿. |

### The hardware on its own

`Knob`, `Fader` and `StepGrid` (also from `@brett_lamy/ui/docstream/strudel/rack`) are ARIA sliders and buttons you can use anywhere inside a `.strudel-rack` panel: drag, arrow keys (Shift for a large step, Alt for a fine one), Page Up/Down, Home/End, and double-click to reset. `Knob` and `Fader` report `onValueChange(value, details)`, where `details.reason` is `drag`, `step-key`, `track-press` or `reset-press`. A `Knob` takes `size`: `"default"`, or `"lg"` for a master control.

{% demo src="strudel-player/hardware" %}

## The syntax tree

Strudel code as data, from `@brett_lamy/ui/docstream/strudel/rack`. `parseStrudel` parses the JavaScript with acorn (the parser Strudel's own transpiler uses) and reads it the way the Strudel REPL runs it: `setcps`/`setcpm` set the tempo, the tracks are a top-level `stack(…)`'s arguments or `$:` / `name:` lines, and each track is a method chain whose calls carry typed arguments: numbers (constant arithmetic folded), mini-notation strings, plain strings, nested patterns and functions. Every double-quoted string is parsed as mini-notation by `parseMini`, which covers the whole grammar. Every node keeps its source range, so edits rewrite only the characters they touch. It is what the rack is generated from.

```tsx
import { parseStrudel, parseMini, setMethod, mixCode } from '@brett_lamy/ui/docstream/strudel/rack'
```

{% demo src="strudel-player/syntax-tree" %}

### The song

```ts
const song = parseStrudel(code)
song.tempo        // { cps: .5, unit: 'cps', call }
song.layout       // 'stack' | 'labels' | 'single' | 'empty'
song.tracks[1]    // { index, label, muted, kind: 'melodic', sound: 'sawtooth', chain, start, end }
song.tracks[1].chain.methods.map((m) => m.name) // ['scale', 's', 'lpf']
findCall(song.tracks[1].chain, 'lpf').args[0]  // { kind: 'number', value: 800, start, end }
song.master       // methods on the stack, e.g. .postgain(.9)
song.minis        // every mini-notation string, in source order
song.program      // acorn's ESTree, for anything else
```

Invalid JavaScript throws `StrudelSyntaxError` (with `offset`). A mini-notation string that doesn't parse keeps `mini: null` and its `MiniSyntaxError`, and the rest of the song still reads.

### Mini-notation

`parseMini` returns sequences of steps; each step is a slice and the operators after it.

| Syntax | Node |
| --- | --- |
| `bd sd`, `~`, `-`, `0.5`, `c#4` | `sequence` of `step`s whose slices are `atom`s (`rest` for `~` and `-`) |
| `[a b]` | `subcycle` |
| `<a b>` | `alternation` (one per cycle) |
| `{a b c, d e}%4` | `polymeter` with `steps` |
| `a b, c d` · `a \| b` · `a . b` | `stack` · `choose` · `feet` layers |
| `*2 /4 !3 @3 _ ? ?0.3 :3 ..7 (3,8,2)` | `fast`, `slow`, `replicate`, `weight`, `degrade`, `tail`, `range`, `euclid` ops |
| `^a b` | a `marked` sequence |

`miniAtoms(node, { ops: false })` lists the values a pattern plays (without operator arguments like the 2 in `bd*2`).

### Edits

```ts
setMethod(code, track.chain, 'room', formatNumber(.5)) // replace .room(…)'s argument, or append .room(.5)
removeMethod(code, track.chain, 'delay')
setTempo(song, .6)                                     // keeps setcpm code in cpm
setMiniAtom(code, mini, atom, '~')                     // one step of a pattern
mixCode(song, { muted: new Set([2]), solo: new Set() }) // the code to play, with silenced tracks
```

Edits return new code. Parse it again for the next edit (it is fast: a song is a few hundred characters).
