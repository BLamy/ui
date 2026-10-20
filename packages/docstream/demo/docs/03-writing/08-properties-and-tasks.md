---
description: YAML frontmatter as a first-party property sheet you can read and edit losslessly, and task lists with eight states that readers can change in place.
---

# Properties and tasks

Two features turn a Markdown file into a working document. **Document properties** give it structured metadata — owner, status, version, tags — that survives every edit byte-for-byte. **Task states** go past done / not done to the states real work moves through: in progress, blocked, implemented but unverified, refuted. Both render as interactive controls when the host wants them to be, and both write back to plain Markdown.

## Document properties

YAML frontmatter — a block between `---` lines at the very top of the file — becomes the document's **properties**:

````md title="launch.md"
---
# Comments, key order and quoting survive edits.
title: Q4 launch checklist
status: in-review
owner: "@brett"
version: 3
reviewed: false
tags: [docs, launch]
---

# Q4 launch checklist

The body starts here.
````

Docstream renders it as a compact **Properties** sheet above the body, collapsed by default and showing how many properties there are. Here it is in the playground, editable — change a value in the sheet and watch the YAML on the left update, comment and quoting intact; or edit the YAML and watch the sheet follow:

{% demo src="writing-playground/editor" variants="properties:Properties,tasks:Tasks" %}

{% hint style="info" %}
**On this docs site**, frontmatter whose only keys are `title`, `description`, `order`, `hidden` and `icon` is site metadata: the site uses it for the sidebar and the page header and hides it from the page. Add any other key and the whole block renders as the property sheet, as it would anywhere else.
{% endhint %}

### How frontmatter is read

- The first line must be exactly `---` (a byte-order mark before it is fine); the block ends at the next `---` or `...` line. Anything else at the top is ordinary Markdown — a `---` later in the file is a divider.
- The YAML is kept **verbatim** in `doc.properties.yaml`, separate from the body blocks, with its delimiters. Serializing writes it back exactly as it was.
- It is parsed with the `yaml` package and never executed. It must be a mapping; invalid YAML or a top-level list makes the sheet show the parser's error and the raw text instead of fields.

| YAML value | Shown as | Edited with |
| --- | --- | --- |
| `status: in-review` | Text | A text input |
| `version: 3` | Number | A number input |
| `reviewed: false` | `true` / `false` | A checkbox |
| `owner:` (nothing) | "Empty" | A text input |
| Multi-line strings | Text | A textarea |
| `tags: [docs, launch]`, nested maps | YAML | A YAML textarea, applied on blur (errors shown inline) |

### Rendering options

`MarkdownContent`, `DocsRenderer` and `GitbookStreamdown` all take `documentProperties`:

```tsx title="Doc.tsx"
<MarkdownContent markdown={md} />                                         {/* collapsed sheet (default) */}
<MarkdownContent markdown={md} documentProperties={{ defaultOpen: true }} /> {/* expanded */}
<MarkdownContent markdown={md} documentProperties={false} />              {/* hidden */}
```

### Editing properties

The read-only sheet is the `DocumentProperties` component; give it an `onChange` and it becomes an editor — inputs per type, **Add property**, and a remove button per row. Each change hands you a new properties node; put it on the document and serialize:

```tsx title="PropertiesEditor.tsx"
import { useMemo, useState } from "react"
import { DocumentProperties, DocsRenderer, parseMarkdown, serializeMarkdown } from "@brett_lamy/docstream"

export function PropertiesEditor({ initial }: { initial: string }) {
  const [source, setSource] = useState(initial)
  const doc = useMemo(() => parseMarkdown(source), [source])
  return (
    <>
      {doc.properties ? (
        <DocumentProperties
          properties={doc.properties}
          defaultOpen
          onChange={(properties) => setSource(serializeMarkdown({ ...doc, properties }))}
        />
      ) : null}
      <DocsRenderer doc={doc} documentProperties={false} />
    </>
  )
}
```

The same edits are available without the UI. All three helpers keep comments, key order, quoting and the other keys' formatting; changing a scalar patches just that value's characters in the YAML:

```ts title="bump.ts"
import { parseMarkdown, serializeMarkdown } from "@brett_lamy/docstream"
import { readDocumentProperties, removeDocumentProperty, setDocumentProperty } from "@brett_lamy/docstream/gitbook"

const doc = parseMarkdown(source)
const { values, error } = readDocumentProperties(doc.properties!) // never throws
if (!error) {
  let props = setDocumentProperty(doc.properties!, "version", Number(values.version) + 1)
  props = removeDocumentProperty(props, "reviewed")
  const next = serializeMarkdown({ ...doc, properties: props })
}
```

| Export | Entry | What it does |
| --- | --- | --- |
| `readDocumentProperties(node)` | root, `/gitbook` | `{ values, error? }` — JSON-like values; never throws |
| `setDocumentProperty(node, key, value)` | root, `/gitbook` | New node with one key set or added; throws on invalid YAML |
| `removeDocumentProperty(node, key)` | root, `/gitbook` | New node without the key |
| `DocumentProperties` | root, `/properties` | The sheet; editable with `onChange` |

The sheet's styles ship in `@brett_lamy/docstream/styles.css`; hosts that use only the `/properties` entry can import `@brett_lamy/docstream/properties/styles.css` instead.

## Task states

A GFM task list knows two states. Docstream's knows eight, each with its own marker, icon and tooltip:

{% tabs sync="example" %}
{% tab title="Preview" %}
- [ ] Write the migration guide
- [~] Port the examples to folder demos
- [?] Fix nested list indentation
- [b] Publish to npm — waiting on the 2FA reset
- [d] Screenshot tests for dark mode
- [!] "Mermaid renders in under 1 ms"
- [x] Thumbnail hover cards
- [-] IE11 support
{% endtab %}
{% tab title="Markdown" %}
````md
- [ ] Write the migration guide
- [~] Port the examples to folder demos
- [?] Fix nested list indentation
- [b] Publish to npm — waiting on the 2FA reset
- [d] Screenshot tests for dark mode
- [!] "Mermaid renders in under 1 ms"
- [x] Thumbnail hover cards
- [-] IE11 support
````
{% endtab %}
{% endtabs %}

| Marker | State | Tooltip | Meaning |
| --- | --- | --- | --- |
| `[ ]` | `pending` | Pending | Not started. |
| `[~]` | `in-progress` | In progress | Someone is on it. |
| `[?]` | `implemented` | Implemented · evidence needed | The work is done, but nothing has confirmed it yet. |
| `[b]` | `blocked` | Blocked | Can't move until something else does. |
| `[d]` | `parked` | Parked · verification debt | Set aside on purpose, with checking owed later. |
| `[!]` | `refuted` | Refuted | Checked, and it turned out false or broken. |
| `[x]` / `[X]` | `verified` | Verified | Done and confirmed. |
| `[-]` | `cancelled` | Cancelled | Won't be done. |

The split between `[?]` and `[x]` is the point: "the code landed" and "we saw it work" are different claims, and a checklist that can't tell them apart overstates progress.

### Semantics

- Only `[x]` is **checked**. The six intermediate states render as an indeterminate checkbox (`aria-checked="mixed"`) with the state's icon; `[ ]` is unchecked. The accessible name includes the state: "Publish to npm — waiting on the 2FA reset: Blocked".
- Hovering or focusing a box shows its state name after a short delay.
- Any other character in the brackets (`[n]`, `[yes]`) is not a task marker — the item is ordinary text.
- Once one item in a list has a marker, the list is a task list and every item in it gets a box (items without a marker are pending).
- Nested and ordered task lists work, and each marker — uppercase `[X]` included — is written back as you spelled it until the state changes.

### Interactive tasks

Pass `onTaskStateChange` and the boxes become controls:

- **Click** a marked box to clear it to pending; click a pending box to check it.
- **Right-click**, or press **Shift+F10** or the context-menu key, for a menu of all eight states — arrow keys, Home / End to move, Enter to pick, Escape to close.

Docstream doesn't own your document, so the handler receives the AST list item and the new state. Write the state onto the item and re-render — the playground above does exactly this, then serializes the document so the Markdown updates as you click:

```tsx title="Checklist.tsx"
import { useMemo, useState } from "react"
import { DocsRenderer, parseMarkdown, serializeMarkdown, type ListItemNode, type TaskState } from "@brett_lamy/docstream"

function setTaskState(item: ListItemNode, state: TaskState) {
  delete item.checkMark // drop a remembered uppercase [X]
  item.checked = state === "verified"
  if (state === "pending" || state === "verified") delete item.state
  else item.state = state
}

export function Checklist({ initial, onSave }: { initial: string; onSave: (md: string) => void }) {
  const [source, setSource] = useState(initial)
  const doc = useMemo(() => parseMarkdown(source), [source])
  return (
    <DocsRenderer
      doc={doc}
      onTaskStateChange={(item, state) => {
        setTaskState(item, state) // `item` is a node of `doc`
        const next = serializeMarkdown(doc)
        setSource(next)
        onSave(next)
      }}
    />
  )
}
```

`MarkdownContent` and `GitbookStreamdown` accept the same prop. Without it, boxes are read-only: they show their state and ignore clicks.

### Building your own

The pieces are exported for task UIs outside a document:

| Export | Entry | What it is |
| --- | --- | --- |
| `TaskCheckbox` | root, `/tasks` | The checkbox: `state`, `onChange?`, `label?` — tooltip and state menu included |
| `TASK_STATE_ICONS` | root, `/tasks` | The icon component for each state |
| `TASK_STATES` | root, `/gitbook` | `[{ id, marker, label }]` in menu order |
| `getTaskState(item)` | root, `/gitbook` | An item's state (`pending` when unmarked) |
| `taskMarker(item)` | root, `/gitbook` | The character to write between the brackets |
| `taskStateFromMarker(char)` | root, `/gitbook` | `"~"` → `"in-progress"`, unknown → `undefined` |

```tsx title="StatusPicker.tsx"
import { useState } from "react"
import { TaskCheckbox } from "@brett_lamy/docstream/tasks"
import type { TaskState } from "@brett_lamy/docstream"

export function StatusPicker() {
  const [state, setState] = useState<TaskState>("in-progress")
  return <TaskCheckbox state={state} onChange={setState} label="Release 1.19" />
}
```

## Next

{% content-ref url="../04-interactive/01-demos.md" %}
Demos — live React components backed by real files
{% endcontent-ref %}
