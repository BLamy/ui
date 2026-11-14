# Tabs

Tabs with panels, on UI SDK's `Tabs`: a list of tabs, one selected, and the panel that belongs to it. A selection indicator slides between tabs, and a panel enters from the side of the newly selected tab. Two looks share the parts — `segmented`, the iOS control (a tinted track with a card under the selected tab), and `underline`, a bar under the labels with a tinted line.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/tabs.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Tabs, TabsList, TabsTab, TabsPanel,
} from '@/components/ui/tabs'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Tabs, TabsList, TabsTab, TabsPanel } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

Four components cover "pick one of several", so choose by what changes:

| You need | Use |
| --- | --- |
| Panels of content, one visible at a time (a settings page, a detail view) | `Tabs` (this page) |
| A value or a view mode with no panels — a filter, a time range | [Segmented](https://blamy.github.io/ui/#/segmented) |
| The app's bottom navigation bar, in one line | [TabBar](https://blamy.github.io/ui/#/tab-bar) |
| Bottom bar, vertical rail or custom tabs with panels | [TabView](https://blamy.github.io/ui/#/tab-view) |

## Variants

Put a `TabsTab` and a matching `TabsPanel` under the same `value`. `variant` goes on `Tabs` and is shared with its `TabsList` and `TabsTab`s. A tab with `disabled` is dimmed and can't be selected; arrow keys still reach it, so it can be found.

{% demo src="tabs/variants" %}

```tsx
<Tabs variant="underline" defaultValue="members">
  <TabsList aria-label="Workspace">
    <TabsTab value="members">Members</TabsTab>
    <TabsTab value="billing">Billing</TabsTab>
    <TabsTab value="audit" disabled>Audit log</TabsTab>
  </TabsList>
  <TabsPanel value="members">…</TabsPanel>
  <TabsPanel value="billing">…</TabsPanel>
</Tabs>
```

## Controlled, with directional panels

`value` and `onValueChange` control the selection, so anything — a Next button, a route — can move it. `onValueChange` gets the new value and the details of the change: `details.reason` is `item-press`, `list-navigation` (arrow keys), `find-in-page`, `item-removed` or `imperative`, and `details.cancel()` refuses it. The value is `null` when nothing is selected. `TabsPanel` knows which way the selection moved on screen (UI SDK's `data-activation-direction`) and slides in from that side: forward comes from the right, back from the left. Under reduced motion it cross-fades instead.

{% demo src="tabs/controlled" %}

```tsx
const [step, setStep] = useState<string | null>('plan')

<Tabs value={step} onValueChange={setStep}>…</Tabs>
```

To select a tab from outside the tree (a shortcut, the URL), pass a controller: `const tabs = createTabsController()`, `<Tabs controller={tabs}>`, then `tabs.select('billing')`.

## Accessibility

UI SDK gives the list `role="tablist"`, each tab `role="tab"` with `aria-selected`, and each panel `role="tabpanel"` labelled by its tab; a tab points at its panel with `aria-controls` only while that panel is in the page. Tab moves focus into the list (onto the selected tab) and then on to the panel; Left and Right move between tabs and select them as they go (`activation="manual"` on `Tabs` changes that to Enter or Space), wrapping at the ends unless `loop={false}`; Home and End jump to the ends. In right-to-left text the arrows follow the reading direction. Give the `TabsList` an `aria-label` or `aria-labelledby`. A panel with nothing focusable inside is a tab stop itself, and shows a focus ring.

## Props

### Tabs

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `segmented` | `segmented` or `underline`; read by `TabsList` and every `TabsTab`. |
| `value` / `defaultValue` / `onValueChange` | first enabled tab | Controlled / initial selection, by tab `value`. `onValueChange(value, details)`. |
| `activation` | `automatic` | `manual` selects on Enter or Space instead of on focus. |
| `orientation` | `horizontal` | `vertical` moves with Up and Down and lays the root out as a row. |
| `loop` | `true` | Whether arrow keys wrap from the last tab to the first. |
| `hiddenUntilFound` | `false` | Keeps hidden panels in the page so the browser's find in page can match their text and select their tab. |
| `controller` | — | From `createTabsController()`: `select(value)`, `getValue()`, `focus()`. |

### TabsList, TabsTab, TabsTabIcon, TabsPanel

| Part | Notes |
| --- | --- |
| `TabsList` | Needs an accessible name (`aria-label`). `segmented` fills its width and gives tabs equal share; `underline` sizes tabs to their labels with a 20px gap. It draws the sliding indicator, after its children. |
| `TabsTab` | `value` (matches its panel) and `disabled`. It is UI SDK's `button` with the tab role (`type="button"`, so it never submits a form), reset to take the host's font and line height; `render={<a href="…" />}` makes it a link, `render={<div />}` a tab that holds controls of its own. |
| `TabsTabIcon` | Wraps a decorative icon so it stays out of the tab's name; `mirror` flips it in right-to-left text. An icon-only tab needs an `aria-label`. |
| `TabsPanel` | `value`; only the selected panel is mounted unless you pass `keepMounted` (or `hiddenUntilFound`). |

All parts accept `className` (merged last; a string, or a function of the part's state such as `({ selected }) => …`), `style` and `render`. `Tabs` is a flex column with a 16px gap; the list and panel are siblings in it. For a vertical rail, use [TabView](https://blamy.github.io/ui/#/tab-view).

## Styling

Slots are UI SDK's: `data-slot="tabs"`, `tabs-list`, `tabs-tab`, `tabs-tab-icon`, `tabs-indicator`, `tabs-panel`. Tabs carry `data-selected` and `data-disabled`, every part `data-orientation` and `data-activation-direction` (`left`, `right`, `up`, `down` or `none`); hover, press and keyboard focus are the native `hover:`, `active:` and `focus-visible:`. A panel gets `data-starting-style` for the first frame it shows, which is what its entrance transitions from. The indicator is one `TabsIndicator` behind the labels (the list is `isolate`), placed from the `--active-tab-left`, `-top`, `-width` and `-height` variables UI SDK measures, so it slides and resizes between unequal tabs on the smooth spring. `tabsListVariants`, `tabsTabVariants` and `tabsIndicatorVariants` give the classes for each look.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `tabsListVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
relative isolate flex
```

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | `gap-0.5 rounded-[9px] bg-secondary p-0.5` |
| `underline` | `gap-5 shadow-hairline-b` |

### `tabsTabVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
bl-btn relative box-border flex cursor-pointer items-center justify-center gap-1.5 border-0 bg-transparent [font-family:inherit] leading-[inherit] font-semibold whitespace-nowrap outline-none transition-[color] duration-spring-snappy ease-spring-snappy data-disabled:cursor-default data-disabled:opacity-40
```

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | `flex-1 rounded-[7px] px-3 py-[5px] text-footnote text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/45` |
| `underline` | `-mb-px h-10 px-0.5 py-0 text-subhead text-muted-foreground hover:not-data-selected:not-data-disabled:text-foreground data-selected:text-primary focus-visible:r…` |

### `tabsIndicatorVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
absolute top-0 left-0 -z-1 w-(--active-tab-width) translate-x-(--active-tab-left) transition-[translate,width,height] duration-spring-smooth ease-spring-smooth data-[activation-direction=none]:transition-none motion-reduce:transition-none
```

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | `h-(--active-tab-height) translate-y-(--active-tab-top) rounded-[7px] bg-segment shadow-[0_1px_4px_black] shadow-black/14` |
| `underline` | `h-[2px] translate-y-[calc(var(--active-tab-top)+var(--active-tab-height)-100%)] bg-primary` |
