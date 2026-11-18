#!/usr/bin/env node
/* Writes each component page's `## Installation` section into apps/docs/pages/<page>.md as plain docstream
 * Markdown from the page's registry entry (registry/components/<name>.json, `page` field): a titled tab set — the
 * "Installation" heading with the npm | shadcn CLI switch on its right — whose tabs each hold a `{% command %}` box
 * (docstream derives the pnpm / yarn / bun forms), a line of prose and the import code. The npm tab imports each
 * module from its own package entry (`@brett_lamy/ui/dialog`, tools/registry/package-exports.mjs) and names the
 * library's entry that has the same names (`@brett_lamy/ui/time` on Calendar's page); the root import
 * (`@brett_lamy/ui`) is shown once, on the Installation page. The shadcn tab says what `add` installs from npm:
 * `@brett_lamy/ui`, for UI SDK and Docstream, which the registry does not copy.
 *
 *   node tools/docs/install-md.mjs           → rewrite the sections in place
 *   node tools/docs/install-md.mjs --check   → exit 1 if any page's section is stale (pages-md runs this)
 *
 * The section is the one `{% tabs title="Installation" %}` set; everything else in the page is left alone. A page without one gets it after its lead (the H1 and the paragraph under it). */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SRC, aliasOf, buildGraph, importsOf, isDocstreamSpecifier, isUpstreamSdkSpecifier, moduleExports } from '../registry/graph.mjs';
import { entryModuleOf, libraryOf, npmSpecifier } from '../registry/package-exports.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PAGES = join(ROOT, 'apps/docs/pages');
const COMPONENTS = join(ROOT, 'registry/components');
const REGISTRY_URL = 'https://blamy.github.io/ui/r';
const check = process.argv.includes('--check');

/** The names a page's import line shows: the entry's `imports`, else its first few components. */
function importNames(entry, max = 4) {
  if (entry.imports?.length) return entry.imports;
  const parts = entry.exports.filter((e) => /^[A-Z][a-z]/.test(e));
  return (parts.length ? parts : entry.exports).slice(0, max);
}

/** `import { … } from '…'`, on one line when it fits, else packed onto indented lines. */
function importLine(names, from) {
  const one = `import { ${names.join(', ')} } from '${from}'`;
  if (one.length <= 72) return one;
  const lines = [];
  let cur = '';
  for (const n of names) {
    if (cur && `${cur} ${n},`.length > 64) { lines.push(cur); cur = ''; }
    cur += (cur ? ' ' : '') + n + ',';
  }
  lines.push(cur);
  return `import {\n${lines.map((l) => '  ' + l).join('\n')}\n} from '${from}'`;
}

/** One npm / npx command: docstream derives the pnpm / yarn / bun forms (pnpm first) and syncs the reader's choice
 *  across the site (key `pm`). */
const command = (cmd) => `{% command %}${cmd}{% endcommand %}`;

/** The import snippet: an untitled block (no header bar, floating copy) without line numbers. */
const IMPORT_FENCE = '```tsx';

// Which module defines each exported name, and which registry item owns each module (tools/registry/graph.mjs).
const graph = buildGraph({ errors: [] });
const definedIn = new Map();
for (const mod of graph.modules) {
  const ex = moduleExports(`${SRC}/${mod}`);
  for (const v of [...ex.values, ...ex.types]) if (!definedIn.has(v)) definedIn.set(v, mod);
}

/** The package's other stylesheets an item asks the app for (its manifest's `css` imports of `@brett_lamy/ui/…`), minus
 *  the ones `@brett_lamy/ui/styles.css` already carries: docstream's own sheet, for the parts that render docstream. */
const KIT_SHEET = readFileSync(join(ROOT, 'packages/ui/src/styles.css'), 'utf8');
function ownSheets(entry) {
  return Object.keys(entry.css ?? {})
    .map((key) => /^@import\s+["'](@brett_lamy\/ui\/[^"']+)["']/.exec(key)?.[1])
    .filter((sheet) => sheet && !KIT_SHEET.includes(`"./${sheet.slice('@brett_lamy/ui/'.length)}"`));
}

/** A rule-16 widget module (CONVENTIONS): nothing in it but `export … from '@brett_lamy/ui/docstream/…'` lines. */
function isDocstreamShim(file) {
  const code = readFileSync(join(ROOT, SRC, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*['"]use client['"];?\s*$/m, '');
  const statements = code.split(';').map((s) => s.trim()).filter(Boolean);
  return statements.length > 0 && statements.every((s) => /^export\s+(type\s+)?\{[^}]*\}\s+from\s+['"]@brett_lamy\/ui\/docstream[^'"]*['"]$/.test(s));
}

/** What `shadcn add <item>` takes from the npm package instead of copying: UI SDK (`sdk`) and Docstream (`docstream`),
 *  looked for in the item's own files and in those of every item it brings with it. */
function fromPackage(name, seen = new Set(), found = new Set()) {
  if (seen.has(name)) return found;
  seen.add(name);
  const item = graph.items.get(name);
  for (const file of item?.files ?? []) {
    for (const spec of importsOf(`${SRC}/${file}`)) {
      if (isUpstreamSdkSpecifier(spec)) found.add('sdk');
      else if (isDocstreamSpecifier(spec)) found.add('docstream');
    }
  }
  for (const dep of item?.deps ?? []) fromPackage(dep, seen, found);
  return found;
}

/** The shadcn tab's line of prose: what the CLI writes and installs. UI SDK and Docstream aren't copied: an item that
 *  uses either (itself, or through a part it is built from) installs `@brett_lamy/ui`, and the copied files import
 *  them by the package's name. A widget's one-module re-export of Docstream has nothing of its own to edit. */
function cliProse(name, where) {
  const item = graph.items.get(name);
  const uses = fromPackage(name);
  if (!uses.size) {
    return `Copies the source into your project's ${where} (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:`;
  }
  if (item.files.length === 1 && isDocstreamShim(item.files[0])) {
    return `Adds one module to your project's ${where} and installs \`@brett_lamy/ui\`, whose Docstream it imports by the package's name. The module only re-exports the widget, so there is nothing in it to edit; it gives the widget your alias. Import from your alias:`;
  }
  const what = uses.has('sdk') && uses.has('docstream')
    ? 'for UI SDK and Docstream, which the copied files import by the package\'s name (`@brett_lamy/ui/sdk/…`, `@brett_lamy/ui/docstream/…`)'
    : uses.has('sdk')
      ? 'for UI SDK, which the copied files import by the package\'s name (`@brett_lamy/ui/sdk/…`)'
      : 'for Docstream, which it imports by the package\'s name';
  return `Copies the source into your project's ${where} (with the parts it is built from), adds BL UI's tokens to your CSS and installs \`@brett_lamy/ui\` ${what}. The copied source is yours to edit. Import from your alias:`;
}

/** The library entry that exports every shown name too (`@brett_lamy/ui/time` for Calendar's parts), when there is one
 *  and it is another path than the import line's: a library named after its main module is that line already. */
function libraryEntry(byModule) {
  const libs = new Set();
  for (const [mod, names] of byModule) {
    for (const n of names) {
      const entry = entryModuleOf(graph, mod, n);
      if (!entry) return null; // a name without an entry of its own is on the root only
      libs.add(libraryOf(entry));
    }
  }
  if (libs.size !== 1) return null;
  const [lib] = libs;
  if (!lib.entry) return null;
  const spec = `@brett_lamy/ui/${lib.entry}`;
  return [...byModule].every(([mod, names]) => names.every((n) => npmSpecifier(graph, mod, n) === spec)) ? null : { name: lib.name, spec };
}

export function installSection(entry) {
  const names = importNames(entry);
  // The shown names may live in several modules (List + IndexBar): one import line per module, one item per owner.
  const byModule = new Map();
  for (const n of names) {
    const mod = definedIn.get(n);
    if (!mod) throw new Error(`install-md: ${entry.name}: nothing exports "${n}"`);
    byModule.set(mod, [...(byModule.get(mod) ?? []), n]);
  }
  const items = [entry.name, ...new Set([...byModule.keys()].map((m) => graph.owner.get(m)))].filter((v, i, a) => a.indexOf(v) === i);
  // npm: each module's own entry point, the registry path under the package name (`@/components/ui/dialog` ↔
  // `@brett_lamy/ui/dialog`); a module without one comes from the root.
  // A module inside a folder with an index.ts is imported by the folder (`@/components/ui/composer`).
  const byEntry = new Map();
  const byAlias = new Map();
  for (const [mod, ns] of byModule) {
    for (const n of ns) {
      const from = npmSpecifier(graph, mod, n);
      byEntry.set(from, [...(byEntry.get(from) ?? []), n]);
      const alias = aliasOf(entryModuleOf(graph, mod, n) ?? mod);
      byAlias.set(alias, [...(byAlias.get(alias) ?? []), n]);
    }
  }
  const files = graph.items.get(entry.name)?.files ?? [];
  const where = files.some((f) => f.startsWith('lib/')) ? '`lib/`' : '`components/ui/`';
  const library = libraryEntry(byModule);
  const fromModule = library ? `then the parts from their module (the ${library.name} library's entry, \`${library.spec}\`, has them too):` : 'then the parts from their module:';
  return [
    '{% tabs title="Installation" sync="install" %}',
    '{% tab title="shadcn CLI" %}',
    command(`npx shadcn@latest add ${items.map((i) => `${REGISTRY_URL}/${i}.json`).join(' ')}`),
    '',
    cliProse(entry.name, where),
    '',
    IMPORT_FENCE,
    [...byAlias.entries()].map(([alias, ns]) => importLine(ns, alias)).join('\n'),
    '```',
    '{% endtab %}',
    '{% tab title="npm" %}',
    command('npm install @brett_lamy/ui'),
    '',
    ownSheets(entry).length
      ? `Import the stylesheets once at your app's entry (the kit's, then docstream's, which this part renders with), ${fromModule}`
      : `Import the stylesheet once at your app's entry, ${fromModule}`,
    '',
    IMPORT_FENCE, `import '@brett_lamy/ui/styles.css'`, ...ownSheets(entry).map((sheet) => `import '${sheet}'`), '', [...byEntry.entries()].map(([from, ns]) => importLine(ns, from)).join('\n'), '```',
    '{% endtab %}',
    '{% endtabs %}',
  ].join('\n');
}

/** [start, end) lines of an existing section: the `{% tabs title="Installation" %}` set, or the pre-1.2 form
 *  (`## Installation`, a blank line, then one nested tab set). */
function sectionRange(lines) {
  let start = lines.findIndex((l) => /^\{% tabs title="Installation"/.test(l));
  let from = start;
  if (start < 0) {
    start = lines.findIndex((l, i) => l === '## Installation' && lines[i + 1] === '' && /^\{% tabs\b/.test(lines[i + 2] ?? ''));
    from = start + 2;
  }
  if (start < 0) return null;
  let depth = 0;
  for (let i = from; i < lines.length; i++) {
    if (/^\{% tabs\b/.test(lines[i])) depth++;
    else if (/^\{% endtabs %\}$/.test(lines[i]) && --depth === 0) return [start, i + 1];
  }
  return null;
}

/** Index just past a page's lead: the H1 and, if one follows, a plain paragraph. */
function leadEnd(lines) {
  let i = lines.findIndex((l) => l.startsWith('# '));
  if (i < 0) return 0;
  i++;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i < lines.length && !/^(```|\||#|\{%|[-*] |\d+\. |>)/.test(lines[i])) {
    while (i < lines.length && lines[i].trim()) i++;
  }
  return i;
}

export function withInstall(md, entry) {
  const section = installSection(entry);
  const lines = md.split('\n');
  const range = sectionRange(lines);
  if (range) return [...lines.slice(0, range[0]), section, ...lines.slice(range[1])].join('\n');
  const i = leadEnd(lines);
  const head = lines.slice(0, i).join('\n').trimEnd();
  const rest = lines.slice(i).join('\n').trim();
  return `${head}\n\n${section}\n${rest ? `\n${rest}\n` : ''}`;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const stale = [];
  for (const f of readdirSync(COMPONENTS).filter((f) => f.endsWith('.json')).sort()) {
    const entry = JSON.parse(readFileSync(join(COMPONENTS, f), 'utf8'));
    if (!entry.page) continue; // a lib item documented on another component's page (filter-model, filter-query, gpu-query)
    // A second item documented on the same page (avatar-group on avatar, filter-input on filter): the page's own item
    // writes its one Installation section.
    if (entry.name !== entry.page && existsSync(join(COMPONENTS, `${entry.page}.json`))) continue;
    const file = join(PAGES, `${entry.page}.md`);
    let md;
    try { md = readFileSync(file, 'utf8'); } catch { console.error(`install-md: ${f} names page "${entry.page}", which has no ${file}`); process.exit(1); }
    const next = withInstall(md, entry);
    if (next === md) continue;
    stale.push(entry.page);
    if (!check) writeFileSync(file, next);
  }
  if (check && stale.length) {
    console.error(`install-md: stale Installation sections in ${stale.join(', ')} — run node tools/docs/install-md.mjs`);
    process.exit(1);
  }
  console.log(`install-md: ${stale.length ? (check ? 'stale' : 'updated') + ' ' + stale.join(', ') : 'up to date'}`);
}
