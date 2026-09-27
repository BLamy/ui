# NavigationStack

A controlled stack of screens: push by adding to the array, pop by removing. Edge-swipe back, large titles, sticky subheaders, and the pop is reported — never performed — by the component.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx lineNumbers="false"
import '@brett_lamy/ui/styles.css'

import { NavigationStack, ScreenWrap } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/navigation-stack.json{% endcommand %}

Adds `@/components/ui/navigation-stack.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx lineNumbers="false"
import {
  NavigationStack, ScreenWrap,
} from '@/components/ui/navigation-stack'
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
| `onRefresh` | pull-to-refresh with spinner + success haptic |

## Back gestures

Dragging from the left edge pops interactively — the outgoing screen tracks your finger while the one below parallaxes in. On touch devices the stack also arms a **history sentinel** so the system back-swipe lands as a `popstate` and pops the stack instead of leaving the page.

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
<div style={{'--bl-safe-top': '59px'}}>     // env(safe-area-inset-top) on real hardware
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

`leading` and `trailing` hold bar buttons, and `onRefresh` adds pull-to-refresh with a spinner and a success haptic. Compose pushes a screen; Send pops it by clearing state.

{% demo src="navigation-stack/inbox-actions" %}
