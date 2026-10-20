---
description: Everything CommonMark and GFM give you — headings, emphasis, links, lists, tables, images, quotes — and the few places docstream goes further.
---

# Markdown basics

Docstream starts from ordinary Markdown: if a file renders on GitHub, it renders here. Every example on this page is drawn by docstream itself, so what you see under **Preview** is exactly what your readers will see — flip any example to **Markdown** to read the source that made it. The tabs are synced, so one click flips every example on the page.

Want to try something right now? The playground below re-parses on every keystroke and shows whether your document survives a parse → serialize round trip unchanged.

{% demo src="writing-playground/editor" variants="basics:Basics,blocks:Blocks" %}

## Headings

`#` through `######` make ATX headings. Setext headings — a line underlined with `===` (level 1) or `---` (level 2) — work too, and keep their underline when the page is serialized again. A bare `##` with no text, which GitBook exports sometimes contain, parses without error and renders as an empty heading.

````md
# Page title
## Section
### Subsection
#### Detail

Also a page title
=================

Also a section
--------------
````

The headings on this page are the rendered result. Headings anywhere in the page — inside hints, tabs, steps, columns and expandables included — feed the page outline on the right.

{% hint style="info" %}
On this docs site the first `# heading` of a file is the page title. It's drawn in the page header with the `description` from the frontmatter beneath it, so the body starts at your first `##`.
{% endhint %}

## Emphasis and inline code

{% tabs sync="example" %}
{% tab title="Preview" %}
**Bold** and __bold__, *italic* and _italic_, ***both at once***, ~~strikethrough~~, and `inline code`. Emphasis nests: **bold with _italic_ inside**, and spans links and chips: **ask @brett** or *[read the source](https://github.com/BLamy/ui/tree/main/packages/docstream)*.

Code spans can hold backticks if you use more of them: ``a `tick` inside``.
{% endtab %}
{% tab title="Markdown" %}
````md
**Bold** and __bold__, *italic* and _italic_, ***both at once***, ~~strikethrough~~, and `inline code`. Emphasis nests: **bold with _italic_ inside**, and spans links and chips: **ask @brett** or *[read the source](https://github.com/BLamy/ui/tree/main/packages/docstream)*.

Code spans can hold backticks if you use more of them: ``a `tick` inside``.
````
{% endtab %}
{% endtabs %}

Docstream remembers how you spelled each marker — `__` versus `**`, `_` versus `*` — so a page that is parsed, edited and saved keeps its author's style.

## Links

Four ways to write a link, all rendered the same:

{% tabs sync="example" %}
{% tab title="Preview" %}
- Inline: [the docstream repo](https://github.com/BLamy/ui/tree/main/packages/docstream "Docstream on GitHub")
- Reference: [Pele][pele], collapsed [KaTeX][], and shortcut [GitBook]
- Bare autolink: https://blamy.github.io/ui/#/docstream
- Angle autolink: <https://www.npmjs.com/package/@brett_lamy/docstream>
- HTML: <a href="https://github.com/BLamy/ui/issues">open an issue</a>

[pele]: https://pele.run "Pele, the Mermaid renderer"
[katex]: https://katex.org
[gitbook]: https://gitbook.com
{% endtab %}
{% tab title="Markdown" %}
````md
- Inline: [the docstream repo](https://github.com/BLamy/ui/tree/main/packages/docstream "Docstream on GitHub")
- Reference: [Pele][pele], collapsed [KaTeX][], and shortcut [GitBook]
- Bare autolink: https://blamy.github.io/ui/#/docstream
- Angle autolink: <https://www.npmjs.com/package/@brett_lamy/docstream>
- HTML: <a href="https://github.com/BLamy/ui/issues">open an issue</a>

[pele]: https://pele.run "Pele, the Mermaid renderer"
[katex]: https://katex.org
[gitbook]: https://gitbook.com
````
{% endtab %}
{% endtabs %}

- **Reference definitions** (`[label]: url "title"`) can sit anywhere in the file and render nothing. Labels match case-insensitively; the first definition of a label wins.
- **Bare autolinks** need `http://` or `https://` and start at the beginning of a line, after whitespace, or after an emphasis marker. Trailing punctuation (`.`, `,`, `)` …) is left out of the link. `www.example.com` alone stays text.
- **Links between pages** use relative paths to the `.md` file — `[Callouts and tabs](02-callouts-and-tabs.md)` — and the docs site turns them into page links.

## Lists

{% tabs sync="example" %}
{% tab title="Preview" %}
{% columns %}
{% column %}
- Unordered items
- With nested content
  - a nested bullet
  - another one
    1. ordered inside
    2. and deeper
- Back at the top

* Asterisks work
+ and so do pluses
{% endcolumn %}
{% column %}
1. Ordered items
2. Count up
3. Can hold blocks:

   ```sh
   npm run build
   ```
{% endcolumn %}
{% endcolumns %}
{% endtab %}
{% tab title="Markdown" %}
````md
- Unordered items
- With nested content
  - a nested bullet
  - another one
    1. ordered inside
    2. and deeper
- Back at the top

* Asterisks work
+ and so do pluses

1. Ordered items
2. Count up
3. Can hold blocks:

   ```sh
   npm run build
   ```
````
{% endtab %}
{% endtabs %}

Ordered lists may also use `)` delimiters (`1)`, `2)`). A list item owns everything indented past its marker, so code fences, quotes and further lists can live inside one. Bullet characters, numbering, the space after the marker and the continuation indent all round-trip as written.

### Start numbers and list boundaries

An ordered list counts from its first number, and a change of bullet character (`-`, `*`, `+`) or ordered delimiter (`.`, `)`) starts a new list — both as in CommonMark:

{% tabs sync="example" %}
{% tab title="Preview" %}
{% columns %}
{% column %}
3. Picks up at three
4. then four
5. then five
{% endcolumn %}
{% column %}
- One list

* A second list
* (the bullet changed)

1. Steps
2. continue

1) New delimiter,
2) new list
{% endcolumn %}
{% endcolumns %}
{% endtab %}
{% tab title="Markdown" %}
```md
3. Picks up at three
4. then four
5. then five

- One list

* A second list
* (the bullet changed)

1. Steps
2. continue

1) New delimiter,
2) new list
```
{% endtab %}
{% endtabs %}

Items that keep the same bullet stay in one list across blank lines, and repeated numbers (`1.` `1.` `1.`) still count up when rendered.

## Task lists

GFM task lists, extended with six more states. `[ ]` and `[x]` behave as everywhere else; the others draw a distinct icon and a state-name tooltip (hover a box):

{% tabs sync="example" %}
{% tab title="Preview" %}
- [ ] Pending
- [~] In progress
- [?] Implemented — evidence needed
- [b] Blocked
- [d] Parked — verification debt
- [!] Refuted
- [x] Verified
- [-] Cancelled
{% endtab %}
{% tab title="Markdown" %}
````md
- [ ] Pending
- [~] In progress
- [?] Implemented — evidence needed
- [b] Blocked
- [d] Parked — verification debt
- [!] Refuted
- [x] Verified
- [-] Cancelled
````
{% endtab %}
{% endtabs %}

The states, their meanings, and how to make the boxes clickable are on [Properties and tasks](08-properties-and-tasks.md).

## Blockquotes

{% tabs sync="example" %}
{% tab title="Preview" %}
> A blockquote holds full block content.
>
> - lists,
> - `code`,
>
> > and nested quotes.
{% endtab %}
{% tab title="Markdown" %}
````md
> A blockquote holds full block content.
>
> - lists,
> - `code`,
>
> > and nested quotes.
````
{% endtab %}
{% endtabs %}

For a coloured callout with an icon, use a [hint](02-callouts-and-tabs.md#hints) instead.

## Tables

GFM pipe tables, with column alignment from the delimiter row:

{% tabs sync="example" %}
{% tab title="Preview" %}
| Left | Center | Right |
| :--- | :---: | ---: |
| `parseMarkdown` | markdown → AST | 1.2 ms |
| `serializeMarkdown` | AST → markdown | 0.4 ms |
| `a \| b` in code | escaped pipe \| in text | **bold** |
{% endtab %}
{% tab title="Markdown" %}
````md
| Left | Center | Right |
| :--- | :---: | ---: |
| `parseMarkdown` | markdown → AST | 1.2 ms |
| `serializeMarkdown` | AST → markdown | 0.4 ms |
| `a \| b` in code | escaped pipe \| in text | **bold** |
````
{% endtab %}
{% endtabs %}

- `:---` aligns left, `:---:` centres, `---:` aligns right.
- A pipe inside a cell needs a backslash (`\|`) — inside a code span too. Docstream also accepts a bare `|` inside a code span and remembers which you wrote.
- Cells hold inline Markdown only (emphasis, code, links, images, chips). For block content in a grid, use [columns](04-layout.md#columns) or [card tables](04-layout.md#card-tables).
- HTML `<table>` markup, as GitBook exports it, is parsed into the same table.

## Images

An image alone on its line becomes a **figure**. An image inside a sentence stays **inline** — handy for badges, optionally wrapped in a link:

{% tabs sync="example" %}
{% tab title="Preview" %}
![A docstream placeholder](https://placehold.co/960x300/e8e8f2/5b5bd6/png?text=docstream)

Inline badges: [![npm](https://img.shields.io/npm/v/%40brett_lamy%2Fdocstream)](https://www.npmjs.com/package/@brett_lamy/docstream) <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
{% endtab %}
{% tab title="Markdown" %}
````md
![A docstream placeholder](https://placehold.co/960x300/e8e8f2/5b5bd6/png?text=docstream)

Inline badges: [![npm](https://img.shields.io/npm/v/%40brett_lamy%2Fdocstream)](https://www.npmjs.com/package/@brett_lamy/docstream) <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license">
````
{% endtab %}
{% endtabs %}

Captions, `<figure>` and the GitBook figure export are on [Layout](04-layout.md#figures). Relative image paths go through the host's asset resolver — see [Assets](../05-media/06-assets.md).

### Thumbnails

Give an image a title that starts with `thumbnail` and it becomes a **thumbnail**: a small framed image that opens a card with the full image on hover or keyboard focus. Anything after `thumbnail:` is drawn as a badge — a timestamp, a step number, a size. Put the thumbnail first in a paragraph or list item and the text sets beside it:

{% tabs sync="example" %}
{% tab title="Preview" %}
![Console overview](https://placehold.co/1280x800/e8e8f2/5b5bd6/png?text=Overview "thumbnail: 0:39.8") The console **Overview** loads for the signed-in operator, and the ticker falls back to "Stats unavailable — retrying". Hover or focus the thumbnail for the full screenshot.

1. ![Settings](https://placehold.co/1280x800/f2ece8/d65b5b/png?text=Settings "thumbnail: 1:02.4") Opened **Settings → Billing**.
2. ![Saved](https://placehold.co/1280x800/e8f2ea/2f9e57/png?text=Saved "thumbnail: 1:10.0") Clicked **Save**; the toast confirmed.
3. A thumbnail mid-sentence ![tiny](https://placehold.co/400x250/png "thumbnail") stays inline, without the side-by-side layout.
{% endtab %}
{% tab title="Markdown" %}
````md
![Console overview](https://placehold.co/1280x800/e8e8f2/5b5bd6/png?text=Overview "thumbnail: 0:39.8") The console **Overview** loads for the signed-in operator, and the ticker falls back to "Stats unavailable — retrying". Hover or focus the thumbnail for the full screenshot.

1. ![Settings](https://placehold.co/1280x800/f2ece8/d65b5b/png?text=Settings "thumbnail: 1:02.4") Opened **Settings → Billing**.
2. ![Saved](https://placehold.co/1280x800/e8f2ea/2f9e57/png?text=Saved "thumbnail: 1:10.0") Clicked **Save**; the toast confirmed.
3. A thumbnail mid-sentence ![tiny](https://placehold.co/400x250/png "thumbnail") stays inline, without the side-by-side layout.
````
{% endtab %}
{% endtabs %}

| Title | Result |
| --- | --- |
| `"thumbnail"` | Thumbnail, no badge |
| `"thumbnail: 0:39.8"` | Thumbnail with a `0:39.8` badge (case-insensitive, spaces around `:` optional) |
| `"Build status"` (anything else) | An ordinary inline image; the title is a tooltip |

{% hint style="warning" %}
A thumbnail needs text on its line. An image **alone** on its line is a figure, whatever its title says.
{% endhint %}

Thumbnails also work in [stepper step headings](03-steppers.md#thumbnails-in-step-headings), where the image takes a column of its own.

## Dividers

Three or more `-`, `*` or `_` alone on a line draw a rule (and keep the exact marker you wrote):

````md
---
***
_____
````

---

Watch out for `---` straight under a line of text: that's a setext heading, not a divider. Leave a blank line above it.

## HTML

Docstream does not render arbitrary HTML — it understands the handful of tags that GitBook exports and READMEs rely on, and turns them into the same blocks as their Markdown spellings:

| HTML | Becomes |
| --- | --- |
| `<details>` + `<summary>` | An [expandable](02-callouts-and-tabs.md#expandables) |
| `<table>` / `<table data-view="cards">` | A table / a [card grid](04-layout.md#card-tables) |
| `<figure><img><figcaption>` | A [figure](04-layout.md#figures) with a caption |
| `<img>` alone on a line | A figure |
| `<img>` in a sentence, optionally in `<a href>` | An inline image (badges) |
| `<a href="…">text</a>` | A link |

Other tags (`<div>`, `<kbd>`, `<br>`, `<script>` …) are not interpreted: they show as the literal text you wrote, so nothing in a document can inject markup into your page.

## Escaping

A backslash before any ASCII punctuation character makes it literal: \*not italic\*, \_not italic\_, \`not code\`, \[not a link\](url), \@not-a-mention, \#not-a-tag. The serializer keeps your escapes even where they aren't strictly needed.

````md
\*not italic\*, \_not italic\_, \`not code\`, \[not a link\](url), \@not-a-mention, \#not-a-tag
````

Inside a code span or a fence nothing needs escaping — that's why every `{% tag %}` shown on these pages is safe inside backticks. To print a docstream tag as text in a paragraph, put it in a code span: a line that *starts* with an unrecognized `{% tag %}` is kept in the source but renders nothing.

## Mentions, tags and citations

Write `@name`, `#tag` or `$org/repo` at a word boundary and docstream renders a chip. Footnote markers like `[^1]` become source badges:

{% tabs sync="example" %}
{% tab title="Preview" %}
Ask @brett to review the #streaming changes in $BLamy/docstream before Friday. Emails like brett@example.com, `C#` and prices like $5 stay plain text.
{% endtab %}
{% tab title="Markdown" %}
````md
Ask @brett to review the #streaming changes in $BLamy/docstream before Friday. Emails like brett@example.com, `C#` and prices like $5 stay plain text.
````
{% endtab %}
{% endtabs %}

Chip ids start with a letter or `_`, then letters, digits, `.`, `-` and `_` (codebase ids may also contain `/`). The host decides what a click does. Chips, hover cards and citations are covered in depth on [References and citations](../06-ai/02-references-and-citations.md).

{% hint style="warning" %}
That boundary rule applies to npm scopes too: in running text `@brett_lamy/docstream` would start a mention chip. Put package names in a code span.
{% endhint %}

## Next

{% content-ref url="02-callouts-and-tabs.md" %}
Callouts and tabs — hints, tab sets, synced tabs, section tabs and expandables
{% endcontent-ref %}
