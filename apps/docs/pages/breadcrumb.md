# Breadcrumb

The path to the current page. Every item is pressable (a link, a button, or a picker of its siblings like VS Code's breadcrumb), and when the trail is wider than its container the middle collapses into one `…` menu, so the first and the last item are always there. It is a `nav` with an ordered list of native links and UI SDK buttons, with the siblings and the hidden items in a [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu).

Use it for a location inside a hierarchy (files, folders, a docs section). For moving back through pages the user pushed, use [NavigationStack](https://blamy.github.io/ui/#/navigation-stack)'s back button; for switching between peer views, [Tabs](https://blamy.github.io/ui/#/tabs); for a menu of actions, [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu). On touch, every face keeps its width but answers to a 44px-tall hit area.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/breadcrumb.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import { Breadcrumb, BreadcrumbItem } from '@/components/ui/breadcrumb'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Breadcrumb, BreadcrumbItem } from '@brett_lamy/ui/breadcrumb'
```
{% endtab %}
{% endtabs %}

## Items

Pass `items` for the data-driven form, or compose `BreadcrumbItem`s as children. An item takes an `href` (a real `<a>`, so your router's link handling and middle-click work), an `onClick`, or both; with only `onClick` it is a button. The last item is the current page: it gets `aria-current="page"` and is plain text unless it has a handler or an `href`. `icon` is an icon name (`'house'`) or any node. Between items sits a chevron, `aria-hidden`; `separator` replaces it (`null` for none).

{% demo src="breadcrumb/trail" %}

```tsx
<Breadcrumb
  items={[
    { value: 'home', label: 'Home', icon: 'house', href: '/' },
    { value: 'projects', label: 'Projects', href: '/projects' },
    { value: 'here', label: 'Design system' },
  ]}
/>

// …or composed
<Breadcrumb size="sm">
  <BreadcrumbItem href="/" icon="house">Home</BreadcrumbItem>
  <BreadcrumbItem>Design system</BreadcrumbItem>
</Breadcrumb>
```

### The current page as an action

The last item is plain text; give it an `onClick` or an `href` and it is pressable (still `aria-current="page"`), for "reload" or "copy link".

{% demo src="breadcrumb/current-action" %}

## Sibling menus

An item that carries `siblings` is a picker: pressing it opens a menu of the other entries of its parent, the `siblingValue` one checked, and choosing one fires that entry's `href` or `onClick`. Use it for a file path, a project switcher or any hierarchy where the siblings are one step away. The item's own `href` and `onClick` are not used (the menu replaces them), so put the "go there" action in the entries.

An item that opens a popup of your own instead (a file picker dialog, say) is a button with `onClick` plus `aria-haspopup`, `aria-expanded` and `aria-controls`, which go onto the item's button. In the `…` menu it is an ordinary item that runs `onClick`.

{% demo src="breadcrumb/sibling-menus" %}

```tsx
{
  value: 'folder',
  label: 'ui',
  icon: 'folder',
  siblingValue: 'ui',
  siblings: [
    { value: 'ui', label: 'ui', icon: 'folder', href: '/ui' },
    { value: 'docs', label: 'docs', icon: 'folder', href: '/docs' },
  ],
}
```

## Collapsing

The fit is a UI SDK primitive (`lib/breadcrumb-primitive.ts`, built with `definePrimitive` and rendered with `createParts`). It measures the root's own width with a `ResizeObserver`, against the natural width of each item taken from an off-screen, inert copy of the full list, and re-measures when the items, their labels or the container change, or web fonts load. While items are hidden the root has `data-collapsed`. When the trail does not fit, the middle becomes a `…` button (named "More") that opens a menu of the hidden items, each firing its own `href` / `onClick` (a hidden item that is a sibling picker opens its entries as a submenu). The first item and the last always stay and as many trailing items as fit; widen the container and items come back. The first render, and the server's, is the full list, so nothing flickers in. Give the root a width of its own (it is `w-full` by default) so it fills its container instead of shrinking to its content.

{% demo src="breadcrumb/collapsing" %}

The arithmetic is a pure function, exported for your own layouts and tests:

```ts
// widths: each item's own width; then the available width,
// the width between neighbours, and the width of the … item.
fitBreadcrumbs([44, 76, 108, 100, 92], 320, 16, 24)
// → { head: 1, tail: 2 }  — keep 1 leading and 2 trailing, hide the 2 in between
```

`keepHead` and `keepTail` on the root (or the function's options) change how many items at each end never collapse; `collapse={false}` turns the behavior off.

## Accessibility

The root is a `nav` landmark named "Breadcrumb" (`aria-label` overrides it) around an ordered list. The current item has `aria-current="page"`. A sibling picker is a button with `aria-haspopup`, `aria-expanded` and a `menu` of `menuitemradio` rows (the current one `aria-checked`); the `…` button needs a name, so `ellipsisLabel` localizes "More". Links are real `a` elements when they have an `href`; arrow keys, Home/End, type-to-select and Esc come from the menu. The measuring copy is `aria-hidden` and `inert`, so assistive tech, agents and focus never see it, but a test that queries by text will find each label twice — query within the `breadcrumb-list` slot or by role.

For an agent (UI SDK's `createAgent`), the trail is one `breadcrumb` entry named like the landmark. Its `items` are the shown items (`{ value, label }`), and its `activate(value)` presses one: the link, button or sibling picker. It returns `false` for plain-text items and hidden ones. The hidden items are rows of the `…` menu, a Menu entry of its own named "More". Sibling pickers are Menus too.

## Props

### Breadcrumb

| Prop | Default | Effect |
| --- | --- | --- |
| `items` | — | Data-driven form: an array of `BreadcrumbItemData`. Otherwise pass `BreadcrumbItem` children. |
| `size` | `default` | `sm`, `default` or `lg`: text size, icon size and item height. |
| `separator` | chevron | Replaces the chevron (`null` for none). |
| `collapse` | `true` | Collapse the middle into `…` when the items do not fit. |
| `keepHead` / `keepTail` | `1` / `1` | Leading / trailing items that never collapse. `keepTail` is at least 1: the current page always shows. |
| `ellipsisLabel` | `More` | The `…` button's accessible name. |
| `aria-label` | `Breadcrumb` | The landmark's name. |
| `className` / `style` | — | Merged onto the `nav`. |

### BreadcrumbItem and BreadcrumbItemData

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | the React key | `string \| number` name (required in `BreadcrumbItemData`; it is also the menu row's value). |
| `label` | — | The plain-text name (a `string`): what shows, what the menus' type-to-select and an agent read. |
| `children` | `label` | Content to show instead, like an icon and a styled name; the menus show it too and still read `label`. On `BreadcrumbItem`, children alone (a string) work as the label. |
| `icon` | — | An icon name or a node, before the label. |
| `href` / `onClick` | — | The link and / or press handler. `onClick(event)` gets the click (call `event.preventDefault()` on a link to route it yourself), or, for a row chosen in a menu, the event that chose it. |
| `siblings` | — | `BreadcrumbEntry[]` (`value`, `label`, `children`, `icon`, `href`, `onClick`): the entries of this item's parent, shown as a menu on press. |
| `siblingValue` | — | The `value` of the `siblings` entry that is current; the menu's rows are then radio items and this one is checked. |

`BreadcrumbEllipsis` (`items`, `aria-label`) is the `…` item the root renders; use it directly for a trail you shorten by hand. `BreadcrumbSeparator` is the chevron span (children replace the icon).

## Styling

Slots: `breadcrumb` (the `nav`; `data-collapsed` while items are hidden), `breadcrumb-list` (the `ol`), `breadcrumb-item` (each `li`; `data-current` on the last one), `breadcrumb-ellipsis`, `breadcrumb-measure` (the off-screen copy), `breadcrumb-link` (a link or plain-text face; a face that is a button carries UI SDK's `button` slot, and one that opens a menu `menu-trigger`), `breadcrumb-separator`. Faces style `:hover`, `:active`, `:focus-visible` (a ring, like Button) and `aria-[current=page]` for the current page, which turns from `text-foreground/70` to `text-foreground`; a face whose menu is open has `aria-expanded`. Width never depends on the current state, because the measuring copy cannot know which item is last; restyle with colors and backgrounds, not font weight or padding that only the current item has.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `breadcrumbVariants`

Defined in `@/components/ui/breadcrumb`. Base classes:

```text
relative block w-full min-w-0 overflow-clip whitespace-nowrap text-foreground [overflow-clip-margin:4px] pointer-coarse:[overflow-clip-margin:12px] [contain:inline-size]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `text-caption` |
| `default` (default) | `text-footnote` |
| `lg` | `text-subhead` |

### `breadcrumbItemVariants`

Defined in `@/components/ui/breadcrumb`. Base classes:

```text
[ 'bl-btn relative box-border inline-flex max-w-full min-w-0 items-center rounded-md border-0 bg-transparent py-0 text-foreground/70 no-underline [font:inherit] whitespace-nowrap outline-none transition-colors motion-reduce:transition-none', // On touch the face keeps its measured width but its hit area grows to 44px tall. "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:top-1/2 pointer-coarse:after:h-11 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']", 'aria-[current=page]:text-foreground', 'focus-visible:ring-2 focus-visible:ring-ring', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-5 gap-1 px-1` |
| `default` (default) | `h-6 gap-1.5 px-1.5` |
| `lg` | `h-7 gap-1.5 px-2` |

**`interactive`** — default `true`

| Value | Adds |
| --- | --- |
| `true` (default) | `cursor-pointer hover:bg-secondary hover:text-foreground active:bg-secondary-strong aria-expanded:bg-secondary aria-expanded:text-foreground data-disabled:curso…` |
| `false` | `cursor-default` |
