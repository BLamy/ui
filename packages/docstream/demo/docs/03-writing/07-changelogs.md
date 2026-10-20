---
description: Release notes as a dated timeline — every entry a full document, with code, hints and images.
---

# Changelogs

`{% updates %}` lays out release notes as a timeline: the date in a narrow column on the left, the entry beside it, a rule between entries. Each `{% update %}` is a full document, so an entry can carry a migration snippet, a breaking-change warning or a screenshot alongside its bullet points.

## The shape

{% tabs sync="example" %}
{% tab title="Preview" %}
{% updates %}
{% update date="2026-08-01" %}
**Added** — theming tokens with built-in defaults.
{% endupdate %}
{% update date="2026-07-15" %}
**Fixed** — nested list indentation in the serializer.
{% endupdate %}
{% endupdates %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% updates %}
{% update date="2026-08-01" %}
**Added** — theming tokens with built-in defaults.
{% endupdate %}
{% update date="2026-07-15" %}
**Fixed** — nested list indentation in the serializer.
{% endupdate %}
{% endupdates %}
````
{% endtab %}
{% endtabs %}

| Tag | Attribute | Meaning |
| --- | --- | --- |
| `{% updates %}` | `format` | Kept for GitBook compatibility (`format="full"`, …) and written back unchanged; docstream draws every format the same way. |
| `{% update %}` | `date` | The entry's date, shown **verbatim** — `2026-08-01`, `Aug 1, 2026` and `v1.18 · Oct 2026` all work. |

- Entries render in the order you write them — put the newest first. Nothing is sorted or reformatted.
- Lines between entries that aren't inside an `{% update %}` are ignored.
- Headings inside an entry render as headings but stay out of the page outline, so a long changelog doesn't flood the table of contents.

## A real changelog

Docstream's own recent releases, written the way we recommend: newest first, ISO dates, a version heading, and each line led by a bold verb.

{% tabs sync="example" %}
{% tab title="Preview" %}
{% updates %}
{% update date="2026-10-20" %}
### 1.18.0

**Added** — thumbnail images. An image whose title starts with `thumbnail` renders as a small framed image with an optional badge, opening a hover card with the full image. First in a paragraph or list item, the text runs beside it; first in a step heading, it takes a column.

```md
![Overview](shots/overview.png "thumbnail: 0:39.8") The console loads.
```

**Fixed** (1.18.1) — a step's body starts at the top, so untitled steps line up with their numbers.
{% endupdate %}
{% update date="2026-10-20" %}
### 1.17.0

**Added** — `.rrweb` recordings in `{% embed %}` play in the replay player, fetched only when scrolled near.

**Changed** — the replay URL bar leads with path, query and hash.
{% endupdate %}
{% update date="2026-10-17" %}
### 1.16.0

**Added** — math blocks are source-and-result cards like Mermaid's: TeX beside KaTeX, stacked when narrow. `SplitCard`, `SplitSource` and `SplitResult` are exported; `MathFormula` followed in 1.16.1.

**Fixed** (1.16.2) — Pele and card colours fall back when a host lacks docstream's hover and panel tokens.
{% endupdate %}
{% update date="2026-10-17" %}
### 1.15.0

**Added** — Mermaid diagrams drawn by Pele: source and drawing side by side, **Open in Playground**, render time.

{% hint style="info" %}
`collapsedCodeLines` / `expandedCodeLines` on mermaid fences are still accepted but no longer do anything — the source pane always shows the whole diagram.
{% endhint %}
{% endupdate %}
{% update date="2026-10-17" %}
### 1.14.0

**Added** — `AssetResolverProvider` and `useAsset`: hosts resolve images, STL models and Strudel files from wherever they live.
{% endupdate %}
{% update date="2026-10-16" %}
### 1.10.0 – 1.13.2

**Added** — STL model viewer and Strudel music player embeds; a full syntax tree for Strudel's mini-notation; a skeuomorphic equipment rack with a masonry layout you can drag and resize.
{% endupdate %}
{% update date="2026-10-15" %}
### 1.9.0

**Added** — YAML frontmatter as document properties, and eight task states, from `[ ]` pending through `[?]` implemented to `[x]` verified:

- [~] Each state has its own icon
- [?] and a state-name tooltip

See [Properties and tasks](08-properties-and-tasks.md).
{% endupdate %}
{% endupdates %}
{% endtab %}
{% tab title="Markdown" %}
````md
{% updates %}
{% update date="2026-10-20" %}
### 1.18.0

**Added** — thumbnail images. An image whose title starts with `thumbnail` renders as a small framed image with an optional badge, opening a hover card with the full image. First in a paragraph or list item, the text runs beside it; first in a step heading, it takes a column.

```md
![Overview](shots/overview.png "thumbnail: 0:39.8") The console loads.
```

**Fixed** (1.18.1) — a step's body starts at the top, so untitled steps line up with their numbers.
{% endupdate %}
{% update date="2026-10-20" %}
### 1.17.0

**Added** — `.rrweb` recordings in `{% embed %}` play in the replay player, fetched only when scrolled near.

**Changed** — the replay URL bar leads with path, query and hash.
{% endupdate %}
{% update date="2026-10-17" %}
### 1.16.0

**Added** — math blocks are source-and-result cards like Mermaid's: TeX beside KaTeX, stacked when narrow. `SplitCard`, `SplitSource` and `SplitResult` are exported; `MathFormula` followed in 1.16.1.

**Fixed** (1.16.2) — Pele and card colours fall back when a host lacks docstream's hover and panel tokens.
{% endupdate %}
{% update date="2026-10-17" %}
### 1.15.0

**Added** — Mermaid diagrams drawn by Pele: source and drawing side by side, **Open in Playground**, render time.

{% hint style="info" %}
`collapsedCodeLines` / `expandedCodeLines` on mermaid fences are still accepted but no longer do anything — the source pane always shows the whole diagram.
{% endhint %}
{% endupdate %}
{% update date="2026-10-17" %}
### 1.14.0

**Added** — `AssetResolverProvider` and `useAsset`: hosts resolve images, STL models and Strudel files from wherever they live.
{% endupdate %}
{% update date="2026-10-16" %}
### 1.10.0 – 1.13.2

**Added** — STL model viewer and Strudel music player embeds; a full syntax tree for Strudel's mini-notation; a skeuomorphic equipment rack with a masonry layout you can drag and resize.
{% endupdate %}
{% update date="2026-10-15" %}
### 1.9.0

**Added** — YAML frontmatter as document properties, and eight task states, from `[ ]` pending through `[?]` implemented to `[x]` verified:

- [~] Each state has its own icon
- [?] and a state-name tooltip

See [Properties and tasks](08-properties-and-tasks.md).
{% endupdate %}
{% endupdates %}
````
{% endtab %}
{% endtabs %}

## Writing good entries

{% columns %}
{% column %}
**Lead with the verb.** Readers scan a changelog for what affects them:

| Verb | Use for |
| --- | --- |
| **Added** | New features, blocks, props |
| **Changed** | Behaviour that works differently |
| **Fixed** | Bugs |
| **Deprecated** | Still works; will go |
| **Removed** | Gone |
| **Breaking** | Requires a change from the reader |
{% endcolumn %}
{% column %}
**Show the migration.** A breaking entry earns a `danger` hint and the before / after:

{% hint style="danger" %}
**Breaking** — `Streamdown` is no longer re-exported. Install `streamdown` and import it from there.
{% endhint %}

```diff
- import { Streamdown } from "@brett_lamy/docstream"
+ import { Streamdown } from "streamdown"
```
{% endcolumn %}
{% endcolumns %}

- Use ISO dates (`2026-10-20`): they sort, and they read the same everywhere.
- One `{% update %}` per release. Patch releases can fold into their minor's entry, as above.
- Link to the page that documents a feature rather than re-explaining it in the changelog.

## Next

{% content-ref url="08-properties-and-tasks.md" %}
Properties and tasks — YAML frontmatter as a property sheet, and eight task states
{% endcontent-ref %}
