# Avatar

A round avatar showing a person's initials on a gradient derived from their name, so the same person gets the same colour everywhere without storing one. It also takes an image, an accent `tint`, a glyph for bots, a presence dot and a hover card, and `AvatarGroup` overlaps several into one stack. Use it in [list rows](https://blamy.github.io/ui/#/lists), headers, thread lists and chat. For a workspace or app icon with no person behind it, a plain `Icon` on a tile is usually clearer; for a count or a status word, use [Badge](https://blamy.github.io/ui/#/badge).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/avatar.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Avatar } from '@/components/ui/avatar'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Avatar } from '@brett_lamy/ui/avatar'
```
{% endtab %}
{% endtabs %}

## Sizes and variations

`size` is in px (default 40) and the initials scale to 38% of it. Give it a `name`: up to two initials (the first letters of the first and last word), and a hue hashed from the name (spaces ignored). `tint` sets the accent the gradient runs from instead; `src` shows an image over the initials; `icon` replaces them (a bot's spark) and `shape="square"` rounds the corners instead of the circle; `status` adds a presence dot ringed in the surface.

{% demo src="avatar/sizes-and-stacks" %}

```tsx
<Avatar name="Wei Chen" size={56} />
<Avatar name="Ada Lovelace" tint="#0A84FF" status="online" />
<Avatar name="Stitch" shape="square" icon={<Icon name="sparkle" />} />
<Avatar name="Ada" src="/ada.png" />
```

The hashed gradient is built in OKLCH at a fixed perceptual lightness, so white initials keep at least 4.5:1 contrast in the middle of the avatar on every hue, in light and dark.

## Image and fallback

With no children an Avatar renders an `AvatarImage` for `src` and an `AvatarFallback` with the initials or the `icon`. The image covers the avatar once it has loaded; the fallback shows until then, and instead of it if it fails. Pass the parts yourself for another image (a `srcSet`, lazy loading) or fallback; `AvatarFallback`'s `delay` waits before showing it, so a fast image never flashes the initials:

```tsx
<Avatar name="Ada">
  <AvatarImage src="/ada.png" srcSet="/ada@2x.png 2x" loading="lazy" />
  <AvatarFallback delay={300}>AL</AvatarFallback>
</Avatar>
```

`onLoadingStatusChange` on the Avatar reports the image's status.

## Hover card

`card` takes a [HoverCard](https://blamy.github.io/ui/#/hover-card)'s content about the person, shown while the pointer rests on the avatar or keyboard focus stays on it. The avatar becomes a button named after them. It is shorthand for the composition, which you can write out when you need the HoverCard's own props:

```tsx
<Avatar name="Ada Lovelace" card={<HoverCardHeader icon={<Avatar name="Ada Lovelace" size={44} />} title="Ada Lovelace" description="Wrote the first program" />} />

<HoverCard>
  <HoverCardTrigger render={<Avatar name="Ada Lovelace" />} />
  <HoverCardContent>…</HoverCardContent>
</HoverCard>
```

## AvatarGroup

`AvatarGroup` wraps `Avatar`s, overlaps them (`overlap` px, 28% of the size by default) and rings each in the surface colour. Past `max` (5 by default) the rest fold into a `+N` bubble. By default it is a plain stack and each avatar keeps its own hover card. With `menu`, the stack becomes one button that opens a menu listing everyone (avatar and name), and `onAction` receives the chosen avatar's `key`. Inside that button, avatars drop their cards: they would be buttons in a button, and the menu lists everyone anyway.

{% demo src="avatar/group" %}

```tsx
<AvatarGroup aria-label="Reviewers">
  {people.map((p) => <Avatar key={p.id} name={p.name} card={<PersonCard person={p} />} />)}
</AvatarGroup>

<AvatarGroup menu onAction={(id) => open(id)}>
  {people.map((p) => <Avatar key={p.id} name={p.name} tint={p.tint} />)}
</AvatarGroup>
```

## On a surface

The rings (around each avatar in a stack, and around the presence dot) take `--avatar-ring`, the page background by default. A [Card](https://blamy.github.io/ui/#/card) sets it to its own colour; on any other surface set it once on the region: `className="[--avatar-ring:var(--sidebar)]"`.

## Accessibility

A named avatar is an image (`role="img"`) called after the person, with their presence: "Ada Lovelace, Online". The initials and the dot are hidden from screen readers, so nothing is read twice. In a row that already shows the name beside it, pass `aria-hidden` to the avatar. Pass `aria-label` to name it something else. With a `card`, the avatar is a button named after the person (UI SDK's interactive avatar): it is in the Tab order, and keyboard focus opens the card after the same delay as the pointer; Esc closes it. The image (`AvatarImage`) is decorative (`alt=""`) unless you give it `alt`. A plain stack is a `group` named "N people" unless you set `aria-label`, and the `+N` bubble says "N more". With `menu`, the stack is one button with that name that opens a [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu) whose items are named by the people's names: arrow keys, typeahead, Esc and focus return come with it.

## Props

### Avatar

UI SDK's `Avatar` props (`render`, `onLoadingStatusChange`, any `span` attribute), plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `name` | — | Who it is: up to two initials (first and last word), the hue of the gradient, and the avatar's accessible name. |
| `initials` | — | Replaces the computed initials. |
| `tint` | — | Accent colour (any CSS colour): the gradient runs from it to a fainter copy. |
| `src` | — | An image over the initials; the initials stay if it fails to load. |
| `icon` | — | A glyph in place of the initials. |
| `shape` | `circle` | `square` for a rounded square (radius 30% of the size). |
| `status` | — | `online`, `idle`, `dnd` or `offline`: a presence dot on the lower right, added to the accessible name. |
| `size` | `40` | Width and height in px; font size is `size × 0.38`. |
| `card` | — | A HoverCard's content about them. The avatar becomes a button. |
| `children` | — | Your own `AvatarImage` and `AvatarFallback`, in place of the ones made from `src`, `icon` and the name. |
| `className` / `style` | — | Merged onto the `span`; `style` is applied after the computed size and gradient, so it can override them. |

### AvatarGroup

Any `div` attribute (`id`, `aria-*`, `data-*`, `ref`) passes to the root (the menu's trigger with `menu`), plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `children` | — | The `Avatar`s, each with a `key` and a `name` (which labels it in the menu). |
| `max` | `5` | Avatars shown before the rest become a `+N` bubble. |
| `size` | `32` | Size of every avatar (an avatar's own `size` wins). |
| `overlap` | 28% of `size` | How far each avatar tucks under the one before, in px. |
| `menu` | `false` | Make the stack one button that lists everyone in a menu. |
| `aria-label` | `N people` | Accessible name of the group (and, with `menu`, of its button and menu). |
| `onAction` | — | With `menu`: `(value, details)` when someone is chosen; `value` is their avatar's `key` (its index when it has none). |

## Styling

The root is UI SDK's Avatar, with `data-slot="avatar"` and `data-loading-status` (`idle`, `loading`, `loaded` or `error`) for its image; the image is `avatar-image` and the fallback `avatar-fallback`. The dot is `avatar-status` (with `data-status`), the `+N` bubble is an avatar with `data-overflow`, and a stack without a menu is `avatar-group` (with a menu, the group is the menu's trigger). The size, font size, corner radius and gradient (an OKLCH hue from the name, lighter at the top; or from `tint`) are computed per render and set as the CSS variables `--avatar-size`, `--avatar-font`, `--avatar-radius` and `--avatar-bg`; everything else is classes. Override the gradient with `style`, not a background class. `avatarVariants`, `avatarStatusVariants` and `avatarGroupVariants` are exported.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `avatarGroupVariants`

Defined in `@/components/ui/avatar-group`. Base classes:

```text
inline-flex items-center rounded-full outline-none [&>*]:ring-2 [&>*]:ring-(--avatar-ring,var(--background)) [&>*+*]:-ml-(--avatar-overlap)
```

No variants.

### `avatarVariants`

Defined in `@/components/ui/avatar`. Base classes:

```text
grid size-(--avatar-size) shrink-0 place-items-center bg-(image:--avatar-bg) font-semibold tracking-[.5px] text-white select-none [font-size:var(--avatar-font)]
```

**`shape`** — default `circle`

| Value | Adds |
| --- | --- |
| `circle` (default) | `rounded-full` |
| `square` | `rounded-(--avatar-radius)` |

### `avatarStatusVariants`

Defined in `@/components/ui/avatar`. Base classes:

```text
absolute -right-[2px] -bottom-[2px] box-border size-[max(10px,calc(var(--avatar-size)*.36))] rounded-full border-[2.5px] border-(--avatar-ring,var(--background))
```

**`status`** — default `online`

| Value | Adds |
| --- | --- |
| `online` (default) | `bg-success` |
| `idle` | `bg-warning` |
| `dnd` | `bg-destructive` |
| `offline` | `bg-tertiary-foreground` |
