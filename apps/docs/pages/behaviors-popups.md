# Popups and layers

Every floating thing in BL UI (Popover, Tooltip, HoverCard, DropdownMenu (and its context menus), Select, Combobox, Dialog, Sheet, CommandMenu) is a UI SDK popup: one engine for opening and closing, placing beside a trigger, Escape and outside presses, focus moving in and back, modality, nesting, and presenting as a sheet. The same engine is in `@ui-sdk/core` for a popup of your own: `createPopup` with a **preset** and the popup slot helpers. Below it are the pieces it is made of, which you can use alone: `position` places an element beside an anchor, and `bindLayer` puts an element in the dismissal stack. The upstream reference is [Popups](https://ui-sdk.dev/docs/core/behaviors/popups).

```ts
import {
  createPopup, popupState, popupTrigger, popupContent, popupTitle, popupDescription, popupClose, popupArrow, popupBackdrop,
  position, bindLayer, bindPersistentLayer, isDismissal, supportsTopLayer,
} from '@ui-sdk/core'
import { popoverPreset } from '@ui-sdk/core/popover'
```

## Already done for you

Reach for these only when no kit component has the shape you need. A styled kit popup is usually closer than you think: `Popover` takes any content, `openOnHover`, `modal`, `presentation="auto"` and a controller, and `PopoverContent`'s `variant="plain"` is the bare floating surface.

| You want | Use |
| --- | --- |
| Interactive content beside a trigger | [Popover](https://blamy.github.io/ui/#/popover) |
| A label on hover or focus | [Tooltip](https://blamy.github.io/ui/#/tooltip) |
| A preview on hover | [Hover Card](https://blamy.github.io/ui/#/hover-card) |
| A modal task | [Dialog](https://blamy.github.io/ui/#/dialog) (a sheet or tray in a compact container), [Sheet](https://blamy.github.io/ui/#/sheet) |
| Open from code and wait for a result | The component's controller: `createPopoverController`, `createDialogController`… (`await controller.open({ anchor, payload })` resolves when it closes, with `reason` and an optional `returnValue`) |

## A popup of your own

A primitive becomes a popup by spreading `popupState(options)` into its state, returning `createPopup(context, { preset })` from its `api`, and building its parts with the slot helpers. The preset is the behavior: here the popover's (non-modal, placed beside its trigger, closed by Escape or an outside press). The helpers give each part its role and ARIA: the trigger's `aria-expanded` and `aria-controls`, the content's `role="dialog"` named by the title, the close button.

{% demo src="behaviors-popups/invite-popover" %}

```ts
const invite = definePrimitive({
  name: 'invite',
  options: { open: 'boolean', defaultOpen: 'boolean', onOpenChange: 'callback' },
  state: (options: InviteOptions) => popupState(options),
  sync: (options) => (options.open === undefined ? {} : { open: options.open }),
  api: (context) => createPopup(context, { preset: popoverPreset }),
  slots: (slot) => ({
    trigger: popupTrigger(slot),
    content: popupContent(slot),
    title: popupTitle(slot),
    description: popupDescription(slot),
    close: popupClose(slot),
  }),
  agent: { actions: ['open', 'close'] },
})
```

The content part takes the placement props (`side`, `align`, `sideOffset`, `alignOffset`, `collisionPadding`), writes `data-side`/`data-align` and the `--available-height`, `--anchor-width` and `--transform-origin` variables, and gets `data-starting-style` and `data-ending-style` for its entrance and exit. That is why the demo can reuse the kit's own floating surface and motion classes (`popoverSurface` and `popoverMotion` from `@/lib/primitives`) unchanged. `onOpenChange(open, details)` hears every reason: `trigger-press`, `trigger-hover`, `trigger-focus`, `escape-key`, `outside-press`, `focus-out`, `window-blur`, `close-press` and `imperative`.

Verified in happy-dom with UI SDK's strict mode on: pressing Invite opens it with `trigger-press` and moves focus to the link field; the content is named "Invite people" by its title; Escape closes it with `escape-key` and puts focus back on Invite.

### Pick its behavior

Change the preset to change the interaction. Each follows its WAI-ARIA pattern, and the kit's components use the same ones, so a popup of yours behaves like theirs:

| Preset | Import from | For |
| --- | --- | --- |
| `popoverPreset` | `@ui-sdk/core/popover` | Interactive content beside a trigger |
| `dialogPreset` | `@ui-sdk/core/dialog` | A modal task that holds focus (the page, or the layer host, turns inert) |
| `tooltipPreset` | `@ui-sdk/core/tooltip` | A short label on hover or focus |
| `hoverCardPreset` | `@ui-sdk/core/hover-card` | A preview on hover or focus |

`createPopup` also reads `modal`, `presentation`, `openOnHover`, `delay`, `closeDelay`, `disabled`, `dismissible` and `onDismissAttempt` from the primitive's options when you declare them. `popupArrow`, `popupBackdrop` and `popupViewport` (the full-screen element a sheet sits in) complete the set; `popupSlots(slot)` builds them all at once.

## Placing an element

`position(anchor, element, options)` places an element beside an anchor, follows it as things move, and flips and shifts it when there isn't room. It doesn't open or dismiss anything. The anchor can be an element, a point `{ x, y }`, or anything with `getBoundingClientRect` (a text selection's range, so a toolbar can follow a selection); pass a getter to let it change while the element stays mounted. In a primitive, return the cleanup from the slot's `bind`:

```ts
bubble: slot({
  present: (state) => state.open,
  bind: (el, { api }) => position(() => api.anchor(), el, { side: 'top', align: 'center', sideOffset: 8 }),
}),
```

It writes the same `data-side`, `data-align`, `--available-width`, `--available-height` and `--transform-origin` as the kit's popups, so the same classes style it. The cleanup has a `place()` method to measure again at once.

## Layers of your own

`bindLayer(el, options)` registers an element in the same stack as UI SDK's popups: Escape goes to the topmost layer, an outside press dismisses it, and a popup opened inside it (a menu in your panel) counts as inside, so using it keeps your panel open. Use it for a floating shape that is not a popover: a ring of actions, a toolbar over a selection.

```ts
panel: slot({
  present: (state) => state.open,
  bind: (el, { api }) =>
    bindLayer(el, {
      topLayer: true,                                          // above clipping ancestors, where supported
      contains: (target) => !!api.trigger()?.contains(target), // a press on the trigger is not "outside"
      onDismiss: (reason) => api.close(reason),
    }),
}),
```

You still own the layer's state, role, focus and placement (compose it with `position`, and `keepFocus` to hand focus back to the trigger). `modal: true` stops an outside press from reaching the page beneath and `closeOnBlur` closes it when the window loses focus; for modal focus handling and an inert page, use `dialogPreset` instead. `isDismissal(reason)` tells a dismissal (Escape, an outside press) from a choice made inside your UI.

`bindPersistentLayer(el)` is the opposite: an element that stays usable while modal popups are open, and whose presses don't dismiss other layers. UI SDK's toast region and a media player bar are the uses.

## Inside an app's frame

A popup rendered inside a **layer host** stays inside it: placed against the host's box, out of the browser's top layer, and modal only to the host. `BLProvider`'s root is a layer host, and every kit popup passes it as `container` (`useLayerHost()` from `@/lib/theme` returns it), so a dialog in a framed app covers the frame, not the page. Two consequences for your own popups:

- Pass `container={useLayerHost()}` to a UI SDK popup you render directly, as the kit's wrappers do, so it renders as the host's child and no transformed or clipping ancestor gets in the way.
- There is no `::backdrop` inside a host. Render the Backdrop part (`DialogBackdrop`, `DrawerBackdrop`) as `fixed inset-0` for a dim, not `backdrop:` utilities.

An element is a layer host while it renders `data-layer-host` in its markup and has `contain: layout`. That is the one behavior our fork of UI SDK adds (with `bindLayer`'s `when` option); its contract is on [Layer hosts](https://blamy.github.io/ui/#/behaviors-layer-hosts).
