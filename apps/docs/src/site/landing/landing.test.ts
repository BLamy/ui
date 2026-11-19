/* The landing page's claims, held to the code. The page shows commands to copy, code to paste and a live app whose
   notes state facts about the kit; when one of these fails, the page says something the code no longer does. */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { LIBRARIES } from '../libraries';
import { UI_ROOT } from '../plan-graph';
import { INSTALL_COMMAND, PACKAGE, SAMPLE_NPM, SAMPLE_SOURCE, SOURCE_ITEM, SOURCE_LIBRARY_ITEM } from './install-data';
import { formatSize } from './sizes';

const REPO = resolve(UI_ROOT, '../..');
const read = (path: string) => readFileSync(path, 'utf8');
const pkg = JSON.parse(read(join(UI_ROOT, 'package.json'))) as { name: string; exports: Record<string, Record<string, string> | string> };

/** `import { A, B } from 'x'` and `import 'x'` lines of a sample → what each imports. */
const importsIn = (code: string) => [...code.matchAll(/^import\s+(?:\{([^}]*)\}\s+from\s+)?'([^']+)';?$/gm)]
  .map(([, names, spec]) => ({ spec, names: (names ?? '').split(',').map((n) => n.trim()).filter(Boolean) }));

/** A source file for a path without its extension, or a folder's index. */
const sourceFile = (base: string) => [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')].find((f) => existsSync(f) && !f.endsWith('/') && /\.(tsx?|css)$/.test(f));

/** A module the kit imports by alias or by a relative path, as a file. */
function moduleFile(from: string, spec: string): string | undefined {
  if (spec.startsWith('@/components/ui/')) return sourceFile(join(UI_ROOT, 'src/components', spec.slice('@/components/ui/'.length)));
  if (spec.startsWith('@/lib/')) return sourceFile(join(UI_ROOT, 'src/lib', spec.slice('@/lib/'.length)));
  if (spec.startsWith('.')) return sourceFile(resolve(dirname(from), spec));
  return undefined;
}

/** Every name a module exports, following `export * from`. */
function exportsOf(file: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>();
  if (seen.has(file)) return names;
  seen.add(file);
  const src = read(file);
  for (const [, name] of src.matchAll(/^export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm)) names.add(name);
  for (const [, list] of src.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)) {
    for (const part of list.split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  for (const [, spec] of src.matchAll(/^export\s+\*\s+from\s+'([^']+)'/gm)) {
    const next = moduleFile(file, spec);
    if (next) for (const name of exportsOf(next, seen)) names.add(name);
  }
  return names;
}

/** The source file behind an entry of the package (`@brett_lamy/ui/time` → `src/libraries/time.ts`). */
function entrySource(spec: string): string | undefined {
  const key = spec === PACKAGE ? '.' : `.${spec.slice(PACKAGE.length)}`;
  const entry = pkg.exports[key];
  const source = typeof entry === 'string' ? entry : entry?.['@org/source'];
  return source ? join(UI_ROOT, source) : undefined;
}

describe('the install section', () => {
  it('installs the package the workspace publishes', () => {
    expect(pkg.name).toBe(PACKAGE);
    expect(INSTALL_COMMAND).toBe(`npm install ${pkg.name}`);
  });

  it('imports only entries of the package, and names they export', () => {
    const imports = importsIn(SAMPLE_NPM);
    expect(imports.length).toBeGreaterThanOrEqual(3);
    for (const { spec, names } of imports) {
      const file = entrySource(spec);
      expect(file && existsSync(file), `${spec} is an entry of ${PACKAGE}`).toBe(true);
      if (!file || !names.length) continue;
      const exported = exportsOf(file);
      for (const name of names) expect(exported.has(name), `${spec} exports ${name}`).toBe(true);
    }
  });

  it('imports copied source by the alias the registry writes, and names the module exports', () => {
    const imports = importsIn(SAMPLE_SOURCE);
    expect(imports).toHaveLength(1);
    for (const { spec, names } of imports) {
      expect(spec).toBe(`@/components/ui/${SOURCE_ITEM}`);
      const file = moduleFile(REPO, spec);
      const exported = file ? exportsOf(file) : new Set<string>();
      expect(file, spec).toBeDefined();
      for (const name of names) expect(exported.has(name), `${spec} exports ${name}`).toBe(true);
    }
  });

  it('names registry items that exist', () => {
    const registry = JSON.parse(read(join(REPO, 'registry.json'))) as { items: Array<{ name: string; registryDependencies?: string[] }> };
    const items = new Set(registry.items.map((i) => i.name));
    expect(items.has(SOURCE_ITEM), SOURCE_ITEM).toBe(true);
    // The library's item copies its modules: each is one of its dependencies.
    const item = registry.items.find((i) => i.name === SOURCE_LIBRARY_ITEM);
    expect(SOURCE_LIBRARY_ITEM, 'a library with an entry').toBeDefined();
    expect(item, `${SOURCE_LIBRARY_ITEM} is a registry item`).toBeDefined();
    expect(item?.registryDependencies?.length ?? 0, `${SOURCE_LIBRARY_ITEM} lists its modules`).toBeGreaterThan(0);
  });
});

describe('the libraries section', () => {
  it('can show every library as a path of the one package', () => {
    for (const lib of LIBRARIES) expect(lib.npm === PACKAGE || lib.npm.startsWith(`${PACKAGE}/`), `${lib.id}: ${lib.npm}`).toBe(true);
  });

  it('formats sizes the way bundlers report them', () => {
    expect(formatSize(812)).toBe('812 B');
    expect(formatSize(4230)).toBe('4.2 kB');
    expect(formatSize(38_400)).toBe('38 kB');
    expect(formatSize(1_300_000)).toBe('1.3 MB');
  });
});

describe('the live app', () => {
  it('is the macOS block, which turns into a phone where the kit\'s compact size class starts', () => {
    const src = read(join(UI_ROOT, 'src/lib/size-class.ts'));
    const [, medium] = /medium = (\d+), regular = (\d+)/.exec(src) ?? [];
    expect(medium).toBe('640');
    const block = read(join(REPO, 'registry/blocks/macos/page.tsx'));
    expect(block).toMatch(/const isPhone = \(width: number\) => sizeClassOf\(width\) === 'compact'/);
    expect(read(join(REPO, 'apps/docs/src/site/landing.tsx'))).toContain("import('@/components/blocks/macos/page')");
  });
});
