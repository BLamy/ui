# OpenCode

OpenCode's real v2.2.4 terminal UI, rendered by OpenTUI WebAssembly, connected to a browser workspace. Files and shell tools use the same AlmostNode or agent-wasm container as the app being built. When a server starts, its port opens in a sandboxed iframe through the host's service worker.

{% demo src="open-code/vibecoder" %}

The [Vibecoder block](https://blamy.github.io/ui/#/blocks/vibecoder) starts OpenCode and the starter app automatically when it opens. Its HTTP server serves HTML, CSS, JavaScript and an API route from the virtual filesystem. Try the counter in the preview. With a provider connected, ask OpenCode to edit `index.html` or `style.css`; select **Reload** to see the change.

## Agent Browser MCP

Vibecoder automatically attaches an `agent-browser` MCP server to OpenCode. The server follows the selected app iframe across port changes and reloads. With a provider connected, try: **“Use the browser tools to inspect the preview, click the counter twice, and verify its updated text.”** OpenCode can take a semantic DOM snapshot, click its `@refs`, fill and append text, select options, press keys, wait for elements, read text and URLs, navigate within the current app, and reload it. A snapshot gives stable refs within one document; take another after navigation.

The embedded example's **Test browser tools** button calls the same host handlers used by MCP. It snapshots the live iframe, clicks its counter, reads the updated value, navigates to an app URL, and reloads to check reconnection. This check does not call a model. The OpenCode browser backend smoke page separately verifies real MCP discovery, host instructions, and tool calls through its upstream MCP client.

The browser demo uses an **iframe adapter compatible with a subset of [Agent Browser's MCP tools](https://github.com/vercel-labs/agent-browser)**. The upstream native Rust/CDP server cannot execute inside the WASM container. This adapter uses DOM events inside the preview, including form submission and focus handling. Events are synthetic; it does not offer native screenshots, arbitrary tabs, CDP or trusted pointer events. Only supported arguments are advertised. Its snapshots describe DOM semantics rather than the browser's native accessibility tree.

The adapter is installed into HTML responses at the host bridge before the unchanged AlmostNode service worker serves them. A separate MessageChannel carries tool commands into that app document. The host checks the selected frame, origin and session. Navigation is restricted to the selected virtual port; the agent cannot use these tools to inspect the host terminal, provider connection dialog, parent storage or another browser tab. App HTML must allow the injected script under its Content Security Policy. Closing or replacing a frame cancels pending calls. Navigation and reload create a fresh worker scope and repeat its handshake. App paths and query parameters travel in a URL fragment that stays in the browser, so the static Cloudflare host does not receive them.

MCP stays inside the browser and uses OpenCode's upstream MCP client, tool registry and permission checks. No provider proxy is involved in executing browser tools. Provider access is still required for the model to decide which tools to call. Set `browserTools={false}` to disable the iframe tools. Hosts may also supply `mcpServers` on `OpenCodeHostBridge` to attach other trusted in-page MCP implementations; each provides a versioned tool catalog and an asynchronous `callTool(name, args, signal)` handler. The runtime must advertise `capabilities.hostMcp: 1`.

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

## Service worker

Previews use the **unchanged AlmostNode service worker shipped in `@agent-wasm/core` 0.4.0**. The default preview host serves that worker under `https://bl-cors-proxy.brett-lamy.workers.dev/opencode-preview/<session>/`. A bootstrap page transfers a MessagePort directly from BL UI to the worker. Its existing `/__virtual__/<port>/` requests reach the owning container's `ServerBridge.handleRequest()` through that channel. App files and responses stay in the browser; Cloudflare serves the static bootstrap and worker.

The preview frame registers the worker without reloading the host page. Only servers whose `ownerId` matches the container are exposed; auxiliary servers stay hidden. Port closures remove their previews. Stop disposes factory-owned containers and their servers; borrowed containers keep running.

Requests go to the virtual HTTP server through AlmostNode's worker, including scripts, styles, API requests and forms. A new port opens automatically; the toolbar switches ports, reloads or closes the selected preview. Frames allow scripts, forms and their own origin so service workers work. Their origin must differ from the host page's origin, keeping the preview app away from the parent's DOM and storage. `previewRuntimeUrl` selects a self-hosted bootstrap/worker deployment. The host validates the frame, origin, session and selected owned port before forwarding HTTP requests.

Existing applications can still register their own AlmostNode worker with Vite's `almostnodePlugin()` from `@agent-wasm/core/vite`, or copy `getServiceWorkerContent()` from `@agent-wasm/core/next`. `serviceWorkerUrl` on the adapter opts into that host-page registration too. The isolated preview uses its own worker scope. Use HTTPS or localhost.

## Custom host bridge

Use `OpenCodeHostBridge` for another runtime. Supply `id`, `directory`, `workspaceBridge` and `processBridge`. Add `previews.ready`, `previews.list`, `previews.subscribe` and `previews.fetch` to enable port previews; `setTarget` forwards HMR messages into the selected frame. The bundled adapter supports text files and commands with shell pipes; a custom process bridge is needed for piped stdin. HTTP responses are buffered by the container adapter; arbitrary WebSocket servers need additional host support.

```tsx
<OpenCode host={bridge} loadRuntime={() => import('./opencode-runtime')} />
```

The default trusted runtime module is [the OpenCode fork on GitHub Pages](https://blamy.github.io/opencode/runtime.js). It downloads and starts when the component mounts. Pass `autoStart={false}` to wait for the Start button. `runtimeUrl` points to a self-hosted copy; `loadRuntime` can return a bundled implementation of the same `mount()` contract. Upstream installs document-wide terminal state, so only one OpenCode runtime can run per document. Multiple components can remain idle.

## Provider connection

Select **Connection** for the Tailscale/Cloudflare explanation. Tailscale routes provider traffic through your online exit node. The public Cloudflare relay handles provider tokens, prompts and replies in transit. Then use `/connect → OpenAI → Codex device code (legacy)` and approve sign-in yourself. Provider credentials and sessions stay in memory and are cleared on reload. The public free model can return a quota error; it is not a working provider connection.

## Props

| Prop                         | Purpose                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| `host` / `createHost`        | Borrow a host or create an owned one when starting. Choose one. |
| `runtimeUrl` / `loadRuntime` | Hosted browser module or custom runtime loader.                 |
| `previewRuntimeUrl`          | Separate-origin AlmostNode worker/bootstrap host.               |
| `title`                      | Accessible component and frame name. Defaults to `OpenCode`.    |
| `height`                     | Component height in pixels. Defaults to `620`.                  |
| `theme`                      | `dark` or `light`. Changing it restarts the session.            |
| `autoStart`                  | Start on mount. Defaults to `true`; `false` enables manual Start.                            |
| `browserTools`               | Attach the iframe browser MCP tools. Defaults to `true`.        |
| `onReady`                    | Receives the mounted runtime session and host.                  |
| `onStateChange`              | Observes idle, starting, running, error and stopped.            |

For small programs embedded in an AI response, use [TuiPreview](https://blamy.github.io/ui/#/tui-preview). Mount `OpenCode` when the response needs a complete editable workspace and app previews. An AI response must not provide an untrusted runtime module URL.
