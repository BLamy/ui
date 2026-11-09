import { useState } from "react"
import { GitbookEditor } from "@brett_lamy/docstream-editor"
import { MarkdownPane, Pane, Split } from "./ui"
import { demoResolver } from "./resolver"
import { demoRuntime } from "./runtime"

const FENCE = "```"

const SEED = `# Widgets

A demo the host's resolver knows, by \`src\` alone:

{% demo src="widgets/counter" %}

With variants from the tag (they win over the resolver's meta):

{% demo src="widgets/badge" title="Badge styles" variants="soft:Soft,solid:Solid" %}

A demo that carries its own files. No resolver entry, so the files are the demo:

{% demo src="pasted/hello" title="Hello" %}
${FENCE}tsx title="index.tsx"
export default function Hello({ variant = "world" }: { variant?: string }) {
  return <p style={{ padding: 16 }}>Hello, {variant}!</p>
}
${FENCE}
{% enddemo %}
`

/** `{% demo %}` blocks in the editor: resolved by `demoResolver`, or run from inline files by `demoRuntime`. */
export default function ResolverDemo() {
  const [markdown, setMarkdown] = useState(SEED)
  const [withResolver, setWithResolver] = useState(true)
  const [withRuntime, setWithRuntime] = useState(true)
  const toggle = (label: string, value: boolean, set: (v: boolean) => void) => (
    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} /> {label}
    </label>
  )
  return (
    <Split>
      <Pane title="GitbookEditor" actions={<>{toggle("demoResolver", withResolver, setWithResolver)}{toggle("demoRuntime", withRuntime, setWithRuntime)}</>}>
        <GitbookEditor
          key={`${withResolver}-${withRuntime}`}
          markdown={markdown}
          onChange={setMarkdown}
          toolbar={false}
          documentProperties={false}
          {...(withResolver ? { demoResolver } : {})}
          {...(withRuntime ? { demoRuntime } : {})}
        />
      </Pane>
      <MarkdownPane markdown={markdown} />
    </Split>
  )
}
