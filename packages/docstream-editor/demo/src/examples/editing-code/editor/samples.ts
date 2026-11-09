import type { Sample } from "./Workbench"

const CODE = `# Code blocks

\`\`\`ts title="greet.ts" lineNumbers="true"
export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

A fence with only a language:

\`\`\`json
{ "name": "docstream-editor", "private": false }
\`\`\`

The legacy wrapper is kept as written:

{% code title="install.sh" %}
\`\`\`sh
npm install @brett_lamy/docstream-editor
\`\`\`
{% endcode %}

A live fence (this site gives the editor no live renderer, so it is edited as code):

\`\`\`jsx live="true" title="Counter"
import { useState } from "react"
import { createRoot } from "react-dom/client"

function App() {
  const [n, setN] = useState(0)
  return <button onClick={() => setN(n + 1)}>Clicked {n}×</button>
}

createRoot(document.getElementById("root")).render(<App />)
\`\`\`
`

const COMMANDS = `# Install commands

{% command %}npm install @brett_lamy/docstream-editor @brett_lamy/docstream{% endcommand %}

Several lines, with a line that isn't npm:

{% command %}
npm create vite@latest my-docs -- --template react-ts
cd my-docs
npm install @brett_lamy/docstream-editor
{% endcommand %}

With a verbatim bun command:

{% command bun="bun add @brett_lamy/docstream-editor --trust" %}npm install @brett_lamy/docstream-editor{% endcommand %}
`

const MATH = `# Math

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

$$
\\begin{aligned}
\\nabla \\cdot \\mathbf{E} &= \\frac{\\rho}{\\varepsilon_0} \\\\
\\nabla \\cdot \\mathbf{B} &= 0
\\end{aligned}
$$

$$
\\operatorname{softmax}(\\mathbf{z})_i = \\frac{e^{z_i}}{\\sum_{j=1}^{K} e^{z_j}}
$$
`

const DIAGRAMS = `# Diagrams

\`\`\`mermaid
graph LR
  MD[Markdown] -->|parseMarkdown| AST[docstream AST]
  AST -->|astToTiptap| PM[editor document]
  PM -->|tiptapToAst| AST2[docstream AST]
  AST2 -->|serializeMarkdown| MD2[Markdown]
\`\`\`

\`\`\`mermaid
sequenceDiagram
  participant A as Author
  participant E as Editor
  participant H as Host
  A->>E: types
  E->>H: onChange(markdown)
  H->>E: markdown prop
\`\`\`
`

export const SAMPLES = {
  code: { label: "Code", markdown: CODE, tip: "Each block has a title field, a language field, a # (line numbers) box and a Live box. Titled fences number their lines unless told not to." },
  commands: { label: "Commands", markdown: COMMANDS, tip: "Edit the npm command under a box; the pnpm / yarn / bun fields override what's derived." },
  math: { label: "Math", markdown: MATH, tip: "Edit the TeX on the left of a card; KaTeX redraws on the right after a short pause." },
  diagrams: { label: "Diagrams", markdown: DIAGRAMS, tip: "Edit the Mermaid source; the diagram redraws when you pause." },
} satisfies Record<string, Sample>

export type SampleId = keyof typeof SAMPLES
