# TouchKit

An iOS-flavored React component framework — Cocoa Touch container semantics, shadcn-style composable APIs, react-aria-components underneath — organized as an Nx + pnpm monorepo and cataloged in Storybook by atomic design.

## Packages (`packages/`)

| Package | What it is |
| --- | --- |
| `@touchkit/ui` | Core: `TouchKitProvider` (light/dark `--tk-*` tokens, tint, Dynamic Island `safeTop`), Haptics engine, `Icon`, `Avatar`, `Switch`, `Segmented`, `List`/`List.Section`/`List.Row` (sticky headers, swipe-to-delete, edit mode), `IndexBar`, `TabBar`, `EditBar`, `NavigationStack` (edge-swipe back, pull-to-refresh, scroll-away chrome), `SplitView`, `Credenza`, `SideDrawer` |
| `@touchkit/chatkit` | `ChatShell` (+ `.Rail/.Nav/.Main` slots, `useChatShell()`), `Message`, `Composer`, `ChannelList`, `ThreadPreview`, `RichText`, `ChatUsersProvider` |
| `@touchkit/workbench` | `WorkbenchShell` slot system (adaptive desktop / medium drawer / compact tab bar), `ThreadSidebar`, `MessageScroller`, `ChatView`, `Composer`, `TerminalDock`, `SnapSheet`, `SurfacePanel` + surfaces, `WorkTrace`, `MarkdownView` |
| `@touchkit/beautiful` | 33 AI-native primitives in the workbench dark language: `LoadingState`, `Thinking`, `StreamingText`, `ApprovalCard`, agent tables, `Sidebar` system, `CommandMenu`, `Toast`, `PlanReview`, `AgentBoard`, pickers, … |
| `@touchkit/pencilkit` | `PencilCanvas` + decomposed toolbar slots (`ToolPicker`, `InkPicker`, `WidthPicker`, `PencilActions`), `usePencilHistory`, on `perfect-freehand` |

Conventions (see `CONVENTIONS.md`): every component takes `className`/`style` merged last, carries `data-slot`, composes via compound components + context hooks rather than render props. `@touchkit/beautiful` primitives slot into workbench (e.g. a `Thinking` accordion as `WorkTrace` children).

## Apps (`apps/`)

Each app consumes only package public APIs — proof the library distributes cleanly.

| App | Port | Demo |
| --- | --- | --- |
| `contacts` | 4201 | The full TouchKit demo (SplitView/NavigationStack/TabBar compositions, phone/tablet/fluid frame switcher) |
| `workbench-app` | 4202 | T3-style IDE workbench |
| `chat` | 4203 | Team chat (rail · channels · threads) |
| `pencil` | 4204 | Freehand drawing |
| `beautiful` | 4205 | Beautiful UI catalog page |
| `docs` | 4206 | GitBook-style TouchKit documentation — 50 pages, 47 live component embeds |
| `catalog` | 6006 | Storybook — 226 stories, Atoms → Molecules → Organisms → Templates → Pages |

## Commands

```sh
pnpm install
pnpm storybook            # component catalog on :6006
pnpm dev:contacts         # (or dev:chat, dev:pencil, dev:workbench, dev:beautiful)
pnpm nx run-many -t build # build every package + app
```

The visual source of truth is the prototype bundle in `../project/*.jsx`; ports are pixel-identical.
