# ObjectTree

Values as a debugger shows them: scopes in collapsible sections, objects opened level by level, DevTools-style previews tinted by type. Children load when a row opens, failures stay on the row that failed, and a node with thousands of children groups them in ranges, so a 100,000 element array is a few rows. It takes plain data and knows nothing about where the values came from, so it fits any JSON-like value as well. Its previews are a part of their own, ObjectValue, for a console row or anywhere else a value shows up.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/object-tree.json https://blamy.github.io/ui/r/object-value.json https://blamy.github.io/ui/r/object-tree-model.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { ObjectTree } from '@/components/ui/object-tree'
import { ObjectValue } from '@/components/ui/object-value'
import { nodeFromValue } from '@/lib/object-tree'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { ObjectTree, ObjectValue, nodeFromValue } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Give it a `root` and a `loadChildren`. A node has an `id`, a `name`, a `value` that says what it is and what to show, and whether it `hasChildren`. Keep anything of your own in `data`, like the object id your engine needs.

```tsx
const root = useMemo(() => [
  { id: 'local', name: 'addItem (local)', section: true, data: scopeId },
  { id: 'global', name: 'Global', section: true, defaultExpanded: false, data: globalId },
], [scopeId, globalId])

<ObjectTree
  aria-label="Scopes"
  root={root}
  loadChildren={(node) => engine.readProperties(node.data)}
  onInvokeGetter={(node) => engine.callGetter(node.data)}
/>
```

{% demo src="object-tree/scopes" %}

The tree fills its parent, so give the parent a height. A row's `id` only has to be unique among its siblings: one object can sit at many places in a tree, and each place is its own row with its own children.

## Lazy children

`loadChildren(node)` runs when a row first opens, and what it returns is kept: closing and reopening asks nothing. While it's waiting the row shows Loading, and if it rejects, the failure and a Retry stay on that row while everything around it carries on. A loader can answer without a promise, and then there's no Loading at all.

A new `root` is a new moment. What was loaded goes, and an answer still on its way finds nothing to land on and is dropped, so a slow answer about the last step never shows under this one. So keep `root` the same object until it really changes. Rows stay open across a new `root` if their ids stay the same, which makes a variable's name a good id: stepping through code keeps `state.items` open, and it asks for the new children. The last ones stay on show, faded, until they arrive, so nothing flickers. While new roots keep coming, as they do when a playhead is dragged through thousands of steps, the tree takes the newest each time the last has gone in and skips those in between.

{% demo src="object-tree/lazy" %}

## Values

`value` is plain data, so it can arrive from another process. `previewFromValue` makes one from a live value.

| `type` | Fields | Shows |
| --- | --- | --- |
| `string` | `value` | `"hello"`, truncated past 100 characters |
| `number` | `value`, a string for `NaN`, `-0`, `Infinity` | `42` |
| `boolean` | `value` | `true` |
| `null`, `undefined` | | `null` |
| `bigint` | `value` | `12n` |
| `symbol` | `value`, the text to show | `Symbol(id)` |
| `function` | `name`, `params`, `flavor`: `async`, `generator`, `async generator`, `class` | `ƒ add(a, b)` |
| `object` | `className`, `properties`, `overflow` | `Cart {id: "c_81", total: 12, …}` |
| `array` | `className`, `length`, `items`, `overflow` | `(3) [1, 2, 3]`, `Uint8Array(4) [1, 2, 3, 4]` |
| `map` | `className`, `size`, `entries`, `overflow` | `Map(1) {"a" => 1}` |
| `set` | `className`, `size`, `items`, `overflow` | `Set(2) {1, 2}` |
| `date`, `regexp` | `value`, the text to show | `/a+/g` |
| `error` | `name`, `message`, `stack` | `TypeError: nope` |
| `accessor` | | `(...)` |
| `entry` | `key`, `value`, one entry of a map | `"a" => 1` |
| `unavailable` | `label` | `<unavailable>`, `<uninitialized>` |

An object, array, map or set left without its contents shows only its name, `Cart` or `Array(3)`, and `overflow` adds an ellipsis when the preview doesn't list everything. Five properties or ten items show, each a word or two.

ObjectValue is the same preview on its own. A long string or an error's stack gets Show more and Copy beside it, and `quote={false}` gives the bare text a console shows for a top-level string.

{% demo src="object-tree/values" %}

## Getters

A value of `{ type: 'accessor' }` shows `(...)`. Pressing it calls `onInvokeGetter(node)`, and what comes back takes its place: a `value`, and `hasChildren`, `children` or `data` if it can open. A getter that throws says so beside the `(...)`, which can be pressed again. A new `root` drops an answer on its way, as it does for children.

## Sections

`section: true` on a top-level node makes it a collapsible header rather than a value, for Local, Closure and Global. Sections start open and everything else starts closed; `defaultExpanded` changes either. Nodes without `section` can sit beside them, the way `this` sits above the scopes. Sections take `children` or load through `loadChildren` like anything else.

## Large collections

Indexed children at the start of a node's list, an array's items or a map's entries, group above 100 (`groupSize`). They group as DevTools does: 100,000 is ten ranges of 10,000, each a hundred of 100, each a hundred values. Names come from the children, so a sparse array's ranges show its real indices. Named children after them, like `length`, stay outside the ranges. A list of only names stays flat up to 1,000, since names are easier to find unbroken, then groups too.

Only open rows are walked and only the rows on screen are in the DOM, so nothing slows down however many children are behind a closed row.

{% demo src="object-tree/large" %}

## Any JSON-like value

`nodeFromValue(value)` makes a node from a live value, with no loader to write. Its children are worked out as rows open, so a value can be huge or point back at itself. Maps, sets, dates, regexps, errors, typed arrays, getters and class instances all show as themselves, and copying gives JSON.

{% demo src="object-tree/json" %}

## Narrow windows

The tree follows its own width and has nothing to reset as it changes. The indent stops at a quarter of the row, so deep rows keep their room. A name takes what it needs up to 55% of what's left, and the value takes the rest. The whole value is always within reach: a tooltip for the pointer, a press on a row that cut its value off, or the … button on a long one, each opening a popover with all of it and a Copy. It sits inside a row of fixed height, which is why a string expands there rather than in place.

## Accessibility

It's react-aria's Tree, a `treegrid`, under its Virtualizer. Up and Down move, Right opens, Left closes or goes to the parent, Home, End and the page keys go further, and typing a name jumps to it. Enter does what a press does. Right also reaches the buttons in a row. Each row is announced by its name and value, with its level and whether it's open. ⌘C or Ctrl+C copies the focused value, unless you've selected text, which copies as usual.

With `onSelect`, a press selects and the chevron or a double press opens. Sections and ranges still open on a press, and don't select. On touch a tap acts, as it does across react-aria, so it opens a branch and selects a leaf, and a long press selects.

## Props

### ObjectTree

| Prop | Default | Effect |
| --- | --- | --- |
| `aria-label` | required | Names the tree. |
| `root` | required | One node or a list. A new object is a new moment: see Lazy children. |
| `loadChildren` | children of `nodeFromValue` values | `(node) => nodes`, or a promise of them. |
| `onInvokeGetter` | calls `nodeFromValue` getters | `(node) => ({ value, hasChildren?, children?, data? })`, or a promise of that. A whole node works too. |
| `onSelect` | none | `(node \| null) => void`. Rows can be selected only if it's there. |
| `copyValue` | see below | `(node) => text`, or a promise of it. By default a string's own text, an error's stack, JSON for `nodeFromValue` values, otherwise the preview. |
| `groupSize` | `100` | Indexed children to a range. |
| `rowHeight` | `24` | Row height in px. |
| `emptyMessage` | `Nothing to show` | Shown when `root` is an empty list. |
| `className` / `style` | | On the root, merged last. |

### Nodes

| Field | Effect |
| --- | --- |
| `id` | Unique among its siblings. |
| `name` | The label. Empty for a bare value. |
| `value` | What it is and what to show. Sections leave it out. |
| `hasChildren` | It can open. Defaults to whether `children` has anything, or to `true` for a section. |
| `children` | Known up front, so nothing loads. |
| `section` | A top-level group. |
| `defaultExpanded` | Starts open. |
| `dim` | Faded, as DevTools shows non-enumerable properties. |
| `data` | Anything of yours. |

### ObjectValue

| Prop | Default | Effect |
| --- | --- | --- |
| `value` | required | A `ValuePreview`. |
| `maxLength` | `100` | Characters of a long string to show at first. |
| `quote` | `true` | `false` for the bare text of a top-level console string. |
| `expandable` | `true` | Show more and Copy. Off for a row of fixed height. |

## Styling

The tree is `data-slot="object-tree"` with rows in `object-tree-row`, whose `data-kind` is `node`, `section`, `range` or `note`; `objectTreeRowVariants` is their recipe. Set `--object-tree-indent` on it to change the indent, 14px by default. The value is `object-value`, with its type in `data-type`. Tints are SyntaxHighlighting's token colors, so a value and the code beside it read alike, and its `--bl-syntax-*` properties retheme both.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `objectTreeRowVariants`

Defined in `@/components/ui/object-tree`. Base classes:

```text
[ 'group/row flex h-full w-full cursor-default items-center gap-1 pr-1 outline-none', 'pl-[min(calc((var(--tree-item-level)-1)*var(--object-tree-indent)),25%)]', 'text-caption leading-none text-foreground', 'data-selected:bg-accent data-focus-visible:[box-shadow:inset_0_0_0_2px_var(--ring)]', ]
```

**`kind`**

| Value | Adds |
| --- | --- |
| `node` | `font-mono data-hovered:bg-accent/50` |
| `section` | `font-sans font-semibold shadow-hairline-b data-hovered:bg-accent/50` |
| `range` | `font-mono text-muted-foreground data-hovered:bg-accent/50` |
| `note` | `font-sans text-muted-foreground` |

**`stale`**

| Value | Adds |
| --- | --- |
| `true` | `opacity-60` |
