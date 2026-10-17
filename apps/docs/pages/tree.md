# Tree

A hierarchy you can expand, collapse, search and select from the keyboard, built on [Trees](https://trees.software) (`@pierre/trees`). Rows are virtualized, so a tree of thousands of files scrolls smoothly. Each row has indent guides, a chevron on folders, a file-type icon on files, a truncating label and a short detail after it. Trees adds search, Git status, inline rename and drag and drop. Pass the data as nested `items`. A node with `children` is a folder. Any hierarchy works, not only files: an outline, a schema, a syntax tree. Use [ListBox](https://blamy.github.io/ui/#/list-box) for a flat list of choices and [NavigationStack](https://blamy.github.io/ui/#/navigation-stack) to drill into one level at a time.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/tree.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Tree, type TreeNode } from '@/components/ui/tree'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Tree, type TreeNode } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## File tree

`sort` lists folders first, then A→Z, the way a file browser does. Without it, rows keep the order of `items`. Files take an icon for their type from the name. `gitStatus` maps node ids to `added`, `modified`, `deleted`, `renamed`, `untracked` or `ignored`, and a folder shows a dot when something inside it changed. `search` adds a SearchField over the rows: typing keeps only the matches and their folders. `contextMenu` returns a `ContextMenuContent` for the row you right-click (or long-press, or press the menu key on). Setting `renamingId` turns that row's label into a field. Return calls `onRename` with the new name, and Escape or a click away cancels. Either way, `onRenameEnd` runs after.

{% demo src="tree/file-tree" %}

```tsx
<Tree aria-label="Project files" items={nodes} sort search gitStatus={{ 'src/tree.tsx': 'added' }}
  defaultExpanded={['src']} selectedIds={selected} onSelectionChange={setSelected}
  renamingId={renaming} onRenameEnd={() => setRenaming(null)}
  onRename={(node, name) => rename(node.id, name)}
  contextMenu={(node) => (
    <ContextMenuContent aria-label={`${node.name} actions`} onAction={(key) => key === 'rename' && setRenaming(node.id)}>
      <ContextMenuItem id="rename">Rename</ContextMenuItem>
      <ContextMenuItem id="delete" variant="destructive">Delete</ContextMenuItem>
    </ContextMenuContent>
  )} />
```

## Any hierarchy

For something that isn't files, set `icons="none"` and give leaves their own `icon` from the icon set. `detail` goes after the label: a count, a kind, a short status. `dimmed` fades a row that's listed but not the point. Siblings may share a name, and a name may contain a slash. ⌘-click and ⇧-click select more than one row.

{% demo src="tree/basic" %}

```tsx
const MAILBOXES: TreeNode[] = [
  { id: 'icloud', name: 'iCloud', children: [
    { id: 'inbox', name: 'Inbox', icon: 'tray', detail: '12' },
    { id: 'archive', name: 'Archive', icon: 'folder', dimmed: true },
  ] },
]

<Tree aria-label="Mailboxes" items={MAILBOXES} icons="none" defaultExpanded="all"
  selectedIds={selected} onSelectionChange={setSelected} />
```

## Drag and drop

Rows drag only when `canDrag` allows them. They carry their path as text, and `onDragStart` can add your own data, such as a custom type that another part of the page accepts. `onMove` turns on moving rows into folders within the tree, and `canMove` vetoes a drop. `externalDrop` takes drops from outside the tree, such as files from the computer or rows from another list. `accepts` decides from the drag's types, the target folder lights up while it would be accepted, and `onDrop` gets the `DataTransfer` and the folder (or `null` for the tree itself). A file's row stands for the folder it's in.

```tsx
<Tree aria-label="Files" items={nodes}
  canDrag={(rows) => rows.every((r) => !r.children)}
  onDragStart={(rows, data) => data.setData('application/x-my-file', rows.map((r) => r.id).join('\n'))}
  externalDrop={{
    accepts: (types) => types.includes('Files'),
    onDrop: (data, folder) => upload(folder?.id ?? 'root', [...data.files]),
  }} />
```

## Accessibility

Trees renders a `tree` of `treeitem`s with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded` and `aria-selected`, and it is a single tab stop. ArrowUp and ArrowDown move between rows. ArrowRight opens a folder or moves into it, and ArrowLeft closes it or moves to its parent. Home and End jump to the first and last rows. Space or Return selects. The search field is a separate SearchField above the tree, outside its `tree` role. `aria-label` names the tree and is required. The rows live in the tree's shadow root, so page CSS does not reach them. Style them through the variables below.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `aria-label` | — | The tree's name. |
| `items` | — | `TreeNode[]`: `id`, `name`, `children` (folders), `detail`, `detailTitle`, `icon`, `dimmed`. |
| `sort` | `false` | Folders first, then A→Z. Otherwise the order of `items`. |
| `selectedIds` / `defaultSelectedIds` | — | The selection, controlled or initial. A controlled selection scrolls into view. |
| `onSelectionChange` | — | `(ids) => …` after a click, a ⌘- or ⇧-click, or the arrow keys. |
| `onAction` | — | Double-click or Return on a row. |
| `defaultExpanded` | `'none'` | `'all'`, `'none'` or the ids of folders to start open. |
| `expandedIds` | — | Folders (and their ancestors) to open whenever they appear in the list. The user can still close them. |
| `search` | `false` | A SearchField above the rows that filters to the matches. |
| `flatten` | `false` | A chain of single-folder folders shows as one row (`src / app`). |
| `icons` | `'standard'` | The file-type icon set: `'minimal'`, `'standard'`, `'complete'`, or `'none'`. |
| `gitStatus` | — | Git-style status by node id. |
| `density` | `'default'` | `'compact'`, `'default'`, `'relaxed'` or a spacing factor. |
| `contextMenu` | — | `(node) => ContextMenuContent`. |
| `renamingId`, `onRename`, `onRenameEnd` | — | Inline rename. |
| `canDrag`, `onDragStart`, `onMove`, `canMove`, `externalDrop` | — | Drag and drop. |

`TreeFolderIcon` and `TreeFileIcon` are the file icons for lists of files outside a Tree. `TreeFolderIcon` takes `open`, and `TreeFileIcon` takes the file's `name`. Both take `size` (default 18) and `className`.

## Styling

The host is `data-slot="tree"`. Give it a height (or let a flex parent stretch it), because rows are virtualized inside it. BL UI maps the theme onto Trees' variables: a tint of the primary color for the selection, the primary color for the accent, the ring for focus, the border for indent guides, `--font-sans` and the footnote size for text. Override any `--trees-*-override` variable on the host to change one, for example `--trees-selected-bg-override`. See [Trees' styling reference](https://trees.software/docs#styling-and-theming).
