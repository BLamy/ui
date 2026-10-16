# Tree

A hierarchy you can expand, collapse and select from the keyboard: react-aria's `Tree` (a `treegrid`) with Finder- and VS Code-style rows. Each row has indent guides down the open folders above it, a chevron that turns as it opens, an icon, a truncating label, a trailing slot for counts and badges, and, optionally, its own right-click menu. `TreeFolderIcon` and `TreeFileIcon` turn it into a file tree. Use [ListBox](https://blamy.github.io/ui/#/list-box) for a flat list of choices and [NavigationStack](https://blamy.github.io/ui/#/navigation-stack) to drill into one level at a time.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/tree.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Tree, TreeItem } from '@/components/ui/tree'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Tree, TreeItem } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## File tree

Pass the data as `items` and render each node with a function. A node's children go in a nested `<Collection>`. `icon` can be a function of the row's state, so `TreeFolderIcon` opens with its folder; `TreeFileIcon` reads the extension from `name` and draws a colored badge for TS, JS, JSON, CSS, Markdown, MDX, HTML, SVG, images, YAML and shell files, or plain lines on the page for anything else. `contextMenu` takes a `ContextMenuContent`, which opens at the pointer on right-click, on a long-press, or with the menu key. With `selectionBehavior="replace"`, a click selects and a double-click runs the item's `onAction`. The demo uses it to open folders.

{% demo src="tree/file-tree" %}

```tsx
function render(node: Node) {
  return (
    <TreeItem
      id={node.id}
      title={node.name}
      icon={({ isExpanded }) => node.children ? <TreeFolderIcon open={isExpanded} /> : <TreeFileIcon name={node.name} />}
      trailing={node.status}
      contextMenu={
        <ContextMenuContent aria-label={`${node.name} actions`} onAction={…}>
          <ContextMenuItem id="rename">Rename…</ContextMenuItem>
          <ContextMenuItem id="delete" variant="destructive">Delete</ContextMenuItem>
        </ContextMenuContent>
      }
    >
      {node.children ? <Collection items={node.children}>{render}</Collection> : null}
    </TreeItem>
  )
}

<Tree aria-label="Project files" items={nodes} selectionMode="single" selectionBehavior="replace"
  expandedKeys={expanded} onExpandedChange={setExpanded}>
  {render}
</Tree>
```

## Static items, multiple selection

For a fixed hierarchy, nest `TreeItem`s directly. `defaultExpandedKeys` (or controlled `expandedKeys` and `onExpandedChange`) sets which items are open. With `selectionMode="multiple"`, each press adds or removes a row. `isDisabled` dims a row and skips it.

{% demo src="tree/basic" %}

```tsx
<Tree aria-label="Mailboxes" selectionMode="multiple" defaultExpandedKeys={['icloud']}>
  <TreeItem id="icloud" title="iCloud" icon={<Icon name="cloud" />}>
    <TreeItem id="inbox" title="Inbox" icon={<Icon name="tray" />} trailing="12" />
  </TreeItem>
</Tree>
```

## Accessibility

react-aria renders a `treegrid` of `row`s with `aria-level`, `aria-expanded` and `aria-selected`. The tree is a single tab stop. ArrowUp and ArrowDown move between rows. ArrowRight opens a folder or moves into it, and ArrowLeft closes it or moves to its parent. Home and End jump to the first and last rows, and typing jumps to a matching row. Space or Enter selects. The chevron is a real button labelled “Expand …” or “Collapse …”. The tree needs a name, from `aria-label` or `aria-labelledby`. When `title` isn't a string, give the item a `textValue` for typeahead.

## Props

### Tree

Everything react-aria's `Tree` takes, including `items`, `selectionMode`, `selectionBehavior`, `selectedKeys`, `onSelectionChange`, `expandedKeys`, `defaultExpandedKeys`, `onExpandedChange`, `onAction`, `disabledKeys`, `renderEmptyState` and `dragAndDropHooks`.

### TreeItem

| Prop | Default | Effect |
| --- | --- | --- |
| `id` | — | The key. |
| `title` | — | The label. A string doubles as the typeahead text. |
| `textValue` | string `title` | Typeahead and accessible text. |
| `icon` | — | Leading icon, or `(state) => icon` (`state.isExpanded`, `isSelected`, `level`, …). |
| `trailing` | — | After the label: counts, dots, badges. Also takes a function of the state. |
| `contextMenu` | — | A `ContextMenuContent` opened by right-click, long-press or the menu key. |
| `onAction` | — | Runs on Enter, or on double-click with `selectionBehavior="replace"`. |
| `isDisabled` | `false` | 40% opacity, not focusable. |
| `children` | — | Nested `TreeItem`s or a `<Collection>`. |

### TreeFolderIcon / TreeFileIcon

`TreeFolderIcon` takes `open`. `TreeFileIcon` takes the file's `name`. Both take `size` (default 18) and `className`.

## Styling

Slots: `tree`, `tree-item` (react-aria's `data-expanded`, `data-selected`, `data-focus-visible` and `data-disabled` states, and the `group/tree-item` group), `tree-item-row`, `tree-guide`, `tree-item-icon`, `tree-item-title`, `tree-item-trailing`, `tree-folder-icon` and `tree-file-icon` (with `data-ext`). Rows are 32px tall and indent 16px per level. A selected row takes the primary color, and its guides and trailing text follow it. Inside a row, `group-data-selected/tree-item:…` restyles a part when the row is selected.
