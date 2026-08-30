# TouchKit monorepo conventions

TouchKit is an iOS-flavored React component framework, distributed as workspace packages:

- `@touchkit/ui` — core: theme/tokens, Haptics, icons, controls, list primitives, containers (NavigationStack, SplitView, TabBar, Credenza, SideDrawer, IndexBar).
- `@touchkit/chatkit` — team-chat scaffold (ChatShell + slots, message primitives). Depends on `@touchkit/ui`.
- `@touchkit/workbench` — IDE workbench scaffold (WorkbenchShell + slots, chat view, terminal dock, surface panel). Depends on `@touchkit/ui`.
- `@touchkit/beautiful` — AI-native primitives (loading, thinking, approvals, agent tables, sidebar system) in the workbench dark language.
- `@touchkit/pencilkit` — freehand drawing canvas (perfect-freehand).

Source of truth for visuals: the prototypes in `../project/*.jsx` (relative to this repo root). **Ports must render pixel-identically** — keep the exact inline styles, CSS custom properties, easing (`cubic-bezier(.32,.72,0,1)`), radii, shadows, font stacks and animation timings from the prototype. Do not "modernize" the visual output.

## Tech rules

1. **TypeScript ESM** (`.tsx`), React 19. No `window.*` globals, no `module.exports`, no CDN script injection. `framer-motion` and `perfect-freehand` are npm deps — import directly (replace the prototypes' lazy CDN loaders; `useMotion()` can simply return the imported module to keep call-sites unchanged). The ios-vibrator-pro-max haptics polyfill MAY stay a dynamic CDN import inside `Haptics.boot()` (Safari-only runtime concern), guarded by try/catch.
2. **react-aria base**: interactive primitives use `react-aria-components` (Button, Switch, RadioGroup/Radio for Segmented, Slider, TextField/SearchField, Dialog/Modal semantics where they don't fight custom animation). Where a component's animation/gesture code needs a raw element (swipe rows, wheels, drag trays), keep the raw element but preserve/extend the ARIA the prototype already has. Never regress keyboard behavior (arrow-key row nav, Esc pops, focus rings).
3. **shadcn conventions**: every component accepts `className` and `style` and merges them last; use `cn()` from `@touchkit/ui` (clsx + tailwind-merge); add `data-slot="<name>"` on each component root; variants via `class-variance-authority` where a component has variants; compound/composable APIs — e.g. `List`, `List.Section`, `List.Row` (also exported flat as `ListSection`, `ListRow`), `ChatShell.Rail/.Nav/.Main`, context + hooks (`useChatShell()`) instead of render props/prop drilling. Children-first: anything that can be a slot/children should be.
4. **CSS**: framework CSS (keyframes, scrollbar classes, range styling) lives in each package's `src/styles.css`, imported by the package entry (side-effect import) — not injected via `document.createElement`. Tokens are CSS custom properties (`--tk-*`, `--wb-*`) supplied by `TouchKitProvider` from `@touchkit/ui` (props: `dark`, `tint`, `safeTop`). Light/dark palettes are the exact var maps from the prototype `App`.
5. **Demo data & demo compositions** do NOT go in packages — they go in the consuming app (`apps/*`) or in stories. Packages export only reusable primitives. Exception: small self-contained showcase components explicitly named *Demo* may live in the package under `src/demos/` if stories/apps share them (e.g. `HapticsPlayground`).
6. Every package `src/index.ts` re-exports everything public, named exports only.

## Storybook (apps/catalog)

Stories live next to components: `packages/<pkg>/src/**/*.stories.tsx`. Use CSF3 with `Meta`/`StoryObj`. Titles follow **atomic design**:

- `Atoms/…` — Icon, Avatar, Switch, Segmented, Spinner, PillButton, Chip, Meter, SearchField…
- `Molecules/…` — ListRow, SectionHeader, IndexBar, TabBar, EditBar, Composer, Message, ThreadPreview…
- `Organisms/…` — List, NavigationStack, SplitView, Credenza, SideDrawer, Sidebar, ChannelNav, TerminalDock, SurfacePanel, agent tables…
- `Templates/…` — ChatShell, WorkbenchShell, SplitView layouts…
- `Pages/…` — full demo apps (Contacts, Chat, Workbench, PencilKit, Beautiful catalog).

Wrap every story in `TouchKitProvider` (use a decorator; dark for chatkit/workbench/beautiful). Give container stories an explicit sized frame (e.g. 390×720 phone frame or 100%×640 panel) since TouchKit containers are absolutely-positioned within their host. Include a story per meaningful prop/composition variant, with `args` wired so controls work.

## Apps

Apps consume ONLY package public APIs (`import { … } from '@touchkit/ui'`) — this proves distributability. Each app recreates its prototype demo page faithfully (frame switcher headers etc. simplified is fine; the component under demo must be pixel-faithful).
