# Input

The filled iOS text input: UI SDK's `Input`, a native `<input>` with a 44px default height, a soft filled background that turns into a primary ring on focus, and red and dimmed states for invalid and disabled. `Input` is only the control. To get a visible label, a description and validation messages, put it inside a [Field](https://blamy.github.io/ui/#/field); for several lines use [Textarea](https://blamy.github.io/ui/#/textarea); for a query with a clear button use [SearchInput](https://blamy.github.io/ui/#/search-input).

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

`size` sets the height and type size: `sm` is 32px, `default` 44px and `lg` 50px with larger corners. Text fields are taller than buttons on purpose (buttons are 32 / 36 / 44): iOS gives a field the 44px touch height. To line a field up with a button in one row, pair `Input size="sm"` with `Button size="sm"` (both 32px), or a default Input with `Button size="lg"` (both 44px).

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

The root is `<input data-slot="input">`. It carries UI SDK's state attributes — `data-filled`, `data-disabled`, `data-readonly`, `data-required` — and, inside a `Field`, the field's `data-invalid`, `data-valid` and `data-focused`. The recipe styles focus from `:focus-within` (the input itself), invalid from `aria-invalid` and disabled from `data-disabled`. Text is selectable (`select-text`), so it stays selectable inside gesture-driven surfaces. `inputVariants({ size })` returns the class list for borrowing the look.

### The field surface

`fieldSurfaceVariants({ size })` is the filled box on its own: the `bg-input` fill, the control radius, the 32 / 44 / 50 heights, the inset primary ring while anything inside has focus, the destructive ring while invalid (`aria-invalid` on a control, `data-invalid` on a group), and the disabled dim. Every text-shaped control in the kit draws it — Input, [Textarea](https://blamy.github.io/ui/#/textarea) (with a minimum height in place of a fixed one), the [Filter](https://blamy.github.io/ui/#/filter) value editors, the date and color inputs and the select and combobox triggers — so a theme change to one reaches all of them. Put it on a group that holds a control to build your own field:

```tsx
import { fieldSurfaceVariants } from '@/components/ui/input'

<div className={fieldSurfaceVariants({ size: 'sm' })}>
  <Icon name="link" size={14} />
  <input aria-label="URL" className="min-w-0 flex-1 bg-transparent outline-none" />
</div>
```

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
