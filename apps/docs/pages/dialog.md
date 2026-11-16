# Dialog

Modal dialogs on [UI SDK](https://ui-sdk.dev): a scrim, a card and a focus trap. `Dialog` is the general-purpose modal for a short task (a form, a confirmation with detail, a flow of a few steps). It is **responsive by default**: a centered card while the container it is written in is medium or regular, a sheet you can drag down while it is compact (a phone, a narrow window, a split column), with `variant="tray"` for the floating tray look. `AlertDialog` is the centered iOS alert, a question with two or three short answers, and it stays centered everywhere. The focus trap, Esc, focus return, the inert page behind, `aria-modal`, the swipe that dismisses a sheet and the keyboard inset under it come from UI SDK.

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

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Dialog, DialogTrigger, DialogBackdrop, DialogContent,
  DialogTitle,
} from '@brett_lamy/ui/dialog'
```
{% endtab %}
{% endtabs %}

```tsx
<Dialog>
  <DialogTrigger className={buttonVariants()}>Rename…</DialogTrigger>
  <DialogBackdrop />
  <DialogContent>
    <DialogClose />
    <DialogHeader>
      <DialogTitle>Rename project</DialogTitle>
      <DialogDescription>Names are visible to everyone.</DialogDescription>
    </DialogHeader>
    <DialogBody>…</DialogBody>
    <DialogFooter>
      <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
      <DialogClose render={<Button />} value="save">Save</DialogClose>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Dialog, AlertDialog or Sheet?

- **Dialog**: a task that interrupts and needs finishing: a rename or create form, a confirmation that needs a sentence of detail, a short flow (share → QR code → done; plan → checkout → paid). It adapts by itself: a card where there is room, a sheet or a tray where there isn't. Give the root a `view` and it becomes a flow, the card springing its height between steps (see [Credenza: the responsive dialog](#credenza-the-responsive-dialog)).
- **AlertDialog**: a yes-or-no question with short answers ("Delete this photo?"). A small centered card at every size, `role="alertdialog"`, and a press on the scrim never closes it.
- **[Sheet](https://blamy.github.io/ui/#/sheet)**: a modal that belongs to an edge at every size: a bottom card sheet with snap points for pickers and filters, side panels for settings or a detail, a drop-down from the top. Choose it when the content is larger than a dialog, or should feel attached to an edge even on a desktop.
- [AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane) — an inspector that can stay docked beside content; [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet) — a surface that lives beside the page and leaves it usable; [CommandMenu](https://blamy.github.io/ui/#/command-menu) — a searchable ⌘K palette that presents as a dialog. Use [Popover](https://blamy.github.io/ui/#/popover) for light, anchored content that should not block the page.

## Alerts

`AlertDialog` is the root, `AlertDialogTrigger` the button that opens it (`render` one of ours), `AlertDialogBackdrop` the scrim and `AlertDialogContent` the card. Put `AlertDialogTitle` and `AlertDialogDescription` in an `AlertDialogHeader`, and the answers — `AlertDialogClose`s — in an `AlertDialogFooter`. Each answer closes the alert; its `value` comes back as `details.returnValue` in `onOpenChange`, and an `action` runs first (a Promise it returns keeps the alert open, the button pending, until it settles). Use `variant="cancel"` for the preferred, semibold answer and `tone="destructive"` for the red one (a semantic colour, so it is a `tone`, as on rows). Two answers sit side by side; `orientation="vertical"` on the footer stacks three or more. An alert has `role="alertdialog"`, focus starts on its first answer (so put the safe one first), and a press on the scrim never closes it, as on iOS; Esc still does.

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
      <AlertDialogClose tone="destructive" value="confirm">Delete</AlertDialogClose>
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

A `Dialog` closes on Esc, on a press outside the card and (as a sheet) on a swipe down. `DialogClose` on its own is the round ×, pinned to the card's top-end corner; with children or `render` it is whatever you make it, such as a footer Button: `<DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>`. Like an alert's answers it reports a `value` and runs an `action` before it closes, so Save can commit the draft and close in one press, and `disabled` keeps it from closing while the form is invalid. `DialogBody` scrolls when the content is taller than its host, between a fixed header and footer. `initialFocus` on the content picks where focus starts (a selector, an element or a function), like the input in the form demo.

{% demo src="dialog/forms" %}

`dismissible={false}` on the root refuses Esc, outside presses and a swipe (while there are unsaved changes, or for a step the person has to finish) and reports `onDismissAttempt`. The bare × and the sheet's grabber are left out; Close parts with children, a controller and `open` still close it.

## Responsive by default

`presentation` defaults to `"auto"`: the Dialog reads the nearest size-class scope where it is **written** (BLProvider's root, a SplitView column, a NavigationStack…; see `SizeClassProvider` in [Layout hooks](https://blamy.github.io/ui/#/hooks-layout)) and opens as a centered card in a medium or regular one, as a sheet in a compact one. Context crosses portals, so a Dialog with no trigger, written inside a compact column of a wide app, is a sheet even though it renders into BLProvider's root. Outside every scope, UI SDK's own rule decides (a small touch screen). The choice is made each time it opens.

As a sheet it is dragged down to dismiss (`details.reason === 'swipe'`; a dialog that isn't `dismissible` springs back), it rides above the on-screen keyboard, its grabber shows while it can be dismissed, and a `DialogFooter`'s buttons are 44px tall (a touch target) and a horizontal one shares the width between them, as iOS does, ending at the same inset as a Sheet's footer. `DialogContent`'s `variant` shapes it: `default` is attached to the bottom edge like the kit's [Sheet](https://blamy.github.io/ui/#/sheet), `tray` floats 10px in from the edges (`trayInset` in `@/lib/surface`) with `--radius-sheet` corners, the same card as a resting [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet). The centered card is the same for both variants. `plain` draws no card at all (no surface, size cap, entry scale or grabber) and keeps the Dialog's focus, dismissal and theme scope: the content is yours to place and style, for a surface that brings its own look and motion, such as a [Morph](https://blamy.github.io/ui/#/morph) the content renders (`<DialogContent variant="plain" render={<Morph layoutId="player" />}>`).

{% demo src="dialog/responsive" %}

`presentation="dialog"` keeps it a centered card in every container (a full-screen gate, a player that covers its app, a palette); `presentation="sheet"` makes it a sheet everywhere. The content carries `data-presentation` (`dialog` or `sheet`) and `data-variant` for your own styles.

## Credenza: the responsive dialog

The pattern known as a *Credenza* (a dialog on a wide screen, a drawer on a phone, morphing between the steps of a flow) is this Dialog with a `view`. Give the root the key of the current step, use the `bar` header for back · title · close, and wrap the step in a `DialogView`:

```tsx
<Dialog open={open} onOpenChange={setOpen} view={view}>
  <DialogBackdrop />
  <DialogContent variant="tray">
    <DialogHeader variant="bar">
      <DialogBack hidden={view === 'menu'} onClick={() => setView('menu')} />
      <DialogTitle>{TITLES[view]}</DialogTitle>
      <DialogClose />
    </DialogHeader>
    <DialogView>
      <ShareViews view={view} go={setView} />
    </DialogView>
  </DialogContent>
</Dialog>
```

Changing `view` measures the new step and the card **springs its height** to fit (the tray spring) while the steps cross through a blur in the direction of travel: a new key arrives from the right, a key seen before comes back from the left. `DialogTitle` travels the same way (only while the root has a `view`), and a long title wraps instead of running under the ×. `DialogBack` stays mounted and grows in or out of the bar as `hidden` changes, so the title slides over to make room. When the step that held focus leaves, focus stays on the card instead of falling to the page; a control with `autoFocus` in the new step takes it. Inside a step, use `DialogBody` and `DialogFooter` as in any dialog; a step taller than the card's room scrolls. Try it in the Contacts demo: open any contact → **Share Contact**.

{% demo src="dialog/share-contact" %}

### Multi-step tray

Three steps in one tray (`presentation="sheet"`). The card measures each step and springs to its height, the back chevron shows on the review step, and a drag down dismisses. Sending money is a rare moment, so the Sent step fires a [Celebrate](https://blamy.github.io/ui/#/celebrate) burst once, as it lands.

{% demo src="dialog/send-money" %}

### Destructive confirmation

`presentation="dialog"` keeps it a centered card. Keep the destructive action on the right and say what will happen in the body; both buttons are `DialogClose` parts, and Delete's `action` runs before it closes.

{% demo src="dialog/confirm-delete" %}

### Share sheet

People to share with, actions as `ListRow`s, and a QR code as a second step.

{% demo src="dialog/share-sheet" %}

### Paywall

A Dialog that isn't `dismissible`, in front of a photo app until you subscribe. Pick a plan, then pay on a mock card form: the number groups itself and names the brand, every field checks itself on submit, and the payment shows its processing steps before the success step, which celebrates once. Nothing is charged — use the test card, or 4000 0000 0000 0002 to see a decline land on the card field. Switch to **Tray** for the phone presentation.

{% demo src="dialog/paywall" %}

### Sign in or register

A sign-in gate. Sign in, Create account and Reset password are steps of one Dialog that isn't dismissible, so moving between them morphs the card, and the email carries across. Each form validates on submit and waits on a pretend server; any address signs in, and registering taken@example.com brings its answer back onto the email field.

{% demo src="dialog/auth-gate" %}

### Registration and onboarding

Six steps in one Dialog: account, a six-digit code from the email that drops in at the top, profile, topics, notifications, done. Each step is a `view`, `DialogBack` steps back, and every step checks its own fields before it lets you on. The progress line is drawn by the card itself (`className` and a CSS variable on `DialogContent`), so it stays put while the steps slide beneath it. Closing it keeps your place.

{% demo src="dialog/onboarding" %}

## Where the scrim goes

`Dialog` and `AlertDialog` render into their layer host, BLProvider's root (see `useLayerHost`): your app root, or a demo's frame. The scrim and the card fill the host, only the rest of the host turns inert and the page keeps its scroll, so an app shown in a phone frame or a window keeps its dialogs inside it. Without a BLProvider a dialog renders in the browser's top layer and covers the page. Pass `container` to render it somewhere else. Open state is uncontrolled by default (`defaultOpen`); pass `open` and `onOpenChange(open, details)` to control it, or open it from anywhere with `createDialogController()`. Popups also wear the ThemeScope they were opened in — see [Popover](https://blamy.github.io/ui/#/popover), and the tinted scope in the [Sheet](https://blamy.github.io/ui/#/sheet) flow demo.

## Accessibility

UI SDK traps focus inside the dialog, makes the rest of its host inert, closes on Esc (marked handled, so a SplitView or NavigationStack behind it doesn't also go back) and returns focus to the trigger (or to what had focus before a controller opened it; `finalFocus` changes it). Focus moves to the first focusable element in a Dialog, or wherever `initialFocus` says (opened by touch, to the dialog itself, so no keyboard pops up); in an alert, to its first answer. `DialogTitle` names the dialog through `aria-labelledby` and `DialogDescription` describes it through `aria-describedby`; without a title pass `aria-label`. The × is named "Close" and the chevron "Back"; a folded-away `DialogBack` is `inert` and hidden from assistive tech. Keep alert answers short, and make the safe one the `cancel` one. Nested dialogs stack: the one below stays inert until the top one closes. Under reduced motion the card and the steps only fade.

## Props

### Dialog and AlertDialog

| Prop | Default | Effect |
| --- | --- | --- |
| `open` / `defaultOpen` / `onOpenChange(open, details)` | closed | Control visibility; `details.reason` (`escape-key`, `outside-press`, `close-press`, `swipe`, `imperative`…), `details.returnValue`, `details.cancel()`. |
| `onOpenChangeComplete(open)` | — | After the open or close animation. |
| `dismissible` / `onDismissAttempt` | `true` | `false` refuses Esc, outside presses and swipes, and leaves out the bare × and the grabber. |
| `modal` | `true` | `"trap-focus"` keeps the page usable; `false` makes it non-modal. |
| `presentation` (Dialog) | `"auto"` | `"auto"`: a sheet in a compact scope, a card otherwise. `"dialog"` or `"sheet"` fix it. AlertDialog is always centered. |
| `view` (Dialog) | — | Key of the current step of a flow: the card springs to its `DialogView`, and the step and the title travel by direction. |
| `controller` | — | From `createDialogController()` / `createAlertDialogController()`: open it from code, connect triggers outside it. |
| `container` | BLProvider's root | Where it renders. |

### DialogContent and AlertDialogContent

| Prop | Default | Effect |
| --- | --- | --- |
| `size` (DialogContent) | `default` | `default` ≤400px · `lg` ≤560px wide as a card. An alert is always 270px. |
| `variant` (DialogContent) | `default` | As a sheet: `default` is attached to the bottom edge, `tray` floats inset; the card is the same. `plain`: no card at all, the content is yours (a `Morph`). |
| `initialFocus` / `finalFocus` | first focusable / the trigger | Where focus goes as it opens and closes. |
| `aria-label` | — | Name when there is no title. |
| `className` / `style` | — | Merged onto the card; either may be a function of its state. |
| `children` | — | Content, or a function of its state (`open`, `presentation`, `payload`). |

### Parts

| Part | Notes |
| --- | --- |
| `DialogTrigger`, `AlertDialogTrigger` | The button that opens it; `render` one of ours. `controller` and `payload` connect one outside the root. |
| `DialogBackdrop`, `AlertDialogBackdrop` | The scrim (`bg-overlay`). |
| `DialogHeader` | `variant`: `default` stacks the title over its description (the × pinned beside it); `bar` is one row for `DialogBack`, `DialogTitle` and `DialogClose`. |
| `DialogTitle`, `DialogDescription` | The title (it travels with the `view` in a flow) and the line under it. |
| `DialogBack` | The round ‹ of a `bar` header. `hidden` folds it away; `onClick` steps back; `aria-label` defaults to "Back". |
| `DialogBody` | The scrolling area between header and footer. |
| `DialogFooter` | `orientation`: `horizontal` (right-aligned; shares the width as a sheet) or `vertical` (stacked, full width). |
| `DialogView` | The current step of a flow: springs the card's height and slides by direction. |
| `DialogClose` | The round ×, `aria-label="Close"` (left out when not `dismissible`); with children or `render`, any element that closes. `value`, `action`, `disabled`. |
| `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription` | Centered and compact. |
| `AlertDialogFooter` | `orientation`: `horizontal` (default) or `vertical`. |
| `AlertDialogClose` | An answer. `variant`: `default` · `cancel` (semibold); `tone`: `default` · `destructive` (red); `value`, `action`. |

## Surface parts

The header, title, description, body, footer and round buttons are shared by the kit's surfaces ([Sheet](https://blamy.github.io/ui/#/sheet) and [AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane) build their parts from them; [Card](https://blamy.github.io/ui/#/card), [Popover](https://blamy.github.io/ui/#/popover) and [HoverCard](https://blamy.github.io/ui/#/hover-card) take the `sm` title and description). Use them to make a surface of your own look like one of ours: `surfaceHeaderVariants({ variant: 'default' | 'bar' })`, `surfaceTitleVariants({ size: 'sm' | 'default' })`, `surfaceDescriptionVariants({ size })`, `surfaceBodyVariants()`, `surfaceFooterVariants({ orientation })`, `closeButtonVariants({ layout: 'inline' | 'pinned' })` (30px, `pinned` at the top-end corner) and `sheetGrabberVariants({ handle })`. They live in `@/lib/surface`, a module without hooks, so a Server Component can call them too; `@/components/ui/dialog` re-exports them (`@brett_lamy/ui` exports them from the root).

A [Sheet](https://blamy.github.io/ui/#/sheet) takes the same flow: `Sheet view`, `SheetHeader variant="bar"`, `SheetBack` (this `DialogBack`) and `SheetView` (this `DialogView`), so a flow steps back the same way whichever surface holds it. The round × and ‹ are drawn at 30px and hit-tested at 44px (a `::after` 7px past each edge), for the sheet presentation on a touch screen.

## Styling

Slots (from UI SDK): `dialog-trigger`, `dialog-backdrop`, `dialog-viewport` (a sheet's), `dialog-content` (the card, with our `data-size` and `data-variant`, and UI SDK's `data-presentation`), `dialog-title`, `dialog-description`, `dialog-close`, and the same with `alert-dialog-`; plus our `dialog-header` (with `data-variant`), `dialog-body`, `dialog-footer` (with `data-orientation`), `dialog-back` (with `data-hidden`), `dialog-view`, `dialog-grabber`, `alert-dialog-header` and `alert-dialog-footer`. Every modal card has the `rounded-sheet` radius. The card and scrim carry `data-open` / `data-closed` and `data-starting-style` / `data-ending-style` while they enter and leave: the Dialog grows out of the middle on the snappy spring, the alert settles from slightly larger, the scrim fades, exits are quicker, and reduced motion keeps only the fade. `dialogVariants({ size, variant })` and `alertDialogCloseVariants({ variant })` return the card and answer classes.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `dialogVariants`

Defined in `@/components/ui/dialog`. Base classes:

```text
group/dialog outline-none
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `lg` | — |

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `cn( dialogCard, 'data-[presentation=sheet]:m-0 data-[presentation=sheet]:w-full data-[presentation=sheet]:rounded-b-none data-[presentation=she…` |
| `tray` | `cn( dialogCard, 'data-[presentation=sheet]:mx-2.5 data-[presentation=sheet]:mt-0 data-[presentation=sheet]:mb-[max(10px,env(safe-area-inset-bot…` |
| `plain` | — |

2 compound variants — see the source.

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

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `destructive` | `text-destructive` |
