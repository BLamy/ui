# Slider

UI SDK's `Slider` in the iOS style: a 4px track with a tint fill and a 26px white thumb. Pass a number for one thumb or an array for a range with two. Use it to choose a value on a continuum (brightness, volume, a price range); for an exact number prefer a field, and for a few discrete choices a [Segmented](https://blamy.github.io/ui/#/segmented) control.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/slider.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import { Slider } from '@/components/ui/slider'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Slider } from '@brett_lamy/ui/slider'
```
{% endtab %}
{% endtabs %}

## Label, value and range

`label` adds a caption and `showValue` the formatted value opposite it; `format` takes `Intl.NumberFormat` options (percent, currency) or a function of the value. `min`, `max` (defaults 0 and 100) and `step` (default 1) set the scale. Controlled with `value` / `onValueChange(value, details)`, or `defaultValue`; `onValueCommit` fires once when a drag or key press ends. The thumbs are added for you, one per value; a range's thumbs are named "Minimum" and "Maximum" unless you pass `thumbLabels`.

{% demo src="slider/controls" %}

```tsx
<Slider label="Brightness" showValue defaultValue={0.64} min={0} max={1} step={0.01}
  format={{ style: 'percent' }} />
<Slider label="Budget" showValue value={range} onValueChange={setRange} thumbLabels={['Lowest', 'Highest']} />   {/* range = [20, 80] */}
```

## Variants, colors and the scrubber

`variant="overlay"` makes the track and fill translucent and monochrome, so the slider reads over artwork, video or glass: white in a dark scheme, black in a light one. It follows the scheme it sits in; where the backdrop has its own scheme (album art that is dark in both appearances), set `appearance="dark"` or `"light"` on the slider. `appearance` is the kit's color-scheme prop, so it also works with the default look. `size="sm"` is the scrubber: a 12px thumb on a 20px hit area that grows while dragging. Any other color is a CSS variable the parts read, set with `className` and working with every variant: `--bl-slider-track`, `--bl-slider-fill`, `--bl-slider-thumb`.

```tsx
<Slider aria-label="Volume" variant="overlay" appearance="dark" size="sm" value={volume} onValueChange={setVolume} />
<Slider aria-label="Exposure" className="[--bl-slider-fill:var(--success)]" defaultValue={62} />
```

{% demo src="slider/media" %}

## Vertical

`orientation="vertical"` stands the slider up (a mixer channel, an equalizer band): the label and value sit above a control that fills the rest of the parent's height, so give the parent a height. The keys are the same as on a horizontal slider.

```tsx
<div className="flex h-56 gap-6">
  <Slider orientation="vertical" label="Bass" defaultValue={40} />
  <Slider orientation="vertical" label="Treble" defaultValue={30} />
</div>
```

## Custom layout

Pass children to replace the default layout and compose the parts yourself: `SliderValue` (the formatted value), `SliderControl` (the hit area), `SliderTrack` (the rail), `SliderIndicator` (the fill) and one `SliderThumb` per value. Give each thumb of a range its own `aria-label`:

```tsx
<Slider defaultValue={[20, 80]} aria-label="Price range">
  <SliderValue />
  <SliderControl>
    <SliderTrack>
      <SliderIndicator />
      <SliderThumb index={0} aria-label="Lowest price" />
      <SliderThumb index={1} aria-label="Highest price" />
    </SliderTrack>
  </SliderControl>
</Slider>
```

`createSliderController()` drives a slider from elsewhere: pass it as `controller` and call its methods.

## Accessibility

Each thumb holds a native range input (`aria-valuenow`, and `aria-valuetext` formatted with `format`), which is what takes focus. Arrow keys move by `step`, Page Up / Down by `largeStep`, Home / End to the ends. A slider needs a name: `label`, `aria-label` or `aria-labelledby`; a one-thumb slider hands it to its thumb. Inside a `ListRow` it is labelled by the row title. In a range the group takes the name and each thumb has its own (`thumbLabels`, or `aria-label` on a `SliderThumb`).

## Props

### Slider

Every UI SDK `Slider` prop applies (`value`, `defaultValue`, `onValueChange`, `onValueCommit`, `min`, `max`, `step`, `largeStep`, `disabled`, `orientation`, `format`, `locale`, `name`, `controller`, `aria-*`), plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `label` | — | Caption above the track. |
| `showValue` | `false` | The formatted value on the right of the label row. |
| `thumbLabels` | `['Minimum', 'Maximum']` | Names of a range's thumbs, in order. |
| `variant` | `default` | `default` (tint fill) · `overlay` (translucent, for media). |
| `appearance` | `auto` | The color scheme of the slider: `auto` follows the page, `light` / `dark` fix it for what the slider sits on. |
| `size` | `default` | `default` 26px thumb · `sm` 12px scrubber thumb. |
| `children` | — | Replaces the default label, value and track. |

`details.reason` on `onValueChange` says what moved it (a pointer, a key, the controller); `details.cancel()` keeps the old value.

### Parts

`SliderValue` shows the formatted value (a range joined with an en dash). `SliderControl` is the 28px hit area (20px for `sm`), inset by half a thumb; vertical, it is a column that takes the remaining height. `SliderTrack` is the 4px rail and `SliderIndicator` the fill up to the thumb (or between a range's thumbs). `SliderThumb` takes an `index` for ranges, plus `aria-label` / `aria-labelledby` for its input.

## Styling

UI SDK writes `data-slot` on every part (`slider`, `slider-value`, `slider-control`, `slider-track`, `slider-indicator`, `slider-thumb`) and the state attributes `data-orientation`, `data-disabled`, `data-readonly` and `data-dragging` (a thumb, while it is dragged); the root also has `data-variant`, `data-appearance` and `data-size` when not default, and is a named Tailwind group (`group/slider`), so a part styles itself from the root with `group-data-[size=sm]/slider:`. The focus ring is the kit's solid ring, drawn on the thumb with `has-focus-visible:`. A disabled slider is dimmed to 40%. `sliderVariants({ variant })` returns the root classes (layout and the variant's `--bl-slider-*` colors); `size` is read by the parts from `data-size`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `sliderVariants`

Defined in `@/components/ui/slider`. Base classes:

```text
[ 'group/slider grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 data-disabled:opacity-40', // Stood up: the label and value over a control that takes the rest of the parent's height. 'data-[orientation=vertical]:flex data-[orientation=vertical]:h-full data-[orientation=vertical]:w-fit data-[orientation=vertical]:flex-col', ]
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `overlay` | `[--bl-slider-track:light-dark(--alpha(black/14%),--alpha(white/22%))] [--bl-slider-fill:light-dark(--alpha(black/72%),--alpha(white/88%))]` |
