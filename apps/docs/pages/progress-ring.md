# ProgressRing

Circular progress in the iOS style: a track and a round-capped arc that starts at twelve o'clock and fills clockwise. `ProgressRing` is determinate progress — it springs to each new value and its percentage rolls digit by digit — and `CountdownRing` is the verification-code timer that drains one second at a time and turns red near the end.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { ProgressRing, CountdownRing } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/progress-ring.json{% endcommand %}

Adds `@/components/ui/progress-ring.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  ProgressRing, CountdownRing,
} from '@/components/ui/progress-ring'
```
{% endtab %}
{% endtabs %}

## ProgressRing

`ProgressRing` is react-aria's `ProgressBar` (`role="progressbar"`, `aria-valuenow`, `aria-valuetext`) drawn as a ring. Give it an `aria-label` and a `value` (0–100 by default, or set `minValue` / `maxValue`); `showValue` puts the rolling percentage in the middle, or pass children — a stop square, a check. Omit `value` (or pass `isIndeterminate`) for a spinning quarter arc.

{% demo src="progress-ring/rings" %}

```tsx
<ProgressRing aria-label="Upload" value={progress} size="lg" showValue />
<ProgressRing aria-label="Downloading" value={42}><StopSquare /></ProgressRing>
<ProgressRing aria-label="Loading" isIndeterminate />
```

## CountdownRing

A countdown is a clock, so its arc runs at constant speed — one linear second per tick — rather than on a spring. The seconds in the middle roll (NumberMorph); at `warnAt` seconds (5 by default) the arc and the digits turn the warning color. When the period restarts the arc jumps straight back to full instead of spinning backwards through the turnover.

`useCountdown(duration, { running, loop, onEnd })` drives one: it returns the whole seconds left, ticking once a second, and by default loops like a TOTP period.

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
| `value` / `minValue` / `maxValue` | — / 0 / 100 | The progress (react-aria `ProgressBar`). |
| `isIndeterminate` | `false` | Spinning quarter arc (still under reduced motion). |
| `size` | `md` | `sm` 20 · `md` 28 · `lg` 44 · `xl` 72 px, or any number of px. |
| `thickness` | scales with size | Stroke width in px. |
| `tone` | `default` | `success`, `warning`, `destructive`. |
| `color` / `trackColor` | tint / fill | Any CSS colors. |
| `showValue` | `false` | The rolling percentage (sizes `md` and up). |
| `children` | — | Custom content in the middle. |

### CountdownRing

| Prop | Default | Effect |
| --- | --- | --- |
| `remaining` | — | Seconds left. |
| `duration` | `30` | Seconds in a full period. |
| `warnAt` | `5` | Turn the warning color at or below this; `0` never. |
| `size` / `thickness` | `md` | As for ProgressRing. |
| `color` / `warnColor` / `trackColor` | tint / red / fill | Any CSS colors. |
| `showLabel` | on from `md` | The seconds in the middle. |

The elements carry `data-slot="progress-ring"` or `data-slot="countdown-ring"` (with `data-warning` while warning); the arc is `data-slot="progress-ring-arc"`.
