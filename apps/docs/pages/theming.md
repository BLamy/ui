# Theming

BL UI takes its colors from your shadcn theme: every part is styled with shadcn's CSS variables. The iOS look is a theme you can install — the **bl-theme** — and light/dark, tint and a few surfaces with a look of their own (Workbench, terminal, chat) are chosen per subtree.

{% tabs title="Installation" sync="install" %}
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
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/theme.json{% endcommand %}

Adds `@/components/ui/theme.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  BLProvider, ThemeScope, AppearanceProvider, useAppearance,
} from '@/components/ui/theme'
```
{% endtab %}
{% endtabs %}

## How colors work

BL UI has no palette of its own. Every part is styled with shadcn's utilities — `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary` — so it takes its colors from the CSS variables your app's shadcn theme defines (`--background`, `--primary`, `--muted-foreground`, …). Drop a component into a shadcn app and it matches the app.

The iOS look you see on this site is one such theme, the **bl-theme**. Install it to get the same palette; leave it out and the parts wear your theme instead.

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

Writes the iOS values into your CSS variables (`:root` and `.dark`) and adds the theme scopes below.
{% endtab %}
{% endtabs %}

## Light and dark

Dark mode is shadcn's: the `.dark` class. `BLProvider` and `ThemeScope` put `light` or `dark` on their root, so a subtree can differ from the page. They follow the ambient `AppearanceProvider` unless given an explicit `dark` / `appearance`.

```tsx
<AppearanceProvider value="dark">
  <BLProvider>…</BLProvider>              {/* dark */}
  <BLProvider dark={false}>…</BLProvider> {/* light, whatever the page does */}
</AppearanceProvider>
```

## Tint

`tint` sets `--primary` and `--ring` for everything below — buttons, switches, selection, links.

```tsx
<BLProvider tint="#FF375F">…</BLProvider>
<ThemeScope tint="#5E5CE6">…</ThemeScope>
```

> Tints are picked from the iOS system palette: `#0A84FF`, `#5E5CE6`, `#30B0C7`, `#34C759`, `#FF9F0A`, `#FF375F`. Anything else works — pick a color with contrast against both card colors.

## Theme scopes

Some surfaces have a look of their own: the Workbench is a dark-first IDE, its terminal stays dark in both appearances, team chat has its own grays. They are **theme scopes** — a subtree where the bl-theme sets the same shadcn variables to that surface's values. `WorkbenchShell` and `WorkbenchTheme` open a `workbench` scope, `ChatShell` a `chat` scope, the dock and `SurfaceTerminal` a `terminal` scope. Open one yourself with `ThemeScope`:

```tsx
<ThemeScope scope="workbench" appearance="dark">
  <Composer>…</Composer>
</ThemeScope>
```

A scope sets only what its surface changes; everything else (primary, overlay, bars) comes from around it. Without the bl-theme a scope is just its `light` / `dark` class, so it wears your theme.

| Scope | Opened by | Changes |
| --- | --- | --- |
| `workbench` | `WorkbenchShell`, `WorkbenchTheme` | surfaces, labels, fills, hairlines, code blocks (dark `#141419` / light `#FFFFFF` background) |
| `terminal` | `WorkbenchDock`, `SurfaceTerminal`, `TerminalBody` | always dark; background `#0C0C10` (`#1A1A1F` in a light Workbench) |
| `chat` | `ChatShell` | chat grays, link and mention colors |
| `sheet` | `FloatingSheet`, `FloatingChat`, `ArtifactChatContainer` with a `tone` | the floating surface's text, card, fills and hairlines in that tone (background and accent stay the host's) |
| `glass` | the Composer inside `FloatingChat` / `ArtifactChatContainer` | the translucent composer card over content |

## Variables

Every shadcn variable, with its bl-theme value:

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

### BL UI's extra variables

Where shadcn has no equivalent, BL UI adds a variable — registered as a Tailwind color, so it is a utility like any other. Each has a fallback derived from your shadcn variables, so it works without the bl-theme.

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

With the shadcn CLI, the `bl-ui` item registers these utilities in your Tailwind theme; the npm stylesheet already includes them for BL UI's own parts.

## Live example

Swap appearance and tint on the fly — the components just re-read their nearest variables:

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
