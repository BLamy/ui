# Forms

How to build a form with the kit. There is no `Form` component, on purpose: UI SDK's controls submit under their `name`, validate with the browser's constraints, and each [Field](https://blamy.github.io/ui/#/field) shows its own error. So a form is a native `<form>` with Fields in it, and the one piece of layout it needs — the fields stacked with the form spacing — is a `FieldGroup` rendered as the form:

```tsx
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'

<FieldGroup className="gap-5" render={<form onSubmit={save} />}>
  <Field name="email">
    <FieldLabel>Email</FieldLabel>
    <Input type="email" required />
    <FieldError />
  </Field>
  <Button type="submit">Save</Button>
</FieldGroup>
```

Everything a field needs — the label, the control, the description, the error, and `FieldSet` for an iOS-style section — comes from [Field](https://blamy.github.io/ui/#/field). The controls that go in one: [Input](https://blamy.github.io/ui/#/input), [Textarea](https://blamy.github.io/ui/#/textarea), [Select](https://blamy.github.io/ui/#/select), [Combobox](https://blamy.github.io/ui/#/combobox), [Checkbox](https://blamy.github.io/ui/#/checkbox), [RadioGroup](https://blamy.github.io/ui/#/radio-group), [Switch](https://blamy.github.io/ui/#/switch), [Slider](https://blamy.github.io/ui/#/slider), the date inputs, [NaturalTimeInput](https://blamy.github.io/ui/#/natural-time-input) and [FileUpload](https://blamy.github.io/ui/#/file-upload).

## A signup form

Controls that set `required`, `type="email"` and similar constraints block the submit and show in their `FieldError`; the first invalid control takes focus. Give each `Field` (or control) a `name` so its value appears in `FormData`. In this demo the address `taken@example.com` is rejected after submit: the field is marked `invalid` with the server's message, and editing it clears the error.

{% demo src="form/signup" %}

```tsx
<FieldGroup className="gap-5" render={<form onSubmit={save} />}>
  <FieldSet>
    <FieldLegend>Account</FieldLegend>
    <Field name="email" invalid={taken ? true : undefined}>
      <FieldLabel>Email</FieldLabel>
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
</FieldGroup>
```

In `onSubmit` call `e.preventDefault()` (the native submit would reload the page) and read the values from `new FormData(e.currentTarget)`. Without a handler the form submits through its `action`, which can be a React server action: `render={<form action={signup} />}`.

## Spacing

`FieldGroup` stacks its children with `gap-3`, the spacing inside a section. A whole form reads better with `gap-5` between its sections, so pass `className="gap-5"`; inside a dialog or a sheet, where the room is tighter, `gap-3.5` or the default is right. The classes go on the `FieldGroup`, the form's own props (`onSubmit`, `action`, `noValidate`, `aria-label`, `id`) on the `<form>` in `render`.

## Validation timing

| When | How |
| --- | --- |
| On submit | The default. The browser checks each control's constraints; a `FieldError` in the field replaces the browser's bubble with the message in the page. |
| After that | The error follows the value as it is edited, and goes when the value is valid. |
| Live, or from your server | Pass `invalid` to the `Field` and the message to its `FieldError`; return `invalid` to `undefined` when it clears. |
| Your own checks | `noValidate` on the form turns the browser's off; mark each `Field` `invalid` yourself (the saas-checkout block does this step by step). |
| Reset | A `type="reset"` button restores every control's default and hides the errors; a controlled control hears it through its change callback with the reason `reset`. |

An error is shown in the foreground color after a red icon, never as red text alone, and the caption, description and legend use the foreground at 70%: both pass WCAG AA on the grouped grey surfaces.

## Accessibility

It is a `<form>`, so Enter in a text field submits it, and the first invalid control takes focus after a failed submit. Name it with `aria-label` or `aria-labelledby` on the `<form>` to make it a `form` landmark. Each `FieldSet` is a `<fieldset>` and its `FieldLegend` a `<legend>`, which a screen reader announces as the group name when focus enters it. Fields keep their own labels; a control without one is still unnamed.
