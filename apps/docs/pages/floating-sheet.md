# FloatingSheet

A floating surface that grows from a resting card into the full page along a single drag. It fills its positioned host as a pointer-transparent layer, so a map, canvas, or scrolling page stays usable around it. The same component is translucent glass over a map, an opaque card inside a gutter, or a system-style sheet docked to the bottom edge; `FloatingChat` and the floating layout of [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container) are both built on it.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/floating-sheet.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  FloatingSheet, useFloatingSheet,
} from '@/components/ui/floating-sheet'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { FloatingSheet, useFloatingSheet } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

```tsx
import { Button, FloatingSheet } from '@brett_lamy/ui'

<div style={{ position: 'relative', height: 560 }}>
  <Map />
  <FloatingSheet appearance="glass" peek={190} label="Order">
    <FloatingSheet.Body><OrderStatus /></FloatingSheet.Body>
    <FloatingSheet.Foot>
      <Button size="pill">Continue</Button>
    </FloatingSheet.Foot>
  </FloatingSheet>
</div>
```

The host must be positioned (`relative`, `absolute`, …) and sized; the sheet measures it, not the viewport. Only the geometry waits for that measurement: the surface, the Body and the Foot render from the first (server) render, closed until the host has a height, and a host that measures 0 (a hidden tab, a closed panel) keeps its last geometry, so the Body never unmounts or loses its state.

## Appearances

| Look | Props |
| --- | --- |
| Glass | `appearance="glass"` (default) with a `gutter`. Blurs whatever is behind it. |
| Peeking | Any appearance with `peek` — part of the body stays visible above the foot while resting. |
| Card | `appearance="sheet"` with a `gutter`: an opaque `--card` surface with a soft shadow. |
| Docked sheet | `appearance="sheet"` with `gutter={0}`: edge to edge with square bottom corners, like a system sheet. |
| Open | `defaultOpen` or a controlled `open`: the cap meets the top of the host and the host dims behind it. |

The tone follows the nearest `AppearanceProvider`, so these examples switch with the docs' light/dark toggle. Pass `tone="light"` or `tone="dark"` when the surface must disagree with the page (a light sheet over a light map inside a dark app).

{% demo src="floating-sheet/appearances" %}

## Drag behavior

The sheet is [UI SDK's Drawer](https://ui-sdk.dev/docs/react/components/drawer) with a snap point at the peek, one per detent and one at full height. The FloatingSheet's own box is its layer host, so the drawer fills that box, not the app.

- **One surface.** The drawer moves a panel as tall as the grown sheet; the surface grows taller, wider and squarer with it as it rises past the peek (`--fs-grown`, 0 → 1), so there is no second card fading in.
- **Release keeps its momentum.** UI SDK projects the pointer's velocity forward: a flick goes to the next stop in the direction it was thrown, a slow drag settles at the nearest stop, and the tray spring carries the surface there from the finger's speed (grab it mid-flight and it stops under your finger).
- **Detents.** `detents={[0.5]}` adds resting heights between the peek and full (fractions of the grown body, or `'70%'` for a share of the host).
- **The cap is a handle.** A press steps to the next stop; the arrow keys, Home and End move through them. `Escape` and the scrim bring a grown sheet back to rest.
- **The page stays usable at rest.** Up to the peek the sheet is not modal (`modalAbove`): no dim, nothing inert, focus left alone. Above it the scrim dims the host and Tab stays in the sheet.
- **Drag below rest to minimize.** With `minimizable` (the default), dragging below the resting height puts the surface away and a round FAB pops in at `fabPosition`. Pressing the FAB brings the resting sheet back.
- **Scroll hides it.** While it rests on its cap and foot alone, `hideOnScroll` slides it away when the shared BL UI chrome hides (the same signal `TabBar` follows) or when `scrollRef`'s scroller moves down.

`useFloatingSheet()` reads the sheet's state from inside it — this example drives the same sheet from its own foot and prints the context as it settles:

{% demo src="floating-sheet/drag-snap-minimize" %}

With a half-height detent — drag slowly to settle at the nearest stop, flick to go to the next:

{% demo src="floating-sheet/detents" %}

## Dismissible

A docked bottom sheet you can put away, like the Maps or Find My sheet. With `dismissible`, dragging below the resting height slides the whole surface off the bottom edge and calls `onVisibleChange(false, details)`; `visible` brings it back, rising on the same spring. There is no FAB in this mode.

`peek`, `detents` and `topGap` also take a share of the host's height (`'40%'`), so stops can be written the way a designer specifies them, without measuring the host first. `topGap` leaves room above the fully grown sheet so the page behind still shows and the top corners stay round. `surfaceClassName` restyles the card itself (`bg-background`). The compact terminal dock in [WorkbenchShell](https://blamy.github.io/ui/#/workbench-shell) is exactly this.

{% demo src="floating-sheet/dismissible" %}

```tsx
<FloatingSheet
  appearance="sheet"
  gutter={0}
  dismissible
  visible={open}
  onVisibleChange={setOpen}
  peek="40%"
  detents={['70%']}
  topGap="5%"
  hideOnScroll={false}
>
  <FloatingSheet.Body>…</FloatingSheet.Body>
</FloatingSheet>
```

Which one to use: [Sheet](https://blamy.github.io/ui/#/sheet) is the modal edge panel — focus trap, Escape, outside press, content that must be answered. `FloatingSheet` is the same Drawer set up to live *beside* the page and leave it usable at rest: a chat, a map panel, a dock.

## Appearance morphs

Changing `appearance` or `tone` changes the material of the same surface: background, border and shadow cross on the spring curves, nothing remounts.

{% demo src="floating-sheet/appearance-morph" %}

## Trays

A flow in one sheet, after Family's trays: each step sets its own `peek`, so the sheet's height morphs between steps while the content slides the way the flow moves (forward from the right, back from the left).

{% demo src="floating-sheet/trays" %}

## Slots

| Slot | Role |
| --- | --- |
| `FloatingSheet.Body` | The growing region. Laid out at its full open height behind a window that slides with the drag, so content never reflows mid-gesture. |
| `FloatingSheet.Foot` | Pinned to the bottom of the surface at every height — a composer, action buttons, or nothing. |
| `FloatingSheet.Fab` | Content of the minimized FAB; `fabIcon` is the prop form. |

## Props

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `appearance` | `'glass' \| 'sheet'` | `'glass'` | Translucent blur over the host, or an opaque card. |
| `tone` | `'auto' \| 'dark' \| 'light'` | ambient | Colour scheme inside the sheet. Defaults to the `AppearanceProvider` value, else `auto` (inherit the host's `--bl-*` tokens). |
| `gutter` | `number` | `20` | Inset from the host edges while resting. `0` docks it edge to edge. |
| `radius` | `number` | `28` | Corner radius while resting; squares off as the sheet fills the host. |
| `peek` | `number \| '${number}%'` | `0` | Body height visible above the foot while resting; `'52%'` sizes the whole resting sheet as a share of the host. Capped at three quarters of the host. |
| `topGap` | `number \| '${number}%'` | `0` | Space left above the fully grown sheet; keeps the top corners round. |
| `detents` | `(number \| '${number}%')[]` | — | Extra resting stops: fractions of the grown body, or shares of the host. |
| `dismissible` | `boolean` | `false` | Drag below rest slides the sheet off the bottom edge (calls `onVisibleChange(false, details)`) instead of folding it to a FAB. |
| `visible` / `defaultVisible` / `onVisibleChange` | `boolean` / `boolean` / `(visible, details) => void` | `true` | Whether a dismissible sheet is on screen. |
| `bodyAlign` | `'start' \| 'end'` | `'start'` | `start` keeps a card's header under the cap; `end` pins the body to the foot so a transcript grows upward. |
| `open` / `defaultOpen` / `onOpenChange(open, details)` | `boolean` | uncontrolled | Controlled or uncontrolled fully grown state. `details.reason`: `swipe`, `handle-press`, `handle-key`, `imperative`. |
| `minimizable` | `boolean` | `true` | Whether a drag below rest folds the sheet into its FAB. |
| `fabPosition` | `FloatingSheetFabPosition` | `'bottom-center'` | `top-left`, `top-center`, `top-right`, `center-left`, `center-right`, `bottom-left`, `bottom-center`, or `bottom-right`. |
| `fabIcon` | `ReactNode` | tint dot | Icon for the minimized FAB. |
| `scrim` | `boolean` | `true` | Dim the host as the sheet grows. |
| `hideOnScroll` | `boolean` | `true` | Hide while resting when the shared chrome or `scrollRef` scrolls down. |
| `scrollRef` | `RefObject<HTMLElement>` | — | A scroller whose direction also hides and restores the resting sheet. |
| `label` | `string` | `'Sheet'` | Accessible name of the sheet. |
| `className` / `style` | | | Merged onto the root layer. |
| `surfaceClassName` | `string` | — | Merged onto the sheet surface (the card). |

## Hook and styling

`useFloatingSheet()` returns `{ open, setOpen, progress, peek, minimized, setMinimized }` — `progress` is the stop it rests on, from 0 at the peek to 1 fully grown (a detent in between). While it moves, the live value is the `--fs-grown` CSS variable on the surface. `useHideOnScroll(hideOnScroll, scrollRef)` is the hide-on-scroll signal on its own, for other floating chrome.

The root carries `data-slot="floating-sheet"` (and `data-layer-host`) with `data-appearance`, `data-tone`, `data-body-align`, `data-open`, `data-expanded`, `data-minimized` and `data-dismissed`. The drawer panel is `drawer-content` (`role="dialog"`, named by `label`), the cap is `drawer-handle` and the scrim `drawer-backdrop`; inside, `floating-sheet-surface` adds `data-peeking`, `data-dragging` and `data-hidden`, then `floating-sheet-reveal`, `floating-sheet-body` and `floating-sheet-foot`. The FAB is a UI SDK button labelled "Open", hooked by `data-floating-sheet-fab` (its `data-slot` is `button`) and `data-folded` while it is hidden. The surface's geometry is CSS off UI SDK's `--drawer-progress` (`--fs-extent`, `--fs-grown`); its material reads `--ck-sheet-bg-alpha`, `--ck-sheet-border-alpha`, `--ck-sheet-shadow-*` and `--ck-sheet-divider-alpha`, so hosts restyle it with plain CSS.

## Accessibility

The sheet is a dialog named by `label`. The cap is UI SDK's drawer handle ("Expand" / "Collapse"): Enter or Space steps to the next stop, the arrow keys, Home and End move between stops. The body is `inert` while the sheet rests on its cap and foot alone. At rest the page around the sheet stays usable and focus is never moved; grown, the sheet is modal to its own box and `Escape` brings it back to rest.

## Built on it

- `FloatingChat` — the same look over a Composer: its transcript hangs off the Composer's own draggable bump, and it shares this sheet's tone and hide-on-scroll signal.
- [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container) — floats a `FloatingChat` over the artifact below its breakpoint. Its **Delivery tracking** example is a docked `FloatingSheet` over a map.

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
pointer-events-auto absolute z-1 grid size-[52px] cursor-pointer place-items-center rounded-[50%] border p-0 text-foreground transition-[opacity,scale] duration-spring-snappy ease-spring-snappy outline-none focus-visible:ring-2 focus-visible:ring-primary/60 data-folded:pointer-events-none data-folded:scale-60 data-folded:opacity-0 motion-reduce:transition-none
```

**`position`** — default `bottom-center`

| Value | Adds |
| --- | --- |
| `top-left` | `top-(--fs-fab-gutter) left-(--fs-fab-gutter)` |
| `top-center` | `top-(--fs-fab-gutter) left-1/2 -translate-x-1/2` |
| `top-right` | `top-(--fs-fab-gutter) right-(--fs-fab-gutter)` |
| `center-left` | `top-1/2 left-(--fs-fab-gutter) -translate-y-1/2` |
| `center-right` | `top-1/2 right-(--fs-fab-gutter) -translate-y-1/2` |
| `bottom-left` | `bottom-(--fs-fab-gutter) left-(--fs-fab-gutter)` |
| `bottom-center` (default) | `bottom-[max(var(--fs-fab-gutter),20px)] left-1/2 -translate-x-1/2` |
| `bottom-right` | `right-(--fs-fab-gutter) bottom-(--fs-fab-gutter)` |

### `floatingSheetVariants`

Defined in `@/components/ui/floating-sheet`. Base classes:

```text
ck-floating-sheet pointer-events-none absolute inset-0 z-40 overflow-clip text-foreground [font-family:var(--bl-font,-apple-system,BlinkMacSystemFont,"SF_Pro_Text",sans-serif)]
```

**`tone`** — default `auto`

| Value | Adds |
| --- | --- |
| `auto` (default) | `[--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]` |
| `dark` | `[--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]` |
| `light` | `[--ck-sheet-line:0,0,0] [--ck-sheet-surface:250,250,252]` |
