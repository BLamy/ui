# Hooks

Every hook BL UI defines, in one table, and where each is documented in detail. Most are the read side of a component: they return the state a parent provides (`useSplitView`, `useToast`), and they throw, return `null` or fall back to a default when you call them in the wrong place. A few are standalone utilities (`useContainerWidth`, `usePersistentState`, `useHotkey`), and a handful are building blocks for gestures and motion.

## Public and registry-only

BL UI ships two ways from the same files (see [How the registry works](https://blamy.github.io/ui/#/registry)), and the hooks follow:

- **Public** hooks are re-exported from the package root: `import { useToast } from '@brett_lamy/ui'`. They are also in the registry, so a source copy gives you the same hook at an alias path (`@/components/ui/toast`, `@/lib/container`).
- **Registry-only** hooks are not in the package root. Seven are: `useTabPanelDirection`, `useBackHistory`, `usePullToRefresh`, `useTitleFlight`, `usePersistentHost`, `useAttachHost` and `useRowLabel`. They are internals of components (`NavigationStack`, `Tabs`, `ArtifactChatContainer`, `ListRow`) and are copied into your project, with the component that uses them, when you add that component. You can also add one on its own, for example `npx shadcn@latest add https://blamy.github.io/ui/r/back-history.json`.

A "must be called under" entry below means the hook reads a React context that the named component provides. Components render their children where you put them, so the rule is about the **React tree**, not the DOM: a node rendered through a portal sees the context of the place the portal was created, not of the element it lands in.

## All hooks

Grouped by page. "Needs" is the component or provider the hook must be called under, and what happens outside it. "Export" says whether it is in the package root (`public`) or only in the registry (`registry-only`).

### Layout

Documented on [Layout hooks](https://blamy.github.io/ui/#/hooks-layout).

| Hook | Returns | Needs | Export |
| --- | --- | --- | --- |
| `useContainerWidth` | `[ref, width]` | nothing | public |
| `useContainerSize` | `[ref, { width, height }]` | nothing | public |
| `useSplitView` | split view state and actions | `SplitView`; throws outside | public |
| `useSplitViewColumn` | the column name | a split view column; `null` outside | public |
| `useSplitViewBack` | `{ title, back }` | a `NavigationStack` at the root of a column; `null` outside | public |
| `useSplitViewStack` | `{ push, pop, popToRoot, depth, canPop }` | `SplitViewStack`; throws outside | public |
| `useSidebar` | `{ open, setOpen, toggle, narrow }` | `SidebarProvider`; throws outside | public |
| `useTabView` | `{ orientation, placement, variant }` | `TabView`; defaults outside | public |
| `useTabViewTab` | the tab's react-aria render state | the content of a `TabViewTab`; `null` outside | public |
| `useFloatingSheet` | `{ open, setOpen, progress, peek, minimized, setMinimized }` | `FloatingSheet`; throws outside | public |
| `useFloatingChat` | `{ open, setOpen, progress, composing, minimized, … }` | `FloatingChat`; throws outside | public |
| `useArtifactChatContainer` | `{ width, layout, compact, chatOpen, … }` | `ArtifactChatContainer`; throws outside | public |

### Motion

Documented on [Motion hooks](https://blamy.github.io/ui/#/hooks-motion).

| Hook | Returns | Needs | Export |
| --- | --- | --- | --- |
| `useMotion` | the `framer-motion` module | nothing | public |
| `useSpringTransition` | a spring, or `{ duration: 0 }` | nothing | public |
| `useDirection` | `-1`, `0` or `1` | nothing | public |
| `useMorphTransition` | a framer-motion `Transition` | `MorphGroup`, optional; the `smooth` spring outside | public |
| `useTabPanelDirection` | CSS variables `--bl-dx`, `--bl-dy` | `Tabs` or `TabView`; direction `0` outside | registry-only |
| `useTitleFlight` | `{ fly, scrub, release, end, isCurrent }` | nothing (takes a ref) | registry-only |
| `useEdgeSwipe` | `{ bind }` | nothing (spread on an element) | public |
| `useSheetDrag` | `{ reveal, minimize, dragging, handlers, toggle, … }` | nothing (spread on a handle) | public |
| `usePullToRefresh` | `{ refreshing, bind }` | nothing (takes refs) | registry-only |

### Theme

Documented on [Theme hooks](https://blamy.github.io/ui/#/hooks-theme).

| Hook | Returns | Needs | Export |
| --- | --- | --- | --- |
| `useAppearance` | `'light'`, `'dark'` or `undefined` | nothing; reads `AppearanceProvider`, else `<html class="dark">` | public |
| `useThemeScopeProps` | `{ data-theme-scope, className, style }` | `ThemeScope`; `{}` outside | public |
| `useChromeHidden` | `boolean` | nothing (a global store) | public |
| `useScrollHidden` | `boolean` | nothing (takes the scroller's ref) | public |
| `useWorkbenchAppearance` | `'light'` or `'dark'` | `WorkbenchTheme`, optional; the ambient value, else `'dark'` outside | public |

### State and platform

Documented on [State hooks](https://blamy.github.io/ui/#/hooks-state).

| Hook | Returns | Needs | Export |
| --- | --- | --- | --- |
| `usePersistentState` | `[value, setValue]` | nothing | public |
| `useControllableState` | `[value, set]` | nothing | public |
| `useHotkey` | nothing | nothing | public |
| `usePersistentHost` | a detached `HTMLElement` | nothing; `null` on the server | registry-only |
| `useAttachHost` | nothing | nothing | registry-only |
| `useBackHistory` | nothing | nothing | registry-only |
| `useRowLabel` | an `aria-labelledby` id or `undefined` | a `ListRow` with a title; `undefined` outside | registry-only |

### Composer

Documented on [Composer hooks](https://blamy.github.io/ui/#/hooks-composer).

| Hook | Returns | Needs | Export |
| --- | --- | --- | --- |
| `useComposer` | the draft, attachments and actions | `Composer`; throws outside | public |
| `useComposerBump` | `{ side, open, setOpen, reveal, progress, … }` | `ComposerBump`; throws outside | public |
| `useComposerAnnotator` | an annotator component, or `null` | nothing; reads `ComposerAnnotatorProvider`, else `PencilKitAnnotator` | public |
| `usePencilHistory` | strokes with undo, redo and clear | nothing | public |

### Feedback

Documented on [Feedback hooks](https://blamy.github.io/ui/#/hooks-feedback).

| Hook | Returns | Needs | Export |
| --- | --- | --- | --- |
| `useToast` | the `toast` API of a queue | `Toaster`, optional; the default queue outside | public |
| `useCommandMenu` | `{ query, page, push, pop, select, … }` | `CommandMenu`; throws outside | public |
| `useCommandActive` | the active item's `value`, or `null` | `CommandMenu`; throws outside | public |

### Syntax, sessions and countdown

Documented on [Syntax, sessions and countdown hooks](https://blamy.github.io/ui/#/hooks-syntax-and-sessions).

| Hook | Returns | Needs | Export |
| --- | --- | --- | --- |
| `useSyntaxTokens` | `{ lines, highlighter }` | nothing | public |
| `useSyntaxHighlighting` | `{ code, language, variant, title, engine }` | `SyntaxHighlighting`; `null` outside | public |
| `useCountdown` | `{ remaining, period, elapsed, reset }` | nothing | public |
| `useSessionRecording` | nothing | nothing | public |
| `useSessions` | `SessionInfo[]`, newest first | nothing | public |
| `useSessionCloud` | `{ status, settings, configure }` | nothing | public |
| `useCloud` | `{ status, settings }` of a `CloudSync` | nothing | public |

`useReducedMotion` is also public: it is framer-motion's hook, re-exported from the package root, and is covered with the motion hooks.

### Data, files and storage

Each is documented on the page of the component or module it belongs to.

| Hook | Returns | Needs | Export | Documented on |
| --- | --- | --- | --- | --- |
| `useTimeParse` | `{ result, pending, … }` for a line of English | nothing (loads `gpu-time` on first use) | public | [TimeInput](https://blamy.github.io/ui/#/time-input) |
| `useCronParse` | `{ support, match, pending, … }` for a line of English | nothing (loads `gpu-cron`; needs WebGPU) | public | [CronEditor](https://blamy.github.io/ui/#/cron-editor) |
| `useFilters` | the controlled filter list and its actions | nothing | public | [Filter](https://blamy.github.io/ui/#/filter) |
| `useFilterBar` | the filter bar's state and actions | `FilterBar`; throws outside | public | [Filter](https://blamy.github.io/ui/#/filter) |
| `useFilterQuery` | a natural-language query turned into filters | nothing (loads the vendored gpu-query model) | public | [FilterInput](https://blamy.github.io/ui/#/filter-input) |
| `useFileUpload` | `{ files, add, remove, retry, … }` | nothing | public | [useFileUpload](https://blamy.github.io/ui/#/use-file-upload) |
| `useFilePreview` | an object URL for a file, revoked on unmount | nothing | public | [useFileUpload](https://blamy.github.io/ui/#/use-file-upload) |
| `useVault`, `useVaultState` | the passkey vault and its state | `VaultProvider`; throws outside | public | [Passkey vault](https://blamy.github.io/ui/#/passkey-vault) |
| `usePasskey`, `useWebAuthnSupport` | passkey create and use; what the browser supports | nothing (`usePasskey` takes the vault when present) | public | [Passkey vault](https://blamy.github.io/ui/#/passkey-vault) |
| `useEncryptedState` | `[value, set, meta]` stored encrypted in the vault | `VaultProvider` | public | [Passkey vault](https://blamy.github.io/ui/#/passkey-vault) |
| `usePGlite`, `useReadyDatabase`, `useDatabaseStatus` | the database, or its status | `PGliteProvider`; throws outside | public | [PGlite](https://blamy.github.io/ui/#/pglite) |
| `useQuery`, `useLiveQuery`, `useExec`, `useTransaction` | rows and status; a function that runs SQL | `PGliteProvider` | public | [PGlite](https://blamy.github.io/ui/#/pglite) |
| `useSchema`, `usePersistenceSupport`, `useTabLock` | the database's tables; where it can persist; a one-tab lock | `PGliteProvider` for `useSchema` | public | [PGlite](https://blamy.github.io/ui/#/pglite) |
| `useTailscale`, `useTailscaleStatus`, `useTailscaleFetch` | the tailnet connection, its status, a `fetch` that routes through it | `TailscaleProvider`; throws outside | public | [Sign in with Tailscale](https://blamy.github.io/ui/#/tailscale-login) |
| `useTailscaleRouter` | the service-worker router's status | `TailscaleProvider` | public | [Tailscale request router](https://blamy.github.io/ui/#/tailscale-router) |

The `react-aria` hooks that BL UI builds on (`usePress`, `useClipboard`, `useDrag` …) are not BL UI's own; they have their own section, starting with the [react-aria hooks overview](https://blamy.github.io/ui/#/aria-hooks).

## Conventions

- **Context hooks fail loudly or quietly, by design.** A hook whose component cannot work without it (`useSplitView`, `useComposer`, `useCommandMenu`) throws an error that names the component to wrap it in. A hook that only adds information (`useSplitViewColumn`, `useSplitViewBack`, `useTabViewTab`, `useSyntaxHighlighting`) returns `null`. A hook with a sensible global answer (`useToast`, `useAppearance`, `useMorphTransition`, `useTabView`) falls back to it.
- **Returned objects are rebuilt on each render.** The state objects from `useSplitView`, `useSidebar`, `useFloatingSheet`, `useComposer` and the like are new every render. Their function members are not always memoized either, so do not put the whole object, or a function taken from it, in a dependency array unless the page says that member is stable. The cases that are stable are called out: `useToast`'s API per queue, `useContainerWidth`'s `ref`, `usePersistentState`'s setter, and the `select`, `isSelected` and `toggleSidebar` callbacks of `useSplitView`.
- **Browser APIs are guarded or run in effects.** From the source, nothing here needs `window`, `document` or `localStorage` to exist during a server render (measuring, listeners and recording start in effects; storage reads are guarded). Where the first client render can still differ from the server's (`usePersistentState`, `useSyntaxTokens`, `useAppearance`), the page for that hook says so.
- **Reduced motion.** `useSpringTransition`, `useMorphTransition`, `useSheetDrag` and `useTitleFlight` honor `prefers-reduced-motion` themselves (an instant transition, a jump to rest, no flight). `useEdgeSwipe` and `usePullToRefresh` do not check it: they follow the finger, and what happens on release is up to the caller (`usePullToRefresh` always settles with its own spring transition).
- **Client modules.** Every hook file starts with `'use client'`, so the package and a copied source both work in Next.js server components as long as you call the hook from a client component.
