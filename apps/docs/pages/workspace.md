# Workspace

A dockable workspace for editors and tools. Tabs live in tabsets, tabsets sit in resizable splits, and a tab moves along its strip, to another tabset, or onto an edge of one to split it there, by pointer or from the keyboard. Any tabset can be maximized over the others. Each split is [UI SDK](https://ui-sdk.dev)'s Resizable and each tabset its Tabs, driven by one layout you can save. On a phone-sized box it becomes one strip of tabs along the bottom.

Use it when people arrange the panes themselves. For a fixed set of views one at a time, use [Tabs](https://blamy.github.io/ui/#/tabs); for fixed columns that collapse into a stack on a phone (mail, notes, settings), use [SplitView](https://blamy.github.io/ui/#/split-view).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/workspace.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Workspace, WorkspaceTab, WorkspaceTabTrigger, WorkspaceTabClose,
  WorkspaceToolbar, createWorkspaceController,
} from '@/components/ui/workspace'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Workspace, WorkspaceTab, WorkspaceTabTrigger, WorkspaceTabClose,
  WorkspaceToolbar, createWorkspaceController,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

{% demo src="workspace/editor" %}

Increment the counter, type a note, then move those tabs. A tab's content is rendered once, into an element of its own that its tabset's panel adopts, so moving a tab keeps its React state, its DOM and its running effects. Hidden tabs stay mounted unless `keepMounted` says otherwise; closing a tab unmounts it.

## Usage

```tsx
import { Workspace, type TabNode, type WorkspaceLayoutInput } from '@/components/ui/workspace'

const layout: WorkspaceLayoutInput = {
  version: 1,
  root: {
    type: 'split',
    orientation: 'horizontal',
    children: [
      { type: 'tabset', tabs: [{ id: 'editor', title: 'Editor', data: null }] },
      { type: 'tabset', tabs: [{ id: 'preview', title: 'Preview', data: null }] },
    ],
  },
}

const renderTabContent = (tab: TabNode) => (tab.id === 'editor' ? <Editor /> : <Preview />)

<Workspace aria-label="Editor" className="h-[600px]" defaultLayout={layout} renderTabContent={renderTabContent} />
```

Give the workspace a height and a name. The layout is a tree of `split` and `tabset` nodes and is plain JSON; tabs have unique ids, a `title` and your own `data`. A split's `orientation` is `horizontal` (side by side) or `vertical` (stacked), and `size` is a share of the split in percent. Splits and tabsets may leave out their ids in an input. Keep `renderTabContent` stable (`useCallback`) when it renders expensive views; its second argument says whether the tab is `selected`, `visible` (selected and not behind a maximized tabset) and which tabset holds it.

## The layout

`defaultLayout` starts an uncontrolled workspace; `layout` controls it. `onLayoutChange(layout, details)` runs for every change, each frame of a resize included: `details.action` says what happened (`select`, `add`, `close`, `move`, `resize`, `maximize`, `restore`, `update`, `set`), `details.reason` why (`item-press`, `list-navigation`, `remove-press`, `drag`, `move-key`, `step-key`, `toggle-press`, `imperative`…), `details.tab` and `details.tabset` what it touched, and `details.cancel()` refuses it. `onLayoutCommit(layout, details)` runs once an interaction ends (a tab dropped, a handle let go): save the layout there.

```tsx
<Workspace
  defaultLayout={saved ?? layout}
  onLayoutChange={(next, details) => {
    if (details.action === 'close' && dirty(details.tab)) details.cancel()
  }}
  onLayoutCommit={(next) => localStorage.setItem('layout', JSON.stringify(next))}
  renderTabContent={renderTabContent}
/>
```

The layout holds arrangement and tab data only, not an editor's draft or other React state.

## Driving it from outside

Create a controller with `createWorkspaceController()` and pass it as `controller`. It has `getLayout`, `setLayout`, `getActiveTabsetId` (the tabset last used, by pointer or focus), `addTab(tab, { tabsetId, index, select })`, `closeTab`, `closeTabset`, `moveTab(tabId, target)`, `selectTab`, `updateTab`, `updateTabset`, `maximizeTabset` and `restoreTabset`. Each write runs `onLayoutChange` with the reason `imperative` (or the one you pass as the last argument) and returns whether the layout changed. A controller is not held back by `disabled`, `disableClose`, `disableDrag` or `accepts`.

A `moveTab` target is a place in a strip, `{ tabsetId, index }`, or a region of a tabset's content, `{ tabsetId, region }`: `center` joins the tabset, and `left`, `right`, `top` or `bottom` splits it there.

## Tabs, toolbars and empty tabsets

`renderTab(tab)` draws a tab in its strip: a `WorkspaceTab` around a `WorkspaceTabTrigger` (the tab itself, UI SDK's `TabsTab`) and, to close it, a `WorkspaceTabClose`. The trigger shows the title unless it has children; the close button renders nothing for a tab that can't be closed, and `event.preventDefault()` in its `onClick` keeps the tab open, like to ask about unsaved changes first.

```tsx
renderTab={(tab) => (
  <WorkspaceTab value={tab.id}>
    <WorkspaceTabTrigger>
      <FileIcon name={tab.title} />
      <span className="truncate">{tab.title}</span>
    </WorkspaceTabTrigger>
    <WorkspaceTabClose />
  </WorkspaceTab>
)}
```

`renderTabsetToolbar(tabset, state)` draws what follows a tabset's tabs; `state` has `active`, `maximized`, `only`, `empty`, `selectedTabId` and `tabSide`. `WorkspaceToolbar` lays out your actions followed by `WorkspaceMaximize`, which maximizes and restores its tabset and renders nothing in the only one. `renderEmptyTabset(tabset)` fills a tabset without tabs: the root of an empty workspace, or one with `keepWhenEmpty`.

## Moving tabs

Drag a tab along its strip, into another strip, onto the middle of a tabset's content to join it, or near an edge to split there; a copy of the tab follows the pointer and the drop indicator shows the region. Escape cancels a drag. `accepts(tab, target)` decides whether a tab may go to a target, another tabset or an edge of any tabset (its own strip always takes it back), so `accepts={() => false}` keeps every tab in its strip; `disabled` locks the arrangement (nothing resizes, moves or closes by hand, though tabs still select and tabsets maximize). A tab with `disableDrag` stays put and one with `disableClose` has no close button.

## Sides, sizes and the compact presentation

`tabSide` (`top`, `bottom`, `start`, `end`) puts every tabset's strip on that side, and a tabset's own `tabSide` overrides it; `start` and `end` follow the reading direction, and their strips run down the pane (Up and Down move between tabs). `tabsetMinWidth` and `tabsetMinHeight` (in `px` or `rem`) bound every tabset, and a tabset's `minWidth`/`minHeight` override them.

`presentation` decides how the layout is shown. `docked` lays the tabsets out in their splits. `tabs` shows every tab of every tabset in one strip along the bottom, one tab at a time, with nothing to drag or drop: picking a tab selects it in its tabset and makes that tabset the active one, and each tab keeps its state. `auto` (the default) is `tabs` while the workspace's own box is compact (narrower than 640px, measured on the workspace, not the viewport) and `docked` otherwise. The layout itself never changes, so a window that grows again gets its panes back. The root carries `data-presentation` (`docked` or `tabs`).

## Styling

`className` styles the root, which draws no frame of its own: add `rounded-card border border-border` for a card. `classNames` adds classes to the parts the workspace renders from its layout: `split`, `handle`, `tabset`, `header`, `tabList`, `tab`, `tabTrigger`, `toolbar`, `tabPanels`, `tabContent` and `dropIndicator`. They carry UI SDK's state attributes: a handle has `data-hovering` and `data-dragging`; a tabset `data-active`, `data-maximized`, `data-empty` and `data-tab-side`; a tab `data-selected`, `data-moving` (picked up) and `data-dragging`, and its copy in flight `data-drag-preview`; the drop indicator `data-region`.

## Accessibility

The workspace is a `group` named by its `aria-label`. Each tabset is a `group` named `Pane 1`, `Pane 2`… in reading order (`tabsetLabel` renames them), holding a tab list named after it. Each split is a `group` named `Split 1`, `Split 2`… in reading order (`data-slot="workspace-split"`): the workspace's own part, rendered by the Resizable that lays it out. The handle between two children of a split is a `separator` named `Resize Pane 1`. Each tab describes how to move it; `tabDescription` replaces that text. Picking a tab up, moving it and dropping it are announced. Close buttons are for the pointer: they are out of the tab order and hidden from screen readers (a tab list may hold only tabs), since Delete closes the focused tab, and focus moves to the tab that takes a closed one's place.

| Key | Action |
| --- | --- |
| Arrow keys | On a tab, select the previous or next one. |
| Home / End | Select the first or last tab. |
| Space or Enter | Pick the focused tab up; again, drop it. |
| Arrow keys, while picked up | Move the tab along its strip and on into the next tabset; across the strip, to the previous or next tabset. |
| Escape | Put a picked-up tab back. |
| Delete or Backspace | Close the focused tab. |
| Arrow keys on a handle | Resize the split. |

## Props

### Workspace

A `<div>` with the `group` role.

| Prop | Default | Effect |
| --- | --- | --- |
| `layout` / `defaultLayout` | an empty tabset | The layout, controlled or at first. |
| `onLayoutChange` | — | `(layout, details)` on every change: `details.action`, `details.reason`, `details.tab`, `details.tabset`, `details.cancel()`. |
| `onLayoutCommit` | — | `(layout, details)` once an interaction ends. For saving. |
| `controller` | — | From `createWorkspaceController()`. |
| `renderTabContent` | required | `(tab, { selected, visible, tabsetId })`: a tab's content. |
| `renderTab` | title and close button | `(tab)`: a tab in its strip. |
| `renderTabsetToolbar` | `WorkspaceToolbar` | `(tabset, state)`: what follows a tabset's tabs. |
| `renderEmptyTabset` | — | `(tabset)`: what a tabset without tabs shows. |
| `keepMounted` | `true` | Whether hidden tabs' content stays mounted; a function decides per tab. |
| `disabled` | `false` | Locks the arrangement. |
| `accepts` | yes | `(tab, target)`: whether a tab may go to `target`, another tabset or an edge. |
| `tabSide` | `top` | Where strips sit around their content: `top`, `bottom`, `start` or `end`. |
| `presentation` | `auto` | `docked`, `tabs` (one strip along the bottom), or `auto`: `tabs` while the workspace is compact. |
| `tabsetMinWidth` / `tabsetMinHeight` | — | Bounds for every tabset, in `px` or `rem`. |
| `tabsetLabel` | `Pane N` | `(tabset, index)`: a tabset's name. |
| `tabDescription` | how to move and close | What a screen reader hears after a tab's name. |
| `classNames` | — | Classes for the parts rendered from the layout. |

### WorkspaceTab, WorkspaceTabTrigger, WorkspaceTabClose

`WorkspaceTab` takes the tab's `value` (its id); the trigger and the close button take it from the tab around them. Each takes `className`, which may be a function of its state.

### WorkspaceToolbar, WorkspaceMaximize

`WorkspaceToolbar` takes `children` (your actions, before the maximize button) and `className`. `WorkspaceMaximize` is named `Maximize pane` or `Restore pane` and has `data-maximized`; its children may be a function of its state.
