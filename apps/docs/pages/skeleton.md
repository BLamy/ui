# Skeleton

Loading placeholders that hold the shape of the content on its way. A soft highlight sweeps across each block left to right — the reading direction — instead of the whole thing pulsing, and reduced motion gets a still block. `Skeleton` is one block with a `shape`; `SkeletonText` stacks text lines into a paragraph with a shorter last line. Use it while data is on its way and the layout is known; use a [Spinner](https://blamy.github.io/ui/#/spinner) for an action in flight or a wait with no shape, and [EmptyState](https://blamy.github.io/ui/#/empty-state) once the data has arrived and there is none.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/skeleton.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Skeleton, SkeletonText } from '@brett_lamy/ui/skeleton'
```
{% endtab %}
{% endtabs %}

## Shapes

Size a block with classes, as in shadcn (`className="h-24 w-full"`); `width` / `height` (numbers are px) are there for a size computed at runtime. `shape` picks the corners.

| Shape | Corners | Use it for |
| --- | --- | --- |
| `default` | `rounded-ctl` (10px) | cards, buttons, blocks |
| `rect` | 3px | media, thumbnails, table cells |
| `text` | fully rounded, 14px tall | a line of text — set the width, and a height class (`h-3`) for smaller or larger type |
| `circle` | round, never shrinks | avatars and icons — equal width and height (`size-10`) |

```tsx
<Skeleton shape="circle" className="size-10" />
<Skeleton shape="text" width="60%" />
<Skeleton shape="rect" style={{ aspectRatio: '16 / 9' }} />
<SkeletonText lines={3} lastLineWidth="45%" />
```

## List rows

Put placeholders in a real `ListRow`'s slots — `icon`, `title`, `description` — and the rows keep their height, insets and dividers, so nothing moves when the data lands.

{% demo src="skeleton/list-rows" %}

## Media cards

A `rect` for the artwork, text lines for the title and blurb, a `default` block for the button.

{% demo src="skeleton/media-card" %}

## A thread loading

Bubble-shaped placeholders on both sides, with varied widths so it reads as a conversation rather than a grid.

{% demo src="skeleton/chat-messages" %}

## Paragraphs

`SkeletonText` shortens its last line so the block reads as a paragraph; a taller `text` line stands in for a headline. Its bars take `lineClassName` (`h-3` for smaller type) and the spacing is a class on the paragraph (`className="gap-3"`).

{% demo src="skeleton/paragraph" %}

## Avatar and text

{% demo src="skeleton/avatar-text" %}

## Loading → content

Keep the placeholder and the content in one container and swap them: `Swap` cross-fades by `value` and `AnimatedHeight` springs the container to the new height, so the page below never jumps. Press **Reload** to fetch again.

{% demo src="skeleton/loading-swap" %}

```tsx
<AnimatedHeight>
  <div role="group" aria-label="Order" aria-busy={loading}>
    <Swap value={loading ? 'loading' : 'loaded'}>
      {loading ? <OrderPlaceholder /> : <Order />}
    </Swap>
  </div>
</AnimatedHeight>
```

## Light and dark

The fill is `bg-secondary-strong` and the sweep a highlight that is lighter than the bar in both appearances (`--skeleton-sheen`: the card color in light, the foreground at 8% in dark, where the card is darker than the bar), so the same placeholder sits right on light and dark surfaces, and in any ThemeScope, with no extra props. Set `--skeleton-sheen` on a surface of your own to change it.

{% demo src="skeleton/light-and-dark" %}

## Accessibility

Placeholders are `aria-hidden`: they are decoration, not content. Mark the region that is loading instead — `role="group"` with `aria-busy="true"` and a label such as "Loading contacts" (a plain `div` can't take a name, so the role matters) — and clear `aria-busy` when the content arrives, so assistive technology announces the result once.

## Props

### Skeleton

| Prop | Default | Effect |
| --- | --- | --- |
| `shape` | `default` | `default` · `rect` · `text` · `circle` (see Shapes). |
| `width` / `height` | — | A size computed at runtime; a number is px, a string any CSS length. Prefer classes otherwise. |
| `className` / `style` | — | Merged onto the block (`div`); every other `div` prop passes through. |
| `render` | — | Another element, where the markup needs phrasing content: `<Skeleton shape="text" render={<span />} />` inside a `<p>` or a button. |

### SkeletonText

| Prop | Default | Effect |
| --- | --- | --- |
| `lines` | `3` | Number of text lines. |
| `lastLineWidth` | `60%` | Width of the last line (`100%` for a full line); ignored for a single line. |
| `lineClassName` | — | Classes for each line, such as `h-3` (the `text` shape is `h-3.5`). |
| `className` | — | Classes for the paragraph; its gap is `gap-2`, so `gap-3` spaces the lines out. |

`skeletonVariants({ shape })` returns the class list, for styling your own element as a placeholder. Blocks carry `data-slot="skeleton"` and `data-shape`; the paragraph is `data-slot="skeleton-text"`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `skeletonVariants`

Defined in `@/components/ui/skeleton`. Base classes:

```text
[ // The sheen is lighter than the bar in both appearances: the card color in light, a whisper of the foreground in // dark (the dark card is darker than the bar, and would sweep a shadow across it). '[--skeleton-sheen:color-mix(in_oklab,var(--card)_55%,transparent)] dark:[--skeleton-sheen:color-mix(in_oklab,var(--foreground)_8%,transparent)]', 'block bg-secondary-strong [background-image:linear-gradient(90deg,transparent_25%,var(--skeleton-sheen)_50%,transparent_75%)] [background-size:200%_100%] [background-position:150%_0] [background-repeat:no-repeat] animate-bl-shimmer motion-reduce:animate-none', ]
```

**`shape`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `rounded-ctl` |
| `rect` | `rounded-[3px]` |
| `text` | `h-3.5 rounded-full` |
| `circle` | `shrink-0 rounded-full` |
