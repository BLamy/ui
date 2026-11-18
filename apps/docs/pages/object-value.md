# ObjectValue

One value's preview, tinted by its type as DevTools shows it: `"strings"`, `42`, `ƒ formatPrice(amount, currency)`, `Cart {id: "c_81f2", total: 148.5, …}`, `Map(1) {"TEA-01" => 12.5}`. It's for a single value inline: a console line, a hover card, a tooltip, a cell. Long strings and error stacks are cut short, with Show more and Copy beside them. For a value you open level by level (an object's properties, a scope's variables), use [ObjectTree](https://blamy.github.io/ui/#/object-tree), which draws its rows with this; for source code, [CodeEditor](https://blamy.github.io/ui/#/code-editor), whose token colors it shares.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/object-value.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import { ObjectValue } from '@/components/ui/object-value'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { ObjectValue } from '@brett_lamy/ui/object-value'
```
{% endtab %}
{% endtabs %}

## Usage

`value` is a `ValuePreview`: plain data that says what the value is and what to show, so it can come from another process (a debugger protocol, a worker, a server). `previewFromValue(value)` makes one from a live value.

```tsx
<ObjectValue value={{ type: 'string', value: 'hello' }} />
<ObjectValue value={previewFromValue({ a: 1, b: [2, 3] })} />
```

{% demo src="object-value/basic" %}

## Values

| `type` | Fields | Shows |
| --- | --- | --- |
| `string` | `value` | `"hello"`, cut at `maxLength` |
| `number` | `value`, a string for `NaN`, `-0`, `Infinity` | `42` |
| `boolean` | `value` | `true` |
| `null`, `undefined` | | `null` |
| `bigint` | `value` | `12n` |
| `symbol` | `value`, the text to show | `Symbol(id)` |
| `function` | `name`, `params`, `flavor`: `async`, `generator`, `async generator`, `class` | `ƒ add(a, b)` |
| `object` | `className`, `properties`, `overflow` | `Cart {id: "c_81", total: 12, …}` |
| `array` | `className`, `length`, `items`, `overflow` | `(3) [1, 2, 3]` |
| `map` | `className`, `size`, `entries`, `overflow` | `Map(1) {"a" => 1}` |
| `set` | `className`, `size`, `items`, `overflow` | `Set(2) {1, 2}` |
| `date`, `regexp` | `value`, the text to show | `/a+/g` |
| `error` | `name`, `message`, `stack` | `TypeError: nope`, its stack on Show more |
| `accessor` | | `(...)` |
| `entry` | `key`, `value` | `"a" => 1` |
| `unavailable` | `label` | `<unavailable>` |

An object, array, map or set without its contents shows only its name (`Cart`, `Array(3)`), and `overflow` adds an ellipsis when the preview doesn't list everything. Five properties or ten items show, each a word or two. `previewText(value)` gives the same preview as plain text, and `previewTokens(value)` as tinted pieces, for a renderer of your own.

## Console lines and fixed rows

`quote={false}` prints a top-level string bare, as a console does. In a row of fixed height, as ObjectTree's, `actions={false}` leaves out Show more and Copy: the value stays on one line, still cut at `maxLength`, and the row offers the rest another way (ObjectTree opens a popover with all of it).

{% demo src="object-value/console" %}

## Accessibility

The preview is text, read as it shows. Show more and Copy are buttons named by their text; Copy announces "Copied" through UI SDK's shared live region and shows it for a moment, and their hit area reaches past the text without moving the lines. The text can be selected and copied as usual.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | required | A `ValuePreview`. |
| `maxLength` | `100` | Characters of a long string (or stack) to show at first; Show more adds more. |
| `quote` | `true` | `false` for the bare text of a top-level console string. |
| `actions` | `true` | Show more and Copy beside a long string or an error's stack. `false` in a row of fixed height. |
| `onValueCopy` | none | `(text) => void`: writes what Copy gives yourself, instead of `navigator.clipboard` (a host with a clipboard of its own). |

What Copy gives is `copyTextOf(preview)` (from `@/lib/object-tree-value`; on npm, `@brett_lamy/ui/lib/object-tree-value`): a string's own text, an error's stack, otherwise the preview's text. `previewText(preview)` is the preview as plain text and `previewTokens(preview)` the typed runs it is drawn from (`{ text, type }`).
| `className` / `style` | | On the root `span`, merged last; other props pass through. |

## Styling

The root is a `span` with `data-slot="object-value"` and the value's type in `data-type`, in `font-mono text-caption`; set a size or font on it to change both. The tints are CodeEditor's token colors (`bl-tok-string`, `bl-tok-number`…), so a value and the code beside it read alike, and the `--bl-syntax-*` properties retheme both.
