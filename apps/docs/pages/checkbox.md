# Checkbox

react-aria's `Checkbox` with the iOS selection mark: a 22px circle that fills with the tint and draws its tick on, or a rounded square (`shape="square"`) for the shadcn look. `Checkbox` is one boolean, `CheckboxGroup` ties several to an array of values, and either can be indeterminate. For an on/off setting that takes effect immediately use [Switch](https://blamy.github.io/ui/#/switch); for one choice out of many use [RadioGroup](https://blamy.github.io/ui/#/radio-group).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/checkbox.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Checkbox, CheckboxGroup } from '@/components/ui/checkbox'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Checkbox, CheckboxGroup } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Shapes and states

Children are the label. `defaultSelected` / `isSelected` + `onChange(boolean)` control it; `isIndeterminate` shows a dash instead of a tick; `isDisabled` dims the row. A `required` checkbox in a [Form](https://blamy.github.io/ui/#/form) blocks the submit until it is checked and then turns red.

{% demo src="checkbox/states" %}

```tsx
<Checkbox defaultSelected>Circle</Checkbox>
<Checkbox shape="square" isIndeterminate>Some selected</Checkbox>
<Checkbox shape="square" name="terms" isRequired>I agree to the Terms</Checkbox>
```

## Groups and select all

`CheckboxGroup` holds a `value` array (or `defaultValue`) and calls `onChange(string[])`; each child `Checkbox` has a `value`. Put a `Label` first, or give the group an `aria-label`. A "select all" box is an ordinary `Checkbox` whose `isSelected`, `isIndeterminate` and `onChange` you derive from the array.

{% demo src="checkbox/select-all" %}

```tsx
<CheckboxGroup value={selected} onChange={setSelected}>
  <Label>Notification channels</Label>
  <Checkbox value="email">Email</Checkbox>
  <Checkbox value="push">Push</Checkbox>
</CheckboxGroup>
```

## Accessibility

A native `<input type="checkbox">` sits inside the label, so Space toggles, Tab moves between boxes and the whole row is the click target. The indeterminate state is exposed to assistive technology as "mixed". The visible text is the accessible name; for an icon-only or text-less box add `aria-label`. The focus ring shows for keyboard focus only (`data-focus-visible`). A group needs its own name (`Label` or `aria-label`).

## Props

### Checkbox

Every react-aria `Checkbox` prop applies, plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `shape` | `circle` | `circle` or `square` (rounded 6px). |
| `isSelected` / `defaultSelected` / `onChange` | — | Controlled / uncontrolled boolean. |
| `isIndeterminate` | `false` | Dash instead of tick; takes precedence visually over `isSelected`. |
| `isDisabled` / `isRequired` / `isInvalid` | `false` | Disabled dims to 40%; invalid turns the mark red. |
| `value`, `name` | — | The value inside a group; the form field name. |
| `className` | — | Merged onto the row; may be a function of the render state. |

### CheckboxGroup

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onChange` | — | The array of selected `value`s. |
| `isDisabled` / `isRequired` / `name` | — | Applied to every box. |
| `className` | — | Merged onto the vertical `gap-3` stack. |

## Styling

The row is `data-slot="checkbox"`, the mark `data-slot="checkbox-indicator"` and the group `data-slot="checkbox-group"`. The mark reads the row's `data-selected`, `data-indeterminate`, `data-pressed`, `data-focus-visible` and `data-invalid` with `group-data-*` classes. The tick animates by stroke-dashoffset and stays still under reduced motion. `checkboxVariants({ shape })` styles the mark on its own.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `checkboxVariants`

Defined in `@/components/ui/checkbox`. Base classes:

```text
[ 'box-border grid size-[22px] shrink-0 place-items-center border-[1.5px] border-tertiary-foreground text-white', 'transition-[background-color,border-color,scale] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none', 'group-data-selected:border-primary group-data-selected:bg-primary', 'group-data-indeterminate:border-primary group-data-indeterminate:bg-primary', 'group-data-pressed:scale-90 group-data-focus-visible:ring-[3px] group-data-focus-visible:ring-ring/45', 'group-data-invalid:border-destructive group-data-invalid:group-data-selected:bg-destructive', ]
```

**`shape`** — default `circle`

| Value | Adds |
| --- | --- |
| `circle` (default) | `rounded-full` |
| `square` | `rounded-md` |
