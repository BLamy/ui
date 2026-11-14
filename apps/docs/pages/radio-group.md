# RadioGroup

One choice from a short list, on UI SDK's `RadioGroup` and `Radio`: round 22px radios that fill their ring with the tint when selected. Arrow keys move the selection; Tab enters and leaves the group as one stop. For the iOS segmented-control look use `Segmented`; for several independent choices use [Checkbox](https://blamy.github.io/ui/#/checkbox).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/radio-group.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { RadioGroup, Radio } from '@/components/ui/radio-group'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { RadioGroup, Radio } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Orientation and disabled options

Children are `Radio`s, each with a `value`. A `Radio` is the circle itself (with its `RadioIndicator`, the dot): wrap it and its text in a [Label](https://blamy.github.io/ui/#/label) with `variant="control"` so the whole line presses it. Name the group with `aria-label`, a `Label` whose `htmlFor` is the group's `id`, or the `FieldLabel` of a [Field](https://blamy.github.io/ui/#/field) around it. `value` / `defaultValue` + `onValueChange(value, details)` hold the choice. `RadioGroup` is vertical by default; `orientation="horizontal"` lays the radios in a wrapping row.

{% demo src="radio-group/plans" %}

```tsx
<Label variant="field" htmlFor="plan">Plan</Label>
<RadioGroup id="plan" value={plan} onValueChange={setPlan}>
  <Label variant="control"><Radio value="free" />Free</Label>
  <Label variant="control"><Radio value="pro" />Pro · $8 / month</Label>
  <Label variant="control"><Radio value="enterprise" disabled />Enterprise</Label>
</RadioGroup>
```

To pick from elsewhere, pass a controller from `createRadioGroupController()` as `controller`.

## Validation

Put a `required` group in a [Field](https://blamy.github.io/ui/#/field) with a `FieldError`: submitting its [form](https://blamy.github.io/ui/#/form) without a choice turns the radios red, shows the error under the group and moves focus to it. `invalid` on the Field marks it invalid yourself.

{% demo src="radio-group/validation" %}

```tsx
<Field>
  <FieldLabel>Data region</FieldLabel>
  <RadioGroup name="region" required>
    <Label variant="control"><Radio value="us" />United States</Label>
    <Label variant="control"><Radio value="eu" />European Union</Label>
  </RadioGroup>
  <FieldError match="valueMissing">Choose where your data is stored.</FieldError>
</Field>
```

## Accessibility

The group is `role="radiogroup"` and each `Radio` a `<button>` with the `radio` role and `aria-checked`, with a hidden native radio for forms. The group is one tab stop; arrow keys on both axes move focus and selection together and skip disabled options. A group with no name is announced without context, so always name it.

## Props

### RadioGroup

| Prop | Default | Effect |
| --- | --- | --- |
| `orientation` | `vertical` | `vertical` (column, `gap-3`) or `horizontal` (wrapping row, `gap-5`). |
| `value` / `defaultValue` / `onValueChange` | — | The checked radio's `value`; the callback gets `(value, details)` with `details.reason` and `details.cancel()`. |
| `name`, `required`, `disabled`, `readOnly` | — | Form name and constraints for the whole group. |
| `loop` | `true` | Whether arrow keys wrap from the last radio to the first. |
| `controller` | — | From `createRadioGroupController()`. |
| `className` | — | Merged; may be a function of the state. |

### Radio

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | — | Required; the group's value when checked. |
| `disabled` | `false` | Dims to 40% and skips it. |
| `children` | `<RadioIndicator />` | Replace the dot. |
| `className` | — | Merged onto the circle. |

### RadioIndicator

The white dot inside a checked radio; it has `data-starting-style` / `data-ending-style` as it comes and goes.

## Styling

`data-slot="radio-group"`, `"radio"` and `"radio-indicator"`. A radio carries `data-checked` / `data-unchecked`, `data-disabled`, `data-readonly` and `data-required`; pressed is `active:` and keyboard focus `focus-visible:`. Invalid is `aria-invalid` (which a Field writes) on the radio or the group. `radioGroupVariants({ orientation })` and `radioVariants()` return the class lists.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `radioGroupVariants`

Defined in `@/components/ui/radio-group`. Base classes:

```text
group flex
```

**`orientation`** — default `vertical`

| Value | Adds |
| --- | --- |
| `vertical` (default) | `flex-col gap-3` |
| `horizontal` | `flex-row flex-wrap gap-5` |

### `radioVariants`

Defined in `@/components/ui/radio-group`. Base classes:

```text
[ 'box-border grid size-[22px] shrink-0 cursor-pointer rounded-full border-[1.5px] border-tertiary-foreground bg-transparent p-0 outline-none', 'transition-[border-width,border-color,scale] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none', 'data-checked:border-[7px] data-checked:border-primary', 'active:not-data-disabled:scale-90 focus-visible:ring-[3px] focus-visible:ring-ring/45', // Invalid: the radio itself (`aria-invalid`, which a Field writes on its control) or the group around it. 'aria-invalid:border-destructive group-aria-invalid:border-destructive', 'data-disabled:cursor-default data-disabled:opacity-40', ]
```

No variants.
