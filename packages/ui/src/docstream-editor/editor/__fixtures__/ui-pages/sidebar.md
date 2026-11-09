# Sidebar

One compositional API over every sidebar behavior — a **higher-level primitive than shadcn's sidebar**: the same children render as any variant, and every variant knows how to become a hamburger overlay on its own.

{% tabs title="Installation" sync="install" %}
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
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/sidebar.json{% endcommand %}

Adds `@/components/ui/sidebar.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  Sidebar, SidebarProvider, SidebarHeader, SidebarContent,
} from '@/components/ui/sidebar'
```
{% endtab %}
{% endtabs %}

```tsx
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarInset } from '@brett_lamy/ui'
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

Below `breakpoint` every variant becomes an overlay drawer behind the hamburger. The breakpoint is measured on the provider's own width, so this happens inside a 380px pane on a wide screen too.

{% demo src="sidebar/mobile-menu" %}

## The three layers

1. `<SidebarProvider defaultOpen breakpoint>` — owns open state and watches **container** width (not the viewport), so it works inside any panel.
2. `<Sidebar variant width railWidth>` — renders its children in the chosen behavior.
3. `<SidebarTrigger>` + `<SidebarInset>` — the hamburger (toggles whatever is mounted) and the main column.

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
| `Sidebar.Search` | Quick-search field; icon-only when collapsed |
| `Sidebar.Section title` | Group label; divider when collapsed |
| `Sidebar.Item icon label badge active onPress` | Nav row; icon-only + tooltip when collapsed |

Every part reads collapsed state from context — compose any content and the rail variant still works. `SidebarNav` is a pre-composed example built from these parts.

## Built from

`SidebarProvider` measures itself with `useContainerWidth`, and the overlay variant is an [EdgeDrawer](https://blamy.github.io/ui/#/edge-drawer) — the same drawer the [templates](https://blamy.github.io/ui/#/artifact-chat-container) use. Colours read the workbench `--wb-*` tokens with dark fallbacks, so it drops into a `WorkbenchShell` unchanged.
