# SplitView

`UISplitViewController` as composable parts. Up to three columns — **sidebar**, **supplementary** and **detail** — that tile when there is room, float the sidebar when there isn't, and collapse into a navigation stack on a phone. The SplitView takes its size class from its own box (`bindSizeClass`), never the viewport, so it works in a window, a pane, a phone frame or a resizable column. It is one UI SDK primitive (`lib/split-view-primitive.ts`) rendered with `createParts`.

Use it for an app whose screens are columns: a list beside what it opens (Mail, Notes, Settings, Music). A column that pushes pages of its own (an album, then its credits) holds a [NavigationStack](#/navigation-stack).

| You need | Use |
| --- | --- |
| Columns that tile, float the sidebar, and become a push stack on a phone | **SplitView** |
| A sidebar on a tablet that is the bottom tab bar on a phone (Music, Podcasts) | **SplitView** with `compactPresentation="tabs"` (below) |
| Only a bottom tab bar, or only a side rail | [Tabs](#/tabs) `variant="bar"` / `"rail"`, or `presentation="auto"` for both |
| A push/pop stack of pages: a phone app, or one column of a SplitView | [NavigationStack](#/navigation-stack) (inside a column, it is that column's stack) |
| A web-app navigation shell whose compact form is a drawer behind a menu button, with a collapsed rail | [Sidebar](#/sidebar) |
| One side panel that docks, slides over or pushes a page | [AdaptivePane](#/adaptive-pane) |
| User-arranged, dockable tabsets (an IDE) | [Workspace](#/workspace) |

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/split-view.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  SplitView, SplitViewSidebar, SplitViewSupplementary,
  SplitViewDetail,
} from '@/components/ui/split-view'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  SplitView, SplitViewSidebar, SplitViewSupplementary,
  SplitViewDetail,
} from '@brett_lamy/ui/split-view'
```
{% endtab %}
{% endtabs %}

| Size class | Default | Layout |
| --- | --- | --- |
| `regular` | ≥ 1024px | every column tiled; the sidebar button slides the sidebar away |
| `medium` | 640–1023px | supplementary + detail tiled; the sidebar floats over them (`overlay`) or pushes them (`displace`) |
| `compact` | < 640px | one column at a time: picking a row pushes the next column; back, Esc, the platform's back and an edge swipe pop |

The root writes `data-size-class` on itself for CSS, and is the size-class scope of everything it renders (`SizeClassProvider`), so anything inside that reads the nearest scope (a popup with `presentation="auto"`, `useSizeClassScope()`, a `useSizeClass` shell before it measures) follows the split view's box.

```tsx
<SplitView defaultValue={{ sidebar: 'inbox' }}>
  <SplitViewSidebar>
    <SplitViewHeader title="Mailboxes" />
    <SplitViewContent>
      <SplitViewSection title="iCloud">
        <SplitViewItem value="inbox" title="Inbox" icon={<Icon name="tray" />} trailing={4} />
      </SplitViewSection>
    </SplitViewContent>
  </SplitViewSidebar>
  <SplitViewSupplementary>
    <SplitViewHeader title="Inbox" leading={<SplitViewSidebarTrigger />} />
    <SplitViewContent>{/* a SplitViewItem per message */}</SplitViewContent>
  </SplitViewSupplementary>
  <SplitViewDetail>
    {message ? <Message id={message} /> : <EmptyState title="No Message Selected" />}
  </SplitViewDetail>
</SplitView>
```

## Continuity

Each column is **one element for its whole life**. Tiled, floating and stacked are the same DOM in different places: the primitive turns its state into CSS variables (`--column-left`, `--column-width`, `--column-translate`, `--column-z`, `--column-dim`) and attributes, and CSS transitions on the `smooth` spring move the column. So when the size class changes, the column you were reading stays where it is and changes shape; nothing remounts, cross-fades or loses its scroll position (a NavigationStack in it keeps its pages). Selecting a message at regular width and then narrowing the window lands you on that message in the stack. Transitions retarget from where a column is (a push can be reversed mid-flight), a divider drag and the back swipe follow the pointer with transitions off (`--stack-progress` drives the swipe), widths are expressions of the container, so resizing within a class never lags, and `prefers-reduced-motion` turns every move into a jump. The compact stack moves exactly like a NavigationStack: the column under slides back 30% under a 10% shade, and the one on top casts the `shadow-edge-*` edge.

## Parts

| Part | Role |
| --- | --- |
| `SplitView` | Root: size class, sidebar, value per column, compact navigation, widths. `sizeClass` forces a class; `breakpoints` moves them (`{ medium, regular }`); `sidebarBehavior` is `auto` · `tile` · `overlay` · `displace`; `controller` drives it from outside |
| `SplitViewSidebar` | The sidebar column (below), plus `compactPresentation`: `stack` (default, the compact stack's first page) or `tabs` (the iOS tab bar over the other columns while compact; see "A sidebar that becomes a tab bar") |
| `SplitViewSidebar` · `SplitViewSupplementary` · `SplitViewDetail` | Columns (`<section>`, `data-slot="split-view-sidebar"` etc., `data-top`, `data-behind`, `data-lifted`, `data-hairline`). The column is its own surface: `className` (a string, or a function of `{ column, top, behind, lifted }`) merges over its background and flex layout; `style`, `ref` and the rest go on the section. `width`, `minWidth`, `maxWidth`, `resizable` (a `separator` divider on its trailing edge: arrows, Shift+arrows, Home/End, Enter or double-click to reset) |
| `SplitViewHeader` | The bar of a column that doesn't push (`data-slot="split-view-header"`): `title`, `leading`, `trailing`; collapsed, a back button to the column before (`split-view-back`) takes the leading items' place. `largeTitle` draws the iOS large title (a level-1 heading) at the top of the content; with it or `showOnScroll`, the inline title fades in once the content scrolls (`data-title-hidden` while it is away). `titleAlign="start"` puts the title after the leading items. `scrollEdge` (default true) is iOS's scroll-edge look: the hairline under the bar shows only once the pane's `SplitViewContent` has scrolled under it (`data-scrolled`), as a `NavigationStackBar`'s surface does, so the bars of a window line up at rest; `scrollEdge={false}` keeps it at rest. It is the same bar as `NavigationStackBar` (one back-label rule, one large title, one fade): a page of a NavigationStack uses `NavigationStackBar`'s parts |
| `SplitViewContent` | The column's scroller (`data-slot="split-view-content"`); draws the header's large title (`split-view-large-title`) at the top of the scroll, and carries `data-scrolled` once it leaves its top and `data-under` once the large title has gone under the bar |
| `SplitViewItem` | A row bound to the column's value: pressing it selects `value` and shows the next column (a push while collapsed). Row anatomy: `icon`, `title`, `description`, `trailing`, or your own `children`. The current one (its `value` is the column's; never while collapsed, where rows are navigation) has `aria-current` and `data-current`. The items of a column are one tab stop: Up, Down, Home and End move between them, past `disabled` ones, and Tab moves on to the next column. `variant` is `pill` (sidebar default; 44px tall in a compact split view) or `row`; `tint` gives it its own colour; `preview` shows a hover card beside it; `onClick` runs first (`event.preventDefault()` keeps it from selecting). `icon` is an `Icon` name or a node. `tab`: one of the compact tab bar's tabs, in a sidebar with `compactPresentation="tabs"` |
| `SplitViewSection` | A titled group of items (`role="group"`, named by its label); the label is the kit's `menu` section label, or a bold heading with `variant="prominent"`. `collapsible` makes the label UI SDK's Collapsible trigger (`open` / `defaultOpen` / `onOpenChange(open, details)`). The same value may appear in several sections; every copy draws current. `tab` with a `value` and an `icon`: the whole section is one tab of the compact tab bar (a tab group), current while any of its items is the selection |
| `SplitViewSidebarTrigger` | The sidebar button (`aria-expanded`, `aria-controls`, `data-slot="split-view-sidebar-trigger"`); steps aside when collapsed. `children` replace the 22px `sidebar` glyph; `shortcut` (UI SDK's syntax, `"mod+alt+s"`) toggles the sidebar from anywhere and is announced as `aria-keyshortcuts` (reason `shortcut`) |
| `useSplitView()` | `sizeClass`, `collapsed`, `columns`, `value`, `select(column, value)`, `isCurrent(column, value)`, `compactColumn`, `show`, `back`, `canGoBack`, `sidebarOpen`, `setSidebarOpen`, `toggleSidebar`, `sidebarBehavior`, `supplementaryOpen`, `setSupplementaryOpen`, `columnWidths`, `setColumnWidth`. Throws outside a SplitView |
| `useSplitViewColumn()` | The column the caller is in, or `null` |
| `useSplitViewBack(title?)` | For a bar of your own at a column's root (a NavigationStack does this itself): `{ title, back }` while collapsed with a column before it, else `null` |

A column with nothing selected shows the kit's [EmptyState](#/empty-state) (`size="default"` fills the column).

## State and changes

Every piece of state is UI SDK-shaped: a controlled prop, a `default…` prop and an `on…Change(value, details)` callback, where `details` has `reason`, `event`, `source` and `cancel()`.

| State | Props | Reasons |
| --- | --- | --- |
| Sidebar | `sidebarOpen`, `defaultSidebarOpen`, `onSidebarOpenChange` | `trigger-press` (the toggle), `escape-key`, `outside-press` (a floating sidebar), `item-press` (a pick in a floating sidebar closes it), `content-resize` (the size class changed and it reset), `imperative` |
| Value per column | `value`, `defaultValue`, `onValueChange` (`details.column`) | `item-press`, `imperative` |
| Top of the compact stack | `compactColumn`, `defaultCompactColumn`, `onCompactColumnChange` | `item-press` (a pick pushed), `trigger-press` (back button), `escape-key`, `back` (the platform's back), `swipe`, `imperative` |
| Supplementary column | `supplementaryOpen`, `defaultSupplementaryOpen`, `onSupplementaryOpenChange` | `trigger-press`, `item-press`, `imperative` |
| Column widths | `columnWidths`, `defaultColumnWidths`, `onColumnWidthsChange` (`details.column`; once a drag ends) | `drag`, `resize-key`, `handle-press` (Enter or a double click resets), `imperative` |

`onSizeClassChange(sizeClass)` hears the size class change (not on mount).

### Driving it from outside

Create a controller with `createSplitViewController()` and pass it as `controller`: `getSizeClass`, `isSidebarOpen`, `setSidebarOpen`, `toggleSidebar`, `getValue`, `setValue`, `select(column, value)`, `getCompactColumn`, `setCompactColumn`, `show(column)`, `back`, `isSupplementaryOpen`, `setSupplementaryOpen`, `getColumnWidths`, `setColumnWidths` and `setColumnWidth(column, width)`. Each write runs its change callback with the reason `imperative` (or the one you pass last as `{ reason, event }`) and returns whether anything changed. Agents get the same actions.

## Mail — three columns

{% demo src="split-view/mail-three-columns" %}

## Notes — two columns

The list is the sidebar; hide it for a full-width editor.

{% demo src="split-view/notes-two-columns" %}

## Settings — sidebar behaviours

{% demo src="split-view/settings-sidebar-behaviours" %}

## Resize it

Drag the handle (or focus it and use the arrow keys). This one uses smaller `breakpoints` so every class fits on the page: watch the list tile, float, then become the root of a stack.

{% demo src="split-view/drag-to-resize" %}

## Sidebar per size class

The sidebar starts at (and resets to, whenever the size class changes) a state per class: open at regular, closed at medium, unless `defaultSidebarOpen` says otherwise (a boolean sets regular; an object sets each class). The reset is reported through `onSidebarOpenChange` with the reason `content-resize`, like any other change, so a parent that controls `sidebarOpen` simply mirrors it. (The first measurement on mount is where the sidebar *starts*, so it isn't reported.)

```tsx
const [open, setOpen] = useState(true)

<SplitView
  sidebarBehavior="tile"
  defaultSidebarOpen={{ regular: true, medium: true }}
  sidebarOpen={open}
  onSidebarOpenChange={setOpen}
>
```

Resize across the breakpoints, close the sidebar, resize again; the readout follows every reset:

{% demo src="split-view/medium-sidebar" %}

## Tinted rows, shared values, previews and large titles

`tint` on a `SplitViewItem` replaces the app tint for that row's current background (and colours its icon); custom content reads it as `--split-item-tint` / `--split-item-on-tint` (the foreground defaults to the theme's `--primary-foreground`). Items are bound by value, so an item that appears in two `SplitViewSection`s (Groceries under Pinned and under My Lists) draws current in both. `preview` puts a hover card beside the row (the list's first reminders here), the kit's `HoverCard`.

`<SplitViewHeader largeTitle title="Groceries" />` draws the title big at the top of the column's `SplitViewContent`, scrolling with it. Once it has gone under the bar, the inline title and the bar's hairline fade in; scroll back up and they fade away.

```tsx
<SplitViewSidebar>
  <SplitViewHeader title="Lists" largeTitle />
  <SplitViewContent>
    <SplitViewSection title="Pinned">
      <SplitViewItem value="groceries" title="Groceries" tint="#34C759" preview={<ListPreview id="groceries" />} />
    </SplitViewSection>
    <SplitViewSection title="My Lists" collapsible>
      <SplitViewItem value="groceries" title="Groceries" tint="#34C759" />
      <SplitViewItem value="work" title="Work" tint={{ background: '#5856D6', foreground: '#fff' }} />
    </SplitViewSection>
  </SplitViewContent>
</SplitViewSidebar>
```

{% demo src="split-view/reminders-tinted" %}

### Header options

`showOnScroll` hides the inline title until the content scrolls (as on `NavigationStackTitle`); `largeTitleTrailing` puts content (a count, a button) on the large title's line, and `largeTitleClassName` aligns it with the content. `SplitViewSection variant="prominent"` draws a large section label.

{% demo src="split-view/header-options" %}

## A column that pushes: NavigationStack

A column with pages of its own holds a [NavigationStack](#/navigation-stack), and its pages use `NavigationStackBar`'s parts. The column is the stack's parent:

- **Collapsed**, the stack's first page gets the back button to the column before, named by that column's title ("‹ Library"), and the stack's first title names the column for the one after it.
- **Escape, the platform back and the edge swipe pop the innermost level first**: the stack's pages, then the columns once the stack is at its first page. A popup open in a page closes before either.
- **Tiled**, the first page has no back button; put the `SplitViewSidebarTrigger` in `NavigationStackLeading` (the back button takes its place when there is one).
- **Across size classes** the column and its stack are the same elements: a page pushed at regular width is still on top when the window narrows.

`resetKey` pops the stack to its first page when the sidebar picks something else; `renderPage(key)` draws the pages pushed by key (`useNavigationStack().push(key)`), a deep link or a restored stack.

```tsx
function Library() {
  const s = useSplitView()
  return (
    <SplitViewDetail>
      <NavigationStack resetKey={s.value.sidebar} renderPage={(key) => <AlbumPage value={key} />}>
        <NavigationStackPage value="albums">
          <NavigationStackBar>
            <NavigationStackLeading><SplitViewSidebarTrigger /></NavigationStackLeading>
            <NavigationStackTitle>Recently Added</NavigationStackTitle>
          </NavigationStackBar>
          <NavigationStackContent>
            <NavigationStackLargeTitle />
            <AlbumGrid />  {/* a tile calls useNavigationStack().push(`album:${id}`) */}
          </NavigationStackContent>
        </NavigationStackPage>
      </NavigationStack>
    </SplitViewDetail>
  )
}
```

Its pages are keys, so the stack can be controlled (`pages` / `onPagesChange`, to restore it after a reload or open a deep link) or driven from anywhere (`createNavigationStackController()`). In a right-to-left document the pages enter from the left and the swipe starts on the right edge, as the compact columns do: every offset is multiplied by `--stack-dir`, which `rtl:` sets to `-1`. A tiled layout stays left to right.

{% demo src="split-view/nested-stack" %}

## A sidebar that becomes a tab bar

Music, Podcasts and the TV app are a sidebar on an iPad and a tab bar on an iPhone. `compactPresentation="tabs"` on `SplitViewSidebar` is that, with one tree: while the split view is compact the sidebar leaves the stack and its `tab` items become the kit's [Tabs](#/tabs) `bar`, pinned over the bottom of the other columns. A `SplitViewSection` with `tab`, a `value` and an `icon` is one tab for all its rows (Library), current while any of them is the selection. Picking a tab selects it exactly as picking the row would (`onValueChange`, reason `item-press`) and goes back to the first page of the stack beside it; the arrow keys move between tabs and Enter or Space picks one (manual activation, so arrowing doesn't reset the stack). Tabs keep the sidebar's order.

Nothing remounts at the boundary: the detail's NavigationStack (with `resetKey={value.sidebar}`) stays mounted, and its content keeps room for the bar (`--tabs-bar-h`, which the split view publishes while its sidebar is a tab bar, home indicator included), as `SplitViewContent` does. A mini player or a toolbar of your own sits at `bottom: calc(var(--tabs-bar-h) + 8px)`.

```tsx
<SplitView value={{ sidebar }} onValueChange={(v) => setSidebar(v.sidebar)}>
  <SplitViewSidebar compactPresentation="tabs" aria-label="Podcasts">
    <SplitViewContent>
      <SplitViewItem value="home" title="Home" icon="house" tab />
      <SplitViewItem value="search" title="Search" icon="magnifyingglass" tab />
      <SplitViewSection title="Library" tab value="library" icon="books-vertical">
        <SplitViewItem value="shows" title="Shows" icon="layers" />
      </SplitViewSection>
    </SplitViewContent>
  </SplitViewSidebar>
  <SplitViewDetail>
    <NavigationStack resetKey={sidebar}>…</NavigationStack>
  </SplitViewDetail>
</SplitView>
```

Drag the frame across 640px:

{% demo src="split-view/sidebar-tab-bar" %}

The [Apple Music block](#/blocks/apple-music) is the full version: one SplitView at every size, its Library tab a section, and the mini player riding over the tab bar.

## Gallery: closing the supplementary column

`supplementaryOpen={false}` (or `setSupplementaryOpen(false)` from `useSplitView()`) slides the supplementary column away, under a tiled sidebar or off the leading edge, and the detail springs across to take its space. The column keeps its width, scroll position and state, and slides back the same way. Collapsed, the stack skips it: picking in the sidebar pushes the detail directly.

```tsx
const s = useSplitView()
<Button onClick={() => s.setSupplementaryOpen(!s.supplementaryOpen)}>Gallery</Button>
```

{% demo src="split-view/notes-gallery" %}

## Stories

Storybook's **Organisms/SplitView** (`registry/blocks/split-view-demos/split-view.stories.tsx`) shows every composition at its size class: Mail light and dark, Notes, Settings, the compact stack and a pushed column, overlay and displace sidebars, a resizable frame, tinted items, large titles scrolled and compact, item states, an empty detail, header options, the gallery, and the sidebar as a tab bar (`SidebarTabBar`, `SidebarTabBarDark`, `SidebarTabBarTablet`), the column that pushes (`NestedStack`, `NestedStackDark`, `NestedStackMedium`, `NestedStackCompact`, `NestedStackCompactRoot`, `NestedNavigationStack`, `NavigationStackRootBack`).

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `splitViewItemVariants`

Defined in `@/components/ui/split-view`. Base classes:

```text
[ 'bl-btn group/item relative flex w-full cursor-pointer items-center gap-3 border-0 text-start [font-family:inherit] text-subhead text-foreground outline-none', 'transition-[background-color,color] duration-150', 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', 'disabled:cursor-default disabled:opacity-45', ]
```

**`variant`** — default `pill`

| Value | Adds |
| --- | --- |
| `pill` (default) | `min-h-10 rounded-ctl px-2.5 py-1.5 group-data-[size-class=compact]/split:min-h-11` |
| `row` | `min-h-row px-4 py-2.5` |

**`current`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | — |
| `false` (default) | `bg-transparent not-disabled:hover:bg-secondary not-disabled:active:bg-accent` |

**`tinted`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | — |
| `false` (default) | — |

4 compound variants — see the source.
