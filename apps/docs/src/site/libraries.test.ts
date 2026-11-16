/* The split plan, checked against the code: every module in @brett_lamy/ui has one home, and no library would import
   from a library it doesn't depend on. When this fails, the plan (libraries.ts) and the code disagree — fix one. */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LIBRARIES, LIBRARY, REMOVED_SHIMS, SPLIT_CHANGES } from './libraries';

const SRC = resolve(__dirname, '../../../../packages/ui/src');
const isModule = (name: string) => /\.(tsx?|js)$/.test(name) && !/\.(test|stories)\.|\.dom\.test\./.test(name);

/** A module unit: a top-level file of components/ or lib/, or a whole folder (`components/composer/`). */
const units = ['components', 'lib'].flatMap((dir) =>
  readdirSync(join(SRC, dir))
    .filter((name) => !name.startsWith('__') && (statSync(join(SRC, dir, name)).isDirectory() || isModule(name)))
    .map((name) => (statSync(join(SRC, dir, name)).isDirectory() ? `${dir}/${name}/` : `${dir}/${name}`)),
);

const files = (unit: string): string[] =>
  unit.endsWith('/')
    ? readdirSync(join(SRC, unit), { recursive: true, encoding: 'utf8' }).filter((f) => isModule(f)).map((f) => join(SRC, unit, f))
    : [join(SRC, unit)];

/** `@/components/ui/composer/composer` → `components/composer/`; `@/lib/icon` → `lib/icon.tsx`. */
function unitOf(spec: string): string | null {
  const m = /^@\/(components\/ui|lib)\/([^/]+)(\/.*)?$/.exec(spec);
  if (!m) return null;
  const dir = m[1] === 'lib' ? 'lib' : 'components';
  if (m[3] || (existsSync(join(SRC, dir, m[2])) && statSync(join(SRC, dir, m[2])).isDirectory())) return `${dir}/${m[2]}/`;
  return ['.tsx', '.ts', '.js'].map((ext) => `${dir}/${m[2]}${ext}`).find((u) => existsSync(join(SRC, u))) ?? null;
}

const owner = new Map<string, string>();
for (const lib of LIBRARIES) for (const unit of lib.modules ?? []) owner.set(unit, lib.id);
for (const shim of REMOVED_SHIMS) owner.set(shim, 'docstream');
const home = (unit: string) => owner.get(unit) ?? 'ui';

function reach(id: string, seen = new Set<string>()): Set<string> {
  for (const dep of LIBRARY[id].dependsOn) if (!seen.has(dep)) { seen.add(dep); reach(dep, seen); }
  return seen;
}

describe('the split plan', () => {
  it('names real modules, each once', () => {
    const listed = [...LIBRARIES.flatMap((l) => l.modules ?? []), ...REMOVED_SHIMS];
    expect(listed.filter((u) => !units.includes(u)), 'listed but missing').toEqual([]);
    expect(listed.filter((u, i) => listed.indexOf(u) !== i), 'listed twice').toEqual([]);
  });

  it('has a dependency graph without cycles or unknown libraries', () => {
    for (const lib of LIBRARIES) {
      for (const dep of lib.dependsOn) expect(LIBRARY[dep], `${lib.id} → ${dep}`).toBeDefined();
      expect(reach(lib.id).has(lib.id), `${lib.id} depends on itself`).toBe(false);
    }
  });

  it('never has a library import from one it does not depend on', () => {
    const violations: string[] = [];
    for (const unit of units) {
      const from = home(unit);
      if (REMOVED_SHIMS.includes(unit)) continue;
      const allowed = reach(from).add(from);
      for (const file of files(unit)) {
        const text = readFileSync(file, 'utf8');
        for (const [, spec] of text.matchAll(/(?:from\s*|import\s*\(\s*)'(@\/[^']+|@brett_lamy\/[^']+)'/g)) {
          const target = spec.startsWith('@brett_lamy/docstream-editor') ? 'docstream-editor' : spec.startsWith('@brett_lamy/docstream') ? 'docstream' : (() => {
            const u = unitOf(spec);
            return u ? home(u) : null;
          })();
          const planned = SPLIT_CHANGES.some((c) => c.unit === unit && c.imports === spec);
          if (target && !allowed.has(target) && !planned) violations.push(`${unit} (${from}) imports ${spec} (${target})`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('lists only split changes the code still needs', () => {
    for (const c of SPLIT_CHANGES) {
      expect(files(c.unit).some((f) => readFileSync(f, 'utf8').includes(`'${c.imports}'`)), `${c.unit} no longer imports ${c.imports}`).toBe(true);
    }
  });
});
