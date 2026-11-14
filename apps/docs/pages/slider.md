# Slider

UI SDK's `Slider` in the iOS style: a 4px track with a tint fill and a 26px white thumb. Pass a number for one thumb or an array for a range with two. Use it to choose a value on a continuum (brightness, volume, a price range); for an exact number or a few discrete choices, prefer a field or a [ToggleGroup](https://blamy.github.io/ui/#/toggle).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/slider.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Slider } from '@/components/ui/slider'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Slider } from '@brett_lamy/ui'
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

`variant="on-dark"` (translucent white) and `variant="on-light"` (translucent black) make the track readable over artwork, dark glass or light imagery. `size="sm"` is the scrubber: a 12px thumb on a 20px hit area that grows while dragging. Any other color is a CSS variable the parts read, set with `className` and working with every variant: `--bl-slider-track`, `--bl-slider-fill`, `--bl-slider-thumb`.

```tsx
<Slider aria-label="Exposure" className="[--bl-slider-fill:var(--success)]" defaultValue={62} />
```

{% demo src="slider/media" %}

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
| `variant` | `default` | `default` (tint fill) · `on-dark` · `on-light`. |
| `size` | `default` | `default` 26px thumb · `sm` 12px scrubber thumb. |
| `children` | — | Replaces the default label, value and track. |

`details.reason` on `onValueChange` says what moved it (a pointer, a key, the controller); `details.cancel()` keeps the old value.

### Parts

`SliderValue` shows the formatted value (a range joined with an en dash). `SliderControl` is the 28px hit area (20px for `sm`), inset by half a thumb. `SliderTrack` is the 4px rail and `SliderIndicator` the fill up to the thumb (or between a range's thumbs). `SliderThumb` takes an `index` for ranges, plus `aria-label` / `aria-labelledby` for its input.

## Styling

UI SDK writes `data-slot` on every part (`slider`, `slider-value`, `slider-control`, `slider-track`, `slider-indicator`, `slider-thumb`) and the state attributes `data-orientation`, `data-disabled`, `data-readonly` and `data-dragging` (a thumb, while it is dragged); the root also has `data-variant` and `data-size` when not default. The focus ring is the kit's solid ring, drawn on the thumb with `has-focus-visible:`. A disabled slider is dimmed to 40%. `sliderVariants({ variant })` returns the root classes (layout and the variant's `--bl-slider-*` colors); `size` is read by the parts from `data-size`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `sliderVariants`

Defined in `@/components/ui/slider`. Base classes:

```text
group grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 data-disabled:opacity-40
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `on-dark` | `[--bl-slider-track:--alpha(white/22%)] [--bl-slider-fill:--alpha(white/88%)]` |
| `on-light` | `[--bl-slider-track:--alpha(black/14%)] [--bl-slider-fill:--alpha(black/72%)]` |
