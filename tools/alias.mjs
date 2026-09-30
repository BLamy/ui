/* The workspace's import aliases — the same paths a project gets after `shadcn add`:
 *   @/components/ui/<x>      → packages/ui/src/components/<x>     (components/ui/<x> in a consumer app)
 *   @/lib/<x>                → packages/ui/src/lib/<x>            (lib/<x>)
 *   @/components/blocks/<x>  → registry/blocks/<x>                (components/blocks/<x>)
 * Keep in sync with `paths` in tsconfig.base.json. Used by the Vite configs (lib build, docs, Storybook, Vitest). */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const aliases = [
  { find: /^@\/components\/ui\/(.*)$/, replacement: `${ROOT}/packages/ui/src/components/$1` },
  { find: /^@\/lib\/(.*)$/, replacement: `${ROOT}/packages/ui/src/lib/$1` },
  { find: /^@\/components\/blocks\/(.*)$/, replacement: `${ROOT}/registry/blocks/$1` },
];
