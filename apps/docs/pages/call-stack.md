# CallStack

Frames as a debugger lists them: the frame the stack stopped in marked apart from the one you've selected, runs of framework and library frames folded into one row, async boundaries as labelled separators, and a location that shows short with the whole path a press away. It's virtualized, so a stack of thousands of frames from recursion stays quick to scroll and step through. It takes plain data and knows nothing about what produced it.

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

<CallStack frames={frames} selectedId={frameId} onSelect={(frame) => setFrameId(frame.id)} />
```

{% demo src="call-stack/frames" %}

The first real frame is the top of the stack, where it stopped, and it wears a marker and a heavier name wherever the selection is. A frame with no `functionName` shows `(anonymous)`, and one with no `location` shows only its name. Leave out `selectedId` and the list remembers its own, starting from `defaultSelectedId`. Selecting a frame from outside scrolls it into view. While new stacks keep coming, as they do when a playhead is dragged through thousands of steps, the list takes the newest each time the last has gone in and skips those in between.

## Runs

Two or more `framework` or `library` frames in a row fold into one row, `2 React frames` when they share a `label`, and `3 framework frames` or `3 library frames` when they don't. Press it, or press Enter on it, to open it and again to close it, and the frames show beneath it, set in. Each run opens by itself.

The top frame and the selected frame never hide. If either sits inside a run, the frames on each side fold around it, and pressing either fold opens the whole run. `collapseRuns={false}` turns folding off, and `defaultExpandedRuns` opens runs from the start, each named by the id of its first frame.

## Async boundaries

A frame with `kind: 'async'` isn't a frame, it's the boundary between the frames before and after it, drawn as a separator with its `label` (`async` if there's none). A separator can't be focused or selected, and arrow keys pass over it.

## Locations

A location shows its file's last part and its line. At narrow widths it's cut from the left, so the line number and the end of the file name stay. The whole path is the tooltip, and pressing the location opens it with a Copy, without selecting the frame. On the keyboard, Right from a row reaches it.

## Large stacks

Only the rows on screen are in the DOM, so a thousand rounds of recursion scrolls as smoothly as ten. Home and End reach either end, the arrow keys step, the page keys go further, and typing a function's name jumps to it.

{% demo src="call-stack/recursive" %}

## Accessibility

It's react-aria's GridList under its Virtualizer. Selection follows the arrow keys, so a debugger's source and scopes can follow along, and it's `aria-selected` on the row. Each row is announced by its function, file and line, with `stopped here` on the top frame, and a run by its count and whether it's open. Each stretch between async boundaries is a `rowgroup` named by its separator.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `frames` | required | Top of the stack first. See below. |
| `selectedId` | none | The selected frame. Leave it out for a list that remembers its own. |
| `defaultSelectedId` | none | Selected when the list mounts, when `selectedId` is left out. |
| `onSelect` | none | `(frame, index) => void`, when a frame is pressed or the arrow keys reach it. |
| `collapseRuns` | `true` | Fold runs of framework and library frames. |
| `defaultExpandedRuns` | none | Runs open when the list mounts, each named by its first frame's id. |
| `rowHeight` | `26` | Row height in px. |
| `emptyMessage` | `No frames` | Shown when there are no frames. |
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

The list is `data-slot="call-stack"`, with `call-stack-frame` rows (`data-kind`, and `data-top` on the top frame), `call-stack-run` rows and `call-stack-separator` headers. `callStackRowVariants` is the rows' recipe. It sits with [Lists](https://blamy.github.io/ui/#/lists) at the density a debugger needs: selection is the same `accent` wash as a selected ListRow.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `callStackRowVariants`

Defined in `@/components/ui/call-stack`. Base classes:

```text
[ 'group/row flex h-full w-full cursor-default items-center gap-1.5 pr-2 text-caption leading-none text-foreground outline-none', 'data-hovered:bg-accent/50 data-selected:bg-accent data-focus-visible:[box-shadow:inset_0_0_0_2px_var(--ring)]', ]
```

**`kind`**

| Value | Adds |
| --- | --- |
| `app` | — |
| `framework` | `text-muted-foreground data-selected:text-foreground` |
| `run` | `font-sans text-muted-foreground` |

**`inRun`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `pl-5` |
| `false` (default) | `pl-1` |
