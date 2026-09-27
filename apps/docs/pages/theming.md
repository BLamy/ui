# Theming

Every component reads CSS custom properties from its nearest themed ancestor, so theming is one style object on the root.

## Installation

{% tabs %}
{% tab title="npm" %}
```sh
npm install @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  BLProvider, AppearanceProvider, useAppearance,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="pnpm" %}
```sh
pnpm add @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  BLProvider, AppearanceProvider, useAppearance,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="yarn" %}
```sh
yarn add @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  BLProvider, AppearanceProvider, useAppearance,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="bun" %}
```sh
bun add @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  BLProvider, AppearanceProvider, useAppearance,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
```sh
npx shadcn@latest add https://blamy.github.io/ui/r/theme.json
```

Adds `@/components/ui/theme.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  BLProvider, AppearanceProvider, useAppearance,
} from '@/components/ui/theme'
```
{% endtab %}
{% endtabs %}

## Phone components — `--bl-*`

```jsx
<App dark tint="#FF375F"/>   // the demo app sets these for you
```

| Token | Light | Dark |
| --- | --- | --- |
| `--bl-bg` / `--bl-bg2` | `#fff` / `#F2F2F7` | `#000` / `#0A0A0C` |
| `--bl-card` | `#fff` | `#1C1C1E` |
| `--bl-label` / `--bl-label2` | `#0B0B0F` / 60% | `#F5F5F7` / 62% |
| `--bl-sep` | rgba(60,60,67,.22) | rgba(84,84,88,.48) |
| `--bl-fill` / `--bl-fill2` | 13% / 24% gray | 22% / 34% gray |
| `--bl-tint` | your accent | your accent |

## Workbench components — `--wb-*`

The Workbench ships dark-first: `--wb-bg`, `--wb-side`, `--wb-card`, `--wb-fill`, `--wb-sep`, `--wb-label`, `--wb-label2`, `--wb-tint`. Pass `tint` to `<Workbench>` to re-accent the whole shell.

> Tints are picked from the iOS system palette: `#0A84FF`, `#5E5CE6`, `#30B0C7`, `#34C759`, `#FF9F0A`, `#FF375F`. Anything else works — pick a color with contrast against both card colors.

## Live example

Swap tokens and tint on the fly — the components just re-read their nearest `--bl-*` values:

{% demo src="theming/theme-tokens" %}

## Examples

### One tint per subtree

`BLProvider` takes a `tint` and sets `--bl-tint` for everything below it. Nest providers to re-accent a region; without `dark` they follow the page's appearance.

{% demo src="theming/tint-gallery" %}

### Scoped appearance

An explicit `dark` wins over the ambient appearance, so a player card can stay light or dark whatever the page around it does.

{% demo src="theming/scoped-appearance" %}

### A custom palette

Any `--bl-*` token can be overridden through `style`. Define the palette for both appearances and pick one with `useAppearance()`.

{% demo src="theming/custom-palette" %}
