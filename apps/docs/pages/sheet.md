# Sheet

A modal panel pinned to one edge of its host. `side="bottom"` (the default) is the iOS card sheet with a grabber; `left` and `right` are side panels; `top` drops down from the top. It is [UI SDK](https://ui-sdk.dev)'s Drawer: it follows a drag and springs back or away, can rest on snap points, and has a dialog's scrim, Esc, outside press, focus trap and focus return, like [Dialog](https://blamy.github.io/ui/#/dialog), whose header, title, body and close look it shares. `contained` keeps it inside one box of the page instead of the whole app, and `SheetContent variant="panel"` makes it a plain full-height edge panel.

Use a Sheet for pickers, filters and settings that are too big for a dialog or belong to an edge. Use [Dialog](https://blamy.github.io/ui/#/dialog) when one component should be a centered card in a wide container and a tray in a compact one (its `presentation="auto"`), [AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane) for a region of the layout that docks as a column when there is room and becomes a drawer or a pushed page when there isn't (it is built on a contained Sheet), and [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet) for a surface that sits beside the page without blocking it (a map panel, a chat, a dock).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/sheet.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Sheet, SheetTrigger, SheetBackdrop, SheetContent, SheetTitle,
} from '@/components/ui/sheet'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Sheet, SheetTrigger, SheetBackdrop, SheetContent, SheetTitle,
} from '@brett_lamy/ui/sheet'
```
{% endtab %}
{% endtabs %}

## Usage

`Sheet` is the root and takes the `side`. `SheetTrigger` is the button that opens it (`render` one of ours), `SheetBackdrop` the scrim and `SheetContent` the panel. `SheetClose` on its own is the round × in the corner; with children or `render` it is any element, such as the Apply button, and its `action` runs before the sheet closes. `SheetFooter` pins its actions to the bottom (`mt-auto`), so a side panel keeps its button at the foot whatever the content height: stacked full width (`orientation="vertical"`, the default), or side by side sharing the width (`orientation="horizontal"`), as in a Dialog presented as a sheet.

```tsx
<Sheet side="bottom">
  <SheetTrigger className={buttonVariants({ variant: 'secondary' })}>Filters</SheetTrigger>
  <SheetBackdrop />
  <SheetContent>
    <SheetClose />
    <SheetHeader>
      <SheetTitle>Filters</SheetTitle>
      <SheetDescription>Narrow the list of messages.</SheetDescription>
    </SheetHeader>
    <SheetBody>…</SheetBody>
    <SheetFooter>
      <SheetClose render={<Button size="pill" />} action={apply}>Apply</SheetClose>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

## Sides

The bottom sheet is full width with rounded top corners (the kit's modal radius, `rounded-sheet`), a 5px grabber (`grabber={false}` on the content removes it) and a height capped 48px short of its host. `top` has the same cap and respects the safe-area top; `left` and `right` (or the writing-direction `start` and `end`) are 85% of the host, up to 360px, full height. Every side follows a drag toward its edge: let go past the threshold, or flick, and it springs away; otherwise it springs back, on the kit's tray spring. `swipe={false}` on the content turns the drag off (Escape and the scrim still close it). A press on the scrim closes it; `dismissible={false}` on the root refuses the scrim, Esc and the swipe (it resists and springs back, and `onDismissAttempt` runs) so the user has to choose an action: the bare `SheetClose` × and the grabber are left out (a sheet with snap points keeps its handle), and a `SheetClose` with children still closes it. The sheet renders into BLProvider's root (see `useLayerHost`) — your app root, or a demo's frame — and stays inside it; without one it renders in the browser's top layer and covers the page.

{% demo src="sheet/sides" %}

## Contained, and the panel look

`contained` renders the sheet inside its positioned parent rather than BLProvider's root: the Sheet writes a layer host there (`data-slot="sheet-host"`, `absolute inset-0`, `contain: layout`), so its scrim, panel, focus trap and Escape stay in that box and the rest of the page outside it stays usable. The host stacks at `z-index: var(--sheet-z, 30)`; set `--sheet-z` on the parent to move it. `modal={false}` puts the panel beside a usable box, with no scrim. In a browser without the top layer (UI SDK would portal the sheet to the body) the sheet renders into that host instead, so it stays contained there too.

`SheetContent variant="panel"` is the edge panel without chrome: full length, flush with its edge, divided from the page by a hairline, no grabber, on the page background, 20rem wide up to 85% of the host. Its children are the whole panel (its own classes lay them out), which is what a drawer of navigation or an inspector wants. AdaptivePane's drawer and Sidebar's overlay are a contained Sheet with a panel, and [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet) is a contained bottom Sheet.

```tsx
<div className="relative h-full">
  <Sheet contained side="left" open={open} onOpenChange={setOpen}>
    <SheetBackdrop />
    <SheetContent variant="panel" aria-label="Folders" className="w-60">…</SheetContent>
  </Sheet>
</div>
```

{% demo src="sheet/contained" %}

## Snap points

`snapPoints` lists where the sheet can rest, from the edge it comes from: a fraction of the host up to 1, pixels above 1, `"…px"`, `"…rem"`, `"…%"`, or `"content"` for its own size. With more than one, the grabber becomes a `SheetHandle`: a press moves to the next snap point, and the arrow keys, Home and End step through them. It shows first but comes after the content in the tab order, so focus lands on the sheet's own controls. `snapPoint` / `defaultSnapPoint` / `onSnapPointChange(snapPoint, details)` control it.

```tsx
<Sheet snapPoints={[0.5, 1]}>…</Sheet>
```

## A flow in a tray

A flow in a sheet is built exactly like a [Dialog](https://blamy.github.io/ui/#/dialog) flow, so there is one way to go back on a phone. Give the root a `view` and put the content in a `SheetView`: each new `view` springs the sheet to its height, and the step and its `SheetTitle` slide in from the right (a view seen before comes back from the left). The header is the flow bar, `SheetHeader variant="bar"`: `SheetBack` (Dialog's `DialogBack`) on the leading edge, folded away with `hidden` on the first step and growing in after it, the `SheetTitle` taking the row, and the `SheetClose` × at the end of it. Keep the header outside the `SheetView`, as Dialog keeps its bar outside `DialogView`: the title travels on its own and goes on naming the sheet. Without a `view`, `SheetView` still springs the sheet when its content changes in place (an error appearing). Use it for short, content-sized trays; a sheet with a scrolling body leaves it out.

```tsx
<Sheet view={step}>
  <SheetBackdrop />
  <SheetContent>
    <SheetHeader variant="bar">
      <SheetBack hidden={step === 'pick'} onClick={() => setStep('pick')} />
      <SheetTitle>{step === 'pick' ? 'Choose a plan' : 'Confirm'}</SheetTitle>
      <SheetClose />
    </SheetHeader>
    <SheetView>{step === 'pick' ? <PickPlan /> : <Confirm />}</SheetView>
  </SheetContent>
</Sheet>
```
 The demo also opens the sheet inside a `ThemeScope` with its own tint: popups wear the scope they are opened in, so the sheet's primary button is teal though the page's is not (`Dialog`, `Popover` and the rest do the same — see [Popover](https://blamy.github.io/ui/#/popover)).

{% demo src="sheet/flow" %}

## Accessibility

Like Dialog: focus is trapped, the rest of the host is inert, Esc closes, focus returns to the trigger. The content has the `dialog` role and `aria-modal`, named by a `SheetTitle` (`aria-labelledby`) or `aria-label` — provide one. Always include a visible way to close (`SheetClose`) since the scrim, Esc and the swipe are not discoverable to everyone. The `SheetHandle` is a named button (`aria-label="Resize"` by default) that controls the sheet. A contained sheet makes only its own box inert. In a flow, each view has its own `SheetTitle`, so the sheet's name follows the step; the leaving view is hidden from assistive technology and focus while it slides out, and focus stays in the sheet when the focused control leaves.

## Props

### Sheet

| Prop | Default | Effect |
| --- | --- | --- |
| `side` | `bottom` | `bottom` · `top` · `left` · `right` · `start` · `end`. |
| `open` / `defaultOpen` / `onOpenChange(open, details)` | closed | Control visibility; `details.reason` (`swipe` among them), `details.returnValue`, `details.cancel()`. |
| `contained` | `false` | Render inside the positioned parent, in a layer host of its own, instead of BLProvider's root. |
| `view` | — | Key of the current view of a flow: a new one springs the sheet to its `SheetView` and slides it in. |
| `dismissible` | `true` | `false` refuses the scrim, Esc and the swipe (`onDismissAttempt` runs). |
| `modal` | `true` | `"trap-focus"` leaves the page usable; `false` puts the sheet beside the page. |
| `snapPoints` / `snapPoint` / `defaultSnapPoint` / `onSnapPointChange` | `["content"]` | Where it rests. |
| `physics` | the kit's tray spring | Overrides the spring, projection, rubber band and dim. |
| `controller` | — | From `createSheetController()`: open, close and move it from code, connect triggers outside it. |
| `container` | BLProvider's root | Where it renders (ignored when `contained`). |

### SheetContent

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `card` | `card`: the modal sheet. `panel`: a full-length edge panel whose children are the whole panel. |
| `grabber` | `true` | The grabber on bottom cards (a `SheetHandle` with snap points). |
| `swipe` | `true` | Whether a drag toward its edge closes it (`false` writes UI SDK's `data-drawer-no-drag`). |
| `keepMounted` | `false` | Keep the panel rendered while closed. |
| `initialFocus` / `finalFocus` | first focusable / the trigger | Where focus goes as it opens and closes (`"content"` for the panel itself). |
| `aria-label` | — | Name when there is no `SheetTitle`. |
| `className` / `style` | — | Merged onto the panel; either may be a function of its state (`side` among it). |
| `children` | — | Content, or a function of its state. |

### Parts

`SheetTitle`, `SheetDescription` and `SheetClose` are the Drawer's parts in the shared surface look (`surfaceTitleVariants`, `surfaceDescriptionVariants`, `closeButtonVariants` from `@/lib/surface`, also exported by Dialog); `SheetHeader` and `SheetBody` are Dialog's header and body under their own slots: `SheetHeader variant` is `default` (title over description, the × pinned in the corner) or `bar` (one row: `SheetBack` · `SheetTitle` · `SheetClose`). `SheetBack` is Dialog's `DialogBack` (slot `dialog-back`): the round ‹, `hidden` folds it away, its `onClick` steps your `view` back. In a `bar` header `SheetTitle` takes the free width and `SheetClose` sits in the row instead of the corner. `SheetFooter` is its own: the actions at the foot with 20px side padding, `orientation` `vertical` (default) or `horizontal`. `SheetHandle` is the grabber as a control, for placing your own with `grabber={false}`; `sheetGrabberVariants({ handle })` is its look. `SheetView` is Dialog's `DialogView` in a sheet (the springing, sliding view of a flow; slot `dialog-view`).

## Styling

Slots (from UI SDK): `drawer-trigger`, `drawer-backdrop`, `drawer-viewport`, `drawer-content` (with `data-side` and our `data-variant`), `drawer-title`, `drawer-description`, `drawer-close`, `drawer-handle`; plus our `sheet-host`, `sheet-grabber`, `sheet-header`, `sheet-body` and `sheet-footer`. UI SDK places and moves the panel itself (leave its `translate` alone) and drives the scrim's opacity as it moves; `data-dragging` is set during a drag. `sheetVariants({ variant, side })` returns the panel classes.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `sheetVariants`

Defined in `@/components/ui/sheet`. Base classes:

```text
pointer-events-auto relative box-border flex flex-col shadow-[0_0_40px_black] shadow-black/22 outline-none after:absolute after:bg-inherit after:content-[''] data-dragging:select-none
```

**`variant`** — default `card`

| Value | Adds |
| --- | --- |
| `card` (default) | `bg-card text-card-foreground` |
| `panel` | `bg-background text-foreground` |

**`side`** — default `bottom`

| Value | Adds |
| --- | --- |
| `bottom` (default) | `max-h-[calc(100%-48px)] w-full pb-[max(12px,env(safe-area-inset-bottom))] after:inset-x-0 after:top-full after:h-24` |
| `top` | `max-h-[calc(100%-48px)] w-full pt-(--bl-safe-top) after:inset-x-0 after:bottom-full after:h-24` |
| `left` | `mr-auto h-full w-[85%] max-w-[360px] after:inset-y-0 after:right-full after:w-24` |
| `right` | `ml-auto h-full w-[85%] max-w-[360px] after:inset-y-0 after:left-full after:w-24` |

8 compound variants — see the source.
