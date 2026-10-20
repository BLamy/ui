---
description: Type / for a menu of every block the editor can insert. Filter it by typing, drive it from the keyboard, or replace it with your own items.
---

# Slash menu

Type `/` anywhere in the text and a menu of blocks opens at the caret. Keep typing to filter it, then press Enter: the `/query` you typed is removed and the block is inserted in its place. Each block lands in the Markdown pane exactly as it will be saved.

{% demo src="editing-slash/editor" %}

## Every command

`SLASH_ITEMS` is the built-in list, in menu order. **Inserts** is what the item writes into an otherwise empty document.

| Item | Matches | Inserts |
| --- | --- | --- |
| Heading 1 | `h1 title` | `# ` |
| Heading 2 | `h2 section` | `## ` |
| Heading 3 | `h3 subsection` | `### ` |
| Bullet list | `ul unordered` | `- ` |
| Numbered list | `ol ordered` | `1. ` |
| Task list | `todo checkbox` | `- [ ] ` |
| Quote | `blockquote` | `> ` |
| Divider | `hr rule separator` | `---` |
| Code block | `snippet pre` | an empty fence |
| Hint | `callout info warning danger success admonition` | `{% hint style="info" %}` |
| Tabs | `tabbed switcher` | `{% tabs %}` with **First tab** and **Second tab** |
| Install command | `command npm pnpm yarn bun npx package manager install terminal shell` | `{% command %}{% endcommand %}` |
| Expandable | `details accordion collapse` | `<details>` with the summary **Click to expand** |
| Stepper | `steps guide step-by-step` | `{% stepper %}` with **First step** and **Second step** |
| Embed | `youtube video iframe url` | `{% embed url="" %}` |
| Page link | `content-ref reference` | `{% content-ref url="" %}` labelled **Page link** |
| Demo | `example live preview component playground` | `{% demo src="" %}` |
| Columns | `two column layout` | `{% columns %}` with two columns |
| Image | `figure picture photo` | an empty figure |
| Math | `tex latex formula equation` | `$$` block seeded with `e = mc^2` |
| Table | `grid cells` | a 2 × 2 table with a header row |
| Updates | `changelog release notes` | `{% updates format="full" %}` with one update dated today and a **What changed** heading |
| OpenAPI operation | `api swagger endpoint rest` | `{% openapi-operation path="/" method="get" %}` |
| Mermaid diagram | `chart graph flowchart` | a `mermaid` fence with `graph TD` / `A --> B` |
| Strudel music | `audio song beat pattern live code tidal` | a `strudel` fence with a four-note pattern |
| Citation | `cite footnote source reference superscript` | `[^n]`, the next unused citation number |

The heading, list, quote and code items act on the current block. A bullet list on a line that already has text turns that line into the first item. The others insert a new block at the caret. Where a block has fields (a hint's style, a tab's title, an embed's URL) you fill them in on the block itself. The pages on [code](04-code-math-and-diagrams.md), [layout](05-tables-and-layout.md) and [references](03-references-and-citations.md) show each one.

{% hint style="info" %}
Type `/` on an empty line. If you type it in the middle of a paragraph, a new block splits the paragraph around it.
{% endhint %}

## Filtering

What you type after the `/` is matched against each item's **title and keywords together**, lower-cased, as a plain substring. So `/list` finds all three lists, `/chart` finds Mermaid, `/cite` finds Citation, and `/h2` finds Heading 2. If nothing matches, the menu says *No matching blocks*. A space ends the query, and the menu closes.

{% demo src="editing-slash/filter" %}

## Keyboard and mouse

| Key | In the menu |
| --- | --- |
| `↓` / `↑` | Next / previous item. Wraps around, and scrolls the active item into view. |
| `Enter` | Insert the active item. |
| `Esc` | Close the menu, keeping what you typed. |
| Hover, click | Hovering moves the highlight; clicking inserts. |

The menu opens below the caret and flips above it when there's no room below. It always stays inside the viewport. The `@` / `#` / `$` [reference pickers](03-references-and-citations.md) use the same menu component, so they behave the same way.

## Your own items

A `SlashItem` is a title, keywords, a [lucide](https://lucide.dev) icon and a `run(editor)` function. By the time `run` is called, the `/query` text has already been deleted, so `run` only has to insert. Pass your own list as `slashMenu={{ items }}`. It **replaces** the built-ins, so spread `SLASH_ITEMS` in to keep any of them.

{% demo src="editing-slash/editor" variants="custom:Custom items" %}

```tsx title="Editor.tsx"
import { GitbookEditor, SLASH_ITEMS, type SlashItem } from "@brett_lamy/docstream-editor"
import { CalendarDays, TriangleAlert } from "lucide-react"

const items: SlashItem[] = [
  // Keep a few built-ins…
  ...SLASH_ITEMS.filter((item) => ["Heading 2", "Bullet list", "Code block", "Table"].includes(item.title)),
  // …and add your own. `run` gets the TipTap editor.
  {
    title: "Warning",
    keywords: "caution careful hint callout",
    icon: TriangleAlert,
    run: (editor) =>
      editor.chain().focus().insertContent({
        type: "gbHint",
        attrs: { style: "warning" },
        content: [{ type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "Careful:" }] }],
      }).run(),
  },
  {
    title: "Today's date",
    keywords: "now time stamp",
    icon: CalendarDays,
    run: (editor) => editor.chain().focus().insertContent(new Date().toISOString().slice(0, 10)).run(),
  },
]

export const Editor = () => <GitbookEditor slashMenu={{ items }} />
```

`run` can insert any node in the editor's schema, as TipTap JSON (`{ type, attrs, content }`). The node names are the ones in the [editing surface table](01-editing-surface.md#what-you-can-edit) (`gbHint`, `gbTabs`/`gbTab`, `gbCommand`, `codeBlock`, …), and each one serializes to its Markdown like a built-in. You can also insert a Markdown snippet: `markdownPasteContent(md)` turns Markdown into that JSON.

```ts title="snippet.ts"
import { markdownPasteContent, type SlashItem } from "@brett_lamy/docstream-editor"
import { FileText } from "lucide-react"

const releaseNote: SlashItem = {
  title: "Release note",
  keywords: "changelog template",
  icon: FileText,
  run: (editor) => {
    const pasted = markdownPasteContent('## What changed\n\n{% hint style="success" %}\nShipped.\n{% endhint %}\n')
    if (pasted) editor.chain().focus().insertContent(pasted.content).run()
  },
}
```

`slashMenu={false}` removes the menu, and `/` is then just a character.

## In a custom editor

Composing your own `useEditor()`? `createGitbookExtensions({ slashMenu })` takes the same `true` / `false` / `{ items }`. `createSlashMenu(items)` builds the extension on its own, and `SlashMenu` is the default instance. The popup is `SuggestionMenuView` with `createSuggestionRender`, both exported, for a menu of your own on another trigger character. See [Extensions](../03-files-and-demos/05-extensions.md).

```ts title="extensions.ts"
import { createGitbookExtensions, createSlashMenu, SLASH_ITEMS } from "@brett_lamy/docstream-editor"

// The full set, with a custom menu:
const extensions = createGitbookExtensions({ slashMenu: { items: SLASH_ITEMS.slice(0, 9) } })

// Or the menu alone, for a schema of your own:
const Slash = createSlashMenu(SLASH_ITEMS.filter((item) => item.title !== "OpenAPI operation"))
```

## Next

{% content-ref url="03-references-and-citations.md" %}
[References and citations](03-references-and-citations.md)
{% endcontent-ref %}
