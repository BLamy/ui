# Hover Card

A card that previews what its trigger points at — a person, a repository, a file, a commit — while the pointer rests on the trigger or keyboard focus stays on it, on [UI SDK](https://ui-sdk.dev)'s Hover Card. Where a [Tooltip](https://blamy.github.io/ui/#/tooltip) names a control in a line of text, a hover card is a small page: an avatar and a title, a line or two of detail, even a button. The pointer can move into it to select its text or press that button without it closing. Hover cards are how BL UI previews references everywhere: Avatar takes a `card`, ListRow a `preview`, Tree a `preview(node)`, and the blocks use them for people, links, files and the like. Use a [Popover](https://blamy.github.io/ui/#/popover) instead for content that is opened on purpose (a press) or must work on touch, and a Tooltip for a short label.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/hover-card.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  HoverCard, HoverCardTrigger, HoverCardContent, HoverCardHeader,
} from '@/components/ui/hover-card'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  HoverCard, HoverCardTrigger, HoverCardContent, HoverCardHeader,
} from '@brett_lamy/ui/hover-card'
```
{% endtab %}
{% endtabs %}

## Usage

`HoverCard` is the root. `HoverCardTrigger` is the trigger, a link by default (give it an `href`); `render` makes it any other element that has a name — a button, a row, an avatar with an `aria-label`. `HoverCardContent` is the card and holds whatever previews it. `HoverCardHeader` lays out the usual top in the kit's row anatomy: an `icon` (an Avatar, a glyph, a thumbnail; hidden from screen readers, since the title says the same), a `title` (the card's heading), a `description` under it and a `trailing` control.

```tsx
<HoverCard>
  <HoverCardTrigger href="/u/ada">@ada</HoverCardTrigger>
  <HoverCardContent align="start">
    <HoverCardHeader icon={<Avatar name="Ada Lovelace" />} title="Ada Lovelace" description="@ada"
      trailing={<Button size="sm" variant="secondary">Follow</Button>} />
    <p>Maintainer · reviews the motion and layout parts.</p>
  </HoverCardContent>
</HoverCard>
```

{% demo src="hover-card/profile" %}

The card opens after the pointer — or keyboard focus — has rested on the trigger for 600ms (`delay`), and stays 300ms after the pointer leaves both the trigger and the card (`closeDelay`), so the pointer can cross the gap into it. Esc closes it and leaves focus on the trigger; Tab from the trigger moves into an open card. The content opens on the trigger's `side` (`bottom` by default), lined up by `align`, 8px away (`sideOffset`), and flips when there's no room; `arrow` draws a pointer toward the trigger.

## On the parts

Most hover cards belong to a part that already shows the thing they preview:

- **Avatar** — `card={…}` opens on the avatar itself, inside an AvatarGroup too.
- **ListRow** — `preview={…}` opens beside the row, so it never covers the list.
- **Tree** — `preview={(node) => …}` opens beside the row under the pointer; return nothing for rows without one.

{% demo src="hover-card/rows" %}

## One card for many triggers

A feed or a list can share one card instead of rendering one per link. Connect the triggers and the card to one `createHoverCardController<Payload>()`; each trigger passes a `payload` and the content reads it from its state. As the pointer sweeps from one trigger to the next, the open card moves along at once, without the delay.

```tsx
const profile = createHoverCardController<Person>()

{people.map((person) => (
  <HoverCardTrigger key={person.id} controller={profile} payload={person} href={`/u/${person.handle}`}>
    {person.name}
  </HoverCardTrigger>
))}
<HoverCard controller={profile}>
  <HoverCardContent>{({ payload }) => payload && <HoverCardHeader title={payload.name} description={`@${payload.handle}`} />}</HoverCardContent>
</HoverCard>
```

For something you hit-test yourself — a canvas item, a map pin, an SVG mark — open it from code: `profile.open({ anchor, payload })` places the card against `anchor` (an element, or a virtual anchor such as a point `{ x, y }`), and `profile.close()` closes it.

## What goes inside

A preview, not the thing itself: a header, a line or two of detail, a few badges, at most one or two actions. It is 18rem wide (`className="w-80"` changes it). Because touch never opens a hover card, everything in it must also be reachable by pressing the trigger — the profile behind the name, the file behind the row.

## Accessibility

The trigger stays a plain link (or the element you render), and pressing it does what it always does. The card is a preview beside it, not a dialog: it never traps focus or blocks the page, and it doesn't hide the rest of the page from assistive technology. It is supplementary — screen reader and touch users get the same information by following the trigger, which should have its own name. Presses inside the card stay in the card: they never also press the row or button it previews.

## Props

### HoverCard

| Prop | Default | Effect |
| --- | --- | --- |
| `delay` | `600` | ms the pointer or keyboard focus rests on the trigger before it opens. |
| `closeDelay` | `300` | ms before it closes once the pointer has left trigger and card. |
| `open` / `defaultOpen` / `onOpenChange(open, details)` | closed | Control visibility; `details.reason`, `details.cancel()`. |
| `disabled` | `false` | Never opens. |
| `controller` | — | From `createHoverCardController()`: share one card between triggers, open it from code. |
| `container` | BLProvider's root | Where it renders. |

### HoverCardTrigger

| Prop | Default | Effect |
| --- | --- | --- |
| `href` | — | Where the link goes. |
| `render` | an `<a>` | Another element: `render={<button type="button" aria-label="Ada" />}`. |
| `controller` / `payload` | — | Connect a trigger outside the root, with data for the card. |

### HoverCardContent

| Prop | Default | Effect |
| --- | --- | --- |
| `side` / `align` | `bottom` / `center` | Where it opens relative to the trigger. |
| `sideOffset` / `alignOffset` | `8` / `0` | Gap in px, and shift along the trigger. |
| `arrow` | `false` | Draw a pointer toward the trigger (`HoverCardArrow`). |
| `className` / `style` | `w-72 p-4` | Merged onto the card; either may be a function of its state. |
| `children` | — | Content, or a function of its state (`open`, `payload`). |

### HoverCardHeader

| Prop | Effect |
| --- | --- |
| `icon` | An Avatar, glyph or thumbnail on the leading side. |
| `title` | What the card previews, as a heading (`h3`). |
| `description` | A handle, path or kind under the title. |
| `trailing` | A trailing control or status: a Follow button, a Badge. |

Other props (`id`, `aria-*`, `data-*`, `className`, `style`, `ref`) go on its `div`.

## Styling

Slots (from UI SDK): `hover-card-trigger`, `hover-card-content`, `hover-card-arrow`, plus `hover-card-header`. The card is on the same surface as [Popover](https://blamy.github.io/ui/#/popover) (`popover` colors, `rounded-card` from the `--radius` scale and `shadow-popover`) with the same motion: it grows out of the trigger as it enters (`data-starting-style`), leaves quicker (`data-ending-style`), and only fades under reduced motion; `data-side` / `data-align` give where it landed. Only the trigger that opened it gets `data-open`. It renders into BLProvider's root (the browser's top layer without one), and inside a [ThemeScope](https://blamy.github.io/ui/#/theming) it takes the scope's appearance.
