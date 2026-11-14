# Toggle

A button that stays pressed, on UI SDK's `Toggle`, and `ToggleGroup`, a row of them that share one value. Use a Toggle for a state that stays (pin, mute, bold, show the sidebar): it is a `button` with `aria-pressed`. For an action use [Button](https://blamy.github.io/ui/#/button); for an on/off setting in a list or form use [Switch](https://blamy.github.io/ui/#/switch) or [Checkbox](https://blamy.github.io/ui/#/checkbox). For one required choice from a few where arrow keys should select, use [Segmented](https://blamy.github.io/ui/#/segmented); for a choice in a form, [RadioGroup](https://blamy.github.io/ui/#/radio-group).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/toggle.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Toggle, ToggleIcon, ToggleGroup, ToggleGroupItem,
} from '@/components/ui/toggle'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Toggle, ToggleIcon, ToggleGroup, ToggleGroupItem } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

```tsx
<Toggle aria-label="Pin" pressed={pinned} onPressedChange={setPinned}>
  <Icon name="pin" size={16} />
</Toggle>
```

## Variants and sizes

`variant` sets the resting look and what "on" looks like:

| `variant` | At rest | On |
| --- | --- | --- |
| `default` | transparent | tinted (`bg-primary/15`, primary text), like an iOS toolbar toggle |
| `filled` | a secondary fill, for a toggle standing alone on a card | tinted |
| `outline` | a hairline frame | tinted, the frame gone |
| `quiet` | muted text, a fill on hover: Button's `quiet` | a grey fill: the toolbar tool that is switched on |

`size` is `sm` 32px, `default` 36px or `lg` 44px for a text label, and Button's icon sizes for a lone glyph: `icon-sm` (a 28px square, the toolbar tool), `icon` (a 36px circle) and `icon-lg` (a 44px circle). Control it with `pressed` and `onPressedChange(pressed, details)`, or leave it uncontrolled with `defaultPressed`.

{% demo src="toggle/toolbar" %}

```tsx
<Toggle variant="quiet" size="icon-sm" aria-label="Bookmark" pressed={saved} onPressedChange={setSaved}>
  <Icon name="bookmark" size={18} sw={1.7} />
</Toggle>
<Toggle variant="filled">
  <ToggleIcon><Icon name="bell" size={16} /></ToggleIcon>
  Mute
</Toggle>
```

In a toolbar, an action beside a quiet toggle is a `quiet` Button of the same size, so the two read as one family ([Button: icon buttons and toolbars](https://blamy.github.io/ui/#/button)).

`ToggleIcon` wraps a glyph beside the text: it is hidden from screen readers (the text names the toggle), `mirror` flips it in right-to-left text, and the toggle gets `data-has-icon`. `details.reason` is `press` or `imperative`; `details.cancel()` keeps the current state. To press it from elsewhere (a keyboard shortcut), create a controller with `createToggleController()` and pass it as `controller`.

## ToggleGroup

A row of toggles on UI SDK's `ToggleGroup`: one tab stop, arrow keys between the items, and one value for the whole row. One item is pressed at a time unless you set `multiple`; with `multiple` each item toggles on its own (text styles). The value is always an array of the pressed items' `value`s, in document order (`value` / `defaultValue` / `onValueChange(value, details)`). Pressing the pressed item of a single group again clears it; add `deselectable={false}` (with a `defaultValue`) to keep one always on. Items take the group's `variant` and `size`.

{% demo src="toggle/group-modes" %}

```tsx
<ToggleGroup variant="filled" aria-label="View" defaultValue={['grid']} deselectable={false}>
  <ToggleGroupItem value="list">List</ToggleGroupItem>
  <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
</ToggleGroup>

<ToggleGroup variant="outline" multiple aria-label="Text style">
  <ToggleGroupItem value="bold" aria-label="Bold">B</ToggleGroupItem>
  <ToggleGroupItem value="italic" aria-label="Italic">I</ToggleGroupItem>
</ToggleGroup>
```

The group's `variant` is a Toggle variant, with two of its own looks: `filled` is a secondary tray where, in a single group, one card slides between the items; `outline` joins the items in one hairline frame. `details.reason` is `item-press` or `imperative` (a write from a controller made with `createToggleGroupController()` and passed as `controller`); `details.cancel()` keeps the current value.

## Accessibility

A Toggle is a native `button` with `aria-pressed`, so Space and Enter toggle it and assistive technology reads "pressed" / "not pressed". Keep the label the same in both states (the pressed state carries the change); an icon-only toggle needs `aria-label`. A `disabled` toggle leaves the tab order; add `focusableWhenDisabled` to keep it reachable (it reports `aria-disabled` and ignores presses). Keyboard focus shows Button's solid 2px ring; inside an `outline` group the ring is drawn inside the frame.

ToggleGroup is a `group` of those buttons, in single and multiple mode alike; it needs a name (`aria-label` or `aria-labelledby`). It is one Tab stop, entering on the first pressed item; the arrow keys and Home / End move focus without pressing, and Space / Enter press. Disabled items stay reachable with the arrow keys (`aria-disabled`) but ignore presses.

## Props

### Toggle

Every UI SDK `Toggle` prop applies (`pressed`, `defaultPressed`, `onPressedChange`, `disabled`, `focusableWhenDisabled`, `value` inside a group, `controller`, `render`, `children`, `className` as a string or a function of the state), plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default` · `filled` · `outline` · `quiet`. |
| `size` | `default` | `sm` · `default` · `lg` · `icon-sm` · `icon` · `icon-lg`. |

### ToggleGroup

Every UI SDK `ToggleGroup` prop applies, plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default` (a gap, tinted when on) · `quiet` (a gap, the quiet look) · `filled` (a tray with a sliding card) · `outline` (joined in a hairline frame). |
| `size` | `default` | Any Toggle size; passed to every item. |
| `multiple` | `false` | Let several items stay pressed. |
| `value` / `defaultValue` / `onValueChange` | — | The pressed items' values, as an array. |
| `deselectable` | `true` | `false` keeps one pressed once any is (single mode). |
| `orientation` / `loop` / `disabled` | `horizontal` / `true` / `false` | Arrow-key axis, wrapping at the ends, and disabling every item. |
| `controller` | — | From `createToggleGroupController()`. |

### ToggleGroupItem

A Toggle: `value` (what the group's value lists while it is pressed), `disabled`, `focusableWhenDisabled`, `className`, `children`, plus `variant` and `size` to override the group's for one item. Its own `pressed` / `defaultPressed` don't apply inside a group.

## Styling

A Toggle is `data-slot="toggle"`, with `data-pressed` while it is on, `data-disabled` and `data-has-icon` from UI SDK; hover, a held press and keyboard focus are the native `hover:`, `active:` and `focus-visible:`. A press scales it to 97%, as Button does. The group is `data-slot="toggle-group"` (with `data-variant` and `data-orientation`); the sliding card is `data-slot="selection-indicator"`, positioned from the `--selection-indicator-left`, `-top`, `-width` and `-height` variables it writes on itself. `toggleVariants({ variant, size })` and `toggleGroupVariants({ variant })` return the class lists; `ToggleVariant` and `ToggleSize` are the value types.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `toggleVariants`

Defined in `@/components/ui/toggle`. Base classes:

```text
[ 'bl-btn box-border inline-flex cursor-pointer items-center justify-center gap-1.5 border-0 [font-family:inherit] font-semibold whitespace-nowrap [&_svg]:shrink-0', 'transition-[background-color,color,box-shadow,scale] duration-spring-snappy ease-spring-snappy active:not-aria-expanded:not-data-disabled:scale-[.97] motion-reduce:transition-none', pressableFocusRing, 'data-disabled:cursor-default data-disabled:opacity-40', ]
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-transparent text-foreground`, an accent hover, tinted while pressed |
| `filled` | `bg-secondary text-foreground`, tinted while pressed |
| `outline` | `bg-transparent text-foreground shadow-hairline`, tinted and frameless while pressed |
| `quiet` | `bg-transparent text-muted-foreground`, a secondary hover, `data-pressed:bg-secondary data-pressed:text-foreground` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 min-w-8 rounded-lg px-2 text-footnote` |
| `default` (default) | `h-9 min-w-9 rounded-ctl px-2.5 text-subhead` |
| `lg` | `h-11 min-w-11 rounded-xl px-3.5 text-body` |
| `icon-sm` | `size-7 rounded-lg p-0` |
| `icon` | `size-9 rounded-full p-0` |
| `icon-lg` | `size-11 rounded-full p-0` |

### `toggleGroupVariants`

Defined in `@/components/ui/toggle`. Base classes:

```text
relative isolate inline-flex w-fit items-center
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `gap-1` |
| `quiet` | `gap-1` |
| `filled` | `gap-0.5 rounded-[11px] bg-secondary p-0.5` |
| `outline` | `gap-0 rounded-ctl shadow-hairline` |
