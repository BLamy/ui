# Dialog

A modal dialog on react-aria: a scrim, a card and a focus trap. `size="alert"` is the centered iOS alert — 270px wide, a centered title and message, a hairline-divided row of text buttons — for a decision the user must make. `default` (up to 400px) and `lg` (up to 560px) are general dialogs with a header, a scrolling body and right-aligned footer actions, for a short form or a confirmation with detail. Esc, focus return and `aria-modal` come from react-aria.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/dialog.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  DialogTrigger, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  DialogTrigger, DialogContent, DialogHeader, DialogTitle,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Dialog, Sheet or Credenza?

- **Dialog** — an interruption that needs an answer or a short task, centered, at every screen size. Choose it for confirmations, rename and create forms, errors. You pick its size; on a narrow screen it stays a centered card that shrinks to fit.
- **[Sheet](https://blamy.github.io/ui/#/sheet)** — the same modal, pinned to an edge: a bottom card sheet for pickers and filters on a phone, left/right panels for settings or a detail, a drop-down from the top. Choose it when the content is larger than a dialog or should feel attached to an edge.
- **[Credenza](https://blamy.github.io/ui/#/credenza)** — one component that is a centered dialog on desktop and a floating, drag-to-dismiss tray on a compact host, and morphs its height and title as a flow steps through states (menu → QR → done). Choose it when you want that adaptive, multi-step behavior built in instead of switching Dialog and Sheet yourself.
- [SideDrawer](https://blamy.github.io/ui/#/side-drawer) and [EdgeDrawer](https://blamy.github.io/ui/#/edge-drawer) — inspector and navigation panels that can stay docked beside content; [CommandMenu](https://blamy.github.io/ui/#/command-menu) — a searchable ⌘K palette that can present as a dialog. Use [Popover](https://blamy.github.io/ui/#/popover) for light, anchored content that should not block the page.

## Alerts

Wrap a trigger and a `DialogContent` in `DialogTrigger`. Put `DialogTitle` and `DialogDescription` in a `DialogHeader`, and `DialogAction`s in a `DialogFooter`. `DialogAction` closes the dialog by default (react-aria's `close` slot) and runs its `onPress` first; use `variant="cancel"` for the preferred, semibold action, `destructive` for the red one, and `slot={null}` to keep the dialog open. Two actions sit side by side; `orientation="vertical"` on the footer stacks three or more. Alerts have `role="alertdialog"` and are not dismissed by pressing the scrim, as on iOS; Esc still closes them.

{% demo src="dialog/alerts" %}

```tsx
<DialogTrigger>
  <Button variant="destructive">Delete photo…</Button>
  <DialogContent size="alert">
    <DialogHeader>
      <DialogTitle>Delete this photo?</DialogTitle>
      <DialogDescription>It will be removed from all your devices.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogAction variant="cancel">Cancel</DialogAction>
      <DialogAction variant="destructive" onPress={deletePhoto}>Delete</DialogAction>
    </DialogFooter>
  </DialogContent>
</DialogTrigger>
```

## Forms

`default` and `lg` dialogs are dismissed by an outside press as well as Esc (`isDismissable`). `DialogClose` is the round × pinned to the top-right corner; `DialogBody` scrolls when the content is taller than the screen, between a fixed header and footer. `DialogContent`'s children can be a function receiving `close`, so a Save button can validate before it dismisses. Use ordinary [Button](https://blamy.github.io/ui/#/button)s in the footer here — `DialogAction` is the alert's full-width text button.

{% demo src="dialog/forms" %}

## Where the scrim goes

The overlay is `position: absolute; inset: 0` inside its portal root. `BLProvider` — your app root — is that root (`position: relative`), so the scrim covers the provider, not the whole browser page; without one the dialog attaches to `<body>`. The demos wrap a small frame in a `BLProvider` to show this. Open state is uncontrolled by default; pass `isOpen` and `onOpenChange` to `DialogTrigger` to control it. Overlays also wear the ThemeScope they were opened in — see [Popover](https://blamy.github.io/ui/#/popover), and the tinted scope in the [Sheet](https://blamy.github.io/ui/#/sheet) flow demo.

## Accessibility

react-aria's `Modal` traps focus inside the dialog, hides the rest of the page from assistive technology, locks scroll, closes on Esc and returns focus to the trigger. Focus moves to the dialog itself — so an alert reads its title and message first — or to a control marked `autoFocus`, like the input in the form demo. `DialogTitle` names the dialog through `aria-labelledby`; without a `DialogTitle` pass `aria-label`. Keep alert actions short, and make the safe action the `cancel` one.

## Props

### DialogTrigger

React-aria's `DialogTrigger` (re-exported): `isOpen`, `defaultOpen`, `onOpenChange`.

### DialogContent

| Prop | Default | Effect |
| --- | --- | --- |
| `size` | `default` | `alert` 270px, centered text · `default` ≤400px · `lg` ≤560px (both `rounded-[20px]`). |
| `isDismissable` | `true`, `false` for `alert` | Close on an outside press. |
| `isKeyboardDismissDisabled` | `false` | Ignore Esc. |
| `role` | `dialog`, `alertdialog` for `alert` | ARIA role. |
| `aria-label` | — | Name when there is no `DialogTitle`. |
| `className` | — | Merged onto the card. |
| `overlayClassName` | — | Merged onto the scrim. |
| `children` | — | Content, or a function receiving `{ close }`. |

### Parts

| Part | Notes |
| --- | --- |
| `DialogHeader`, `DialogTitle`, `DialogDescription` | Centered and compact in alerts; left-aligned with a larger title (leaving room for the ×) otherwise. |
| `DialogBody` | Scrolling area for `default` and `lg`. |
| `DialogFooter` | `orientation`: `horizontal` (default) or `vertical`, for alerts; a right-aligned button row in other sizes. |
| `DialogAction` | `variant`: `default` · `cancel` (semibold) · `destructive`. `slot` defaults to `close`. |
| `DialogClose` | Round × button, `aria-label="Close"`, closes via the `close` slot. |
| `Dialog` | The bare react-aria `Dialog`, for custom surfaces such as inside a `Popover`. |

## Styling

Slots: `dialog-overlay` (the scrim, `bg-overlay`), `dialog-content` (the card, with `data-size`), `dialog`, `dialog-header`, `dialog-title`, `dialog-description`, `dialog-body`, `dialog-footer` (with `data-orientation`), `dialog-action`, `dialog-close`. The card scales in (the alert with its own animation) and the scrim fades; reduced motion gets a fade. The scrim's class list is exported as `dialogOverlayClass`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `dialogVariants`

Defined in `@/components/ui/dialog`. Base classes:

```text
relative box-border flex max-h-full flex-col overflow-hidden bg-card text-card-foreground shadow-[0_24px_80px_--alpha(black/30%),0_0_0_.5px_var(--border)] outline-none
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `alert` | `w-[270px] rounded-card data-entering:animate-bl-alert-in data-exiting:animate-bl-alert-out motion-reduce:data-entering:animate-bl-fade-in motion-reduce:data-ex…` |
| `default` (default) | `w-full max-w-[400px] rounded-[20px] data-entering:animate-bl-pop-in data-exiting:animate-bl-pop-out motion-reduce:data-entering:animate-bl-fade-in motion-reduc…` |
| `lg` | `w-full max-w-[560px] rounded-[20px] data-entering:animate-bl-pop-in data-exiting:animate-bl-pop-out motion-reduce:data-entering:animate-bl-fade-in motion-reduc…` |

### `dialogActionVariants`

Defined in `@/components/ui/dialog`. Base classes:

```text
cn('bl-btn box-border flex h-11 cursor-pointer items-center justify-center border-0 bg-transparent px-3 [font-family:inherit] text-body whitespace-nowrap text-primary transition-[background-color] duration-exit data-pressed:bg-accent data-disabled:cursor-default data-disabled:opacity-40', focusRing, 'data-focus-visible:ring-inset')
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `font-normal` |
| `cancel` | `font-semibold` |
| `destructive` | `font-normal text-destructive` |
