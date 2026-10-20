/* Starting documents for the playground, one per variant. */
const fence = "```"

export const SAMPLES = {
  basics: {
    label: "Basics",
    markdown: `# Release notes

Docstream renders **bold**, _italic_, ~~struck~~ and \`inline code\`, plus
[links](https://github.com/BLamy/docstream), autolinks like https://pele.run,
and chips: ask @brett about #streaming.

> Blockquotes hold full markdown — even **lists**:
> - one
> - two

| Block | Streams | Round-trips |
| :--- | :---: | ---: |
| Hints | yes | yes |
| Tables | yes | yes |

---

1. Edit this text
2. Watch the preview
   - nested lists work too
`,
  },
  blocks: {
    label: "Blocks",
    markdown: `{% hint style="success" %}
Every block on the docs site is available here. Try changing \`success\` to \`danger\`.
{% endhint %}

{% tabs %}
{% tab title="TypeScript" %}
${fence}ts title="hello.ts"
export const hello = (name: string) => \`Hello, \${name}!\`
${fence}
{% endtab %}
{% tab title="JavaScript" %}
${fence}js title="hello.js"
export const hello = (name) => \`Hello, \${name}!\`
${fence}
{% endtab %}
{% endtabs %}

{% stepper %}
{% step %}
### Write markdown
Any GitBook block, nested as deep as you like.
{% endstep %}
{% step %}
### Parse it
\`parseMarkdown\` turns it into a block AST.
{% endstep %}
{% step %}
### Render it
\`DocsRenderer\` turns the AST into React.
{% endstep %}
{% endstepper %}
`,
  },
  properties: {
    label: "Properties",
    markdown: `---
# Comments, key order and quoting survive edits.
title: Q4 launch checklist
status: in-review
owner: "@brett"
version: 3
reviewed: false
tags: [docs, launch]
---

# Q4 launch checklist

The property sheet above is the YAML frontmatter. Edit a value there and
watch the YAML in the editor change — or edit the YAML and watch the sheet.
`,
  },
  tasks: {
    label: "Tasks",
    markdown: `## Launch checklist

- [ ] Write the migration guide
- [~] Port the examples to folder demos
- [?] Fix nested list indentation
- [b] Publish to npm (waiting on the 2FA reset)
- [d] Screenshot tests for dark mode
- [!] "Mermaid renders in under 1 ms"
- [x] Thumbnail hover cards
- [-] IE11 support
  - [x] Nested tasks keep their own state
  - [~] And their own indentation

Click a box to toggle it. Right-click (or Shift+F10) for every state.
`,
  },
} as const

export type SampleId = keyof typeof SAMPLES
