# ProgressStepper

A row of milestones for a multi-step process: an order moving from placed to delivered, a checkout, a deploy. Each step has an icon and a track; steps before `current` are done, the one at `current` is active and shimmers while it waits, the rest are to do. It shows where you are, not how far through a step: for a percentage use [Progress](https://blamy.github.io/ui/#/progress).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/progress-stepper.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { ProgressStepper } from '@/components/ui/progress-stepper'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { ProgressStepper } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Pass `steps` (an `id`, a `label` and an optional `icon` each) and the index of the step in progress. Step `current` past the end (`steps.length`) and every step reads as done.

{% demo src="progress-stepper/order" %}

```tsx
const steps = [
  { id: 'placed', label: 'Placed', icon: <Icon name="check-circle" /> },
  { id: 'shipped', label: 'Shipped', icon: <Icon name="airplane" /> },
]

<ProgressStepper steps={steps} current={1} labels />
```

## Variants

`variant="bars"` (default) draws a short segment under each icon that fills as the step completes; `variant="line"` joins the icons with one line, with no segment after the last. `labels` shows each step's label under its track; off, the labels are screen-reader only. `animated` (default on) sweeps a highlight along the active segment; off, or under reduced motion, the active segment is a still, partly filled bar.

## Accessibility

The root is an `ol` with `aria-label="Progress"`, so a page with two steppers should tell them apart with surrounding headings. Each step is an `li` with `aria-current="step"` when active, and `label` is always present as text (visually hidden unless `labels` is on). The icon and tracks are `aria-hidden`, so the state is conveyed by position and `aria-current`, not colour alone. It is not a `progressbar`: there is no value to announce.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `steps` | — | `{ id, label, icon? }[]`. `label` is the accessible name. |
| `current` | — | Index of the active step; earlier ones are done, later ones to do. |
| `variant` | `bars` | `bars` or `line`. |
| `animated` | `true` | Shimmer the active segment. |
| `labels` | `false` | Show labels under the steps. |
| `className` / `style` | — | Merged onto the `ol`. |

## Styling

Slots: `progress-stepper` (with `data-variant`, and `data-animated` when on), `progress-step` (with `data-state="done|active|todo"`), `progress-step-icon`, `progress-step-track` and `progress-step-fill`. The accent is the `--ck-stepper-accent` custom property (the primary colour by default) and the idle track `--ck-stepper-idle` (secondary); override them on the root to recolour. Style one state with a `data-[state=done]:` selector.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `progressStepperVariants`

Defined in `@/components/ui/progress-stepper`. Base classes:

```text
m-0 flex list-none p-0 [--ck-stepper-accent:var(--primary)] [--ck-stepper-idle:var(--secondary)]
```

**`variant`** — default `bars`

| Value | Adds |
| --- | --- |
| `bars` (default) | `gap-[6px]` |
| `line` | `gap-0` |
