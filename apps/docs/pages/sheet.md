# Sheet

A modal panel pinned to one edge of its host. `side="bottom"` (the default) is the iOS card sheet with a grabber; `left` and `right` are side panels; `top` drops down from the top. It is a react-aria `Modal` like [Dialog](https://blamy.github.io/ui/#/dialog), so the scrim, Esc, outside press, focus trap and focus return are the same — and it shares Dialog's header, title, description, body and close parts. Use a Sheet for pickers, filters and settings that are too big for a dialog or belong to an edge; use [Credenza](https://blamy.github.io/ui/#/credenza) when one component should be a dialog on desktop and a draggable tray on phones, [SideDrawer](https://blamy.github.io/ui/#/side-drawer) for an inspector that can dock beside content, and [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet) for a surface that sits beside the page without blocking it (a map panel, a chat, a dock).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/sheet.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

`Sheet` is react-aria's `DialogTrigger`: the first pressable child opens the `SheetContent`. Children can be a function that receives `close`. `SheetFooter` pins its actions to the bottom (`mt-auto`), so a side panel keeps its button at the foot whatever the content height.

```tsx
<Sheet>
  <Button variant="secondary">Filters</Button>
  <SheetContent side="bottom" aria-label="Filters">
    {({ close }) => (
      <>
        <SheetClose />
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Narrow the list of messages.</SheetDescription>
        </SheetHeader>
        <SheetBody>…</SheetBody>
        <SheetFooter><Button size="pill" onPress={close}>Apply</Button></SheetFooter>
      </>
    )}
  </SheetContent>
</Sheet>
```

## Sides

The bottom sheet is full width with a rounded top, a 5px grabber (`grabber={false}` removes it — the grabber is a visual cue; the sheet is dismissed by Esc, the × or a scrim press, not by dragging) and a height capped 48px short of its host. `top` has the same cap and respects the safe-area top; `left` and `right` are 85% of the host, up to 360px, full height. The scrim is pressable by default (`isDismissable`); pass `isDismissable={false}` to make the user choose an action. The sheet fills its portal root, so inside a `BLProvider` — your app root, or a demo's frame — it covers the provider; without one it attaches to `<body>`.

{% demo src="sheet/sides" %}

## A flow in a tray

`animateHeight` wraps the content in [AnimatedHeight](https://blamy.github.io/ui/#/motion): when the content changes — a step forward, an error appearing — the sheet springs to the new height instead of jumping. Use it for short, content-sized trays. A sheet with a scrolling body should leave it off. The demo also opens the sheet inside a `ThemeScope` with its own tint: overlays wear the scope they are opened in, so the sheet's primary button is teal though the page's is not (`Dialog`, `Popover` and the rest do the same — see [Popover](https://blamy.github.io/ui/#/popover)).

{% demo src="sheet/flow" %}

## Accessibility

Like Dialog: focus is trapped, the page behind is hidden from assistive technology, Esc closes, focus returns to the trigger. The content is a react-aria `Dialog`, named by a `SheetTitle` (`aria-labelledby`) or the `aria-label` prop — provide one. Always include a visible way to close (`SheetClose`, or an action that calls `close`) since the scrim and Esc are not discoverable on touch. A flow that steps through states with `animateHeight` should keep the title in step with the content.

## Props

### SheetContent

| Prop | Default | Effect |
| --- | --- | --- |
| `side` | `bottom` | `bottom` · `top` · `left` · `right`. |
| `grabber` | `true` | The drag-handle cue, bottom sheets only. |
| `animateHeight` | `false` | Spring the sheet's height when its content changes. |
| `isDismissable` | `true` | Close on an outside press. |
| `isKeyboardDismissDisabled` | `false` | Ignore Esc. |
| `aria-label` | — | Name when there is no `SheetTitle`. |
| `className` / `overlayClassName` | — | Merged onto the sheet / the scrim. |
| `children` | — | Content, or a function receiving `{ close }`. |

`Sheet` accepts `isOpen`, `defaultOpen` and `onOpenChange`.

### Parts

`SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetBody` and `SheetClose` are Dialog's `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogBody` and `DialogClose` under another name. `SheetFooter` is its own: a column of actions at the foot with 20px side padding.

## Styling

Slots: `sheet-overlay`, `sheet` (with `data-side`), `sheet-grabber`, `sheet-content`, `sheet-footer`, plus Dialog's `dialog-header`, `dialog-title`, `dialog-description`, `dialog-body` and `dialog-close`. The sheet slides from its edge while the scrim fades; under reduced motion both fade. `sheetVariants({ side })` returns the placement and animation classes.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `sheetVariants`

Defined in `@/components/ui/sheet`. Base classes:

```text
absolute box-border flex flex-col bg-card text-card-foreground shadow-[0_0_40px_black] shadow-black/22 outline-none motion-reduce:data-entering:animate-bl-fade-in motion-reduce:data-exiting:animate-bl-fade-out
```

**`side`** — default `bottom`

| Value | Adds |
| --- | --- |
| `bottom` (default) | `inset-x-0 bottom-0 max-h-[calc(100%-48px)] rounded-t-card pb-[max(12px,env(safe-area-inset-bottom))] data-entering:animate-bl-sheet-in-bottom data-exiting:anim…` |
| `top` | `inset-x-0 top-0 max-h-[calc(100%-48px)] rounded-b-card pt-(--bl-safe-top) data-entering:animate-bl-sheet-in-top data-exiting:animate-bl-sheet-out-top` |
| `left` | `inset-y-0 left-0 w-[85%] max-w-[360px] rounded-r-card data-entering:animate-bl-sheet-in-left data-exiting:animate-bl-sheet-out-left` |
| `right` | `inset-y-0 right-0 w-[85%] max-w-[360px] rounded-l-card data-entering:animate-bl-sheet-in-right data-exiting:animate-bl-sheet-out-right` |
