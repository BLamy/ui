# Segmented

The iOS segmented control: a short row of mutually exclusive options in a tinted track, with one card under the selected option that slides (and resizes) to the next on a spring. It is a radio group, so it picks a *value* — a time range, a filter, a view mode — and does not own any panels. If each option reveals its own content, use [Tabs](https://blamy.github.io/ui/#/tabs), which has the same look (`variant="segmented"`) with tab and panel semantics; for the bottom navigation bar use [TabBar](https://blamy.github.io/ui/#/tab-bar), and for a richer tab container [TabView](https://blamy.github.io/ui/#/tab-view).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/segmented.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Segmented } from '@/components/ui/segmented'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Segmented } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

It is controlled: `value` is the id of the selected option, and `onChange` receives the new id (it is not called when the selected option is pressed again).

{% demo src="segmented/basic" %}

```tsx
const [range, setRange] = useState('week')

<Segmented
  aria-label="Time range"
  options={[
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
  ]}
  value={range}
  onChange={setRange}
/>
```

## Sizing and filtering a list

The track fills its container and gives each segment an equal share. Size it with `className` or `style` — `w-fit` hugs the labels, a fixed width pins it. Labels are any `ReactNode`, so an icon or a count works; keep them short, they never wrap.

{% demo src="segmented/filter" %}

## Accessibility

It renders react-aria's `RadioGroup` (`role="radiogroup"`, horizontal) with one `Radio` per option. Tab moves focus onto the selected option (the first, if none is selected); Left and Right — and Up and Down — move to the next option *and select it*, so there is no separate confirm step. The focused segment shows a focus ring. The group's name is `aria-label`, defaulting to "Segmented control" — always pass a real one ("Time range"). If changing the value changes what is on screen, say so in a label or a live region near the content.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `options` | — | `{ id: string, label: ReactNode }[]`, in display order. |
| `value` | — | `id` of the selected option. |
| `onChange` | — | `(id: string) => void`, called when a different option is chosen. |
| `aria-label` | `Segmented control` | The radio group's accessible name. |
| `className` / `style` | — | Applied to the track (merged last). |

There is no per-option disabled state and no uncontrolled mode; wrap it if you want either.

## Styling

The track is `data-slot="segmented"` (`rounded-[9px]`, `bg-secondary`, 2px padding) and the sliding card is `data-slot="segmented-indicator"`. Each segment is a react-aria `Radio`, so `data-selected`, `data-focus-visible` and `data-pressed` are available for selectors. The indicator class, `segmentIndicator`, is shared with [Tabs](https://blamy.github.io/ui/#/tabs) and the toggle group so all of them move the same way; it only transitions under normal motion.
