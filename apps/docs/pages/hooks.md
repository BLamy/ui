# Hooks

Every hook BL UI defines, in one table, and where each is documented in detail. Most are the read side of a component: they return the state a parent provides (`useSplitView`, `useToast`), and they throw, return `null` or fall back to a default when you call them in the wrong place. A few are standalone utilities (`useSizeClass`, `useContainerWidth`, `usePersistentState`, `useControllableState`), and a handful are building blocks for motion. Gestures (edge swipes, drags, pull-to-refresh) are UI SDK behaviors, not BL UI hooks. Behavior (keyboard, focus, selection, dismissal, popups, drag and drop, shortcuts) is UI SDK's, not a BL UI hook: see [Behaviors](https://blamy.github.io/ui/#/behaviors).

## Public and registry-only

BL UI ships two ways from the same files (see [How the registry works](https://blamy.github.io/ui/#/registry)), and the hooks follow:

- **Public** hooks are re-exported from the package root: `import { useToast } from '@brett_lamy/ui'`. They are also in the registry, so a source copy gives you the same hook at an alias path (`@/components/ui/toast`, `@/lib/container`).
- **Registry-only** hooks are not in the package root. One is: `useRowLabel`, plus the framework-free `createTitleFlight`. They are internals of components (`ListRow`, `NavigationStack`) and are copied into your project, with the component that uses them, when you add that component. You can also add one on its own, for example `npx shadcn@latest add https://blamy.github.io/ui/r/row-label.json`.

A "must be called under" entry below means the hook reads a React context that the named component provides. Components render their children where you put them, so the rule is about the **React tree**, not the DOM: a node rendered through a portal sees the context of the place the portal was created, not of the element it lands in.

## All hooks

Grouped by page. "Needs" is the component or provider the hook must be called under, and what happens outside it. "Export" says whether it is in the package root (`public`) or only in the registry (`registry-only`).

### Layout

Documented on [Layout hooks](https://blamy.github.io/ui/#/hooks-layout).

| Hook | Returns | Needs | Export |
| --- | --- | --- | --- |
| `useSizeClass` | `[ref, 'compact' \| 'medium' \| 'regular']` | nothing (the ref goes on the element it measures) | public |
| `useContainerWidth` | `[ref, width]` | nothing | public |
| `useContainerSize` | `[ref, { width, height }]` | nothing | public |
| `useSplitView` | split view state and actions | `SplitView`; throws outside | public |
| `useSplitViewColumn` | the column name | a split view column; `null` outside | public |
| `useSplitViewBack` | `{ title, back }` | a bar of your own at the root of a column; `null` outside | public |
| `useNavigationStack` | the stack's controller: `{ push, pop, popTo, replace, refresh, getPages }` | a `NavigationStack`; throws outside | public |
| `useSidebar` | `{ open, setOpen, toggle, sizeClass, compact }` | `SidebarProvider`; throws outside | public |
| `useSidebarCollapsed` | whether the enclosing sidebar is collapsed to its icon rail | a `Sidebar`; `false` outside | public |
| `useTabs` | `{ variant, side, orientation }` | `Tabs`; `null` outside | public |
| `useTabsTab` | the tab's UI SDK state, `{ selected, disabled }` | the content of a `TabsTab`; `null` outside | public |
| `useFloatingSheet` | `{ open, setOpen, progress, peek, minimized, setMinimized }` | `FloatingSheet`; throws outside | public |
| `useHideOnScroll` | `boolean` | nothing (takes the scroller's ref) | public |
| `useArtifactChatContainer` | `{ sizeClass, layout, open, setOpen, composing, minimized, … }` | `ArtifactChatContainer`; throws outside | public |

### Motion

Documented on [Motion hooks](https://blamy.github.io/ui/#/hooks-motion).

| Hook | Returns | Needs | Export |
| --- | --- | --- | --- |
| `useSpringTransition` | a spring, or `{ duration: 0 }` | nothing | public |
| `useDirection` | `-1`, `0` or `1` | nothing | public |
| `useMorphTransition` | a framer-motion `Transition` | `MorphGroup`, optional; the `smooth` spring outside | public |
| `createTitleFlight` (not a hook) | `{ fly, end, destroy }` | nothing (takes the stack's root element) | registry-only |

6.0 removed `useTabPanelDirection` (tab panels read UI SDK's `data-activation-direction`) and the gesture hooks: `useEdgeSwipe` is the kit's `bindEdgeSwipe` (`@/lib/edge-swipe`), `useSheetDrag` is UI SDK's `Drawer` with snap points (or `bindDrag`), `usePullToRefresh` is the kit's `bindPullToRefresh` (or `NavigationStackContent onRefresh`), and `useTitleFlight` is `createTitleFlight`; see [Motion hooks](https://blamy.github.io/ui/#/hooks-motion).

### Theme

Documented on [Theme hooks](https://blamy.github.io/ui/#/hooks-theme).

| Hook | Returns | Needs | Export |
| --- | --- | --- | --- |
| `useAppearance` | `'light'`, `'dark'` or `undefined` | nothing; reads `AppearanceProvider`, else `<html class="dark">` | public |
| `useThemeScopeProps` | `{ data-theme-scope, className, style }` | `ThemeScope`; `{}` outside | public |
| `useChromeHidden` | `boolean` | nothing (a global store) | public |
| `useThemeScope` | the nearest scope's `{ scope, appearance, tint, vars }` | `ThemeScope`; `null` outside | public |
| `useScopeAppearance` | `'light'`, `'dark'` or `undefined` | nothing; the rule a `ThemeScope` of that name applies here | public |
| `useLayerHost` | the element popups and dialogs portal into, or `undefined` | `BLProvider`; `undefined` outside | public |

6.0 removed `useScrollHidden`: floating chrome uses `useHideOnScroll` (Layout), and anything else reads `useChromeHidden()`.

### State and platform

Documented on [State hooks](https://blamy.github.io/ui/#/hooks-state).

| Hook | Returns | Needs | Export |
| --- | --- | --- | --- |
| `usePersistentState` | `[value, setValue]` | nothing | public |
| `useControllableChange` | `[value, set]` | nothing | public |
| `useKeptChildren` | `{ dock, portal, inline }` | nothing | public |
| `useRowLabel` | an `aria-labelledby` id or `undefined` | a `ListRow` with a title; `undefined` outside | registry-only |

6.0 removed `useHotkey` (use UI SDK's `useShortcut`) and `useBackHistory` (use the kit's `bindBack` from `@/lib/back`); see [State and platform hooks](https://blamy.github.io/ui/#/hooks-state).

### Composer

Documented on [Composer hooks](https://blamy.github.io/ui/#/hooks-composer).

| Hook | Returns | Needs | Export |
| --- | --- | --- | --- |
| `useComposer` | the draft, attachments and actions | `Composer`; throws outside | public |
| `useComposerBump` | `{ side, open, setOpen, reveal, progress, dragging, settling, … }` | `ComposerBump`; throws outside | public |
| `usePencilHistory` | strokes with undo, redo and clear | nothing | public |

### Feedback

Documented on [Feedback hooks](https://blamy.github.io/ui/#/hooks-feedback).

| Hook | Returns | Needs | Export |
| --- | --- | --- | --- |
| `useToast` | the nearest toast queue (a UI SDK `Toaster`) | `ToastProvider`, optional; the page's `toast` outside | public |
| `useCommandMenu` | `{ query, pages, page, controller }` | `CommandMenu`; throws outside | public |
| `useCommandMenuValue` | the highlighted command's `value`, or `null` | `CommandMenu`; throws outside | public |

### Syntax, sessions and countdown

Documented on [Syntax, sessions and countdown hooks](https://blamy.github.io/ui/#/hooks-syntax-and-sessions).

| Hook | Returns | Needs | Export |
| --- | --- | --- | --- |
| `useSyntaxTokens` | `{ lines, highlighter }` | nothing | public |
| `useCodeEditor` | `{ getValue, language, variant, title, engine }` | `CodeEditor`; `null` outside | public |
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
| `useTimeParse` | `{ result, pending, … }` for a line of English | nothing (loads `gpu-time` on first use) | public | [NaturalTimeInput](https://blamy.github.io/ui/#/natural-time-input) |
| `useCronParse` | `{ support, match, pending, … }` for a line of English | nothing (loads `gpu-cron`; needs WebGPU) | public | [CronEditor](https://blamy.github.io/ui/#/cron-editor) |
| `useFilters` | the controlled filter list and its actions | nothing | public | [Filter](https://blamy.github.io/ui/#/filter) |
| `useFilterBar` | the filter bar's state and actions | `FilterBar`; throws outside | public | [Filter](https://blamy.github.io/ui/#/filter) |
| `useFilterQuery` | a natural-language query turned into filters | nothing (loads the vendored gpu-query model) | public | [Filter](https://blamy.github.io/ui/#/filter) |
| `useFileUpload` | `{ files, add, remove, retry, … }` | nothing | public | [useFileUpload](https://blamy.github.io/ui/#/use-file-upload) |
| `useFilePreview` | an object URL for a file, revoked on unmount | nothing | public | [useFileUpload](https://blamy.github.io/ui/#/use-file-upload) |
| `useVault`, `useVaultState` | the passkey vault and its state | `VaultProvider`; throws outside | public | [Passkey vault](https://blamy.github.io/ui/#/passkey-vault) |
| `usePasskey`, `useWebAuthnSupport` | passkey create and use; what the browser supports | nothing (`usePasskey` takes the vault when present) | public | [Passkey vault](https://blamy.github.io/ui/#/passkey-vault) |
| `useEncryptedState` | `[value, set, meta]` stored encrypted in the vault | `VaultProvider` | public | [Passkey vault](https://blamy.github.io/ui/#/passkey-vault) |
| `usePGlite`, `useReadyDatabase`, `useDatabaseStatus` | the database, or its status | `PGliteProvider`; throws outside | public | [PGlite](https://blamy.github.io/ui/#/pglite) |
| `useQuery`, `useLiveQuery`, `useExec`, `useTransaction` | rows and status; a function that runs SQL | `PGliteProvider` | public | [PGlite](https://blamy.github.io/ui/#/pglite) |
| `useSchema`, `usePersistenceSupport`, `useTabLock` | the database's tables; where it can persist; a one-tab lock | `PGliteProvider` for `useSchema` | public | [PGlite](https://blamy.github.io/ui/#/pglite) |
| `useTailscale`, `useTailscaleStatus`, `useTailscaleFetch` | the tailnet connection, its status, a `fetch` that routes through it | `TailscaleProvider`; throws outside | public | [Sign in with Tailscale](https://blamy.github.io/ui/#/tailscale) |
| `useTailscaleRouter` | the service-worker router's status | `TailscaleProvider` | public | [Tailscale request router](https://blamy.github.io/ui/#/tailscale-router) |

BL UI is built on [UI SDK](https://blamy.github.io/ui/#/ui-sdk), and the behaviors it builds on (press, focus, shortcuts, clipboard, drag and drop, popups) are UI SDK's, not BL UI's own. You can use them beside the kit; they are covered in [Behaviors](https://blamy.github.io/ui/#/behaviors). Keyboard shortcuts in particular are UI SDK's `useShortcut` (`@ui-sdk/react/shortcuts`): 6.0 removed `useHotkey` and `matchesHotkey`.

## Conventions

- **Context hooks fail loudly or quietly, by design.** A hook whose component cannot work without it (`useSplitView`, `useComposer`, `useCommandMenu`) throws an error that names the component to wrap it in. A hook that only adds information (`useSplitViewColumn`, `useSplitViewBack`, `useTabs`, `useTabsTab`, `useCodeEditor`) returns `null`. A hook with a sensible global answer (`useToast`, `useAppearance`, `useMorphTransition`) falls back to it.
- **Returned objects are rebuilt on each render.** The state objects from `useSplitView`, `useSidebar`, `useFloatingSheet`, `useComposer` and the like are new every render. Their function members are not always memoized either, so do not put the whole object, or a function taken from it, in a dependency array unless the page says that member is stable. The cases that are stable are called out: `useToast`'s queue, `useContainerWidth`'s `ref`, `useSizeClass`'s ref callback, `usePersistentState`'s setter, and `useNavigationStack`'s controller. `useSplitView`'s object and callbacks are kept while its state is unchanged and rebuilt when it changes.
- **Browser APIs are guarded or run in effects.** From the source, nothing here needs `window`, `document` or `localStorage` to exist during a server render (measuring, listeners and recording start in effects; storage reads are guarded). Where the first client render can still differ from the server's (`usePersistentState`, `useSyntaxTokens`, `useAppearance`), the page for that hook says so.
- **Reduced motion.** `useSpringTransition`, `useMorphTransition` and `createTitleFlight` honor `prefers-reduced-motion` themselves (an instant transition, no flight). The containers' gestures follow the finger and settle with CSS transitions that the components turn off with `motion-reduce:`.
- **Client modules.** Every hook file starts with `'use client'`, so the package and a copied source both work in Next.js server components as long as you call the hook from a client component.
