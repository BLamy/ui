# Sidebar

One compositional API over every sidebar behavior — a **higher-level primitive than shadcn's sidebar**: the same children render as any variant, and every variant knows how to become a hamburger overlay on its own.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/sidebar.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Sidebar, SidebarProvider, SidebarHeader, SidebarContent,
} from '@/components/ui/sidebar'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Sidebar, SidebarProvider, SidebarHeader, SidebarContent,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

```tsx
import {
  SidebarProvider, Sidebar, SidebarTrigger, SidebarInset,
} from '@brett_lamy/ui'
```

{% demo src="sidebar/variant-playground" %}

## Examples

### Docked with a footer

A CRM: workspace in the header, search, grouped items with a badge, and the signed-in account in `Sidebar.Footer`. Any `ReactNode` works as an item icon.

{% demo src="sidebar/crm-docked" %}

### Collapsible icon rail

`variant="rail"` with `defaultOpen={false}` starts as icons with tooltips. The trigger expands it to full width without moving the content under it.

{% demo src="sidebar/editor-rail" %}

### Floating card

`variant="float"` insets the sidebar as a rounded card, which suits documentation and settings.

{% demo src="sidebar/docs-float" %}

### Narrow container

Below `breakpoint` every variant becomes an overlay drawer behind the hamburger: UI SDK's Drawer, contained in the provider, so Escape, a press on the scrim and a swipe toward its edge close it (it comes from the start: the left, or the right under `dir="rtl"`), and focus stays inside while it is open. The breakpoint is measured on the provider's own width (its size class), so this happens inside a 380px pane on a wide screen too, and a new `breakpoint` is measured against at once. The sidebar's children stay mounted when it switches: a filter field keeps what was typed.

{% demo src="sidebar/mobile-menu" %}

## The three layers

1. `<SidebarProvider defaultOpen breakpoint>` — owns open state (`open` / `defaultOpen` / `onOpenChange(open, details)`, or a `controller` from `createSidebarController()`) and measures its **own** width with the kit's size classes (`data-size-class` on its element, `compact` below `breakpoint`; it is also the size-class scope of what it renders), not the viewport, so it works inside any panel.
2. `<Sidebar variant width railWidth>` — renders its children in the chosen behavior.
3. `<SidebarTrigger>` + `<SidebarInset>` — the hamburger (toggles whatever is mounted, with `aria-expanded` and `aria-controls` naming the panel, `data-slot="sidebar-panel"`) and the main column.

`onOpenChange` hears every change with its reason: `trigger-press`, the overlay's `escape-key`, `outside-press` and `swipe`, `content-resize` when the provider crosses its breakpoint (closed when compact, back to `defaultOpen` when not; its first measurement is where it starts, not a change, so an uncontrolled sidebar mounted compact starts closed and a controlled parent hears nothing at mount), or `imperative` from `useSidebar().setOpen` and the controller. `details.cancel()` refuses it.

## Variants

| Variant | Open | Closed | Below breakpoint |
| --- | --- | --- | --- |
| `docked` | Fixed column | Slides away | Overlay drawer |
| `rail` | Fixed column | Icon rail (labels hide) | Overlay drawer |
| `float` | Inset floating card | Slides away | Overlay drawer |
| `overlay` | Drawer + scrim | Hidden | Overlay drawer |

## Slots & parts

| Part | Role |
| --- | --- |
| `Sidebar.Header / .Content / .Footer` | Layout slots — Content scrolls |
| `Sidebar.Workspace name detail` | Identity block; avatar-only when collapsed |
| `Sidebar.Search placeholder onClick` | Quick-search button (`data-sidebar-search`); icon-only when collapsed. `onClick(event, details)` is UI SDK Button's |
| `Sidebar.Section title` | Group label; divider when collapsed |
| `Sidebar.Item icon label badge active onClick` | Nav row (`data-sidebar-item`); icon-only + tooltip when collapsed (named by its label). `onClick(event, details)` is UI SDK Button's |

Every part reads collapsed state from context (`useSidebarCollapsed()` for your own) — compose any content and the rail variant still works. `SidebarNav` is a pre-composed example built from these parts.

## Built from

A `sidebar` primitive (`lib/sidebar-primitive.ts`, UI SDK's `definePrimitive`) holds the open state and binds the provider's size class (the kit's `bindSizeClass`, and the provider is the size-class scope of what it renders); the trigger is its button part. The overlay is UI SDK's Drawer over the provider, the same one [AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane) uses in its `drawer` presentation, and the items are UI SDK Buttons. Colours read the workbench `--wb-*` tokens with dark fallbacks, so it drops into a `WorkbenchShell` unchanged.
