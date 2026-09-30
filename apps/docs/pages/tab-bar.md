# TabBar

The iOS bottom tab bar as one component: icons over short labels on a blurred bar, a sliding indicator, and (inside a scrolling screen) hiding as you scroll down. `TabBar` renders no panels — it is just the bar, so you show the screen for the selected tab yourself. That is the difference from its siblings: [Tabs](https://blamy.github.io/ui/#/tabs) are in-page tabs with panels, [Segmented](https://blamy.github.io/ui/#/segmented) picks a value, and [TabView](https://blamy.github.io/ui/#/tab-view) is the composable version this one is built on — reach for it when you want panels, a vertical rail, custom tab content or an indicator style of your own.

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

`items` are `{ id, title, icon }`, where `icon` is the name of a glyph from the [Icons](https://blamy.github.io/ui/#/icons) set. `selected` and `onSelect` make it controlled. The bar is absolutely positioned on the bottom edge of the nearest positioned ancestor and floats over the screen, so give that ancestor `relative` and leave at least 62px of padding under the content.

{% demo src="tab-bar/phone" %}

```tsx
const items = [
  { id: 'favorites', title: 'Favorites', icon: 'star' },
  { id: 'recents', title: 'Recents', icon: 'clock' },
  { id: 'contacts', title: 'Contacts', icon: 'person' },
]

<div className="relative h-dvh">
  <Screen tab={tab} />
  <TabBar items={items} selected={tab} onSelect={setTab} />
</div>
```

## Hiding on scroll

With `hideOnScroll` (the default) the bar slides down when the app's chrome is hidden and returns with it. The bar does not watch scrolling itself: it follows `chromeStore`, which a [NavigationStack](https://blamy.github.io/ui/#/navigation-stack) screen publishes as it scrolls. In your own scroller, call `chromeStore.set(true)` on scroll down and `chromeStore.set(false)` on scroll up, as the demo above does (import it from `@/lib/theme`, or `@brett_lamy/ui`). Pass `hideOnScroll={false}` for a bar that never moves.

## Accessibility

It is a react-aria `Tabs` list: `role="tablist"` with `role="tab"` buttons and `aria-selected`; Left and Right move between tabs and select them, and Tab leaves the list. Every tab's name comes from its `title` (its `id` when the title is not a string). The tablist's own label is fixed at "Tabs". Since no panel is rendered, link the screen you show to the selected tab yourself if assistive technology should connect them — for that, use [TabView](https://blamy.github.io/ui/#/tab-view), which renders real `tabpanel`s.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `items` | — | `{ id: string, title: ReactNode, icon: string }[]`. |
| `selected` | — | `id` of the selected tab. |
| `onSelect` | — | `(id: string) => void`. |
| `hideOnScroll` | `true` | Slide away while `chromeStore` says the chrome is hidden. |
| `className` / `style` | — | Applied to the bar itself (`data-slot="tab-view-bar"`), merged last. |

## Styling

The bar is a `TabViewBar` with `variant="bar"`: `absolute inset-x-0 bottom-0 z-120`, 62px tall, a hairline on top, the `bg-bar` surface with a backdrop blur. Its parts carry the `tab-view-*` slots (`tab-view-bar`, `tab-view-list`, `tab-view-tab`, `tab-view-indicator`) and react-aria state attributes such as `data-selected` on the tabs — see the [TabView](https://blamy.github.io/ui/#/tab-view) page.
