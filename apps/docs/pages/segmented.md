# Segmented

The iOS segmented control: a short row of mutually exclusive options in a tinted track, with one card under the selected option that slides (and resizes) to the next on a spring. It is UI SDK's `SegmentedControl`, a radio group, so it picks a *value* — a time range, a filter, a view mode — and does not own any panels. If each option reveals its own content, use [Tabs](https://blamy.github.io/ui/#/tabs), which has the same look (`variant="segmented"`) with tab and panel semantics; for the bottom navigation bar use [Tabs](https://blamy.github.io/ui/#/tabs) with `variant="bar"`. A [ToggleGroup](https://blamy.github.io/ui/#/toggle) with `variant="segmented"` draws the same track for buttons that press (several at once, or none), where arrow keys only move focus; a choice inside a form with longer labels is a [RadioGroup](https://blamy.github.io/ui/#/radio-group).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/segmented.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Segmented, SegmentedItem } from '@/components/ui/segmented'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Segmented, SegmentedItem } from '@brett_lamy/ui/segmented'
```
{% endtab %}
{% endtabs %}

## Usage

Each segment is a `SegmentedItem` with a `value`. Control it with `value` and `onValueChange(value, details)`, or leave it uncontrolled with `defaultValue`. `details.reason` says why it changed (`item-press`, `list-navigation`, `reset`, `restore`, `imperative`), and `details.cancel()` keeps the current value.

{% demo src="segmented/basic" %}

```tsx
const [range, setRange] = useState('week')

<Segmented aria-label="Time range" value={range} onValueChange={(v) => v && setRange(v)}>
  <SegmentedItem value="day">Day</SegmentedItem>
  <SegmentedItem value="week">Week</SegmentedItem>
  <SegmentedItem value="month">Month</SegmentedItem>
</Segmented>
```

## Sizes

`size` sets the height: `sm` 32px, `default` 36px, `lg` 44px, the same heights as [Button](https://blamy.github.io/ui/#/button), so a segmented control lines up with the buttons in a toolbar. Use `sm` in dense inspectors and toolbars, `lg` where it is the main control of a touch screen. On a touch screen every size reaches a 44px hit area, without changing its look.

{% demo src="segmented/sizes" %}

```tsx
<Segmented aria-label="Axis" size="sm" defaultValue="x">
  <SegmentedItem value="x">X</SegmentedItem>
  <SegmentedItem value="y">Y</SegmentedItem>
</Segmented>
```

## Width and filtering a list

The track fills its container and gives each segment an equal share. Size it with `className` or `style`: `w-fit` hugs the labels (the card then resizes as it slides between segments of different widths), a fixed width pins it. Items take any children, so an icon or a count works; keep them short, they never wrap. A segment with only an icon needs an `aria-label`.

{% demo src="segmented/filter" %}

## Disabled, read-only and forms

`disabled` on the control dims and disables it all; `disabled` on one `SegmentedItem` skips that item (arrow keys pass over it). `readOnly` keeps the items focusable but stops changes. Each item renders a hidden native radio, so with a `name` the value submits with a form; `required` blocks the submit until something is chosen, and a form reset goes back to `defaultValue`.

```tsx
<Segmented aria-label="Billing" name="period" defaultValue="monthly">
  <SegmentedItem value="monthly">Monthly</SegmentedItem>
  <SegmentedItem value="yearly">Yearly</SegmentedItem>
  <SegmentedItem value="lifetime" disabled>Lifetime</SegmentedItem>
</Segmented>
```

To change it from elsewhere, create a controller with `createSegmentedControlController()` and pass it as `controller`; its writes run `onValueChange` with the reason `imperative`.

## Accessibility

It renders UI SDK's `SegmentedControl` (`role="radiogroup"`), and each `SegmentedItem` is a button with the `radio` role. Tab moves focus onto the checked item (the first enabled one, if none is checked); the arrow keys move to the next item *and check it*, so there is no separate confirm step, and wrap at the ends unless `loop={false}`. Space checks the focused item and Enter submits its form. The focused segment shows a focus ring. Name it with `aria-label` (or a [Label](https://blamy.github.io/ui/#/label) whose `htmlFor` is its `id`): "Time range", not "Segmented control". If changing the value changes what is on screen, say so in a label or a live region near the content.

## Props

`Segmented` takes UI SDK's `SegmentedControl` props:

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` | — | The checked item's `value`. |
| `onValueChange` | — | `(value, details) => void`, called when a different item is checked; `value` is `null` when a reset leaves nothing checked. |
| `disabled` / `readOnly` / `required` | `false` | As described above. |
| `name` / `form` | — | Submit the value under `name`, optionally with a form elsewhere on the page. |
| `size` | `default` | `sm` (32px) · `default` (36px) · `lg` (44px). |
| `orientation` | `horizontal` | `vertical` stacks the segments. |
| `loop` | `true` | Arrow keys wrap from the last item to the first. |
| `controller` | — | From `createSegmentedControlController()`. |
| `aria-label` | — | The group's accessible name. |
| `className` / `style` | — | Applied to the track (merged last); `className` may be a function of the state. |

`SegmentedItem` takes `value` (required), `disabled`, `className` and `render`; its size comes from the control.

## Styling

The track is `data-slot="segmented-control"` (with `data-size`), each segment `data-slot="segmented-control-item"`, and the sliding card UI SDK's `SegmentedControlIndicator` (`data-slot="segmented-control-indicator"`), which the root renders for you. The checked item has `data-checked` (the others `data-unchecked`); `data-disabled`, `data-readonly`, `data-required` and `data-orientation` are there for selectors, and hover, press and keyboard focus are plain `hover:`, `active:` and `focus-visible:`. The indicator is positioned from the CSS variables UI SDK writes on it (`--segmented-control-indicator-left`, `-top`, `-width`, `-height`).

The look is four exports, shared with [Tabs](https://blamy.github.io/ui/#/tabs) `variant="segmented"` and [ToggleGroup](https://blamy.github.io/ui/#/toggle) `variant="segmented"`, so the three are pixel-alike at the same size:

| Export | What it draws |
| --- | --- |
| `segmentTrackVariants({ size })` | The tray: `bg-secondary`, 2px padding, the radius of a Button of that size. Add `flex` or `inline-flex`. |
| `segmentItemVariants({ size })` | A segment: height, padding, text size, medium weight (semibold when `data-checked`, `data-selected` or `data-pressed`), the solid focus ring, the 44px touch hit area. |
| `segmentIndicatorVariants({ size })` | The card: `bg-segment` (a raised gray in dark), its shadow, the track's radius minus the padding. |
| `segmentIndicatorSlide` | How the card moves: behind the labels, sliding and resizing on the smooth spring, still under reduced motion. |

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `segmentTrackVariants`

Defined in `@/components/ui/segmented`. Base classes:

```text
group/segments relative isolate gap-0.5 bg-secondary p-0.5 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `rounded-lg` |
| `default` (default) | `rounded-ctl` |
| `lg` | `rounded-xl` |

### `segmentItemVariants`

Defined in `@/components/ui/segmented`. Base classes:

```text
[ 'bl-btn relative box-border flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-0 bg-transparent [font-family:inherit] font-medium whitespace-nowrap text-foreground outline-none [&_svg]:shrink-0', 'data-checked:font-semibold data-selected:font-semibold data-pressed:font-semibold', // An unselected segment dims under the finger (as on iOS) until the card slides to it. 'transition-opacity duration-spring-snappy ease-spring-snappy motion-reduce:transition-none', 'active:not-data-disabled:not-data-checked:not-data-selected:not-data-pressed:opacity-60', // Stacked, each segment keeps its height instead of sharing the track's. 'group-data-[orientation=vertical]/segments:flex-none', // The solid ring of every control, without the offset: the neighbours are 2px away. 'focus-visible:ring-2 focus-visible:ring-ring', 'pointer-coarse:group-data-[orientation=horizontal]/segments:after:absolute pointer-coarse:group-data-[orientation=horizontal]/segments:after:inset-x-0', 'data-disabled:cursor-default not-in-data-disabled:data-disabled:opacity-40', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-7 px-2.5 text-footnote leading-[inherit] rounded-[calc(var(--radius-lg)-2px)] pointer-coarse:after:-inset-y-2` |
| `default` (default) | `h-8 px-3 text-subhead leading-[inherit] rounded-[calc(var(--radius-ctl)-2px)] pointer-coarse:after:-inset-y-1.5` |
| `lg` | `h-10 px-3.5 text-callout leading-[inherit] rounded-[calc(var(--radius-xl)-2px)] pointer-coarse:after:-inset-y-0.5` |

### `segmentIndicatorVariants`

Defined in `@/components/ui/segmented`. Base classes:

```text
bg-segment shadow-[0_1px_4px_black] shadow-black/14
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `rounded-[calc(var(--radius-lg)-2px)]` |
| `default` (default) | `rounded-[calc(var(--radius-ctl)-2px)]` |
| `lg` | `rounded-[calc(var(--radius-xl)-2px)]` |
