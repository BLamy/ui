# MarkdownEditor

A Markdown field on the `@brett_lamy/ui/docstream-editor` WYSIWYG editor. It reads and writes the same GitBook-flavored Markdown that [MarkdownView](https://blamy.github.io/ui/#/markdown-view) renders, so what you type is what readers get. Type `/` for blocks, paste Markdown to get structure, and paste or drop images as inline image blocks or as attachment chips.

Use a sibling when the job differs: [MarkdownView](https://blamy.github.io/ui/#/markdown-view) shows Markdown nobody edits (a reply, release notes), [Textarea](https://blamy.github.io/ui/#/textarea) takes plain text with no formatting, and [CodeEditor](https://blamy.github.io/ui/#/code-editor) edits source code.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/markdown-editor.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for Docstream, which it imports by the package's name. The copied source is yours to edit. Import from your alias:

```tsx
import { MarkdownEditor } from '@/components/ui/markdown-editor'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheets once at your app's entry (the kit's, then docstream's, which this part renders with), then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'
import '@brett_lamy/ui/docstream/styles.css'

import { MarkdownEditor } from '@brett_lamy/ui/markdown-editor'
```
{% endtab %}
{% endtabs %}

```tsx
import { MarkdownEditor } from '@brett_lamy/ui/markdown-editor'

const [markdown, setMarkdown] = useState('# Notes')

<MarkdownEditor
  value={markdown}
  onValueChange={setMarkdown}
  placeholder="Type / for blocks"
/>
```

## Live examples

### Kitchen sink

Edit the complete Docstream sample beside its live `MarkdownView` preview. It includes inline formatting and reference chips, every heading level, nested and task lists, code, hints, tabs, commands, expandables, steppers, columns, tables and cards, figures, math, Mermaid, embeds, content links, updates, OpenAPI, source references, and live demos. Type `/` for blocks or `@`, `#`, and `$` for reference pickers.

The **Markdown**, **Rich editor**, and **Preview** tabs inside the example switch modes. Markdown starts with the source beside its rendered preview; Rich editor opens the block editor beside the preview. **Reset example** restores the sample. Source-reference metadata and the API operation remain editable in the field; the preview resolves their content. The video requires a network connection, and the optional sandboxed React and VizEngine integrations include setup syntax.

{% demo src="docstream/kitchen-sink" %}

### Notes with a live preview

A controlled editor beside a `MarkdownView` of the same value. Every edit serializes to Markdown, so the preview updates as you type.

{% demo src="markdown-editor/notes-with-preview" %}

### Comment box with pasted screenshots

`imagePaste="chip"` turns pasted or dropped images into compact chips. You store the files: `onAttachmentAdd` hands you each image as a data URL, `onAttachmentRemove` reports chips the user deleted, and `attachments` feeds the chips their thumbnails. Chips serialize as `![name](attachment:id)`. ⌘/Ctrl+Enter calls `onSubmit`.

{% demo src="markdown-editor/comment-box" %}

### A toolbar of your own

`toolbar` (`true`) shows the built-in row: bold, italic, strike, code and link. Pass a node instead to choose the tools: a kit [Toolbar](https://blamy.github.io/ui/#/toolbar) of `MarkdownEditorToolbarButton`s, each running a TipTap `command` on the editor. With a `mark` (and its `attributes`) a button is a toggle, pressed while the selection is in that mark or block. It takes ToolbarButton's props (default size `icon-sm`).

```tsx
<MarkdownEditor
  aria-label="Release notes"
  toolbar={
    <Toolbar aria-label="Formatting" size="sm">
      <MarkdownEditorToolbarButton command="toggleBold" mark="bold" aria-label="Bold"><strong>B</strong></MarkdownEditorToolbarButton>
      <MarkdownEditorToolbarButton command="toggleItalic" mark="italic" aria-label="Italic"><em>I</em></MarkdownEditorToolbarButton>
      <ToolbarSeparator />
      <MarkdownEditorToolbarButton command="toggleTaskList" mark="taskList" aria-label="Checklist"><Icon name="checklist" /></MarkdownEditorToolbarButton>
    </Toolbar>
  }
/>
```

### Read-only and rendered

`readOnly` keeps the field and its content selectable, but it can't be edited and the toolbar is hidden. For display only, render the same Markdown with `MarkdownView`.

{% demo src="markdown-editor/read-only-toggle" %}

### In a form

Put it in a `Field`, like any other control: `FieldLabel` names it, `FieldDescription` and `FieldError` describe it, and the field's `name`, `disabled` and `invalid` apply (the red ring and `aria-invalid` come only from the Field). `name` submits the Markdown with the form through a hidden input. Outside a Field, `aria-label`, `aria-labelledby` and `aria-describedby` go on the editable element.

```tsx
<Field name="notes">
  <FieldLabel variant="default">Notes</FieldLabel>
  <MarkdownEditor />
  <FieldDescription>Markdown is fine.</FieldDescription>
</Field>
```

{% demo src="markdown-editor/issue-form" %}

### Slash commands and blocks

Type `/` for headings, lists, tasks, quotes, code, hints, tabs, expandables, steppers, tables and more. The ref exposes the editor: `insertMarkdown`, `setMarkdown`, `getMarkdown`, `clear`, `focus`, and the full TipTap `commands` and `chain()`.

{% demo src="markdown-editor/slash-blocks" %}

## Live XState and tscircuit previews

Fences labelled `xstate` or `tscircuit` use the same source-and-preview cards as Mermaid. Edit the source directly in the rich editor: the result redraws after a short pause, and syntax errors stay inside the preview so you can keep typing. Type `/` and choose **XState diagram** or **tscircuit example** to insert a starting point. The circuit preview uses a hosted runtime and needs a network connection.

{% demo src="docstream/diagrams" %}

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` | — | Markdown (controlled). |
| `defaultValue` | `string` | `''` | Initial Markdown (uncontrolled). |
| `onValueChange` | `(markdown, details) => void` | — | Called with serialized Markdown on every edit. `details.reason` is `input-change` (typing, paste, a toolbar or "/" command) or `imperative` (the ref's `setMarkdown`, `insertMarkdown`, `clear`), with `event` and `source`; `details.cancel()` puts the document back. |
| `onSubmit` | `(markdown) => void` | — | ⌘/Ctrl+Enter. |
| `placeholder` | `string` | — | Shown while the document is empty. |
| `variant` | `'default' \| 'plain' \| 'card'` | `'default'` | The kit's filled field box (Input's and Textarea's), no chrome, or a card with a hairline. |
| `size` | `'sm' \| 'default' \| 'lg'` | `'default'` | Type size, padding and default minimum height. |
| `minHeight` / `maxHeight` | `number \| string` | size-based / none | Writing-area bounds; content scrolls past `maxHeight`. |
| `toolbar` | `boolean \| ReactNode` | `false` | `true`: the kit's `Toolbar` of `MarkdownEditorToolbarButton`s (bold, italic, strikethrough, inline code, link) with a "Type / for blocks" tip where there's room. A node: your own toolbar in the same place, made of the same parts. Hidden while read-only or disabled. |
| `slashMenu` | `boolean \| { items }` | `true` | The `/` block menu, or a custom item list. |
| `references` | `boolean \| ReferenceSources` | `false` | `@` / `#` / `$` pickers that insert reference chips. |
| `demo` | `MarkdownEditorDemo` | — | Live demo blocks (`{% demo %}`), the same option as MarkdownView's: `resolver` (to components, source files and metadata), `runtime` (runs demos that carry their files inline, e.g. `createAlmostNodeDemoRuntime()`), `vfs` (demo files held in memory, `createDemoVFS()`), `dependencies` (extra npm packages inline demos may import). |
| `documentProperties` | `boolean \| { defaultOpen? }` | `true` | Show the frontmatter as an editable property sheet above the document. |
| `resolveAsset` | `(url) => string \| Promise<string>` | — | Turns an asset URL as written (`./models/part.stl`) into a loadable one, e.g. a `blob:` URL of a file next to the document. |
| `pickFile` | `({ kind, current }) => Promise<string \| null \| undefined>` | — | Adds "Choose file…" to embed blocks (and "Choose image…" to images); resolve with the URL to write. |
| `onDropEmbeds` | `(data: DataTransfer) => string[] \| Promise<string[]> \| null` | — | Claim a drop: return the URLs to embed at the drop point, or `null` for the default handling. |
| `pasteMarkdown` | `boolean` | `true` | Parse pasted plain text that looks like Markdown into structure. |
| `imagePaste` | `'inline' \| 'chip'` | `'inline'` | Pasted or dropped images become image blocks or attachment chips. |
| `attachments` | `MarkdownEditorAttachment[]` | — | Chip mode: the host's store (`{ id, name, src?, size?, type? }`). |
| `onAttachmentAdd` | `(attachment & { file }) => void` | — | Chip mode: once per pasted or dropped image. |
| `onAttachmentRemove` | `(ids) => void` | — | Chip mode: chips deleted, cut or cleared. |
| `onAttachmentOpen` | `(attachment) => void` | built-in viewer | Chip mode: a chip was clicked. |
| `readOnly` | `boolean` | `false` | Not editable; selectable, field chrome kept. |
| `disabled` | `boolean` | `false` | Not editable and dimmed. A `Field`'s `disabled` applies too. |
| `autoFocus` | `boolean` | `false` | Focus on mount. |
| `name` | `string` | — | Submit the Markdown with a form. |
| `handleKeyDown` / `handlePaste` | `(event) => boolean` | — | ProseMirror's hooks: run before the editor's own handling; return `true` when you handled it. |
| `onEditorFocus` / `onEditorBlur` | `(event: FocusEvent) => void` | — | The writing area took or lost focus (the DOM event). React's `onFocus` / `onBlur` go on the root and also fire for the toolbar. |
| `onEditorReady` | `(editor \| null) => void` | — | The TipTap editor once mounted. |
| `classNames` | `MarkdownEditorClassNames` | — | Classes for parts of the document: `title`, `heading`, `paragraph`, `list`, `checklist`, `checklistItem`, `checkbox`, `table`, `tableHeader`, `tableCell`, `blockquote`, `codeBlock`, `link`, `toolbar`, `editor`, `content`. |
| `ref` | `MarkdownEditorHandle` | — | `editor`, `commands`, `chain()`, `focus()`, `blur()`, `getMarkdown()`, `setMarkdown()`, `insertMarkdown()`, `clear()`, `isEmpty()`. |

`id`, `aria-label`, `aria-labelledby` and `aria-describedby` go on the writing area; every other `div` prop (`className`, `style`, `data-*`, …) goes on the root. `markdownEditorVariants` is the cva recipe; `looksLikeMarkdown` and `insertMarkdown(editor, markdown)` are the paste helpers, exported for editors of your own.

## Accessibility

- The writing area (the `contenteditable`) is the field's control, named by the `Field`'s label, or by `aria-label` / `aria-labelledby`, and described by its `FieldDescription` and `FieldError`. `aria-invalid`, `aria-readonly` and `aria-disabled` follow the Field and the props.
- Tab and Shift+Tab move focus out of the editor, so it is never a keyboard trap; in a list item they indent and outdent it, and move focus on once the item can't move further. ⌘/Ctrl+Enter submits.
- The "/" menu is UI SDK's trigger menu, a listbox at the caret: ↑ ↓ move, Enter picks, Escape closes it. Its groups have labels, and a search with no match says "No matching blocks".
- The toolbar is the kit's `Toolbar` named "Formatting": one Tab stop, arrow keys between buttons, each button named ("Bold", "Inline code", "Link") and a toggle (`aria-pressed`) while the selection is in that mark. The link button opens a popover with a named URL field.
- A checklist row's checkbox is a `button` with `role="checkbox"`, named after its item ("Snap detents: Verified" style names come from the item's text and state).
- Read-only stays focusable and selectable (and in the tab order), so its text can be read and copied; disabled leaves the tab order.

## Theming

The editor follows the surrounding `--bl-*` tokens, so it matches light and dark wherever `BLProvider` or the docs' `AppearanceProvider` put it. It maps them onto the shadcn names the Docstream stylesheet reads (`--card`, `--muted`, `--border`, `--accent`, `--primary`…), the same way `MarkdownView` does. The slash menu, the link popover and the chip hover card render in place in the browser's top layer, so they inherit the editor's tokens; inside a `BLProvider` they stay within its frame (its layer host).

The wrapper has `data-slot="markdown-editor"` and `data-variant`, plus `data-readonly`, `data-disabled` and `data-invalid` for state styling. The editor inside keeps Docstream's `gb` and `gb-content` classes for overrides; the toolbar is `data-slot="markdown-editor-toolbar"`.

## Styling the document

The Docstream editor's stylesheet ships inside `@brett_lamy/ui/styles.css` in a cascade layer (`components.bl-editor`), with the kit's own editor rules in the layer above it (`components.bl-mde`) — both under Tailwind's `utilities`. So ordinary classes restyle the editor without `!important`. With the registry, the item adds the same `@import` to your CSS, in the same layer. Docstream's own sheet (`@brett_lamy/ui/docstream/styles.css`, imported beside the kit's) styles the read-only blocks the editor shows inside a document: demos, command boxes, diagrams, task icons. The component imports no CSS itself, so it loads in plain Node.

`classNames` puts classes on parts of the live document and keeps them there as you type: the first block (`title`), headings, checklists and their checkboxes, tables and their cells, quotes, code blocks, links, the toolbar. The Notes block dresses its editor this way — a big bold title line, round checklist circles that fill with the tint, hairline tables:

```tsx
<MarkdownEditor
  variant="plain"
  classNames={{
    title: 'text-[28px] leading-[1.2] font-bold tracking-[-.4px] mb-2',
    checklist: 'pl-0',
    checklistItem: 'gap-2.5 items-start',
    checkbox: 'appearance-none m-0 size-[21px] rounded-full shadow-[inset_0_0_0_1.6px_var(--tertiary-foreground)] data-checked:bg-primary data-checked:shadow-none',
    tableHeader: 'bg-transparent font-semibold px-3 py-2',
    tableCell: 'px-3 py-2',
  }}
/>
```

Descendant variants on `className` work too (`[&_.ProseMirror_h2]:text-[21px]`). Don't import `@brett_lamy/ui/docstream-editor/styles.css` yourself: an unlayered copy outranks every layer, and you'd be back to `!important`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `markdownEditorVariants`

Defined in `@/components/ui/markdown-editor`. Base classes:

```text
[ 'bl-mde group/mde relative box-border flex w-full min-w-0 flex-col text-left [font-family:inherit] text-foreground', 'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy', 'data-disabled:cursor-not-allowed data-disabled:opacity-50', ]
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `plain` | `rounded-none bg-transparent` |
| `card` | `rounded-card bg-card shadow-hairline focus-within:shadow-[inset_0_0_0_1.5px_var(--primary)] data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)]` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `bl-mde-sm` |
| `default` (default) | `bl-mde-md` |
| `lg` | `bl-mde-lg` |
