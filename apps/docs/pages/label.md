# Label

The name of a form field. It is react-aria's `Label`, so inside a field (`TextField`, `Select`, `Checkbox`, …) it is linked to the control automatically: no `htmlFor` or `id` to wire, clicking it focuses the control, and assistive technology announces it as the control's name. Two looks: `default` for inline labels and `field` for the small grouped-form header that sits above an input. Pair it with [TextField](https://blamy.github.io/ui/#/text-field) and [Input](https://blamy.github.io/ui/#/input).

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

## In a field

Put the `Label` inside the field and leave the wiring to react-aria. `variant="field"` is the iOS grouped-form header; with no `variant`, the label is 15px foreground.

{% demo src="label/fields" %}

```tsx
<TextField isRequired>
  <Label variant="field">Email</Label>
  <Input type="email" />
  <FieldDescription>Receipts and sign-in links go here.</FieldDescription>
  <FieldError />
</TextField>
```

The disabled dimming is `group-data-disabled:opacity-50`, so it needs an ancestor with the `group` class that carries `data-disabled`. `TextField` has both, so a disabled field dims its label as in the third field above. If you use a react-aria field of your own, add `group` to it.

## Accessibility

A label outside a react-aria field is just a `<label>` with no target. Wrap it in the field it names, or give the control its own `aria-label`. Keep the label text visible and short; use `FieldDescription` for help and `FieldError` for errors, both of which react-aria ties to the input.

## Props

Extends react-aria `LabelProps` (`elementType`, `htmlFor`, `id`, and any `<label>` attribute).

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default` (15px, foreground, medium) or `field` (13px, muted, 4px side padding). |
| `className` | — | Merged after the recipe. |

## Styling

`data-slot="label"`. The label is `inline-flex` with a 6px gap, so an icon or a "required" marker placed inside aligns with the text. `labelVariants({ variant })` returns the classes for another element.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `labelVariants`

Defined in `@/components/ui/label`. Base classes:

```text
inline-flex items-center gap-1.5 font-medium group-data-disabled:opacity-50
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `text-subhead text-foreground` |
| `field` | `px-1 text-footnote text-muted-foreground` |
