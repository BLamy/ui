#!/usr/bin/env node
/* What each entry of @brett_lamy/ui costs an app, measured on the built package (packages/ui/dist), the way an app's
 * bundler would see it: every entry is bundled on its own with Rolldown, the bundler under Vite (minified, tree-shaken,
 * code-split), with React and the package's optional peers left out and every other npm dependency counted in.
 *
 *   node tools/size/measure.mjs            print the table, write apps/docs/src/site/library-sizes.generated.json
 *   node tools/size/measure.mjs --check    also fail when an entry is over its budget (tools/size/budget.json), when a
 *                                          library entry stops tree-shaking, or when the generated file is stale
 *   node tools/size/measure.mjs --update   write the budgets from what was measured (review the diff)
 *   node tools/size/measure.mjs --modules  also print every per-module entry
 *   node tools/size/measure.mjs --why @brett_lamy/ui/button [Button]
 *                                          what an entry (or some names of it) is made of, largest first
 *
 * For each entry:
 *   load   what the browser must fetch before the entry works: its chunk and everything it imports statically
 *   lazy   what it may fetch later: chunks behind a dynamic `import()` (KaTeX, Mermaid, the Cloudflare catalog, …)
 * both minified, and gzipped (level 9). Not counted: stylesheets (one `styles.css` for the kit), worker scripts and
 * wasm an entry loads by URL, and the optional peers (listed per entry when it imports one).
 *
 * Two things are checked, because they are what "you only ship what you import" rests on:
 *   1. budgets: what a library entry loads, and what one import loads (a Button, a Dialog: the floor an app pays), may
 *      not grow past its budget (5% over what was measured when the budget was set);
 *   2. tree-shaking: one name imported from a library entry (`import { Waveform } from '@brett_lamy/ui/audio'`) or from
 *      the root costs what its own module entry costs (`@brett_lamy/ui/waveform`), within a small tolerance, for the
 *      probes in PROBES.
 * (That entries share code instead of each carrying a copy needs no check here: dist is one file per module, UI SDK
 * included, so two entries that use a module import the same file.)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { rolldown } from 'rolldown';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '../..');
const ui = join(root, 'packages/ui');
const pkg = JSON.parse(readFileSync(join(ui, 'package.json'), 'utf8'));
const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
const UPDATE = args.has('--update');
const OUT = join(root, 'apps/docs/src/site/library-sizes.generated.json');
const BUDGET = join(import.meta.dirname, 'budget.json');

if (!existsSync(join(ui, 'dist/index.js')) || !existsSync(join(ui, 'dist/vendor/ui-sdk/core/index.js'))) {
  console.error('packages/ui/dist is not built. Run: pnpm nx run @brett_lamy/ui:build');
  process.exit(1);
}

const { LIBRARIES } = await import(pathToFileURL(join(root, 'apps/docs/src/site/libraries.ts')).href);

/** `@brett_lamy/ui/<entry>` → its built file, from the package's own `exports` and `imports`. */
const entryFile = (spec) => {
  const key = spec === '@brett_lamy/ui' ? '.' : `./${spec.slice('@brett_lamy/ui/'.length)}`;
  const target = pkg.exports[key];
  const file = typeof target === 'string' ? target : target?.default ?? target?.import;
  return file ? join(ui, file) : null;
};
const privateImport = (spec) => {
  const pick = (v) => (typeof v === 'string' ? v : pick(v.default));
  return pkg.imports?.[spec] ? join(ui, pick(pkg.imports[spec])) : null;
};
const peers = Object.keys(pkg.peerDependencies ?? {});
const OPTIONAL = new Set(Object.keys(pkg.peerDependenciesMeta ?? {}).filter((p) => pkg.peerDependenciesMeta[p].optional));
const isPeer = (spec) => peers.find((p) => spec === p || spec.startsWith(`${p}/`));

/** Files an app serves or styles it loads once, not bundle bytes: stylesheets, wasm, fonts, images, and Vite's
 *  `?url` / `?worker` / `?raw` imports. */
const NOT_CODE = /\.(css|wasm|svg|png|jpe?g|gif|webp|woff2?|ttf|otf)$|\?/;
const ENTRY = 'bl-size-entry.js';
const EMPTY = '\0bl-size-empty:';
/** A stand-in module for something that is not code. (Named `.js`, or the bundler reads the id's extension.) */
const emptyId = (id) => `${EMPTY}${id.replace(/[^\w@-]+/g, '_')}.js`;

async function measure(label, source) {
  const usedPeers = new Set();
  const bundle = await rolldown({
    input: ENTRY,
    cwd: ui,
    platform: 'browser',
    treeshake: true,
    logLevel: 'silent',
    // What a production app build resolves and defines; UI SDK's `development` checks are picked by `imports`
    // (the condition is not set here, so the stubs).
    resolve: { conditionNames: ['production', 'browser', 'import', 'module', 'default'] },
    transform: { define: { 'process.env.NODE_ENV': '"production"' } },
    plugins: [{
      name: 'bl-package',
      resolveId(id, importer) {
        if (id === ENTRY) return { id: join(ui, ENTRY), moduleSideEffects: true };
        if (NOT_CODE.test(id)) return { id: emptyId(id), moduleSideEffects: false };
        // The package's own entries and private imports, as a consumer's resolver would find them. (A plugin's answer
        // skips the package.json lookup, so it carries the package's `sideEffects` itself: only stylesheets have any.)
        if (/^@brett_lamy\/ui(\/|$)/.test(id)) {
          const file = entryFile(id);
          if (!file) throw new Error(`no such entry: ${id}${importer ? ` (imported by ${importer})` : ''}`);
          return file.endsWith('.css') ? { id: emptyId(id), moduleSideEffects: false } : { id: file, moduleSideEffects: false };
        }
        if (id.startsWith('#') && privateImport(id)) return { id: privateImport(id), moduleSideEffects: false };
        const peer = /^[^./\0]/.test(id) ? isPeer(id) : undefined;
        if (peer) {
          if (OPTIONAL.has(peer)) usedPeers.add(peer);
          return { id, external: true };
        }
        return null;
      },
      load(id) {
        if (id === join(ui, ENTRY)) return source;
        if (id.startsWith(EMPTY)) return 'export default "";';
        return null;
      },
    }],
  });
  const { output } = await bundle.generate({ format: 'esm', minify: true, comments: false, entryFileNames: 'entry.js', chunkFileNames: 'chunk-[hash].js' });
  await bundle.close();
  const chunks = new Map(output.filter((o) => o.type === 'chunk').map((c) => [c.fileName, c]));
  const entry = [...chunks.values()].find((c) => c.isEntry);
  // `load`: the entry chunk and its static imports, transitively. Everything else is behind an `import()`.
  const load = new Set();
  const queue = [entry.fileName];
  while (queue.length) {
    const name = queue.pop();
    if (load.has(name) || !chunks.has(name)) continue;
    load.add(name);
    queue.push(...chunks.get(name).imports);
  }
  const sum = (names) => {
    const all = Buffer.concat(names.map((n) => Buffer.from(chunks.get(n).code)));
    return { min: all.length, gzip: gzipSync(all, { level: 9 }).length, brotli: brotliCompressSync(all, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length };
  };
  // What the loaded chunks are made of, by package or by folder of this one (`--why`): rendered bytes, before minifying.
  const by = new Map();
  let modules = 0;
  for (const name of load) {
    for (const [id, { renderedLength }] of Object.entries(chunks.get(name).modules)) {
      if (!renderedLength) continue;
      modules++;
      const m = /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/.exec(id);
      const group = m && !/ui-sdk-(core|react)$/.test(m[1]) ? m[1] : id.replace(/^.*packages\/ui\/dist\//, '').replace(/^(vendor\/ui-sdk\/(?:core|react))\/.*$/, '$1').replace(/^(docstream(?:-editor)?)\/.*$/, '$1').replace(/^(lib\/icon-shapes)\/.*$/, '$1');
      by.set(group, (by.get(group) ?? 0) + renderedLength);
    }
  }
  return { load: sum([...load]), lazy: sum([...chunks.keys()].filter((n) => !load.has(n))), peers: [...usedPeers].sort(), inputs: modules, by: [...by].sort((x, y) => y[1] - x[1]) };
}

const whole = (spec) => `export * from ${JSON.stringify(spec)};`;

/* `--why <entry> [name,…]`: what one entry (or some names of it) is made of, largest first, and stop. */
if (args.has('--why')) {
  const argv = process.argv.slice(2);
  const spec = argv[argv.indexOf('--why') + 1];
  const names = argv[argv.indexOf('--why') + 2];
  const source = names && !names.startsWith('--') ? `import { ${names} } from ${JSON.stringify(spec)};\nglobalThis.__keep = [${names}];` : whole(spec);
  const m = await measure('why', source);
  console.log(`${spec}${names && !names.startsWith('--') ? ` { ${names} }` : ''}: loads ${(m.load.min / 1024).toFixed(1)} kB min, ${(m.load.gzip / 1024).toFixed(1)} kB gzip; lazy ${(m.lazy.gzip / 1024).toFixed(1)} kB gzip; ${m.inputs} modules`);
  console.log('made of (rendered, before minifying):');
  for (const [group, bytes] of m.by.slice(0, 40)) console.log(`${(bytes / 1024).toFixed(1).padStart(9)} kB  ${group}`);
  process.exit(0);
}
const named = (names, spec) => `import { ${names} } from ${JSON.stringify(spec)};\nglobalThis.__keep = [${names}];`;

/* One name through a wide door must cost what it costs through its own: [the wide import, its module entry]. */
const PROBES = [
  { label: 'Button from the root', wide: named('Button', '@brett_lamy/ui'), narrow: named('Button', '@brett_lamy/ui/button') },
  { label: 'Dialog from the root', wide: named('Dialog, DialogContent', '@brett_lamy/ui'), narrow: named('Dialog, DialogContent', '@brett_lamy/ui/dialog') },
  { label: 'cn from the root', wide: named('cn', '@brett_lamy/ui'), narrow: named('cn', '@brett_lamy/ui/lib/utils') },
  { label: 'Waveform from /audio', wide: named('Waveform', '@brett_lamy/ui/audio'), narrow: named('Waveform', '@brett_lamy/ui/waveform') },
  { label: 'Calendar from /time', wide: named('Calendar', '@brett_lamy/ui/time'), narrow: named('Calendar', '@brett_lamy/ui/calendar') },
  { label: 'MarkdownView from /markdown', wide: named('MarkdownView', '@brett_lamy/ui/markdown'), narrow: named('MarkdownView', '@brett_lamy/ui/markdown-view') },
  { label: 'FilterInput from /filter', wide: named('FilterInput', '@brett_lamy/ui/filter'), narrow: named('FilterInput', '@brett_lamy/ui/filter-input') },
  { label: 'usePersistentState from /sync', wide: named('usePersistentState', '@brett_lamy/ui/sync'), narrow: named('usePersistentState', '@brett_lamy/ui/lib/persistent-state') },
];
/** A wide import may cost this much more than the narrow one: re-export glue, never a module. */
const SHAKE_TOLERANCE = (narrow) => Math.max(256, Math.round(narrow * 0.02));

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const rows = [];
const libraries = {};
const problems = [];

/* The libraries: the root (the core and its foundation), every generated or hand-written library entry, docstream's
   two roots and UI SDK's two. */
const entriesOf = (lib) => {
  if (lib.id === 'ui') return ['@brett_lamy/ui'];
  if (lib.id === 'ui-sdk') return ['@brett_lamy/ui/sdk/core', '@brett_lamy/ui/sdk/react/dialog'];
  return [lib.npm, ...(lib.alsoAt ?? []).map((e) => `@brett_lamy/ui/${e}`)];
};
for (const lib of LIBRARIES) {
  if (lib.status === 'planned') continue;
  const [main, ...rest] = entriesOf(lib);
  const m = await measure(lib.id, whole(main));
  libraries[lib.id] = { entry: main, min: m.load.min, gzip: m.load.gzip, brotli: m.load.brotli, lazy: m.lazy, peers: m.peers };
  rows.push([main, m]);
  for (const spec of rest) {
    const also = await measure(spec, whole(spec));
    libraries[lib.id].also = { ...(libraries[lib.id].also ?? {}), [spec]: { min: also.load.min, gzip: also.load.gzip, lazy: also.lazy, peers: also.peers } };
    rows.push([spec, also]);
  }
}

const probes = {};
for (const p of PROBES) {
  const [wide, narrow] = [await measure('wide', p.wide), await measure('narrow', p.narrow)];
  probes[p.label] = { wide: wide.load.min, narrow: narrow.load.min, gzip: wide.load.gzip };
  const over = wide.load.min - narrow.load.min;
  if (over > SHAKE_TOLERANCE(narrow.load.min)) problems.push(`tree-shaking: ${p.label} costs ${kb(wide.load.min)}, its own entry ${kb(narrow.load.min)} (${kb(over)} more)`);
}

const modules = {};
if (args.has('--modules')) {
  for (const key of Object.keys(pkg.exports)) {
    const target = pkg.exports[key];
    if (typeof target !== 'object' || key === '.' || /^\.\/(sdk|docstream)/.test(key) || /libraries\//.test(target['@org/source'] ?? '')) continue;
    const m = await measure(key, whole(`@brett_lamy/ui${key.slice(1)}`));
    modules[key] = { min: m.load.min, gzip: m.load.gzip, lazy: m.lazy.gzip };
  }
}

/* ── report ── */
const pad = (s, n) => String(s).padEnd(n);
const padl = (s, n) => String(s).padStart(n);
console.log(`\n${pad('entry (everything it exports)', 40)}${padl('load min', 11)}${padl('gzip', 11)}${padl('lazy gzip', 11)}  optional peers`);
for (const [spec, m] of rows) console.log(`${pad(spec, 40)}${padl(kb(m.load.min), 11)}${padl(kb(m.load.gzip), 11)}${padl(m.lazy.min ? kb(m.lazy.gzip) : '—', 11)}  ${m.peers.join(', ')}`);
console.log(`\n${pad('one import, two doors', 40)}${padl('wide min', 11)}${padl('own entry', 11)}${padl('gzip', 11)}`);
for (const [label, p] of Object.entries(probes)) console.log(`${pad(label, 40)}${padl(kb(p.wide), 11)}${padl(kb(p.narrow), 11)}${padl(kb(p.gzip), 11)}`);
if (args.has('--modules')) {
  console.log(`\n${pad('module entry', 40)}${padl('load min', 11)}${padl('gzip', 11)}${padl('lazy gzip', 11)}`);
  for (const [key, m] of Object.entries(modules).sort((a, b) => b[1].gzip - a[1].gzip)) console.log(`${pad(key, 40)}${padl(kb(m.min), 11)}${padl(kb(m.gzip), 11)}${padl(m.lazy ? kb(m.lazy) : '—', 11)}`);
}

/* ── the site's data, and the budgets ── */
const generated = `${JSON.stringify({ note: 'Generated by tools/size/measure.mjs from packages/ui/dist: minified bytes an app loads for everything an entry exports (React and optional peers excluded), and gzipped.', version: pkg.version, libraries, probes }, null, 2)}\n`;
const budgets = existsSync(BUDGET) ? JSON.parse(readFileSync(BUDGET, 'utf8')) : { note: '', gzip: {} };
if (UPDATE) {
  const room = (bytes) => Math.ceil((bytes * 1.05) / 256) * 256;
  const gzip = Object.fromEntries(Object.entries(libraries).map(([id, l]) => [id, room(l.gzip)]));
  const names = Object.fromEntries(Object.entries(probes).map(([label, p]) => [label, room(p.gzip)]));
  writeFileSync(BUDGET, `${JSON.stringify({ note: 'gzip bytes each library entry (`gzip`) and each single import (`names`) may load, 5% over what tools/size/measure.mjs measured when it was set. Raise one on purpose: node tools/size/measure.mjs --update, and say why in the commit.', gzip, names }, null, 2)}\n`);
  console.log(`\nbudgets written: ${BUDGET}`);
} else {
  for (const [id, l] of Object.entries(libraries)) {
    const limit = budgets.gzip?.[id];
    if (limit === undefined) problems.push(`${id}: no budget (run with --update)`);
    else if (l.gzip > limit) problems.push(`${id}: ${kb(l.gzip)} gzip is over its budget of ${kb(limit)}`);
  }
  // …and what one import costs: the floor every app pays for a Button or a Dialog.
  for (const [label, p] of Object.entries(probes)) {
    const limit = budgets.names?.[label];
    if (limit === undefined) problems.push(`${label}: no budget (run with --update)`);
    else if (p.gzip > limit) problems.push(`${label}: ${kb(p.gzip)} gzip is over its budget of ${kb(limit)}`);
  }
}
const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
if (CHECK) {
  // Sizes move by a few bytes with the toolchain; the committed file is stale when a library moved by more than 1%.
  const was = current ? JSON.parse(current).libraries ?? {} : {};
  for (const [id, l] of Object.entries(libraries)) {
    const before = was[id]?.gzip;
    if (before === undefined || Math.abs(l.gzip - before) > before * 0.01) problems.push(`${id}: library-sizes.generated.json says ${before === undefined ? 'nothing' : kb(before)}, measured ${kb(l.gzip)}: run node tools/size/measure.mjs`);
  }
} else if (current !== generated) {
  writeFileSync(OUT, generated);
  console.log(`\nwrote ${OUT}`);
}

if (problems.length) {
  console.error(`\n${problems.map((p) => `✗ ${p}`).join('\n')}`);
  process.exit(CHECK ? 1 : 0);
}
console.log('\nsizes: within budget; wide imports cost what their own entries cost');
