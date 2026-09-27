# EdgeDrawer

A headless scrim and panel that slide in from one edge of a positioned host. It has no chrome of its own — the children are the whole panel — so it is the drawer inside [Sidebar](https://blamy.github.io/ui/#/sidebar)'s overlay variant, [AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane)'s drawer mode, and every template's compact navigation.

## Installation

{% tabs sync="install" %}
{% tab title="npm" %}
{% tabs sync="pm" %}
{% tab title="pnpm" %}
```sh
pnpm add @brett_lamy/ui
```
{% endtab %}
{% tab title="npm" %}
```sh
npm install @brett_lamy/ui
```
{% endtab %}
{% tab title="yarn" %}
```sh
yarn add @brett_lamy/ui
```
{% endtab %}
{% tab title="bun" %}
```sh
bun add @brett_lamy/ui
```
{% endtab %}
{% endtabs %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { EdgeDrawer } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% tabs sync="pm" %}
{% tab title="pnpm" %}
```sh
pnpm dlx shadcn@latest add https://blamy.github.io/ui/r/edge-drawer.json
```
{% endtab %}
{% tab title="npm" %}
```sh
npx shadcn@latest add https://blamy.github.io/ui/r/edge-drawer.json
```
{% endtab %}
{% tab title="yarn" %}
```sh
yarn dlx shadcn@latest add https://blamy.github.io/ui/r/edge-drawer.json
```
{% endtab %}
{% tab title="bun" %}
```sh
bunx --bun shadcn@latest add https://blamy.github.io/ui/r/edge-drawer.json
```
{% endtab %}
{% endtabs %}

Adds `@/components/ui/edge-drawer.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import { EdgeDrawer } from '@/components/ui/edge-drawer'
```
{% endtab %}
{% endtabs %}

```tsx
import { EdgeDrawer } from '@brett_lamy/ui'

<div style={{ position: 'relative' }}>
  <Page />
  <EdgeDrawer side="left" open={open} onClose={() => setOpen(false)} width={280} maxWidth="84%">
    <Navigation />
  </EdgeDrawer>
</div>
```

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `side` | `left` | Edge the panel slides from. |
| `open` / `onClose` | — | Controlled visibility; tapping the scrim calls `onClose`. |
| `width` / `maxWidth` | — | Panel size. |
| `zIndex` | `30` | Scrim layer; the panel sits one above it. |
| `scrim` / `shadow` | dark scrim, soft shadow | Override the dimming colour and the open panel's shadow. |
| `style` / `className` | — | Applied to the panel. |

The panel exposes `data-slot="edge-drawer"`, `data-side`, and `data-open`, and is `aria-hidden` while closed.

## Live example

{% demo src="adaptive-pane/pane-modes" %}

## Examples

### Navigation drawer

A hamburger opens the app's folders from the left. `maxWidth` keeps a strip of the page visible on narrow hosts, and choosing a folder closes the drawer.

{% demo src="edge-drawer/mail-navigation" %}

### Filters panel

From the right edge with a scrolling body and a pinned footer. The drawer has no chrome, so the layout inside is entirely yours.

{% demo src="edge-drawer/product-filters" %}

### Floating glass panel

`scrim="transparent"` and `shadow="none"` turn it into a floating card: inset the content, give it a radius, and let `backdrop-filter` blur what is behind.

{% demo src="edge-drawer/quick-settings" %}
