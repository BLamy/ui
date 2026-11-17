/* ══ A system and `wrangler.jsonc`, both ways ══
   Reads a Worker's config into a system, writes a system's bindings back to that file, and says where the two differ. It's files
   only: nothing's deployed, and no account comes into it.

   Writing changes only what changed. It edits the file's text, and doesn't print a copy of what it read, so the rest of the file,
   its comments and how it's laid out stay as they are, byte for byte. A config with nothing to change comes back identical. */
import { findNodeAtLocation, getNodeValue, parseTree, printParseErrorCode, type Node, type ParseError } from 'jsonc-parser';
import type { CatalogBinding } from '@/lib/cloudflare-catalog';
import { CLOUDFLARE_CATALOG as C } from '@/lib/cloudflare-catalog.generated';
import {
  catalogBinding, isOwnSetting, linkOf, runsCode,
  type CloudflareConsumerSettings, type CloudflareEdge, type CloudflareMigration, type CloudflareService, type CloudflareSettings, type CloudflareTrigger,
} from '@/lib/cloudflare-services';
import { edgeBinding, serviceName, type CloudflareSystem } from '@/lib/cloudflare-system';

export interface WranglerOptions {
  /** Which of its `env` sections. By default, the top level. Bindings aren't inherited, so it's that section and nothing else. */
  env?: string;
}

export interface WranglerNote {
  code: 'unknown-binding' | 'no-name' | 'wrong-shape' | 'env-not-read' | 'duplicate';
  /** The key at the top of the config. */
  key?: string;
  /** What it's called on `env`. */
  name?: string;
  message: string;
}

/** Something on `env` that isn't a way to anything else: a var, a Worker's own assets. It stays in the file as it is. */
export interface WranglerSetting {
  key: string;
  name: string;
}

export type WranglerRead =
  | { ok: true; system: CloudflareSystem; /** The service whose config this is. */ worker: string; envs: string[]; settings: WranglerSetting[]; notes: WranglerNote[] }
  | { ok: false; /** Why it couldn't be read, in words. */ reason: string; kind: 'toml' | 'syntax' | 'shape' | 'env' };

export type WranglerEnvironmentsRead =
  | { ok: true; system: CloudflareSystem; /** Each environment's Worker, by its name; the top level's is under `''`. */ workers: Record<string, string>; envs: string[]; notes: WranglerNote[] }
  | { ok: false; reason: string; kind: 'toml' | 'syntax' | 'shape' | 'env' };

export interface WranglerDifference {
  /** `added`: in the system, and not in the config. `removed`: in the config, and not in the system. `renamed`: the same thing, under
   *  another name. `resource`: the same name, for something else, like another bucket. `setting`: one of the Worker's settings,
   *  triggers or vars, or a binding's or a consumer's setting, is another value. */
  kind: 'added' | 'removed' | 'renamed' | 'resource' | 'setting';
  /** The key at the top of the config. */
  key: string;
  /** What it's called on `env`, or the queue, for a consumer. */
  name: string;
  /** What it was called, or what it was for. */
  was?: string;
  /** What it's for now. */
  now?: string;
  message: string;
}

export interface WranglerNeed {
  key: string;
  name: string;
  /** What it has to have that a system doesn't say. */
  fields: string[];
  message: string;
}

export type WranglerWrite =
  | { ok: true; text: string; differences: WranglerDifference[]; needs: WranglerNeed[]; /** Connections it couldn't write, with why. */ skipped: { edge: string; reason: string }[] }
  | { ok: false; reason: string };

export type WranglerCompare =
  | { ok: true; differences: WranglerDifference[]; notes: WranglerNote[]; skipped: { edge: string; reason: string }[] }
  | { ok: false; reason: string };

/** The field of each binding that says what's behind it: which bucket, which database, which class. */
export const WRANGLER_RESOURCE_FIELDS: Readonly<Record<string, string>> = {
  r2_buckets: 'bucket_name',
  d1_databases: 'database_name',
  kv_namespaces: 'id',
  queues: 'queue',
  durable_objects: 'class_name',
  workflows: 'name',
  services: 'service',
  vectorize: 'index_name',
  hyperdrive: 'id',
  analytics_engine_datasets: 'dataset',
  pipelines: 'stream',
  ai_search: 'instance_name',
  ai_search_namespaces: 'namespace',
  agent_memory: 'namespace',
  k2: 'stream',
  secrets_store_secrets: 'secret_name',
  artifacts: 'namespace',
  flagship: 'app_id',
  dispatch_namespaces: 'namespace',
  vpc_services: 'service_id',
  vpc_networks: 'network_id',
};

const CONSUMER_KEY = 'queues.consumers';
const CONSUMER_VIA = 'queue-consumer';
const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const kindWord = (b: CatalogBinding) => b.friendlyName ?? b.key;

/* ── Reading the text ── */

type Parsed = { ok: true; root: Node; bom: string; body: string } | { ok: false; reason: string; kind: 'toml' | 'syntax' | 'shape' };

function lineColumn(text: string, offset: number) {
  const before = text.slice(0, offset).split(/\r\n|\r|\n/);
  return `line ${before.length}, column ${before[before.length - 1]!.length + 1}`;
}

/** Whether what couldn't be read as JSONC looks like TOML: its first line that says anything is a `[section]` or a `key = value`. */
function looksLikeToml(text: string): boolean {
  const first = text.split(/\r\n|\r|\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#') && !l.startsWith('//'));
  return !!first && (/^\[\[?[\w."'-]+\]?\]$/.test(first) || /^[\w."'-]+\s*=/.test(first));
}

function parse(text: string): Parsed {
  const bom = text.startsWith('\uFEFF') ? '\uFEFF' : '';
  const body = text.slice(bom.length);
  const errors: ParseError[] = [];
  const root = parseTree(body, errors, { allowTrailingComma: true, disallowComments: false, allowEmptyContent: false });
  if (errors.length || !root) {
    if (looksLikeToml(body)) return { ok: false, kind: 'toml', reason: 'That’s TOML. This reads wrangler.jsonc and wrangler.json, and it writes to the text of the file, so it won’t guess at another format. Wrangler takes the same keys in wrangler.jsonc.' };
    const e = errors[0];
    return { ok: false, kind: 'syntax', reason: e ? `That isn’t JSONC: ${printParseErrorCode(e.error)}, at ${lineColumn(body, e.offset)}.` : 'That’s empty: a config is an object.' };
  }
  if (root.type !== 'object') return { ok: false, kind: 'shape', reason: 'A config is an object, with a Worker’s settings in it.' };
  return { ok: true, root, bom, body };
}

const keyOf = (prop: Node) => prop.children![0]!.value as string;
const propsOf = (node: Node | undefined) => (node?.type === 'object' ? node.children ?? [] : []);
const envNames = (root: Node) => propsOf(findNodeAtLocation(root, ['env'])).map(keyOf);

/** What's at a path, even where a key's written twice, in which case the last one is what counts, as with JSON.parse. */
function at(section: Node, path: readonly string[]): Node | undefined {
  let here: Node | undefined = section;
  for (const key of path) {
    const props: Node[] = propsOf(here).filter((p) => keyOf(p) === key);
    here = props[props.length - 1]?.children?.[1];
    if (!here) return undefined;
  }
  return here;
}

/* ── What's in a section ── */

interface Entry {
  binding: CatalogBinding;
  key: string;
  name: string;
  resource?: string;
  /** The entry, in the tree of the text it came from. */
  node: Node;
  /** Its place among its siblings, and what holds it, for an array. */
  index: number | null;
  /** What it says, as a value. */
  value: Record<string, unknown>;
}

const pathOf = (b: CatalogBinding) => b.path.split('.');

/** The ways to another service in a section, in the order the catalog has them, and whatever's wrong with what looked like one. */
function entriesIn(section: Node): { entries: Entry[]; settings: WranglerSetting[]; notes: WranglerNote[] } {
  const entries: Entry[] = [], settings: WranglerSetting[] = [], notes: WranglerNote[] = [];
  for (const b of C.bindings) {
    const node = at(section, pathOf(b));
    if (!node) continue;
    const own = isOwnSetting(b);
    if (b.container === 'map') {
      for (const prop of propsOf(node)) settings.push({ key: b.key, name: keyOf(prop) });
      continue;
    }
    const nameField = b.nameField!;
    const one = (el: Node, index: number | null, where: string) => {
      const value = getNodeValue(el) as unknown;
      if (!isPlain(value)) { notes.push({ code: 'wrong-shape', key: b.key, message: `${where} isn’t an object, so it isn’t drawn.` }); return; }
      const name = value[nameField];
      if (typeof name !== 'string' || !name) {
        // Assets don't have to have a binding.
        if (!own) notes.push({ code: 'no-name', key: b.key, message: `${where} has no \`${nameField}\`, so it isn’t drawn.` });
        return;
      }
      if (own) { settings.push({ key: b.key, name }); return; }
      const field = WRANGLER_RESOURCE_FIELDS[b.key];
      const resource = field && typeof value[field] === 'string' && value[field] ? value[field] as string : undefined;
      entries.push({ binding: b, key: b.key, name, ...(resource ? { resource } : null), node: el, index, value });
    };
    if (b.container === 'array') {
      if (node.type !== 'array') { notes.push({ code: 'wrong-shape', key: b.key, message: `\`${b.path}\` has to be a list, so it isn’t drawn.` }); continue; }
      (node.children ?? []).forEach((el, i) => one(el, i, `\`${b.path}\`, item ${i + 1},`));
    } else {
      if (node.type !== 'object') { notes.push({ code: 'wrong-shape', key: b.key, message: `\`${b.path}\` has to be an object, so it isn’t drawn.` }); continue; }
      one(node, null, `\`${b.path}\``);
    }
  }
  // What the catalog doesn't know about, by how it looks: something with a name for `env`. It isn't anything to guess at.
  const known = new Set([...C.bindings.map((b) => b.key), ...C.otherConfigKeys.map((k) => k.path.split('.')[0]!), 'env']);
  for (const prop of propsOf(section)) {
    const key = keyOf(prop);
    if (known.has(key)) continue;
    const value = getNodeValue(prop.children![1]!) as unknown;
    const names = (Array.isArray(value) ? value : [value]).flatMap((v) => (isPlain(v) && typeof (v.binding ?? v.name) === 'string' ? [String(v.binding ?? v.name)] : []));
    for (const name of names) notes.push({ code: 'unknown-binding', key, name, message: `${name}, in \`${key}\`, isn’t in the catalog, as of ${C.pins.docs.date}, so it isn’t drawn. It stays in the file as it is.` });
  }
  return { entries, settings, notes };
}

interface Consumer {
  queue: string;
  node: Node;
  index: number;
  value: Record<string, unknown>;
}

function consumersIn(section: Node): Consumer[] {
  const node = at(section, CONSUMER_KEY.split('.'));
  if (node?.type !== 'array') return [];
  return (node.children ?? []).flatMap((el, index) => {
    const value = getNodeValue(el) as unknown;
    return isPlain(value) && typeof value.queue === 'string' && value.queue ? [{ queue: value.queue, node: el, index, value }] : [];
  });
}

/* ── A Worker's own facts: its settings, triggers, vars and class history ── */

/** Whether two plain values are the same. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string' && !!v;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** A setting of a Worker's, by where it is in the config. Wrangler inherits each from the top level into an env section. */
const SETTING_PATHS: readonly { field: keyof CloudflareSettings; path: readonly string[]; is: (v: unknown) => boolean }[] = [
  { field: 'main', path: ['main'], is: str },
  { field: 'compatibilityDate', path: ['compatibility_date'], is: str },
  { field: 'compatibilityFlags', path: ['compatibility_flags'], is: strings },
  { field: 'placement', path: ['placement', 'mode'], is: str },
  { field: 'cpuMs', path: ['limits', 'cpu_ms'], is: isNum },
  { field: 'subrequests', path: ['limits', 'subrequests'], is: isNum },
  { field: 'observability', path: ['observability', 'enabled'], is: (v) => typeof v === 'boolean' },
  { field: 'headSamplingRate', path: ['observability', 'head_sampling_rate'], is: isNum },
  { field: 'logpush', path: ['logpush'], is: (v) => typeof v === 'boolean' },
];

/** A consumer's settings, by their keys in `queues.consumers`. */
const CONSUMER_FIELDS: readonly [keyof CloudflareConsumerSettings, string, (v: unknown) => boolean][] = [
  ['batchSize', 'max_batch_size', isNum], ['batchTimeout', 'max_batch_timeout', isNum], ['retries', 'max_retries', isNum],
  ['retryDelay', 'retry_delay', isNum], ['deadLetterQueue', 'dead_letter_queue', str], ['concurrency', 'max_concurrency', isNum],
];

/** What a section says, or the top level's, for an env section that doesn't say. */
interface Reading {
  root: Node;
  section: Node;
  /** It's an env section, which inherits what it doesn't say. */
  inherits: boolean;
}
const valueAt = (r: Reading, path: readonly string[]): unknown => {
  const own = at(r.section, path);
  if (own) return getNodeValue(own) as unknown;
  const inherited = r.inherits ? at(r.root, path) : undefined;
  return inherited ? getNodeValue(inherited) as unknown : undefined;
};

function readSettings(r: Reading): CloudflareSettings | undefined {
  const out: Record<string, unknown> = {};
  for (const { field, path, is } of SETTING_PATHS) {
    const v = valueAt(r, path);
    if (is(v)) out[field] = v;
  }
  return Object.keys(out).length ? out as CloudflareSettings : undefined;
}

function readRoute(v: unknown): CloudflareTrigger | null {
  if (str(v)) return { kind: 'route', pattern: v };
  if (!isPlain(v) || !str(v.pattern)) return null;
  return { kind: 'route', pattern: v.pattern, ...(str(v.zone_name) ? { zone: v.zone_name } : null), ...(v.custom_domain === true ? { customDomain: true } : null) };
}
/** The routes, `workers.dev` and cron schedules in a section, in that order, or nothing if it says nothing about any. */
function readTriggers(r: Reading): CloudflareTrigger[] | undefined {
  const routes = valueAt(r, ['routes']), route = valueAt(r, ['route']), dev = valueAt(r, ['workers_dev']), crons = valueAt(r, ['triggers', 'crons']);
  if (routes === undefined && route === undefined && dev === undefined && crons === undefined) return undefined;
  const out: CloudflareTrigger[] = [];
  for (const v of Array.isArray(routes) ? routes : route !== undefined ? [route] : []) {
    const t = readRoute(v);
    if (t) out.push(t);
  }
  if (dev === true) out.push({ kind: 'workers-dev' });
  if (strings(crons)) for (const schedule of crons) out.push({ kind: 'cron', schedule });
  return out;
}
const writeRoute = (t: Extract<CloudflareTrigger, { kind: 'route' }>): unknown =>
  (t.zone || t.customDomain ? { pattern: t.pattern, ...(t.zone ? { zone_name: t.zone } : null), ...(t.customDomain ? { custom_domain: true } : null) } : t.pattern);

function readMigrations(r: Reading): CloudflareMigration[] | undefined {
  const v = valueAt(r, ['migrations']);
  if (!Array.isArray(v)) return undefined;
  return v.flatMap((m): CloudflareMigration[] => {
    if (!isPlain(m) || !str(m.tag)) return [];
    const out: CloudflareMigration = { tag: m.tag };
    if (strings(m.new_sqlite_classes)) out.newSqliteClasses = m.new_sqlite_classes;
    if (strings(m.new_classes)) out.newClasses = m.new_classes;
    if (Array.isArray(m.renamed_classes)) {
      const renamed = m.renamed_classes.flatMap((x) => (isPlain(x) && str(x.from) && str(x.to) ? [{ from: x.from, to: x.to }] : []));
      if (renamed.length) out.renamedClasses = renamed;
    }
    if (strings(m.deleted_classes)) out.deletedClasses = m.deleted_classes;
    return [out];
  });
}
const writeMigration = (m: CloudflareMigration): unknown => ({
  tag: m.tag,
  ...(m.newSqliteClasses ? { new_sqlite_classes: m.newSqliteClasses } : null),
  ...(m.newClasses ? { new_classes: m.newClasses } : null),
  ...(m.renamedClasses ? { renamed_classes: m.renamedClasses } : null),
  ...(m.deletedClasses ? { deleted_classes: m.deletedClasses } : null),
});

/** The names of the plain values on `env` (`vars`), or nothing if it has none. They aren't inherited. */
function readVars(section: Node): string[] | undefined {
  const node = at(section, ['vars']);
  return node?.type === 'object' ? propsOf(node).map(keyOf) : undefined;
}

/** A Worker's own facts, from its section. */
function workerFacts(r: Reading): Pick<CloudflareService, 'settings' | 'triggers' | 'vars' | 'migrations'> {
  const settings = readSettings(r), triggers = readTriggers(r), vars = readVars(r.section), migrations = readMigrations(r);
  return { ...(settings ? { settings } : null), ...(triggers ? { triggers } : null), ...(vars ? { vars } : null), ...(migrations ? { migrations } : null) };
}

/** A consumer's settings, from its entry. */
function consumerSettings(value: Record<string, unknown>): CloudflareConsumerSettings | undefined {
  const out: Record<string, unknown> = {};
  for (const [field, key, is] of CONSUMER_FIELDS) if (is(value[key])) out[field] = value[key];
  return Object.keys(out).length ? out as CloudflareConsumerSettings : undefined;
}

/** What a binding's entry says past its name and resource: a service binding's entrypoint, a producer's delivery delay. */
function entryFields(e: Entry): Pick<CloudflareEdge, 'entrypoint' | 'deliveryDelay'> {
  return {
    ...(e.key === 'services' && str(e.value.entrypoint) ? { entrypoint: e.value.entrypoint } : null),
    ...(e.key === 'queues' && isNum(e.value.delivery_delay) ? { deliveryDelay: e.value.delivery_delay } : null),
  };
}

const edgeIdOf = (worker: string, key: string, name: string) => `${worker}-${key}-${name}`;
const consumerEdgeId = (worker: string, queue: string) => `${worker}-${CONSUMER_VIA}-${queue}`;
const serviceIdOf = (product: string, resource: string | undefined) => (resource ? `${product}:${resource}` : product);

/* ── Into a system ── */

/** A config, as a system: its Worker, a service for each thing it's bound to, and an edge for each binding and queue consumer. */
export function readWrangler(text: string, options: WranglerOptions = {}): WranglerRead {
  const parsed = parse(text);
  if (!parsed.ok) return parsed;
  const { root } = parsed;
  const envs = envNames(root);
  const section = options.env === undefined ? root : at(root, ['env', options.env]);
  if (!section) return { ok: false, kind: 'env', reason: envs.length ? `There’s no env called ${options.env}. It has ${envs.join(', ')}.` : `There’s no env called ${options.env}, as it has no env sections.` };
  if (section.type !== 'object') return { ok: false, kind: 'shape', reason: `\`env.${options.env}\` has to be an object.` };

  const value = (node: Node | undefined) => (node ? getNodeValue(node) as unknown : undefined);
  const baseName = value(at(root, ['name']));
  const ownName = options.env === undefined ? undefined : value(at(section, ['name']));
  const named = typeof ownName === 'string' && ownName ? ownName : typeof baseName === 'string' && baseName ? (options.env === undefined ? baseName : `${baseName}-${options.env}`) : null;
  const reading: Reading = { root, section, inherits: options.env !== undefined };
  const environment = options.env !== undefined ? { environment: options.env } : null;
  const worker: CloudflareService = {
    id: named ?? 'worker',
    kind: value(at(root, ['pages_build_output_dir'])) !== undefined ? 'pages' : 'workers',
    ...(named ? { label: named } : null),
    ...workerFacts(reading),
    ...environment,
  };

  const { entries, settings, notes } = entriesIn(section);
  if (options.env === undefined && envs.length) notes.push({ code: 'env-not-read', message: `It has env sections, which weren’t read, as bindings aren’t inherited: ${envs.join(', ')}. Ask for one by name to read it.` });
  const services = new Map<string, CloudflareService>([[worker.id, worker]]);
  const edges: CloudflareEdge[] = [];
  const edgeIds = new Set<string>();
  const uniqueId = (base: string) => {
    let id = base;
    for (let n = 2; edgeIds.has(id); n++) id = `${base}-${n}`;
    edgeIds.add(id);
    return id;
  };
  const seen = new Set<string>();
  for (const e of entries) {
    const product = e.binding.product!;
    if (seen.has(e.name)) notes.push({ code: 'duplicate', key: e.key, name: e.name, message: `There are two bindings called ${e.name}.` });
    seen.add(e.name);
    // A Worker bound to itself is one service.
    const id = e.key === 'services' && e.resource === worker.label ? worker.id : serviceIdOf(product, e.resource ?? (WRANGLER_RESOURCE_FIELDS[e.key] ? e.name : undefined));
    // A Durable Object's class is in this Worker's code, unless the binding says whose.
    const host = e.key === 'durable_objects' ? { host: str(e.value.script_name) ? e.value.script_name : worker.id } : null;
    if (!services.has(id)) services.set(id, { id, kind: product, ...(e.resource ? { label: e.resource, resource: e.resource } : null), ...host, ...environment });
    edges.push({ id: uniqueId(edgeIdOf(worker.id, e.key, e.name)), from: worker.id, to: id, via: e.key, binding: e.name, ...entryFields(e) });
  }
  for (const c of consumersIn(section)) {
    const id = serviceIdOf('queues', c.queue);
    if (!services.has(id)) services.set(id, { id, kind: 'queues', label: c.queue, resource: c.queue, ...environment });
    const consumer = consumerSettings(c.value);
    edges.push({ id: uniqueId(consumerEdgeId(worker.id, c.queue)), from: id, to: worker.id, via: CONSUMER_VIA, ...(consumer ? { consumer } : null) });
  }
  const account = value(at(root, ['account_id']));
  const system: CloudflareSystem = { services: [...services.values()], edges, ...(str(account) ? { accountId: account } : null) };
  return { ok: true, system, worker: worker.id, envs, settings, notes };
}

/**
 * Every environment in a config, as one system: the top level's Worker and what it's bound to, and each `env` section's,
 * each in its environment (`environment`). What two environments are bound to alike, like one bucket, is in neither, as it's
 * shared. Each section is read as `readWrangler` reads it, so `writeWrangler(text, system, { env })` writes each one back.
 */
export function readWranglerEnvironments(text: string): WranglerEnvironmentsRead {
  const top = readWrangler(text);
  if (!top.ok) return top;
  const workers: Record<string, string> = { '': top.worker };
  const services = new Map(top.system.services.map((s) => [s.id, s]));
  const edges = [...top.system.edges];
  const notes = top.notes.filter((n) => n.code !== 'env-not-read');
  const shared = new Set<string>();
  for (const env of top.envs) {
    const read = readWrangler(text, { env });
    if (!read.ok) return read;
    workers[env] = read.worker;
    notes.push(...read.notes);
    for (const s of read.system.services) {
      const had = services.get(s.id);
      if (!had) services.set(s.id, s);
      else if (had.environment !== s.environment) shared.add(s.id);
    }
    edges.push(...read.system.edges.filter((e) => !edges.some((x) => x.id === e.id)));
  }
  const system: CloudflareSystem = {
    ...top.system,
    services: [...services.values()].map((s) => {
      if (!shared.has(s.id)) return s;
      const { environment: _, ...rest } = s;
      return rest;
    }),
    edges,
  };
  return { ok: true, system, workers, envs: top.envs, notes };
}

/* ── Comparing them ── */

interface Plan {
  section: readonly string[];
  parsed: Extract<Parsed, { ok: true }>;
  worker: string;
  differences: WranglerDifference[];
  /** What to do to the text, in terms of what's there, found again each time. */
  steps: Step[];
  needs: WranglerNeed[];
  skipped: { edge: string; reason: string }[];
  notes: WranglerNote[];
}

type Step =
  | { k: 'rename'; binding: CatalogBinding; from: string; to: string }
  | { k: 'resource'; binding: CatalogBinding; name: string; to: string | undefined }
  | { k: 'remove'; binding: CatalogBinding; name: string }
  | { k: 'add'; binding: CatalogBinding; fields: Record<string, unknown> }
  | { k: 'field'; binding: CatalogBinding; name: string; field: string; /** Left out, the field goes. */ value: unknown }
  | { k: 'remove-consumer'; queue: string }
  | { k: 'add-consumer'; queue: string; fields: Record<string, unknown> }
  | { k: 'consumer-field'; queue: string; field: string; value: unknown }
  | { k: 'set'; path: readonly string[]; /** Left out, the key goes. */ value: unknown }
  | { k: 'add-var'; name: string }
  | { k: 'remove-var'; name: string };

/** Whether what's at a binding's path, if anything, is what it should be. */
function canHold(section: Node, b: CatalogBinding): boolean {
  const parts = pathOf(b);
  for (let i = 1; i < parts.length; i++) {
    const on = at(section, parts.slice(0, i));
    if (on && on.type !== 'object') return false;
  }
  const here = at(section, parts);
  return !here || here.type === (b.container === 'array' ? 'array' : 'object');
}

/** Which service a config is for: the one it says, then the one asked for, then the only thing there that runs code. */
function pickWorker(system: CloudflareSystem, configName: string | undefined, asked: string | undefined): { id: string } | { reason: string } {
  if (asked) return system.services.some((s) => s.id === asked) ? { id: asked } : { reason: `There’s no service called ${asked} in this system.` };
  const named = system.services.find((s) => runsCode(s.kind) && (s.id === configName || s.label === configName));
  if (named) return { id: named.id };
  const runners = system.services.filter((s) => runsCode(s.kind));
  if (runners.length === 1) return { id: runners[0]!.id };
  if (!runners.length) return { reason: 'Nothing in this system runs code, so there’s nothing for a config to be for.' };
  return { reason: `A config is for one Worker, and this system has ${runners.map(serviceName).join(', ')}. Say which.` };
}

function plan(text: string, system: CloudflareSystem, options: WranglerOptions & { worker?: string }): { ok: true; plan: Plan } | { ok: false; reason: string } {
  const parsed = parse(text);
  if (!parsed.ok) return parsed;
  const { root } = parsed;
  const sectionPath = options.env === undefined ? [] : ['env', options.env];
  const section = options.env === undefined ? root : at(root, sectionPath);
  if (!section) return { ok: false, reason: envNames(root).length ? `There’s no env called ${options.env}. It has ${envNames(root).join(', ')}.` : `There’s no env called ${options.env}, as it has no env sections.` };
  const read = readWrangler(text, options);
  if (!read.ok) return read;
  const picked = pickWorker(system, read.worker, options.worker);
  if ('reason' in picked) return { ok: false, reason: picked.reason };
  const worker = picked.id;
  const byId = new Map(system.services.map((s) => [s.id, s]));

  const { entries, notes } = entriesIn(section);
  const differences: WranglerDifference[] = [], steps: Step[] = [], needs: WranglerNeed[] = [], skipped: { edge: string; reason: string }[] = [];

  /* What the system says this Worker's bound to. A binding reached through another's method, like `ai.gateway`, is that binding. */
  const wanted: { edge: CloudflareEdge; binding: CatalogBinding; name: string; to: CloudflareService }[] = [];
  const consumers: { edge: CloudflareEdge; queue: string; settings?: CloudflareConsumerSettings }[] = [];
  for (const e of system.edges) {
    const from = byId.get(e.from), to = byId.get(e.to);
    if (e.to === worker && e.via === CONSUMER_VIA && from) {
      const check = linkOf(e, from.kind, byId.get(worker)!.kind);
      if (!check.ok) { skipped.push({ edge: e.id, reason: check.reason }); continue; }
      const queue = from.resource ?? from.label ?? from.id;
      consumers.push({ edge: e, queue, settings: e.consumer });
      continue;
    }
    if (e.from !== worker) continue;
    const key = e.via.split('.')[0]!;
    const binding = catalogBinding(key);
    // A connection a config doesn't hold, like a Durable Object reaching its Container, isn't anything to write.
    if (!binding) continue;
    if (!to) { skipped.push({ edge: e.id, reason: `It goes to ${e.to}, which isn’t in this system.` }); continue; }
    const check = linkOf(e, from!.kind, to.kind);
    if (!check.ok) { skipped.push({ edge: e.id, reason: check.reason }); continue; }
    const name = edgeBinding(e, to);
    if (!name) { skipped.push({ edge: e.id, reason: 'It has no name on env.' }); continue; }
    // Reached through another's method, it's that binding, and a binding that's a key of its own is only the one.
    const earlier = wanted.find((w) => w.binding.key === key && (w.name === name || binding.container === 'object'));
    if (earlier && (e.via !== key || binding.container === 'object')) {
      if (earlier.name !== name) skipped.push({ edge: e.id, reason: `A Worker has one \`${key}\`, and that’s called ${earlier.name}.` });
      continue;
    }
    wanted.push({ edge: e, binding, name, to });
  }

  /* The same name, then what was read as this edge under another name, and what's left over is new, or gone. */
  const matched = new Set<Entry>();
  const unplaced: typeof wanted = [];
  const namesSeen = new Set<string>();
  for (const w of wanted) {
    const same = entries.find((en) => !matched.has(en) && en.key === w.binding.key && en.name === w.name);
    if (same) { matched.add(same); compareResource(same, w); } else if (namesSeen.has(`${w.binding.key}:${w.name}`)) skipped.push({ edge: w.edge.id, reason: `There’s already a binding called ${w.name}.` });
    else unplaced.push(w);
    namesSeen.add(`${w.binding.key}:${w.name}`);
  }
  function compareResource(entry: Entry, w: (typeof wanted)[number]) {
    const field = WRANGLER_RESOURCE_FIELDS[entry.key];
    const now = w.to.resource;
    if (!field || now === undefined || now === entry.resource) return;
    differences.push({ kind: 'resource', key: entry.key, name: entry.name, was: entry.resource, now, message: `${entry.name} is for ${now} in the system, and ${entry.resource ?? 'nothing'} in the config.` });
    steps.push({ k: 'resource', binding: entry.binding, name: entry.name, to: now });
  }
  /** A matched entry's fields past its name and resource: a service binding's entrypoint, a producer's delay, a Durable
   *  Object's Worker. What the system doesn't say is left as it is. */
  const desiredFields = (w: (typeof wanted)[number]): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    if (w.binding.key === 'services' && w.edge.entrypoint !== undefined) out.entrypoint = w.edge.entrypoint;
    if (w.binding.key === 'queues' && w.edge.deliveryDelay !== undefined) out.delivery_delay = w.edge.deliveryDelay;
    if (w.binding.key === 'durable_objects' && w.to.host !== undefined) {
      const host = byId.get(w.to.host);
      out.script_name = w.to.host === worker ? undefined : host?.label ?? w.to.host;
    }
    return out;
  };
  const compareFields = (entry: Entry, w: (typeof wanted)[number]) => {
    for (const [field, value] of Object.entries(desiredFields(w))) {
      if (same(entry.value[field], value)) continue;
      differences.push({ kind: 'setting', key: entry.key, name: w.name, was: entry.value[field] === undefined ? undefined : String(entry.value[field]), now: value === undefined ? undefined : String(value), message: value === undefined ? `${w.name} has \`${field}\` in the config, and not in the system.` : `${w.name}’s \`${field}\` is ${String(value)} in the system, and ${entry.value[field] === undefined ? 'not set' : String(entry.value[field])} in the config.` });
      steps.push({ k: 'field', binding: entry.binding, name: w.name, field, value });
    }
  };
  for (const w of wanted) {
    const entry = entries.find((en) => matched.has(en) && en.key === w.binding.key && en.name === w.name);
    if (entry) compareFields(entry, w);
  }
  const newOnes: typeof wanted = [];
  for (const w of unplaced) {
    const was = entries.find((en) => !matched.has(en) && en.key === w.binding.key && edgeIdOf(read.worker, en.key, en.name) === w.edge.id);
    if (was) {
      matched.add(was);
      differences.push({ kind: 'renamed', key: was.key, name: w.name, was: was.name, message: `${was.name}, in the config, is called ${w.name} in the system.` });
      steps.push({ k: 'rename', binding: was.binding, from: was.name, to: w.name });
      compareResource({ ...was, name: w.name }, w);
      compareFields({ ...was, name: w.name }, w);
    } else newOnes.push(w);
  }
  for (const en of entries) {
    if (matched.has(en)) continue;
    differences.push({ kind: 'removed', key: en.key, name: en.name, message: `${en.name} (${kindWord(en.binding)}) is in the config, and not in the system.` });
    steps.push({ k: 'remove', binding: en.binding, name: en.name });
  }
  for (const w of newOnes) {
    const b = w.binding;
    // What's there under that key isn't what it should be, and that isn't this to put right.
    if (!canHold(section, b)) { skipped.push({ edge: w.edge.id, reason: `\`${b.path}\` isn’t what it should be, so ${w.name} can’t be added to it.` }); continue; }
    const field = WRANGLER_RESOURCE_FIELDS[b.key];
    const resource = w.to.resource ?? (field && field !== 'id' ? w.to.label : undefined);
    const extra = Object.fromEntries(Object.entries(desiredFields(w)).filter(([, v]) => v !== undefined));
    const fields: Record<string, unknown> = { [b.nameField!]: w.name, ...(field && resource ? { [field]: resource } : null), ...extra };
    differences.push({ kind: 'added', key: b.key, name: w.name, now: resource, message: `${w.name} (${kindWord(b)}) is in the system, and not in the config.` });
    steps.push({ k: 'add', binding: b, fields });
    const missing = b.fields.filter((f) => f.required && !(f.name in fields)).map((f) => f.name);
    if (missing.length) needs.push({ key: b.key, name: w.name, fields: missing, message: `${w.name} needs ${missing.map((m) => `\`${m}\``).join(' and ')}, which a system doesn’t say, so that’s for you to fill in.` });
    if (b.key === 'durable_objects') needs.push({ key: b.key, name: w.name, fields: ['migrations'], message: `${w.name}’s class needs a migration, in \`migrations\`, before it can be deployed.` });
  }

  /* Queue consumers go by their queue. */
  const haveConsumers = consumersIn(section);
  const wantQueues = new Set(consumers.map((c) => c.queue));
  for (const c of haveConsumers) {
    if (wantQueues.has(c.queue)) continue;
    differences.push({ kind: 'removed', key: CONSUMER_KEY, name: c.queue, message: `The consumer of ${c.queue} is in the config, and not in the system.` });
    steps.push({ k: 'remove-consumer', queue: c.queue });
  }
  const consumerList = at(section, CONSUMER_KEY.split('.'));
  const holder = at(section, ['queues']);
  const consumerFields = (settings: CloudflareConsumerSettings | undefined): [string, unknown][] =>
    CONSUMER_FIELDS.flatMap(([field, key]) => (settings?.[field] !== undefined ? [[key, settings[field]] as [string, unknown]] : []));
  for (const c of consumers) {
    const had = haveConsumers.find((h) => h.queue === c.queue);
    if (had) {
      for (const [key, value] of consumerFields(c.settings)) {
        if (same(had.value[key], value)) continue;
        differences.push({ kind: 'setting', key: CONSUMER_KEY, name: c.queue, was: had.value[key] === undefined ? undefined : String(had.value[key]), now: String(value), message: `The consumer of ${c.queue}’s \`${key}\` is ${String(value)} in the system, and ${had.value[key] === undefined ? 'not set' : String(had.value[key])} in the config.` });
        steps.push({ k: 'consumer-field', queue: c.queue, field: key, value });
      }
      continue;
    }
    if ((holder && holder.type !== 'object') || (consumerList && consumerList.type !== 'array')) { skipped.push({ edge: c.edge.id, reason: `\`${CONSUMER_KEY}\` isn’t what it should be, so the consumer of ${c.queue} can’t be added to it.` }); continue; }
    differences.push({ kind: 'added', key: CONSUMER_KEY, name: c.queue, message: `The consumer of ${c.queue} is in the system, and not in the config.` });
    steps.push({ k: 'add-consumer', queue: c.queue, fields: Object.fromEntries(consumerFields(c.settings)) });
  }

  /* The Worker's own facts, compared as what they mean, so a file that says the same thing another way is left as it is. New
     ones go in ahead of its bindings, where a person would put them. */
  const bindingSteps = steps.splice(0);
  const me = byId.get(worker)!;
  const reading: Reading = { root, section, inherits: options.env !== undefined };
  const setting = (path: readonly string[], was: unknown, now: unknown, what: string) => {
    differences.push({ kind: 'setting', key: path.join('.'), name: path[path.length - 1]!, ...(was === undefined ? null : { was: JSON.stringify(was) }), ...(now === undefined ? null : { now: JSON.stringify(now) }), message: `${what} ${now === undefined ? 'isn’t in the system' : `is ${JSON.stringify(now)} in the system`}, and ${was === undefined ? 'isn’t in the config' : `${JSON.stringify(was)} in the config`}.` });
  };
  /** Sets a key to a value, or takes it out (or, if it's inherited, empties it), as it isn't what the system says. */
  const put = (path: readonly string[], value: unknown, empty: unknown) => {
    const own = at(section, path) !== undefined;
    if (value !== undefined) steps.push({ k: 'set', path, value });
    else if (own) steps.push({ k: 'set', path, value: undefined });
    if (value === undefined && reading.inherits && !own && at(root, path)) steps.push({ k: 'set', path, value: empty });
  };
  for (const { field, path } of SETTING_PATHS) {
    const now = me.settings?.[field];
    if (now === undefined) continue;
    const was = valueAt(reading, path);
    if (same(was, now)) continue;
    setting(path, was, now, `\`${path.join('.')}\``);
    put(path, now, undefined);
  }
  if (system.accountId !== undefined && !same(valueAt(reading, ['account_id']), system.accountId)) {
    setting(['account_id'], valueAt(reading, ['account_id']), system.accountId, 'The account');
    put(['account_id'], system.accountId, undefined);
  }
  if (me.triggers !== undefined) {
    const had = readTriggers(reading) ?? [];
    const routes = (list: readonly CloudflareTrigger[]) => list.flatMap((t) => (t.kind === 'route' ? [t] : []));
    const crons = (list: readonly CloudflareTrigger[]) => list.flatMap((t) => (t.kind === 'cron' ? [t.schedule] : []));
    const dev = (list: readonly CloudflareTrigger[]) => list.some((t) => t.kind === 'workers-dev');
    if (!same(routes(had), routes(me.triggers))) {
      const want = routes(me.triggers);
      setting(['routes'], routes(had).map((t) => t.pattern), want.map((t) => t.pattern), 'Its routes');
      if (at(section, ['route'])) steps.push({ k: 'set', path: ['route'], value: undefined });
      put(['routes'], want.length ? want.map(writeRoute) : undefined, []);
    }
    if (dev(had) !== dev(me.triggers)) {
      setting(['workers_dev'], dev(had), dev(me.triggers), '`workers_dev`');
      steps.push({ k: 'set', path: ['workers_dev'], value: dev(me.triggers) });
    }
    if (!same(crons(had), crons(me.triggers))) {
      setting(['triggers', 'crons'], crons(had), crons(me.triggers), 'Its cron schedules');
      put(['triggers', 'crons'], crons(me.triggers).length ? crons(me.triggers) : undefined, []);
    }
  }
  if (me.migrations !== undefined) {
    const had = readMigrations(reading);
    if (!same(had ?? [], me.migrations)) {
      setting(['migrations'], had?.map((m) => m.tag), me.migrations.map((m) => m.tag), 'Its Durable Object migrations');
      put(['migrations'], me.migrations.length ? me.migrations.map(writeMigration) : undefined, []);
    }
  }
  if (me.vars !== undefined) {
    const had = readVars(section) ?? [];
    for (const name of had) if (!me.vars.includes(name)) {
      differences.push({ kind: 'removed', key: 'vars', name, message: `${name} (a var) is in the config, and not in the system.` });
      steps.push({ k: 'remove-var', name });
    }
    for (const name of me.vars) if (!had.includes(name)) {
      differences.push({ kind: 'added', key: 'vars', name, message: `${name} (a var) is in the system, and not in the config.` });
      steps.push({ k: 'add-var', name });
      needs.push({ key: 'vars', name, fields: ['value'], message: `${name} needs a value, which a system doesn’t hold, so that’s for you to fill in.` });
    }
  }
  steps.push(...bindingSteps);
  return { ok: true, plan: { section: sectionPath, parsed, worker, differences, steps, needs, skipped, notes } };
}

/** Where a config and a system differ, by name. */
export function compareWrangler(text: string, system: CloudflareSystem, options: WranglerOptions & { worker?: string } = {}): WranglerCompare {
  const made = plan(text, system, options);
  if (!made.ok) return made;
  return { ok: true, differences: made.plan.differences, notes: made.plan.notes, skipped: made.plan.skipped };
}

/* ── Editing the text ── */

const eolOf = (text: string) => (text.includes('\r\n') ? '\r\n' : '\n');
const lineStart = (text: string, i: number) => {
  let at = i;
  while (at > 0 && text[at - 1] !== '\n' && text[at - 1] !== '\r') at--;
  return at;
};
const lineEnd = (text: string, i: number) => {
  let at = i;
  while (at < text.length && text[at] !== '\n' && text[at] !== '\r') at++;
  return at;
};
const indentAt = (text: string, i: number) => /^[ \t]*/.exec(text.slice(lineStart(text, i), i))![0];
const sameLine = (text: string, a: number, b: number) => !/[\r\n]/.test(text.slice(a, b));

/** The next thing that isn't space or a comment, from here. */
function skipSpace(text: string, from: number): number {
  let i = from;
  for (;;) {
    while (i < text.length && /\s/.test(text[i]!)) i++;
    if (text.startsWith('//', i)) i = lineEnd(text, i);
    else if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 2;
    } else return i;
  }
}
const commaAfter = (text: string, node: Node): number | null => {
  const i = skipSpace(text, node.offset + node.length);
  return text[i] === ',' ? i : null;
};

/** Cuts ranges out, and a line that's left with nothing on it. */
function cut(text: string, ranges: readonly (readonly [number, number])[]): string {
  let out = text;
  for (const [a, b] of [...ranges].sort((x, y) => y[0] - x[0])) {
    out = out.slice(0, a) + out.slice(b);
    const start = lineStart(out, a), end = lineEnd(out, a);
    // What was cut was all that was on that line, so the line goes too.
    if (/^[ \t]*$/.test(out.slice(start, end))) {
      const eol = out.startsWith('\r\n', end) ? 2 : out[end] === '\n' || out[end] === '\r' ? 1 : 0;
      if (eol) out = out.slice(0, start) + out.slice(end + eol);
    }
  }
  return out;
}

/** Takes one thing out of an array or an object, and the comma that went with it, and leaves any comments. */
function removeFrom(text: string, container: Node, index: number): string {
  const items = container.children!;
  const item = items[index]!;
  const start = item.offset, end = item.offset + item.length;
  // Alone at the start of its line, what's after it there, a comment perhaps, takes its place, at the same indent.
  const alone = /^[ \t]*$/.test(text.slice(lineStart(text, start), start));
  const past = (i: number) => {
    let at = i;
    while (alone && (text[at] === ' ' || text[at] === '\t')) at++;
    return at;
  };
  const own = commaAfter(text, item);
  const next = items[index + 1];
  if (own !== null) {
    // A comment before its comma stays where it is.
    if (text.slice(end, own).trim()) return cut(text, [[start, past(end)], [own, own + 1]]);
    // With another after it on the same line, what's between goes too, unless there's a comment in it.
    return cut(text, [[start, next && sameLine(text, end, next.offset) && skipSpace(text, own + 1) === next.offset ? next.offset : past(own + 1)]]);
  }
  const prev = items[index - 1];
  if (!prev) return cut(text, [[start, past(end)]]);
  const comma = commaAfter(text, prev)!;
  // The comma before it goes, and what's between that and it, if that's only space on one line.
  const between = text.slice(comma + 1, start);
  return /^[ \t]*$/.test(between) ? cut(text, [[comma, end]]) : cut(text, [[comma, comma + 1], [start, past(end)]]);
}

/** Puts something at the end of an array or an object, as what's there is laid out. */
function appendTo(text: string, container: Node, json: string): string {
  const eol = eolOf(text);
  const close = container.offset + container.length - 1;
  const items = container.children ?? [];
  const last = items[items.length - 1];
  const insert = (at: number, what: string) => text.slice(0, at) + what + text.slice(at);
  if (!last) {
    const inside = text.slice(container.offset + 1, close);
    if (!inside.trim()) return `${text.slice(0, container.offset + 1)}${container.type === 'object' ? ` ${json} ` : json}${text.slice(close)}`;
    // Only comments in there. They stay, and it goes after them.
    const indent = indentAt(text, container.offset);
    if (sameLine(text, container.offset, close)) return insert(close, /\s/.test(text[close - 1]!) ? `${json} ` : ` ${json} `);
    return insert(lineStart(text, close), `${indent}${unit(text)}${json}${eol}`);
  }
  const end = last.offset + last.length;
  const trailing = commaAfter(text, last);
  if (sameLine(text, end, close)) {
    // On one line: straight after the last one, with what space there was before the close left where it is.
    return trailing === null ? insert(end, `, ${json}`) : insert(trailing + 1, ` ${json}`);
  }
  // On lines of its own: after the last one's line, with a trailing comment staying on that line.
  const indent = indentAt(text, last.offset);
  const lineAt = lineEnd(text, trailing ?? end);
  const withNew = `${text.slice(0, lineAt)}${eol}${indent}${json}${trailing === null ? '' : ','}${text.slice(lineAt)}`;
  return trailing === null ? withNew.slice(0, end) + ',' + withNew.slice(end) : withNew;
}

/** One step of indenting, as this file does it. */
function unit(text: string): string {
  const m = /\r?\n([ \t]+)\S/.exec(text);
  return m?.[1]?.[0] === '\t' ? '\t' : m?.[1] ?? '  ';
}

/** A value as JSON on one line, spaced as a person would write it: `{ "a": 1 }`, `["a", "b"]`. */
function inline(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (isPlain(value)) {
    const fields = Object.entries(value).filter(([, v]) => v !== undefined);
    return fields.length ? `{ ${fields.map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`).join(', ')} }` : '{}';
  }
  return JSON.stringify(value);
}
const flat = (fields: Readonly<Record<string, unknown>>) => inline(fields);

function setField(text: string, entry: Node, field: string, value: unknown): string {
  const props = propsOf(entry);
  const prop = props.filter((p) => keyOf(p) === field).pop();
  const node = prop?.children?.[1];
  if (value === undefined) return prop ? removeFrom(text, entry, props.indexOf(prop)) : text;
  if (node) return text.slice(0, node.offset) + inline(value) + text.slice(node.offset + node.length);
  return appendTo(text, entry, `${JSON.stringify(field)}: ${inline(value)}`);
}

/** Sets what's at a path in a section, making the objects on the way that aren't there yet, or takes it out. */
function setPath(text: string, section: Node, path: readonly string[], value: unknown): string {
  let holder = section, i = 0;
  for (; i < path.length - 1; i++) {
    const next = at(holder, [path[i]!]);
    if (!next) break;
    // Something that isn't an object is in the way, and that isn't this to put right.
    if (next.type !== 'object') return text;
    holder = next;
  }
  if (i === path.length - 1) return setField(text, holder, path[i]!, value);
  if (value === undefined) return text;
  const rest = path.slice(i);
  const nested = rest.slice(1).reduceRight((inner, key) => `{ ${JSON.stringify(key)}: ${inner} }`, inline(value));
  return appendTo(text, holder, `${JSON.stringify(rest[0])}: ${nested}`);
}

function sectionIn(text: string, sectionPath: readonly string[]): Node {
  const root = parseTree(text, [], { allowTrailingComma: true })!;
  return sectionPath.length ? at(root, sectionPath)! : root;
}

function applyStep(text: string, sectionPath: readonly string[], step: Step): string {
  const section = sectionIn(text, sectionPath);
  const find = (b: CatalogBinding, name: string) => entriesIn(section).entries.find((e) => e.binding.key === b.key && e.name === name);
  switch (step.k) {
    case 'rename': {
      const e = find(step.binding, step.from)!;
      return setField(text, e.node, step.binding.nameField!, step.to);
    }
    case 'resource': {
      const e = find(step.binding, step.name)!;
      return setField(text, e.node, WRANGLER_RESOURCE_FIELDS[step.binding.key]!, step.to!);
    }
    case 'remove': {
      const e = find(step.binding, step.name)!;
      if (e.index !== null) return removeFrom(text, at(section, pathOf(step.binding))!, e.index);
      // A binding that's an object is a key of its own.
      const parts = pathOf(step.binding);
      const holder = parts.length > 1 ? at(section, parts.slice(0, -1))! : section;
      const index = holder.children!.findIndex((p) => keyOf(p) === parts[parts.length - 1]);
      return removeFrom(text, holder, index);
    }
    case 'add': {
      const parts = pathOf(step.binding);
      const json = flat(step.fields);
      if (step.binding.container === 'object') {
        // There with no name yet, it's only the name that's missing.
        if (!at(section, parts)) return appendTo(text, section, `${JSON.stringify(step.binding.key)}: ${json}`);
        return Object.entries(step.fields).reduce((t, [k, v]) => setField(t, at(sectionIn(t, sectionPath), parts)!, k, v), text);
      }
      return appendAt(text, section, parts, json);
    }
    case 'remove-consumer': {
      const c = consumersIn(section).find((x) => x.queue === step.queue)!;
      return removeFrom(text, at(section, CONSUMER_KEY.split('.'))!, c.index);
    }
    case 'add-consumer':
      return appendAt(text, section, CONSUMER_KEY.split('.'), flat({ queue: step.queue, ...step.fields }));
    case 'consumer-field': {
      const c = consumersIn(section).find((x) => x.queue === step.queue)!;
      return setField(text, c.node, step.field, step.value);
    }
    case 'field': {
      const e = find(step.binding, step.name)!;
      return setField(text, e.node, step.field, step.value);
    }
    case 'set':
      return setPath(text, section, step.path, step.value);
    case 'add-var':
      return setPath(text, section, ['vars', step.name], '');
    case 'remove-var':
      return setPath(text, section, ['vars', step.name], undefined);
    default:
      return text;
  }
}

/** Puts something in the list at a path, making what isn't there yet. */
function appendAt(text: string, section: Node, parts: readonly string[], json: string): string {
  const list = at(section, parts);
  if (list) return appendTo(text, list, json);
  let holder = section, i = 0;
  for (; i < parts.length - 1; i++) {
    const next = at(holder, [parts[i]!]);
    if (!next) break;
    holder = next;
  }
  const rest = parts.slice(i);
  const value = rest.slice(1).reduceRight((inner, key) => `{ ${JSON.stringify(key)}: ${inner} }`, `[${json}]`);
  return appendTo(text, holder, `${JSON.stringify(rest[0])}: ${value}`);
}

/* ── Out to the file ── */

/** A config with a system's bindings for its Worker written to it, and the rest of the file as it was. */
export function writeWrangler(text: string, system: CloudflareSystem, options: WranglerOptions & { worker?: string } = {}): WranglerWrite {
  const made = plan(text, system, options);
  if (!made.ok) return made;
  const { parsed, differences, steps, needs, skipped, section } = made.plan;
  let body = parsed.body;
  for (const step of steps) body = applyStep(body, section, step);
  return { ok: true, text: parsed.bom + body, differences, needs, skipped };
}
