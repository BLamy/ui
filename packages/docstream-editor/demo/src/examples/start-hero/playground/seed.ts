// The document the playground opens with: one of almost everything the editor edits.
export const SEED = `---
title: Release notes draft
owner: brett
status: draft
---

# Release notes draft

{% hint style="info" %}
Edit me — this hint is a real GitBook block. Pick another style under its icon.
{% endhint %}

## Highlights

- Editor and renderer share **one AST**, so the Markdown on the right is byte-for-byte what docstream renders
- Press \`/\` for blocks, \`@\` or \`#\` for chips, and the toolbar for inline marks
- Ask @brett about the #seasonal numbers [^1]

{% tabs sync="pm" %}
{% tab title="Install" %}
{% command %}npm install @brett_lamy/docstream-editor{% endcommand %}
{% endtab %}

{% tab title="Import" %}
\`\`\`tsx title="App.tsx"
import { GitbookEditor } from "@brett_lamy/docstream-editor"
\`\`\`
{% endtab %}
{% endtabs %}

## Checklist

- [x] Parser and serializer agree
- [~] Docs site migration
- [?] Visual regression baseline
- [ ] Announce in #releases

\`\`\`mermaid
graph LR
  MD[Markdown] --> E[GitbookEditor] --> MD
  MD --> R[docstream renderer]
\`\`\`

$$
\\text{edits} \\circ \\text{serialize} = \\text{identity on untouched bytes}
$$

{% source-ref mount="demo" path="src/Button.tsx" export="default" kind="component" title="Virtual Button" %}

[^1]: https://scoopdata.io/q3 "ScoopData Q3"
`
