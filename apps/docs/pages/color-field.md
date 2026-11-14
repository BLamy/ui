# ColorField

A text field that reads a color: type `#7f5af0`, `rebeccapurple`, `hsl(262 83% 66%)` or `oklch(0.62 0.19 293)` and the field holds that color, beside a swatch of what it understood. It is UI SDK's `ColorPicker` with only its typed parts, drawn as the kit's filled field: `ColorField` holds the color, `ColorFieldInput` reads any CSS color, `ColorFieldChannelInput` edits one channel as a number, and `ColorFieldSwatch` shows the result. `ColorSwatch` is the chip on its own. Use a ColorField when people know the value; reach for [ColorPicker](https://blamy.github.io/ui/#/color-picker) when they need to see and drag through the colors.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/color-field.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  ColorField, ColorFieldGroup, ColorFieldInput, ColorFieldSwatch,
} from '@/components/ui/color-field'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  ColorField, ColorFieldGroup, ColorFieldInput, ColorFieldSwatch,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Values are CSS color strings

`value`, `defaultValue` and `onValueChange` carry a CSS color string, as UI SDK's `ColorPicker` writes it: hex by default (`#7f5af0`, eight digits once the opacity is below 1), or the `format` you ask for (`"hsl"`, `"srgb"`, `"oklch"`…). A value you pass is kept as you wrote it until someone edits it. There is no color object to build. When you need the channels, another format or a contrast ratio, read the string with `parseColor` from `@ui-sdk/core/color` (the library's UI SDK dependency, nothing extra to install), or take `details.color`, the same color as data, from the change:

```tsx
import { formatColor, parseColor } from '@ui-sdk/core/color'

const [accent, setAccent] = useState('#7f5af0')

<ColorField
  value={accent}
  onValueChange={(value, details) => {
    setAccent(value) // '#663399'
    details.reason // 'input-commit'
    formatColor(details.color, 'hsl') // 'hsl(270 50% 40%)'
  }}
/>

const color = parseColor(accent) // { space: 'srgb', coords: [0.4, 0.2, 0.6], alpha: 1 }, or null for text that is no color
```

`onValueChange` runs when the color changes and `details.cancel()` refuses the change; `onValueCommit` runs once an edit ends, which is the moment to save. A field always holds a color: without a `defaultValue` it starts at black, and there is no empty value.

## Anatomy

`ColorField` is both the root that holds the color and the filled field around its parts. With no children it renders a swatch and an input, so one line is the whole control. Put it in a [Field](https://blamy.github.io/ui/#/field) for its label, description and error.

```tsx
<Field>
  <FieldLabel variant="field">Accent</FieldLabel>
  <ColorField defaultValue="#7f5af0" />
  <FieldDescription>Any CSS color.</FieldDescription>
  <FieldError />
</Field>
```

Pass children to choose the parts yourself:

```tsx
<ColorField defaultValue="#7f5af0">
  <ColorFieldSwatch />
  <ColorFieldInput placeholder="#RRGGBB" />
</ColorField>
```

Leave the swatch out for a plain text field. Outside a `Field`, name the field with `aria-label`.

## Typing a color

The text is edited freely, and the value changes when Enter is pressed or the input loses focus: text that is a CSS color is read and rewritten in the field's `format` (`rebeccapurple` becomes `#663399`); anything else, an empty box included, goes back to the value. Escape puts the text back at once. A hex needs its `#`. The swatch follows the value. Show an error your code decides with `invalid` on the `Field` and a `<FieldError match>`: the field's outline turns red. `required` only marks the field (`data-required`), since it always has a value.

{% demo src="color-field/basic" %}

## One channel

`ColorFieldChannelInput` is a number box for one `channel` of the color, in the units people read it in: degrees for `hue`, a percentage for `saturation`, `lightness`, `brightness` and `alpha`, 0 to 255 for `red`, `green` and `blue`. The channels come from the root's `space`: `"hsv"` (the default) has hue, saturation and brightness, `"hsl"` hue, saturation and lightness, `"srgb"` red, green and blue, `"oklch"` lightness, chroma and hue; `alpha` is in all of them. Enter, leaving the box or its arrow keys set the channel.

Several boxes under one root edit the same color. When that root is a `ColorPicker`, draw each box with `ColorFieldGroup`, the same filled field without a root of its own, so three of them make an HSL editor:

{% demo src="color-field/channel" %}

`ColorFieldGroup` is also how a text field goes inside a [ColorPicker](https://blamy.github.io/ui/#/color-picker), beside its area and sliders: the picker holds the color, and a second `ColorField` there would hold a color of its own.

## Swatches

`ColorSwatch` paints any CSS color string. It is a 24px circle by default; size and shape it with `className` (`size-8`, `rounded-lg`). A translucent color shows the surface behind it. It is an image to assistive technology, named by its CSS value unless you give it an `aria-label`, so name the swatches people have to tell apart. Inside a field or a picker use `ColorFieldSwatch`, which follows the color being edited and is named from it ("vivid blue", "vivid purple, 60% opaque").

{% demo src="color-field/swatches" %}

## Accessibility

The field is a `group` named by its `Field`'s label (or `aria-label`), with the description and error linked to it; pressing the label focuses the input. The input inside is a text box named "Color", and a channel box is a number input named after its channel ("Hue"): pass `aria-label` to name either in another language, or point a `Label` at the input's `id`. The swatch beside it is an image with a spoken color name, but the input is the control: keep it visible. The focus ring and the invalid outline sit on the field.

| Key | Action |
| --- | --- |
| Type | Edit the text. Nothing changes until it is read. |
| Enter | Read the text: a CSS color becomes the value, anything else goes back. |
| Escape | Put the text back to the value. |
| Tab or blur | Read the text, as Enter does. |
| Arrow Up / Down | In a channel box, step the channel. |

## Props

### ColorField

UI SDK's `ColorPicker` root, a `<div>` with the `group` role: every prop of it applies, and `className` (a string or a function of its state) merges onto the filled field.

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` | black | The color, as a CSS color string. |
| `onValueChange` | — | `(value, details)` when the color changes: `details.reason`, `details.color` (the color as data), `details.cancel()`. |
| `onValueCommit` | — | `(value, details)` once an edit ends. |
| `size` | `default` | `sm` 32px · `default` 44px · `lg` 50px. |
| `space` | `hsv` | The channels a `ColorFieldChannelInput` can edit: `hsv`, `hsl`, `srgb` or `oklch`. |
| `format` | hex, or the `space` | How the value is written: `hex`, `srgb`, `hsl`, `oklch`… |
| `gamut` | `srgb` | The colors the value can hold: `srgb`, `p3`, or `false` for any. |
| `disabled` / `readOnly` / `required` | `false` | State. A disabled field submits nothing; a read-only one stays focusable. |
| `name` / `form` | — | Submits the value through a hidden input. |
| `controller` | — | A `createColorPickerController()` (from [ColorPicker](https://blamy.github.io/ui/#/color-picker)) to set the color from outside. |
| `children` | swatch and input | The parts, or a function of the field's state. |
| `aria-label` | — | The field's name when there is no `Field` label. |

### The parts

| Part | Element | Effect |
| --- | --- | --- |
| `ColorFieldInput` | `<input>` | The text box: `placeholder`, `aria-label`, `className`… No fill or outline of its own; the field draws them. |
| `ColorFieldChannelInput` | `<input type="number">` | One `channel` as a number: `hue`, `saturation`, `brightness`, `lightness`, `chroma`, `red`, `green`, `blue` or `alpha`. |
| `ColorFieldSwatch` | `<div>` | A chip of the field's color. Children may be a function of the state. |
| `ColorFieldGroup` | `<div>` | The filled field as a plain box, for parts inside a `ColorPicker`. `size` as on `ColorField`. |
| `ColorSwatch` | `<div>` | A chip of the `color` you give it (any CSS color); `aria-label` names it. |

## Styling

`ColorField` is UI SDK's root, so its slot is `color-picker`; the parts are `color-picker-input`, `color-picker-channel-input` and `color-picker-swatch`, and the kit's own are `color-field-group` and `color-swatch`. The field carries `data-disabled`, `data-readonly`, `data-required`, `data-out-of-gamut` and, from its `Field`, `data-invalid`; it shows a primary ring while the input has focus (`focus-within`) and a destructive ring when `data-invalid`. A `ColorFieldGroup` dims with the picker around it. A swatch has a hairline edge (`shadow-hairline`) and is filled with `--color-picker-color`, which the part writes since the value is only known at runtime.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `colorFieldVariants`

Defined in `@/components/ui/color-field`. Base classes:

```text
[ 'box-border flex w-full min-w-0 items-center gap-2 bg-input px-3 text-foreground outline-none transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy', 'focus-within:bg-transparent focus-within:ring-[1.5px] focus-within:ring-primary focus-within:ring-inset', 'data-invalid:ring-[1.5px] data-invalid:ring-destructive data-invalid:ring-inset data-disabled:cursor-not-allowed data-disabled:opacity-50', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 rounded-lg text-subhead` |
| `default` (default) | `h-11 rounded-ctl text-body` |
| `lg` | `h-[50px] rounded-xl text-body` |
