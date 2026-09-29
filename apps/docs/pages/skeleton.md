# Skeleton

Loading placeholders that hold the shape of the content on its way. A soft highlight sweeps across each block left to right — the reading direction — instead of the whole thing pulsing, and reduced motion gets a still block. `Skeleton` is one block with a `shape`; `SkeletonText` stacks text lines into a paragraph with a shorter last line.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Skeleton, SkeletonText } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/skeleton.json{% endcommand %}

Adds `@/components/ui/skeleton.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'
```
{% endtab %}
{% endtabs %}

## Shapes

Size a block with `width` / `height` (numbers are px) or with classes; `shape` picks the corners.

| Shape | Corners | Use it for |
| --- | --- | --- |
| `default` / `rounded` | 10px | cards, buttons, blocks |
| `rect` | 3px | media, thumbnails, table cells |
| `text` | fully rounded, 14px tall | a line of text — set `width`, and `height` for smaller or larger type |
| `circle` | round, never shrinks | avatars and icons — equal `width` and `height` |

```tsx
<Skeleton shape="circle" width={40} height={40} />
<Skeleton shape="text" width="60%" />
<Skeleton shape="rect" style={{ aspectRatio: '16 / 9' }} />
<SkeletonText lines={3} lastLineWidth="45%" />
```

## List rows

Put placeholders in a real `ListRow`'s slots — `leading`, `title`, `subtitle` — and the rows keep their height, insets and dividers, so nothing moves when the data lands.

{% demo src="skeleton/list-rows" %}

## Media cards

A `rect` for the artwork, text lines for the title and blurb, a `rounded` block for the button.

{% demo src="skeleton/media-card" %}

## A thread loading

Bubble-shaped placeholders on both sides, with varied widths so it reads as a conversation rather than a grid.

{% demo src="skeleton/chat-messages" %}

## Paragraphs

`SkeletonText` shortens its last line so the block reads as a paragraph; a taller `text` line stands in for a headline.

{% demo src="skeleton/paragraph" %}

## Avatar and text

{% demo src="skeleton/avatar-text" %}

## Loading → content

Keep the placeholder and the content in one container and swap them: `ContentSwap` cross-fades by key and `AnimatedHeight` springs the container to the new height, so the page below never jumps. Press **Reload** to fetch again.

{% demo src="skeleton/loading-swap" %}

```tsx
<AnimatedHeight>
  <div aria-busy={loading}>
    <ContentSwap id={loading ? 'loading' : 'loaded'}>
      {loading ? <OrderPlaceholder /> : <Order />}
    </ContentSwap>
  </div>
</AnimatedHeight>
```

## Light and dark

The fill and the sweep come from the `--bl-*` tokens — `fill2` under a card-coloured highlight — so the same placeholder sits right on light and dark surfaces with no extra props.

{% demo src="skeleton/light-and-dark" %}

## Accessibility

Placeholders are `aria-hidden`: they are decoration, not content. Mark the region that is loading instead — `aria-busy="true"` with a label such as "Loading contacts" — and clear `aria-busy` when the content arrives, so assistive technology announces the result once.

## Props

### Skeleton

| Prop | Default | Effect |
| --- | --- | --- |
| `shape` | `default` | `default` · `rounded` · `rect` · `text` · `circle` (see Shapes). |
| `width` / `height` | — | Size; a number is px, a string any CSS length. Classes work too. |
| `className` / `style` | — | Merged onto the block (`div`); every other `div` prop passes through. |

### SkeletonText

| Prop | Default | Effect |
| --- | --- | --- |
| `lines` | `3` | Number of text lines. |
| `lastLineWidth` | `60%` | Width of the last line (`100%` for a full line); ignored for a single line. |
| `lineHeight` | `14` | Height of each line in px. |
| `gap` | `8` | Space between lines in px. |
| `lineClassName` | — | Extra classes for each line. |

`skeletonVariants({ shape })` returns the class list, for styling your own element as a placeholder. Blocks carry `data-slot="skeleton"` and `data-shape`; the paragraph is `data-slot="skeleton-text"`.
