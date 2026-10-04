# Blocks

Whole apps composed from BL UI parts, in the spirit of shadcn blocks. A block is a few readable files that import the library's parts by alias (`@/components/ui/…`) plus components of its own — the complex, product-specific ones (a terminal dock, a chat shell, a tile map) live in the block, not in the library. Preview it at any width, read the code, and add it to your app with the shadcn CLI: the block's files land in `components/blocks/<name>/`, and only the library parts it imports are copied with it.

{% demo src="blocks/discord-clone" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/discord-clone.json{% endcommand %}

{% demo src="blocks/github-clone" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/github-clone.json{% endcommand %}

{% demo src="blocks/t3-clone" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/t3-clone.json{% endcommand %}

{% demo src="blocks/codex-clone" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/codex-clone.json{% endcommand %}

{% demo src="blocks/macos" layout="multi" %}

The macOS block is a desktop whose apps are the blocks on this page — Reminders, Mail, Safari, Notes, Music, Passwords, System Settings, Time Machine, Maps, Delivery, Freeform, GitHub, Discord, Codex, T3 Code and Loop QA; the Dock and Alfred open them in windows — so adding it also adds each of them; delete an entry from its `apps.ts` (and the block it imports) to trim the desktop.

The menu bar has two working status items. **Wi-Fi** opens a macOS-style menu: a switch (off only dims the glyph), the network you are on with a check, nearby networks with a lock and signal bars (all invented), and *Network Settings…*, which opens the Settings app. **Tailscale** shows the Tailscale mark, dim until you are connected and with a dot while an exit node is in use. Connected, it opens the core [TailscaleMenu](https://blamy.github.io/ui/#/tailscale-menu) in its `networks` variant, so exit nodes read like Wi-Fi networks (a check for the one in use, the name, a signal glyph, *Connecting…* while it switches, *None* on top); signed out, it opens the sign-in. The desktop owns one Tailscale controller, the real Tailscale, whose WebAssembly client loads only when someone signs in, and it gives that same controller to the Safari window: sign in from the menu bar or from Safari's gate, and an exit node chosen in either shows in both. Pass `tailscale` (controller options) or `controller` to use your own.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/macos.json{% endcommand %}

{% demo src="blocks/apple-reminders" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-reminders.json{% endcommand %}

{% demo src="blocks/apple-settings" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-settings.json{% endcommand %}

{% demo src="blocks/apple-mail" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-mail.json{% endcommand %}

{% demo src="blocks/apple-notes" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-notes.json{% endcommand %}

{% demo src="blocks/apple-passwords" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-passwords.json{% endcommand %}

{% demo src="blocks/apple-music" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-music.json{% endcommand %}

{% demo src="blocks/loop-qa" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/loop-qa.json{% endcommand %}

{% hint style="info" %}
**Blocks land in `components/blocks/<name>/`.** Render the default export from `page.tsx` in a sized container — blocks fill their parent and adapt to its width, not the window's.
{% endhint %}

{% demo src="blocks/map-chat" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/map-chat.json{% endcommand %}

{% demo src="blocks/delivery-tracking" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/delivery-tracking.json{% endcommand %}

{% demo src="blocks/pencilkit-sketch" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/pencilkit-sketch.json{% endcommand %}

{% demo src="blocks/timemachine" layout="multi" %}

Time Machine plays back the sessions the macOS block records. Each page load is an rrweb recording stored as an append-only stream in localStorage — private to the browser by default — via `useSessionRecording` (`@/lib/session-recorder`), built on `LocalStreams` (`@/lib/append-stream`). Switch on Cloud sync in the app and `CloudSync` (`@/lib/durable-streams`) mirrors the same streams live to a Durable Streams server, such as one on Rivet. The app is marked `rr-block rr-ignore`, so the recorder never records a replay of itself.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/timemachine.json{% endcommand %}

{% demo src="blocks/freeform" layout="multi" %}

Freeform is the PencilKit core grown into a whole app: boards in a gallery, and an infinite canvas of sticky notes, shapes, text, photos, links, connectors that stay glued to what they join, and freehand drawing (the core's strokes, inks and tool palette). Scroll to pan, pinch or ⌘-scroll to zoom, drag to move, and use the handles to resize and rotate.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/freeform.json{% endcommand %}

{% demo src="blocks/safari" layout="multi" %}

Safari is a browser that only browses through your tailnet, on the real Tailscale. It opens on a gate: nothing works until Tailscale is connected (a saved session is restored without a prompt, and signing out brings the gate back), and the browser behind it is `inert`. Press **Sign in with Tailscale** and Tailscale's own sign-in opens in a popup; the client (Tailscale's Go code as WebAssembly, about 26 MB) is downloaded on that press and not before, and the device lives for the tab. Then it is a tabbed browser with per-tab history, an address field that suggests your tailnet's devices, a tab overview, a start page that reports what was loaded, and a shield menu to see the connection, **choose an exit node** and sign out.

A tailnet on its own reaches your devices (by name or `100.x` address) and subnet routes. To open a public site an exit node carries the traffic, while the DNS lookup for a public name is, as in almostnode, a DNS-over-HTTPS request from the page itself (the client cannot resolve public names), and the address is handed to the client (`ipMap`) so the page is fetched by name through the exit node; if the client ignores the map, Safari dials the address with the name as `Host` and TLS name. That lookup does show the name to the DNS server (`dnsVia: 'exit-node'` sends it through the exit node instead). When the exit node cannot carry a page, the error page shows the client's own error. Safari picks the exit node for you: opening a public address with none set selects the best online one (the one used last, else the first by name; `pickExitNode`) and then loads the page. The shield menu (the core `TailscaleMenu`) can change or clear it; choosing *None: your devices only* is remembered, so a public address then shows why it fails, and **Try Again** turns an exit node back on. Try Again also swaps an offline or failing exit node for another online one, and shows *Connecting…* while it does. With no online exit node a public address fails with an explanation; that is the point of the gate. Your tailnet needs a device offering one: `tailscale set --advertise-exit-node`, approved in the admin console.

Every document, stylesheet, image and form is fetched by the page itself with `tailscale.fetch`, which has no fallback to the public network (it rejects while disconnected), and shown as a sealed document: scripts, frames, plug-ins and media are removed, assets are inlined as data URLs, and the frame carries a `Content-Security-Policy` of `default-src 'none'` and no scripting, so the page cannot make a request of its own. That is why it does not use the service worker router: a worker cannot see navigations or frames, and an `http://` subresource on an https page is blocked before it reaches one.

**What that means in use: it is a document browser, not an app runtime.** A page that needs JavaScript (a single-page app, a video site such as youtube.com) shows only what its HTML contains, so even through an exit node it will not work. Pages that are server-rendered (documentation, Wikipedia, Hacker News, your own apps' dashboards) do. Running scripts without opening a way around the tailnet would need a different design, such as a remote browser on your tailnet.

The default is the real Tailscale; the block imports the WebAssembly file's URL from `wasm-url.ts` (a Vite `?url` import: swap it for your bundler's equivalent). Pass `tailscale` for other options or a `controller` you made yourself:

```tsx
import Safari, { tailnetOptions } from '@/components/blocks/safari/page'
import { webStorageTailscalePersistence } from '@/lib/tailscale'

// Keep the device across visits (the node's keys go in localStorage), on your own Headscale server:
<Safari tailscale={{ ...tailnetOptions(), controlUrl: 'https://headscale.example', persistence: webStorageTailscalePersistence(localStorage, 'safari') }} />
```

**What is verified.** In Chromium (`tools/e2e/safari.e2e.mjs`), on an in-memory tailnet used as test tooling (a dev-only test page, not a demo; it has a few sites, an exit node and a stand-in for the public internet): the gate, sign-in, pages with their stylesheets and images, links, forms (GET and POST), redirects, back and forward, tabs, the exit node (a public address picks an online exit node by itself and loads through it), and that no request leaves the page. Unit tests cover the loader's sealing and the exit-node plumbing. Against the real client, the same Chromium run checks that the WebAssembly loads only on the press and that the sign-in reaches Tailscale's real control plane and opens its real login page. **Not verified here:** a completed sign-in and real traffic, including through an exit node (that needs a Tailscale account), and the real client's behavior with the DNS lookups and `Host`/TLS-name handling for public sites, which follows almostnode's approach but is untested against a live exit node. The client relays over DERP only (no direct connections), buffers whole bodies, and carries HTTP only.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/safari.json{% endcommand %}

{% demo src="blocks/split-view-demos" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/split-view-demos.json{% endcommand %}

## Anatomy of a block

A block is a folder in `registry/blocks/<slug>/`. Adding it copies the folder to `components/blocks/<slug>/` in your app, plus the library parts it imports and no others.

```text
components/blocks/discord-clone/
  page.tsx              the default export: the whole app, sized by its parent
  data.ts               sample data you replace with your own
  channel-message.tsx   parts of this product
  thread-view.tsx
  chat-theme.css        the block's theme scope
  components/
    chat-shell.tsx      block-local components (the shell is this product's, not the library's)
    message.tsx         with its own cva recipe, messageVariants
    channel-list.tsx
    …
```

`meta.json` describes it to the registry:

```json
{
  "name": "discord-clone",
  "title": "Discord clone",
  "description": "A team chat in Discord's shape: …",
  "categories": ["chat", "application"],
  "files": ["page.tsx", "channel-message.tsx", "components/message.tsx", "chat-theme.css", "…"],
  "dependencies": ["class-variance-authority", "react-aria-components"]
}
```

`files` are the files copied. `dependencies` are the npm packages the block itself imports beyond React; the library parts it needs come from its imports.

**What goes in a block, and what in the library.** The library holds parts that work in any product: buttons, lists, split views, the Composer, the theme. A block holds what only makes sense in one product: a Discord-style `ChatShell`, the T3-style `WorkbenchShell`, terminal and surface panels, a `ModelPicker`, a `TileMap` with its geography, sample data, and the palette that product wears. If a piece would be useful in a second, unrelated product, it belongs in the library; if it names a product or a domain, it belongs in the block. Block-local components can have block-local `cva` recipes ([Styling and variants](https://blamy.github.io/ui/#/styling)).

**Imports.** A block imports `react`, library parts by alias (`@/components/ui/<x>`, `@/lib/<x>`), its own files, and the packages listed in `dependencies`, and nothing else. The registry build fails on anything more, which is how a block stays copyable. Never import from `@brett_lamy/ui`.

**Adapting one.** You own the copy. Replace `data.ts` with your data source, delete the parts you do not want, change a recipe. Blocks that another page wants to reuse export their parts: the docs import `TileMap` from `@/components/blocks/map-chat/tile-map` and `ModelPicker` from `@/components/blocks/t3-clone/components/workbench/model-picker`.

See [How the registry works](https://blamy.github.io/ui/#/registry) for how a block becomes an item.
