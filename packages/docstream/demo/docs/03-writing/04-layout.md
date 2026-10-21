---
description: Side-by-side columns, card grids for overviews, link cards for "see also", file cards, and captioned figures.
---

# Layout

Markdown is a single column of text. These blocks break out of it: **columns** put content side by side, **card tables** lay out a grid, **content refs** and **files** turn a link into a card, and **figures** give images a frame and a caption.

## Columns

`{% columns %}` holds two or more `{% column %}` blocks of equal width. Each column is a full document.

{% tabs sync="example" %}
{% tab title="Preview" %}
{% columns %}
{% column %}
{% hint style="success" %}
**Do** — keep each demo in its own example folder, so the code readers see is the file that runs.
{% endhint %}
{% endcolumn %}
{% column %}
{% hint style="danger" %}
**Don't** — paste a component's source into the page, where it drifts from the real file.
{% endhint %}
{% endcolumn %}
{% endcolumns %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% columns %}
{% column %}
{% hint style="success" %}
**Do** — keep each demo in its own example folder, so the code readers see is the file that runs.
{% endhint %}
{% endcolumn %}
{% column %}
{% hint style="danger" %}
**Don't** — paste a component's source into the page, where it drifts from the real file.
{% endhint %}
{% endcolumn %}
{% endcolumns %}
````
{% endtab %}
{% endtabs %}

Columns shine for code beside its explanation, and for before / after:

{% tabs sync="example" %}
{% tab title="Preview" %}
{% columns %}
{% column %}
**Before** — four hand-written tabs to keep in step:

```md
{% tabs sync="pm" %}
{% tab title="npm" %}
…
{% endtabs %}
```
{% endcolumn %}
{% column %}
**After** — one line; pnpm, yarn and bun are derived:

```md
{% command %}npm install x{% endcommand %}
```
{% endcolumn %}
{% column %}
**Result**

{% command %}npm install @brett_lamy/docstream{% endcommand %}
{% endcolumn %}
{% endcolumns %}
{% endtab %}
{% tab title="Markdown" %}
`````md
{% columns %}
{% column %}
**Before** — four hand-written tabs to keep in step:

```md
{% tabs sync="pm" %}
{% tab title="npm" %}
…
{% endtabs %}
```
{% endcolumn %}
{% column %}
**After** — one line; pnpm, yarn and bun are derived:

```md
{% command %}npm install x{% endcommand %}
```
{% endcolumn %}
{% column %}
**Result**

{% command %}npm install @brett_lamy/docstream{% endcommand %}
{% endcolumn %}
{% endcolumns %}
`````
{% endtab %}
{% endtabs %}

- Neither tag takes attributes; widths are always equal.
- Columns stay side by side at every page width, so keep them to two or three, with short content. For a grid that reflows, use a card table.
- Lines between columns that aren't inside a `{% column %}` are ignored.

## Card tables

GitBook stores card grids as an HTML table with `data-view="cards"`. Docstream renders each **row** as a card: the first cell is the card's title, every other cell a line of body text. The grid reflows to the page width.

{% tabs sync="example" %}
{% tab title="Preview" %}
<table data-view="cards"><thead><tr><th></th><th></th><th></th></tr></thead><tbody>
<tr><td><strong>Parser</strong></td><td>Markdown → block AST, streaming-safe</td><td><code>parseMarkdown</code></td></tr>
<tr><td><strong>Renderer</strong></td><td>AST → React, every GitBook block</td><td><code>DocsRenderer</code></td></tr>
<tr><td><strong>Serializer</strong></td><td>AST → Markdown, byte-for-byte</td><td><code>serializeMarkdown</code></td></tr>
<tr><td><strong>Demos</strong></td><td>Live React from real files</td><td><a href="../04-interactive/01-demos.md">Read more</a></td></tr>
</tbody></table>
{% endtab %}
{% tab title="Markdown" %}
````md
<table data-view="cards"><thead><tr><th></th><th></th><th></th></tr></thead><tbody>
<tr><td><strong>Parser</strong></td><td>Markdown → block AST, streaming-safe</td><td><code>parseMarkdown</code></td></tr>
<tr><td><strong>Renderer</strong></td><td>AST → React, every GitBook block</td><td><code>DocsRenderer</code></td></tr>
<tr><td><strong>Serializer</strong></td><td>AST → Markdown, byte-for-byte</td><td><code>serializeMarkdown</code></td></tr>
<tr><td><strong>Demos</strong></td><td>Live React from real files</td><td><a href="../04-interactive/01-demos.md">Read more</a></td></tr>
</tbody></table>
````
{% endtab %}
{% endtabs %}

What a cell may contain:

| In a cell | Rendered |
| --- | --- |
| `<strong>` / `<b>`, `<em>` / `<i>`, `<code>` | Bold, italic, code |
| `<a href="…">` | A link inside the card |
| `**Markdown**` written directly | Parsed as inline Markdown too |
| `<br>` | A space |
| Any other tag — `<img>`, `<p>`, `<span>` … | Removed; its text is kept |

{% hint style="warning" %}
Always write the `<thead>` row, even with empty cells: the **first** `<tr>` is the header, and only the rows after it become cards. Cover images (GitBook's `data-card-cover`) and whole-card targets (`data-card-target`) aren't drawn — put a link in a cell instead.
{% endhint %}

The table may span lines, as above, or sit on one. An HTML table **without** `data-view="cards"` renders as an ordinary table. For tabular data you write by hand, GFM [pipe tables](01-markdown-basics.md#tables) are easier to read.

## Content refs

`{% content-ref url="…" %}` turns a link into a full-width card. The body is the card's text (inline Markdown). Use them for "Next" and "See also" instead of a bare list of links:

{% tabs sync="example" %}
{% tab title="Preview" %}
{% content-ref url="05-code.md" %}
**Code** — fences, titles, line numbers and install commands
{% endcontent-ref %}

{% content-ref url="https://github.com/BLamy/ui/tree/main/packages/docstream" %}
The docstream repository on GitHub
{% endcontent-ref %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% content-ref url="05-code.md" %}
**Code** — fences, titles, line numbers and install commands
{% endcontent-ref %}

{% content-ref url="https://github.com/BLamy/ui/tree/main/packages/docstream" %}
The docstream repository on GitHub
{% endcontent-ref %}
````
{% endtab %}
{% endtabs %}

The body may wrap over several lines; they're joined with spaces. A relative `.md` URL links to that page of the docs site.

## Files

GitBook's `{% file %}` block — a downloadable attachment — renders with the same card chrome. It's a single tag with no end tag: `src` is the link, `caption` the card's text (without a caption, the card shows the `src`).

{% tabs sync="example" %}
{% tab title="Preview" %}
{% file src="https://raw.githubusercontent.com/BLamy/docstream/main/README.md" caption="README.md — the package overview" %}

{% file src="https://raw.githubusercontent.com/BLamy/docstream/main/package.json" %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% file src="https://raw.githubusercontent.com/BLamy/docstream/main/README.md" caption="README.md — the package overview" %}

{% file src="https://raw.githubusercontent.com/BLamy/docstream/main/package.json" %}
````
{% endtab %}
{% endtabs %}

{% hint style="info" %}
Newer GitBook exports write the caption as a body — `{% file src="…" %}caption{% endfile %}`. Docstream reads only the `caption` attribute, so move the text there.
{% endhint %}

## Figures

Three spellings make a figure — an image in a rounded frame, centred, with an optional caption:

{% tabs sync="example" %}
{% tab title="Preview" %}
![An image alone on its line](https://placehold.co/960x280/e8e8f2/5b5bd6/png?text=Markdown+image)

<img src="https://placehold.co/960x280/f2ece8/d65b5b/png?text=HTML+img" alt="An HTML img alone on its line">

<figure><img src="https://placehold.co/960x280/e8f2ea/2f9e57/png?text=figure+%2B+figcaption" alt="A GitBook figure"><figcaption><p>GitBook's figure export — the only form with a caption</p></figcaption></figure>
{% endtab %}
{% tab title="Markdown" %}
````md
![An image alone on its line](https://placehold.co/960x280/e8e8f2/5b5bd6/png?text=Markdown+image)

<img src="https://placehold.co/960x280/f2ece8/d65b5b/png?text=HTML+img" alt="An HTML img alone on its line">

<figure><img src="https://placehold.co/960x280/e8f2ea/2f9e57/png?text=figure+%2B+figcaption" alt="A GitBook figure"><figcaption><p>GitBook's figure export — the only form with a caption</p></figcaption></figure>
````
{% endtab %}
{% endtabs %}

| Form | Caption | Notes |
| --- | --- | --- |
| `![alt](src)` alone on a line | — | An optional `"title"` is kept in the source. |
| `<img src="…" alt="…">` alone on a line | — | GitBook drawings export this way. |
| `<figure><img …><figcaption>…</figcaption></figure>` | Plain text from `<figcaption>` (its `<p>` is unwrapped) | May span several lines. |

- Each form keeps its own spelling when the page is serialized, until you change the figure.
- A relative `src` goes through the host's asset resolver (`AssetResolverProvider`, or `setAssetBase` for a static base URL) — see [Assets](../05-media/06-assets.md).
- An image **inside** a sentence is inline instead (badges); an image whose title starts with `thumbnail` followed by text is a [thumbnail](01-markdown-basics.md#thumbnails).

## Dividers

`---`, `***` or `___` alone on a line draws a horizontal rule — see [Markdown basics](01-markdown-basics.md#dividers). Use one to separate a page's reference material from its walkthrough; use a heading when the next part deserves a name.

## See also

{% columns %}
{% column %}
{% content-ref url="../05-media/01-embeds-and-video.md" %}
Embeds and video — YouTube, MP4, link cards
{% endcontent-ref %}
{% endcolumn %}
{% column %}
{% content-ref url="05-code.md" %}
Next: Code — fences, titles and install boxes
{% endcontent-ref %}
{% endcolumn %}
{% endcolumns %}
