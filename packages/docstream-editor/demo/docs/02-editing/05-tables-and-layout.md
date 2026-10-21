---
description: How the editor handles tables, card tables, hints, tabs, steppers, columns, expandables, page links, embeds and changelogs, and what you edit on each.
---

# Tables and layout

GitBook's layout blocks are containers: a hint, a tab, a step or a column holds ordinary blocks, and you type in it like anywhere else. What the editor adds is the block's own controls: a style picker, title fields, `+` and `×` buttons, a date picker. Each control writes the matching attribute in the Markdown.

{% demo src="editing-layout/editor" %}

| Block | Insert with | Controls on the block | Body |
| --- | --- | --- | --- |
| Table | `/table` | Tab / Shift+Tab between cells; Tab in the last cell adds a row | Inline content per cell |
| Card table | Markdown only | None (edited as a table) | Inline content per cell |
| Hint | `/hint` | Style picker: info, success, warning, danger | Any blocks |
| Tabs | `/tabs` | Click to switch, rename the active tab, `+` add, `×` remove, heading button for a section title | Any blocks per tab |
| Stepper | `/stepper` | A title field per step; numbers follow the order | Any blocks per step |
| Columns | `/columns` | None | Any blocks per column |
| Expandable | `/expandable` | Summary field | Any blocks |
| Page link | `/page` | Label and URL fields | — |
| Embed | `/embed` | URL field (+ **Choose file…** / **Upload…** when the host provides them) | — |
| Updates | `/updates` | A date picker per update | Any blocks per update |
| OpenAPI operation | `/openapi` | Spec, method, path and spec URL fields | — |

## Tables

GFM tables are edited cell by cell. `Tab` moves to the next cell and `Shift`+`Tab` to the previous one. `Tab` in the last cell adds a row. `/table` inserts a 2 × 2 table with a header row.

{% demo src="editing-layout/editor" variants="tables:Tables" %}

- **Column alignment is kept.** `:--`, `:-:` and `--:` survive edits, and so do escaped pipes (`\|`) in cells.
- **Cells hold inline content**: text, marks, links, inline code, chips and inline images.
- Selecting every cell and pressing `Backspace` or `Delete` removes the table.
- There are no buttons for adding or removing columns. The TipTap table commands (`addColumnAfter`, `deleteColumn`, `addRowBefore`, `deleteRow`, `mergeCells`, …) are available on the editor from `onEditorReady`, if you want to add your own.

{% hint style="info" %}
A Markdown table cell is a single line. If you press `Enter` (or insert a line break) inside a cell, the text you type is kept, but it saves joined to the cell's line with a space. Use `Tab` to move to the next cell.
{% endhint %}

### Card tables

`<table data-view="cards">` is GitBook's card grid. The editor edits it as an ordinary table: the first cell of each row is the card title. The `data-view` attribute and the table's HTML form are carried through untouched (`GbTable` keeps `view`), so the page still renders cards. See docstream's [Layout](https://blamy.github.io/ui/#/docstream/writing/layout) page for how cards render.

## Hints

The gutter holds the hint's icon and a style picker. Change the style and the tag's `style=` changes with it. The body is a full document: lists, code, tables, even other hints. `/hint` inserts an `info` hint.

{% demo src="editing-layout/editor" variants="hints:Hints" %}

A style docstream doesn't know (a typo, or GitBook's older `tip`) shows as `info` in the picker, and its tag is written back exactly as it was until you pick a new style.

## Tabs

The tab strip is live: click a tab to show it, type in the active tab's title to rename it, `+` adds a tab, and `×` removes one (a set always keeps at least one). `/tabs` inserts a set with **First tab** and **Second tab**.

{% demo src="editing-layout/editor" variants="tabs:Tabs" %}

- **Section tabs.** The heading button in the strip gives the set a title, `{% tabs title="Usage" %}`. The editor then draws it as docstream does: a real heading with the tabs as pills beside it, plus an **H2 / H3 / H4** picker that writes `level="3"`. Clear the title to turn it back into plain tabs.
- **Sync keys.** `{% tabs sync="pm" %}` is kept as written. There's no control for it, and readers' choices sync on the published page.
- Which tab is showing in the editor is editor state only. It is never saved.

See docstream's [Callouts and tabs](https://blamy.github.io/ui/#/docstream/writing/callouts-and-tabs) page for how tabs collapse, sync and become sections.

## Steppers

Each step is numbered from its position. Its title is a field in the step's header, written back as the step's first heading (`### Title`). Below it, the step's body holds any blocks. A step whose heading starts with a thumbnail image keeps the thumbnail when you retitle it. `/stepper` inserts two steps.

{% demo src="editing-layout/editor" variants="steppers:Steppers" %}

To add or remove a step, edit the Markdown: copy a `{% step %}` … `{% endstep %}` block. There are no step buttons yet.

## Columns and expandables

Columns sit side by side in the editor as on the page, each a full document. `/columns` inserts two. A `{% columns %}` block needs at least two columns, and more can be written in the Markdown. Expandables (`<details>`) have their summary as a field in the header, and their body below. In the editor an expandable is always open, so you can edit its body.

{% demo src="editing-layout/editor" variants="columns:Columns" %}

## Page links and embeds

A page link (`{% content-ref %}`) is a card with two fields: the label and the URL, which can be a relative `.md` path or a full URL. A label written as a link to the page (GitBook's form, `[Slash menu](02-slash-menu.md)`) stays a link. A label with formatting keeps it until you retype it.

An embed is its preview with a URL field below:

| URL | Preview in the editor |
| --- | --- |
| YouTube (`youtube.com/watch?v=…`, `youtu.be/…`) | A player |
| `.mp4`, `.webm`, `.ogg` | A native video player (with `autoplay`, `loop`, `muted`, `controls`, `poster` from the tag) |
| A Replay / Loop QA session | docstream's replay player |
| `.rrweb`, `.stl`, `.strudel` files | docstream's replay, 3-D model and music players, through the host's asset resolver |
| Anything else | A link card |

{% demo src="editing-layout/editor" variants="links:Links & embeds" %}

`title`, `poster` and the playback flags are kept as written. Hosts that pass `pickFile` or `uploadFile` get **Choose file…** and **Upload…** buttons on every embed, and dropped files can become embeds. That is covered in [Host files](../03-files-and-demos/02-host-files.md).

## Changelogs

`{% updates %}` holds one `{% update date="…" %}` per entry. Each update has a date picker and a body of ordinary blocks. `/updates` inserts one dated today, with a **What changed** heading. `format=` is kept. See docstream's [Changelogs](https://blamy.github.io/ui/#/docstream/writing/changelogs) page.

{% demo src="editing-layout/editor" variants="updates:Updates" %}

## OpenAPI operations

`{% openapi-operation %}` shows docstream's rendered operation (method, parameters, responses, a cURL sample) with four fields above it: spec name, method, path and spec URL. The operation reloads when the URL or path changes. `/openapi` inserts one for `GET /`. See docstream's [OpenAPI](https://blamy.github.io/ui/#/docstream/media/openapi) page.

## Next

{% content-ref url="06-properties-and-tasks.md" %}
[Properties and tasks](06-properties-and-tasks.md)
{% endcontent-ref %}
