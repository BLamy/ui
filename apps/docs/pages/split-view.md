# SplitView

`UISplitViewController` as composable parts. Up to three columns — **sidebar**, **supplementary** and **detail** — that tile when there is room, float the sidebar when there isn't, and collapse into a navigation stack on a phone. The SplitView measures its own box, so it works in a window, a pane or a resizable frame.

{% tabs title="Installation" sync="install" %}
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
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/split-view.json{% endcommand %}

Adds `@/components/ui/split-view.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  SplitView, SplitViewSidebar, SplitViewSupplementary,
  SplitViewDetail,
} from '@/components/ui/split-view'
```
{% endtab %}
{% endtabs %}

| Width class | Default | Layout |
| --- | --- | --- |
| `regular` | ≥ 1024px | every column tiled; the sidebar button slides the sidebar away |
| `medium` | 640–1023px | supplementary + detail tiled; the sidebar floats over them (`overlay`) or pushes them (`displace`) |
| `compact` | < 640px | one column at a time — picking a row pushes the next column, back / Esc / an edge swipe pops |

```tsx
<SplitView defaultSelection={{ sidebar: 'inbox' }}>
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
  <SplitViewDetail>{/* reads useSplitView().selection */}</SplitViewDetail>
</SplitView>
```

## Continuity

Each column is **one element for its whole life**. Tiled, floating and stacked are the same DOM in different places, moved with the `smooth` spring — so when the width class changes, the column you were reading stays where it is and changes shape; nothing remounts, cross-fades or loses its scroll position. Selecting a message at regular width and then narrowing the window lands you on that message in the stack. Springs are interruptible (a push can be reversed mid-flight), dividers and the back swipe track the pointer 1:1, and `prefers-reduced-motion` turns every move into a jump.

## Parts

| Part | Role |
| --- | --- |
| `SplitView` | Root: width class, sidebar visibility, selection, compact navigation. `widthClass` forces a class; `breakpoints` moves them; `sidebarBehavior` is `auto` · `tile` · `overlay` · `displace`; `sidebarVisibility` sets the visibility each width class starts at; `supplementaryVisible` hides the middle column |
| `SplitViewSidebar` · `SplitViewSupplementary` · `SplitViewDetail` | Columns. `width`, `minWidth`, `maxWidth`, `resizable` (keyboard-accessible divider: arrows, Shift+arrows, Home/End, Enter or double-click to reset); `stack` makes the column host a push/pop stack |
| `SplitViewHeader` | Column bar — title, `leading`, `trailing`; becomes a back button (labelled with the previous column's or stack page's title, truncated to the room the title leaves) when collapsed or on a pushed page. `largeTitle` for the iOS large title |
| `SplitViewContent` | The column's scroller; draws the header's large title at the top of the scroll |
| `SplitViewItem` | A row bound to the column's selection: pressing it selects and shows the next column. `tint` gives it its own selection colour |
| `SplitViewSection` | A titled (optionally `collapsible`) group of items. The same item id may appear in several sections; every copy highlights |
| `SplitViewStack` | A push/pop stack inside a column; `resetKey` drops back to its root. Pages push with `useSplitViewStack().push(<Page />)` |
| `SplitViewToggle` | Sidebar button (`aria-expanded`, `aria-controls`); steps aside when collapsed |
| `SplitViewEmpty` | Nothing-selected placeholder |
| `useSplitView()` | `widthClass`, `collapsed`, `selection`, `select`, `show`, `back`, `sidebarVisible`, `toggleSidebar`, `supplementaryVisible`, `setSupplementaryVisible`, `widths`… |
| `useSplitViewStack()` | The nearest stack's `push`, `pop`, `popToRoot`, `depth`, `canPop` |

## Mail — three columns

{% demo src="split-view/mail-three-columns" %}

## Notes — two columns

The list is the sidebar; hide it for a full-width editor.

{% demo src="split-view/notes-two-columns" %}

## Settings — sidebar behaviours

{% demo src="split-view/settings-sidebar-behaviours" %}

## Resize it

Drag the handle (or focus it and use the arrow keys). This one uses smaller `breakpoints` so every class fits on the page — watch the list tile, float, then become the root of a stack.

{% demo src="split-view/drag-to-resize" %}

## Sidebar visibility per width class

The sidebar starts at — and resets to, whenever the width class changes — a visibility per class: shown at regular, hidden at medium, unless `sidebarVisibility` says otherwise. The reset is reported through `onSidebarVisibleChange` like any other change, so a parent that controls `sidebarVisible` simply mirrors it. (The first measurement on mount is where the sidebar *starts*, so it isn't reported.)

```tsx
const [visible, setVisible] = useState(true)

<SplitView
  sidebarBehavior="tile"
  sidebarVisibility={{ regular: true, medium: true }}
  sidebarVisible={visible}
  onSidebarVisibleChange={setVisible}
>
```

Resize across the breakpoints, hide the sidebar, resize again — the readout follows every reset:

{% demo src="split-view/medium-sidebar" %}

## Tinted rows, shared selection and large titles

`tint` on a `SplitViewItem` replaces the app tint for that row's selected background (and colours its icon); custom content reads it as `--split-item-tint` / `--split-item-on-tint`. Selection is by value, so an item that appears in two `SplitViewSection`s — Groceries under Pinned and under My Lists — highlights in both.

`<SplitViewHeader largeTitle title="Groceries" />` draws the title big at the top of the column's `SplitViewContent`, scrolling with it. Once it has gone under the bar, the inline title and the bar's hairline spring in; scroll back up and they fold away.

```tsx
<SplitViewSidebar>
  <SplitViewHeader title="Lists" largeTitle />
  <SplitViewContent>
    <SplitViewSection title="Pinned">
      <SplitViewItem id="groceries" title="Groceries" tint="#34C759" />
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

A column can host its own push/pop stack — `<SplitViewStack>` inside it, or `<SplitViewDetail stack>` as a shorthand. Each page can have its own `SplitViewHeader` and `SplitViewContent`; a pushed page's back button pops the stack and is labelled with the page below's title. The leading-edge swipe, Esc and the back button always pop the **innermost** level: the column stack only moves once the nested stack is back at its root. A `NavigationStack` nested in a column gets the same treatment.

```tsx
function Albums() {
  const stack = useSplitViewStack()
  return (
    <>
      <SplitViewHeader title="Recently Added Albums" />
      <SplitViewContent>
        {albums.map((a) => (
          <AlbumTile key={a.id} onPress={() => stack.push(<AlbumPage album={a} />, { key: a.id })} />
        ))}
      </SplitViewContent>
    </>
  )
}

<SplitViewDetail>
  <SplitViewStack resetKey={selection.sidebar}>
    <Albums />
  </SplitViewStack>
</SplitViewDetail>
```

Pages are kept as elements, so read live data inside them with hooks or context rather than closing over it at push time.

{% demo src="split-view/nested-stack" %}

## Gallery: hiding the supplementary column

`supplementaryVisible={false}` (or `setSupplementaryVisible(false)` from `useSplitView()`) slides the supplementary column away — under a tiled sidebar, or off the leading edge — and the detail springs across to take its space. The column keeps its width, scroll position and state, and slides back the same way. Collapsed, the stack skips it: picking in the sidebar pushes the detail directly.

```tsx
const s = useSplitView()
<Button onPress={() => s.setSupplementaryVisible(!s.supplementaryVisible)}>Gallery</Button>
```

{% demo src="split-view/notes-gallery" %}
