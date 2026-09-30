# BL UI monorepo conventions

BL UI is an iOS-flavored React component framework: a **core library** and **blocks**, distributed two ways from the same files.

- **Core** (`packages/ui`, published as `@brett_lamy/ui`) — generic, composable parts: theme/tokens, icons, motion, press and util helpers, controls, list primitives, containers (NavigationStack, SplitView, TabBar, Credenza, SideDrawer, IndexBar), the Composer and PencilKit (`PencilKitAnnotator` is the Composer's default image annotator). Nothing product-specific.
- **Blocks** (`registry/blocks/<slug>`) — full compositions that show how the core fits together and may own complex, product-specific components: the IDE workbench parts (`t3-clone`), the team-chat shell (`discord-clone`), `map-chat`, `delivery-tracking`, `loop-qa`, and so on.
- **Registry** (primary): every core module is its own shadcn item (`registry:ui` / `registry:lib`), with dependencies computed from its imports, so `shadcn add` copies only what a part needs. **npm** (secondary): the same modules, built with `preserveModules` and `'use client'`, for people who want one dependency.

Every component is built **shadcn-style on react-aria-components, styled with Tailwind v4**. Visual output must not change while code moves onto that base: the visual-regression suite (below) is the source of truth, at zero pixel tolerance.

## Tech rules

1. **TypeScript ESM** (`.tsx`), React 19. No `window.*` globals, no CDN script injection.
2. **react-aria base.** Anything interactive is a react-aria-components element: `Button` (ours, `@/components/ui/button`), `ToggleButton`, `Switch`, `Checkbox`, `RadioGroup`/`Radio`, `Tabs`, `ListBox`, `GridList`, `Menu`, `Popover`, `Dialog`/`Modal`, `Tooltip`, `Slider`, `TextField`/`SearchField`, `Disclosure`, `Link`. Use `onPress`, not `onClick`. Where gesture code needs a raw element (swipe rows, wheels, drag trays, canvases), keep it raw but keep its ARIA and keyboard behavior. Never regress keyboard behavior (arrow-key navigation, Esc, focus order).
3. **shadcn conventions.** Every component takes `className` (and `style`) and merges them last with `cn()` from `@/lib/utils`; its root has `data-slot="<name>"`; variants use `cva` (export the `…Variants` function); compound APIs over props (`List.Section`, `ChatShellMain`), context + hooks over prop drilling. For react-aria elements whose `className` can be a function, wrap with `composeRenderProps`.
4. **Tailwind, not inline styles; tokens, not literals.** Style with utility classes. `style={{…}}` is only for values computed at runtime (gesture offsets, measured sizes, animation progress) — prefer feeding those in as CSS variables (`style={{ '--x': px }}` + `translate-x-(--x)`). Everything themeable comes from `packages/ui/src/tokens.css` (`@theme inline`, the single source; `pnpm tokens` generates `lib/tokens.generated.ts` from it): colors (shadcn's variables plus BL UI's extras such as `text-tertiary-foreground`, `bg-secondary-strong`, `bg-bar`, `text-success`), radii (`rounded-ctl|panel|card|sheet`, multiples of `--radius`), the text scale (`text-caption2` … `text-title`), shadows (`shadow-hairline`, `-t`, `-b`), heights (`h-row`, `h-toolbar`) and `font-sans`. Surface palettes are theme scopes (`ThemeScope`) whose values live in `src/theme.css` (core scopes) or a block's own stylesheet. No hex/rgba literals and no new arbitrary `rounded-[…]`, `text-[…px]` or `shadow-[…]`: `node tools/tokens/check.mjs` enforces it against `tools/tokens/allowlist.json` (which only shrinks). Interaction states use react-aria's data attributes (`data-pressed:`, `data-hovered:`, `data-selected:`, `data-focus-visible:`, `data-disabled:`, `group-data-selected:`).
5. **Exact metrics.** The text-scale tokens set font-size only, so they never change a line-height. Keep the original easing (`ease-ios` = `cubic-bezier(.32,.72,0,1)`), radii, shadows and durations; a value that is not on a token scale stays literal until the scale is extended on purpose. `font-family: inherit` is `[font-family:inherit]`.
6. **CSS files** hold only what utilities can't express (keyframes, scrollbars, range thumbs, third-party overrides). The package's `src/styles.css` pulls in the Tailwind token map (`packages/ui/src/tokens.css`) and Tailwind's utilities layer; `src/theme.css` is the optional bl-theme (`@brett_lamy/ui/theme.css`) — no preflight, so host apps keep their base styles.
7. **Core vs blocks.** A part goes in core if it is generic and composes with others; a part that only makes sense inside one product goes in that block. Core modules import only `react`, npm packages, and each other by alias (`@/components/ui/<x>`, `@/lib/<x>`) — never `@brett_lamy/ui` and never a block. Block files import only `react`, `@/components/ui/*`, `@/lib/*`, their own files and the npm packages in their `meta.json` (`node tools/registry/build.mjs --check` fails otherwise). Demo data and compositions live in blocks, docs examples or stories.
8. **Barrel.** `packages/ui/src/index.ts` re-exports the public API for the npm package, named exports only; every registry manifest's `exports` must be in it (checked).
9. **Client modules.** A module that uses hooks, react-aria or motion starts with `'use client'` (`node tools/codemod/use-client.mjs` adds it) so both the package and the copied source work in Next.js server components.

## Checks — run before every commit

- `pnpm vr --project stories` (Storybook on :6006) and `pnpm vr --project docs` (docs dev server on :4417): every screenshot must match its baseline exactly. Inspect a failure with `node tools/vr/zoom.mjs <story-id>` (expected left, actual right). Only re-baseline (`pnpm vr:update`) for an intended visual change, and say why in the commit.
- `pnpm nx run-many -t typecheck,build,test`, `node tools/registry/build.mjs --check`, `node tools/tokens/build.mjs --check`, `node tools/tokens/check.mjs` and `node tools/docs/variants-md.mjs --check`.

## Storybook (apps/catalog)

Stories live next to components: `packages/<pkg>/src/**/*.stories.tsx`. Use CSF3 with `Meta`/`StoryObj`. Titles follow **atomic design**:

- `Atoms/…` — Icon, Avatar, Button, Switch, Segmented, Spinner, Chip, Meter, SearchField…
- `Molecules/…` — ListRow, SectionHeader, IndexBar, TabBar, EditBar, Composer… (block parts keep their ids too: Message, ThreadPreview)
- `Organisms/…` — List, NavigationStack, SplitView, Credenza, SideDrawer, Sidebar, ChannelNav, TerminalDock, SurfacePanel, agent tables…
- `Templates/…` — the container layouts that stay in core (SplitView layouts, ArtifactChatContainer…).
- `Blocks/…` — registry blocks (`registry/blocks`), including their own parts (ChatShell, WorkbenchShell, terminal, surfaces, MapChat, DeliveryTracking, PencilKit sketch).

Wrap every story in `BLProvider` (or `ThemeScope`) (use a decorator; dark for the chat and workbench parts). Give container stories an explicit sized frame (e.g. 390×720 phone frame or 100%×640 panel) since BL UI containers are absolutely-positioned within their host. Include a story per meaningful prop/composition variant, with `args` wired so controls work.

## Apps

The workspace has two apps: `apps/docs` (the documentation site) and `apps/catalog` (Storybook). Apps and blocks import through the same aliases a registry install creates (`@/components/ui/<x>`, `@/lib/<x>`, `@/components/blocks/<slug>/…`), configured in `tsconfig.base.json` and `tools/alias.mjs` — this proves that a copied item works in a plain app.
