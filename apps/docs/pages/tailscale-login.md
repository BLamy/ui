# Sign in with Tailscale

Join a tailnet from a browser tab: a "Sign in with Tailscale" button, the state machine behind it (`createTailscale`, `TailscaleProvider`, `useTailscaleStatus`), and a tailnet client that is created only when someone signs in. Once connected, `useTailscaleFetch` sends requests for `*.ts.net` names and Tailscale addresses through the tailnet; the [request router](https://blamy.github.io/ui/#/tailscale-router) does the same for every `fetch` on the page without changing your code.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/tailscale-login-button.json https://blamy.github.io/ui/r/tailscale.json https://blamy.github.io/ui/r/tailscale-connect.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { TailscaleProvider } from '@/lib/tailscale-react'
import {
  TailscaleLoginButton, TailscaleStatusBadge,
} from '@/components/ui/tailscale-login-button'
import { createTailscaleConnectClient } from '@/lib/tailscale-connect'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  TailscaleProvider, TailscaleLoginButton, TailscaleStatusBadge,
  createTailscaleConnectClient,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

{% demo src="tailscale-login/sign-in" %}

The demos on this page use an in-memory fake tailnet (`createFakeTailscaleClient`): nothing leaves the page and no account is needed. Read [Limits](#limits) before you rely on the real client.

## Quick start

```tsx
import wasmURL from '@agent-wasm/tailscale-connect/main.wasm?url'   // Vite: host the 26 MB binary yourself
import { TailscaleProvider } from '@/lib/tailscale-react'
import { createTailscaleConnectClient } from '@/lib/tailscale-connect'
import { TailscaleLoginButton, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button'

export function Network() {
  return (
    <TailscaleProvider options={{ client: () => createTailscaleConnectClient({ wasmURL }) }}>
      <TailscaleLoginButton />
      <TailscaleStatusBadge />
    </TailscaleProvider>
  )
}
```

The real client is the optional peer dependency `@agent-wasm/tailscale-connect` (the `tailscale-connect` registry item installs it; with the npm package, `npm install @agent-wasm/tailscale-connect` yourself). Without it, use your own `TailscaleClient` or the fake.

Press the button: a popup opens at once (inside the press, so popup blockers allow it), the WebAssembly client loads and asks Tailscale's control server for a sign-in URL, the popup goes there, the person signs in with their identity provider, and the client reports `Running`. Nothing is downloaded before the press. If no popup could open, the badge shows a **Continue to Tailscale** link instead and `onLoginUrl` is called.

## Where this comes from

The design follows [almostnode](https://github.com/blamy/almostnode), which runs Node in the browser and puts its network on a tailnet. What it does, from reading its source (`packages/almostnode/src/network`, `packages/tailscale-connect`, `packages/keychain`, `packages/workbench/src/features/tailscale-*`):

| Question | almostnode's answer |
| --- | --- |
| The client | `@agent-wasm/tailscale-connect`, its fork of Tailscale's `cmd/tsconnect`: Tailscale's Go client compiled to WebAssembly (`main.wasm`, about 26 MB) with a small JavaScript wrapper, `createIPN(config)`. |
| How it connects | The client runs WireGuard in userspace inside the WebAssembly. Browsers cannot send UDP, so traffic goes through Tailscale's DERP relays over WebSockets; there are no direct peer-to-peer paths. almostnode runs the client in a dedicated Worker. |
| Sign-in | Two modes. **Interactive**: `ipn.login()` makes the control server send a URL (`notifyBrowseToURL`), opened in a popup that was opened synchronously on the click and pointed there with `opener` cleared. **Auth key**: a pre-auth key passed to `createIPN`; its web IDE asks its own server endpoint, which checks the user's session token and mints a short-lived, ephemeral Headscale pre-auth key. A custom control server (Headscale) is a `controlURL`. |
| Session | The client's keys and prefs are a string map read synchronously through `stateStorage`. almostnode persists it as JSON in `sessionStorage` (the IDE in `localStorage` and a keychain mirror), in plain text. |
| Requests | It replaces `globalThis.fetch` (and `XMLHttpRequest`) inside its runtime and routes by host: `*.ts.net`, 100.64.0.0/10, `fd7a:115c:a1e0::/48` and single-label names to the tailnet; everything else to the browser, unless an exit node is on. It does **not** use a service worker for this (its service worker serves its virtual dev servers). |
| Rough edges it works around | Public host names are resolved over DNS-over-HTTPS and passed in as an `ipMap`, because DNS inside the WebAssembly failed; it forces `CorpDNS` on in the stored prefs; it restarts the client after a Go panic; bodies travel as base64. |

What BL UI keeps: the client package and its call sequence, the two sign-in modes, the popup trick, the routing ranges. What it changes: the client sits behind a structural `TailscaleClient` interface so you can run it where you like (or fake it), nothing is persisted unless you say where, the encrypted option is the [passkey vault](https://blamy.github.io/ui/#/passkey-vault), and routing for a whole page is a [service worker](https://blamy.github.io/ui/#/tailscale-router) instead of a patched `fetch`.

## Sign-in modes

### Interactive (default)

`signIn()` opens the popup, starts the client and calls `login()`; the status is `signing-in` until the client reports `Running`, then `connected`. Pressing the button again while signing in cancels. Only an `https:` login URL (or `http:` on localhost, for a local Headscale) is opened; anything else (`javascript:`, `data:`) becomes an error, so a hostile control server cannot run script in the popup.

### Auth key

{% demo src="tailscale-login/auth-key" %}

```tsx
<TailscaleProvider
  options={{
    client: () => createTailscaleConnectClient({ wasmURL }),
    auth: {
      mode: 'auth-key',
      // your server checks who is asking and mints a key for them
      authKey: async (signal) => (await (await fetch('/api/tailscale/auth-key', { method: 'POST', credentials: 'include', signal })).json()).authKey,
    },
  }}
>
```

A pre-auth key is a bearer credential for joining the tailnet: anyone who reads it can add a device. Never ship one in your bundle. Mint it on your server, per user, and make it **ephemeral** (the device disappears when it goes offline), **single-use**, **tagged** (so ACLs limit what it reaches) and **short-lived** (minutes). The controller passes the key to the client and keeps it nowhere. If the client is not running within `authKeyTimeoutMs` (30 s), the status is `error` with reason `auth-key`.

### Your own control server

`controlUrl: 'https://headscale.example.com'` points the client at Headscale or another control server. Not tried here.

## Sessions and the passkey vault

The client's state map holds the device's **private keys**. Whoever has it can be this device on your tailnet until the key expires or an admin removes the device. So the default is to keep it in memory only: every visit is a new device, which suits ephemeral auth keys. To keep it:

| Persistence | Where | Notes |
| --- | --- | --- |
| `memoryTailscalePersistence()` | nowhere | The default. |
| `webStorageTailscalePersistence(sessionStorage)` | `sessionStorage` / `localStorage` | Plain text, as almostnode does. Readable by any script on the origin and by anyone with the profile's files. |
| `vaultTailscalePersistence(vault)` | the passkey vault | AES-GCM encrypted at rest; unlocked by a passkey. |

```tsx
function Tailnet() {
  const vault = useVault()            // inside <VaultGate>: the vault is unlocked here
  const [persistence] = useState(() => vaultTailscalePersistence(vault))
  return (
    <TailscaleProvider options={{ client, persistence }}>
      <TailscaleLoginButton />
    </TailscaleProvider>
  )
}

<VaultProvider options={{ id: 'app', rp: { name: 'App' } }}>
  <VaultGate appName="App"><Tailnet /></VaultGate>
</VaultProvider>
```

Put the provider inside `VaultGate`: a locked vault cannot be read, and the controller reports `error` (reason `storage`) rather than quietly signing in as a new device. The vault protects the keys at rest, not from script on your page (see the vault page). Writes are debounced (250 ms) and flushed on stop; a failed write shows as `warning` and does not disconnect.

When a session is saved, `TailscaleProvider` restores it on mount (`autoConnect`, default true) without asking anyone. `disconnect()` stops the client and keeps the session; `signOut()` logs the device out and deletes it.

## One device per origin

Two tabs running the same saved state would be one device in two places. The controller takes a Web Lock (`bl-tailscale:<lockName>`) while its client runs; a second tab gets `error` with reason `other-tab`. With the [router](https://blamy.github.io/ui/#/tailscale-router) that tab still reaches the tailnet: its requests go through the service worker to the tab that holds the connection. `lockName: false` turns the lock off.

## API

### createTailscale(options)

| Option | Default | Effect |
| --- | --- | --- |
| `client` | required | A `TailscaleClient`, or a function that makes one (called on first sign-in or restore). |
| `auth` | interactive | `{ mode: 'interactive' }` or `{ mode: 'auth-key', authKey: string \| (signal) => Promise<string> }`. |
| `persistence` | memory | Where the device's state is kept (above). |
| `hostname` | `bl-` + 6 letters | The device's name, kept with the session. |
| `controlUrl` | Tailscale's | A Headscale or other control server. |
| `autoConnect` | `true` | Restore a saved session on activation. |
| `popup` | `true` | Open the sign-in page in a popup. |
| `onLoginUrl` | | Called with the sign-in URL when no popup is open. |
| `lockName` | `default` | The Web Lock name, or `false`. |
| `authKeyTimeoutMs` | `30000` | How long an auth-key sign-in may take. |
| `policy` | tailnet allowlist | What `fetch` helpers route (see the router page). |

| Member | Effect |
| --- | --- |
| `getSnapshot()` / `subscribe(fn)` | The snapshot below; change notifications. |
| `activate()` | Start using it (restores a saved session); returns the release. Providers call it; StrictMode safe. |
| `signIn()` / `cancel()` | Sign in (call it from a press); give up a sign-in in progress. |
| `connect()` / `disconnect()` | Restore the saved session / stop and keep it. |
| `signOut()` | Log out and forget the session. |
| `fetch(request)` | A `TailscaleRequest` through the tailnet; rejects with reason `not-connected` unless connected. |
| `matches(url, method?)` | Whether the policy routes `url`. |
| `dispose()` | Stop everything. |

### The snapshot

`status` is one of `idle`, `loading` (the client is loading), `needs-login`, `signing-in`, `starting`, `needs-approval` (an admin must approve the device), `connected` and `error`. With it: `loginUrl`, `error` (a `TailscaleError` with `reason`: `no-client`, `client`, `auth-key`, `login-url`, `not-connected`, `other-tab`, `storage`, `locked-out`, `in-use`), `warning`, `selfName`, `tailnet`, `addresses`, `peers` and `hasSession`. `tailscaleErrorMessage(error)` gives a sentence for people.

### Hooks

| Hook | Returns |
| --- | --- |
| `useTailscale(t?)` | The controller, with the component subscribed. |
| `useTailscaleStatus(t?)` | The snapshot. |
| `useTailscaleFetch(t?)` | A stable `fetch`: matching requests through the tailnet, the rest (and everything while disconnected, unless the policy fails closed) to the network. |

All three throw outside `TailscaleProvider` unless given a controller. `useOptionalTailscale()` returns null instead.

### The client interface

```ts
interface TailscaleClient {
  start(options: { hostname, controlUrl?, authKey?, state, onState, onEvent }): Promise<void>
  login(): void | Promise<void>
  logout(): void | Promise<void>
  fetch(request: TailscaleRequest): Promise<TailscaleResponse>
  dispose(): void | Promise<void>
}
```

`onEvent` takes `{ state?, loginUrl?, netMap?, error? }`, where `state` is the backend state Tailscale reports (`NeedsLogin`, `Starting`, `Running`, `NeedsMachineAuth` …). `createTailscaleConnectClient({ wasmURL, load?, acceptDns? })` is the real one; `createFakeTailscaleClient({ routes, approveAfterMs, acceptKeys, tailnet, failStart })` the fake (it also has `approve()`, `crash()` and the list of `requests` it answered). To run the real client in a Worker, as almostnode does, implement this interface over `postMessage`.

## Components

### TailscaleLoginButton

{% demo src="tailscale-login/states" %}

A react-aria `Button`. By state: **Sign in with Tailscale** (idle, signed out), **Signing in…** / **Connecting…** / **Waiting for approval…** with a spinner (a press cancels; `aria-busy` is set and the accessible name says so), **Sign out of Tailscale** (connected), **Try again** (error). Props: `variant` (`default`, `outline`, `secondary`), `size` (`default`, `sm`, `lg`, `pill`), `labels`, `onSignIn` / `onCancel` / `onSignOut` to replace the defaults, `status` to drive it without a provider, `tailscale`, `className`. `data-slot="tailscale-login-button"` and `data-status`.

### TailscaleStatusBadge

A polite `role="status"` region: a pill with an icon and a word, the tailnet when connected, the error when failed, and the sign-in link while signing in. `compact` shows the pill alone; `layout` is `inline` or `stacked`. Props `status`, `tailnet`, `loginUrl` and `error` override the controller's.

`TailscaleMark` is the nine-dot mark in `currentColor`. Tailscale's name and logo are Tailscale Inc.'s trademarks; check their brand guidelines before you ship them.

## Limits

What was **verified** here:

- The state machine, sign-in modes, popup handling, persistence adapters, Web Lock and StrictMode behaviour: unit tests against the fake client.
- The real `@agent-wasm/tailscale-connect` 1.39.98 client in Chromium (Playwright), through `createTailscaleConnectClient`: it loaded lazily, started, reported `NeedsLogin`, and on `login()` produced a real `https://login.tailscale.com/a/…` sign-in URL within about three seconds.

What could **not** be verified (no Tailscale account or credentials were used):

- Finishing a sign-in, auth keys against a real control server, Headscale, and reaching a real device. The parts of the client's API used after sign-in (`notifyNetMap`, `fetch` with the structured request) are taken from the package's `pkg.d.ts` and almostnode's code.
- Whether MagicDNS names resolve inside the client. The adapter sends the DNS settings almostnode sends and keeps `CorpDNS` on as it does, but the client's start-up log still shows `dns=false` before sign-in.
- The package's published `pkg.js` notes that its minimal build supports only simple GET requests; the adapter sends a URL string for those and the structured form otherwise, which needs a build that accepts it.

Inherent to running Tailscale in a page:

- **Size and memory**: about 26 MB of WebAssembly, downloaded on first sign-in (cache it), and a Go runtime in the tab.
- **Relayed only**: no UDP in browsers, so all traffic goes through DERP over WebSockets: slower than a native client.
- **HTTP only**: the client exposes `fetch`; there are no raw TCP sockets, and WebSockets to tailnet hosts are not covered.
- **Buffered**: request and response bodies cross into WebAssembly as whole base64 strings, so large bodies cost memory and nothing streams.
- **Public hosts**: with an exit node, public names need DNS that works inside the client; almostnode resolves them over DNS-over-HTTPS first. This adapter does not.
- **The tab is the device**: closing it takes the device offline; a restored session reconnects when the page loads again.
- **Panics**: the Go runtime can crash; the status becomes `error` and **Try again** starts a fresh client.

## Testing

Use the fake: `createTailscale({ client: createFakeTailscaleClient({ routes: { 'nas.example-tailnet.ts.net': (req) => new Response('ok') } }).client, env: { open: () => null, locks: null } })`. `approveAfterMs: false` holds an interactive sign-in until you call `approve()`; `acceptKeys` limits auth keys; `failStart` and `crash()` exercise the error paths. The repository's `tools/e2e/tailscale.e2e.mjs` drives these demos in Chromium.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `tailscaleLoginButtonVariants`

Defined in `@/components/ui/tailscale-login-button`. Base classes:

```text
box-border inline-flex cursor-pointer items-center justify-center gap-2 border-0 [font-family:inherit] font-semibold whitespace-nowrap outline-none transition-[scale,background-color,opacity] duration-spring-snappy ease-spring-snappy data-pressed:scale-[.97] motion-reduce:transition-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-offset-2 data-disabled:cursor-default data-disabled:opacity-40
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-foreground text-background` |
| `outline` | `bg-background text-foreground shadow-hairline data-hovered:bg-secondary` |
| `secondary` | `bg-secondary text-secondary-foreground` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `h-10 rounded-ctl px-4 text-subhead` |
| `sm` | `h-8 rounded-lg px-3 text-footnote` |
| `lg` | `h-11 rounded-xl px-5 text-callout` |
| `pill` | `h-11 w-full rounded-card px-4 text-callout` |

**`tone`** — default `idle`

| Value | Adds |
| --- | --- |
| `idle` (default) | — |
| `busy` | — |
| `connected` | — |
| `error` | `bg-secondary text-foreground shadow-none` |

### `tailscaleStatusBadgeVariants`

Defined in `@/components/ui/tailscale-login-button`. Base classes:

```text
inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-footnote
```

**`layout`** — default `inline`

| Value | Adds |
| --- | --- |
| `inline` (default) | — |
| `stacked` | `flex-col items-start` |
