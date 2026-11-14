# Segmented

The iOS segmented control: a short row of mutually exclusive options in a tinted track, with one card under the selected option that slides (and resizes) to the next on a spring. It is UI SDK's `SegmentedControl`, a radio group, so it picks a *value* — a time range, a filter, a view mode — and does not own any panels. If each option reveals its own content, use [Tabs](https://blamy.github.io/ui/#/tabs), which has the same look (`variant="segmented"`) with tab and panel semantics; for the bottom navigation bar use [TabBar](https://blamy.github.io/ui/#/tab-bar), and for a richer tab container [TabView](https://blamy.github.io/ui/#/tab-view).

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

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Segmented, SegmentedItem } from '@brett_lamy/ui'
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

## Sizing and filtering a list

The track fills its container and gives each segment an equal share. Size it with `className` or `style` — `w-fit` hugs the labels, a fixed width pins it. Items take any children, so an icon or a count works; keep them short, they never wrap.

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
| `orientation` | `horizontal` | `vertical` stacks the segments. |
| `loop` | `true` | Arrow keys wrap from the last item to the first. |
| `controller` | — | From `createSegmentedControlController()`. |
| `aria-label` | — | The group's accessible name. |
| `className` / `style` | — | Applied to the track (merged last); `className` may be a function of the state. |

`SegmentedItem` takes `value` (required), `disabled`, `className` and `render`.

## Styling

The track is `data-slot="segmented-control"` (`rounded-[9px]`, `bg-secondary`, 2px padding), each segment `data-slot="segmented-control-item"`, and the sliding card UI SDK's `SegmentedControlIndicator` (`data-slot="segmented-control-indicator"`), which the root renders for you. The checked item has `data-checked` (the others `data-unchecked`); `data-disabled`, `data-readonly`, `data-required` and `data-orientation` are there for selectors, and hover, press and keyboard focus are plain `hover:`, `active:` and `focus-visible:`. The indicator is positioned from the CSS variables UI SDK writes on it (`--segmented-control-indicator-left`, `-top`, `-width`, `-height`). Its look, `segmentIndicator`, is shared with [Tabs](https://blamy.github.io/ui/#/tabs) and the toggle group so all of them move the same way; it only transitions under normal motion.
