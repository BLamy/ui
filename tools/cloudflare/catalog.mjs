#!/usr/bin/env node
/* Regenerates the catalog of Cloudflare's services that the diagrams offer, from pinned upstream data.
 *
 *   node tools/cloudflare/catalog.mjs           → packages/ui/src/lib/cloudflare-catalog.generated.ts
 *   node tools/cloudflare/catalog.mjs --check   fails if that would change a byte
 *
 * Sources, each pinned below, and fetched once into node_modules/.cache/cloudflare-catalog, so the first run needs the
 * network and later runs don't:
 *   directory        src/content/directory/*.yaml in cloudflare-docs (CC-BY-4.0): products. Each file's git hash is checked.
 *   wrangler-schema  wrangler's config-schema.json: binding keys and their fields, triggers.
 *   wrangler-types   `wrangler types` run on a config generated from that schema: which runtime type each binding has.
 *   wrangler-cli     wrangler's bundle, read as text: its friendly names and its R2 event categories.
 *   workers-types    the .d.ts, through the compiler API: each runtime type's methods, and the handlers a Worker can export.
 *   docs-page        pages at the same cloudflare-docs ref: event names, and which product each config section links to.
 *   hand             hand.mjs: everything a person decided.
 *
 * The package is only read: nothing in workers-types runs. TypeScript and YAML are pinned here too, as what the compiler prints
 * for a type is part of the output, so that a new TypeScript in the repo doesn't change it.
 *
 * No Cloudflare logos or icons: src/icons is never fetched, and no product carries an image.
 */
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import {
  BINDING_PRODUCT, CONTEXT_TYPES, ENV_MAP_KEYS, EVENT_SOURCE_PRODUCT, HANDLER_TYPES, NON_BINDING_SURFACE, OTHER_CONFIG_KEYS,
  PROBE_EXTRA_FIELDS, PROBE_FIXED_NAMES, PROBE_VALUES, PRODUCT_OVERRIDES, RECEIVES,
} from './hand.mjs';
import { openTypes } from './workers-types.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'packages/ui/src/lib/cloudflare-catalog.generated.ts');
const CHECK = process.argv.includes('--check');

const DOCS_REPO = 'cloudflare/cloudflare-docs';
const DOCS_REF = '5c2ac2bf064c2b8de82fdcd6f28d245b064f8da4';
/** When that commit was made: what a product's name means, as Cloudflare renames things. */
const DOCS_DATE = '2026-11-04';
const DIRECTORY_PATH = 'src/content/directory';
const WRANGLER_VERSION = '4.157.0';
const WRANGLER_SCHEMA_SHA256 = '57b91625cbaa059d39c30033c8f06df7a334348ccf019267e32ff3defd835d57';
const WORKERS_TYPES_VERSION = '5.20261104.1';
const WORKERS_TYPES_SHA256 = '0833a980954cf53790409a826372d9bbe06805d48339fd8e6c4de9d61a8651b3';
const TYPESCRIPT_VERSION = '6.0.3';
const YAML_VERSION = '2.9.0';
const SCRATCH = process.env.CATALOG_CACHE ?? join(ROOT, 'node_modules/.cache/cloudflare-catalog');

/* ══ What it needs, installed where it won't touch the repo ══ */

mkdirSync(SCRATCH, { recursive: true });
const TOOLS = join(SCRATCH, 'tools');
function installTools() {
  const pkg = { name: 'cloudflare-catalog-tools', private: true, dependencies: { wrangler: WRANGLER_VERSION, typescript: TYPESCRIPT_VERSION, yaml: YAML_VERSION } };
  const file = join(TOOLS, 'package.json');
  const text = `${JSON.stringify(pkg, null, 2)}\n`;
  if (existsSync(join(TOOLS, 'node_modules/wrangler/package.json')) && existsSync(file) && readFileSync(file, 'utf8') === text) return;
  mkdirSync(TOOLS, { recursive: true });
  writeFileSync(file, text);
  console.log(`installing wrangler ${WRANGLER_VERSION}, typescript ${TYPESCRIPT_VERSION} and yaml ${YAML_VERSION} into ${TOOLS}`);
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts', '--silent'], { cwd: TOOLS, stdio: ['ignore', 'ignore', 'inherit'] });
}
installTools();
const requireTool = createRequire(join(TOOLS, 'package.json'));
const WRANGLER_DIR = dirname(requireTool.resolve('wrangler/package.json'));
const YAML = requireTool('yaml');
const ts = requireTool('typescript');
if (ts.version !== TYPESCRIPT_VERSION) throw new Error(`typescript ${ts.version}, pinned ${TYPESCRIPT_VERSION}`);

const run = promisify(execFile);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const gitBlobSha = (text) => { const buf = Buffer.from(text); return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex'); };
const firstLine = (s) => (s ?? '').split('\n')[0].trim();
const sortBy = (xs, f) => [...xs].sort((a, b) => (f(a) < f(b) ? -1 : f(a) > f(b) ? 1 : 0));

/* ══ Fetching: pinned, cached, offline on a second run ══ */

const RAW = `https://raw.githubusercontent.com/${DOCS_REPO}/${DOCS_REF}`;
async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'cloudflare-catalog-generator', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : null) } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

async function page(path) {
  const file = join(SCRATCH, 'pages', path.replaceAll('/', '__'));
  if (existsSync(file)) return readFileSync(file, 'utf8');
  mkdirSync(dirname(file), { recursive: true });
  const text = await get(`${RAW}/${path}`);
  writeFileSync(file, text);
  return text;
}

async function directoryFiles() {
  const dir = join(SCRATCH, 'directory');
  mkdirSync(dir, { recursive: true });
  const listing = join(SCRATCH, 'directory-listing.json');
  if (!existsSync(listing)) writeFileSync(listing, await get(`https://api.github.com/repos/${DOCS_REPO}/contents/${DIRECTORY_PATH}?ref=${DOCS_REF}`));
  const files = JSON.parse(readFileSync(listing, 'utf8')).filter((f) => f.type === 'file' && f.name.endsWith('.yaml'));
  const queue = files.filter((f) => !existsSync(join(dir, f.name)) || statSync(join(dir, f.name)).size !== f.size);
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) writeFileSync(join(dir, f.name), await get(`${RAW}/${DIRECTORY_PATH}/${f.name}`));
  }));
  return files.map((f) => {
    const text = readFileSync(join(dir, f.name), 'utf8');
    if (gitBlobSha(text) !== f.sha) throw new Error(`${f.name} isn't what git has at ${DOCS_REF}: delete ${dir} and run this again`);
    return { file: f.name, sha: f.sha, text };
  });
}

function workersTypesPath() {
  const dir = join(SCRATCH, `workers-types-${WORKERS_TYPES_VERSION}`);
  const dts = join(dir, 'package/index.d.ts');
  if (!existsSync(dts)) {
    mkdirSync(dir, { recursive: true });
    if (readdirSync(dir).length) throw new Error(`${dir} should be empty before packing`);
    execFileSync('npm', ['pack', `@cloudflare/workers-types@${WORKERS_TYPES_VERSION}`, '--pack-destination', dir, '--silent'], { cwd: SCRATCH, stdio: ['ignore', 'ignore', 'inherit'] });
    const tgz = join(dir, `cloudflare-workers-types-${WORKERS_TYPES_VERSION}.tgz`);
    const got = sha256(readFileSync(tgz));
    if (got !== WORKERS_TYPES_SHA256) throw new Error(`workers-types tarball hash ${got}, expected ${WORKERS_TYPES_SHA256}`);
    execFileSync('tar', ['-xzf', tgz, '-C', dir], { cwd: SCRATCH });
  }
  return dts;
}

/* ══ Products ══ */

const trimUrl = (u) => { const p = String(u ?? '').split('#')[0]; return p.endsWith('/') ? p : `${p}/`; };

function readProducts(files) {
  const rows = files.map(({ file, sha, text }) => {
    const y = YAML.parse(text);
    return {
      id: file.replace(/\.yaml$/, ''),
      name: y.name ?? null,
      title: y.entry?.title ?? null,
      url: y.entry?.url ?? null,
      group: y.entry?.group ?? null,
      additionalGroups: y.entry?.additional_groups ?? [],
      description: y.meta?.description ?? null,
      hidden: y.entry?.show === false,
      fileSha: sha,
    };
  });
  // Which other product's URL a product's URL sits under (the longest), for "feature of".
  const owners = sortBy(rows.filter((r) => trimUrl(r.url) !== '/'), (r) => -trimUrl(r.url).length);
  // With `except` (a product looking for its parent), only a strictly shorter URL counts; products can share one.
  const productAtUrl = (url, except) => owners.find((o) => o.id !== except && trimUrl(url).startsWith(trimUrl(o.url)) && (except === undefined || trimUrl(url) !== trimUrl(o.url)));

  for (const r of rows) {
    const docs = r.group === 'Docs collections' || r.additionalGroups.includes('Docs collections');
    const parent = productAtUrl(r.url, r.id)?.id ?? null;
    const [ruleClass, rule] = docs ? ['docs', 'docs-collection']
      : r.hidden ? (parent ? ['feature', 'hidden-nested'] : ['docs', 'hidden-top-level'])
      : ['service', 'visible-entry'];
    const o = PRODUCT_OVERRIDES[r.id];
    r.class = o?.class ?? ruleClass;
    r.ruleClass = ruleClass;
    r.rule = rule;
    r.parent = r.class === 'feature' ? (o?.parent ?? parent) : null;
    if (o) r.why = o.why;
  }
  for (const id of Object.keys(PRODUCT_OVERRIDES)) if (!rows.some((r) => r.id === id)) throw new Error(`hand.mjs overrides a product that isn't there: ${id}`);
  for (const r of rows) if (r.parent && !rows.some((p) => p.id === r.parent)) throw new Error(`${r.id}: no such parent ${r.parent}`);
  return { rows, productAtUrl };
}

/* ══ Bindings, from the schema ══ */

function readSchema() {
  const raw = readFileSync(join(WRANGLER_DIR, 'config-schema.json'));
  const schema = JSON.parse(raw);
  const version = JSON.parse(readFileSync(join(WRANGLER_DIR, 'package.json'), 'utf8'));
  if (version.version !== WRANGLER_VERSION) throw new Error(`wrangler ${version.version}, pinned ${WRANGLER_VERSION}`);
  if (sha256(raw) !== WRANGLER_SCHEMA_SHA256) throw new Error(`wrangler's config-schema.json has hash ${sha256(raw)}, pinned ${WRANGLER_SCHEMA_SHA256}`);
  const defs = schema.definitions;
  const deref = (s) => { let x = s; while (x?.$ref) x = defs[x.$ref.split('/').pop()]; return x; };
  return { sha: sha256(raw), license: version.license, defs, deref };
}

/* A binding is a place in the config with a field that names it on `env`: `binding`, or a `name` whose description says
   so. Nested one level for queues.producers, durable_objects.bindings and the like. `previews` repeats the keys for preview
   deployments and is skipped. */
function findBindings({ defs, deref }) {
  const typeName = (raw) => {
    const p = deref(raw);
    if (p.const !== undefined) return JSON.stringify(p.const);
    if (p.enum) return p.enum.map((e) => JSON.stringify(e)).join(' | ');
    if (p.anyOf) return p.anyOf.map(typeName).join(' | ');
    if (Array.isArray(p.type)) return p.type.join(' | ');
    if (p.type === 'array') return `${typeName(p.items ?? {})}[]`;
    return p.type ?? 'any';
  };
  const nameFieldOf = (branches) => {
    if (branches.some((b) => b.properties?.binding)) return 'binding';
    if (branches.some((b) => /binding/i.test(b.properties?.name?.description ?? ''))) return 'name';
    return null;
  };
  const fieldsOf = (branches) => {
    const out = new Map();
    for (const b of branches) for (const [name, raw] of Object.entries(b.properties ?? {})) {
      const p = deref(raw);
      const req = branches.filter((x) => x.properties?.[name]).every((x) => x.required?.includes(name));
      out.set(name, { name, type: typeName(raw), required: req, ...(p.deprecated || raw.deprecated ? { deprecated: true } : {}), description: firstLine(raw.description ?? p.description) });
    }
    return [...out.values()];
  };
  const sites = (key, raw, depth = 0) => {
    const s = deref(raw);
    if (s.type === 'array') {
      const item = deref(s.items ?? {});
      const branches = item.anyOf ? item.anyOf.map(deref) : [item];
      const field = nameFieldOf(branches);
      return field ? [{ path: key, container: 'array', nameField: field, branches, description: firstLine(raw.description ?? s.description), fields: fieldsOf(branches) }] : [];
    }
    if (s.type === 'object' && s.properties) {
      const field = nameFieldOf([s]);
      if (field) return [{ path: key, container: 'object', nameField: field, branches: [s], description: firstLine(raw.description ?? s.description), fields: fieldsOf([s]) }];
      if (depth > 0) return [];
      return Object.entries(s.properties).flatMap(([k, v]) => sites(`${key}.${k}`, v, depth + 1));
    }
    return [];
  };
  const env = defs.RawEnvironment.properties;
  const top = defs.RawConfig.properties;
  const found = Object.entries(env).filter(([k]) => k !== 'previews').flatMap(([k, v]) => sites(k, v));
  return { found, env, top, typeName };
}

/* The names wrangler itself gives binding keys, from its bundle, read as text. */
function readWranglerBundle() {
  const text = readFileSync(join(WRANGLER_DIR, 'wrangler-dist/cli.js'), 'utf8');
  const friendlyBlock = /friendlyBindingNames = \{([\s\S]*?)\n\s*\};/.exec(text)?.[1];
  if (!friendlyBlock) throw new Error('friendlyBindingNames is no longer in the wrangler bundle');
  const friendly = Object.fromEntries([...friendlyBlock.matchAll(/^\s*([a-z0-9_]+): "([^"]+)"/gm)].map((m) => [m[1], m[2]]));
  const categoryBlock = /actionsForEventCategories = \{([\s\S]*?)\n\s*\};/.exec(text)?.[1];
  if (!categoryBlock) throw new Error('actionsForEventCategories is no longer in the wrangler bundle');
  const r2Categories = Object.fromEntries([...categoryBlock.matchAll(/"([a-z-]+)": \[([^\]]*)\]/g)].map((m) => [m[1], [...m[2].matchAll(/"([^"]+)"/g)].map((a) => a[1])]));
  return { friendly, r2Categories, bytes: text.length };
}

/* ══ A product, by name: for the headings of the events page ══ */

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
const singular = (t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t);
const RESOURCE_NOUN = /_(buckets|namespaces|databases|datasets|certificates|secrets|services|networks|consumers|loaders)$/;

function nameMatch(text, products) {
  const exactly = (s) => products.filter((p) => norm(s) === p.id || norm(s) === norm(p.name));
  const exact = exactly(text);
  if (exact.length === 1) return { tier: 'exact', id: exact[0].id };
  const stripped = String(text).replace(RESOURCE_NOUN, '');
  if (stripped !== text) {
    const e = exactly(stripped);
    if (e.length === 1) return { tier: 'noun-stripped', id: e[0].id };
  }
  const tokens = norm(stripped).split('-').filter(Boolean).map(singular);
  const hits = products.filter((p) => { const have = new Set(p.id.split('-').map(singular)); return tokens.every((t) => have.has(t)); });
  if (hits.length === 1) return { tier: 'tokens', id: hits[0].id };
  if (hits.length > 1) return { tier: 'ambiguous', candidates: hits.map((p) => p.id) };
  return { tier: 'none' };
}

/* ══ wrangler types on a config generated from the schema ══ */

async function runWranglerTypes({ deref }, roots) {
  const cwd = join(SCRATCH, 'wrangler-types-run');
  rmSync(cwd, { recursive: true, force: true });
  for (const d of ['home', 'logs', 'src', 'public']) mkdirSync(join(cwd, d), { recursive: true });
  writeFileSync(join(cwd, 'package.json'), '{"name":"catalog-types-probe","private":true}\n');
  writeFileSync(join(cwd, 'src/index.ts'), 'export default { fetch() { return new Response("") } };\nexport class ProbeClass {}\n');
  for (const f of ['probe.wasm', 'probe.txt', 'probe.bin']) writeFileSync(join(cwd, f), '');

  const sample = (raw, name) => {
    const s = deref(raw);
    if (s.anyOf) return sample(s.anyOf[0], name);
    if (s.const !== undefined) return s.const;
    if (s.enum) return s.enum[0];
    const t = Array.isArray(s.type) ? s.type[0] : s.type;
    if (t === 'string') return PROBE_VALUES[name] ?? 'probe-value';
    if (t === 'number') return 1;
    if (t === 'boolean') return true;
    if (t === 'array') return [sample(s.items, name)];
    if (t === 'object') return Object.fromEntries((s.required ?? []).map((r) => [r, sample(s.properties[r], r)]));
    return 'probe-value';
  };
  const envName = (path) => `B_${path.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}`;
  const config = { name: 'catalog-probe', main: 'src/index.ts', compatibility_date: '2026-11-03' };
  for (const b of roots.sites) {
    const item = { ...sample(b.container === 'array' ? { type: 'object', properties: Object.assign({}, ...b.branches.slice(0, 1).map((x) => x.properties)), required: b.branches[0].required } : b.branches[0], b.path), ...PROBE_EXTRA_FIELDS[b.path], [b.nameField]: envName(b.path) };
    const value = b.container === 'array' ? [item] : item;
    const parts = b.path.split('.');
    let at = config;
    for (const p of parts.slice(0, -1)) at = at[p] ??= {};
    at[parts.at(-1)] = value;
  }
  // Keys that put names on `env` in a form of their own.
  config.vars = { B_VARS: 'probe-value' };
  config.secrets = { required: ['B_SECRETS'] };
  config.wasm_modules = { B_WASM_MODULES: 'probe.wasm' };
  config.text_blobs = { B_TEXT_BLOBS: 'probe.txt' };
  config.data_blobs = { B_DATA_BLOBS: 'probe.bin' };
  if (config.assets) config.assets.directory = 'public';
  writeFileSync(join(cwd, 'wrangler.json'), JSON.stringify(config, null, 2));

  await run(process.execPath, [join(WRANGLER_DIR, 'bin/wrangler.js'), 'types', './out.d.ts', '--include-runtime=false'], {
    cwd,
    timeout: 120_000,
    maxBuffer: 1 << 24,
    env: { PATH: process.env.PATH, HOME: join(cwd, 'home'), XDG_CONFIG_HOME: join(cwd, 'home/.config'), WRANGLER_LOG_PATH: join(cwd, 'logs'), WRANGLER_SEND_METRICS: 'false', WRANGLER_HIDE_BANNER: 'true', CI: '1', NO_UPDATE_NOTIFIER: '1' },
  });

  const text = readFileSync(join(cwd, 'out.d.ts'), 'utf8');
  const sf = ts.createSourceFile('out.d.ts', text, ts.ScriptTarget.ESNext, true);
  const env = {};
  sf.forEachChild((n) => {
    if (!ts.isInterfaceDeclaration(n) || n.name.text !== '__BaseEnv_Env') return;
    for (const m of n.members) {
      if (!ts.isPropertySignature(m) || !m.type) continue;
      env[m.name.getText(sf).replace(/^"|"$/g, '')] = {
        text: m.type.getText(sf).replace(/\s+/g, ' ').replace(/ProbeClass/g, 'T'),
        inlineMembers: ts.isTypeLiteralNode(m.type) ? m.type.members.map((x) => x.name?.getText(sf)).filter(Boolean) : null,
      };
    }
  });
  const lookup = (key, path) => env[PROBE_FIXED_NAMES[key]] ?? env[envName(path)] ?? null;
  return { env, lookup, config };
}

/* ══ Receive side ══ */

async function readEventSubscriptions(products) {
  const hub = 'src/content/docs/queues/event-subscriptions/events-schemas.mdx';
  const text = await page(hub);
  const sources = [];
  for (const m of text.matchAll(/^### (.+)\n\n<Render file="([^"]+)" product="queues" \/>/gm)) {
    const heading = m[1];
    const partial = await page(`src/content/partials/queues/${m[2]}.mdx`);
    // An event's heading is in backticks; Browser Run also has a how-to heading, "#### Subscribe to events".
    const events = partial.split(/^#### /m).slice(1).filter((s) => s.startsWith('`')).map((s) => ({
      name: /^`([^`]+)`/.exec(s)[1],
      type: /"type":\s*"(cf\.[^"]+)"/.exec(s)?.[1] ?? null,
    }));
    const auto = nameMatch(heading, products);
    const hand = EVENT_SOURCE_PRODUCT[heading];
    if (!hand && auto.tier !== 'exact') throw new Error(`event source "${heading}" needs an entry in hand.mjs (${JSON.stringify(auto)})`);
    sources.push({
      heading, product: hand ?? auto.id, events, partial: `src/content/partials/queues/${m[2]}.mdx`,

    });
  }
  return { hub, sources };
}

async function readR2Notifications(bundle) {
  const path = 'src/content/docs/r2/buckets/event-notifications.mdx';
  const text = await page(path);
  const rows = [...text.matchAll(/^\| `(object-[a-z]+)` \|[^|]*\| (.*) \|$/gm)].map((m) => ({ category: m[1], actions: [...m[2].matchAll(/`([^`]+)`/g)].map((a) => a[1]).sort() }));
  const agree = rows.every((r) => JSON.stringify([...(bundle.r2Categories[r.category] ?? [])].sort()) === JSON.stringify(r.actions)) && rows.length === Object.keys(bundle.r2Categories).length;
  if (!agree) throw new Error(`R2's event categories in ${path} aren't the ones in wrangler's bundle`);
  return { doc: path, categories: rows };
}

/* ══ Runtime surface ══ */

const cut = (text, most) => (text.length > most ? `${text.slice(0, most - 1)}…` : text);
const typeRoot = (text) => /^(?:import\("([^"]+)"\)\.)?([A-Za-z_][A-Za-z0-9_]*)/.exec(text);
const VALUE_TYPES = new Set(['any', 'string', 'number', 'boolean', 'ArrayBuffer']);

function trimMember(m) {
  if (m.kind !== 'method') return { name: m.name, type: m.type, ...(m.optional ? { optional: true } : {}), ...(m.deprecated ? { deprecated: true } : {}) };
  return {
    name: m.name, overloads: m.overloads, params: m.params,
    ...(m.paramTypes ? { paramTypes: m.paramTypes.map((t) => cut(t, 80)) } : {}),
    returns: m.returns.map((r) => cut(r, 120)),
    ...(m.optional ? { optional: true } : {}), ...(m.deprecated ? { deprecated: true } : {}),
  };
}
const methodsOf = (d) => (d.members ?? []).filter((m) => m.kind === 'method');
const propsOf = (d) => (d.members ?? []).filter((m) => m.kind !== 'method');

/* ══ Main ══ */

const dts = workersTypesPath();
const files = await directoryFiles();
const { rows: products, productAtUrl } = readProducts(files);
const schema = readSchema();
const { found: bindingSites, top: topProps } = findBindings(schema);
const bundle = readWranglerBundle();

// Binding keys: the sites the schema shows, plus the keys that put names on `env` without a naming field.
const rootOf = (path) => path.split('.')[0];
const ENV_MAPS = ENV_MAP_KEYS;
const detectedRoots = new Set(bindingSites.map((b) => rootOf(b.path)));
const friendlyOnly = Object.keys(bundle.friendly).filter((k) => !detectedRoots.has(k));
for (const k of friendlyOnly) if (!ENV_MAPS.includes(k)) throw new Error(`wrangler names a binding key "${k}" that neither the schema walk nor hand.mjs ENV_MAP_KEYS has`);
const allKeys = [...detectedRoots, ...ENV_MAPS];
for (const k of allKeys) if (!(k in BINDING_PRODUCT)) throw new Error(`binding key "${k}" is not in hand.mjs BINDING_PRODUCT`);
for (const k of Object.keys(BINDING_PRODUCT)) if (!allKeys.includes(k)) throw new Error(`hand.mjs lists binding key "${k}", which the schema doesn't have`);

// Which runtime type each binding has, from wrangler's own generator.
const wt = await runWranglerTypes(schema, { sites: bindingSites });
const types = openTypes(ts, dts);

const describeWithFollowOn = (name) => ({ ...types.describe(name), followOn: types.followOn(name) });

const bindings = [];
const envRows = [
  ...bindingSites.map((b) => ({ key: rootOf(b.path), path: b.path, container: b.container, nameField: b.nameField, description: b.description, fields: b.fields })),
  ...ENV_MAPS.map((key) => ({ key, path: key, container: 'map', nameField: null, description: firstLine((topProps[key] ?? {}).description), fields: [] })),
];
for (const row of envRows) {
  const emitted = wt.lookup(row.key, row.path);
  const m = emitted ? typeRoot(emitted.text) : null;
  const typeName = m?.[2] ?? null;
  let runtime = null;
  let unresolved = null;
  if (!emitted) unresolved = 'wrangler types emits nothing for it';
  else if (emitted.inlineMembers) unresolved = 'wrangler types writes an inline type, not a name in workers-types';
  else if (VALUE_TYPES.has(typeName) || !typeName) unresolved = `a plain value (${emitted.text.slice(0, 40)}), not an object with methods`;
  else {
    runtime = describeWithFollowOn(typeName);
    if (!runtime.found) { unresolved = `wrangler says ${typeName}; workers-types has no such name`; runtime = null; }
  }
  bindings.push({
    key: row.key,
    path: row.path,
    container: row.container,
    nameField: row.nameField,
    description: row.description,
    friendlyName: bundle.friendly[row.key] ?? null,
    fields: row.fields,
    product: BINDING_PRODUCT[row.key].product,
    ...(BINDING_PRODUCT[row.key].why ? { why: BINDING_PRODUCT[row.key].why } : {}),
    typeText: emitted?.text ?? null,
    runtimeType: runtime?.name ?? null,
    typeWhere: runtime?.where ?? null,
    methods: emitted?.inlineMembers ? emitted.inlineMembers.map((name) => ({ name })) : runtime ? methodsOf(runtime).map(trimMember) : [],
    properties: runtime ? propsOf(runtime).map(trimMember) : [],
    followOn: runtime?.followOn ?? {},
    ...(unresolved ? { unresolved } : {}),

  });
}

// Handlers and the types they hand you.
const handlers = HANDLER_TYPES.map((name) => {
  const d = types.describe(name);
  if (!d.found) throw new Error(`workers-types has no ${name}`);
  return { type: name, where: d.where, line: d.line, handlers: methodsOf(d).map(trimMember) };
});
const contextTypes = CONTEXT_TYPES.map((name) => {
  const d = types.describe(name);
  return { type: name, found: d.found, where: d.where ?? null, kind: d.kind ?? null, methods: methodsOf(d).map((m) => m.name), properties: propsOf(d).map((m) => m.name) };
});

// The receive side: check every reference in the hand table.
const events = await readEventSubscriptions(products);
const r2Notifications = await readR2Notifications(bundle);
const pathInSchema = (path) => {
  let at = { properties: schema.defs.RawConfig.properties, type: 'object' };
  for (const part of path.split('.')) {
    at = schema.deref(at);
    if (at.type === 'array') at = schema.deref(at.items);
    if (at.anyOf) at = schema.deref(at.anyOf.find((x) => schema.deref(x).properties?.[part]) ?? at);
    at = at.properties?.[part];
    if (!at) return false;
  }
  return true;
};
const memberExists = (ref) => {
  const [t, m] = ref.split('.');
  const d = types.describe(t);
  return !!d.found && d.members.some((x) => x.name === m);
};
let checked = 0;
const receives = [];
for (const r of RECEIVES) {
  const problems = [];
  const check = (ok, what) => { checked++; if (!ok) problems.push(what); };
  check(memberExists(r.handler), `handler ${r.handler}`);
  if (r.by) check(memberExists(r.by), `by ${r.by}`);
  if (r.payload) check(types.describe(r.payload).found, `payload ${r.payload}`);
  for (const c of r.config ?? []) check(pathInSchema(c), `config ${c}`);
  if (r.from) check(products.some((p) => p.id === r.from), `from ${r.from}`);
  if (r.via) check(products.some((p) => p.id === r.via), `via ${r.via}`);
  if (r.doc) { let ok = true; try { await page(r.doc); } catch { ok = false; } check(ok, `doc ${r.doc}`); }
  if (problems.length) throw new Error(`hand.mjs RECEIVES ${r.id}: not found: ${problems.join(', ')}`);
  receives.push({
    ...r,

  });
}
const artifactsEventTypes = schema.defs.ArtifactsEventType.enum;

// Config keys that aren't bindings, and surfaces with no binding: checked as well.
const otherConfigKeys = OTHER_CONFIG_KEYS.map((k) => {
  if (!pathInSchema(k.path)) throw new Error(`hand.mjs OTHER_CONFIG_KEYS: ${k.path} is not in the schema`);
  if (!products.some((p) => p.id === k.product)) throw new Error(`hand.mjs OTHER_CONFIG_KEYS: no product ${k.product}`);
  checked += 2;
  return { ...k };
});
const nonBindingSurface = [];
for (const s of NON_BINDING_SURFACE) {
  const d = types.describe(s.type);
  if (!d.found) throw new Error(`hand.mjs NON_BINDING_SURFACE: no type ${s.type}`);
  if (!products.some((p) => p.id === s.product)) throw new Error(`hand.mjs NON_BINDING_SURFACE: no product ${s.product}`);
  await page(s.doc);
  checked += 3;
  nonBindingSurface.push({ ...s, methods: methodsOf(d).map(trimMember), properties: propsOf(d).map(trimMember) });
}

// Each product's surface, in both directions: what a Worker calls on it, and what it can send a Worker.
for (const p of products) {
  p.surface = {
    calls: [...new Set(bindings.filter((b) => b.product === p.id).map((b) => b.key))],
    callsWithoutBinding: nonBindingSurface.filter((s) => s.product === p.id).map((s) => s.type),
    alsoReachedThrough: Object.entries(BINDING_PRODUCT).flatMap(([k, v]) => Object.entries(v.alsoReaches ?? {}).filter(([, id]) => id === p.id).map(([m]) => `${k}.${m}`)),
    sends: receives.filter((r) => r.from === p.id).map((r) => r.id),
    events: events.sources.filter((s) => s.product === p.id).flatMap((s) => s.events.map((e) => e.type ?? e.name)),
  };
}

/* ══ What the audit found, as rules ══ */

// Only something a diagram can place can have a binding, send a Worker something, or be reached from one.
const classOf = new Map(products.map((p) => [p.id, p.class]));
const mustBeService = (id, what) => { if (id && classOf.get(id) !== 'service') throw new Error(`${what} points at ${id}, which is a ${classOf.get(id) ?? 'nothing'}, not a service`); };
for (const b of bindings) mustBeService(b.product, `binding ${b.path}`);
for (const r of receives) { mustBeService(r.from, `what's received ${r.id}`); mustBeService(r.via, `what's received ${r.id}`); }
for (const [k, v] of Object.entries(BINDING_PRODUCT)) for (const id of Object.values(v.alsoReaches ?? {})) mustBeService(id, `binding ${k}`);

/* ══ The module ══ */

const clean = (o) => JSON.parse(JSON.stringify(o));
const catalog = {
  pins: {
    docs: { repo: DOCS_REPO, ref: DOCS_REF, date: DOCS_DATE, license: 'CC-BY-4.0', files: files.length },
    wrangler: { version: WRANGLER_VERSION, schemaSha256: schema.sha, license: schema.license },
    workersTypes: { version: WORKERS_TYPES_VERSION, tarballSha256: WORKERS_TYPES_SHA256 },
    typescript: { version: ts.version },
  },
  attribution: `Product names, URLs, groups and descriptions are from ${DOCS_REPO} at ${DOCS_REF.slice(0, 12)} (${DOCS_DATE}), (c) Cloudflare, Inc. and contributors, CC-BY-4.0, https://creativecommons.org/licenses/by/4.0/ . Copied unchanged: class and parent are added here. Cloudflare is a trademark of Cloudflare, Inc., and this isn't endorsed by them.`,
  products: products.map((p) => ({
    id: p.id,
    name: p.name ?? p.title ?? p.id,
    url: p.url,
    group: p.group,
    groups: p.additionalGroups,
    description: p.description,
    class: p.class,
    parent: p.parent,
    ...(p.why ? { why: p.why } : null),
    calls: p.surface.calls,
    callsWithoutBinding: p.surface.callsWithoutBinding,
    alsoReachedThrough: p.surface.alsoReachedThrough,
    sends: p.surface.sends,
    events: p.surface.events,
  })),
  bindings: bindings.map((b) => ({
    ...b,
    ...(BINDING_PRODUCT[b.key].alsoReaches ? { alsoReaches: BINDING_PRODUCT[b.key].alsoReaches } : null),
  })),
  handlers: handlers.map(({ line: _l, ...h }) => h),
  contextTypes,
  receives,
  otherConfigKeys,
  nonBindingSurface,
  r2Notifications,
  eventSubscriptions: events,
  artifactsEvents: { types: artifactsEventTypes, target: 'workflow' },
};

/** One line for each thing in a list, so that a change to the upstream data shows as a change to that thing. */
function render(value, indent = '  ') {
  if (Array.isArray(value) && value.length && value.every((v) => v && typeof v === 'object')) {
    return `[\n${value.map((v) => `${indent}  ${JSON.stringify(clean(v))},`).join('\n')}\n${indent}]`;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return `{\n${Object.entries(value).map(([k, v]) => `${indent}  ${JSON.stringify(k)}: ${render(v, `${indent}  `)},`).join('\n')}\n${indent}}`;
  }
  return JSON.stringify(clean(value));
}
const moduleText = `/* Generated by tools/cloudflare/catalog.mjs from pinned upstream data. Do not edit: change tools/cloudflare/hand.mjs, or the pins.
   ${catalog.attribution} */
import type { CloudflareCatalog } from '@/lib/cloudflare-catalog';

export const CLOUDFLARE_CATALOG: CloudflareCatalog = ${render(catalog, '')};
`;

/* ══ What it says ══ */

const count = (xs, f) => { const out = {}; for (const x of xs) out[f(x)] = (out[f(x)] ?? 0) + 1; return out; };
const unresolved = catalog.bindings.filter((b) => b.unresolved);
const size = Buffer.byteLength(moduleText);
const methodCount = catalog.bindings.reduce((n, b) => n + b.methods.length, 0);
console.log(`products: ${catalog.products.length}, ${Object.entries(count(catalog.products, (p) => p.class)).map(([k, v]) => `${v} ${k}`).join(', ')}`);
console.log(`binding keys: ${new Set(catalog.bindings.map((b) => b.key)).size}, ${catalog.bindings.length} places, ${catalog.bindings.length - unresolved.length} with a type, ${methodCount} methods`);
console.log(`unresolved: ${unresolved.map((b) => `${b.key} (${b.unresolved})`).join('; ')}`);
console.log(`no product behind: ${catalog.bindings.filter((b) => !b.product).map((b) => b.key).join(', ')}`);
console.log(`what's received: ${catalog.receives.length} rows, ${checked} references checked`);
console.log(`module: ${size} bytes, ${gzipSync(moduleText).length} gzipped`);

if (CHECK) {
  const had = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
  if (had !== moduleText) {
    const a = (had ?? '').split('\n'), b = moduleText.split('\n');
    const line = a.findIndex((l, i) => l !== b[i]);
    console.error(`${OUT} isn't what this generates. First difference, at line ${(line < 0 ? a.length : line) + 1}:\n  has:   ${(a[line] ?? '(nothing)').slice(0, 200)}\n  wants: ${(b[line < 0 ? a.length : line] ?? '(nothing)').slice(0, 200)}\nRun node tools/cloudflare/catalog.mjs, and look at what changed.`);
    process.exit(1);
  }
  console.log('up to date');
} else {
  writeFileSync(OUT, moduleText);
  console.log(`wrote ${OUT}`);
}
