# DropdownMenu

An iOS pull-down menu: a short list of actions — rows with a trailing icon, an optional description or keyboard shortcut, thick bands between groups, and a red destructive row. It is UI SDK's `Menu`, so it closes on choice, moves with the arrow keys and typeahead, opens submenus to the side and gives focus back to where it came from. It opens from a button (`DropdownMenuTrigger`) or where you right-click (`DropdownMenuContextTrigger`: see [Context menus](#context-menus)), and `size="sm"` makes it the dense desktop menu.

Use it for a "more" button, the actions on an item, or view options. To pick a value for a form field use [Select](https://blamy.github.io/ui/#/select) (or [Combobox](https://blamy.github.io/ui/#/combobox) to type to filter); for free-form content use [Popover](https://blamy.github.io/ui/#/popover); for a searchable launcher of many commands use [CommandMenu](https://blamy.github.io/ui/#/command-menu).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/dropdown-menu.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Anatomy

`DropdownMenu` is the root: it renders no element and holds the open state. `DropdownMenuTrigger` is the button. It has no look of its own: `render` one of ours into it, `render={<Button … />}`, which keeps Button's sizes and states (every popup trigger in the kit is styled this way). `DropdownMenuContent` is the menu. Give items a `value` and handle `onAction` on the root (it receives the chosen item's `value`, submenu rows included), or `onSelect` on one item. The menu is named by its trigger; an icon-only trigger needs an `aria-label`.

```tsx
<DropdownMenu onAction={(value) => run(value)}>
  <DropdownMenuTrigger render={<Button variant="secondary" size="icon" />} aria-label="More">
    <Icon name="ellipsis" />
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem value="copy" icon={<Icon name="copy" size={20} />}>Copy</DropdownMenuItem>
    <DropdownMenuItem value="share" icon={<Icon name="share" size={20} />}>Share…</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem value="delete" destructive icon={<Icon name="trash" size={20} />}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Return a promise from `onAction` or `onSelect` to keep the row pending (`data-pending`, the menu stays open) until it settles.

## Actions, shortcuts, submenus

Rows take an `icon` (trailing, 22px), a `description` line, a `shortcut` and `destructive`. `shortcut` takes keys such as `mod+shift+r` and shows them for the platform with `aria-keyshortcuts`: `⇧⌘R` on Apple platforms, modifiers always in Apple's order (⌃⌥⇧⌘) as in a Tooltip or the CommandMenu, and `Ctrl+Shift+R` elsewhere. In markup it is only a hint, so bind the keys yourself (a [data menu](#menus-as-data) binds them for you). `DropdownMenuShortcut` draws the same hint by hand. `DropdownMenuSeparator` is the thick group band, not a hairline; rows get hairlines between them automatically. A submenu is a `DropdownMenuSub` holding a `DropdownMenuSubTrigger` (the row, with a chevron) and a `DropdownMenuSubContent`; it opens on hover or with the arrow toward it and closes with the arrow back or Esc. `disabled` dims a row (40%): it stays reachable with the arrows but does not run. `render={<a href="…" />}` makes a row a link.

{% demo src="dropdown-menu/actions" %}

## Checkbox and radio items

`DropdownMenuCheckboxItem` toggles on its own (`checked` / `defaultChecked` / `onCheckedChange`); `DropdownMenuRadioItem`s inside a `DropdownMenuRadioGroup` share one `value` / `defaultValue` / `onValueChange`. Both keep the menu open (`closeOnSelect` closes it) and show a leading checkmark; every row of a group keeps the checkmark's column, so labels line up. A `DropdownMenuGroupLabel` names its group or radio group.

{% demo src="dropdown-menu/selectable" %}

```tsx
<DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
  <DropdownMenuGroupLabel>Sort by</DropdownMenuGroupLabel>
  <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
  <DropdownMenuRadioItem value="date">Date modified</DropdownMenuRadioItem>
</DropdownMenuRadioGroup>
<DropdownMenuSeparator />
<DropdownMenuCheckboxItem value="hidden" checked={hidden} onCheckedChange={setHidden}>
  Show hidden files
</DropdownMenuCheckboxItem>
```

## Sizes

`size` on `DropdownMenuContent` sets the density of everything inside it, submenus included. `default` is the iOS pull-down: 44px rows of body text, bands between groups, at least 230px wide. `sm` is the dense desktop menu: 32px rounded rows of footnote text inside a padded surface, hairline separators and a tinted checkmark, at least 190px wide, for a toolbar, a status bar or a composer's option pills.

{% demo src="dropdown-menu/compact" %}

## Context menus

The same menu opens where you right-click when you put a `DropdownMenuContextTrigger` in place of the trigger. The context trigger is an area (a `div`) that listens for the gestures, with anything inside it, buttons included; a tap on them still works. It opens the menu three ways, so it works everywhere: a right-click (or Control-click) opens it at the pointer, below and to the right, flipping to stay on screen; a held touch or pen press does too (iOS Safari never fires `contextmenu`, so the long press is handled for you); and the menu key or Shift+F10 opens it at the focused element with its first row highlighted (macOS fires no `contextmenu` for Shift+F10, so the trigger sends one). Closing it gives focus back to what had it when it opened (the button the menu key was pressed on), else to the area; a menu opened by its button keeps UI SDK's return to the button.

```tsx
<DropdownMenu onAction={(value) => run(value)}>
  <DropdownMenuContextTrigger className="rounded-xl">
    <button>Lisbon</button>
  </DropdownMenuContextTrigger>
  <DropdownMenuContent aria-label="Photo actions">
    <DropdownMenuItem value="copy" icon={<Icon name="copy" size={20} />}>Copy</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem value="delete" destructive icon={<Icon name="trash" size={20} />}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

{% demo src="dropdown-menu/context-menu" %}

Everything else on this page works the same: rows, checkbox and radio items, submenus, `items` data, `size`. The menu has no button to take a name from, so give its content an `aria-label`. A long press does not also activate the control under the finger, and moving first cancels it (it was a scroll). A second right-click elsewhere in the area while the menu is open moves it there. One menu can serve several areas: give each `DropdownMenuContextTrigger` a `payload` and read it from the content's state, or connect areas outside the root with a `controller`.

The area has no role and is not focusable by itself: give it `tabIndex={0}` when nothing inside it takes focus, so the menu key and Shift+F10 can reach it, and offer the same actions another way (a toolbar, a "more" button): a right-click is a shortcut, never the only path.

The menu always opens at the pointer. For a menu that should clear its area (a dock's menu above the dock), open it yourself from the area's `onContextMenu` with a controller: call `event.preventDefault()` (the trigger then leaves the event alone) and `controller.open({ anchor: { x: event.clientX, y: area.getBoundingClientRect().top }, focus: 'popup' })`, with `side="top"` on the content. A long press on a touch screen still opens at the finger.

## Menus as data

`items` on the root takes a `DropdownMenuData` list — strings, actions, separators, groups, checkboxes, radio groups and submenus: UI SDK's `MenuData`, whose actions and checkboxes also take the kit's `icon` and `description` — and an empty `DropdownMenuContent` draws them with the same rows. A data menu also runs its items' `shortcut`s while it is closed (`itemShortcuts={false}` turns that off). `onCheckedChange` and `onValueChange` on the root report data checkboxes (`details.value`) and radio groups (`details.group`). `DropdownMenuItems` draws a `DropdownMenuData` list inside content of your own.

```tsx
const fileMenu: DropdownMenuData = [
  { value: 'open', label: 'Open…', shortcut: 'mod+o', icon: <Icon name="folder" size={20} /> },
  { value: 'duplicate', label: 'Duplicate', description: 'Next to the original' },
  { type: 'separator' },
  { type: 'checkbox', value: 'toolbar', label: 'Toolbar', defaultChecked: true },
  { type: 'radio-group', name: 'sort', label: 'Sort by', defaultValue: 'name', items: [{ value: 'name', label: 'Name' }, { value: 'date', label: 'Date' }] },
  { type: 'submenu', label: 'Share', items: ['Copy link', 'Email'] },
]

<DropdownMenu items={fileMenu} onAction={run}>
  <DropdownMenuTrigger render={<Button variant="secondary" />}>File</DropdownMenuTrigger>
  <DropdownMenuContent />
</DropdownMenu>
```

## Opening from elsewhere

`open` / `defaultOpen` / `onOpenChange(open, details)` control the menu; `details.reason` says why it changed (`trigger-press`, `item-press`, `escape-key`, `outside-press`, …) and `details.cancel()` refuses the change. `createDropdownMenuController()` passed as `controller` opens it from code (`controller.open({ focus: 'first' })`) or from triggers outside the root, each with its own `payload`.

## In a trigger's palette

The menu renders into BLProvider's root and wears the [ThemeScope](https://blamy.github.io/ui/#/theming) it was opened from, so a menu opened from a dark panel inside a light app is dark with no extra work, as long as the panel is a `ThemeScope`. When the trigger sits on a surface that CSS paints instead (a host app's own `[data-theme-scope]` rule, a block's stylesheet, a shell that sets `.dark` and variables on a plain element), pass `palette="trigger"`: each time it opens, the menu copies the theme variables resolved at its trigger, the trigger's appearance (`light` / `dark`) and its named scope. `PopoverContent` takes the same prop; `useTriggerPalette` is the hook behind it, for a popup part of your own. A menu with no trigger to read (a context menu, a controller's `open`) keeps the ThemeScope's palette.

```tsx
<DropdownMenuContent size="sm" side="top" palette="trigger">…</DropdownMenuContent>
```

## Small screens

`presentation="auto"` on the root shows the menu as a bottom sheet on small touch screens, `"sheet"` always does. The sheet is shaped like the kit's Sheet, grabber included, but has no scrim inside BLProvider or another layer host, where the menu isn't in the top layer. Submenus then replace the level they open from.

## Accessibility

UI SDK renders a `menu` of `menuitem` / `menuitemcheckbox` / `menuitemradio` rows. The trigger gets `aria-haspopup="menu"` and `aria-expanded`; Enter, Space, a press or the Down arrow opens it (Up opens on the last row); arrows, Home/End and typeahead move; Enter or Space chooses; Esc closes and returns focus to the trigger (`finalFocus` on the content sends it elsewhere). A row is named by its label: its `description` is wired as the row's description (`aria-describedby`), so a screen reader reads "Show Info" and then "Captured Sep 22", and typeahead matches the label only. Icons and shortcuts are outside the name (the keys are announced from `aria-keyshortcuts`); a row whose children are not plain text needs a `label` for typeahead.

## Props

### DropdownMenu

UI SDK's `Menu` props. The popup renders into BLProvider's root unless you pass `container`.

| Prop | Default | Effect |
| --- | --- | --- |
| `open` / `defaultOpen` / `onOpenChange` | closed | Control visibility; `onOpenChange(open, details)`. |
| `onAction` | — | `(value, details)`: the chosen item's `value`. |
| `items` | — | `DropdownMenuData` the empty content draws. |
| `onCheckedChange` / `onValueChange` | — | Data checkbox / radio-group changes. |
| `itemShortcuts` | `true` | A data menu binds its shortcuts while closed. |
| `presentation` | `popover` | `auto` or `sheet` for a bottom sheet. |
| `modal` / `loop` / `delay` / `controller` | — | UI SDK's. |

### DropdownMenuTrigger

UI SDK's `MenuTrigger`, a `button`: `render`, `payload`, `controller`, `disabled`, and the usual button props.

### DropdownMenuContextTrigger

A `div` that opens the menu on a right-click, a long press, the menu key or Shift+F10. It takes the usual props, `className` included.

| Prop | Default | Effect |
| --- | --- | --- |
| `disabled` | `false` | Turns it off; the browser's own menu shows. |
| `payload` | — | Reaches the content's state, for one menu shared by several areas. |
| `controller` | — | Connects an area outside the root. |

### DropdownMenuContent and DropdownMenuSubContent

| Prop | Default | Effect |
| --- | --- | --- |
| `size` | `default` (a submenu: its parent's) | `sm` is the dense desktop menu. |
| `palette` | `scope` | `trigger` copies the trigger's palette when it opens. |
| `side` / `align` | `bottom` / `start` (a submenu: beside its row) | Starting position; it flips to fit, `data-side` reports the result. |
| `sideOffset` | `8` (a submenu: `-6`, overlapping its row) | Gap to the trigger, px. |
| `finalFocus` | the trigger; opened by a context trigger, what had focus | Where focus goes on close. |
| `keepMounted` | `false` | Keep the closed menu in the DOM, hidden. |
| `className` / `style` / `ref` | — | Merged onto the surface (it scrolls when taller than the room it has). |

### DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | — | Passed to `onAction` (required on checkbox and radio items). |
| `label` | the children, when text | Typeahead text. |
| `icon` | — | Trailing icon. |
| `description` | — | Secondary line under the label; the row's accessible description. |
| `shortcut` (`DropdownMenuItem`) | — | Keys such as `mod+r`, shown for the platform. |
| `destructive` (`DropdownMenuItem`) | `false` | Tints the row with `text-destructive`. |
| `disabled` | `false` | Dims the row; it stays reachable but does not run. |
| `closeOnSelect` | items: `true`, checkbox / radio: `false` | Whether choosing closes the menu. |
| `onSelect` (`DropdownMenuItem`) | — | Runs on this item. |
| `checked` / `defaultChecked` / `onCheckedChange` (checkbox) | — | Its state. |
| `render` | — | Another element, e.g. `<a href>`. |

`DropdownMenuRadioGroup` (`value` / `defaultValue` / `onValueChange`, `name`), `DropdownMenuGroup`, `DropdownMenuGroupLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuSub` (`open` / `defaultOpen` / `onOpenChange`) and `DropdownMenuSubTrigger` (`description`, `disabled`) complete the set. `DropdownMenuItems` (`items`) draws a data list; `createDropdownMenuController()` makes a `DropdownMenuController`.

## Styling

Parts carry UI SDK's slots: `menu-trigger` (a submenu's row too), `menu-context-trigger` (with `data-open` while its menu is up, and `data-disabled`), `menu-content` (a submenu's too, with `data-size`), `menu-item`, `menu-checkbox-item`, `menu-radio-group`, `menu-radio-item`, `menu-group`, `menu-group-label`, `menu-separator`, `menu-shortcut`. Rows expose `data-highlighted` (the active row), `data-open` (a row whose submenu is open), `data-checked`, `data-disabled`, `data-destructive` and `data-pending`; hold-to-press is `:active`. The content has `data-side`, `data-presentation`, and `data-starting-style` / `data-ending-style` for its grow-from-trigger animation. `dropdownMenuContentVariants({ size })` and `dropdownMenuItemVariants({ size })` are the recipes. The surface takes its radius from the `--radius` scale (`rounded-card`) and its shadow from `shadow-popover`, like every popup in the kit.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `dropdownMenuContentVariants`

Defined in `@/components/ui/dropdown-menu`. Base classes:

```text
[popoverSurface, popoverMotion, popoverSheet, 'bl-scroll box-border overflow-y-auto py-1']
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `min-w-[230px]` |
| `sm` | `min-w-[190px] px-1` |

### `dropdownMenuItemVariants`

Defined in `@/components/ui/dropdown-menu`. Base classes:

```text
[ 'bl-btn relative box-border flex cursor-pointer items-center text-foreground outline-none', 'data-highlighted:bg-accent data-highlighted:not-data-disabled:active:bg-secondary-strong data-open:bg-accent data-disabled:cursor-default data-disabled:opacity-40 data-destructive:text-destructive data-pending:cursor-progress', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `[ 'min-h-11 gap-3 py-[11px] pr-4 pl-4 text-body leading-[22px]', // Hairline between rows — not under the last row, nor above a group band.…` |
| `sm` | `min-h-8 gap-2 rounded-lg px-2.5 py-1.5 text-footnote leading-[18px]` |
