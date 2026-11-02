# Workspace

A dockable workspace for editors and tools. Drag tabs between resizable groups, drop a tab on an edge to split a pane, and maximize any group. This is BL UI’s themed wrapper around [react-resizable-panels’ Workspace](https://react-resizable-panels.vercel.app/examples/workspace), using the upstream implementation from version 4.16.0.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/workspace.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Workspace, WorkspaceTabCloseButton, WorkspaceToolbar,
} from '@/components/ui/workspace'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Workspace, WorkspaceTabCloseButton, WorkspaceToolbar,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

{% demo src="workspace/editor" %}

Increment the counter, type a note, then move those tabs. Tab content uses portals, so moving a tab preserves its React state, DOM and running effects. Inactive tabs stay mounted by default. Closing a tab unmounts it. `hiddenTabBehavior="activity"` pauses hidden effects with React 19.2; `"unmount"` releases hidden content entirely.

Workspace is available from the current source build and the shadcn registry. The npm option requires a package release containing this component; use the registry installation while npm publishing awaits authentication.

## Usage

```tsx
import { Workspace, type WorkspaceModelInput } from '@/components/ui/workspace';

const model: WorkspaceModelInput = {
  version: 1,
  root: {
    type: 'split',
    orientation: 'horizontal',
    children: [
      { type: 'tabset', tabs: [{ id: 'editor', title: 'Editor', data: null }] },
      { type: 'tabset', tabs: [{ id: 'preview', title: 'Preview', data: null }] },
    ],
  },
};

function renderTabContent(tab) {
  return tab.id === 'editor' ? <Editor /> : <Preview />;
}

<Workspace className="h-[600px]" defaultModel={model} renderTabContent={renderTabContent} />;
```

Give the workspace a height. The model is a tree of `split` nodes and `tabset` nodes; tabs have unique IDs, a title and application data. Split orientations are `horizontal` or `vertical`. Numeric model sizes are percentages. Keep `renderTabContent` stable when it renders expensive views.

## Layout and controls

`defaultModel` initializes the layout. Use `onModelChanged(model, meta)` to save it and `useWorkspaceRef()` with `workspaceRef` to call `getModel`, `setModel`, `addTab`, `closeTab`, `moveTab`, `selectTab`, `maximizeTabset` or `restoreTabset`. The model contains serializable layout and tab data; it does not store an editor’s draft or other React state for reloads.

`WorkspaceToolbar` provides maximize and restore controls. Pass `renderTabsetToolbar` for custom controls, and use `useParentTabset()` to add tabs to that group. `useParentWorkspace()`, `useParentTab()` and their state hooks expose the surrounding workspace, tab and group. `WorkspaceTabCloseButton` closes its enclosing tab and respects `disableClose`. To confirm an unsaved close, prevent its click’s default behavior.

All upstream Workspace props are supported, including `disabled`, `disableDrop`, `tabPlacement`, `tabsetMinWidth`, `tabsetMinHeight`, `resizePreviewMode`, `classNames`, `styles` and custom renderers. Custom tabs must spread the `renderTab` props, including their ref, handlers and styles, to preserve keyboard and touch behavior. BL UI supplies semantic theme colors, separators, tab headers, close controls and drop indicators.

## Keyboard and server rendering

Arrow keys move focus within a tab list, Home and End jump to its ends, Enter or Space selects, and Delete or Backspace closes the focused tab. Separators support keyboard resizing. Tabs can also be marked `disableDrag` or `disableClose` individually.

Tab content mounts in the browser by default. For SSR, `serverRenderTabContent` can render selected content in the server HTML; that content remounts once when hydration transfers it into a portal. The default avoids that remount.
