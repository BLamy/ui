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

The host must be positioned (`relative`, `absolute`, …) and sized; the sheet measures it, not the viewport.

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

- **The cap is the handle.** Dragging it moves the surface one-to-one with the pointer; there is no second card fading in.
- **Release keeps its momentum.** The pointer's velocity is projected forward: a flick goes to the next stop in the direction it was thrown, a slow drag settles at the nearest stop, and a spring carries the surface there *from the finger's speed* (grab it mid-flight and it stops under your finger).
- **Detents.** `detents={[0.5]}` adds resting heights between the peek and full (fractions of the grown body, or `'70%'` for a share of the host).
- **Tap toggles.** A plain tap on the cap (under 4px of travel) opens or closes it. `Escape` and the scrim close it.
- **Drag below rest to minimize.** With `minimizable` (the default), dragging below the resting height first closes the peek, then folds the surface into a round FAB at `fabPosition`. Tapping the FAB restores the resting sheet.
- **Scroll hides it.** While resting, `hideOnScroll` slides it away when the shared BL UI chrome hides (the same signal `TabBar` follows) or when `scrollRef`'s scroller moves down.

`useFloatingSheet()` reads the live state from inside the sheet — this example drives the same sheet from its own foot and prints the context while you drag:

{% demo src="floating-sheet/drag-snap-minimize" %}

With a half-height detent — drag slowly to settle at the nearest stop, flick to go to the next:

{% demo src="floating-sheet/detents" %}

## Dismissible

A docked bottom sheet you can put away, like the Maps or Find My sheet. With `dismissible`, dragging below the resting height slides the whole surface off the bottom edge and calls `onDismiss`; `visible` brings it back, rising on the same spring. There is no FAB in this mode.

`peek`, `detents` and `topGap` also take a share of the host's height (`'40%'`), so stops can be written the way a designer specifies them, without measuring the host first. `topGap` leaves room above the fully grown sheet so the page behind still shows and the top corners stay round. `surfaceClassName` restyles the card itself (`bg-background`). The compact terminal dock in [WorkbenchShell](https://blamy.github.io/ui/#/workbench-shell) is exactly this.

{% demo src="floating-sheet/dismissible" %}

```tsx
<FloatingSheet
  appearance="sheet"
  gutter={0}
  dismissible
  visible={open}
  onDismiss={() => setOpen(false)}
  peek="40%"
  detents={['70%']}
  topGap="5%"
  hideOnScroll={false}
>
  <FloatingSheet.Body>…</FloatingSheet.Body>
</FloatingSheet>
```

Which one to use: [Sheet](https://blamy.github.io/ui/#/sheet) is the modal edge panel — focus trap, Escape, outside press, content that must be answered. `FloatingSheet` is the surface that lives *beside* the page and leaves it usable: a chat, a map panel, a dock.

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
| `dismissible` | `boolean` | `false` | Drag below rest slides the sheet off the bottom edge (calls `onDismiss`) instead of folding it to a FAB. |
| `visible` / `onDismiss` | `boolean` / `() => void` | `true` | Whether a dismissible sheet is on screen. Controlled. |
| `bodyAlign` | `'start' \| 'end'` | `'start'` | `start` keeps a card's header under the cap; `end` pins the body to the foot so a transcript grows upward. |
| `open` / `defaultOpen` / `onOpenChange` | `boolean` | uncontrolled | Controlled or uncontrolled grown state. |
| `minimizable` | `boolean` | `true` | Whether a drag below rest folds the sheet into its FAB. |
| `fabPosition` | `FloatingSheetFabPosition` | `'bottom-center'` | `top-left`, `top-center`, `top-right`, `center-left`, `center-right`, `bottom-left`, `bottom-center`, or `bottom-right`. |
| `fabIcon` | `ReactNode` | tint dot | Icon for the minimized FAB. |
| `scrim` | `boolean` | `true` | Dim the host as the sheet grows. |
| `hideOnScroll` | `boolean` | `true` | Hide while resting when the shared chrome or `scrollRef` scrolls down. |
| `scrollRef` | `RefObject<HTMLElement>` | — | A scroller whose direction also hides and restores the resting sheet. |
| `label` | `string` | `'Sheet'` | Accessible name of the body region. |
| `className` / `style` | | | Merged onto the root layer. |
| `surfaceClassName` | `string` | — | Merged onto the sheet surface (the card). |

## Hook and styling

`useFloatingSheet()` returns `{ open, setOpen, progress, peek, minimized, setMinimized }` — `progress` runs from 0 at rest to 1 fully grown, and updates on every drag frame.

The root carries `data-slot="floating-sheet"` with `data-appearance`, `data-tone`, `data-body-align`, `data-open`, `data-expanded`, `data-dragging`, and `data-minimized`; the surface adds `data-peeking`, `data-hidden`, and `data-fab-position`. Geometry is written to `--ck-sheet-*` custom properties (`--ck-sheet-height`, `--ck-sheet-reveal`, `--ck-sheet-radius`, `--ck-sheet-grown`, …), so hosts restyle it with plain CSS.

## Accessibility

The cap is a real button with `aria-expanded` and `aria-controls` pointing at the body region, so keyboard users toggle the sheet with Enter or Space. The body is `inert` and `aria-hidden` while fully collapsed, the scrim is focusable only while the sheet is open, and `Escape` closes it.

## Built on it

- `FloatingChat` — a `FloatingSheet` whose body is a transcript (`bodyAlign="end"`) and whose foot is a composer.
- [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container) — floats a `FloatingChat` over the artifact below its breakpoint. Its **Delivery tracking** example is a docked `FloatingSheet` over a map.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `floatingSheetSurfaceVariants`

Defined in `@/components/ui/floating-sheet`. Base classes:

```text
surfaceBase
```

**`appearance`** — default `glass`

| Value | Adds |
| --- | --- |
| `glass` (default) | `border-[color:rgba(var(--ck-sheet-line),var(--ck-sheet-border-alpha,.12))] bg-[color:rgba(var(--ck-sheet-surface),var(--ck-sheet-bg-alpha,.28))] bg-[linear-gra…` |
| `sheet` | `border-[color:rgba(var(--ck-sheet-line),calc(var(--ck-sheet-border-alpha,.12)_*_.5))] bg-card [box-shadow:0_-1px_0_rgba(var(--ck-sheet-line),.04),0_2px_10px_co…` |

**`placement`** — default `resting`

| Value | Adds |
| --- | --- |
| `resting` (default) | `[transform:translateX(-50%)]` |
| `hidden` | `[transform:translate(-50%,calc(100%_+_44px))]` |
| `top-left` | `top-[var(--ck-sheet-gutter,20px)] right-auto bottom-auto left-[var(--ck-sheet-gutter,20px)] [transform:none]` |
| `top-center` | `top-[var(--ck-sheet-gutter,20px)] right-auto bottom-auto left-1/2 [transform:translateX(-50%)]` |
| `top-right` | `top-[var(--ck-sheet-gutter,20px)] right-[var(--ck-sheet-gutter,20px)] bottom-auto left-auto [transform:none]` |
| `center-left` | `top-1/2 right-auto bottom-auto left-[var(--ck-sheet-gutter,20px)] [transform:translateY(-50%)]` |
| `center-right` | `top-1/2 right-[var(--ck-sheet-gutter,20px)] bottom-auto left-auto [transform:translateY(-50%)]` |
| `bottom-left` | `top-auto right-auto bottom-[var(--ck-sheet-gutter,20px)] left-[var(--ck-sheet-gutter,20px)] [transform:none]` |
| `bottom-center` | `top-auto right-auto bottom-[max(var(--ck-sheet-gutter,20px),20px)] left-1/2 [transform:translateX(-50%)]` |
| `bottom-right` | `top-auto right-[var(--ck-sheet-gutter,20px)] bottom-[var(--ck-sheet-gutter,20px)] left-auto [transform:none]` |

**`hidden`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `pointer-events-none opacity-0` |
| `false` (default) | — |

### `floatingSheetVariants`

Defined in `@/components/ui/floating-sheet`. Base classes:

```text
ck-floating-sheet pointer-events-none absolute inset-0 z-40 text-foreground [font-family:var(--bl-font,-apple-system,BlinkMacSystemFont,"SF_Pro_Text",sans-serif)]
```

**`tone`** — default `auto`

| Value | Adds |
| --- | --- |
| `auto` (default) | `[--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]` |
| `dark` | `[--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]` |
| `light` | `[--ck-sheet-line:0,0,0] [--ck-sheet-surface:250,250,252]` |
