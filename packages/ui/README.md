# @brett_lamy/ui

Touch-first React components inspired by UIKit container patterns, built on [UI SDK](https://ui-sdk.dev) and Tailwind v4: UI SDK owns the behavior (keyboard, focus, selection, popups, ARIA), this library the look, the tokens and the iOS containers. Colors, radius and font come from your shadcn theme (CSS variables); the iOS look ships as an optional theme. The library has lists, navigation, adaptive split views, drawers, sheets, a reusable jump rail, the Composer (a Markdown prompt box), PencilKit drawing and the message scroller. Product-specific compositions (an IDE workbench, a team-chat shell, a map chat, …) are **blocks**, installed from the shadcn registry rather than this package.

## Install

Two ways, from the same source files. The docs explain both: [Installation](https://blamy.github.io/ui/#/installation) and [Optimization](https://blamy.github.io/ui/#/optimization).

- **shadcn registry (recommended for products).** `npx shadcn add https://blamy.github.io/ui/r/split-view.json` copies the source of one component and what it imports into your app (`components/ui/…`, `lib/…`), so you own the files and only ship what you use.
- **npm.** One dependency with everything in it:

```sh
npm i @brett_lamy/ui
```

Import the stylesheet once — and, for the iOS palette, the bl-theme (it sets shadcn's CSS variables; leave it out to use your own shadcn theme). `BLProvider` picks light/dark and a tint for a subtree, and `ThemeScope` scopes any set of variables to a subtree:

```css
@import '@brett_lamy/ui/styles.css';
@import '@brett_lamy/ui/theme.css'; /* optional: the iOS palette */
```

```tsx
import { BLProvider, NavigationStack, NavigationStackPage, NavigationStackBar, NavigationStackTitle, NavigationStackContent } from '@brett_lamy/ui';

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

The package is ESM with one output module per source module (`sideEffects` is limited to CSS), so bundlers drop what you don't import; component modules start with `'use client'` for Next.js.

React 19 is required (the components use `use(Context)`, `<Context value>` and `ref` as a prop).

The package depends on our fork of UI SDK under upstream's names (`@ui-sdk/core` → `npm:@brett_lamy/ui-sdk-core`, `@ui-sdk/react` → `npm:@brett_lamy/ui-sdk-react`), so `npm i @brett_lamy/ui` brings it. A registry install copies source that imports `@ui-sdk/core` and `@ui-sdk/react`: add the two aliases to your app yourself (see [Installation](https://blamy.github.io/ui/#/installation)). UI SDK puts a little runtime CSS in a cascade layer named `ui-sdk`; `styles.css` declares it first, and an app with its own Tailwind build should start its global CSS with `@layer ui-sdk;`. Coming from 5.x: [Migrating to 6.0](https://blamy.github.io/ui/#/migrating-to-6).

## IndexBar

`IndexBar` accepts application-defined string or numeric keys. Labels are optional, so dense timelines can render as dots, and `preview` accepts any React node. Hover previews without navigating; pointer drag and keyboard navigation (`ArrowUp`, `ArrowDown`, `Home`, `End`) commit a stop.

```tsx
import { IndexBar, type IndexBarItem } from '@brett_lamy/ui';

const stops: IndexBarItem<number>[] = turns.map((turn, index) => ({
  key: turn.sequence,
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

The A–Z rail of a contacts list is `alphabetItems`, which dims (but keeps reachable) the letters you leave out:

```tsx
import { IndexBar, alphabetItems } from '@brett_lamy/ui';

<IndexBar
  items={alphabetItems(['A', 'B', 'K'])}
  onJump={(letter) => scrollToSection(letter)}
/>;
```

## Exports

- Containers: `NavigationStack`, `SplitView`, `Dialog` (a card, or a tray with views in a compact container), `Sheet`, `AdaptivePane`, `Sidebar`
- Lists and navigation: `List`, `ListSection`, `ListRow`, `IndexBar`, `Tabs` (segmented, underline, the iOS tab bar, rails), `Toolbar` (plain, floating, or the iOS bottom bar for edit mode), `Breadcrumb`, `Tree`, `DataTable`
- Inputs and feedback: `Field`, `Input`, `SearchInput`, `Switch`, `Segmented`, `DateInput`, `ColorPicker`, `EmptyState`, plus shadcn-style primitives (`Button`, `Toggle`, `Select`, `Combobox`, …)
- Motion: `springs`, `springCss`, `TextMorph`, `NumberMorph`, `AnimatedHeight`, `Swap`, `Celebrate`
- Foundations: `BLProvider`, `ThemeScope`, `AppearanceProvider`, `Icon`, `Avatar`, `Spinner`
- Chat: `Composer` and its parts, conversation parts (`Conversation`, `UserMessage`, `AssistantMessage`, `WorkLog`, `ToolCall`, …), `MessageScroller`, `MarkdownView`, `FloatingSheet`, `ArtifactChatContainer`
- Editors and media: `CodeEditor`, `MarkdownEditor`, `Terminal`, `Workspace`, `DebugToolbar`, `Canvas`, PencilKit (`PencilCanvas`, `PencilToolbar`, `ImageAnnotator`), the video parts
- Blocks, installed from the registry rather than this package: the team-chat shell (`discord-clone`: `ChatShell` and its regions, channels, messages, members), the IDE workbench (`t3-clone`: `WorkbenchShell` and its parts, `WorkbenchComposer`, `ModelPicker`, the terminal dock and surfaces), the demo apps (`map-chat`, `delivery-tracking`, `split-view-demos`, `pencilkit-sketch`) and the full apps (GitHub, Apple Mail, VS Code, …)

Every component exports its props type from the package root. See the Storybook catalog for interaction and responsive examples.

## Team chat

`ChatShell` is a thin layout root: it measures its own width, owns the compact navigation drawer and applies the chat palette. Everything inside is a part you place yourself — leave out what a layout doesn't need. Parts read shell state (`width`, `compact`, `navOpen`, `setNavOpen`) through `useChatShell()`. It ships with the `discord-clone` registry block (`npx shadcn add https://blamy.github.io/ui/r/discord-clone.json`), with its channel, message, member and composer parts, so you own and edit them; the library parts it composes come from the package.

```tsx
import {
  ChatShell, ChatShellNav, ChatShellSidebar, ChatShellMain, ChatShellHeader, ChatShellNavTrigger, ChatShellTitle,
  ChatShellFooter,
} from '@/components/blocks/discord-clone/components/chat-shell';
import {
  Tabs, TabsBar, TabsList, TabsTab, TabsPill, SidebarContent, SidebarSection,
  SidebarItem, Composer, ComposerCard, ComposerInput, ComposerFooter, ComposerSpacer, ComposerSend,
} from '@brett_lamy/ui';

export function Chat() {
  const [channel, setChannel] = useState('general');
  return (
    <ChatShell breakpoint={880}>
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

`ArtifactChatContainer` keeps a conversation beside an artifact when space permits. Below its container breakpoint the artifact keeps the full canvas and the chat floats over it as a `FloatingSheet`: the `Composer` is its foot, the transcript grows above it, and it folds into a FAB.

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
        <WorkbenchTab id="chat" icon="msg">Chat</WorkbenchTab>
        <WorkbenchTab id="diff" icon="diff">Diff</WorkbenchTab>
      </WorkbenchTabBar>
    </WorkbenchShell>
  );
}
```

Descendants read and drive the shell with `useWorkbenchShell()` (`sidebarOpen`, `dockOpen`, `panelOpen`, `panelFullscreen`, their setters and toggles, `widthClass`, `compact`).

`Composer` is compositional (like shadcn's InputGroup): `Composer` owns the draft, `ComposerCard` holds `ComposerInput` (the docstream editor, `@brett_lamy/ui/docstream-editor`, a WYSIWYG editor; pasted images become attachment chips) and addons (`ComposerFooter`, `ComposerSelect`, `ComposerPill`, `ComposerSend`, …), and `ComposerBump`s attach above or below the card. Its buttons, pills and menus are the kit's `Button` and `DropdownMenu`. The `t3-clone` block's `WorkbenchComposer` is a full composition (with its `ModelPicker`). `MarkdownView` renders replies with docstream (`@brett_lamy/ui/docstream`); `SurfaceFiles` and `SurfaceDiff` use `@pierre/trees` and `@pierre/diffs`.

### Image annotation

Pressing an image attachment opens PencilKit's `ImageAnnotator`, which draws on the image with `PencilKitAnnotator` by default; Save flattens the strokes into the image. The engine is pluggable — swap it for every Composer below an `ImageAnnotatorProvider`, or per composer with the `annotator` prop (`annotator={null}` opts out to a plain preview):

```tsx
import { ImageAnnotatorProvider } from '@brett_lamy/ui';

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
  PencilCanvas, PencilToolbar, PencilToolbarPinned, PencilToolPicker, PencilActions, usePencilHistory, type PencilTool,
} from '@brett_lamy/ui';

function Sketch() {
  const [tool, setTool] = useState<PencilTool>('pen');
  const history = usePencilHistory();
  return (
    <div className="relative h-[540px]">
      <PencilCanvas tool={tool} strokes={history.strokes} onStrokesChange={history.onStrokesChange} emptyState="Draw here">
        <PencilToolbar className="absolute inset-x-2.5 bottom-3.5 mx-auto">
          <PencilToolPicker value={tool} onValueChange={setTool} />
          <PencilToolbarPinned>
            <PencilActions onUndo={history.undo} onRedo={history.redo} onClear={history.clear}
              canUndo={history.canUndo} canRedo={history.canRedo} canClear={history.canClear} />
          </PencilToolbarPinned>
        </PencilToolbar>
      </PencilCanvas>
    </div>
  );
}
```

## Workspace development

```sh
pnpm nx build @brett_lamy/ui
pnpm nx lint @brett_lamy/ui
```
