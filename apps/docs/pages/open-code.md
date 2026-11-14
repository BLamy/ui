# OpenCode

`OpenCode` is a whole coding agent in the page: OpenCode's real v2.2.4 terminal UI, rendered by OpenTUI WebAssembly, connected to a browser workspace (an AlmostNode or agent-wasm container). Its file and shell tools work on the same container as the app being built, and when a server starts, its port opens beside the terminal as a live preview in a sandboxed iframe.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/open-code.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { OpenCode } from '@/components/ui/open-code'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { OpenCode } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

{% hint style="info" %}
**Which terminal?** [Terminal](https://blamy.github.io/ui/#/terminal) is an emulator for a process you run (a shell, a REPL, a log stream). [TuiPreview](https://blamy.github.io/ui/#/tui-preview) runs one small OpenTUI program from source, such as a code fence in an AI reply. `OpenCode` is the full agent with a workspace and app previews.
{% endhint %}

## Installation

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/open-code.json{% endcommand %}

The registry includes the component and host bridge. Install `@agent-wasm/core` for the runtime used in this example. The `@brett_lamy/ui/opencode` package export is also available from the current source build; it requires a package release containing this component.

```tsx
import { OpenCode } from '@/components/ui/open-code';
import { createAgentWasmOpenCodeHost } from '@/lib/open-code-host';

async function createHost() {
  const { createContainer } = await import('@agent-wasm/core');
  const container = createContainer({ basePath: '/my-app' });
  return createAgentWasmOpenCodeHost(container, { disposeContainer: true });
}

<OpenCode createHost={createHost} />;
```

`createAlmostNodeOpenCodeHost` accepts the same container interface. The adapter supplies filesystem methods, shell execution, server ownership filtering and preview events. It never launches a native process or shell on your computer. The container's runtime determines which Node APIs and commands work.

Keep `createHost` stable between renders. A factory creates a fresh workspace on each Start and the component disposes it on Stop, errors or unmounting. Alternatively pass `host={bridge}` to borrow an existing workspace; the caller owns its lifetime. Each workspace needs a unique absolute directory (the default is `/workspaces/<container.id>`).

## Usage

Give it a host (or a factory that makes one on Start) and a size. Everything else has a default: the trusted runtime module, the preview host, and the browser tools.

```tsx
<OpenCode createHost={createHost} className="h-[620px]" />

// In a pane or window that draws its own edge: no border or radius, filling its box
<OpenCode host={bridge} variant="plain" className="h-full" autoStart={false} />
```

## States

The header says where it is, and `data-state` on the root carries the same value (`idle`, `starting`, `running`, `error`, `stopped`); `onStateChange` reports it. With `autoStart={false}` it waits at **Start OpenCode**. While the runtime loads, the terminal says so. An error (a runtime that cannot load, or one missing a capability a store needs) stops the session and shows the message in an alert above the terminal; Start tries again. Each open port adds a toggle in the preview toolbar.

## Appearance and size

`appearance` picks the terminal's color scheme. Without it the component follows the nearest [ThemeScope](https://blamy.github.io/ui/#/theming), else the ambient appearance (`<html class="dark">` counts), else dark. Changing it restarts the session, because the runtime reads it once at mount.

The component has no height of its own beyond a 320px floor: size it with `className` (`h-[620px]`, `flex-1`, `h-full`). Below the compact width of its own box (`data-size-class`), the preview stacks under the terminal instead of beside it.

## The Vibecoder block

{% demo src="open-code/vibecoder" %}

The [Vibecoder block](https://blamy.github.io/ui/#/blocks/vibecoder) starts OpenCode and the starter app automatically when it opens. Its HTTP server serves HTML, CSS, JavaScript and an API route from the virtual filesystem. Try the counter in the preview. With a provider connected, ask OpenCode to edit `index.html` or `style.css`; select **Reload** to see the change.

Vibecoder saves provider sign-ins and its network connection in the UI library’s **Passwords keychain**. Set up or unlock Passwords before signing in through OpenCode’s `/connect` flow or connecting Tailscale. Provider credentials use `opencode-provider-credentials`; the connection choice, Tailscale node keys and selected exit node use `opencode-connection`. Both slots use the vault’s passkey PRF and AES-GCM encryption in browser storage.

After refreshing, select **Unlock Passwords keychain** once. Vibecoder restarts automatically, loads the saved provider sign-ins and restores the selected connection. Tailscale reconnects as the same device and selects its saved exit node without another Tailscale sign-in. An unavailable exit node leaves provider traffic blocked until you reconnect or choose another connection. Locking Passwords stops the terminal; unlocking restores it. **Explore offline** and the Cloudflare choice are remembered too. Signing out removes the corresponding saved provider credential or Tailscale session. Workspace files and conversations remain in memory.

A runtime advertising `capabilities.credentialStore = 1` and `capabilities.connectionStore = 1` is required. Older runtimes are rejected when a configured store would be ignored. Deploy the companion OpenCode browser runtime together with this UI update.

## Props

| Prop | Default | Purpose |
| --- | --- | --- |
| `host` / `createHost` | | Borrow a host, or create an owned one on each Start (disposed on Stop). Choose one. |
| `credentialStore` | | Supported encrypted host store. Never prompts or falls back to plaintext. Locking it stops the terminal. |
| `connectionStore` | | Encrypted connection choice, Tailscale node session and exit node. |
| `runtimeUrl` / `loadRuntime` | hosted module | Hosted browser module or custom runtime loader. |
| `previewRuntimeUrl` | the hosted preview host | Separate-origin AlmostNode worker/bootstrap host. |
| `title` | `OpenCode` | Visible title; also names the region, its terminal and its preview frames. |
| `appearance` | scope, ambient, else `dark` | `light` or `dark`. Changing it restarts the session. |
| `variant` | `card` | `card`: bordered and rounded. `plain`: no border or radius, for a pane that draws its own. |
| `autoStart` | `true` | Start on mount and restore after keychain unlock; `false` waits for Start. |
| `browserTools` | `true` | Attach the iframe browser MCP tools. |
| `onReady` | | Receives the mounted runtime session and host. |
| `onStateChange` | | Observes `idle`, `starting`, `running`, `error` and `stopped`. |
| `ref`, `className`, `style`, … | | Passed to the root `<section>`. |

`openCodeVariants({ variant })` is the root's recipe.

## Accessibility

The root is a region named by `title`. The status line is a live `status`, errors are an `alert`, the terminal's mount point is a group named "`title` terminal" (the runtime's own input sits inside it), and the open ports are a toggle group: one tab stop, arrow keys between ports. Start / Stop, Reload and Close are the kit's Buttons.

For small programs embedded in an AI response, use [TuiPreview](https://blamy.github.io/ui/#/tui-preview). Mount `OpenCode` when the response needs a complete editable workspace and app previews. An AI response must not provide an untrusted runtime module URL.

## Runtime

How the pieces behind the component fit together: the browser tools, the preview service worker, your own host bridge and the provider connection.

### Agent Browser MCP

Vibecoder automatically attaches an `agent-browser` MCP server to OpenCode. The server follows the selected app iframe across port changes and reloads. With a provider connected, try: **“Use the browser tools to inspect the preview, click the counter twice, and verify its updated text.”** OpenCode can take a semantic DOM snapshot, click its `@refs`, fill and append text, select options, press keys, wait for elements, read text and URLs, navigate within the current app, and reload it. A snapshot gives stable refs within one document; take another after navigation.

The embedded example's **Test browser tools** button calls the same host handlers used by MCP. It snapshots the live iframe, clicks its counter, reads the updated value, navigates to an app URL, and reloads to check reconnection. This check does not call a model. The OpenCode browser backend smoke page separately verifies real MCP discovery, host instructions, and tool calls through its upstream MCP client.

The browser demo uses an **iframe adapter compatible with a subset of [Agent Browser's MCP tools](https://github.com/vercel-labs/agent-browser)**. The upstream native Rust/CDP server cannot execute inside the WASM container. This adapter uses DOM events inside the preview, including form submission and focus handling. Events are synthetic; it does not offer native screenshots, arbitrary tabs, CDP or trusted pointer events. Only supported arguments are advertised. Its snapshots describe DOM semantics rather than the browser's native accessibility tree.

The adapter is installed into HTML responses at the host bridge before the unchanged AlmostNode service worker serves them. A separate MessageChannel carries tool commands into that app document. The host checks the selected frame, origin and session. Navigation is restricted to the selected virtual port; the agent cannot use these tools to inspect the host terminal, provider connection dialog, parent storage or another browser tab. App HTML must allow the injected script under its Content Security Policy. Closing or replacing a frame cancels pending calls. Navigation and reload create a fresh worker scope and repeat its handshake. App paths and query parameters travel in a URL fragment that stays in the browser, so the static Cloudflare host does not receive them.

MCP stays inside the browser and uses OpenCode's upstream MCP client, tool registry and permission checks. No provider proxy is involved in executing browser tools. Provider access is still required for the model to decide which tools to call. Set `browserTools={false}` to disable the iframe tools. Hosts may also supply `mcpServers` on `OpenCodeHostBridge` to attach other trusted in-page MCP implementations; each provides a versioned tool catalog and an asynchronous `callTool(name, args, signal)` handler. The runtime must advertise `capabilities.hostMcp: 1`.

### Service worker

Previews use the **unchanged AlmostNode service worker shipped in `@agent-wasm/core` 0.4.0**. The default preview host serves that worker under `https://bl-cors-proxy.brett-lamy.workers.dev/opencode-preview/<session>/`. A bootstrap page transfers a MessagePort directly from BL UI to the worker. Its existing `/__virtual__/<port>/` requests reach the owning container's `ServerBridge.handleRequest()` through that channel. App files and responses stay in the browser; Cloudflare serves the static bootstrap and worker.

The preview frame registers the worker without reloading the host page. Only servers whose `ownerId` matches the container are exposed; auxiliary servers stay hidden. Port closures remove their previews. Stop disposes factory-owned containers and their servers; borrowed containers keep running.

Requests go to the virtual HTTP server through AlmostNode's worker, including scripts, styles, API requests and forms. A new port opens automatically; the toolbar switches ports (a toggle group: one tab stop, arrow keys between ports), reloads or closes the selected preview. The preview sits beside the terminal, and under it when the component's own box is compact (`data-size-class`), whatever the viewport. Frames allow scripts, forms and their own origin so service workers work. Their origin must differ from the host page's origin, keeping the preview app away from the parent's DOM and storage. `previewRuntimeUrl` selects a self-hosted bootstrap/worker deployment. The host validates the frame, origin, session and selected owned port before forwarding HTTP requests.

Existing applications can still register their own AlmostNode worker with Vite's `almostnodePlugin()` from `@agent-wasm/core/vite`, or copy `getServiceWorkerContent()` from `@agent-wasm/core/next`. `serviceWorkerUrl` on the adapter opts into that host-page registration too. The isolated preview uses its own worker scope. Use HTTPS or localhost.

### Custom host bridge

Use `OpenCodeHostBridge` for another runtime. Supply `id`, `directory`, `workspaceBridge` and `processBridge`. Add `previews.ready`, `previews.list`, `previews.subscribe` and `previews.fetch` to enable port previews; `setTarget` forwards HMR messages into the selected frame. The bundled adapter supports text files and commands with shell pipes; a custom process bridge is needed for piped stdin. HTTP responses are buffered by the container adapter; arbitrary WebSocket servers need additional host support.

```tsx
<OpenCode host={bridge} loadRuntime={() => import('./opencode-runtime')} />
```

The default trusted runtime module is [the OpenCode fork on GitHub Pages](https://blamy.github.io/opencode/runtime.js). It downloads and starts when the component mounts. Pass `autoStart={false}` to wait for the Start button. `runtimeUrl` points to a self-hosted copy; `loadRuntime` can return a bundled implementation of the same `mount()` contract. Upstream installs document-wide terminal state, so only one OpenCode runtime can run per document. Multiple components can remain idle.

### Provider connection

Select **Connection** for the Tailscale/Cloudflare explanation. Tailscale routes provider traffic through your online exit node. The public Cloudflare relay handles provider tokens, prompts and replies in transit. Then use `/connect → OpenAI → Codex device code (legacy)` and approve sign-in yourself. Keep the OpenCode authorization dialog open until OpenCode shows **Connected OpenAI**; the official approval page alone does not complete the token exchange. Closing the pending dialog cancels it, and attempts expire after ten minutes. Without a `credentialStore`, provider credentials and sessions stay in memory and are cleared on reload. The example uses the encrypted Passwords slot described above; sessions still stay in memory. The public free model can return a quota error; it is not a working provider connection.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `openCodeVariants`

Defined in `@/components/ui/open-code`. Base classes:

```text
group/open-code flex min-h-80 min-w-0 flex-col overflow-hidden bg-background font-sans text-foreground
```

**`variant`** — default `card`

| Value | Adds |
| --- | --- |
| `card` (default) | `rounded-card border border-border` |
| `plain` | — |
