---
description: Footnote citations with source chips and hover previews, plus @mention, #tag and $codebase chips your app can handle or render its own way.
---

# References and citations

Inline reference chips and footnote-style citations turn plain streamed text into a **sourced answer**. Everything on this page renders from this page's own Markdown — hover the badges.

## Citations

Cite sources GitBook-footnote style: a marker like [^1] in the prose, and a definition line anywhere in the document. Markers render as superscript badges linking to the source [^1], and every defined source appears in the chip row at the bottom of the document [^2]. A source without a preview resolver still gets its favicon and hostname [^3].

```md title="answer.md"
Pistachio is up 18% quarter over quarter [^1].

[^1]: https://scoopdata.io/q3 "ScoopData Q3 report"
[^2]: https://trends.google.com/ice-cream "Google Trends"
```

- **A definition** is one line: `[^id]: url`, optionally followed by `"Label"`. Ids can be any characters except whitespace and `]` — `[^1]`, `[^scoop]`.
- **Placement is free**. Definitions are collected from the whole document before parsing, so a marker can precede its definition. Definitions that end the document are kept together as a group, and serialize back the same way.
- **Definitions inside code fences** are content, not definitions (which is why the example above doesn't add sources to this page).
- **Always give a label** — it is the preview card's fallback title and the source chip's tooltip.

{% hint style="info" %}
Definitions can stream in after the markers. A marker without a definition renders as a plain badge, and picks up its link once the definition arrives.
{% endhint %}

## Preview cards

Give `DocstreamRefContext` a `resolveCitationPreview` and each linked citation gets an Open Graph-style hover card — image, site name, title, description and URL. The resolver runs lazily, the first time a citation is hovered or keyboard-focused, and results are cached by URL (failures resolve to no preview). This site supplies previews for two hosts:

```tsx title="main.tsx"
import { DocstreamRefContext, type CitationPreviewResolver } from "@brett_lamy/docstream"

const citationPreviews: CitationPreviewResolver = (citation) => {
  if (citation.url?.includes("trends.google.com")) {
    return {
      title: "Explore what the world is searching",
      description: "Compare search interest for ice cream flavors across regions and time ranges.",
      siteName: "Google Trends",
      image: "https://ssl.gstatic.com/trends_nrtr/4116_RC01/embed_loader.gif",
    }
  }
  if (citation.url?.includes("scoopdata.io")) {
    return { title: citation.label ?? "ScoopData Q3 report", siteName: "ScoopData", description: "…", image: "…" }
  }
  return null // no card data: the badge still shows hostname and favicon
}

<DocstreamRefContext.Provider value={{ resolveCitationPreview: citationPreviews }}>
  <MarkdownContent markdown={page} />
</DocstreamRefContext.Provider>
```

In production, resolve metadata through your own server or a build-time index, so cross-origin pages don't depend on browser CORS:

```tsx
<DocstreamRefContext.Provider value={{
  resolveCitationPreview: async (citation) =>
    fetch(`/api/link-preview?url=${encodeURIComponent(citation.url!)}`).then((r) => r.json()),
}}>
```

| `CitationPreview` field | Shown as |
| --- | --- |
| `image` | Card image (hidden if it fails to load). |
| `siteName` | Source line, next to the favicon. Defaults to the hostname. |
| `favicon` | Defaults to Google's favicon service for the hostname. |
| `title` | Card title. Defaults to the definition's label, then the hostname. |
| `description` | Card body. |

## Mentions, tags and codebases

Write \@name, \#tag or \$org/repo mid-sentence and docstream renders a clickable chip — ask @brett to review the #seasonal numbers with @dana, and file them in $blamy/docstream.

| Sigil | Kind | Id characters |
| --- | --- | --- |
| `@` | `mention` | Starts with a letter or `_`, then letters, digits, `.`, `-`, `_` |
| `#` | `tag` | Same as mentions |
| `$` | `codebase` | Same, plus `/` (`$org/repo`) |

- Chips are recognized only at a **word boundary** — start of text, after whitespace, an opening bracket, or an emphasis marker — so brett@replay.io and C# stay plain text.
- A letter start keeps prices plain: $5 is not a chip.
- Trailing `.`, `/` or `-` is dropped from the id, so a chip can end a sentence: thanks, @dana.
- Escape the sigil with a backslash (`\@name`) to keep it literal.

## Handling clicks and custom chips

`DocstreamRefContext` takes three optional handlers:

| Field | Signature | Purpose |
| --- | --- | --- |
| `onReferenceClick` | `(ref: ReferenceNode) => void` | Called for chip clicks, and for citation badges (linked or not). |
| `renderReference` | `(ref: ReferenceNode) => ReactNode \| null` | Replace any chip or badge; return `null` to keep the default. |
| `resolveCitationPreview` | `CitationPreviewResolver` | Hover cards, above. |

`ReferenceNode` is `{ type: "reference", kind: "mention" | "tag" | "codebase" | "citation", id, url?, label? }`. Try both variants — the second adds a `renderReference` that turns mentions into avatar chips and returns `null` for everything else:

{% demo src="ai-references/chip-events" %}

```tsx title="Answer.tsx"
import { useContext } from "react"
import { DocstreamRefContext, GitbookStreamdown } from "@brett_lamy/docstream"

function Answer({ md }: { md: string }) {
  const outer = useContext(DocstreamRefContext) // keep the host's citation previews
  return (
    <DocstreamRefContext.Provider value={{
      ...outer,
      onReferenceClick: (ref) => openPanel(ref.kind, ref.id),
      renderReference: (ref) => (ref.kind === "mention" ? <Avatar user={ref.id} /> : null),
    }}>
      <GitbookStreamdown markdown={md} />
    </DocstreamRefContext.Provider>
  )
}
```

{% hint style="warning" %}
A nested provider replaces the outer value entirely. Spread the outer context (as above) when you only want to add a handler.
{% endhint %}

## Streaming behavior

While `isStreaming` is set, a half-arrived `[^1`, `@bre` or `#seas` at the end of the buffer is held back by `trimPartialInlineToken`, so chips never flash as plain text or change id mid-stream. See [Streaming](01-streaming.md#trimpartialinlinetoken) for it live.

## Building blocks

| Export | Purpose |
| --- | --- |
| `DocstreamRefContext` | The context above (also exported from `@brett_lamy/docstream/streamdown` and `/reference`). |
| `InlineReference` | Renders one `ReferenceNode` with the context's handlers. |
| `CitationSources` | The chip row for a document's `citations` (`{ citations?: CitationDef[] }`). |
| `footnoteDefinitions` | The citation definitions of the most recent parse, by id. |
| `serializeReference` | A `ReferenceNode` back to Markdown (`[^1]`, `@brett`, `$org/repo`). |

[^1]: https://scoopdata.io/q3 "ScoopData Q3 report"
[^2]: https://trends.google.com/ice-cream "Google Trends"
[^3]: https://marketbasket.io/flavors "Market Basket"
