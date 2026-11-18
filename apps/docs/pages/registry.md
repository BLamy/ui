# How the registry works

BL UI is distributed as a [shadcn registry](https://ui.shadcn.com/docs/registry): a set of JSON files, one per item, each listing the source files to copy and what they need. The registry is built from the library's own code, so nothing is listed by hand and nothing goes stale. This page explains the model, so you can read an item, trust what `add` will do, test changes locally, and contribute.

## From modules to items

Every module under `packages/ui/src/components` and `packages/ui/src/lib` belongs to exactly one item. By default a module is its own item, named after the file (or the folder it sits in): `components/badge.tsx` is `badge`, `lib/motion.ts` is `motion`, everything under `components/composer/` is `composer`. A documented component that spans several modules is grouped by a small manifest in `registry/components/<name>.json`. Docstream and its editor (`packages/ui/src/docstream`, `packages/ui/src/docstream-editor`) and UI SDK are part of the library but not items: they are built and installed whole, as `@brett_lamy/ui`.

An item's dependencies are computed from its real imports (TypeScript's scanner, so a string in sample data does not count):

| Import in a source file | Becomes |
| --- | --- |
| `@/components/ui/<x>` or `@/lib/<x>` | a `registryDependencies` entry on the item that owns that module |
| a relative import into another item's module | the same |
| `@brett_lamy/ui/docstream/<entry>`, `@brett_lamy/ui/docstream-editor/<entry>` | the npm dependency `@brett_lamy/ui` at the library's version: the import stays as written |
| `@ui-sdk/core`, `@ui-sdk/react/<part>`: UI SDK, as the library's source names it | the npm dependency `@brett_lamy/ui` at the library's version, which ships UI SDK; the copied file imports `@brett_lamy/ui/sdk/core`, `@brett_lamy/ui/sdk/react/<part>` |
| any other package (`framer-motion`, `class-variance-authority`, …) | an npm `dependencies` entry, versioned from the workspace |
| `react`, `react-dom` | nothing: your app has them |

`registryDependencies` are full URLs to BL UI's own items (`https://blamy.github.io/ui/r/button.json`), never bare names. That is what keeps shadcn's stock `button` from being pulled in: installing `list` copies BL UI's `button`, `icon`, `motion` and `utils` with it, and overwrites your `components/ui/button.tsx` and `lib/utils.ts` (see [Installation](https://blamy.github.io/ui/#/installation)).

The result is a real dependency graph. Installing `list` brings only what `list` imports, transitively, and the npm packages those files use:

```json
{
  "name": "list",
  "type": "registry:ui",
  "dependencies": [
    "@brett_lamy/ui@6.0.0",
    "class-variance-authority@^0.7.1",
    "framer-motion@^13.1.0"
  ],
  "registryDependencies": [
    "https://blamy.github.io/ui/r/bl-ui.json",
    "https://blamy.github.io/ui/r/checkbox.json",
    "https://blamy.github.io/ui/r/empty-state.json",
    "https://blamy.github.io/ui/r/hover-card.json",
    "https://blamy.github.io/ui/r/icon.json",
    "https://blamy.github.io/ui/r/list-primitive.json",
    "…"
  ],
  "files": [
    { "path": "packages/ui/src/components/list.tsx", "type": "registry:ui", "target": "components/ui/list.tsx" }
  ]
}
```

### Parts built on UI SDK

Almost every interactive part is a UI SDK part, and UI SDK is not copied: the package ships its own build of it. In the library's source a module imports it under upstream's names (`@ui-sdk/react/dialog`); the registry build lists `@brett_lamy/ui` in the item's `dependencies` and writes the copied file with the package's entry for the same module:

```tsx
// components/ui/dialog.tsx, as copied
import { Dialog as SdkDialog } from '@brett_lamy/ui/sdk/react/dialog';
```

So your copy and anything else in your app that imports `@brett_lamy/ui/sdk/…` run on one copy of UI SDK. Do not add upstream's `@ui-sdk/*` packages beside it.

### Parts built on docstream

`markdown-view`, `markdown-editor`, `composer`, and the four thin widget modules `replay-preview`, `tui-preview`, `stl-viewer` and `strudel-player` import docstream by the package's name. `add` copies the item's own module, which keeps importing `@brett_lamy/ui/docstream…`, and installs `@brett_lamy/ui` for it. `stl-viewer`, for example, copies one file:

```tsx
// components/ui/stl-viewer.tsx
export { StlViewer } from '@brett_lamy/ui/docstream/stl';
export type { StlViewerProps } from '@brett_lamy/ui/docstream/stl';
```

and its item lists `"dependencies": ["@brett_lamy/ui@6.0.0"]`. Since no module of the package imports CSS, these items (and `conversation`, which renders MarkdownView) also add docstream's stylesheet to your CSS through shadcn's `css` field, `@import "@brett_lamy/ui/docstream/styles.css" layer(docstream)`; `markdown-editor` adds the editor's sheet as well, in the `components.bl-editor` layer. Blocks that use docstream (Apple Music, Apple Notes, Apple Reminders, Loop QA, Replay Canvas, Strudel Studio, Time Machine) do the same.

## Item types

| Type | Made from | Lands in |
| --- | --- | --- |
| `registry:style` | `bl-ui`, from `tokens.css` and `styles.css` | your CSS |
| `registry:theme` | `bl-theme`, from `theme.css` | your CSS variables |
| `registry:ui` | a library module or group under `components/` | `components/ui/…` |
| `registry:lib` | a library module under `lib/` | `lib/…` |
| `registry:block` | `registry/blocks/<slug>/meta.json` | `components/blocks/<slug>/` |
| `registry:item` | a library of `apps/docs/src/site/libraries.ts`: `library-<entry>` | nothing of its own: it installs the library's items |

There are over 270 items: 29 of them blocks, 18 of them libraries. [`registry.json`](https://blamy.github.io/ui/r/registry.json) is the index, and each item is `https://blamy.github.io/ui/r/<item>.json`.

## bl-ui and bl-theme

Every item depends on `bl-ui`. It installs no package; it writes to your CSS:

- **`@theme inline` tokens**, generated from `tokens.css`: the extra colors (`text-tertiary-foreground`, `bg-bar`, `text-success`, …), the radius, text-size, shadow and size scales, and the spring motion tokens. Colors that shadcn's own theme already maps (`--color-background` and friends) are left to your app.
- **Framework CSS**: keyframes, scrollbars, and a `box-sizing` reset scoped to `[data-slot]`, so a host without Tailwind's preflight does not distort BL UI's parts.
- **The `dark` variant**, redefined as `(&:where(.dark, .dark *))`, so the element that carries `.dark` (a `ThemeScope` root) restyles itself, not just its children.

`bl-theme` is opt-in. It sets shadcn's variables for light (`:root`) and dark (`.dark`) to the iOS palette, and adds the scopes `workbench`, `terminal`, `sheet` and `glass` as `[data-theme-scope="…"]` rules. It is generated from `theme.css`. See [Theming](https://blamy.github.io/ui/#/theming) for what each layer does.

## Libraries

The package is many libraries (Time, Canvas, Diagram, Audio, Markdown…), each an entry of `@brett_lamy/ui` on npm. The registry has the same grouping: one `registry:item` per library, named `library-<entry>`, with no files of its own and every item of the library in its `registryDependencies`. `library-ui` is the core, every item that no other library owns.

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/library-audio.json{% endcommand %}

```json
{
  "name": "library-audio",
  "type": "registry:item",
  "title": "Audio (library)",
  "registryDependencies": [
    "https://blamy.github.io/ui/r/bl-ui.json",
    "https://blamy.github.io/ui/r/now-playing-bars.json",
    "https://blamy.github.io/ui/r/playback.json",
    "https://blamy.github.io/ui/r/strudel-player.json",
    "https://blamy.github.io/ui/r/waveform.json"
  ]
}
```

The library items are generated from the same list that writes the package's library entries, so `library-audio` installs what `@brett_lamy/ui/audio` exports, and the modules those need. [Installation](https://blamy.github.io/ui/#/installation) lists them, under "Libraries and entries".

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
- **Never import the package, but for docstream.** A library file must not import from `@brett_lamy/ui`; the build fails if one does. The package barrel re-exports these files, so importing it from them would be circular. The one exception is docstream's entries (`@brett_lamy/ui/docstream/<entry>`, `@brett_lamy/ui/docstream-editor/<entry>`), which nothing copies. UI SDK is imported as `@ui-sdk/…` in a library file; the registry build turns that into `@brett_lamy/ui/sdk/…` in the copy.
- **Blocks are small on purpose.** A block may import only `react`, `@/components/ui/*`, `@/lib/*`, its own files, and the npm packages listed in its `meta.json` `dependencies` (docstream's and UI SDK's entries by the package's name, `@brett_lamy/ui/docstream/…` and `@brett_lamy/ui/sdk/…`, with `@brett_lamy/ui` listed; never `@ui-sdk/…`). Product-specific components live in the block; anything general belongs in the library.
- **Use the tokens.** Components style themselves with theme utilities, not literals: `node tools/tokens/check.mjs` enforces it. See [Styling and variants](https://blamy.github.io/ui/#/styling).
- **Register a documented component** by adding `registry/components/<name>.json` with its docs `page` and `exports`; the page's Installation section is generated from it (`node tools/docs/install-md.mjs`).
- **Put a module in a library** by listing it under the library's `modules` in `apps/docs/src/site/libraries.ts`; a module no library lists belongs to the core. The build regenerates the library's entry and its `library-<entry>` item, and the docs app's test fails if the module imports from a library its own does not build on.
- **Register a block** by adding `registry/blocks/<slug>/meta.json` (`name`, `title`, `description`, `categories`, `files`, `dependencies`) and a `{% demo src="blocks/<slug>" layout="multi" %}` line on the Blocks page.

Regenerate and check:

```sh
pnpm registry                            # rewrite registry.json, the package's exports and its library entries
node tools/registry/build.mjs --check    # fail if committed files are stale (CI)
node tools/tokens/check.mjs              # fail on hex, rgba or arbitrary radius/text/shadow in components
```

## The npm package comes from the same files

`@brett_lamy/ui` is built from the same `packages/ui/src` files the registry copies. Vite's library mode compiles them to ESM with one output module per source module (`preserveModules`), dependencies external, and `'use client'` kept on each component module; docstream is then compiled a module per file with `tsc`. The root exports the core, every library has an entry (`@brett_lamy/ui/audio`), every module has its own entry at its registry path (`@/components/ui/list` is `@brett_lamy/ui/list`; the registry build writes all of these into `package.json` from the same import graph and the list of libraries), and `package.json` marks `"sideEffects": ["*.css"]`, so a bundler drops the modules an app does not import. The last step of the build copies the compiled UI SDK into the package, where the `@brett_lamy/ui/sdk/…` entries reach it. The package contains every library, docstream and UI SDK: blocks are registry-only, since they are meant to be copied and edited.

One source of truth means the two paths cannot disagree: a fix to `packages/ui/src/components/list.tsx` lands in the next `npm` release and in the next `add`.
