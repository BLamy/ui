#!/usr/bin/env node
/* Writes each component page's `## Installation` section into apps/docs/pages/<page>.md as plain docstream
 * Markdown from the page's registry entry (registry/components/<name>.json, `page` field): a titled tab set — the
 * "Installation" heading with the npm | shadcn CLI switch on its right — whose tabs each hold a `{% command %}` box
 * (docstream derives the pnpm / yarn / bun forms), a line of prose and the import code.
 *
 *   node tools/docs/install-md.mjs           → rewrite the sections in place
 *   node tools/docs/install-md.mjs --check   → exit 1 if any page's section is stale (pages-md runs this)
 *
 * The section is the one `{% tabs title="Installation" %}` set; everything else in the page is left alone. A page without one gets it after its lead (the H1 and the paragraph under it). */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SRC, aliasOf, buildGraph, moduleExports } from '../registry/graph.mjs';

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
  const files = graph.items.get(entry.name)?.files ?? [];
  const where = files.some((f) => f.startsWith('lib/')) ? '`lib/`' : '`components/ui/`';
  return [
    '{% tabs title="Installation" sync="install" %}',
    '{% tab title="shadcn CLI" %}',
    command(`npx shadcn@latest add ${items.map((i) => `${REGISTRY_URL}/${i}.json`).join(' ')}`),
    '',
    `Copies the source into your project's ${where} (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:`,
    '',
    IMPORT_FENCE,
    [...byModule.entries()].map(([mod, ns]) => importLine(ns, aliasOf(mod))).join('\n'),
    '```',
    '{% endtab %}',
    '{% tab title="npm" %}',
    command('npm install @brett_lamy/ui'),
    '',
    "Import the stylesheet once at your app's entry, then the parts from the package root:",
    '',
    IMPORT_FENCE, `import '@brett_lamy/ui/styles.css'`, '', importLine(names, '@brett_lamy/ui'), '```',
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
