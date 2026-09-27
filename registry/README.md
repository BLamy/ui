# registry

Source for the shadcn registry (`registry.json` at the repo root, built into the docs site under `/r`, i.e.
`https://blamy.github.io/ui/r/<item>.json`).

- `blocks/<slug>/` — full-app blocks (e.g. `github-clone`, `discord-clone`, `t3-clone`). Each has
  `meta.json` (`{ name, title, description, categories, files }`, see `blocks/types.ts`) and a `page.tsx` whose
  default export is the whole block. Files import only from `react`, `@brett_lamy/ui` / `@brett_lamy/pencilkit` and
  their sibling files (they are installed together into `components/blocks/<slug>/`). An optional
  `<slug>.stories.tsx` is picked up by Storybook (not listed in `files`). The docs Blocks page discovers blocks by
  glob — nothing else to register.
- `components/<name>.json` — one per documented component (`{ name, title, description, page, exports, imports?,
  types?, from? }`, see `components/types.ts`). `page` is the docs page id whose Installation section shows it.
  `components/<name>.tsx` is generated from it (a thin named re-export, installed as `@/components/ui/<name>`).
- `styles.css` — `@brett_lamy/ui`'s sheet compiled together with the blocks' Tailwind classes, for the docs and
  Storybook.

Commands (repo root):

- `pnpm registry` — regenerate `components/*.tsx` and `registry.json` (validates exports and block imports).
- `pnpm registry:static` — also run `shadcn build` into `apps/docs/public/r` (the docs build does this via
  `nx run @brett_lamy/registry:registry`).
- `node tools/registry/build.mjs --static --url http://localhost:4501/r --out /tmp/r` — a static registry for
  another host, for testing `npx shadcn add` locally.
- `node tools/registry/build.mjs --check` — fail if the committed files are stale (CI).

Every item depends on `bl-ui` (`registry:style`): it installs `@brett_lamy/ui`, adds
`@import "@brett_lamy/ui/styles.css"` to the app's CSS and the BL token utilities (`bg-bl-card`, `text-bl-label`,
…) to its `@theme inline`. Blocks should style with those `bl-*` / `wb-*` / `ck-*` utilities rather than shadcn's
semantic names, which belong to the consumer's own palette.
