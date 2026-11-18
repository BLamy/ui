---
description: What an app changes for 6.0 — one install, docstream's and UI SDK's new names, and the names that moved from the package root to a library's entry.
---

# Migrating

6.0 is where the plan lands, so there is one move to make and no later one: no split into packages to follow, and no 7.0 that takes re-exports away. This page is the short version of what an app changes because of the packaging. The full guide, with every renamed component and prop, is [Migrating to 6.0](https://blamy.github.io/ui/#/migrating-to-6).

## Install one package

{% command %}npm install @brett_lamy/ui{% endcommand %}

| In your `package.json` before | From 6.0 |
| --- | --- |
| `@brett_lamy/ui` 5.x | `@brett_lamy/ui` 6.0 |
| `@brett_lamy/docstream`, `@brett_lamy/docstream-editor` | remove them: both are inside `@brett_lamy/ui` |
| `@ui-sdk/core`, `@ui-sdk/react`, if you added upstream's packages yourself | remove them: UI SDK is inside `@brett_lamy/ui` |

## If you use @brett_lamy/docstream or @brett_lamy/docstream-editor

They stop at **2.0.1**. From `@brett_lamy/ui` 6.0 they are part of the library: the same modules, under the library's name. Install the library instead, and rename the imports:

| Before (2.0.1) | From 6.0 |
| --- | --- |
| `npm install @brett_lamy/docstream @brett_lamy/docstream-editor` | `npm install @brett_lamy/ui` (it brings both) |
| `@brett_lamy/docstream` | `@brett_lamy/ui/docstream` |
| `@brett_lamy/docstream/<entry>` (`site`, `gitbook`, `replay`, `stl`, `strudel`, …) | `@brett_lamy/ui/docstream/<entry>` |
| `@brett_lamy/docstream/styles.css` | `@brett_lamy/ui/docstream/styles.css` |
| `@brett_lamy/docstream-editor` | `@brett_lamy/ui/docstream-editor` |
| `@brett_lamy/docstream-editor/<entry>` (`editor`, `convert`, `styles.css`) | `@brett_lamy/ui/docstream-editor/<entry>` |

The components and the Markdown are 2.0.1's; their props take the kit's spellings (`streaming`, `onValueChange(value, details)`, `defaultTime`…, with no aliases), and they draw with the kit's icons, so `lucide-react` is gone. Optional peers stay optional (`@brett_lamy/viz-engine` for the viz fence), and one of 2.0.1's dependencies becomes an optional peer: install `xstate` yourself if your pages draw `xstate` fences. Import `@brett_lamy/ui/docstream/styles.css` yourself, as with 2.0.1: no JavaScript module of the package imports CSS. The editor's stylesheet is already inside `@brett_lamy/ui/styles.css`; import `@brett_lamy/ui/docstream-editor/styles.css` only in an app that doesn't load the kit's. Two things come with the library that 2.0.1 didn't have: the `capnp` fence draws a workerd config on a CloudflareDiagram, and the `xstate` fence draws a machine on a read-only StateDiagram. The full list, with the stylesheet order, is in the 6.0 migration guide's [Docstream section](https://blamy.github.io/ui/#/migrating-to-6#docstream-is-part-of-the-library).

{% hint style="info" %}
The version of docstream you get is the library's: `@brett_lamy/ui@6.0.0` carries docstream as it was when 6.0 shipped. There is no separate version to keep in step any more.
{% endhint %}

## If you import UI SDK yourself

UI SDK ships inside the package, and every one of its entries is an entry of `@brett_lamy/ui`. Wherever UI SDK's docs say `@ui-sdk/…`, write `@brett_lamy/ui/sdk/…`:

| UI SDK's docs | In your code |
| --- | --- |
| `@ui-sdk/core` | `@brett_lamy/ui/sdk/core` |
| `@ui-sdk/core/gesture` | `@brett_lamy/ui/sdk/core/gesture` |
| `@ui-sdk/react/dialog` | `@brett_lamy/ui/sdk/react/dialog` |

Do not install upstream's `@ui-sdk/*` beside the package: a second copy would not share the kit's layer stack and focus state.

## If you import from the package root

`@brett_lamy/ui` exports the core and the foundation under it (Tokens, Motion, Icons). A name that belongs to another library is imported from that library's entry, or from its module's entry as before:

| These names | Import from |
| --- | --- |
| Calendar, DateInput, DatePicker, NaturalTimeInput, CronEditor | `@brett_lamy/ui/time` |
| Canvas, PencilKit | `@brett_lamy/ui/canvas` |
| Diagram, DiagramFrame, StateDiagram | `@brett_lamy/ui/diagram` |
| Waveform, NowPlayingBars, StrudelPlayer | `@brett_lamy/ui/audio` |
| VideoPreview, VideoTimeline, Filmstrip | `@brett_lamy/ui/video` |
| MarkdownView, MarkdownEditor, StlViewer, TuiPreview | `@brett_lamy/ui/markdown` |
| Composer and its parts, Conversation, MessageScroller, ArtifactChatContainer | `@brett_lamy/ui/composer` |
| ReplayPreview, the session-recording hooks | `@brett_lamy/ui/replay` |
| SqlConsole | `@brett_lamy/ui/sql` |
| The filter bar and its parts, FilterInput | `@brett_lamy/ui/filter` |
| `usePersistentState` | `@brett_lamy/ui/sync` |
| VaultGate and its parts | `@brett_lamy/ui/vault` |
| The Tailscale controls | `@brett_lamy/ui/tailscale` |
| OpenCode | `@brett_lamy/ui/opencode` |

```tsx
// before
import { Button, Calendar, MarkdownView } from '@brett_lamy/ui'

// now
import { Button } from '@brett_lamy/ui'
import { Calendar } from '@brett_lamy/ui/time'
import { MarkdownView } from '@brett_lamy/ui/markdown'
```

The names are the same; only the path changes. The guide lists every one of them, module by module: [Names that left the root](https://blamy.github.io/ui/#/migrating-to-6#names-that-left-the-root).

An app that already imports each part from its module's entry (`@brett_lamy/ui/calendar`, `@brett_lamy/ui/markdown-view`) changes nothing here. Four of those paths are a library's entry now, because the library is named after its main module: `@brett_lamy/ui/canvas`, `/diagram`, `/composer` and `/filter` export what they did and the rest of their library with it.

## If you copy source with the registry

Items keep their names, their paths and their `@/components/ui/<x>` imports. Two things are new:

- **UI SDK comes from the package.** It is not copied: an item whose files use it adds `@brett_lamy/ui` to your dependencies, and the copied files import `@brett_lamy/ui/sdk/…`. Docstream already worked this way.
- **A library is one item.** `library-<entry>` installs every item of a library; `library-ui` is the core.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/library-time.json{% endcommand %}

The move from 5.x to 6.0 changes the components themselves; that is the guide's subject: [Migrating to 6.0](https://blamy.github.io/ui/#/migrating-to-6).

## Stylesheets

`@brett_lamy/ui/styles.css` covers every library in the package, and `@brett_lamy/ui/theme.css` is the optional iOS palette. Docstream keeps its own sheet, `@brett_lamy/ui/docstream/styles.css`, which the parts that render Markdown need. There is no stylesheet per library to import.

## The docstream shims

`ReplayPreview`, `StlViewer`, `StrudelPlayer` and `TuiPreview` are thin components that re-export docstream widgets for the kit's docs and registry. With docstream inside the library they stay: they are the kit's entries for those widgets (`@brett_lamy/ui/replay-preview`, and with their libraries on `@brett_lamy/ui/replay`, `/markdown` and `/audio`), and the registry items that copy them.
