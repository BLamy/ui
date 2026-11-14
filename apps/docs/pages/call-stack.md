# CallStack

Frames as a debugger lists them: the frame the stack stopped in marked apart from the one you've selected, runs of framework and library frames folded into one row, async boundaries as labelled separators, and a location that shows short with the whole path a press away. It's virtualized, so a stack of thousands of frames from recursion stays quick to scroll and step through. It takes plain data and knows nothing about what produced it. Its rows are drawn on the kit's [Tree](https://blamy.github.io/ui/#/tree) (`renderRow`), so it shares Tree's row look, densities, selection, empty state and virtualizer with Tree and [ObjectTree](https://blamy.github.io/ui/#/object-tree), the values beside it in a debugger. For a list of things that aren't frames, use Tree or [Listbox](https://blamy.github.io/ui/#/list-box).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/call-stack.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { CallStack } from '@/components/ui/call-stack'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { CallStack } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Give it `frames`, top of the stack first, and the selected frame. The list fills its parent, so give the parent a height.

```tsx
const frames = [
  { id: 'a', functionName: 'formatPrice', location: { file: '/src/lib/money.ts', line: 42, column: 11 } },
  { id: 'r1', functionName: 'renderWithHooks', kind: 'framework', label: 'React', location: { file: reactDom, line: 14985 } },
  { id: 'r2', functionName: 'beginWork', kind: 'framework', label: 'React', location: { file: reactDom, line: 19073 } },
  { id: 'wait', kind: 'async', label: 'await loadCart' },
  { id: 'b', functionName: 'loadCart', location: { file: '/src/cart/load.ts', line: 9 } },
]

<CallStack frames={frames} value={frameId} onValueChange={(id) => setFrameId(id)} />
```

{% demo src="call-stack/frames" %}

The first real frame is the top of the stack, where it stopped, and it wears a marker and a heavier name wherever the selection is. A frame with no `functionName` shows `(anonymous)`, and one with no `location` shows only its name. Leave out `value` and the list remembers its own, starting from `defaultValue`. `onValueChange` gets the frame's id, then UI SDK's change details with the frame itself: `details.frame`, its `details.index` in `frames`, `details.reason` (`item-press` or `list-navigation`) and `details.cancel()` to refuse the change. Selecting a frame from outside scrolls it into view. While new stacks keep coming, as they do when a playhead is dragged through thousands of steps, the list takes the newest each time the last has gone in and skips those in between.

## Runs

Two or more `framework` or `library` frames in a row fold into one row, `2 React frames` when they share a `label`, and `3 framework frames` or `3 library frames` when they don't. A run is a branch of the tree: press it, or press Return or Right on it, to open it, and press it again (or Left) to close it. The frames show beneath it, set in, one level down. Each run opens by itself, and a run is never selected.

The top frame and the selected frame never hide. If either sits inside a run, the frames on each side fold around it, and pressing either fold opens the whole run. `collapseRuns={false}` turns folding off, and `defaultExpandedRuns` opens runs from the start, each named by the id of its first frame.

## Async boundaries

A frame with `kind: 'async'` isn't a frame, it's the boundary between the frames before and after it, drawn as a separator with its `label` (`async` if there's none). A separator is a disabled row: it can't be focused or selected, arrow keys pass over it, and a screen reader still finds it between the frames.

## Locations

A location shows its file's last part and its line. At narrow widths it's cut from the left, so the line number and the end of the file name stay. The whole path is the tooltip, and pressing the location opens it in a popover with a Copy, without selecting the frame. The location's button stays out of the tab order: on the keyboard, Return on a frame shows its whole path.

## Large stacks

Only the rows on screen are in the DOM, so a thousand rounds of recursion scrolls as smoothly as ten. Home and End reach either end, the arrow keys step, and typing a function's name jumps to it, whether or not that row is in the DOM.

{% demo src="call-stack/recursive" %}

## Accessibility

It's the kit's Tree ([UI SDK](https://ui-sdk.dev)'s Tree over its virtualizer): a `tree` with one tab stop, a `treeitem` per frame, a branch per run (`aria-expanded`, with its frames at `aria-level` 2) and a disabled item per async boundary. Selection follows the arrow keys, so a debugger's source and scopes can follow along, and it's `aria-selected` on the row. Each row is named by its function, file and line, with `stopped here` on the top frame, and a run by its count.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `frames` | required | Top of the stack first. See below. |
| `value` | none | The selected frame's id. Leave it out for a list that remembers its own. |
| `defaultValue` | none | Selected when the list mounts, when `value` is left out. |
| `onValueChange` | none | `(id, details) => void`, when a frame is pressed or the arrow keys reach it. `details` has `frame`, `index`, `reason` and `cancel()`. |
| `collapseRuns` | `true` | Fold runs of framework and library frames. |
| `defaultExpandedRuns` | none | Runs open when the list mounts, each named by its first frame's id. |
| `density` | `'compact'` | Tree's scale: `'compact'` (24px rows), `'default'` (30px) or `'comfortable'` (36px, for touch). |
| `emptyState` | `No frames` | Shown when there are no frames: a string is [EmptyState](https://blamy.github.io/ui/#/empty-state)'s title, a node shows as it is, `null` shows nothing. |
| `aria-label` | `Call stack` | Names the list. |
| `className` / `style` | | On the root, merged last. |

### Frames

| Field | Effect |
| --- | --- |
| `id` | Unique in the stack. |
| `functionName` | Empty shows `(anonymous)`. |
| `location` | `{ file, line, column? }`. |
| `kind` | `app` by default, `framework` and `library` fold in runs, and `async` marks a boundary. |
| `label` | On a framework or library frame, who it belongs to. On an async boundary, the separator's text. |

## Styling

The list is `data-slot="call-stack"`, around a Tree's `tree-view`. Its rows are UI SDK's `tree-item`s, each with a `tree-label` inside drawn with Tree's `treeRowVariants`, and a label's `data-row` says what it is: `frame` (with `data-kind`, and `data-top` on the top frame), `run` or `separator`. Selection (`data-selected`, Tree's `primary` wash), an open run (`data-expanded`) and keyboard focus look as they do in a Tree, and the indent of a run's frames is Tree's `--tree-indent`.
