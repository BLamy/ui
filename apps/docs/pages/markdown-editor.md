# MarkdownEditor

A Markdown field on the `@brett_lamy/docstream-editor` WYSIWYG editor. It reads and writes the same GitBook-flavored Markdown that [MarkdownView](https://blamy.github.io/ui/#/docstream) renders, so what you type is what readers get. Type `/` for blocks, paste Markdown to get structure, and paste or drop images as inline image blocks or as attachment chips.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx lineNumbers="false"
import '@brett_lamy/ui/styles.css'

import { MarkdownEditor } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/markdown-editor.json{% endcommand %}

Adds `@/components/ui/markdown-editor.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx lineNumbers="false"
import { MarkdownEditor } from '@/components/ui/markdown-editor'
```
{% endtab %}
{% endtabs %}

```tsx
import { MarkdownEditor } from '@brett_lamy/ui'

const [markdown, setMarkdown] = useState('# Notes')

<MarkdownEditor value={markdown} onValueChange={setMarkdown} placeholder="Type / for blocks" />
```

## Live examples

### Notes with a live preview

A controlled editor beside a `MarkdownView` of the same value. Every edit serializes to Markdown, so the preview updates as you type.

{% demo src="markdown-editor/notes-with-preview" %}

### Comment box with pasted screenshots

`imagePaste="chip"` turns pasted or dropped images into compact chips. You store the files: `onAttachmentAdd` hands you each image as a data URL, `onAttachmentRemove` reports chips the user deleted, and `attachments` feeds the chips their thumbnails. Chips serialize as `![name](attachment:id)`. ⌘/Ctrl+Enter calls `onSubmit`.

{% demo src="markdown-editor/comment-box" %}

### Read-only and rendered

`readOnly` keeps the field and its content selectable, but it can't be edited and the toolbar is hidden. For display only, render the same Markdown with `MarkdownView`.

{% demo src="markdown-editor/read-only-toggle" %}

### In a form

`name` submits the Markdown with the form through a hidden input. `aria-labelledby`, `aria-describedby` and `invalid` go on the editable element, so a `Label` and help text are read with the field.

{% demo src="markdown-editor/issue-form" %}

### Slash commands and blocks

Type `/` for headings, lists, tasks, quotes, code, hints, tabs, expandables, steppers, tables and more. The ref exposes the editor: `insertMarkdown`, `setMarkdown`, `getMarkdown`, `clear`, `focus`, and the full TipTap `commands` and `chain()`.

{% demo src="markdown-editor/slash-blocks" %}

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` | — | Markdown (controlled). |
| `defaultValue` | `string` | `''` | Initial Markdown (uncontrolled). |
| `onValueChange` | `(markdown) => void` | — | Called with serialized Markdown on every edit. |
| `onSubmit` | `(markdown) => void` | — | ⌘/Ctrl+Enter. |
| `placeholder` | `string` | — | Shown while the document is empty. |
| `variant` | `'default' \| 'ghost' \| 'card'` | `'default'` | Filled field, no chrome, or a raised card. |
| `size` | `'sm' \| 'default' \| 'lg'` | `'default'` | Type size, padding and default minimum height. |
| `minHeight` / `maxHeight` | `number \| string` | size-based / none | Writing-area bounds; content scrolls past `maxHeight`. |
| `toolbar` | `boolean` | `false` | Bold, italic, strike, code and link buttons. Hidden while read-only or disabled. |
| `slashMenu` | `boolean \| { items }` | `true` | The `/` block menu, or a custom item list. |
| `references` | `boolean \| ReferenceSources` | `false` | `@` / `#` / `$` pickers that insert reference chips. |
| `pasteMarkdown` | `boolean` | `true` | Parse pasted plain text that looks like Markdown into structure. |
| `imagePaste` | `'inline' \| 'chip'` | `'inline'` | Pasted or dropped images become image blocks or attachment chips. |
| `attachments` | `MarkdownEditorAttachment[]` | — | Chip mode: the host's store (`{ id, name, src?, size?, type? }`). |
| `onAttachmentAdd` | `(attachment & { file }) => void` | — | Chip mode: once per pasted or dropped image. |
| `onAttachmentRemove` | `(ids) => void` | — | Chip mode: chips deleted, cut or cleared. |
| `onAttachmentOpen` | `(attachment) => void` | built-in viewer | Chip mode: a chip was clicked. |
| `readOnly` | `boolean` | `false` | Not editable; selectable, field chrome kept. |
| `disabled` | `boolean` | `false` | Not editable and dimmed. |
| `invalid` | `boolean` | `false` | Red ring and `aria-invalid`. |
| `autoFocus` | `boolean` | `false` | Focus on mount. |
| `name` | `string` | — | Submit the Markdown with a form. |
| `onKeyDown` / `onPaste` | `(event) => boolean` | — | Run before the editor's own handling; return `true` when handled. |
| `onFocus` / `onBlur` | `() => void` | — | Focus changes. |
| `onEditorReady` | `(editor \| null) => void` | — | The TipTap editor once mounted. |
| `ref` | `MarkdownEditorHandle` | — | `editor`, `commands`, `chain()`, `focus()`, `blur()`, `getMarkdown()`, `setMarkdown()`, `insertMarkdown()`, `clear()`, `isEmpty()`. |

`id`, `aria-label`, `aria-labelledby`, `aria-describedby`, `className` and `style` are passed through as well. `markdownEditorVariants` is the cva recipe; `looksLikeMarkdown` and `insertMarkdown(editor, markdown)` are the paste helpers, exported for editors of your own.

## Theming

The editor follows the surrounding `--bl-*` tokens, so it matches light and dark wherever `BLProvider` or the docs' `AppearanceProvider` put it. It maps them onto the shadcn names the Docstream stylesheet reads (`--card`, `--muted`, `--border`, `--accent`, `--primary`…), the same way `MarkdownView` does. The slash menu and the chip hover card render on `<body>`, and they take the tokens of the editor that opened them.

The wrapper has `data-slot="markdown-editor"` and `data-variant`, plus `data-readonly`, `data-disabled` and `data-invalid` for state styling. The editor inside keeps Docstream's `gb`, `gb-toolbar` and `gb-content` classes for overrides.
