# TabBar

The iOS bottom tab bar as one component: icons over short labels on a blurred bar that (inside a scrolling screen) hides as you scroll down. `TabBar` renders no panels — it is just the bar, so you show the screen for the selected tab yourself. That is the difference from its siblings: [Tabs](https://blamy.github.io/ui/#/tabs) are in-page tabs with panels, [Segmented](https://blamy.github.io/ui/#/segmented) picks a value, and [TabView](https://blamy.github.io/ui/#/tab-view) is the composable version this one is built on — reach for it when you want panels, a vertical rail, custom tab content or a selection indicator.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/tab-bar.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { TabBar } from '@/components/ui/tab-bar'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { TabBar } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

`items` are `{ value, title, icon }`, where `icon` is the name of a glyph from the [Icons](https://blamy.github.io/ui/#/icons) set. `value` and `onValueChange` make it controlled; `defaultValue` alone leaves the selection to the bar. The bar is absolutely positioned on the bottom edge of the nearest positioned ancestor and floats over the screen, so give that ancestor `relative` and leave at least 62px of padding under the content.

{% demo src="tab-bar/phone" %}

```tsx
const items = [
  { value: 'favorites', title: 'Favorites', icon: 'star' },
  { value: 'recents', title: 'Recents', icon: 'clock' },
  { value: 'contacts', title: 'Contacts', icon: 'person' },
]

const [tab, setTab] = useState('recents')

<div className="relative h-dvh">
  <Screen tab={tab} />
  <TabBar items={items} value={tab} onValueChange={setTab} />
</div>
```

`onValueChange` gets the picked item's `value` and UI SDK's change details: `details.reason` is `item-press` or `list-navigation` (arrow keys), and `details.cancel()` refuses the change. Declare the items `as const` and the value is narrowed to theirs.

## Hiding on scroll

With `hideOnScroll` (the default) the bar slides down when the app's chrome is hidden and returns with it. The bar does not watch scrolling itself: it follows `chromeStore`, which a [NavigationStack](https://blamy.github.io/ui/#/navigation-stack) screen publishes as it scrolls. In your own scroller, call `chromeStore.set(true)` on scroll down and `chromeStore.set(false)` on scroll up, as the demo above does (import it from `@/lib/theme`, or `@brett_lamy/ui`). Pass `hideOnScroll={false}` for a bar that never moves.

## Accessibility

It is a UI SDK `Tabs` list: `role="tablist"` with `role="tab"` items and `aria-selected`; Left and Right move between tabs and select them, Home and End jump to the ends, and Tab leaves the list. Every tab's name comes from its `title`; give a tab whose title is not a string an `aria-label`, or it falls back to its `value`. The tablist is named "Tabs" unless you pass `aria-label`. Since no panel is rendered, the tabs carry no `aria-controls`; link the screen you show to the selected tab yourself if assistive technology should connect them — or use [TabView](https://blamy.github.io/ui/#/tab-view), which renders real `tabpanel`s.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `items` | — | `{ value: string, title: ReactNode, icon: string, 'aria-label'?: string }[]`. `aria-label` names a tab whose `title` isn't text. |
| `value` | — | `value` of the selected tab; pass it to control the bar. |
| `defaultValue` | first item | The tab selected at first, when uncontrolled. |
| `onValueChange` | — | `(value, details) => void`. |
| `hideOnScroll` | `true` | Slide away while `chromeStore` says the chrome is hidden. |
| `aria-label` | `Tabs` | Names the tablist. |
| `className` / `style` | — | Applied to the bar itself (`data-slot="tab-view-bar"`), merged last. |

## Styling

The bar is a `TabViewBar` with `variant="bar"`: `absolute inset-x-0 bottom-0 z-120`, 62px tall, a hairline on top, the `bg-bar` surface with a backdrop blur. Inside it are UI SDK's `tabs-list` and `tabs-tab` slots, with `data-selected` on the selected tab — see the [TabView](https://blamy.github.io/ui/#/tab-view) page.
