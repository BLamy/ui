# Toggle

A two-state button on react-aria's `ToggleButton`. Off it looks like a quiet button; on it is tinted (`bg-primary/15`, primary text), like an iOS toolbar toggle. Use it for a state that stays (pin, mute, bold), not for an action (use [Button](https://blamy.github.io/ui/#/button)) and not for a setting in a list (use [Switch](https://blamy.github.io/ui/#/switch)). Several related toggles belong in a [ToggleGroup](https://blamy.github.io/ui/#/toggle-group).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/toggle.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Toggle } from '@/components/ui/toggle'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Toggle } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Variants and sizes

`variant` sets the resting look: `default` is transparent, `filled` has a secondary background (for a toggle standing alone on a card) and `outline` a hairline frame that disappears when it is on. `size` is `sm` 32px, `default` 36px or `lg` 44px. Control it with `isSelected` and `onChange(boolean)`, or `defaultSelected`.

{% demo src="toggle/toolbar" %}

```tsx
<Toggle aria-label="Pin" isSelected={pinned} onChange={setPinned}>
  <Icon name="pin" size={16} />
</Toggle>
<Toggle variant="filled"><Icon name="bell" size={16} />Mute</Toggle>
```

## Accessibility

It is a `button` with `aria-pressed`, so Space and Enter toggle it and assistive technology reads "pressed" / "not pressed". Keep the label the same in both states (the pressed state carries the change); an icon-only toggle needs `aria-label`. Focus shows a 3px ring for keyboard focus only.

## Props

Every react-aria `ToggleButton` prop applies (`isSelected`, `defaultSelected`, `onChange`, `isDisabled`, `id`, `children`, `className` as a string or function), plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default` · `filled` · `outline`. |
| `size` | `default` | `sm` · `default` · `lg`. |

## Styling

`data-slot="toggle"` with react-aria's `data-selected`, `data-pressed`, `data-hovered`, `data-focus-visible` and `data-disabled`. A press scales it to 96%. `toggleVariants({ variant, size })` returns the class list; `ToggleGroupItem` builds on it.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `toggleVariants`

Defined in `@/components/ui/toggle`. Base classes:

```text
[ 'bl-btn box-border inline-flex cursor-pointer items-center justify-center gap-1.5 border-0 [font-family:inherit] font-semibold whitespace-nowrap text-foreground outline-none', 'transition-[background-color,color,box-shadow,scale] duration-spring-snappy ease-spring-snappy data-pressed:not-aria-expanded:scale-[.96] motion-reduce:transition-none [&_svg]:shrink-0', 'data-hovered:bg-accent data-pressed:bg-secondary-strong', 'data-selected:bg-primary/15 data-selected:text-primary data-selected:data-pressed:bg-primary/25', 'data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 data-disabled:cursor-default data-disabled:opacity-40', ]
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-transparent` |
| `filled` | `bg-secondary` |
| `outline` | `bg-transparent shadow-hairline data-selected:shadow-[inset_0_0_0_1px_transparent]` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 min-w-8 rounded-lg px-2 text-footnote` |
| `default` (default) | `h-9 min-w-9 rounded-ctl px-2.5 text-subhead` |
| `lg` | `h-11 min-w-11 rounded-xl px-3.5 text-body` |
