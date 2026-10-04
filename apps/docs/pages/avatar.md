# Avatar

A round avatar showing a person's initials on a gradient derived from their name, so the same person gets the same colour everywhere without storing one. It also takes an image, an accent colour, a glyph for bots and a presence dot, and `AvatarGroup` overlaps several into one pressable stack. Use it in [list rows](https://blamy.github.io/ui/#/lists), headers, thread lists and chat.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/avatar.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Avatar, AvatarGroup } from '@/components/ui/avatar'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Avatar, AvatarGroup } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Sizes and variations

`size` is in px (default 40) and the initials scale to 38% of it. Give it a contact (`c`), or just a `name` (up to two initials). `color` sets the accent the gradient runs from; `src` shows an image over the initials; `icon` replaces them (a bot's spark) and `shape="square"` rounds the corners instead of the circle; `status` adds a presence dot ringed in the surface (set `--avatar-ring` on a region whose background isn't the page's).

{% demo src="avatar/sizes-and-stacks" %}

```tsx
<Avatar c={{ f: 'Wei', l: 'Chen' }} size={56} />
<Avatar name="Ada Lovelace" color="#0A84FF" status="online" />
<Avatar name="Stitch" shape="square" icon={<Icon name="sparkle" />} />
<Avatar name="Ada" src="/ada.png" />
```

## AvatarGroup

`AvatarGroup` wraps `Avatar`s, overlaps them (`overlap` px, 28% of the size by default) and rings each in the surface colour. Past `max` (5 by default) the rest fold into a `+N` bubble. Pressing the group opens a menu listing everyone — avatar and name — and `onSelect` receives the position of the one chosen. `menu={false}` leaves a plain stack.

{% demo src="avatar/group" %}

```tsx
<AvatarGroup max={5} onSelect={(i) => open(people[i])}>
  {people.map((p) => <Avatar key={p.id} name={p.name} color={p.color} />)}
</AvatarGroup>
```

## Accessibility

The initials are the only content and the `span` has no role or label. In a row that also shows the person's name, the avatar is decoration and the name carries the meaning. If it is the only thing identifying someone, pass `aria-label` (the avatar then gets `role="img"`). A pressable `AvatarGroup` is one button named "N people" (set `label`), and its menu is a react-aria menu: arrow keys, typeahead, Esc and focus return come with it.

## Props

### Avatar

| Prop | Default | Effect |
| --- | --- | --- |
| `c` | — | `{ f, l }`: first and last name. The initials are `f[0]` and `l[0]`, and the colour hashes `f + l` into a hue. |
| `name` | — | A display name instead of `c`: up to two initials (first and last word), and its hash picks the colour. |
| `initials` | — | Replaces the computed initials. |
| `color` | — | Accent colour (any CSS colour): the gradient runs from it to a fainter copy. |
| `src` | — | An image over the initials; the initials stay if it fails to load. |
| `icon` | — | A glyph in place of the initials. |
| `shape` | `circle` | `square` for a rounded square (radius 30% of the size). |
| `status` | — | `online`, `idle`, `dnd` or `offline`: a presence dot on the lower right. |
| `size` | `40` | Width and height in px; font size is `size × 0.38`. |
| `className` / `style` | — | Merged onto the `span`; `style` is applied after the computed size and gradient, so it can override them. |

With `c`, both names are required: `f[0]` and `l[0]` are read directly, so an empty string yields a missing initial.

### AvatarGroup

| Prop | Default | Effect |
| --- | --- | --- |
| `children` | — | The `Avatar`s. Each one's `name` (or `c`) labels it in the menu. |
| `max` | `5` | Avatars shown before the rest become a `+N` bubble. |
| `size` | `32` | Size of every avatar (an avatar's own `size` wins). |
| `overlap` | 28% of `size` | How far each avatar tucks under the one before, in px. |
| `menu` | `true` | Press the group to list everyone. `false` leaves a non-interactive stack. |
| `label` | `N people` | Accessible name of the group. |
| `onSelect` | — | Called with the index of the person chosen from the menu. |

## Styling

The root has `data-slot="avatar"` (the dot is `avatar-status`, the `+N` bubble `avatar-overflow`, the group `avatar-group`). The size, font size, corner radius and gradient (`hsl` hue from the name, lighter at the top; or from `color`) are computed per render and set as the CSS variables `--avatar-size`, `--avatar-font`, `--avatar-radius` and `--avatar-bg`; everything else is classes. Override the gradient with `style`, not a background class. `avatarVariants`, `avatarStatusVariants` and `avatarGroupVariants` are exported.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

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

### `avatarGroupVariants`

Defined in `@/components/ui/avatar`. Base classes:

```text
inline-flex items-center rounded-full outline-none [&>*]:ring-2 [&>*]:ring-(--avatar-ring,var(--background)) [&>*+*]:-ml-(--avatar-overlap)
```

No variants.
