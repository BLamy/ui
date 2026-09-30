#!/usr/bin/env node
/* Builds the shadcn registry — source-copy items, computed from the code.
 *
 *   node tools/registry/build.mjs            → registry.json (repo root)
 *   node tools/registry/build.mjs --static   → …then `shadcn build` into apps/docs/public/r (served at /ui/r)
 *   node tools/registry/build.mjs --static --url http://localhost:4500/r --out /tmp/r
 *                                            → a static registry for another host (local testing); the
 *                                              committed registry.json is left alone
 *   node tools/registry/build.mjs --check    → fail if the committed files are stale (CI)
 *
 * Items (see graph.mjs for how library modules are grouped and their dependencies computed from imports):
 *   bl-ui            registry:style — the tokens (tokens.css → cssVars.theme) and framework CSS (styles.css → css).
 *                    Every other item depends on it. No npm package is installed.
 *   bl-theme         registry:theme — the iOS palette (theme.css), opt-in.
 *   <component>      registry:ui / registry:lib — the module's real source, installed at components/ui/… or lib/….
 *                    registryDependencies point at our own items by URL (never shadcn's stock ones of the same name).
 *   <block>          registry:block — registry/blocks/<slug>/meta.json; files land in components/blocks/<slug>/.
 */
import { posix } from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import postcss from 'postcss';
import ts from 'typescript';
import { ROOT, SRC, buildGraph, importsOf, resolveModule, npmVersion, moduleExports } from './graph.mjs';

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
const itemUrl = (name) => `${URL_BASE}/${name}.json`;
const BASE_ITEM = itemUrl('bl-ui');

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

/* ── CSS → the registry's `css` object ── */
// Converts a stylesheet to shadcn's nested-object form: rules → { selector: { prop: value } }, at-rules with a body →
// { '@name params': { … } }. Imports, layer-order statements and `@source` are skipped (the app owns those).
function cssToRegistry(css) {
  const convert = (container) => {
    const out = {};
    container.each((node) => {
      if (node.type === 'decl') out[node.prop] = node.important ? `${node.value} !important` : node.value;
      else if (node.type === 'rule') {
        const body = convert(node);
        out[node.selector.replace(/\s+/g, ' ')] = { ...(out[node.selector.replace(/\s+/g, ' ')] ?? {}), ...body };
      } else if (node.type === 'atrule') {
        if (['import', 'source', 'plugin', 'theme'].includes(node.name)) return;
        if (!node.nodes) {
          if (node.name === 'custom-variant') out[`@custom-variant ${node.params}`] = {};
          return; // `@layer a, b;`
        }
        out[`@${node.name} ${node.params}`.trim()] = convert(node);
      }
    });
    return out;
  };
  return convert(postcss.parse(css));
}

/* ── bl-ui: the base item — tokens and framework CSS ── */
// Colors shadcn's own theme already maps (`--color-background: var(--background)` …): left out, they belong to the app.
const SHADCN_COLORS = /^color-(background|foreground|card|card-foreground|popover|popover-foreground|primary|primary-foreground|secondary|secondary-foreground|muted|muted-foreground|accent|accent-foreground|destructive|border|input|ring|chart-\d|sidebar(-[a-z-]+)?)$/;
function themeVars() {
  const css = read('packages/ui/src/tokens.css');
  const vars = {};
  for (const block of css.matchAll(/@theme(?:\s+inline)?\s*\{([\s\S]*?)\n\}/g)) {
    for (const m of block[1].replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)) {
      if (!SHADCN_COLORS.test(m[1])) vars[m[1]] = m[2].trim();
    }
  }
  return vars;
}

function baseItem() {
  const tokens = read('packages/ui/src/tokens.css');
  const customVariant = tokens.match(/@custom-variant\s+dark\s+([^;]+);/)?.[1];
  const css = {
    ...(customVariant ? { [`@custom-variant dark ${customVariant}`]: {} } : {}),
    ...cssToRegistry(read('packages/ui/src/styles.css')),
  };
  return {
    name: 'bl-ui',
    type: 'registry:style',
    title: 'BL UI',
    description:
      "BL UI's tokens and framework CSS: registers its extra color utilities (text-tertiary-foreground, bg-bar, text-success, …), the radius, text-size, shadow and size scales and the spring motion tokens next to shadcn's, plus the keyframes and scrollbar rules the parts use. Every other item depends on it.",
    cssVars: { theme: themeVars() },
    css,
    docs: 'BL UI reads your shadcn theme variables (and --radius, --font-sans). For the iOS look add the bl-theme item. The "dark" variant is redefined to also match the element that carries .dark, so a ThemeScope root can restyle itself.',
    files: [],
  };
}

/* ── bl-theme: the iOS palette as a shadcn theme (opt-in) ── */
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
      "BL UI's iOS look as a shadcn theme: sets your CSS variables (light and dark) to the iOS palette, plus the Workbench, terminal, sheet and glass theme scopes the Composer and floating chats use.",
    cssVars: { light: strip(light.decls), dark: strip(dark.decls) },
    // A nested light subtree (BLProvider / ThemeScope put `light` on their root) needs the light values back; the CLI
    // only writes :root and .dark from cssVars.
    css: { '.light:not([data-theme-scope])': light.decls, ...Object.fromEntries(scopes.map((r) => [r.selector, r.decls])) },
    files: [],
  };
}

/* ── components: one item per group of library modules ── */
const graph = buildGraph({ errors });
const titleOf = (name) => name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const depsField = (npm) => npm.map(([n, v]) => (v ? `${n}@${v}` : n));

const definedAnywhere = new Set();
for (const mod of graph.modules) {
  const ex = moduleExports(`${SRC}/${mod}`);
  for (const v of [...ex.values, ...ex.types]) definedAnywhere.add(v);
}
const componentItems = [...graph.items.values()].map((it) => {
  const m = it.manifest ?? {};
  const type = it.kind === 'lib' ? 'registry:lib' : 'registry:ui';
  for (const e of m.exports ?? []) if (!definedAnywhere.has(e)) errors.push(`registry/components/${it.name}.json: nothing in the library exports "${e}"`);
  return {
    name: it.name,
    type,
    title: m.title ?? titleOf(it.name),
    description: m.description ?? `${titleOf(it.name)} — part of BL UI's library (${it.files.join(', ')}).`,
    dependencies: depsField(it.npm),
    registryDependencies: [BASE_ITEM, ...it.deps.map(itemUrl)],
    ...(m.css ? { css: m.css } : {}),
    files: it.files.map((f) => ({
      path: `${SRC}/${f}`,
      type,
      target: f.startsWith('components/') ? `components/ui/${f.slice('components/'.length)}` : f,
    })),
    ...(m.page ? { meta: { page: m.page, exports: m.exports } } : {}),
  };
});

/* ── blocks ── */
const BLOCKS_DIR = 'registry/blocks';
const isOwnFile = (from, spec) => spec.startsWith('.') && !posix.relative('/', posix.join('/', posix.dirname(from), spec)).startsWith('..');

const blockItems = readdirSync(join(ROOT, BLOCKS_DIR), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(ROOT, BLOCKS_DIR, d.name, 'meta.json')))
  .map((d) => d.name)
  .sort()
  .map((slug) => {
    const meta = readJson(`${BLOCKS_DIR}/${slug}/meta.json`);
    if (meta.name !== slug) errors.push(`${BLOCKS_DIR}/${slug}/meta.json: name must be "${slug}"`);
    const deps = new Set();
    const files = meta.files.map((f) => {
      const path = `${BLOCKS_DIR}/${slug}/${f}`;
      const isCode = /\.tsx?$/.test(f);
      if (!existsSync(join(ROOT, path))) errors.push(`${path} is listed in meta.json but missing`);
      else if (isCode) {
        for (const spec of importsOf(path)) {
          const target = spec.startsWith('@/') ? resolveModule('', spec, graph.all) : null;
          if (target) deps.add(graph.owner.get(target));
          else if (spec.startsWith('@/components/ui/') || spec.startsWith('@/lib/')) errors.push(`${path}: "${spec}" is not a library module`);
          else if (spec.startsWith('@/')) errors.push(`${path}: "${spec}" — blocks import library parts by @/components/ui/… or @/lib/…`);
          else if (!(spec === 'react' || spec.startsWith('react/') || isOwnFile(f, spec) || (meta.dependencies || []).some((d) => spec === d || spec.startsWith(d + '/')))) {
            errors.push(`${path}: imports "${spec}" — blocks may import only react, @/components/ui/…, @/lib/…, their own files and meta.dependencies`);
          }
        }
      }
      return { path, type: isCode ? 'registry:component' : 'registry:file', target: `components/blocks/${slug}/${f}` };
    });
    return {
      name: slug,
      type: 'registry:block',
      title: meta.title,
      description: meta.description,
      categories: meta.categories,
      dependencies: (meta.dependencies || []).map((n) => (npmVersion(n) ? `${n}@${npmVersion(n)}` : n)),
      registryDependencies: [BASE_ITEM, ...[...deps].sort().map(itemUrl)],
      files,
      meta: { entry: `components/blocks/${slug}/page.tsx` },
    };
  });

const registry = {
  $schema: 'https://ui.shadcn.com/schema/registry.json',
  name: 'bl-ui',
  homepage: URL_BASE.replace(/\/r$/, ''),
  items: [baseItem(), themeItem(), ...componentItems, ...blockItems],
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
if (errors.length) {
  console.error(errors.map((e) => '✗ ' + e).join('\n'));
  process.exit(1);
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
