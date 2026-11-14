# Field

The wrapper that makes a control a proper form field. `Field` is UI SDK's `Field`: it links a `FieldLabel`, a control, a `FieldDescription` and a `FieldError` by id, gives the control its `name`, and shows validation. The control is one of ours — an [Input](https://blamy.github.io/ui/#/input), a [Textarea](https://blamy.github.io/ui/#/textarea), a [Select](https://blamy.github.io/ui/#/select), a [Checkbox](https://blamy.github.io/ui/#/checkbox), a [Switch](https://blamy.github.io/ui/#/switch) or a [RadioGroup](https://blamy.github.io/ui/#/radio-group) — and it keeps its own value and attributes. `FieldSet` groups fields under an iOS-style section header. Reach for a `Field` whenever a control has a visible label, help text or an error message, or sits in a [Form](https://blamy.github.io/ui/#/form).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/field.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Field, FieldLabel, FieldDescription, FieldError, FieldSet,
  FieldLegend, FieldGroup,
} from '@/components/ui/field'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Field, FieldLabel, FieldDescription, FieldError, FieldSet,
  FieldLegend, FieldGroup,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Anatomy

```tsx
<Field name="email">
  <FieldLabel variant="field">Email</FieldLabel>
  <Input type="email" required />
  <FieldDescription>We never share it.</FieldDescription>
  <FieldError />
</Field>
```

Stack the pieces in that order. The field takes `name`, `disabled` and `invalid`; everything about the value (`value`, `defaultValue`, `onValueChange`, `type`, `required`, `readOnly`, `autoComplete`, `maxLength`…) goes on the control. `FieldLabel variant="field"` is the small grouped-form caption; the default variant is a larger `subhead` label. `FieldError` renders nothing until the field is invalid; with no children it shows the browser's message, and you can pass your own.

{% demo src="field/anatomy" %}

## Validation

Use native constraints on the control: `required`, `type="email"`, `minLength`, `pattern`. Their errors show after a submit attempt, the first invalid control takes focus, and the message then updates as the value changes. Give one `FieldError` per problem with `match` (`valueMissing`, `typeMismatch`, `patternMismatch`, `tooShort`…), or leave a single `FieldError` empty to show the browser's own words.

For a rule the browser can't check (a taken username, a server's answer, a character limit), decide it in your code and pass `invalid`:

| `invalid` | Shows |
| --- | --- |
| omitted | The browser's validation, once a submit finds the field invalid. |
| `true` | The field's errors now. Pass the message as the `FieldError`'s children. |
| `false` | No error, whatever the browser thinks. |

```tsx
<Field name="email" invalid={taken ? true : undefined}>
  <FieldLabel variant="field">Email</FieldLabel>
  <Input type="email" required onValueChange={() => setTaken(false)} />
  <FieldError match="valueMissing">Enter your email address.</FieldError>
  {taken ? <FieldError match>That address is already registered.</FieldError> : null}
</Field>
```

Go back to `undefined`, not `false`, when your error clears, so the browser's validation takes over again.

{% demo src="field/validation" %}

## Field sets

`FieldSet` is a native `<fieldset>` and `FieldLegend` its `<legend>`, styled as the uppercase section header of an iOS grouped form. Keep the legend first. A `FieldDescription` right inside the set, outside any `Field`, describes the whole set; put it last for the footnote under the group. `FieldGroup` is a plain stack for the fields. `disabled` on the set disables every control inside it and leaves their values out of the form.

```tsx
<FieldSet disabled={sameAsShipping}>
  <FieldLegend>Billing address</FieldLegend>
  <FieldGroup>
    <Field name="billing-street">
      <FieldLabel variant="field">Street</FieldLabel>
      <Input autoComplete="billing street-address" />
    </Field>
  </FieldGroup>
  <FieldDescription>Only if it differs from shipping.</FieldDescription>
</FieldSet>
```

{% demo src="field/field-set" %}

## Other controls

A `Select`, `Checkbox`, `Switch` or `RadioGroup` inside a `Field` takes the field's label, description and name the same way; pressing the label toggles a checkbox or a switch. For a native control the library doesn't ship, like a `<select>`, use `FieldControl render={<select />}`. Text always goes in an `Input` or a `Textarea`, never a `FieldControl`: an agent sees only the library's controls. To make a control of your own join the field around it, call `useFieldControl()` and spread `field.props(yourProps)` on its element.

## Accessibility

The label names the control (`aria-labelledby`, beside a native `<label for>`), the description and any error that shows describe it (`aria-describedby`), and an invalid control has `aria-invalid`. An error that appears while focus stays put is announced. A `FieldSet` is a `group` named by its legend. Every field still needs a name: a `FieldLabel`, or `aria-label` on the control when the design hides it.

## Props

### Field

A `<div>`. Every UI SDK `Field` prop applies:

| Prop | Default | Effect |
| --- | --- | --- |
| `name` | — | The name the control submits under, when the control sets none. |
| `disabled` | `false` | Disables the control and marks every part `data-disabled`. |
| `invalid` | — | Your own verdict: `true` shows the errors now, `false` shows none; omit it for the browser's validation. |
| `render` | — | Another element or component in place of the `<div>`. |
| `className` | — | Merged onto the stack (`flex flex-col gap-1.5`); may be a function of the field's state. |

### The parts

| Part | Element | Effect |
| --- | --- | --- |
| `FieldLabel` | `<label>` | The control's name. `variant` takes [Label](https://blamy.github.io/ui/#/label)'s variants: `default`, or `field` for the grouped-form caption. |
| `FieldDescription` | `<p>` | Help text: 13px, muted, announced with the control (or with the set, right inside a `FieldSet`). |
| `FieldError` | `<div>` | The validation message, in the destructive color. `match`: `true`, `false` or a validity flag. Children may be a function of the state (`state.message` is the browser's message). |
| `FieldSet` | `<fieldset>` | Groups fields; `disabled` disables them together. |
| `FieldLegend` | `<legend>` | The set's name: 13px, uppercase, muted. |
| `FieldGroup` | `<div>` | A `gap-3` stack of fields, with no role. |
| `FieldControl` | `<input>` | A native control through `render`, for one the library doesn't ship. |

## Styling

The parts are `data-slot="field"`, `field-label`, `field-description`, `field-error`, `field-set`, `field-legend` and `field-group`. Every part of a field carries the same state attributes — `data-invalid`, `data-valid`, `data-disabled`, `data-required` and `data-focused` — so a label can turn red with its control, and the control gets them too. The `Field` is also a `group`, so `group-data-disabled:` and friends work from anything inside it.
