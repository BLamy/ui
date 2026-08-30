# @touchkit/workbench

An adaptive IDE/workbench scaffold for React: thread navigation, chat, a terminal dock, and pluggable right-side surfaces. The same composition becomes desktop columns, a medium-width drawer, or compact full-screen surfaces and a snap sheet.

## Install

```sh
pnpm add @touchkit/workbench @touchkit/ui react react-dom
```

The built-in Files and Diff surfaces use Pierre's renderers. Install them directly when you compose those primitives yourself:

```sh
pnpm add @pierre/diffs @pierre/trees
```

See [Diffs](https://diffs.com/docs) and [Trees](https://trees.software/docs) for their full APIs.

```tsx
import '@touchkit/ui/styles.css';
import '@touchkit/workbench/styles.css';
import { WorkbenchShell, useWorkbenchShell } from '@touchkit/workbench';

function Header() {
  const { compact, setSideSheet, panel, setPanel } = useWorkbenchShell();
  return (
    <MyHeader
      onOpenNavigation={compact ? () => setSideSheet(true) : undefined}
      panelOpen={panel}
      onTogglePanel={() => setPanel((open) => !open)}
    />
  );
}

export function Workbench() {
  return (
    <WorkbenchShell tint="#0a84ff">
      <WorkbenchShell.Sidebar><ThreadList /></WorkbenchShell.Sidebar>
      <WorkbenchShell.Main><><Header /><Conversation /></></WorkbenchShell.Main>
      <WorkbenchShell.Dock><TerminalDock /></WorkbenchShell.Dock>
      <WorkbenchShell.DockSheet><TerminalBody /></WorkbenchShell.DockSheet>
      <WorkbenchShell.Panel><ProjectSurface /></WorkbenchShell.Panel>
      <WorkbenchShell.TabBar><MobileSurfaceTabs /></WorkbenchShell.TabBar>
    </WorkbenchShell>
  );
}
```

Slots take ordinary React elements. Descendants read state with `useWorkbenchShell()`; no context prop or global namespace is required. The hook throws a clear error outside `WorkbenchShell`.

## Responsive behavior

| Shell width | Behavior |
| --- | --- |
| 1120px and wider | Sidebar, main/dock, and optional surface panel render as columns |
| 760-1119px | The surface panel becomes a right-edge overlay drawer |
| Below 760px | Sidebar becomes an overlay, terminal uses `SnapSheet`, surfaces use the compact tab bar |

The shell measures its own container, not the browser viewport, so it works in resizable panes and embedded tools.

## Context and state

`useWorkbenchShell()` exposes `wc`, `compact`, sidebar and terminal visibility, terminal height, panel visibility, active compact tab, full-screen state, and their setters. Use these values inside small slot components so each region owns only its relevant behavior.

## Other exports

- Conversation: `MessageScroller`, `ChatView`, `Composer`, `EmptyThread`, `WorkTrace`
- Navigation and surfaces: `ThreadSidebar`, `SurfacePanel`, `SurfaceTabBar`, surface views
- File and review rendering: `SurfaceFiles` backed by `@pierre/trees`; `SurfaceDiff` backed by `@pierre/diffs`
- Terminal: `TerminalDock`, `TermHeader`, `TermBody`, `SnapSheet`
- Markdown: `MarkdownView`, backed by `@brett_lamy/docstream`

`Composer` uses `@brett_lamy/docstream-editor` for structured GitBook-flavored Markdown.
Type `/` for blocks; Enter sends a plain top-level paragraph, structured blocks retain their
native Enter behavior, and ⌘/Ctrl+Enter always sends. Pasted Markdown becomes rich nodes while
pasted images keep the Workbench annotation flow.

The package ships runnable Storybook examples for every shell width class, empty chat state, terminal sheet, panel drawer, and full-screen surface.

## Workspace development

```sh
pnpm nx build @touchkit/workbench
pnpm nx lint @touchkit/workbench
```
