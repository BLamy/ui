# AdaptivePane

One region of a layout, five presentations. The same children show as a docked **column** beside the page, a **drawer** over it from the pane's side, a **push** (a page pushed over the host like a NavigationStack screen), a **cover** that fills the host, or **hidden**; they stay mounted through every switch, so fields, scroll position, selection and subscriptions carry over. `presentation="auto"` (the default) picks the presentation from the size-class scope it is written in, so one pane is an inspector column on a desktop window, a drawer on a tablet-sized one and a pushed page on a phone. It is the navigation of [ChatShell](https://blamy.github.io/ui/#/chat-shell), its thread panel, and the sidebar and surface panel of [WorkbenchShell](https://blamy.github.io/ui/#/workbench-shell).

Use [Sheet](https://blamy.github.io/ui/#/sheet) for a modal panel that is not part of the layout (filters, a picker), [Dialog](https://blamy.github.io/ui/#/dialog) for a task that interrupts, [Sidebar](https://blamy.github.io/ui/#/sidebar) for an app's navigation list with a collapsed rail, [SplitView](https://blamy.github.io/ui/#/split-view) for list–detail columns that become a stack, and [FloatingSheet](https://blamy.github.io/ui/#/floating-sheet) for a surface that floats beside a usable page.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/adaptive-pane.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  AdaptivePane, AdaptivePaneHeader, AdaptivePaneTitle, AdaptivePaneClose,
} from '@/components/ui/adaptive-pane'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  AdaptivePane, AdaptivePaneHeader, AdaptivePaneTitle, AdaptivePaneClose,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Put the pane in a positioned host (`position: relative`), beside the page it belongs to. `open` says whether it shows, in every presentation; `onOpenChange(open, details)` hears why it wants to change. The header parts give it a title and a way to close that fit each presentation.

```tsx
<div className="relative flex h-full">
  <main className={cn('min-w-0 flex-1', adaptivePanePageClass)}>…</main>
  <AdaptivePane side="end" open={open} onOpenChange={setOpen} columnWidth={300}>
    <AdaptivePaneHeader>
      <AdaptivePaneTitle>Activity</AdaptivePaneTitle>
      <AdaptivePaneClose backLabel="Profile" />
    </AdaptivePaneHeader>
    <ActivityList />
  </AdaptivePane>
</div>
```

{% demo src="adaptive-pane/auto" %}

## Presentations

| `presentation` | Renders |
| --- | --- |
| `auto` (default) | One of the below, from the size-class scope the pane is written in: `column` in a regular scope, `drawer` in a medium one, and in a compact one `push` for an `end` pane (a pushed page comes from the trailing edge) or `drawer` for any other side. Outside every scope: `column`. |
| `column` | A flex or grid child beside its siblings, `columnWidth` wide. Part of the layout: no scrim, no focus trap. Closed, it leaves the layout (`hidden`). |
| `drawer` | A [contained Sheet](https://blamy.github.io/ui/#/sheet) panel from `side` over the positioned host, `drawerWidth` wide (20rem by default, at most 85% of the host). Escape, the scrim, the close part and a swipe toward its edge close it, and focus stays inside while it is open. `modal={false}` drops the scrim and leaves the page usable. |
| `push` | A page pushed over the whole host from the trailing edge, NavigationStack-style: the header becomes the bar (back on the leading edge, the title centred, under the safe area), the page under it parallaxes, dims and is inert, and the back button, Escape, the platform back and a swipe from the leading edge pop it. |
| `cover` | Fills the positioned host at `zIndex`: a full-screen panel, or a detail page over its list. |
| `hidden` | Nothing on screen, whatever `open` says; the children stay mounted, off the page. |

`side` is the host's edge the pane belongs to: UI SDK's logical `start` (the default) or `end`, which follow the reading direction (under `dir="rtl"` a `start` drawer comes from the right, and its separator and swipe strip move with it), or a physical `left` or `right`.

A shell with its own thresholds can still pass a presentation by hand (`presentation={wide ? 'column' : 'drawer'}`); with `auto`, make the host a size-class scope instead (`useSizeClass` and `SizeClassProvider` from `@/lib/container`, as the demo above does), so a dialog opened from inside the pane follows the same scope.

{% demo src="adaptive-pane/pane-modes" %}

## Header, title and close

`AdaptivePaneHeader` is the pane's title row. In a column, a drawer or a cover it is the surface bar the kit's dialogs use (the title, then a round ×); in a push it is the NavigationStack bar. `AdaptivePaneTitle` (an `h2`) names the pane: the drawer's dialog and the pushed page's region are labelled by it, unless the pane has its own `aria-label`. `AdaptivePaneClose` is the × in a column, drawer or cover (named "Close" plus the title: "Close Activity") and the "‹ Back" button in a push, showing `backLabel`; either way `onOpenChange` hears `close-press`. Actions after the close part sit at the end of the row.

{% demo src="adaptive-pane/file-inspector" %}

## The push

The page under a push opts in to the parallax: put `adaptivePanePageClass` on it (a child of the same host, before the pane) and let the host clip (`overflow: hidden`). The pane writes one variable on the host (`--adaptive-pane-under`, 1 pushed, 0 not, in between while a swipe scrubs) and `data-adaptive-pane-swiping` / `data-adaptive-pane-settling` while a swipe moves and settles, and never writes styles on your page. While it is pushed, the host's other children are `inert`, so the page under it leaves the tab order and the accessibility tree, as a covered NavigationStack page does; closing gives focus back to what opened it.

```tsx
<div className="relative h-full overflow-hidden">
  <Article className={adaptivePanePageClass} />
  <AdaptivePane side="end" presentation="push" open={open} onOpenChange={setOpen}>
    <AdaptivePaneHeader>
      <AdaptivePaneTitle>Comments</AdaptivePaneTitle>
      <AdaptivePaneClose backLabel="Article" />
    </AdaptivePaneHeader>
    <Comments />
  </AdaptivePane>
</div>
```

{% demo src="adaptive-pane/compact-push" %}

## Resizing and gestures

`resizable` puts a separator on the inner edge of a `column` or a `drawer` (UI SDK's `createResize`): drag it, or focus it and use the arrow keys (16px, Shift for 48px), Home and End; Enter or a double-click returns to the host's width. The separator is one tab stop with `aria-valuenow`, `aria-valuemin` and `aria-valuemax` (the window-splitter pattern); while it drags, the pane has `data-dragging` and only its `--adaptive-pane-w` variable changes, so the content doesn't re-render. `minWidth` (default 160) and `maxWidth` (px) bound it, and a column never takes the last 240px of its host (a drawer, the last 48px). The widths are kept per presentation in `widths` / `defaultWidths`, and `onWidthsChange(widths, details)` reports each settled change (a drag on release, every key) with `details.reason` `drag`, `resize-key` or `size-reset`; an unset width means the host's applies.

A drawer follows a drag of its panel toward its edge and closes past a distance or on a flick (`reason: 'swipe'`). `swipe={false}` turns only that off, while Escape and the scrim still close it. `swipeToOpen` adds a thin strip along the host's edge that opens a closed drawer with a swipe (`bindEdgeSwipe`, `reason: 'swipe'`): past a third of the host's width, or sooner with a flick, so a short nudge does nothing. That strip sits where a NavigationStack's back swipe starts, so use it on the side a stack in the host doesn't.

## Examples

### Mail shell

`column` when the host is wide, `drawer` when it is narrow, and a menu button only in the compact layout. Docked, the mailboxes always show (`open={!compact || open}`).

{% demo src="adaptive-pane/mail-shell" %}

### List and detail

The detail is a trailing column when there is room and covers the list when there is not; closing it on a phone clears the selection.

{% demo src="adaptive-pane/team-directory" %}

### Reader outline

The presentation doesn't have to come from the width. Here the reader chooses: docked outline, a drawer, or hidden for focus.

{% demo src="adaptive-pane/reader-outline" %}

## Accessibility

- The drawer is a dialog (`aria-modal` unless `modal={false}`), the push a named region, both labelled by the `AdaptivePaneTitle` or `aria-label`; give the pane one of them. A column is part of the page: wrap its content in a landmark (`<aside aria-label>`, `<nav>`) when it is one.
- Focus moves into an opened drawer or push, is kept in a modal drawer, and goes back to what opened it on close. While pushed, the page under is inert.
- `AdaptivePaneClose` is always reachable by keyboard; the scrim, the swipes and Escape are shortcuts, not the only way out.
- The separator is a `separator` with its value range and the window-splitter keys; the swipe strip is `aria-hidden`.

## Props

### AdaptivePane

| Prop | Default | Effect |
| --- | --- | --- |
| `presentation` | `auto` | `auto` · `column` · `drawer` · `push` · `cover` · `hidden`. |
| `open` / `defaultOpen` / `onOpenChange(open, details)` | closed | Whether it shows. `details.reason`: `close-press`, `escape-key`, `outside-press`, `swipe`, `back`, `imperative`…; `details.cancel()` keeps it. |
| `side` | `start` | `start` · `end` · `left` · `right`. |
| `columnWidth` | the track's | The column's width (number = px, or any CSS length). |
| `drawerWidth` | `20rem` | The drawer's width, capped at 85% of the host (override with `max-w-*` in `className`). |
| `resizable` | `false` | A separator on the inner edge of a column or drawer. |
| `minWidth` / `maxWidth` | 160 / — | Bounds of a resize, px. |
| `widths` / `defaultWidths` / `onWidthsChange(widths, details)` | — | The resized widths per presentation (`{ column, drawer }`). |
| `swipe` | `true` | Whether a drag of the drawer toward its edge closes it. |
| `swipeToOpen` | `false` | A strip on the host's edge that swipes a closed drawer open. |
| `modal` / `dismissible` | `true` / `true` | The drawer's modality and whether Escape, the scrim and the swipe can close it (UI SDK's Drawer props). |
| `zIndex` | 30 | Stacking of the drawer, push or cover over the host's other children. |
| `aria-label` | the title | The pane's name. |
| `controller` | — | From `createAdaptivePaneController()`: `isOpen`, `setOpen`, `getWidths`, `setWidths` from anywhere (also the agent's actions). |
| `className` / `style` | — | The pane's box in every presentation: the column, the drawer's panel, the pushed page, the cover. Either may be a function of `{ presentation, open, side }`. |

### AdaptivePaneClose

| Prop | Default | Effect |
| --- | --- | --- |
| `backLabel` | `Back` | What a pushed pane goes back to, beside the chevron. |
| `aria-label` | "Close" + title / the back label | Its name. |
| `children` | × / ‹ backLabel | Replaces the glyph. |

`AdaptivePaneHeader` takes a `div`'s props; `AdaptivePaneTitle` an `h2`'s.

## Styling

Slots: `adaptive-pane` (the root, with `data-presentation`, `data-side`, `data-open` / `data-closed`, `data-dragging`), `adaptive-pane-resizer`, `adaptive-pane-edge`, `adaptive-pane-dim` and `adaptive-pane-page` (the push), `adaptive-pane-header` (with `data-presentation="push"` in a push), `adaptive-pane-title`, `adaptive-pane-close`. The drawer is a `Sheet contained` with `SheetContent variant="panel"`: its panel is `drawer-content` with `data-variant="panel"`, its host `sheet-host`. Variables: `--adaptive-pane-w` (the width, resized or the host's), `--adaptive-pane-z`, and on the host `--adaptive-pane-under`.

## Container utilities

The shells share more primitives, in `@/lib/container` and `@/lib/kept-children` (`@brett_lamy/ui` on npm):

| Export | Role |
| --- | --- |
| `useSizeClass(options?)` / `SizeClassProvider` | Measure a box's size class and make it the scope of what it renders (what `auto` reads). |
| `useContainerWidth(initial?)` | Returns `[ref, width]`; a ResizeObserver keeps `width` in sync with the element, not the viewport. |
| `useContainerSize(initial?)` | The same with both axes: returns `[ref, { width, height }]`. |
| `useKeptChildren(children)` | The pane's own trick, for your own regions: render children once through a portal and dock them wherever they show now (`{ portal, dock, inline }`). |
| `defineSlot(name)` / `collectSlots(children)` | Marker components for compound slots and the reader that maps them to their children. |
