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

This page does. Any example on it whose code mentions `GITHUB_TOKEN` doesn't run when the page loads: it shows a button, and its module isn't even imported until the token is there. Press it, create a passkey for this site's keychain, sign in to GitHub (a device code, like `gh auth login`) or paste a token, and the example runs with it.

{% demo src="environment-variables/github-repos" %}

The token goes into a **keychain** encrypted with your passkey (Touch ID, Face ID, Windows Hello or a security key), and is sent only to `api.github.com`. Every example on the page shares it: the one below runs at once now. Come back later and the button says **Unlock with Passkey**: one biometric prompt, and every example whose variables are in the keychain opens, with no sign-in.

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

## A passkey keychain

docstream ships the keychain this page uses. `createEnvKeychain` keeps values encrypted with AES-GCM under a key derived from the passkey's PRF output, so reading them takes the reader's biometrics; the names it holds are readable while locked, which is how the button knows to say "unlock". `keychainEnvHost` turns it into a host:

```tsx
import { createEnvKeychain, keychainEnvHost } from "@brett_lamy/docstream"

const keychain = createEnvKeychain({ id: "my-docs", rpName: "My docs" })
const envHost = keychainEnvHost(keychain, {
  signInLabel: "Sign in with GitHub",
  // Only for what the keychain doesn't hold yet; what it returns is saved.
  obtain: async (names) => ({ GITHUB_TOKEN: await signInWithGitHub() }),
})
```

A press creates the keychain the first time (a passkey prompt) or unlocks it, asks `obtain` for anything missing, and answers with **everything** the keychain holds, so every example those values cover opens together. There is no recovery key: a lost passkey only means signing in again (`keychain.reset()`). Without passkey PRF support, values are kept for the page only.

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

This site's host (`demo/src/github-env.tsx`) is that keychain plus GitHub's device flow through a CORS proxy, with a paste-a-token fallback. The [BL UI docs](https://blamy.github.io/ui/#/env-variables) answer from their Passwords keychain, with device sign-ins for GitHub, Fly.io, Netlify and Replay.

{% hint style="info" %}
Without an `envHost`, the gate asks the reader to type the values, and keeps them in memory for the page.
{% endhint %}
