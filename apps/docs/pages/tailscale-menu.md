# Tailscale menu

The Tailscale connection as a menu, for a popover or a menu-bar extra: where you are connected (the tailnet and this device), the exit node chooser, and sign out. It reads the nearest [`TailscaleProvider`](https://blamy.github.io/ui/#/tailscale-login) and changes the exit node through `onExitNode` (default `tailscale.setExitNode`). The exit nodes read as a radio list (Safari's shield menu) or as a list of networks, like macOS's Wi-Fi menu.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/tailscale-menu.json https://blamy.github.io/ui/r/tailscale.json https://blamy.github.io/ui/r/tailscale-connect.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { TailscaleProvider } from '@/lib/tailscale-react'
import { TailscaleMenu } from '@/components/ui/tailscale-menu'
import { createTailscaleConnectClient } from '@/lib/tailscale-connect'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  TailscaleProvider, TailscaleMenu, createTailscaleConnectClient,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

{% demo src="tailscale-menu/menu" %}

The demo is real: it runs Tailscale's client and needs a Tailscale account; approve the sign-in popup and the menu lists the exit nodes of your tailnet. Read [Limits](https://blamy.github.io/ui/#/tailscale-login) before you rely on the real client.

## Variants

```tsx
<PopoverContent aria-label="Tailscale connection">
  <TailscaleMenu variant="radio" onExitNode={choose} detail="3 pages and 9 requests this session." />
</PopoverContent>

<TailscaleMenu variant="networks" />
```

| `variant` | Exit nodes | Offline device |
| --- | --- | --- |
| `radio` (default) | A react-aria `RadioGroup`: "None: your devices only", then one radio per device. | Its name ends in "(offline)"; still selectable. |
| `networks` | A react-aria `ListBox`, like the Wi-Fi menu: **None** at the top, a leading check on the one in use, the name, a trailing glyph (`glyph` replaces it). | Dimmed, "Offline" underneath, not selectable. |

While a change is under way the row says **Connecting…** (with a spinner in `networks`) and the list ignores further presses; if `onExitNode` rejects, its message shows under the list. Arrow keys move through the rows.

## Parts

| Export | What it is |
| --- | --- |
| `TailscaleMenu` | The column: summary, optional `detail` line, the exit nodes under `heading` (default "Exit node", `null` hides it), `children`, and the sign-out button. `exitNodes={false}` and `signOut={false}` leave those out. |
| `TailscaleMenuSummary` | "Connected to *tailnet*" and "As *this device*". |
| `TailscaleExitNodes` | The chooser alone: `variant`, `onExitNode`, `labels` (`group`, `none`, `noneDetail`, `offline`, `connecting`, `empty`, `failed`), `glyph(peer, { active, connecting, online })`. |

All take `tailscale` (a controller; default the provider's), `className`, and carry `data-slot` (`tailscale-menu`, `tailscale-menu-summary`, `tailscale-exit-nodes`) and `data-variant`.

## Choosing an exit node

`pickExitNode(snapshot, { exclude, prefer })` returns the id of the best exit node, or `null`. It considers only peers that offer to be an exit node, have an id and are **online**; it takes `prefer` (the one used before) if that still qualifies, else the first by name; `exclude` leaves out ids (the node that just failed). It does not talk to the controller:

```ts
import { pickExitNode } from '@/lib/tailscale-exit'

const id = pickExitNode(tailscale.getSnapshot(), { prefer: lastUsed })
if (id) await tailscale.setExitNode(id)
```

`exitNodePeers(snapshot)` lists the candidates (offline ones included, by name), `exitNodeOnline(snapshot)` says whether the exit node in use is up, and `exitNodeName(peer)` is the first DNS label. The [Safari block](https://blamy.github.io/ui/#/blocks) uses them to pick an exit node for you when a public site needs one.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `tailscaleMenuVariants`

Defined in `@/components/ui/tailscale-menu`. Base classes:

```text
flex flex-col
```

**`variant`** — default `radio`

| Value | Adds |
| --- | --- |
| `radio` (default) | `gap-3` |
| `networks` | `gap-2` |

### `tailscaleExitNodesVariants`

Defined in `@/components/ui/tailscale-menu`. Base classes:

```text
flex flex-col
```

**`variant`** — default `radio`

| Value | Adds |
| --- | --- |
| `radio` (default) | `gap-1.5` |
| `networks` | `gap-1` |
