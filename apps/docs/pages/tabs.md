# Tabs

Switch between views, one at a time, on UI SDK's `Tabs`: a list of tabs, one selected, and the panel that belongs to it. One root covers every place tabs live, from a segmented control at the top of a settings card to the iOS tab bar at the bottom of an app, a side rail on a tablet and a Discord-style workspace switcher. `variant` picks the look and `side` says where the tabs sit around the panels.

Choose by what changes:

| You need | Use |
| --- | --- |
| Panels of content, one visible at a time (a settings page, a detail view) | `Tabs` with `variant="segmented"` or `"underline"` |
| The app's bottom tab bar, a side rail, a workspace switcher | `Tabs` with `variant="bar"`, `"rail"` or `"workspace"` (see "Bottom tab bar" below) |
| A value or a view mode with no panels (a filter, a time range) | [Segmented](https://blamy.github.io/ui/#/segmented): a radio group, not a tablist |
| Push and pop screens inside a tab | [NavigationStack](https://blamy.github.io/ui/#/navigation-stack) inside a `TabsPanel` |
| Tabs the user can drag between dockable panes (an editor) | [Workspace](https://blamy.github.io/ui/#/workspace) |

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

## In-page tabs

Put a `TabsTab` and a matching `TabsPanel` under the same `value`. `segmented` (the default) is the iOS control: a tinted track with a card under the selected tab, its label semibold. `underline` puts a tinted line under the selected label. Both draw their sliding indicator for you. A tab with `disabled` is dimmed and can't be selected; arrow keys still reach it, so it can be found. `icon` adds a glyph before the label.

{% demo src="tabs/variants" %}

```tsx
<Tabs variant="underline" defaultValue="members">
  <TabsList aria-label="Workspace">
    <TabsTab value="members" icon="person2">Members</TabsTab>
    <TabsTab value="billing">Billing</TabsTab>
    <TabsTab value="audit" disabled>Audit log</TabsTab>
  </TabsList>
  <TabsPanel value="members">…</TabsPanel>
  <TabsPanel value="billing">…</TabsPanel>
</Tabs>
```

`side="start"` (or `"end"`) stands the list up beside the panels; Up and Down then move between tabs.

## Controlled, with directional panels

`value` and `onValueChange` control the selection, so anything (a Next button, a route) can move it. `onValueChange` gets the new value and the details of the change: `details.reason` is `item-press`, `list-navigation` (arrow keys), `find-in-page`, `item-removed` or `imperative`, and `details.cancel()` refuses it. The value is `null` when nothing is selected. A panel knows which way the selection moved on screen (UI SDK's `data-activation-direction`) and slides in from that side: forward comes from the right, back from the left. Under reduced motion it cross-fades instead.

{% demo src="tabs/controlled" %}

```tsx
const [step, setStep] = useState<string | null>('plan')

<Tabs value={step} onValueChange={setStep}>…</Tabs>
```

To select a tab from outside the tree (a shortcut, the URL), pass a controller: `const tabs = createTabsController()`, `<Tabs controller={tabs}>`, then `tabs.select('billing')`.

## Bars

The other four looks put the list on a `TabsBar`, a surface that can also hold parts that aren't tabs: a `TabsHeader` (a logo), a `TabsAction` (a button such as Compose), a `TabsFooter` (the account) and `TabsSeparator`s between groups of tabs. In `bar` and `rail` a tab's `icon` sits over its label.

| `variant` | Default `side` | What it is |
| --- | --- | --- |
| `bar` | `bottom` | The iOS tab bar: 62px, translucent, pinned over the bottom of the host (its top with `side="top"`), hiding with the scroll. |
| `rail` | `start` | A side rail of icons over labels, with a tinted fill under the selected tab. |
| `workspace` | `start` | A 52px column of tiles (Discord, Slack); its list scrolls when the tiles outgrow it. |
| `plain` | `top` | No chrome: you style the bar and the tabs. |

Panels inside `TabsPanels` stack in the space the bar leaves and each scrolls on its own: the old one slides out while the new one slides in. A bare `TabsPanel` (as in the in-page looks) sits in the flow instead.

{% demo src="tabs/sections-and-rail" %}

```tsx
<Tabs variant={compact ? 'bar' : 'rail'} defaultValue="contacts">
  <TabsBar>
    <TabsList aria-label="Sections">
      <TabsTab value="contacts" icon="person">Contacts</TabsTab>
      <TabsTab value="recents" icon="clock">Recents</TabsTab>
    </TabsList>
  </TabsBar>
  <TabsPanels>
    <TabsPanel value="contacts"><ContactList /></TabsPanel>
    <TabsPanel value="recents"><Recents /></TabsPanel>
  </TabsPanels>
</Tabs>
```

## Bottom tab bar

The iOS tab bar is `Tabs variant="bar"`: icons over short labels on a blurred bar pinned to the bottom edge of the nearest positioned ancestor, floating over the screen. Give the host `relative` and leave 62px under the content (a `NavigationStackContent` takes `bottomInset`).

{% demo src="tabs/phone" %}

```tsx
<Tabs variant="bar" defaultValue="recents" className="absolute inset-0">
  <TabsBar>
    <TabsList aria-label="Phone">
      <TabsTab value="favorites" icon="star">Favorites</TabsTab>
      <TabsTab value="recents" icon="clock">Recents</TabsTab>
      <TabsTab value="contacts" icon="person">Contacts</TabsTab>
    </TabsList>
  </TabsBar>
  <TabsPanels>
    <TabsPanel value="favorites" keepMounted>…</TabsPanel>
    …
  </TabsPanels>
</Tabs>
```

When your router shows the screen, leave the panels out: the bar is then only the bar, and its tabs carry no `aria-controls`. `className="contents"` on `Tabs` keeps the root out of the layout, so the bar places itself against your host:

{% demo src="tabs/hide-on-scroll" %}

```tsx
<div className="relative h-dvh">
  <Screen tab={tab} />
  <Tabs variant="bar" value={tab} onValueChange={(next) => next && setTab(next)} className="contents">
    <TabsBar>
      <TabsList aria-label="Tabs">
        {items.map((it) => <TabsTab key={it.value} value={it.value} icon={it.icon}>{it.title}</TabsTab>)}
      </TabsList>
    </TabsBar>
  </Tabs>
</div>
```

### Hiding with the scroll

`TabsBar` in the `bar` look follows the kit's chrome state: scrolling down hides it, scrolling up (or reaching the top) brings it back, in step with a [NavigationStack](https://blamy.github.io/ui/#/navigation-stack)'s bar above. It needs no wiring: a NavigationStack page publishes the state as it scrolls. In a scroller of your own, call `chromeStore.set(true)` on a scroll down and `chromeStore.set(false)` on a scroll up, as the demo above does (import it from `@/lib/theme`, or `@brett_lamy/ui`). `hideOnScroll={false}` pins the bar. Anything else that should duck out of the way reads the same flag with `useChromeHidden()`.

### Tabs and navigation stacks

Where you nest them decides how pushes interact with the bar; there is no mode flag.

**Bar persists.** Each tab's panel holds a `NavigationStack` (`keepMounted` keeps its state while another tab shows), so pushes slide under the bar and the bar stays put: UIKit's `tabBarController(navController)` shape.

**Bar rides the root.** Put the tabs inside the stack's root screen and a push covers the bar and the root together: `navController(tabBarController)`.

## Rail

A mail client's leading rail: a logo in `TabsHeader`, the mailboxes as tabs, Compose as a `TabsAction` (a button, not a tab), and the account pinned to the far end in `TabsFooter`.

{% demo src="tabs/mail-rail" %}

`side="end"` puts the rail on the trailing edge, here an icon-only inspector beside an editor. `TabsSeparator` splits the groups and the arrow keys pass over it. A tab with no text needs an `aria-label`.

{% demo src="tabs/editor-inspector" %}

## Workspace switcher

`variant="workspace"` is the rail for a [ChatShell](https://blamy.github.io/ui/#/chat-shell): a 52px muted column. The footer follows the last tile, `TabsSeparator` is the short rule under Home, `TabsAction` the dashed "Add" tile, and the `TabsPill` on each tab's leading edge (a nub for `attention`, taller on hover, full when selected) rides the bouncy spring. On touch, the tiles' and the action's hit areas grow to 44px. Custom tiles are the tabs' content, and the rail gets tab semantics for free: one tab stop, Up and Down between servers, Home and End to jump.

{% demo src="tabs/chat-workspaces" %}

```tsx
<Tabs variant="workspace" value={server} onValueChange={setServer}>
  <TabsBar>
    <TabsList aria-label="Workspaces">
      <TabsTab value="home" aria-label="Direct Messages">
        <TabsPill />
        <Tile><Icon name="bubble-oval" size={17} sw={2} /></Tile>
      </TabsTab>
      <TabsSeparator />
      {servers.map((s) => (
        <TabsTab key={s.id} value={s.id} aria-label={s.name}>
          <TabsPill attention={s.unread} />
          <Tile color={s.color} mentions={s.mentions}>{s.label}</Tile>
        </TabsTab>
      ))}
    </TabsList>
    <TabsFooter>
      <TabsAction aria-label="Add a server" icon="plus" onClick={addServer} />
    </TabsFooter>
  </TabsBar>
</Tabs>
```

`Tile` is yours: a circle that reads `group-hover:` and `group-data-selected:` to morph into a rounded square in its color (the discord-clone block ships one as `WorkspaceTile`). Put the rail in a `chat` theme scope (`ChatShell` opens one) and it follows light and dark.

## Custom tabs

A function as a tab's children gets the tab's state (`selected`, `disabled`) and draws the whole tab. Put one `TabsIndicator` in the list and it slides to the selected tab; in `segmented` and `underline` your `TabsIndicator` replaces the one they draw. Its `className` styles the mark, which sits in a frame the size of the selected tab, so `inset-x-2.5` or `-start-1.5` place it against that tab.

{% demo src="tabs/inbox-badges" %}

```tsx
<Tabs variant="plain" defaultValue="unread">
  <TabsBar>
    <TabsList aria-label="Inbox">
      <TabsTab value="unread">
        {({ selected }) => <>Unread <Badge variant={selected ? 'default' : 'secondary'}>7</Badge></>}
      </TabsTab>
      …
      <TabsIndicator className="inset-x-2.5" />
    </TabsList>
    <TabsFooter><TabsAction aria-label="Filter settings" icon="sliders" /></TabsFooter>
  </TabsBar>
  …
</Tabs>
```

Or style off the tab itself with `group-data-selected/tab:`, `group-hover/tab:` and `group-focus-visible/tab:` on what's inside it (every tab is a `group/tab`), or read its state in a nested component with `useTabsTab()`. A tab is UI SDK's `button` with the tab role (reset to take the host's font); `render={<a href="/inbox" />}` makes it a link and `render={<div />}` a tab that holds controls of its own.

## Order

The bar and the panels may be written either way round: tabs and panels find each other by `value` wherever they sit. A `TabsBar` (or a bare `TabsList`) that is a direct child of `Tabs` and comes after the panels is still laid out ahead of them, so `side` keeps meaning what it says. When the bar is nested deeper, lay the wrapper out yourself:

{% demo src="tabs/panels-first" %}

## Accessibility

UI SDK gives the list `role="tablist"` (with `aria-orientation` when vertical), each tab `role="tab"` with `aria-selected`, and each panel `role="tabpanel"` labelled by its tab; a tab points at its panel with `aria-controls` only while that panel is in the page, so a bar with no panels stays valid. The list is one tab stop. The arrow keys follow the orientation (Left and Right when the tabs sit at the top or bottom, Up and Down at the start or end) and select as they move (`activation="manual"` waits for Enter or Space), wrapping at the ends unless `loop={false}`; Home and End jump to the ends. In right-to-left text the arrows follow the reading direction. Name the `TabsList` with `aria-label` or `aria-labelledby`, and give a tab with no text (an icon, a tile) an `aria-label`: `icon` is decorative and left out of the name. A panel with nothing focusable inside is a tab stop itself and shows a focus ring. The separator, the indicator and the pill are hidden from assistive technology; `TabsAction` is an ordinary button outside the tablist and needs its own name.

## Props

### Tabs

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `segmented` | `segmented`, `underline`, `bar`, `rail`, `workspace` or `plain`; read by every part. |
| `side` | by `variant` | `top`, `bottom`, `start` or `end`: where the tabs sit around the panels. It sets the orientation (`top`/`bottom` horizontal, `start`/`end` vertical). Defaults to `bottom` for `bar`, `start` for `rail` and `workspace`, `top` otherwise. |
| `value` / `defaultValue` / `onValueChange` | first enabled tab | Controlled / initial selection, by tab `value`. `onValueChange(value, details)`. |
| `activation` | `automatic` | `manual` selects on Enter or Space instead of on focus. |
| `loop` | `true` | Whether arrow keys wrap from the last tab to the first. |
| `hiddenUntilFound` | `false` | Keeps hidden panels in the page so the browser's find in page can match their text and select their tab. |
| `controller` | — | From `createTabsController()`: `select(value)`, `getValue()`, `focus()`. |

### Parts

| Part | Notes |
| --- | --- |
| `TabsList` | The tablist; needs a name (`aria-label`). `segmented` fills its width with equal tabs; `underline` sizes tabs to their labels with a 20px gap. `segmented` and `underline` draw the sliding indicator after the children, unless one of them is a `TabsIndicator`. |
| `TabsTab` | `value` (matches its panel), `disabled`, and `icon`: a glyph name from [Icons](https://blamy.github.io/ui/#/icons) or a node, over the label in `bar` and `rail`, before it elsewhere. Children are the label; a function child gets the tab's state and draws the whole tab. |
| `TabsTabIcon` | Wraps a decorative icon in a custom tab so it stays out of the tab's name; `mirror` flips it in right-to-left text. |
| `TabsIndicator` | One mark that slides to the selected tab, as a direct child of `TabsList`: the card in `segmented`, a line along the bottom (or the end edge, vertically) in `underline`, a short underline or a leading bar elsewhere. `className` and `style` go to the mark. |
| `TabsPanel` | `value`; only the selected panel is mounted unless you pass `keepMounted` (or `hiddenUntilFound`). Flows on its own; stacks inside `TabsPanels`. |
| `TabsPanels` | The box the panels share: they stack in it, scroll on their own, and cross-slide. It fills the space the bar leaves. |
| `TabsBar` | The surface around the list, in the root's look. `hideOnScroll` (default `true`) applies to `bar`. |
| `TabsHeader` / `TabsFooter` | Content before the list, and at the far end of the bar (in `workspace`, right after the list). |
| `TabsAction` | A button in the bar that isn't a tab ("Add server", "Compose"): `icon`, children as its label, `onClick`, `disabled`. |
| `TabsSeparator` | A decorative divider inside the list; arrow keys pass over it. |
| `TabsPill` | Inside a tab: the Discord pill on its leading edge. `attention` shows the unread nub while the tab is neither hovered nor selected. |

Every part takes `className` (merged last; on UI SDK's parts a string or a function of the part's state, such as `({ selected }) => …`), `style`, and `ref`; UI SDK's parts also take `render`.

### Hooks

| Hook | Returns |
| --- | --- |
| `useTabs()` | `{ variant, side, orientation }` of the enclosing `Tabs`, or `null` outside one. |
| `useTabsTab()` | Inside a `TabsTab`: its UI SDK state, `{ selected, disabled }`; `null` outside one. |

## Styling

Slots are UI SDK's: `data-slot="tabs"`, `tabs-list`, `tabs-tab`, `tabs-tab-icon`, `tabs-indicator`, `tabs-panel`, and the kit's own `tabs-bar`, `tabs-panels`, `tabs-header`, `tabs-footer`, `tabs-pill`. The root and the bar carry `data-variant` and `data-side`; the bar `data-orientation`, and `data-hidden` while it is hidden by the scroll. Tabs carry `data-selected` and `data-disabled`, every tab part `data-orientation` and `data-activation-direction` (`left`, `right`, `up`, `down` or `none`); hover, press and keyboard focus are the native `hover:`, `active:` and `focus-visible:`. A panel gets `data-starting-style` for its first frame and, stacked, `data-ending-style` until it has left, each offset toward the side `data-activation-direction` names. The indicator's frame is placed from the `--active-tab-left`, `-top`, `-width` and `-height` variables UI SDK measures, so it slides and resizes between unequal tabs on the smooth spring. `tabsVariants`, `tabsBarVariants`, `tabsListVariants`, `tabsTabVariants`, `tabsIndicatorVariants`, `tabsPillVariants` and `tabsActionVariants` give the classes for each look.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `tabsVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
flex min-h-0 min-w-0 [&>[data-slot=tabs-panels]~[data-slot=tabs-bar]]:-order-1 [&>[data-slot=tabs-panels]~[data-slot=tabs-list]]:-order-1 [&>[data-slot=tabs-panel]~[data-slot=tabs-list]]:-order-1
```

**`side`** — default `top`

| Value | Adds |
| --- | --- |
| `top` (default) | `flex-col` |
| `bottom` | `flex-col-reverse` |
| `start` | `flex-row` |
| `end` | `flex-row-reverse` |

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | `gap-4` |
| `underline` | `gap-4` |
| `bar` | — |
| `rail` | — |
| `workspace` | — |
| `plain` | — |

### `tabsBarVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
box-border
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `segmented` | `inline` |
| `underline` | `inline` |
| `bar` | `cn( 'absolute inset-x-0 bottom-0 z-120 flex data-[side=top]:top-0 data-[side=top]:bottom-auto transition-transform duration-spring-smooth ease-spring-s…` |
| `rail` | `relative flex w-19 shrink-0 flex-col gap-1 bg-bar py-2 data-[side=end]:border-s data-[side=start]:border-e border-border` |
| `workspace` | `flex w-13 shrink-0 flex-col items-center gap-2 border-e border-border bg-muted px-0 py-2.5` |
| `plain` (default) | `inline` |

### `tabsListVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
relative outline-none
```

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | `cn('flex', segmentTrackVariants())` |
| `underline` | `isolate flex gap-5 shadow-hairline-b data-[orientation=vertical]:flex-col data-[orientation=vertical]:gap-0 data-[orientation=vertical]:border-e data-[orientat…` |
| `bar` | `flex flex-1` |
| `rail` | `flex flex-col gap-1 px-1.5` |
| `workspace` | `flex min-h-0 w-full flex-col items-center gap-2 overflow-y-auto overscroll-contain -mt-1 -mb-1.5 pt-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidd…` |
| `plain` | `flex data-[orientation=vertical]:flex-col` |

### `tabsTabVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
group/tab relative box-border cursor-pointer border-0 bg-transparent [font-family:inherit] outline-none data-disabled:cursor-default
```

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | `segmentItemVariants()` |
| `underline` | `cn( 'bl-btn -mb-px flex h-10 items-center justify-center gap-1.5 px-0.5 py-0 text-subhead leading-[inherit] font-semibold whitespace-nowrap hover:not…` |
| `bar` | `cn( 'bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] p-0 text-center leading-[normal] data-selected:text-primary focus-visible:roun…` |
| `rail` | `cn( 'bl-btn flex flex-col items-center justify-center gap-[3px] rounded-panel px-1 pt-[7px] pb-1.5 text-center leading-[normal] hover:not-data-select…` |
| `workspace` | `group flex w-full shrink-0 justify-center p-0 text-inherit pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5` |
| `plain` | `p-0 text-inherit` |

### `tabsIndicatorVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
absolute
```

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | `cn('inset-0', segmentIndicatorVariants())` |
| `underline` | `bg-primary` |
| `bar` | `bg-primary` |
| `rail` | `bg-primary` |
| `workspace` | `bg-primary` |
| `plain` | `bg-primary` |

**`orientation`** — default `horizontal`

| Value | Adds |
| --- | --- |
| `horizontal` (default) | — |
| `vertical` | — |

4 compound variants — see the source.

### `tabsPillVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
pointer-events-none absolute start-0 top-1/2 h-0 w-1 -translate-y-1/2 rounded-e-sm bg-foreground opacity-0 transition-[height,opacity] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none data-attention:h-1.5 data-attention:opacity-100 group-hover/tab:not-data-selected:h-3.5 group-hover/tab:not-data-selected:opacity-100 data-selected:h-7 data-selected:opacity-100
```

No variants.

### `tabsActionVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/45 data-disabled:cursor-default data-disabled:opacity-40
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `segmented` | `bl-btn border-0 bg-transparent p-0 [font-family:inherit] text-muted-foreground hover:not-data-disabled:text-foreground` |
| `underline` | `bl-btn border-0 bg-transparent p-0 [font-family:inherit] text-muted-foreground hover:not-data-disabled:text-foreground` |
| `bar` | `bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 leading-[normal] [font-family:inherit] text-muted-foreground acti…` |
| `rail` | `bl-btn mx-1.5 flex flex-col items-center justify-center gap-[3px] rounded-panel border-0 bg-transparent px-1 pt-[7px] pb-1.5 leading-[normal] [font-family:inhe…` |
| `workspace` | `relative grid size-[34px] shrink-0 place-items-center rounded-[17px] border border-dashed border-border bg-transparent text-muted-foreground [transition:border…` |
| `plain` (default) | `bl-btn border-0 bg-transparent p-0 [font-family:inherit]` |
