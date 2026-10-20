---
description: Where everything lives once the split is done — apps, packages, blocks and tools.
---

# Repository layout

## Today

```txt title="BLamy/ui"
apps/
  docs/                 the site (this page), with the ui docs pages
  catalog/              Storybook
packages/
  ui/                   @brett_lamy/ui — everything below, in one package
  docstream/            @brett_lamy/docstream          ← merged in, with history
    demo/               its docs (docs/) and live examples; a standalone playground
  docstream-editor/     @brett_lamy/docstream-editor   ← merged in, with history
    demo/
registry/               the app blocks (registry-only) and the registry build's styles
tools/                  registry, tokens, docs generators, e2e, visual regression, codemod,
                        notes-desktop/, worktree-atlas-desktop/
```

## After the split

```txt title="BLamy/ui"
apps/
  site/                 landing page, roadmap, and every library's docs (was apps/docs)
  catalog/              Storybook
  notes-desktop/        macOS wrapper for the Notes block (was tools/)
  worktree-atlas-desktop/
packages/
  tokens/  icons/  motion/
  ui/                   the core: primitives and containers
  time/  canvas/  media/  markdown/  composer/
  sql/  pglite/  filter/  sync/
  vault/  tailscale/  registry/
  docstream/  docstream-editor/
    <each package>/
      src/              the code
      docs/             its pages, as Markdown — the site mounts them with DocsSite
      docs/examples/    the live demos those pages embed
blocks/                 the app blocks: private, registry-only (was registry/)
tools/                  e2e, visual regression, docs generators, codemod, release
```

## How the pieces fit

- **Nx tags enforce the layers.** Each package gets `layer:foundation`, `layer:core`, `layer:feature` or `layer:standalone`, and `@nx/enforce-module-boundaries` (off today) gets constraints that match the [package map](01-packages.md): a feature may use the core and foundation; the core only foundation; foundation nothing above it.
- **One alias table.** `tools/alias.mjs` and `tsconfig.base.json` map `@/components/ui/<x>` and `@/lib/<x>` to the package that owns each module, generated from the module map instead of written by hand.
- **The registry builds from every package.** `tools/registry` already computes dependencies from imports; it learns to walk all the packages, so one item can pull files from several.
- **The site mounts each package's docs.** The way `#/docstream` mounts `packages/docstream/demo/docs` today, every library gets `#/<library>`, with its examples resolved from its own folder.
