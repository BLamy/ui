import { useState } from "react"
import { GitbookEditor } from "@brett_lamy/ui/docstream-editor"
import type { DemoResolver } from "@brett_lamy/ui/docstream"
import Repos from "./repos"
import reposSource from "./repos.tsx?raw"

// A document that declares `env: [GITHUB_TOKEN]` (open Properties above the body to see or edit it), with a demo block
// that uses the token. In the editor that block is gated exactly as on a rendered page: it waits for GITHUB_TOKEN from
// the editor's `envHost` (here, the site's GitHub sign-in, which this page has already asked for).
const SEED = `---
env: [GITHUB_TOKEN]
---

# My repositories

The demo below reads \`GITHUB_TOKEN\` from the document's environment.

{% demo src="github/repos" %}
`

const resolver: DemoResolver = {
  list: () => ["github/repos"],
  meta: async () => ({ title: "Your GitHub repositories", status: "Live" }),
  files: async () => [{ path: "repos.tsx", content: reposSource }],
  load: async () => Repos,
}

export default function EnvEditor() {
  const [markdown, setMarkdown] = useState(SEED)
  return (
    <div style={{ height: "100%", overflow: "auto", padding: "8px 16px" }}>
      <GitbookEditor markdown={markdown} onValueChange={setMarkdown} demoResolver={resolver} documentProperties={{ defaultOpen: true }} />
    </div>
  )
}
