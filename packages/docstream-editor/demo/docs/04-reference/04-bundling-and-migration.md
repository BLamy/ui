---
description: What the package ships, its exports map, how Vite, Next.js and webpack consume it, the boundaries its tests enforce, and what changed release by release.
---

# Bundling and migration

## What ships

Since 1.4, the package publishes compiled ES modules: ES2022, `react-jsx`, one `dist/` file per source module, with `.d.ts` declarations and declaration maps. The build (`scripts/build.mjs`) runs `tsc`, rewrites relative imports to fully-specified paths (`./x` → `./x.js`, which Node and webpack require for `"type": "module"` packages), and copies the CSS next to the modules that import it.

Nothing is bundled in: Tiptap, docstream and every other dependency stay `import`s, resolved by your bundler to the single copy in your app. Dynamic `import()`s stay dynamic, so the lazy pieces docstream draws inside the editor (Mermaid via Pele, KaTeX, rrweb, Strudel) load only when a document needs them.

The TypeScript sources are published too (`src/`, without tests or fixtures), behind a `source` export condition.

```json title="package.json (exports)"
{
  "exports": {
    ".": {
      "source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./editor": {
      "source": "./src/editor/Editor.tsx",
      "types": "./dist/editor/Editor.d.ts",
      "import": "./dist/editor/Editor.js",
      "default": "./dist/editor/Editor.js"
    },
    "./convert": {
      "source": "./src/editor/convert.ts",
      "types": "./dist/editor/convert.d.ts",
      "import": "./dist/editor/convert.js",
      "default": "./dist/editor/convert.js"
    },
    "./styles.css": "./dist/styles.css"
  },
  "sideEffects": ["**/*.css"]
}
```

`sideEffects` marks only the stylesheets, so a bundler drops whatever you don't import from the root entry.

## Which entry to import

| Entry | Pulls in | Use it when |
| --- | --- | --- |
| `@brett_lamy/docstream-editor` | Everything. Tree-shaken by any ESM bundler. | Almost always. |
| `…/editor` | `GitbookEditor` with all its node views. That includes the source-file editor that `{% source-ref %}` blocks use, and docstream's renderer pieces. Not `ReactDemoEditor`, and not the clipboard and extension re-exports. | An unbundled or dev-server setup where you want to skip parsing the rest. |
| `…/convert` | The conversion functions and `@brett_lamy/docstream/gitbook`. No React, no Tiptap. | Servers, workers, edge functions, tests. |
| `…/styles.css` | The editor stylesheet, which `@import`s docstream's property and task styles. | Once, at your entry, after `@brett_lamy/docstream/styles.css`. |

## Bundlers

{% tabs %}
{% tab title="Vite" %}
No configuration. Vite pre-bundles the editor, and Tiptap's CommonJS dependencies such as `use-sync-external-store`, like any dependency. You don't need `optimizeDeps.include` or `exclude` entries. If you added them for releases before 1.4, remove them.

To compile from the TypeScript sources in a monorepo, put `"source"` first in `resolve.conditions`, keeping Vite's defaults after it:

```ts title="vite.config.ts"
import { defaultClientConditions, defineConfig } from "vite"

export default defineConfig({
  resolve: { conditions: ["source", ...defaultClientConditions] },
})
```

Add `"customConditions": ["source"]` to `tsconfig.json` so the type-check follows the same files.
{% endtab %}

{% tab title="Next.js" %}
The editor is plain ESM, so it needs no `transpilePackages` entry. Render `GitbookEditor` from a `"use client"` component (the package carries no directive), and import both stylesheets from the root layout. `…/convert` is safe in server components and route handlers.
{% endtab %}

{% tab title="webpack" %}
Consumed as plain ESM. The fully-specified relative imports in `dist/` satisfy webpack's strict ESM resolution for `"type": "module"` packages. Make sure your CSS loader handles `@import` (the editor's stylesheet imports docstream's property and task styles).
{% endtab %}
{% endtabs %}

## Boundaries the tests enforce

| Test | Guarantees |
| --- | --- |
| `never imports the almost-node playground` | No source file imports `@brett_lamy/docstream/playground` or `@agent-wasm/core`. Live code is opt-in through `liveRenderer` / `demoRuntime`. |
| `never imports the almost-node playground from dist/ either` | The same, for the published `.js` and `.d.ts` files. |
| `publishes every entry from dist/ and loads each in plain Node` | Every `exports` entry points into `dist/`, its `types` sit beside it, and `import()` of each one succeeds in Node without a bundler. |
| `pins docstream to its own version` | `dependencies["@brett_lamy/docstream"]` equals the package's own `version`. See [the version rule](../01-getting-started/03-with-docstream.md#the-version-rule). |

## Migration notes

{% hint style="success" %}
Every release since 1.3 has been additive. Only 1.3 changed behavior you might depend on: it stopped running live code by itself.
{% endhint %}

<details>
<summary>Migrating to 1.3: live code is opt-in</summary>

`GitbookEditor` no longer runs `live` jsx/tsx code blocks in almost-node on its own. To keep the preview, pass the renderer:

```tsx lineNumbers="false"
import { almostNodeLiveRenderer } from "@brett_lamy/docstream/playground"

<GitbookEditor markdown={md} onChange={setMd} liveRenderer={almostNodeLiveRenderer} />
```

`ReactDemoEditor` takes the same `liveRenderer` prop. Without it, the files stay editable and a short note replaces the preview. Install `@agent-wasm/core` yourself if you use the playground.

</details>

<details>
<summary>Migrating to 1.4: compiled output</summary>

No API changes. Exports resolve to compiled `dist/*.js` and `.d.ts` instead of `src/*.ts(x)` (docstream 1.4 made the same change). Remove any `optimizeDeps`, `transpilePackages` or type-check settings you added to consume the raw sources.

</details>

<details>
<summary>Migrating to 1.5: demo clipboard and VFS</summary>

No breaking changes. Copying a selection with demo blocks now writes the docstream clipboard, pasting one restores the demos with their files, and demo blocks gain a drag grip. New props: `demoVFS`, `onDemoFilesChange`, `pastedDemoFiles`, `demoClipboard`. `react-aria` is now a dependency (for `useClipboard`). Set `demoClipboard={false}` to keep the old copy behavior.

</details>

<details>
<summary>Migrating to 1.9: document properties and task states</summary>

No breaking changes. YAML frontmatter shows as an editable property sheet above the body. Pass `documentProperties={false}` to hide it (the YAML is still kept). Task lists support all eight docstream states (`[ ]`, `[~]`, `[?]`, `[b]`, `[d]`, `[!]`, `[x]`, `[-]`). Custom editors get `GbDocumentProperties`, `DocumentPropertiesEditor`, `GbTaskItem`, and the `setDocumentProperties` / `setTaskState` commands.

</details>

<details>
<summary>Migrating to 1.14 and later: host files</summary>

No breaking changes. `resolveAsset`, `pickFile` and `onDropEmbeds` (1.14) and `uploadFile` (1.17) are optional. Without them, the editor behaves as before.

</details>

## Release history

{% updates %}
{% update date="2026-10-20" %}
**1.19.0**: docstream 1.19.0 (ordered lists keep their start number; a new bullet or delimiter starts a new list; OpenAPI spec links go through `resolveAsset`). A list created right after another list of the same kind gets the other marker, so the two stay separate when saved and reopened. **Fixed**: line breaks (`Shift`+`Enter`) save as `\` breaks and load as real ones; a second paragraph in a table cell is saved, joined to the cell's line; `editable` follows the prop after mount; the toolbar's Bold / Italic / Strike / Code / Link buttons follow the selection; `SourceFileEditor` no longer re-reads (and drops unsaved edits) when the host re-renders. **Removed**: the underline mark (`Mod`+`U`), which Markdown can't store.
{% endupdate %}

{% update date="2026-10-20" %}
**1.18.1**: Thumbnail images (`![alt](src "thumbnail: 0:39.8")`) show as docstream's thumbnail with its hover card. A thumbnail first in a stepper step's heading sits beside the title and survives retitling. docstream 1.18.1.
{% endupdate %}

{% update date="2026-10-20" %}
**1.17.0**: `.rrweb` embeds play as session replays. Added `uploadFile` for dropped, pasted and chosen files. docstream 1.17.0.
{% endupdate %}

{% update date="2026-10-17" %}
**1.16.1**: Mermaid and math blocks are docstream's source-and-result cards: source on the left, Pele or KaTeX on the right, stacked when narrow. (1.16.2: card links stay muted.)
{% endupdate %}

{% update date="2026-10-17" %}
**1.14.0**: Added `resolveAsset`, `pickFile` (**Choose file…**) and `onDropEmbeds` for host projects. (1.14.1: late drops insert after the selection.)
{% endupdate %}

{% update date="2026-10-16" %}
**1.10.0**: STL and Strudel embeds. `strudel` fences preview a player.
{% endupdate %}

{% update date="2026-10-15" %}
**1.9.0**: Document properties and task-state editing.
{% endupdate %}

{% update date="2026-09-28" %}
**1.5.0**: Copy, paste and drag demo blocks with their files between editors. Added the demo VFS.
{% endupdate %}

{% update date="2026-09-28" %}
**1.4.0**: Published as compiled ESM (`dist/` with declarations).
{% endupdate %}

{% update date="2026-09-28" %}
**Breaking: 1.3.0**: The editor never imports docstream's almost-node playground. Added the `liveRenderer` option.
{% endupdate %}

{% update date="2026-09-28" %}
**1.2.4**: Lossless round trip: layout, reference links and definitions, escapes, link identity, marks on chips and images, nested emphasis.
{% endupdate %}

{% update date="2026-09-27" %}
**1.2.1**: Editor versions now track the docstream version they pin.
{% endupdate %}
{% endupdates %}

Releases between these entries (1.6–1.8, 1.12–1.13) only moved the docstream pin.
