# ProgressStepper

A row of milestones for a multi-step process: an order moving from placed to delivered, a checkout, a deploy. Each step has an icon and a track; steps before `current` are complete (with a check badge), the one at `current` is under way and shimmers while it waits, the rest are upcoming. It shows where you are, not how far through a step: for a percentage use [Progress](https://blamy.github.io/ui/#/progress), and for one task's progress in a circle [ProgressRing](https://blamy.github.io/ui/#/progress-ring). Its segments are the Progress rail, so the two read as one system on a page.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/progress-stepper.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  ProgressStepper, ProgressStepperItem,
} from '@/components/ui/progress-stepper'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  ProgressStepper, ProgressStepperItem,
} from '@brett_lamy/ui/progress-stepper'
```
{% endtab %}
{% endtabs %}

## Usage

Pass `steps` (an `id`, a `label` and an optional `icon` each) and the index of the step in progress. Step `current` past the end (`steps.length`) and every step reads as complete.

{% demo src="progress-stepper/order" %}

```tsx
const steps = [
  { id: 'placed', label: 'Placed', icon: <Icon name="check-circle" /> },
  { id: 'shipped', label: 'Shipped', icon: <Icon name="airplane" /> },
]

<ProgressStepper steps={steps} current={1} labels />
```

## Parts

`steps` is the shorthand for the parts. Pass `ProgressStepperItem` children instead when a step needs more than a label and an icon: a `description` (a time, a place), a class of its own, or a marker of your own. A `ProgressStepperItem` with no children renders its `ProgressStepperItemIcon`, `ProgressStepperItemTrack`, `ProgressStepperItemLabel` and `ProgressStepperItemDescription` from its `icon`, `label` and `description`; give it children to arrange them yourself. Each step works out its state from its position, so the parts only need `current` on the root.

{% demo src="progress-stepper/parts" %}

```tsx
<ProgressStepper current={2} labels aria-label="Delivery">
  <ProgressStepperItem icon={<Icon name="check-circle" />} label="Placed" description="12:04" />
  <ProgressStepperItem>
    <ProgressStepperItemIcon><Spinner size={18} /></ProgressStepperItemIcon>
    <ProgressStepperItemTrack />
    <ProgressStepperItemLabel>On the way</ProgressStepperItemLabel>
  </ProgressStepperItem>
</ProgressStepper>
```

## Variants

`variant="bars"` (default) draws a short segment under each icon that fills as the step completes; `variant="line"` joins the icons with one line, with no segment after the last. `labels` shows each step's label under its track (centred under a bar; start-aligned under the icon in `line`, on a second row), wrapping to two lines before it is cut, so "Order placed" stays readable at phone width; off, the labels are screen-reader only. `animated` (default on) sweeps a highlight along the current segment; off, or under reduced motion, the current segment is a still, partly filled bar.

## Accessibility

The root is an `ol` named "Progress" by default; name each stepper with `aria-label` (or `aria-labelledby`) when a page has more than one. Each step is an `li` with `aria-current="step"` on the current one, and its label is always present as text (visually hidden unless `labels` is on); complete steps add a hidden ", completed" (`completedLabel` sets the word in your app's language), so a screen reader hears "Placed, completed". The icon and tracks are `aria-hidden`, so the state is conveyed by text and `aria-current`, not colour alone. It is not a `progressbar`: there is no value to announce.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `steps` | — | `{ id, label, icon?, description? }[]` (`ProgressStepperStep`). `label` is the accessible name. Leave out to pass `ProgressStepperItem` children. |
| `current` | — | Index of the step in progress; earlier ones are complete, later ones upcoming. `steps.length` for all complete. |
| `variant` | `bars` | `bars` or `line`. |
| `animated` | `true` | Shimmer the current segment. |
| `labels` | `false` | Show labels (and descriptions) under the steps; a label wraps to two lines. |
| `completedLabel` | `"completed"` | What a complete step adds to its name for screen readers. |
| `aria-label` / `aria-labelledby` | `"Progress"` | The list's name. Name each stepper when a page has more than one (an order and a deploy). |
| `className` / `style` | — | Merged onto the `ol`, which takes the other `ol` attributes (and `ref`) too. |

### ProgressStepperItem

| Prop | Default | Effect |
| --- | --- | --- |
| `label` / `icon` / `description` | — | Shorthand for the parts below. |
| `children` | — | The parts, arranged yourself (replaces the shorthand). |
| `className`, `li` attributes | — | Merged onto the `li`. |

`ProgressStepperItemIcon`, `ProgressStepperItemTrack`, `ProgressStepperItemLabel` and `ProgressStepperItemDescription` are `span`s that take `className` and `span` attributes, and read their step's state from context.

## Styling

Slots: `progress-stepper` (with `data-variant`, and `data-animated` when on), `progress-stepper-item` (with `data-state="complete|current|upcoming"`), `progress-stepper-item-icon` (with `progress-stepper-item-check` on complete steps), `progress-stepper-item-track`, `progress-stepper-item-fill`, `progress-stepper-item-label` and `progress-stepper-item-description`. The accent is the `--stepper-accent` custom property (the primary colour by default) and the rail `--stepper-track` (`--secondary-strong`, the Progress rail); override them on the root to recolour. Style one state with a `data-[state=complete]:` selector.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `progressStepperVariants`

Defined in `@/components/ui/progress-stepper`. Base classes:

```text
m-0 flex list-none p-0 [--stepper-accent:var(--primary)] [--stepper-track:var(--secondary-strong)]
```

**`variant`** — default `bars`

| Value | Adds |
| --- | --- |
| `bars` (default) | `gap-1.5` |
| `line` | `gap-0` |
