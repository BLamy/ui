# Installation

BL UI is published as one typed ESM package, [`@brett_lamy/ui`](https://www.npmjs.com/package/@brett_lamy/ui):

```sh
npm i @brett_lamy/ui
```

Import its stylesheet once near your application entry, then use named imports from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  BLProvider, NavigationStack, IndexBar, ChatShell, WorkbenchShell,
} from '@brett_lamy/ui'
```

| Area | Contents |
| --- | --- |
| Core | Theme, haptics, lists, navigation, IndexBar, Credenza, SideDrawer, Sidebar, layout primitives |
| Chat | ChatShell, channel navigation, messages, thread previews, FloatingSheet, ArtifactChatContainer |
| Workbench | WorkbenchShell, Composer, MessageScroller, terminal, surfaces, MarkdownView |
| PencilKit | PencilKit-style drawing canvas and toolbar, and `PencilKitAnnotator` — the Composer's default image annotator |

## shadcn CLI

Every component page and block is also an item in BL UI's [shadcn registry](https://ui.shadcn.com/docs/registry). Adding one installs `@brett_lamy/ui`, writes a thin re-export to `components/ui/<name>.tsx` (blocks land in `components/blocks/<name>/`), and — through the `bl-ui` base item every entry depends on — imports the package stylesheet and adds the BL token utilities (`bg-bl-card`, `text-bl-label`, `border-bl-sep`, …) to your Tailwind theme. Your own shadcn palette is left alone.

```sh
npx shadcn@latest add https://blamy.github.io/ui/r/composer.json
```

```tsx
import { Composer, ComposerCard, ComposerInput } from '@/components/ui/composer'
```

| Item | Installs |
| --- | --- |
| `bl-ui` | The package, its stylesheet, and the token utilities (added automatically) |
| `composer`, `split-view`, `list`, … | `components/ui/<name>.tsx` — one per component page; each page's **Installation** section has its command |
| `github-clone`, … | A whole app in `components/blocks/<name>/` — see [Blocks](https://blamy.github.io/ui/#/blocks) |

The index is [`registry.json`](https://blamy.github.io/ui/r/registry.json). With Vite, pre-bundle the Markdown engine, which ships TypeScript source:

```ts
// vite.config.ts
optimizeDeps: {
  include: ['@brett_lamy/ui > @brett_lamy/docstream', '@brett_lamy/ui > @brett_lamy/docstream-editor'],
},
```

## Provider

Wrap UI surfaces that use the core `--bl-*` theme tokens. Workbench supplies its dark `--wb-*` tokens from `WorkbenchShell`.

```tsx
<BLProvider tint="#0A84FF">
  <NavigationStack screens={screens} onPop={handlePop} />
</BLProvider>
```

## Peer expectations

- React and React DOM 18 or 19
- A bundler that resolves ESM package exports and CSS imports
- Browser APIs such as ResizeObserver for container-aware shells

All public components and their props types are exported from the package root. The package README contains copy-ready examples, and every major interaction has a runnable Storybook story below.

## Live check

{% demo src="installation/controls" %}
