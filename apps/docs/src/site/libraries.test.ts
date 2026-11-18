/* The split plan, checked against the code: every unit of packages/ui/src has one home, no library imports from a
   library it doesn't build on, and no two npm packages would need each other. When this fails, the plan
   (libraries.ts) and the code disagree — fix one. */
import { describe, expect, it } from 'vitest';
import { LIBRARIES, LIBRARY, LAYER_EXCEPTIONS, ownerOf, packageNames, packageOf, reach, takes } from './libraries';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UI_ROOT, importsOf, listUnits, resolveImport } from './plan-graph';

const units = listUnits();

/** `jsonc-parser (optional peer)` → `jsonc-parser`. */
const packageOfExternal = (entry: string) => entry.replace(/ \(.*\)$/, '');
const NPM_NAME = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/;
/** The npm package an import names, or null for the workspace's own (relative, aliases, UI SDK, the package itself),
    React, Node built-ins and URLs. */
function npmPackageOf(spec: string): string | null {
  if (/^(?:\.|\/|@\/|@ui-sdk\/|@brett_lamy\/ui(?:\/|$)|node:|data:|virtual:|https?:)/.test(spec)) return null;
  const pkg = spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/');
  if (!NPM_NAME.test(pkg) || pkg === 'react' || pkg === 'react-dom') return null;
  return pkg;
}

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
        const planned = LAYER_EXCEPTIONS.some((c) => c.unit === unit && c.imports === spec);
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

  it('names in `external` every npm package a library imports that the libraries it builds on don\'t bring', () => {
    const missing: string[] = [];
    for (const lib of LIBRARIES) {
      const brought = [lib.id, ...reach(lib.id)].flatMap((id) => (LIBRARY[id]?.external ?? []).map(packageOfExternal));
      const has = (pkg: string) => brought.some((e) => (e.endsWith('/*') ? pkg.startsWith(e.slice(0, -1)) : e === pkg));
      const units = listUnits().filter((u) => ownerOf(u).id === lib.id);
      for (const pkg of new Set(units.flatMap((u) => importsOf(u).map(({ spec }) => npmPackageOf(spec))))) {
        if (pkg && !has(pkg)) missing.push(`${lib.id}: ${pkg}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('marks "(optional peer)" exactly the optional peers of @brett_lamy/ui', () => {
    const { peerDependenciesMeta = {} } = JSON.parse(readFileSync(join(UI_ROOT, 'package.json'), 'utf8')) as { peerDependenciesMeta?: Record<string, { optional?: boolean }> };
    const wrong: string[] = [];
    for (const lib of LIBRARIES.filter((l) => l.modules)) {
      for (const entry of lib.external ?? []) {
        const pkg = packageOfExternal(entry);
        if (entry.endsWith(' (optional peer)') !== !!peerDependenciesMeta[pkg]?.optional) wrong.push(`${lib.id}: ${entry}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('lists only split changes the code still needs', () => {
    for (const c of LAYER_EXCEPTIONS) {
      expect(importsOf(c.unit).some(({ spec }) => spec === c.imports), `${c.unit} no longer imports ${c.imports}`).toBe(true);
    }
  });
});
