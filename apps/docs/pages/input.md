# Input

The filled iOS text input: UI SDK's `Input`, a native `<input>` with a 44px default height, a soft filled background that turns into a primary ring on focus, and red and dimmed states for invalid and disabled. `Input` is only the control. To get a visible label, a description and validation messages, put it inside a [Field](https://blamy.github.io/ui/#/field); for several lines use [Textarea](https://blamy.github.io/ui/#/textarea); for a query with a clear button use [SearchField](https://blamy.github.io/ui/#/search-field).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/input.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Input, createInputController } from '@/components/ui/input'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Input, createInputController } from '@brett_lamy/ui'
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

## Value

Pass `defaultValue` to start with some text, or `value` and `onValueChange(value, details)` to control it. `details.reason` says why it changed (`input-change` for typing, `clear-press`, `reset` when the form resets, `imperative` for a controller), and `details.cancel()` rejects the change, which keeps the previous text and caret. The native `onChange` still works.

```tsx
const [code, setCode] = useState('')

<Input
  aria-label="Code"
  inputMode="numeric"
  maxLength={6}
  value={code}
  onValueChange={(value, details) => {
    if (/^\d*$/.test(value)) setCode(value)
    else details.cancel()
  }}
/>
```

To write an input from somewhere else, give it a controller. Its writes go through the same `onValueChange`.

```tsx
const [message] = useState(createInputController)

<Input controller={message} aria-label="Message" />
<Button onClick={() => message.setValue('On my way!')}>Quick reply</Button>
<Button onClick={() => message.focus()}>Focus</Button>
```

## Input or Field

| | `Input` alone | `Input` in a `Field` |
| --- | --- | --- |
| Label | none — pass `aria-label` | `FieldLabel`, linked by id |
| Description and error | none | `FieldDescription`, `FieldError`, announced with the control |
| Invalid | `aria-invalid` | native constraints on the input (`required`, `type`, `pattern`) after a submit, or `invalid` on the Field |
| Disabled | `disabled` | `disabled` on the input, or on the Field |
| Name | `name` | `name` on the input, or on the Field |
| Value | `value` / `onValueChange` | the same, still on the input |

A `Field` hands the control its ids, name and validity; `Input` picks those up automatically, so the same `Input` works in both places and always owns its value. Use the bare form for a toolbar filter or a cell inside something that already labels it, and the wrapped one for anything in a form.

## States

Focus replaces the fill with a 1.5px primary ring. The invalid ring is red and follows `aria-invalid`, which a `Field` writes on its control and a bare `Input` takes as a prop. A disabled input is dimmed with a not-allowed cursor. A read-only input looks like a normal one but cannot be edited.

{% demo src="input/states" %}

```tsx
<Input aria-label="Handle" aria-invalid={handle.length < 3 || undefined} />
<Input aria-label="Plan" disabled />
<Input aria-label="Invite code" readOnly />
```

## Accessibility

An input needs a name. Inside a `Field`, the `FieldLabel` provides it; on its own, pass `aria-label` or `aria-labelledby`. Set `type` (`email`, `tel`, `url`, `password`) and `autoComplete` so browsers and password managers offer the right keyboard and suggestions. Do not use the placeholder as the label: it is tertiary-colored and disappears as soon as someone types.

## Props

`Input` accepts everything UI SDK's `Input` does (every native `<input>` attribute, `render`, `className` and `style` as values or functions of its state), except the native `size` attribute, which is replaced by:

| Prop | Default | Effect |
| --- | --- | --- |
| `size` | `default` | `sm` 32px · `default` 44px · `lg` 50px. |
| `value` / `defaultValue` | — | Controlled or starting text. A form reset returns to `defaultValue`. |
| `onValueChange` | — | `(value, details)`; `details` has `reason`, `source`, `event` and `cancel()`. |
| `controller` | — | From `createInputController()`: `getValue()`, `setValue(value)`, `clear()`, `focus()`. |
| `disabled` / `readOnly` / `required` | `false` | The native attributes; they also set `data-disabled`, `data-readonly` and `data-required`. |
| `className` | — | Merged last; may be a function of the input's state (`filled`, `disabled`, `readOnly`, `required`). |
| `ref` | — | The underlying `<input>`, for selection (`select()`, `setSelectionRange`) and programmatic focus. |

## Styling

The root is `<input data-slot="input">`. It carries UI SDK's state attributes — `data-filled`, `data-disabled`, `data-readonly`, `data-required` — and, inside a `Field`, the field's `data-invalid`, `data-valid` and `data-focused`. The recipe styles focus from the native `:focus`, invalid from `aria-invalid` and disabled from `data-disabled`. Text is selectable (`select-text`), so it stays selectable inside gesture-driven surfaces. `inputVariants({ size })` returns the class list for borrowing the look.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `inputVariants`

Defined in `@/components/ui/input`. Base classes:

```text
[ 'box-border w-full min-w-0 rounded-ctl border-0 bg-input px-3 [font-family:inherit] text-foreground outline-none', 'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy placeholder:text-tertiary-foreground', 'focus:bg-transparent focus:shadow-[inset_0_0_0_1.5px_var(--primary)]', 'aria-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] data-disabled:cursor-not-allowed data-disabled:opacity-50', selectableText, ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 text-subhead` |
| `default` (default) | `h-11 text-body` |
| `lg` | `h-[50px] rounded-xl text-body` |
