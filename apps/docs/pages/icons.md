# Icons

An SF Symbols-style set drawn for BL UI: every glyph sits on the same 24px grid with about 2px of optical padding, strokes with round caps and joins in `currentColor`, and shares one set of corner radii, so icons from media, settings and mail screens line up next to each other and next to text. Transport controls are solid, as they are in SF Symbols; most other glyphs come as an outline with a `-fill` variant.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Icon } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/icon.json{% endcommand %}

Adds `@/components/ui/icon.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import { Icon } from '@/components/ui/icon'
```
{% endtab %}
{% endtabs %}

## Usage

Pick a glyph by name. It takes the text color around it, so tint it with `color` or a text class:

```tsx
<Icon name="paperplane" />
<Icon name="heart-fill" className="text-destructive" />
<Icon name="bell-slash" size={18} weight="semibold" />
```

Icons are decorative by default (`aria-hidden`). When an icon is the only content of a control, label the control; when the icon itself carries meaning, give it a `title` and it renders as `role="img"` with that name:

```tsx
<Icon name="lock-fill" title="Encrypted" />
```

Names are kebab-case and follow SF Symbols where they can: `magnifyingglass`, `xmark`, `archivebox`, `speaker-high`, `arrow-clockwise`. `ICON_NAMES` lists every one, `ICON_CATEGORIES` groups them, and `ICON_KEYWORDS` holds the synonyms the gallery below searches.

## Sizes and weights

`size` sets the width and height in pixels (default 22). `weight` sets the stroke the way SF Symbols' weights do; solid shapes keep their size, and knocked-out details (the tick in `check-circle-fill`) follow the weight too. Pass `sw` for an exact stroke width instead.

| Weight | Stroke |
| --- | --- |
| `ultralight` | 1.2 |
| `light` | 1.5 |
| `regular` | 1.8 (default) |
| `medium` | 2 |
| `semibold` | 2.2 |
| `bold` | 2.5 |

Match the weight to the text beside the icon: `regular` next to body text, `semibold` in toolbars and tab bars, `bold` for small glyphs inside filled circles.

## Gallery

Search by name or keyword (try "mute", "lyrics" or "settings"), narrow by category, pick a weight, and click an icon to copy its JSX.

{% demo src="icons/gallery" %}

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | `IconName` | — | Which glyph to draw. An unknown name draws `info`. |
| `size` | `number` | `22` | Width and height in px. |
| `weight` | `'ultralight' \| 'light' \| 'regular' \| 'medium' \| 'semibold' \| 'bold'` | `'regular'` | Stroke weight. |
| `sw` | `number` | — | Exact stroke width; overrides `weight`. |
| `title` | `string` | — | Accessible name; renders `role="img"` with a `<title>`. |
| `aria-label` | `string` | — | Accessible name without a tooltip title. |
| `shapes` | `IconShape[]` | — | Custom geometry drawn with the same stroke system; overrides `name`. |
| `className`, `style` | | | Passed to the `<svg>`. |

Older names from earlier releases (`chev`, `chevL`, `search`, `x`, `xcirc`, `home`, `mail`, `starF`, `person2`, `wave`, `pin`, `phone`, `message`) still work and draw exactly what they did; `ICON_ALIASES` maps the ones that became canonical names.

## Custom shapes

A glyph is a list of shapes on the 24px grid. Draw your own with `shapes` and it gets the same stroke, weights and knockouts as the built-in set:

```tsx
import { Icon, type IconShape } from '@brett_lamy/ui'

const TICKET: IconShape[] = [
  { d: 'M4 7.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2.5 2.5 0 0 0 0 5v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2.5 2.5 0 0 0 0-5z' },
  { d: 'M14.5 6v2M14.5 11v2M14.5 16v2' },
]

<Icon shapes={TICKET} weight="semibold" />
```

| Key | Meaning |
| --- | --- |
| `d` | an SVG path |
| `c` | a circle, `[cx, cy, r]` |
| `r` | a rounded rect, `[x, y, width, height, rx]` |
| `f` | `1` fills instead of stroking; `2` fills and strokes, so a solid variant keeps its outline's size and rounded corners |
| `k` | `1` knocks the shape out of the rest through a mask, so the cut shows whatever is behind the icon |
| `o` | `1` draws the shape above the knockouts (a slash over its own gap) |
| `w` | scales the stroke width for this shape |
| `fr` | `1` uses the even-odd fill rule |

Keep to the grid's conventions so custom glyphs sit with the set: content inside roughly 3.5–20.5, strokes at the default width, circles at radius 8.6 for circled symbols, and corner radii around 1.5–2.
