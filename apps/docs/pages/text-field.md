# TextField

The wrapper that makes a text control a proper form field. `TextField` is react-aria's `TextField`: it links a `Label`, an [Input](https://blamy.github.io/ui/#/input) or [Textarea](https://blamy.github.io/ui/#/textarea), a `FieldDescription` and a `FieldError` by id, owns the value, and runs validation. `Input` alone is just the styled control. Reach for `TextField` whenever the field has a visible label, help text or an error message, or sits in a [Form](https://blamy.github.io/ui/#/form).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/text-field.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  TextField, FieldDescription, FieldError,
} from '@/components/ui/text-field'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { TextField, FieldDescription, FieldError } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Anatomy

```tsx
<TextField type="email" isRequired>
  <Label variant="field">Email</Label>
  <Input />
  <FieldDescription>We never share it.</FieldDescription>
  <FieldError />
</TextField>
```

Stack the pieces in that order. `Label variant="field"` is the small grouped-form caption; the default variant is a larger `subhead` label. `FieldError` renders nothing until the field is invalid; with no children it shows the validation message, and you can pass your own children to override it.

{% demo src="text-field/anatomy" %}

## Validation

Set `isRequired`, `type`, `minLength`, `pattern` for native constraints, or `validate` for your own rule: return a string (or array of strings) for an invalid value, `null` for a valid one.

When errors appear depends on `validationBehavior`:

| Value | Shows errors |
| --- | --- |
| `native` (default) | After the enclosing `Form` is submitted, using the browser's constraint messages. |
| `aria` | Live, as the user types, from `validate` and the constraint props. |

Native `type` and `pattern` checks run only in native mode, so in an `aria` field express the rule in `validate`. `isInvalid` forces the invalid state from outside (for example a server error or a character limit).

{% demo src="text-field/validation" %}

## Accessibility

react-aria connects the label (`aria-labelledby`), the description and the error (`aria-describedby`), so a screen reader reads them with the field, and it sets `aria-invalid` and `aria-required`. Every field still needs a name: a `Label`, or `aria-label` when the design hides it.

## Props

### TextField

Every react-aria `TextField` prop applies; the ones you will use most:

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onChange` | — | Controlled or uncontrolled string; `onChange` receives the string. |
| `name`, `type`, `autoComplete` | — | Form name and input attributes. |
| `isRequired` / `isDisabled` / `isReadOnly` | `false` | Constraint and state flags, forwarded to the control. |
| `isInvalid` | — | Force the invalid state. |
| `validate` | — | Returns an error message, array of messages or `null`. |
| `validationBehavior` | `native` | `native` or `aria` (see Validation). |
| `className` | — | Merged onto the wrapper; may be a function of the render state. |

### FieldDescription and FieldError

| Part | Effect |
| --- | --- |
| `FieldDescription` | A `Text` in react-aria's `description` slot: 13px, muted, announced with the field. |
| `FieldError` | The validation message in destructive color; react-aria `FieldError` props (`children` as a node or a function of the validation result). |

## Styling

The wrapper is `data-slot="text-field"`, a `group flex flex-col gap-1.5`; the description is `data-slot="field-description"` and the error `data-slot="field-error"`. The group carries react-aria's `data-invalid`, `data-disabled` and `data-required`, which `Label` uses to dim itself when the field is disabled.
