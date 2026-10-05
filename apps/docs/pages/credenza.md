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

- Opening moves focus onto the sheet — or onto a descendant marked `data-autofocus`; a view change that takes the focused control away does the same
- Tab and Shift+Tab cycle inside it; focus that lands elsewhere in its host is pulled back
- **Escape closes only the Credenza** — the key is stopped, so a SplitView or NavigationStack behind it doesn't also pop
- Closing returns focus to the control that opened it
- A Credenza mounted already open (a demo on page load) doesn't take focus until you work inside its host; once your focus is in it, view changes hand it on as usual

## Non-dismissable

`isDismissable={false}` is for a step the user has to finish: a paywall, a sign-in gate, terms to accept. There is no close button or grabber, and Escape, a press on the scrim and a drag down leave it up — the tray gives a little under the finger and springs back. Escape is still kept from the views behind. Nothing the user does calls `onClose`, so it is optional; set `open` to `false` when the step is done. Focus and the view morph work as usual.

## Live example

{% demo src="credenza/share-contact" %}

## Examples

### Multi-step tray

Three views in one `compact` tray. The card measures each view and springs to its height, `canBack` shows the back chevron on the review step, and a drag down dismisses. Sending money is a rare moment, so the Sent view fires a [Celebrate](https://blamy.github.io/ui/#/celebrate) burst once, as it lands.

{% demo src="credenza/send-money" %}

### Destructive confirmation

Without `compact` it is a centered dialog. Keep the destructive action on the right and say what will happen in the body.

{% demo src="credenza/confirm-delete" %}

### Share sheet

People to share with, actions as `ListRow`s, and a QR code as a second view.

{% demo src="credenza/share-sheet" %}

### Paywall

A non-dismissable Credenza in front of a photo app until you subscribe. Pick a plan, then pay on a mock card form: the number groups itself and names the brand, every field checks itself on submit, and the payment shows its processing steps before the success view, which celebrates once. Nothing is charged — use the test card, or 4000 0000 0000 0002 to see a decline land on the card field. Switch to **Tray** for the phone presentation.

{% demo src="credenza/paywall" %}

### Sign in or register

A sign-in gate. Sign in, Create account and Reset password are views of one non-dismissable Credenza, so moving between them morphs the card, and the email carries across. Each form validates on submit and waits on a pretend server; any address signs in, and registering taken@example.com brings its answer back onto the email field.

{% demo src="credenza/auth-gate" %}

### Registration and onboarding

Six steps in one Credenza: account, a six-digit code from the email that drops in at the top, profile, topics, notifications, done. Each step is a `view`, `canBack` and `onBack` step back, and every step checks its own fields before it lets you on. The progress line is drawn by the card itself (`className` and a CSS variable), so it stays put while the views slide beneath it. Closing it keeps your place.

{% demo src="credenza/onboarding" %}

## API

### `<Credenza>`

| Prop | Default | Effect |
| --- | --- | --- |
| `open` | — | Whether it is up. Controlled: the Credenza never closes itself. |
| `onClose` | — | The user dismissed it: Escape, a press on the scrim, the close button or a drag down. |
| `isDismissable` | `true` | `false`: no close button or grabber, and Escape, the scrim and a drag down leave it up. Only `open` closes it. |
| `view` | — | Key of the current view. A new key morphs the card to its height and slides in from the right; a key seen before comes back from the left. |
| `title` | — | The header title; it travels with the view. |
| `canBack` / `onBack` | `false` / — | Show the back chevron, and what it does. |
| `compact` | `false` | A floating bottom tray instead of a centered dialog. |
| `children` | — | The current view. A descendant marked `data-autofocus` takes focus on open and after a view change. |
| `className` / `style` | — | Merged onto the card (`data-slot="credenza"`). |

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
