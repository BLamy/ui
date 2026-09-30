# Credenza

A responsive dialog that renders as a **centered dialog** on desktop and a **floating bottom tray** on phones — with Family-style morphing between stacked states.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/credenza.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Credenza } from '@/components/ui/credenza'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Credenza } from '@brett_lamy/ui'
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

Try it in the Contacts demo: open any contact → **Share Contact**.

## Focus and keyboard

The Credenza is a modal dialog (`role="dialog"`, `aria-modal`, labelled by its title) scoped to the element it fills:

- Opening moves focus onto the sheet — or onto a descendant marked `data-autofocus`
- Tab and Shift+Tab cycle inside it; focus that lands elsewhere in its host is pulled back
- **Escape closes only the Credenza** — the key is stopped, so a SplitView or NavigationStack behind it doesn't also pop
- Closing returns focus to the control that opened it
- A Credenza mounted already open (a demo on page load) doesn't take focus until you work inside its host

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

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `credenzaVariants`

Defined in `@/components/ui/credenza`. Base classes:

```text
z-401 box-border overflow-hidden bg-card text-foreground shadow-[0_24px_80px_--alpha(black/34%),0_0_0_1px_var(--border)] outline-none
```

**`compact`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `absolute inset-x-2.5 bottom-2.5 touch-none rounded-[28px]` |
| `false` (default) | `absolute top-1/2 left-1/2 w-[400px] max-w-[calc(100%-44px)] rounded-[24px]` |
