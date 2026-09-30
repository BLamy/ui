# ScrollArea

A scroll container with the kit's thin scrollbars. Scrolling stays native — momentum, overscroll, trackpad, touch, find-in-page — and only the scrollbar is restyled: 3px wide, a soft thumb, no track. Use it wherever a region of a fixed size holds more than fits; it is a styled `div`, not a virtualized list. For a list that follows a conversation or a stream, see [MessageScroller](https://blamy.github.io/ui/#/message-scroller), and for a scroller with jump points, [IndexBar](https://blamy.github.io/ui/#/index-bar) beside it.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/scroll-area.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { ScrollArea } from '@/components/ui/scroll-area'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { ScrollArea } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Orientations

`orientation` decides which axes scroll: `vertical` (the default), `horizontal` or `both`. The region needs a bounded size to have anything to scroll — a fixed or max height (`h-44`, `max-h-80`), a width smaller than its content, or a flex or grid parent that constrains it (`min-h-0` is already applied).

{% demo src="scroll-area/orientations" %}

```tsx
<ScrollArea aria-label="Release notes" className="h-44 rounded-card bg-card">
  {releases.map((r) => <Release key={r.version} {...r} />)}
</ScrollArea>

<ScrollArea orientation="horizontal" aria-label="Tags">
  <div className="flex w-max gap-2">…</div>
</ScrollArea>
```

A horizontal area's content must be wider than the area — `w-max` on a flex row does it.

## Accessibility

A scrollable region has to be reachable without a mouse, so `ScrollArea` is a tab stop (`tabIndex={0}`) and shows a focus ring; once focused, the arrow keys, Page Up and Down, Home and End scroll it natively. Give it an `aria-label` (or `aria-labelledby`) so it is announced as something, and add `role="region"` if it is a landmark worth jumping to. If the content inside is itself focusable and you don't want the extra tab stop, pass `tabIndex={-1}`: other props are spread after the default. `overscroll-contain` keeps a scroll that reaches the end from also scrolling the page behind it.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `orientation` | `vertical` | `vertical` hides x overflow, `horizontal` hides y overflow, `both` scrolls either way. |
| `className` | — | Merged last — size it here. |
| `tabIndex` | `0` | Keyboard focusability (see above). |

Every other `div` prop passes through.

## Styling

`data-slot="scroll-area"` with `data-orientation`. The scrollbar look is the `bl-scroll` utility class (`scrollbar-width: thin`, plus a 3px WebKit scrollbar), which you can put on any scroller of your own. The base is `relative min-h-0 overscroll-contain`, so sticky children (a table header) stick to the area. `scrollAreaVariants({ orientation })` returns the classes.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `scrollAreaVariants`

Defined in `@/components/ui/scroll-area`. Base classes:

```text
bl-scroll relative min-h-0 overscroll-contain outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45
```

**`orientation`** — default `vertical`

| Value | Adds |
| --- | --- |
| `vertical` (default) | `overflow-x-hidden overflow-y-auto` |
| `horizontal` | `overflow-x-auto overflow-y-hidden` |
| `both` | `overflow-auto` |
