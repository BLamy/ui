#!/usr/bin/env node
/* Builds the shadcn registry.
 *
 *   node tools/registry/build.mjs            → registry/components/<name>.tsx + registry.json (repo root)
 *   node tools/registry/build.mjs --static   → …then `shadcn build` into apps/docs/public/r (served at /ui/r)
 *   node tools/registry/build.mjs --static --url http://localhost:4500/r --out /tmp/r
 *                                            → a static registry for another host (local testing); the
 *                                              committed registry.json is left alone
 *   node tools/registry/build.mjs --check    → fail if the committed files are stale (CI)
 *
 * Items:
 *   bl-ui            registry:style — installs @brett_lamy/ui, imports its stylesheet, adds the BL token utilities
 *                    (bg-bl-card, text-bl-label, …) to the app's Tailwind theme. Everything else depends on it.
 *   <component>      registry:ui — one per registry/components/<name>.json: a thin `@/components/ui/<name>`
 *                    re-export of the component's parts.
 *   <block>          registry:block — one per registry/blocks/<slug>/meta.json; files land together in
 *                    components/blocks/<slug>/ so their relative imports keep working.
 */
import { posix } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const PROD_URL = 'https://blamy.github.io/ui/r';
const URL_BASE = (opt('--url') || PROD_URL).replace(/\/$/, '');
const OUT = resolve(ROOT, opt('--out') || 'apps/docs/public/r');
const CHECK = flag('--check');

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));
const rel = (p) => relative(ROOT, p).split('\\').join('/');

/* ── the packages' public exports, parsed from their index.ts ── */
function publicExports(indexPath) {
  const src = read(indexPath);
  const values = new Set();
  const types = new Set();
  for (const m of src.matchAll(/export\s+(type\s+)?\{([^}]*)\}\s*from/g)) {
    for (let spec of m[2].split(',')) {
      spec = spec.replace(/\/\/.*$/gm, '').trim();
      if (!spec) continue;
      const isType = !!m[1] || spec.startsWith('type ');
      const name = spec.replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
      (isType ? types : values).add(name);
    }
  }
  return { values, types };
}

const PACKAGES = {
  '@brett_lamy/ui': { ...publicExports('packages/ui/src/index.ts'), version: readJson('packages/ui/package.json').version },
};
const dep = (pkg) => `${pkg}@^${PACKAGES[pkg].version}`;
const BASE_ITEM = `${URL_BASE}/bl-ui.json`;

const errors = [];
const written = [];
function emit(path, content) {
  const abs = join(ROOT, path);
  const current = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  if (current === content) return;
  if (CHECK) {
    errors.push(`${path} is stale — run \`pnpm registry\``);
    return;
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  written.push(path);
}

/* ── bl-ui: the base item ── */
// The extra color tokens BL UI registers next to shadcn's (see packages/ui/src/tokens.css and the Theming page).
const EXTRA_COLORS = /^color-(success|warning|tertiary-foreground|secondary-strong|overlay|bar|sticky|handle|link|code|code-foreground)$/;
function themeVars() {
  // BL's own utilities from tokens.css's `@theme inline`: the extra colors (with their shadcn-derived fallbacks),
  // the iOS font and the spring motion tokens. shadcn's own names (background, primary, …) and font-mono are left
  // out: in a consumer's app those belong to the app's theme already.
  const css = read('packages/ui/src/tokens.css');
  const block = css.slice(css.indexOf('@theme inline {'));
  const vars = {};
  for (const m of block.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)) {
    const [, name, value] = m;
    if (EXTRA_COLORS.test(name) || /^(spacing-toolbar|font-ios|ease-ios|ease-spring-|duration-spring-|ease-exit|duration-exit|transition-duration-)/.test(name)) {
      vars[name] = value.trim();
    }
  }
  return vars;
}

const baseItem = {
  name: 'bl-ui',
  type: 'registry:style',
  title: 'BL UI',
  description:
    "Installs @brett_lamy/ui, imports its stylesheet, and registers BL UI's extra color utilities (text-tertiary-foreground, bg-secondary-strong, bg-bar, text-success, …) next to shadcn's.",
  dependencies: [dep('@brett_lamy/ui')],
  cssVars: { theme: themeVars() },
  css: { '@import "@brett_lamy/ui/styles.css"': {} },
  docs: 'BL UI colors are your shadcn theme variables. For the iOS look add the bl-theme item (npx shadcn add …/r/bl-theme.json). With Vite, pre-bundle the Markdown engine (it ships TypeScript source): optimizeDeps: { include: ["@brett_lamy/ui > @brett_lamy/docstream", "@brett_lamy/ui > @brett_lamy/docstream-editor"] }.',
  files: [],
};

/* ── bl-theme: the iOS palette as a shadcn theme (opt-in) ── */
// Parsed from packages/ui/src/theme.css: `:root` → cssVars.light, `.dark` → cssVars.dark, the scope rules → css.
function parseRules(css) {
  const rules = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = {};
    for (const d of m[2].matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;]+);/g)) decls[d[1]] = d[2].trim();
    rules.push({ selector: m[1].trim().replace(/\s+/g, ' '), decls });
  }
  return rules;
}
function themeItem() {
  const rules = parseRules(read('packages/ui/src/theme.css'));
  const strip = (decls) => Object.fromEntries(Object.entries(decls).filter(([k]) => k.startsWith('--')).map(([k, v]) => [k.slice(2), v]));
  const light = rules.find((r) => r.selector.startsWith(':root'));
  const dark = rules.find((r) => r.selector.startsWith('.dark'));
  const scopes = rules.filter((r) => r.selector.startsWith('[data-theme-scope'));
  return {
    name: 'bl-theme',
    type: 'registry:theme',
    title: 'BL theme',
    description:
      "BL UI's iOS look as a shadcn theme: sets your CSS variables (light and dark) to the iOS palette, plus the Workbench, terminal and chat theme scopes.",
    cssVars: { light: strip(light.decls), dark: strip(dark.decls) },
    // A nested light subtree (BLProvider / ThemeScope put `light` on their root) needs the light values back; the CLI
    // only writes :root and .dark from cssVars.
    css: { '.light:not([data-theme-scope])': light.decls, ...Object.fromEntries(scopes.map((r) => [r.selector, r.decls])) },
    files: [],
  };
}

/* ── components ── */
const COMPONENTS_DIR = 'registry/components';
const components = readdirSync(join(ROOT, COMPONENTS_DIR))
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => readJson(`${COMPONENTS_DIR}/${f}`));

function importBlock(keyword, names, from) {
  if (!names.length) return '';
  const one = `export ${keyword}{ ${names.join(', ')} } from '${from}';`;
  if (one.length <= 110) return one + '\n';
  return `export ${keyword}{\n${names.map((n) => `  ${n},`).join('\n')}\n} from '${from}';\n`;
}

const componentItems = components.map((c) => {
  const from = c.from || '@brett_lamy/ui';
  const pkg = PACKAGES[from];
  if (!pkg) errors.push(`${c.name}: unknown package ${from}`);
  for (const e of c.exports) if (pkg && !pkg.values.has(e)) errors.push(`${c.name}: ${from} has no export ${e}`);
  for (const t of c.types || []) if (pkg && !pkg.types.has(t)) errors.push(`${c.name}: ${from} has no type ${t}`);
  for (const i of c.imports || []) if (!c.exports.includes(i)) errors.push(`${c.name}: imports lists ${i}, which isn't in exports`);
  // Types named after one of the parts (ComposerProps, ComposerBumpProgress…): the longest value export that
  // prefixes the type must be in this entry, so `List` doesn't pick up `ListBoxProps`.
  const owner = (t) => [...pkg.values].filter((v) => /^[A-Z]/.test(v) && t.startsWith(v)).sort((a, b) => b.length - a.length)[0];
  const auto = pkg ? [...pkg.types].filter((t) => c.exports.includes(owner(t))) : [];
  const types = [...new Set([...(c.types || []), ...auto])].sort();
  const file = `${COMPONENTS_DIR}/${c.name}.tsx`;
  emit(
    file,
    `// Generated by tools/registry/build.mjs from ${c.name}.json — do not edit.\n` +
      `// ${c.title}: ${c.description}\n` +
      importBlock('', c.exports, from) +
      importBlock('type ', types, from),
  );
  return {
    name: c.name,
    type: 'registry:ui',
    title: c.title,
    description: c.description,
    dependencies: [...new Set([dep('@brett_lamy/ui'), dep(from)])],
    registryDependencies: [BASE_ITEM],
    files: [{ path: file, type: 'registry:ui', target: `components/ui/${c.name}.tsx` }],
    meta: { page: c.page, exports: c.exports },
  };
});

/* ── blocks ── */
const BLOCKS_DIR = 'registry/blocks';
// A relative import that stays inside the block's folder (e.g. `./data`, `../lib/data` from `components/`).
function isOwnFile(slug, from, spec) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return false;
  const base = posix.join('/', posix.dirname(from));
  return posix.normalize(posix.join(base, spec)).startsWith('/') && !posix.relative('/', posix.join(base, spec)).startsWith('..');
}

const blockItems = readdirSync(join(ROOT, BLOCKS_DIR), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(ROOT, BLOCKS_DIR, d.name, 'meta.json')))
  .map((d) => d.name)
  .sort()
  .map((slug) => {
    const meta = readJson(`${BLOCKS_DIR}/${slug}/meta.json`);
    if (meta.name !== slug) errors.push(`${BLOCKS_DIR}/${slug}/meta.json: name must be "${slug}"`);
    const files = meta.files.map((f) => {
      const path = `${BLOCKS_DIR}/${slug}/${f}`;
      if (!existsSync(join(ROOT, path))) errors.push(`${path} is listed in meta.json but missing`);
      else {
        const src = read(path);
        // Real import specifiers only (TypeScript's scanner), not strings inside sample data.
        for (const { fileName: spec } of ts.preProcessFile(src, true, true).importedFiles) {
          if (!(spec === 'react' || spec.startsWith('react/') || isOwnFile(slug, f, spec) || spec in PACKAGES || (meta.dependencies || []).some((d) => spec === d || spec.startsWith(d + '/')))) {
            errors.push(`${path}: imports "${spec}" — blocks may import only react, @brett_lamy/ui, their own files and meta.dependencies`);
          }
        }
      }
      return { path, type: 'registry:component', target: `components/blocks/${slug}/${f}` };
    });
    return {
      name: slug,
      type: 'registry:block',
      title: meta.title,
      description: meta.description,
      categories: meta.categories,
      dependencies: [dep('@brett_lamy/ui'), ...(meta.dependencies || [])],
      registryDependencies: [BASE_ITEM],
      files,
      meta: { entry: `components/blocks/${slug}/page.tsx` },
    };
  });

const registry = {
  $schema: 'https://ui.shadcn.com/schema/registry.json',
  name: 'bl-ui',
  homepage: URL_BASE.replace(/\/r$/, ''),
  items: [baseItem, themeItem(), ...componentItems, ...blockItems],
};
const registryJson = JSON.stringify(registry, null, 2) + '\n';

if (errors.length) {
  console.error(errors.map((e) => '✗ ' + e).join('\n'));
  process.exit(1);
}

let registryFile = 'registry.json';
if (URL_BASE === PROD_URL) emit('registry.json', registryJson);
else {
  // Another host: build from a temporary registry.json, leaving the committed one alone.
  registryFile = join(mkdtempSync(join(tmpdir(), 'bl-registry-')), 'registry.json');
  writeFileSync(registryFile, registryJson);
}
console.log(
  `registry: ${registry.items.length} items (${componentItems.length} components, ${blockItems.length} blocks)` +
    (written.length ? `; wrote ${written.join(', ')}` : '; up to date'),
);

if (flag('--static') && !CHECK) {
  // shadcn resolves each item's file paths from the cwd, so run it at the repo root.
  const bin = join(ROOT, 'node_modules/.bin/shadcn');
  execFileSync(existsSync(bin) ? bin : 'npx', [...(existsSync(bin) ? [] : ['shadcn@latest']), 'build', registryFile, '-o', OUT], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  console.log(`static registry → ${OUT.startsWith(ROOT) ? rel(OUT) : OUT}`);
}
