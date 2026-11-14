# ContextMenu

The [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu), opened where you right-click instead of from a button: UI SDK's `Menu` with its context trigger. It anchors at the pointer, and it opens three ways so it works everywhere: a right-click (or Control-click), a held touch or pen press — iOS Safari never fires `contextmenu`, so a long press is handled for you — and the keyboard's menu key or Shift+F10, which opens it at the focused element. The rows, bands, shortcuts and submenus are DropdownMenu's own; the menu closes on choice, moves with the arrow keys and gives focus back to where it was. Use it for actions on an item in a list, a canvas or a dock. A menu that must be discoverable without a right-click belongs on a button: use [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/context-menu.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator,
} from '@/components/ui/context-menu'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Anatomy

`ContextMenu` is the root (a DropdownMenu: it renders no element, `onAction` and the open state live on it). `ContextMenuTrigger` is the area — a `div` that listens for the gestures — and `ContextMenuContent` is the menu, beside the area. Anything can sit in the area, buttons included; a tap on them still works. The menu has no button to take a name from, so give it an `aria-label`.

```tsx
<ContextMenu onAction={(value) => run(value)}>
  <ContextMenuTrigger className="rounded-xl">
    <button>Lisbon</button>
  </ContextMenuTrigger>
  <ContextMenuContent aria-label="Photo actions">
    <ContextMenuItem value="copy" icon={<Icon name="copy" size={20} />}>Copy</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem value="delete" destructive icon={<Icon name="trash" size={20} />}>Delete</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

`ContextMenuItem`, `ContextMenuCheckboxItem`, `ContextMenuRadioGroup`, `ContextMenuRadioItem`, `ContextMenuGroup`, `ContextMenuGroupLabel`, `ContextMenuSeparator`, `ContextMenuShortcut`, `ContextMenuSub`, `ContextMenuSubTrigger` and `ContextMenuSubContent` are the DropdownMenu parts under another name, so everything on that page — descriptions, checkbox and radio items, submenus, `items` data — works here unchanged.

## Right-click, long-press, menu key

Right-click a tile, long-press it on a touch screen (half a second, still), or focus it and press the menu key or Shift+F10. The menu opens at the pointer — below and to its right, flipping to stay on screen — or at the focused element from the keyboard, with its first row highlighted. Escape or a click outside closes it and returns focus to the element that had it (the button the menu key was pressed on), else to the area.

{% demo src="context-menu/actions" %}

A long press does not also activate the control under the finger, and moving first cancels it (it was a scroll). A second right-click elsewhere in the area while the menu is open moves it there. One menu can serve several areas: give each `ContextMenuTrigger` a `payload` and read it from the content's state, or connect them with `createMenuController()`.

## Hanging the menu off an edge

The menu always opens at the pointer. For a menu that should clear its area (a dock's menu above the dock), open it yourself from the area's `onContextMenu` with a controller: call `event.preventDefault()` (the trigger then leaves the event alone) and `controller.open({ anchor: { x: event.clientX, y: area.getBoundingClientRect().top }, focus: 'popup' })`, with `side="top"` on the content. A long press on a touch screen still opens at the finger.

## Accessibility

The menu is UI SDK's `menu`, so arrows, Home/End and typeahead move, Enter or Space chooses, and Esc closes. The area has no role and is not focusable by itself: give it `tabIndex={0}` when nothing inside it takes focus, so the menu key and Shift+F10 can reach it, and offer the same actions another way (a toolbar, a "more" button) — a right-click is a shortcut, never the only path. Give the menu an `aria-label`.

## Props

### ContextMenu

DropdownMenu's root props: `onAction`, `open` / `defaultOpen` / `onOpenChange`, `items`, `controller`, `container`.

### ContextMenuTrigger

A `div`: it takes the usual props, `className` included.

| Prop | Default | Effect |
| --- | --- | --- |
| `disabled` | `false` | Turns it off; the browser's own menu shows. |
| `payload` | — | Reaches the content's state, for one menu shared by several areas. |
| `controller` | — | Connects an area outside the root. |

### ContextMenuContent

`DropdownMenuContent`: `aria-label`, `side` / `align`, `sideOffset`, `finalFocus` (defaults to what had focus when it opened), `className`.

## Styling

`ContextMenuTrigger` is UI SDK's `menu-context-trigger` slot, with `data-open` while its menu is up and `data-disabled`. The menu wears DropdownMenu's slots (`menu-content`, `menu-item`, …) and the nearest ThemeScope.
