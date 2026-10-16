# Strudel syntax tree

Strudel code as data. `parseStrudel` parses the JavaScript with acorn (the parser Strudel's own transpiler uses) and reads it the way the Strudel REPL runs it: `setcps`/`setcpm` set the tempo, the tracks are a top-level `stack(…)`'s arguments or `$:` / `name:` lines, and each track is a method chain whose calls carry typed arguments — numbers (constant arithmetic folded), mini-notation strings, plain strings, nested patterns and functions. Every double-quoted string is parsed as mini-notation by `parseMini`, which covers the whole grammar. Every node keeps its source range, so edits rewrite only the characters they touch. It is what [StrudelRack](https://blamy.github.io/ui/#/strudel-rack) is generated from.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/strudel-syntax.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  parseStrudel, parseMini, setMethod, mixCode,
} from '@/components/ui/strudel-syntax'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  parseStrudel, parseMini, setMethod, mixCode,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

It lives in [`@brett_lamy/docstream`](https://blamy.github.io/ui/#/docstream) (`@brett_lamy/docstream/strudel`, 1.11 and later).

{% demo src="strudel-syntax/inspector" %}

## The song

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

## Mini-notation

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

## Edits

```ts
setMethod(code, track.chain, 'room', formatNumber(.5)) // replace .room(…)'s argument, or append .room(.5)
removeMethod(code, track.chain, 'delay')
setTempo(song, .6)                                     // keeps setcpm code in cpm
setMiniAtom(code, mini, atom, '~')                     // one step of a pattern
mixCode(song, { muted: new Set([2]), solo: new Set() }) // the code to play, with silenced tracks
```

Edits return new code. Parse it again for the next edit (it is fast: a song is a few hundred characters).
