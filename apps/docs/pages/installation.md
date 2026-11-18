# Installation

BL UI is built on [UI SDK](https://ui-sdk.dev) (keyboard, focus, selection, popups, ARIA) and Tailwind CSS v4, and needs React 19. It is one npm package, `@brett_lamy/ui`: every BL library is an entry of it, and UI SDK and docstream ship inside it (see [Libraries and entries](#libraries-and-entries)). You can take it two ways from one source of truth:

- **shadcn registry (recommended).** `npx shadcn@latest add …` copies the source of the parts you pick into your project, with only what each part imports (`framer-motion`, `class-variance-authority`, …). You own the files, so you can edit variants and defaults, and you ship exactly what you added. Two things are not copied, because the package ships them whole: UI SDK, the behavior layer under every interactive part, and docstream, the Markdown renderer and editor. A part that uses either adds `@brett_lamy/ui` to your dependencies and imports it by name (`@brett_lamy/ui/sdk/…`, `@brett_lamy/ui/docstream…`); a part built on docstream (MarkdownView, MarkdownEditor, the Composer, ReplayPreview, StlViewer, StrudelPlayer, TuiPreview) also adds docstream's stylesheet to your CSS.
- **npm package.** `npm install @brett_lamy/ui` gives you everything in one dependency: the core, every other library, docstream and UI SDK. It is generated from the same sources: ESM, one output module per source module so bundlers tree-shake, an entry per library (`@brett_lamy/ui/time`) and per module at the registry's path (`@brett_lamy/ui/dialog` for `@/components/ui/dialog`), and `'use client'` on component modules for Next.js.

| | Registry | npm |
| --- | --- | --- |
| You get | Source files in `components/ui/` and `lib/`, and `@brett_lamy/ui` in `node_modules` for UI SDK and docstream | `@brett_lamy/ui` in `node_modules` |
| Change a default or add a variant | Edit your copy | Wrap the component |
| Bundle | Only what you add | Whatever you import, tree-shaken |
| Blocks (whole apps) | Yes, `components/blocks/<name>/` | No, registry only |
| Updates | Re-run `add` and review the diff | `npm update` |

See [Optimization](https://blamy.github.io/ui/#/optimization) for how to choose and how to keep bundles small, and [How the registry works](https://blamy.github.io/ui/#/registry) for what an item is.

## Registry

{% tabs title="Framework" sync="framework" %}
{% tab title="Vite" %}
{% stepper %}
{% step %}
### Start from a shadcn app

New project: scaffold a Vite + React + Tailwind v4 app with shadcn. Pick any base and preset (look) when it asks: BL UI's parts are UI SDK parts and don't depend on shadcn's base.

{% command %}npx shadcn@latest create --name my-app --template vite{% endcommand %}

This writes `components.json`, the `@/` import alias, `lib/utils.ts` and the theme CSS.

Existing app: it needs Tailwind CSS v4 and an `@/` alias. Skip the rest of this step if you have them.

{% command %}npm install tailwindcss @tailwindcss/vite{% endcommand %}

```ts
// vite.config.ts
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

```css
/* src/index.css */
@layer ui-sdk;
@import "tailwindcss";
```

Add the alias to `tsconfig.json` (and `tsconfig.app.json` if you have one), then run shadcn's `init`. If you already use shadcn with any base (Radix, Base UI, React Aria) you can keep it: BL UI does not depend on your base.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

{% command %}npx shadcn@latest init{% endcommand %}
{% endstep %}

{% step %}
### Declare UI SDK's layer

BL UI's parts are built on [UI SDK](https://ui-sdk.dev). There is no package to add for it: the registry does not copy UI SDK, so the first part you add that uses it puts `@brett_lamy/ui` in your dependencies, and the copied files import it from there (`@brett_lamy/ui/sdk/react/dialog`).

UI SDK adds a little CSS at runtime (hidden parts, the popup reset, a sheet's backdrop) in a cascade layer named `ui-sdk`. Declare that layer first, at the very top of your global CSS (`@layer ui-sdk;` above `@import "tailwindcss"`, as in the snippet above), so your own styles and Tailwind's utilities always win over it. See [Migrating to 6.0](https://blamy.github.io/ui/#/migrating-to-6) for the details.
{% endstep %}

{% step %}
### Add BL UI

`bl-ui` is the base item every other item depends on, so adding any part brings it along. It writes BL UI's tokens into your CSS `@theme inline` (extra colors such as `text-tertiary-foreground`, `bg-bar`, `text-success`, the radius, text-size, shadow and size scales, the spring motion tokens), the framework CSS (keyframes, scrollbars, a `box-sizing` reset scoped to `[data-slot]`), and redefines the `dark` variant so the element that carries `.dark` restyles itself. It installs no package and leaves your palette alone.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/bl-ui.json{% endcommand %}
{% endstep %}

{% step %}
### Add the iOS theme (optional)

`bl-theme` sets your shadcn variables (light and dark) to the iOS palette and adds the `workbench`, `terminal`, `sheet` and `glass` [theme scopes](https://blamy.github.io/ui/#/theming). It overwrites the palette variables it sets. Skip it to keep your own look.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/bl-theme.json{% endcommand %}
{% endstep %}

{% step %}
### Add parts and blocks

Each part's page has an **Installation** section with its command. Parts land in `components/ui/<name>.tsx` and `lib/<name>.ts`; blocks, which are whole apps, in `components/blocks/<name>/`.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/composer.json{% endcommand %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/apple-reminders.json{% endcommand %}

A whole library is one item, `library-<entry>`, which installs every part of it ([Libraries in the registry](#libraries-in-the-registry)):

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/library-time.json{% endcommand %}
{% endstep %}

{% step %}
### Use them

```tsx
// src/App.tsx
import {
  Composer, ComposerCard, ComposerInput, ComposerFooter, ComposerSend,
} from '@/components/ui/composer'
import AppleReminders from '@/components/blocks/apple-reminders/page'

export default function App() {
  return (
    <main className="grid h-dvh grid-rows-[1fr_auto]">
      <AppleReminders />
      <Composer onSubmit={(markdown) => console.log(markdown)}>
        <ComposerCard>
          <ComposerInput placeholder="Ask anything" />
          <ComposerFooter>
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>
    </main>
  )
}
```

{% command %}npm run dev{% endcommand %}

The copied parts import UI SDK and docstream from the installed package (`@brett_lamy/ui/sdk/…`, `@brett_lamy/ui/docstream…`), which Vite pre-bundles like any other dependency: no configuration. Docstream loads its heavy renderers (KaTeX, rrweb, Pele) only when a page needs them; if the dev server reloads the page the first time one loads, list it in `optimizeDeps.include` (see [Optimization](https://blamy.github.io/ui/#/optimization)).
{% endstep %}
{% endstepper %}
{% endtab %}

{% tab title="Next.js" %}
{% stepper %}
{% step %}
### Start from a shadcn app

New project: scaffold a Next.js app with shadcn (any base). It sets up Tailwind CSS v4 through `@tailwindcss/postcss`, the `@/` alias and `components.json`; check that the latter has `"rsc": true` (see the next steps).

{% command %}npx shadcn@latest create --name my-app --template next{% endcommand %}

Existing app: it needs Tailwind CSS v4 and the `@/*` alias (create-next-app's default). For Tailwind v4 in Next, install the PostCSS plugin and import Tailwind in your global CSS:

{% command %}npm install tailwindcss @tailwindcss/postcss postcss{% endcommand %}

```js
// postcss.config.mjs
const config = { plugins: { '@tailwindcss/postcss': {} } }
export default config
```

```css
/* app/globals.css */
@layer ui-sdk;
@import "tailwindcss";
```

Then run shadcn's `init`, which writes `components.json` and `lib/utils.ts`:

{% command %}npx shadcn@latest init{% endcommand %}
{% endstep %}

{% step %}
### Declare UI SDK's layer

The same `@layer ui-sdk;` line as on Vite, at the top of `app/globals.css` (the snippet above has it). There is no package to add for UI SDK: the first part that uses it puts `@brett_lamy/ui` in your dependencies.
{% endstep %}

{% step %}
### Add BL UI

The same base item as on Vite. It only edits your CSS (tokens and framework CSS), so it works with the App Router unchanged.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/bl-ui.json{% endcommand %}
{% endstep %}

{% step %}
### Add the iOS theme (optional)

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/bl-theme.json{% endcommand %}
{% endstep %}

{% step %}
### Add parts and blocks

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/list.json{% endcommand %}

The copied modules that use hooks, UI SDK parts or motion start with `'use client'`. Keep `"rsc": true` in `components.json` for a Next app: the shadcn CLI leaves the directives in with it and strips them with `"rsc": false`.
{% endstep %}

{% step %}
### Use them

A server component can render a BL UI part, but a function prop such as `onClick` has to come from a client component. Put the interactive part behind your own `'use client'` file:

```tsx
// components/todo-list.tsx
'use client'
import { List, ListRow, ListSection } from '@/components/ui/list'

export function TodoList() {
  return (
    <List variant="inset">
      <ListSection title="Today">
        <ListRow title="Ship the docs" onClick={() => {}} />
      </ListSection>
    </List>
  )
}
```

```tsx
// app/page.tsx (a server component)
import { TodoList } from '@/components/todo-list'

export default function Page() {
  return <TodoList />
}
```

Browser-only parts (the Composer's editor, maps, session replay) can also be loaded with `next/dynamic` and `ssr: false`; see [Optimization](https://blamy.github.io/ui/#/optimization).
{% endstep %}
{% endstepper %}
{% endtab %}
{% endtabs %}

### What gets copied where

| Item type | Lands in | Example |
| --- | --- | --- |
| `registry:style` | your CSS, no files | `bl-ui` |
| `registry:theme` | your CSS variables, no files | `bl-theme` |
| `registry:ui` | `components/ui/<name>.tsx`, or a folder `components/ui/<name>/` for a part made of several files | `button`, `list`, `composer` |
| `registry:lib` | `lib/<name>.ts` | `icon`, `motion`, `theme`, `utils` |
| `registry:block` | `components/blocks/<name>/` | `apple-mail`, `discord-clone` |
| `registry:item` | nothing of its own: it installs every item of one library | `library-ui`, `library-audio` |

Each item declares the items it imports, so `npx shadcn@latest add …/list.json` also copies `button`, `icon`, `motion`, `utils` and the rest of what `list` needs, and installs the npm packages those files import (`framer-motion`, `class-variance-authority`, …), and only those. An item whose files use UI SDK or docstream lists `@brett_lamy/ui` itself, at the library's version: neither is copied, and the copied files import them as `@brett_lamy/ui/sdk/…` and `@brett_lamy/ui/docstream/…`. The index is [`registry.json`](https://blamy.github.io/ui/r/registry.json).

> **BL UI replaces `components/ui/button.tsx` and `lib/utils.ts`.** Dependencies are declared on BL UI's own items, so shadcn's stock `button` is never pulled in, and adding a part that uses Button writes BL UI's `button.tsx` over yours. The same goes for `lib/utils.ts`. BL UI's `cn` is a superset of shadcn's (the same `clsx` plus `tailwind-merge`, with BL UI's tokens registered), so code that calls `cn` keeps working, but your `Button` variants and any edits to these two files are replaced. Commit first, and review the diff after `add`. The CLI asks before overwriting; `-o` answers yes.

### Aliases

Source files import by alias: `@/components/ui/<name>` and `@/lib/<name>`, which are shadcn's defaults. The CLI rewrites them to the aliases in your `components.json`, so an app that uses `~/components/ui` and `~/lib` works after you set:

```json
{
  "aliases": {
    "components": "~/components",
    "ui": "~/components/ui",
    "lib": "~/lib",
    "utils": "~/lib/utils"
  }
}
```

Set these before the first `add`, and make sure your bundler and `tsconfig` resolve the same prefix.

### Updating later

Nothing pins you to a version. To pick up a change, re-run the item's `add` with `-o` and read the diff (`git diff`) to bring your own edits back:

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/list.json -o{% endcommand %}

The live docs pages always show the current source in each demo's code panel.

### Adding blocks

A block is a whole app or screen composed from library parts. Adding one copies its own files into `components/blocks/<name>/` and only the library parts it imports. Render the default export of `page.tsx` inside a sized container. See [Blocks](https://blamy.github.io/ui/#/blocks) and, for how they are put together, [Anatomy of a block](https://blamy.github.io/ui/#/blocks).

## npm package

{% tabs title="Framework" sync="framework" %}
{% tab title="Vite" %}
{% stepper %}
{% step %}
### Install

BL UI needs React 19. `@brett_lamy/ui` is the only package to install: UI SDK, docstream and its editor are inside it. Tailwind is optional here: the package ships a precompiled stylesheet for its own classes. You only need Tailwind if you also write Tailwind classes in your app.

{% command %}npm install @brett_lamy/ui{% endcommand %}
{% endstep %}

{% step %}
### Import the styles

No JavaScript module of the package imports CSS (so every entry loads in plain Node): import the stylesheets once, at your app's entry, before your own CSS. The kit's sheet declares the cascade layers, `ui-sdk` first, so UI SDK's runtime rules stay below everything else. (With a Tailwind build of your own, also put `@layer ui-sdk;` at the top of your global CSS.)

```tsx
// src/main.tsx
import '@brett_lamy/ui/styles.css' // always: the kit, with the Markdown editor's sheet in a layer
import '@brett_lamy/ui/theme.css' // optional: the iOS palette
import '@brett_lamy/ui/docstream/styles.css' // only if you render Markdown (below)
```

`@brett_lamy/ui/docstream/styles.css` is docstream's sheet. MarkdownView, MarkdownEditor, Composer, Conversation, ReplayPreview, TuiPreview, StlViewer, StrudelPlayer and docstream's own components (`@brett_lamy/ui/docstream/…`, DocsSite included) need it, after the kit's sheet; nothing else does. The editor's sheet (`@brett_lamy/ui/docstream-editor/styles.css`) is already inside `@brett_lamy/ui/styles.css`: import it yourself only in an app that doesn't load the kit's sheet, never both. With the registry, an item that needs a sheet adds the `@import` to your CSS. To let your classes beat docstream's rules without `!important`, import its sheet from your CSS into the layer the kit declares for it instead: `@import "@brett_lamy/ui/docstream/styles.css" layer(docstream);`.

Without the theme, define shadcn's CSS variables (`--background`, `--primary`, …) yourself or from a shadcn preset.
{% endstep %}

{% step %}
### Use it

```tsx
import { BLProvider } from '@brett_lamy/ui/lib/theme'
import { NavigationStack } from '@brett_lamy/ui/navigation-stack'
import { SplitView } from '@brett_lamy/ui/split-view'
```

Import each part from its module's entry, the registry's path under the package name: `@/components/ui/split-view` is `@brett_lamy/ui/split-view`, `@/lib/theme` is `@brett_lamy/ui/lib/theme`, and each component page shows its import. A folder is one entry (`@brett_lamy/ui/pencilkit`). A library is an entry too (`@brett_lamy/ui/time`, `@brett_lamy/ui/audio`), and the package root exports the core (`import { Button } from '@brett_lamy/ui'`): [Libraries and entries](#libraries-and-entries) has the table and says when to use which. All of them tree-shake the same in a production build, but a module entry keeps the dev server and your editor from loading a whole index to resolve one name, and switching to or from the registry changes only the prefix.

UI SDK's own parts and behaviors, for a component you build yourself, are entries of the package as well: wherever UI SDK's docs say `@ui-sdk/…`, write `@brett_lamy/ui/sdk/…` (`import { useShortcut } from '@brett_lamy/ui/sdk/react/shortcuts'`). Do not install upstream's `@ui-sdk/*` beside the package: a second copy would not share the kit's layer stack and focus state.

Docstream, the Markdown renderer and editor inside the package, has entries of its own (`@brett_lamy/ui/docstream/site`, `@brett_lamy/ui/docstream-editor`…) and needs no bundler configuration; its stylesheet is the one in the step above.
{% endstep %}
{% endstepper %}
{% endtab %}

{% tab title="Next.js" %}
{% stepper %}
{% step %}
### Install

The same one package as on Vite:

{% command %}npm install @brett_lamy/ui{% endcommand %}
{% endstep %}

{% step %}
### Import the styles in the root layout

The same stylesheets as on Vite, in the root layout:

```tsx
// app/layout.tsx
import '@brett_lamy/ui/styles.css' // always: the kit, with the Markdown editor's sheet in a layer
import '@brett_lamy/ui/theme.css' // optional: the iOS palette
import '@brett_lamy/ui/docstream/styles.css' // only if you render Markdown

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

If you also use Tailwind classes in your own code, set up Tailwind v4 with `@tailwindcss/postcss` as in the registry steps above.
{% endstep %}

{% step %}
### Use it

The package is compiled ESM and its component modules carry `'use client'`, so a server component can import and render them. Function props (`onClick`, `onValueChange`) still have to come from a client component.

```tsx
// app/page.tsx
import { Button } from '@brett_lamy/ui/button'

export default function Page() {
  return <Button>Continue</Button>
}
```

Module entries (`@brett_lamy/ui/button`) need no configuration. If you import from the package root instead, `experimental.optimizePackageImports: ['@brett_lamy/ui']` in `next.config` keeps those imports cheap. `transpilePackages` is not needed: the package is already compiled.
{% endstep %}
{% endstepper %}
{% endtab %}
{% endtabs %}

The npm package contains every library (the core, the libraries beside it, docstream and its editor, UI SDK) and the two stylesheets. Blocks are registry-only. 6.0 is a breaking release: the components moved from react-aria-components to UI SDK, and their props follow UI SDK's API. See [Migrating to 6.0](https://blamy.github.io/ui/#/migrating-to-6).

## Libraries and entries

`@brett_lamy/ui` is one package and many libraries. Each library is an entry of the package, so an app installs once and its bundler takes only the entries it imports. Each one has a page under [Libraries](https://blamy.github.io/ui/#/libraries).

### What the root carries

`@brett_lamy/ui`, the package root, exports the core library and the foundation it stands on:

| Library | On the root |
| --- | --- |
| UI, the core | Controls, fields and pickers, the popups (Dialog, Sheet, Popover, DropdownMenu, Select, Combobox, Toast, CommandMenu), the containers (NavigationStack, SplitView, Tabs, AdaptivePane, Sidebar, List, Toolbar, DataTable), and the workbench and debugging parts (CodeEditor, Terminal, Workspace, LogList, RequestTable) |
| Tokens | `BLProvider`, `ThemeScope`, the size-class scope and its hooks, `cn` and `cx` |
| Motion | The springs, presence, TextMorph, NumberMorph, Morph, AnimatedHeight, Swap, Celebrate, the edge swipe and pull to refresh |
| Icons | `Icon` and its name lists |

It exports nothing of another library, so importing the root never loads the Markdown editor, a diagram or a video timeline. The registry build fails if the root re-exports a module that belongs to another library.

### The library entries

| Library | Import from | What it exports |
| --- | --- | --- |
| Tokens | `@brett_lamy/ui/tokens` | The theme (`BLProvider`, `ThemeScope`, `appearance` and `tint`), size classes, `cn` and `cx`, the syntax lexer, the change details every callback hands out |
| Motion | `@brett_lamy/ui/motion` | The springs, presence, the morphing parts, the edge swipe and pull to refresh |
| Icons | `@brett_lamy/ui/icons` | `Icon`, its lists, and the file-type icons |
| Time | `@brett_lamy/ui/time` | Calendar, DateInput, DatePicker, NaturalTimeInput, CronEditor, the cron and time parsers |
| Canvas | `@brett_lamy/ui/canvas` | Canvas, PencilKit, the canvas math |
| Diagram | `@brett_lamy/ui/diagram` | Diagram, DiagramFrame, StateDiagram, the diagram and state-machine models and the layout. `elkjs` and `xstate` are optional peers |
| | `@brett_lamy/ui/cloudflare` | CloudflareDiagram and the Cloudflare catalog, kept on an entry of their own for the catalog's size |
| Audio | `@brett_lamy/ui/audio` | Waveform, NowPlayingBars, StrudelPlayer, the playback clock |
| Video | `@brett_lamy/ui/video` | VideoPreview, VideoTimeline, Filmstrip, the timeline model, the FFmpeg renderer |
| Markdown | `@brett_lamy/ui/markdown` | MarkdownView, MarkdownEditor, StlViewer, TuiPreview |
| Composer | `@brett_lamy/ui/composer` | Composer and its parts, Conversation, MessageScroller, ArtifactChatContainer |
| Replay | `@brett_lamy/ui/replay` | ReplayPreview and the session recorder |
| SQL | `@brett_lamy/ui/sql` | SqlConsole |
| PGlite | `@brett_lamy/ui/pglite` | The PGlite hooks, the schema reader, import and export, the tab lock. `@electric-sql/pglite` and `@electric-sql/pglite-tools` are optional peers |
| Filter | `@brett_lamy/ui/filter` | The filter bar and its parts, FilterInput, the filter model, the query parser |
| Sync | `@brett_lamy/ui/sync` | `usePersistentState`, the append-only local streams, the Durable Streams client |
| Vault | `@brett_lamy/ui/vault` | VaultGate, the passkey vault and its React hooks |
| Sandbox | `@brett_lamy/ui/sandbox` | `createSandbox`, `useSandbox` and `serveSandbox`: code that runs in a Worker with an origin of its own. `@agent-wasm/core` is an optional peer, loaded only when a sandbox starts: see [Sandbox](#/sandbox) |
| Tailscale | `@brett_lamy/ui/tailscale` | The Tailscale client, its React hooks, the controls, the service-worker router, the fake for tests. `@agent-wasm/tailscale-connect` is an optional peer |
| OpenCode | `@brett_lamy/ui/opencode` | The OpenCode component and its runtime (the loaders, the hosts, the vault stores). The runtime's modules load only when the component mounts |
| Docstream | `@brett_lamy/ui/docstream`, `@brett_lamy/ui/docstream/<entry>` | The Markdown renderer, DocsSite and their entries: [docstream's docs](https://blamy.github.io/ui/#/docstream) |
| Docstream Editor | `@brett_lamy/ui/docstream-editor`, `/editor`, `/convert` | The WYSIWYG editor: [its docs](https://blamy.github.io/ui/#/docstream-editor) |
| UI SDK | `@brett_lamy/ui/sdk/core`, `@brett_lamy/ui/sdk/core/<entry>`, `@brett_lamy/ui/sdk/react/<entry>` | Our build of UI SDK, entry for entry: [Built on UI SDK](https://blamy.github.io/ui/#/ui-sdk) |

A library entry exports every module of the library that has an entry of its own. Four libraries are named after their main module (Canvas, Diagram, Composer, Filter): for those the path is the library's, and that module has no separate entry.

### A library entry or a module entry

Every module is an entry too: `@brett_lamy/ui/calendar`, `@brett_lamy/ui/waveform`, `@brett_lamy/ui/lib/cron`. So a name has two import paths and no more, its module's and its library's, and a name of the core or the foundation is on the root as well.

```tsx
import { Calendar } from '@brett_lamy/ui/calendar' // its module
// or
import { Calendar, DatePicker, CronEditor } from '@brett_lamy/ui/time' // its library
```

| Import from | When |
| --- | --- |
| The module's entry | The default, and what each component page shows. It is the registry's path under the package name, so the line is the same in both installs but for the prefix, and the dev server and your editor load one module, not an index |
| The library's entry | You use several parts of one library and want one import line, or you want to see what a library has. In a production build it costs what the module entries cost |
| The root | Parts of the core, in one line |

Load a heavy part lazily from its module's entry (`import('@brett_lamy/ui/markdown-editor')`): a lazy import of a library entry or of the root puts all of it behind the split point.

### Libraries in the registry

The registry has one item per library, `library-<entry>`. It has no files of its own: it installs every item of the library, each as source.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/library-audio.json{% endcommand %}

| Item | Installs |
| --- | --- |
| `library-ui` | The core: every item that no other library owns |
| `library-tokens`, `library-motion`, `library-icons` | The foundation |
| `library-time`, `library-canvas`, `library-diagram`, `library-audio`, `library-video` | Their parts and the engines under them |
| `library-markdown`, `library-composer`, `library-replay` | Their parts. They are built on docstream, which comes from `@brett_lamy/ui` |
| `library-sql`, `library-pglite`, `library-filter`, `library-sync`, `library-vault`, `library-tailscale` | Their parts and the engines under them |

Docstream, its editor and UI SDK have no item, because nothing copies them: the items that use them add `@brett_lamy/ui` to your dependencies. OpenCode has no library item either: add `open-code`.

### Sizes are checked

What an entry costs an app is measured, not assumed. `pnpm size` (`tools/size/measure.mjs`) bundles every library entry on its own from the built package, the way an app's bundler would: minified, tree-shaken and code-split, with React and the optional peers left out and every other dependency counted in. For each entry it reports two sizes, minified and gzipped:

| | What it is |
| --- | --- |
| `load` | What the browser must fetch before the entry works: its chunk and everything it imports statically |
| `lazy` | What it may fetch later: the chunks behind a dynamic `import()` (KaTeX, Mermaid, the Cloudflare catalog) |

Stylesheets, worker scripts and the wasm an entry loads by URL are not counted. `pnpm size --check` runs in CI and before a version is published, and fails when:

- a library's `load`, or what one import loads (a Button, a Dialog: the floor an app pays), is over its budget (`tools/size/budget.json`, set 5% over what was measured);
- a name imported through a library entry or the root costs more than through its own module's entry, within a small tolerance: `import { Waveform } from '@brett_lamy/ui/audio'` must cost what `@brett_lamy/ui/waveform` costs;
- the measured sizes the site shows are stale.

The measured sizes are on each library's page. See [Optimization](https://blamy.github.io/ui/#/optimization) for keeping your own bundle small.

## What the registry installs

| Item | What it is |
| --- | --- |
| `bl-ui` | Tokens and framework CSS written into your CSS. Every other item depends on it. Installs no package. |
| `bl-theme` | Optional: the iOS palette on your shadcn variables, plus the `workbench`, `terminal`, `sheet` and `glass` theme scopes |
| `button`, `dialog`, `select`, `tabs`, … | shadcn-style primitives, one item each, in `components/ui/<name>.tsx`. UI SDK, which they are built on, comes from `@brett_lamy/ui`, which the item adds to your dependencies |
| `list`, `split-view`, `navigation-stack`, `composer`, … | Containers and larger parts, grouped with the modules that belong together |
| `icon`, `motion`, `theme`, `utils`, … | Libraries in `lib/<name>.ts` |
| `markdown-view`, `markdown-editor`, `composer`, `replay-preview`, … | Parts built on docstream: their own module is copied, and docstream comes from `@brett_lamy/ui`, which the item adds to your dependencies; the item also adds `@import "@brett_lamy/ui/docstream/styles.css" layer(docstream)` to your CSS (`markdown-editor`, and through it `composer`, the editor's sheet too, in the `components.bl-editor` layer) |
| `library-ui`, `library-time`, `library-audio`, … | A whole library: no files of its own, every item of the library ([Libraries in the registry](#libraries-in-the-registry)) |
| `github-clone`, `apple-mail`, … | A whole app in `components/blocks/<name>/`, see [Blocks](https://blamy.github.io/ui/#/blocks) |

## Provider

`BLProvider` gives an iOS surface its appearance (`light` / `dark`), tint, font and safe area, and hosts overlays. Shells open their own theme scopes. See [Theming](https://blamy.github.io/ui/#/theming).

```tsx
<BLProvider tint="#0A84FF">
  <NavigationStack pages={pages} onPagesChange={setPages}>
    <NavigationStackPage value="inbox">…</NavigationStackPage>
  </NavigationStack>
</BLProvider>
```

## Requirements

- React and React DOM 19 (and `@types/react` 19.2.10 or newer with TypeScript)
- `@brett_lamy/ui` itself, in both installs: the package carries UI SDK and docstream, which the registry does not copy. Upstream's `@ui-sdk/core` and `@ui-sdk/react` must not be installed beside it
- Only for the parts that use them, optional peers of the package: `xstate` (StateDiagram, a CloudflareDiagram service's machine, the xstate fence), `elkjs` (automatic diagram layout), `@electric-sql/pglite` and `@electric-sql/pglite-tools` (the PGlite parts, and their export and import), `@agent-wasm/tailscale-connect` (the Tailscale client), `@agent-wasm/core` (docstream's live playground), `@brett_lamy/viz-engine` (docstream's VizEngine scenes) and `vite` (docstream's Vite plugin)
- `@layer ui-sdk;` declared before your other CSS when you have your own Tailwind build
- Tailwind CSS v4 (for the registry path, and for any Tailwind classes of your own)
- shadcn's CSS variables, from your shadcn theme or the bl-theme
- A bundler that resolves ESM package exports and CSS imports (Vite, Next.js, React Router, …)
- Browser APIs such as ResizeObserver for container-aware shells

## Live check

{% demo src="installation/controls" %}
