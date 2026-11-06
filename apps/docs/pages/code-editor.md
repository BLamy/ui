# CodeEditor

Code you can edit, by default, and read-only code of any shape: a snippet on a docs page, inline code in a sentence, or a debugger's source pane on half a million lines. It's one component with one API, and it draws in one of two ways, because those jobs need opposite things from the page.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/code-editor.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { CodeEditor } from '@/components/ui/code-editor'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { CodeEditor } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

```tsx
// Editable by default
<CodeEditor defaultValue={source} language="ts" onChange={(value, change) => save(value)} />
<CodeEditor value={source} onChange={setSource} language="ts" />

// Read-only: a snippet, in the page
<CodeEditor readOnly value={source} language="ts" title="src/queue.ts" lineNumbers showCopy highlightLines={[4]} />
<CodeEditor readOnly variant="inline" value="usePoll<User>('/api/me')" language="ts" />

// Read-only: a source view, for a debugger
<CodeEditor readOnly variant="ghost" lineCount={n} getLine={(i) => decoded.line(i)} gutters={gutters} currentLine={25} currentColumn={12} markers={markers} ref={ref} />
```

{% demo src="code-editor/editable" %}

Windowed, it fills its parent when the parent has a height, and follows its content when it doesn't, scrolling past 8,192 px. `maxHeight` makes it as tall as its text, up to that. A `variant` of `default` is a card and `ghost` has no chrome, for a pane that already has edges.

## Two renderers

| | In the page | Windowed |
| --- | --- | --- |
| **What's in the DOM** | Every character | What's on screen, and a little more |
| **Height** | Follows its content | Fills a parent with a height. With none, follows its content, up to 8,192 px |
| **Selection** | The browser's | Its own, drawn on the rows, copied from the source |
| **⌘F** | Finds everything | Only sees what's rendered |
| **Server rendering** | Yes | Measures itself first, so it's empty on the server |
| **Size** | Up to the limits below | A megabyte on one line, half a million lines |
| **Labels from** | gpu-lexer | A small lexer that can resume anywhere |

You get the windowed renderer when it's editable, when a prop only it can honor is used, or when the text is too big to put in the page. Otherwise you get the page. `windowed` overrides that where it can: `windowed` on a read-only text always windows it, and `windowed={false}` keeps it in the page however big it is. It can't be `false` on an editor, or `true` on `variant="inline"`, and the types won't let you ask.

These props mean windowed, because the page can't honor them: `lines`, `lineCount` and `getLine`, `gutters`, `onLineNumberPress`, `currentLine`, `markers`, `lineDecoration`, `scrollToLine`, a function for `highlight`, `onCopyText`, `onSelectionChange` and `maxLineLength`. Everything else works in both.

A read-only text goes in the page up to **5,000 lines**, **32 KB on a line** and **256 KB** in all (`MAX_PAGE_LINES`, `MAX_PAGE_LINE_LENGTH`, `MAX_PAGE_CHARS`). Those come from timing the in-page renderer in Chromium, from first render to settled colors, on a hardware GPU:

| Text | Settled in | JS heap |
| --- | --- | --- |
| 5,000 lines | 0.3 s | 50 MB |
| 10,000 lines | 0.55 s | 121 MB |
| 100,000 lines | 5.8 s | 1.1 GB |
| 500,000 lines | The tab crashed | |
| 32 KB on a line | 0.1 s | |
| 50 KB on a line | 0.5 s | |
| 200 KB on a line | 5.9 s | |
| 1 MB on a line | Not done after two minutes | |

Past the limit, a text swaps renderers, so a block of streaming text that grows that far changes its line height and its colors when it does.

## Editing

It's a real editor. The focus is on a hidden `<textarea>`, as in CodeMirror and Monaco, so typing, paste, cut, dead keys, input methods and a phone's keyboard all come from the browser, and arrive as what they did. The caret blinks, unless the reader prefers reduced motion, and stays in view.

{% hint style="info" %}
Not included: multiple cursors, find and replace, folding, a minimap and language servers. ⌘F is the browser's, and only sees what's rendered.
{% endhint %}

| Key | On a Mac | Elsewhere |
| --- | --- | --- |
| A word left or right | ⌥← ⌥→ | Ctrl+← Ctrl+→ |
| The line's start or end | ⌘← ⌘→, Home, End | Home, End |
| The file's start or end | ⌘↑ ⌘↓ | Ctrl+Home, Ctrl+End |
| A page | PageUp, PageDown | PageUp, PageDown |
| Extend the selection | Shift with any of these | Shift with any of these |
| Delete a word | ⌥⌫ ⌥⌦ | Ctrl+Backspace, Ctrl+Delete |
| Delete to the line's start or end | ⌘⌫ ⌘⌦ | |
| Undo, redo | ⌘Z, ⇧⌘Z | Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y |
| Select all | ⌘A | Ctrl+A |

- **Home** goes to where the code starts, and from there to the very start of the line.
- **Enter** keeps the line's indent, as far as the caret.
- **Tab** indents with the file's own indent, a tab or two or four spaces, which it works out from the file. With a caret it goes to the next stop. With a selection across lines it moves all of them and leaves them selected, and so does **⇧Tab**, going the other way. In the spaces at the start of a line, **Backspace** goes back an indent at a time.
- **Esc** then **Tab** leaves the editor, either way, so the keyboard is never trapped. Esc lasts until the next key. Buttons in the gutters and markers are one stop between the editor and what's after it.
- On a Mac the readline keys work too: Ctrl+A, E, B, F, P, N, H, D and K.

Undo keeps up to 1,000 steps and 32 million characters. Typing groups into a step until the caret moves, the word ends, or you stop for most of a second, and deleting groups the same way. Everything else is a step of its own. A step over the limit is still kept, on its own, because it's the one someone is most likely to want back.

### Changes

`onChange(value, change)` is the ordinary way to hear about one. `change` says what happened, so you can often do without `value`:

| Field | Meaning |
| --- | --- |
| `from` / `to` | The range that was replaced, in the text before the change, as `{ line, column }`. |
| `newTo` | Where the new text ends, in the text after it. |
| `text` / `removed` | What went in and what came out, with `\n` for line ends. |
| `origin` | `input`, `delete`, `newline`, `indent`, `paste`, `cut`, `composition`, `undo` or `redo`. |

`value` is the whole text, joined from its lines on each change. On half a million lines that's a few milliseconds of every key. So for a document that size, use `onEdit(change)`, which gets the same `change` and never joins anything, and call `getValue()` on the ref when you actually want the text.

{% demo src="code-editor/huge-document" %}

`lineAfterEdit(line, change)` says where a line number ends up after a change, for breakpoints and anything else you keep by line. The editor can't move them itself, since they're yours.

### Controlled

`value` and `onChange` work as they do on an input.

{% demo src="code-editor/controlled" %}

- What you pass back from `onChange` is the same string, so accepting a change costs nothing: nothing is parsed and nothing is joined.
- Any other `value` is worked out as the edit it amounts to, so the caret stays where it means something, and it's a step in undo. To start a different file with a clean slate, give the editor a `key`.
- An edit you don't accept is put back, right after `onChange` returns, so update `value` from inside it, not later.

A file's own line ending, `\n` or `\r\n`, is kept in `value` and `getValue()`. A file with a mix ends up with whichever it used most, on the first edit. U+2028 and U+2029 stay in the line and show as symbols: they're legal in a string, and turning them into line ends would change the file. `splitCodeLines` splits where JS engines count lines, for a read-only source whose positions come from an engine.

## Snippets

Read-only, small, and in the page, every character real: it's highlighted by [gpu-lexer](https://gpu-lexer.vercel.app/), a tiny WebGPU model that splits source into words, whitespace and symbols and labels each piece from its local and whole-file context. It needs no grammar or language setting (75+ languages, including mixed HTML, Vue and Svelte), and one lexer on one GPU device serves every block on the page.

### File viewer

A filename header with a copy button, a line-number gutter, and a highlighted range. The gutter stays put while wide lines scroll sideways, and the numbers are drawn with CSS so copying a selection never picks them up.

{% demo src="code-editor/file-viewer" %}

### Inline code

`variant="inline"` renders a `<code>` span that flows with the sentence. It's always read-only.

{% demo src="code-editor/inline-code" %}

### Showing a change

`addedLines` and `removedLines` tint whole lines and add a `+` / `−` column. The code inside keeps its syntax colors. For a full unified diff with two gutters, lay out rows yourself with `useSyntaxTokens` (the [GitHub clone](https://blamy.github.io/ui/#/blocks) block's Files changed tab does this).

{% demo src="code-editor/diff" %}

### Copyable snippets

`showCopy` adds a labelled copy button: in the header when there is a `title`, otherwise floating at the top right (it shows on hover and keyboard focus, and always on touch screens). A polite status message announces the copy.

{% demo src="code-editor/copyable-snippets" %}

### Theming

Token colors are CSS classes (`bl-tok-keyword`, `bl-tok-string`, …) that read `--bl-syntax-*` custom properties, in both renderers. The defaults use `light-dark()`, so they follow `BLProvider`, the docs' `AppearanceProvider`, or any `color-scheme`. Override the properties on the block or on any ancestor. `appearance="light" | "dark"` forces one palette.

{% demo src="code-editor/custom-theme" %}

### Composed from parts

Pass children and `CodeEditor` becomes a root: `CodeEditorHeader`, `CodeEditorTitle` and `CodeEditorCopyButton` read its text, and `CodeEditorContent` renders the code, in whichever renderer it's using.

{% demo src="code-editor/composed-parts" %}

### Your own layout

`useSyntaxTokens(code)` returns the lines as token arrays. `SyntaxTokens` renders one line of them.

{% demo src="code-editor/tokens-hook" %}

### GPU mode and the fallback

Highlighting in the page runs on the GPU. The first block on a page loads gpu-lexer (about 28 KB), requests a WebGPU adapter, and compiles its pipelines. Every later block reuses that device and lexer.

- **No layout shift.** The block renders its plain text at once, in the final layout. The token colors swap in when the GPU answers, usually within a frame for small sources.
- **Shared and queued.** Parse calls from every instance go through one FIFO queue, and identical sources share a single call. Results are cached by source text, so remounts, repeated snippets and switching tabs show colors on the first frame.
- **Large files.** Sources over 64 KB are lexed in line-aligned pieces that stay under WebGPU's buffer limits. Files longer than 400 lines render in 200-line blocks with `content-visibility: auto`, so the browser skips layout and paint for blocks that are off screen.
- **Streaming.** While a source grows, the lines that haven't changed keep their tokens until the new result arrives.
- **Operators, not keywords.** gpu-lexer sometimes labels operators such as `=>`, `?.` and `??` (and some punctuation) as keywords. Those spans are re-cut before caching, so `=>`, `===`, `?.`, `??`, `&&`, `...`, `::` and `->` get the operator color. Brackets, commas, semicolons and a lone `.` or `:` stay plain, and words keep their label.

Before the first lex, the page asks for a WebGPU adapter once and caches the answer. The `engine` prop decides what to do with it:

| `engine` | Behavior |
| --- | --- |
| `'auto'` (default) | gpu-lexer on a hardware adapter (Metal, D3D12, Vulkan on a real GPU). If the only adapter is a software one (SwiftShader in headless CI, llvmpipe), there is no adapter, or the probe takes longer than 2.5 s, the fallback shows right away instead of waiting on a slow software GPU. |
| `'gpu'` | gpu-lexer on any adapter, software included. It is slow on software adapters, and falls back only where WebGPU is missing. Windowed, this is what asks for gpu-lexer instead of the small lexer. |
| `'fallback'` | Always the fallback, for tests or pages that must not use the GPU. |

The fallback is a small lexer that only knows comments, strings, numbers, a shared keyword list, calls, capitalized types and operators. It is a stand-in, not a second highlighter.

{% demo src="code-editor/engines" %}

Each `<pre>` (and inline `<code>`) reports what it shows in `data-highlighter`:

| Value | Meaning |
| --- | --- |
| `pending` | Plain text, waiting for the adapter probe or the GPU. |
| `gpu` | Tokens from gpu-lexer on WebGPU. |
| `fallback` | No hardware WebGPU adapter (with `engine="auto"`), no WebGPU at all, or `engine="fallback"`. |
| `none` | Not lexed: `language="text"` or `highlight={false}`. |

An explicit `engine="gpu"` or `engine="fallback"` also sets `data-engine`. The windowed renderer reports `lexer` or `custom` instead of `gpu` or `fallback`.

Tests should wait for `pending` to go away before taking a screenshot. In headless CI without a GPU, `auto` settles on the fallback within the probe, so this wait is short. The GPU visual tests run in full Chromium on macOS, whose Metal adapter is hardware, so `auto` uses gpu-lexer there. gpu-lexer's labels are the same from run to run, so the screenshots are too.

## Source views

Read-only, and windowed: a debugger's source pane. A megabyte on one line and half a million lines scroll as smoothly as twenty, because neither is ever in the page: a monospace line is a grid of cells, so what's on screen is arithmetic, and only that is rendered. Gutters take anything you put in them, and it takes a current line, tints and things to press inside a line. It knows nothing about debuggers, but that's what it's for: breakpoints, hit counts and jumping to an execution are all built on top of it below.

Give it lines and a height. `splitCodeLines` splits a source where JS engines count a new line, which isn't only at `\n`.

```tsx
<CodeEditor readOnly variant="ghost" lines={splitCodeLines(source)} aria-label="app.js" className="h-96" />
```

{% demo src="code-editor/source-view" %}

If you don't want a big file in React, give it `lineCount` and `getLine` instead. It asks for the lines on screen, and in slices in the background, makes a pass over the file for two things: the widest line, which `maxLineLength` saves it, and comments that span lines, which your own `highlight` does. Keep `getLine` stable, or pass `contentKey` to say when the content really changed. To start a different file at the top, give the editor a `key`.

```tsx
<CodeEditor readOnly lineCount={500_000} getLine={(i) => decoded.line(i)} contentKey={file.id} maxLineLength={file.widest} />
```

Lines are numbered from `startLine`, 1 by default, everywhere in the props and the ref, and from 0 only in `getLine` and `highlight`. Columns are UTF-16 code units from 0, as JS engines count them.

### Gutters

`gutters` is an ordered list. A gutter has an `id`, a `width` in px and `render(lineNumber)`, which can return anything: a dot, a count, a popover trigger. `onPress` makes the cell a button, and `isPressable` says on which lines. Gutters stay put while the code scrolls sideways. The built-in line numbers go next to the code, or first with `lineNumbers="start"`, or not at all with `lineNumbers={false}`. They're on by default in an editor and for `lines` or `getLine`, and off for a read-only text, in either renderer.

Here's a debugger's source view, composed from the outside. The [DebugToolbar](https://blamy.github.io/ui/#/debug-toolbar) moves between executed lines and breakpoints. Press a line number to jump there. Press a hit count for arrows and a box to type which execution. Press beside a line number for a breakpoint, and on a notch above the code for one at that column.

{% demo src="code-editor/debugger" %}

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

<CodeEditor
  readOnly
  variant="ghost"
  lines={lines}
  gutters={gutters}
  onLineNumberPress={jumpToLine}
  isLineNumberPressable={ranAtLeastOnce}
/>
```

{% hint style="info" %}
A stepping debugger re-renders on every step. With `gutters` memoized and the callbacks stable, a step only redraws the rows that changed.
{% endhint %}

### Line state

`currentLine` draws a band across the line, and `currentColumn` a mark inside it. When they change the editor brings them into view if they aren't already, a third of the way down, so what comes next shows too. `revealCurrentLine={false}` leaves that to you, and `{ smooth: true }` animates it. On a long line it scrolls sideways to the column as well.

`lineDecoration(lineNumber)` gives a line a `tint` (`info`, `success`, `warning`, `danger`, `muted`), or classes for its band, its text and its gutter cells, like dimming lines that never ran. It's only called for rows on screen.

`markers` puts things to press at a column inside a line, like column-level breakpoints: an array of `{ line, column, label, onPress, isActive }`, or a function from a line to its markers when there are many. A line of a bundle can have tens of thousands, and only those in the rendered part of the line are in the page. A marker sits over the grid and never moves the text. `children` replaces the default notch.

### Scrolling

`scrollToLine` works through a ref and a prop. `align` is `start`, `center` (the default), `end` or `nearest`, `column` scrolls sideways too, and `smooth` animates unless the reader prefers reduced motion. The prop acts when its value changes, so going back to the same line again is what the ref is for.

```tsx
const editor = useRef<CodeEditorHandle>(null)

editor.current?.scrollToLine(1200, { align: 'start', smooth: true })

<CodeEditor ref={editor} readOnly lines={lines} scrollToLine={{ line: 1200, column: 80 }} />
```

### Big files

{% demo src="code-editor/megabyte-line" %}

{% demo src="code-editor/half-million-lines" %}

What's in the page is the rows on screen and a few more, and on each of them a few hundred characters around the view. The element that scrolls holds an empty box the size of the file, with a viewport stuck to its corner, and scrolling moves layers inside that viewport with one transform each. A scroll frame that doesn't bring in new rows or text doesn't run React at all. A range beyond 16 million px, which browsers can't size reliably, is compressed: the scrollbar still covers the whole file, and a pixel of it is more than a pixel of code.

An edit doesn't start any of that over. A long line keeps most of its grid through an edit. The lexer starts again from the edited line, in the state that line starts in, and stops as soon as a later line starts in the state it did before, which is usually the very next line. On a long line it does the same from a checkpoint a little before the edit, and is usually back in step within a few kilobytes, however long the line is. Typing `/*` at the top of a file is the one edit that has to go all the way down, and that goes in slices, starting with what's on screen.

In Chromium, on a machine that was busy with other things, under React's development build:

| The work of a key, up to the frame it shows in | Median | 95th percentile | Slowest |
| --- | --- | --- | --- |
| Typing at the end of 500,000 lines | 6.1 ms | 9.9 ms | 10.8 ms |
| Typing in the middle of a megabyte line | 7.3 ms | 10.8 ms | 13.1 ms |

Both are with `onEdit`. `onChange` on the 500,000 lines joins the text on each key, and came to 11.9 ms, 16.3 ms and 16.4 ms. Breaking a megabyte line in two with Enter is the one key that can go over a frame, at 12.8 ms, 17.7 ms and 20.8 ms, because the two new lines are measured from scratch.

The grid has these rules:

- **Plain characters** are one cell, at the measured width of the font. The measure follows the font when it loads or changes.
- **Tabs** reach the next stop, `tabSize` cells apart (default 2), wherever on the line they start. They're drawn as spaces and copied as tabs.
- **East Asian wide characters and emoji** are two cells, held to that width in the page, since a fallback font's idea of a character's width isn't the grid's.
- **Marks, joiners, skin tones and flags** stay with the character they belong to.
- **Controls and invisible characters**, including bidi overrides and zero-width spaces, show as a dim symbol and copy as themselves.
- **Right-to-left text** keeps its place on the line and is shaped and ordered inside that place. A selection inside a run of it is by position in the source, so it won't line up letter for letter.

### Selecting and copying

Selection is the windowed renderer's own: two positions in the document, drawn on the rows, and copied from the source. The browser's can't work here, since most of what you'd select doesn't exist. So a selection can run from the first character of a file to the last, it survives scrolling away and back, and copying gets the source as it is, tabs and all, with nothing from the gutters.

Drag to select, past an edge to scroll along with it. Double click for a word, triple click for a line, and shift click to extend. In a read-only view, Shift with the arrow keys, Home or End extends from where you last clicked, ⌘A or Ctrl+A selects all, ⌘C or Ctrl+C copies and Esc clears. The context menu's Copy works too, and in an editor, Cut and Paste. On touch, a pan scrolls, and a long press selects a word and then drags.

What that costs:

- Find in page only sees what's rendered, as with any virtualized list.
- Copy stops at 64 million characters, and `onCopyText` says so with `truncated`.
- Copying a whole file blocks while the text is put together. On 500,000 lines of 32 characters, that was about half a second.

The ref has `getSelection`, `getSelectionText`, `setSelection`, `selectAll`, `focus` and `getValue`, and `onSelectionChange` follows along. In an editor, a caret is a selection with both ends at the same place. In the page, they work on the browser's selection.

### Highlighting

{% demo src="code-editor/highlighting" %}

Windowed, a small lexer labels the text at once, with the library's token colors. It's shaped for C-family and script languages, and tells a regular expression from a division, carries block comments and template literals across lines, and can start anywhere: a window in the middle of a megabyte line is labelled just as if the whole line had been. `highlight={null}` or `false` turns highlighting off, and so does a plain-text `language`.

`highlight(text, lineIndex, context)` plugs in your own. It returns labelled pieces of the text, with a `type` from the library's token colors (`plain` for none) and a `className` if you want one, or a promise of them, and the text shows plain until the answer arrives. It's never given more than a window of a long line: `context.partial` says it's a window, `context.offset` where it starts, and `context.line` has the whole line if you need it. Keep the function stable, since a new one forgets everything it answered. `lexCodeLine(text)` is the default lexer on one line, for a highlighter that wants to start from it.

If a frame has already spent 6 ms highlighting, the rest of its rows show plain and catch up in the next frame, so a slow highlighter can't hold up scrolling or typing.

`engine="gpu"`, or `createGpuCodeHighlight()` for `highlight`, labels it with gpu-lexer instead, which labels any language. What a frame asks for goes as one text, so a screenful costs one trip to the GPU. Without a hardware adapter it falls back to [lexSyntax](https://blamy.github.io/ui/#/hooks-syntax-and-sessions)'s small lexer, or leaves the text plain if that fails. It's not the default because the answer arrives a frame later, its labels are less exact on minified code, and the default has to give the same picture on every machine.

```tsx
const gpu = createGpuCodeHighlight()

<CodeEditor readOnly lines={lines} highlight={gpu} />
```

### Narrow windows

At phone width the gutters stay readable and the code scrolls sideways behind them. `wrap` wraps instead. It breaks at the last column that fits, not between words, because knowing how many rows a line takes has to be arithmetic for a file of any size. Only a line's first row has its gutter cells. A very long line wrapped is a lot of rows, and those are windowed the same way. In an editor, the up and down keys go by the rows you can see.

{% demo src="code-editor/wrapping" %}

## Accessibility

An editor is a `<textarea>` with `role="textbox"`, `aria-multiline` and `aria-readonly`, which holds the focus, and is named by `aria-label` or `title`. It holds the caret's line, or the selected text, so a screen reader has something to read as the caret moves. It keeps Tab, and Esc gives it back, so the keyboard is never trapped.

A snippet is a real `<pre><code>`. The `<pre>` is focusable, so keyboard users can scroll it, and it is named by `title` (or the language). Line numbers and diff signs are CSS-generated and hidden from assistive tech, so they are neither read aloud nor copied. The copy button is a labelled react-aria `Button` whose label changes to "Copied", with a polite status message.

A source view is a labelled region that takes focus, so arrow keys, Page Up and Down, Home and End scroll it. Pass `aria-label` with the file's name.

Gutter buttons and markers are one tab stop, however many there are, so Tab can't get lost walking half a million rows. Tab goes in and then out again, the arrow keys go down a gutter and along a line and scroll as they need to, and Enter or Space presses. A row with focus stays in the page wherever the view goes, including one whose cell opened a popover. Anything focusable a gutter's `render` returns joins in.

The code is a list of lines, each announcing its place in the whole file with `aria-setsize` and `aria-posinset`. Line numbers that aren't buttons are hidden from assistive technology, since the list already says which line it is.

## Props

### CodeEditor

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `onChange` | — | The text, controlled. `onChange(value, change)`. Read-only, just `value`. |
| `defaultValue` | `''` | The text, uncontrolled. |
| `onEdit` | — | `(change)`: every change, without joining the text. For huge documents. |
| `readOnly` | `false` | Turns editing off. `variant="inline"` is always read-only. |
| `lines` | — | With `readOnly`: the source, a line to an entry. |
| `lineCount` / `getLine` | — | With `readOnly`: the source by index, from 0. `getLine` is called for what's on screen and by a pass over the file in slices. |
| `contentKey` | — | Changes when `getLine`'s content does. Without it a new `getLine` means new content. |
| `windowed` | automatic | Which renderer, where you have a choice. See [Two renderers](#two-renderers). |
| `language` | — | `ts`, `tsx`, `json`, `bash`, … Shown as `data-language`. `text` / `plaintext` turns highlighting off. gpu-lexer works out the language itself. |
| `variant` | `'default'` | `default`: a bordered card. `ghost`: no chrome. `inline`: a `<code>` span. |
| `title` | — | Header title, usually a filename. It also names the code for screen readers. |
| `showCopy` | `false` | A copy button in the header, or floating when there is no title. |
| `lineNumbers` | depends | A line-number gutter. On in an editor and for `lines` or `getLine`, off for a read-only text. Windowed, `start` puts it first and `end` next to the code. |
| `startLine` | `1` | Number of the first line. Line numbers everywhere use the displayed numbers. |
| `highlightLines` | — | Lines to highlight: `[3, [7, 9], '12-14']`. |
| `addedLines` / `removedLines` | — | Lines tinted green with a `+`, or red with a `−`. |
| `wrap` | `false` | Soft-wrap instead of scrolling sideways. |
| `maxHeight` | — | Scroll past this height. |
| `lineProps` | — | `(line) => HTMLAttributes`: extra attributes per line, such as `id` anchors or click handlers. Windowed, for lines on screen. |
| `highlight` | `true` | `false` or `null` for plain text. A function labels the text itself, and means windowed. |
| `engine` | `'auto'` | `auto` uses the GPU only on a hardware adapter. `gpu` uses it on software adapters too. `fallback` never uses it. |
| `tabSize` | `2` | Cells between tab stops. |
| `lineHeight` | `20` windowed | Height of a line, in px. In the page it's 1.6 times the font unless you say. |
| `appearance` | ambient | Force the token palette. It defaults to the `AppearanceProvider` value, and otherwise follows the color scheme. |
| `contentClassName` | — | Class for the inner `<pre>` or windowed view. |
| `gutters` | `[]` | `CodeEditorGutter[]`, in order. Memoize it. |
| `onLineNumberPress` / `isLineNumberPressable` | — | Makes line numbers buttons, on the lines you say. |
| `lineNumberLabel` / `lineNumberTitle` | `Line N` / — | Their accessible name and tooltip. |
| `currentLine` / `currentColumn` | — | The line and column execution is on. |
| `revealCurrentLine` | `true` | Keep the current line in view. `{ smooth: true }` animates it. |
| `lineDecoration` | — | `(lineNumber) => { tint, className, textClassName, gutterClassName }`. |
| `markers` | — | `CodeEditorMarker[]`, or `(lineNumber) => CodeEditorMarker[]`. |
| `scrollToLine` | — | Scrolls when this changes: a line, or `{ line, column, align, smooth }`. |
| `maxLineLength` | — | The widest line in cells, if you know it. Saves a pass over the file. |
| `onCopyText` | — | `({ text, truncated })` when a selection is copied. |
| `onSelectionChange` | — | `(selection \| null)`, with lines from `startLine` and columns from 0. |

`className`, `style` and other `div` props go on the root. `CodeEditorContent` takes `lineNumbers` … `lineHeight` plus a `value` and `language` of its own, for the page. `CodeEditorCopyButton` takes `value`, `label` (default `"Copy code"`) and `onCopy`, and it can be used outside an editor (the GitHub clone's *Copy raw file* button is one). `codeEditorVariants` is the cva recipe.

### CodeEditorGutter

| Field | Effect |
| --- | --- |
| `id` / `width` | Names it, and sets its width in px. |
| `render` | `(lineNumber) => ReactNode`: a cell's contents. |
| `onPress` / `isPressable` | Makes the cell a button, on the lines you say. |
| `label` / `title` | The button's accessible name, and a tooltip. |
| `align` / `className` | `start`, `center` (default) or `end`; a class on each cell. |

### CodeEditorMarker

| Field | Effect |
| --- | --- |
| `line` | The line, in the array form of `markers`. |
| `column` | UTF-16 code units from the start of the line. Past the end, it's shown at the end. |
| `label` | Its accessible name. |
| `onPress` / `isActive` | Makes it a button; filled in, and announced as pressed. |
| `title` / `className` / `children` | A tooltip, a class, and something to draw instead of the notch. |

### CodeEditorHandle

| Method | Effect |
| --- | --- |
| `scrollToLine(line, options)` | `options`: `align`, `column`, `smooth`. |
| `getSelection()` / `setSelection(selection)` | Read or set it, with `null` for none. |
| `getSelectionText()` | The selected text, from the source. |
| `selectAll()` / `focus()` | Selects everything; focuses it without scrolling. |
| `getValue()` | The whole text. |

### Hooks and helpers

| Export | Description |
| --- | --- |
| `useCodeEditor()` | The enclosing editor's `getValue`, `language`, `variant`, `title` and `engine`, for custom parts inside it. |
| `useSyntaxTokens(code, { language?, enabled?, engine? })` | `{ lines: CodeToken[][], highlighter }`. It returns plain lines at first, then tokens. |
| `SyntaxTokens` | Renders one line's tokens as `bl-tok-*` spans. |
| `lexSyntax(code, engine?)` | `Promise<{ spans, highlighter }>` through the shared queue and cache. |
| `webgpuSupported(engine?)` | `false` once WebGPU is known to be missing, and for `auto` (the default) once the probe has found only a software adapter. |
| `probeWebGPU()` | `Promise<'hardware' \| 'software' \| 'none'>`, the cached one-time adapter probe. |
| `languageFromPath(path)` | `'src/queue.ts'` → `'ts'`, for `language` and labels. |
| `tokenizeLines(code, spans)` | Cuts gpu-lexer spans into per-line tokens. |
| `splitCodeLines(source)` | A source's lines, where JS engines count them. |
| `splitEditorLines(text)` | A text's lines, as an editor counts them. |
| `lineAfterEdit(line, change)` | Where a line number ends up after a change. |
| `lexCodeLine(text)` | The default lexer on one line. |
| `createGpuCodeHighlight({ engine })` | A `highlight` that labels with gpu-lexer. |
| `tooBigForPage(text)` | Whether a read-only text would be windowed. |

## Theming

| Property | Colors |
| --- | --- |
| `--bl-syntax-keyword`, `-type`, `-function`, `-string`, `-number`, `-constant`, `-operator`, `-comment` | Token colors, in both renderers. `--bl-syntax-comment-style` sets the comment font style (default `italic`). |
| `--bl-syntax-fg` | Plain text (default `--foreground`). |
| `--bl-syntax-surface` | Block background and the sticky gutter (default `--card`; transparent for `ghost`). |
| `--bl-syntax-border`, `--bl-syntax-radius`, `--bl-syntax-header-bg` | Card chrome. |
| `--bl-syntax-line-number` | Gutter numbers, in the page (default `--tertiary-foreground`). |
| `--bl-syntax-highlight`, `--bl-syntax-highlight-bar` | Highlighted lines (default: a tint wash and a tint bar). |
| `--bl-syntax-added`, `--bl-syntax-removed` (and `-gutter`) | Diff line backgrounds. |
| `--bl-syntax-font`, `--bl-syntax-font-size` | Type, in both renderers (defaults: `--font-mono`, 13px). |
| `--bl-syntax-line-height`, `--bl-syntax-padding-y`, `--bl-syntax-tab-size` | Spacing, in the page (defaults: 1.6, 12px, 2). Windowed, `lineHeight` and `tabSize` are props. |
| `--bl-syntax-caret` | The caret (default `--foreground`). |
| `--bl-syntax-inline-bg`, `--bl-syntax-inline-font-size` | The inline variant. |

A class on `CodeEditor` changes the font and its size, and the character width follows. Windowed, the parts are `code-editor-line`, `code-editor-text`, `code-editor-gutter-row`, `code-editor-gutter-cell`, `code-editor-band`, `code-editor-selection`, `code-editor-caret`, `code-editor-input`, `code-editor-column` and `code-editor-marker`, and rows carry `data-line`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `codeEditorLineVariants`

Defined in `@/components/ui/code-editor-window`. Base classes:

```text
pointer-events-none absolute inset-x-0 h-(--code-editor-line)
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

### `codeEditorGutterCellVariants`

Defined in `@/components/ui/code-editor-window`. Base classes:

```text
box-border flex h-full shrink-0 items-center overflow-hidden
```

**`align`** — default `center`

| Value | Adds |
| --- | --- |
| `start` | `justify-start` |
| `center` (default) | `justify-center` |
| `end` | `justify-end` |

### `codeEditorVariants`

Defined in `@/components/ui/code-editor`. Base classes:

```text
bl-syntax
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bl-syntax-card` |
| `ghost` | `bl-syntax-ghost` |
| `inline` | `bl-syntax-inline` |
