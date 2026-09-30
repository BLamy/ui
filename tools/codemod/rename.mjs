#!/usr/bin/env node
/* Renames/moves files inside the workspace and fixes every relative import that pointed at them (and the moved files'
 * own relative imports), like an IDE's "move file".
 *
 *   node tools/codemod/rename.mjs moves.json [--dry]
 *
 * moves.json: { "old/path.tsx": "new/path.tsx", … } (repo-relative). Scans the packages, registry, apps
 * and tools folders. Only relative specifiers are rewritten; aliases and packages are left alone.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dry = process.argv.includes('--dry');
const [movesFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const moves = new Map(Object.entries(JSON.parse(readFileSync(resolve(movesFile), 'utf8'))).map(([o, n]) => [join(ROOT, o), join(ROOT, n)]));
const newOf = (p) => moves.get(p) ?? p;

const EXTS = ['', '.ts', '.tsx', '.css', '/index.ts', '/index.tsx'];
const resolveFile = (from, spec) => {
  const p = resolve(dirname(from), spec);
  for (const e of EXTS) {
    const f = p + e;
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
};

const SKIP = new Set(['node_modules', 'dist', 'out-tsc', '.git', 'public', '.results', '__baseline__']);
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs|mts)$/.test(name)) out.push(p);
  }
  return out;
};
const files = ['packages', 'registry', 'apps', 'tools'].flatMap((d) => walk(join(ROOT, d)));

const relSpec = (from, to) => {
  let r = relative(dirname(from), to);
  const ext = /\.(tsx?)$/.test(r) ? '' : null;
  if (ext === '') r = r.replace(/\.(tsx?)$/, '');
  r = r.replace(/\/index$/, '');
  return r.startsWith('.') ? r : './' + r;
};

const rewrites = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!/from\s+['"]\.|import\s+['"]\.|import\(['"]\./.test(src)) {
    if (!moves.has(file)) continue;
  }
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const edits = [];
  const visit = (n) => {
    let lit = null;
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) lit = n.moduleSpecifier;
    else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) lit = n.arguments[0];
    if (lit && lit.text.startsWith('.')) {
      const target = resolveFile(file, lit.text);
      if (target) {
        const next = relSpec(newOf(file), newOf(target));
        const hasExt = /\.(css|json|svg|png|mjs|js)$/.test(lit.text);
        const text = hasExt ? relative(dirname(newOf(file)), newOf(target)).replace(/^(?!\.)/, './') : next;
        if (text !== lit.text) edits.push({ start: lit.getStart(sf) + 1, end: lit.getEnd() - 1, text });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (edits.length || moves.has(file)) {
    let out = src;
    for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
    rewrites.push([file, out, edits.length]);
  }
}

console.log(`${moves.size} moves, ${rewrites.filter((r) => r[2]).length} files with rewritten imports`);
if (dry) process.exit(0);
for (const [file, out] of rewrites) if (!moves.has(file)) writeFileSync(file, out);
for (const [o, n] of moves) {
  mkdirSync(dirname(n), { recursive: true });
  execFileSync('git', ['mv', '-f', o, n], { cwd: ROOT });
  const rw = rewrites.find((r) => r[0] === o);
  if (rw) writeFileSync(n, rw[1]);
}
