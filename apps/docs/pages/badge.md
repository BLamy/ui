# Badge

A small iOS capsule for a status, a count or a tag: 22px tall (18px at `size="sm"`), fully rounded, semibold text, never narrower than it is tall so a single digit is a circle. It is a plain `span` with no interaction, so it sits inside text, rows and headers; `render={<a href />}` makes it a link. For something the reader can press, use [Button](https://blamy.github.io/ui/#/button); for a removable tag in an input, a combobox chip; for a person, [Avatar](https://blamy.github.io/ui/#/avatar).

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

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Badge } from '@brett_lamy/ui/badge'
```
{% endtab %}
{% endtabs %}

## Variants

Seven variants. `default` is the solid accent, `secondary` a gray fill, `tinted` a 15% accent wash with accent text (inked darker in light, so it reads at AA), `outline` a hairline ring with foreground text, and `destructive`, `success` and `warning` are solid red, green and orange (success and warning with black text: white on the light iOS green or yellow would be about 2:1). An `svg` child (an [Icon](https://blamy.github.io/ui/#/icons)) is sized to 12px (10px at `sm`) and sits before the text with a 4px gap. Badge keeps shadcn's `variant` for these colours rather than the kit's `tone`.

{% demo src="badge/variants" %}

```tsx
<Badge>12</Badge>
<Badge variant="tinted">Beta</Badge>
<Badge variant="success"><Icon name="check" size={12} sw={2.6} />Verified</Badge>
```

## Sizes

`default` is 22px with 12px text; `sm` is 18px with 11px text, for a count beside a row's title, in a tab or on a button (the sidebar's and the font picker's counts use it). Numbers use tabular figures, so a count does not jitter as it changes.

```tsx
<Badge size="sm" variant="tinted" aria-label="12 unread">12</Badge>
```

## As a link

`render` renders another element with the badge's look: `<Badge render={<a href="#failures" />} variant="destructive">View 3 failures</Badge>`.

## In a list

Let the status pick the variant, and show a count badge only when there is something to count.

{% demo src="badge/in-context" %}

## Accessibility

A badge is plain text in a `span`: there is no role, and nothing is announced specially. Put enough in the text itself ("Failed", "3 warnings"), because colour alone is not enough. A bare number such as `3` reads out of context, so give it an `aria-label` that says what is counted, as the list above does.

## Props

Every `span` prop (and `ref`) passes through.

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default` · `secondary` · `tinted` · `outline` · `destructive` · `success` · `warning`. |
| `size` | `default` | `default` (22px) · `sm` (18px). |
| `render` | — | Another element with the badge's look, e.g. `render={<a href="…" />}`. |
| `className` | — | Merged after the recipe. |

## Styling

The element has `data-slot="badge"`. It is `inline-flex`, `shrink-0` and `whitespace-nowrap`, so it does not wrap or squeeze in a flex row. `badgeVariants({ variant, size })` returns the class list to put the same look on another element.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `badgeVariants`

Defined in `@/components/ui/badge`. Base classes:

```text
box-border inline-flex shrink-0 items-center justify-center gap-1 rounded-full leading-none font-semibold whitespace-nowrap tabular-nums
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-primary text-primary-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `tinted` | `bg-primary/15 text-[color-mix(in_oklab,var(--primary)_78%,black)] dark:text-primary` |
| `outline` | `text-foreground shadow-hairline` |
| `destructive` | `bg-destructive text-white` |
| `success` | `bg-success text-black` |
| `warning` | `bg-warning text-black` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-[18px] min-w-[18px] px-1.5 text-caption2 [&>svg]:size-2.5` |
| `default` (default) | `h-[22px] min-w-[22px] px-2 text-caption [&>svg]:size-3` |
