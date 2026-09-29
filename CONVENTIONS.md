# BL UI monorepo conventions

BL UI is an iOS-flavored React component framework, distributed as one workspace package:

- `@brett_lamy/ui` — theme/tokens, Haptics, icons, controls, list primitives, containers (NavigationStack, SplitView, TabBar, Credenza, SideDrawer, IndexBar), the team-chat parts and ChatShell (`src/components/chat`, `src/templates`), the IDE workbench parts and WorkbenchShell (`src/components/workbench`, `src/templates`), and PencilKit freehand drawing on perfect-freehand (`src/components/pencilkit`, `src/lib/pencilkit`; `PencilKitAnnotator` is the Composer's default image annotator). Demo apps live in `src/demos`.

Every component is built **shadcn-style on react-aria-components, styled with Tailwind v4**. Visual output must not change while code moves onto that base: the visual-regression suite (below) is the source of truth, at zero pixel tolerance.

## Tech rules

1. **TypeScript ESM** (`.tsx`), React 19. No `window.*` globals, no CDN script injection.
2. **react-aria base.** Anything interactive is a react-aria-components element: `Button` (ours, `@brett_lamy/ui`), `ToggleButton`, `Switch`, `Checkbox`, `RadioGroup`/`Radio`, `Tabs`, `ListBox`, `GridList`, `Menu`, `Popover`, `Dialog`/`Modal`, `Tooltip`, `Slider`, `TextField`/`SearchField`, `Disclosure`, `Link`. Use `onPress`, not `onClick`. Where gesture code needs a raw element (swipe rows, wheels, drag trays, canvases), keep it raw but keep its ARIA and keyboard behavior. Never regress keyboard behavior (arrow-key navigation, Esc, focus order).
3. **shadcn conventions.** Every component takes `className` (and `style`) and merges them last with `cn()` from `@brett_lamy/ui`; its root has `data-slot="<name>"`; variants use `cva` (export the `…Variants` function); compound APIs over props (`List.Section`, `ChatShellMain`), context + hooks over prop drilling. For react-aria elements whose `className` can be a function, wrap with `composeRenderProps`.
4. **Tailwind, not inline styles.** Style with utility classes. `style={{…}}` is only for values computed at runtime (gesture offsets, measured sizes, animation progress) — prefer feeding those in as CSS variables (`style={{ '--x': px }}` + `translate-x-(--x)`). Colors come from the theme: shadcn names (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `border-border`, `bg-card`, `bg-destructive`) or the palettes they map to (`text-bl-label3`, `bg-bl-fill2`, `bg-wb-card`, `text-wb-label2`). Interaction states use react-aria's data attributes (`data-pressed:`, `data-hovered:`, `data-selected:`, `data-focus-visible:`, `data-disabled:`, `group-data-selected:`).
5. **Exact metrics.** Tailwind v4's named text sizes also set line-height — use `text-[15px]` when the original only set a font size. Keep the original easing (`ease-ios` = `cubic-bezier(.32,.72,0,1)`), radii, shadows (`shadow-[…]`), and durations. `font-family: inherit` is `[font-family:inherit]`.
6. **CSS files** hold only what utilities can't express (keyframes, scrollbars, range thumbs, third-party overrides). The package's `src/styles.css` pulls in the shared theme (`packages/ui/src/theme.css`) and Tailwind's utilities layer — no preflight, so host apps keep their base styles.
7. **Haptics** go through `Haptics` from `@brett_lamy/ui` (or workbench's `vib`/`tick`). Call them synchronously inside the event that caused them (`onPress`, `onChange`, a keydown) — on iOS/macOS Safari a tick needs a live user gesture; press-time requests are held for the following click, anything later than ~350ms is dropped. Mid-drag ticks (pointermove, momentum) are Android-only; never add overlays or intercept events to get more.
8. **Demo data and compositions** live in apps or stories. Packages export reusable components only; showcase components named `*Demo` may live under `src/demos/`.
9. The package `src/index.ts` re-exports everything public, named exports only.

## Checks — run before every commit

- `pnpm vr --project stories` (Storybook on :6006) and `pnpm vr --project docs` (docs dev server on :4417): every screenshot must match its baseline exactly. Inspect a failure with `node tools/vr/zoom.mjs <story-id>` (expected left, actual right). Only re-baseline (`pnpm vr:update`) for an intended visual change, and say why in the commit.
- `pnpm test:haptics`: taps in iOS-Safari mode must tick once per request, and Chromium must call `navigator.vibrate` per request.
- `pnpm nx run-many -t typecheck,build`.

## Storybook (apps/catalog)

Stories live next to components: `packages/<pkg>/src/**/*.stories.tsx`. Use CSF3 with `Meta`/`StoryObj`. Titles follow **atomic design**:

- `Atoms/…` — Icon, Avatar, Button, Switch, Segmented, Spinner, Chip, Meter, SearchField…
- `Molecules/…` — ListRow, SectionHeader, IndexBar, TabBar, EditBar, Composer, Message, ThreadPreview…
- `Organisms/…` — List, NavigationStack, SplitView, Credenza, SideDrawer, Sidebar, ChannelNav, TerminalDock, SurfacePanel, agent tables…
- `Templates/…` — ChatShell, WorkbenchShell, SplitView layouts…
- `Pages/…` — full demo apps (Contacts, Chat, Workbench, PencilKit).

Wrap every story in `BLProvider` (use a decorator; dark for the chat and workbench parts). Give container stories an explicit sized frame (e.g. 390×720 phone frame or 100%×640 panel) since BL UI containers are absolutely-positioned within their host. Include a story per meaningful prop/composition variant, with `args` wired so controls work.

## Apps

Apps consume ONLY package public APIs (`import { … } from '@brett_lamy/ui'`) — this proves distributability. Each app recreates its prototype demo page faithfully (frame switcher headers etc. simplified is fine; the component under demo must be pixel-faithful).
