/* The split plan, checked against the code: every unit of packages/ui/src has one home, no library imports from a
   library it doesn't build on, and no two npm packages would need each other. When this fails, the plan
   (libraries.ts) and the code disagree — fix one. */
import { describe, expect, it } from 'vitest';
import { LIBRARIES, LIBRARY, SPLIT_CHANGES, ownerOf, packageNames, packageOf, reach, takes } from './libraries';
import { importsOf, listUnits, resolveImport } from './plan-graph';

const units = listUnits();

describe('the split plan', () => {
  it('names real modules, each once', () => {
    const patterns = LIBRARIES.flatMap((l) => (l.modules ?? []).map((m) => ({ lib: l.id, m })));
    expect(patterns.filter(({ m }) => !units.some((u) => takes(m, u))).map(({ lib, m }) => `${lib}: ${m}`), 'listed but missing').toEqual([]);
    const twice = units.map((u) => ({ u, homes: patterns.filter(({ m }) => takes(m, u)).map(({ lib }) => lib) })).filter(({ homes }) => homes.length > 1);
    expect(twice.map(({ u, homes }) => `${u}: ${homes.join(', ')}`), 'listed twice').toEqual([]);
  });

  it('has a dependency graph without cycles or unknown libraries', () => {
    for (const lib of LIBRARIES) {
      for (const dep of lib.dependsOn) expect(LIBRARY[dep], `${lib.id} → ${dep}`).toBeDefined();
      expect(reach(lib.id).has(lib.id), `${lib.id} depends on itself`).toBe(false);
      if (lib.partOf) expect(LIBRARY[lib.partOf]?.partOf, `${lib.id} ships in ${lib.partOf}, which ships in its own package`).toBeUndefined();
    }
  });

  it('never has a library import from one it does not depend on', () => {
    const violations: string[] = [];
    for (const unit of units) {
      const from = ownerOf(unit).id;
      const allowed = reach(from).add(from);
      for (const { file, spec } of importsOf(unit)) {
        const target = resolveImport(file, spec, units);
        if (!target) continue;
        const to = 'unit' in target ? ownerOf(target.unit).id : 'uiSdk' in target ? 'ui-sdk' : 'barrel' in target ? 'ui' : null;
        const at = `${unit} (${from}) imports ${spec}`;
        if (!to) { violations.push(`${at}: no such module`); continue; }
        const planned = SPLIT_CHANGES.some((c) => c.unit === unit && c.imports === spec);
        if (!allowed.has(to) && !planned) violations.push(`${at} (${to})`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('has npm packages that never need each other both ways', () => {
    // A library that ships inside another package (docstream in ui) brings its dependencies to that package.
    const deps = new Map<string, Set<string>>();
    for (const lib of LIBRARIES) {
      const pkg = packageOf(lib).id;
      for (const dep of lib.dependsOn) if (packageOf(LIBRARY[dep]).id !== pkg) deps.set(pkg, (deps.get(pkg) ?? new Set()).add(packageOf(LIBRARY[dep]).id));
    }
    const reaches = (from: string, to: string, seen = new Set<string>()): boolean =>
      [...(deps.get(from) ?? [])].some((d) => d === to || (!seen.has(d) && (seen.add(d), reaches(d, to, seen))));
    for (const pkg of deps.keys()) expect(reaches(pkg, pkg), `${pkg} needs itself through another package`).toBe(false);
  });

  it('publishes every package name once, and keeps the frozen names out of the plan', () => {
    const names = LIBRARIES.flatMap(packageNames);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
    const frozen = LIBRARIES.flatMap((l) => (l.formerly ?? []).map((f) => f.npm));
    expect(frozen.filter((n) => names.includes(n))).toEqual([]);
    for (const lib of LIBRARIES.filter((l) => l.partOf)) expect(lib.npm.startsWith(`${LIBRARY[lib.partOf ?? ''].npm}/`), lib.id).toBe(true);
  });

  it('lists only split changes the code still needs', () => {
    for (const c of SPLIT_CHANGES) {
      expect(importsOf(c.unit).some(({ spec }) => spec === c.imports), `${c.unit} no longer imports ${c.imports}`).toBe(true);
    }
  });
});
