# Tree

A hierarchy you can expand, collapse, search and select from the keyboard: [UI SDK](https://ui-sdk.dev)'s Tree with the kit's rows. Compose it from parts for a short tree whose rows are yours, or hand it nested `items` and it draws the rows itself, only the ones in view, with what a file browser has: indent guides, a chevron on folders, a file-type icon on files, a truncating label and a short `trailing` note after it, search, Git status, rename in place, a context menu and a hover preview per row, and drag and drop. A node with `children` is a folder. Any hierarchy works, not only files: an outline, a database schema, a syntax tree. For a debugger's values use [ObjectTree](https://blamy.github.io/ui/#/object-tree), and for its frames [CallStack](https://blamy.github.io/ui/#/call-stack): both draw their own rows on this tree, so the three look and move alike. Use [Listbox](https://blamy.github.io/ui/#/listbox) for a flat list of choices, [List](https://blamy.github.io/ui/#/lists) for flat rows you press, [DataTable](https://blamy.github.io/ui/#/data-table) for records in columns, and [NavigationStack](https://blamy.github.io/ui/#/navigation-stack) to drill into one level at a time.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/tree.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import { Tree } from '@/components/ui/tree'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { Tree } from '@brett_lamy/ui/tree'
```
{% endtab %}
{% endtabs %}

## File tree

`sort` lists folders first, then A→Z, the way a file browser does. Without it, rows keep the order of `items`. Files take a one-color icon for their type from the label (a whole name such as `.gitignore`, else its extension). Indent guides show beside the row with the keyboard and its siblings, and all of them while the pointer is over the tree. A long name gives way in the middle: the start first, then the end loses its own start, so the extension stays. `gitStatus` maps values to `added`, `modified`, `deleted`, `renamed`, `untracked` or `ignored`, and a folder shows a dot when something inside it changed. `search` adds a SearchInput over the rows: typing keeps only the matches and their folders. `contextMenu` returns a `DropdownMenuContent` for the row you right-click (or long-press, or press the menu key on); its items act through their own `onSelect`. With `onRename`, F2 turns the focused row's label into a field, and so does setting `editing` to a row's value (from a menu's Rename). Return, or leaving the field, calls `onRename` with the new name, and Escape cancels. Either way `onEditingChange(null, details)` runs after, and `details.reason` says how it ended. Agents see the rename as its own component, a group around the tree with the tree's name, with `start(value)`, `rename(value, label)` and `cancel()`: a step that names the tree and one of those actions reaches it.

{% demo src="tree/file-tree" %}

```tsx
<Tree aria-label="Project files" items={nodes} sort search gitStatus={{ 'src/tree.tsx': 'added' }}
  defaultExpanded={['src']} value={selected} onValueChange={setSelected}
  editing={editing} onEditingChange={setEditing}
  onRename={(node, label) => rename(node.value, label)}
  contextMenu={(node) => (
    <DropdownMenuContent aria-label={`${node.label} actions`}>
      <DropdownMenuItem value="rename" onSelect={() => setEditing(node.value)}>Rename</DropdownMenuItem>
      <DropdownMenuItem value="delete" destructive onSelect={() => remove(node.value)}>Delete</DropdownMenuItem>
    </DropdownMenuContent>
  )} />
```

## Any hierarchy

For something that isn't files, set `icons={false}` and give leaves their own `icon` from the icon set. `trailing` goes after the label, at the row's end: a count, a kind, a short status (with `description` saying it in words, for its tooltip and screen readers). `dimmed` fades a row that's listed but not the point, and `disabled` makes one that can't be selected or run. `mode="multiple"` makes the value an array: ⌘-click and ⇧-click select more than one row. `mode="none"` is a tree that only navigates or runs `onAction`.

{% demo src="tree/basic" %}

```tsx
const MAILBOXES: TreeNode[] = [
  { value: 'icloud', label: 'iCloud', children: [
    { value: 'inbox', label: 'Inbox', icon: 'tray', trailing: '12' },
    { value: 'archive', label: 'Archive', icon: 'folder', dimmed: true },
  ] },
]

<Tree aria-label="Mailboxes" items={MAILBOXES} icons={false} defaultExpanded="all"
  mode="multiple" value={selected} onValueChange={setSelected} />
```

## Database schema

`schemaTreeItems(schema)` (from `@/lib/pglite-schema`) turns what `useSchema()` gives into items: schemas, then tables and views with their kind and row count, then columns with their type, foreign key and `not null`, and a key on a primary key. Each node carries its `table` (and `column`), so `onAction`'s `details.node` says what was chosen. The [SQL console](https://blamy.github.io/ui/#/sql-console) uses it to paste `select * from …`.

{% demo src="tree/schema" %}

```tsx
const { schema, loading } = useSchema()
const items = schemaTreeItems(schema)

<Tree aria-label="Database schema" items={items} icons={false} density="compact"
  loading={loading} emptyState="No tables yet" autoExpand={items.map((n) => n.value)}
  onAction={(_value, { node }) => {
    const n = node as SchemaTreeNode
    if (n.kind === 'table') insert(`select * from ${n.table.name};`)
  }} />
```

## Loading and empty

`loading` says the data isn't here yet: while there are no rows, placeholder rows show at the rows' own height and indent, and the tree is `aria-busy`. Rows that are already there stay on show while more load. With no rows, `emptyState` shows: a string is the title of the kit's [EmptyState](https://blamy.github.io/ui/#/empty-state), and any other node shows as it is. By default it says "No matches" while searching and "No items" otherwise; `null` shows nothing.

{% demo src="tree/loading" %}

## Rows of your own

`renderRow(node, { level, branch, expanded })` draws a row on the same virtual tree, for rows a file browser doesn't have. Return a `TreeItemLabel`: it carries the row's look (`treeRowVariants`: height, indent, hover, selection, focus ring), and its text is the name typing finds. Put a `TreeItemIndicator` in it for a branch. The item around it, its place in the scroll, keyboard focus, selection and `onAction` stay the tree's; indent guides, icons, Git status, rename and dragging are the built-in row's and don't apply. ObjectTree and CallStack are built this way.

{% demo src="tree/custom-rows" %}

```tsx
<Tree aria-label="Teams" items={teams} defaultExpanded="all"
  renderRow={(node, { branch }) => (
    <TreeItemLabel>
      {branch ? <TreeItemIndicator /> : <span className="size-4 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{node.label}</span>
      {node.trailing ? <Badge variant="secondary">{node.trailing}</Badge> : null}
    </TreeItemLabel>
  )} />
```

## Selecting, opening and running

These are UI SDK's, and they are three separate things. Selection is `value` / `defaultValue` / `onValueChange(value, details)`: one value or `null`, or an array with `mode="multiple"`. Which branches are open is `expanded` / `defaultExpanded` / `onExpandedChange(expanded, details)`; `defaultExpanded="all"` opens every branch, and `autoExpand` opens the branches you list (and the ones above them) when they join the list; one the user closes stays closed while it stays listed. `onAction(value, details)` runs on a press or Return, apart from selecting: open the file there. In a tree drawn from `items`, `details.node` is the row's node. Return a Promise and the row shows `data-pending` until it settles. `actionOn="double-press"` runs it on a double press instead, as a file browser does: a single press only selects, Return still runs it, and the arrow keys never do. A press on a branch also opens or closes it; `expandOnPress={false}` leaves that to its chevron and the arrow keys. Every `details` has a `reason` (`item-press`, `list-navigation`, `trigger-press`, `imperative`) and `cancel()`.

A selection set from outside comes into view: a step to the next row scrolls only as far as it takes, and a jump lands mid-list, with the rows around it on show. `activation="automatic"` selects as the arrow keys move. `current` marks the row for the page you're on (`aria-current="page"`) and opens the branches above it, for a tree of links. A `createTreeController()` passed as `controller` opens and closes branches, selects, and `reveal(value)`s a row from outside.

## From parts

With children, `Tree` is UI SDK's composition with the kit's rows: an item that holds a `TreeGroup` is a branch. The props for a tree drawn from data (`items`, `sort`, `search`, `renderRow`…) aren't typed on this one (`TreePartsProps` against `TreeDataProps`), so none is silently ignored.

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

It is a `tree` of `treeitem`s with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded` and `aria-selected`, and a single tab stop. ArrowUp and ArrowDown move between rows. ArrowRight opens a folder or moves into it, and ArrowLeft closes it or moves to its parent. Home and End jump to the first and last rows, `*` opens the folders beside the focused one, and typing finds the next row whose label starts with that text. Space selects, and Return selects and runs `onAction`. The keyboard reaches rows that aren't in the DOM: the tree knows the whole hierarchy from `items`, and scrolls to them. The search field is a separate SearchInput above the tree, outside its `tree` role. A row's file-type icon is hidden from its name, and its Git status is spoken after it. `aria-label` (or `aria-labelledby`) names the tree.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `aria-label` | — | The tree's name. |
| `items` | — | `TreeNode[]`: `value`, `label`, `children` (folders), `disabled`, `href`, `trailing`, `description`, `icon`, `dimmed`. The tree draws them, virtualized. |
| `paths` | — | File paths instead of `items` (`['src/index.ts', 'README.md']`); folders become branches. |
| `mode` | `'single'` | `'single'`, `'multiple'` or `'none'`. |
| `value` / `defaultValue` / `onValueChange` | — | The selection, controlled or initial. A controlled value scrolls into view. |
| `expanded` / `defaultExpanded` / `onExpandedChange` | — | The open branches. `defaultExpanded` also takes `'all'`. |
| `autoExpand` | — | Branches (and those above them) to open whenever this list changes. The user can still close them. |
| `onAction` | — | `(value, details) => …` on a press or Return; `details.node` is the row's node in a tree drawn from `items`. |
| `actionOn` | `'press'` | `'double-press'`: a pointer runs `onAction` only on a double press; a single press selects. Return still runs it. |
| `activation`, `expandOnPress`, `current`, `checkable`, `checked`, `disabled`, `controller`… | — | UI SDK's, unchanged. |
| `sort` | `false` | Folders first, then A→Z. Otherwise the order of `items`. |
| `search` | `false` | A SearchInput above the rows that filters to the matches. |
| `flatten` | `false` | A chain of single-folder folders shows as one row (`src / app`). |
| `icons` | `true` | A one-color file-type icon on leaves, from the label's name or extension. `false` leaves only a node's own `icon`. |
| `gitStatus` | — | Git-style status by value. |
| `density` | `'default'` | `'compact'` (24px rows), `'default'` (30px) or `'comfortable'` (36px, for touch). |
| `contextMenu` | — | `(node) => DropdownMenuContent`. |
| `preview` | — | `(node) => ReactNode`: a [HoverCard](https://blamy.github.io/ui/#/hover-card) beside the row the pointer rests on, or keyboard focus stays on (a file's size and last change). Return nothing for rows without one. |
| `editing`, `onEditingChange`, `onRename` | — | Rename in place. |
| `canDrag`, `onDragStart`, `onMove`, `canMove`, `externalDrop` | — | Drag and drop. |
| `loading` | `false` | No data yet: placeholder rows while there are none, and `aria-busy`. |
| `emptyState` | "No items" / "No matches" | Shown when there are no rows: a string is EmptyState's title, a node shows as it is, `null` shows nothing. |
| `renderRow` | — | `(node, { level, branch, expanded }) => TreeItemLabel`: a row of your own. |

`TreeItem`, `TreeItemLabel`, `TreeItemIndicator`, `TreeItemCheckbox` and `TreeGroup` take what UI SDK's parts take.

The file icons live in `@/lib/file-icons`, for lists of files outside a Tree too: `FileTypeIcon` is the one-color glyph a Tree's rows draw (`name`, `size` 16), `FileBadgeIcon` a page with a colored badge for the type (`name`, `size` 18) and `FolderIcon` a two-tone folder that opens (`open`, `size` 18); all take `className`, and `fileTypeOf(name)` gives the type a name maps to.

## Styling

A tree drawn from `items` is a `data-slot="tree-view"` wrapper that takes `className` and `style`. Give it a height (or let a flex parent stretch it), because rows are virtualized inside it. The tree itself is UI SDK's `tree`, with `tree-item`, `tree-label` and `tree-indicator` parts. Style a row through its label, which carries `data-selected`, `data-expanded`, `data-branch`, `data-current`, `data-disabled` and `data-pending`; keyboard focus is on the item around it. `treeRowVariants` is the label's recipe and `treeVariants` holds the density: `--tree-row-height`, `--tree-pad-x`, `--tree-gap` and `--tree-indent` set a row's height, its inline padding, the gap between its parts and the indent of a level, `--tree-nudge` how far the chevron sits below center, and `--tree-inset` the margin either side of a drawn row (inside a 16px inset); every item has UI SDK's `--tree-level`. These are the styling API: set them in `className` to retune one tree. Keyboard focus is a 2px `--ring` inside the row, the selection a `primary` wash. Git status inks are the `git-added`, `git-modified`, `git-renamed`, `git-deleted` and `git-ignored` color tokens (`--git-added`… to retheme them). While it loads, the placeholder is a `group` named "Loading …" inside the `tree-view`.

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
| `comfortable` | `[--tree-row-height:36px] [--tree-pad-x:9.6px] [--tree-gap:7.2px] [--tree-indent:24.28125px] [--tree-nudge:1.2px] [--tree-inset:2.4px]` |

### `treeRowVariants`

Defined in `@/components/ui/tree`. Base classes:

```text
[ 'group/tree-row relative box-border flex h-(--tree-row-height) w-full min-w-0 cursor-default items-center gap-(--tree-gap) rounded-ctl pe-(--tree-pad-x) leading-(--tree-row-height) select-none', // Logical, so a row's own `ps-*` (ObjectTree's capped indent) merges with it, and the indent follows the text direction. 'ps-[calc(var(--tree-pad-x)+(var(--tree-level,1)-1)*var(--tree-indent))]', 'hover:not-data-disabled:not-data-selected:bg-secondary data-selected:bg-primary/16 data-current:font-medium data-disabled:opacity-50 data-pending:cursor-progress', 'group-focus-visible/tree-item:[box-shadow:inset_0_0_0_2px_var(--ring)]', 'group-data-dimmed/tree-item:opacity-60 group-data-drop-target/tree-item:bg-secondary group-data-drop-target/tree-item:[box-shadow:inset_0_0_0_2px_var(--primary)]', ]
```

No variants.
