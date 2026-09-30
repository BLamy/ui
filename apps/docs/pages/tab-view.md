# TabView

A compositional tab container on react-aria's `Tabs`. The same parts make the iOS bottom bar, a vertical rail along the left edge, or a fully custom bar — a Discord-style workspace rail for a [ChatShell](https://blamy.github.io/ui/#/chat-shell) is one of them.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/tab-view.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  TabView, TabViewBar, TabViewList, TabViewTab,
} from '@/components/ui/tab-view'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  TabView, TabViewBar, TabViewList, TabViewTab,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

```tsx
import {
  TabView, TabViewBar, TabViewList, TabViewTab, TabViewPanels, TabViewPanel,
} from '@brett_lamy/ui'

<TabView orientation="vertical" defaultSelectedKey="contacts">
  <TabViewBar>
    <TabViewList aria-label="Sections">
      <TabViewTab id="contacts" icon="person" title="Contacts" />
      <TabViewTab id="recents" icon="clock" title="Recents" />
    </TabViewList>
  </TabViewBar>
  <TabViewPanels>
    <TabViewPanel id="contacts"><ContactList /></TabViewPanel>
    <TabViewPanel id="recents"><Recents /></TabViewPanel>
  </TabViewPanels>
</TabView>
```

## Parts

| Part | What it is |
| --- | --- |
| `TabView` | Root (react-aria `Tabs`). `selectedKey` / `defaultSelectedKey` / `onSelectionChange`, `orientation`, `placement`. |
| `TabViewBar` | The bar's surface: `variant="bar"` (iOS bottom bar, hides with the scroll), `"rail"` (vertical, icons over labels) or `"plain"` (no chrome — you style it). Defaults to `bar` when horizontal, `rail` when vertical. |
| `TabViewList` | The tablist. Arrow keys follow the orientation — Left/Right horizontally, Up/Down vertically. |
| `TabViewTab` | A tab. `icon` + `title` render the default look; `children` (or a render function) replace it entirely. Exposes `data-selected`, `data-hovered`, `data-pressed`, `data-focus-visible`. |
| `TabViewIndicator` | Put inside a tab. `variant="bar"` is react-aria's `SelectionIndicator`: an underline (horizontal) or leading bar (vertical) that slides between tabs. `variant="pill"` is the Discord pill on the leading edge: a nub for `attention`, taller on hover, full height when selected. |
| `TabViewSeparator` | A divider inside the list. Arrow keys skip it. |
| `TabViewAction` | A button in the bar that isn't a tab ("Add server", "Compose"). |
| `TabViewHeader` / `TabViewFooter` | Non-tab content before the list and at the far end of the bar (logo, account button). |
| `TabViewPanels` / `TabViewPanel` | The content, one panel per tab `id`. Pass `shouldForceMount` to keep a panel's state while it's hidden. |

Descendants read the root with `useTabView()` (`orientation`, `placement`, `variant`); anything inside a tab reads that tab's state with `useTabViewTab()`.

## Orientation and placement

`placement` says where the bar sits: `top` and `bottom` are horizontal, `start` and `end` vertical. `orientation="vertical"` on its own means `start`, so the bar runs down the left edge (the right edge in RTL).

```tsx
<TabView>                       // horizontal, bar at the bottom (default)
<TabView placement="top">       // horizontal, bar on top
<TabView orientation="vertical"> // vertical rail on the leading edge
<TabView placement="end">       // vertical rail on the trailing edge
```

## Order

The bar and the panels may be written either way round. react-aria mints the ids the panels point at while it renders the tablist, so the tablist has to render first: a `TabViewBar` (or `TabViewList`) that is a direct child of `TabView` is moved ahead of the panels — which also keeps `placement` right — and when the bar is nested deeper and comes after the panels, `TabViewPanels` leaves a box-less placeholder where you wrote it and the panels render after the tablist, into that placeholder.

```tsx
<TabView placement="top">
  <TabViewPanels style={{ order: 2 }}>…</TabViewPanels>
  <header style={{ order: 1 }}>
    <Logo />
    <TabViewBar variant="plain"><TabViewList aria-label="Sections">…</TabViewList></TabViewBar>
  </header>
</TabView>
```

{% demo src="tab-view/panels-first" %}

## Custom tabs

A render function gets the tab's state, so a tab can look like anything:

```tsx
<TabViewTab id="unread" textValue="Unread">
  {({ isSelected }) => (
    <>
      Unread <Badge variant={isSelected ? 'default' : 'secondary'}>7</Badge>
      <TabViewIndicator />   {/* slides to the selected tab */}
    </>
  )}
</TabViewTab>
```

Or style off the data attributes: give the tab `className="group"` and use `group-data-selected:` / `group-data-hovered:` on what's inside it.

## Building a Discord rail

`TabViewBar variant="workspace"` is the rail: a 52px muted column with a hairline. Its list scrolls on its own once the tiles outgrow the rail, the footer follows the last tile, `TabViewSeparator` is the short rule under Home, `TabViewAction` the dashed "Add" tile, and the `pill` indicator on the leading edge rides the bouncy spring. Custom tiles are the tabs' content; the rail gets tab semantics for free: one tab stop, Up/Down between servers, Home/End to jump.

```tsx
<TabView
  orientation="vertical" selectedKey={server} onSelectionChange={setServer}
>
  <TabViewBar variant="workspace">
    <TabViewList aria-label="Workspaces">
      <TabViewTab id="home" textValue="Direct Messages">
        <TabViewIndicator variant="pill" />
        <Tile><Icon name="bubble-oval" size={17} sw={2} /></Tile>
      </TabViewTab>
      <TabViewSeparator />
      {servers.map((s) => (
        <TabViewTab key={s.id} id={s.id} textValue={s.name}>
          <TabViewIndicator variant="pill" attention={s.unread} />
          <Tile color={s.color} mentions={s.mentions}>{s.label}</Tile>
        </TabViewTab>
      ))}
    </TabViewList>
    <TabViewFooter>
      <TabViewAction aria-label="Add a server" icon="plus" onPress={addServer} />
    </TabViewFooter>
  </TabViewBar>
</TabView>
```

`Tile` is yours: a circle that reads `group-data-hovered:` / `group-data-selected:` to morph into a rounded square in its color (the examples below carry a copy; the discord-clone block ships it as `WorkspaceTile`). Put the rail in a `chat` theme scope — `ChatShell` opens one — and it follows light and dark.

## TabBar and navigation stacks

`TabBar` is the one-line iOS bar — a `TabView` with a `bar` and no panels, for hosts that own their content:

```jsx
<TabBar items={tabs} selected={tab} onSelect={setTab}/>
```

Tabs are just containers — where you nest them decides how pushes interact with the bar. There is no mode flag.

**Bar persists.** Each tab owns a `NavigationStack`, so pushes slide under the bar and the bar stays put — UIKit's `tabBarController(navController)` shape. Tab state survives switching away and back.

**Bar rides the root.** Put the tabs inside the stack's root screen and a push covers bar and root together — `navController(tabBarController)`. The Contacts demo can swap between both trees live in **Settings → Composition**; app state survives the remount because the demo owns it.

## Hiding with the scroll

The `bar` variant follows the scrolling screen: down hides it, up brings it back, in step with the nav bar above. It needs no wiring — the bar subscribes to the kit's chrome state wherever it is mounted:

```jsx
// follows the scroll
<TabBar items={tabs} selected={tab} onSelect={setTab}/>
// pinned
<TabBar items={tabs} selected={tab} onSelect={setTab} hideOnScroll={false}/>
// pinned, composed
<TabViewBar hideOnScroll={false}>…</TabViewBar>
```

Anything else that should duck out of the way can read the same flag with `useChromeHidden()`.

## Live example

Switch orientation, then try the Discord rail — click the tiles or use the arrow keys:

{% demo src="tab-view/sections-and-rail" %}

## Examples

### Bottom tab bar

The iOS Phone app: four tabs over a `bar` that floats at the bottom of the host. Each panel is its own scroller, so leave room for the bar's 62px.

{% demo src="tab-view/phone-tab-bar" %}

### Top tabs with badges

`placement="top"` with a `plain` bar. Each tab is a render function, so its badge can follow `isSelected`, and one `TabViewIndicator` slides between tabs. `TabViewFooter` pushes an action to the far end.

{% demo src="tab-view/inbox-badges" %}

### Vertical rail with header, action and footer

A mail client's leading rail: a logo in `TabViewHeader`, the mailboxes as tabs, Compose as a `TabViewAction` (a button, not a tab), and the account pinned to the bottom with `TabViewFooter`.

{% demo src="tab-view/mail-rail" %}

### Trailing inspector

`placement="end"` puts an icon-only rail on the trailing edge of an editor, with the panels beside it. `TabViewSeparator` splits the groups and arrow keys skip it.

{% demo src="tab-view/editor-inspector" %}

### Chat workspaces

A vertical `TabView` with a `workspace` bar beside a channel column, in a `chat` theme scope (`themeScopeProps({ scope: 'chat', appearance })`) that keeps it in step with light and dark.

{% demo src="tab-view/chat-workspaces" %}

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `tabViewVariants`

Defined in `@/components/ui/tab-view`. Base classes:

```text
flex min-h-0 min-w-0
```

**`placement`** — default `bottom`

| Value | Adds |
| --- | --- |
| `top` | `flex-col` |
| `bottom` (default) | `flex-col-reverse` |
| `start` | `flex-row` |
| `end` | `flex-row-reverse` |

### `tabViewBarVariants`

Defined in `@/components/ui/tab-view`. Base classes:

```text
box-border
```

**`variant`** — default `bar`

| Value | Adds |
| --- | --- |
| `bar` (default) | `absolute inset-x-0 bottom-0 z-120 flex h-[62px] [border-top:1px_solid_var(--border)] bg-bar pb-1 backdrop-blur-[20px] backdrop-saturate-[1.7] transition-transf…` |
| `rail` | `relative flex w-[76px] shrink-0 flex-col gap-1 bg-bar py-2 data-[placement=end]:[border-left:1px_solid_var(--border)] data-[placement=start]:[border-right:1px_…` |
| `workspace` | `flex w-[52px] shrink-0 flex-col items-center gap-[8px] border-r border-border bg-muted px-0 py-[10px]` |
| `plain` | `flex shrink-0 data-[orientation=vertical]:flex-col` |

### `tabViewListVariants`

Defined in `@/components/ui/tab-view`. Base classes:

```text
outline-none
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `bar` | `flex flex-1` |
| `rail` | `flex flex-col gap-1 px-1.5` |
| `workspace` | `flex min-h-0 w-full flex-col items-center gap-[8px] overflow-y-auto overscroll-contain -mt-1 -mb-1.5 pt-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:…` |
| `plain` (default) | `flex data-[orientation=vertical]:flex-col` |

### `tabViewTabVariants`

Defined in `@/components/ui/tab-view`. Base classes:

```text
relative cursor-pointer outline-none
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `bar` | `bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 text-center leading-[normal] [font-family:inherit] text-tertiary-…` |
| `rail` | `bl-btn flex flex-col items-center justify-center gap-[3px] rounded-panel px-1 pt-[7px] pb-1.5 text-center leading-[normal] text-tertiary-foreground transition-…` |
| `workspace` | `group flex w-full shrink-0 justify-center data-disabled:cursor-default` |
| `plain` (default) | `data-disabled:cursor-default` |

### `tabViewIndicatorVariants`

Defined in `@/components/ui/tab-view`. Base classes:

```text
pointer-events-none absolute
```

**`variant`** — default `bar`

| Value | Adds |
| --- | --- |
| `bar` (default) | `bg-primary transition-[translate,width,height] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none` |
| `pill` | `start-0 top-1/2 h-0 w-1 -translate-y-1/2 rounded-e-[4px] bg-foreground opacity-0 transition-[height,opacity] duration-spring-snappy ease-spring-snappy data-att…` |

**`orientation`** — default `horizontal`

| Value | Adds |
| --- | --- |
| `horizontal` (default) | — |
| `vertical` | — |

2 compound variants — see the source.

### `tabViewActionVariants`

Defined in `@/components/ui/tab-view`. Base classes:

```text
cursor-pointer outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring/45
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `bar` | `bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 leading-[normal] [font-family:inherit] text-tertiary-foreground d…` |
| `rail` | `bl-btn mx-1.5 flex flex-col items-center justify-center gap-[3px] rounded-panel border-0 bg-transparent px-1 pt-[7px] pb-1.5 leading-[normal] [font-family:inhe…` |
| `workspace` | `grid size-[34px] shrink-0 place-items-center rounded-[17px] border border-dashed border-border bg-transparent text-tertiary-foreground [transition:border-radiu…` |
| `plain` (default) | `bl-btn border-0 bg-transparent p-0 [font-family:inherit]` |
