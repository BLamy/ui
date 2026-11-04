/* ══ A system and `wrangler.jsonc`, both ways ══
   Reads a Worker's config into a system, writes a system's bindings back to that file, and says where the two differ. It's files
   only: nothing's deployed, and no account comes into it.

   Writing changes only what changed. It edits the file's text, and doesn't print a copy of what it read, so the rest of the file,
   its comments and how it's laid out stay as they are, byte for byte. A config with nothing to change comes back identical. */
import { findNodeAtLocation, getNodeValue, parseTree, printParseErrorCode, type Node, type ParseError } from 'jsonc-parser';
import type { CatalogBinding } from '@/lib/cloudflare-catalog';
import { CLOUDFLARE_CATALOG as C } from '@/lib/cloudflare-catalog.generated';
import { catalogBinding, isOwnSetting, linkOf, runsCode, type CloudflareEdge, type CloudflareService } from '@/lib/cloudflare-services';
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

export interface WranglerDifference {
  /** `added`: in the system, and not in the config. `removed`: in the config, and not in the system. `renamed`: the same thing, under
   *  another name. `resource`: the same name, for something else, like another bucket. */
  kind: 'added' | 'removed' | 'renamed' | 'resource';
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
  const bom = text.startsWith('﻿') ? '﻿' : '';
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
      entries.push({ binding: b, key: b.key, name, ...(resource ? { resource } : null), node: el, index });
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
}

function consumersIn(section: Node): Consumer[] {
  const node = at(section, CONSUMER_KEY.split('.'));
  if (node?.type !== 'array') return [];
  return (node.children ?? []).flatMap((el, index) => {
    const value = getNodeValue(el) as unknown;
    return isPlain(value) && typeof value.queue === 'string' && value.queue ? [{ queue: value.queue, node: el, index }] : [];
  });
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
  const worker: CloudflareService = {
    id: named ?? 'worker',
    kind: value(at(root, ['pages_build_output_dir'])) !== undefined ? 'pages' : 'workers',
    ...(named ? { label: named } : null),
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
    if (!services.has(id)) services.set(id, { id, kind: product, ...(e.resource ? { label: e.resource, resource: e.resource } : null) });
    edges.push({ id: uniqueId(edgeIdOf(worker.id, e.key, e.name)), from: worker.id, to: id, via: e.key, binding: e.name });
  }
  for (const c of consumersIn(section)) {
    const id = serviceIdOf('queues', c.queue);
    if (!services.has(id)) services.set(id, { id, kind: 'queues', label: c.queue, resource: c.queue });
    edges.push({ id: uniqueId(consumerEdgeId(worker.id, c.queue)), from: id, to: worker.id, via: CONSUMER_VIA });
  }
  return { ok: true, system: { services: [...services.values()], edges }, worker: worker.id, envs, settings, notes };
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
  | { k: 'add'; binding: CatalogBinding; fields: Record<string, string> }
  | { k: 'remove-consumer'; queue: string }
  | { k: 'add-consumer'; queue: string };

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
  const consumers: { edge: CloudflareEdge; queue: string }[] = [];
  for (const e of system.edges) {
    const from = byId.get(e.from), to = byId.get(e.to);
    if (e.to === worker && e.via === CONSUMER_VIA && from) {
      const check = linkOf(e, from.kind, byId.get(worker)!.kind);
      if (!check.ok) { skipped.push({ edge: e.id, reason: check.reason }); continue; }
      const queue = from.resource ?? from.label ?? from.id;
      consumers.push({ edge: e, queue });
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
  const newOnes: typeof wanted = [];
  for (const w of unplaced) {
    const was = entries.find((en) => !matched.has(en) && en.key === w.binding.key && edgeIdOf(read.worker, en.key, en.name) === w.edge.id);
    if (was) {
      matched.add(was);
      differences.push({ kind: 'renamed', key: was.key, name: w.name, was: was.name, message: `${was.name}, in the config, is called ${w.name} in the system.` });
      steps.push({ k: 'rename', binding: was.binding, from: was.name, to: w.name });
      compareResource({ ...was, name: w.name }, w);
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
    const fields: Record<string, string> = { [b.nameField!]: w.name, ...(field && resource ? { [field]: resource } : null) };
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
  for (const c of consumers) {
    if (haveConsumers.some((h) => h.queue === c.queue)) continue;
    if ((holder && holder.type !== 'object') || (consumerList && consumerList.type !== 'array')) { skipped.push({ edge: c.edge.id, reason: `\`${CONSUMER_KEY}\` isn’t what it should be, so the consumer of ${c.queue} can’t be added to it.` }); continue; }
    differences.push({ kind: 'added', key: CONSUMER_KEY, name: c.queue, message: `The consumer of ${c.queue} is in the system, and not in the config.` });
    steps.push({ k: 'add-consumer', queue: c.queue });
  }
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
    // With another after it on the same line, what's between goes too, unless there's a comment in it.
    const until = next && sameLine(text, end, next.offset) && skipSpace(text, own + 1) === next.offset ? next.offset : past(own + 1);
    return text.slice(end, own).trim() ? cut(text, [[start, end], [own, until]]) : cut(text, [[start, until]]);
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

const flat = (fields: Readonly<Record<string, string>>) => `{ ${Object.entries(fields).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`;

function setField(text: string, entry: Node, field: string, value: string): string {
  const prop = propsOf(entry).filter((p) => keyOf(p) === field).pop();
  const node = prop?.children?.[1];
  if (node) return text.slice(0, node.offset) + JSON.stringify(value) + text.slice(node.offset + node.length);
  return appendTo(text, entry, `${JSON.stringify(field)}: ${JSON.stringify(value)}`);
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
      return appendAt(text, section, CONSUMER_KEY.split('.'), flat({ queue: step.queue }));
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
