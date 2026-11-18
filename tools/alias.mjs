/* The workspace's import aliases — the same paths a project gets after `shadcn add`:
 *   @/components/ui/<x>      → packages/ui/src/components/<x>     (components/ui/<x> in a consumer app)
 *   @/lib/<x>                → packages/ui/src/lib/<x>            (lib/<x>)
 *   @/components/blocks/<x>  → registry/blocks/<x>                (components/blocks/<x>)
 * and the package's UI SDK entries, which copied source imports by the package's name:
 *   @brett_lamy/ui/sdk/<x>   → packages/ui/src/sdk/<x>            (each a one-line re-export of `@ui-sdk/<x>`, so the
 *                                                                 library's own modules and an app share one copy)
 * Keep in sync with `paths` in tsconfig.base.json. Used by the Vite configs (lib build, docs, Storybook, Vitest). */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const aliases = [
  { find: /^@\/components\/ui\/(.*)$/, replacement: `${ROOT}/packages/ui/src/components/$1` },
  { find: /^@\/lib\/(.*)$/, replacement: `${ROOT}/packages/ui/src/lib/$1` },
  { find: /^@\/components\/blocks\/(.*)$/, replacement: `${ROOT}/registry/blocks/$1` },
  { find: /^@brett_lamy\/ui\/sdk\/(.*)$/, replacement: `${ROOT}/packages/ui/src/sdk/$1` },
];

/* The library's entries that code inside it imports by the package's name: docstream and docstream-editor
 * (`@brett_lamy/ui/docstream/<entry>`, generated from tools/registry/package-exports.mjs FOLDED) and `./cloudflare`, which
 * docstream's capnp fence loads, `./state-diagram`, which its xstate fence draws, `./lib/state-diagram-{model,source}`,
 * which its text form (`xstateToMermaid`) reads with, and
 * `./lib/icon`, `./lib/syntax-lexer`, `./lib/syntax` and `./lib/change-details`: its glyphs, its fences' lexers and its
 * callbacks' details. Each → its
 * source, from the package's own `exports`. An app in the workspace gets there through
 * the package and the `@org/source` condition; this is for what can't: the library's Vitest run, the playgrounds. */
const ui = JSON.parse(readFileSync(`${ROOT}/packages/ui/package.json`, 'utf8'));
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
export const docstreamAliases = Object.entries(ui.exports)
  .filter(([key, value]) => /^\.\/(docstream(-editor)?(\/|$)|cloudflare$|state-diagram$|lib\/state-diagram-(model|source)$|lib\/(icon|syntax-lexer|syntax|change-details)$)/.test(key) && value && typeof value === 'object' && value['@org/source'])
  .map(([key, value]) => ({ find: new RegExp(`^${escape(`@brett_lamy/ui${key.slice(1)}`)}$`), replacement: resolve(ROOT, 'packages/ui', value['@org/source']) }));
