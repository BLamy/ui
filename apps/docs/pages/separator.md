# Separator

A one-pixel rule in the border colour, horizontal or vertical. It is react-aria's `Separator`: a horizontal rule renders as an `<hr>`, a vertical one as a `div` with `role="separator"` and `aria-orientation="vertical"`. Use it between blocks of content, between rows of a list, and between inline items.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/separator.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Separator } from '@/components/ui/separator'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Separator } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Rules

A horizontal rule is full width, `inset` indents the start by 16px like an iOS list separator, and `orientation="vertical"` stretches to the height of its flex row.

{% demo src="separator/rules" %}

```tsx
<Separator />
<Separator inset />
<div className="flex h-5 items-center gap-3">
  Docs <Separator orientation="vertical" /> Components
</div>
```

`inset` only affects horizontal separators: it adds a 16px left margin and shortens the width to match (`calc(100% - 16px)`). A vertical separator ignores it.

## Accessibility

A separator is exposed as a divider and is not focusable. It is structural: where spacing alone already separates the content, a border or gap is enough. Inside a menu or list box, use those components' own separators (DropdownMenu ships one) rather than this one.

## Props

Extends react-aria `SeparatorProps` (`elementType`, `id`, any DOM attribute), with `orientation` and `inset` from the recipe.

| Prop | Default | Effect |
| --- | --- | --- |
| `orientation` | `horizontal` | `horizontal` (`h-px w-full`) or `vertical` (`w-px self-stretch`). |
| `inset` | `false` | Indent a horizontal rule by 16px. |
| `className` | — | Merged after the recipe. |

## Styling

`data-slot="separator"`. The recipe is `m-0 shrink-0 border-0 bg-border`, so override the colour with a `bg-*` class, and give a vertical rule a height by placing it in a flex row with a fixed height (it uses `self-stretch`, so it has no height of its own elsewhere).

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `separatorVariants`

Defined in `@/components/ui/separator`. Base classes:

```text
m-0 shrink-0 border-0 bg-border
```

**`orientation`** — default `horizontal`

| Value | Adds |
| --- | --- |
| `horizontal` (default) | `h-px w-full` |
| `vertical` | `w-px self-stretch` |

**`inset`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | — |
| `false` (default) | — |

1 compound variant — see the source.
