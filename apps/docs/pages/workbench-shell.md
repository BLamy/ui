# WorkbenchShell

An IDE-style agent workspace, built from parts. `WorkbenchShell` is a thin layout root: it measures itself, owns the region state, and provides it through context. Every region is a part you place yourself — the sidebar, main column, header, bottom dock, right panel, and compact tab bar — and each part picks its own presentation from the shell's width class. Nothing is configured through props or slot functions; leave a part out and its region simply isn't there.

## Installation

{% tabs %}
{% tab title="npm" %}
```sh
npm install @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  WorkbenchShell, WorkbenchSidebar, WorkbenchMain,
  WorkbenchHeader, ThreadList, ThreadItem, Conversation,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="pnpm" %}
```sh
pnpm add @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  WorkbenchShell, WorkbenchSidebar, WorkbenchMain,
  WorkbenchHeader, ThreadList, ThreadItem, Conversation,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="yarn" %}
```sh
yarn add @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  WorkbenchShell, WorkbenchSidebar, WorkbenchMain,
  WorkbenchHeader, ThreadList, ThreadItem, Conversation,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="bun" %}
```sh
bun add @brett_lamy/ui
```

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  WorkbenchShell, WorkbenchSidebar, WorkbenchMain,
  WorkbenchHeader, ThreadList, ThreadItem, Conversation,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
```sh
npx shadcn@latest add https://blamy.github.io/ui/r/workbench-shell.json
```

Adds `@/components/ui/workbench-shell.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  WorkbenchShell, WorkbenchSidebar, WorkbenchMain,
  WorkbenchHeader, ThreadList, ThreadItem, Conversation,
} from '@/components/ui/workbench-shell'
```
{% endtab %}
{% endtabs %}

```tsx
import {
  WorkbenchShell, WorkbenchSidebar, WorkbenchMain, WorkbenchHeader, WorkbenchSidebarTrigger, WorkbenchTitle,
  WorkbenchActions, WorkbenchDockTrigger, WorkbenchPanelTrigger, WorkbenchDock, WorkbenchPanel,
  WorkbenchTabBar, WorkbenchTab,
} from '@brett_lamy/ui'

<WorkbenchShell tint="#0A84FF">
  <WorkbenchSidebar><Threads /></WorkbenchSidebar>
  <WorkbenchMain>
    <WorkbenchHeader>
      <WorkbenchSidebarTrigger />
      <WorkbenchTitle project="cookbook">{thread.title}</WorkbenchTitle>
      <WorkbenchActions>
        <WorkbenchDockTrigger />
        <WorkbenchPanelTrigger />
      </WorkbenchActions>
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
```

## The T3 Code clone

Every part at once: the `t3-clone` registry block — thread sidebar, a streaming conversation, the terminal dock, and a surface panel. The code panel shows the block's `page.tsx`; its sidebar, conversation, and panel are three more short files built from the parts below, and `npx shadcn add` copies all of them into your app. Switch widths to watch each region move.

{% demo src="blocks/t3-clone" %}

## Layout parts

| Part | Role |
| --- | --- |
| `WorkbenchShell` | Grid root. `tint`, `appearance`, and the initial state: `defaultSidebarOpen`, `defaultDockOpen`, `defaultDockHeight`, `defaultPanelOpen`, `defaultPanelFullscreen`. |
| `WorkbenchSidebar` | Left region. `width` (242) for the column, `drawerWidth` (280) for the compact drawer. |
| `WorkbenchSidebarTrigger` · `WorkbenchSidebarClose` | Header toggle (a hamburger when compact) · the drawer's × (renders only when compact). |
| `WorkbenchMain` | Centre column: header, content, then the dock. |
| `WorkbenchHeader` · `WorkbenchTitle` · `WorkbenchActions` · `WorkbenchAction` | The 44px title bar: `project / title` crumb that fills the free space, then a row of icon actions. |
| `WorkbenchDock` · `WorkbenchDockTrigger` · `WorkbenchDockClose` | Bottom dock, resizable from its top edge (`minHeight` 110, `maxHeight` 520); `snaps` for the compact sheet. |
| `WorkbenchPanel` · `WorkbenchPanelTrigger` | Right region (an inspector) and its header toggle (hidden when compact). |
| `WorkbenchPanelHeader` · `WorkbenchPanelTitle` · `WorkbenchPanelFullscreen` · `WorkbenchPanelClose` | The panel's bar: icon + name, full-screen toggle (hidden when compact), close. |
| `WorkbenchTabBar` · `WorkbenchTab` | Compact-only view switcher. The `mainTab` (default `chat`) shows the main column; any other tab opens the panel page and reports its id through `onValueChange`. |

Triggers take an optional `onPress` that replaces their default action. Every part also works outside a shell — the triggers then do nothing unless given `onPress`, the dock renders inline with its own height, and the tab bar always shows — so a panel or a terminal can be dropped into any layout.

## Responsive regions

| Region | Regular ≥ 1120px | Medium 760–1119px | Compact < 760px |
| --- | --- | --- | --- |
| `WorkbenchSidebar` | Column, toggled | Column, toggled | [EdgeDrawer](#edge-drawer) over the whole shell |
| `WorkbenchDock` | Inline, open by default | Inline, closed by default | `SnapSheet` (52% / 93% snaps) |
| `WorkbenchPanel` | Column (`clamp(300px, 32%, 420px)`), open by default | Right EdgeDrawer over a scrim | A page covering everything above the tab bar |
| Panel full screen | Covers the whole shell | Covers the whole shell | — |
| `WorkbenchTabBar` | Not rendered | Not rendered | Bottom bar |

Widths are measured on the shell's own box (`useContainerWidth` → `workbenchWidthClass`), so nested and resizable workbenches behave. The sidebar and panel are [AdaptivePanes](#adaptive-pane); the shell keeps separate state for the wide and compact presentations, so crossing the breakpoint never pops a drawer open.

## Context

`useWorkbenchShell()` (throws outside a shell) and `useOptionalWorkbenchShell()` (returns `null`) expose:

| Field | Meaning |
| --- | --- |
| `width` · `widthClass` · `compact` | Measured width and its class. |
| `sidebarOpen` · `setSidebarOpen` · `toggleSidebar` | Column visibility, or the drawer when compact. |
| `dockOpen` · `setDockOpen` · `toggleDock` · `dockHeight` · `setDockHeight` | Dock (or sheet) visibility and height. |
| `panelOpen` · `setPanelOpen` · `togglePanel` | Column / drawer visibility, or the panel page when compact. |
| `panelFullscreen` · `setPanelFullscreen` | Full-screen panel. |
| `appearance` | The resolved light / dark palette. |

## Thread sidebar parts

| Part | Role |
| --- | --- |
| `ThreadSidebar` | The column: header, toolbar, list, footer. |
| `ThreadSidebarHeader` · `ThreadSidebarBrand` | App mark and name (`icon` replaces the tinted tile); put a `WorkbenchSidebarClose` after it. |
| `ThreadSidebarToolbar` · `ThreadSearch` · `ThreadNewButton` | Controlled search field and the compose button. |
| `ProjectSwitcher` | The current project row. |
| `ThreadList` · `ThreadGroup` | The scroller and its labelled groups; `collapsible` groups fold on a spring. |
| `ThreadItem` | A thread: `active`, `meta` (its age), and `status` — `running` (pulsing dot), `unread` (bold + dot), `error`. |
| `ThreadShowMore` | "Show N more" for a truncated group. |
| `ThreadSidebarFooter` · `SidebarNotice` · `SidebarFooterItem` · `SidebarUser` | Footer callout, rows like Settings, and the signed-in user. |

Inside a shell, choosing a thread or starting a new one closes the compact drawer on its own.

## Conversation parts

| Part | Role |
| --- | --- |
| `Conversation` | Root; `empty` switches to the empty state. Keep the children in this order. |
| `ConversationEmpty` · `ConversationGreeting` | Above the composer while empty; leaves upward when the thread starts. |
| `ConversationMessages` | Keyed messages in a `MessageScroller`: each `UserMessage` anchors near the top, replies grow below. `threadKey`, `streaming`, `peek`. |
| `ConversationComposer` | Docks the composer: centred while empty, at the bottom after — the same element, so it flies between the two. |
| `ConversationSuggestions` · `Suggestion` | Chips under the empty composer. |
| `UserMessage` | Right-aligned bubble, with `images` above it. |
| `AssistantMessage` · `MessageMarkdown` · `ConversationTyping` | The reply: streaming Markdown, with the typing dots until the first token. |
| `WorkLog` · `ToolCall` | "Worked for 42s", expanding into the steps behind the reply — a title, a `detail`, a `code` well, and a `status`. |
| `SettledBanner` | Above the composer of a settled thread. |

## Terminal and surface parts

| Part | Role |
| --- | --- |
| `TerminalHeader` · `TerminalAction` · `TerminalBody` | Session bar with actions, and a small interactive shell (`seed`, `run`, `user`, `cwd`). |
| `SurfacePicker` | The panel's empty state: a card per surface. |
| `SurfaceBrowser` · `SurfaceAppPreview` | URL bar over a page well, and a placeholder page. |
| `SurfaceFiles` | A `@pierre/trees` file tree (`paths`, `selected`). |
| `SurfaceDiff` | A `@pierre/diffs` unified diff (`oldFile`, `newFile`), themed to the appearance. |
| `SurfaceAgents` | Subagent and workflow runs with status dots. |
| `SurfaceTerminal` | A dark well for a `TerminalBody` in the panel. |

## Compositions

### Chat only

A sidebar and a conversation — no dock, no panel. Leaving parts out is the whole configuration.

{% demo src="workbench-shell/chat-only" %}

### Chat with a diff inspector

No sidebar; the panel is an inspector showing the agent's change. At this width it is a column; narrower, the same panel slides over as a drawer.

{% demo src="workbench-shell/diff-inspector" %}

### Phone

At compact width the header's sidebar toggle becomes a hamburger, and the dock is a `SnapSheet`: it rises on a spring, follows the finger (rubber-banding past the top), and its release velocity picks a snap or dismisses it.

{% demo src="workbench-shell/phone" %}

### Agent console

A run monitor instead of a chat: the work log is the main content, the dock tails the logs, and the panel lists the runs.

{% demo src="workbench-shell/agent-console" %}

### The first message

A new thread is a `Conversation` with `empty`: the greeting, the composer centred, suggestions. Sending the first message turns it into the thread around the *same* composer — the greeting leaves, the composer travels down to its dock with its draft and focus, and the first turn rises in:

{% demo src="workbench-shell/first-message" %}

### The compact terminal on its own

`SnapSheet` is also usable directly. A slow drag settles at the nearest snap; a flick carries on to the next — or down past the lowest to close. Settling ticks; dismissal thumps.

{% demo src="workbench-shell/snap-sheet" %}

## Terminal

`TerminalBody` is a tiny echo shell for demos — `ls`, `pwd`, `echo`, `whoami`, `npm run dev`, `clear`, `help` — or pass `run` to drive it yourself. Enter runs with a tick. Click into it and type:

{% demo src="workbench-shell/terminal" %}

## Surfaces

A `WorkbenchPanel` works outside a shell too. The picker, then any surface — the close button returns to the picker:

{% demo src="workbench-shell/surfaces" %}

## File tree

Every workspace file tree in BL UI is rendered by **[Pierre Trees](https://trees.software/)** (`@pierre/trees`). `SurfaceFiles` supplies BL UI tokens and haptics while Pierre owns path-first selection, expansion, search, keyboard navigation, and virtualization.

```sh
pnpm add @pierre/trees
```

{% demo src="workbench-shell/file-tree" %}

See the full [Trees documentation](https://trees.software/docs).

## Code diff

Every source diff in BL UI is rendered by **[Pierre Diffs](https://diffs.com/)** (`@pierre/diffs`), including `SurfaceDiff`. Pierre supplies Shiki syntax highlighting, unified and split layouts, selection, and scalable rendering.

```sh
pnpm add @pierre/diffs
```

{% demo src="workbench-shell/code-diff" %}

See the full [Diffs documentation](https://diffs.com/docs).
