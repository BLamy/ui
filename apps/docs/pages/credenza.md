# Credenza

A responsive dialog that renders as a **centered dialog** on desktop and a **floating bottom tray** on phones — with Family-style morphing between stacked states.

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

import { Credenza } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% tabs sync="pm" %}
{% tab title="pnpm" %}
```sh
pnpm dlx shadcn@latest add https://blamy.github.io/ui/r/credenza.json
```
{% endtab %}
{% tab title="npm" %}
```sh
npx shadcn@latest add https://blamy.github.io/ui/r/credenza.json
```
{% endtab %}
{% tab title="yarn" %}
```sh
yarn dlx shadcn@latest add https://blamy.github.io/ui/r/credenza.json
```
{% endtab %}
{% tab title="bun" %}
```sh
bunx --bun shadcn@latest add https://blamy.github.io/ui/r/credenza.json
```
{% endtab %}
{% endtabs %}

Adds `@/components/ui/credenza.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import { Credenza } from '@/components/ui/credenza'
```
{% endtab %}
{% endtabs %}

```jsx
<Credenza
  open={!!share} compact={wc === 'compact'}
  view={share} title={TITLES[share]}
  canBack={share !== 'menu'} onBack={() => go('menu')}
  onClose={() => setShare(null)}
>
  <ShareViews view={share} go={go}/>
</Credenza>
```

## The morph

Each state (`menu → qr → vcard → done`) is measured, and the card **spring-animates its height** to fit; views cross-fade through scale + blur while the title and back chevron morph in place. framer-motion powers the springs and lazy-loads from a CDN — until it arrives, states switch instantly.

## Tray behavior (compact)

- Drag down to dismiss, with velocity-aware release
- The card floats inset from the edges — a tray, not an edge-to-edge sheet
- Success states fire `Haptics.notification('success')`

Try it in the Contacts demo: open any contact → **Share Contact**.

## Live example

{% demo src="credenza/share-contact" %}

## Examples

### Multi-step tray

Three views in one `compact` tray. The card measures each view and springs to its height, `canBack` shows the back chevron on the review step, and a drag down dismisses.

{% demo src="credenza/send-money" %}

### Destructive confirmation

Without `compact` it is a centered dialog. Keep the destructive action on the right and say what will happen in the body.

{% demo src="credenza/confirm-delete" %}

### Share sheet

People to share with, actions as `ListRow`s, and a QR code as a second view.

{% demo src="credenza/share-sheet" %}
