# NavigationStack

iOS's navigation controller as composable parts, on a UI SDK primitive. The stack is a list of page keys, bottom to top — `pages` / `defaultPages` / `onPagesChange(pages, details)`, or a controller — and each page is declared as a child with its bar, title and content (or drawn from its key by `renderPage`). Push by adding a key; the back button, Escape, the platform back and an edge swipe ask for one fewer.

Use it for a drill-down: a phone app, or the pages of one [SplitView](#/split-view) column (it is the kit's only push stack, and inside a column it knows it: the first page goes back to the column before when the split view collapses).

| You need | Use |
| --- | --- |
| Pages pushed and popped by key, with iOS bars, large titles and the back swipe | **NavigationStack** |
| Columns beside each other that collapse into a stack on a phone | [SplitView](#/split-view), with a NavigationStack in a column that pushes |
| One side panel that pushes over a page on a phone | [AdaptivePane](#/adaptive-pane) `presentation="push"` |
| A modal flow with its own steps | [Dialog](#/dialog) `view` |

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/navigation-stack.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  NavigationStack, NavigationStackPage, NavigationStackBar,
  NavigationStackTitle, NavigationStackContent,
  NavigationStackLargeTitle,
} from '@/components/ui/navigation-stack'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  NavigationStack, NavigationStackPage, NavigationStackBar,
  NavigationStackTitle, NavigationStackContent,
  NavigationStackLargeTitle,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

```jsx
<NavigationStack
  pages={sel ? ['list', 'detail'] : ['list']}
  onPagesChange={(pages) => { if (pages.length === 1) setSel(null) }}
>
  <NavigationStackPage value="list">
    <NavigationStackBar>
      <NavigationStackTitle>Contacts</NavigationStackTitle>
    </NavigationStackBar>
    <NavigationStackContent>
      <NavigationStackLargeTitle />
      <NavigationStackSubheader><SearchInput /></NavigationStackSubheader>
      <ContactList />
    </NavigationStackContent>
  </NavigationStackPage>
  {sel && (
    <NavigationStackPage value="detail">
      <NavigationStackBar>
        <NavigationStackTitle showOnScroll>{sel.name}</NavigationStackTitle>
      </NavigationStackBar>
      <NavigationStackContent><Detail c={sel} /></NavigationStackContent>
    </NavigationStackPage>
  )}
</NavigationStack>
```

Pages are the stack's direct children (fragments and arrays are fine), each with a `value`. The stack renders the ones in `pages`, so you can declare every page up front (a settings tree) or render only the ones in the stack. A key no child is for is drawn by `renderPage(key)` (return a `NavigationStackPage` with that `value`): pages pushed by key from a row (`useNavigationStack().push('album:42')`), a deep link, a stack restored after a reload. A page you stop rendering while it pops stays on screen, as it was, until it has slid out. With neither `pages` nor `defaultPages`, the stack starts on its first page child.

```jsx
<NavigationStack renderPage={(key) => <AlbumPage value={key} id={key.slice(6)} />}>
  <NavigationStackPage value="albums">
    <NavigationStackBar><NavigationStackTitle>Albums</NavigationStackTitle></NavigationStackBar>
    <NavigationStackContent>
      <AlbumGrid onOpen={(id) => stack.push(`album:${id}`)} />  {/* stack = useNavigationStack() */}
    </NavigationStackContent>
  </NavigationStackPage>
</NavigationStack>
```

## Parts

| Part | What it is |
| --- | --- |
| `NavigationStack` | The root. `pages` / `defaultPages` / `onPagesChange(pages, details)` (`details.reason`: `trigger-press`, `escape-key`, `back`, `swipe`, `imperative`; `details.cancel()` keeps the pages), `controller`, `renderPage(key)`, `resetKey` (a new value pops to the first page: the sidebar selection the stack belongs to), `rootBack`, `safeTop` (px), `bottomInset`, `onBarHiddenChange`. Writes `data-size-class` from its own width and is the size-class scope of its pages. |
| `NavigationStackPage` | One page, by `value`. `variant="grouped"` gives it the inset-grouped background (`plain` is the default). Covered pages are `inert` with `data-covered`; a pushed page enters with `data-starting-style`, a popped one leaves with `data-ending-style`; `data-scrolled` once its content scrolls past the large title. Anything else inside (an index bar, a tab bar) floats over the content. |
| `NavigationStackBar` | The navigation bar, on the kit's iOS bar surface (`barSurface`), which fades in once the content scrolls under it. It draws the back button itself when there is a page to go back to. `hideOnScroll` (default true) slides it away as the content scrolls down; `data-hidden` while it is away. |
| `NavigationStackTitle` | The bar's centered title, and the page's name: the next page's back label and the large title read it. `showOnScroll` fades it in only once the content has scrolled. While it is faded out it is out of the accessibility tree (the large title is the page's heading). |
| `NavigationStackLeading` / `NavigationStackTrailing` | Bar items at either edge. Leading items give way to the back button. |
| `NavigationStackBack` | A back button of your own (the bar already has one): pops its page, or runs `rootBack` on the first page. The bar's own is named "Back to *title*", whatever its label shows. |
| `NavigationStackContent` | The scrolling content under the bar. `onRefresh` adds pull to refresh, `maxWidth` a readable width, `bottomInset` room for bars that ride over it. |
| `NavigationStackLargeTitle` | iOS's large title at the top of the content, the page's level-1 heading; it collapses into the bar as you scroll. Its text defaults to the page's title. |
| `NavigationStackSubheader` | Under the large title: a search field, a segmented control. |

`createNavigationStackController()` gives a handle with `push`, `pop`, `popTo`, `replace`, `refresh` and `getPages`; `useNavigationStack()` returns the same methods to anything inside a stack (it throws outside one, as `useSplitView` does).

A push slides the page in from the trailing edge with the `shadow-edge-*` edge, over the page under it, which slides back 30% under a 10% shade: the same motion as a compact SplitView's columns.

## Back gestures

Dragging from the leading edge (the left, or the right in right-to-left text, where pages enter from the left and the back chevron points right) pops interactively — the outgoing page tracks your finger while the one below parallaxes in (the kit's `bindEdgeSwipe`, through the stack's `--stack-progress`, settling on the tray spring under `data-swipe-settling`). The platform back pops it too (`bindBack`): Android's back button, and on iOS a history entry the system back-swipe lands on instead of leaving the page. Escape, back and swipe go to the innermost stack that can pop, after any popup open in it; a stack on its first page leaves them to whatever is around it. With a hardware keyboard, Up and Down move between a page's rows (`ListRow`s, or anything marked `data-tkrow`); a text field, a select, a slider or another widget that moves with the arrows keeps them.

## Back button and title morph

The back button names the page behind it, as on iOS. Its label gets whatever room the centered title leaves on its side of the bar — measured, not counted in characters — so a long previous title is ellipsized; only when a sliver is left does it fall back to **Back**, and then to the chevron alone.

Titles travel between pages. On push the previous page's title — its large title, or the inline one once it has scrolled — flies into the new back button, shrinking and taking the tint (an inline title, already the size of the back label, stays solid instead of cross-fading, and the new back chevron fades in at its resting place rather than sweeping through the title); on pop the back label flies back into the title it names. The edge swipe scrubs the flight with your finger and finishes it on the tray spring, and a push or pop that lands mid-flight simply takes over. Reduced motion skips the flight.

{% demo src="navigation-stack/title-morph" %}

## Chrome that gets out of the way

Scrolling down slides the nav bar (and any `Tabs` bar in the tree) away; scrolling up — or reaching the top — brings both back. Sticky section headers ride along, because they read their offset from the same source.

```jsx
<NavigationStackBar hideOnScroll={false}>   {/* opt out per page; default is true */}
  <NavigationStackTitle>Contacts</NavigationStackTitle>
</NavigationStackBar>

<TabsBar hideOnScroll={false}>…</TabsBar>   // or keep the tab bar pinned
```

The two are coordinated through the kit's chrome state, so a tab bar mounted three containers away still follows the page on top of the stack. Read it yourself with `useChromeHidden()`, or listen with the stack's `onBarHiddenChange`.

## Dynamic Island

The bar collapses **to a floor, never to nothing**: set `--bl-safe-top` (or pass `safeTop` to `<App>`) and that many pixels of opaque bar stay behind, so content never scrolls under the camera island.

```jsx
// device frame
// --bl-safe-top is env(safe-area-inset-top) on real hardware
<div style={{'--bl-safe-top': '59px'}}>
  <App safeTop={59}/>
</div>
```

Bar height becomes `safeTop + 52`; on hide it translates up by exactly 52, leaving the island strip in place. Large titles, the pull-to-refresh spinner, sticky headers, and the IndexBar rail all offset from the same number. In the [Contacts demo](https://blamy.github.io/ui/#/introduction), switch the frame to **Phone 390** to see it — the island is drawn, and the bar stops under it.

## Live example
{% demo src="navigation-stack/teams-push" %}

## Examples

### Settings drill-down

The stack is an array of keys in state: rows push by appending, and `onPagesChange` hands back the shorter list on a pop. Every page is declared; the stack shows the ones in `pages`. Three levels, grouped pages, and controls that keep their state as you go back.

{% demo src="navigation-stack/settings-drill-down" %}

### Large title, search, detail

`NavigationStackLargeTitle` collapses into the bar as the list scrolls, with a search field under it in `NavigationStackSubheader`. The detail page's title uses `showOnScroll`, beside a `NavigationStackTrailing` bar button.

{% demo src="navigation-stack/contacts-large-title" %}

### Bar buttons and pull to refresh

`NavigationStackLeading` and `NavigationStackTrailing` hold bar buttons, and the content's `onRefresh` adds pull to refresh with a spinner (a touch gesture; `controller.refresh()` runs it from a button or a key). Compose pushes a page; Send pops it by clearing state.

{% demo src="navigation-stack/inbox-actions" %}

### In a SplitView column

A SplitView column that pushes pages holds a NavigationStack, and the column is its parent. When the split view collapses to one column, the stack's first page shows a back button that returns to the column before it, labelled with that column's title, and the stack's first title labels the next column's back button. Escape, the platform back and the swipe pop the stack's pages before the columns move. Pass `rootBack` to set the first page's back button yourself, or `rootBack={false}` to hide it. See [SplitView: a column that pushes](#/split-view).

{% demo src="navigation-stack/in-split-view" %}

## Stories

Storybook's **Organisms/NavigationStack**: push/pop, pull to refresh, safe top, title on scroll, the chrome hiding on scroll (with a tab bar, disabled, with a safe top), the title morph, the back label fitting, truncated, falling back and dark, a wide page (`Wide`), and the detail column of a SplitView, tiled and compact (`DetailColumnOfASplitView`, `DetailColumnCompact`, `DetailColumnCompactDark`).
