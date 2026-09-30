# Badge

A small iOS capsule for a status, a count or a tag: 22px tall, fully rounded, 12px semibold text. It is a plain `span` with no interaction, so it sits inside text, rows and headers. For something the reader can press, use [Button](https://blamy.github.io/ui/#/button).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/badge.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Badge } from '@/components/ui/badge'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Badge } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Variants

Six variants. `default` is the solid accent, `tinted` a 15% accent wash with accent text, `outline` a hairline ring with foreground text, and `destructive` and `success` are solid red and green. An `svg` child (an [Icon](https://blamy.github.io/ui/#/icons)) is sized to 12px and sits before the text with a 4px gap.

{% demo src="badge/variants" %}

```tsx
<Badge>12</Badge>
<Badge variant="tinted">Beta</Badge>
<Badge variant="success"><Icon name="check" size={12} sw={2.6} />Verified</Badge>
```

## In a list

Let the status pick the variant, and show a count badge only when there is something to count.

{% demo src="badge/in-context" %}

## Accessibility

A badge is plain text in a `span`: there is no role, and nothing is announced specially. Put enough in the text itself ("Failed", "3 warnings"), because colour alone is not enough. A bare number such as `3` reads out of context, so give it an `aria-label` that says what is counted, as the list above does.

## Props

Extends `ComponentProps<'span'>`; every span prop passes through.

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default` · `secondary` · `tinted` · `outline` · `destructive` · `success`. |
| `className` | — | Merged after the recipe. |

## Styling

The element has `data-slot="badge"`. It is `inline-flex`, `shrink-0` and `whitespace-nowrap`, so it does not wrap or squeeze in a flex row. `badgeVariants({ variant })` returns the class list to put the same look on another element.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `badgeVariants`

Defined in `@/components/ui/badge`. Base classes:

```text
box-border inline-flex h-[22px] shrink-0 items-center justify-center gap-1 rounded-full px-2 text-caption leading-none font-semibold whitespace-nowrap [&>svg]:size-3
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-primary text-primary-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `tinted` | `bg-primary/15 text-primary` |
| `outline` | `text-foreground shadow-hairline` |
| `destructive` | `bg-destructive text-white` |
| `success` | `bg-success text-white` |
