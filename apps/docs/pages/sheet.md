# Sheet

A modal panel pinned to one edge of its host. `side="bottom"` (the default) is the iOS card sheet with a grabber; `left` and `right` are side panels; `top` drops down from the top. It is [UI SDK](https://ui-sdk.dev)'s Drawer: it follows a drag and springs back or away, can rest on snap points, and has a dialog's scrim, Esc, outside press, focus trap and focus return, like [Dialog](https://blamy.github.io/ui/#/dialog) — whose header, body and close look it shares. Use a Sheet for pickers, filters and settings that are too big for a dialog or belong to an edge; use [Credenza](https://blamy.github.io/ui/#/credenza) when one component should be a dialog on desktop and a draggable tray on phones, [SideDrawer](https://blamy.github.io/ui/#/side-drawer) for an inspector that can dock beside content, and [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet) for a surface that sits beside the page without blocking it (a map panel, a chat, a dock).

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

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Sheet, SheetTrigger, SheetBackdrop, SheetContent, SheetTitle,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

`Sheet` is the root and takes the `side`. `SheetTrigger` is the button that opens it (`render` one of ours), `SheetBackdrop` the scrim and `SheetContent` the panel. `SheetClose` on its own is the round × in the corner; with children or `render` it is any element, such as the Apply button, and its `action` runs before the sheet closes. `SheetFooter` pins its actions to the bottom (`mt-auto`), so a side panel keeps its button at the foot whatever the content height.

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

The bottom sheet is full width with a rounded top, a 5px grabber (`grabber={false}` on the content removes it) and a height capped 48px short of its host. `top` has the same cap and respects the safe-area top; `left` and `right` (or the writing-direction `start` and `end`) are 85% of the host, up to 360px, full height. Every side follows a drag toward its edge: let go past the threshold, or flick, and it springs away; otherwise it springs back, on the kit's tray spring. A press on the scrim closes it; `dismissible={false}` on the root refuses the scrim, Esc and the swipe (it resists and springs back, and `onDismissAttempt` runs) so the user has to choose an action. The sheet renders into BLProvider's root (see `useLayerHost`) — your app root, or a demo's frame — and stays inside it; without one it renders in the browser's top layer and covers the page.

{% demo src="sheet/sides" %}

## Snap points

`snapPoints` lists where the sheet can rest, from the edge it comes from: a fraction of the host up to 1, pixels above 1, `"…px"`, `"…rem"`, `"…%"`, or `"content"` for its own size. With more than one, the grabber becomes a `SheetHandle`: a press moves to the next snap point, and the arrow keys, Home and End step through them. `snapPoint` / `defaultSnapPoint` / `onSnapPointChange(snapPoint, details)` control it.

```tsx
<Sheet snapPoints={[0.5, 1]}>…</Sheet>
```

## A flow in a tray

`animateHeight` wraps the content in [AnimatedHeight](https://blamy.github.io/ui/#/motion): when the content changes — a step forward, an error appearing — the sheet springs to the new height instead of jumping. Use it for short, content-sized trays. A sheet with a scrolling body should leave it off. The demo also opens the sheet inside a `ThemeScope` with its own tint: popups wear the scope they are opened in, so the sheet's primary button is teal though the page's is not (`Dialog`, `Popover` and the rest do the same — see [Popover](https://blamy.github.io/ui/#/popover)).

{% demo src="sheet/flow" %}

## Accessibility

Like Dialog: focus is trapped, the rest of the host is inert, Esc closes, focus returns to the trigger. The content has the `dialog` role and `aria-modal`, named by a `SheetTitle` (`aria-labelledby`) or `aria-label` — provide one. Always include a visible way to close (`SheetClose`) since the scrim, Esc and the swipe are not discoverable to everyone. The `SheetHandle` is a named button (`aria-label="Resize"` by default) that controls the sheet. A flow that steps through states with `animateHeight` should keep the title in step with the content.

## Props

### Sheet

| Prop | Default | Effect |
| --- | --- | --- |
| `side` | `bottom` | `bottom` · `top` · `left` · `right` · `start` · `end`. |
| `open` / `defaultOpen` / `onOpenChange(open, details)` | closed | Control visibility; `details.reason` (`swipe` among them), `details.returnValue`, `details.cancel()`. |
| `dismissible` | `true` | `false` refuses the scrim, Esc and the swipe (`onDismissAttempt` runs). |
| `modal` | `true` | `"trap-focus"` leaves the page usable; `false` puts the sheet beside the page. |
| `snapPoints` / `snapPoint` / `defaultSnapPoint` / `onSnapPointChange` | `["content"]` | Where it rests. |
| `physics` | the kit's tray spring | Overrides the spring, projection, rubber band and dim. |
| `controller` | — | From `createSheetController()`: open, close and move it from code, connect triggers outside it. |
| `container` | BLProvider's root | Where it renders. |

### SheetContent

| Prop | Default | Effect |
| --- | --- | --- |
| `grabber` | `true` | The grabber on bottom sheets (a `SheetHandle` with snap points). |
| `animateHeight` | `false` | Spring the sheet's height when its content changes. |
| `initialFocus` / `finalFocus` | first focusable / the trigger | Where focus goes as it opens and closes. |
| `aria-label` | — | Name when there is no `SheetTitle`. |
| `className` / `style` | — | Merged onto the panel; either may be a function of its state (`side` among it). |
| `children` | — | Content, or a function of its state. |

### Parts

`SheetTitle`, `SheetDescription` and `SheetClose` are the Drawer's parts in Dialog's look; `SheetHeader` and `SheetBody` are Dialog's `DialogHeader` and `DialogBody`. `SheetFooter` is its own: a column of actions at the foot with 20px side padding. `SheetHandle` is the grabber as a control, for placing your own with `grabber={false}`.

## Styling

Slots (from UI SDK): `drawer-trigger`, `drawer-backdrop`, `drawer-viewport`, `drawer-content` (with `data-side`), `drawer-title`, `drawer-description`, `drawer-close`, `drawer-handle`; plus our `sheet-grabber`, `sheet-footer`, `dialog-header` and `dialog-body`. UI SDK places and moves the panel itself (leave its `translate` alone) and drives the scrim's opacity as it moves; `data-dragging` is set during a drag. `sheetVariants({ side })` returns the panel classes.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `sheetVariants`

Defined in `@/components/ui/sheet`. Base classes:

```text
relative box-border flex flex-col bg-card text-card-foreground shadow-[0_0_40px_black] shadow-black/22 outline-none after:absolute after:bg-inherit after:content-[''] data-dragging:select-none
```

**`side`** — default `bottom`

| Value | Adds |
| --- | --- |
| `bottom` (default) | `max-h-[calc(100%-48px)] w-full rounded-t-card pb-[max(12px,env(safe-area-inset-bottom))] after:inset-x-0 after:top-full after:h-24` |
| `top` | `max-h-[calc(100%-48px)] w-full rounded-b-card pt-(--bl-safe-top) after:inset-x-0 after:bottom-full after:h-24` |
| `left` | `mr-auto h-full w-[85%] max-w-[360px] rounded-r-card after:inset-y-0 after:right-full after:w-24` |
| `right` | `ml-auto h-full w-[85%] max-w-[360px] rounded-l-card after:inset-y-0 after:left-full after:w-24` |
