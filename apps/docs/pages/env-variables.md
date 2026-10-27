---
env: [GITHUB_TOKEN]
---

# Example environment variables

A page can list the environment variables its examples need in its frontmatter. An example whose code uses one of them doesn't run when the page loads: it shows **Load from Keychain** instead, and runs once the value is loaded.

```markdown
---
env: [GITHUB_TOKEN, NETLIFY_AUTH_TOKEN]
---
```

{% demo src="env-variables/github-repos" %}

{% demo src="env-variables/no-env" %}

## Where the values come from

These docs answer from the keychain the [Apple Passwords](#/blocks/apple-passwords) block keeps: the same passkey vault and the same device sign-ins, so a token you signed in to there is already here.

1. **Load from Keychain** unlocks the keychain with your passkey.
2. A variable a sign-in provides and the keychain doesn't have starts that sign-in: a device code for GitHub, an approval page for Fly.io, Netlify and Replay. The result is saved in the keychain, encrypted with your passkey once one is set up.
3. A variable no sign-in provides is typed once and kept in the keychain.

| Variable | Sign-in |
| --- | --- |
| `GITHUB_TOKEN`, `GH_TOKEN` | GitHub (device code) |
| `FLY_API_TOKEN`, `FLY_ACCESS_TOKEN` | Fly.io |
| `NETLIFY_AUTH_TOKEN` | Netlify |
| `REPLAY_API_KEY`, `RECORD_REPLAY_API_KEY` | Replay |

When this tab is signed in to Tailscale (in the [Safari](#/blocks/safari) block, say) and an exit node is online, the sign-ins go through the tailnet; otherwise they go through BL's own CORS proxy, a Cloudflare Worker.

## In your own docs

docstream does the gating; the host only supplies the values:

```tsx
import { GitbookStreamdown, type DocstreamEnvHost } from '@brett_lamy/docstream'

const envHost: DocstreamEnvHost = {
  label: 'Load from Keychain',
  describe: (name) => (name === 'GITHUB_TOKEN' ? 'Sign in with GitHub' : undefined),
  request: async (names) => readFromYourKeychain(names), // resolve with the values you could get
}

<GitbookStreamdown markdown={page} demoResolver={demos} envHost={envHost} />
```

- An example is gated when its source mentions a declared name as a whole word. Its module isn't imported until the values are loaded.
- In-page demos read the values with `useDocstreamEnv().values`. Demos that run in almost-node, and live code fences, get them as `process.env.NAME`.
- Without an `envHost`, the gate asks the reader to type the values and keeps them in memory for the page.
