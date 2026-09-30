# Utilities

The small helpers every BL UI component is built from. `cn` merges class names with tailwind-merge taught the library's token utilities; `pressable` and `brandTile` are class fragments for custom controls. The rest of this page lists the other modules under `lib/` and says which are public and which are internal. The design tokens themselves are in [Styling](https://blamy.github.io/ui/#/styling) and [Theming](https://blamy.github.io/ui/#/theming).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/utils.json{% endcommand %}

Copies the source into your project's `lib/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { cn, pressable, brandTile } from '@/lib/utils'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { cn, pressable, brandTile } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## cn

```tsx
cn('px-4 py-2', isActive && 'bg-primary', className)
```

`cn(...inputs)` is `clsx` followed by `twMerge`: falsy values drop out, arrays and objects flatten, and when two utilities conflict the **last** one wins, so a consumer's `className` placed last overrides a component's defaults. Every component merges `className` this way.

What sets it apart from a stock `twMerge` is that it knows BL UI's token utilities, registered from `lib/tokens.generated.ts`. Without that, tailwind-merge would read `text-footnote` (a font size) as a color and let `text-foreground` swallow it. With it, sizes and colors are separate groups:

| Group | Tokens | Effect |
| --- | --- | --- |
| Color (`bg-*`, `text-*`, `border-*` …) | `background`, `foreground`, `card`, `primary`, `muted-foreground`, plus BL UI's `tertiary-foreground`, `secondary-strong`, `overlay`, `bar`, `sticky`, `handle`, `link`, `code`, `success`, `warning`, … | `cn('bg-card bg-bar')` is `bg-bar` |
| Font size (`text-*`) | `caption2`, `caption`, `footnote`, `detail`, `subhead`, `callout`, `body`, `title` | `cn('text-footnote text-body')` is `text-body`; `text-footnote text-foreground` keeps both |
| Radius (`rounded-*`) | `ctl`, `panel`, `card`, `sheet` | `cn('rounded-ctl rounded-card')` is `rounded-card` |
| Shadow | `hairline`, `hairline-t`, `hairline-b` | last one wins |
| Spacing (`h-*`, `min-h-*`, `size-*` …) | `toolbar`, `row` | `cn('h-row h-toolbar')` is `h-toolbar` |
| Font family | `sans`, `mono` | last one wins |

{% demo src="utilities/cn-merge" %}

If you add a token of your own to `tokens.css`, regenerate the list (`node tools/tokens/build.mjs`) so `cn` learns it; in a registry install the list is the copied `lib/tokens.generated.ts`. `tokens.generated.ts` also exports `THEME_VARS` and the `ThemeVar` type that `ThemeScope`'s `vars` uses. It is generated (do not edit it), and the lists are internal: only `ThemeVar` reaches the package root, as a type.

## pressable

A class string for tappable elements you draw yourself: it removes the mobile tap flash, inherits the host font, and nudges the brightness on hover, dimmer on light surfaces (`.97`) and brighter on dark ones (`1.12`). It has no layout, so combine it with your own shape.

```tsx
<button className={cn(pressable, 'rounded-full bg-card px-4 py-2')}>Copy link</button>
```

{% demo src="utilities/pressable" %}

It is for plain elements and [PlainButton](https://blamy.github.io/ui/#/plain-button)-style parts. The styled `Button` has its own press and hover states through react-aria's data attributes and does not use it.

## brandTile

`brandTile` is `bg-[linear-gradient(135deg,var(--primary),#5E5CE6)]`: the accent fading into iOS indigo. The indigo is a fixed brand color; the start follows `--primary` (and so a `tint`). Use it for a logo tile or an avatar square, as the greeting in [Conversation](https://blamy.github.io/ui/#/conversation) does.

## Constants

| Name | Value | Notes |
| --- | --- | --- |
| `BARH` | `52` | The toolbar height in px, for JavaScript math (navigation and drawer bars, chrome offsets). In CSS use the `h-toolbar` utility, which is the same 52px. |
| `FONT` | the iOS system stack | A font-family string. Nothing in the library uses it; set `font-sans` in CSS instead. |
| `EASE` | `cubic-bezier(.32,.72,0,1)` | Deprecated. New motion uses the spring tokens in `lib/motion.ts` (`springs`, `--ease-spring-*`). |

## Other lib modules

| Module | Public? | What it is |
| --- | --- | --- |
| `lib/container.ts` | yes | `useContainerWidth()` and `useContainerSize()` measure an element with a `ResizeObserver` and return `[ref, width]` or `[ref, { width, height }]` (a `ContainerSize`), so a shell sizes itself from its own box instead of the viewport. The `initial` argument (1200, or 1200 by 800) is used until the first measurement. `defineSlot(name)` and `collectSlots(children)` are the slot pattern behind `FloatingChat.Chat` and `ArtifactChatContainer.Content`: a slot renders nothing itself, and its parent reads the children by name. |
| `lib/sheet-drag.ts` | yes | `useSheetDrag(options)`, the grow, snap and fold gesture behind [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet)'s cap and the Composer's draggable bump. It takes `open`, `peek`, `maxReveal`, optional `detents` and `minimizable`, and returns `reveal`, `minimize`, `dragging`, `settling`, `detent`, `handlers` for the handle element and `toggle`. `SHEET_TAP_SLOP` (4px) and `SHEET_MINIMIZE_TRAVEL` (96px) are its thresholds. |
| `lib/qr.ts` | yes | `encodeQR(text, { level, minVersion, maxVersion, mask })` returns `{ size, version, level, mask, modules }` with `modules[y][x]` true for a dark module. Byte mode only; throws a `RangeError` when the text does not fit. It is what `QRSvg` draws, so use that component unless you need the matrix. |
| `lib/primitives.ts` | internal | Shared class fragments for the primitives: `focusRing`, `popoverSurface`, `popoverMotion`, `overlayZ`, `selectableText`. The file says it is not exported from the package; copy one in if you need it. |
| `lib/row-label.ts` | internal | `RowLabelContext` and `useRowLabel`. A list row publishes its title's id so a Switch or Slider inside it is labelled by the row title unless it has its own label. |
| `lib/persistent-host.tsx` | internal | How `ArtifactChatContainer` moves one composer and transcript between its docked column and its floating layer without remounting them: detached host elements portalled into, then re-attached to the current dock. |

`lib/motion.ts`, `lib/theme.tsx`, `lib/icon.tsx` and `lib/syntax.ts` have their own pages: [Motion](https://blamy.github.io/ui/#/motion), [Theming](https://blamy.github.io/ui/#/theming), [Icons](https://blamy.github.io/ui/#/icons) and [SyntaxHighlighting](https://blamy.github.io/ui/#/syntax-highlighting).
