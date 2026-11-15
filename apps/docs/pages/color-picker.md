# ColorPicker

UI SDK's color picker, as parts you compose. `ColorPicker` is a group that holds one color and hands it to whatever sits inside: a `ColorPickerArea` (saturation and brightness together), `ColorPickerSlider`s (hue, opacity, any one channel), a row of `ColorPickerSwatches` presets, a `ColorPickerInputGroup` holding a typed `ColorPickerInput` or `ColorPickerChannelInput`s, a `ColorPickerEyeDropper`, and the `ColorPickerSwatch` or `ColorPickerTrigger` that show it. The usual arrangement, a button showing the color that opens a popover with all of those, is two parts inside the root: `ColorPickerTrigger` and `ColorPickerContent`. `ColorInput` is the one-line preset for typing a color: a swatch and a text box in the kit's filled field. Use the popover for accent colors, labels and tints people want to see and drag through; use `ColorInput` when they know the value (a hex from a brand sheet), and a [Select](https://blamy.github.io/ui/#/select) or [Segmented](https://blamy.github.io/ui/#/segmented) when the choice is a handful of named colors.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/color-picker.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  ColorPicker, ColorPickerTrigger, ColorPickerContent, ColorInput,
} from '@/components/ui/color-picker'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  ColorPicker, ColorPickerTrigger, ColorPickerContent, ColorInput,
} from '@brett_lamy/ui/color-picker'
```
{% endtab %}
{% endtabs %}

## Values are CSS color strings

`value`, `defaultValue` and `onValueChange` carry a CSS color string: pass `'#7f5af0'`, `'hsl(262 83% 66% / 0.6)'` or any other CSS color, and the picker writes hex back (eight digits once the opacity is below 1), or the `format` you ask for. A value you pass is kept as you wrote it until someone edits it. `onValueChange(value, details)` runs on every step of a drag and `onValueCommit(value, details)` once when the drag, key press or typed color ends, so save in the second. `details.reason` says what changed it (`drag`, `track-press`, `step-key`, `input-commit`, `item-press`, `eye-dropper-pick`…), `details.color` is the same color as data, and `details.cancel()` refuses the change. A picker always holds a color: without a `defaultValue` it starts at black. Read a string with `parseColor` and write one with `formatColor`, both from `@ui-sdk/core/color` (the kit's UI SDK dependency, nothing extra to install):

```tsx
import { formatColor, parseColor } from '@ui-sdk/core/color'

const [accent, setAccent] = useState('#7f5af0')

<ColorPicker
  aria-label="Accent"
  value={accent}
  onValueChange={(value, details) => {
    setAccent(value) // '#663399'
    formatColor(details.color, 'hsl') // 'hsl(270 50% 40%)'
  }}
  onValueCommit={save}
>
  …
</ColorPicker>

const color = parseColor(accent) // { space: 'srgb', coords: [0.4, 0.2, 0.6], alpha: 1 }, or null for text that is no color
```

## Anatomy

`ColorPicker` goes outside, and holds the popover's open state too, so the trigger and the content go straight in:

```tsx
<ColorPicker defaultValue="#7f5af0">
  <ColorPickerTrigger />
  <ColorPickerContent swatches={['#ff453a', '#30d158', '#0a84ff']} />
</ColorPicker>
```

`open`, `defaultOpen`, `onOpenChange` and `presentation` on the root drive that popover (`presentation="auto"` makes it a bottom sheet in a compact container). Several triggers under one root, each opening its own popup, each go in their own [Popover](https://blamy.github.io/ui/#/popover). `ColorPickerContent` is the popover's content with a `ColorPickerArea`, a hue slider, an optional opacity slider (`alpha`), a text field and, if you pass `swatches`, a row of presets. Pass children to lay out your own. `ColorPicker` renders a `<div>` with the `group` role around its parts: name it with `aria-label`, or put it in a [Field](https://blamy.github.io/ui/#/field) whose label names it, and lay its parts out with `className`.

## In a popover

`ColorPickerTrigger` is the kit's filled field box as a button: a swatch, the value exactly as its `ColorPickerInput` shows it (so one widget never shows two notations: the value you pass, then each edit in the picker's `format`, hex by default with eight digits below full opacity) and the up-down glyph of a pop-up button. It keeps the field's primary edge while the popover is open. `showValue={false}` shows the swatch alone, and `size` is `sm`, `default` or `lg`. Give a trigger without a visible label an `aria-label`. The dialog is named after the picker (its Field's label or `aria-label`), else "Color picker"; `aria-label` on `ColorPickerContent` renames it. In a themed area wrap the demo in a [ThemeScope](https://blamy.github.io/ui/#/theming) (or put `BLProvider` at your root) so the popover wears the same theme.

{% demo src="color-picker/popover" %}

## Typing a color: ColorInput

`ColorInput` is the picker's root drawn as the kit's filled field, with a swatch and a text box when it has no children: one line is the whole control. Put it in a [Field](https://blamy.github.io/ui/#/field) for its label, description and error.

```tsx
<Field>
  <FieldLabel>Accent</FieldLabel>
  <ColorInput defaultValue="#7f5af0" />
  <FieldDescription>Any CSS color.</FieldDescription>
  <FieldError />
</Field>
```

The text is edited freely, and the value changes when Enter is pressed or the input loses focus: text that is a CSS color is read and rewritten in the `format` (`rebeccapurple` becomes `#663399`); anything else, an empty box included, goes back to the value. Escape puts the text back at once. A hex needs its `#`. The swatch follows the value. Show an error your code decides with `invalid` on the `Field` and a `<FieldError match>`: the field's outline turns red. `required` only marks the field (`data-required`), since it always has a value. Pass children to choose the parts (`<ColorPickerInput placeholder="#RRGGBB" />` alone is a plain text field), and `aria-label` when there is no `Field`.

{% demo src="color-picker/input" %}

## One channel as a number

`ColorPickerChannelInput` is a number box for one `channel` of the color, in the units people read it in, with the unit right after the digits (the box is as wide as its number): degrees for `hue`, a percentage for `saturation`, `lightness`, `brightness` and `alpha`, 0 to 255 for `red`, `green` and `blue`. The channels come from the root's `space` (see below). Enter, leaving the box or its arrow keys set the channel. Several boxes under one root edit the same color; draw each in a `ColorPickerInputGroup`, the filled field as a plain box (the picker holds the color), so three of them make an HSL editor:

{% demo src="color-picker/channels" %}

## Composing the parts

Every part edits the color of the `ColorPicker` around it, so you can put them anywhere inside it: in a panel, a sheet, a settings row. `ColorPickerArea` plots two channels, `x` across and `y` up (saturation and brightness by default), and renders its own thumb; size it with `className`. `ColorPickerSlider` is one `channel` as a gradient track with its thumb: `"hue"`, `"alpha"`, `"saturation"`…; `label` and `showValue` add a caption and the number above the track, and without a `label` the thumb is named after its channel. For typing the value, put a `ColorPickerInput` (with a `ColorPickerSwatch` if you like) in a `ColorPickerInputGroup`. The swatch is 24px, and 20px in a `size="sm"` field.

{% demo src="color-picker/composed" %}

## Spaces and formats

`space` on the picker decides which channels its parts edit, and what the value is written in unless you set `format`:

| `space` | Area, across and up | Slider | Value written as |
| --- | --- | --- | --- |
| `hsv` (default) | saturation, brightness | hue | hex, like `#0ea5e9` |
| `hsl` | saturation, lightness | hue | `hsl(198.63 88.66% 48.43%)` |
| `srgb` | red, green | blue | `rgb(14 165 233)` |
| `oklch` | chroma, lightness | hue | `oklch(0.6847 0.1479 237.32)` |

Every space has an `alpha` channel too. The area draws itself with gradients for saturation by brightness or lightness; for any other pair (OKLCH, red by green, hue by lightness) put a `ColorPickerAreaCanvas` before the thumb, which paints it pixel by pixel:

```tsx
<ColorPicker aria-label="Accent" space="oklch" gamut="p3" defaultValue="oklch(0.7 0.25 150)">
  <ColorPickerArea>
    <ColorPickerAreaCanvas />
    <ColorPickerAreaThumb />
  </ColorPickerArea>
  <ColorPickerSlider channel="hue" />
</ColorPicker>
```

Colors stay inside sRGB by default: a drag can go past the edge (the parts then carry `data-out-of-gamut`) and the value is the closest color inside. `gamut="p3"` allows wide-gamut colors and `gamut={false}` any color. The parts keep a hue while the color turns gray or black, so dragging back out of a corner returns to the same hue.

## Presets and opacity

`ColorPickerSwatches` is a row of `ColorPickerSwatchItem`s, one `value` each (any CSS color); choosing one sets the picker's color, and the item whose color looks like the current one is selected, however either is written. `ColorPickerSlider channel="alpha"` edits the opacity over a checkerboard, and an opacity below 1 adds two digits to the hex. `ColorPickerSwatch` shows the picker's color anywhere inside it.

{% demo src="color-picker/presets-opacity" %}

## Eye dropper and controller

`ColorPickerEyeDropper` is a small button that picks a color from anywhere on the screen. Browsers without the EyeDropper API can't do that, and there the button is hidden. To set the color from outside the picker (a reset button, a keyboard shortcut), create a controller and pass it as `controller`:

```tsx
const [picker] = useState(() => createColorPickerController())

<Button onClick={() => picker.setValue('rebeccapurple')}>Use purple</Button>
<ColorPicker aria-label="Theme color" controller={picker}>…</ColorPicker>
```

`setValue()` takes any CSS color, runs `onValueChange` as a drag would, and returns `false` for text that is not a color. With a `name`, the picker submits its value in a form through a hidden input, and a form reset returns it to `defaultValue`.

## Swatches

`ColorSwatch` paints any CSS color string on its own, outside a picker. It is a 24px circle by default; size and shape it with `className` (`size-8`, `rounded-lg`). A translucent color shows the surface behind it. It is an image to assistive technology, named by its CSS value unless you give it an `aria-label`, so name the swatches people have to tell apart. Inside a picker use `ColorPickerSwatch`, which follows the color being edited and is named from it ("vivid blue", "vivid purple, 60% opaque").

{% demo src="color-picker/swatches" %}

## Accessibility

No WAI-ARIA pattern covers a color picker, so UI SDK builds it from ones that do. The picker is a `group`. The area's thumb and each slider's thumb are `slider`s; the area's names both of its channels ("Saturation and brightness") and reads both values. The presets are a `listbox` of `option`s with one tab stop, each named by its color ("vivid red"), as `ColorPickerSwatch` is, so people who cannot see a swatch still get the value. The text field is a text box named "Color", and a channel box a number input named after its channel ("Hue"); its unit (° or %) is drawn after it and hidden from screen readers, which hear the spin button's own value. Thumbs, the input and presets are named in English by default: pass `aria-label` to name them in another language. Name the picker, the presets (`aria-label` on `ColorPickerSwatches`) and a trigger with no visible label.

| Part | Keys |
| --- | --- |
| ColorPickerArea | Left / Right move across and Up / Down move up and down, one step; Shift with an arrow moves ten; Page Up / Page Down move up or down a tenth of the range; Home / End go to the start or end across. |
| ColorPickerSlider | Arrows step the channel; Shift with an arrow steps ten; Page Up / Page Down a tenth of the range; Home / End to the start or end. |
| ColorPickerSwatches | Arrow keys move between presets, Home / End to the first or last; Enter or Space picks; Tab leaves the row. |
| ColorPickerTrigger | Enter, Space or a press opens the popover; Esc or an outside press closes it and focus returns to the trigger. |
| ColorPickerInput | Typing edits the text and changes nothing yet; Enter or Tab (or leaving it) reads it, Escape puts it back. |
| ColorPickerChannelInput | Arrow Up / Down step the channel; Enter or leaving it reads the number. |

Each key press commits, like the end of a drag. Thumbs travel inside their area and track (half a thumb in from each edge), grow while their track is held and under keyboard focus, and show a ring on keyboard focus (`focus-visible`); `prefers-reduced-motion` turns the size transition off.

## Props

### ColorPicker

UI SDK's `ColorPicker` root: a `<div>` with the `group` role, and the hidden input a form submits.

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` | black | The color, as a CSS color string. |
| `onValueChange` | — | `(value, details)` on every change: `details.reason`, `details.color`, `details.cancel()`. |
| `onValueCommit` | — | `(value, details)` once an interaction ends. |
| `space` | `hsv` | The channels the parts edit: `hsv`, `hsl`, `srgb` or `oklch`. |
| `format` | hex, or the `space` | How an edit writes the value (the trigger and the text box both show it): `hex`, `srgb`, `hsl`, `oklch`… |
| `gamut` | `srgb` | `srgb`, `p3`, or `false` for any color. |
| `disabled` / `readOnly` / `required` | `false` | State. A disabled picker can't be focused and submits nothing; a read-only one stays focusable. |
| `name` / `form` | — | Submits the value. |
| `controller` | — | A `createColorPickerController()`: `getValue()`, `setValue(value)`, `focus()`. |
| `open` / `defaultOpen` / `onOpenChange` | closed | The open state of the popover its `ColorPickerTrigger` opens. |
| `presentation` | `popover` | `sheet`, or `auto`: a bottom sheet in a compact container. |
| `children` | — | The parts, or a function of the picker's state (`{ value, color, space, disabled, readOnly, outOfGamut }`). |

### ColorInput

The same root as the kit's filled field (`fieldSurfaceVariants`): every `ColorPicker` prop above except the popover ones, plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `size` | `default` | `sm` 32px · `default` 44px · `lg` 50px. |
| `children` | swatch and input | The parts. |
| `aria-label` | — | The field's name when there is no `Field` label. |

### ColorPickerTrigger

The [Popover](https://blamy.github.io/ui/#/popover)'s trigger, a `<button>` in the filled field's box (`colorPickerTriggerVariants`); its props pass through (`className` may be a function, `render` replaces the button).

| Prop | Default | Effect |
| --- | --- | --- |
| `size` | `default` | `sm` 32px · `default` 44px · `lg` 50px. |
| `showValue` | `true` | Show the value beside the swatch. |

### ColorPickerContent

The popover's content (256px wide, `w-64`, and never narrower than its trigger); `PopoverContent`'s props pass through.

| Prop | Default | Effect |
| --- | --- | --- |
| `swatches` | — | Preset colors as a row of swatches under the text field. |
| `alpha` | `false` | Add an opacity slider. |
| `children` | area, hue, text field, swatches | Replace the default contents. |
| `side` / `align` | `bottom` / `start` | Where it sits against the trigger. |
| `aria-label` | the picker's name | The dialog's name. |

### The parts

| Part | Props |
| --- | --- |
| `ColorPickerArea` | `x`, `y`: the channels across and up (by `space`: saturation and brightness, saturation and lightness, red and green, chroma and lightness). Children default to a `ColorPickerAreaThumb`. 12rem square by default: size it with `className` (`h-40 w-full`). |
| `ColorPickerAreaThumb` | The area's handle. Takes `aria-label`. |
| `ColorPickerAreaCanvas` | Paints the area for channels no gradient draws. Put it before the thumb. |
| `ColorPickerSlider` | `channel` (hue by default: `hue`, `saturation`, `brightness`, `lightness`, `chroma`, `red`, `green`, `blue`, `alpha`), `orientation`, plus `label` and `showValue`. Children default to a `ColorPickerSliderThumb`. `className` styles the track. |
| `ColorPickerSliderThumb` | A slider's handle. Takes `aria-label`. |
| `ColorPickerSwatches` | The preset list. Name it with `aria-label`. |
| `ColorPickerSwatchItem` | `value` (required): the preset, as any CSS color. |
| `ColorPickerInputGroup` | `<div>`: the filled field as a plain box for the parts below; `size` `sm` / `default` / `lg`. Dims with the picker. |
| `ColorPickerInput` | `<input>`: any CSS color, read on Enter or blur. Named "Color" unless you give it `aria-label` or an `id` a label points at. |
| `ColorPickerChannelInput` | `<input type="number">` for one `channel`, followed by its unit. |
| `ColorPickerSwatch` | `<div>`: a chip of the picker's color, named by it. |
| `ColorPickerEyeDropper` | A button; children replace its icon, `aria-label` its name. |
| `ColorSwatch` | `<div>`: a chip of the `color` you give it (any CSS color); `aria-label` names it. |

## Styling

The parts carry UI SDK's slots: `color-picker`, `color-picker-area`, `color-picker-area-thumb`, `color-picker-area-canvas`, `color-picker-slider`, `color-picker-slider-thumb`, `color-picker-input`, `color-picker-channel-input`, `color-picker-swatch`, `color-picker-swatches`, `color-picker-swatch-item` and `color-picker-eye-dropper`; the kit's own are `color-picker-input-group` and `color-swatch`, and the trigger and content are the popover's (`popover-trigger`, `popover-content`). Every part has `data-disabled`, `data-readonly`, `data-required` and `data-out-of-gamut`; a slider and its thumb add `data-channel` and `data-orientation`, a preset `data-selected`, and the eye dropper `data-unsupported`. `ColorInput`, `ColorPickerInputGroup` and the trigger are the kit's filled field (`fieldSurfaceVariants` from [Input](https://blamy.github.io/ui/#/input)): a 1.5px primary edge while anything in them has focus (and while the trigger's popover is open), a destructive edge when their Field is invalid, and a `data-size` the swatch follows. A preset's selection ring and its offset take the popover's surface color. Thumbs have a white ring in both appearances, since they sit on any color. The colors themselves are CSS variables the parts write, since they are computed from the value: `--color-area-background` and `--color-slider-background` (the gradients) and `--color-picker-color` (a swatch, a preset, and the color under a thumb).

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `colorPickerTriggerVariants`

Defined in `@/components/ui/color-picker`. Base classes:

```text
bl-btn w-full cursor-pointer justify-start text-left active:not-data-disabled:bg-secondary-strong aria-expanded:bg-transparent aria-expanded:shadow-[inset_0_0_0_1.5px_var(--primary)]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `fieldSurfaceVariants({ size: 'sm' })` |
| `default` (default) | `fieldSurfaceVariants({ size: 'default' })` |
| `lg` | `fieldSurfaceVariants({ size: 'lg' })` |
