---
description: Every block and inline the editor edits, the Markdown shortcuts and keys that make them, the toolbar, and how Markdown it has no control for survives.
---

# The editing surface

`GitbookEditor` edits the same document docstream renders: GitHub-flavored Markdown plus GitBook's `{% tag %}` blocks. Every node in the editor maps to a node in docstream's AST, so what you type is what gets saved, and what gets saved is what readers see.

Every demo on these pages is a real `GitbookEditor` beside the Markdown it serializes. Both sides are editable. Type in the editor and the Markdown follows on every keystroke. Type in the Markdown and the editor reloads it. The badge tells you whether the current Markdown survives a load-and-save through the editor unchanged.

{% demo src="editing-surface/editor" variants="blocks:Blocks,inline:Inline,preserved:Preserved" %}

## What you can edit

<table data-view="cards"><thead><tr><th></th><th></th></tr></thead><tbody>
<tr><td><strong>Text</strong></td><td>Headings 1–6, paragraphs, blockquotes, dividers. Bold, italic, strike, inline code and links, in any combination.</td></tr>
<tr><td><strong>Lists</strong></td><td>Bullet, numbered and task lists, nested to any depth. Task boxes have <a href="06-properties-and-tasks.md">eight states</a>.</td></tr>
<tr><td><strong>Code</strong></td><td>Fences with a language, title, line numbers and live flag. Install command boxes, math, Mermaid. See <a href="04-code-math-and-diagrams.md">Code, math and diagrams</a>.</td></tr>
<tr><td><strong>Layout</strong></td><td>Tables and card tables, hints, tabs, steppers, columns, expandables, page links, embeds, changelogs. See <a href="05-tables-and-layout.md">Tables and layout</a>.</td></tr>
<tr><td><strong>References</strong></td><td><code>@mention</code>, <code>#tag</code> and <code>$codebase</code> chips, and <code>[^n]</code> citations. See <a href="03-references-and-citations.md">References and citations</a>.</td></tr>
<tr><td><strong>Files and demos</strong></td><td>Figures and inline images, attachment chips, <code>{% demo %}</code> blocks and source references. See <a href="../03-files-and-demos/01-images-and-attachments.md">Files and demos</a>.</td></tr>
</tbody></table>

Each GitBook block is a TipTap node with a React node view, built from the same parts docstream uses to render it. A math block draws docstream's KaTeX card, a Mermaid fence draws its Pele diagram, and a command box is docstream's own command box. The editor's stylesheet mirrors docstream's, so the editor looks like the published page.

| Markdown | Editor node | Edited with |
| --- | --- | --- |
| `#` … `######` headings | `heading` | Text; Markdown shortcuts |
| Paragraphs | `paragraph` | Text |
| `-` / `*` / `+` / `1.` lists | `bulletList`, `orderedList`, `listItem` | Text; Tab / Shift+Tab to nest |
| `- [ ]` task lists | `taskList`, `taskItem` (`GbTaskItem`) | Click the box; right-click for states |
| `>` blockquotes, GitHub alerts | `blockquote` | Text |
| `---` | `horizontalRule` | — |
| Fences, `{% code %}` | `codeBlock` (`GbCodeBlock`) | Title, language, `#` and Live fields |
| GFM tables, `<table data-view="cards">` | `table` (`GbTable`) | Cells; Tab / Shift+Tab |
| `{% hint %}` | `gbHint` | Style picker; body |
| `{% tabs %}` / `{% tab %}` | `gbTabs`, `gbTab` | Rename, add, remove, section title |
| `{% stepper %}` / `{% step %}` | `gbStepper`, `gbStep` | Step title field; body |
| `{% columns %}` / `{% column %}` | `gbColumns`, `gbColumn` | Body of each column |
| `<details><summary>` | `gbExpandable` | Summary field; body |
| `{% content-ref %}` | `gbContentRef` | Label and URL fields |
| `{% embed %}` | `gbEmbed` | URL field |
| `{% command %}` | `gbCommand` | npm command; pnpm / yarn / bun overrides |
| `$$` … `$$` | `gbMath` | TeX field, KaTeX preview |
| `{% updates %}` / `{% update %}` | `gbUpdates`, `gbUpdate` | Date picker; body |
| `{% openapi-operation %}` | `gbOpenapi` | Spec, method, path, spec URL |
| Images, `<figure>` | `gbFigure`, `gbInlineImage` | Image URL and caption |
| `{% demo %}` | `gbDemo` | See [Demo blocks](../03-files-and-demos/04-demo-blocks.md) |
| `{% source-ref %}` | `gbSourceRef` | See [Source files](../03-files-and-demos/03-source-files.md) |
| `[label]: url` definitions | `gbDefinition` | Label, URL and title fields |
| An unknown `{% tag %}` line | `gbRaw` | The line itself, as text |

## Markdown shortcuts

Type Markdown and the editor turns it into the block or mark as you go. At the start of an empty line:

| Type | You get |
| --- | --- |
| `#` to `######`, then a space | Heading 1–6 |
| `-`, `*` or `+`, then a space | Bullet list |
| `1.`, then a space | Numbered list, starting at that number |
| `[ ]`, then a space (or `- [ ] `) | Task list |
| `[x]` `[~]` `[?]` `[b]` `[d]` `[!]` `[-]`, then a space | A task in that [state](06-properties-and-tasks.md#task-states) |
| `>`, then a space | Blockquote |
| `---` | Divider |
| ```` ``` ```` or `~~~`, an optional language, then a space or Enter | Code block (```` ```ts ```` sets the language) |

Anywhere in a line, closing an inline span applies its mark:

| Type | You get |
| --- | --- |
| `**bold**` or `__bold__` | **bold** |
| `*italic*` or `_italic_` | _italic_ |
| `~~strike~~` | ~~strike~~ |
| `` `code` `` | `code` |

Pasting a URL over selected text links it, and a URL you type becomes a link when you finish it with a space. Everything else is a [slash command](02-slash-menu.md) away: type `/`.

{% hint style="info" %}
Marks you add in the editor get docstream's default spelling: `**bold**`, `_italic_`, `~~strike~~`. Spellings already in the Markdown, like `*italic*` or `__bold__`, are kept until you change that text.
{% endhint %}

## Keyboard shortcuts

`Mod` is ⌘ on macOS and Ctrl elsewhere.

| Keys | Action |
| --- | --- |
| `Mod`+`B` | Bold |
| `Mod`+`I` | Italic |
| `Mod`+`Shift`+`S` | Strike |
| `Mod`+`E` | Inline code |
| `Mod`+`Alt`+`1` … `6` | Heading 1–6 (toggle) |
| `Mod`+`Alt`+`0` | Paragraph |
| `Mod`+`Shift`+`7` | Numbered list |
| `Mod`+`Shift`+`8` | Bullet list |
| `Mod`+`Shift`+`9` | Task list |
| `Mod`+`Shift`+`B` | Blockquote |
| `Mod`+`Alt`+`C` | Code block |
| `Tab` / `Shift`+`Tab` | Nest / un-nest a list item; next / previous table cell |
| `Enter` three times, or `↓` at the end | Leave a code block |
| `Mod`+`Z` / `Mod`+`Shift`+`Z` (or `Mod`+`Y`) | Undo / redo (off with `disableHistory`) |
| `/` | [Slash menu](02-slash-menu.md) |
| `@` `#` `$` | [Reference pickers](03-references-and-citations.md) |

Hosts can take keys first: `onKeyDown` sees every key before the editor's keymaps and returns `true` to swallow it.

```tsx title="Editor.tsx"
<GitbookEditor
  markdown={md}
  onChange={setMd}
  onKeyDown={(event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "s") {
      save(md)
      return true
    }
    return false
  }}
/>
```

`Shift`+`Enter` (or `Mod`+`Enter`) inserts a line break inside a paragraph. It saves as a trailing backslash (`line one\` then `line two`), and a backslash break in the Markdown opens as a real line break. A two-space break (`line one␣␣`) is kept as written. Markdown has no underline, so `Mod`+`U` is turned off rather than making formatting that couldn't be saved.

## The toolbar

The built-in toolbar sits above the document: **Bold**, **Italic**, **Strike**, **Inline code** and **Link**, plus a reminder that `/` opens the block menu. The link button asks for a URL. Leave it empty to remove the link under the selection.

Turn it off with `toolbar={false}` and put your own controls next to the editor. `onEditorReady` hands you the TipTap editor, so a button can run any command:

```tsx title="MyToolbar.tsx"
import { useState } from "react"
import { GitbookEditor } from "@brett_lamy/docstream-editor"
import type { Editor } from "@tiptap/react"

export function MyEditor() {
  const [md, setMd] = useState("# Hello")
  const [editor, setEditor] = useState<Editor | null>(null)
  return (
    <>
      <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
      <button onClick={() => editor?.chain().focus().toggleBlockquote().run()}>Quote</button>
      <GitbookEditor markdown={md} onChange={setMd} toolbar={false} onEditorReady={setEditor} />
    </>
  )
}
```

## Editable, read-only and bare

`editable={false}` turns the editor into a viewer that still looks like the editor. Text can't be typed, block controls (style pickers, title fields, `+` buttons) disappear, and task boxes stop responding. `toolbar`, `slashMenu`, `references` and `placeholder` strip the editor down to a plain Markdown text box.

{% demo src="editing-surface/editor" variants="editable:Editable,readonly:Read-only,bare:Bare" %}

| Prop | Default | Effect |
| --- | --- | --- |
| `editable` | `true` | `false`: read-only. The document still follows `markdown`. Read at mount. |
| `toolbar` | `true` | The formatting toolbar. |
| `slashMenu` | `true` | The `/` menu: `false`, or `{ items }` for your own ([Slash menu](02-slash-menu.md)). |
| `references` | `true` | The `@` / `#` (and `$`) pickers ([References](03-references-and-citations.md)). |
| `documentProperties` | `true` | The frontmatter sheet ([Properties](06-properties-and-tasks.md)). |
| `placeholder` | `"Write, or type / to insert a block…"` | Shown in an empty document. |
| `autofocus` | `false` | Focus the editor on mount. |
| `className` | — | Added to the `gb` wrapper. |

The full list is in [Props](../04-reference/01-props.md).

{% hint style="info" %}
Most props are read once, when the editor is created: TipTap builds its extensions then. Changing `slashMenu`, `references`, `placeholder` or `extensions` later has no effect — remount the editor (give it a new `key`) to apply them. `editable` follows the prop at any time, and `markdown` and the file and demo props are live. The demo above remounts on every variant switch.
{% endhint %}

## Markdown the editor has no control for

The editor never drops what it can't show. docstream records how a page was written: blank lines, list markers, fence styles, tag lines, link forms, escapes. The editor carries all of that on each node and hands it back on save. So a page you only open and close comes back byte for byte, and an edit changes only the lines you touched. Open **Preserved** in the first demo above to try it.

- **An unknown `{% tag %}`** becomes a raw line (`gbRaw`), shown as an editable text field and written back verbatim. A typo in a tag name is visible here, while docstream's renderer silently skips it.
- **Raw HTML, GitHub alerts and other dialects** (`<kbd>`, `==mark==`, `H~2~O`) are text to the editor and are saved as written.
- **Reference-style links** (`[text][label]`) keep their form, and their `[label]: url` definitions become small editable blocks (`gbDefinition`) where the Markdown put them.
- **Spellings**: `*` vs `_`, `**` vs `__`, `***both***`, `\_escapes\_`, `<autolinks>`, code spans with extra backticks, odd spacing and blank lines are all kept. Text you retype gets the default spelling.
- **Footnote definitions** (`[^1]: url "Label"`) are kept with the document and re-appended on save. See [Citations](03-references-and-citations.md#citations).

{% hint style="success" %}
The [Conversion](../04-reference/02-conversion.md) page explains how the round trip works (`astToTiptap`, `tiptapToAst`, `serializeEditorMarkdown`) and how to run it yourself.
{% endhint %}

## Pasting Markdown

Paste plain-text Markdown, such as a docs page's **Copy page** output, a `{% hint %}` block, a fence or a list, and it arrives as blocks rather than literal text. Pasting ordinary prose stays a normal text paste, and rich HTML from another web page keeps ProseMirror's own handling. Turn it off with `markdownPaste={false}`. Copying and pasting demos with their files is covered in [Demo blocks](../03-files-and-demos/04-demo-blocks.md).

## Next

{% content-ref url="02-slash-menu.md" %}
[Slash menu](02-slash-menu.md)
{% endcontent-ref %}
