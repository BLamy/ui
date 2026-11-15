# Utilities

The small helpers every BL UI component is built from. `cn` merges class names with tailwind-merge taught the library's token utilities; `cx` does the same under a UI SDK part's `className`, which may be a function of state; `pressable` and `brandTile` are class fragments for custom controls. The rest of this page lists the other modules under `lib/` and says which are public and which are internal. The design tokens themselves are in [Styling](https://blamy.github.io/ui/#/styling) and [Theming](https://blamy.github.io/ui/#/theming).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/utils.json{% endcommand %}

Copies the source into your project's `lib/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { cn, cx, pressable, brandTile } from '@/lib/utils'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { cn, cx, pressable, brandTile } from '@brett_lamy/ui/lib/utils'
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

## cx

```tsx
<SelectTrigger className={cx('h-row rounded-ctl px-3', className)} />
```

`cx(ours, className)` merges a component's classes under the `className` a caller passed to a UI SDK part. A part's `className` may be a string or a function of the part's state (`({ open }) => open ? 'bg-muted' : ''`); `cx` returns a string for a string and a function for a function, with the caller's classes merged last by `cn` either way. Use it wherever you wrap a UI SDK part; `cn` is for plain elements. Both are on the package root (`@brett_lamy/ui`) as well as in `@/lib/utils`.

## pressable

A class string for tappable elements you draw yourself: it removes the mobile tap flash, inherits the host font, and nudges the brightness on hover, dimmer on light surfaces (`.97`) and brighter on dark ones (`1.12`). It has no layout, so combine it with your own shape.

```tsx
<button className={cn(pressable, 'rounded-full bg-card px-4 py-2')}>Copy link</button>
```

{% demo src="utilities/pressable" %}

It is for plain elements and [unstyled UI SDK buttons](https://blamy.github.io/ui/#/button) (`Button as SdkButton` from `@ui-sdk/react/button`). The styled `Button` has its own press and hover states (`active:` and `hover:` on UI SDK's Button) and does not use it.

## brandTile

`brandTile` is `bg-[linear-gradient(135deg,var(--primary),#5E5CE6)]`: the accent fading into iOS indigo. The indigo is a fixed brand color; the start follows `--primary` (and so a `tint`). Use it for a logo tile or an avatar square, as the greeting in [Conversation](https://blamy.github.io/ui/#/conversation) does.

`pressable`, `brandTile` and the constants below are helpers for your own markup, not part of a component's API, so they stay off the package root: with npm, import them from the module, `import { pressable, brandTile } from '@brett_lamy/ui/lib/utils'`.

## Constants

| Name | Value | Notes |
| --- | --- | --- |
| `BARH` | `52` | The toolbar height in px, for JavaScript math (navigation and drawer bars, chrome offsets). In CSS use the `h-toolbar` utility, which is the same 52px. |
| `FONT` | the iOS system stack | A font-family string. Nothing in the library uses it; set `font-sans` in CSS instead. |

## Other lib modules

6.0 removed `lib/sheet-drag.ts` (`useSheetDrag`, `SHEET_TAP_SLOP`, `SHEET_MINIMIZE_TRAVEL`), the hooks in `lib/edge-swipe.ts` (`useEdgeSwipe`) and `lib/pull-to-refresh.ts` (`usePullToRefresh`), `lib/back-history.ts` and `lib/scroll-hidden.ts` (`useScrollHidden`), and `navigationPush` left `NavigationStack`. The gestures are UI SDK's behaviors (`Drawer` snap points, `bindDrag`) or the kit's own, framework-free ones built on them (`lib/edge-swipe.ts` is now `bindEdgeSwipe`, `lib/pull-to-refresh.ts` is `bindPullToRefresh`, and `lib/back.ts`, `lib/stack.ts`, `lib/size-class.ts`, `lib/presence.ts`: see [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit)), and hide-on-scroll is `useHideOnScroll` or `useChromeHidden`. See [Motion hooks](https://blamy.github.io/ui/#/hooks-motion).

| Module | Public? | What it is |
| --- | --- | --- |
| `lib/container.ts` | yes | `useSizeClass()` returns `[ref, sizeClass]`, the `compact` / `medium` / `regular` class of an element's own box (`bindSizeClass` from `lib/size-class.ts`, which also writes `data-size-class` on it), or the nearest size-class scope's before the ref is attached; reach for it first. `SizeClassProvider`, `useSizeClassScope()` and `usePresentation()` are the size-class scope that `presentation="auto"` popups follow (see [Layout hooks](https://blamy.github.io/ui/#/hooks-layout)). `useContainerWidth()` and `useContainerSize()` measure an element with a `ResizeObserver` and return `[ref, width]` or `[ref, { width, height }]` (a `ContainerSize`), so a shell sizes itself from its own box instead of the viewport. The `initial` argument (1200, or 1200 by 800) is used until the first measurement. |
| `lib/qr.ts` | yes | `encodeQR(text, { level, minVersion, maxVersion, mask })` returns `{ size, version, level, mask, modules }` with `modules[y][x]` true for a dark module. Byte mode only; throws a `RangeError` when the text does not fit. It is what `QRCode` draws, so use that component unless you need the matrix. |
| `lib/primitives.ts` | internal | Shared class fragments for the primitives: `focusRing` and `pressableFocusRing`, `popoverSurface`, `popoverSheet`, `popoverMotion`, `popoverArrow`, `popoverArrowGlyph`, `selectableText`, the group header `sectionLabelVariants({ variant: 'grouped' \| 'sidebar' \| 'menu' })`, the iOS bar `barSurface`, the dense-row layers `dataRowLayers`, `tableHeaderCellClass`, `columnResizerClass` and `valueChip`. The file says it is not exported from the package; copy one in if you need it. |
| `lib/surface.ts` | yes (through `dialog` and `sheet`) | The modal-surface recipes every surface shares, hook-free so Card can use them on the server: `surfaceHeaderVariants`, `surfaceTitleVariants`, `surfaceDescriptionVariants`, `surfaceBodyVariants`, `surfaceFooterVariants`, `closeButtonVariants` and `sheetGrabberVariants`. |
| `lib/row-label.ts` | internal | `RowLabelContext` and `useRowLabel`. A list row publishes its title's id so a Switch or Slider inside it is labelled by the row title unless it has its own label. |
| `lib/kept-children.ts` | yes | `useKeptChildren(children, { slot })`: children rendered once through a portal into a detached element that the current home docks, so they stay mounted (draft, caret, scroll, a streaming reply) while a region moves between presentations. AdaptivePane, Sidebar and `ArtifactChatContainer` use it; see [State hooks](https://blamy.github.io/ui/#/hooks-state). |

`lib/motion.ts`, `lib/theme.tsx`, `lib/icon.tsx` and `lib/syntax.ts` have their own pages: [Motion](https://blamy.github.io/ui/#/motion), [Theming](https://blamy.github.io/ui/#/theming), [Icons](https://blamy.github.io/ui/#/icons) and [CodeEditor](https://blamy.github.io/ui/#/code-editor).
