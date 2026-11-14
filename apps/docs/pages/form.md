# Form

A native `<form>` as a vertical `gap-5` stack. UI SDK has no form component, on purpose: its controls submit under their `name`, validate with the browser's constraints, and each [Field](https://blamy.github.io/ui/#/field) shows its own error. So `Form` is the element itself with the kit's spacing, and everything a field needs — the label, the control, the description, the error, and `FieldSet` for an iOS-style section — comes from [Field](https://blamy.github.io/ui/#/field).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/form.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Form } from '@/components/ui/form'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Form } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## A signup form

Controls that set `required`, `type="email"` and similar constraints block the submit and show in their `FieldError`; the first invalid control takes focus. Give each `Field` (or control) a `name` so its value appears in `FormData`. In this demo the address `taken@example.com` is rejected after submit: the field is marked `invalid` with the server's message, and editing it clears the error.

{% demo src="form/signup" %}

```tsx
<Form onSubmit={save}>
  <FieldSet>
    <FieldLegend>Account</FieldLegend>
    <Field name="email" invalid={taken ? true : undefined}>
      <FieldLabel variant="field">Email</FieldLabel>
      <Input type="email" required onValueChange={() => setTaken('')} />
      <FieldError>{(state) => taken || state.message}</FieldError>
    </Field>
  </FieldSet>
  <FieldSet>
    <FieldLegend>Preferences</FieldLegend>
    <Label variant="control"><Checkbox name="terms" required />I agree to the Terms</Label>
    <FieldDescription>You can change these later in Settings.</FieldDescription>
  </FieldSet>
  <Button type="submit" size="pill">Create account</Button>
</Form>
```

In `onSubmit` call `e.preventDefault()` (the native submit would reload the page) and read the values from `new FormData(e.currentTarget)`. Without a handler the form submits through its `action`, which can be a React server action.

## Validation timing

| When | How |
| --- | --- |
| On submit | The default. The browser checks each control's constraints; a `FieldError` in the field replaces the browser's bubble with the message in the page. |
| After that | The error follows the value as it is edited, and goes when the value is valid. |
| Live, or from your server | Pass `invalid` to the `Field` and the message to its `FieldError`; return `invalid` to `undefined` when it clears. |
| Reset | A `type="reset"` button restores every control's default and hides the errors; a controlled control hears it through its change callback with the reason `reset`. |

## Accessibility

It is a `<form>`, so Enter in a text field submits it, and the first invalid control takes focus after a failed submit. Name it with `aria-label` or `aria-labelledby` to make it a `form` landmark. Each `FieldSet` is a `<fieldset>` and its `FieldLegend` a `<legend>`, which a screen reader announces as the group name when focus enters it. Fields keep their own labels; a form control without one is still unnamed.

## Props

`Form` takes the props of a `<form>`:

| Prop | Default | Effect |
| --- | --- | --- |
| `onSubmit` / `onReset` / `onInvalid` | — | Native form events. |
| `action` | — | Where to submit without a handler; a URL or a server action. |
| `noValidate` | `false` | Skip the browser's constraint validation and validate yourself. |
| `className` | — | Merged onto the stack (`flex flex-col gap-5`). |

## Styling

`data-slot="form"`. Sections are `FieldSet`s: `data-slot="field-set"` resets the fieldset's border, margin and padding, so the spacing comes from the `gap` utilities; override them with `className`.
