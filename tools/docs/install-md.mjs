#!/usr/bin/env node
/* Writes each component page's `## Installation` section into apps/docs/pages/<page>.md as plain docstream
 * Markdown from the page's registry entry (registry/components/<name>.json, `page` field): GitBook tabs for the npm
 * package and the shadcn CLI, each with synced pnpm / npm / yarn / bun command tabs and the import line.
 *
 *   node tools/docs/install-md.mjs           → rewrite the sections in place
 *   node tools/docs/install-md.mjs --check   → exit 1 if any page's section is stale (pages-md runs this)
 *
 * The section is `## Installation`, a blank line, then one (nested) `{% tabs %}` set; everything else in the page is
 * left alone. A page without one gets it after its lead (the H1 and the paragraph under it). */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/* The site default is pnpm (first tab); `sync="pm"` keeps the reader's choice across every command on the site. */
const PMS = [
  ['pnpm', (p) => `pnpm add ${p}`, (c) => `pnpm dlx ${c}`],
  ['npm', (p) => `npm install ${p}`, (c) => `npx ${c}`],
  ['yarn', (p) => `yarn add ${p}`, (c) => `yarn dlx ${c}`],
  ['bun', (p) => `bun add ${p}`, (c) => `bunx --bun ${c}`],
];

/** One command per package manager — tabs whose bodies are single code blocks render as one command block. */
const commandTabs = (cmd) => [
  '{% tabs sync="pm" %}',
  ...PMS.flatMap(([pm, add, dlx]) => [`{% tab title="${pm}" %}`, '```sh', cmd(add, dlx), '```', '{% endtab %}']),
  '{% endtabs %}',
];

export function installSection(entry) {
  const from = entry.from || '@brett_lamy/ui';
  const names = importNames(entry);
  const pkgs = [...new Set(['@brett_lamy/ui', from])].join(' ');
  return [
    '## Installation',
    '',
    '{% tabs sync="install" %}',
    '{% tab title="npm" %}',
    ...commandTabs((add) => add(pkgs)),
    '',
    "Import the stylesheet once at your app's entry, then the parts from the package root:",
    '',
    '```tsx', `import '@brett_lamy/ui/styles.css'`, '', importLine(names, from), '```',
    '{% endtab %}',
    '{% tab title="shadcn CLI" %}',
    ...commandTabs((_, dlx) => dlx(`shadcn@latest add ${REGISTRY_URL}/${entry.name}.json`)),
    '',
    `Adds \`@/components/ui/${entry.name}.tsx\`, installs \`@brett_lamy/ui\`, and wires its stylesheet and tokens into your CSS. Import from your alias:`,
    '',
    '```tsx', importLine(names, `@/components/ui/${entry.name}`), '```',
    '{% endtab %}',
    '{% endtabs %}',
  ].join('\n');
}

/** [start, end) lines of an existing section: `## Installation`, a blank line, then one (nested) tab set. */
function sectionRange(lines) {
  const start = lines.findIndex((l, i) => l === '## Installation' && lines[i + 1] === '' && /^\{% tabs\b/.test(lines[i + 2] ?? ''));
  if (start < 0) return null;
  let depth = 0;
  for (let i = start + 2; i < lines.length; i++) {
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
