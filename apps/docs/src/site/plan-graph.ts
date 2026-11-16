/* The split plan's view of the code: the module units of packages/ui/src and what each one imports. Node only — read by
   the plan's test (libraries.test.ts) and by the docs' Vite plugin (`virtual:bl-site-files`, the roadmap's module map),
   so both see the same units.

   A unit is a top-level file of components/ or lib/ (`components/dialog.tsx`), a folder there (`components/composer/`,
   `lib/diagram-layout/`), docstream and its editor as one folder each (`docstream/`, `docstream-editor/`), or one of
   the package's own entry files (`cloudflare.ts`, `opencode.ts`). The barrel (`index.ts`) belongs to the package, and
   `stories/` and `agent/` hold only stories and tests. */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const UI_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../packages/ui');
export const UI_SRC = join(UI_ROOT, 'src');

const SOURCE = /\.(tsx?|js|mjs)$/;
const NOT_SOURCE = /\.(test|stories|spec)\.|\.dom\.test\.|\.d\.ts$/;
const isModule = (path: string) => SOURCE.test(path) && !NOT_SOURCE.test(path) && !path.split('/').some((p) => p.startsWith('__'));
const isDir = (path: string) => existsSync(path) && statSync(path).isDirectory();

/** Every unit, sorted. */
export function listUnits(): string[] {
  const units: string[] = [];
  for (const dir of ['components', 'lib']) {
    for (const name of readdirSync(join(UI_SRC, dir))) {
      if (name.startsWith('__')) continue;
      if (isDir(join(UI_SRC, dir, name))) units.push(`${dir}/${name}/`);
      else if (isModule(name)) units.push(`${dir}/${name}`);
    }
  }
  for (const dir of ['docstream', 'docstream-editor']) if (isDir(join(UI_SRC, dir))) units.push(`${dir}/`);
  for (const name of readdirSync(UI_SRC)) if (name !== 'index.ts' && isModule(name) && !isDir(join(UI_SRC, name))) units.push(name);
  return units.sort();
}

/** The source files of a unit (absolute paths). */
export function unitFiles(unit: string): string[] {
  if (!unit.endsWith('/')) return [join(UI_SRC, unit)];
  return readdirSync(join(UI_SRC, unit), { recursive: true, encoding: 'utf8' })
    .map((f) => f.split('\\').join('/'))
    .filter(isModule)
    .map((f) => join(UI_SRC, unit, f));
}

/** The unit a file of packages/ui/src belongs to, or null outside every unit. */
export function unitOfFile(abs: string, units: readonly string[]): string | null {
  const rel = relative(UI_SRC, abs).split('\\').join('/');
  if (rel.startsWith('..')) return null;
  return units.find((u) => (u.endsWith('/') ? rel.startsWith(u) : rel === u)) ?? null;
}

const EXTENSIONS = ['', '.ts', '.tsx', '.js', '/index.ts', '/index.tsx'];
const existing = (base: string) => EXTENSIONS.map((e) => base + e).find((p) => existsSync(p) && !isDir(p)) ?? null;

let exportsMap: Record<string, unknown> | null = null;
/** `@brett_lamy/ui/<entry>` → its source file, from the package's own `exports` (the workspace's `@org/source`). */
function entrySource(entry: string): string | null {
  exportsMap ??= (JSON.parse(readFileSync(join(UI_ROOT, 'package.json'), 'utf8')).exports ?? {}) as Record<string, unknown>;
  const key = `./${entry}`;
  const pick = (value: unknown) => (value && typeof value === 'object' ? (value as Record<string, unknown>)['@org/source'] : value);
  const exact = pick(exportsMap[key]);
  if (typeof exact === 'string') return resolve(UI_ROOT, exact);
  for (const [pattern, value] of Object.entries(exportsMap)) {
    const star = pattern.indexOf('*');
    const target = pick(value);
    if (star < 0 || typeof target !== 'string') continue;
    const [head, tail] = [pattern.slice(0, star), pattern.slice(star + 1)];
    if (key.startsWith(head) && key.endsWith(tail) && key.length >= head.length + tail.length) {
      return resolve(UI_ROOT, target.replace('*', key.slice(head.length, key.length - tail.length)));
    }
  }
  return null;
}

/** What an import points at: a unit, the UI SDK wrappers, the package's barrel, nothing of BL's (an npm package),
    or a name the plan can't place (a `@brett_lamy/ui/…` entry that doesn't exist). */
export type Target = { unit: string } | { uiSdk: true } | { barrel: true } | { unresolved: string } | null;

export function resolveImport(from: string, spec: string, units: readonly string[]): Target {
  if (spec.startsWith('.')) {
    const file = existing(resolve(dirname(from), spec));
    const unit = file ? unitOfFile(file, units) : null;
    return unit ? { unit } : null;
  }
  if (spec.startsWith('@ui-sdk/')) return { uiSdk: true };
  const alias = /^@\/(components\/ui|lib)\/(.+)$/.exec(spec);
  if (alias) {
    const file = existing(join(UI_SRC, alias[1] === 'lib' ? 'lib' : 'components', alias[2]));
    const unit = file ? unitOfFile(file, units) : null;
    return unit ? { unit } : { unresolved: spec };
  }
  // docstream and its editor, by the library's entries or by the npm names they had up to 2.0.1.
  if (/^@brett_lamy\/(ui\/)?docstream-editor(\/|$)/.test(spec)) return { unit: 'docstream-editor/' };
  if (/^@brett_lamy\/(ui\/)?docstream(\/|$)/.test(spec)) return { unit: 'docstream/' };
  if (spec === '@brett_lamy/ui') return { barrel: true };
  if (spec.startsWith('@brett_lamy/ui/')) {
    const file = entrySource(spec.slice('@brett_lamy/ui/'.length)) ?? existing(join(UI_SRC, spec.slice('@brett_lamy/ui/'.length)));
    const unit = file ? unitOfFile(file, units) : null;
    return unit ? { unit } : { unresolved: spec };
  }
  return null;
}

/* `import … from 'x'`, `export … from 'x'`, `import 'x'` and `import('x')`, in either quote; comments are skipped. */
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)(['"])([^'"\n]+)\1/gm;
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Every import specifier in a file, with the file it's in. */
export function importsOf(unit: string): Array<{ file: string; spec: string }> {
  const out: Array<{ file: string; spec: string }> = [];
  for (const file of unitFiles(unit)) {
    for (const m of stripComments(readFileSync(file, 'utf8')).matchAll(IMPORT)) out.push({ file, spec: m[2] });
  }
  return out;
}

/** Markdown pages in a docs folder (the libraries' own docs, for the site's page count). */
export function countMarkdown(dir: string): number {
  if (!isDir(dir)) return 0;
  return readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.md')).length;
}
