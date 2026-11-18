# Sidebar

An app's navigation column: the account or team at the top, a search, labelled sections of rows with icons, counts and the current page, and an account at the bottom. It shows as a docked column, as an icon rail that expands, or as a floating card, and it becomes a drawer behind a button when its container gets narrow. Use it for the main navigation of a web or desktop app shell.

Reach for a sibling instead when:

| You need | Use |
| --- | --- |
| Columns that become a push stack on a phone (Mail, Notes, Settings) | [SplitView](https://blamy.github.io/ui/#/split-view) |
| A push/pop stack of pages, also inside a SplitView column | [NavigationStack](https://blamy.github.io/ui/#/navigation-stack) |
| A side panel that is not navigation (an inspector, activity) | [AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane) |
| Dockable, user-arranged tabsets | [Workspace](https://blamy.github.io/ui/#/workspace) |
| A short list of grouped rows inside a page | [List](https://blamy.github.io/ui/#/lists) |

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/sidebar.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import {
  SidebarProvider, Sidebar, SidebarContent, SidebarSection,
  SidebarItem, SidebarTrigger, SidebarInset,
} from '@/components/ui/sidebar'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  SidebarProvider, Sidebar, SidebarContent, SidebarSection,
  SidebarItem, SidebarTrigger, SidebarInset,
} from '@brett_lamy/ui/sidebar'
```
{% endtab %}
{% endtabs %}

{% demo src="sidebar/variant-playground" %}

## Anatomy

```tsx
import {
  SidebarProvider, Sidebar, SidebarHeader, SidebarAccount, SidebarContent, SidebarSearch,
  SidebarSection, SidebarItem, SidebarFooter, SidebarInset, SidebarTrigger,
} from '@/components/ui/sidebar'

<SidebarProvider>                                  {/* open state; measures its own width */}
  <Sidebar variant="rail" presentation="auto">     {/* the look, and column or drawer */}
    <SidebarHeader>
      <SidebarAccount title="Northwind" description="Sales" />
    </SidebarHeader>
    <SidebarContent aria-label="Northwind">        {/* a nav landmark; scrolls */}
      <SidebarSearch shortcut="/" onClick={openSearch} />
      <SidebarSection title="Pipeline">           {/* role="group", named by its title */}
        <SidebarItem icon="tray" title="Inbox" trailing={6} current />
        <SidebarItem icon="calendar" title="Meetings" render={<a href="/meetings" />} />
      </SidebarSection>
    </SidebarContent>
    <SidebarFooter>
      <SidebarItem icon={<Avatar name="Ada Lovelace" size={20} />} title="Ada Lovelace" />
    </SidebarFooter>
  </Sidebar>
  <SidebarInset>
    <SidebarTrigger shortcut="mod+b" />
    …
  </SidebarInset>
</SidebarProvider>
```

## Docked, with a footer

A CRM: the team (`SidebarAccount`) in the header, a search with its `/` shortcut, two sections with a count, and the signed-in account in `SidebarFooter`. A row's `icon` is an [Icon](https://blamy.github.io/ui/#/icons) name or any node; a number or a string in `trailing` is drawn as a count badge, anything else as it is.

{% demo src="sidebar/crm-docked" %}

## Collapsible icon rail

`variant="rail"`: closed, it keeps a 52px column of the same rows cut to their icons (each row keeps its name, and a tooltip shows it on hover or focus), and section titles become hairlines. Open, it is a full column. The trigger, or its `shortcut`, switches between the two without moving the page under it. This one sits in a `workbench` theme scope, which gives it the Workbench palette; elsewhere it follows the surrounding theme.

{% demo src="sidebar/editor-rail" %}

## Floating card

`variant="float"` insets the sidebar as a rounded card with its own border, which suits documentation and settings. Rows are links here: `render={<a href="…" />}` renders a row as the element you pass, and `current` writes `aria-current="page"`.

{% demo src="sidebar/docs-float" %}

## Narrow containers: the drawer

`presentation="auto"` (the default) is a column while the provider is at least `breakpoints.medium` wide (640px by default, the same size classes as SplitView and every other scope) and a drawer while it is narrower (its size class is `compact`). That is AdaptivePane's `auto` rule (`resolveAdaptivePanePresentation`) with one difference, on purpose: in a medium scope a navigation sidebar stays a column, as an iPad's split view keeps its sidebar beside the content, where a pane of tools becomes a drawer. The drawer is [AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane)'s, a [Sheet](https://blamy.github.io/ui/#/sheet) contained in the provider: it comes from the start (the right under `dir="rtl"`), keeps focus inside while open, and Escape, a press on the scrim, a swipe toward its edge and a press on one of its rows close it. Rows grow to 44px for touch. The width is measured on the provider, never the viewport, so the same happens inside a 380px pane on a wide screen. The children are rendered once and only move between the column and the drawer: a filter field keeps what was typed.

`presentation="column"` keeps a column at every width; `presentation="drawer"` is always a drawer (an overlay sidebar over a full-width page).

{% demo src="sidebar/mobile-menu" %}

## Open state

`SidebarProvider` owns it: `open` / `defaultOpen` / `onOpenChange(open, details)`, or a `controller` from `createSidebarController()` for code outside it. `details.reason` says why: `trigger-press` and `shortcut` from the trigger, the drawer's `escape-key`, `outside-press`, `swipe` and `action` (a row was pressed in it), `content-resize` when the provider crosses its breakpoint (it closes when it becomes compact and goes back to `defaultOpen` when it grows; its first measurement is where it starts, not a change), or `imperative` from `useSidebar().setOpen` and the controller. `details.cancel()` refuses the change.

What closed means depends on the look: a `docked` or `float` column slides away toward the start, a `rail` collapses to its icons, a drawer hides. A press on a row in a drawer closes it after `onClick`, unless `onClick` calls `event.preventDefault()`.

## Accessibility

- `SidebarContent` is a `nav` landmark; name it with `aria-label` when the page has more than one. Each `SidebarSection` with a `title` is a `role="group"` named by it.
- Rows and the search are buttons (UI SDK's Button), or links through `render`. The current row has `aria-current="page"`. Every row is named by its `title`, also in a collapsed rail, where the shared tooltip shows it.
- `SidebarTrigger` has `aria-expanded` and `aria-controls` (the panel, `data-slot="sidebar-panel"`). A `shortcut` on the trigger or the search writes `aria-keyshortcuts`; the keycap is hidden from screen readers.
- A closed column is `inert`: its rows leave the tab order. The drawer is a named dialog (`aria-label` on `Sidebar`, default "Sidebar").
- Focus shows as a ring inside each row. In a compact provider rows and the trigger are 44px tall.

## Props

### SidebarProvider

| Prop | Default | Effect |
| --- | --- | --- |
| `open` / `defaultOpen` / `onOpenChange` | `true` (closed when it mounts compact) | Open state; `onOpenChange(open, details)`. |
| `breakpoints` | `{ medium: 640, regular: 1024 }` | Where the provider's own width changes size class, the same spelling and defaults as SplitView's: below `medium` it is `compact`. |
| `controller` | — | `createSidebarController()`: `isOpen`, `setOpen`, `toggle` from anywhere. |
| `className` / `style` / DOM props | — | The provider's box (`relative flex h-full`, `data-size-class`). |

### Sidebar

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `docked` | The look: `docked` column on a hairline, `rail` that collapses to its icons, `float` inset card. |
| `presentation` | `auto` | `column`, `drawer`, or `auto`: a drawer while the provider is compact. |
| `width` | `228` | Open width, px, of the column and the drawer (a drawer takes at most 85% of the provider). |
| `railWidth` | `52` | Width of a collapsed rail, px. |
| `aria-label` | `"Sidebar"` | The drawer's name. |
| `ref`, `id`, `data-*`… | — | Go on the sidebar's panel (`data-slot="sidebar-panel"`), the same element as a column and as a drawer, to measure it or find it in a test. |
| `className` / `style` | — | The column's box or the drawer's panel; a function gets `{ variant, presentation, open, collapsed }`. |

### Parts

| Part | Props | Notes |
| --- | --- | --- |
| `SidebarHeader` · `SidebarFooter` | `div` props | Don't scroll; the footer sits on a hairline. |
| `SidebarContent` | `nav` props | Scrolls. `aria-label` defaults to "Sidebar". |
| `SidebarAccount` | `title`, `description`, `icon` | Who or where this is (an account, a team, the app): a 28px tile (default: the title's first letter on the brand gradient), a name and a second line. The tile alone in a collapsed rail. In a compact provider it grows with the 44px rows under it (a 32px tile, a 15px name), so the drawer's heading is never smaller than its rows. |
| `SidebarSearch` | `placeholder` ("Search"), `shortcut`, UI SDK Button props | A button shaped like a search field that opens your search ([CommandMenu](https://blamy.github.io/ui/#/command-menu), a Dialog). `shortcut` presses it from anywhere and shows a keycap. |
| `SidebarSection` | `title`, `div` props | A labelled group; the title turns into a hairline in a collapsed rail. |
| `SidebarItem` | `icon`, `title`, `description`, `trailing`, `current`, `tint`, `disabled`, `render`, `onClick(event, details)` | A navigation row. `tint` is a CSS colour for an action row ("New task"). |
| `SidebarTrigger` | `shortcut`, button props | Toggles the sidebar in whichever presentation shows. Default icon `sidebar-left`, name "Toggle sidebar". |
| `SidebarInset` | `div` props | The main column beside the sidebar. |

The rows, sections, search and account also work outside a `Sidebar` (a shell's own side panel, such as [WorkbenchShell](https://blamy.github.io/ui/#/workbench-shell)'s), where there is no collapsed state to follow.

### Hooks

- `useSidebar()`: `{ open, setOpen, toggle, sizeClass }` of the nearest provider (it throws outside one).
- `useSidebarCollapsed()`: whether the sidebar around is a collapsed rail, for your own parts that hide their text (`false` outside a `Sidebar`).

## Built from

A `sidebar` primitive (`lib/sidebar-primitive.ts`, UI SDK's `definePrimitive`) holds the open state and measures the provider (`bindSizeClass`); the provider is the size-class scope of what it renders, popups included. The column and the drawer are [AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane)'s presentations, so the children stay mounted through a change. Rows are UI SDK Buttons sharing one [Tooltip](https://blamy.github.io/ui/#/tooltip) through a controller; counts are [Badge](https://blamy.github.io/ui/#/badge) `size="sm" variant="tinted"`; keycaps are [Kbd](https://blamy.github.io/ui/#/kbd); shortcuts go through UI SDK's shortcut manager; section titles use `sectionLabelVariants({ variant: 'sidebar' })` from `@/lib/primitives`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `sidebarItemVariants`

Defined in `@/components/ui/sidebar`. Base classes:

```text
[ 'relative flex w-full min-w-0 shrink-0 cursor-pointer items-center gap-2.5 overflow-hidden rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-start font-sans select-none', 'outline-none transition-colors duration-150 hover:bg-secondary active:bg-secondary-strong', 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', 'data-disabled:cursor-default data-disabled:opacity-40 data-disabled:hover:bg-transparent', ]
```

**`current`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `bg-secondary-strong font-medium [&_[data-slot=sidebar-icon]]:text-primary` |
| `false` (default) | — |

**`compact`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `min-h-11 text-subhead` |
| `false` (default) | `min-h-8 text-footnote` |

**`tinted`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `font-semibold text-(color:--sidebar-tint) [&_[data-slot=sidebar-icon]]:text-(color:--sidebar-tint)` |
| `false` (default) | — |

2 compound variants — see the source.
