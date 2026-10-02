/* The core library as a graph of registry items.
 *
 * Every module under packages/ui/src/{components,lib} belongs to exactly one item:
 *   - a `registry/components/<name>.json` manifest groups modules (`files`, relative to packages/ui/src), else it
 *     names the module of the same name (components/<name>.tsx, components/<name>/**, lib/<name>.ts(x));
 *   - every other module is its own item, named after the file (or the folder it sits in).
 * An item's dependencies are computed from real imports, never listed by hand:
 *   - `@/components/ui/<x>` and `@/lib/<x>` (and the relative equivalents) → registryDependencies on the item that owns the file;
 *   - any other bare specifier → an npm dependency, versioned from packages/ui/package.json or the workspace root.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const SRC = 'packages/ui/src';
const abs = (p) => join(ROOT, p);
const readJson = (p) => JSON.parse(readFileSync(abs(p), 'utf8'));

const SKIP_FILE = /\.(stories|test|spec)\.tsx?$/;
const MODULE = /\.tsx?$/;
const walk = (dir, out = [], keep = (name) => MODULE.test(name) && !SKIP_FILE.test(name) && !name.endsWith('.d.ts')) => {
  for (const name of readdirSync(abs(dir))) {
    const p = posix.join(dir, name);
    if (statSync(abs(p)).isDirectory()) walk(p, out, keep);
    else if (keep(name)) out.push(p);
  }
  return out;
};

/** Every library module, as paths relative to packages/ui/src. */
export function listModules() {
  return [...walk(`${SRC}/components`), ...walk(`${SRC}/lib`)].map((p) => posix.relative(SRC, p)).sort();
}

/** Non-code files (JSON, LICENSE, …) that sit inside a module folder (`lib/<dir>/…`, `components/<dir>/…`), relative to packages/ui/src.
 *  Stylesheets are the framework's and not assets. */
function listAssets() {
  const keep = (name) => !MODULE.test(name) && !/\.css$/.test(name) && !name.startsWith('.');
  return ['components', 'lib']
    .flatMap((root) => readdirSync(abs(`${SRC}/${root}`), { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) => walk(`${SRC}/${root}/${d.name}`, [], keep)))
    .map((p) => posix.relative(SRC, p))
    .sort();
}

const pkgVersions = (() => {
  const ui = readJson('packages/ui/package.json');
  const root = readJson('package.json');
  // The workspace root pins concrete versions for what the blocks and the library share; the ui package's ranges fill in the rest.
  // The ui package's optional peers (the PGlite engine) are installed as ordinary dependencies by a registry item, at the peer range.
  return { ...ui.peerDependencies, ...ui.dependencies, ...root.devDependencies, ...root.dependencies };
})();
export const npmVersion = (name) => pkgVersions[name];

/** Real import specifiers of a file (TypeScript's scanner, so strings in sample data don't count). */
export function importsOf(path) {
  return ts.preProcessFile(readFileSync(abs(path), 'utf8'), true, true).importedFiles.map((i) => i.fileName);
}

/** Exported names of a module, split into values and types. */
export function moduleExports(path) {
  const sf = ts.createSourceFile(path, readFileSync(abs(path), 'utf8'), ts.ScriptTarget.Latest, true);
  const values = new Set();
  const types = new Set();
  const exported = (n) => n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  sf.forEachChild((n) => {
    if (ts.isVariableStatement(n) && exported(n)) {
      for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name)) values.add(d.name.text);
    } else if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n) || ts.isEnumDeclaration(n)) && exported(n) && n.name) values.add(n.name.text);
    else if ((ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) && exported(n)) types.add(n.name.text);
    else if (ts.isExportDeclaration(n) && n.exportClause && ts.isNamedExports(n.exportClause)) {
      for (const e of n.exportClause.elements) (n.isTypeOnly || e.isTypeOnly ? types : values).add(e.name.text);
    } else if (ts.isExportDeclaration(n) && !n.exportClause) values.add('*:' + (n.moduleSpecifier?.text ?? ''));
  });
  return { values, types };
}

const RESOLVE_EXT = ['.tsx', '.ts', '/index.tsx', '/index.ts'];
/** A library module (relative to packages/ui/src) for an import specifier seen in `fromRel`, or null. */
export function resolveModule(fromRel, spec, all) {
  let target;
  if (spec.startsWith('@/components/ui/')) target = 'components/' + spec.slice('@/components/ui/'.length);
  else if (spec.startsWith('@/lib/')) target = 'lib/' + spec.slice('@/lib/'.length);
  else if (spec.startsWith('.')) target = posix.normalize(posix.join(posix.dirname(fromRel), spec));
  else return null;
  for (const e of ['', ...RESOLVE_EXT]) if (all.has(target + e)) return target + e;
  return null;
}

const itemNameOf = (rel) => {
  const parts = rel.split('/');
  const base = parts[parts.length - 1].replace(/\.(tsx?)$/, '').replace(/\.generated$/, '');
  // components/<dir>/** and lib/<dir>/** are one item named after the folder
  return parts.length > 2 ? parts[1] : base;
};

/** Component manifests (docs metadata + optional grouping), keyed by item name. */
export function loadManifests() {
  const dir = 'registry/components';
  return Object.fromEntries(
    readdirSync(abs(dir))
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => [f.replace(/\.json$/, ''), readJson(`${dir}/${f}`)]),
  );
}

export function buildGraph({ errors = [] } = {}) {
  const modules = listModules();
  const all = new Set(modules);
  const manifests = loadManifests();
  const owner = new Map(); // module -> item name
  const itemFiles = new Map(); // item -> modules[]
  const claim = (item, file) => {
    if (owner.has(file) && owner.get(file) !== item) errors.push(`${file} is claimed by both "${owner.get(file)}" and "${item}"`);
    owner.set(file, item);
    itemFiles.set(item, [...(itemFiles.get(item) ?? []), file]);
  };
  // 1. grouped by manifest
  for (const [name, m] of Object.entries(manifests)) {
    const files =
      m.files ??
      modules.filter((f) => f === `components/${name}.tsx` || f.startsWith(`components/${name}/`) || f === `lib/${name}.ts` || f === `lib/${name}.tsx`);
    if (!files.length) errors.push(`registry/components/${name}.json: no module found (set "files")`);
    for (const f of files) {
      if (!all.has(f)) errors.push(`registry/components/${name}.json: ${f} is not a module`);
      else claim(name, f);
    }
  }
  // 2. everything else is its own item
  for (const f of modules) {
    if (owner.has(f)) continue;
    const name = itemNameOf(f);
    if (manifests[name] && !itemFiles.get(name)?.length) continue;
    claim(name, f);
  }
  // 3. assets (a JSON weights file, a LICENSE) sitting in a folder with modules install with the item that owns them
  for (const asset of listAssets()) {
    const sibling = modules.find((m) => posix.dirname(m) === posix.dirname(asset) && owner.has(m));
    if (sibling) claim(owner.get(sibling), asset);
  }
  const items = new Map();
  for (const [name, files] of itemFiles) {
    const kind = files.every((f) => f.startsWith('lib/')) ? 'lib' : 'ui';
    if (kind === 'ui' && files.some((f) => f.startsWith('lib/'))) errors.push(`item "${name}" mixes components/ and lib/ modules`);
    const deps = new Set();
    const npm = new Map();
    for (const f of files) {
      if (!MODULE.test(f)) continue; // assets have no imports
      for (const spec of importsOf(`${SRC}/${f}`)) {
        const target = resolveModule(f, spec, all);
        if (target) {
          const dep = owner.get(target);
          if (dep && dep !== name) deps.add(dep);
        } else if (spec.startsWith('.') || spec.startsWith('@/')) {
          if (!/\.(css|json)$/.test(spec)) errors.push(`${SRC}/${f}: cannot resolve "${spec}"`);
        } else if (!(spec === 'react' || spec.startsWith('react/') || spec === 'react-dom' || spec.startsWith('react-dom/'))) {
          const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
          if (pkg === '@brett_lamy/ui') errors.push(`${SRC}/${f}: the library must not import itself ("${spec}")`);
          else npm.set(pkg, npmVersion(pkg));
        }
      }
    }
    items.set(name, { name, kind, files: files.sort(), deps: [...deps].sort(), npm: [...npm.entries()].sort(), manifest: manifests[name] });
  }
  return { items, owner, modules, all, manifests };
}

/** The item that owns a library module, and the alias path a consumer imports it by. */
export const aliasOf = (rel) =>
  rel.startsWith('components/') ? '@/components/ui/' + rel.slice('components/'.length).replace(/\.tsx?$/, '') : '@/lib/' + rel.slice('lib/'.length).replace(/\.tsx?$/, '');

export { abs, readJson, relative };
