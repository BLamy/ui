# Tailscale request router

A service worker that sends a page's requests to the tailnet. Once it is installed and the page is [signed in to Tailscale](https://blamy.github.io/ui/#/tailscale-login), a plain `fetch('http://nas.tail1234.ts.net/photos')`, an `<img src="http://100.101.102.103/cam.jpg">` or a library's `XMLHttpRequest` reaches the device on your tailnet, and nothing in that code knows about Tailscale. Requests the policy does not name are not touched: the worker does not even answer them, so the browser handles them as if it were not there.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/tailscale-router.json{% endcommand %}

Copies the source into your project's `lib/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  TailscaleRouter, useTailscaleRouter,
} from '@/lib/tailscale-router/react'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { TailscaleRouter, useTailscaleRouter } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

{% demo src="tailscale-router/intercept" %}

The demo's service worker is real (the library's `tailscale-sw.js`, registered on this site); the tailnet behind it is the in-memory fake, so it works without an account. `*.ts.net` names do not exist on the public internet, which is why a request sent while signed out fails.

## Set up

**1. Serve the worker from your site's root.** A service worker only controls pages under the path it is served from, so it cannot live in your bundle's hashed assets.

- shadcn CLI: the `tailscale-router` item installs it as `public/tailscale-sw.js`.
- npm: copy it from the package, for example in a `postinstall` script: `cp node_modules/@brett_lamy/ui/dist/tailscale-sw.js public/`. It is also exported as `@brett_lamy/ui/tailscale-sw.js` for tools that copy by specifier.
- Next.js: the same file in `public/`. Any other host: serve it at `/tailscale-sw.js` with a JavaScript content type, and keep it out of long-lived caches (the router registers it with `updateViaCache: 'none'`, so the browser checks for a new version on every registration).

It is a plain classic script with no imports and no build step, so copying is all there is to it.

**2. Mount the router next to the connection.**

```tsx
import { TailscaleProvider } from '@/lib/tailscale-react'
import { TailscaleRouter } from '@/lib/tailscale-router/react'

<TailscaleProvider options={{ client }}>
  <TailscaleRouter policy={{ hosts: ['*.corp.example'], cidrs: ['192.168.1.0/24'] }} />
  <App />
</TailscaleProvider>
```

`useTailscaleRouter(options)` is the same as a hook and returns `{ status, detail, routed, policy, router }`. Without React: `registerTailscaleRouter({ tailscale, policy })` returns a handle with `ready`, `getState()`, `subscribe()`, `dispose()` and `unregister()`. Any object with `fetch`, `getSnapshot` and `subscribe` can stand in for the controller.

## How it works

1. `registerTailscaleRouter` resolves the policy and registers `tailscale-sw.js?p=<policy>`: **the policy is part of the script URL**. The worker reads it from its own location each time it starts, so it knows what to route the moment it wakes, and no message can change it. A different policy is a different script, which the browser installs in place of the old one.
2. The worker activates at once (`skipWaiting`, `clients.claim()`), so the first page load is controlled without a reload.
3. The page sends the worker one end of a `MessageChannel` and says whether it is connected; it updates that whenever the connection changes.
4. For each request a controlled page makes, the worker runs the policy. No match: it returns without calling `respondWith`. Match: it reads the request body (up to `maxBodyBytes`), passes the request to a connected page over its port, and builds the `Response` from what comes back: the status and headers first, then the body as chunks, so a client that streams is streamed.
5. The page checks the request against the policy again, asks your `shouldRoute`, and sends it through `tailscale.fetch`. If the page is not connected, or `shouldRoute` says no, the worker sends the original request to the network (or answers 503, with `whenUnavailable: 'error'`).
6. Browsers stop idle workers after about thirty seconds, which drops the port. The next matching request wakes the worker, which asks its windows to attach again and waits up to 1.5 s for one.

A routed response carries `x-bl-tailscale: routed`; a fail-closed one `x-bl-tailscale: unavailable`. Cross-origin requests in `cors` mode also get `Access-Control-Allow-Origin` (your origin), `-Allow-Credentials` and `-Expose-Headers`, so the page can read them; no preflight is sent, because a request the worker answers never reaches the network.

## The policy

{% demo src="tailscale-router/policy" %}

The default routes only what looks like it lives on a tailnet: `*.ts.net` names (every tailnet's MagicDNS suffix), `100.64.0.0/10` and `fd7a:115c:a1e0::/48` (Tailscale's address ranges). Add what else your tailnet serves:

| Field | Default | Effect |
| --- | --- | --- |
| `hosts` | `[]` | `api.internal` (exactly), `*.corp.example` (its subdomains), `.corp.example` (the domain and subdomains), or an address or range. |
| `cidrs` | `[]` | Subnet routes, `192.168.1.0/24`, `fd00:1::/64`. A bare address is a /32 or /128. |
| `shortNames` | `false` | MagicDNS short names (`http://nas/`: one label, no dot). Off so a typo does not leave the browser. |
| `intercept` | `tailnet` | `all` routes every cross-origin request (an exit node's job; see Limits). |
| `exclude` | `[]` | Hosts and ranges never routed, even with `all`. |
| `schemes`, `methods` | both, all | Narrow by scheme or method. |
| `sameOrigin` | `false` | Also route the page's own origin. |
| `whenUnavailable` | `network` | `error`: a matched request answers 503 rather than going to the public network. |
| `maxBodyBytes` | 32 MiB | Bigger request bodies are not routed. |
| `timeoutMs` | 60 000 | How long to wait for the response headers (then 504). |

Never routed, whatever the policy says: navigations, anything that is not http(s), loopback (`localhost`, `*.localhost`, `127.0.0.0/8`, `::1`), and the page's own origin unless `sameOrigin`. A host or range that cannot be read throws `TailscalePolicyError`, and so does `hosts: ['*']`: routing everything is `intercept: 'all'`, a choice you spell out.

`shouldRoute(request)` has the last word in the page, for rules a static list cannot express. It runs only for requests the policy already matched; return false to send one to the network.

`matchTailscalePolicy(url, method, resolveTailscalePolicy(policy), origin)` answers the same question in the page (the demo above), with a `reason`. The worker carries its own copy of this matcher (it cannot import modules); the two are tested against one set of cases.

## Security

**What the worker can see.** Every request its policy matches, from every page it controls: the URL, the headers (except `Cookie`, which it drops) and the body. It passes them to a page of the same origin over a private port; nothing else is involved. Requests it does not match it never reads.

**Who can serve requests.** Only top-level windows of the same origin can attach: same-origin iframes (user content served from your origin, say) and workers are ignored.

**The limit.** Same-origin script is inside the boundary. Script on your page can register a different worker at the same scope, unregister this one, or attach a port of its own and receive the routed requests. This router is no defence against cross-site scripting or a compromised dependency; a Content Security Policy and careful dependencies are.

**Defaults.** The policy is an allowlist; routing everything is explicit; the page's own origin and loopback are never routed; the policy cannot be changed by a message; the sign-in URL must be https. Prefer `whenUnavailable: 'error'` when a request for a private name must never reach the public network, and `exclude` for hosts that must never go through the tailnet.

## Constraints

- **Secure context**: service workers exist only on HTTPS and `localhost`. Elsewhere `status` is `unsupported` with a reason. Some private windows disable them.
- **Scope**: a worker served at `/tailscale-sw.js` controls the whole origin; served from a sub-path it controls only that path (pass `scope`). One registration per scope: two routers with different policies on one page would replace each other's worker, so mount one.
- **First load and hard reloads**: the worker claims the page as soon as it activates. A hard reload (Shift-reload) bypasses service workers by design; the status is then `uncontrolled` until a normal reload.
- **Updates**: changing the policy or the file installs a new worker in place of the old one; pages attach to it again automatically. `dispose()` leaves the worker installed (idle) for the next visit unless `unregisterOnDispose`; `unregister()` removes it.
- **Navigations are not routed**: links, iframes and `location` changes to another origin are not requests from a controlled page, so a worker cannot answer them. Use `fetch` (or an `<img>`, `<video>`, script, stylesheet, font: subresources are routed).
- **WebSockets** are not requests a worker sees. **EventSource** is, but the WebAssembly client returns whole bodies, so a stream arrives when it ends.
- **Streaming**: the worker streams whatever the client gives it; the WebAssembly client buffers. Request bodies are always read whole (up to `maxBodyBytes`).
- **Redirects**: the client follows them (`redirect: 'follow'`); `manual` returns the 3xx as is, not an opaque redirect; `error` fails.
- **Credentials and cookies**: the browser's cookies are not sent and `Set-Cookie` in a routed response is ignored (a response a worker makes never touches the cookie jar). Use `Authorization` headers for tailnet services.
- **CORS**: the worker answers cross-origin requests with your origin allowed, so your page can read tailnet responses; the tailnet server's own CORS headers do not matter.
- **Mixed content**: on an https page, a request for `http://100.x.y.z/` is blocked by the browser's mixed-content rules, by the Fetch specification before the worker sees it (from the specs; not verified here). Use `https://<device>.<tailnet>.ts.net` names (Tailscale can issue certificates for them; TLS is then done inside the client) or serve the page from `localhost` while developing.
- **Another tab**: the worker hands requests to whichever attached tab is connected, so a tab without its own connection still reaches the tailnet while one tab has it.

## Verified

In Chromium (Playwright, `tools/e2e/tailscale.e2e.mjs`), against the demo: the worker registers and controls the page; plain `fetch` calls to a `*.ts.net` name and to `100.101.102.103` are answered through the (fake) tailnet; a cross-origin `cors` fetch is readable; a 70 kB binary request body round-trips byte for byte; a streamed response arrives in parts over time; same-origin requests are not routed; signed out, matching requests go to the network; after a reload the worker routes again; `unregister()` removes it. Unit tests run the worker script itself in a fake service-worker global: matching parity, fallback and fail-closed, `shouldRoute`, body limits, timeouts, iframe owners ignored, and re-attachment after a restart. Not tested: other browsers, and a real tailnet behind the worker.
