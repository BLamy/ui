# AdaptivePane

One region, four presentations. A shell measures itself and picks a presentation; the pane renders the same children as a docked column, an edge drawer, a cover over the host, or nothing, and they stay mounted through every switch (fields, scroll subscriptions and selection carry over). It is the building block behind the navigation of [ChatShell](https://blamy.github.io/ui/#/chat-shell) and the sidebar and surface panel of [WorkbenchShell](https://blamy.github.io/ui/#/workbench-shell), the shells that ship in the `discord-clone` and `t3-clone` [blocks](https://blamy.github.io/ui/#/blocks).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/adaptive-pane.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { AdaptivePane } from '@/components/ui/adaptive-pane'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { AdaptivePane } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

```tsx
import { AdaptivePane } from '@/components/ui/adaptive-pane'
import { useContainerWidth } from '@/lib/container'

function Shell({ nav, children }) {
  const [ref, width] = useContainerWidth()
  const [open, setOpen] = useState(false)
  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'flex', height: '100%' }}
    >
      <AdaptivePane
        presentation={width < 760 ? 'drawer' : 'column'}
        open={open}
        onOpenChange={setOpen}
        columnWidth={240}
        drawerWidth={280}
      >
        {nav}
      </AdaptivePane>
      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  )
}
```

## Presentations

| `presentation` | Renders |
| --- | --- |
| `column` | A fixed-width flex or grid child beside its siblings (`columnWidth`, `columnClassName`, `columnStyle`). |
| `drawer` | UI SDK's Drawer from `side` over the positioned host (`open` / `defaultOpen` / `onOpenChange(open, details)`, `drawerWidth`, `drawerMaxWidth`, `zIndex`, `backdropClassName`, `scrim`, `shadow`, `swipe`, `aria-label`, `className`, `style`). Escape, a press on the scrim and a swipe toward its edge close it (`details.reason` is `escape-key`, `outside-press` or `swipe`), and focus stays inside while it is open. |
| `cover` | Fills the positioned host at `zIndex` — full-screen panels and compact pages. |
| `hidden` | Nothing on screen; the children stay mounted, off the page. |

`side` is the host's edge the pane belongs to: UI SDK's logical `start` (the default) or `end`, which follow the reading direction (so under `dir="rtl"` a `start` drawer comes from the right, and its separator and swipe strip move with it), or a physical `left` or `right`.

## Resizing and gestures

`resizable` puts a separator on the inner edge of a `column` or a `drawer` (UI SDK's `createResize`): drag it, or focus it and use the arrow keys (16px, Shift for 48px), Home and End; Enter or a double-click returns to the host's width. The separator is one tab stop with `aria-valuenow`, `aria-valuemin` and `aria-valuemax` (the window-splitter pattern); while it drags, the pane has `data-dragging` and only its `--adaptive-pane-w` variable changes, so the content doesn't re-render. `minWidth` (default 160) and `maxWidth` (px) bound it, and a column never takes the last 240px of its host (a drawer, the last 48px). The widths are kept per presentation in `widths` / `defaultWidths`, and `onWidthsChange(widths, details)` reports each settled change (a drag on release, every key) with `details.reason` `drag`, `resize-key` or `size-reset`; an unset width means the host's applies.

A drawer is UI SDK's Drawer: dragging its panel toward its edge follows the finger and closes it past a distance or on a flick (`reason: 'swipe'`). `swipe={false}` turns only that off: the panel no longer follows a drag (UI SDK's `data-drawer-no-drag` on it), while Escape and the scrim still close it. `swipeToOpen` adds a thin strip along the host's edge that opens a closed drawer with a swipe (`bindEdgeSwipe` on the host, `reason: 'swipe'`): it opens past a third of the host's width, or sooner with a flick, so a short nudge in the strip does nothing. That strip sits where a NavigationStack's back swipe starts, so use it on the side a stack in the host doesn't.

## Container utilities

The shells share two more primitives, in `@/lib/container` (`@brett_lamy/ui` on npm):

| Export | Role |
| --- | --- |
| `useContainerWidth(initial?)` | Returns `[ref, width]`; a ResizeObserver keeps `width` in sync with the element, not the viewport. |
| `useContainerSize(initial?)` | The same with both axes: returns `[ref, { width, height }]` (for positioning things against the box, like a mini player above a tab bar). |
| `defineSlot(name)` / `collectSlots(children)` | Marker components for compound slots (`Shell.Main`) and the reader that maps them to their children. |

## Live example

Pick a presentation, or open a second pane as a right drawer:

{% demo src="adaptive-pane/pane-modes" %}

## Examples

### Mail shell

`column` when the host is wide, `drawer` when it is narrow, and a menu button only in the compact layout. Switch widths in the header.

{% demo src="adaptive-pane/mail-shell" %}

### List and detail

The detail is a trailing column when there is room and covers the list when there is not. Closing the detail on a phone switches the pane to `hidden`.

{% demo src="adaptive-pane/team-directory" %}

### Reader outline

The presentation doesn't have to come from the width. Here the reader chooses: docked outline, a drawer, or hidden for focus.

{% demo src="adaptive-pane/reader-outline" %}
