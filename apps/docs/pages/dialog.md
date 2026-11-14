# Dialog

Modal dialogs on [UI SDK](https://ui-sdk.dev): a scrim, a card and a focus trap. `AlertDialog` is the centered iOS alert — 270px wide, a centered title and message, a hairline-divided row of text buttons — for a decision the user must make. `Dialog` is the general-purpose card (`size="default"` up to 400px, `lg` up to 560px) with a header, a scrolling body and right-aligned footer actions, for a short form or a confirmation with detail. The focus trap, Esc, focus return, the inert page behind and `aria-modal` come from UI SDK.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/dialog.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Dialog, DialogTrigger, DialogBackdrop, DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Dialog, DialogTrigger, DialogBackdrop, DialogContent,
  DialogTitle,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Dialog, Sheet or Credenza?

- **Dialog** — an interruption that needs an answer or a short task, centered, at every screen size. Choose it for confirmations, rename and create forms, errors. You pick its size; on a narrow screen it stays a centered card that shrinks to fit, unless you give it `presentation="auto"`.
- **[Sheet](https://blamy.github.io/ui/#/sheet)** — the same modal, pinned to an edge: a bottom card sheet for pickers and filters on a phone, left/right panels for settings or a detail, a drop-down from the top. Choose it when the content is larger than a dialog or should feel attached to an edge.
- **[Credenza](https://blamy.github.io/ui/#/credenza)** — one component that is a centered dialog on desktop and a floating, drag-to-dismiss tray on a compact host, and morphs its height and title as a flow steps through states (menu → QR → done). Choose it when you want that adaptive, multi-step behavior built in instead of switching Dialog and Sheet yourself.
- [SideDrawer](https://blamy.github.io/ui/#/side-drawer) — an inspector that can stay docked beside content; [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet) — a surface that lives beside the page and leaves it usable; [CommandMenu](https://blamy.github.io/ui/#/command-menu) — a searchable ⌘K palette that can present as a dialog. Use [Popover](https://blamy.github.io/ui/#/popover) for light, anchored content that should not block the page.

## Alerts

`AlertDialog` is the root, `AlertDialogTrigger` the button that opens it (`render` one of ours), `AlertDialogBackdrop` the scrim and `AlertDialogContent` the card. Put `AlertDialogTitle` and `AlertDialogDescription` in an `AlertDialogHeader`, and the answers — `AlertDialogClose`s — in an `AlertDialogFooter`. Each answer closes the alert; its `value` comes back as `details.returnValue` in `onOpenChange`, and an `action` runs first (a Promise it returns keeps the alert open, the button pending, until it settles). Use `variant="cancel"` for the preferred, semibold answer and `destructive` for the red one. Two answers sit side by side; `orientation="vertical"` on the footer stacks three or more. An alert has `role="alertdialog"`, focus starts on its first answer (so put the safe one first), and a press on the scrim never closes it, as on iOS; Esc still does.

{% demo src="dialog/alerts" %}

```tsx
<AlertDialog onOpenChange={(open, { returnValue }) => !open && returnValue === 'confirm' && deletePhoto()}>
  <AlertDialogTrigger className={buttonVariants({ variant: 'destructive' })}>Delete photo…</AlertDialogTrigger>
  <AlertDialogBackdrop />
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
      <AlertDialogDescription>It will be removed from all your devices.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogClose variant="cancel">Cancel</AlertDialogClose>
      <AlertDialogClose variant="destructive" value="confirm">Delete</AlertDialogClose>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

To ask from code, `createConfirm()` returns a function that opens an alert and resolves `true` when it was answered with `value="confirm"`:

```tsx
const confirm = createConfirm()
…
<AlertDialog controller={confirm.controller}>…</AlertDialog>
if (await confirm()) deletePhoto()
```

## Forms

A `Dialog` closes on Esc and on a press outside the card. `DialogClose` on its own is the round × pinned to the top-right corner; with children or `render` it is whatever you make it, such as a footer Button: `<DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>`. Like an alert's answers it reports a `value` and runs an `action` before it closes, so Save can commit the draft and close in one press, and `disabled` keeps it from closing while the form is invalid. `DialogBody` scrolls when the content is taller than its host, between a fixed header and footer. `initialFocus` on the content picks where focus starts (a selector, an element or a function), like the input in the form demo.

{% demo src="dialog/forms" %}

`dismissible={false}` on the root refuses Esc, outside presses and a swipe while there are unsaved changes, and reports `onDismissAttempt`; its Close parts and a controller still close it.

## Where the scrim goes

`Dialog` and `AlertDialog` render into their layer host, BLProvider's root (see `useLayerHost`): your app root, or a demo's frame. The scrim and the card fill the host, only the rest of the host turns inert and the page keeps its scroll, so an app shown in a phone frame or a window keeps its dialogs inside it. Without a BLProvider a dialog renders in the browser's top layer and covers the page. Pass `container` to render it somewhere else. Open state is uncontrolled by default (`defaultOpen`); pass `open` and `onOpenChange(open, details)` to control it, or open it from anywhere with `createDialogController()`. Popups also wear the ThemeScope they were opened in — see [Popover](https://blamy.github.io/ui/#/popover), and the tinted scope in the [Sheet](https://blamy.github.io/ui/#/sheet) flow demo.

## As a sheet

`presentation="auto"` on a `Dialog` turns it into a bottom sheet when it opens in a compact container (a phone-sized frame or column), and `presentation="sheet"` always does. As a sheet it is shaped like the kit's bottom [Sheet](https://blamy.github.io/ui/#/sheet) and a swipe down dismisses it (a protected one springs back). The content carries `data-presentation` (`dialog` or `sheet`).

## Accessibility

UI SDK traps focus inside the dialog, makes the rest of its host inert, closes on Esc and returns focus to the trigger (or to what had focus before a controller opened it; `finalFocus` changes it). Focus moves to the first focusable element in a Dialog, or wherever `initialFocus` says; in an alert, to its first answer. `DialogTitle` names the dialog through `aria-labelledby` and `DialogDescription` describes it through `aria-describedby`; without a title pass `aria-label`. Keep alert answers short, and make the safe one the `cancel` one. Nested dialogs stack: the one below stays inert until the top one closes.

## Props

### Dialog and AlertDialog

| Prop | Default | Effect |
| --- | --- | --- |
| `open` / `defaultOpen` / `onOpenChange(open, details)` | closed | Control visibility; `details.reason`, `details.returnValue`, `details.cancel()`. |
| `dismissible` | `true` | `false` refuses Esc, outside presses and swipes (`onDismissAttempt` runs). |
| `modal` | `true` | `"trap-focus"` keeps the page usable; `false` makes it non-modal. |
| `presentation` (Dialog) | `"dialog"` | `"sheet"`, or `"auto"` for a sheet in a compact container. |
| `controller` | — | From `createDialogController()` / `createAlertDialogController()`: open it from code, connect triggers outside it. |
| `container` | BLProvider's root | Where it renders. |

### DialogContent and AlertDialogContent

| Prop | Default | Effect |
| --- | --- | --- |
| `size` (DialogContent) | `default` | `default` ≤400px · `lg` ≤560px (both `rounded-[20px]`). An alert is always 270px. |
| `initialFocus` / `finalFocus` | first focusable / the trigger | Where focus goes as it opens and closes. |
| `aria-label` | — | Name when there is no title. |
| `className` / `style` | — | Merged onto the card; either may be a function of its state. |
| `children` | — | Content, or a function of its state (`open`, `presentation`, `payload`). |

### Parts

| Part | Notes |
| --- | --- |
| `DialogTrigger`, `AlertDialogTrigger` | The button that opens it; `render` one of ours. `controller` and `payload` connect one outside the root. |
| `DialogBackdrop`, `AlertDialogBackdrop` | The scrim (`bg-overlay`). |
| `DialogHeader`, `DialogTitle`, `DialogDescription` | Left-aligned, a large title that leaves room for the ×. |
| `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription` | Centered and compact. |
| `DialogBody` | The scrolling area between header and footer. |
| `DialogFooter` | A right-aligned button row. |
| `AlertDialogFooter` | `orientation`: `horizontal` (default) or `vertical`. |
| `DialogClose` | The round ×, `aria-label="Close"`; with children or `render`, any element. `value`, `action`, `disabled`. |
| `AlertDialogClose` | An answer. `variant`: `default` · `cancel` (semibold) · `destructive`; `value`, `action`. |

## Styling

Slots (from UI SDK): `dialog-trigger`, `dialog-backdrop`, `dialog-content` (the card, with our `data-size`), `dialog-title`, `dialog-description`, `dialog-close`, and the same with `alert-dialog-`; plus our `dialog-header`, `dialog-body`, `dialog-footer`, `alert-dialog-header` and `alert-dialog-footer` (with `data-orientation`). The card and scrim carry `data-open` / `data-closed` and `data-starting-style` / `data-ending-style` while they enter and leave: the Dialog grows out of the middle on the snappy spring, the alert settles from slightly larger, the scrim fades, exits are quicker, and reduced motion keeps only the fade. `dialogVariants({ size })` and `alertDialogCloseVariants({ variant })` return the card and answer classes.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `dialogVariants`

Defined in `@/components/ui/dialog`. Base classes:

```text
fixed inset-0 m-auto box-border flex h-fit max-h-[calc(100%-48px)] flex-col overflow-hidden bg-card text-card-foreground shadow-[0_24px_80px_--alpha(black/30%),0_0_0_.5px_var(--border)] outline-none transition-[opacity,scale] data-ending-style:duration-exit data-ending-style:ease-exit motion-reduce:duration-spring-smooth motion-reduce:ease-spring-smooth
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `alert` | `w-[270px] max-w-[calc(100%-48px)] rounded-card duration-spring-smooth ease-spring-smooth data-starting-style:opacity-0 data-ending-style:opacity-0 motion-safe:…` |
| `default` (default) | `w-[calc(100%-48px)] max-w-[400px] rounded-[20px] ${dialogPop} ${dialogSheet}` |
| `lg` | `w-[calc(100%-48px)] max-w-[560px] rounded-[20px] ${dialogPop} ${dialogSheet}` |

### `alertDialogCloseVariants`

Defined in `@/components/ui/dialog`. Base classes:

```text
cn( 'bl-btn box-border flex h-11 cursor-pointer items-center justify-center border-0 bg-transparent px-3 [font-family:inherit] text-body whitespace-nowrap text-primary transition-[background-color] duration-exit active:bg-accent disabled:cursor-default disabled:opacity-40 data-pending:cursor-progress', focusRing, 'focus-visible:ring-inset', )
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `font-normal` |
| `cancel` | `font-semibold` |
| `destructive` | `font-normal text-destructive` |
