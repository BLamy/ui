# Card

A panel for grouping related content, shaped after an iOS inset-grouped section: rounded corners, the card color on a grouped background, and a few slots — header, title, description, a top-right action, content and footer — that set the padding and type so your content only has to fill them. `Card` is a plain container; `render={<a href />}` makes the whole card one link. For rows inside a grouped section use [List](https://blamy.github.io/ui/#/lists) instead, for a section that opens and closes [Disclosure](https://blamy.github.io/ui/#/disclosure), and for content over the page a [Popover](https://blamy.github.io/ui/#/popover) or [Dialog](https://blamy.github.io/ui/#/dialog).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/card.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Card, CardHeader, CardTitle, CardContent,
} from '@/components/ui/card'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Card, CardHeader, CardTitle, CardContent,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Variants

`variant` picks the surface. `default` is the card color, meant to sit on the grouped background (`bg-muted`); `elevated` adds a soft shadow and hairline so it lifts off any surface; `outline` is a hairline with no fill, for places that already have a surface.

{% demo src="card/variants" %}

```tsx
<Card variant="elevated">
  <CardHeader>
    <CardTitle>Team plan</CardTitle>
    <CardDescription>$24 per seat, billed monthly</CardDescription>
    <CardAction><Badge variant="tinted">Current</Badge></CardAction>
  </CardHeader>
  <CardContent>…</CardContent>
  <CardFooter>
    <Button size="sm">Upgrade</Button>
  </CardFooter>
</Card>
```

## Composing a card

Every part is optional; use the ones you need. `CardAction` takes the header's top-right corner beside the title and description (a badge, a menu button, a link): the header becomes a two-column grid only when it has one. `CardContent` has no layout of its own, so give it a grid or flex through `className`. The card is `overflow: hidden`, so an image or a full-bleed list as a direct child takes the card's rounded corners.

{% demo src="card/plan" %}

## A whole-card link

`render` swaps the element of any part: `<Card render={<a href="…" />}>` makes the card one link whose name is its text, and `<CardTitle render={<h2 />}>` changes the heading level without copying classes. Don't put buttons or links inside a card that is itself a link; give it a focus ring through `className`.

{% demo src="card/link" %}

```tsx
<Card variant="elevated" render={<a href="/docs/migrating" />} className="focus-visible:ring-[3px] focus-visible:ring-ring/45">
  <CardHeader>
    <CardTitle render={<h2 />}>Migrating to 6.0</CardTitle>
    <CardDescription>What moved, what was renamed.</CardDescription>
  </CardHeader>
</Card>
```

## Accessibility

A card has no role of its own. `CardTitle` renders an `h3`; `render={<h2 />}` (or any level) changes it. When the card is a distinct region that people may want to jump to, give it `role="group"` (or `region`) and an `aria-labelledby` pointing at the title's `id`. Card content keeps its own semantics: buttons and links inside are regular controls, reached in DOM order.

## Props

### Card

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default` · `elevated` · `outline` (see Variants). |
| `render` | — | Another element: `render={<a href="…" />}`, `render={<section />}`. |
| `className` | — | Merged last, so it can override the recipe. Every other `div` prop (and `ref`) passes through. |

### Parts

| Part | Element | Base layout |
| --- | --- | --- |
| `CardHeader` | `div` | Grid with a 4px gap; two columns when it holds a `CardAction`; `px-4 pt-4 pb-1`. |
| `CardTitle` | `h3` | `text-body`, semibold, no margin. |
| `CardDescription` | `p` | `text-footnote`, muted, no margin. |
| `CardAction` | `div` | The header's second column, spanning the title and description rows, top-aligned at the end. |
| `CardContent` | `div` | `px-4 py-3`, `text-subhead`. |
| `CardFooter` | `div` | Row, centered, 8px gap; `px-4 pt-1 pb-4`. |

All parts take `render` and `className` (merged last) and pass the rest of their element's props through.

## Styling

Slots are `data-slot="card"`, `card-header`, `card-title`, `card-description`, `card-action`, `card-content` and `card-footer`. The card is a flex column with `text-card-foreground` and the `rounded-panel` radius, the same inset-grouped surface as a List section and `DisclosureGroup variant="inset"` (which is built from `cardVariants`). The fill comes from `bg-card`, so a [ThemeScope](https://blamy.github.io/ui/#/theming) re-colors it; `elevated` uses the `shadow-raised` token. A filled card sets `--avatar-ring` to its colour, so avatars and their presence dots ring in the card. `cardVariants({ variant })` returns the class list for styling your own element as a card.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `cardVariants`

Defined in `@/components/ui/card`. Base classes:

```text
flex flex-col overflow-hidden rounded-panel text-card-foreground
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-card [--avatar-ring:var(--card)]` |
| `elevated` | `bg-card shadow-raised [--avatar-ring:var(--card)]` |
| `outline` | `bg-transparent shadow-hairline` |
