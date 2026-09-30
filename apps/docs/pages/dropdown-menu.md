# DropdownMenu

An iOS pull-down menu: a button that opens a short list of actions — rows with a trailing icon, an optional description or keyboard shortcut, thick bands between groups, and a red destructive row. It is react-aria's `MenuTrigger`, `Menu` and `MenuItem`, so the menu closes on choice, moves with the arrow keys and gives focus back to the button. Use it for a "more" button, a context of actions, or view options. To pick a value for a form field use [Select](https://blamy.github.io/ui/#/select); for free-form content use [Popover](https://blamy.github.io/ui/#/popover); for a searchable palette use [CommandMenu](https://blamy.github.io/ui/#/command-menu).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/dropdown-menu.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Anatomy

`DropdownMenu` is the trigger wrapper: its first pressable child is the button and `DropdownMenuContent` is the menu. Handle choices with `onAction` on the content (it receives the item's `id`) or `onAction` on an item. The menu needs an `aria-label`.

```tsx
<DropdownMenu>
  <Button variant="secondary" size="icon" aria-label="More"><Icon name="ellipsis" /></Button>
  <DropdownMenuContent aria-label="Photo actions" onAction={(key) => run(key)}>
    <DropdownMenuItem id="copy" icon={<Icon name="copy" size={20} />}>Copy</DropdownMenuItem>
    <DropdownMenuItem id="share" icon={<Icon name="share" size={20} />}>Share…</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem id="delete" variant="destructive" icon={<Icon name="trash" size={20} />}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Actions, shortcuts, submenus

Rows take an `icon` (trailing, 22px), a `description` line, a `shortcut` (use `DropdownMenuShortcut` or a [Kbd](https://blamy.github.io/ui/#/kbd)) and `variant="destructive"`. `DropdownMenuSeparator` is the thick group band, not a hairline; rows get hairlines between them automatically. Wrap a row and a nested `DropdownMenuContent` in `DropdownMenuSub` for a submenu — the row shows a chevron in place of its icon, the submenu opens to the side with `ArrowRight` and closes with `ArrowLeft`. `isDisabled` dims a row (40%) and skips it. Shortcut text is only display; bind the keys yourself.

{% demo src="dropdown-menu/actions" %}

## Selectable items

Set `selectionMode="single"` or `"multiple"` with `selectedKeys` and `onSelectionChange` on the `DropdownMenuContent` — or on a `DropdownMenuSection`, so one menu can hold a sort order (single) and a set of filters (multiple), each with its own state. Selected rows show a leading checkmark, and every row in a selectable group reserves the space for it. A titled section gets a small header (`DropdownMenuLabel`).

{% demo src="dropdown-menu/selectable" %}

```tsx
<DropdownMenuSection
  title="Sort by"
  selectionMode="single"
  selectedKeys={sort}
  onSelectionChange={setSort}
>
  <DropdownMenuItem id="name">Name</DropdownMenuItem>
  <DropdownMenuItem id="date">Date modified</DropdownMenuItem>
</DropdownMenuSection>
```

## Accessibility

react-aria renders a `menu` of `menuitem` / `menuitemradio` / `menuitemcheckbox` rows. The trigger gets `aria-haspopup="menu"` and `aria-expanded`; Enter, Space, a press or the Down arrow opens it (Up opens with the last row focused); arrows, Home/End and typeahead move; Enter or Space chooses; Esc closes and returns focus to the trigger. Submenus use `ArrowRight`/`ArrowLeft`. Give the menu an `aria-label`, icon-only triggers an `aria-label`, and items made of non-text children a `textValue` (plain string children supply it).

## Props

### DropdownMenu and DropdownMenuContent

`DropdownMenu` is react-aria's `MenuTrigger`: `isOpen`, `defaultOpen`, `onOpenChange`.

| Prop | Default | Effect |
| --- | --- | --- |
| `placement` | react-aria's (bottom start; a submenu goes to the end) | Popover placement. |
| `popoverClassName` | — | Classes for the popover (minimum width 230px). |
| `className` | — | Classes for the menu (scrolls past the popover's max height). |
| `aria-label` | — | Required name. |
| `onAction` | — | Called with the pressed item's `id`. |
| `selectionMode` / `selectedKeys` / `defaultSelectedKeys` / `onSelectionChange` | `none` | Selectable menu. |
| `items` | — | Dynamic collection with a render function. |

The popover sits 8px from its trigger; a submenu overlaps its parent row (offset −6px).

### DropdownMenuItem

| Prop | Default | Effect |
| --- | --- | --- |
| `id` | — | Key passed to `onAction`. |
| `variant` | `default` | `destructive` tints the row with `text-destructive`. |
| `icon` | — | Trailing icon (hidden if the row opens a submenu). |
| `description` | — | Secondary line under the label. |
| `shortcut` | — | Trailing shortcut. |
| `onAction` / `href` / `isDisabled` / `textValue` | — | react-aria `MenuItem` props. |

`DropdownMenuSection` (`title`, selection props), `DropdownMenuLabel`, `DropdownMenuSeparator` (react-aria `Separator`), `DropdownMenuShortcut` (a styled span) and `DropdownMenuSub` (react-aria `SubmenuTrigger`) complete the set.

## Styling

Slots: `dropdown-menu` (the popover), `dropdown-menu-content` (the menu), `dropdown-menu-item`, `dropdown-menu-section`, `dropdown-menu-label`, `dropdown-menu-separator`, `dropdown-menu-shortcut`. Rows expose `data-focused`, `data-pressed`, `data-open` (a row whose submenu is open) and `data-disabled`. Like every overlay, the menu wears the nearest ThemeScope — [see the scoped demo on Popover](https://blamy.github.io/ui/#/popover).

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `dropdownMenuItemVariants`

Defined in `@/components/ui/dropdown-menu`. Base classes:

```text
[ 'bl-btn relative box-border flex min-h-11 cursor-pointer items-center gap-3 py-[11px] pr-4 pl-4 text-body leading-[22px] outline-none', 'data-focused:bg-accent data-pressed:bg-secondary-strong data-open:bg-accent data-disabled:cursor-default data-disabled:opacity-40', // Hairline between rows — not under the last row, nor above a section band. 'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border last:after:hidden [&:has(+[role=separator])]:after:hidden', ]
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `text-foreground` |
| `destructive` | `text-destructive` |
