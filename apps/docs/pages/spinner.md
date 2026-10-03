# Spinner

Loading indicators for an indeterminate wait. The default is the iOS activity indicator: eight spokes that fade from faint to full and turn in eight discrete steps, not a smooth spin. Pick `animation` and it becomes one of twenty-two other loaders, each with three variants: seven ported from [Dani Asyrofi's Loading](https://loading.daniasyrofi.com) (Orbit, Bars, Matrix, Merge, Encode, Scan and Lift) and fifteen BL UI's own, drawn after the ideas in his gallery (Steps, Cradle, Hourglass, Balance, Fanout, Battery, Bloom, Sonar, Gyro, Coalesce, Crystal, Loop, Relay, Robot and Kettle). All of them draw in `currentColor`, so they take the colour of the text around them. Use one for a wait inside a button, a row or a toolbar; for a bar use [Progress](https://blamy.github.io/ui/#/progress), for a ring with a value use [ProgressRing](https://blamy.github.io/ui/#/progress-ring), and for content that is loading use [Skeleton](https://blamy.github.io/ui/#/skeleton).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/spinner.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Spinner } from '@/components/ui/spinner'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Spinner } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

`spin` turns the iOS indicator's rotation on; without it the spokes stay still. `size` is the width and height in px. Mounting the spinner is an event, so it grows in (scale and opacity) on the snappy spring instead of popping in; under reduced motion it appears at once.

{% demo src="spinner/states" %}

```tsx
<Spinner spin size={16} />
<div className="text-primary"><Spinner spin size={32} /></div>
```

## Loaders

`animation` picks one of twenty-two loaders and `variant` one of its three patterns. The first variant is the default, and a variant the animation does not have falls back to it. The loaders animate on their own (no `spin`); hold one still with `paused`.

{% demo src="spinner/gallery" %}

| `animation` | Looks like | Variants |
| --- | --- | --- |
| `ios` (default) | Eight spokes in stepped rotation | — (use `spin`) |
| `orbit` | Eight dots on a ring, lit in turn | `chase`, `oppose`, `breathe` |
| `beacon` | Five bars rising and falling | `rise`, `fall`, `balance` |
| `matrix` | A 3×3 grid of dots pulsing | `diagonal`, `ripple`, `scan` |
| `cells` | Four tiles that merge and spread | `merge`, `spread`, `checker` |
| `register` | Six bits shifting like a register | `shift`, `invert`, `pair` |
| `bands` | Three rails with a segment sweeping across | `descend`, `ascend`, `split` |
| `lift` | Four stacked levels lifting in a queue | `rise`, `fall`, `breathe` |
| `steps` | A marker hopping up a stair | `climb`, `descend`, `mark` |
| `cradle` | Newton's cradle: the end balls swing in turn | `transfer`, `reverse`, `double` |
| `hourglass` | Sand runs down, then the glass turns over | `flip`, `slow`, `grains` |
| `balance` | A beam balance that tips, settles or weighs | `tilt`, `settle`, `weigh` |
| `fanout` | A root that fans out to three results | `search`, `collect`, `rank` |
| `battery` | Four cells that fill, drain or breathe | `charge`, `drain`, `pulse` |
| `bloom` | Thirteen dots on a sunflower spiral opening in turn | `grow`, `ripple`, `spin` |
| `sonar` | A radar sweep with blips, or rings that ping out | `sweep`, `pulse`, `ping` |
| `gyro` | Three rings turning about different axes | `spin`, `tumble`, `settle` |
| `coalesce` | Eight dots gathering, bursting or rippling | `gather`, `burst`, `ripple` |
| `crystal` | A hexagon whose six facets light up | `grow`, `mirror`, `shimmer` |
| `loop` | A light running round an infinity loop | `run`, `trail`, `pair` |
| `relay` | Three nodes passing a pulse along | `hop`, `bounce`, `flow` |
| `robot` | A little robot on a stand that blinks, glances about or rocks as it thinks | `blink`, `look`, `think` |
| `kettle` | A kettle with steam rising; it shakes as it whistles, or its lid rattles | `whistle`, `boil`, `steam` |

`spinnerAnimations` lists every animation with its label and variants (`{ id, label, variants }[]`), so a gallery or a picker never has to hard-code them.

```tsx
<Spinner animation="orbit" />                          // chase
<Spinner animation="orbit" variant="oppose" size={48} />
<Spinner animation="matrix" speed={1.5} />
<Spinner animation="beacon" paused />
```

### Playground

Change the animation, variant, size and speed, and pause it. The line under the preview is the code for what you see.

{% demo src="spinner/playground" %}

### Size, speed and pausing

The loaders are drawn on a 24px grid and scaled to `size` (12–160px, default 32), so they stay sharp at any size. `speed` is the playback rate (0.25–3, default 1) and scales the delays as well as the durations, so the pattern keeps its shape. Every loader starts two seconds into its cycle, so the very first frame already shows each phase instead of an empty ring.

A loader nobody can see should not keep animating: each one pauses itself while it is scrolled out of view or the tab is hidden (an `IntersectionObserver` and the page visibility event), and resumes when it returns. Pages with many spinners therefore cost almost nothing off screen.

## In a button

Render the spinner only while the work runs, next to the label, and disable the button so a second press cannot double-submit. The spinner is decorative, so announce the result somewhere: here a `role="status"` line.

{% demo src="spinner/button-loading" %}

## Accessibility

A spinner is decorative by default: it is `aria-hidden` and says nothing to assistive technology. Put the state in text: change the button label ("Saving…"), or mark the loading region `aria-busy="true"` with a label. If the spinner is the only thing that says something is loading, give it a `label` and it becomes a `role="status"` with that name.

Under `prefers-reduced-motion` the loaders hold a still frame (at 65% opacity) instead of looping. The iOS indicator keeps its stepped rotation, as before, so render it only while something is pending.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `animation` | `ios` | `ios` or one of the twenty-two loaders in the table above (`orbit`, `beacon`, `matrix`, `cells`, `register`, `bands`, `lift`, `steps`, `cradle`, `hourglass`, `balance`, `fanout`, `battery`, `bloom`, `sonar`, `gyro`, `coalesce`, `crystal`, `loop`, `relay`, `robot`, `kettle`). |
| `variant` | the animation's first | One of its three patterns (see the table above). |
| `spin` | `false` | `ios` only: start the stepped rotation (`animate-[blSpin_.75s_steps(8)_infinite]`). |
| `size` | `22` (`ios`) / `32` | Width and height in px; 12–160 for the loaders. |
| `speed` | `1` | Playback rate of the loaders, 0.25–3. |
| `paused` | `false` | Hold a loader still. |
| `label` | — | An accessible name; without it the spinner is `aria-hidden`. |
| `className` / `style` | — | Merged onto the root (`svg` for `ios`, a `span` for the loaders); set the colour with a `text-*` class or `color`. |

## Styling

The root is `data-slot="spinner"` with `data-animation`, and `data-paused` while it is held or hidden. The `ios` spokes use `fill="currentColor"` with opacities 1/8 to 8/8, so the colour comes from the parent; its `blSpin` keyframes ship with BL UI's stylesheet.

The loaders are plain CSS in that stylesheet (`@layer components`, classes and keyframes prefixed `bl-ld-`), driven by custom properties: `--bl-ld-size`, `--bl-ld-speed` and `--bl-ld-scale` on the root, and `--bl-ld-d` (cycle length) and `--bl-ld-delay` on each moving part, which the component writes from its timing tables. Because they are `@layer components`, any utility class you put on the spinner wins.

## Credits

The idea, and the first seven loaders, come from [Loading](https://loading.daniasyrofi.com) by [Dani Asyrofi](https://daniasyrofi.com), whose gallery of small CSS loaders is well worth a look.

- **Orbit, Bars, Matrix, Merge, Encode, Scan and Lift** are his, MIT licensed. BL UI ports the markup and timing tables to React and the CSS to its stylesheet; the licence text is kept at the top of `spinner.tsx`, so it travels with a registry copy.
- **Steps, Cradle, Hourglass, Balance, Fanout, Battery, Bloom, Sonar, Gyro, Coalesce, Crystal, Loop, Relay, Robot and Kettle** are BL UI's own. They were made after the *ideas* in his gallery (a cradle, an hourglass, a balance beam, a stair climb, a fan-out of results, a robot, a kettle …) and share none of its code or artwork: the drawings are new (see `spinner-shapes.tsx`), and so are the keyframes.

The original also publishes more specialised loaders (AI-agent, canvas and WebGL ones) from its own site; they are not part of BL UI.
