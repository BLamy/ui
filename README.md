# TouchKit

TouchKit is an iOS-flavored React component monorepo built with Nx and pnpm. It contains the component packages, demo applications, Storybook catalog, and a GitBook-style documentation app.

## Workspace layout

- `packages/ui` — core TouchKit components, containers, haptics, and tokens
- `packages/chatkit` — composable team-chat primitives
- `packages/workbench` — IDE workbench shell and Docstream-backed markdown
- `packages/beautiful` — AI-native interface primitives
- `packages/pencilkit` — freehand drawing components
- `apps/docs` — the documentation site
- `apps/catalog` — the Storybook component catalog
- `project` — original HTML design prototypes and source assets

## Development

```sh
pnpm install
pnpm dev:docs          # docs app on :4206
pnpm storybook         # component catalog on :6006
pnpm nx run-many -t build
```

The docs app renders markdown through [`@brett_lamy/docstream`](https://www.npmjs.com/package/@brett_lamy/docstream). Every push to `main` builds `apps/docs` and deploys it to [GitHub Pages](https://blamy.github.io/ui/).
