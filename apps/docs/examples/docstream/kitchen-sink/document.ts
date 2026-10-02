import counterSource from './counter.tsx?raw'
import openapi from './openapi.json?raw'

// Data URLs keep the document portable, including GitHub Pages and Copy page.
const illustration = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="180" viewBox="0 0 600 180">'
  + '<rect width="600" height="180" rx="18" fill="#e0e7ff"/>'
  + '<rect x="28" y="40" width="156" height="100" rx="12" fill="#6366f1"/>'
  + '<rect x="222" y="40" width="156" height="100" rx="12" fill="#8b5cf6"/>'
  + '<rect x="416" y="40" width="156" height="100" rx="12" fill="#0d9488"/>'
  + '<g fill="white" font-family="sans-serif" font-size="18" text-anchor="middle">'
  + '<text x="106" y="97">Markdown</text><text x="300" y="97">Editor</text><text x="494" y="97">Preview</text>'
  + '</g></svg>',
)
const specUrl = 'data:application/json,' + encodeURIComponent(openapi)

export const kitchenSinkMarkdown = `# Docstream kitchen sink

A single document for **MarkdownView** and **MarkdownEditor**. Edit any block, switch tabs, tick a task, open the details, or click a reference.

## Typography and links

### Heading level three

#### Heading level four

##### Heading level five

###### Heading level six

Plain text, **bold**, *italic*, ***bold and italic***, ~~strikethrough~~, **~~combined marks~~**, and \`inline code\`.

An [inline link](https://github.com/BLamy/docstream "Docstream on GitHub"), a **[bold link](https://github.com/BLamy/docstream)**, a [reference-style link][docstream], an autolink <https://github.com/BLamy/docstream>, and a bare URL https://github.com/BLamy/docstream.

Escaped punctuation: \\*literal asterisks\\*, snake\\_case, and \`const pipe = "a|b"\`.

An inline image: <img src="${illustration}" alt="Markdown, editor, and preview" width="120" height="36"> beside text.

[docstream]: https://github.com/BLamy/docstream "Docstream"

## Reference chips

Ask @maya about #docs in $blamy/ui. The implementation is explained in the source[^source], and citations can have their own labels.

## Lists, tasks, and quotes

- A bullet with **bold text**
- A nested list
  - A child item with \`code\`
  - Another child

3. Ordered lists can start at three.
4. Each item can contain a paragraph.

- [x] Add the renderer example
- [x] Add the editor example
- [ ] Try editing this checklist

> A blockquote can contain **formatting**.
>
> - It can contain a list, too.
> - And more than one paragraph.

---

## Code blocks

A titled fence with line numbers:

\`\`\`tsx title="preview.tsx" lineNumbers="true"
import { MarkdownView } from '@brett_lamy/ui'

export function Preview({ markdown }: { markdown: string }) {
  return <MarkdownView markdown={markdown} />
}
\`\`\`

An untitled fence without line numbers:

\`\`\`json lineNumbers="false"
{ "renderer": "docstream", "editable": true }
\`\`\`

A GitBook code wrapper:

{% code title="hello.sh" lineNumbers="false" %}
\`\`\`sh
echo "Hello, Docstream"
\`\`\`
{% endcode %}

## Hints

{% hint style="info" %}
**Info:** Useful context. Hints can contain lists:

- Render the same Markdown in both components.
- Keep the document as the source of truth.
{% endhint %}

{% hint style="success" %}
**Success:** The document is ready to share.
{% endhint %}

{% hint style="warning" %}
**Warning:** Check the preview before publishing.
{% endhint %}

{% hint style="danger" %}
**Danger:** This is the destructive-state treatment.
{% endhint %}

## Tabs and installation commands

{% tabs title="Install the package" level="3" sync="kitchen-sink-install" %}
{% tab title="Package" %}
{% command sync="kitchen-sink-pm" %}npm install @brett_lamy/ui{% endcommand %}
{% endtab %}
{% tab title="Registry" %}
{% command sync="kitchen-sink-pm" %}npx shadcn@latest add https://blamy.github.io/ui/r/markdown-view.json{% endcommand %}
{% endtab %}
{% endtabs %}

Commands also accept explicit package-manager overrides. Selecting a manager here synchronizes the commands above:

{% command sync="kitchen-sink-pm" pnpm="pnpm add -D typescript" yarn="yarn add --dev typescript" bun="bun add --dev typescript" %}npm install --save-dev typescript{% endcommand %}

{% tabs sync="kitchen-sink-tabs" %}
{% tab title="Overview" %}
Tabs can contain paragraphs, **formatting**, and other blocks.
{% endtab %}
{% tab title="Details" %}
- First detail
- Second detail
{% endtab %}
{% endtabs %}

This second tab set follows the first:

{% tabs sync="kitchen-sink-tabs" %}
{% tab title="Overview" %}
The overview is selected in both tab sets.
{% endtab %}
{% tab title="Details" %}
The details are selected in both tab sets.
{% endtab %}
{% endtabs %}

Code-only tabs use the compact code treatment:

{% tabs %}
{% tab title="TypeScript" %}
\`\`\`ts
export const ready = true
\`\`\`
{% endtab %}
{% tab title="JSON" %}
\`\`\`json
{ "ready": true }
\`\`\`
{% endtab %}
{% endtabs %}

## Expandables

<details>

<summary>Open the extra details</summary>

Hidden content supports **formatting** and nested blocks.

{% hint style="info" %}
This hint lives inside an expandable.
{% endhint %}

</details>

## Steppers and columns

{% stepper %}
{% step %}
### Write

Create a Markdown document.
{% endstep %}
{% step %}
### Edit

Load it into MarkdownEditor and change a block.
{% endstep %}
{% step %}
### Render

Pass the resulting value to MarkdownView.
{% endstep %}
{% endstepper %}

{% columns %}
{% column %}
### Authoring

- Rich-text editing
- Slash commands
- Markdown paste
{% endcolumn %}
{% column %}
### Reading

- Streaming replies
- Interactive blocks
- Themed previews
{% endcolumn %}
{% endcolumns %}

## Tables and cards

| Left aligned | Centered | Right aligned |
| :--- | :---: | ---: |
| **Markdown** | \`ready\` | 12 |
| A pipe: a\\|b | [Docs](https://blamy.github.io/ui/) | 24 |

An HTML table:

<table><thead><tr><th>Feature</th><th>Status</th></tr></thead><tbody><tr><td><strong>HTML tables</strong></td><td>Supported</td></tr></tbody></table>

A GitBook card table:

<table data-view="cards"><thead><tr><th>Title</th><th>Description</th></tr></thead><tbody><tr><td><strong>Write</strong></td><td>Create a document with MarkdownEditor.</td></tr><tr><td><strong>Read</strong></td><td>Render it with MarkdownView.</td></tr></tbody></table>

## Images and figures

![Markdown flows through the editor into a preview](${illustration} "A Markdown image")

<figure><img src="${illustration}" alt="Three connected document stages"><figcaption>A figure with an editable caption.</figcaption></figure>

## Math and Mermaid

Display math is rendered with KaTeX:

$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

\`\`\`mermaid collapsedCodeLines="4" expandedCodeLines="12"
flowchart LR
  Markdown --> Editor
  Editor --> Markdown
  Markdown --> Preview
\`\`\`

## Video and embeds

A direct video with a poster and playback attributes. This is MDN's flower clip; playback needs a network connection.

{% embed url="https://developer.mozilla.org/shared-assets/videos/flower.mp4" title="Flowers moving in the breeze" poster="${illustration}" autoplay="false" loop="true" muted="true" controls="true" %}

Other URLs fall back to a link card:

{% embed url="https://github.com/BLamy/docstream" %}

<details>

<summary>Hosted video and public replay embed syntax</summary>

YouTube links use the hosted player. Public Loop QA task, journey, exploration, and test-run links use ReplayPreview.

\`\`\`md
{% embed url="https://www.youtube.com/watch?v=VIDEO_ID" /%}
{% embed url="https://loop-qa.replay.io/projects/PROJECT_ID/tasks/TASK_ID" /%}
\`\`\`

The Sources section below includes an interactive replay bundled with this example.

</details>

## Content and file references

{% content-ref url="https://blamy.github.io/ui/#/markdown-editor" %}
MarkdownEditor component page
{% endcontent-ref %}

{% file src="data:text/plain,Hello%20from%20Docstream" caption="Read the example text file" %}

## Updates

{% updates format="YYYY-MM-DD" %}
{% update date="2026-10-01" %}
### Kitchen sink added

The Markdown and editor pages now share one complete sample.
{% endupdate %}
{% update date="2026-09-30" %}
### Ready to edit

Hints, tabs, tables, figures, and references stay structured when edited.
{% endupdate %}
{% endupdates %}

## OpenAPI operation

The specification is bundled as a data URL, so the example also works on a static site.

{% openapi-operation spec="openapi.json" path="/notes/{id}" method="get" %}
[Kitchen sink API](${specUrl})
{% endopenapi-operation %}

## Component, story, and replay sources

Source references preserve the real file's mount, path, export, and kind. The preview resolves these bundled exports; the editor exposes their metadata.

{% source-ref mount="kitchen-sink" path="fixtures.tsx" export="ComponentExample" kind="component" title="Component export" /%}

{% source-ref mount="kitchen-sink" path="fixtures.tsx" export="Primary" kind="story" title="Storybook export" /%}

{% source-ref mount="kitchen-sink" path="fixtures.tsx" export="ReplayExample" kind="component" title="Session replay" /%}

## Live demos

A resolver-backed demo, including variants and its real source:

{% demo src="kitchen-sink/counter" title="Interactive counter" layout="single" variants="full:Full,compact:Compact" /%}

The block form carries the same real source file inline, so it can be copied with the document:

{% demo src="kitchen-sink/inline-counter" title="Demo with inline files" layout="single" entry="counter.tsx" %}
\`\`\`tsx title="counter.tsx"
${counterSource.trimEnd()}
\`\`\`
{% enddemo %}

## Optional runtimes and source preservation

Live React fences are highlighted code unless a host supplies a \`liveRenderer\`. Docstream's optional \`@brett_lamy/docstream/playground\` entry supplies the sandbox runtime and requires \`@agent-wasm/core\`.

\`\`\`tsx live="true" title="live-counter.tsx" entry="/src/main.tsx"
import { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>
}
\`\`\`

VizEngine scenes use the optional \`@brett_lamy/docstream/viz\` entry and the \`@brett_lamy/viz-engine\` peer dependency:

\`\`\`tsx
import { VizEmbed } from '@brett_lamy/docstream/viz'

<VizEmbed scene={scene} title="An interactive scene" />
\`\`\`

Unknown integration tags are preserved in the source while rendering no extra content:

{% custom-integration name="preserved" %}

[^source]: https://github.com/BLamy/docstream "Docstream source"
`
