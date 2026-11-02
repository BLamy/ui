# Hover Card

A card that previews what its trigger points at — a person, a repository, a file, a commit — while the pointer rests on the trigger or keyboard focus lands on it. Where a [Tooltip](https://blamy.github.io/ui/#/tooltip) names a control in a line of text, a hover card is a small page: an avatar and a title, a line or two of detail, even a button. The pointer can move into it to select its text or press that button without it closing. Hover cards are how BL UI previews references everywhere: Avatar takes a `card`, ListRow a `preview`, Tree a `preview(node)`, and the blocks use them for people, links, files and the like.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/hover-card.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  HoverCard, HoverCardTrigger, HoverCardHeader,
} from '@/components/ui/hover-card'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  HoverCard, HoverCardTrigger, HoverCardHeader,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Put the trigger and a `HoverCard` in `HoverCardTrigger`. The first child is the trigger — usually a link, a name or an avatar — and the card holds whatever previews it. `HoverCardHeader` lays out the usual top: media, a title, a subtitle and an action.

```tsx
<HoverCardTrigger>
  <a href="/u/ada">@ada</a>
  <HoverCard placement="bottom start">
    <HoverCardHeader media={<Avatar name="Ada Lovelace" />} title="Ada Lovelace" subtitle="@ada"
      action={<Button size="sm" variant="secondary">Follow</Button>} />
    <p>Maintainer · reviews the motion and layout parts.</p>
  </HoverCard>
</HoverCardTrigger>
```

{% demo src="hover-card/profile" %}

The card opens after the pointer has rested on the trigger for 600ms (`delay`) and stays 250ms after it leaves both the trigger and the card (`closeDelay`), so the pointer can cross the gap into it. Only one is open at a time, and right after one closes the next opens without the delay, so sweeping across names in a paragraph or rows in a list moves the card along. Keyboard focus (`:focus-visible`, not a click) opens it at once; Esc closes it. `placement` is `bottom` by default and flips when there's no room; `arrow` draws a pointer toward the trigger.

## On the parts

Most hover cards belong to a part that already shows the thing they preview:

- **Avatar** — `card={…}` opens on the avatar itself, inside an AvatarGroup too.
- **ListRow** — `preview={…}` opens beside the row (`end top`), so it never covers the list.
- **Tree** — `preview={(node) => …}` opens beside the row under the pointer; return nothing for rows without one.

{% demo src="hover-card/rows" %}

## Your own triggers

`HoverCardTrigger` wraps its trigger in an inline-flex `span` (`className` changes it: `flex w-full` for a row). Where a wrapper doesn't fit — a canvas item, a table cell, an SVG mark — `useHoverCard` gives the same behavior to an element you render:

```tsx
const card = useHoverCard<HTMLDivElement>()
const { ref, ...handlers } = card.triggerProps

<div ref={ref} {...handlers}>…</div>
<HoverCard {...card.cardProps}>…</HoverCard>
```

`cardProps` carries `triggerRef`; pass your own `triggerRef` to anchor the card to a different element than the one that's hovered.

## What goes inside

A preview, not the thing itself: a header, a line or two of detail, a few badges, at most one or two actions. It is 18rem wide (`className="w-80"` changes it). Because touch never opens a hover card, everything in it must also be reachable by pressing the trigger — the profile behind the name, the file behind the row.

## Accessibility

The card is a non-modal popover: it never takes focus, traps it or blocks the page, and it doesn't hide the rest of the page from assistive technology. It is supplementary — screen reader users get the same information by following the trigger, which should be a real link or button with its own name. Opening on `:focus-visible` gives keyboard users the preview as they Tab through; pressing the trigger still does what it always does.

## Props

### HoverCardTrigger (and useHoverCard)

| Prop | Default | Effect |
| --- | --- | --- |
| `delay` | `600` | ms of hovering before it opens (none while warm). |
| `closeDelay` | `250` | ms before it closes once the pointer has left trigger and card. |
| `isOpen` / `defaultOpen` / `onOpenChange` | closed | Control visibility. |
| `isDisabled` | `false` | Never opens. |
| `className` | `inline-flex max-w-full` | The wrapper around the trigger (HoverCardTrigger only). |

### HoverCard

| Prop | Default | Effect |
| --- | --- | --- |
| `placement` | `bottom` | Side and alignment relative to the trigger; flips when there's no room. |
| `offset` | `8` | Gap in px. |
| `arrow` | `false` | Draw a pointer toward the trigger. |
| `triggerRef` / `isOpen` / `onOpenChange` | from HoverCardTrigger | For `useHoverCard`'s `cardProps`. |
| `className` / `contentClassName` | `w-72` / `p-4` | The surface and its padded content. |

### HoverCardHeader

| Prop | Effect |
| --- | --- |
| `media` | An Avatar, icon or thumbnail on the leading side. |
| `title` / `subtitle` | The name, and a handle, path or kind under it. |
| `action` | A trailing control: a Follow button, a status Badge. |

## Styling

The card is `data-slot="hover-card"` with its content in `hover-card-content`, on the same surface as [Popover](https://blamy.github.io/ui/#/popover) (`popover` colors, the 14px radius and shadow) and the same motion: it grows out of the trigger and fades under reduced motion. It renders in BLProvider's portal root, or `<body>` without one, and inside a [ThemeScope](https://blamy.github.io/ui/#/theming) it takes the scope's appearance.
