---
description: Where everything lives today, with docstream inside the library, and once the split is done — apps, packages, blocks and tools.
---

# Repository layout

## Today

```txt title="BLamy/ui"
apps/
  docs/                          the site (this page): landing, libraries, roadmap, the ui docs pages
  catalog/                       Storybook
  docstream-playground/          docstream's docs (docs/) and live examples; also runs on its own
  docstream-editor-playground/   the editor's docs and examples
packages/
  ui/                            @brett_lamy/ui — everything below, in one package
    src/components/  src/lib/    the kit, one module per entry (@brett_lamy/ui/dialog)
    src/docstream/               @brett_lamy/ui/docstream/*        ← was @brett_lamy/docstream
    src/docstream-editor/        @brett_lamy/ui/docstream-editor/* ← was @brett_lamy/docstream-editor
    src/cloudflare.ts            @brett_lamy/ui/cloudflare (the Cloudflare catalog, on an entry of its own)
    src/opencode.ts              @brett_lamy/ui/opencode
  ui-sdk-core/  ui-sdk-react/    @brett_lamy/ui-sdk-core and -react, generated from the fork
vendor/ui-sdk/                   our UI SDK fork (a submodule of BLamy/ui-sdk)
registry/                        the app blocks (registry-only) and the registry build's styles
tools/                           registry, tokens, docs generators, e2e, visual regression, codemod, release,
                                 ui-sdk (builds the wrappers), notes-desktop/, worktree-atlas-desktop/
```

## After the split

```txt title="BLamy/ui"
apps/
  site/                  landing page, roadmap, and every library's docs (was apps/docs)
  catalog/               Storybook
  notes-desktop/         macOS wrapper for the Notes block (was tools/)
  worktree-atlas-desktop/
packages/
  tokens/  motion/  icons/
  ui/                    the core: primitives, containers, docstream and its editor
  time/  canvas/  diagram/  media/  composer/
  sql/  pglite/  filter/  sync/
  vault/  tailscale/  opencode/  registry/
  ui-sdk-core/  ui-sdk-react/
    <each package>/
      src/               the code
      docs/              its pages, as Markdown — the site mounts them with DocsSite
      docs/examples/     the live demos those pages embed
vendor/ui-sdk/
blocks/                  the app blocks: private, registry-only (was registry/)
tools/                   e2e, visual regression, docs generators, codemod, release, ui-sdk
```

Docstream stays where it is, inside `packages/ui/src`, and its docs move from its playground to `packages/ui/docs/docstream` when the core gets its own docs folder. The playgrounds stay as dev servers for working on docstream alone.

## How the pieces fit

- **Nx tags enforce the layers.** Each package gets `layer:foundation`, `layer:core` or `layer:feature`, and `@nx/enforce-module-boundaries` (off today) gets constraints that match the [package map](01-packages.md): a feature may use the core and the foundation; the core only the foundation; the foundation nothing above it.
- **One alias table.** `tools/alias.mjs` and `tsconfig.base.json` map `@/components/ui/<x>` and `@/lib/<x>` to the package that owns each module, generated from the module map instead of written by hand.
- **The registry builds from every package.** `tools/registry` already computes dependencies from imports; it learns to walk all the packages, so one item can pull files from several.
- **The site mounts each package's docs.** The way `#/docstream` mounts `apps/docstream-playground/docs` today, every library gets `#/<library>`, with its examples resolved from its own folder.
