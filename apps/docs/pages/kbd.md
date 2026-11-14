# Kbd

A keycap for keyboard shortcuts: a 20px rounded chip with a hairline under it, in the small muted text, as a real `<kbd>`. Spell a key out as its children, or pass `keys` a UI SDK shortcut string (`mod+k`) and it shows the shortcut for the reader's platform: ⌘K on Apple, Ctrl+K elsewhere. `KbdGroup` spaces several keys into a chord. Use it in [command menus](https://blamy.github.io/ui/#/command-menu), tooltips and help text; a menu item draws its own shortcut from its `shortcut` prop.

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

One `Kbd` per key, wrapped in a `KbdGroup` when there are several, or one `Kbd` with `keys` for the whole shortcut. `keys` takes the same strings as UI SDK's `useShortcut` and a menu item's `shortcut` (`mod+s`, `shift+enter`, `alt+arrowup`), formatted the same way on the server and on the first client render. A `Kbd` can also hold an icon (it is sized to 12px).

{% demo src="kbd/shortcuts" %}

```tsx
<Kbd keys="shift+mod+p" />

<KbdGroup>
  <Kbd>⇧</Kbd><Kbd>⌘</Kbd><Kbd>P</Kbd>
</KbdGroup>

<DropdownMenuItem shortcut="mod+s">Save</DropdownMenuItem>
```

In a menu, give the item a `shortcut` instead of a `Kbd`: the item draws the hint in the menu's own style and sets `aria-keyshortcuts`.

## Accessibility

The keycaps are display only: they do not make a shortcut work. Bind the key yourself (`useShortcut` from `@ui-sdk/react/shortcuts`, or `useHotkey` in the [command menu](https://blamy.github.io/ui/#/command-menu)), and use the keycaps to show it. A screen reader reads the glyphs as typed, so `⌘` may be announced by name; where that matters, put the spelled-out shortcut in `aria-label` on the `Kbd`. Keycaps have `pointer-events-none` and `select-none`, so they are never clickable or selectable.

## Props

| Component | Props |
| --- | --- |
| `Kbd` | `keys?: string`, a shortcut shown for the platform in place of `children`; any `<kbd>` attribute, `className`, `children`. |
| `KbdGroup` | any `<span>` props; an `inline-flex` row with a 4px gap. |

## Styling

`data-slot="kbd"` and `data-slot="kbd-group"`. The keycap is `inline-flex`, `h-5 min-w-5`, `rounded-[5px]`, `bg-secondary`, `text-muted-foreground`, with a `shadow-hairline-b` underline. Override any of it with `className` (merged last).
