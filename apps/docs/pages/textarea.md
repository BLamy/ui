# Textarea

The multi-line sibling of [Input](https://blamy.github.io/ui/#/input), on react-aria's `TextArea`: same filled surface, same primary focus ring, red invalid and dimmed disabled states, taller and with a 22px line height. It is only the control; wrap it in a [TextField](https://blamy.github.io/ui/#/text-field) for a label, a description and validation.

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

`size` sets the minimum height: `sm` 64px (and a slightly smaller type size), `default` 96px, `lg` 144px. The box does not resize by hand (`resize-none`) and does not grow with its content; text past the height scrolls.

{% demo src="textarea/sizes" %}

```tsx
<Textarea size="sm" aria-label="Note" placeholder="Quick note" />
<Textarea aria-label="Commit message" />
<Textarea size="lg" aria-label="Notes" disabled />
```

## In a TextField

As with `Input`, the label, description and validation come from the wrapper. This example adds a character counter as plain state and marks the field invalid (`isInvalid`) when it goes past the limit.

{% demo src="textarea/counter" %}

```tsx
<TextField value={bio} onChange={setBio} isInvalid={bio.length > 140}>
  <Label variant="field">Bio</Label>
  <Textarea size="sm" />
  <FieldDescription>Shown on your public profile.</FieldDescription>
</TextField>
```

For a hard limit, `maxLength` on the `TextField` stops typing instead.

## Accessibility

Name it like any field: a `Label` inside a `TextField`, or `aria-label` when used bare. A bare `Textarea` is invalid through `aria-invalid` and disabled through `disabled`; inside a `TextField` use `isInvalid` and `isDisabled`. Enter inserts a newline, so submit with a button rather than relying on Enter.

## Props

`Textarea` accepts every react-aria `TextArea` prop (native `<textarea>` attributes such as `rows` and `placeholder`, `className` as a string or function, `style`) and:

| Prop | Default | Effect |
| --- | --- | --- |
| `size` | `default` | `sm` min-height 64px · `default` 96px · `lg` 144px. |
| `className` | — | Merged last. |

## Styling

The root is `<textarea data-slot="textarea">` with react-aria's `data-focused`, `data-hovered`, `data-invalid` and `data-disabled`. `textareaVariants({ size })` returns the class list.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `textareaVariants`

Defined in `@/components/ui/textarea`. Base classes:

```text
[ 'box-border block w-full min-w-0 resize-none rounded-ctl border-0 bg-input px-3 py-2.5 [font-family:inherit] text-body leading-[22px] text-foreground outline-none', 'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy placeholder:text-tertiary-foreground', 'data-focused:bg-transparent data-focused:shadow-[inset_0_0_0_1.5px_var(--primary)]', 'data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] data-disabled:cursor-not-allowed data-disabled:opacity-50', selectableText, ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `min-h-24` |
| `sm` | `min-h-16 text-subhead leading-[20px]` |
| `lg` | `min-h-36` |
