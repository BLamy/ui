# FloatingSheet

A card that rests over a page and grows into it along one drag: an order status over a map, a panel over a canvas, a terminal dock over an editor, the floating chat of [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container). It fills its positioned host as a pointer-transparent layer, so the page stays usable around the resting card; drag its cap up and the same surface grows taller, wider and squarer until it fills the host; drag it below rest and it folds into a FAB (or slides away). It is [UI SDK's Drawer](https://ui-sdk.dev/docs/react/components/drawer) with snap points at the peek and full height, modal only above the peek.

Use [Sheet](https://blamy.github.io/ui/#/sheet) instead for a modal edge panel that must be answered (focus trap, Escape and outside press close it); [Dialog](https://blamy.github.io/ui/#/dialog) for a short task; [AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane) for a panel that is part of the layout (a docked column beside the page, a drawer or a pushed page as the host narrows); [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container) for a chat beside an artifact (it floats on this sheet when compact).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/floating-sheet.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  FloatingSheet, FloatingSheetBody, FloatingSheetFooter,
  FloatingSheetFab,
} from '@/components/ui/floating-sheet'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  FloatingSheet, FloatingSheetBody, FloatingSheetFooter,
  FloatingSheetFab,
} from '@brett_lamy/ui/floating-sheet'
```
{% endtab %}
{% endtabs %}

```tsx
import { Button } from '@brett_lamy/ui/button'
import { FloatingSheet, FloatingSheetBody, FloatingSheetFooter } from '@brett_lamy/ui/floating-sheet'

<div style={{ position: 'relative', height: 560 }}>
  <Map />
  <FloatingSheet peek={190} aria-label="Order">
    <FloatingSheetBody><OrderStatus /></FloatingSheetBody>
    <FloatingSheetFooter>
      <Button size="pill">Continue</Button>
    </FloatingSheetFooter>
  </FloatingSheet>
</div>
```

The host must be positioned (`relative`, `absolute`, …) and sized; the sheet measures it, not the viewport. Only the geometry waits for that measurement: the surface, the Body and the Footer render from the first (server) render, closed until the host has a height, and a host that measures 0 (a hidden tab, a closed panel) keeps its last geometry, so the Body never unmounts or loses its state.

## Looks

| Look | Props |
| --- | --- |
| Glass | `variant="glass"` (default), inset by its `gutter`. Blurs whatever is behind it. |
| Peeking | Any look with `peek`: part of the body stays visible above the footer while resting. |
| Card | `variant="card"`: an opaque card surface with a soft shadow. At rest it is the same floating card as Dialog's `variant="tray"` on a phone: 10px in from the edges, `--radius-sheet` corners. |
| Docked sheet | `variant="card"` with `gutter={0}`: edge to edge with square bottom corners, like a system sheet. |
| Open | `defaultOpen` or a controlled `open`: the cap meets the top of the host and the host dims behind it. |

The material is mixed from the theme's own tokens (`--card`, `--foreground`), so `appearance="auto"` (the default) follows the page and these examples switch with the docs' light/dark toggle. Pass `appearance="light"` or `"dark"` when the surface must disagree with the page (a dark sheet over a light map): the bl-theme's `sheet` scope goes on it, and popups opened inside wear it too.

{% demo src="floating-sheet/appearances" %}

## Drag behavior

The sheet is UI SDK's Drawer with a snap point at the peek, one per entry of `snapPoints` and one at full height. It is a [contained Sheet](https://blamy.github.io/ui/#/sheet) (its layer host fills the FloatingSheet's box), so the drawer fills that box, not the app.

- **One surface.** The drawer moves a panel as tall as the grown sheet; the surface grows taller, wider and squarer with it as it rises past the peek (`--fs-grown`, 0 → 1), so there is no second card fading in.
- **Release keeps its momentum.** UI SDK projects the pointer's velocity forward: a flick goes to the next stop in the direction it was thrown, a slow drag settles at the nearest stop, and the tray spring carries the surface there from the finger's speed.
- **Snap points.** `snapPoints={[0.5]}` adds resting heights between the peek and full (fractions of the grown body, or `'70%'` for a share of the host).
- **The cap is a handle.** A press steps to the next stop; the arrow keys, Home and End move through them. It is 18px tall, and 36px on a touch screen (`pointer: coarse`), so with the dock's padding under it it is a 44px target even while nothing peeks. `Escape` and the scrim bring a grown sheet back to rest (reported to `onOpenChange` with reason `escape-key` / `outside-press`, cancelable).
- **The page stays usable at rest.** Up to the peek the sheet is not modal (`modalAbove`): no dim, nothing inert, focus left alone. Above it the scrim dims the host and Tab stays in the sheet.
- **Below rest, `collapse` decides.** `fab` (default): the surface folds into a round FAB (placed by `FloatingSheetFab`'s `side` / `align`), and pressing the FAB brings the resting sheet back. `hide`: the surface slides off the bottom edge (`onVisibleChange(false, details)`); `visible` brings it back. `none`: it springs back to rest.
- **Scroll hides it.** While it rests on its cap and footer alone, `hideOnScroll` slides it away when the shared BL UI chrome hides (the same signal the `Tabs` bar follows) or when `scrollRef`'s scroller moves down.

`useFloatingSheet()` reads the sheet's state from inside it. This example drives the same sheet from its own footer and prints the context as it settles:

{% demo src="floating-sheet/drag-snap-minimize" %}

With a half-height snap point (drag slowly to settle at the nearest stop, flick to go to the next):

{% demo src="floating-sheet/detents" %}

## Hiding instead of folding

A docked bottom sheet you can put away, like the Maps or Find My sheet: `collapse="hide"`. Dragging below the resting height slides the whole surface off the bottom edge and calls `onVisibleChange(false, details)`; `visible` brings it back, rising on the same spring. There is no FAB in this mode.

`peek`, `snapPoints` and `topGap` also take a share of the host's height (`'40%'`), so stops can be written the way a designer specifies them. `topGap` leaves room above the fully grown sheet so the page behind still shows and the top corners stay round. `surfaceClassName` restyles the card itself (`bg-background`). The compact terminal dock in [WorkbenchShell](https://blamy.github.io/ui/#/workbench-shell) is exactly this.

{% demo src="floating-sheet/dismissible" %}

```tsx
<FloatingSheet
  variant="card"
  gutter={0}
  collapse="hide"
  visible={open}
  onVisibleChange={setOpen}
  peek="40%"
  snapPoints={['70%']}
  topGap="5%"
  hideOnScroll={false}
  aria-label="Nearby places"
>
  <FloatingSheetBody>…</FloatingSheetBody>
</FloatingSheet>
```

## Look morphs

Changing `variant` or `appearance` changes the material of the same surface: background, border and shadow cross on the spring curves, nothing remounts.

{% demo src="floating-sheet/appearance-morph" %}

## Trays

A flow in one sheet, after Family's trays, written with the same parts as a [Sheet](https://blamy.github.io/ui/#/sheet) or [Dialog](https://blamy.github.io/ui/#/dialog) flow: `view` names the step (FloatingSheet hands it to the Sheet it is built on), and each step sets its own `peek`, so the sheet's height springs between steps. Inside, `SheetHeader variant="bar"` holds `SheetBack` (it folds in once there is a step to go back to) and `SheetTitle`, which travels with its step, and `SheetView` slides the content the way the flow moves: forward from the end, back from the start. Nothing tracks the direction by hand.

```tsx
<FloatingSheet view={tray.id} peek={tray.peek} variant="card" collapse="none" aria-label="Checkout">
  <FloatingSheetBody>
    <SheetHeader variant="bar">
      <SheetBack hidden={step === 0} onClick={() => setStep(step - 1)} />
      <SheetTitle>{tray.title}</SheetTitle>
    </SheetHeader>
    <SheetView className="px-5 pb-5">{tray.body}</SheetView>
  </FloatingSheetBody>
</FloatingSheet>
```

{% demo src="floating-sheet/trays" %}

## Parts

| Part | Role |
| --- | --- |
| `FloatingSheet` | The layer and its drawer. Write the parts inside it. |
| `FloatingSheetBody` | The growing region (`div` props). Laid out at its full grown height behind a window that slides with the drag, so content never reflows mid-gesture; `inert` while the sheet rests on its cap and footer alone. Its children stack as written (a flow's `SheetHeader` and `SheetView` go straight in): with `bodyAlign="start"` the last one takes the rest of the window, so a lone scroller fills it; with `end` they keep their own height and sit against the footer. |
| `FloatingSheetFooter` | Pinned to the bottom of the surface at every height (`div` props): a composer, action buttons. Write it after the Body. |
| `FloatingSheetFab` | The round button the sheet folds into (Button props). Its children are its face and `aria-label` its name; without one the sheet shows a dot named "Open " + the sheet's name. It renders on the host's edge wherever you write it: `side` (`'top' \| 'bottom' \| 'start' \| 'end'`, default `'bottom'`; `start` / `end` are the inline edges) and `align` along it (`'start' \| 'center' \| 'end'`, default `'center'`). |

## Props

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `variant` | `'glass' \| 'card'` | `'glass'` | Translucent blur over the host, or an opaque card. |
| `appearance` | `'auto' \| 'light' \| 'dark'` | `'auto'` | Colour scheme of the surface: the page's, or the `sheet` scope in that appearance. |
| `gutter` | `number` | `10` | Inset from the host edges while resting, px (Dialog's tray inset). `0` docks it edge to edge. |
| `width` | `number \| string` | the host's width | The surface's largest inline size (px or a CSS length): on a wide host it keeps the card to a readable column, as a Maps card on an iPad. |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` | Where a surface narrower than the host sits: `gutter` in from that edge. |
| `radius` | `number \| string` | `'var(--radius-sheet)'` | Corner radius while resting (px or a CSS length; the radius of every modal sheet); squares off as the sheet fills the host. |
| `peek` | `number \| '${number}%'` | `0` | Body height visible above the footer while resting; `'52%'` sizes the whole resting sheet as a share of the host. Capped at three quarters of the host. |
| `topGap` | `number \| '${number}%'` | `0` | Space left above the fully grown sheet; keeps the top corners round. |
| `snapPoints` | `(number \| '${number}%')[]` | — | Extra resting stops between the peek and full: fractions of the grown body, or shares of the host. |
| `bodyAlign` | `'start' \| 'end'` | `'start'` | `start` keeps a card's header under the cap; `end` pins the body to the footer so a transcript grows upward. |
| `open` / `defaultOpen` / `onOpenChange(open, details)` | `boolean` | `false` | The fully grown state. `details.reason`: `swipe`, `handle-press`, `handle-key`, `escape-key`, `outside-press`, `imperative`; `details.cancel()` keeps it where it is. |
| `collapse` | `'fab' \| 'hide' \| 'none'` | `'fab'` | What a drag below rest does. |
| `minimized` / `defaultMinimized` / `onMinimizedChange(minimized, details)` | `boolean` | `false` | The fold into the FAB (`collapse="fab"`). `details.reason`: `swipe`, `trigger-press`, `imperative`. |
| `visible` / `defaultVisible` / `onVisibleChange(visible, details)` | `boolean` | `true` | Whether a `collapse="hide"` sheet is on screen. |
| `scrim` | `boolean` | `true` | Dim the host as the sheet grows. |
| `view` | `string` | — | Key of the current step of a flow, as on Sheet and Dialog: `SheetHeader variant="bar"`, `SheetBack`, `SheetTitle` and `SheetView` inside travel with it (see Trays). |
| `hideOnScroll` | `boolean` | `true` | Hide while resting on its cap and footer when the shared chrome or `scrollRef` scrolls down. |
| `scrollRef` | `RefObject<HTMLElement>` | — | A scroller whose direction also hides and restores the resting sheet. |
| `aria-label` | `string` | `'Sheet'` | Accessible name of the sheet. |
| `className` / `style` | | | Merged onto the root layer. |
| `id`, `data-*`, `ref`… | | | The root layer is a `div`: the rest of a div's props reach it. |
| `surfaceClassName` | `string` | — | Merged onto the sheet surface (the card). |

## Hook and styling

`useFloatingSheet()` returns `{ open, setOpen, progress, peek, minimized, setMinimized }`. `progress` is the stop it rests on, from 0 at the peek to 1 fully grown (a snap point in between); while it moves, the live value is the `--fs-grown` CSS variable on the surface. The setters take an optional `{ reason, event }` and go through `onOpenChange` / `onMinimizedChange`. `useHideOnScroll(hideOnScroll, scrollRef)` (from `@/lib/scroll-edge`, see [Layout hooks](https://blamy.github.io/ui/#/hooks-layout)) is the hide-on-scroll signal on its own, for other floating chrome.

The root carries `data-slot="floating-sheet"` (the contained Sheet's `sheet-host` inside it is the layer host) with `data-variant`, `data-appearance` (an explicit one), `data-body-align`, `data-open`, `data-expanded`, `data-minimized` and `data-dismissed`. The drawer panel is `drawer-content` (`role="dialog"`, named by `aria-label`), the cap is `drawer-handle` and the scrim `drawer-backdrop`; inside, `floating-sheet-surface` adds `data-peeking`, `data-dragging` and `data-hidden`, then `floating-sheet-reveal`, `floating-sheet-body` and `floating-sheet-footer`. The FAB is a UI SDK button hooked by `data-floating-sheet-fab` (its `data-slot` is `button`) and `data-folded` while it is hidden. The surface's geometry is CSS off UI SDK's `--drawer-progress` (`--fs-extent`, `--fs-grown`); its material reads `--ck-sheet-bg-alpha`, `--ck-sheet-border-alpha`, `--ck-sheet-shadow-*` and `--ck-sheet-divider-alpha`, so hosts restyle it with plain CSS. `floatingSheetVariants`, `floatingSheetSurfaceVariants({ variant, hidden })` and `floatingSheetFabVariants({ variant, side, align })` are the recipes.

## Accessibility

The sheet is a dialog named by `aria-label`. The cap is UI SDK's drawer handle ("Expand" / "Collapse"): Enter or Space steps to the next stop, the arrow keys, Home and End move between stops; it shows the kit's focus ring. The body is `inert` while the sheet rests on its cap and footer alone. At rest the page around the sheet stays usable and focus is never moved; grown, the sheet is modal to its own box and `Escape` brings it back to rest. The FAB is out of the tab order and the accessibility tree until the sheet folds into it.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `floatingSheetSurfaceVariants`

Defined in `@/components/ui/floating-sheet`. Base classes:

```text
surfaceBase
```

**`hidden`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `pointer-events-none translate-y-[calc(100%_+_44px)] opacity-0` |
| `false` (default) | — |

### `floatingSheetFabVariants`

Defined in `@/components/ui/floating-sheet`. Base classes:

```text
cn( 'pointer-events-auto absolute z-1 grid size-[52px] cursor-pointer place-items-center rounded-full border p-0 text-foreground transition-[opacity,scale] duration-spring-snappy ease-spring-snappy data-folded:pointer-events-none data-folded:scale-60 data-folded:opacity-0 motion-reduce:transition-none', focusRing, )
```

**`side`** — default `bottom`

| Value | Adds |
| --- | --- |
| `top` | `top-(--fs-fab-gutter)` |
| `bottom` (default) | `bottom-(--fs-fab-gutter)` |
| `start` | `start-(--fs-fab-gutter)` |
| `end` | `end-(--fs-fab-gutter)` |

**`align`** — default `center`

| Value | Adds |
| --- | --- |
| `start` | — |
| `center` (default) | — |
| `end` | — |

6 compound variants — see the source.

### `floatingSheetVariants`

Defined in `@/components/ui/floating-sheet`. Base classes:

```text
ck-floating-sheet pointer-events-none absolute inset-0 z-40 overflow-clip font-sans text-foreground [contain:layout]
```

No variants.
