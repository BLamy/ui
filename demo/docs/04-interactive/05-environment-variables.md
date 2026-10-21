---
description: Examples that need a secret — an API token — wait behind a button until the host supplies it, from a keychain or a sign-in.
env: [GITHUB_TOKEN]
---

# Environment variables

Some examples need a secret before they can do anything: a GitHub token to list your repositories, a Netlify token to deploy. A page declares those variables in its frontmatter:

```markdown
---
env: [GITHUB_TOKEN]
---
```

This page does. Any example on it whose code mentions `GITHUB_TOKEN` doesn't run when the page loads: it shows a button, and its module isn't even imported until the token is there. Press it, sign in to GitHub (a device code, like `gh auth login`) or paste a token, and the example runs with it.

{% demo src="environment-variables/github-repos" %}

The token stays in this tab (sessionStorage) and is sent only to `api.github.com`. Every example on the page shares it: the one below runs at once now.

## In almost-node: `process.env`

A live code fence runs in almost-node, so it gets the variables as `process.env`:

```jsx live="true" title="whoami.jsx"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"

function Whoami() {
  const [user, setUser] = useState(null)
  useEffect(() => {
    fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } })
      .then((r) => r.json())
      .then(setUser)
  }, [])
  if (!user) return <p>Asking GitHub who you are…</p>
  return (
    <p style={{ display: "flex", alignItems: "center", gap: 10, font: "15px system-ui" }}>
      <img src={user.avatar_url} width={32} height={32} style={{ borderRadius: "50%" }} alt="" />
      Signed in as <strong>{user.login}</strong>
    </p>
  )
}

createRoot(document.getElementById("root")).render(<Whoami />)
```

## Reading the values

| Where the example runs | How it reads `GITHUB_TOKEN` |
| --- | --- |
| In the page (`{% demo %}` from a resolver) | `useDocstreamEnv().values.GITHUB_TOKEN` |
| In almost-node (inline demos, live code fences) | `process.env.GITHUB_TOKEN` |

An example is gated when its source mentions a declared name as a whole word — `GITHUB_TOKEN` in a comment counts, `MY_GITHUB_TOKEN_2` doesn't. Examples that use none of the page's variables run straight away.

## Supplying the values

The renderer asks the host. Pass an `envHost` to `DocsSite`, `GitbookStreamdown`, `DocsRenderer` or `MarkdownContent`:

```tsx
import type { DocstreamEnvHost } from "@brett_lamy/docstream"

const envHost: DocstreamEnvHost = {
  label: "Sign in with GitHub",                       // the gate's button
  describe: (name) => (name === "GITHUB_TOKEN" ? "GitHub device sign-in" : undefined),
  request: async (names) => {
    // Unlock a keychain, run a sign-in, ask a secrets manager…
    // Resolve with the values you could get; names you leave out stay gated.
    return { GITHUB_TOKEN: await signInWithGitHub() }
  },
}

<DocsSite files={files} envHost={envHost} />
```

This site's host is about 120 lines (`demo/src/github-env.tsx`): GitHub's device flow through a CORS proxy, with a paste-a-token fallback, kept in sessionStorage. The [BL UI docs](https://blamy.github.io/ui/#/env-variables) answer from a passkey-encrypted keychain instead, with device sign-ins for GitHub, Fly.io, Netlify and Replay.

{% hint style="info" %}
Without an `envHost`, the gate asks the reader to type the values, and keeps them in memory for the page.
{% endhint %}
