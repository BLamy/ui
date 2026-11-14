# Layer hosts

UI SDK's popups show over the whole page, in the browser's top layer. When one element holds a whole app (a phone frame on a docs page, a window on a desktop, `BLProvider`'s root) its popups belong inside it. That is a **layer host**, and it is the one behavior our fork of UI SDK, [BLamy/ui-sdk](https://github.com/BLamy/ui-sdk), adds: it changes how core's popups, layers, positioning, modality and shortcuts work, so it can't be built outside core the way [the kit's other behaviors](https://blamy.github.io/ui/#/behaviors-kit) are. It is `@experimental`, documented in the fork's own docs under "Keep Popups Inside an Element" (`core/behaviors/popups.mdx`), and proposed upstream on [Built on UI SDK](https://blamy.github.io/ui/#/ui-sdk).

There is nothing to import. An element is a layer host while it has the `data-layer-host` attribute:

```tsx
<div
  ref={setHost}
  data-layer-host=""                  // in the markup, not added from an effect
  className="[contain:layout] overflow-clip"
>
  <Dialog container={host}>…</Dialog>
</div>
```

## Already done for you

`BLProvider`'s root, a contained `Sheet`'s host (`data-slot="sheet-host"`, from `<Sheet contained>`) and `FloatingSheet`'s root are layer hosts, and every kit popup renders into the nearest `BLProvider` root (`useLayerHost()` returns it). So a dialog in a framed app covers the frame, not the page, as long as the frame is a `BLProvider`. A popup of UI SDK's that you render yourself: pass `container={useLayerHost()}`.

## What a host does

Core looks for the nearest ancestor with the attribute (across shadow roots) each time a popup shows, starting from the popup's top-layer element: its content, or a sheet's or drawer's viewport. A popup inside a host:

- **Stays out of the top layer.** No `popover` attribute and no `showPopover()`: content and backdrop get an inline `z-index: 2147483000`, and the host's `contain: layout` makes it a stacking context, so they stack only above the host's own content. Content that was shown in the top layer once (a `keepMounted` popup, a Tooltip) has the stale `popover` attribute removed when it shows in a host, so the browser's `[popover]:not(:popover-open)` rule can't hide it.
- **Is placed against the host.** Anchored popups (Popover, Menu, Select, Combobox, Tooltip, Hover Card) flip and shift against the host's padding box, cut down to the visible viewport and measured in screen pixels, so a host scaled with `transform: scale()` works too. `--available-width`, `--available-height`, `data-side` and the other usual outputs are measured against it.
- **Fills the host when it is fixed.** `contain: layout` makes the host the containing block of `position: fixed`, so a centered dialog (`fixed inset-0 m-auto`), a backdrop (`fixed inset-0`), and a sheet's or drawer's viewport fill the host, and snap points measure it.
- **Is modal to the host.** Only the rest of the host turns inert. The page outside stays usable and keeps its scroll (no scroll lock, no `--scrollbar-width`). Tab trapping works as before.
- **Hears presses, focus and Escape from its host.** From outside the host, a modal layer in it, and every layer beneath it in the same host, don't hear them: a press on the page reaches the page and closes neither a contained modal dialog nor a popover under it. A non-modal popover in a host with no modal above it still closes on a press or focus anywhere outside it. Escape with focus on `<body>` (the focused element was removed) goes to the topmost layer, contained or not.
- **Pauses only its host's shortcuts.** A contained modal pauses shortcuts whose layer is in the host, and page shortcuts while focus is in the host or on `<body>`. With focus on the page outside, page shortcuts keep running.
- **Has its own modal stack.** Popups opened from a contained popup nest and close in order, and two hosts can each have a modal dialog open; Escape goes to the host that has focus.

Each frame below is a host. Open both dialogs: each makes only its own frame inert, and the page around them stays usable.

{% demo src="behaviors-layer-hosts/contained-dialog" %}

## What a host needs from you

- **The attribute in the markup.** React writes attributes when it creates the element, before any child's ref binds, so a popup that is open from the first render already sees the host. Written from an effect or a callback ref, children bind first and that popup goes to the top layer.
- **`contain: layout`** on the host (`[contain:layout]`). Core writes no style for it. Without it, anchored popups still keep to the host's box, but fixed parts (a centered dialog, a backdrop, a sheet's viewport) are placed against the viewport instead of filling the host.
- **A definite size and `overflow: clip`** (so a sheet's slide-in and shadows stay inside), with the app's content scrolling in a child, not the host itself.
- **A Backdrop part for a dim** (`DialogBackdrop`, `AlertDialogBackdrop`, `DrawerBackdrop`, `fixed inset-0`), because there is no `::backdrop` outside the top layer.
- **The host as `container`**, recommended. Without it a popup renders in place inside the host and is contained anyway; `container={host}` makes it the host's direct child, which avoids clipping and transformed ancestors (a `transform`, `filter` or `contain` between the popup and the host becomes the fixed parts' containing block instead), and is the only option in browsers without the top layer, where a popup with no container is portaled to `document.body`, outside the host. Popups opened inside it inherit the container.

## `bindLayer` in a host, and `when`

UI SDK's public `bindLayer(el, { onDismiss, contains?, modal?, topLayer?, closeOnBlur? })` puts any element of yours in the layer stack its popups share. Inside a host it keeps to the host too: it stays out of the top layer even with `topLayer: true` (and gets no z-index from core, so set your own), and a `modal: true` one hears presses and Escape from inside its host only.

The fork also gives it `when?: () => boolean` (named after `registerShortcut`'s `when`), read on every press and key: while it returns `false` the layer is skipped, so Escape goes on to the layer beneath (and isn't `preventDefault()`ed), outside presses pass it by, and window blur doesn't reach it. That is what lets [the kit's page stack](https://blamy.github.io/ui/#/behaviors-kit) live outside UI SDK: it binds a layer on a detached element, live only while it can pop.

```ts
bindLayer(marker, { when: () => stack.pops(), onDismiss: () => stack.pop({ reason: 'escape-key' }) })
```

## Known limits

- A sheet presented from a Popover, Menu, Select or Combobox in a host has no dim: its dim is the top layer's `::backdrop`, and those components have no Backdrop part. Presses outside the sheet still dismiss it.
- On Android, the popups' `CloseWatcher` back gesture still closes the topmost contained modal when focus is on the page outside its host.
- The fork's browser spec (`tests/specs/layer-host.spec.ts`, 9 tests) runs on Chromium with the React fixture only; the 25 jsdom tests in `packages/core/test/layer-host.test.ts` cover dialogs, drawers, positioned popups, two hosts and `when`.
