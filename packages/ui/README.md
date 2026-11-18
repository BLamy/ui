# @brett_lamy/ui

BL UI: touch-first React components inspired by UIKit's containers, built on [UI SDK](https://ui-sdk.dev) and Tailwind v4. UI SDK owns the behavior (keyboard, focus, selection, popups, ARIA); this package owns the look, the tokens and the iOS containers. It is one package that holds every BL library as an entry: the core on the root, then Time, Canvas, Diagram, Audio, Video, Markdown, Composer, Replay, SQL, PGlite, Filter, Sync, Vault, Tailscale and OpenCode, with docstream (the GitBook-flavored Markdown renderer), its editor and our build of UI SDK inside. An app installs it once and bundles only the entries it imports.

## Install

```sh
npm install @brett_lamy/ui
```

That is the whole install: no second package, no alias. React 19 is required (the components use `use(Context)`, `<Context value>` and `ref` as a prop). The docs have every step for Vite and Next.js: [Installation](https://blamy.github.io/ui/#/installation).

No JavaScript module of the package imports CSS (so every entry loads in plain Node): import the stylesheets once, at your app's entry.

```tsx
import '@brett_lamy/ui/styles.css' // always: the kit, with the Markdown editor's sheet in a layer
import '@brett_lamy/ui/theme.css' // optional: the iOS palette
import '@brett_lamy/ui/docstream/styles.css' // only if you render Markdown (below)
```

`@brett_lamy/ui/docstream/styles.css` is docstream's sheet. MarkdownView, MarkdownEditor, Composer, Conversation, ReplayPreview, TuiPreview, StlViewer, StrudelPlayer and docstream's own components (`@brett_lamy/ui/docstream/…`, DocsSite included) need it, after the kit's sheet; nothing else does. The editor's sheet (`@brett_lamy/ui/docstream-editor/styles.css`) is already inside `@brett_lamy/ui/styles.css`: import it yourself only in an app that doesn't load the kit's sheet, never both.

The theme sets shadcn's CSS variables to the iOS palette; leave it out to use your own shadcn theme. `BLProvider` picks light or dark and a tint for a subtree, and `ThemeScope` scopes any set of variables to a subtree.

```tsx
import { BLProvider } from '@brett_lamy/ui/lib/theme';
import { NavigationStack, NavigationStackBar, NavigationStackContent, NavigationStackPage, NavigationStackTitle } from '@brett_lamy/ui/navigation-stack';

export function App() {
  return (
    <BLProvider tint="#0a84ff">
      <NavigationStack>
        <NavigationStackPage value="home">
          <NavigationStackBar><NavigationStackTitle>Home</NavigationStackTitle></NavigationStackBar>
          <NavigationStackContent>…</NavigationStackContent>
        </NavigationStackPage>
      </NavigationStack>
    </BLProvider>
  );
}
```

UI SDK puts a little runtime CSS in a cascade layer named `ui-sdk`; `styles.css` declares it first, and an app with its own Tailwind build should start its global CSS with `@layer ui-sdk;`. Coming from 5.x: [Migrating to 6.0](https://blamy.github.io/ui/#/migrating-to-6).

## Libraries

The package root, `@brett_lamy/ui`, exports the core and the foundation under it (Tokens, Motion, Icons). Every other library is an entry of its own, so an app that imports the root never loads a library it does not use. Each has a page on the [BL site](https://blamy.github.io/ui/#/libraries).

| Library | Import from | What it holds |
| --- | --- | --- |
| UI | `@brett_lamy/ui` | The core: controls (Button, Toggle, Switch, Segmented), fields and pickers (Field, Input, Select, Combobox, ColorPicker), popups (Dialog, Sheet, Popover, DropdownMenu, Toast, CommandMenu), containers (NavigationStack, SplitView, Tabs, AdaptivePane, Sidebar, List, Toolbar, IndexBar, Tree, DataTable), and the workbench parts (CodeEditor, Terminal, Workspace, DebugToolbar) |
| Tokens | `@brett_lamy/ui/tokens` | `BLProvider`, `ThemeScope`, size classes, `cn` and `cx`, the syntax lexer |
| Motion | `@brett_lamy/ui/motion` | `springs`, presence, TextMorph, NumberMorph, Morph, AnimatedHeight, Swap, Celebrate, edge swipe, pull to refresh |
| Icons | `@brett_lamy/ui/icons` | `Icon` and the file-type icons |
| Time | `@brett_lamy/ui/time` | Calendar, DateInput, DatePicker, NaturalTimeInput, CronEditor, the cron and time parsers |
| Canvas | `@brett_lamy/ui/canvas` | Canvas, and PencilKit (`PencilCanvas`, `PencilToolbar`, `ImageAnnotator`) |
| Diagram | `@brett_lamy/ui/diagram` | Diagram, DiagramFrame, StateDiagram (XState, an optional peer; ELK lays diagrams out when asked, also optional), the diagram and state-machine models |
| | `@brett_lamy/ui/cloudflare` | CloudflareDiagram with the Cloudflare catalog, on an entry of its own because the catalog is large |
| Audio | `@brett_lamy/ui/audio` | Waveform, NowPlayingBars, StrudelPlayer, the playback clock |
| Video | `@brett_lamy/ui/video` | VideoPreview, VideoTimeline, Filmstrip, the FFmpeg renderer |
| Markdown | `@brett_lamy/ui/markdown` | MarkdownView, MarkdownEditor, StlViewer, TuiPreview |
| Composer | `@brett_lamy/ui/composer` | Composer and its parts, Conversation, MessageScroller, ArtifactChatContainer |
| Replay | `@brett_lamy/ui/replay` | ReplayPreview and the session recorder |
| SQL | `@brett_lamy/ui/sql` | SqlConsole |
| PGlite | `@brett_lamy/ui/pglite` | The PGlite hooks and helpers (`@electric-sql/pglite` is an optional peer) |
| Filter | `@brett_lamy/ui/filter` | The filter bar, FilterInput, the filter model and query parser |
| Sync | `@brett_lamy/ui/sync` | `usePersistentState`, append-only local streams, the Durable Streams client |
| Vault | `@brett_lamy/ui/vault` | VaultGate and the passkey vault |
| Tailscale | `@brett_lamy/ui/tailscale` | The Tailscale client, its React hooks and controls (`@agent-wasm/tailscale-connect` is an optional peer) |
| OpenCode | `@brett_lamy/ui/opencode` | The OpenCode component and its runtime: the loaders, the hosts and the vault stores |
| Docstream | `@brett_lamy/ui/docstream`, `@brett_lamy/ui/docstream/<entry>` | The Markdown renderer and DocsSite ([below](#docstream)) |
| Docstream Editor | `@brett_lamy/ui/docstream-editor` | The WYSIWYG editor for docstream Markdown |
| UI SDK | `@brett_lamy/ui/sdk/core`, `@brett_lamy/ui/sdk/react/<part>` | Our build of UI SDK ([below](#ui-sdk)) |

Every module is an entry too, at the registry's path under the package name: `@/components/ui/navigation-stack` is `@brett_lamy/ui/navigation-stack`, `@/lib/theme` is `@brett_lamy/ui/lib/theme`. So a name has two import paths and no more: its module's entry and its library's entry. The names of the core and the foundation are on the root as well.

```tsx
import { Waveform } from '@brett_lamy/ui/waveform'; // its module
// or
import { Waveform } from '@brett_lamy/ui/audio'; // its library, beside NowPlayingBars and StrudelPlayer

import { Button, Dialog, Icon } from '@brett_lamy/ui'; // the core and the foundation
```

Where a library is named after its main module (`canvas`, `diagram`, `composer`, `filter`), that path is the library: it exports the module and the rest of the library with it.

The package is ESM with one output module per source module (`sideEffects` is limited to CSS), so a bundler drops what you don't import; component modules start with `'use client'` for Next.js. Each path costs an app the same, and that is checked before every release: each library entry is bundled from the built package and held to a size budget, and a name imported through a library entry or the root may not cost more than through its module's entry.

## UI SDK

UI SDK is part of the package: its own build, from the fork at [BLamy/ui-sdk](https://github.com/BLamy/ui-sdk) (upstream plus layer hosts, a `when` option on `bindLayer` and the exported `SlotProps` type), in `dist/vendor/ui-sdk` with its Apache-2.0 `LICENSE` and a `NOTICE.md`. Every UI SDK entry is an entry of this package. Wherever UI SDK's docs say `@ui-sdk/…`, write `@brett_lamy/ui/sdk/…`:

| UI SDK's docs | Here |
| --- | --- |
| `@ui-sdk/core` | `@brett_lamy/ui/sdk/core` |
| `@ui-sdk/core/gesture` | `@brett_lamy/ui/sdk/core/gesture` |
| `@ui-sdk/react/dialog` | `@brett_lamy/ui/sdk/react/dialog` |

```tsx
import { definePrimitive } from '@brett_lamy/ui/sdk/core';
import { createParts } from '@brett_lamy/ui/sdk/react/primitive';
import { useShortcut } from '@brett_lamy/ui/sdk/react/shortcuts';
```

Do not install upstream's `@ui-sdk/core` or `@ui-sdk/react` beside it: a second copy would not share the kit's layer stack and focus state. The package's license is `MIT AND Apache-2.0` for that reason: BL UI is MIT, the UI SDK inside it Apache-2.0.

## shadcn registry

Every part also installs as source with the shadcn CLI, from the same files this package is built from. `add` copies one component and what it imports into your app (`components/ui/…`, `lib/…`) and adds BL UI's tokens to your CSS, so you own the files:

```sh
npx shadcn@latest add https://blamy.github.io/ui/r/navigation-stack.json   # one part, with what it imports
npx shadcn@latest add https://blamy.github.io/ui/r/library-audio.json      # every part of a library
```

There is one `library-<entry>` item for each library entry, from `library-tokens` to `library-tailscale`, and `library-ui` for the core. UI SDK and docstream are not copied: an item whose files use either adds `@brett_lamy/ui` to your dependencies, and the copied files import `@brett_lamy/ui/sdk/…` and `@brett_lamy/ui/docstream/…`. An item that needs docstream's sheet adds the `@import` to your CSS.

Product-specific compositions are **blocks**, installed from the registry and not part of this package: the team-chat shell (`discord-clone`: `ChatShell` and its regions, channels, messages, members), the IDE workbench (`t3-clone`: `WorkbenchShell` and its parts, `WorkbenchComposer`, `ModelPicker`, the terminal dock and surfaces), the demo apps (`map-chat`, `delivery-tracking`, `split-view-demos`, `pencilkit-sketch`) and the full apps (GitHub, Apple Mail, VS Code, …). See [How the registry works](https://blamy.github.io/ui/#/registry) and [Optimization](https://blamy.github.io/ui/#/optimization).

## Docstream

Docstream and its editor are part of this package: `@brett_lamy/ui/docstream` and its entries (`/site`, `/gitbook`, `/replay`, `/stl`, `/strudel`, `/xstate`, `/capnp`, `/playground`, `/viz`, `/vite`…), and `@brett_lamy/ui/docstream-editor` (`/editor`, `/convert`). They replace the npm packages `@brett_lamy/docstream` and `@brett_lamy/docstream-editor`, which stop at 2.0.1: rename `@brett_lamy/docstream` to `@brett_lamy/ui/docstream` in your imports. Docstream styles itself with `@brett_lamy/ui/docstream/styles.css` (see [Install](#install) for which components need it). It draws with the kit's `Icon` and colors code with the kit's lexer (`@brett_lamy/ui/lib/syntax`). Its optional peers are this package's: `@agent-wasm/core` (`/playground`), `@brett_lamy/viz-engine` (`/viz`), `vite` (`/vite`) and `xstate` (the xstate fence). Its own docs: [#/docstream](https://blamy.github.io/ui/#/docstream) and [#/docstream-editor](https://blamy.github.io/ui/#/docstream-editor).

## IndexBar

`IndexBar` accepts application-defined string or numeric keys. Labels are optional, so dense timelines can render as dots, and `preview` accepts any React node. Hover previews without navigating; pointer drag and keyboard navigation (`ArrowUp`, `ArrowDown`, `Home`, `End`) commit a stop.

```tsx
import { IndexBar, type IndexBarItem } from '@brett_lamy/ui';

const stops: IndexBarItem<number>[] = turns.map((turn, index) => ({
  value: turn.sequence,
  label: index % 5 === 0 ? String(index + 1) : undefined,
  caption: turn.author,
  preview: <span>{turn.summary}</span>,
}));

<IndexBar
  items={stops}
  aria-label="Jump to conversation turn"
  onJump={(sequence) => scrollToTurn(sequence)}
/>;
```

The A–Z rail of a contacts list is `indexBarAlphabetItems`, which dims (but keeps reachable) the letters you leave out:

```tsx
import { IndexBar, indexBarAlphabetItems } from '@brett_lamy/ui';

<IndexBar
  items={indexBarAlphabetItems(['A', 'B', 'K'])}
  onJump={(letter) => scrollToSection(letter)}
/>;
```

## Team chat

`ChatShell` is a thin layout root: it measures its own width, owns the compact navigation drawer and applies the chat palette. Everything inside is a part you place yourself — leave out what a layout doesn't need. Parts read shell state (`width`, `sizeClass`, `navOpen`, `setNavOpen`) through `useChatShell()`. It ships with the `discord-clone` registry block (`npx shadcn add https://blamy.github.io/ui/r/discord-clone.json`), with its channel, message, member and composer parts, so you own and edit them; the library parts it composes come from the package.

```tsx
import {
  ChatShell, ChatShellNav, ChatShellSidebar, ChatShellMain, ChatShellHeader, ChatShellNavTrigger, ChatShellTitle,
  ChatShellFooter,
} from '@/components/blocks/discord-clone/components/chat-shell';
import { Tabs, TabsBar, TabsList, TabsTab, TabsPill, SidebarContent, SidebarSection, SidebarItem } from '@brett_lamy/ui';
import { Composer, ComposerCard, ComposerInput, ComposerFooter, ComposerSpacer, ComposerSend } from '@brett_lamy/ui/composer';

export function Chat() {
  const [channel, setChannel] = useState('general');
  return (
    <ChatShell breakpoints={{ medium: 880 }}>
      <ChatShellNav>
        <Tabs variant="switcher" defaultValue="hq" className="contents">
          <TabsBar>
            <TabsList aria-label="Workspaces">
              <TabsTab value="hq" aria-label="HQ"><TabsPill />{/* tile */}</TabsTab>
            </TabsList>
          </TabsBar>
        </Tabs>
        <ChatShellSidebar>
          <SidebarContent>
            <SidebarSection title="Team">
              <SidebarItem title="general" current={channel === 'general'} onClick={() => setChannel('general')} />
              <SidebarItem title="dev" trailing={2} current={channel === 'dev'} onClick={() => setChannel('dev')} />
            </SidebarSection>
          </SidebarContent>
        </ChatShellSidebar>
      </ChatShellNav>
      <ChatShellMain>
        <ChatShellHeader><ChatShellNavTrigger /><ChatShellTitle>{channel}</ChatShellTitle></ChatShellHeader>
        <div role="log" className="min-h-0 flex-1 overflow-y-auto">{/* messages */}</div>
        <ChatShellFooter>
          <Composer onSubmit={send}>
            <ComposerCard>
              <ComposerInput placeholder={'Message #' + channel} />
              <ComposerFooter><ComposerSpacer /><ComposerSend /></ComposerFooter>
            </ComposerCard>
          </Composer>
        </ChatShellFooter>
      </ChatShellMain>
    </ChatShell>
  );
}
```

`ArtifactChatContainer` (`@brett_lamy/ui/composer`) keeps a conversation beside an artifact when space permits. Below its container breakpoint the artifact keeps the full canvas and the chat floats over it as a `FloatingSheet`: the `Composer` is its foot, the transcript grows above it, and it folds into a FAB.

```tsx
<ArtifactChatContainer working={isWorking}>
  <ArtifactChatContainerContent><Artifact /></ArtifactChatContainerContent>
  <ArtifactChatContainerChat><Conversation /></ArtifactChatContainerChat>
  <ArtifactChatContainerComposer><MyComposer /></ArtifactChatContainerComposer>
</ArtifactChatContainer>
```

## Workbench

An adaptive IDE scaffold built from parts: a thin `WorkbenchShell` root that measures itself and owns region state, and parts you place yourself. Each part picks its presentation from the shell's width class — desktop columns (1120px and wider), a right-edge panel drawer (760–1119px), or a hamburger sidebar, compact panel page, bottom tab bar, and dismissible-sheet dock below that — measured from the shell's own container, not the viewport. It ships with the T3 Code-style app, the `t3-clone` registry block; the shell is a `ThemeScope scope="workbench"`, so its menus and drawers wear the workbench palette.

```tsx
import {
  WorkbenchShell, WorkbenchSidebar, WorkbenchMain, WorkbenchHeader, WorkbenchSidebarTrigger, WorkbenchTitle,
  WorkbenchActions, WorkbenchDockTrigger, WorkbenchPanelTrigger, WorkbenchDock, WorkbenchPanel,
  WorkbenchTabBar, WorkbenchTab,
} from '@/components/blocks/t3-clone/components/workbench/workbench-shell';

export function Workbench() {
  return (
    <WorkbenchShell tint="#0a84ff">
      <WorkbenchSidebar><Threads /></WorkbenchSidebar>
      <WorkbenchMain>
        <WorkbenchHeader>
          <WorkbenchSidebarTrigger />
          <WorkbenchTitle project="cookbook">{thread.title}</WorkbenchTitle>
          <WorkbenchActions><WorkbenchDockTrigger /><WorkbenchPanelTrigger /></WorkbenchActions>
        </WorkbenchHeader>
        <Chat />
        <WorkbenchDock><Terminal /></WorkbenchDock>
      </WorkbenchMain>
      <WorkbenchPanel><Surfaces /></WorkbenchPanel>
      <WorkbenchTabBar value={surface} onValueChange={setSurface}>
        <WorkbenchTab value="chat" icon="msg">Chat</WorkbenchTab>
        <WorkbenchTab value="diff" icon="diff">Diff</WorkbenchTab>
      </WorkbenchTabBar>
    </WorkbenchShell>
  );
}
```

Descendants read and drive the shell with `useWorkbenchShell()` (`sizeClass`, `appearance`, `sidebarOpen`, `dockOpen`, `panelOpen`, `panelFullscreen`, their setters and toggles, and the two panes' controllers).

`Composer` is compositional (like shadcn's InputGroup): `Composer` owns the draft, `ComposerCard` holds `ComposerInput` (the docstream editor, `@brett_lamy/ui/docstream-editor`, a WYSIWYG editor; pasted images become attachment chips) and addons (`ComposerFooter`, `ComposerSelect`, `ComposerPill`, `ComposerSend`, …), and `ComposerBump`s attach above or below the card. Its buttons, pills and menus are the kit's `Button` and `DropdownMenu`. The `t3-clone` block's `WorkbenchComposer` is a full composition (with its `ModelPicker`). `MarkdownView` renders replies with docstream (`@brett_lamy/ui/docstream`); `SurfaceFiles` and `SurfaceDiff` use `@pierre/trees` and `@pierre/diffs`.

### Image annotation

Pressing an image attachment opens PencilKit's `ImageAnnotator`, which draws on the image with `PencilKitAnnotator` by default; Save flattens the strokes into the image. The engine is pluggable — swap it for every Composer below an `ImageAnnotatorProvider`, or per composer with the `annotator` prop (`annotator={null}` opts out to a plain preview):

```tsx
import { ImageAnnotatorProvider } from '@brett_lamy/ui/canvas';

<ImageAnnotatorProvider engine={MyEngine}>
  <App />
</ImageAnnotatorProvider>;
// or per composer: <Composer annotator={MyEngine}> (annotator={null} opts out)
```

An engine is a component that calls its `children` with `{ canvas, toolbar?, title? }`: the canvas is laid over the image (its first `<svg>` is flattened into the image on save), the toolbar sits under it.

## PencilKit

PencilKit's drawing surface in BL UI's language, on [perfect-freehand](https://github.com/steveruizok/perfect-freehand): `PencilCanvas`, the tool / ink / width pickers and undo bar on the kit's `Toolbar`, `usePencilHistory`, and `StrokePath` for rendering saved strokes. A full sketch app is the `pencilkit-sketch` registry block.

```tsx
import { useState } from 'react';
import {
  PencilCanvas, PencilToolbar, PencilToolPicker, PencilActions, usePencilHistory, type PencilTool,
} from '@brett_lamy/ui/canvas';

function Sketch() {
  const [tool, setTool] = useState<PencilTool>('pen');
  const history = usePencilHistory();
  return (
    <div className="relative h-[540px]">
      <PencilCanvas tool={tool} strokes={history.strokes} onStrokesChange={history.onStrokesChange} emptyState="Draw here">
        <PencilToolbar
          className="absolute inset-x-2.5 bottom-3.5 mx-auto"
          trailing={
            <PencilActions onUndo={history.undo} onRedo={history.redo} onClear={history.clear}
              canUndo={history.canUndo} canRedo={history.canRedo} canClear={history.canClear} />
          }
        >
          <PencilToolPicker value={tool} onValueChange={setTool} />
        </PencilToolbar>
      </PencilCanvas>
    </div>
  );
}
```

## Workspace development

```sh
pnpm nx build @brett_lamy/ui   # Vite, then docstream's per-file tsc build
pnpm nx test @brett_lamy/ui    # builds first: docstream's entry-boundary test reads dist
pnpm nx lint @brett_lamy/ui
```

The rules every module follows, and the checks CI runs, are in the repository's [CONVENTIONS.md](https://github.com/BLamy/ui/blob/main/CONVENTIONS.md).
