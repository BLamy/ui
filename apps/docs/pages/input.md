# Input

The filled iOS text input: react-aria's `Input` with a 44px default height, a soft filled background that turns into a primary ring on focus, and red and dimmed states for invalid and disabled. `Input` is only the control. To get a visible label, a description and validation messages, put it inside a [TextField](https://blamy.github.io/ui/#/text-field); for several lines use [Textarea](https://blamy.github.io/ui/#/textarea); for a query with a clear button use [SearchField](https://blamy.github.io/ui/#/search-field).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/input.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Input } from '@/components/ui/input'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Input } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Sizes

`size` sets the height and type size: `sm` is 32px, `default` 44px and `lg` 50px with larger corners.

{% demo src="input/sizes" %}

```tsx
<Input size="sm" aria-label="Filter by tag" placeholder="Filter by tag" />
<Input aria-label="Project name" />
<Input size="lg" type="email" aria-label="Email" />
```

## Input or TextField

| | `Input` alone | `Input` in a `TextField` |
| --- | --- | --- |
| Label | none — pass `aria-label` | `Label`, linked by id |
| Description and error | none | `FieldDescription`, `FieldError`, announced with the field |
| Invalid | `aria-invalid` | `isInvalid`, `validate`, `isRequired`, `type` and the enclosing Form |
| Disabled | `disabled` | `isDisabled` on the TextField |
| Value | native `value` / `onChange(event)` | `value` / `onChange(string)` on the TextField |

`TextField` wraps react-aria's `TextField`, which hands the control its ids, state and validity through context; `Input` picks those up automatically, so the same `Input` works in both places. Use the bare form for a toolbar filter or a cell inside something that already labels it, and the wrapped one for anything in a form.

## States

Focus replaces the fill with a 1.5px primary ring. The invalid ring is red and is driven by react-aria's `data-invalid`, which a bare `Input` gets from `aria-invalid`. A disabled input is dimmed with a not-allowed cursor. A read-only input looks like a normal one but cannot be edited.

{% demo src="input/states" %}

```tsx
<Input aria-label="Handle" aria-invalid={handle.length < 3 || undefined} />
<Input aria-label="Plan" disabled />
<Input aria-label="Invite code" readOnly />
```

## Accessibility

An input needs a name. Inside a `TextField`, the `Label` provides it; on its own, pass `aria-label` or `aria-labelledby`. Set `type` (`email`, `tel`, `url`, `password`) and `autoComplete` so browsers and password managers offer the right keyboard and suggestions. Do not use the placeholder as the label: it is tertiary-colored and disappears as soon as someone types.

## Props

`Input` accepts everything react-aria's `Input` does (native `<input>` attributes, `className` as a string or a function of the render state, `style`), except the native `size` attribute, which is replaced by:

| Prop | Default | Effect |
| --- | --- | --- |
| `size` | `default` | `sm` 32px · `default` 44px · `lg` 50px. |
| `className` | — | Merged last; may be a function of the render state. |

## Styling

The root is `<input data-slot="input">`. It carries react-aria's state attributes — `data-focused`, `data-focus-visible`, `data-hovered`, `data-invalid`, `data-disabled` — and the recipe styles focus, invalid and disabled from them. Text is selectable (`select-text`), so it stays selectable inside gesture-driven surfaces. `inputVariants({ size })` returns the class list for borrowing the look.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `inputVariants`

Defined in `@/components/ui/input`. Base classes:

```text
[ 'box-border w-full min-w-0 rounded-ctl border-0 bg-input px-3 [font-family:inherit] text-foreground outline-none', 'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy placeholder:text-tertiary-foreground', 'data-focused:bg-transparent data-focused:shadow-[inset_0_0_0_1.5px_var(--primary)]', 'data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] data-disabled:cursor-not-allowed data-disabled:opacity-50', selectableText, ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 text-subhead` |
| `default` (default) | `h-11 text-body` |
| `lg` | `h-[50px] rounded-xl text-body` |
