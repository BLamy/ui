# ContextMenu

The [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu), opened where you right-click instead of from a button. It anchors at the pointer, and it opens three ways so it works everywhere: a right-click (or Control-click), a held touch or pen press — iOS Safari never fires `contextmenu`, so a long press is handled for you — and the keyboard's menu key or Shift+F10, which opens it at the focused element. The rows, bands, shortcuts and submenus are DropdownMenu's own; the menu closes on choice, moves with the arrow keys and gives focus back to where it was. Use it for actions on an item in a list, a canvas or a dock. A menu that must be discoverable without a right-click belongs on a button: use [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/context-menu.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Anatomy

`ContextMenu` is the area — a `div` that listens for the gestures — and `ContextMenuContent` is its menu, placed inside it. Anything can sit beside the menu in the area, buttons included; a tap on them still works. The menu needs an `aria-label`.

```tsx
<ContextMenu className="rounded-xl">
  <button>Lisbon</button>
  <ContextMenuContent aria-label="Photo actions" onAction={(key) => run(key)}>
    <ContextMenuItem id="copy" icon={<Icon name="copy" size={20} />}>Copy</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem id="delete" variant="destructive" icon={<Icon name="trash" size={20} />}>Delete</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

`ContextMenuItem`, `ContextMenuSection`, `ContextMenuLabel`, `ContextMenuSeparator`, `ContextMenuShortcut` and `ContextMenuSub` are the DropdownMenu parts under another name, so everything on that page — descriptions, selectable sections, submenus — works here unchanged.

## Right-click, long-press, menu key

Right-click a tile, long-press it on a touch screen (half a second, still), or focus it and press the menu key or Shift+F10. The menu opens at the pointer — below and to its right, flipping to stay on screen — or at the bottom-left of the focused element from the keyboard. Escape or a click outside closes it and returns focus to the element that had it.

{% demo src="context-menu/actions" %}

A long press takes the pointer from whatever is under the finger, so lifting it doesn't also activate that control. Moving more than a few pixels first cancels the long press (it was a scroll). A second right-click while the menu is open moves it to the new spot, as the system menu does.

## Accessibility

The menu is react-aria's `menu`, so arrows, Home/End and typeahead move, Enter or Space chooses, and Esc closes. The area itself is not focusable and has no role: put the menu on something that is, and offer the same actions another way (a toolbar, a "more" button) — a right-click is a shortcut, never the only path. The menu key and Shift+F10 reach it from any focused element inside the area. Give the menu an `aria-label`.

## Props

### ContextMenu

A `div`: it takes the usual props, `className` included.

| Prop | Default | Effect |
| --- | --- | --- |
| `isDisabled` | `false` | Turns it off; the browser's own menu shows. |
| `onOpenChange` | — | Called with `true` when the menu opens and `false` when it closes. |
| `longPressDelay` | `500` | How long a touch or pen press must hold (ms). |
| `anchor` | `pointer` | Where the menu hangs: at the pointer, or at the pointer's x on the area's `top` or `bottom` edge — for a menu that should clear the area, like a dock's. Pair it with `placement` on the content. |

### ContextMenuContent

DropdownMenu's `DropdownMenuContent`: `aria-label`, `onAction`, `selectionMode` and friends, `popoverClassName`. `placement` defaults to `bottom start` from the pointer.

## Styling

Slots: `context-menu` (the area; `data-open` while its menu is up) plus DropdownMenu's own — `dropdown-menu`, `dropdown-menu-content`, `dropdown-menu-item` and the rest. The area is `position: relative` (the menu hangs off an invisible anchor inside it). Like every overlay, the menu wears the nearest ThemeScope.
