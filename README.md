# BL UI

BL UI is an iOS-flavored React component library built on [UI SDK](https://ui-sdk.dev) and Tailwind CSS v4, in an Nx + pnpm monorepo. This repository holds the library, [`@brett_lamy/ui`](https://www.npmjs.com/package/@brett_lamy/ui) (with docstream, the GitBook-flavored Markdown renderer, and its editor inside it), the shadcn registry and its blocks, a Storybook catalog, and the [BL site](https://blamy.github.io/ui/): a landing page, a page per [library](https://blamy.github.io/ui/#/libraries), the kit's docs, docstream's docs and the [roadmap](https://blamy.github.io/ui/#/roadmap) for splitting `@brett_lamy/ui` into packages.

## Install

Two ways, from the same source files. [Installation](https://blamy.github.io/ui/#/installation) has every step for Vite and Next.js.

**shadcn registry (recommended).** The copied source imports UI SDK as `@ui-sdk/core` and `@ui-sdk/react`, which are our fork under upstream's names. Add the two aliases, then the base item, then any part or block:

```sh
npm install @ui-sdk/core@npm:@brett_lamy/ui-sdk-core@0.1.0-beta.2.bl.1 @ui-sdk/react@npm:@brett_lamy/ui-sdk-react@0.1.0-beta.2.bl.1
npx shadcn@latest add https://blamy.github.io/ui/r/bl-ui.json
npx shadcn@latest add https://blamy.github.io/ui/r/navigation-stack.json
```

Each item copies one component and only what it imports into `components/ui/` and `lib/`; blocks (whole apps) land in `components/blocks/<name>/`. See [How the registry works](https://blamy.github.io/ui/#/registry).

**npm.** The whole library as one dependency: ESM with one module per source module and an entry per module, so bundlers tree-shake it. It depends on the same two aliases; list them yourself too, so your own `@ui-sdk/react` imports share the kit's copy:

```sh
npm install @brett_lamy/ui @ui-sdk/core@npm:@brett_lamy/ui-sdk-core@0.1.0-beta.2.bl.1 @ui-sdk/react@npm:@brett_lamy/ui-sdk-react@0.1.0-beta.2.bl.1
```

```tsx
import '@brett_lamy/ui/styles.css'
import '@brett_lamy/ui/theme.css' // optional: the iOS palette
import { BLProvider, Button, NavigationStack, NavigationStackPage, NavigationStackBar, NavigationStackTitle, NavigationStackContent } from '@brett_lamy/ui'

export function App() {
  return (
    <BLProvider>
      <NavigationStack>
        <NavigationStackPage value="home">
          <NavigationStackBar><NavigationStackTitle>Home</NavigationStackTitle></NavigationStackBar>
          <NavigationStackContent>
            <Button onClick={() => alert('Hello')}>Say hello</Button>
          </NavigationStackContent>
        </NavigationStackPage>
      </NavigationStack>
    </BLProvider>
  )
}
```

React 19 is required. Coming from 5.x, or from `@brett_lamy/docstream` / `@brett_lamy/docstream-editor` (frozen at 2.0.1, now `@brett_lamy/ui/docstream…`): [Migrating to 6.0](https://blamy.github.io/ui/#/migrating-to-6).

## Workspace layout

- `packages/ui` — the library, `@brett_lamy/ui`: shadcn-style parts on UI SDK, the iOS containers, icons, motion, theme, the Composer, PencilKit and the Diagram family (`src/components`, `src/lib`; files import each other as `@/components/ui/<x>` and `@/lib/<x>`, the paths a registry install uses), docstream and its editor (`src/docstream`, `src/docstream-editor`, published as `@brett_lamy/ui/docstream/<entry>` and `@brett_lamy/ui/docstream-editor/<entry>`), and the Cloudflare entry (`src/cloudflare.ts`, `@brett_lamy/ui/cloudflare`). Stories and tests live next to their sources.
- `packages/ui-sdk-core`, `packages/ui-sdk-react` — `@brett_lamy/ui-sdk-core` and `@brett_lamy/ui-sdk-react`, generated from our UI SDK fork in `vendor/ui-sdk` (a submodule of [BLamy/ui-sdk](https://github.com/BLamy/ui-sdk)).
- `registry` — the blocks (`registry/blocks/<slug>`: `t3-clone`, `discord-clone`, `cloudflare-studio`, …) and the manifests that document the library's items (`registry/components/*.json`). `registry.json` at the root is generated. See [registry/README.md](registry/README.md).
- `apps/docs` — the BL site: the landing, library and roadmap pages (`src/site/`, with the split plan in `src/site/libraries.ts`, which `libraries.test.ts` checks against the real imports), the roadmap (`roadmap/*.md`), and the kit's docs (`pages/*.md` ordered by `pages/nav.json`, live examples in `examples/<page>/<example>`).
- `apps/docstream-playground`, `apps/docstream-editor-playground` — docstream's and the editor's own docs and examples (`docs/`), which the site mounts at [#/docstream](https://blamy.github.io/ui/#/docstream) and [#/docstream-editor](https://blamy.github.io/ui/#/docstream-editor).
- `apps/catalog` — the Storybook catalog (stories from `packages/ui`, the blocks and `apps/catalog/stories`).
- `tools` — workspace scripts: `registry` (the registry and the package's `exports`), `tokens` (token generator and lint), `docs` (install sections, variant tables, Markdown export, copy-page check), `cloudflare` (the Cloudflare catalog and the package check), `e2e` (Playwright behavior and accessibility tests), `vr` (visual regression), `ui-sdk` (builds the wrappers from the fork), `release`, `codemod`.
- `docs` — design notes (the 2.0 plan and decision log).

## Development

```sh
pnpm install           # also builds the two UI SDK packages from vendor/ui-sdk when it changed
pnpm dev:docs          # the BL site on :4206
pnpm storybook         # component catalog on :6006
pnpm nx run-many -t lint,typecheck,build,test
pnpm registry          # rewrite registry.json and the package's exports
pnpm tokens            # regenerate lib/tokens.generated.ts from tokens.css, then lint for literals
pnpm variants          # regenerate the cva variant tables in the docs
pnpm e2e               # Playwright behavior tests (they start their own docs server)
pnpm a11y              # axe audit against the baseline
pnpm vr                # visual regression (needs Storybook on :6006 and docs on :4417)
pnpm knip              # dead-code check
```

[CONVENTIONS.md](CONVENTIONS.md) has the rules every module follows and the full list of checks CI runs. Every push to `main` builds `apps/docs` and deploys it, with the registry under `/r`, to [GitHub Pages](https://blamy.github.io/ui/), and publishes any package version npm doesn't have yet (`ui-sdk-core`, `ui-sdk-react`, then `ui`).
