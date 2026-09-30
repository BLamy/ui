# How the registry works

BL UI is distributed as a [shadcn registry](https://ui.shadcn.com/docs/registry): a set of JSON files, one per item, each listing the source files to copy and what they need. The registry is built from the library's own code, so nothing is listed by hand and nothing goes stale. This page explains the model, so you can read an item, trust what `add` will do, test changes locally, and contribute.

## From modules to items

Every module under `packages/ui/src/components` and `packages/ui/src/lib` belongs to exactly one item. By default a module is its own item, named after the file (or the folder it sits in): `components/badge.tsx` is `badge`, `lib/motion.ts` is `motion`, everything under `components/composer/` is `composer`. A documented component that spans several modules is grouped by a small manifest in `registry/components/<name>.json`.

An item's dependencies are computed from its real imports (TypeScript's scanner, so a string in sample data does not count):

| Import in a source file | Becomes |
| --- | --- |
| `@/components/ui/<x>` or `@/lib/<x>` | a `registryDependencies` entry on the item that owns that module |
| a relative import into another item's module | the same |
| any other package (`framer-motion`, `react-aria-components`, `class-variance-authority`, …) | an npm `dependencies` entry, versioned from the workspace |
| `react`, `react-dom` | nothing: your app has them |

`registryDependencies` are full URLs to BL UI's own items (`https://blamy.github.io/ui/r/button.json`), never bare names. That is what keeps shadcn's stock `button` from being pulled in: installing `list` copies BL UI's `button`, `icon`, `motion` and `utils` with it, and overwrites your `components/ui/button.tsx` and `lib/utils.ts` (see [Installation](https://blamy.github.io/ui/#/installation)).

The result is a real dependency graph. Installing `list` brings only what `list` imports, transitively, and the npm packages those files use:

```json
{
  "name": "list",
  "type": "registry:ui",
  "dependencies": ["class-variance-authority@^0.7.1", "framer-motion@^13.1.0"],
  "registryDependencies": [
    "https://blamy.github.io/ui/r/bl-ui.json",
    "https://blamy.github.io/ui/r/icon.json",
    "https://blamy.github.io/ui/r/motion.json",
    "https://blamy.github.io/ui/r/row-label.json",
    "https://blamy.github.io/ui/r/theme.json",
    "https://blamy.github.io/ui/r/utils.json"
  ],
  "files": [
    { "path": "packages/ui/src/components/list.tsx", "type": "registry:ui", "target": "components/ui/list.tsx" }
  ]
}
```

## Item types

| Type | Made from | Lands in |
| --- | --- | --- |
| `registry:style` | `bl-ui`, from `tokens.css` and `styles.css` | your CSS |
| `registry:theme` | `bl-theme`, from `theme.css` | your CSS variables |
| `registry:ui` | a library module or group under `components/` | `components/ui/…` |
| `registry:lib` | a library module under `lib/` | `lib/…` |
| `registry:block` | `registry/blocks/<slug>/meta.json` | `components/blocks/<slug>/` |

There are over a hundred items. [`registry.json`](https://blamy.github.io/ui/r/registry.json) is the index, and each item is `https://blamy.github.io/ui/r/<item>.json`.

## bl-ui and bl-theme

Every item depends on `bl-ui`. It installs no package; it writes to your CSS:

- **`@theme inline` tokens**, generated from `tokens.css`: the extra colors (`text-tertiary-foreground`, `bg-bar`, `text-success`, …), the radius, text-size, shadow and size scales, and the spring motion tokens. Colors that shadcn's own theme already maps (`--color-background` and friends) are left to your app.
- **Framework CSS**: keyframes, scrollbars, and a `box-sizing` reset scoped to `[data-slot]`, so a host without Tailwind's preflight does not distort BL UI's parts.
- **The `dark` variant**, redefined as `(&:where(.dark, .dark *))`, so the element that carries `.dark` (a `ThemeScope` root) restyles itself, not just its children.

`bl-theme` is opt-in. It sets shadcn's variables for light (`:root`) and dark (`.dark`) to the iOS palette, and adds the scopes `workbench`, `terminal`, `sheet` and `glass` as `[data-theme-scope="…"]` rules. It is generated from `theme.css`. See [Theming](https://blamy.github.io/ui/#/theming) for what each layer does.

## Blocks

A block is a directory in `registry/blocks/<slug>/` with a `meta.json` and the files it lists. Its item copies those files to `components/blocks/<slug>/`, and its `registryDependencies` are computed like a component's: `bl-ui`, plus the library items its files import. See [Blocks](https://blamy.github.io/ui/#/blocks) for what one contains.

## Try a change locally

Build the registry for a local URL, serve it, and add from it in a test app. Everything writes to `/tmp`; your working tree is untouched.

{% stepper %}
{% step %}
### Build a static registry for localhost

Item URLs are absolute, so build with the URL you will serve from:

```sh
node tools/registry/build.mjs --static --url http://localhost:4501/r --out /tmp/reg-root/r
```
{% endstep %}

{% step %}
### Serve it

```sh
cd /tmp/reg-root && python3 -m http.server 4501
```
{% endstep %}

{% step %}
### Add from it in a test app

```sh
npx shadcn@latest add http://localhost:4501/r/list.json
```

Try the parts you changed, and one block, in a fresh shadcn app. If a file does not resolve, the fix is almost always an import that skips the alias.
{% endstep %}
{% endstepper %}

## Contributing

The registry is computed from the code, so the rules are about the code:

- **Import by alias.** Library files import each other as `@/components/ui/<x>` and `@/lib/<x>` (shadcn's default aliases). The CLI rewrites them to the user's aliases. Relative imports between a module and its own folder are fine.
- **Never import the package.** A library file must not import from `@brett_lamy/ui`; the build fails if one does. The package barrel re-exports these files, so importing it from them would be circular.
- **Blocks are small on purpose.** A block may import only `react`, `@/components/ui/*`, `@/lib/*`, its own files, and the npm packages listed in its `meta.json` `dependencies`. Product-specific components live in the block; anything general belongs in the library.
- **Use the tokens.** Components style themselves with theme utilities, not literals: `node tools/tokens/check.mjs` enforces it. See [Styling and variants](https://blamy.github.io/ui/#/styling).
- **Register a documented component** by adding `registry/components/<name>.json` with its docs `page` and `exports`; the page's Installation section is generated from it (`node tools/docs/install-md.mjs`).
- **Register a block** by adding `registry/blocks/<slug>/meta.json` (`name`, `title`, `description`, `categories`, `files`, `dependencies`) and a `{% demo src="blocks/<slug>" layout="multi" %}` line on the Blocks page.

Regenerate and check:

```sh
pnpm registry                            # rewrite registry.json
node tools/registry/build.mjs --check    # fail if committed files are stale (CI)
node tools/tokens/check.mjs              # fail on hex, rgba or arbitrary radius/text/shadow in components
```

## The npm package comes from the same files

`@brett_lamy/ui` is built from the same `packages/ui/src` files the registry copies. Vite's library mode compiles them to ESM with one output module per source module (`preserveModules`), dependencies external, and `'use client'` kept on each component module. The barrel re-exports the library, and `package.json` marks `"sideEffects": ["*.css"]`, so a bundler drops the modules an app does not import. The package contains the library only: blocks are registry-only, since they are meant to be copied and edited.

One source of truth means the two paths cannot disagree: a fix to `packages/ui/src/components/list.tsx` lands in the next `npm` release and in the next `add`.
