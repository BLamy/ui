# Kbd

A keycap for keyboard shortcuts: a 20px rounded chip with a hairline under it, in the small muted text. It is react-aria's `Keyboard` (a real `<kbd>`), so inside a menu item it becomes that item's shortcut. `KbdGroup` spaces several keys into a chord. Use it in [command menus](https://blamy.github.io/ui/#/command-menu), tooltips, menu rows and help text.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/kbd.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Kbd, KbdGroup } from '@/components/ui/kbd'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Kbd, KbdGroup } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Shortcuts

One `Kbd` per key, wrapped in a `KbdGroup` when there are several. A `Kbd` can also hold a whole chord as one string (`⌘S`), and an icon (it is sized to 12px).

{% demo src="kbd/shortcuts" %}

```tsx
<KbdGroup>
  <Kbd>⇧</Kbd><Kbd>⌘</Kbd><Kbd>P</Kbd>
</KbdGroup>

<DropdownMenuItem shortcut={<Kbd>⌘S</Kbd>}>Save</DropdownMenuItem>
```

In a menu, pass a single `Kbd` as the item's `shortcut`. react-aria gives a `Keyboard` inside an item an `id` and lists it in the item's `aria-describedby`. A `KbdGroup` of several keys inside an item would repeat that same `id` on each key, so use one `Kbd` with the full chord there.

## Accessibility

The keycaps are display only: they do not make a shortcut work. Bind the key yourself (see `useHotkey` in the [command menu](https://blamy.github.io/ui/#/command-menu)), and use the keycaps to show it. A screen reader reads the glyphs as typed, so `⌘` may be announced by name; where that matters, put the spelled-out shortcut in `aria-label` on the `Kbd`. Keycaps have `pointer-events-none` and `select-none`, so they are never clickable or selectable.

## Props

| Component | Props |
| --- | --- |
| `Kbd` | react-aria `KeyboardProps`: any `<kbd>` attribute, `className`, `children`. |
| `KbdGroup` | any `<span>` props; an `inline-flex` row with a 4px gap. |

## Styling

`data-slot="kbd"` and `data-slot="kbd-group"`. The keycap is `inline-flex`, `h-5 min-w-5`, `rounded-[5px]`, `bg-secondary`, `text-muted-foreground`, with a `shadow-hairline-b` underline. Override any of it with `className` (merged last).
