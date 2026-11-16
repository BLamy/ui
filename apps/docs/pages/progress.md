# Progress

A horizontal progress bar in the iOS style, on UI SDK's `Progress`: a rounded track, a fill that springs to each new value, and an optional label and percentage above it. Use it for a long task with a known length (an upload, a sync); omit `value` for an indeterminate bar that slides. For a circular version see [ProgressRing](https://blamy.github.io/ui/#/progress-ring), for multi-step flows [ProgressStepper](https://blamy.github.io/ui/#/progress-stepper), and for an unmeasured wait a [Spinner](https://blamy.github.io/ui/#/spinner). For a level in a range (storage used, battery) use UI SDK's `Meter` (`role="meter"`, not a progressbar); `progressVariants` and `progressIndicatorVariants` style it the same way.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/progress.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Progress } from '@/components/ui/progress'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Progress } from '@brett_lamy/ui/progress'
```
{% endtab %}
{% endtabs %}

## Usage

Give it a `label` (which also names the bar) or an `aria-label`, and a `value` from 0 to 100 (set `min` / `max` for another range). `showValue` puts the value opposite the label; the default percentage rolls digit by digit ([NumberMorph](https://blamy.github.io/ui/#/number-morph)).

{% demo src="progress/variants" %}

```tsx
<Progress label="Uploading 12 photos" showValue value={38} />
<Progress label="Backup complete" showValue value={100} tone="success" size="sm" />
<Progress label="Preparing…" />   {/* no value: indeterminate */}
```

## Controlled progress

Drive `value` from state. Pass `value={null}` (or leave it out) while the request is queued, then back to a determinate value, and change `tone` to `success` when it completes. The fill transitions its width on the smooth spring, so uneven updates still move smoothly.

{% demo src="progress/upload" %}

## Custom value text

The default label is the percentage. Pass `format` (Intl.NumberFormat options, or a function returning the text) and UI SDK's text is shown as is, without the roll. A percent format reports the value's position between `min` and `max`; any other formats `value` itself, so `value={18} max={24}` with `{ style: 'decimal' }` reads "18". `getValueLabel` gives screen readers more context than the visible text without changing it.

## Composition

With no children `Progress` renders its parts from `label`, `showValue`, `size` and `tone`. Pass them yourself to rearrange them:

```tsx
<Progress value={38}>
  <ProgressLabel>Uploading</ProgressLabel>
  <ProgressValue />
  <ProgressTrack size="sm"><ProgressIndicator tone="success" /></ProgressTrack>
</Progress>
```

`ProgressTrack` takes `size` and `ProgressIndicator` takes `tone`. `ProgressValue` shows the formatted text; its children can be a function of the state.

## Accessibility

UI SDK provides `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and `aria-valuetext`; an indeterminate bar omits `aria-valuenow`. The `label` (a `ProgressLabel`) is wired up with `aria-labelledby`. Without a `label` you must pass `aria-label` or `aria-labelledby`. The rolling number keeps the formatted text as plain (visually hidden) text and hides its reels, so it is not read as stray digits. Screen readers do not announce progress on their own: for a task the person is waiting on, announce completion in a `role="status"` region.

## Props

`Progress` takes UI SDK's [Progress props](https://ui-sdk.dev/docs/react/components/progress) (`value`, `min`, `max`, `format`, `locale`, `getValueLabel`, `render`) plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `min` / `max` | `null` / 0 / 100 | The progress. Leave `value` out (or `null`) for indeterminate: the bar slides (under reduced motion a dim full-width fill, so it never reads as part done) and the value is hidden. |
| `locale` | page language | The locale of the value, passed to the rolling percentage too. |
| `size` | `default` | Track height: `sm` 4px, `default` 6px, `lg` 10px. |
| `tone` | `default` | Fill colour: `default` (primary), `success`, `warning`, `destructive`. |
| `label` | — | Text above the bar; it names the progressbar. |
| `showValue` | `false` | Show the value opposite the label (never while indeterminate). |
| `format` / `getValueLabel` | percent | Custom value text; see above. |
| `children` | — | Replaces the default label, value and track with your own parts. |
| `className` | — | Merged onto the root; a function of the state (`value`, `percent`, `status`) works. |

## Styling

Parts: `data-slot="progress"` (the grid root), `progress-label`, `progress-value`, `progress-track` and `progress-indicator`, all written by UI SDK. Every part carries `data-indeterminate` while the value is unknown, `data-progressing` while under way and `data-complete` once done. The indicator sets its own width as an inline percentage of the track (none while indeterminate). `progressVariants` styles the track by `size` and `progressIndicatorVariants` the fill by `tone`; call them to borrow the look.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `progressVariants`

Defined in `@/components/ui/progress`. Base classes:

```text
relative w-full overflow-hidden rounded-full bg-secondary-strong
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-1` |
| `default` (default) | `h-1.5` |
| `lg` | `h-2.5` |

### `progressIndicatorVariants`

Defined in `@/components/ui/progress`. Base classes:

```text
absolute inset-y-0 start-0 rounded-full transition-[width] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none rtl:[--bl-progress-dir:-1] data-indeterminate:w-2/5 data-indeterminate:animate-bl-progress data-indeterminate:transition-none motion-reduce:data-indeterminate:w-full motion-reduce:data-indeterminate:animate-none motion-reduce:data-indeterminate:opacity-35
```

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-primary` |
| `success` | `bg-success` |
| `warning` | `bg-warning` |
| `destructive` | `bg-destructive` |
