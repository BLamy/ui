# RadioGroup

One choice from a short list, on react-aria's `RadioGroup` and `Radio`: round 22px radios that fill their ring with the tint when selected. Arrow keys move the selection; Tab enters and leaves the group as one stop. For the iOS segmented-control look use `Segmented`; for several independent choices use [Checkbox](https://blamy.github.io/ui/#/checkbox).

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

Children are `Radio`s, each with a `value`; put a `Label` first to name the group. `RadioGroup` is vertical by default; `orientation="horizontal"` lays the radios in a wrapping row. That row includes the label, so in a horizontal group wrap the radios in their own `div` with a flex layout to keep the label above.

{% demo src="radio-group/plans" %}

```tsx
<RadioGroup value={plan} onChange={setPlan}>
  <Label variant="field">Plan</Label>
  <Radio value="free">Free</Radio>
  <Radio value="pro">Pro · $8 / month</Radio>
  <Radio value="enterprise" isDisabled>Enterprise</Radio>
</RadioGroup>
```

## Validation

Set `isRequired` on the group (or `isInvalid`, or a `validate` function) and add a `FieldError`: the radios turn red and the message shows after a submit inside a [Form](https://blamy.github.io/ui/#/form) (or live with `validationBehavior="aria"`).

{% demo src="radio-group/validation" %}

## Accessibility

The group is `role="radiogroup"`, named by its `Label` (or `aria-label`), and each `Radio` is a native radio input inside its label. Arrow keys move focus and selection together. A disabled option is skipped by arrow navigation. A group with no label is announced without context, so always label it.

## Props

### RadioGroup

| Prop | Default | Effect |
| --- | --- | --- |
| `orientation` | `vertical` | `vertical` (column, `gap-3`) or `horizontal` (wrapping row, `gap-5`); also sets the arrow-key axis. |
| `value` / `defaultValue` / `onChange` | — | The selected radio's `value` (string). |
| `name`, `isRequired`, `isDisabled`, `isReadOnly`, `isInvalid`, `validate`, `validationBehavior` | — | As in react-aria's `RadioGroup`. |
| `className` | — | Merged; may be a function of the render state. |

### Radio

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | — | Required; the group's value when selected. |
| `isDisabled` | `false` | Dims to 40% and skips it. |
| `children` | — | The label. |
| `className` | — | Merged onto the row. |

## Styling

`data-slot="radio-group"`, `"radio"` and `"radio-indicator"`. The indicator reads the row's `data-selected`, `data-pressed`, `data-focus-visible` and `data-invalid`. `radioGroupVariants({ orientation })` and `radioVariants()` return the class lists.

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
[ 'box-border size-[22px] shrink-0 rounded-full border-[1.5px] border-tertiary-foreground bg-transparent', 'transition-[border-width,border-color,scale] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none', 'group-data-selected:border-[7px] group-data-selected:border-primary group-data-selected:bg-white', 'group-data-pressed:scale-90 group-data-focus-visible:ring-[3px] group-data-focus-visible:ring-ring/45', 'group-data-invalid:border-destructive', ]
```

No variants.
