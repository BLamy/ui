---
description: A document can declare the environment variables its examples need. Demo blocks that use them wait for the values, in the editor as on the rendered page.
env: [GITHUB_TOKEN]
---

# Environment variables

A document declares the variables its examples need in its frontmatter, which the editor shows as **Properties**:

```markdown
---
env: [GITHUB_TOKEN]
---
```

A `{% demo %}` whose code mentions one of them doesn't run until the value is there: it shows a gate, and its module isn't imported. This page declares `GITHUB_TOKEN`, so the example below waits too. Press **Sign in with GitHub**, enter the device code at github.com (or paste a token), and it runs. The token stays in this tab and is sent only to `api.github.com`.

{% demo src="demos-env/editor" %}

Inside the editor, the document's own `env` property gates its demo blocks the same way. Edit the property (open **Properties** above the body) and the gates follow. The token this page loaded is shared with the editor, so its repositories demo runs at once.

## Supplying the values

Pass docstream's `DocstreamEnvHost` as `envHost`. It's the same object `DocsSite` and `GitbookStreamdown` take:

```tsx
import { GitbookEditor } from "@brett_lamy/docstream-editor"
import type { DocstreamEnvHost } from "@brett_lamy/docstream"

const envHost: DocstreamEnvHost = {
  label: "Sign in with GitHub",
  request: async (names) => ({ GITHUB_TOKEN: await signInWithGitHub() }),
}

<GitbookEditor markdown={markdown} onChange={setMarkdown} demoResolver={demos} envHost={envHost} />
```

Inside a page that already has a host (as here), the editor uses that one. Without any host, the gate asks for the values and keeps them in memory.

Demo components read the values with `useDocstreamEnv().values.NAME`. Examples that run in almost-node get them as `process.env.NAME`. See [Environment variables](https://blamy.github.io/docstream/#/interactive/environment-variables) in the docstream docs for the whole feature, including a live code fence.
