---
description: Mention people, tag channels and name codebases from pickers your app fills, and insert numbered citations, all as chips that save as plain Markdown.
---

# References and citations

docstream's Markdown has four inline chips: `@mention` for people and agents, `#tag` for channels and labels, `$codebase` for repositories, and `[^n]` for footnote citations. The editor turns each one into a **chip**: an atomic inline node you can select, copy and delete like a single character. A chip serializes back to exactly the text it came from.

{% demo src="editing-references/editor" %}

## Typing a chip

Type a trigger character at the start of a word and a picker opens. Keep typing to filter it, use `↑` / `↓` and `Enter` to insert, or `Esc` to close it. Inserting replaces what you typed with the chip **and a space**, so you can keep writing.

| Trigger | Chip | Serializes to | Picker is on |
| --- | --- | --- | --- |
| `@` | mention | `@luna` | by default |
| `#` | tag / channel | `#launch` | by default |
| `$` | codebase | `$acme/web` | only when the host passes a `codebases` source |
| `/` → **Citation** | citation | `[^3]` | with the [slash menu](02-slash-menu.md) |

- **Free-form entry is always offered.** If what you typed isn't an exact match, the last row inserts it as-is: `@anyone⏎` works with no source configured at all.
- **The query ends at a space.** IDs are one word: letters, digits, `_`, `.` and `-`, plus `/` for codebases (`$org/repo`).
- **`$` is opt-in.** With no `codebases` source there's no `$` picker, so typing `$5` or `$HOME` in prose never opens a menu.

{% hint style="info" %}
Chips also come from Markdown, with or without a picker. When a page loads (or is pasted in), any `@id`, `#id` or `$id` at a word boundary becomes a chip, even with `references={false}`. A sigil in the middle of a word is plain text, so `brett@example.com` and `C#` stay as written. To keep a sigil literal, put it in a code span. The parsing rules are on [docstream's site](https://blamy.github.io/docstream/#/ai/references-and-citations).
{% endhint %}

## Feeding the pickers

`references` takes one source per trigger. A source is either a **static list**, which the editor filters by `id` and `label`, or a **function** `(query) => options` that you answer per keystroke, sync or async, already filtered.

{% demo src="editing-references/editor" variants="directory:Host lists,async:Async search" %}

```tsx title="Editor.tsx"
import { GitbookEditor, type ReferenceOption } from "@brett_lamy/docstream-editor"

const people: ReferenceOption[] = [
  { id: "luna", label: "Luna Park", description: "luna@example.com", group: "People" },
  { id: "reviewer", label: "Reviewer", description: "agent · claude-code", group: "Agents" },
]

<GitbookEditor
  markdown={md}
  onChange={setMd}
  references={{
    mentions: people,                                   // a static list
    tags: ["general", "launch", "design-system"],       // plain strings work too
    codebases: async (query) => searchRepos(query),     // async: [{ id: "acme/web" }, …]
  }}
/>
```

| Option field | Shown as |
| --- | --- |
| `id` | The chip, and the menu row (`@luna`). The only field that's saved. |
| `label` | After the id in the row (`Luna Park`). Also matched by a static list's filter. |
| `description` | After the label (`luna@example.com`, `agent · claude-code`). |
| `group` | A section header above the first option of each run of options with the same group. |

| `references` | Effect |
| --- | --- |
| `true` (default) | `@` and `#` pickers, free-form only. |
| `{ mentions?, tags?, codebases? }` | Those sources. A missing `mentions` / `tags` stays free-form; `codebases` enables `$`. |
| `false` | No pickers. Chips in loaded Markdown still render as chips. |

Details worth knowing:

- A static list is matched **case-insensitively** against `id` and `label`.
- At most **50** options are shown per query.
- A source that throws or rejects shows an empty list, and free-form entry still works.
- The pickers are created with the editor, so a new `references` object takes effect only when the editor remounts. To change what a picker offers while the editor is open, pass a **function** and let it read your current data.

## Citations

A citation is a numbered marker, `[^1]`, with a definition at the end of the document: `[^1]: url "Label"`. docstream draws it as a superscript with a preview card. In the editor the marker is a chip showing its number, and hovering it shows the definition's label (or URL).

{% demo src="editing-references/editor" variants="citations:Citations" %}

- **Insert one** with `/cite` (the slash menu's **Citation** item). It takes one more than the highest number already in the document: with `[^1]` and `[^2]` present, you get `[^3]`.
- **Definitions are kept with the document, not in the editing surface.** `GitbookEditor` remembers the definitions from the Markdown it loaded or had pasted in, and re-appends them, unchanged and in order, every time it serializes. Add or edit them in the Markdown (the right-hand pane above). A new marker has no definition until you add one.
- Deleting a marker leaves its definition in place, because it may be cited elsewhere.

{% hint style="warning" %}
Footnote definitions have no node in the editor's schema, so a custom editor built from `createGitbookExtensions` must keep `doc.citations` itself. Read them from `parseMarkdown(md).citations`, then set `ast.citations` before `serializeEditorMarkdown(ast)`. `GitbookEditor` does this for you. See [Conversion](../04-reference/02-conversion.md).
{% endhint %}

## Chips in the Markdown

Every chip round-trips exactly. These lines load as chips and save as written:

````md
@luna owns the launch; ask in #launch before merging into $acme/web.

Agents are people too: @reviewer approved it[^1].

[^1]: https://example.com/review "Review thread"
````

How a chip looks and what a click on it does in the *published* page is the renderer's job. docstream gives hosts `onReferenceClick` and custom chip renderers, and its [references page](https://blamy.github.io/docstream/#/ai/references-and-citations) covers both.

## In a custom editor

`createGitbookExtensions({ references })` takes the same option. The pieces are exported as well:

| Export | What it is |
| --- | --- |
| `createReferenceSuggestion({ char, items, allowFreeForm })` | One picker extension for `"@"`, `"#"` or `"$"`. `allowFreeForm: false` drops the type-anything row. |
| `resolveReferenceOptions(source, query)` | Resolves a source for a query the way the picker does (filter, cap at 50). Handy in tests. |
| `GbReference` | The chip node: `kind` (`mention` / `tag` / `codebase` / `citation`), `id`, plus `url` and `label` for citations. |
| `ReferenceOption`, `ReferenceSource`, `ReferenceSources`, `ReferenceTrigger` | Types. |

```ts title="extensions.ts"
import { createGitbookExtensions, createReferenceSuggestion } from "@brett_lamy/docstream-editor"

// Built-in pickers off; a mentions picker that only accepts known people.
const extensions = createGitbookExtensions({
  references: false,
  extensions: [createReferenceSuggestion({ char: "@", items: people, allowFreeForm: false })],
})
```

## Next

{% content-ref url="04-code-math-and-diagrams.md" %}
[Code, math and diagrams](04-code-math-and-diagrams.md)
{% endcontent-ref %}
