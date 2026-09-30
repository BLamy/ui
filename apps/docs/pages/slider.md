# Slider

react-aria's `Slider` in the iOS style: a 4px track with a tint fill and a 26px white thumb. Pass a number for one thumb or an array for a range with two. Use it to choose a value on a continuum (brightness, volume, a price range); for an exact number or a few discrete choices, prefer a field or a [ToggleGroup](https://blamy.github.io/ui/#/toggle-group).

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

`label` adds a caption and `showValue` the formatted value opposite it; `formatOptions` is `Intl.NumberFormat` (percent, currency). `minValue`, `maxValue` (defaults 0 and 100) and `step` (default 1) set the scale. Controlled with `value` / `onChange`, or `defaultValue`. The thumbs are added for you — one per value.

{% demo src="slider/controls" %}

```tsx
<Slider label="Brightness" showValue defaultValue={0.64} minValue={0} maxValue={1} step={0.01}
  formatOptions={{ style: 'percent' }} />
<Slider label="Budget" showValue value={range} onChange={setRange} />   {/* range = [20, 80] */}
```

## Tones and the scrubber

`tone="onDark"` (translucent white) and `tone="onLight"` (translucent black) make the track readable over artwork, dark glass or light imagery. `size="sm"` is the scrubber: a 12px thumb on a 20px hit area that grows while dragging. `trackColor`, `fillColor` and `thumbColor` take any CSS color and work with every tone.

{% demo src="slider/media" %}

## Custom layout

Pass children to replace the default layout and compose `SliderTrack` and `SliderThumb` yourself (for example with a react-aria `Label` and `SliderOutput`), or to give a thumb a `name` or `aria-label` in a range:

```tsx
<Slider defaultValue={[20, 80]} aria-label="Price range">
  <SliderTrack>
    <SliderThumb index={0} aria-label="Minimum" />
    <SliderThumb index={1} aria-label="Maximum" />
  </SliderTrack>
</Slider>
```

## Accessibility

Each thumb is `role="slider"` with `aria-valuenow` and `aria-valuetext` (formatted with `formatOptions`). Arrow keys move by `step`, Page Up / Down by larger steps, Home / End to the ends. A slider needs a name: `label`, `aria-label` or `aria-labelledby`. Inside a `ListRow` it is labelled by the row title. In a range, name each thumb.

## Props

### Slider

Every react-aria `Slider` prop applies (`value`, `defaultValue`, `onChange`, `onChangeEnd`, `minValue`, `maxValue`, `step`, `isDisabled`, `orientation`, `formatOptions`, `aria-*`), plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `label` | — | Caption above the track. |
| `showValue` | `false` | The formatted value on the right of the label row. |
| `tone` | `default` | `default` · `onDark` · `onLight`. |
| `size` | `default` | `default` 26px thumb · `sm` 12px scrubber thumb. |
| `trackColor` / `fillColor` / `thumbColor` | — | Any CSS color; set the `--bl-slider-*` variables. |
| `children` | — | Replaces the default label, value and track. |

### SliderTrack and SliderThumb

`SliderTrack` is the 28px hit area (20px for `sm`) that draws the track and the fill between thumbs and renders the thumbs as children. `SliderThumb` takes an `index` for ranges, plus `name`, `isDisabled` and `aria-label`.

## Styling

`data-slot="slider"` (with `data-tone` and `data-size` when not default), `"slider-track"`, `"slider-range"` (the fill) and `"slider-thumb"`. A thumb gets `data-dragging` and `data-focus-visible`. A disabled slider is dimmed to 40%. `sliderVariants({ tone, size })` returns the root classes.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `sliderVariants`

Defined in `@/components/ui/slider`. Base classes:

```text
group grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 data-disabled:opacity-40
```

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `onDark` | `[--bl-slider-track:--alpha(white/22%)] [--bl-slider-fill:--alpha(white/88%)]` |
| `onLight` | `[--bl-slider-track:--alpha(black/14%)] [--bl-slider-fill:--alpha(black/72%)]` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `sm` | — |
