#!/usr/bin/env node
/* Makes cva a first-class citizen of the docs: every recipe in the library (`export const xVariants = cva(…)`) is read
 * with the TypeScript AST and written out as a table, so the docs can't drift from the code.
 *
 *   node tools/docs/variants-md.mjs           → rewrite apps/docs/pages/variants.md and each page's `## cva recipes` section
 *   node tools/docs/variants-md.mjs --check   → exit 1 if anything is stale (pages-md runs this)
 *
 * - apps/docs/pages/variants.md    the reference: every recipe, grouped by registry item.
 * - `## cva recipes` on a page     the recipes defined by the page's registry item (registry/components/<name>.json `page`),
 *                                  as the last section of the page. Pages whose item has no recipe are left alone.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { SRC, aliasOf, buildGraph } from '../registry/graph.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PAGES = join(ROOT, 'apps/docs/pages');
const SITE = 'https://blamy.github.io/ui/#';
const check = process.argv.includes('--check');

const graph = buildGraph({ errors: [] });

/** Recipes defined in a module: name, base classes, variant groups, defaults, compound count. */
function recipesIn(rel) {
  const text = readFileSync(join(ROOT, SRC, rel), 'utf8');
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
  const out = [];
  const str = (n) => {
    if (!n) return '';
    if (ts.isStringLiteralLike(n)) return n.text;
    if (ts.isTemplateExpression(n)) return n.getText(sf).slice(1, -1);
    return n.getText(sf); // cn(...) and friends: shown as written
  };
  const key = (p) => (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name) || ts.isNumericLiteral(p.name) ? p.name.text : p.name.getText(sf));
  sf.forEachChild((n) => {
    if (!ts.isVariableStatement(n) || !n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return;
    for (const d of n.declarationList.declarations) {
      const init = d.initializer;
      if (!ts.isIdentifier(d.name) || !init || !ts.isCallExpression(init) || init.expression.getText(sf) !== 'cva') continue;
      const [base, config] = init.arguments;
      const groups = [];
      let defaults = {};
      let compound = 0;
      if (config && ts.isObjectLiteralExpression(config)) {
        for (const p of config.properties) {
          if (!ts.isPropertyAssignment(p)) continue;
          const name = key(p);
          if (name === 'variants' && ts.isObjectLiteralExpression(p.initializer)) {
            for (const g of p.initializer.properties) {
              if (!ts.isPropertyAssignment(g) || !ts.isObjectLiteralExpression(g.initializer)) continue;
              groups.push({
                name: key(g),
                options: g.initializer.properties.filter(ts.isPropertyAssignment).map((o) => ({ value: key(o), classes: str(o.initializer) })),
              });
            }
          } else if (name === 'defaultVariants' && ts.isObjectLiteralExpression(p.initializer)) {
            defaults = Object.fromEntries(p.initializer.properties.filter(ts.isPropertyAssignment).map((o) => [key(o), o.initializer.getText(sf).replace(/^['"]|['"]$/g, '')]));
          } else if (name === 'compoundVariants' && ts.isArrayLiteralExpression(p.initializer)) compound = p.initializer.elements.length;
        }
      }
      out.push({ name: d.name.text, module: rel, base: str(base), groups, defaults, compound });
    }
  });
  return out;
}

const byItem = new Map();
for (const it of graph.items.values()) {
  const recipes = it.files.filter((f) => /\.tsx?$/.test(f)).flatMap(recipesIn); // not an item's assets (weights.json, LICENSE)
  if (recipes.length) byItem.set(it.name, { item: it, recipes });
}

const cell = (s) => '`' + s.replace(/\s+/g, ' ').trim().replace(/`/g, "'").replace(/\|/g, '\\|') + '`';
const trunc = (s, n = 160) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function recipeMd(r, level) {
  const h = '#'.repeat(level);
  const lines = [`${h} \`${r.name}\``, ''];
  lines.push(`Defined in \`${aliasOf(r.module)}\`. Base classes:`, '', '```text', r.base.replace(/\s+/g, ' ').trim() || '(none)', '```', '');
  if (!r.groups.length) lines.push('No variants.', '');
  for (const g of r.groups) {
    lines.push(`**\`${g.name}\`**${r.defaults[g.name] !== undefined ? ` — default \`${r.defaults[g.name]}\`` : ''}`, '', '| Value | Adds |', '| --- | --- |');
    for (const o of g.options) lines.push(`| \`${o.value}\`${r.defaults[g.name] === o.value ? ' (default)' : ''} | ${o.classes ? cell(trunc(o.classes)) : '—'} |`);
    lines.push('');
  }
  if (r.compound) lines.push(`${r.compound} compound variant${r.compound === 1 ? '' : 's'} — see the source.`, '');
  return lines.join('\n');
}

const usage = (r) => {
  const g = r.groups[0];
  return g ? `${r.name}({ ${g.name}: '${g.options[0]?.value}' })` : `${r.name}()`;
};

function referencePage() {
  const total = [...byItem.values()].reduce((n, v) => n + v.recipes.length, 0);
  const lines = [
    '# Variants reference',
    '',
    `Every BL UI component is a [cva](https://cva.style) recipe. This page is generated from the source (${total} recipes) — the same functions you can call on any element, and the defaults you can edit in your installed copy. See [Styling and variants](${SITE}/styling) for how to use, compose and change them.`,
    '',
    '```tsx',
    "import { buttonVariants } from '@/components/ui/button'",
    '',
    "<a href=\"/docs\" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Docs</a>",
    '```',
    '',
  ];
  for (const { item, recipes } of [...byItem.values()].sort((a, b) => a.item.name.localeCompare(b.item.name))) {
    const title = item.manifest?.title ?? item.name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    lines.push(`## ${title}`, '');
    for (const r of recipes) lines.push(recipeMd(r, 3));
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

const SECTION = '## cva recipes';
function withRecipes(md, recipes, itemName) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => l === SECTION);
  const body = [
    SECTION,
    '',
    `Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change \`defaultVariants\` to change the default. All recipes are listed in the [Variants reference](${SITE}/variants).`,
    '',
    ...recipes.map((r) => recipeMd(r, 3)),
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  if (i < 0) return md.trimEnd() + '\n\n' + body + '\n';
  let end = lines.length;
  for (let j = i + 1; j < lines.length; j++) if (/^## /.test(lines[j])) { end = j; break; }
  return [...lines.slice(0, i), body, '', ...lines.slice(end)].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

const stale = [];
const write = (file, next) => {
  let cur = '';
  try { cur = readFileSync(file, 'utf8'); } catch {}
  if (cur === next) return;
  stale.push(file.replace(ROOT + '/', ''));
  if (!check) writeFileSync(file, next);
};

write(join(PAGES, 'variants.md'), referencePage());
for (const { item, recipes } of byItem.values()) {
  const page = item.manifest?.page;
  if (!page) continue;
  const file = join(PAGES, `${page}.md`);
  let md;
  try { md = readFileSync(file, 'utf8'); } catch { continue; }
  write(file, withRecipes(md, recipes, item.name));
}

if (check && stale.length) {
  console.error(`variants-md: stale ${stale.join(', ')} — run node tools/docs/variants-md.mjs`);
  process.exit(1);
}
console.log(`variants-md: ${[...byItem.values()].reduce((n, v) => n + v.recipes.length, 0)} recipes; ${stale.length ? (check ? 'stale ' : 'updated ') + stale.length + ' files' : 'up to date'}`);
