/* One import path per name: every name the package exports comes from exactly one of its subpath entries.
 *
 * The aggregates are left out: `.` (the root barrel) and docstream's two package roots (`./docstream`,
 * `./docstream-editor`) gather what their entries export, as a package's main entry does. Every other entry is
 * walked to the declarations its names come from (`export … from`, `export *`, re-exported imports, through the
 * workspace's `@/` aliases and the package's own `@brett_lamy/ui/…` entries), and a name is reported when two
 * entries export it: the same declaration twice is a second import path for it, two declarations under one name
 * are two things a reader can't tell apart by the name.
 *
 * Allowed, and only these (SHARED): the documented re-exports of CONVENTIONS rules 15 and 16, and docstream's own
 * entries among themselves (the shape `@brett_lamy/docstream` 2.0.1 published, kept as it was: FOLDED in
 * package-exports.mjs). tools/registry/build.mjs runs this and fails on what it reports. */
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import ts from 'typescript';
import { ROOT, SRC } from './graph.mjs';

const AGGREGATES = new Set(['.', './docstream', './docstream-editor']);
const isDocstream = (key) => /^\.\/docstream(-editor)?\//.test(key);

/** What each Docstream widget's kit module (rule 16) and MarkdownView may re-export from docstream: a fixed list, so a
 *  shim's re-export list never widens without this table changing too. MarkdownView's are types only. */
export const SHIM_NAMES = {
  './replay-preview': [
    'ReplayPreview', 'ReplayPreviewProps', 'ReplayPreviewHandle', 'ReplayChrome', 'ReplayDevtools', 'ReplayDevtoolsTab', 'ReplayEvent',
    'ReplayInspection', 'ReplayInspectionTab', 'ReplayMarker', 'ReplayMarkerKind', 'ReplaySource',
  ],
  './tui-preview': ['TuiPreview', 'TuiPreviewProps', 'TuiPreviewOptions', 'TuiPreviewState', 'TuiAppearance', 'TuiTheme'],
  './stl-viewer': ['StlViewer', 'StlViewerProps'],
  './strudel-player': [
    'StrudelPlayer', 'StrudelPlayerProps', 'StrudelCodeChangeDetails', 'StrudelPanelChangeReason', 'StrudelSnapshot',
    'getStrudelSnapshot', 'playStrudel', 'stopStrudel', 'subscribeStrudel', 'updateStrudel',
  ],
  './markdown-view': ['CodeBlockNode', 'CodeBlockRenderDetails', 'ReferenceNode'],
};
const TYPES_ONLY = new Set(['./markdown-view']);
const SURFACE = `${SRC}/lib/surface.ts`;

/** Entries allowed to share a name, each with the rule that says so. A set of entries passes when one rule covers
 *  all of them (`name`; `ids`: the declarations behind it; `type`: the name is a type, declared once). */
export const SHARED = [
  {
    why: 'a component re-exports the types its props take from its own model (`./data-table` with `./lib/data-table-model`): types only, declared once',
    covers: (keys, { type }) => type && keys.length === 2 && keys.some((k) => keys.some((m) => m !== k && m.startsWith(`./lib/${k.slice(2)}-`))),
  },
  {
    why: "rule 16: a Docstream widget's kit module re-exports the widget from docstream's entry, the names in SHIM_NAMES only; MarkdownView re-exports the docstream types its props take",
    covers: (keys, { name, type }) => {
      const kit = keys.filter((k) => !isDocstream(k));
      return kit.length === 1 && !!SHIM_NAMES[kit[0]]?.includes(name) && (type || !TYPES_ONLY.has(kit[0]));
    },
  },
  {
    why: 'rule 15: the surface recipes live in lib/surface, re-exported by dialog and sheet: one declaration, in lib/surface.ts',
    covers: (keys, { ids }) =>
      keys.includes('./lib/surface') && keys.every((k) => ['./lib/surface', './dialog', './sheet'].includes(k)) &&
      ids.size === 1 && [...ids][0].startsWith(`${SURFACE}#`),
  },
  {
    why: "docstream's entries among themselves: the 2.0.1 package's shape, kept as it was published",
    covers: (keys) => keys.every(isDocstream),
  },
];

const EXT = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
const resolveFile = (base) => EXT.map((e) => base + e).find((p) => existsSync(join(ROOT, p)) && /\.tsx?$/.test(p));

/** Every name the package's subpath entries export, with the entries that export it, and the declarations
 *  (`file#name`, or `package#name` for an outside package) behind it. */
export function entryNames(exportsMap) {
  const self = new Map(); // '@brett_lamy/ui/<sub>' → source file
  for (const [key, entry] of Object.entries(exportsMap)) {
    const source = typeof entry === 'object' ? entry['@org/source'] : undefined;
    if (source && /\.tsx?$/.test(source)) self.set(`@brett_lamy/ui${key.slice(1)}`, posix.join('packages/ui', source));
  }
  const resolve = (from, spec) => {
    if (spec.startsWith('.')) return resolveFile(posix.join(posix.dirname(from), spec));
    if (spec.startsWith('@/components/ui/')) return resolveFile(`${SRC}/components/${spec.slice('@/components/ui/'.length)}`);
    if (spec.startsWith('@/lib/')) return resolveFile(`${SRC}/lib/${spec.slice('@/lib/'.length)}`);
    if (spec === '@brett_lamy/ui' || spec.startsWith('@brett_lamy/ui/')) return self.get(spec) ?? null;
    return null;
  };

  const parsed = new Map();
  const parse = (file) => {
    if (parsed.has(file)) return parsed.get(file);
    const sf = ts.createSourceFile(file, readFileSync(join(ROOT, file), 'utf8'), ts.ScriptTarget.Latest, true);
    const imports = new Map(); // local → { spec, name }
    const named = new Map(); // exported name → { spec?, name } (spec undefined: a local or an import)
    const stars = [];
    const types = new Set(); // interfaces and type aliases declared in the file
    const exported = (n) => n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    sf.forEachChild((n) => {
      if ((ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) && n.name) types.add(n.name.text);
      if (ts.isImportDeclaration(n) && n.importClause && ts.isStringLiteral(n.moduleSpecifier)) {
        const spec = n.moduleSpecifier.text;
        const b = n.importClause.namedBindings;
        const typeOnly = n.importClause.isTypeOnly;
        if (n.importClause.name) imports.set(n.importClause.name.text, { spec, name: 'default' });
        if (b && ts.isNamedImports(b)) for (const e of b.elements) imports.set(e.name.text, { spec, name: (e.propertyName ?? e.name).text, typeOnly: typeOnly || e.isTypeOnly });
        if (b && ts.isNamespaceImport(b)) imports.set(b.name.text, { spec, name: '*' });
      } else if (ts.isExportDeclaration(n)) {
        const spec = n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) ? n.moduleSpecifier.text : undefined;
        if (!n.exportClause) stars.push(spec);
        else if (ts.isNamedExports(n.exportClause)) for (const e of n.exportClause.elements) named.set(e.name.text, { spec, name: (e.propertyName ?? e.name).text, typeOnly: n.isTypeOnly || e.isTypeOnly });
        else named.set(n.exportClause.name.text, { local: true });
      } else if (exported(n)) {
        if (ts.isVariableStatement(n)) { for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name)) named.set(d.name.text, { local: true }); }
        else if (n.name && ts.isIdentifier(n.name) && !n.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) named.set(n.name.text, { local: true });
      }
    });
    const out = { imports, named, stars, types };
    parsed.set(file, out);
    return out;
  };

  const memo = new Map();
  const typeIds = new Set(); // declarations that are types: an interface or type alias here, or an outside package's name re-exported as a type
  /** name → declaration id, for everything `file` exports. */
  const exportsOf = (file, seen = new Set()) => {
    if (memo.has(file)) return memo.get(file);
    if (seen.has(file)) return new Map();
    seen.add(file);
    const { imports, named, stars, types } = parse(file);
    const out = new Map();
    const origin = (spec, name, typeOnly) => {
      const target = resolve(file, spec);
      const id = target ? exportsOf(target, seen).get(name) ?? `${target}#${name}` : `${spec}#${name}`;
      if (typeOnly && !target) typeIds.add(id);
      return id;
    };
    for (const spec of stars) {
      const target = resolve(file, spec);
      if (target) for (const [n, id] of exportsOf(target, seen)) if (n !== 'default') out.set(n, id);
    }
    for (const [name, ref] of named) {
      if (ref.local || (ref.spec === undefined && !imports.has(ref.name))) {
        const local = ref.local ? name : ref.name;
        if (types.has(local)) typeIds.add(`${file}#${local}`);
        out.set(name, `${file}#${local}`);
      } else if (ref.spec !== undefined) out.set(name, origin(ref.spec, ref.name, ref.typeOnly));
      else {
        const imp = imports.get(ref.name);
        out.set(name, origin(imp.spec, imp.name, ref.typeOnly || imp.typeOnly));
      }
    }
    memo.set(file, out);
    return out;
  };

  const names = new Map(); // name → { entries: Set, ids: Set, type }
  for (const [key, entry] of Object.entries(exportsMap)) {
    if (AGGREGATES.has(key)) continue;
    const source = typeof entry === 'object' ? entry['@org/source'] : undefined;
    if (!source || !/\.tsx?$/.test(source)) continue;
    for (const [name, id] of exportsOf(posix.join('packages/ui', source))) {
      if (name === 'default') continue;
      const at = names.get(name) ?? { entries: new Set(), ids: new Set(), type: true };
      at.entries.add(key);
      at.ids.add(id);
      names.set(name, at);
    }
  }
  for (const at of names.values()) at.type = at.ids.size === 1 && typeIds.has([...at.ids][0]);
  return names;
}

/** The names on more than one entry that no SHARED rule allows, as error lines. */
export function onePathErrors(exportsMap) {
  const errors = [];
  for (const [name, { entries, ids, type }] of entryNames(exportsMap)) {
    if (entries.size < 2) continue;
    const keys = [...entries].sort();
    if (SHARED.some((rule) => rule.covers(keys, { name, ids, type }))) continue;
    const what = ids.size > 1 ? `${ids.size} different declarations under one name` : 'one declaration on two import paths';
    errors.push(`"${name}" is exported by ${keys.join(', ')} (${what}): a name has one entry (CONVENTIONS, "The package surface")`);
  }
  return errors.sort();
}

