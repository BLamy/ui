# Theming

BL UI uses shadcn's theming model and takes it past colors. You define CSS variables (`--background`, `--primary`, `--radius`, `--font-sans`, …), the library maps them to Tailwind utilities, and every component reads only those utilities. Change a variable and the parts change, on the whole page or on any subtree. A stock shadcn preset works unchanged; the iOS look on this site is an optional theme, the **bl-theme**.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/theme.json{% endcommand %}

Copies the source into your project's `lib/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  BLProvider, ThemeScope, AppearanceProvider, useAppearance,
} from '@/lib/theme'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  BLProvider, ThemeScope, AppearanceProvider, useAppearance,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## How it works

Four layers, from your CSS down to the pixels:

1. **You define variables.** In `:root`, `.dark`, or any selector: `--background`, `--foreground`, `--card`, `--primary`, `--border`, `--radius`, `--font-sans`, … These are the names shadcn presets already use.
2. **`@theme inline` maps them.** BL UI's tokens (the `bl-ui` registry item, or `@brett_lamy/ui/styles.css`) declare Tailwind variables that point at yours: `--color-primary: var(--primary)`, `--radius-ctl: calc(var(--radius) * 1)`. `inline` keeps the `var()` in every compiled utility, so a nested scope that redefines `--primary` re-resolves it. Nothing is baked in at build time.
3. **Components read utilities only.** `bg-primary`, `text-muted-foreground`, `rounded-ctl`, `text-footnote`, `shadow-hairline`, `h-row`. No hex, no `rgba()`, no arbitrary radius or text size inside a component, so there is exactly one place to change each value.
4. **Any subtree can override.** Redefine variables with plain CSS, or wrap a region in `ThemeScope`. Popovers, menus and dialogs opened inside it wear the same scope even though they render in a portal.

The `dark:` variant is redefined as `(&:where(.dark, .dark *))`, so the element that carries `.dark` (a `ThemeScope` root) restyles itself as well as its children.

## Light and dark

Dark mode is shadcn's: the `.dark` class. `BLProvider` and `ThemeScope` put `light` or `dark` on their root, so a subtree can differ from the page. They follow the ambient `AppearanceProvider` unless given an explicit `dark` / `appearance`. Without a provider, the `dark` class on `<html>` counts as the ambient appearance.

```tsx
<AppearanceProvider value="dark">
  <BLProvider>…</BLProvider>              {/* dark */}
  <BLProvider dark={false}>…</BLProvider> {/* light, whatever the page does */}
</AppearanceProvider>
```

## Tint

`tint` sets `--primary` and `--ring` for everything below it: buttons, switches, selection, links.

```tsx
<BLProvider tint="#FF375F">…</BLProvider>
<ThemeScope tint="#5E5CE6">…</ThemeScope>
```

> Tints are picked from the iOS system palette: `#0A84FF`, `#5E5CE6`, `#30B0C7`, `#34C759`, `#FF9F0A`, `#FF375F`. Anything else works. Pick a color with contrast against both card colors.

## The iOS theme

The bl-theme is one such palette. Install it for the look on this site; leave it out and the parts wear your theme.

{% tabs title="The iOS theme" sync="install" %}
{% tab title="npm" %}
Import it after BL UI's stylesheet:

```css
@import "@brett_lamy/ui/styles.css";
@import "@brett_lamy/ui/theme.css";
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/bl-theme.json{% endcommand %}

Writes the iOS values into your CSS variables (`:root` and `.dark`) and adds the theme scopes below. It overwrites the palette variables it sets, so skip it to keep your own.
{% endtab %}
{% endtabs %}

## Colors

Every shadcn variable, the utility that reads it, and its bl-theme value:

| Variable | Utility | Light | Dark |
| --- | --- | --- | --- |
| `--background` | `bg-background` | `#fff` | `#000` |
| `--foreground` | `text-foreground` | `#0B0B0F` | `#F5F5F7` |
| `--card` / `--popover` | `bg-card` | `#fff` | `#1C1C1E` |
| `--primary` / `--ring` | `bg-primary` | `#0A84FF` (your `tint`) | `#0A84FF` |
| `--secondary` / `--input` | `bg-secondary` | 13% gray | 22% gray |
| `--muted` | `bg-muted` | `#F2F2F7` (grouped background) | `#0A0A0C` |
| `--muted-foreground` | `text-muted-foreground` | 60% label | 62% label |
| `--accent` | `bg-accent` | 16% gray (pressed) | 22% gray |
| `--destructive` | `text-destructive` | `#FF3B30` | `#FF453A` |
| `--border` | `border-border` | rgba(60,60,67,.22) | rgba(84,84,88,.48) |
| `--sidebar` | `bg-sidebar` | `#ECECF1` | `#111114` |
| `--chart-1…5` | `fill-chart-1` | iOS blue, green, orange, red, purple | |

### BL UI's extra colors

Where shadcn has no equivalent, BL UI adds a variable and registers it as a Tailwind color, so it is a utility like any other. Each has a fallback derived from your shadcn variables (with `color-mix`), so it works without the bl-theme. `--destructive-foreground` falls back to white.

| Variable | Utility | Used for | Light | Dark | Fallback |
| --- | --- | --- | --- | --- | --- |
| `--success` | `text-success` | positive status, on switches | `#34C759` | `#30D158` | green |
| `--warning` | `text-warning` | caution status | `#FF9F0A` | `#FF9F0A` | orange |
| `--tertiary-foreground` | `text-tertiary-foreground` | the third label level (placeholders, captions) | 33% label | 30% label | `muted-foreground` at 60% |
| `--secondary-strong` | `bg-secondary-strong` | stronger fill: tracks, pressed chips | 24% gray | 34% gray | `--accent` |
| `--overlay` | `bg-overlay` | modal scrims | 38% black | 50% black | 40% black |
| `--bar` | `bg-bar` | translucent nav, tab and tool bars | rgba(250,250,252,.85) | rgba(16,16,18,.82) | `--background` at 85% |
| `--sticky` | `bg-sticky` | sticky section headers | rgba(244,244,248,.92) | rgba(18,18,20,.9) | `--muted` at 92% |
| `--handle` | `bg-handle` | drag grabbers | 24% gray | 34% gray | `--secondary-strong` |
| `--link` | `text-link` | inline links, mentions | `--primary` | `--primary` | `--primary` |
| `--code` | `bg-code` | code-block surface | `#101014` | `#101014` | `--muted` |
| `--code-foreground` | `text-code-foreground` | text on `--code` | `#D8D8E2` | `#D8D8E2` | `--foreground` |

With the shadcn CLI, the `bl-ui` item registers these utilities in your Tailwind theme; the npm stylesheet already includes them.

## Radius

One variable, `--radius`, drives four steps. Each step is a multiplier of it, so changing `--radius` rescales every corner in proportion. The bl-theme sets `--radius: .625rem`.

| Utility | Multiplier | At `.625rem` |
| --- | --- | --- |
| `rounded-ctl` | × 1 | 10px |
| `rounded-panel` | × 1.2 | 12px |
| `rounded-card` | × 1.4 | 14px |
| `rounded-sheet` | × 1.8 | 18px |

Tailwind's own `rounded-sm`, `rounded-md` and `rounded-lg` are left alone, so they follow the host app's scale.

## Type

Font sizes only: no line-height rides along, so a size never changes a row's height. Set `leading-*` yourself where you need it.

| Utility | Size |
| --- | --- |
| `text-caption2` | 11px |
| `text-caption` | 12px |
| `text-footnote` | 13px |
| `text-detail` | 14px |
| `text-subhead` | 15px |
| `text-callout` | 16px |
| `text-body` | 17px |
| `text-title` | 20px |

## Shadows, sizes and fonts

| Utility | Value |
| --- | --- |
| `shadow-hairline` | `inset 0 0 0 1px var(--border)`, a border that takes no space |
| `shadow-hairline-t` · `shadow-hairline-b` | the same on the top or bottom edge only |
| `h-toolbar` | 52px, the one height of every app toolbar (SplitView and NavigationStack bars, shell headers) |
| `h-row` · `min-h-row` | 46px, a list row |
| `font-sans` | `--font-sans`; the bl-theme sets the iOS system stack, otherwise your app's |
| `font-mono` | `--font-mono` |

## Motion

The spring tokens are sampled from the same physics as `springs` in the motion module (see [Motion](https://blamy.github.io/ui/#/motion)) and come in pairs: `duration-spring-{snappy,smooth,bouncy,tray}` with `ease-spring-{snappy,smooth,bouncy,tray}`. `ease-ios` is the classic `cubic-bezier(.32,.72,0,1)`. Exits are quicker than entries: `duration-exit` with `ease-exit`.

```tsx
<div className="transition-transform duration-spring-smooth ease-spring-smooth" />
```

## Scoping and overriding

Because components read variables at the point of use, a subtree is themed by redefining the variables above it. Three ways, from least to most code.

### With plain CSS

Any selector works: a class, an attribute, an id. `data-theme-scope` is the convention `ThemeScope` uses, so the same rule serves both.

```css
[data-theme-scope="brand"] {
  --primary: #f43;
  --radius: 0.25rem;
  --card: #fff8f6;
}

.dark [data-theme-scope="brand"],
[data-theme-scope="brand"].dark {
  --card: #1c1210;
}
```

A scope sets only what it changes. Everything else (border, muted text, the bars) comes from the theme around it.

### With ThemeScope

`ThemeScope` is the element that carries the scope: the attribute, the `light` / `dark` class, a tint and any variables you pass.

```tsx
<ThemeScope
  scope="brand"
  appearance="dark"
  tint="#f43"
  vars={{ radius: '0.25rem', card: '#111' }}
  className="rounded-card bg-background p-4 text-foreground"
>
  …
</ThemeScope>
```

| Prop | Effect |
| --- | --- |
| `scope` | An open string. It becomes `data-theme-scope="…"`, so any `[data-theme-scope="name"]` rule in your CSS applies. Built-ins are listed below. |
| `appearance` | `light` or `dark` for this subtree. Defaults to the ambient `AppearanceProvider`; without one, a plain scope inherits the page and a named scope is light (`terminal` is always dark). |
| `tint` | `--primary` and `--ring` for the subtree. |
| `vars` | Variables by name without the leading dashes. Typed by the theme's variable names, so `radius`, `card` and `font-sans` autocomplete; any other key is a custom property of your own. Wins over `tint`. |

`THEME_VARS` lists every variable name and `ThemeVar` is the union type. `themeScopeProps()` returns the same attribute, class and style for a root you render yourself, and `readThemeVars(el)` reads the resolved variables back.

Scopes nest, and the nearest one wins: a `tint` inside a `dark` scope inside a `brand` scope resolves to the tint, then the dark values, then the brand ones, then the page.

### Overlays follow their scope

Popovers, tooltips, menus, dialogs, sheets and the CommandMenu render in a portal (`BLProvider`'s root, else `<body>`), outside the scope's DOM, so CSS inheritance no longer reaches them. `ThemeScope` publishes its state through `ThemeScopeContext`, and the overlay primitives put the same `data-theme-scope`, appearance class, tint and `vars` on their own root. A popover opened inside a dark, pink, square-cornered scope is dark, pink and square-cornered.

For an overlay of your own, spread the same props onto its root:

```tsx
import { useThemeScopeProps } from '@/lib/theme'

function MyOverlay(props) {
  const scope = useThemeScopeProps() // data-theme-scope, className, style
  return <div {...scope} {...props} />
}
```

Outside a `ThemeScope` the hook returns nothing, so the overlay wears the page as usual.

{% demo src="theming/custom-scope" %}

## Using with a shadcn preset

Nothing to convert. A preset (from `shadcn create` or a theme copied off ui.shadcn.com) defines the variables BL UI reads: `:root` and `.dark` blocks with `--background`, `--primary`, `--radius`, and so on. BL UI's parts use them as they are.

- The parts also read `--radius`, so a preset with sharp or pill corners changes every control. The four radius steps scale from it.
- `--font-sans` sets the text face. The bl-theme points it at the iOS stack; a preset's font is used otherwise.
- The extras in the table above (`--tertiary-foreground`, `--bar`, `--success`, …) are not in a stock preset. Each falls back to a value derived from the preset's variables, so nothing is missing. Define one to override its fallback.

```css
/* your preset, unchanged */
:root { --background: oklch(1 0 0); --primary: oklch(0.55 0.2 260); --radius: 0.5rem; }
.dark { --background: oklch(0.15 0 0); }

/* optional: refine one of BL UI's extras */
:root { --bar: color-mix(in oklab, var(--background) 70%, transparent); }
```

## Define your own scope

A surface with a look of its own (a brand area, a code editor, a settings sheet) is a scope. Write its variables once and name it:

```css
/* scopes.css */
[data-theme-scope="terminal-green"] {
  color-scheme: dark;
  --background: #06110a;
  --foreground: #b7f7c8;
  --card: #0b1c12;
  --muted-foreground: rgba(183, 247, 200, .6);
  --border: rgba(183, 247, 200, .16);
  --primary: #3ddc84;
  --radius: 0;
  --font-sans: ui-monospace, 'SF Mono', Menlo, monospace;
}
```

```tsx
<ThemeScope scope="terminal-green">
  <Composer>…</Composer>
</ThemeScope>
```

Everything below it, overlays included, now reads those values. The library ships scopes the same way:

| Scope | Where | Changes |
| --- | --- | --- |
| `workbench` | bl-theme | surfaces, labels, fills, hairlines, code blocks (dark `#141419` / light `#FFFFFF` background). `WorkbenchTheme` and the `t3-clone` block's `WorkbenchShell` open it |
| `terminal` | bl-theme | always dark; background `#0C0C10` (`#1A1A1F` in a light Workbench). The `t3-clone` block's dock and terminal open it |
| `sheet` | bl-theme | the floating surface's text, card, fills and hairlines in a light or dark tone (background and accent stay the host's). `FloatingSheet`, `FloatingChat` and `ArtifactChatContainer` with a `tone` open it |
| `glass` | bl-theme | the translucent composer card over content, inside `FloatingChat` and `ArtifactChatContainer` |
| `chat` | `discord-clone` block | chat grays, link and mention colors, in `chat-theme.css` next to the block. Its `ChatShell` opens it |

Without the bl-theme, a built-in scope is just its `light` / `dark` class and wears your theme. Blocks bring their own scope CSS with them, so installing one is enough.

## BLProvider

`BLProvider` is the app frame: light or dark, `tint`, a safe-area inset (`safeTop`), and the portal root that overlays render into so they inherit the theme variables and font. It is built on the same variables. Use `ThemeScope` for a region inside a page and `BLProvider` for a frame that fills its box, such as a phone or a pane.

```tsx
<BLProvider tint="#0A84FF" safeTop>
  <NavigationStack screens={screens} onPop={handlePop} />
</BLProvider>
```

## Generated tokens

`tokens.css` in the library is the single source. Three things are generated from it, so they cannot drift:

- `THEME_VARS` and the `ThemeVar` type, which type the `vars` prop.
- The tailwind-merge configuration inside `cn()`, so `cn('text-footnote text-foreground')` keeps both (a size and a color) while `cn('text-foreground text-primary')` keeps the last.
- The `bl-ui` registry item's `cssVars`, which write the tokens into your project.

If you add a token to your own copy, extend `cn()` too (see [Styling and variants](https://blamy.github.io/ui/#/styling)).

## Live example

Swap appearance and tint on the fly. The components just re-read their nearest variables:

{% demo src="theming/theme-tokens" %}

## Examples

### One tint per subtree

`BLProvider` takes a `tint` and sets `--primary` for everything below it. Nest providers to re-accent a region; without `dark` they follow the page's appearance.

{% demo src="theming/tint-gallery" %}

### Scoped appearance

An explicit `dark` wins over the ambient appearance, so a player card can stay light or dark whatever the page around it does.

{% demo src="theming/scoped-appearance" %}

### A custom palette

Any variable can be overridden on a subtree through `style` (or a CSS class). Define the palette for both appearances and pick one with `useAppearance()`.

{% demo src="theming/custom-palette" %}
