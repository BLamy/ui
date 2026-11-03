# Code Viewer

A read-only source view for files of any shape. A megabyte on one line and half a million lines scroll as smoothly as twenty, because neither is ever in the page: a monospace line is a grid of cells, so what's on screen is arithmetic, and only that is rendered. Gutters take anything you put in them, and it takes a current line, tints and things to press inside a line. It knows nothing about debuggers, but that's what it's for: breakpoints, hit counts and jumping to an execution are all built on top of it below.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/code-viewer.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { CodeViewer } from '@/components/ui/code-viewer'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { CodeViewer } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Give it lines and a height. It fills its parent, so the parent needs one, or pass a class like `h-96`. `splitCodeLines` splits a source where JS engines count a new line, which isn't only at `\n`.

```tsx
<CodeViewer lines={splitCodeLines(source)} aria-label="app.js" className="h-96" />
```

{% demo src="code-viewer/basic" %}

If you don't want a big file in React, give it `lineCount` and `getLine` instead. It asks for the lines on screen, and in slices in the background, makes a pass over the file for two things: the widest line, which `maxLineLength` saves it, and comments that span lines, which your own `highlight` does. Keep `getLine` stable, or pass `contentKey` to say when the content really changed. To start a different file at the top, give the viewer a `key`.

```tsx
<CodeViewer lineCount={500_000} getLine={(i) => decoded.line(i)} contentKey={file.id} maxLineLength={file.widest} />
```

Lines are numbered from 1 everywhere in the viewer's props and from 0 only in `getLine` and `highlight`. Columns are UTF-16 code units from 0, as JS engines count them.

## Gutters

`gutters` is an ordered list. A gutter has an `id`, a `width` in px and `render(lineNumber)`, which can return anything: a dot, a count, a popover trigger. `onPress` makes the cell a button, and `isPressable` says on which lines. Gutters stay put while the code scrolls sideways. The built-in line numbers go next to the code, or first with `lineNumbers="start"`, or not at all with `lineNumbers={false}`.

Here's a debugger's source view, composed from the outside. Press a line number to jump there. Press a hit count for arrows and a box to type which execution. Press beside a line number for a breakpoint, and on a notch above the code for one at that column.

{% demo src="code-viewer/debugger" %}

```tsx
const gutters = useMemo(() => [
  { id: 'hits', width: 34, align: 'end', render: (line) => <HitCount line={line} /> },
  {
    id: 'breakpoint',
    width: 16,
    onPress: toggleBreakpoint,
    isPressable: canBreak,
    label: (line) => `Toggle a breakpoint on line ${line}`,
    render: (line) => <Dot on={breakpoints.has(line)} />,
  },
], [breakpoints, canBreak, toggleBreakpoint])

<CodeViewer
  lines={lines}
  gutters={gutters}
  onLineNumberPress={jumpToLine}
  isLineNumberPressable={ranAtLeastOnce}
/>
```

{% hint style="info" %}
A stepping debugger re-renders on every step. With `gutters` memoized and the callbacks stable, a step only redraws the rows that changed.
{% endhint %}

## Line state

`currentLine` draws a band across the line, and `currentColumn` a mark inside it. When they change the viewer brings them into view if they aren't already, a third of the way down, so what comes next shows too. `revealCurrentLine={false}` leaves that to you, and `{ smooth: true }` animates it. On a long line it scrolls sideways to the column as well.

`lineDecoration(lineNumber)` gives a line a `tint` (`info`, `success`, `warning`, `danger`, `muted`), or classes for its band, its text and its gutter cells, like dimming lines that never ran. It's only called for rows on screen.

`markers` puts things to press at a column inside a line, like column-level breakpoints: an array of `{ line, column, label, onPress, isActive }`, or a function from a line to its markers when there are many. A line of a bundle can have tens of thousands, and only those in the rendered part of the line are in the page. A marker sits over the grid and never moves the text. `children` replaces the default notch.

## Scrolling

`scrollToLine` works through a ref and a prop. `align` is `start`, `center` (the default), `end` or `nearest`, `column` scrolls sideways too, and `smooth` animates unless the reader prefers reduced motion. The prop acts when its value changes, so going back to the same line again is what the ref is for.

```tsx
const viewer = useRef<CodeViewerHandle>(null)

viewer.current?.scrollToLine(1200, { align: 'start', smooth: true })

<CodeViewer ref={viewer} scrollToLine={{ line: 1200, column: 80 }} />
```

## Big files

{% demo src="code-viewer/megabyte-line" %}

{% demo src="code-viewer/half-million-lines" %}

What's in the page is the rows on screen and a few more, and on each of them a few hundred characters around the view. The element that scrolls holds an empty box the size of the file, with a viewport stuck to its corner, and scrolling moves layers inside that viewport with one transform each. A scroll frame that doesn't bring in new rows or text doesn't run React at all. A range beyond 16 million px, which browsers can't size reliably, is compressed: the scrollbar still covers the whole file, and a pixel of it is more than a pixel of code.

The grid has these rules:

- **Plain characters** are one cell, at the measured width of the font. The measure follows the font when it loads or changes.
- **Tabs** reach the next stop, `tabSize` cells apart (default 2), wherever on the line they start. They're drawn as spaces and copied as tabs.
- **East Asian wide characters and emoji** are two cells, held to that width in the page, since a fallback font's idea of a character's width isn't the grid's.
- **Marks, joiners, skin tones and flags** stay with the character they belong to.
- **Controls and invisible characters**, including bidi overrides and zero-width spaces, show as a dim symbol and copy as themselves.
- **Right-to-left text** keeps its place on the line and is shaped and ordered inside that place. A selection inside a run of it is by position in the source, so it won't line up letter for letter.

## Selecting and copying

Selection is the viewer's own: two positions in the document, drawn on the rows, and copied from the source. The browser's can't work here, since most of what you'd select doesn't exist. So a selection can run from the first character of a file to the last, it survives scrolling away and back, and copying gets the source as it is, tabs and all, with nothing from the gutters.

Drag to select, past an edge to scroll along with it. Double click for a word, triple click for a line, and shift click to extend. Shift with the arrow keys, Home or End extends from where you last clicked. ⌘A or Ctrl+A selects all, ⌘C or Ctrl+C copies and Esc clears. The context menu's Copy works too. On touch, a pan scrolls, and a long press selects a word and then drags.

What that costs:

- Find in page only sees what's rendered, as with any virtualized list.
- Copy stops at 64 million characters, and `onCopyText` says so with `truncated`.
- Copying a whole file blocks while the text is put together. On 500,000 lines of 32 characters, that was about half a second.

The ref has `getSelection`, `getSelectionText`, `setSelection` and `selectAll`, and `onSelectionChange` follows along.

## Highlighting

{% demo src="code-viewer/highlighting" %}

By default a small lexer labels the text at once, with the library's token colors. It's shaped for C-family and script languages, and tells a regular expression from a division, carries block comments and template literals across lines, and can start anywhere: a window in the middle of a megabyte line is labelled just as if the whole line had been. `highlight={null}` turns highlighting off.

`highlight(text, lineIndex, context)` plugs in your own. It returns labelled pieces of the text, with a `type` from the library's token colors or a `className`, or a promise of them, and the text shows plain until the answer arrives. It's never given more than a window of a long line: `context.partial` says it's a window, `context.offset` where it starts, and `context.line` has the whole line if you need it. Keep the function stable, since a new one forgets everything it answered. `lexCodeLine(text)` is the default lexer on one line, for a highlighter that wants to start from it.

If a frame has already spent 6 ms highlighting, the rest of its rows show plain and catch up in the next frame, so a slow highlighter can't hold up scrolling.

### gpu-lexer

`createGpuCodeHighlight()` plugs in the library's WebGPU highlighter, which labels any language. What a frame asks for goes as one text, so a screenful costs one trip to the GPU. Without a hardware adapter it falls back to [lexSyntax](https://blamy.github.io/ui/#/syntax-highlighting)'s small lexer, or leaves the text plain if that fails. It's not the default because the answer arrives a frame later, its labels are less exact on minified code, and the default has to give the same picture on every machine.

```tsx
const gpu = createGpuCodeHighlight()

<CodeViewer lines={lines} highlight={gpu} />
```

## Narrow windows

At phone width the gutters stay readable and the code scrolls sideways behind them. `wrap` wraps instead. It breaks at the last column that fits, not between words, because knowing how many rows a line takes has to be arithmetic for a file of any size. Only a line's first row has its gutter cells. A very long line wrapped is a lot of rows, and those are windowed the same way.

{% demo src="code-viewer/wrapping" %}

## Accessibility

The viewer is a labelled region that takes focus, so arrow keys, Page Up and Down, Home and End scroll it. Pass `aria-label` with the file's name.

Gutter buttons and markers are one tab stop, however many there are, so Tab can't get lost walking half a million rows. Tab goes in and then out again, the arrow keys go down a gutter and along a line and scroll as they need to, and Enter or Space presses. A row with focus stays in the page wherever the view goes, including one whose cell opened a popover. Anything focusable a gutter's `render` returns joins in.

The code is a list of lines, each announcing its place in the whole file with `aria-setsize` and `aria-posinset`. Line numbers that aren't buttons are hidden from assistive technology, since the list already says which line it is.

## Props

### CodeViewer

| Prop | Default | Effect |
| --- | --- | --- |
| `lines` | — | The source, a line to an entry. |
| `lineCount` / `getLine` | — | The source by index, from 0. `getLine` is called for what's on screen and by a pass over the file in slices. |
| `contentKey` | — | Changes when `getLine`'s content does. Without it a new `getLine` means new content. |
| `gutters` | `[]` | `CodeViewerGutter[]`, in order. Memoize it. |
| `lineNumbers` | `true` | `true` or `end`: next to the code. `start`: first. `false`: none. |
| `onLineNumberPress` / `isLineNumberPressable` | — | Makes line numbers buttons, on the lines you say. |
| `lineNumberLabel` / `lineNumberTitle` | `Line N` / — | Their accessible name and tooltip. |
| `currentLine` / `currentColumn` | — | The line and column execution is on. |
| `revealCurrentLine` | `true` | Keep the current line in view. `{ smooth: true }` animates it. |
| `lineDecoration` | — | `(lineNumber) => { tint, className, textClassName, gutterClassName }`. |
| `markers` | — | `CodeViewerMarker[]`, or `(lineNumber) => CodeViewerMarker[]`. |
| `scrollToLine` | — | Scrolls when this changes: a line, or `{ line, column, align, smooth }`. |
| `highlight` | a small lexer | `(text, lineIndex, context) => tokens`, or `null` for none. |
| `wrap` | `false` | Wrap at the last column that fits. |
| `tabSize` | `2` | Cells between tab stops. |
| `lineHeight` | `20` | Height of a row, in px. |
| `maxLineLength` | — | The widest line in cells, if you know it. Saves a pass over the file. |
| `onCopyText` | — | `({ text, truncated })` when a selection is copied. |
| `onSelectionChange` | — | `(selection \| null)`, with lines from 1 and columns from 0. |

### CodeViewerGutter

| Field | Effect |
| --- | --- |
| `id` / `width` | Names it, and sets its width in px. |
| `render` | `(lineNumber) => ReactNode`: a cell's contents. |
| `onPress` / `isPressable` | Makes the cell a button, on the lines you say. |
| `label` / `title` | The button's accessible name, and a tooltip. |
| `align` / `className` | `start`, `center` (default) or `end`; a class on each cell. |

### CodeViewerMarker

| Field | Effect |
| --- | --- |
| `line` | The line, in the array form of `markers`. |
| `column` | UTF-16 code units from the start of the line. Past the end, it's shown at the end. |
| `label` | Its accessible name. |
| `onPress` / `isActive` | Makes it a button; filled in, and announced as pressed. |
| `title` / `className` / `children` | A tooltip, a class, and something to draw instead of the notch. |

### CodeViewerHandle

| Method | Effect |
| --- | --- |
| `scrollToLine(line, options)` | `options`: `align`, `column`, `smooth`. |
| `getSelection()` / `setSelection(selection)` | Read or set it, with `null` for none. |
| `getSelectionText()` | The selected text, from the source. |
| `selectAll()` / `focus()` | Selects everything; focuses the viewer without scrolling. |

## Styling

The viewer is `data-slot="code-viewer"`, on the `card` surface with the `font-mono` family at `text-footnote`: a class on it changes them, and the character width follows. Token colors are the same `bl-tok-*` classes as [SyntaxHighlighting](https://blamy.github.io/ui/#/syntax-highlighting), so `--bl-syntax-*` themes both. The parts are `code-viewer-line`, `code-viewer-text`, `code-viewer-gutter-row`, `code-viewer-gutter-cell`, `code-viewer-band`, `code-viewer-selection`, `code-viewer-column` and `code-viewer-marker`, and rows carry `data-line`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `codeViewerLineVariants`

Defined in `@/components/ui/code-viewer`. Base classes:

```text
pointer-events-none absolute inset-x-0 h-(--code-viewer-line)
```

**`tint`** — default `none`

| Value | Adds |
| --- | --- |
| `none` (default) | — |
| `current` | `bg-primary/15 shadow-[inset_3px_0_var(--primary)]` |
| `info` | `bg-primary/10 shadow-[inset_3px_0_color-mix(in_srgb,var(--primary)_45%,transparent)]` |
| `success` | `bg-success/15` |
| `warning` | `bg-warning/15` |
| `danger` | `bg-destructive/15` |
| `muted` | `bg-secondary` |

### `codeViewerGutterCellVariants`

Defined in `@/components/ui/code-viewer`. Base classes:

```text
box-border flex h-full shrink-0 items-center overflow-hidden
```

**`align`** — default `center`

| Value | Adds |
| --- | --- |
| `start` | `justify-start` |
| `center` (default) | `justify-center` |
| `end` | `justify-end` |
