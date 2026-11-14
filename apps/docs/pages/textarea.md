# Textarea

The multi-line sibling of [Input](https://blamy.github.io/ui/#/input), on UI SDK's `Textarea`: a native `<textarea>` with the same filled surface, the same primary focus ring, red invalid and dimmed disabled states, taller and with a 22px line height. It is only the control; wrap it in a [Field](https://blamy.github.io/ui/#/field) for a label, a description and validation.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/textarea.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Textarea } from '@/components/ui/textarea'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Textarea } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Sizes

`size` sets the minimum height: `sm` 64px (and a slightly smaller type size), `default` 96px, `lg` 144px. The box does not resize by hand (`resize-none`); text past the height scrolls, unless `autoResize` lets it grow.

{% demo src="textarea/sizes" %}

```tsx
<Textarea size="sm" aria-label="Note" placeholder="Quick note" />
<Textarea aria-label="Commit message" />
<Textarea size="lg" aria-label="Notes" disabled />
```

## In a Field

As with `Input`, the label, description and validation come from the wrapper, and the value stays on the control. This example adds a character counter as plain state and marks the field `invalid` when it goes past the limit.

{% demo src="textarea/counter" %}

```tsx
<Field name="bio" invalid={bio.length > 140 ? true : undefined}>
  <FieldLabel>Bio</FieldLabel>
  <Textarea size="sm" value={bio} onValueChange={setBio} />
  <FieldDescription>Shown on your public profile.</FieldDescription>
</Field>
```

For a hard limit, `maxLength` on the `Textarea` stops typing instead.

## Growing with the text

`autoResize` grows and shrinks the box with its text. Its CSS `min-height` (the `size`) and `max-height` bound it; past the maximum the text scrolls inside.

```tsx
<Textarea autoResize size="sm" className="max-h-48" aria-label="Notes" />
```

## Submitting from the keyboard

Enter starts a new line. `submitShortcut` adds a key that submits the form the textarea is in: `"mod+enter"` (⌘ Enter, or Ctrl Enter off Apple platforms) keeps Enter for new lines, and `"enter"` submits on Enter with Shift Enter for a new line. Pass `onSubmit(value)` to handle it yourself instead of submitting the form.

```tsx
<Textarea aria-label="Message" submitShortcut="mod+enter" onSubmit={(text) => send(text)} />
```

## Accessibility

Name it like any field: a `FieldLabel` inside a `Field`, or `aria-label` when used bare. A bare `Textarea` is invalid through `aria-invalid` and disabled through `disabled`; inside a `Field` use the field's `invalid` and `disabled`. Enter inserts a newline, so submit with a button, or say which key submits with `submitShortcut`.

## Props

`Textarea` accepts every UI SDK `Textarea` prop (every native `<textarea>` attribute such as `rows` and `placeholder`, `render`, `className` and `style` as values or functions of its state) and:

| Prop | Default | Effect |
| --- | --- | --- |
| `size` | `default` | `sm` min-height 64px · `default` 96px · `lg` 144px. |
| `value` / `defaultValue` | — | Controlled or starting text. A form reset returns to `defaultValue`. |
| `onValueChange` | — | `(value, details)`, as on [Input](https://blamy.github.io/ui/#/input): `details.reason`, `details.cancel()`. |
| `controller` | — | From `createInputController()` (exported by Input): `getValue()`, `setValue(value)`, `clear()`, `focus()`. |
| `autoResize` | `false` | Grow and shrink with the text, between the CSS `min-height` and `max-height`. |
| `submitShortcut` | — | `"enter"` or `"mod+enter"`: the key that submits. |
| `onSubmit` | — | `(value, details)` on the shortcut, instead of submitting the form. |
| `className` | — | Merged last. |

## Styling

The root is `<textarea data-slot="textarea">` with UI SDK's `data-filled`, `data-disabled`, `data-readonly` and `data-required`, plus the field's `data-invalid`, `data-valid` and `data-focused` inside a `Field`. The box is Input's shared field surface, `fieldSurfaceVariants({ size })` (fill, radius, focus and invalid rings, disabled dim), with a minimum height in place of a fixed one; `textareaVariants({ size })` adds the multi-line parts (the minimum height, padding, line height). Focus is styled from `:focus-within` and invalid from `aria-invalid`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `textareaVariants`

Defined in `@/components/ui/textarea`. Base classes:

```text
['block h-auto w-full resize-none py-2.5 leading-[22px] placeholder:text-tertiary-foreground', selectableText]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `min-h-16 text-subhead leading-[20px]` |
| `default` (default) | `min-h-24 text-body` |
| `lg` | `min-h-36 text-body` |
