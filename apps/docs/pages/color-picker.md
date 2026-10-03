# ColorPicker

React-aria's color editing, as parts you compose. `ColorPicker` draws nothing itself: it holds the color and hands it to whatever sits inside: a `ColorArea` (saturation and brightness together), `ColorSlider`s (hue, opacity, any one channel), a row of `ColorSwatchPicker` presets, a [ColorField](https://blamy.github.io/ui/#/color-field) for the hex, and the `ColorSwatch` or `ColorPickerTrigger` that show it. The usual arrangement, a button showing the color that opens a popover with all of those, is one line: `ColorPickerTrigger` and `ColorPickerContent`. Use it for accent colors, labels and tints; for typing a known value, a bare [ColorField](https://blamy.github.io/ui/#/color-field) is enough.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/color-picker.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  ColorPicker, ColorPickerTrigger, ColorPickerContent, ColorArea,
  ColorSlider, ColorSwatchPicker, ColorSwatchPickerItem,
} from '@/components/ui/color-picker'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  ColorPicker, ColorPickerTrigger, ColorPickerContent, ColorArea,
  ColorSlider, ColorSwatchPicker, ColorSwatchPickerItem,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Values are colors, not strings

`value`, `defaultValue` and `onChange` use react-aria's `Color`: pass a CSS color string (`'#7f5af0'`, `'hsla(262, 83%, 66%, 0.6)'`) or a `parseColor()` object, and `onChange` gives you a `Color` to read with `toString('hex')`, `'hexa'` (with the opacity), `'hsl'`, `'hsb'` or `'css'`. `parseColor` and `Color` come from `react-aria-components`; there is nothing extra to install.

## Anatomy

`ColorPicker` goes outside; the trigger and content go inside a [Popover](https://blamy.github.io/ui/#/popover)'s `PopoverTrigger`.

```tsx
<ColorPicker defaultValue="#7f5af0">
  <PopoverTrigger>
    <ColorPickerTrigger />
    <ColorPickerContent swatches={['#ff453a', '#30d158', '#0a84ff']} />
  </PopoverTrigger>
</ColorPicker>
```

`ColorPickerContent` is a popover with a `ColorArea`, a hue slider, an optional opacity slider (`alpha`), a hex field and, if you pass `swatches`, a row of presets. Pass children to lay out your own.

## In a popover

`ColorPickerTrigger` is a filled button with a swatch and the hex (`#7F5AF0`, or the eight-digit form once the opacity is below 1); `showValue={false}` shows the swatch alone, and `size` is `sm`, `default` or `lg`. Give a trigger without a visible label an `aria-label`. The popover is portalled, so in a themed area wrap the demo in a [ThemeScope](https://blamy.github.io/ui/#/theming) (or put `BLProvider` at your root).

{% demo src="color-picker/popover" %}

## Composing the parts

Every part reads the color from the surrounding `ColorPicker`, so you can put them anywhere: in a panel, a sheet, a settings row. `ColorArea` plots two channels (saturation across and brightness up by default; `colorSpace`, `xChannel` and `yChannel` change that); size it with `className` since its gradient is set by react-aria. `ColorSlider` is one channel as a gradient track: `channel="hue"` (with `colorSpace="hsb"`), `"alpha"`, `"saturation"`…; `label` and `showValue` add the caption and the number, or give `aria-label` instead.

{% demo src="color-picker/composed" %}

## Presets and opacity

`ColorSwatchPicker` is a row of `ColorSwatchPickerItem`s, one `color` each; choosing one sets the picker's color, and the item that matches the current color shows as selected. `ColorSlider channel="alpha"` edits the opacity over a checkerboard, and an alpha below 1 turns `toString('hexa')` into the eight-digit form.

{% demo src="color-picker/presets-opacity" %}

## Accessibility

Every part is operable by keyboard, with react-aria's semantics. The `ColorArea` has two hidden sliders (one per channel) and a thumb that takes focus; the `ColorSlider` is a slider named by its label; the swatch picker is a `listbox` of `option`s named by the color; the hex field is a text box. Colors are announced by name ("vibrant blue", "50% transparent"), so people who cannot see the swatch still get the value. Name every group of controls: the area, each slider, the presets and the trigger need a visible `Label` or an `aria-label`.

| Part | Keys |
| --- | --- |
| ColorArea | Arrow keys move the thumb one step in x or y; Page Up / Page Down move y by a larger step; Home / End move x by a larger step; Shift with an arrow takes the larger step. |
| ColorSlider | Left / Down and Right / Up step the channel; Page Up / Page Down a larger step; Home / End to the minimum / maximum. |
| ColorSwatchPicker | Arrow keys move between swatches; Space or Enter selects; Tab leaves the row. |
| ColorPickerTrigger | Enter, Space or a press opens the popover; Esc or an outside press closes it and focus returns to the trigger. |
| Hex field | Type and Tab to commit, ArrowUp / ArrowDown to step; see [ColorField](https://blamy.github.io/ui/#/color-field). |

Thumbs grow on drag and keyboard focus and show a ring on keyboard focus (`data-focus-visible`); `prefers-reduced-motion` turns the size transition off.

## Props

### ColorPicker

`ColorPicker` is react-aria's `ColorPicker` as is: it renders no element of its own.

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onChange` | — | The `Color` (or a CSS string). |
| `children` | — | The parts, or a render function receiving `{ color }`. |

### ColorPickerTrigger

A react-aria `Button` (other props pass through; `className` may be a function).

| Prop | Default | Effect |
| --- | --- | --- |
| `size` | `default` | `sm` 32px · `default` 44px · `lg` 50px. |
| `showValue` | `true` | Show the hex beside the swatch. |

### ColorPickerContent

A [Popover](https://blamy.github.io/ui/#/popover) holding a dialog named "Color picker" (256px wide, `w-64`).

| Prop | Default | Effect |
| --- | --- | --- |
| `swatches` | — | Preset colors as a row of swatches under the hex field. |
| `alpha` | `false` | Add an opacity slider. |
| `children` | area, hue, hex, swatches | Replace the default contents. |
| `placement` | `bottom start` | Popover placement. |

### ColorArea, ColorSlider, ColorThumb and the swatch picker

| Part | Props |
| --- | --- |
| `ColorArea` | react-aria's `ColorArea`: `colorSpace` (`hsb`), `xChannel` (`saturation`), `yChannel` (`brightness`), `value`, `onChange`, `isDisabled`. It sets its own `style` (the gradient): size it with `className` (`h-40 w-full`, 12rem square by default). It renders its `ColorThumb`. |
| `ColorSlider` | react-aria's `ColorSlider`: `channel` (required: `hue`, `saturation`, `brightness`, `lightness`, `red`, `green`, `blue`, `alpha`), `colorSpace`, `orientation`, `isDisabled`; plus `label` and `showValue`. Without `label`, pass `aria-label`. |
| `ColorThumb` | The draggable handle, filled with the color under it; used inside the area and the slider track. Takes react-aria's `ColorThumb` props. |
| `ColorSwatchPicker` | `layout` (`grid` or `stack`), plus `value` / `defaultValue` / `onChange` to use it without a `ColorPicker`. Holds the items. |
| `ColorSwatchPickerItem` | `color` (required), `isDisabled`. |

## Styling

Slots: `color-area`, `color-slider`, `color-thumb`, `color-swatch-picker`, `color-swatch-picker-item`, `color-picker-trigger`, `color-picker-content`. The thumb carries `data-dragging`, `data-focus-visible` and `data-disabled`; a swatch item carries `data-selected`, `data-hovered` and `data-focus-visible`, and its selection ring and its offset take the popover's surface color. The colors themselves (area and track gradients, swatch fill) are inline styles from react-aria, since they are computed from the value.
