# ProgressRing

Circular progress in the iOS style: a track and a round-capped arc that starts at twelve o'clock and fills clockwise. `ProgressRing` is determinate progress — it springs to each new value and its percentage rolls digit by digit — and `CountdownRing` is the verification-code timer that drains one second at a time and turns red near the end. For a bar use [Progress](https://blamy.github.io/ui/#/progress); for a wait with no value and no room for a ring use [Spinner](https://blamy.github.io/ui/#/spinner); for a list of milestones use [ProgressStepper](https://blamy.github.io/ui/#/progress-stepper).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/progress-ring.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  ProgressRing, CountdownRing,
} from '@/components/ui/progress-ring'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  ProgressRing, CountdownRing,
} from '@brett_lamy/ui/progress-ring'
```
{% endtab %}
{% endtabs %}

## ProgressRing

`ProgressRing` is UI SDK's `Progress` (`role="progressbar"`, `aria-valuenow`, `aria-valuetext`) drawn as a ring. Give it an `aria-label` and a `value` (0–100 by default, or set `min` / `max`); `showValue` puts the rolling percentage in the middle from `lg` up (smaller rings have no room for "100%" inside the stroke; a custom `format` shows UI SDK's text as is), or pass children — a stop square, a check. Leave `value` out (or pass `null`) for a spinning quarter arc; under reduced motion it is a still, dim full ring instead, so it never reads as a quarter done.

{% demo src="progress-ring/rings" %}

```tsx
<ProgressRing aria-label="Upload" value={progress} size="lg" showValue />
<ProgressRing aria-label="Downloading" value={42}><StopSquare /></ProgressRing>
<ProgressRing aria-label="Loading" />
```

## CountdownRing

A countdown is a clock, so its arc runs at constant speed — one linear second per tick — rather than on a spring. The seconds in the middle roll (NumberMorph); at `urgentAt` seconds (5 by default) the arc and the digits turn the urgent color, red (`--destructive`; this is not the amber `warning` tone). When the period restarts the arc jumps straight back to full instead of spinning backwards through the turnover.

`useCountdown(duration, { running, loop, onEnd, offset })` drives one. It runs on the wall clock (`Date.now()`), so throttled timers catch up instead of drifting, and returns `remaining` (whole seconds left), `period` (periods completed, for the code window), `elapsed` and `reset`. By default it loops like a TOTP period; `offset` starts it part-way through (align it with a clock).

{% demo src="progress-ring/countdown" %}

```tsx
const { remaining } = useCountdown(30, { onEnd: nextCode })
<CountdownRing remaining={remaining} duration={30} />
```

The ring has `role="timer"` and an `aria-label` of "N seconds left" (override with `aria-label`).

## Props

### ProgressRing

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `min` / `max` | `null` / 0 / 100 | The progress (UI SDK `Progress`). Leave `value` out or `null` for the spinning quarter arc (a dim full ring under reduced motion). |
| `locale` | page language | The locale of the value, passed to the rolling percentage too. |
| `format` / `getValueLabel` | percent | The value text and its screen-reader label, as on [Progress](https://blamy.github.io/ui/#/progress). |
| `size` | `default` | `sm` 20 · `default` 28 · `lg` 44 · `xl` 72 px, or any number of px. |
| `thickness` | scales with size | Stroke width in px. |
| `tone` | `default` | `success`, `warning`, `destructive`. |
| `tint` / `trackTint` | primary / fill | The arc's and the track's color, any CSS colors (`tint` overrides `tone`): the kit's caller-color prop, as on Avatar. |
| `showValue` | `false` | The rolling percentage (`lg`, `xl`, or 40px and up; ignored below). |
| `children` | — | Custom content in the middle. |
| `ref`, DOM props | — | Passed to the root (UI SDK `Progress`). |

### CountdownRing

| Prop | Default | Effect |
| --- | --- | --- |
| `remaining` | — | Seconds left. |
| `duration` | `30` | Seconds in a full period. |
| `urgentAt` | `5` | Turn the urgent color at or below this; `0` never. |
| `size` / `thickness` | `default` | As for ProgressRing. |
| `tint` / `urgentTint` / `trackTint` | primary / red / fill | The arc's color, its color in the last seconds (the seconds too), and the track's: any CSS colors. |
| `showValue` | on from 26px | The seconds in the middle, sized with the ring (36% of its diameter), as ProgressRing's `showValue`. |
| `ref`, DOM props | — | Passed to the root `span`. |

A ProgressRing is UI SDK's Progress root with a slot of its own, `data-slot="progress-ring"` (so a rule for the bar's `progress` never matches it), and UI SDK's state attributes (`data-indeterminate`, `data-progressing`, `data-complete`); the value in the middle is `progress-value`. A CountdownRing carries `data-slot="countdown-ring"` (with `data-urgent` for the last seconds); the arc of either is `data-slot="progress-ring-arc"`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `progressRingVariants`

Defined in `@/components/ui/progress-ring`. Base classes:

```text
relative inline-grid size-(--ring-px) shrink-0 place-items-center align-middle
```

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `[--ring-color:var(--primary)]` |
| `success` | `[--ring-color:var(--color-success)]` |
| `warning` | `[--ring-color:var(--color-warning)]` |
| `destructive` | `[--ring-color:var(--destructive)]` |

### `countdownRingValueVariants`

Defined in `@/components/ui/progress-ring`. Base classes:

```text
absolute inset-0 grid place-items-center font-semibold tabular-nums text-(length:--ring-font) transition-colors duration-300
```

**`urgent`** — default `false`

| Value | Adds |
| --- | --- |
| `false` (default) | `text-muted-foreground` |
| `true` | `text-(--ring-urgent)` |
