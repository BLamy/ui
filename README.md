# BL UI

BL UI is an iOS-flavored React component library built on [UI SDK](https://ui-sdk.dev) and Tailwind CSS v4, in an Nx + pnpm monorepo. This repository holds the library, [`@brett_lamy/ui`](https://www.npmjs.com/package/@brett_lamy/ui): one npm package, and every library an entry of it (the core on the root, then `@brett_lamy/ui/time`, `@brett_lamy/ui/diagram`, `@brett_lamy/ui/audio` and the rest, with docstream, its editor and our build of UI SDK inside). It also holds the shadcn registry and its blocks, a Storybook catalog, and the [BL site](https://blamy.github.io/ui/): a landing page, a page per [library](https://blamy.github.io/ui/#/libraries), the kit's docs, docstream's docs and the [roadmap](https://blamy.github.io/ui/#/roadmap).

## Install

```sh
npm install @brett_lamy/ui
```

That is the whole install. UI SDK (the behavior layer), docstream and its editor ship inside the package, so there is no second package and no alias to add. React 19 is required. [Installation](https://blamy.github.io/ui/#/installation) has every step for Vite and Next.js, and the shadcn registry ([below](#shadcn-registry)) copies the same source into your app instead.

No JavaScript module of the package imports CSS (so every entry loads in plain Node): import the stylesheets once, at your app's entry.

```tsx
import '@brett_lamy/ui/styles.css' // always: the kit, with the Markdown editor's sheet in a layer
import '@brett_lamy/ui/theme.css' // optional: the iOS palette
import '@brett_lamy/ui/docstream/styles.css' // only if you render Markdown (below)
```

`@brett_lamy/ui/docstream/styles.css` is docstream's sheet. MarkdownView, MarkdownEditor, Composer, Conversation, ReplayPreview, TuiPreview, StlViewer, StrudelPlayer and docstream's own components (`@brett_lamy/ui/docstream/…`, DocsSite included) need it, after the kit's sheet; nothing else does. The editor's sheet (`@brett_lamy/ui/docstream-editor/styles.css`) is already inside `@brett_lamy/ui/styles.css`: import it yourself only in an app that doesn't load the kit's sheet, never both. With the registry, an item that needs a sheet adds the `@import` to your CSS.

Import each part from its module's entry, the registry's path under the package name (`@/components/ui/navigation-stack` is `@brett_lamy/ui/navigation-stack`), from its library's entry, or, for the core, from the root:

```tsx
import { Button } from '@brett_lamy/ui/button'
import { BLProvider } from '@brett_lamy/ui/lib/theme'
import { NavigationStack, NavigationStackBar, NavigationStackContent, NavigationStackPage, NavigationStackTitle } from '@brett_lamy/ui/navigation-stack'

export function App() {
  return (
    <BLProvider>
      <NavigationStack>
        <NavigationStackPage value="home">
          <NavigationStackBar><NavigationStackTitle>Home</NavigationStackTitle></NavigationStackBar>
          <NavigationStackContent>
            <Button onClick={() => alert('Hello')}>Say hello</Button>
          </NavigationStackContent>
        </NavigationStackPage>
      </NavigationStack>
    </BLProvider>
  )
}
```

The package is ESM with one output module per source module, so a bundler keeps only what you import. Coming from 5.x, or from `@brett_lamy/docstream` / `@brett_lamy/docstream-editor` (frozen at 2.0.1, now `@brett_lamy/ui/docstream…`): [Migrating to 6.0](https://blamy.github.io/ui/#/migrating-to-6).

### Libraries

The package root, `@brett_lamy/ui`, exports the core (controls, fields, popups, the iOS containers, the workbench parts) and the foundation under it: Tokens, Motion and Icons. Every other library is an entry of its own, so an app that imports the root never loads a library it does not use.

| Library | Import from | What it holds |
| --- | --- | --- |
| UI | `@brett_lamy/ui` | The core: Button, Dialog, Select, Tabs, NavigationStack, SplitView, Sidebar, List, Toolbar, DataTable, CodeEditor, Terminal… |
| Tokens | `@brett_lamy/ui/tokens` | `BLProvider`, `ThemeScope`, size classes, `cn` and `cx`, the syntax lexer |
| Motion | `@brett_lamy/ui/motion` | The springs, presence, TextMorph, NumberMorph, Morph, AnimatedHeight, Swap, Celebrate, edge swipe, pull to refresh |
| Icons | `@brett_lamy/ui/icons` | `Icon` and the file-type icons |
| Time | `@brett_lamy/ui/time` | Calendar, DateInput, DatePicker, NaturalTimeInput, CronEditor |
| Canvas | `@brett_lamy/ui/canvas` | Canvas and PencilKit |
| Diagram | `@brett_lamy/ui/diagram`, `@brett_lamy/ui/cloudflare` | Diagram, DiagramFrame, StateDiagram; CloudflareDiagram and the Cloudflare catalog on the second entry |
| Audio | `@brett_lamy/ui/audio` | Waveform, NowPlayingBars, StrudelPlayer, the playback clock |
| Video | `@brett_lamy/ui/video` | VideoPreview, VideoTimeline, Filmstrip, the FFmpeg renderer |
| Markdown | `@brett_lamy/ui/markdown` | MarkdownView, MarkdownEditor, StlViewer, TuiPreview |
| Composer | `@brett_lamy/ui/composer` | Composer and its parts, Conversation, MessageScroller, ArtifactChatContainer |
| Replay | `@brett_lamy/ui/replay` | ReplayPreview and the session recorder |
| SQL | `@brett_lamy/ui/sql` | SqlConsole |
| PGlite | `@brett_lamy/ui/pglite` | The PGlite hooks and helpers |
| Filter | `@brett_lamy/ui/filter` | The filter bar, FilterInput, the filter model |
| Sync | `@brett_lamy/ui/sync` | `usePersistentState`, local streams, the Durable Streams client |
| Vault | `@brett_lamy/ui/vault` | VaultGate and the passkey vault |
| Sandbox | `@brett_lamy/ui/sandbox` | Run code in a Worker with an origin of its own: a disk, a shell and npm on a Node-compatible runtime (`@agent-wasm/core`, an optional peer, loaded only when a sandbox starts) |
| Tailscale | `@brett_lamy/ui/tailscale` | The Tailscale client, its React hooks and controls |
| OpenCode | `@brett_lamy/ui/opencode` | The OpenCode component and its runtime (the loaders, the hosts, the vault stores) |
| Docstream | `@brett_lamy/ui/docstream`, `@brett_lamy/ui/docstream/<entry>` | The Markdown renderer, DocsSite and their entries (`/site`, `/gitbook`, `/replay`…) |
| Docstream Editor | `@brett_lamy/ui/docstream-editor` | The WYSIWYG editor for docstream Markdown |
| UI SDK | `@brett_lamy/ui/sdk/core`, `@brett_lamy/ui/sdk/react/<part>` | Our build of UI SDK, the behavior layer |

A name has two import paths and no more: its module's entry (`@brett_lamy/ui/waveform`) and its library's entry (`@brett_lamy/ui/audio`). The names of the core and the foundation are on the root as well. Each path costs an app the same: `pnpm size --check` fails when a name imported through a library entry or the root costs more than through its module's entry.

UI SDK is part of the package. Wherever UI SDK's docs say `@ui-sdk/…`, write `@brett_lamy/ui/sdk/…`: `@ui-sdk/core` is `@brett_lamy/ui/sdk/core`, `@ui-sdk/react/dialog` is `@brett_lamy/ui/sdk/react/dialog`. Do not install upstream's `@ui-sdk/*` beside it: a second copy would not share the kit's layer stack and focus state.

### shadcn registry

Every part also installs as source with the shadcn CLI, from the same files the package is built from:

```sh
npx shadcn@latest add https://blamy.github.io/ui/r/navigation-stack.json   # one part, with what it imports
npx shadcn@latest add https://blamy.github.io/ui/r/library-audio.json      # every part of a library
npx shadcn@latest add https://blamy.github.io/ui/r/apple-mail.json         # a block: a whole app
```

An item copies one component and only what it imports into `components/ui/` and `lib/`, and adds BL UI's tokens to your CSS (the base item, `bl-ui`, comes with every item); blocks land in `components/blocks/<name>/`. There is one `library-<entry>` item for each library entry, from `library-tokens` to `library-tailscale`, and `library-ui` for the core. UI SDK and docstream are not copied: an item whose files use either adds `@brett_lamy/ui` to your dependencies, and the copied files import `@brett_lamy/ui/sdk/…` and `@brett_lamy/ui/docstream/…`. See [How the registry works](https://blamy.github.io/ui/#/registry).

## Workspace layout

- `packages/ui` — the library, `@brett_lamy/ui`, the one package this repository publishes: shadcn-style parts on UI SDK, the iOS containers, icons, motion, theme, the Composer, PencilKit and the Diagram family (`src/components`, `src/lib`; files import each other as `@/components/ui/<x>` and `@/lib/<x>`, the paths a registry install uses), docstream and its editor (`src/docstream`, `src/docstream-editor`, published as `@brett_lamy/ui/docstream/<entry>` and `@brett_lamy/ui/docstream-editor/<entry>`), the library entries (`src/libraries/<entry>.ts`, generated: `@brett_lamy/ui/audio`), the UI SDK entries (`src/sdk`, generated: `@brett_lamy/ui/sdk/…`), and the hand-written Cloudflare and OpenCode entries (`src/cloudflare.ts`, `src/opencode.ts`). Stories and tests live next to their sources.
- `packages/ui-sdk-core`, `packages/ui-sdk-react` — private workspace packages, never published: the compiled output of our UI SDK fork in `vendor/ui-sdk` (a submodule of [BLamy/ui-sdk](https://github.com/BLamy/ui-sdk)). The library's source imports them as `@ui-sdk/core` and `@ui-sdk/react`, and its build copies them into `packages/ui/dist/vendor/ui-sdk`, so the published package carries UI SDK itself.
- `registry` — the blocks (`registry/blocks/<slug>`: `t3-clone`, `discord-clone`, `cloudflare-studio`, …) and the manifests that document the library's items (`registry/components/*.json`). `registry.json` at the root is generated. See [registry/README.md](registry/README.md).
- `apps/docs` — the BL site: the landing, library and roadmap pages (`src/site/`, with the list of libraries in `src/site/libraries.ts`, which `libraries.test.ts` checks against the real imports and the registry build turns into the package's library entries), the roadmap (`roadmap/*.md`), and the kit's docs (`pages/*.md` ordered by `pages/nav.json`, live examples in `examples/<page>/<example>`).
- `apps/docstream-playground`, `apps/docstream-editor-playground` — docstream's and the editor's own docs and examples (`docs/`), which the site mounts at [#/docstream](https://blamy.github.io/ui/#/docstream) and [#/docstream-editor](https://blamy.github.io/ui/#/docstream-editor).
- `apps/catalog` — the Storybook catalog (stories from `packages/ui`, the blocks and `apps/catalog/stories`).
- `tools` — workspace scripts: `registry` (the registry, the package's `exports`, and the library and UI SDK entries), `size` (what each entry costs an app, and its budgets), `tokens` (token generator and lint), `docs` (install sections, variant tables, Markdown export, copy-page check), `cloudflare` (the Cloudflare catalog and the package check), `e2e` (Playwright behavior and accessibility tests), `vr` (visual regression), `ui-sdk` (compiles the fork), `codemod`, and helpers for some blocks (the desktop wrappers, the FFmpeg and Tailscale builds).
- `docs` — design notes (the 2.0 plan).

## Development

```sh
pnpm install           # also compiles UI SDK from vendor/ui-sdk when it changed
pnpm dev:docs          # the BL site on :4206
pnpm storybook         # component catalog on :6006
pnpm nx run-many -t lint,typecheck,build,test
pnpm registry          # rewrite registry.json, the package's exports and the library entries
pnpm size              # what each library entry costs an app (needs a build; --check holds the budgets)
pnpm tokens            # regenerate lib/tokens.generated.ts from tokens.css, then lint for literals
pnpm variants          # regenerate the cva variant tables in the docs
pnpm e2e               # Playwright behavior tests (they start their own docs server)
pnpm a11y              # axe audit against the baseline
pnpm vr                # visual regression (needs Storybook on :6006 and docs on :4417)
pnpm knip              # dead-code check
```

[CONVENTIONS.md](CONVENTIONS.md) has the rules every module follows and the full list of checks CI runs. Every push to `main` builds `apps/docs` and deploys it, with the registry under `/r`, to [GitHub Pages](https://blamy.github.io/ui/), and publishes `@brett_lamy/ui`, the only package, when npm does not have its version yet.
