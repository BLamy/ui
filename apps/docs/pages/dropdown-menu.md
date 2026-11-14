# DropdownMenu

An iOS pull-down menu: a button that opens a short list of actions — rows with a trailing icon, an optional description or keyboard shortcut, thick bands between groups, and a red destructive row. It is UI SDK's `Menu`, so the menu closes on choice, moves with the arrow keys and typeahead, opens submenus to the side and gives focus back to the button. Use it for a "more" button, a context of actions, or view options. To pick a value for a form field use [Select](https://blamy.github.io/ui/#/select); for free-form content use [Popover](https://blamy.github.io/ui/#/popover); for a searchable palette use [CommandMenu](https://blamy.github.io/ui/#/command-menu).

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

`DropdownMenu` is the root: it renders no element and holds the open state. `DropdownMenuTrigger` is the button — it has no look of its own, so `render` one of ours into it — and `DropdownMenuContent` is the menu. Give items a `value` and handle `onAction` on the root (it receives the chosen item's `value`, submenu rows included), or `onSelect` on one item. The menu is named by its trigger; an icon-only trigger needs an `aria-label`.

```tsx
<DropdownMenu onAction={(value) => run(value)}>
  <DropdownMenuTrigger className={buttonVariants({ variant: 'secondary', size: 'icon' })} aria-label="More">
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

Rows take an `icon` (trailing, 22px), a `description` line, a `shortcut` and `destructive`. `shortcut` takes keys such as `mod+r` and shows them for the platform (⌘R on Apple, Ctrl+R elsewhere) with `aria-keyshortcuts`; in markup it is only a hint, so bind the keys yourself (a [data menu](#menus-as-data) binds them for you). `DropdownMenuShortcut` draws the same hint by hand. `DropdownMenuSeparator` is the thick group band, not a hairline; rows get hairlines between them automatically. A submenu is a `DropdownMenuSub` holding a `DropdownMenuSubTrigger` (the row, with a chevron) and a `DropdownMenuSubContent`; it opens on hover or with the arrow toward it and closes with the arrow back or Esc. `disabled` dims a row (40%): it stays reachable with the arrows but does not run. `render={<a href="…" />}` makes a row a link.

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

## Menus as data

`items` on the root takes UI SDK's `MenuData` — strings, actions, separators, groups, checkboxes, radio groups and submenus — and an empty `DropdownMenuContent` draws them with the same rows. A data menu also runs its items' `shortcut`s while it is closed (`itemShortcuts={false}` turns that off). `onCheckedChange` and `onValueChange` on the root report data checkboxes (`details.value`) and radio groups (`details.group`). `DropdownMenuItems` draws a `MenuData` list inside content of your own.

```tsx
const fileMenu: MenuData = [
  { value: 'open', label: 'Open…', shortcut: 'mod+o' },
  { type: 'separator' },
  { type: 'checkbox', value: 'toolbar', label: 'Toolbar', defaultChecked: true },
  { type: 'radio-group', name: 'sort', label: 'Sort by', defaultValue: 'name', items: [{ value: 'name', label: 'Name' }, { value: 'date', label: 'Date' }] },
  { type: 'submenu', label: 'Share', items: ['Copy link', 'Email'] },
]

<DropdownMenu items={fileMenu} onAction={run}>
  <DropdownMenuTrigger className={buttonVariants({ variant: 'secondary' })}>File</DropdownMenuTrigger>
  <DropdownMenuContent />
</DropdownMenu>
```

## Opening from elsewhere

`open` / `defaultOpen` / `onOpenChange(open, details)` control the menu; `details.reason` says why it changed (`trigger-press`, `item-press`, `escape-key`, `outside-press`, …) and `details.cancel()` refuses the change. `createMenuController()` passed as `controller` opens it from code (`controller.open({ focus: 'first' })`) or from triggers outside the root, each with its own `payload`.

## Small screens

`presentation="auto"` on the root shows the menu as a bottom sheet on small touch screens (shaped like the kit's Sheet, but with no scrim inside BLProvider or another layer host, where the menu isn't in the top layer), `"sheet"` always does. Submenus then replace the level they open from.

## Accessibility

UI SDK renders a `menu` of `menuitem` / `menuitemcheckbox` / `menuitemradio` rows. The trigger gets `aria-haspopup="menu"` and `aria-expanded`; Enter, Space, a press or the Down arrow opens it (Up opens on the last row); arrows, Home/End and typeahead move; Enter or Space chooses; Esc closes and returns focus to the trigger (`finalFocus` on the content sends it elsewhere). Icons are outside a row's accessible name and typeahead; a row whose children are not plain text needs a `label`.

## Props

### DropdownMenu

UI SDK's `Menu` props. The popup renders into BLProvider's root unless you pass `container`.

| Prop | Default | Effect |
| --- | --- | --- |
| `open` / `defaultOpen` / `onOpenChange` | closed | Control visibility; `onOpenChange(open, details)`. |
| `onAction` | — | `(value, details)`: the chosen item's `value`. |
| `items` | — | `MenuData` the empty content draws. |
| `onCheckedChange` / `onValueChange` | — | Data checkbox / radio-group changes. |
| `itemShortcuts` | `true` | A data menu binds its shortcuts while closed. |
| `presentation` | `popover` | `auto` or `sheet` for a bottom sheet. |
| `modal` / `loop` / `delay` / `controller` | — | UI SDK's. |

### DropdownMenuContent and DropdownMenuSubContent

| Prop | Default | Effect |
| --- | --- | --- |
| `side` / `align` | `bottom` / `start` (a submenu: beside its row) | Starting position; it flips to fit, `data-side` reports the result. |
| `sideOffset` | `8` (a submenu: `-6`, overlapping its row) | Gap to the trigger, px. |
| `finalFocus` | the trigger | Where focus goes on close. |
| `keepMounted` | `false` | Keep the closed menu in the DOM, hidden. |
| `className` / `style` | — | Merged onto the surface (min 230px wide, scrolls when taller than the room it has). |

### DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | — | Passed to `onAction` (required on checkbox and radio items). |
| `label` | the children, when text | Typeahead text. |
| `icon` | — | Trailing icon. |
| `description` | — | Secondary line under the label. |
| `shortcut` | — | Keys such as `mod+r`, shown for the platform. |
| `destructive` (`DropdownMenuItem`) | `false` | Tints the row with `text-destructive`. |
| `disabled` | `false` | Dims the row; it stays reachable but does not run. |
| `closeOnSelect` | items: `true`, checkbox / radio: `false` | Whether choosing closes the menu. |
| `onSelect` (`DropdownMenuItem`) | — | Runs on this item. |
| `checked` / `defaultChecked` / `onCheckedChange` (checkbox) | — | Its state. |
| `render` | — | Another element, e.g. `<a href>`. |

`DropdownMenuRadioGroup` (`value` / `defaultValue` / `onValueChange`, `name`), `DropdownMenuGroup`, `DropdownMenuGroupLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuSub` (`open` / `defaultOpen` / `onOpenChange`) and `DropdownMenuSubTrigger` (`description`, `disabled`) complete the set.

## Styling

Parts carry UI SDK's slots: `menu-trigger` (a submenu's row too), `menu-content` (a submenu's too), `menu-item`, `menu-checkbox-item`, `menu-radio-group`, `menu-radio-item`, `menu-group`, `menu-group-label`, `menu-separator`, `menu-shortcut`. Rows expose `data-highlighted` (the active row), `data-open` (a row whose submenu is open), `data-checked`, `data-disabled`, `data-destructive` and `data-pending`; hold-to-press is `:active`. The content has `data-side`, `data-presentation`, and `data-starting-style` / `data-ending-style` for its grow-from-trigger animation. Like every overlay, the menu wears the nearest ThemeScope — [see the scoped demo on Popover](https://blamy.github.io/ui/#/popover).

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `dropdownMenuItemVariants`

Defined in `@/components/ui/dropdown-menu`. Base classes:

```text
[ 'bl-btn relative box-border flex min-h-11 cursor-pointer items-center gap-3 py-[11px] pr-4 pl-4 text-body leading-[22px] text-foreground outline-none', 'data-highlighted:bg-accent data-highlighted:not-data-disabled:active:bg-secondary-strong data-open:bg-accent data-disabled:cursor-default data-disabled:opacity-40 data-destructive:text-destructive data-pending:cursor-progress', // The shortcut UI SDK draws from `shortcut`: before the trailing icon, in the look of DropdownMenuShortcut. '*:data-[slot=menu-shortcut]:shrink-0 *:data-[slot=menu-shortcut]:text-subhead *:data-[slot=menu-shortcut]:tracking-[.08em] *:data-[slot=menu-shortcut]:text-muted-foreground', // Hairline between rows — not under the last row, nor above a group band. 'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border last:after:hidden [&:has(+[data-slot=menu-separator])]:after:hidden', ]
```

No variants.
