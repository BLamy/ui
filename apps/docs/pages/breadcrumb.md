# Breadcrumb

The path to the current page. Every item is pressable (a link, a button, or a picker of its siblings like VS Code's breadcrumb), and when the trail is wider than its container the middle collapses into one `…` menu, so the first and the last item are always there. It is built on react-aria's `Breadcrumbs`, `Breadcrumb` and `Link`, with the siblings and the hidden items in a [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/breadcrumb.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Breadcrumb, BreadcrumbItem } from '@/components/ui/breadcrumb'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Breadcrumb, BreadcrumbItem } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Items

Pass `items` for the data-driven form, or compose `BreadcrumbItem`s as children. An item takes an `href` (a real link, so `RouterProvider` and middle-click work), an `onPress`, or both. The last item is the current page: it gets `aria-current="page"` and is plain text unless it has a handler or an `href`. `icon` is an icon name (`'house'`) or any node. Between items sits a chevron, `aria-hidden`; `separator` replaces it (`null` for none).

{% demo src="breadcrumb/trail" %}

```tsx
<Breadcrumb
  items={[
    { id: 'home', label: 'Home', icon: 'house', href: '/' },
    { id: 'projects', label: 'Projects', href: '/projects' },
    { id: 'here', label: 'Design system' },
  ]}
/>

// …or composed
<Breadcrumb size="sm">
  <BreadcrumbItem href="/" icon="house">Home</BreadcrumbItem>
  <BreadcrumbItem>Design system</BreadcrumbItem>
</Breadcrumb>
```

### The current page as an action

react-aria disables the link of the last item; give it an `onPress` or an `href` and it is pressable again (still `aria-current`), for "reload" or "copy link".

{% demo src="breadcrumb/current-action" %}

## Sibling menus

An item that carries `items` is a picker: pressing it opens a menu of the other entries of its parent, the `selectedId` one checked, and choosing one fires that entry's `href` or `onPress`. Use it for a file path, a project switcher or any hierarchy where the siblings are one step away. The item's own `href` and `onPress` are not used (the menu replaces them), so put the "go there" action in the entries.

{% demo src="breadcrumb/sibling-menus" %}

```tsx
{
  id: 'folder',
  label: 'ui',
  icon: 'folder',
  selectedId: 'ui',
  items: [
    { id: 'ui', label: 'ui', icon: 'folder', href: '/ui' },
    { id: 'docs', label: 'docs', icon: 'folder', href: '/docs' },
  ],
}
```

## Collapsing

The root measures its own width with a `ResizeObserver`, against the natural width of each item taken from an off-screen, inert copy of the full list, and re-measures when the items or the container change. When the trail does not fit, the middle becomes a `…` button (named "More") that opens a menu of the hidden items, each firing its own `href` / `onPress` (a hidden item that is a sibling picker opens its entries as a submenu). The first item and the last always stay and as many trailing items as fit; widen the container and items come back. The first render, and the server's, is the full list, so nothing flickers in. Give the root a width of its own (it is `w-full` by default) so it fills its container instead of shrinking to its content.

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

The root is a `nav` landmark named "Breadcrumb" (`aria-label` overrides it) around an ordered list. The current item has `aria-current="page"`. A sibling picker is a button with `aria-haspopup`, `aria-expanded` and a `menu` of `menuitemradio` rows (the current one `aria-checked`); the `…` button needs a name, so `ellipsisLabel` localizes "More". Links are real `a` elements when they have an `href`; arrow keys, Home/End, type-to-select and Esc come from the menu. The measuring copy is `aria-hidden` and `inert`, so assistive tech and focus never see it, but a test that queries by text will find each label twice — query within the `breadcrumb-list` slot or by role.

## Props

### Breadcrumb

| Prop | Default | Effect |
| --- | --- | --- |
| `items` | — | Data-driven form: an array of `BreadcrumbItemData`. Otherwise pass `BreadcrumbItem` children. |
| `size` | `default` | `sm`, `default` or `lg`: text size, icon size and item height. |
| `separator` | chevron | Replaces the chevron (`null` for none). |
| `collapse` | `true` | Collapse the middle into `…` when the items do not fit. |
| `keepHead` / `keepTail` | `1` / `1` | Leading / trailing items that never collapse. |
| `ellipsisLabel` | `More` | The `…` button's accessible name. |
| `aria-label` | `Breadcrumb` | The landmark's name. |
| `className` / `style` | — | Merged onto the `nav`. |

### BreadcrumbItem and BreadcrumbItemData

| Prop | Default | Effect |
| --- | --- | --- |
| `id` | — | Key (required in `BreadcrumbItemData`; it is also the menu row's key). |
| `label` / children | — | The text. A non-string label needs `textValue` for the menu's type-to-select. |
| `icon` | — | An icon name or a node, before the label. |
| `href` / `onPress` | — | The link and / or press handler. |
| `items` | — | `BreadcrumbEntry[]` (`id`, `label`, `icon`, `href`, `onPress`, `textValue`): the siblings, shown as a menu on press. |
| `selectedId` | — | The `items` entry that is current; it is checked. |

`BreadcrumbEllipsis` (`items`, `label`) is the `…` item the root renders; use it directly for a trail you shorten by hand. `BreadcrumbSeparator` is the chevron span (children replace the icon).

## Styling

Slots: `breadcrumb` (the `nav`), `breadcrumb-list` (the `ol`), `breadcrumb-item` (each `li`), `breadcrumb-ellipsis`, `breadcrumb-link` (the pressable face of an item, the `…` button, or plain text), `breadcrumb-separator`. Faces use react-aria's data attributes: `data-hovered`, `data-pressed`, `data-focus-visible` (a ring, like Button) and `data-current` for the current page, which turns from `text-muted-foreground` to `text-foreground`. Width never depends on the current state, because the measuring copy cannot know which item is last; restyle with colors and backgrounds, not font weight or padding that only the current item has.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `breadcrumbVariants`

Defined in `@/components/ui/breadcrumb`. Base classes:

```text
relative block w-full min-w-0 overflow-clip whitespace-nowrap text-foreground [overflow-clip-margin:4px]
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
[ 'bl-btn box-border inline-flex max-w-full min-w-0 items-center rounded-md border-0 bg-transparent text-muted-foreground no-underline [font-family:inherit] whitespace-nowrap outline-none transition-colors motion-reduce:transition-none', 'data-current:text-foreground', 'data-focus-visible:ring-2 data-focus-visible:ring-ring', ]
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
| `true` (default) | `cursor-pointer data-hovered:bg-secondary data-hovered:text-foreground data-pressed:bg-secondary-strong aria-expanded:bg-secondary aria-expanded:text-foreground…` |
| `false` | `cursor-default` |
