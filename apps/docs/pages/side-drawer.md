# SideDrawer

One inspector, three presentations — chosen by composition, not configuration.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/side-drawer.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { SideDrawer } from '@/components/ui/side-drawer'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { SideDrawer } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

| `presentation` | Shows as | Used when |
| --- | --- | --- |
| `fixed` | docked column beside the detail view | ≥1280px, room to spare |
| `overlay` | sheet from the end edge + scrim (UI SDK's Drawer; the right, or the left under `dir="rtl"`) | desktop / tablet |
| `push` | the whole host, pushed like a NavigationStack screen | phones |
| `auto` (default) | `overlay`, or `push` while the host is narrower than `breakpoint` (520px) | let the host decide |

```jsx
// extra-wide: docked
<SideDrawer presentation="fixed" open={act} onOpenChange={setAct} title="Activity" width={318}>
  <ActivityView c={contact}/>
</SideDrawer>

// desktop/tablet: an overlay sheet; on a phone the same drawer is a pushed page with a back button
<SideDrawer open={act} onOpenChange={setAct} title="Activity" width={340} backLabel="Maya">
  <ActivityView c={contact}/>
</SideDrawer>
```

`onOpenChange(open, details)` hears every close with its reason: `close-press` (the close or back button), `escape-key`, `outside-press` (the scrim), `swipe` (the overlay toward its edge, or the push from the leading edge) and `back` (the platform back gesture while pushed). `details.cancel()` keeps it open. `defaultOpen` makes it uncontrolled, and `createSideDrawerController()` drives it from anywhere. The children stay mounted when the presentation changes, so a draft comment survives a resize from overlay to push.

The content component doesn't know which presentation it's in: the demos below pick one per host size, or leave it to `auto`. Inside a `NavigationStack` you can still push the content as a real page (a `NavigationStackPage`) instead. The Workbench's [WorkbenchPanel](https://blamy.github.io/ui/#/workbench-shell) follows the same philosophy on desktop scales.

## Live example

{% demo src="side-drawer/activity-drawer" %}

## Examples

### Docked inspector

`presentation="fixed"` is a column in the layout that animates its width. The toolbar button toggles it and the inspector follows the selected file.

{% demo src="side-drawer/file-inspector" %}

### Comments over the page

`presentation="overlay"` slides over the content with a scrim (UI SDK's Drawer, contained in the host): the scrim, the close button, Escape and a swipe toward its edge call `onOpenChange(false, details)`, and focus stays in the drawer while it is open.

{% demo src="side-drawer/comments" %}

### Pushed on a phone

In a compact host an overlay drawer is not a floating card with a scrim gap: it is a page pushed on the navigation stack. With `presentation="auto"` (the default) that happens when the host is narrower than `breakpoint` (520px), measured with the kit's size classes (`bindSizeClass`) on the drawer's own layer over the host, which is then the size-class scope of the drawer's content; pass `presentation="push"` to decide yourself.

- It takes the host's full width, with a NavigationStack bar: a back button on the leading edge (`backLabel`, default "Back") and the title centred.
- It slides in from the trailing edge on the smooth spring (`data-starting-style` / `data-ending-style`), and the page underneath parallaxes to −28% of its width under a 12% dim, as a NavigationStack screen does.
- It is a two-page stack from the kit's `createStack` (`@/lib/stack`): the back button, `Escape`, the platform back, or a swipe from the leading edge (`bindEdgeSwipe`; the right edge in right-to-left text, where the panel enters from the left) pops it, and focus moves into the page on a push and back to what opened it on a pop. The swipe scrubs the panel (`data-swiping`, `--stack-progress`), the parallax and the dim together, and commits past a third of the width or on a flick; released, all three settle on the tray spring (`data-swipe-settling`).
- The page under it opts in: put `sideDrawerPageClass` on it (a child of the same host, before the drawer) and let the host clip (`overflow: hidden`). The drawer never writes styles on your elements: it sets `--side-drawer-under` on the host (1 while pushed, 0 to 1 while a swipe scrubs), with `data-side-drawer-swiping` while the finger moves and `data-side-drawer-settling` until the release has settled, and the class translates the page from them. Style it yourself from the same variable if you need another motion. Reduced motion turns the slide off.

```tsx
<div style={{ position: 'relative', overflow: 'hidden' }}>
  <Article className={sideDrawerPageClass} />
  <SideDrawer open={open} onOpenChange={setOpen} title="Comments" backLabel="Article">
    <Comments />
  </SideDrawer>
</div>
```

{% demo src="side-drawer/compact-push" %}

Where this applies: `ChatShellPanel` (a thread panel) pushes on a phone. Leading-edge navigation stays a drawer: `Sidebar`'s compact overlay, `ChatShellNav` and `WorkbenchSidebar` slide in from the left over a scrim, as a hamburger menu should. `WorkbenchPanel` is already a page at compact width, switched by the Workbench tab bar rather than pushed.

### One content, three presentations

The host measures itself with `useContainerWidth` and docks the drawer when it is wide; below that the drawer's `auto` presentation picks the overlay or the push from the host's size class. `Activity` never knows which one it is in, and stays mounted through every switch. Switch widths in the header.

{% demo src="side-drawer/adaptive-activity" %}

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `sideDrawerVariants`

Defined in `@/components/ui/side-drawer`. Base classes:

```text
(none)
```

**`presentation`**

| Value | Adds |
| --- | --- |
| `fixed` | `w-(--side-drawer-w) shrink-0 overflow-hidden bg-background transition-[width] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none` |
| `overlay` | `pointer-events-none absolute inset-0 z-350` |
| `push` | `pointer-events-none absolute inset-0 z-350` |
