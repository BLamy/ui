# Checkbox

UI SDK's `Checkbox` with the iOS selection mark: a 22px circle that fills with the tint and draws its tick on, or a rounded square (`shape="square"`) for the shadcn look. `Checkbox` is one boolean, `CheckboxGroup` ties several to an array of values, and either can be indeterminate. For an on/off setting that takes effect immediately use [Switch](https://blamy.github.io/ui/#/switch); for one choice out of many use [RadioGroup](https://blamy.github.io/ui/#/radio-group).

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

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Checkbox, CheckboxGroup } from '@brett_lamy/ui/checkbox'
```
{% endtab %}
{% endtabs %}

## Shapes and states

The root is the box itself; with no children it renders its `CheckboxIndicator`, the tick. Put it and its text in a [Label](https://blamy.github.io/ui/#/label) with `variant="control"` so the whole line presses it, or give it an `aria-label`. `checked` / `defaultChecked` + `onCheckedChange(checked, details)` control it, where `checked` is `true`, `false` or `'indeterminate'` (a dash instead of a tick); `disabled` dims it and its label. A `required` checkbox in a [form](https://blamy.github.io/ui/#/form) blocks the submit until it is checked; inside a [Field](https://blamy.github.io/ui/#/field) marked `invalid` the box turns red.

{% demo src="checkbox/states" %}

```tsx
<Label variant="control"><Checkbox defaultChecked />Circle</Label>
<Label variant="control"><Checkbox shape="square" defaultChecked="indeterminate" />Some selected</Label>
<Label variant="control"><Checkbox shape="square" name="terms" required />I agree to the Terms</Label>
```

## Groups and select all

`CheckboxGroup` holds a `value` array (or `defaultValue`) and calls `onValueChange(values, details)`; each `Checkbox` inside gives its `value`. Name the group with `aria-label`, or a `Label` whose `htmlFor` is the group's `id`. A "select all" box is a `Checkbox` with `parent`: checked when every value is, indeterminate while some are, and it checks or clears the enabled ones. Pass `allValues` so it is right on the first render.

{% demo src="checkbox/select-all" %}

```tsx
<CheckboxGroup aria-label="Notification channels" value={selected} onValueChange={setSelected} allValues={['email', 'push']}>
  <Label variant="control"><Checkbox parent />All channels</Label>
  <Label variant="control"><Checkbox value="email" />Email</Label>
  <Label variant="control"><Checkbox value="push" />Push</Label>
</CheckboxGroup>
```

To check a box or a group from elsewhere, pass a controller from `createCheckboxController()` or `createCheckboxGroupController()` as `controller`.

## Accessibility

Each box is a `<button>` with the `checkbox` role and `aria-checked` (`mixed` while indeterminate), plus a hidden native checkbox that takes part in forms, so Space toggles it and Tab moves between boxes. A wrapping `Label` names it and makes the text a click target; a box with no text needs `aria-label`. A parent box points at its children with `aria-controls`. The focus ring shows for keyboard focus only (`focus-visible`). A group needs its own name.

## Props

### Checkbox

UI SDK's `Checkbox` props, plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `shape` | `circle` | `circle` or `square` (rounded 6px). |
| `checked` / `defaultChecked` / `onCheckedChange` | — | `true`, `false` or `'indeterminate'`; the callback gets `(checked, details)` with `details.reason` and `details.cancel()`. |
| `disabled` / `readOnly` / `required` | `false` | Disabled dims to 40%; read-only shows the state but can't change it. |
| `value`, `name` | — | The value inside a group; the form field name. |
| `parent` | `false` | Inside a group: checks or clears every enabled box. |
| `controller` | — | From `createCheckboxController()`. |
| `children` | `<CheckboxIndicator />` | Replace the mark. |
| `className` | — | Merged onto the box; may be a function of the state. |

### CheckboxIndicator

The tick (or dash) inside the box. It stays mounted (`keepMounted`) so the tick draws itself on and off; children replace the mark, and may be a function of `{ checked, indeterminate }`.

### CheckboxGroup

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onValueChange` | — | The array of checked `value`s; `(values, details)`. |
| `allValues` | — | Every value, so a `parent` box knows the set before the boxes mount. |
| `disabled` / `readOnly` / `required` / `name` | — | Applied to every box. |
| `controller` | — | From `createCheckboxGroupController()`. |
| `className` | — | Merged onto the vertical `gap-3` stack. |

## Styling

The box is `data-slot="checkbox"`, the mark `data-slot="checkbox-indicator"` and the group `data-slot="checkbox-group"`. The box carries `data-checked`, `data-unchecked`, `data-indeterminate`, `data-disabled`, `data-readonly` and `data-required`; pressed is `active:` and keyboard focus `focus-visible:`. Invalid is `aria-invalid` (which a Field writes) on the box or the group around it. The unchecked edge is `border-control-border` (the `--control-border` token, `--muted-foreground` unless a theme sets it), which keeps 3:1 against the surface in light and dark; the tick is `text-primary-foreground`, so it follows a theme's tint. Keyboard focus draws the kit's solid focus ring. The tick animates by stroke-dashoffset and stays still under reduced motion. `checkboxVariants({ shape })` styles the box on its own.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `checkboxVariants`

Defined in `@/components/ui/checkbox`. Base classes:

```text
[ 'box-border grid size-[22px] shrink-0 cursor-pointer place-items-center border-[1.5px] border-control-border bg-transparent p-0 text-primary-foreground', 'transition-[background-color,border-color,scale] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none', 'data-checked:border-primary data-checked:bg-primary', 'data-indeterminate:border-primary data-indeterminate:bg-primary', 'active:not-data-disabled:scale-90', pressableFocusRing, // Invalid: the box itself (`aria-invalid`, which a Field writes on its control) or the group around it. 'aria-invalid:border-destructive group-aria-invalid/checkbox-group:border-destructive', 'aria-invalid:data-checked:border-destructive aria-invalid:data-checked:bg-destructive group-aria-invalid/checkbox-group:data-checked:border-destructive group-aria-invalid/checkbox-group:data-checked:bg-destructive', 'data-disabled:cursor-default data-disabled:opacity-40', ]
```

**`shape`** — default `circle`

| Value | Adds |
| --- | --- |
| `circle` (default) | `rounded-full` |
| `square` | `rounded-md` |
