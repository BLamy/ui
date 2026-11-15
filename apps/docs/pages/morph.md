# Morph

A shared-element transition: one element that springs between two layouts. The mini player that becomes Now Playing, the thumbnail that becomes the hero, the card that becomes a sheet — [continuity](https://blamy.github.io/ui/#/motion) says the thing you tapped should be the thing that grows, not a second copy cross-fading in over the first.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/morph.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { MorphGroup, Morph } from '@/components/ui/morph'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { MorphGroup, Morph } from '@brett_lamy/ui/morph'
```
{% endtab %}
{% endtabs %}

## Usage

Render the element in whichever layout the state calls for, with the same `<Morph layoutId>` in both places, inside a `<MorphGroup>`. When one unmounts as the other mounts, the element flies from the old frame to the new one — position, size and corner radius — on a spring. Nested `<Morph>`s (the artwork and title inside the player) fly to their own new places at the same time.

```tsx
import { MorphGroup, Morph, MorphPresence } from '@brett_lamy/ui'

<MorphGroup>
  <MorphPresence>
    {open ? (
      <Morph key="full" layoutId="player" radius={0} dragToDismiss onDismiss={() => setOpen(false)}>
        <Morph layoutId="art" radius={14} />
        <Morph layoutId="controls" fade>…</Morph>
      </Morph>
    ) : (
      <Morph key="mini" layoutId="player" radius={14} render={<button type="button" />} onClick={() => setOpen(true)}>
        <Morph layoutId="art" radius={8} />
      </Morph>
    )}
  </MorphPresence>
</MorphGroup>
```

## Morph into a dialog

When the expanded layout is modal (a full player, a detail sheet), make it a Dialog's content and let `Morph` be the element it renders: `<DialogContent render={<Morph layoutId="player" … />}>`. The Dialog moves focus in, closes on Escape and returns focus to the mini player (`finalFocus`); `Morph` adds the morph and drag-to-dismiss. Don't hand-roll `role="dialog"` on a `Morph`: it would have no focus management.

```tsx
<MorphGroup>
  <MorphPresence>
    {open ? null : <Morph key="mini" ref={bar} layoutId="player" render={<button type="button" />} onClick={() => setOpen(true)}>…</Morph>}
  </MorphPresence>
  <Dialog open={open} onOpenChange={setOpen} presentation="dialog">
    <DialogContent render={<Morph layoutId="player" radius={22} dragToDismiss onDismiss={() => setOpen(false)} />} finalFocus={() => bar.current}>
      <DialogTitle className="sr-only">Now Playing</DialogTitle>
      …
    </DialogContent>
  </Dialog>
</MorphGroup>
```

Tap the mini player; drag the full player down, press Escape or tap the grabber to fold it back:

{% demo src="morph/mini-player" %}

## Details

- **Scope.** A `MorphGroup` scopes its `layoutId`s (framer-motion `LayoutGroup`), so two players on one page never trade elements. It also sets the spring for everything inside (`spring="smooth"` by default; `tray` for sheets, or a custom `transition`).
- **Corners.** Pass `radius` rather than a `border-radius` class: it animates with the frame and stays round while the element scales.
- **Text.** Give text blocks `layout="position"` so they move to their new place without being stretched on the way.
- **Parts without a partner** — the full player's controls — take `fade` and sit inside `MorphPresence`, so they fade in and out while the shared parts morph.
- **Drag to dismiss.** `dragToDismiss` makes the element follow a downward drag (rubber-banded upward); releasing past `dismissDistance` (120px) or flicking down calls `onDismiss`, and the element morphs back from wherever the finger left it. The gesture is UI SDK's `bindDrag` (a press that barely moves stays a click, Escape is not needed: lift to release); the offset is the CSS `translate` property, so it never fights the morph's `transform`, and `data-dragging` is set while the finger is down. Horizontal gestures (sliders, carousels) pass through; put vertically scrolling content in a sibling rather than inside the draggable element.
- **Reduced motion.** With `prefers-reduced-motion` the layouts swap at once and fading parts cross-fade briefly; dragging is off.
- `useMorphTransition()` returns the group's transition for your own `motion` elements that should move with the morph.

## Props

### MorphGroup

| Prop | Default | Effect |
| --- | --- | --- |
| `id` | unique | Scope for the `layoutId`s inside. |
| `spring` | `smooth` | A [spring preset](https://blamy.github.io/ui/#/motion). |
| `transition` | — | A custom framer-motion transition (overrides `spring`). |

### Morph

| Prop | Default | Effect |
| --- | --- | --- |
| `layoutId` | — | The shared identity, the same in both layouts (framer-motion's name; `id` stays the DOM id). |
| `radius` | — | Corner radius in px for this layout. |
| `render` | a `div` | The element to render instead, as on UI SDK parts: `render={<button type="button" />}`, `render={<li />}`. Its type becomes the framer-motion element and its props sit under Morph's; `className`s merge. 6.0 replaced `as`. |
| `layout` | `true` | `position` to move without resizing (text), `size` to resize in place. |
| `dragToDismiss` / `onDismiss` / `dismissDistance` | off / — / 120 | Pull-down to dismiss: past the distance, or a downward flick (UI SDK's velocity tracker, over 0.65 px/ms). |
| `fade` | `false` | Fade in on mount and out on unmount (inside `MorphPresence`). |

Every other DOM prop (`id`, `className`, `style`, `onClick`, `onKeyDown`, `aria-*`, `data-*`, and `href`/`src`/`alt`/`type` for a rendered element that has them) and `ref` pass through; the element carries `data-slot="morph"` and `data-morph-id`.

### MorphPresence

| Prop | Default | Effect |
| --- | --- | --- |
| `mode` | `auto` | `auto` (`popLayout` when every child takes a ref, else `sync`), `sync`, `wait` or `popLayout` (framer-motion's `AnimatePresence` modes). |
| `children` | — | Conditionally rendered `Morph` content; parts without a partner fade out as the morph runs. |

### useMorphTransition

`useMorphTransition()` returns the group's transition (the spring, or `{ duration: 0 }` under reduced motion) for your own `motion` elements that should move with the morph.
