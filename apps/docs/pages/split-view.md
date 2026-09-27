# SplitView

`UISplitViewController` as composable parts. Up to three columns — **sidebar**, **supplementary** and **detail** — that tile when there is room, float the sidebar when there isn't, and collapse into a navigation stack on a phone. The SplitView measures its own box, so it works in a window, a pane or a resizable frame.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx lineNumbers="false"
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

```tsx lineNumbers="false"
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
| `SplitView` | Root: width class, sidebar visibility, selection, compact navigation. `widthClass` forces a class; `breakpoints` moves them; `sidebarBehavior` is `auto` · `tile` · `overlay` · `displace` |
| `SplitViewSidebar` · `SplitViewSupplementary` · `SplitViewDetail` | Columns. `width`, `minWidth`, `maxWidth`, `resizable` (keyboard-accessible divider: arrows, Shift+arrows, Home/End, Enter or double-click to reset) |
| `SplitViewHeader` | Column bar — title, `leading`, `trailing`; becomes a back button (labelled with the previous column's title) when collapsed |
| `SplitViewContent` | The column's scroller |
| `SplitViewItem` | A row bound to the column's selection: pressing it selects and shows the next column |
| `SplitViewToggle` | Sidebar button (`aria-expanded`, `aria-controls`); steps aside when collapsed |
| `SplitViewEmpty` | Nothing-selected placeholder |
| `useSplitView()` | `widthClass`, `collapsed`, `selection`, `select`, `show`, `back`, `sidebarVisible`, `toggleSidebar`, `widths`… |

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
