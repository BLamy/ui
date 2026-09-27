# @brett_lamy/ui

Touch-first React components inspired by UIKit container patterns. The package includes theme tokens, haptics, lists, navigation, adaptive split views, drawers, sheets, and a reusable jump rail — plus a team-chat scaffold (`ChatShell`, `ArtifactChatContainer`, `FloatingSheet`) and an IDE workbench (`WorkbenchShell`, `Composer`, `MessageScroller`, terminal dock, surfaces, `MarkdownView`). Drawing lives in the companion package `@brett_lamy/pencilkit`.

## Install

```sh
npm i @brett_lamy/ui
```

Import the stylesheet once, then wrap the part of the app that uses BL UI tokens:

```tsx
import '@brett_lamy/ui/styles.css';
import { BLProvider, NavigationStack } from '@brett_lamy/ui';

export function App() {
  return (
    <BLProvider tint="#0a84ff">
      <NavigationStack screens={screens} onPop={handlePop} />
    </BLProvider>
  );
}
```

React 18 and 19 are supported peer dependencies.

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

- Containers: `NavigationStack`, `SplitView`, `Credenza`, `SideDrawer`, `EdgeDrawer`, `AdaptivePane`, `Sidebar`
- Lists and navigation: `List`, `List.Section`, `List.Row`, `IndexBar`, `TabBar`, `TabView`, `EditBar`
- Inputs and feedback: `SearchField`, `Switch`, `Segmented`, `Haptics`, `HapticIndicator`, plus shadcn-style primitives (`Button`, `Dialog`, `Sheet`, `Select`, `ComboBox`, `Tabs`, …)
- Motion: `springs`, `springCss`, `TextMorph`, `NumberMorph`, `AnimatedHeight`, `ContentSwap`, `Celebrate`
- Foundations: `BLProvider`, `Icon`, `Avatar`, `Spinner`, token helpers
- Team chat: `ChatShell`, `WorkspaceRail`, `ChannelList`, `Message`, `ChatComposer`, `ThreadPreview`, `RichText`, `ChatUsersProvider`, `FloatingSheet`, `FloatingChat`, `ChatColumn`, `ArtifactChatContainer`
- Workbench: `WorkbenchShell` and its parts (`WorkbenchSidebar`, `WorkbenchMain`, `WorkbenchHeader`, `WorkbenchDock`, `WorkbenchPanel`, `WorkbenchTabBar`, …), thread sidebar parts (`ThreadSidebar`, `ThreadList`, `ThreadGroup`, `ThreadItem`, …), conversation parts (`Conversation`, `UserMessage`, `AssistantMessage`, `WorkLog`, `ToolCall`, …), `TerminalHeader` / `TerminalBody`, surfaces (`SurfacePicker`, `SurfaceBrowser`, `SurfaceFiles`, `SurfaceDiff`, `SurfaceAgents`), `Composer` and its parts, `ModelPicker`, `MessageScroller`, `SnapSheet`, `MarkdownView`
- Demo apps: `ChatDemo`, `MapChatDemo`, `DeliveryTrackingDemo`, `SidebarDemo`, `HapticsPlayground`

Every component exports its props type from the package root. See the Storybook catalog for interaction and responsive examples.

## Team chat

`ChatShell` provides an adaptive workspace rail, channel navigation, and main-content region without prescribing application data or routing. Slots take ordinary React elements; a component inside the shell reads layout state (`w`, `compact`, `navOpen`, `setNavOpen`) through `useChatShell()`.

```tsx
import { ChatShell, useChatShell } from '@brett_lamy/ui';

function ChannelNav() {
  const { compact, setNavOpen } = useChatShell();
  return <MyChannelList onClose={compact ? () => setNavOpen(false) : undefined} onPick={() => setNavOpen(false)} />;
}

export function Chat() {
  return (
    <ChatShell breakpoint={880}>
      <ChatShell.Rail><MyWorkspaceRail /></ChatShell.Rail>
      <ChatShell.Nav><ChannelNav /></ChatShell.Nav>
      <ChatShell.Main><Conversation /></ChatShell.Main>
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

An adaptive IDE scaffold built from parts: a thin `WorkbenchShell` root that measures itself and owns region state, and parts you place yourself. Each part picks its presentation from the shell's width class — desktop columns (1120px and wider), a right-edge panel drawer (760–1119px), or a hamburger sidebar, compact panel page, bottom tab bar, and snap-sheet dock below that — measured from the shell's own container, not the viewport. The full T3 Code-style app is the `t3-clone` registry block.

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

Pressing an attachment opens `AnnotateLightbox`. The drawing surface is pluggable, so this package doesn't depend on a drawing library: without an annotator the lightbox is a plain preview. `@brett_lamy/pencilkit` ships `PencilKitAnnotator`:

```tsx
import { ComposerAnnotatorProvider } from '@brett_lamy/ui';
import { PencilKitAnnotator } from '@brett_lamy/pencilkit';

<ComposerAnnotatorProvider annotator={PencilKitAnnotator}>
  <App />
</ComposerAnnotatorProvider>;
// or per composer: <Composer annotator={PencilKitAnnotator}> (annotator={null} opts out)
```

An annotator is a component that calls its `children` with `{ canvas, toolbar?, title? }`: the canvas is laid over the image (its first `<svg>` is flattened into the image on save), the toolbar sits under it.

## Workspace development

```sh
pnpm nx build @brett_lamy/ui
pnpm nx lint @brett_lamy/ui
```
