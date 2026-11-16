---
description: Live-coded music in a docs page. A strudel fence or a .strudel file becomes a player with a piano roll, an equipment rack generated from the code, and a syntax tree you can program against.
---

# Music

[Strudel](https://strudel.cc) is a live-coding language for music, the JavaScript port of TidalCycles. docstream runs it **in the page**, not in an iframe: write a pattern in a `strudel` fence and readers get a play button, a scrolling piano roll and the code. Press play:

```strudel title="Night drive"
stack(s("bd*2 [~ bd] sd ~"), note("<c3 a2 f2 g2>").s("sawtooth").lpf(800))
```

````md
```strudel title="Night drive"
stack(s("bd*2 [~ bd] sd ~"), note("<c3 a2 f2 g2>").s("sawtooth").lpf(800))
```
````

The fence language is `strudel`, in any case. The fence's `title` names the player. Inside tabs, a Strudel fence stays a player: it isn't folded into a tabbed code block the way plain fences are.

## A .strudel file

Keep longer songs in their own files and embed them. The file is plain Strudel code. Its URL goes through the [asset resolver](06-assets.md), like an image, and it is fetched as text:

{% embed url="/docstream/music/night-drive.strudel" title="Night drive (four tracks)" %}

```md
{% embed url="/docstream/music/night-drive.strudel" title="Night drive (four tracks)" %}
```

This one has four named tracks (`drums:`, `hats:`, `bass:`, `lead:`). Open its rack with the sliders button to see a device for each.

## How playback works

- **Lazy runtime.** `@strudel/web` (about 850 KB) loads on the first press of play, never at page load. The play button shows a spinner and the subtitle reads "Loading sounds…" meanwhile.
- **Samples.** Before the first pattern runs, the player loads the Tidal [dirt-samples](https://github.com/tidalcycles/dirt-samples) bank, so `s("bd sd hh")` works exactly as on strudel.cc. Pass `samples` to load your own banks instead.
- **One at a time.** Every player on the page shares one runtime. Starting one stops whichever was playing, and a player that unmounts stops itself.
- **Live edits.** While a pattern plays, changes from the rack (or new `code`) are swapped in without stopping, about 120 ms after the last change. If the new code doesn't evaluate, the old pattern keeps playing and the error appears under the bar.
- **The roll.** The canvas draws two cycles around the playhead: notes by pitch, samples on a stable lane per sound name. The subtitle counts cycles.

{% hint style="warning" %}
Audio needs a user gesture, so nothing plays until the reader presses play. Strudel itself (`@strudel/web`) is licensed **AGPL-3.0-or-later**. docstream loads it as a separate dependency only when someone plays a pattern. Check what that means for your product before you ship music players in a closed-source app.
{% endhint %}

## The rack

The sliders button opens the **rack**: equipment generated from the code's syntax tree. Each track becomes a device:

- **Mute and solo.** These change what plays, not what's written (see `mixCode` below).
- **Gain fader.**
- **Sound and scale pickers.** Synths such as `sawtooth` and `supersaw`, and keys and modes such as `C:minor` or `D:dorian`.
- **A step grid for its mini-notation.** Click a step to toggle it with a rest; double-click to type a new value. Operators show as badges: `×2`, `(3,8)`, `?`, `!3`.
- **A knob for each effect it uses:** cutoff, resonance, ADSR, vibrato, shape, drive, crush, pan, reverb, delay and more. Add others from the device's menu.

A master strip has the tempo and the **Rack | Grid** switch. Grid mode puts the modules on a masonry grid: drag a title to move a module, drag its corner to resize it, or use the arrow keys on either handle.

**Every control edits the code in place.** Turning the cutoff knob rewrites the digits inside `.lpf(…)` and nothing else, so comments and formatting survive and the code stays the source of truth. A **Revert edits** button appears once you've changed something. This demo opens the rack from the start and prints what `onCodeChange` reports:

{% demo src="media-music/studio" %}

## StrudelPlayer

```tsx title="Song.tsx"
import { StrudelPlayer } from "@brett_lamy/ui/docstream"
// or: import { StrudelPlayer } from "@brett_lamy/ui/docstream/strudel"

export function Song({ code, save }: { code: string; save: (code: string) => void }) {
  return <StrudelPlayer code={code} title="Demo song" defaultRackOpen onCodeChange={save} />
}
```

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `code` | `string` | none | The pattern, as you would type it at strudel.cc. |
| `src` | `string` | none | URL of a `.strudel` file, fetched when `code` is absent. Used as given (the embed is what resolves assets). |
| `title` | `string` | the file name, or "Strudel pattern" | Shown in the bar and used in the button labels. |
| `rack` | `boolean` | `true` | Offer the rack at all; `false` leaves its toggle out. |
| `defaultRackOpen` | `boolean` | `false` | Open the rack from the start (uncontrolled). |
| `rackOpen` / `onRackOpenChange` | `boolean` / `(open, details) => void` | none | Control the rack panel. `details` is UI SDK's change details: `reason` is `"trigger-press"`, `"find-in-page"` or `"imperative"`, and `details.cancel()` keeps an uncontrolled panel as it was. |
| `defaultCodeOpen` | `boolean` | `false` | Show the code under the player from the start (uncontrolled). |
| `codeOpen` / `onCodeOpenChange` | `boolean` / `(open, details) => void` | none | Control the code panel, the same way. |
| `onCodeChange` | `(code, details) => void` | none | The code after every rack edit and after **Revert edits**. `details` is UI SDK's `ChangeDetails`: `reason` is `"rack-edit"` or `"revert"`, `event` the click, key or drag behind it, `cancel()` keeps the code as it was; for a rack edit `details.rack` is the rack's own details (which control, and how; below). |
| `samples` | `readonly string[]` | `DEFAULT_SAMPLES` | Sample banks to load before the first play, e.g. `["github:tidalcycles/dirt-samples"]`. |
| `className` | `string` | none | Added to `figure.docstream-strudel`, which carries `data-state="idle" \| "loading" \| "playing"`. |
| `style` | `CSSProperties` | none | Inline styles on the root figure. |
| `ref` | `Ref<HTMLElement>` | none | The root figure. |
| `aria-label` | `string` | `title` | The figure's accessible name. |

The open/close trios, `onCodeChange`'s `details`, `style`, `ref` and `aria-label` are new in 2.0.1.

## The syntax tree

The rack is built on a parser you can use directly. `parseStrudel` reads the JavaScript with acorn (the parser Strudel's own transpiler uses) and returns the program **as a song**: tempo, tracks, method chains and every mini-notation string, each with exact source ranges. Edit the code below and watch it re-parse. Steps, the reverb button and solo all go through the same edit helpers the rack uses. This demo plays nothing: it's only the parser.

{% demo src="media-music/syntax-tree" %}

```ts title="song.ts"
import { parseStrudel, parseMini, setMethod, setTempo, mixCode, formatNumber } from "@brett_lamy/ui/docstream/strudel/rack"

const song = parseStrudel(code)
song.tempo        // { cps: 0.5, unit: "cps", call } from setcps / setcpm
song.layout       // "labels" ($: or name: lines) | "stack" (args of one stack(...)) | "single" | "empty"
song.tracks[0]    // { index, label: "drums", muted, kind: "drums", sound: "bd", chain, start, end }
song.tracks[0].chain.methods // [{ name: "gain", args: [{ kind: "number", value: 0.9, start, end }], … }]
song.minis        // every mini-notation string in source order, each with its parsed tree
song.program      // the raw ESTree from acorn

parseMini("bd*2 [~ sd] <c e>") // sequence → steps → atom / subcycle / alternation, with ranges

setMethod(code, song.tracks[2].chain, "lpf", formatNumber(1200)) // replaces the arg, or appends .lpf(1200)
setTempo(song, 0.6)                                               // keeps setcpm code in cpm
mixCode(song, { solo: new Set([0]) })                             // the code with other tracks as `silence`
```

| Export | What it does |
| --- | --- |
| `parseStrudel(code)` | The song. Throws `StrudelSyntaxError` (with `offset`) when the JavaScript doesn't parse. |
| `parseMini(source)` | One mini-notation string as a tree: sequences, `[ ]` subcycles, `< >` alternations, `{ }%n` polymeters, `,` `\|` `.` layers, and the operators `*` `/` `!` `@` `?` `:` `..` `(k,n,r)`. Throws `MiniSyntaxError`. |
| `miniAtoms(node)` / `miniLayers(group)` | The words in a tree; the parallel rows of a group. |
| `chainCalls(chain)` / `findCall(chain, name)` | Walk a method chain. |
| `setArg`, `setMethod`, `removeMethod`, `setTempo` | Exact edits: each returns new code that differs only where the change lands. |
| `setMiniAtom`, `setMiniSource` | Rewrite one step, or a whole mini string. |
| `applyEdits(code, edits)` | Apply your own non-overlapping `{ start, end, text }` edits. |
| `isAudible(track, mix)` / `mixCode(song, mix)` | Mute and solo without touching the written code. |
| `formatNumber(n)` | A compact literal (`.5`, at most 4 decimals), like hand-written Strudel. |

## Building blocks for your own studio

`@brett_lamy/ui/docstream/strudel/rack` exports the pieces the player is made of, with the parser they need (acorn), so `@brett_lamy/ui/docstream/strudel` itself loads it only when a reader opens the rack. The runtime functions stay on `@brett_lamy/ui/docstream/strudel`:

| Export | Purpose |
| --- | --- |
| `StrudelRack` | The rack on its own: `value`, `onValueChange(code, details)`, `onPlayableChange` (the code for the current mute/solo mix), `defaultVariant="rack" \| "grid"` (the look it opens in; the reader can switch), and `persistKey` to remember the layout in `localStorage`. |
| `RackGrid` | The masonry grid: `items` (`{ key, label, node, span? }`), `layout`, `onLayoutChange`. |
| `StepGrid` | A mini-notation tree as a step sequencer: `mini`, `onAtomChange(atom, text, details)` (`details.reason` is `"press"` for a toggle, `"input-commit"` for a typed value), `label`. |
| `Knob`, `Fader` | The hardware controls, both ARIA sliders: drag (Shift for fine), arrows, Page Up/Down, Home/End, double-click to reset. Props: `label`, `value`, `min`, `max`, `log`, `defaultValue`, `format`, `onValueChange(value, details)`, and on a Knob `size` (`"default"` or `"lg"` for master controls). |
| `STRUDEL_PARAMS`, `trackName` | The effects the rack draws knobs for, with ranges and defaults; a track's display name. |
| `playStrudel`, `updateStrudel`, `stopStrudel` | Drive the shared runtime yourself. `playStrudel` must run from a user gesture. |
| `subscribeStrudel`, `getStrudelSnapshot`, `strudelNow` | Who is playing (`{ owner, status }`) and the scheduler's position in cycles, for your own visuals. |
| `isStrudelFile`, `isStrudelLanguage` | The checks the renderer uses for `.strudel` URLs and `strudel` fences. Also on the root entry. |

```tsx title="Mixer.tsx"
import { useState } from "react"
import { StrudelRack } from "@brett_lamy/ui/docstream/strudel/rack"

export function Mixer({ initial }: { initial: string }) {
  const [code, setCode] = useState(initial)
  return <StrudelRack value={code} onValueChange={setCode} defaultVariant="grid" persistKey="my-song" />
}
```

Every edit says what made it. A knob or fader reports `onValueChange(value, details)`, and the rack reports `onValueChange(code, details)` with the control's reason and which control it was:

```tsx title="Studio.tsx"
import { useState } from "react"
import { Knob, StrudelRack, type StrudelRackChangeDetails } from "@brett_lamy/ui/docstream/strudel/rack"

export function Studio({ initial, log }: { initial: string; log: (line: string) => void }) {
  const [code, setCode] = useState(initial)
  const [cutoff, setCutoff] = useState(1200)
  const record = (next: string, { reason, control, track, param }: StrudelRackChangeDetails) => {
    // "step-key gain on track 0", "drag effect lpf on track 2", "remove-press effect room on track 2"
    log(`${reason} ${control}${param ? ` ${param}` : ""}${track === undefined ? "" : ` on track ${track}`}`)
    setCode(next)
  }
  return (
    <>
      <StrudelRack value={code} onValueChange={record} />
      <Knob label="Cutoff" value={cutoff} min={40} max={16000} log defaultValue={1200}
        onValueChange={(value, { reason }) => {
          setCutoff(value)
          if (reason === "reset-press") log("cutoff back to its default")
        }} />
    </>
  )
}
```

| `details` field | Knob, Fader | StrudelRack |
| --- | --- | --- |
| `reason` | `"drag"`, `"step-key"`, `"track-press"` (Fader), `"accessibility-adjust"`, `"reset-press"` (double-click), `"imperative"` | The control's reason, `"item-press"` / `"list-navigation"` (a select or the Add menu), `"press"` / `"input-commit"` (a step), `"remove-press"` (an effect's Remove) |
| `event` | The key, pointer or double-click event, when there is one | The same |
| `control` | | `"tempo"`, `"output"`, `"gain"`, `"effect"`, `"sound"`, `"key"`, `"scale"`, `"steps"` |
| `track` | | The track's index in the song, for a track's controls |
| `param` | | The effect's method (`"lpf"`, `"room"`), for an effect's knob, Remove button and the Add menu |

The details, `value` / `onValueChange` on the rack and on the controls, and `onCodeChange`'s `event` and `rack` are new in 2.0.1. Handlers that take only the value or the code keep working.

The rack's parser (acorn plus the mini-notation parser) loads the first time someone opens a rack in a player, not with the player itself.

## See also

{% content-ref url="06-assets.md" %}
Resolving `.strudel` paths from a repo or a local folder
{% endcontent-ref %}

{% content-ref url="../03-writing/05-code.md" %}
Code fences, titles and other fence attributes
{% endcontent-ref %}
