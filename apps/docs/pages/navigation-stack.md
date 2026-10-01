# NavigationStack

A controlled stack of screens: push by adding to the array, pop by removing. Edge-swipe back, large titles, sticky subheaders, and the pop is reported — never performed — by the component.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/navigation-stack.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  NavigationStack, ScreenWrap,
} from '@/components/ui/navigation-stack'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { NavigationStack, ScreenWrap } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

```jsx
<NavigationStack
  onPop={() => setSel(null)}
  screens={[
    { key: 'list',   title: 'Contacts', largeTitle: true,
      subheader: <SearchField/>, content: <ContactList/> },
    sel && { key: 'detail', title: sel.name, content: <Detail c={sel}/> }
  ].filter(Boolean)}
/>
```

## Screen options

| Option | Effect |
| --- | --- |
| `largeTitle` | iOS large title that collapses on scroll |
| `titleOnScroll` | bar title fades in only after scrolling |
| `grouped` | inset-grouped background (`#F2F2F7` wash) |
| `subheader` | pinned element under the bar (search fields) |
| `overlay` | floats above content (index bars, tab bars) |
| `bottomInset` | reserves room for bars riding the screen |
| `onRefresh` | pull-to-refresh with spinner |

## Back gestures

Dragging from the left edge pops interactively — the outgoing screen tracks your finger while the one below parallaxes in. On touch devices the stack also arms a **history sentinel** so the system back-swipe lands as a `popstate` and pops the stack instead of leaving the page.

## Back button and title morph

The back button names the screen behind it, as on iOS. Its label gets whatever room the centered title leaves on its side of the bar — measured, not counted in characters — so a long previous title is ellipsized; only when a sliver is left does it fall back to **Back**, and then to the chevron alone.

Titles travel between screens. On push the previous screen's title — its large title, or the inline one once it has scrolled — flies into the new back button, shrinking and taking the tint (an inline title, already the size of the back label, stays solid instead of cross-fading, and the new back chevron fades in at its resting place rather than sweeping through the title); on pop the back label flies back into the title it names. The edge swipe scrubs the flight with your finger and finishes it on the same spring as the screens, and a push or pop that lands mid-flight simply takes over. Reduced motion skips the flight.

{% demo src="navigation-stack/title-morph" %}

## Chrome that gets out of the way

Scrolling down slides the nav bar (and any `<TabBar>` in the tree) away; scrolling up — or reaching the top — brings both back. Sticky section headers ride along, because they read their offset from the same source.

```jsx
<NavigationStack screens={[{ key:'list', title:'Contacts', content:<List/>,
  hideChromeOnScroll: false        // opt out per screen; default is true
}]}/>

<TabBar items={tabs} hideOnScroll={false}/>   // or keep the tab bar pinned
```

The two are coordinated through the kit's chrome state, so a tab bar mounted three containers away still follows the screen the user is actually scrolling. Read it yourself with `useChromeHidden()`.

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

The stack is an array of keys in state: rows push by appending, `onPop` drops the last one. Three levels, grouped screens, and controls that keep their state as you go back.

{% demo src="navigation-stack/settings-drill-down" %}

### Large title, search, detail

`largeTitle` collapses into the bar as the list scrolls and `subheader` pins a search field under it. The detail screen uses `titleOnScroll` and a `trailing` bar button.

{% demo src="navigation-stack/contacts-large-title" %}

### Bar buttons and pull to refresh

`leading` and `trailing` hold bar buttons, and `onRefresh` adds pull-to-refresh with a spinner. Compose pushes a screen; Send pops it by clearing state.

{% demo src="navigation-stack/inbox-actions" %}

### Inside a collapsed SplitView

When a SplitView collapses to one column, a `NavigationStack` in a later column shows a back button on its root screen that returns to the column before it, labelled with that column's title. Pass `rootBack` to set it yourself, or `rootBack={false}` to hide it.

{% demo src="navigation-stack/in-split-view" %}
