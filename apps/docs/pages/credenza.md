# Credenza

A responsive dialog that renders as a **centered dialog** on desktop and a **floating bottom tray** on phones — with Family-style morphing between stacked states.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/credenza.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Credenza, CredenzaBackdrop, CredenzaContent, CredenzaHeader,
  CredenzaBack, CredenzaTitle, CredenzaClose, CredenzaView,
} from '@/components/ui/credenza'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Credenza, CredenzaBackdrop, CredenzaContent, CredenzaHeader,
  CredenzaBack, CredenzaTitle, CredenzaClose, CredenzaView,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

```jsx
<Credenza open={!!share} onOpenChange={(open) => { if (!open) setShare(null) }} view={share}>
  <CredenzaBackdrop />
  <CredenzaContent>
    <CredenzaHeader>
      <CredenzaBack hidden={share === 'menu'} onClick={() => go('menu')} />
      <CredenzaTitle>{TITLES[share]}</CredenzaTitle>
      <CredenzaClose />
    </CredenzaHeader>
    <CredenzaView>
      <ShareViews view={share} go={go} />
    </CredenzaView>
  </CredenzaContent>
</Credenza>
```

Credenza is [UI SDK's Dialog](https://ui-sdk.dev/docs/react/components/dialog) with `presentation="auto"`: a centered card while its container is medium or regular, a floating tray while it is **compact**. "Compact" is the nearest size-class scope where the Credenza is written (`BLProvider`'s root, a SplitView column, a NavigationStack, a SidebarProvider…: see `SizeClassProvider` in [Layout hooks](https://blamy.github.io/ui/#/hooks-layout)), whether or not it has a trigger, so a Credenza in a phone frame, a narrow window or a split column is a tray even on a desktop. With no scope around it, UI SDK falls back to a small touch screen. The choice is made each time it opens; pass `presentation="sheet"` or `presentation="dialog"` to fix it.

It renders into [BLProvider](https://blamy.github.io/ui/#/theming)'s root, so the scrim covers the app's frame, not the page.

## The morph

`view` is the key of the current step (`menu → qr → vcard → done`). Changing it measures the new view, and the card **spring-animates its height** to fit while the views cross-fade through blur in the direction of travel: a new key arrives from the right, a key seen before comes back from the left. `CredenzaTitle` slides the same way, and `CredenzaBack` grows in and out of the header as `hidden` changes, so the title slides over to make room.

## Tray behavior (compact)

- Drag down to dismiss, with velocity-aware release (UI SDK's sheet, `details.reason === 'swipe'`)
- The card floats inset from the edges — a tray, not an edge-to-edge sheet — with a grabber at the top
- Style the tray alone with `data-[presentation=sheet]:` on `CredenzaContent`

Try it in the Contacts demo: open any contact → **Share Contact**.

## Focus and keyboard

The Credenza is a modal dialog (`role="dialog"`, `aria-modal`, named by `CredenzaTitle`) scoped to its layer host. UI SDK owns all of it:

- Opening moves focus into the card, or onto the control with `autoFocus`; a view that comes in with an `autoFocus` control hands focus to it, and when the view holding focus leaves, focus stays on the card instead of falling to the page
- Tab and Shift+Tab cycle inside it; the rest of the host is inert
- Escape closes it and is marked handled (`preventDefault`), so a SplitView or NavigationStack behind it doesn't also go back
- Closing returns focus to the control that opened it

## Non-dismissible

`dismissible={false}` is for a step the user has to finish: a paywall, a sign-in gate, terms to accept. There is no × or grabber, and Escape, a press on the scrim and a drag down leave it up — the tray springs back — and `onDismissAttempt` reports each try. A `CredenzaClose` with children (`<CredenzaClose render={<Button />}>Agree</CredenzaClose>`), a controller or `open` still close it. Focus and the view morph work as usual.

## Live example

{% demo src="credenza/share-contact" %}

## Examples

### Multi-step tray

Three views in one tray (`presentation="sheet"`). The card measures each view and springs to its height, the back chevron shows on the review step, and a drag down dismisses. Sending money is a rare moment, so the Sent view fires a [Celebrate](https://blamy.github.io/ui/#/celebrate) burst once, as it lands.

{% demo src="credenza/send-money" %}

### Destructive confirmation

`presentation="dialog"` keeps it a centered card. Keep the destructive action on the right and say what will happen in the body; both buttons are `CredenzaClose` parts, and Delete's `action` runs before it closes.

{% demo src="credenza/confirm-delete" %}

### Share sheet

People to share with, actions as `ListRow`s, and a QR code as a second view.

{% demo src="credenza/share-sheet" %}

### Paywall

A non-dismissible Credenza in front of a photo app until you subscribe. Pick a plan, then pay on a mock card form: the number groups itself and names the brand, every field checks itself on submit, and the payment shows its processing steps before the success view, which celebrates once. Nothing is charged — use the test card, or 4000 0000 0000 0002 to see a decline land on the card field. Switch to **Tray** for the phone presentation.

{% demo src="credenza/paywall" %}

### Sign in or register

A sign-in gate. Sign in, Create account and Reset password are views of one non-dismissible Credenza, so moving between them morphs the card, and the email carries across. Each form validates on submit and waits on a pretend server; any address signs in, and registering taken@example.com brings its answer back onto the email field.

{% demo src="credenza/auth-gate" %}

### Registration and onboarding

Six steps in one Credenza: account, a six-digit code from the email that drops in at the top, profile, topics, notifications, done. Each step is a `view`, `CredenzaBack` steps back, and every step checks its own fields before it lets you on. The progress line is drawn by the card itself (`className` and a CSS variable on `CredenzaContent`), so it stays put while the views slide beneath it. Closing it keeps your place.

{% demo src="credenza/onboarding" %}

## API

### `<Credenza>`

The root. It takes [Dialog's root props](https://ui-sdk.dev/docs/react/components/dialog#api-reference), plus `view`.

| Prop | Default | Effect |
| --- | --- | --- |
| `open` / `defaultOpen` / `onOpenChange(open, details)` | — | Whether it is up. `details.reason` says why it closed: `escape-key`, `outside-press`, `close-press`, `swipe`, `imperative`; `details.cancel()` keeps it open. |
| `presentation` | `'auto'` | `'auto'` follows the container's size class; `'sheet'` is always the tray, `'dialog'` always the card. |
| `dismissible` / `onDismissAttempt` | `true` | `false`: no × or grabber, and Escape, the scrim and a drag down leave it up. |
| `view` | — | Key of the current view. A new key morphs the card to its height and slides in from the right; a key seen before comes back from the left. |
| `controller` | — | `createCredenzaController()`: open and close it from anywhere. |
| `container` | BLProvider's root | Where the card renders. |

### Parts

| Part | Effect |
| --- | --- |
| `CredenzaTrigger` | Opens it (`className={buttonVariants()}` for the kit's button look). Optional: control `open` instead. |
| `CredenzaBackdrop` | The scrim. Without it there is no dim. |
| `CredenzaContent` | The card (`data-slot="dialog-content"`, `data-presentation="dialog" \| "sheet"`). `className` / `style` (or functions of its state), `initialFocus`, `finalFocus`, `aria-label` when there is no title. |
| `CredenzaHeader` | The row for back, title and close. |
| `CredenzaBack` | The back chevron. `hidden` folds it away; `onClick` steps back. |
| `CredenzaTitle` | Names the card and travels with the view: each title is a `data-slot="credenza-title-text"` span that enters from `data-starting-style` and leaves on `data-ending-style` (hidden from the card's name while it leaves). |
| `CredenzaClose` | Alone: the round × (left out when not `dismissible`). With children or `render`: any element that closes, with `action` and `value` like Dialog's Close. |
| `CredenzaView` | The current view: it springs the card's height and cross-fades in the direction of travel. |

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `credenzaVariants`

Defined in `@/components/ui/credenza`. Base classes:

```text
box-border flex flex-col overflow-hidden bg-card text-foreground shadow-[0_24px_80px_--alpha(black/34%),0_0_0_1px_var(--border)] outline-none
```

**`presentation`** — default `dialog`

| Value | Adds |
| --- | --- |
| `dialog` (default) | `fixed inset-0 m-auto h-fit max-h-[calc(100%-44px)] w-[400px] max-w-[calc(100%-44px)] rounded-[24px] transition-[opacity,scale,translate] duration-spring-tray e…` |
| `sheet` | `relative inset-auto mx-2.5 mb-2.5 w-auto touch-none rounded-[28px]` |
