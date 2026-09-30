#!/usr/bin/env node
/* Rewrites imports to the registry's alias form.
 *
 *   node tools/codemod/aliasify.mjs [--dry]
 *
 *   - inside packages/ui/src: a relative import of another library module → `@/components/ui/<x>` / `@/lib/<x>`
 *     (styles, stories helpers and the barrel keep their relative paths);
 *   - in blocks, docs examples/source and catalog stories: named imports from `@brett_lamy/ui` → one import per
 *     defining module, e.g. `import { Button } from '@/components/ui/button'`.
 * Idempotent. Names the barrel doesn't export are reported, not guessed.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix, relative, dirname } from 'node:path';
import ts from 'typescript';
import { ROOT, SRC, aliasOf, listModules } from '../registry/graph.mjs';

const dry = process.argv.includes('--dry');
const modules = new Set(listModules());
const problems = [];

// name → defining module, from the barrel
const barrel = new Map();
{
  const text = readFileSync(join(ROOT, SRC, 'index.ts'), 'utf8');
  const sf = ts.createSourceFile('index.ts', text, ts.ScriptTarget.Latest, true);
  sf.forEachChild((n) => {
    if (!ts.isExportDeclaration(n) || !n.moduleSpecifier || !n.exportClause || !ts.isNamedExports(n.exportClause)) return;
    const spec = n.moduleSpecifier.text;
    if (!spec.startsWith('.')) return;
    const target = ['', '.tsx', '.ts', '/index.tsx', '/index.ts'].map((e) => posix.normalize(spec + e)).find((t) => modules.has(t));
    if (!target) return;
    for (const e of n.exportClause.elements) barrel.set(e.name.text, target);
  });
}

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', 'out-tsc', 'public', '.results', '__baseline__'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
};

const coreFiles = walk(join(ROOT, SRC)).filter((f) => relative(join(ROOT, SRC), f) !== 'index.ts');
const consumerFiles = [
  ...walk(join(ROOT, 'registry/blocks')),
  ...walk(join(ROOT, 'apps/docs/examples')),
  ...walk(join(ROOT, 'apps/docs/src')),
  ...walk(join(ROOT, 'apps/catalog/stories')),
];

const resolveRel = (fromAbs, spec) => {
  const base = posix.normalize(posix.join(posix.dirname(relative(join(ROOT, SRC), fromAbs)), spec));
  return ['', '.tsx', '.ts', '/index.tsx', '/index.ts'].map((e) => base + e).find((t) => modules.has(t)) ?? null;
};

let changed = 0;
for (const file of coreFiles) {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const edits = [];
  const visit = (n) => {
    let lit = null;
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) lit = n.moduleSpecifier;
    else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) lit = n.arguments[0];
    if (lit?.text.startsWith('.')) {
      const target = resolveRel(file, lit.text);
      if (target) edits.push({ start: lit.getStart(sf) + 1, end: lit.getEnd() - 1, text: aliasOf(target) });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (edits.length) {
    let out = src;
    for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
    if (!dry) writeFileSync(file, out);
    changed++;
  }
}

for (const file of consumerFiles) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes("'@brett_lamy/ui'") && !src.includes('"@brett_lamy/ui"')) continue;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const byModule = new Map(); // module → names[]
  const removals = [];
  let first = null;
  let quote = "'";
  sf.forEachChild((n) => {
    if (!ts.isImportDeclaration(n) || n.moduleSpecifier.text !== '@brett_lamy/ui') return;
    quote = n.moduleSpecifier.getText(sf)[0];
    const clause = n.importClause;
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings) || clause.name) {
      problems.push(`${relative(ROOT, file)}: unsupported import form from @brett_lamy/ui`);
      return;
    }
    for (const el of clause.namedBindings.elements) {
      const imported = (el.propertyName ?? el.name).text;
      const mod = barrel.get(imported);
      if (!mod) {
        problems.push(`${relative(ROOT, file)}: "${imported}" is not exported by the library barrel`);
        continue;
      }
      const text = (clause.isTypeOnly || el.isTypeOnly ? 'type ' : '') + (el.propertyName ? `${el.propertyName.text} as ${el.name.text}` : el.name.text);
      byModule.set(mod, [...(byModule.get(mod) ?? []), text]);
    }
    removals.push([n.getStart(sf), n.getEnd(), first === null]);
    first ??= n.getStart(sf);
  });
  if (!removals.length) continue;
  // Drop a name that appears both as a value and as `type X`; sort for stable output.
  const stmts = [...byModule.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mod, names]) => `import { ${[...new Set(names)].join(', ')} } from ${quote}${aliasOf(mod)}${quote}`);
  const semi = src.slice(removals[0][0], removals[0][1]).trimEnd().endsWith(';') ? ';' : '';
  let out = src;
  for (const [start, end, isFirst] of removals.sort((a, b) => b[0] - a[0])) {
    const tail = out[end] === '\n' ? 1 : 0;
    out = out.slice(0, start) + (isFirst ? stmts.map((s) => s + semi).join('\n') : '') + out.slice(end + (isFirst ? 0 : tail));
  }
  if (!dry) writeFileSync(file, out);
  changed++;
}

if (problems.length) console.error(problems.map((p) => '! ' + p).join('\n'));
console.log(`${dry ? 'would change' : 'changed'} ${changed} files (${problems.length} problems)`);
process.exit(problems.length ? 1 : 0);
