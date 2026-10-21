---
description: The plain-data layer under every renderer — parse, serialize byte-for-byte, outline, flatten, and edit GitBook-flavored Markdown without React.
---

# Parser API

Everything docstream renders goes through a plain-data AST, and you can use that layer directly: parse a page, inspect or edit the tree, and write it back **byte-for-byte**. It's the same engine `@brett_lamy/docstream-editor` edits documents with, and it has no React or DOM dependency.

```ts lineNumbers="false"
import { parseMarkdown, serializeMarkdown } from "@brett_lamy/docstream/gitbook" // or the package root
```

{% demo src="ref-parser/explorer" %}

## The round-trip guarantee

```ts lineNumbers="false"
serializeMarkdown(parseMarkdown(md)) === md
```

For Markdown and GitBook pages, serialization reproduces the source exactly — the author's emphasis markers (`_x_` vs `*x*`, `__b__` vs `**b**`), backslash escapes, link forms (inline, reference, collapsed, shortcut, autolink, HTML `<a>`), reference definitions where they were written, Markdown vs HTML images, blank lines between blocks, list markers and indents, fence characters and lengths, table delimiter rows, tag lines as written (quote style, extra attributes), frontmatter delimiters, CRLF line endings and trailing whitespace at end of file. The one normalization: a missing final newline is added.

It works because the AST records **layout-only fields** — `gap`, `blanks`, `raw`, `opening`, `closing`, `delims`, `fence`, `marker`, … — only where the source differs from what the serializer would write by default. Those hints are reused only while they still describe the node: edit a node so its recorded `raw` no longer parses back to the same thing, and the serializer writes fresh canonical syntax for that node alone. Everything you didn't touch stays as written.

```ts title="edit.ts"
import { parseMarkdown, serializeMarkdown } from "@brett_lamy/docstream/gitbook"

const doc = parseMarkdown(source)
for (const block of doc.children) {
  if (block.type === "hint" && block.style === "info") block.style = "warning"
}
const next = serializeMarkdown(doc) // only the edited hints' tag lines change
```

{% hint style="info" %}
Nodes are plain JSON — no classes, no prototypes. Store them, diff them, send them over the wire, build them by hand. Programmatically created nodes simply omit the layout fields and serialize canonically.
{% endhint %}

## Parsing

### `parseMarkdown`

```ts
function parseMarkdown(src: string): DocumentNode
```

Parses a whole document. In order, it:

1. Detects line endings (`\r\n` throughout is recorded as `lineEnding: "\r\n"`).
2. Splits off YAML frontmatter between `---` and `---`/`...` into `doc.properties` (kept as text; never executed).
3. Collects footnote definitions (`[^id]: url "Label"`) and reference link definitions (`[label]: url "title"`) outside code fences into `footnoteDefinitions` / `refDefinitions`.
4. Parses the remaining lines into blocks. Footnote definitions that end the document become `doc.citations`; any elsewhere stay as `definition` blocks where they were written.

Unknown `{% tag %}` lines become `raw` blocks: they render nothing and serialize verbatim, so GitBook tags from other integrations survive a round trip.

### `parseBlocks`

```ts
function parseBlocks(lines: string[]): Block[]
```

Parses an array of lines (not a string) into blocks, with no frontmatter or definition pass — reference links resolve against whatever `refDefinitions` holds. Useful for parsing a fragment, e.g. a block's `raw` text.

### `parseInline`

```ts
function parseInline(src: string, marks?: Partial<Omit<TextNode, "type" | "text">>): Inline[]
```

Parses inline Markdown into a flat list of runs. Formatting is carried as marks on each run, not as nesting, so `**ask @brett**` is two inlines that are both `bold`. Supports `**bold**` / `__bold__`, `*italic*` / `_italic_`, `***both***`, `~~strike~~`, code spans, `[text](url "title")`, `[text][ref]` / `[text][]` / `[ref]`, `<url>` and bare URLs, `![alt](src "title")`, backslash escapes, `@mention` / `#tag` / `$codebase` / `[^n]` chips, and inline HTML `<img>`, `<a href><img></a>` and `<a href>text</a>`. The optional `marks` are applied to everything it emits.

```ts
parseInline('**ask @brett** about [docs](https://x.y "T") and `code`')
// [
//   { type: "text", text: "ask ", bold: true },
//   { type: "reference", kind: "mention", id: "brett", bold: true },
//   { type: "text", text: " about " },
//   { type: "text", text: "docs", link: "https://x.y", linkTitle: "T" },
//   { type: "text", text: " and " },
//   { type: "text", text: "code", code: true },
// ]
```

### `plainText`

```ts
function plainText(nodes: Inline[]): string
```

Flattens inlines to text: runs keep their text, images contribute their `alt`, mentions and tags keep their sigil (`@me`), and citations are dropped (superscripts are noise in titles). This is what heading anchors, step titles and task labels are computed from.

### `trimPartialInlineToken`

```ts
function trimPartialInlineToken(md: string): string
```

What `GitbookStreamdown` applies to the buffer while `isStreaming` is set. It strips a trailing half-arrived token so it never flashes as plain text: a block tag still being typed (`{% demo src="butt`), a one-line `{% command %}…` without its end tag yet, a lone backtick or two (or `~`) that may be the start of a fence, `[^1`, `@bre`, a lone `#`, a trailing `\`. Inside an unterminated code fence it does nothing.

```ts
trimPartialInlineToken("Hello [^1")           // "Hello "
trimPartialInlineToken("ask @bre")            // "ask "
trimPartialInlineToken('x\n{% demo src="a')   // "x\n"
```

## Serializing

```ts
function serializeMarkdown(doc: DocumentNode): string
function serializeBlocks(blocks: Block[]): string
function serializeInline(nodes: Inline[], options?: { tableCell?: boolean }): string
```

- `serializeMarkdown` writes frontmatter, blocks (with their recorded blank lines), and trailing citations as a group. It ends with a single newline unless the source recorded something else (`doc.end`).
- `serializeBlocks` joins blocks by their recorded gaps (one blank line by default, none before the first).
- `serializeInline` restores each run's recorded spelling (`delims`), opens shared formatting once across adjacent runs (`**bold [link](u) inside**` comes back whole, not per run), and escapes minimally — falling back to escaping everything escapable only if the minimal form would parse differently. `tableCell: true` writes pipes as `\|`.

```ts
serializeInline(parseInline("_hi_ **there**")) // "_hi_ **there**"
```

## Definitions and references

```ts
const refDefinitions: Map<string, string>
const footnoteDefinitions: Map<string, { url: string; label?: string }>
function serializeReference(n: ReferenceNode): string
```

`refDefinitions` (normalized label → URL) and `footnoteDefinitions` (id → url + label) are module-level maps that each `parseMarkdown` call clears and refills; `parseInline` resolves `[text][ref]` and `[^id]` against them. They reflect the **last** document parsed — read them right after parsing, or use the AST (`definition` blocks, `doc.citations`) when you need a document's own definitions.

`serializeReference` writes a chip back: `@id`, `#id`, `$id` or `[^id]`.

<details>
<summary><code>inlineDelims</code> / <code>defaultInlineDelims</code> — for editors</summary>

```ts
function inlineDelims(n: Inline): InlineDelimiter[]
function defaultInlineDelims(n: Inline): InlineDelimiter[]
```

`inlineDelims` gives the spelling `serializeInline` will use for an inline, outermost → innermost: its recorded `delims` hint reconciled with its actual marks. An editor can store it per mark and hand it back as `delims`. `defaultInlineDelims` is the spelling without a hint; a hint equal to it can be dropped.

</details>

## Outline and anchors

```ts
interface OutlineEntry { level: number; text: string; id: string }
function documentOutline(doc: DocumentNode | Block[]): OutlineEntry[]
function slugify(text: string): string
```

`documentOutline` lists the page's headings for a table of contents: Markdown headings plus the titles of `{% tabs title="…" %}` sections, in document order, including those inside hints, tabs, steppers, columns and expandables. `id` is the same anchor the renderer puts on the heading.

`slugify` lowercases, strips accents, and joins alphanumeric runs with `-`: `slugify("Héllo, World!")` → `"hello-world"`. A string with nothing left becomes `"section"`.

## Plain Markdown for LLMs

```ts
function flattenForPlainMarkdown(doc: DocumentNode): DocumentNode
function flattenBlocks(blocks: Block[]): Block[]
```

Rewrites the docstream-only blocks into plain Markdown, for prompts and tools that don't know docstream: a `{% command %}` becomes a ```` ```sh ```` fence with the npm command, and a titled tab set becomes a heading followed by each tab as a bold label and its blocks. GitBook tags are kept — they're GitBook, not docstream. `resolveDemosToMarkdown(…, { format: "plain" })` applies it when generating `llms.txt`-style output.

## Package-manager commands

```ts
const PACKAGE_MANAGERS: readonly PackageManager[] // ["pnpm", "npm", "yarn", "bun"]
function packageManagerCommands(npmCommand: string, overrides?: Partial<Record<"pnpm" | "yarn" | "bun", string>>): Record<PackageManager, string>
```

What `{% command %}` renders. `PACKAGE_MANAGERS` is the tab order (the first is the default choice).

| npm form | pnpm | yarn | bun |
| --- | --- | --- | --- |
| `npm install -D vitest` | `pnpm add -D vitest` | `yarn add -D vitest` | `bun add -d vitest` |
| `npm install` | `pnpm install` | `yarn install` | `bun install` |
| `npm install -g x` | `pnpm add -g x` | `yarn global add x` | `bun add -g x` |
| `npm ci` | `pnpm install --frozen-lockfile` | `yarn install --frozen-lockfile` | `bun install --frozen-lockfile` |
| `npm uninstall x` | `pnpm remove x` | `yarn remove x` | `bun remove x` |
| `npx shadcn@latest add x` | `pnpm dlx shadcn@latest add x` | `yarn dlx shadcn@latest add x` | `bunx shadcn@latest add x` |
| `npm run dev` | `pnpm dev` | `yarn dev` | `bun run dev` |
| `npm test` | `pnpm test` | `yarn test` | `bun run test` |
| `npm create vite` | `pnpm create vite` | `yarn create vite` | `bun create vite` |

Flags `-D`, `-E`, `-O`, `-P` and their long forms are mapped per manager; unknown flags pass through. Each line converts separately, `a && b` converts per part, a leading `$ ` prompt is kept, and lines that aren't npm/npx commands (comments, `cd`) are left alone. An override replaces a manager's derived command verbatim.

## Document properties

```ts
function readDocumentProperties(properties: DocumentPropertiesNode): ParsedDocumentProperties
function setDocumentProperty(properties: DocumentPropertiesNode, key: string, value: DocumentPropertyValue): DocumentPropertiesNode
function removeDocumentProperty(properties: DocumentPropertiesNode, key: string): DocumentPropertiesNode
```

Frontmatter lives on `doc.properties` as YAML text. `readDocumentProperties` parses it without throwing — `{ values, error? }`, with an error for invalid YAML or a non-mapping document. `setDocumentProperty` and `removeDocumentProperty` return a new node and keep comments, key order, quoting and the delimiters; changing a scalar is a source-range patch that leaves every other byte alone. Both throw if the YAML is currently invalid.

```ts
const doc = parseMarkdown(page)
if (doc.properties) {
  doc.properties = setDocumentProperty(doc.properties, "status", "published")
}
serializeMarkdown(doc) // only the status line changed
```

`DocumentPropertyValue` is `string | number | boolean | null | DocumentPropertyValue[] | { [key: string]: DocumentPropertyValue }`.

## Task states

```ts
const TASK_STATES: ReadonlyArray<{ id: TaskState; marker: string; label: string }>
function taskStateFromMarker(marker: string): TaskState | undefined
function getTaskState(item: Pick<ListItemNode, "state" | "checked">): TaskState
function taskMarker(item: Pick<ListItemNode, "state" | "checked" | "checkMark">): string
```

| Marker | State | Label |
| --- | --- | --- |
| `[ ]` | `pending` | Pending |
| `[~]` | `in-progress` | In progress |
| `[?]` | `implemented` | Implemented · evidence needed |
| `[b]` | `blocked` | Blocked |
| `[d]` | `parked` | Parked · verification debt |
| `[!]` | `refuted` | Refuted |
| `[x]` / `[X]` | `verified` | Verified |
| `[-]` | `cancelled` | Cancelled |

Plain `[ ]` / `[x]` items carry only `checked`; extended markers also set `state`. `getTaskState` reads either, and `taskMarker` gives the marker to write (an explicit `state` wins; an untouched `[X]` keeps its capital).

## Demo and fence helpers

```ts
function parseDemoVariants(raw: string): DemoVariantOption[]
function fenceFor(content: string): string
function serializeDemoFile(file: DemoInlineFile): string
```

`parseDemoVariants("full:Full,compact")` → `[{ id: "full", label: "Full" }, { id: "compact", label: "compact" }]` (a bare id is its own label). `fenceFor` returns a backtick fence one longer than the longest backtick run in `content`, so nested fences survive. `serializeDemoFile` writes one inline demo file as a titled fence.

<details>
<summary>Lower-level helpers exported only from <code>/gitbook</code></summary>

| Export | Signature | Purpose |
| --- | --- | --- |
| `escapeAttr` | `(value: string) => string` | Escape a tag/fence attribute value: `\` → `\\`, `"` → `\"`, `%}` → `%\}`. |
| `unescapeAttr` | `(raw: string) => string` | Undo `escapeAttr`; other backslashes are kept literally. |
| `fenceOpener` | `(line: string) => Fence \| null` | A fence-opening line as `{ char, length }` (char is a backtick or `~`), or null. Backtick info strings can't contain backticks. |
| `closesFence` | `(line, fence) => boolean` | Same character, at least as many, nothing else on the line. |
| `fenceTracker` | `() => { step(line): boolean; inside: boolean }` | Line-by-line "am I inside a fence?" scanner — what the parser uses so tags inside code are content. |
| `demoBody` | `(lines, start, selfClosing?) => DemoBody \| null` | Collects a `{% demo %}` block's inline files. |
| `thumbnailLabel` | `(node: Inline) => string \| null` | The badge of a thumbnail image (`"thumbnail: 0:39.8"` → `"0:39.8"`), `""` for a plain thumbnail, `null` otherwise. Also on the root. |
| `stepTitleText` | `(nodes: Inline[]) => string` | A step's title text without its thumbnail images. |

</details>

## Assets

```ts
function setAssetBase(repo: string | null, branch: string | null, filePath: string | null): void
function resolveAsset(src: string): string
```

Resolves relative image paths against `raw.githubusercontent.com` for the file being rendered. The AST keeps the original `src`; only rendering resolves it.

```ts
setAssetBase("BLamy/docstream", "main", "docs/guide/intro.md")
resolveAsset("images/figure.png")
// "https://raw.githubusercontent.com/BLamy/docstream/main/docs/guide/images/figure.png"
resolveAsset("https://cdn.example.com/x.png") // absolute http(s):, data: and blob: pass through
setAssetBase(null, null, null)                 // clear
```

For per-document resolution (blob URLs of files opened from a folder, async lookups), wrap the renderer in `AssetResolverProvider` instead — see [Assets](../05-media/06-assets.md).

## See also

{% content-ref url="03-ast.md" %}
AST reference — every node type and field
{% endcontent-ref %}
