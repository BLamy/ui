# IndexBar

A jump rail for long scrollers: a thin strip of stops along one edge that you hover, press or scrub to move somewhere else. It is three things in one component — the UIKit A–Z index for a contact list, a rail of your own stops (chat turns, headings, pages) with a preview bubble, and a Dock-style `wave` of dashes that swells around the pointer, optionally with an outline panel. It does not scroll anything itself: it reports the stop under the pointer and you move your scroller. The [Lists](https://blamy.github.io/ui/#/lists) page covers how it sits beside `List` and `ListRow`; this page is the full reference.

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

It is absolutely positioned on an edge of the nearest positioned ancestor, so put it next to the scroller inside a `relative` wrapper — not inside the scroller, or it scrolls away.

## A–Z

With no `items`, the rail is the alphabet. `avail` is the set of letters that have a section; the rest are dimmed but still reachable, so the stops never drift from the letters. `onLetter` fires as the pointer crosses each letter. Hover peeks a magnified letter without jumping; press and drag to scrub and jump.

{% demo src="index-bar/alphabet" %}

```tsx
<div className="relative h-full">
  <Scroller ref={scroller}>…</Scroller>
  <IndexBar
    avail={new Set(letters)}
    top={8}
    bottom={8}
    onLetter={(letter) => scrollToSection(letter)}
  />
</div>
```

Give no `items` *and* no `avail` and every letter is dimmed. The full alphabet is exported as `AL`.

## Custom stops

`items` is an array of stops — a bare `string | number` is shorthand for a stop with that key. Stops are objects: `key` (handed back untouched to `onJump`, so a number stays a number), `label` (printed on the rail; leave it out for a dot), `caption` (the accessible name, and the heading of the bubble), `preview` (any node, shown in the bubble while you hover or scrub) and `dim`. `onJump(key, stop, index)` fires on a press, on each stop the pointer scrubs across, and on keyboard moves.

{% demo src="index-bar/turns" %}

```tsx
const stops: IndexBarItem<number>[] = turns.map((t, i) => ({
  key: t.id,
  label: i % 3 === 0 ? String(i + 1) : undefined,
  caption: t.author,
  preview: t.text,
}))

<IndexBar items={stops} label="Jump to turn" onJump={(id) => scrollToTurn(id)} />
```

## Wave

`variant="wave"` draws one dash per stop; dashes near the pointer grow with a cosine falloff, like the macOS Dock, and `value` — the key of the current stop — draws that dash full length in the tint. Two ways to read it: hover a dash for a card with that stop's `caption`, `preview` (`previewLines`, `previewWidth`) and a `trailing` node; or add `panel` and hovering the rail opens one card listing every stop as an outline, with `panelTitle` on top, `level` (1 and up) indenting nested stops, and the current stop marked. Put it on the reading side with `side="left"`.

{% demo src="index-bar/wave" %}

```tsx
<IndexBar
  variant="wave"
  side="left"
  panel
  panelTitle="On this page"
  items={headings.map((h) => ({ key: h.id, caption: h.text, level: h.depth }))}
  value={sectionInView}
  onJump={(id) => scrollTo(id)}
/>
```

`value` is yours to keep current, usually from the scroll position or an `IntersectionObserver`. It only affects the wave.

## Accessibility

The rail is a `role="listbox"` with one `option` per stop, named by its `caption`, else its `label`, else "Stop N"; `label` is the listbox's name (default "Jump to section" — set a specific one). It is a tab stop: Up and Down move through the stops and jump to each, Home and End jump to the first and last, and `aria-activedescendant` tracks the active one. The rail shows an outline while focused. The hover bubble, the wave preview card and the `panel` are pointer conveniences (the panel is `aria-hidden`); jumping to any stop is also available from the keyboard. Touch scrubs on press and drag (hover previews don't apply to touch). A dimmed stop is only dimmed — it stays focusable and jumpable.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `items` | — | Stops: `K` (string or number) or `{ key?, label?, preview?, caption?, dim?, level?, trailing? }`. Falls back to A–Z when empty. |
| `onJump` | — | `(key, stop, index)` on commit. Takes precedence over `onLetter`. |
| `avail` / `onLetter` | — | A–Z fallback only: letters that have content / `(letter) => void`. |
| `variant` | `default` | `default` letters and dots with a bubble; `wave` dashes. |
| `side` | `right` | Edge the rail sits on; previews open on the inner side. |
| `value` | — | Key of the current stop (wave). |
| `panel` / `panelTitle` | `false` / — | Wave only: the outline card. |
| `previewLines` / `previewWidth` | `2` / `260` | Wave preview card: lines of `preview` and the card's maximum width in px. |
| `top` / `bottom` | — | Offsets from the ancestor's edges (number = px, or any CSS length). |
| `width` | `22`, or `40` for `wave` | Rail width in px. |
| `label` | `Jump to section` | Accessible name. |
| `insetContent` | `true` | Right-side rail: keep list rows clear of it (below). |
| `className` / `style` | — | Merged onto the rail. |

### Keeping list rows clear

A right-side rail measures how far the `ListRow`s in its parent run under it and publishes that as `--bl-index-bar-inset` on the parent; rows widen their trailing inset by it, so chevrons and accessories are not covered by the letters (an inset-grouped list, which doesn't reach the rail, gets little or none). Pass `insetContent={false}` to opt out. This is for `List` content; other content needs its own right padding.

## Styling

`data-slot="index-bar"` with `data-variant` and `data-side`; the wave's outline card is `data-slot="index-bar-panel"`. Letters use the tint (`text-primary`) and dimmed ones `text-tertiary-foreground`; the wave's dashes use the foreground color. `indexBarVariants({ variant, side })` returns the positioning classes.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `indexBarVariants`

Defined in `@/components/ui/index-bar`. Base classes:

```text
absolute z-80 flex cursor-pointer touch-none flex-col justify-center rounded-lg outline-offset-2 select-none
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `items-center` |
| `wave` | `items-stretch` |

**`side`** — default `right`

| Value | Adds |
| --- | --- |
| `right` (default) | `right-0` |
| `left` | `left-0` |
