import type { Sample } from "./Workbench"

const TABLES = `# Tables

| Prop | Type | Default |
| :-- | :-: | --: |
| \`editable\` | \`boolean\` | \`true\` |
| \`toolbar\` | \`boolean\` | \`true\` |
| \`slashMenu\` | \`boolean \\| { items }\` | \`true\` |

Cells hold inline content: **bold**, [links](https://tiptap.dev), \`code\`, @chips.

<table data-view="cards"><thead><tr><th></th><th></th></tr></thead><tbody>
<tr><td><strong>Parser</strong></td><td>Markdown → AST</td></tr>
<tr><td><strong>Editor</strong></td><td>AST → ProseMirror → AST</td></tr>
<tr><td><strong>Serializer</strong></td><td>AST → Markdown, byte for byte</td></tr>
</tbody></table>
`

const HINTS = `# Hints

{% hint style="info" %}
**Info** — background, a pointer elsewhere.
{% endhint %}

{% hint style="success" %}
**Success** — the recommended path.
{% endhint %}

{% hint style="warning" %}
**Warning** — a gotcha.

- Hints hold any blocks
- lists included
{% endhint %}

{% hint style="danger" %}
**Danger** — data loss, a breaking change.
{% endhint %}
`

const TABS = `# Tabs

{% tabs %}
{% tab title="npm" %}
\`\`\`sh
npm install @brett_lamy/docstream-editor
\`\`\`
{% endtab %}

{% tab title="pnpm" %}
\`\`\`sh
pnpm add @brett_lamy/docstream-editor
\`\`\`
{% endtab %}
{% endtabs %}

{% tabs title="Usage" level="3" %}
{% tab title="Controlled" %}
Pass \`markdown\` and \`onChange\`.
{% endtab %}

{% tab title="Uncontrolled" %}
Omit \`markdown\`; read the document through \`onEditorReady\`.
{% endtab %}
{% endtabs %}
`

const STEPPERS = `# Steppers

{% stepper %}
{% step %}
### Install the packages
Add the editor, docstream and the TipTap peers.
{% endstep %}

{% step %}
### Import both stylesheets
The editor's styles mirror docstream's, so authors see what readers get.
{% endstep %}

{% step %}
### Render the editor
\`<GitbookEditor markdown={md} onChange={setMd} />\`
{% endstep %}
{% endstepper %}
`

const COLUMNS = `# Columns and expandables

{% columns %}
{% column %}
**Do** — keep the Markdown the source of truth.
{% endcolumn %}

{% column %}
**Don't** — store the editor's JSON instead.
{% endcolumn %}
{% endcolumns %}

<details>
<summary>Why Markdown and not JSON?</summary>

Markdown diffs, reviews and greps. The editor reads and writes it **byte for byte**.

</details>
`

const LINKS = `# Page links and embeds

{% content-ref url="02-slash-menu.md" %}
[Slash menu](02-slash-menu.md)
{% endcontent-ref %}

{% content-ref url="https://github.com/BLamy/docstream-editor" %}
The docstream-editor repository
{% endcontent-ref %}

{% embed url="https://www.youtube.com/watch?v=aqz-KE-bpKQ" title="Big Buck Bunny" %}

{% embed url="https://tiptap.dev" %}
`

const UPDATES = `# Changelog

{% updates format="full" %}
{% update date="2026-10-01" %}
## Task states
Eight task states and a properties sheet.
{% endupdate %}

{% update date="2026-08-15" %}
## Lossless round trips
Every Markdown page comes back byte for byte.
{% endupdate %}
{% endupdates %}
`

export const SAMPLES = {
  tables: { label: "Tables", markdown: TABLES, tip: "Tab / Shift+Tab move between cells; Tab in the last cell adds a row. Alignment and data-view survive." },
  hints: { label: "Hints", markdown: HINTS, tip: "Change a hint's style with the picker in its gutter; type inside it like anywhere else." },
  tabs: { label: "Tabs", markdown: TABS, tip: "Click a tab to switch, its title to rename it, + to add one, × to remove one." },
  steppers: { label: "Steppers", markdown: STEPPERS, tip: "Edit a step's title in its header field and its body below; numbers follow the order." },
  columns: { label: "Columns", markdown: COLUMNS, tip: "Type in either column. Edit the expandable's summary in its header field." },
  links: { label: "Links & embeds", markdown: LINKS, tip: "Edit a page link's label and URL, or an embed's URL — a YouTube link becomes a player." },
  updates: { label: "Updates", markdown: UPDATES, tip: "Each update has a date picker; its body is ordinary blocks." },
} satisfies Record<string, Sample>

export type SampleId = keyof typeof SAMPLES
