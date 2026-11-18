/* The npm package's per-module entry points, computed from the same graph as the registry, so a module has one
 * import path in both installs:
 *
 *   @/components/ui/<path>  (registry copy)  ↔  @brett_lamy/ui/<path>      every module under components/
 *   @/lib/<path>            (registry copy)  ↔  @brett_lamy/ui/lib/<path>  the modules of a lib item that has a
 *                                                                         registry/components/<name>.json manifest
 *   (a folder's index.ts is the folder: @/lib/ffmpeg ↔ @brett_lamy/ui/lib/ffmpeg)
 *   except a module marked `@internal` in its header comment (see `isInternalModule`)
 *
 * tools/registry/build.mjs writes them into packages/ui/package.json `exports` (and fails `--check` when they are
 * stale); packages/ui/vite.config.mts builds every one of them as an entry, so each dist module keeps all of its
 * exports. Hand-written entries (".", the stylesheets, "./opencode", "./cloudflare", the worker scripts) are kept as
 * they are.
 *
 * Docstream and its editor are part of the library (src/docstream, src/docstream-editor): their entries are the ones
 * `@brett_lamy/docstream` and `@brett_lamy/docstream-editor` published at 2.0.1, under `./docstream/…` and
 * `./docstream-editor/…` (FOLDED below), written from that table too. They are built apart, a module per file, by
 * packages/ui/scripts/build-docstream.mjs, so their targets keep the shape their own packages had: `source` beside the
 * workspace's `@org/source`, then `types`, `import` and `default`; a stylesheet is its built file. */
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ROOT, SRC, aliasOf, importsOf, moduleExports, resolveModule } from './graph.mjs';

/* ── The libraries ──
 * One package, many libraries: the plan (apps/docs/src/site/libraries.ts, read with Node's type stripping) gives each
 * library the units of src it owns, and for most an `entry`. For every library with an `entry` this writes
 *
 *   packages/ui/src/libraries/<entry>.ts   `export *` from each of the library's modules that has an entry of its own
 *   "./<entry>" in package.json `exports`  so `@brett_lamy/ui/<entry>` is the whole library
 *   the registry item `library-<entry>`    which installs the same modules with the shadcn CLI (build.mjs)
 *
 * so a name has two import paths and no more: its module's (`@brett_lamy/ui/waveform`) and its library's
 * (`@brett_lamy/ui/audio`). Where a library is called what its main module is called (`filter`, `canvas`, `diagram`,
 * `composer`), the path is the library's, and that module is carried by it instead of having an entry of its own.
 * The core (`ui`) has no generated entry: the package root is the core, with the foundation it stands on. */
export const { LIBRARIES, LIBRARY, ownerOf } = await import(pathToFileURL(`${ROOT}/apps/docs/src/site/libraries.ts`).href);
/** `components/composer/index.ts` → the plan's unit, `components/composer/`. */
const unitOf = (mod) => {
  const parts = mod.split('/');
  return parts.length > 2 ? `${parts[0]}/${parts[1]}/` : mod;
};
/** The library a module of packages/ui/src belongs to. */
export const libraryOf = (mod) => ownerOf(unitOf(mod));
/** The libraries with a generated entry. */
export const ENTRY_LIBRARIES = LIBRARIES.filter((l) => l.entry);
const LIBRARY_KEYS = new Map(ENTRY_LIBRARIES.map((l) => [`./${l.entry}`, l]));
export const isLibraryKey = (key) => LIBRARY_KEYS.has(key);
/** The libraries whose names the package root carries: the core and the foundation under it. */
export const ROOT_LIBRARIES = new Set(['ui', 'tokens', 'motion', 'icons']);

/* ── UI SDK, inside the package ──
 * The library ships its own build of UI SDK (the `vendor/ui-sdk` submodule, compiled by tools/ui-sdk/build.mjs into the
 * private workspace packages `packages/ui-sdk-core` and `packages/ui-sdk-react`): no second npm package. The library's
 * source imports it under upstream's names (`@ui-sdk/core`, `@ui-sdk/react/dialog`); packages/ui/scripts/vendor-ui-sdk.mjs
 * copies the compiled fork into dist/vendor/ui-sdk and points those imports at it. An app reaches the same copy at
 *
 *   @ui-sdk/core            →  @brett_lamy/ui/sdk/core
 *   @ui-sdk/core/<entry>    →  @brett_lamy/ui/sdk/core/<entry>
 *   @ui-sdk/react/<entry>   →  @brett_lamy/ui/sdk/react/<entry>
 *
 * one entry per entry of the fork's two packages, each a one-line module under src/sdk (written by
 * tools/registry/build.mjs, `sdkShims`) so it resolves in the workspace like every other entry. */
export const SDK_PACKAGES = ['core', 'react'];
const sdkManifest = (name) => JSON.parse(readFileSync(`${ROOT}/packages/ui-sdk-${name}/package.json`, 'utf8'));
export const isSdkKey = (key) => /^\.\/sdk\//.test(key);

/** Every entry of the fork's two packages: its upstream specifier, our `exports` key, and its shim under src/sdk. */
export function sdkEntries() {
  return SDK_PACKAGES.flatMap((name) =>
    Object.entries(sdkManifest(name).exports)
      .filter(([key]) => key !== './package.json')
      .map(([key, target]) => {
        const sub = key === '.' ? '' : key.slice(1); // '' | '/dialog' | '/web.css'
        const upstream = `@ui-sdk/${name}${sub}`;
        if (typeof target === 'string') {
          // A plain file (core's stylesheet): served from the vendored copy, with no shim.
          return { upstream, key: `./sdk/${name}${sub}`, file: target.replace(/^\.\/dist\//, `./dist/vendor/ui-sdk/${name}/`) };
        }
        const shim = `sdk/${name}${sub || '/index'}.ts`;
        return { upstream, key: `./sdk/${name}${sub}`, shim };
      }),
  );
}

/** The one-line modules behind the `./sdk/…` entries: path under packages/ui/src → content. */
export function sdkShims() {
  return sdkEntries()
    .filter((e) => e.shim)
    .map((e) => [e.shim, `// Generated by tools/registry/build.mjs. UI SDK's \`${e.upstream}\`, from the copy this package ships.\nexport * from '${e.upstream}';\n`]);
}

const sdkExports = () =>
  sdkEntries().map((e) => {
    if (e.file) return [e.key, e.file];
    const dist = `./dist/${e.shim.replace(/\.ts$/, '')}`;
    return [e.key, { '@org/source': `./src/${e.shim}`, types: `${dist}.d.ts`, default: `${dist}.js` }];
  });

/** package.json `imports`: the fork's own private specifiers (`#dev`, `#name-check`, picked by the `development`
 *  condition), which its compiled modules still use from inside our dist. */
export function sdkImports() {
  const out = {};
  for (const name of SDK_PACKAGES) {
    const map = (value) =>
      typeof value === 'string' ? value.replace(/^\.\/dist\//, `./dist/vendor/ui-sdk/${name}/`) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, map(v)]));
    for (const [key, value] of Object.entries(sdkManifest(name).imports ?? {})) {
      if (out[key]) throw new Error(`package-exports: both UI SDK packages define the import ${key}`);
      out[key] = map(value);
    }
  }
  return out;
}

const GENERATED_SOURCE = /^\.\/src\/(components|lib)\/.+\.tsx?$/;

/* A module whose header comment (the first comment, after an optional 'use client') carries `@internal` is the kit's
   own wiring between its modules (a context, a store, helpers): registry installs copy it with the item that owns it,
   but it gets no npm entry, so none of its exports is package API. */
const INTERNAL = /^(?:\s*['"]use client['"];?)?\s*\/\*(?:(?!\*\/)[\s\S])*@internal\b/;
export const isInternalModule = (mod) => INTERNAL.test(readFileSync(`${ROOT}/${SRC}/${mod}`, 'utf8'));

/** `@/components/ui/dialog` → `./dialog`, `@/lib/theme` → `./lib/theme`. */
export const subpathOf = (mod) => aliasOf(mod).replace(/^@\/components\/ui\//, './').replace(/^@\/lib\//, './lib/');

const INDEX = /\/index\.tsx?$/;

/* A folder's index.ts is the folder: the modules of that folder the index reaches (its re-exports and what they
   import, inside the folder) are its implementation, so they get no entry of their own and the folder's entry is their
   one import path (`@brett_lamy/ui/composer`, never `@brett_lamy/ui/composer/composer`). A module of the folder the
   index doesn't reach is a separate half with its own entry (`lib/ffmpeg/react` beside `lib/ffmpeg`). */
const folderCache = new WeakMap();
function folderIndexes(graph) {
  if (folderCache.has(graph)) return folderCache.get(graph);
  const coveredBy = new Map(); // module -> the index module whose entry carries it
  for (const index of graph.modules.filter((m) => INDEX.test(m))) {
    const dir = index.replace(INDEX, '/');
    const seen = new Set([index]);
    const queue = [index];
    while (queue.length) {
      const mod = queue.pop();
      for (const spec of importsOf(`${SRC}/${mod}`)) {
        const target = resolveModule(mod, spec, graph.all);
        if (target && target.startsWith(dir) && !seen.has(target)) { seen.add(target); queue.push(target); }
      }
    }
    for (const mod of seen) if (mod !== index) coveredBy.set(mod, index);
  }
  folderCache.set(graph, coveredBy);
  return coveredBy;
}

/* A module published on a hand-written entry instead of one of its own, so each of its names has one import path:
   CloudflareDiagram is on `@brett_lamy/ui/cloudflare` with the catalog (`src/cloudflare.ts` re-exports all of it). */
export const HAND_ENTRY = { 'components/cloudflare-diagram.tsx': './cloudflare' };

/** The library whose entry carries `mod` in place of an entry of its own: the one with the module's own subpath. */
export function carriedBy(mod) {
  const lib = LIBRARY_KEYS.get(subpathOf(mod));
  if (!lib) return undefined;
  if (libraryOf(mod).id !== lib.id) throw new Error(`package-exports: the library "${lib.id}" takes the entry ${subpathOf(mod)}, but ${mod} belongs to "${libraryOf(mod).id}"`);
  return lib;
}

const publicCache = new WeakMap();
/** Every module with a place among the package's entries: its own, or its library's (`carriedBy`). */
function publicModules(graph) {
  if (publicCache.has(graph)) return publicCache.get(graph);
  const covered = folderIndexes(graph);
  const modules = graph.modules.filter((mod) => {
    const item = graph.items.get(graph.owner.get(mod));
    if (!item || (item.kind === 'lib' && !item.manifest)) return false;
    // A `.generated` module is the data a sibling reads (the Google Fonts table, the tokens): its sibling is the API.
    if (covered.has(mod) || isInternalModule(mod) || HAND_ENTRY[mod] || /\.generated\.tsx?$/.test(mod)) return false;
    return moduleExports(`${SRC}/${mod}`).values.size > 0;
  });
  publicCache.set(graph, modules);
  return modules;
}

const modulesCache = new WeakMap();
/** The modules that get an entry point of their own, relative to packages/ui/src. */
export function packageModules(graph) {
  if (modulesCache.has(graph)) return modulesCache.get(graph);
  const modules = publicModules(graph).filter((mod) => !carriedBy(mod));
  modulesCache.set(graph, modules);
  return modules;
}

/** The modules a library's entry re-exports: each of its modules with an entry of its own, and the one it carries. */
export function libraryModules(graph, lib) {
  return publicModules(graph).filter((mod) => libraryOf(mod).id === lib.id).sort();
}

/** The generated library entries: path under packages/ui/src → content. */
export function libraryEntries(graph) {
  return ENTRY_LIBRARIES.map((lib) => {
    const modules = libraryModules(graph, lib);
    if (!modules.length) throw new Error(`package-exports: the library "${lib.id}" has an entry but no module with one`);
    const lines = modules.map((mod) => `export * from '../${mod.replace(/\.tsx?$/, '').replace(/\/index$/, '')}';`);
    const also = (lib.alsoAt ?? []).map((e) => `\`@brett_lamy/ui/${e}\``).join(', ');
    return [
      `libraries/${lib.entry}.ts`,
      `// Generated by tools/registry/build.mjs from apps/docs/src/site/libraries.ts. Do not edit.\n` +
        `// The ${lib.name} library, \`@brett_lamy/ui/${lib.entry}\`: ${lib.tagline}\n` +
        (also ? `// Also part of it, on an entry of its own: ${also}.\n` : '') +
        `${lines.join('\n')}\n`,
    ];
  });
}

const libraryExports = () =>
  ENTRY_LIBRARIES.map((lib) => [
    `./${lib.entry}`,
    { '@org/source': `./src/libraries/${lib.entry}.ts`, types: `./dist/libraries/${lib.entry}.d.ts`, default: `./dist/libraries/${lib.entry}.js` },
  ]);

/** The module whose entry carries `name` of `mod`: `mod` itself when it has an entry, else the index of its folder
 *  when that index exports the name; null when the name is only on the package root. */
export function entryModuleOf(graph, mod, name) {
  if (publicModules(graph).includes(mod)) return mod;
  const index = folderIndexes(graph).get(mod);
  if (!index) return null;
  const ex = moduleExports(`${SRC}/${index}`);
  return name === undefined || ex.values.has(name) || ex.types.has(name) ? index : null;
}

/** `import { … } from '<this>'` for a name of a module on npm: its entry's subpath, or the package root when it has none. */
export function npmSpecifier(graph, mod, name) {
  if (HAND_ENTRY[mod]) return `@brett_lamy/ui${HAND_ENTRY[mod].slice(1)}`;
  const entry = entryModuleOf(graph, mod, name);
  // A carried module's subpath is its library's entry, so the same spelling serves both.
  return entry ? `@brett_lamy/ui${subpathOf(entry).slice(1)}` : '@brett_lamy/ui';
}

/* The entries docstream and docstream-editor published at 2.0.1 (their package.json `exports`), each subpath → its file
   under src/<part>/. The three marked "+" are the library's own additions since: the xstate fence's machine (the one
   entry that loads the optional xstate peer), the capnp fence, and the Strudel rack with its parser (acorn), split off
   `./strudel` so the player's entry doesn't load it. Add an entry here, never by hand in package.json. */
export const FOLDED = {
  docstream: {
    '.': 'index.ts',
    './gitbook': 'gitbook/index.ts',
    './properties': 'docs/DocumentProperties.tsx',
    './properties/styles.css': 'docs/properties.css',
    './tasks': 'docs/TaskCheckbox.tsx',
    './tasks/styles.css': 'docs/tasks.css',
    './streamdown': 'streamdown.tsx',
    './reference': 'docs/reference.tsx',
    './assets': 'assets.ts',
    './openapi': 'openapi/OpenApiOperation.tsx',
    './replay': 'replay/index.ts',
    './replay/demo': 'replay/demo/index.ts',
    './video': 'video/index.ts',
    './stl': 'stl/index.ts',
    './strudel': 'strudel/index.ts',
    './strudel/rack': 'strudel/rack.ts', // +
    './tui': 'tui/index.ts',
    './viz': 'viz/index.ts',
    './playground': 'playground/index.ts',
    './source': 'source/index.ts',
    './demo': 'demo/index.ts',
    './vite': 'vite/index.ts',
    './site': 'site/index.ts',
    './site/styles.css': 'site/site.css',
    './styles.css': 'styles.css',
    './xstate': 'xstate/index.ts',
    './xstate/machine': 'xstate/machine.ts', // +
    './capnp': 'capnp/index.ts', // +
    './tscircuit': 'tscircuit/index.ts',
  },
  'docstream-editor': {
    '.': 'index.ts',
    './editor': 'editor/Editor.tsx',
    './convert': 'editor/convert.ts',
    './styles.css': 'styles.css',
  },
};

/** The `exports` entries of docstream and docstream-editor, in FOLDED's order. */
export function foldedExports() {
  return Object.entries(FOLDED).flatMap(([part, entries]) =>
    Object.entries(entries).map(([sub, file]) => {
      const key = sub === '.' ? `./${part}` : `./${part}/${sub.slice(2)}`;
      const source = `./src/${part}/${file}`;
      if (!existsSync(`${ROOT}/${SRC}/${part}/${file}`)) throw new Error(`package-exports: ${key} → ${source}, which doesn't exist`);
      if (file.endsWith('.css')) return [key, { '@org/source': source, default: `./dist/${part}/${file}` }];
      const dist = `./dist/${part}/${file.replace(/\.tsx?$/, '')}`;
      return [key, { '@org/source': source, source, types: `${dist}.d.ts`, import: `${dist}.js`, default: `${dist}.js` }];
    }),
  );
}

/** Whether a package.json `exports` key is docstream's or the editor's. */
export const isFoldedKey = (key) => /^\.\/docstream(-editor)?(\/|$)/.test(key);

/** packages/ui/package.json with its generated `exports` entries brought up to date. */
export function withPackageExports(pkg, graph) {
  const kept = Object.entries(pkg.exports).filter(([key, entry]) => {
    if (isFoldedKey(key) || isSdkKey(key) || isLibraryKey(key)) return false;
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
  const imports = sdkImports();
  const { imports: _was, exports: _exports, ...rest } = pkg;
  // `imports` sits right before `exports`, wherever `exports` was.
  const out = {};
  for (const [field, value] of Object.entries(pkg)) {
    if (field === 'imports') continue;
    if (field === 'exports') {
      if (Object.keys(imports).length) out.imports = imports;
      out.exports = Object.fromEntries([...kept, ...libraryExports(), ...generated, ...foldedExports(), ...sdkExports()]);
    } else out[field] = rest[field];
  }
  return out;
}
