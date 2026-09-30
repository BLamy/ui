# SideDrawer

One inspector, three presentations — chosen by composition, not configuration.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { SideDrawer } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/side-drawer.json{% endcommand %}

Adds `@/components/ui/side-drawer.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import { SideDrawer } from '@/components/ui/side-drawer'
```
{% endtab %}
{% endtabs %}

| Mode | Presentation | Used when |
| --- | --- | --- |
| `fixed` | docked column beside the detail view | ≥1280px, room to spare |
| `overlay` | sheet from the right edge + scrim | desktop / tablet |
| `overlay`, compact | the whole host, pushed like a NavigationStack screen | phones (host < `compactBreakpoint`) |

```jsx
// extra-wide: docked
<SideDrawer mode="fixed" open={act} title="Activity" width={318}>
  <ActivityView c={contact}/>
</SideDrawer>

// desktop/tablet: overlay sheet
<SideDrawer
  mode="overlay" open={act} onClose={close} title="Activity" width={340}
>
  <ActivityView c={contact}/>
</SideDrawer>

// phone: the same overlay, now a pushed page with a back button
<SideDrawer mode="overlay" open={act} onClose={close} title="Activity" backLabel="Maya">
  <ActivityView c={contact}/>
</SideDrawer>
```

The content component doesn't know which presentation it's in — the Contacts demo picks per width class. Inside a `NavigationStack` you can still push the content as a real screen instead. The Workbench's [WorkbenchPanel](https://blamy.github.io/ui/#/workbench-shell) follows the same philosophy on desktop scales.

## Live example

{% demo src="side-drawer/activity-drawer" %}

## Examples

### Docked inspector

`mode="fixed"` is a column in the layout that animates its width. The toolbar button toggles it and the inspector follows the selected file.

{% demo src="side-drawer/file-inspector" %}

### Comments over the page

`mode="overlay"` slides over the content with a scrim; tapping the scrim or the close button calls `onClose`.

{% demo src="side-drawer/comments" %}

### Pushed on a phone

In a compact host an overlay drawer is not a floating card with a scrim gap: it is a page pushed on the navigation stack. By default that happens when the host is narrower than `compactBreakpoint` (520px); pass `compact` to decide yourself.

- It takes the host's full width, with a NavigationStack bar: a back button on the leading edge (`backLabel`, default "Back") and the title centred.
- It slides in from the trailing edge on NavigationStack's own push: the same smooth spring, and the page underneath parallaxes to −28% of the host's width under a 12% dim (`navigationPush`, exported from the NavigationStack module, holds the shared numbers).
- The back button, `Escape`, or a swipe from the left edge pops it. The swipe scrubs the panel, the parallax and the dim together, and commits past a third of the width or on a flick, settling on the tray spring, as NavigationStack's edge swipe does.
- The page is everything **before** the drawer in its host, so put the drawer after the page and let the host clip (`overflow: hidden`). Reduced motion turns the slide off.

```tsx
<div style={{ position: 'relative', overflow: 'hidden' }}>
  <Article />
  <SideDrawer
    mode="overlay" open={open} onClose={close}
    title="Comments" backLabel="Article"
  >
    <Comments />
  </SideDrawer>
</div>
```

{% demo src="side-drawer/compact-push" %}

Where this applies: `ChatShellPanel` (a thread panel) pushes on a phone. Leading-edge navigation stays a drawer: `Sidebar`'s compact overlay, `ChatShellNav` and `WorkbenchSidebar` slide in from the left over a scrim, as a hamburger menu should. `WorkbenchPanel` is already a page at compact width, switched by the Workbench tab bar rather than pushed.

### One content, three presentations

The host measures itself with `useContainerWidth` and picks docked, overlay, or a pushed `NavigationStack` screen. `Activity` never knows which one it is in. Switch widths in the header.

{% demo src="side-drawer/adaptive-activity" %}
