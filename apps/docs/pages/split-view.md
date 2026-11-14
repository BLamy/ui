# SplitView

`UISplitViewController` as composable parts. Up to three columns — **sidebar**, **supplementary** and **detail** — that tile when there is room, float the sidebar when there isn't, and collapse into a navigation stack on a phone. The SplitView takes its size class from its own box (UI SDK's `bindSizeClass`), never the viewport, so it works in a window, a pane, a phone frame or a resizable column. It is one UI SDK primitive (`lib/split-view-primitive.ts`) rendered with `createParts`.

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

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  SplitView, SplitViewSidebar, SplitViewSupplementary,
  SplitViewDetail,
} from '@brett_lamy/ui'
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
      <SplitViewItem id="inbox" title="Inbox" />
    </SplitViewContent>
  </SplitViewSidebar>
  <SplitViewSupplementary>
    <SplitViewHeader title="Inbox" leading={<SplitViewToggle />} />
    <SplitViewContent>{/* SplitViewItem per message */}</SplitViewContent>
  </SplitViewSupplementary>
  <SplitViewDetail>{/* reads useSplitView().value */}</SplitViewDetail>
</SplitView>
```

## Continuity

Each column is **one element for its whole life**. Tiled, floating and stacked are the same DOM in different places: the primitive turns its state into CSS variables (`--column-left`, `--column-width`, `--column-translate`, `--column-z`, `--column-dim`) and attributes, and CSS transitions on the `smooth` spring move the column. So when the size class changes, the column you were reading stays where it is and changes shape; nothing remounts, cross-fades or loses its scroll position. Selecting a message at regular width and then narrowing the window lands you on that message in the stack. Transitions retarget from where a column is (a push can be reversed mid-flight), a divider drag and the back swipe follow the pointer with transitions off (`--stack-progress` drives the swipe), widths are expressions of the container, so resizing within a class never lags, and `prefers-reduced-motion` turns every move into a jump.

## Parts

| Part | Role |
| --- | --- |
| `SplitView` | Root: size class, sidebar, value per column, compact navigation, widths. `sizeClass` forces a class; `breakpoints` moves them (`{ medium, regular }`); `sidebarBehavior` is `auto` · `tile` · `overlay` · `displace`; `controller` drives it from outside |
| `SplitViewSidebar` · `SplitViewSupplementary` · `SplitViewDetail` | Columns (`data-slot="split-view-sidebar"` etc., `data-top`, `data-behind`, `data-lifted`). `width`, `minWidth`, `maxWidth`, `resizable` (a `separator` divider: arrows, Shift+arrows, Home/End, Enter or double-click to reset); `stack` makes the column host a push/pop stack |
| `SplitViewHeader` | Column bar (`data-slot="split-view-header"`): title, `leading`, `trailing`; becomes a back button (labelled with the previous column's or stack page's title, truncated to the room the title leaves) when collapsed or on a pushed page. `largeTitle` for the iOS large title (`data-large-title`); with it or `titleOnScroll`, `data-title-hidden` while the inline title is away |
| `SplitViewContent` | The column's scroller (`data-slot="split-view-content"`); draws the header's large title (`split-view-large-title`) at the top of the scroll, and carries `data-scrolled` once it leaves its top and `data-under` once the large title has gone under the bar |
| `SplitViewItem` | A row bound to the column's value: pressing it selects and shows the next column. The items of a column are one tab stop: Up, Down, Home and End move between them, and Tab moves on to the next column. `tint` gives it its own selection colour; `preview` shows a hover card beside it; `onClick` runs first (`event.preventDefault()` keeps it from selecting) |
| `SplitViewSection` | A titled group of items; `collapsible` makes the label UI SDK's Collapsible trigger (`open` / `defaultOpen` / `onOpenChange(open, details)`). The same item id may appear in several sections; every copy highlights |
| `SplitViewStack` | A push/pop stack inside a column. Its pages are keys from `"root"`: `pages` / `defaultPages` / `onPagesChange(pages, details)` (every push and pop, cancelable), `controller` (`createSplitViewStackController()`: `push(key)`, `pop`, `popToRoot`, `getPages`), `renderPage(key)` for keys nothing pushed a node for (a deep link, a restored stack); `resetKey` pops back to its root. Pages push with `useSplitViewStack().push(<Page />, { key })` |
| `SplitViewToggle` | Sidebar button (`aria-expanded`, `aria-controls`); steps aside when collapsed |
| `SplitViewEmpty` | Nothing-selected placeholder |
| `useSplitView()` | `sizeClass`, `collapsed`, `columns`, `value`, `select`, `isSelected`, `compactColumn`, `show`, `back`, `canGoBack`, `sidebarOpen`, `setSidebarOpen`, `toggleSidebar`, `sidebarBehavior`, `supplementaryOpen`, `setSupplementaryOpen`, `columnWidths`, `setColumnWidth` |
| `useSplitViewStack()` | The nearest stack's `push(node, { key? })`, `pop`, `popToRoot`, `depth`, `canPop` |
| `useSplitViewBack(title?)` | For a container that draws its own bar (NavigationStack) at a column's root: `{ title, back }` while collapsed with a column before it, else `null` |

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

Create a controller with `createSplitViewController()` and pass it as `controller`: `getSizeClass`, `isSidebarOpen`, `setSidebarOpen`, `toggleSidebar`, `getValue`, `setValue`, `select(column, id)`, `getCompactColumn`, `setCompactColumn`, `show(column)`, `back`, `isSupplementaryOpen`, `setSupplementaryOpen`, `getColumnWidths`, `setColumnWidths` and `setColumnWidth(column, width)`. Each write runs its change callback with the reason `imperative` (or the one you pass last as `{ reason, event }`) and returns whether anything changed. Agents get the same actions.

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

## Tinted rows, shared selection, previews and large titles

`tint` on a `SplitViewItem` replaces the app tint for that row's selected background (and colours its icon); custom content reads it as `--split-item-tint` / `--split-item-on-tint`. Selection is by value, so an item that appears in two `SplitViewSection`s (Groceries under Pinned and under My Lists) highlights in both. `preview` puts a hover card beside the row (the list's first reminders here), the kit's `HoverCard`.

`<SplitViewHeader largeTitle title="Groceries" />` draws the title big at the top of the column's `SplitViewContent`, scrolling with it. Once it has gone under the bar, the inline title and the bar's hairline spring in; scroll back up and they fold away.

```tsx
<SplitViewSidebar>
  <SplitViewHeader title="Lists" largeTitle />
  <SplitViewContent>
    <SplitViewSection title="Pinned">
      <SplitViewItem id="groceries" title="Groceries" tint="#34C759" preview={<ListPreview id="groceries" />} />
    </SplitViewSection>
    <SplitViewSection title="My Lists" collapsible>
      <SplitViewItem id="groceries" title="Groceries" tint="#34C759" />
      <SplitViewItem id="work" title="Work" tint={{ background: '#5856D6', foreground: '#fff' }} />
    </SplitViewSection>
  </SplitViewContent>
</SplitViewSidebar>
```

{% demo src="split-view/reminders-tinted" %}

### Header options

`titleOnScroll` hides the inline title until the content scrolls; `largeTitleTrailing` puts content (a count, a button) on the large title's line, and `largeTitleClassName` aligns it with the content. `SplitViewSection variant="prominent"` draws a large section label.

{% demo src="split-view/header-options" %}

## Nested stacks

A column can host its own push/pop stack: `<SplitViewStack>` inside it, or `<SplitViewDetail stack>` as a shorthand. Each page can have its own `SplitViewHeader` and `SplitViewContent`; a pushed page's back button pops the stack and is labelled with the page below's title. The columns and the pages are the kit's stacks (`createStack` from `@/lib/stack`; the columns are one only while compact), so the leading-edge swipe, Esc, the platform's back and the back button always pop the **innermost** level: the column stack only moves once the nested stack is back at its root. A `NavigationStack` nested in a column gets the same treatment.

```tsx
function Albums() {
  const stack = useSplitViewStack()
  return (
    <>
      <SplitViewHeader title="Recently Added Albums" />
      <SplitViewContent>
        {albums.map((a) => (
          <AlbumTile key={a.id} onClick={() => stack.push(<AlbumPage album={a} />, { key: a.id })} />
        ))}
      </SplitViewContent>
    </>
  )
}

<SplitViewDetail>
  <SplitViewStack resetKey={value.sidebar}>
    <Albums />
  </SplitViewStack>
</SplitViewDetail>
```

Pages are kept as elements, so read live data inside them with hooks or context rather than closing over it at push time.

The pages are keys too, so the stack can be controlled and driven from outside like a `NavigationStack`: pass `pages` and `onPagesChange` to own them (restore them after a reload, or open a deep link), or a `controller` to push and pop from anywhere. A key that no `push` gave a node is drawn by `renderPage`:

```tsx
const [pages, setPages] = useState(['root', 'tidewater'])  // from the URL
const albums = createSplitViewStackController()

<SplitViewStack
  pages={pages}
  onPagesChange={(next) => setPages(next)}
  controller={albums}
  renderPage={(key) => <AlbumPage album={albumById(key)} />}>
  <Albums />
</SplitViewStack>

albums.push('live-at-the-bbc')  // drawn by renderPage
```

In a right-to-left document the pages enter from the left and the swipe starts on the right edge, as the compact columns do: every offset is multiplied by `--stack-dir`, which `rtl:` sets to `-1`. A tiled layout stays left to right.

{% demo src="split-view/nested-stack" %}

## Gallery: closing the supplementary column

`supplementaryOpen={false}` (or `setSupplementaryOpen(false)` from `useSplitView()`) slides the supplementary column away, under a tiled sidebar or off the leading edge, and the detail springs across to take its space. The column keeps its width, scroll position and state, and slides back the same way. Collapsed, the stack skips it: picking in the sidebar pushes the detail directly.

```tsx
const s = useSplitView()
<Button onClick={() => s.setSupplementaryOpen(!s.supplementaryOpen)}>Gallery</Button>
```

{% demo src="split-view/notes-gallery" %}

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `splitViewItemVariants`

Defined in `@/components/ui/split-view`. Base classes:

```text
[ 'bl-btn group/item relative flex w-full cursor-pointer items-center gap-3 border-0 text-left [font-family:inherit] text-foreground outline-none', 'transition-[background-color,color] duration-150', 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', ]
```

**`variant`** — default `pill`

| Value | Adds |
| --- | --- |
| `pill` (default) | `min-h-[40px] rounded-ctl px-2.5 py-1.5 text-[15.5px]` |
| `row` | `min-h-row px-4 py-2.5 text-[15.5px]` |

**`selected`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | — |
| `false` (default) | `bg-transparent hover:bg-secondary active:bg-accent` |

**`tinted`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | — |
| `false` (default) | — |

4 compound variants — see the source.

### `splitViewSectionLabelVariants`

Defined in `@/components/ui/split-view`. Base classes:

```text
(none)
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `px-2.5 pt-4 pb-1.5 text-footnote font-semibold tracking-[-.1px] text-muted-foreground` |
| `prominent` | `px-1 pt-6 pb-2 text-title font-bold tracking-[-.2px] text-foreground` |
