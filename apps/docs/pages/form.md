# Form

The field-layout module: two parts, `Form` and `FormSection`. `Form` is react-aria's `Form` with a vertical `gap-5` stack: a native `<form>` whose react-aria fields (`TextField`, `RadioGroup`, `Checkbox`…) validate against the browser's constraints and show their errors when it is submitted. `FormSection` groups fields under an iOS-style uppercase header, with an optional footnote. There is no field-wrapper component here: the label, control, description and error of one field come from [TextField](https://blamy.github.io/ui/#/text-field) and its siblings.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/form.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Form, FormSection } from '@/components/ui/form'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Form, FormSection } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## A signup form

Fields that set `isRequired`, `type="email"` and similar constraints block the submit and show their `FieldError`. Give fields a `name` so they appear in `FormData`. `validationErrors` maps a server response onto fields by `name`: the error shows on that field, and clears once the user edits the field and leaves it. In this demo the address `taken@example.com` is rejected after submit.

{% demo src="form/signup" %}

```tsx
<Form validationErrors={errors} onSubmit={save}>
  <FormSection title="Account">
    <TextField name="email" type="email" isRequired>
      <Label variant="field">Email</Label>
      <Input />
      <FieldError />
    </TextField>
  </FormSection>
  <FormSection title="Preferences" description="You can change these later in Settings.">
    <Checkbox name="terms" isRequired>I agree to the Terms</Checkbox>
  </FormSection>
  <Button type="submit" size="pill">Create account</Button>
</Form>
```

In `onSubmit` call `e.preventDefault()` (the native submit would reload the page) and read the values from `new FormData(e.currentTarget)`.

## Validation timing

`validationBehavior` decides when errors show, and fields inherit it from the `Form`:

| Value | Behavior |
| --- | --- |
| `native` (default) | Errors show when the form is submitted, using the browser's messages; the first invalid field takes focus. |
| `aria` | Errors show live as the user edits, from each field's `validate` and constraint props. |

## Accessibility

It renders a `<form>`, so Enter in a text field submits it, and react-aria focuses the first invalid field after a failed submit. Each section is a `<fieldset>` and its title a `<legend>`, which a screen reader announces as the group name when focus enters it. Fields keep their own labels; a form control without one is still unnamed.

## Props

### Form

Every react-aria `Form` prop applies:

| Prop | Default | Effect |
| --- | --- | --- |
| `validationBehavior` | `native` | `native` or `aria` (see above). |
| `validationErrors` | — | Object of field `name` to message (or messages). |
| `onSubmit` / `onReset` / `onInvalid` | — | Native form events. |
| `className` | — | Merged onto the stack (`flex flex-col gap-5`). |

### FormSection

Takes the props of a `<fieldset>` (except `title`), plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `title` | — | Legend: 13px, uppercase, muted. |
| `description` | — | Footnote under the section's fields. |
| `className` | — | Merged onto the `gap-3` stack. |

## Styling

`data-slot="form"` and `data-slot="form-section"`. `FormSection` resets the fieldset's border, margin and padding, so the spacing comes from the `gap` utilities; override them with `className`.
