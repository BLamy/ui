# Tree

A hierarchy you can expand, collapse, search and select from the keyboard: [UI SDK](https://ui-sdk.dev)'s Tree with the kit's rows. Compose it from parts for a short tree whose rows are yours, or hand it nested `items` and it draws the rows itself, only the ones in view, with what a file browser has: indent guides, a chevron on folders, a file-type icon on files, a truncating label and a short detail after it, search, Git status, rename in place, a context menu and a hover preview per row, and drag and drop. A node with `children` is a folder. Any hierarchy works, not only files: an outline, a schema, a syntax tree. Use [Listbox](https://blamy.github.io/ui/#/list-box) for a flat list of choices and [NavigationStack](https://blamy.github.io/ui/#/navigation-stack) to drill into one level at a time.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/tree.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Tree } from '@/components/ui/tree'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Tree } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## File tree

`sort` lists folders first, then A→Z, the way a file browser does. Without it, rows keep the order of `items`. Files take a one-color icon for their type from the label (a whole name such as `.gitignore`, else its extension). Indent guides show beside the row with the keyboard and its siblings, and all of them while the pointer is over the tree. A long name gives way in the middle: the start first, then the end loses its own start, so the extension stays. `gitStatus` maps values to `added`, `modified`, `deleted`, `renamed`, `untracked` or `ignored`, and a folder shows a dot when something inside it changed. `search` adds a SearchField over the rows: typing keeps only the matches and their folders. `contextMenu` returns a `ContextMenuContent` for the row you right-click (or long-press, or press the menu key on); its items act through their own `onSelect`. With `onRename`, F2 turns the focused row's label into a field, and so does setting `editing` to a row's value (from a menu's Rename). Return, or leaving the field, calls `onRename` with the new name, and Escape cancels. Either way `onEditingChange(null, details)` runs after, and `details.reason` says how it ended. Agents see the rename as its own component, a group around the tree with the tree's name, with `start(value)`, `rename(value, label)` and `cancel()`: a step that names the tree and one of those actions reaches it.

{% demo src="tree/file-tree" %}

```tsx
<Tree aria-label="Project files" items={nodes} sort search gitStatus={{ 'src/tree.tsx': 'added' }}
  defaultExpanded={['src']} value={selected} onValueChange={setSelected}
  editing={editing} onEditingChange={setEditing}
  onRename={(node, label) => rename(node.value, label)}
  contextMenu={(node) => (
    <ContextMenuContent aria-label={`${node.label} actions`}>
      <ContextMenuItem value="rename" onSelect={() => setEditing(node.value)}>Rename</ContextMenuItem>
      <ContextMenuItem value="delete" destructive onSelect={() => remove(node.value)}>Delete</ContextMenuItem>
    </ContextMenuContent>
  )} />
```

## Any hierarchy

For something that isn't files, set `icons={false}` and give leaves their own `icon` from the icon set. `detail` goes after the label: a count, a kind, a short status. `dimmed` fades a row that's listed but not the point, and `disabled` makes one that can't be selected or run. `mode="multiple"` makes the value an array: ⌘-click and ⇧-click select more than one row. `mode="none"` is a tree that only navigates or runs `onAction`.

{% demo src="tree/basic" %}

```tsx
const MAILBOXES: TreeNode[] = [
  { value: 'icloud', label: 'iCloud', children: [
    { value: 'inbox', label: 'Inbox', icon: 'tray', detail: '12' },
    { value: 'archive', label: 'Archive', icon: 'folder', dimmed: true },
  ] },
]

<Tree aria-label="Mailboxes" items={MAILBOXES} icons={false} defaultExpanded="all"
  mode="multiple" value={selected} onValueChange={setSelected} />
```

## Selecting, opening and running

These are UI SDK's, and they are three separate things. Selection is `value` / `defaultValue` / `onValueChange(value, details)`: one value or `null`, or an array with `mode="multiple"`. Which branches are open is `expanded` / `defaultExpanded` / `onExpandedChange(expanded, details)`; `defaultExpanded="all"` opens every branch, and `autoExpand` opens the branches you list (and the ones above them) whenever the list changes, while the user can still close them. `onAction(value, details)` runs on a press or Return, apart from selecting: open the file there. Return a Promise and the row shows `data-pending` until it settles. `actionOn="double-press"` runs it on a double press instead, as a file browser does: a single press only selects, Return still runs it, and the arrow keys never do. A press on a branch also opens or closes it; `expandOnPress={false}` leaves that to its chevron and the arrow keys. Every `details` has a `reason` (`item-press`, `list-navigation`, `trigger-press`, `imperative`) and `cancel()`.

`activation="automatic"` selects as the arrow keys move. `current` marks the row for the page you're on (`aria-current="page"`) and opens the branches above it, for a tree of links. A `createTreeController()` passed as `controller` opens and closes branches, selects, and `reveal(value)`s a row from outside.

## From parts

With children, `Tree` is UI SDK's composition with the kit's rows: an item that holds a `TreeGroup` is a branch.

```tsx
<Tree aria-label="Guide" defaultExpanded={['start']}>
  <TreeItem value="start">
    <TreeItemLabel><TreeItemIndicator />Getting started</TreeItemLabel>
    <TreeGroup>
      <TreeItem value="install"><TreeItemLabel render={<a href="#/install" />}>Installation</TreeItemLabel></TreeItem>
    </TreeGroup>
  </TreeItem>
</Tree>
```

Add `checkable` and a `TreeItemCheckbox` in each label for checkboxes kept apart from the selection (`checked` / `onCheckedChange`, with `checkStrategy`). See [UI SDK's Tree](https://ui-sdk.dev/docs/components/tree) for loading children, links and find in page.

## Drag and drop

Rows drag only when `canDrag` allows them. They carry their path as text, and `onDragStart` can add your own data, such as a custom type that another part of the page accepts. `onMove` turns on moving rows into folders within the tree, and `canMove` vetoes a drop. `externalDrop` takes drops from outside the tree, such as files from the computer or rows from another list. `accepts` decides from the drag's types, the target folder lights up while it would be accepted, and `onDrop` gets the `DataTransfer` and the folder (or `null` for the tree itself). A file's row stands for the folder it's in.

```tsx
<Tree aria-label="Files" items={nodes}
  canDrag={(rows) => rows.every((r) => !r.children)}
  onDragStart={(rows, data) => data.setData('application/x-my-file', rows.map((r) => r.value).join('\n'))}
  externalDrop={{
    accepts: (types) => types.includes('Files'),
    onDrop: (data, folder) => upload(folder?.value ?? 'root', [...data.files]),
  }} />
```

## Accessibility

It is a `tree` of `treeitem`s with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded` and `aria-selected`, and a single tab stop. ArrowUp and ArrowDown move between rows. ArrowRight opens a folder or moves into it, and ArrowLeft closes it or moves to its parent. Home and End jump to the first and last rows, `*` opens the folders beside the focused one, and typing finds the next row whose label starts with that text. Space selects, and Return selects and runs `onAction`. The keyboard reaches rows that aren't in the DOM: the tree knows the whole hierarchy from `items`, and scrolls to them. The search field is a separate SearchField above the tree, outside its `tree` role. A row's file-type icon is hidden from its name, and its Git status is spoken after it. `aria-label` (or `aria-labelledby`) names the tree.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `aria-label` | — | The tree's name. |
| `items` | — | `TreeNode[]`: `value`, `label`, `children` (folders), `disabled`, `href`, `detail`, `detailTitle`, `icon`, `dimmed`. Without children of its own, the tree draws them. |
| `paths` | — | File paths instead of `items` (`['src/index.ts', 'README.md']`); folders become branches. |
| `mode` | `'single'` | `'single'`, `'multiple'` or `'none'`. |
| `value` / `defaultValue` / `onValueChange` | — | The selection, controlled or initial. A controlled value scrolls into view. |
| `expanded` / `defaultExpanded` / `onExpandedChange` | — | The open branches. `defaultExpanded` also takes `'all'`. |
| `autoExpand` | — | Branches (and those above them) to open whenever this list changes. The user can still close them. |
| `onAction` | — | `(value, details) => …` on a press or Return. |
| `actionOn` | `'press'` | `'double-press'`: a pointer runs `onAction` only on a double press; a single press selects. Return still runs it. |
| `activation`, `expandOnPress`, `current`, `checkable`, `checked`, `disabled`, `controller`… | — | UI SDK's, unchanged. |
| `sort` | `false` | Folders first, then A→Z. Otherwise the order of `items`. |
| `search` | `false` | A SearchField above the rows that filters to the matches. |
| `flatten` | `false` | A chain of single-folder folders shows as one row (`src / app`). |
| `icons` | `true` | A one-color file-type icon on leaves, from the label's name or extension. `false` leaves only a node's own `icon`. |
| `gitStatus` | — | Git-style status by value. |
| `density` | `'default'` | `'compact'` (24px rows), `'default'` (30px) or `'relaxed'` (36px). |
| `contextMenu` | — | `(node) => ContextMenuContent`. |
| `preview` | — | `(node) => ReactNode`: a [HoverCard](https://blamy.github.io/ui/#/hover-card) beside the row the pointer rests on, or keyboard focus stays on (a file's size and last change). Return nothing for rows without one. |
| `editing`, `onEditingChange`, `onRename` | — | Rename in place. |
| `canDrag`, `onDragStart`, `onMove`, `canMove`, `externalDrop` | — | Drag and drop. |
| `emptyMessage` | — | Shown when there are no rows. While searching it is "No matches". |

`TreeItem`, `TreeItemLabel`, `TreeItemIndicator`, `TreeItemCheckbox` and `TreeGroup` take what UI SDK's parts take. `TreeFolderIcon` and `TreeFileIcon` are file icons for lists of files outside a Tree (a Tree's rows draw their own). `TreeFolderIcon` takes `open`, and `TreeFileIcon` takes the file's `name`. Both take `size` (default 18) and `className`.

## Styling

A tree drawn from `items` is a `data-slot="tree-view"` wrapper that takes `className` and `style`. Give it a height (or let a flex parent stretch it), because rows are virtualized inside it. The tree itself is UI SDK's `tree`, with `tree-item`, `tree-label` and `tree-indicator` parts. Style a row through its label, which carries `data-selected`, `data-expanded`, `data-branch`, `data-current`, `data-disabled` and `data-pending`; keyboard focus is on the item around it. `treeRowVariants` is the label's recipe and `treeVariants` holds the density: `--tree-row-height`, `--tree-pad-x`, `--tree-gap` and `--tree-indent` set a row's height, its inline padding, the gap between its parts and the indent of a level, `--tree-nudge` how far the chevron sits below center, and `--tree-inset` the margin either side of a drawn row (inside a 16px inset); every item has UI SDK's `--tree-level`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `treeVariants`

Defined in `@/components/ui/tree`. Base classes:

```text
text-footnote text-foreground
```

**`density`** — default `default`

| Value | Adds |
| --- | --- |
| `compact` | `[--tree-row-height:24px] [--tree-pad-x:6.4px] [--tree-gap:4.8px] [--tree-indent:18.6875px] [--tree-nudge:0.8px] [--tree-inset:1.6px]` |
| `default` (default) | `[--tree-row-height:30px] [--tree-pad-x:8px] [--tree-gap:6px] [--tree-indent:21.5px] [--tree-nudge:1px] [--tree-inset:2px]` |
| `relaxed` | `[--tree-row-height:36px] [--tree-pad-x:9.6px] [--tree-gap:7.2px] [--tree-indent:24.28125px] [--tree-nudge:1.2px] [--tree-inset:2.4px]` |

### `treeRowVariants`

Defined in `@/components/ui/tree`. Base classes:

```text
[ 'group/tree-row relative box-border flex h-(--tree-row-height) w-full min-w-0 cursor-default items-center gap-(--tree-gap) rounded-ctl pr-(--tree-pad-x) leading-(--tree-row-height) select-none', 'pl-[calc(var(--tree-pad-x)+(var(--tree-level,1)-1)*var(--tree-indent))]', 'hover:not-data-disabled:not-data-selected:bg-secondary data-selected:bg-primary/16 data-current:font-medium data-disabled:opacity-50 data-pending:cursor-progress', 'group-focus-visible/tree-item:[box-shadow:inset_0_0_0_1px_var(--ring)]', 'group-data-dimmed/tree-item:opacity-60 group-data-drop-target/tree-item:bg-secondary group-data-drop-target/tree-item:[box-shadow:inset_0_0_0_2px_var(--primary)]', ]
```

No variants.
