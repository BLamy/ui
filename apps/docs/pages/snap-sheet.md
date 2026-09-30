# SnapSheet

A bottom sheet you drag between snap points, like the Maps or Find My sheet: a handle on top, a panel that follows the finger one-to-one, and on release a spring that settles on the nearest snap point or, pulled far enough down, closes. The release reads the finger's velocity, so a flick carries its momentum. The scrim behind it fades with the panel.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/snap-sheet.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { SnapSheet } from '@/components/ui/snap-sheet'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { SnapSheet } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

It is a positioned layer, not a dialog: it fills the nearest positioned ancestor and is sized from that ancestor's height. For a responsive dialog that becomes a tray on phones use [Credenza](https://blamy.github.io/ui/#/credenza); for a surface that stays open and lets the page behind it keep working use [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet); for panels that slide in from a side, [EdgeDrawer](https://blamy.github.io/ui/#/edge-drawer).

## Usage

Render it inside a `relative` (or `fixed`) container. `open` controls whether it is shown, and `onClose` is called when the user dismisses it (scrim press, or dragging it down) — set `open` to `false` there. Whatever you put inside fills the panel below the handle as a flex column, so a header plus a `min-h-0 flex-1 overflow-y-auto` list makes a sheet with its own scrolling.

{% demo src="snap-sheet/basic" %}

```tsx
<div className="relative h-dvh">
  <Map />
  <SnapSheet open={open} onClose={() => setOpen(false)} snaps={[0.4, 0.7, 0.95]}>
    <Header />
    <div className="min-h-0 flex-1 overflow-y-auto">…</div>
  </SnapSheet>
</div>
```

## Snap points

`snaps` are fractions of the container's height, each between 0 and 1; the default is `[0.55, 0.94]`. The panel's height is the largest snap, and it rises to the **first** snap in the array when it opens, so list the one you want it to open at first (the array need not be sorted). Dragging above the largest snap rubber-bands.

When the finger lifts, the release position is projected 200ms ahead along its velocity and the sheet springs to whichever snap is closest to that point. It closes instead if the projection is closer to the closed position than to any snap, or lands more than 12% of the container's height below the lowest snap. The close spring keeps the flick's velocity, and the panel unmounts once it has left.

## Accessibility and keyboard

Read this before shipping: `SnapSheet` is drag-first and has no built-in dialog behavior. It does not set `role="dialog"` or `aria-modal`, does not move or trap focus, and does not close on Escape; the scrim is a plain element, not a button. The handle responds only to pointer input, so there is no keyboard way to change the snap point. What you need to add:

- a real close control inside the sheet (a "Done" button, as in the demo) — it is the keyboard and screen-reader way out;
- `role="dialog"` or `role="region"` with an `aria-label` on your content if it is a dialog, and focus management (move focus in on open, return it on close) if it is modal;
- an Escape handler, if you want one, that calls your `setOpen(false)`.

Under `prefers-reduced-motion` the spring is replaced by an immediate jump.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `open` | — | Shown when `true`. On `false` the panel springs out, then unmounts. |
| `onClose` | — | Called on scrim press and when a release dismisses the sheet. You must set `open` to `false`; the panel has already started springing off-screen when this fires, and if `open` stays `true` it stays parked out of view. |
| `snaps` | `[0.55, 0.94]` | Resting heights as fractions of the container; the first is where it opens. |
| `children` | — | Content of the panel, in a flex column below the handle. |
| `className` | — | Merged last onto the panel (for example `bg-background` instead of the default `bg-card`). |
| `style` | — | Styles for the panel. |

The component does not report which snap is current (there is no `onSnap`), and only the handle starts a drag; the content is yours.

## Styling

Slots: `data-slot="snap-sheet"` (the positioned layer, `absolute inset-0 z-70`), `snap-sheet-scrim` (black at 45% at full height, following the panel), `snap-sheet-panel` (rounded top corners, hairline border, shadow) and `snap-sheet-handle` (the drag target, 5px by 38px grabber). The panel's height is `--sheet-h`, the largest snap as a percentage, and its offset is a spring-driven motion value, so don't animate `transform` on it yourself.
