# FloatingSheet

A floating surface that grows from a resting card into the full page along a single drag. It fills its positioned host as a pointer-transparent layer, so a map, canvas, or scrolling page stays usable around it. The same component is translucent glass over a map, an opaque card inside a gutter, or a system-style sheet docked to the bottom edge; `FloatingChat` and the floating layout of [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container) are both built on it.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx lineNumbers="false"
import '@brett_lamy/ui/styles.css'

import { FloatingSheet, useFloatingSheet } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/floating-sheet.json{% endcommand %}

Adds `@/components/ui/floating-sheet.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx lineNumbers="false"
import {
  FloatingSheet, useFloatingSheet,
} from '@/components/ui/floating-sheet'
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
| Card | `appearance="sheet"` with a `gutter`: an opaque `--bl-card` surface with a soft shadow. |
| Docked sheet | `appearance="sheet"` with `gutter={0}`: edge to edge with square bottom corners, like a system sheet. |
| Open | `defaultOpen` or a controlled `open`: the cap meets the top of the host and the host dims behind it. |

The tone follows the nearest `AppearanceProvider`, so these examples switch with the docs' light/dark toggle. Pass `tone="light"` or `tone="dark"` when the surface must disagree with the page (a light sheet over a light map inside a dark app).

{% demo src="floating-sheet/appearances" %}

## Drag behavior

- **The cap is the handle.** Dragging it moves the surface one-to-one with the pointer; there is no second card fading in.
- **Release keeps its momentum.** The pointer's velocity is projected forward: a flick goes to the next stop in the direction it was thrown, a slow drag settles at the nearest stop, and a spring carries the surface there *from the finger's speed* (grab it mid-flight and it stops under your finger). Each change of state ticks `Haptics.selection()`.
- **Detents.** `detents={[0.5]}` adds resting heights between the peek and full (fractions of the grown body).
- **Tap toggles.** A plain tap on the cap (under 4px of travel) opens or closes it. `Escape` and the scrim close it.
- **Drag below rest to minimize.** With `minimizable` (the default), dragging below the resting height first closes the peek, then folds the surface into a round FAB at `fabPosition`. Tapping the FAB restores the resting sheet.
- **Scroll hides it.** While resting, `hideOnScroll` slides it away when the shared BL UI chrome hides (the same signal `TabBar` follows) or when `scrollRef`'s scroller moves down.

`useFloatingSheet()` reads the live state from inside the sheet — this example drives the same sheet from its own foot and prints the context while you drag:

{% demo src="floating-sheet/drag-snap-minimize" %}

With a half-height detent — drag slowly to settle at the nearest stop, flick to go to the next:

{% demo src="floating-sheet/detents" %}

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
| `peek` | `number` | `0` | Body height visible above the foot while resting. Capped at three quarters of the host. |
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

## Hook and styling

`useFloatingSheet()` returns `{ open, setOpen, progress, peek, minimized, setMinimized }` — `progress` runs from 0 at rest to 1 fully grown, and updates on every drag frame.

The root carries `data-slot="floating-sheet"` with `data-appearance`, `data-tone`, `data-body-align`, `data-open`, `data-expanded`, `data-dragging`, and `data-minimized`; the surface adds `data-peeking`, `data-hidden`, and `data-fab-position`. Geometry is written to `--ck-sheet-*` custom properties (`--ck-sheet-height`, `--ck-sheet-reveal`, `--ck-sheet-radius`, `--ck-sheet-grown`, …), so hosts restyle it with plain CSS.

## Accessibility

The cap is a real button with `aria-expanded` and `aria-controls` pointing at the body region, so keyboard users toggle the sheet with Enter or Space. The body is `inert` and `aria-hidden` while fully collapsed, the scrim is focusable only while the sheet is open, and `Escape` closes it.

## Built on it

- `FloatingChat` — a `FloatingSheet` whose body is a transcript (`bodyAlign="end"`) and whose foot is a composer.
- [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container) — floats a `FloatingChat` over the artifact below its breakpoint. Its **Delivery tracking** example is a docked `FloatingSheet` over a map.
