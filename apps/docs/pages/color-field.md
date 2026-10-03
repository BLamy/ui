# ColorField

A text field that reads a color: type `#7f5af0`, `7f5af0` or `0a84ff` and the field holds a real color value, with an optional swatch of what it understood. Give it a `channel` and it becomes a number box for one channel of the color (hue, saturation, red, alpha…). `ColorSwatch` is the chip itself, painted over a checkerboard so transparency shows. They are react-aria's `ColorField` and `ColorSwatch` in the iOS filled-field style. Use a ColorField when people know the value; reach for [ColorPicker](https://blamy.github.io/ui/#/color-picker) when they need to see and drag through the colors.

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

## Values are colors, not strings

`value`, `defaultValue` and `onChange` use react-aria's `Color`. Pass a CSS color string (`'#7f5af0'`, `'hsl(262, 83%, 66%)'`) or a `parseColor()` object, and read the result with `color.toString('hex')`, `'hexa'`, `'hsl'`, `'hsb'` or `'css'`, or a channel with `color.getChannelValue('hue')`. `onChange` receives a `Color`, or `null` when the field is empty. `parseColor` and `Color` are exported by `react-aria-components`; there is nothing extra to install.

## Anatomy

A `ColorField` is a column holding a label, the field and any help or error text. The filled field is a `ColorFieldGroup` holding an optional `ColorFieldSwatch` and the `ColorFieldInput`.

```tsx
<ColorField defaultValue="#7f5af0">
  <Label variant="field">Accent</Label>
  <ColorFieldGroup>
    <ColorFieldSwatch />
    <ColorFieldInput />
  </ColorFieldGroup>
  <FieldDescription>A hex color, with or without the #.</FieldDescription>
  <FieldError />
</ColorField>
```

Without a swatch, the library's plain [Input](https://blamy.github.io/ui/#/input) does the same job: `<ColorField><Label variant="field">Accent</Label><Input /></ColorField>`. Import `Label` from [Label](https://blamy.github.io/ui/#/label), and `FieldDescription` and `FieldError` from [TextField](https://blamy.github.io/ui/#/text-field).

## A hex field

The text is edited freely, and the value changes when the field loses focus: a complete, valid color is committed (and reformatted, `0a84ff` becomes `#0A84FF`); anything else reverts to the last color. Characters that cannot be part of a hex color are not accepted. The swatch follows the committed color, and is clear while the field is empty. ArrowUp and ArrowDown step the color's value as a number, Home and End jump to black and white, and scrolling the wheel steps it while the field has focus. `isInvalid` or a failing `validate` turns the outline red and shows the `FieldError`.

{% demo src="color-field/basic" %}

## One channel

`channel` makes the field edit a single channel in the `colorSpace` you name: `hue`, `saturation`, `lightness` in `hsl`; `hue`, `saturation`, `brightness` in `hsb`; `red`, `green`, `blue` in `rgb`; and `alpha` in any. It shows that channel's number, which the arrow keys step. Several fields sharing one `value` stay in sync, so three of them make an HSL editor.

{% demo src="color-field/channel" %}

## Swatches

`ColorSwatch` paints a CSS color string or a `Color` over a two-tone checkerboard, so a translucent color reads as translucent. It is a 24px circle by default; size and shape it with `className` (`size-8`, `rounded-lg`). It is an image to assistive technology, named from the color as react-aria describes it (a name such as "vibrant blue", plus the transparency when there is any); `colorName` replaces the color's part of that name and `aria-label` adds to it. Inside a [ColorPicker](https://blamy.github.io/ui/#/color-picker) a `ColorSwatch` with no `color` shows the picker's color.

{% demo src="color-field/swatches" %}

## Accessibility

The input is a text box named by the field's `Label` (or `aria-label`), with the description and error linked to it; it is not a spin button to assistive technology, but the arrow keys do step it. Focus ring and invalid outline sit on the group. The swatch beside it is an image with a spoken color name, but the input is the control: keep it visible.

| Key | Action |
| --- | --- |
| Type | Edit the text. Only characters that can occur in the color are accepted. |
| Arrow Up / Down | Step the color (or the channel, with `channel`) up / down. |
| Home / End | Lowest / highest value. |
| Tab or blur | Commit the text; an invalid text reverts. |

## Props

### ColorField

The root is react-aria's `ColorField`; every prop passes through, with `className` (a string or a function) merged onto `group flex flex-col gap-1.5`.

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onChange` | — | The `Color` (or a CSS string); `null` when empty. |
| `channel` | — | Edit one channel instead of the whole color: `hue`, `saturation`, `brightness`, `lightness`, `red`, `green`, `blue`, `alpha`. |
| `colorSpace` | the color's | `rgb`, `hsl` or `hsb`: the model a `channel` is read in. |
| `isDisabled` / `isReadOnly` / `isRequired` / `isInvalid` | `false` | State. |
| `isWheelDisabled` | `false` | Ignore the mouse wheel. |
| `validate` / `validationBehavior` | `native` | Custom validation, and when its errors show. |
| `name` | — | Form field name. |
| `aria-label` | — | The field's name when there is no `Label`. |

### ColorFieldGroup, ColorFieldInput and the swatches

| Prop | Default | Effect |
| --- | --- | --- |
| `ColorFieldGroup` `size` | `default` | `sm` 32px · `default` 44px · `lg` 50px. Other props go to react-aria's `Group`. |
| `ColorFieldInput` | — | The text box (react-aria's `Input`): `placeholder`, `className`… No fill or outline of its own; the group draws them. |
| `ColorFieldSwatch` | — | A `ColorSwatch` of the surrounding field's color; clear while it is empty. Takes the swatch props except `color`. |
| `ColorSwatch` `color` | — | A CSS color string or a `Color`. |
| `ColorSwatch` `colorName` / `aria-label` | — | Replace the color's spoken name / add to it. |

## Styling

Slots: `color-field`, `color-field-group`, `color-field-input`, `color-swatch`, `color-field-swatch`. The group shows a primary ring while the input has focus (`data-focus-within`) and a destructive ring when `data-invalid`; `data-disabled` dims it. The swatch has a hairline edge (`shadow-hairline`) and sets its color as inline `background`, since the value is only known at runtime.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `colorFieldGroupVariants`

Defined in `@/components/ui/color-field`. Base classes:

```text
[ 'box-border flex w-full min-w-0 items-center gap-2 bg-input px-3 text-foreground outline-none transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy', 'data-focus-within:bg-transparent data-focus-within:ring-[1.5px] data-focus-within:ring-primary data-focus-within:ring-inset', 'data-invalid:ring-[1.5px] data-invalid:ring-destructive data-invalid:ring-inset data-disabled:cursor-not-allowed data-disabled:opacity-50', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 rounded-lg text-subhead` |
| `default` (default) | `h-11 rounded-ctl text-body` |
| `lg` | `h-[50px] rounded-xl text-body` |
