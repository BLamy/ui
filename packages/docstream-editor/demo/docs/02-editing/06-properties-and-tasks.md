---
description: YAML frontmatter as an editable property sheet that keeps your comments and quoting, and task boxes with eight states, a state menu and undo.
---

# Properties and tasks

Two pieces of document state have their own controls in the editor. The **properties sheet** edits a page's YAML frontmatter, and **task boxes** carry one of eight states. Both are docstream's own components (`DocumentProperties` and `TaskCheckbox`), the same ones the renderer shows. Both write back through `onChange`, and both are part of undo and redo.

## Document properties

Frontmatter (a `---` block at the very top of the Markdown) is document metadata, not body text. The editor shows it as a compact **Properties** sheet above the toolbar, collapsed by default with a count of the properties. Open it and every key is a field:

{% demo src="editing-properties/editor" variants="properties:Properties" %}

````md
---
# Comments, key order and quoting survive edits.
title: Q4 launch checklist
status: draft
owner: "@luna"
reviewed: false
priority: 2
tags: [docs, launch]
---

# Q4 launch checklist
````

| Value | Field | Notes |
| --- | --- | --- |
| Text | A text input | A multi-line string gets a text area. |
| `true` / `false` | A checkbox | |
| A number | A number input | Only valid numbers are written. |
| A list or map | A YAML text area | Committed when you leave the field. Invalid YAML shows the error and isn't applied. |
| `null` / empty | A text input | Shows *Empty*. |

- **Add property** asks for a name (which must be new) and adds it as an empty string. The **×** on a row removes that key.
- **Edits are surgical.** Changing one value rewrites only that value in the YAML. Comments, key order, quoting style and the rest of the block are kept, so the diff is one line.
- **Body edits leave the YAML alone.** Typing in the document never re-serializes the frontmatter, and a page you only open comes back byte for byte.
- **Undo works across both.** A property change is an editor transaction, so `Mod`+`Z` steps back through property and body edits in order.
- **Broken YAML** isn't lost. The sheet shows the parse error and a text area with the raw YAML, so you can fix it in place.
- **Controlled updates** (a new `markdown` prop) refresh the sheet and the body together.

| `documentProperties` | Effect |
| --- | --- |
| `true` (default) | The sheet, collapsed, when the document has frontmatter. |
| `{ defaultOpen: true }` | The sheet, expanded. |
| `false` | No sheet. The frontmatter is still kept and saved. |

The sheet appears only when the Markdown *has* frontmatter. A document without frontmatter has no sheet, and adding the first property is up to your app: see [Commands](#commands-for-hosts) below. How docstream reads frontmatter (delimiters, the YAML subset, rendering options) is on docstream's [Properties and tasks](https://blamy.github.io/ui/#/docstream/writing/properties-and-tasks) page.

{% hint style="info" %}
**On this docs site**, frontmatter whose only keys are site metadata (`title`, `description`, `order`, `hidden`, `icon`) drives the sidebar and page header and isn't shown as a sheet. In the editor, *all* frontmatter is properties.
{% endhint %}

## Task states

A task list item's box holds one of eight states, each with its own Markdown marker, icon and label. They are docstream's `TASK_STATES`, re-exported by the editor:

{% demo src="editing-properties/editor" variants="tasks:Tasks" %}

| Marker | State id | Label | Checkbox |
| --- | --- | --- | --- |
| `[ ]` | `pending` | Pending | unchecked |
| `[~]` | `in-progress` | In progress | mixed |
| `[?]` | `implemented` | Implemented · evidence needed | mixed |
| `[b]` | `blocked` | Blocked | mixed |
| `[d]` | `parked` | Parked · verification debt | mixed |
| `[!]` | `refuted` | Refuted | mixed |
| `[x]` | `verified` | Verified | checked |
| `[-]` | `cancelled` | Cancelled | mixed |

### Changing a state

- **Click** the box: a pending task becomes verified, and any other state becomes pending. So a marked task takes two clicks to verify: one to clear it, one to check it.
- **Right-click** the box (or focus it and press `Shift`+`F10` or the context-menu key) for the **state menu**, which lists all eight with their icons and the current one checked. `↑` / `↓` / `Home` / `End` move, `Enter` picks, and `Esc` or `Tab` closes and returns focus to the box.
- **Hover** or focus a box for a moment to see its label as a tooltip.
- **Type the marker**: at the start of a line, `[~] ` (or `- [~] `) starts a task in that state. The same works for every marker in the table, and `[ ]` / `[x]` as usual.
- **Undo** steps back through state changes one at a time. Each change is its own history entry.

Each change writes that state's marker. A task nobody touches keeps its original spelling, so an uppercase `[X]` stays `[X]` until you change it. In a read-only editor (`editable={false}`) the boxes show their state but don't respond. The box is accessible: it reports `aria-checked="mixed"` for the in-between states, and its label includes the state.

## Commands for hosts

Both are editor commands too, so a host can drive them from its own UI:

{% demo src="editing-properties/editor" variants="commands:Commands" %}

| Command | Does |
| --- | --- |
| `editor.commands.setTaskState(state)` | Sets the state of the task at the caret (`"blocked"`, `"verified"`, …). |
| `editor.commands.setDocumentProperties(properties)` | Replaces the frontmatter (`{ yaml }`, or `null` to remove it). It goes through undo and `onChange` like any edit. |

```tsx title="StatusButton.tsx"
import { setDocumentProperty } from "@brett_lamy/docstream/gitbook"
import type { DocumentPropertiesNode } from "@brett_lamy/docstream-editor"
import type { Editor } from "@tiptap/react"

/** Set `status:` in the frontmatter, creating the frontmatter if the page has none. */
export function markShipped(editor: Editor) {
  const current = editor.state.doc.attrs.properties as DocumentPropertiesNode | null
  editor.commands.setDocumentProperties(setDocumentProperty(current ?? { yaml: "" }, "status", "shipped"))
}

/** Block the task under the caret. */
export const block = (editor: Editor) => editor.chain().focus().setTaskState("blocked").run()
```

`setDocumentProperty` and `removeDocumentProperty` (from `@brett_lamy/docstream/gitbook`) edit one key while keeping the rest of the YAML as written. They are what the sheet itself uses.

## In a custom editor

`createGitbookExtensions()` already includes both pieces: `GbTaskItem`, the task item with the shared checkbox, its state attribute, the marker input rules and `setTaskState`; and `GbDocumentProperties`, the doc-level `properties` attribute and `setDocumentProperties`. Render the sheet yourself with `DocumentPropertiesEditor`:

```tsx title="MyEditor.tsx"
import { EditorContent, useEditor } from "@tiptap/react"
import { DocumentPropertiesEditor, astToTiptap, createGitbookExtensions } from "@brett_lamy/docstream-editor"
import { parseMarkdown } from "@brett_lamy/docstream/gitbook"

export function MyEditor({ markdown }: { markdown: string }) {
  const editor = useEditor({ extensions: createGitbookExtensions(), content: astToTiptap(parseMarkdown(markdown)) })
  if (!editor) return null
  return (
    <div className="gb">
      <DocumentPropertiesEditor editor={editor} defaultOpen />
      <EditorContent editor={editor} className="gb-content" />
    </div>
  )
}
```

`TaskCheckbox`, `TASK_STATE_ICONS`, `TASK_STATES` and the `TaskState` type are re-exported, for task UIs outside the editor.

## Next

{% content-ref url="../03-files-and-demos/01-images-and-attachments.md" %}
[Images and attachments](../03-files-and-demos/01-images-and-attachments.md)
{% endcontent-ref %}
