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

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { MorphGroup, Morph } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Render the element in whichever layout the state calls for, with the same `<Morph id>` in both places, inside a `<MorphGroup>`. When one unmounts as the other mounts, the element flies from the old frame to the new one — position, size and corner radius — on a spring. Nested `<Morph>`s (the artwork and title inside the player) fly to their own new places at the same time.

```tsx
import { MorphGroup, Morph, MorphPresence } from '@brett_lamy/ui'

<MorphGroup>
  <MorphPresence>
    {open ? (
      <Morph key="full" id="player" radius={0} dragToDismiss onDismiss={() => setOpen(false)}>
        <Morph id="art" radius={14} />
        <Morph id="controls" fade>…</Morph>
      </Morph>
    ) : (
      <Morph key="mini" id="player" radius={14} as="button" onClick={() => setOpen(true)}>
        <Morph id="art" radius={8} />
      </Morph>
    )}
  </MorphPresence>
</MorphGroup>
```

Tap the mini player; drag the full player down (or tap the grabber) to fold it back:

{% demo src="morph/mini-player" %}

## Details

- **Scope.** A `MorphGroup` scopes its ids (framer-motion `LayoutGroup`), so two players on one page never trade elements. It also sets the spring for everything inside (`spring="smooth"` by default; `tray` for sheets, or a custom `transition`).
- **Corners.** Pass `radius` rather than a `border-radius` class: it animates with the frame and stays round while the element scales.
- **Text.** Give text blocks `layout="position"` so they move to their new place without being stretched on the way.
- **Parts without a partner** — the full player's controls — take `fade` and sit inside `MorphPresence`, so they fade in and out while the shared parts morph.
- **Drag to dismiss.** `dragToDismiss` makes the element follow a downward drag (rubber-banded upward); releasing past `dismissDistance` (120px) or flicking down calls `onDismiss`, and the element morphs back from wherever the finger left it. Horizontal gestures (sliders, carousels) pass through; put vertically scrolling content in a sibling rather than inside the draggable element.
- **Reduced motion.** With `prefers-reduced-motion` the layouts swap at once and fading parts cross-fade briefly; dragging is off.
- `useMorphTransition()` returns the group's transition for your own `motion` elements that should move with the morph.

## Props

### MorphGroup

| Prop | Default | Effect |
| --- | --- | --- |
| `id` | unique | Scope for the ids inside. |
| `spring` | `smooth` | A [spring preset](https://blamy.github.io/ui/#/motion). |
| `transition` | — | A custom framer-motion transition (overrides `spring`). |

### Morph

| Prop | Default | Effect |
| --- | --- | --- |
| `id` | — | The shared identity, the same in both layouts. |
| `radius` | — | Corner radius in px for this layout. |
| `as` | `div` | `section`, `button`, `li`, `img`, `a`, … |
| `layout` | `true` | `position` to move without resizing (text), `size` to resize in place. |
| `dragToDismiss` / `onDismiss` / `dismissDistance` | off / — / 120 | Pull-down to dismiss. |
| `fade` | `false` | Fade in on mount and out on unmount (inside `MorphPresence`). |

Other DOM props (`className`, `style`, `onClick`, `role`, `aria-*`, `data-*`) pass through; the element carries `data-slot="morph"` and `data-morph-id`.
