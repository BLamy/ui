/* The npm package's per-module entry points, computed from the same graph as the registry, so a module has one
 * import path in both installs:
 *
 *   @/components/ui/<path>  (registry copy)  ↔  @brett_lamy/ui/<path>      every module under components/
 *   @/lib/<path>            (registry copy)  ↔  @brett_lamy/ui/lib/<path>  the modules of a lib item that has a
 *                                                                         registry/components/<name>.json manifest
 *   (a folder's index.ts is the folder: @/lib/ffmpeg ↔ @brett_lamy/ui/lib/ffmpeg)
 *
 * tools/registry/build.mjs writes them into packages/ui/package.json `exports` (and fails `--check` when they are
 * stale); packages/ui/vite.config.mts builds every one of them as an entry, so each dist module keeps all of its
 * exports. Hand-written entries (".", the stylesheets, "./opencode", the worker scripts) are kept as they are. */
import { SRC, aliasOf, moduleExports } from './graph.mjs';

const GENERATED_SOURCE = /^\.\/src\/(components|lib)\/.+\.tsx?$/;

/** `@/components/ui/dialog` → `./dialog`, `@/lib/theme` → `./lib/theme`. */
export const subpathOf = (mod) => aliasOf(mod).replace(/^@\/components\/ui\//, './').replace(/^@\/lib\//, './lib/');

/** The modules that get an entry point, relative to packages/ui/src. */
export function packageModules(graph) {
  return graph.modules.filter((mod) => {
    const item = graph.items.get(graph.owner.get(mod));
    if (!item || (item.kind === 'lib' && !item.manifest)) return false;
    return moduleExports(`${SRC}/${mod}`).values.size > 0;
  });
}

/** `import { … } from '<this>'` for a module on npm: its subpath, or the package root when it has none. */
export function npmSpecifier(graph, mod) {
  return packageModules(graph).includes(mod) ? `@brett_lamy/ui${subpathOf(mod).slice(1)}` : '@brett_lamy/ui';
}

/** packages/ui/package.json with its generated `exports` entries brought up to date. */
export function withPackageExports(pkg, graph) {
  const kept = Object.entries(pkg.exports).filter(([key, entry]) => {
    const source = typeof entry === 'object' ? entry['@org/source'] : undefined;
    return !(source && GENERATED_SOURCE.test(source) && key === subpathOf(source.slice('./src/'.length)));
  });
  const keptKeys = new Set(kept.map(([key]) => key));
  const generated = packageModules(graph)
    .map((mod) => {
      const dist = mod.replace(/\.tsx?$/, '');
      return [subpathOf(mod), { '@org/source': `./src/${mod}`, types: `./dist/${dist}.d.ts`, default: `./dist/${dist}.js` }];
    })
    .filter(([key]) => !keptKeys.has(key))
    .sort(([a], [b]) => a.localeCompare(b));
  return { ...pkg, exports: Object.fromEntries([...kept, ...generated]) };
}
