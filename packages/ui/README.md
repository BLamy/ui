# @brett_lamy/ui

Touch-first React components inspired by UIKit container patterns, built on react-aria-components and Tailwind v4. Colors, radius and font come from your shadcn theme (CSS variables); the iOS look ships as an optional theme. The library has lists, navigation, adaptive split views, drawers, sheets, a reusable jump rail, the Composer (a Markdown prompt box), PencilKit drawing and the message scroller. Product-specific compositions (an IDE workbench, a team-chat shell, a map chat, …) are **blocks**, installed from the shadcn registry rather than this package.

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
import { BLProvider, NavigationStack } from '@brett_lamy/ui';

export function App() {
  return (
    <BLProvider tint="#0a84ff">
      <NavigationStack screens={screens} onPop={handlePop} />
    </BLProvider>
  );
}
```

The package is ESM with one output module per source module (`sideEffects` is limited to CSS), so bundlers drop what you don't import; component modules start with `'use client'` for Next.js.

React 19 is required (the components use `use(Context)`, `<Context value>` and `ref` as a prop).

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
  label="Jump to conversation turn"
  onJump={(sequence) => scrollToTurn(sequence)}
/>;
```

If `items` is omitted or empty, the component retains its A-Z form:

```tsx
<IndexBar
  avail={new Set(['A', 'B', 'K'])}
  onLetter={(letter) => scrollToSection(letter)}
/>;
```

## Exports

- Containers: `NavigationStack`, `SplitView`, `Credenza`, `SideDrawer`, `AdaptivePane`, `Sidebar`
- Lists and navigation: `List`, `List.Section`, `List.Row`, `IndexBar`, `TabBar`, `TabView`, `EditBar`
- Inputs and feedback: `SearchField`, `Switch`, `Segmented`, plus shadcn-style primitives (`Button`, `Dialog`, `Sheet`, `Select`, `ComboBox`, `Tabs`, …)
- Motion: `springs`, `springCss`, `TextMorph`, `NumberMorph`, `AnimatedHeight`, `ContentSwap`, `Celebrate`
- Foundations: `BLProvider`, `ThemeScope`, `AppearanceProvider`, `Icon`, `Avatar`, `Spinner`
- Team chat: `ChatShell` and its regions (`ChatShellNav`, `ChatShellSidebar`, `ChatShellMain`, `ChatShellHeader`, `ChatShellAside`, `ChatShellPanel`…), `FloatingSheet`, `FloatingChat`, `ChatColumn`, `ArtifactChatContainer` (the Discord parts — channels, messages, threads, members — live in the `discord-clone` registry block)
- Workbench: `WorkbenchShell` and its parts (`WorkbenchSidebar`, `WorkbenchMain`, `WorkbenchHeader`, `WorkbenchDock`, `WorkbenchPanel`, `WorkbenchTabBar`, …), conversation parts (`Conversation`, `UserMessage`, `AssistantMessage`, `WorkLog`, `ToolCall`, …), `TerminalHeader` / `TerminalBody`, surfaces (`SurfacePicker`, `SurfaceBrowser`, `SurfaceFiles`, `SurfaceDiff`, `SurfaceAgents`), `Composer` and its parts, `ModelPicker`, `MessageScroller`, `MarkdownView`
- Demo apps: `MapChatDemo`, `DeliveryTrackingDemo`, `SidebarDemo` (full apps — Discord, T3 Code, GitHub — are registry blocks)

Every component exports its props type from the package root. See the Storybook catalog for interaction and responsive examples.

## Team chat

`ChatShell` is a thin layout root: it measures its own width, owns the compact navigation drawer and applies the chat palette. Everything inside is a part you place yourself — leave out what a layout doesn't need. Parts read shell state (`width`, `compact`, `navOpen`, `setNavOpen`) through `useChatShell()`. A full Discord-style app ships as the `discord-clone` registry block, with its channel, message, member and composer parts (install it to own and edit them).

```tsx
import {
  ChatShell, ChatShellNav, ChatShellSidebar, ChatShellMain, ChatShellHeader, ChatShellNavTrigger, ChatShellTitle,
  ChatShellFooter, TabView, TabViewBar, TabViewList, TabViewTab, TabViewIndicator, SidebarContent, SidebarSection,
  SidebarItem, Composer, ComposerCard, ComposerInput, ComposerFooter, ComposerSpacer, ComposerSend,
} from '@brett_lamy/ui';

export function Chat() {
  const [channel, setChannel] = useState('general');
  return (
    <ChatShell breakpoint={880}>
      <ChatShellNav>
        <TabView orientation="vertical" defaultSelectedKey="hq" className="contents">
          <TabViewBar variant="workspace">
            <TabViewList aria-label="Workspaces">
              <TabViewTab id="hq" textValue="HQ"><TabViewIndicator variant="pill" />{/* tile */}</TabViewTab>
            </TabViewList>
          </TabViewBar>
        </TabView>
        <ChatShellSidebar>
          <SidebarContent>
            <SidebarSection title="Team">
              <SidebarItem label="general" active={channel === 'general'} onPress={() => setChannel('general')} />
              <SidebarItem label="dev" badge={2} active={channel === 'dev'} onPress={() => setChannel('dev')} />
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

`ArtifactChatContainer` keeps a conversation beside an artifact when space permits. Below its container breakpoint the artifact keeps the full canvas and the `Composer` floats over it, with the transcript on a draggable top bump.

```tsx
<ArtifactChatContainer working={isWorking}>
  <ArtifactChatContainer.Chat><Conversation /></ArtifactChatContainer.Chat>
  <ArtifactChatContainer.Composer><MyComposer /></ArtifactChatContainer.Composer>
  <ArtifactChatContainer.Content><Artifact /></ArtifactChatContainer.Content>
</ArtifactChatContainer>
```

## Workbench

An adaptive IDE scaffold built from parts: a thin `WorkbenchShell` root that measures itself and owns region state, and parts you place yourself. Each part picks its presentation from the shell's width class — desktop columns (1120px and wider), a right-edge panel drawer (760–1119px), or a hamburger sidebar, compact panel page, bottom tab bar, and dismissible-sheet dock below that — measured from the shell's own container, not the viewport. The full T3 Code-style app is the `t3-clone` registry block.

```tsx
import {
  WorkbenchShell, WorkbenchSidebar, WorkbenchMain, WorkbenchHeader, WorkbenchSidebarTrigger, WorkbenchTitle,
  WorkbenchActions, WorkbenchDockTrigger, WorkbenchPanelTrigger, WorkbenchDock, WorkbenchPanel,
  WorkbenchTabBar, WorkbenchTab,
} from '@brett_lamy/ui';

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

`Composer` is compositional (like shadcn's InputGroup): `Composer` owns the draft, `ComposerCard` holds `ComposerInput` (the `@brett_lamy/docstream-editor` WYSIWYG editor; pasted images become attachment chips) and addons (`ComposerFooter`, `ComposerSelect`, `ModelPicker`, `ComposerSend`, …), and `ComposerBump`s attach above or below the card. `WorkbenchComposer` is the default composition. `MarkdownView` renders replies with `@brett_lamy/docstream`; `SurfaceFiles` and `SurfaceDiff` use `@pierre/trees` and `@pierre/diffs`.

### Image annotation

Pressing an attachment opens `AnnotateLightbox`, which draws on the image with `PencilKitAnnotator` by default; Save flattens the strokes into the image. The annotator is pluggable — swap it for every Composer below a `ComposerAnnotatorProvider`, or per composer with the `annotator` prop (`annotator={null}` opts out to a plain preview):

```tsx
import { ComposerAnnotatorProvider } from '@brett_lamy/ui';

<ComposerAnnotatorProvider annotator={MyAnnotator}>
  <App />
</ComposerAnnotatorProvider>;
// or per composer: <Composer annotator={MyAnnotator}> (annotator={null} opts out)
```

An annotator is a component that calls its `children` with `{ canvas, toolbar?, title? }`: the canvas is laid over the image (its first `<svg>` is flattened into the image on save), the toolbar sits under it.

## PencilKit

PencilKit's drawing surface in BL UI's language, on [perfect-freehand](https://github.com/steveruizok/perfect-freehand): `PencilCanvas`, the tool / ink / width pickers and undo bar, `usePencilHistory`, and `StrokePath` for rendering saved strokes.

```tsx
import { PencilKitDemo, demoStrokes } from '@brett_lamy/ui';

<div style={{ position: 'relative', height: 540 }}>
  <PencilKitDemo defaultStrokes={demoStrokes()} style={{ position: 'absolute', inset: 0 }} />
</div>;
```

## Workspace development

```sh
pnpm nx build @brett_lamy/ui
pnpm nx lint @brett_lamy/ui
```
