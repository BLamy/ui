# StrudelRack

Studio hardware generated from Strudel code. `StrudelRack` reads the code's [syntax tree](https://blamy.github.io/ui/#/strudel-syntax) and builds a rack: a master strip with a BPM readout and tempo and output knobs, then a module per track — a status LED, backlit mute and solo pads, a channel fader for its gain, LCDs for its synth and key, TR-style step keys for its mini-notation and an LED-ring knob for every effect it uses, with a socket to add more. Every control rewrites only the characters it owns, so the code stays the source of truth: what you turn is what you would have typed.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/strudel-rack.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  StrudelRack, Knob, Fader, StepGrid,
} from '@/components/ui/strudel-rack'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { StrudelRack, Knob, Fader, StepGrid } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

It lives in [`@brett_lamy/docstream`](https://blamy.github.io/ui/#/docstream) (`@brett_lamy/docstream/strudel`, 1.11 and later) and is what [StrudelPlayer](https://blamy.github.io/ui/#/strudel-player)'s sliders button opens. The parser it needs (acorn) loads with it.

## On a grid

The master strip's **Rack | Grid** switch moves the modules onto a masonry grid: drag a module by its title to move it, drag its corner to resize it. On the keyboard, the move handle takes arrows and Home/End and the corner takes arrows. `layout="grid"` starts there, and `persistKey` remembers the arrangement.

{% demo src="strudel-rack/grid" %}

```tsx
const [code, setCode] = useState(song)
<StrudelRack code={code} onChange={setCode} onPlayableChange={setPlayable} layout="grid" persistKey="night-drive" />
```

The rack is controlled: `code` in, the edited code out through `onChange`. Mute and solo don't edit the code; they change what plays, which `onPlayableChange` reports (the code with the silenced tracks replaced by `silence`).

## What becomes what

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

## The hardware on its own

`Knob`, `Fader` and `StepGrid` are ARIA sliders and buttons you can use anywhere inside a `.strudel-rack` panel: drag (Shift for fine), arrow keys, Page Up/Down, Home/End, and double-click to reset.

{% demo src="strudel-rack/hardware" %}

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `code` | — | The Strudel code. |
| `onChange` | — | Called with the edited code. |
| `onPlayableChange` | — | Called with the code to play under the current mute/solo mix. |
| `layout` | `"rack"` | `"grid"` puts the modules on the masonry grid. |
| `persistKey` | — | Remember the mode, order and sizes in localStorage. |
