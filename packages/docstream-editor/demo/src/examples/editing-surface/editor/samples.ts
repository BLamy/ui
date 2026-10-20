import type { Sample } from "./Workbench"

const BLOCKS = `# Release checklist

Everything a page usually needs is a **plain block** in the editor: headings, paragraphs, lists, quotes, code, tables and dividers.

## Before the release

1. Bump the version in \`package.json\`
2. Run the full suite
   - unit tests
   - the visual baselines
3. Tag the commit

- [x] Changelog written
- [ ] Docs updated

> Ship small, ship often. A quote can hold **formatting** and [links](https://blamy.github.io/docstream/).

\`\`\`sh
npm version minor && git push --follow-tags
\`\`\`

| Package | Version | Notes |
| :-- | :-: | --: |
| docstream | 1.19.0 | renderer |
| docstream-editor | 1.19.0 | this editor |

---

Type \`/\` on an empty line for every other block.
`

const INLINE = `# Inline formatting

**Bold**, _italic_, ~~strike~~, \`inline code\` and [a link](https://tiptap.dev) — and every combination: ***bold italic***, **_also bold italic_**, ~~**struck bold**~~.

Inline code mixes with the rest: [\`@brett_lamy/docstream\`](https://www.npmjs.com/package/@brett_lamy/docstream), **bold \`code\` inside**, _italic \`code\` too_.

A link inside emphasis, **[x](https://example.com)**, stays distinct from emphasis inside a link, [**x**](https://example.com).

Spellings survive: *star italic*, __underscore bold__, \`\`code with a \` backtick\`\`, an escaped snake\\_case\\_name, a bare URL https://example.com and an autolink <https://example.com>.

Reference-style links resolve through their definition: [the docstream site][docs].

[docs]: https://blamy.github.io/docstream/ "docstream"
`

const PRESERVED = `# Kept as written

The editor has no control for some Markdown, and **loses none of it**. Edit the paragraphs around these blocks and watch the Markdown: they come back byte for byte.

{% my-custom-widget id="42" %}

A raw HTML block:

<div align="center">
  <img src="https://img.shields.io/badge/docs-docstream-5b5bd6" alt="docs badge">
</div>

> [!NOTE]
> A GitHub alert is a blockquote to the editor.

Inline HTML and other dialects ride along as text: <kbd>⌘</kbd> + <kbd>K</kbd>, ==highlight==, H~2~O.

Odd   spacing,  *stars* and   [links](https://example.com "with titles") stay odd.

* a list with star bullets
* stays starred



Three blank lines above this paragraph, too.
`

const MODES = `# Release notes

Edit this page — or switch to **Read-only** and try. In every mode the Markdown pane on the right stays editable, and the editor follows it.

{% hint style="info" %}
A hint, so there is a block with its own controls (the style picker disappears when read-only).
{% endhint %}

- [ ] A task box (clickable only when editable)
- [x] Another one
`

export const SAMPLES = {
  blocks: { label: "Blocks", markdown: BLOCKS, tip: "Edit anything. Try typing # , - , 1. , > or ``` at the start of a new line." },
  inline: { label: "Inline", markdown: INLINE, tip: "Select text and press ⌘B / ⌘I / ⌘E, or use the toolbar. Untouched spellings stay as written." },
  preserved: { label: "Preserved", markdown: PRESERVED, tip: "The custom tag shows as a raw line you can edit; everything else is plain text to the editor." },
  editable: { label: "Editable", markdown: MODES, tip: "The defaults: toolbar, slash menu, @ and # pickers." },
  readonly: {
    label: "Read-only",
    markdown: MODES,
    tip: "editable={false} toolbar={false}: the document can't be changed here — edit the Markdown instead.",
    props: { editable: false, toolbar: false },
  },
  bare: {
    label: "Bare",
    markdown: "",
    tip: "toolbar={false} slashMenu={false} references={false} and a custom placeholder: a plain Markdown text box.",
    props: { toolbar: false, slashMenu: false, references: false, placeholder: "Just write…" },
  },
} satisfies Record<string, Sample>

export type SampleId = keyof typeof SAMPLES
