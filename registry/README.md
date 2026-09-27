# registry

Source for the shadcn registry (`registry.json` at the repo root, built into the docs site under `/r`).

- `blocks/<slug>/` — full-app blocks (e.g. `github-clone`, `discord-clone`, `t3-clone`). Each has
  `meta.json` (`{ name, title, description, categories, files }`) and a `page.tsx` whose default
  export is the whole block. Files import only from `@brett_lamy/ui` / `@brett_lamy/pencilkit`.
- `components/` — per-component registry entries (thin `@/components/ui/*` re-exports).
