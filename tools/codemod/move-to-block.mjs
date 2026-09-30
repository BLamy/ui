#!/usr/bin/env node
/* Moves source files (typically out of packages/ui/src into a registry block) and re-points their imports.
 *
 *   node tools/codemod/move-to-block.mjs moves.json [--dry]
 *
 * moves.json: { "packages/ui/src/components/workbench/terminal.tsx": "registry/blocks/t3-clone/components/workbench/terminal.tsx", … }
 *
 * For every moved file, each relative import is resolved against the file's OLD location:
 *   - it points at another moved file  → rewritten to the relative path between the NEW locations;
 *   - it points at a file left behind in packages/ui/src → rewritten to `@brett_lamy/ui` (names merged into one import),
 *     and each name is checked against the package's public exports (missing ones are reported, not guessed);
 *   - it points anywhere else (a sibling that isn't in the move set, outside src) → reported.
 * Files are moved with `git mv` so history follows. Non-relative imports are untouched.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'packages/ui/src');
const [movesFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dry = process.argv.includes('--dry');
const moves = JSON.parse(readFileSync(resolve(movesFile), 'utf8'));
const abs = (p) => join(ROOT, p);
const oldToNew = new Map(Object.entries(moves).map(([o, n]) => [abs(o), abs(n)]));

const EXTS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
const resolveFile = (base, spec) => {
  const p = resolve(dirname(base), spec);
  for (const e of EXTS) if (existsSync(p + e) && !(e === '' && !/\.\w+$/.test(p))) return p + e;
  return null;
};

// Public names of the package barrel.
const barrel = new Set();
{
  const sf = ts.createSourceFile('index.ts', readFileSync(join(SRC, 'index.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
  sf.forEachChild((n) => {
    if (ts.isExportDeclaration(n) && n.exportClause && ts.isNamedExports(n.exportClause)) {
      for (const e of n.exportClause.elements) barrel.add(e.name.text);
    }
  });
}

const problems = [];
const pathTo = (from, to) => {
  let r = relative(dirname(from), to).replace(/\.(tsx?|jsx?)$/, '').replace(/\/index$/, '');
  if (!r.startsWith('.')) r = './' + r;
  return r;
};

const outputs = [];
for (const [oldP, newP] of oldToNew) {
  const src = readFileSync(oldP, 'utf8');
  const sf = ts.createSourceFile(oldP, src, ts.ScriptTarget.Latest, true);
  const edits = [];
  const barrelNames = new Map(); // name text -> true (kept with `type ` prefix if any)
  let firstBarrelNode = null;
  sf.forEachChild((n) => {
    const isImp = ts.isImportDeclaration(n);
    const isExp = ts.isExportDeclaration(n) && n.moduleSpecifier;
    if (!isImp && !isExp) return;
    const spec = n.moduleSpecifier.text;
    if (!spec.startsWith('.')) return;
    const target = resolveFile(oldP, spec);
    if (!target) {
      problems.push(`${relative(ROOT, oldP)}: cannot resolve "${spec}"`);
      return;
    }
    const start = n.moduleSpecifier.getStart(sf) + 1;
    const end = n.moduleSpecifier.getEnd() - 1;
    if (oldToNew.has(target)) {
      edits.push({ start, end, text: pathTo(newP, oldToNew.get(target)) });
    } else if (target.startsWith(SRC) && isImp && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings) && !n.importClause.name) {
      const typeOnly = n.importClause.isTypeOnly;
      for (const el of n.importClause.namedBindings.elements) {
        const imported = (el.propertyName ?? el.name).text;
        if (!barrel.has(imported)) problems.push(`${relative(ROOT, oldP)}: "${imported}" (from ${spec}) is not exported by @brett_lamy/ui`);
        const name = el.propertyName ? `${el.propertyName.text} as ${el.name.text}` : el.name.text;
        barrelNames.set((typeOnly || el.isTypeOnly ? 'type ' : '') + name, true);
      }
      // Drop this import; the merged one is written where the first went.
      edits.push({ start: n.getStart(sf), end: n.getEnd(), text: firstBarrelNode ? '' : '\u0000BARREL\u0000' });
      firstBarrelNode ??= n;
    } else if (isImp && !n.importClause && /\/(styles|theme)\.css$/.test(target) && target.startsWith(SRC)) {
      edits.push({ start, end, text: `@brett_lamy/ui/${target.split('/').pop()}` });
    } else if (target.startsWith(SRC) && isExp) {
      problems.push(`${relative(ROOT, oldP)}: re-export from "${spec}" needs a manual fix`);
    } else {
      problems.push(`${relative(ROOT, oldP)}: import "${spec}" → ${relative(ROOT, target)} needs a manual fix`);
    }
  });
  let out = src;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  if (barrelNames.size) {
    const names = [...barrelNames.keys()];
    const stmt = `import { ${names.join(', ')} } from '@brett_lamy/ui';`;
    out = out.replace('\u0000BARREL\u0000', stmt).replace(/\n\n\n+/g, '\n\n');
  }
  outputs.push([oldP, newP, out]);
}

if (problems.length) {
  console.error(problems.map((p) => '! ' + p).join('\n'));
}
if (dry) {
  console.log(`dry run: ${outputs.length} files, ${problems.length} problems`);
  process.exit(problems.length ? 1 : 0);
}
for (const [oldP, newP, out] of outputs) {
  mkdirSync(dirname(newP), { recursive: true });
  execFileSync('git', ['mv', '-f', oldP, newP], { cwd: ROOT });
  writeFileSync(newP, out);
}
console.log(`moved ${outputs.length} files (${problems.length} problems to fix by hand)`);
