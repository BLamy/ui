# Progress

A horizontal progress bar in the iOS style, on react-aria's `ProgressBar`: a rounded track, a fill that springs to each new value, and an optional label and percentage above it. Use it for a long task with a known length (an upload, a sync); omit `value` for an indeterminate bar that slides. For a circular version see [ProgressRing](https://blamy.github.io/ui/#/progress-ring), for multi-step flows [ProgressStepper](https://blamy.github.io/ui/#/progress-stepper), and for an unmeasured wait a [Spinner](https://blamy.github.io/ui/#/spinner).

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

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Progress } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Give it a `label` (which also names the bar) or an `aria-label`, and a `value` from 0 to 100 (set `minValue` / `maxValue` for another range). `showValue` puts the value opposite the label; the default percentage rolls digit by digit ([NumberMorph](https://blamy.github.io/ui/#/number-morph)).

{% demo src="progress/variants" %}

```tsx
<Progress label="Uploading 12 photos" showValue value={38} />
<Progress label="Backup complete" showValue value={100} tone="success" size="sm" />
<Progress label="Preparing…" isIndeterminate />
```

## Controlled progress

Drive `value` from state. Switch to `isIndeterminate` while the request is queued, then back to a determinate value, and change `tone` to `success` when it completes. The fill transitions its width on the smooth spring, so uneven updates still move smoothly.

{% demo src="progress/upload" %}

## Custom value text

The default label is the percentage. Pass `formatOptions` (Intl.NumberFormat options) or `valueLabel` and react-aria's text is shown as is, without the roll. A non-percent `formatOptions` formats `value` itself, so `value={18} maxValue={24}` with `{ style: 'decimal' }` reads "18".

## Accessibility

react-aria provides `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and `aria-valuetext`; an indeterminate bar omits `aria-valuenow`. The `label` is wired up with `aria-labelledby`. Without a `label` you must pass `aria-label` or `aria-labelledby`. The rolling number is an `img` with the formatted text as its label, so it is not read as stray digits. Screen readers do not announce progress on their own: for a task the person is waiting on, announce completion in a `role="status"` region.

## Props

`Progress` takes react-aria's [ProgressBar props](https://react-aria.adobe.com/ProgressBar) plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `minValue` / `maxValue` | — / 0 / 100 | The progress. Omit `value` for indeterminate. |
| `isIndeterminate` | `false` | The bar slides (a still bar under reduced motion) and the value is hidden. |
| `size` | `default` | Track height: `sm` 4px, `default` 6px, `lg` 10px. |
| `tone` | `default` | Fill colour: `default` (primary), `success`, `destructive`. |
| `label` | — | Text above the bar; it names the progressbar. |
| `showValue` | `false` | Show the value opposite the label (never while indeterminate). |
| `formatOptions` / `valueLabel` | percent | Custom value text; see above. |
| `className` | — | Merged onto the root; a function of render props works. |

## Styling

Parts: `data-slot="progress"` (the grid root), `progress-track` and `progress-indicator`. The fill width comes from the `--pct` custom property. `progressVariants` styles the track by `size` and `progressIndicatorVariants` the fill by `tone`; call them to borrow the look.

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
absolute inset-y-0 left-0 rounded-full
```

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-primary` |
| `success` | `bg-success` |
| `destructive` | `bg-destructive` |
