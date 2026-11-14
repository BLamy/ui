# ScrollArea

A scroll container on UI SDK's `ScrollArea`, with the kit's thin scrollbars. Scrolling stays native — momentum, overscroll, trackpad, touch, find in page — in a viewport that fills the area. With no scrollbar parts the browser's own bars stay, restyled 3px wide with a soft thumb and no track; add a `ScrollAreaScrollbar` to draw an overlay bar instead. The root reports where the view is, for edge fades and shadows, and `stickToEnd` keeps a growing log at its end. It is not a virtualized list. For a list that follows a conversation or a stream, see [MessageScroller](https://blamy.github.io/ui/#/message-scroller), and for a scroller with jump points, [IndexBar](https://blamy.github.io/ui/#/index-bar) beside it.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/scroll-area.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  ScrollArea, ScrollAreaViewport, ScrollAreaContent,
} from '@/components/ui/scroll-area'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  ScrollArea, ScrollAreaViewport, ScrollAreaContent,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Orientations

Size the `ScrollArea` (a fixed or max height such as `h-44` or `max-h-80`, or a flex or grid parent that bounds it); the `ScrollAreaViewport` inside fills it and scrolls, and `ScrollAreaContent` holds what scrolls. `orientation` on the root decides which axes may scroll: `vertical` (the default), `horizontal` or `both`.

{% demo src="scroll-area/orientations" %}

```tsx
<ScrollArea className="h-44 rounded-card bg-card">
  <ScrollAreaViewport aria-label="Release notes">
    <ScrollAreaContent>
      {releases.map((r) => <Release key={r.version} {...r} />)}
    </ScrollAreaContent>
  </ScrollAreaViewport>
</ScrollArea>

<ScrollArea orientation="horizontal">
  <ScrollAreaViewport aria-label="Tags">
    <ScrollAreaContent className="flex w-max gap-2">…</ScrollAreaContent>
  </ScrollAreaViewport>
</ScrollArea>
```

A horizontal area's content must be wider than the area — `w-max` on a flex row does it.

## Overlay scrollbars

A `ScrollAreaScrollbar` (one per axis, `orientation="vertical"` by default) replaces the browser's bar with a thin thumb over the content's edge. `type` on the root says when it shows: `hover` (default: while hovered or scrolling), `scroll`, `auto` (whenever the content overflows) or `always`; `scrollHideDelay` is how long it lingers.

```tsx
<ScrollArea className="h-64" type="scroll">
  <ScrollAreaViewport aria-label="Inbox"><ScrollAreaContent>…</ScrollAreaContent></ScrollAreaViewport>
  <ScrollAreaScrollbar />
</ScrollArea>
```

## Stick to the end

`stickToEnd` starts at the bottom and keeps the end in view while the content grows, like a chat or streamed output; scrolling up lets go, and scrolling back down sticks again. `ScrollAreaScrollToEnd` is the "Jump to latest" button for it — a small secondary button over the bottom edge, shown only while the view is away from the end. `createScrollAreaController()` scrolls from outside (`scrollToEnd()`, `scrollToStart()`, `isAtEnd()`).

```tsx
<ScrollArea className="h-80" stickToEnd>
  <ScrollAreaViewport role="log" aria-label="Build output"><ScrollAreaContent>{lines}</ScrollAreaContent></ScrollAreaViewport>
  <ScrollAreaScrollToEnd>Jump to latest</ScrollAreaScrollToEnd>
</ScrollArea>
```

## Accessibility

The viewport is a native scroller: once focus is inside it, the arrow keys, Page Up and Down, Home, End and Space scroll it. A viewport that scrolls and holds nothing focusable is a tab stop itself, with a focus ring, so keyboard users can reach it; one with links or fields inside isn't, since Tab reaches them and they scroll it. Give the viewport an `aria-label` (or `aria-labelledby`) so it is announced as something, and `role="region"` if it is a landmark worth jumping to (`role="log"` for a chat). Scrollbars and the corner are hidden from screen readers. `overscroll-contain` keeps a scroll that reaches the end from also scrolling the page behind it.

## Props

### ScrollArea

| Prop | Default | Effect |
| --- | --- | --- |
| `orientation` | `vertical` | `vertical` hides x overflow, `horizontal` hides y overflow, `both` scrolls either way. |
| `type` | `hover` | When overlay scrollbars show: `hover`, `scroll`, `auto` or `always`. |
| `scrollHideDelay` | `600` | Milliseconds a scrollbar stays after it stops being needed (`hover` and `scroll`). |
| `stickToEnd` | `false` | Keep the end in view while the content grows. |
| `controller` | — | From `createScrollAreaController()`. |
| `className` | — | Merged last — size it here. |

### Parts

| Part | Notes |
| --- | --- |
| `ScrollAreaViewport` | The scroller. Name it here (`aria-label`, `role`). |
| `ScrollAreaContent` | What scrolls; it sizes to its content. |
| `ScrollAreaScrollbar` | `orientation` (`vertical` or `horizontal`). Draws a `ScrollAreaThumb` unless given children. |
| `ScrollAreaThumb` | The thumb; sizes and moves itself. |
| `ScrollAreaCorner` | The square where two overlay scrollbars meet. |
| `ScrollAreaScrollToEnd` | A button that scrolls to the end, shown while away from it. Name it with its content. |

All parts accept `className` (merged last; a string or a function of state), `style` and `render`.

## Styling

Slots are UI SDK's: `data-slot="scroll-area"` (with the kit's `data-orientation`), `scroll-area-viewport`, `scroll-area-content`, `scroll-area-scrollbar`, `scroll-area-thumb`, `scroll-area-corner`, `scroll-area-scroll-to-end`. The root carries `data-overflow-x` / `-y`, `data-at-start` / `-end` and per-axis `data-at-y-start`, `data-at-y-end` (and `x`), `data-scrolling`, `data-hovering` and `data-sticking`; a scrollbar has `data-visible` while it should show, and a dragged thumb `data-dragging`. For fades that grow with the distance, the root sets `--scroll-area-overflow-y-start`, `--scroll-area-overflow-y-end` (and `x`) and `--scroll-area-progress-y` / `-x`; they don't inherit, so a child reads one with `inherit`. The native scrollbar look is the `bl-scroll` utility class (`scrollbar-width: thin`, plus a 3px WebKit scrollbar), which you can put on any scroller of your own. `scrollAreaViewportVariants({ orientation })` returns the viewport's classes.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `scrollAreaViewportVariants`

Defined in `@/components/ui/scroll-area`. Base classes:

```text
bl-scroll min-h-0 flex-1 overscroll-contain rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45
```

**`orientation`** — default `vertical`

| Value | Adds |
| --- | --- |
| `vertical` (default) | `overflow-x-hidden! overflow-y-auto!` |
| `horizontal` | `overflow-x-auto! overflow-y-hidden!` |
| `both` | `overflow-auto` |
