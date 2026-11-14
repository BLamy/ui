# Label

The name of a control: UI SDK's `Label`, a native `<label>`. Point `htmlFor` at the control's `id`, or wrap the control; pressing it focuses, checks or toggles the control as a native label would, and assistive technology announces it as the control's name. It reaches what a plain `<label>` can't (a radio group, a slider, a checkbox group). Three looks: `default` for inline labels, `field` for the small grouped-form header above an input, and `control` for the line around a checkbox, radio or switch. Inside a [Field](https://blamy.github.io/ui/#/field) use `FieldLabel` (same variants), which also ties the field's description and errors to the control. Pair it with [Input](https://blamy.github.io/ui/#/input) and [Checkbox](https://blamy.github.io/ui/#/checkbox).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/label.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Label } from '@/components/ui/label'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Label } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Naming a control

Give the control an `id` and the label its `htmlFor`, or put the control inside the label. `variant="field"` is the iOS grouped-form header (the look `FieldLabel` has by default); with no `variant`, the label is 15px foreground; `variant="control"` lays a checkbox, radio or switch and its text in one pressable line.

{% demo src="label/fields" %}

```tsx
<Label variant="field" htmlFor="email">Email</Label>
<Input id="email" type="email" />

<Label variant="control"><Checkbox defaultChecked />Remember me</Label>
```

In a [Field](https://blamy.github.io/ui/#/field), the `FieldLabel` is linked to the control with no `htmlFor`:

```tsx
<Field>
  <FieldLabel>Email</FieldLabel>
  <Input type="email" required />
  <FieldDescription>Receipts and sign-in links go here.</FieldDescription>
  <FieldError />
</Field>
```

A `control` label dims with its control (`has-data-disabled:`). The other variants dim with `group-data-disabled:opacity-50`, so they need an ancestor with the `group` class that carries `data-disabled`, as a disabled Field has.

## Accessibility

A label with no `htmlFor` and no control inside has no target. Name the control with a label, or give it its own `aria-label`. Keep the label text visible and short; use `FieldDescription` for help and `FieldError` for errors, which a Field ties to the control.

## Props

UI SDK's `Label` props (`htmlFor`, `id`, `render`, and any `<label>` attribute), plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default` (15px, foreground, medium), `field` (13px, the foreground at 70% for AA contrast on grey, 4px side padding; `FieldLabel`'s default) or `control` (17px, a 12px gap, pressable). |
| `className` | — | Merged after the recipe; may be a function of the state. |

## Styling

`data-slot="label"`. The label is `inline-flex`, with a 6px gap (`control`: 12px), so an icon, a "required" marker or a control placed inside aligns with the text. `labelVariants({ variant })` returns the classes for another element.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `labelVariants`

Defined in `@/components/ui/label`. Base classes:

```text
inline-flex items-center group-data-disabled:opacity-50
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `gap-1.5 text-subhead font-medium text-foreground` |
| `field` | `gap-1.5 px-1 text-footnote font-medium text-muted-foreground` |
| `control` | `cursor-pointer gap-3 text-body text-foreground has-data-disabled:cursor-default has-data-disabled:text-foreground/40` |
