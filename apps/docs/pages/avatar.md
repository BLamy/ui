# Avatar

A round avatar showing a person's initials on a gradient derived from their name, so the same person gets the same colour everywhere without storing one. It is a dependency-free `span`: there is no image support. Use it in [list rows](https://blamy.github.io/ui/#/lists), headers and thread lists.

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

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Avatar } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Sizes and stacks

`size` is in px (default 40) and the initials scale to 38% of it. Avatars are plain elements, so stacks, rings and presence dots are a matter of classes.

{% demo src="avatar/sizes-and-stacks" %}

```tsx
<Avatar c={{ f: 'Wei', l: 'Chen' }} size={56} />

// Overlap and ring for a stack
<Avatar c={person} size={34} className="-ml-2.5 ring-2 ring-background" />
```

## Accessibility

The initials are the only content and the `span` has no role or label. In a row that also shows the person's name, the avatar is decoration and the name carries the meaning. If it is the only thing identifying someone, add `aria-label` (and `role="img"`) through a wrapper, as the stack above does for the group.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `c` | — | `{ f, l }` (required): first and last name. The initials are `f[0]` and `l[0]`, and the colour hashes `f + l` into a hue. |
| `size` | `40` | Width and height in px; font size is `size × 0.38`. |
| `className` / `style` | — | Merged onto the `span`; `style` is applied after the computed size and gradient, so it can override them. |

The first and last name are both required: `f[0]` and `l[0]` are read directly, so an empty string yields a missing initial.

## Styling

The root has `data-slot="avatar"`. The size, font size and gradient (`hsl` hue from the name, lighter at the top) are computed per render and set inline; everything else is classes (`rounded-full`, `font-semibold`, white text, `select-none`). Because the gradient is inline, override it with `style`, not a background class.
