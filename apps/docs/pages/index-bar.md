# IndexBar

A jump rail for long scrollers: a thin strip of stops along one edge that you hover, press or scrub to move somewhere else. It draws three ways: the UIKit A–Z index of a contact list, a rail of your own stops (chat turns, headings, pages) with a preview bubble, and a Dock-style `wave` of dashes that swells around the pointer, optionally with an outline panel. It doesn't scroll anything itself: it reports the stop under the pointer and you move your scroller. The [Lists](https://blamy.github.io/ui/#/lists) page covers how it sits beside `List` and `ListRow`; this page is the full reference.

Use a sibling instead when the landmarks sit on a clock ([TraceTimeline](https://blamy.github.io/ui/#/trace-timeline)'s vertical rail draws the same wave, with time between the stops), when you need a scrollbar rather than jump points ([ScrollArea](https://blamy.github.io/ui/#/scroll-area)), or when the stops are views to switch between rather than places in one scroller ([Tabs](https://blamy.github.io/ui/#/tabs)).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/index-bar.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { IndexBar } from '@/components/ui/index-bar'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { IndexBar } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

The rail fills the height of the nearest positioned ancestor (`top-0 bottom-0`) on its `side`, so put it next to the scroller inside a `relative` wrapper, not inside the scroller, or it scrolls away. Move it with classes: `className="top-14 bottom-2"` clears a 52px bar.

## A–Z

`alphabetItems(letters)` is the UIKit alphabet: all 26 letters, with the ones not in `letters` disabled (dimmed but still reachable, so the stops never drift from the letters; pass nothing and every letter is enabled). `onJump` fires as the pointer crosses each letter. Hover peeks a magnified letter without jumping; press and drag to scrub and jump.

{% demo src="index-bar/alphabet" %}

```tsx
<div className="relative h-full">
  <Scroller ref={scroller}>…</Scroller>
  <IndexBar
    items={alphabetItems(letters)}
    className="top-2 bottom-2"
    onJump={(letter) => scrollToSection(letter)}
  />
</div>
```

## Custom stops

`items` is an array of stops; a bare `string | number` is shorthand for a stop with that key. A stop is `key` (handed back untouched to `onJump`, so a number stays a number), `label` (printed on the rail; leave it out for a dot), `caption` (the accessible name, and the heading of the bubble), `preview` (any node, shown in the bubble while you hover or scrub) and `disabled` (dimmed, still reachable). `onJump(key, { index, item, reason, event })` fires on a press, on each stop the pointer scrubs across, and on keyboard moves.

{% demo src="index-bar/turns" %}

```tsx
const stops: IndexBarItem<number>[] = turns.map((t, i) => ({
  key: t.id,
  label: i % 3 === 0 ? String(i + 1) : undefined,
  caption: t.author,
  preview: t.text,
}))

<IndexBar items={stops} aria-label="Jump to turn" onJump={(id) => scrollToTurn(id)} />
```

## Wave

`variant="wave"` draws one dash per stop; dashes near the pointer grow with a cosine falloff, like the macOS Dock, and `current` (the key of the stop you are at) draws that dash full length in the tint and sets `aria-current` on it. Two ways to read it: hover a dash for a card with that stop's `caption`, `preview` (`previewLines`, `previewWidth`) and a `trailing` node; or add `panel` and hovering the rail opens one card listing every stop as an outline, with `panelTitle` on top, `level` (1 and up) indenting nested stops, and the current stop marked. Put it on the reading side with `side="start"`. The wave, its card and the row inset are `lib/wave-rail`, shared with TraceTimeline's rail.

{% demo src="index-bar/wave" %}

```tsx
<IndexBar
  variant="wave"
  side="start"
  panel
  panelTitle="On this page"
  aria-label="Sections"
  items={headings.map((h) => ({ key: h.id, caption: h.text, level: h.depth }))}
  current={sectionInView}
  onJump={(id) => scrollTo(id)}
/>
```

`current` is yours to keep up to date, usually from the scroll position or an `IntersectionObserver`.

## Accessibility

The rail is a `role="listbox"` with one `option` per stop, named by its `caption`, else its `label`, else "Stop N"; `aria-label` names the listbox (default "Jump to section": set a specific one). It is a tab stop that keeps focus (UI SDK's listbox behavior with virtual focus): Up and Down, Page Up and Page Down move through the stops and jump to each, Home and End jump to the first and last, it stops at either end, and `aria-activedescendant` tracks the active one. A press jumps to the stop under it and a drag scrubs through the stops, following the pointer even off the rail (UI SDK's `bindDrag`). The rail shows an outline while it has keyboard focus (`:focus-visible`), not after a press. The hover bubble, the wave preview card and the `panel` are pointer conveniences (the panel is `aria-hidden`); every stop is also reachable from the keyboard. Touch scrubs on press and drag (hover previews don't apply to touch). A disabled stop is `aria-disabled` and dimmed, but stays in the arrow order and still jumps (a letter with no contacts jumps to the nearest one, if your `onJump` does that).

## Props

Every `div` prop (`id`, `aria-label`, `className`, `style`, `ref`, `data-*`…) passes to the rail, plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `items` | — | Stops: `K` (string or number) or `{ key?, label?, caption?, preview?, disabled?, level?, trailing? }`. `alphabetItems(available?)` builds the A–Z rail. |
| `onJump` | — | `(key, { index, item, reason, event })` each time the rail lands on another stop. `reason` is `drag` (press or scrub), `list-navigation` (keys), `item-press` (a `panel` row, or a stop clicked by assistive tech) or `imperative` (the agent bridge). |
| `variant` | `default` | `default` letters and dots with a bubble; `wave` dashes. |
| `side` | `end` | `start` or `end`: the edge the rail sits on; previews open on the inner side. |
| `current` | — | Key of the stop you are at: `aria-current`, and the tinted dash in the wave. |
| `panel` / `panelTitle` | `false` / — | Wave only: the outline card. |
| `previewLines` / `previewWidth` | `2` / `260` | Wave preview card: lines of `preview` and the card's maximum width in px. |
| `insetContent` | `true` | `end` rail: keep list rows clear of it (below). |
| `aria-label` | `Jump to section` | The listbox's name. |

Size and place the rail with classes: it is 22px wide (40px for `wave`) and fills the ancestor's height; `className="top-14 bottom-2 w-8"` changes either.

### Keeping list rows clear

A rail on the `end` side measures how far the `ListRow`s in its parent run under it and publishes that as `--bl-index-bar-inset` on the parent; rows widen their trailing inset by it, so chevrons and accessories are not covered by the letters (an inset-grouped list, which doesn't reach the rail, gets little or none). Pass `insetContent={false}` to opt out. This is for `List` content; other content needs its own end padding.

## Styling

`data-slot="index-bar"` with `data-variant`, `data-side` and `data-scrubbing` while a press or drag is on it; the stops are `index-bar-option` (with `data-highlighted` for the keyboard's, `data-disabled` and `aria-current` where they apply) inside `index-bar-track`; the wave's outline card is `data-slot="index-bar-panel"`, never taller than the rail (it scrolls inside that). Letters use the tint (`text-primary`) and disabled ones `text-tertiary-foreground`; the wave's dashes use the foreground color. The bubble and cards are `bg-card` with the popover shadow (`shadow-popover`). `indexBarVariants({ variant, side })` returns the rail's positioning and width.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `indexBarVariants`

Defined in `@/components/ui/index-bar`. Base classes:

```text
absolute top-0 bottom-0 z-80 flex cursor-pointer touch-none flex-col justify-center rounded-lg outline-offset-2 select-none
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `w-[22px] items-center` |
| `wave` | `w-10 items-stretch` |

**`side`** — default `end`

| Value | Adds |
| --- | --- |
| `end` (default) | `end-0` |
| `start` | `start-0` |
