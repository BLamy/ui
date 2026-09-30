# AdaptivePane

One region, four presentations. A shell measures itself and picks a mode; the pane renders the same children as a docked column, an [EdgeDrawer](https://blamy.github.io/ui/#/edge-drawer), a cover over the host, or nothing. It is the building block behind the navigation of [ChatShell](https://blamy.github.io/ui/#/chat-shell) and the sidebar and surface panel of [WorkbenchShell](https://blamy.github.io/ui/#/workbench-shell), the shells that ship in the `discord-clone` and `t3-clone` [blocks](https://blamy.github.io/ui/#/blocks).

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
        mode={width < 760 ? 'drawer' : 'column'}
        open={open}
        onClose={() => setOpen(false)}
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

## Modes

| Mode | Renders |
| --- | --- |
| `column` | A fixed-width flex child beside its siblings (`columnWidth`, `columnStyle`). |
| `drawer` | An `EdgeDrawer` over the host (`open`, `onClose`, `drawerWidth`, and every EdgeDrawer prop). |
| `cover` | Fills the positioned host at `zIndex` — full-screen panels and compact pages. |
| `hidden` | Nothing. |

## Container utilities

The shells share two more primitives, in `@/lib/container` (`@brett_lamy/ui` on npm):

| Export | Role |
| --- | --- |
| `useContainerWidth(initial?)` | Returns `[ref, width]`; a ResizeObserver keeps `width` in sync with the element, not the viewport. |
| `useContainerSize(initial?)` | The same with both axes: returns `[ref, { width, height }]` (for positioning things against the box, like a mini player above a tab bar). |
| `defineSlot(name)` / `collectSlots(children)` | Marker components for compound slots (`Shell.Main`) and the reader that maps them to their children. |

## Live example

Pick a mode, or open a bare EdgeDrawer:

{% demo src="adaptive-pane/pane-modes" %}

## Examples

### Mail shell

`column` when the host is wide, `drawer` when it is narrow, and a menu button only in the compact layout. Switch widths in the header.

{% demo src="adaptive-pane/mail-shell" %}

### List and detail

The detail is a trailing column when there is room and covers the list when there is not. Closing the detail on a phone switches the pane to `hidden`.

{% demo src="adaptive-pane/team-directory" %}

### Reader outline

The mode doesn't have to come from the width. Here the reader chooses: docked outline, a drawer, or hidden for focus.

{% demo src="adaptive-pane/reader-outline" %}
