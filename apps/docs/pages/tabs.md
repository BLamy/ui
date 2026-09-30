# Tabs

Tabs with panels, on react-aria's `Tabs`: a list of tabs, one selected, and the panel that belongs to it. A selection indicator slides between tabs, and a panel enters from the side of the newly selected tab. Two looks share the parts — `segmented`, the iOS control (a tinted track with a card under the selected tab), and `underline`, a bar under the labels with a tinted line.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/tabs.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Tabs, TabList, Tab, TabPanel } from '@/components/ui/tabs'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Tabs, TabList, Tab, TabPanel } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

Four components cover "pick one of several", so choose by what changes:

| You need | Use |
| --- | --- |
| Panels of content, one visible at a time (a settings page, a detail view) | `Tabs` (this page) |
| A value or a view mode with no panels — a filter, a time range | [Segmented](https://blamy.github.io/ui/#/segmented) |
| The app's bottom navigation bar, in one line | [TabBar](https://blamy.github.io/ui/#/tab-bar) |
| Bottom bar, vertical rail or custom tabs with panels, swiping between them | [TabView](https://blamy.github.io/ui/#/tab-view) |

## Variants

Put a `Tab` and a matching `TabPanel` under the same `id`. `variant` goes on `Tabs` and is shared with its `TabList` and `Tab`s. A tab with `isDisabled` is dimmed and skipped.

{% demo src="tabs/variants" %}

```tsx
<Tabs variant="underline" defaultSelectedKey="members">
  <TabList aria-label="Workspace">
    <Tab id="members">Members</Tab>
    <Tab id="billing">Billing</Tab>
    <Tab id="audit" isDisabled>Audit log</Tab>
  </TabList>
  <TabPanel id="members">…</TabPanel>
  <TabPanel id="billing">…</TabPanel>
</Tabs>
```

## Controlled, with directional panels

`selectedKey` and `onSelectionChange` control the selection, so anything — a Next button, a route — can move it. `TabPanel` reads which way the selection moved (by the order of the tabs) and slides in from that side: forward comes from the right, back from the left. Under reduced motion it cross-fades instead.

{% demo src="tabs/controlled" %}

```tsx
const [key, setKey] = useState<Key>('plan')

<Tabs selectedKey={key} onSelectionChange={setKey}>…</Tabs>
```

## Accessibility

react-aria gives the list `role="tablist"`, each tab `role="tab"` with `aria-selected`, and each panel `role="tabpanel"` labelled by its tab. Tab moves focus into the list (onto the selected tab) and then on to the panel; Left and Right move between tabs and select them as they go (`keyboardActivation="manual"` on `Tabs` changes that to Enter or Space); Home and End jump to the ends. Give the `TabList` an `aria-label` or `aria-labelledby`. Panels are focusable, so a panel without focusable content is still reachable, and show a focus ring.

## Props

### Tabs

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `segmented` | `segmented` or `underline`; read by `TabList` and every `Tab`. |
| `selectedKey` / `defaultSelectedKey` / `onSelectionChange` | first tab | Controlled / initial selection, by tab `id`. |
| `keyboardActivation` | `automatic` | `manual` selects on Enter or Space instead of on focus. |
| `isDisabled` / `disabledKeys` | — | Disable all tabs / chosen tabs. |

### TabList, Tab, TabPanel

| Part | Notes |
| --- | --- |
| `TabList` | Needs an accessible name (`aria-label`). `segmented` fills its width and gives tabs equal share; `underline` sizes tabs to their labels with a 20px gap. |
| `Tab` | `id` (matches its panel) and `isDisabled`. The sliding indicator is rendered inside each tab. |
| `TabPanel` | `id`; only the selected panel is mounted unless you pass `shouldForceMount`. |

All parts accept `className` (merged last, or a react-aria render function) and `style`. `Tabs` is a flex column with a 16px gap; the list and panel are siblings in it. For a vertical rail, use [TabView](https://blamy.github.io/ui/#/tab-view) — the list here is laid out horizontally.

## Styling

Slots: `data-slot="tabs"`, `tab-list`, `tab`, `tab-indicator`, `tab-panel`. Tabs expose react-aria's `data-selected`, `data-hovered`, `data-pressed`, `data-focus-visible` and `data-disabled`; the panel gets `data-entering` while it animates in. The indicator is react-aria's `SelectionIndicator` behind the labels (the list is `isolate`), so it slides and resizes between unequal tabs on the smooth spring. `tabsListVariants` and `tabVariants` give the classes for each look.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `tabsListVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
isolate flex
```

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | `gap-0.5 rounded-[9px] bg-secondary p-0.5` |
| `underline` | `gap-5 shadow-hairline-b` |

### `tabVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
bl-btn relative box-border flex cursor-pointer items-center justify-center gap-1.5 font-semibold whitespace-nowrap outline-none transition-[color] duration-spring-snappy ease-spring-snappy data-disabled:cursor-default data-disabled:opacity-40
```

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | `flex-1 rounded-[7px] px-3 py-[5px] text-footnote text-foreground data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45` |
| `underline` | `-mb-px h-10 px-0.5 text-subhead text-muted-foreground data-hovered:text-foreground data-selected:text-primary data-focus-visible:rounded-md data-focus-visible:…` |
