/* ══ A Cloudflare system, as data ══
   A small document: which services, what each is called and bound as, which have a machine, and which events cross which edge.
   It saves as JSON. Reading one never throws, as it can have been edited by hand: what can't be used is left out and said, and
   what's left can still be looked at. `validateSystem` says what's wrong with one that reads. */
import type { CatalogProduct } from '@/lib/cloudflare-catalog';
import { CLOUDFLARE_CATALOG as C } from '@/lib/cloudflare-catalog.generated';
import {
  catalogBinding, catalogProduct, handlerNames, linkOf, runsCode,
  type CloudflareConsumerSettings, type CloudflareEdge, type CloudflareMigration, type CloudflareService, type CloudflareSettings, type CloudflareTrigger,
} from '@/lib/cloudflare-services';
import { inlineCodeIn } from '@/lib/state-diagram-edit';
import { machineToDraft, type StateMachineLike } from '@/lib/state-diagram-model';

export interface CloudflareSystem {
  services: readonly CloudflareService[];
  edges: readonly CloudflareEdge[];
  /** What the system's called, drawn in its header. */
  name?: string;
  /** The Cloudflare account it's on (wrangler's `account_id`). */
  accountId?: string;
}

export interface SystemIssue {
  /** An `error` is something that isn't so. A `warning` could be fine, or not finished yet. */
  severity: 'error' | 'warning';
  code: string;
  message: string;
  service?: string;
  edge?: string;
}

export const EMPTY_SYSTEM: CloudflareSystem = { services: [], edges: [] };

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** How far from the middle a place can be. Past that, it's a mistake, and fitting it all in the view would leave nothing to see. */
const FARTHEST = 10_000_000;
const isPlace = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= FARTHEST;
const areStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/* ── Saving and loading ── */

const SERVICE_KEYS = new Set(['id', 'kind', 'label', 'at', 'binding', 'resource', 'machine', 'host', 'environment', 'handlers', 'triggers', 'settings', 'vars', 'migrations']);
const EDGE_KEYS = new Set(['id', 'from', 'to', 'via', 'binding', 'operations', 'events', 'entrypoint', 'deliveryDelay', 'consumer']);
const SYSTEM_KEYS = new Set(['name', 'accountId', 'services', 'edges']);

/** As JSON, with what's on each in a set order, so that a change shows as that change. */
export function systemToJson(system: CloudflareSystem): string {
  const service = ({ id, kind, label, binding, resource, at, machine, host, environment, handlers, triggers, settings, vars, migrations }: CloudflareService) =>
    ({ id, kind, label, binding, resource, at, machine, host, environment, handlers, triggers, settings, vars, migrations });
  const edge = ({ id, from, to, via, binding, operations, events, entrypoint, deliveryDelay, consumer }: CloudflareEdge) =>
    ({ id, from, to, via, binding, operations, events, entrypoint, deliveryDelay, consumer });
  const { name, accountId } = system;
  return `${JSON.stringify({ name, accountId, services: system.services.map(service), edges: system.edges.map(edge) }, null, 2)}\n`;
}

/* What each of a service's and an edge's facts can be, read leniently: what isn't right is left out, and said. */
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const SETTING_READERS: Readonly<Record<keyof CloudflareSettings, (v: unknown) => boolean>> = {
  main: (v) => typeof v === 'string',
  compatibilityDate: (v) => typeof v === 'string',
  compatibilityFlags: areStrings,
  placement: (v) => typeof v === 'string',
  cpuMs: isCount,
  subrequests: isCount,
  observability: (v) => typeof v === 'boolean',
  headSamplingRate: (v) => typeof v === 'number' && v >= 0 && v <= 1,
  logpush: (v) => typeof v === 'boolean',
};
const CONSUMER_READERS: Readonly<Record<keyof CloudflareConsumerSettings, (v: unknown) => boolean>> = {
  batchSize: isCount, batchTimeout: isCount, retries: isCount, retryDelay: isCount, concurrency: isCount,
  deadLetterQueue: (v) => typeof v === 'string' && !!v,
};
/** The fields of an object that read, by a table of what each can be, and the names of those that don't. */
function readFields<T>(v: Record<string, unknown>, readers: Readonly<Record<string, (v: unknown) => boolean>>): { value: T; wrong: string[] } {
  const value: Record<string, unknown> = {}, wrong: string[] = [];
  for (const [key, x] of Object.entries(v)) {
    if (readers[key]?.(x)) value[key] = Array.isArray(x) ? [...x] : x;
    else wrong.push(key);
  }
  return { value: value as T, wrong };
}
function readTrigger(v: unknown): CloudflareTrigger | null {
  if (!isPlain(v)) return null;
  const str = (x: unknown): x is string => typeof x === 'string' && !!x;
  switch (v.kind) {
    case 'route': return str(v.pattern) ? { kind: 'route', pattern: v.pattern, ...(str(v.zone) ? { zone: v.zone } : null), ...(v.customDomain === true ? { customDomain: true } : null) } : null;
    case 'workers-dev': return { kind: 'workers-dev' };
    case 'cron': return str(v.schedule) ? { kind: 'cron', schedule: v.schedule } : null;
    case 'socket': return str(v.name) ? { kind: 'socket', name: v.name, ...(str(v.address) ? { address: v.address } : null) } : null;
    case 'email': return str(v.address) ? { kind: 'email', address: v.address } : null;
    default: return null;
  }
}
function readMigration(v: unknown): CloudflareMigration | null {
  if (!isPlain(v) || typeof v.tag !== 'string' || !v.tag) return null;
  const m: CloudflareMigration = { tag: v.tag };
  if (areStrings(v.newSqliteClasses)) m.newSqliteClasses = [...v.newSqliteClasses];
  if (areStrings(v.newClasses)) m.newClasses = [...v.newClasses];
  if (areStrings(v.deletedClasses)) m.deletedClasses = [...v.deletedClasses];
  if (Array.isArray(v.renamedClasses)) {
    const renamed = v.renamedClasses.filter((r): r is { from: string; to: string } => isPlain(r) && typeof r.from === 'string' && typeof r.to === 'string');
    if (renamed.length) m.renamedClasses = renamed.map(({ from, to }) => ({ from, to }));
  }
  return m;
}

/** Reads a system. It never throws: what can't be used is left out, and said. */
export function parseSystem(text: string): { system: CloudflareSystem; issues: SystemIssue[] } {
  const issues: SystemIssue[] = [];
  const bad = (code: string, message: string, more?: Partial<SystemIssue>) => { issues.push({ severity: 'error', code, message, ...more }); };
  const odd = (code: string, message: string, more?: Partial<SystemIssue>) => { issues.push({ severity: 'warning', code, message, ...more }); };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    bad('json', `That isn’t JSON: ${e instanceof Error ? e.message : String(e)}`);
    return { system: { services: [], edges: [] }, issues };
  }
  if (!isPlain(raw)) {
    bad('shape', 'A system is an object, with `services` and `edges`.');
    return { system: { services: [], edges: [] }, issues };
  }
  if (raw.services !== undefined && !Array.isArray(raw.services)) bad('shape', '`services` has to be a list.');
  if (raw.edges !== undefined && !Array.isArray(raw.edges)) bad('shape', '`edges` has to be a list.');
  for (const key of Object.keys(raw)) if (!SYSTEM_KEYS.has(key)) odd('unknown-field', `A system doesn’t have \`${key}\`, so it’s been left out.`);
  for (const key of ['name', 'accountId'] as const) if (raw[key] !== undefined && typeof raw[key] !== 'string') odd('shape', `A system’s \`${key}\` has to be text, so it’s been left out.`);

  const services: CloudflareService[] = [];
  const seen = new Set<string>();
  (Array.isArray(raw.services) ? raw.services : []).forEach((s: unknown, i: number) => {
    const where = `services[${i}]`;
    if (!isPlain(s)) { bad('service-shape', `${where} isn’t a service.`); return; }
    if (typeof s.id !== 'string' || !s.id) { bad('service-shape', `${where} has no \`id\`.`); return; }
    if (typeof s.kind !== 'string' || !s.kind) { bad('service-shape', `${s.id} has no \`kind\`.`, { service: s.id }); return; }
    if (seen.has(s.id)) { bad('service-duplicate', `There are two services called ${s.id}. The second’s been left out.`, { service: s.id }); return; }
    seen.add(s.id);
    const made: CloudflareService = { id: s.id, kind: s.kind };
    const id = s.id;
    const leftOut = (field: string, should: string) => odd('service-field', `${id}: \`${field}\` has to be ${should}, so it’s been left out.`, { service: id });
    for (const field of ['label', 'binding', 'resource', 'host', 'environment'] as const) {
      const v = s[field];
      if (typeof v === 'string') made[field] = v;
      else if (v !== undefined) leftOut(field, 'text');
    }
    if (isPlain(s.at) && isPlace(s.at.x) && isPlace(s.at.y)) made.at = { x: s.at.x as number, y: s.at.y as number };
    else if (s.at !== undefined) leftOut('at', `numbers, up to ${FARTHEST} from the middle`);
    if (isPlain(s.machine)) made.machine = s.machine;
    else if (s.machine !== undefined) bad('service-field', `${s.id}: \`machine\` has to be a machine’s config, so it’s been left out.`, { service: s.id });
    for (const field of ['handlers', 'vars'] as const) {
      if (areStrings(s[field])) made[field] = [...s[field]];
      else if (s[field] !== undefined) leftOut(field, 'a list of names');
    }
    if (Array.isArray(s.triggers)) {
      const read = s.triggers.map(readTrigger);
      made.triggers = read.filter((t): t is CloudflareTrigger => !!t);
      if (read.some((t) => !t)) leftOut('triggers', 'a route, workers-dev, a cron, a socket or an email address, each');
    } else if (s.triggers !== undefined) leftOut('triggers', 'a list');
    if (isPlain(s.settings)) {
      const { value, wrong } = readFields<CloudflareSettings>(s.settings, SETTING_READERS);
      made.settings = value;
      for (const key of wrong) leftOut(`settings.${key}`, 'one of a service’s settings, of the right type');
    } else if (s.settings !== undefined) leftOut('settings', 'an object');
    if (Array.isArray(s.migrations)) {
      const read = s.migrations.map(readMigration);
      made.migrations = read.filter((m): m is CloudflareMigration => !!m);
      if (read.some((m) => !m)) leftOut('migrations', 'a migration with a `tag`, each');
    } else if (s.migrations !== undefined) leftOut('migrations', 'a list');
    for (const key of Object.keys(s)) if (!SERVICE_KEYS.has(key)) odd('unknown-field', `${s.id} has \`${key}\`, which a service doesn’t have, so it’s been left out.`, { service: s.id });
    services.push(made);
  });

  const edges: CloudflareEdge[] = [];
  const edgeIds = new Set<string>();
  (Array.isArray(raw.edges) ? raw.edges : []).forEach((e: unknown, i: number) => {
    const where = `edges[${i}]`;
    if (!isPlain(e)) { bad('edge-shape', `${where} isn’t an edge.`); return; }
    if (typeof e.from !== 'string' || typeof e.to !== 'string' || typeof e.via !== 'string') { bad('edge-shape', `${where} needs \`from\`, \`to\` and \`via\`, as text.`); return; }
    let id = typeof e.id === 'string' && e.id ? e.id : `${e.from}-${e.via}`;
    if (edgeIds.has(id)) {
      if (typeof e.id === 'string') bad('edge-duplicate', `There are two edges called ${id}. The second’s been given another name.`, { edge: id });
      let n = 2;
      while (edgeIds.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    edgeIds.add(id);
    const made: CloudflareEdge = { id, from: e.from, to: e.to, via: e.via };
    const leftOut = (field: string, should: string) => odd('edge-field', `${id}: \`${field}\` has to be ${should}, so it’s been left out.`, { edge: id });
    for (const field of ['binding', 'entrypoint'] as const) {
      const v = e[field];
      if (typeof v === 'string') made[field] = v;
      else if (v !== undefined) leftOut(field, 'text');
    }
    for (const field of ['operations', 'events'] as const) {
      if (areStrings(e[field])) made[field] = [...e[field]];
      else if (e[field] !== undefined) leftOut(field, 'a list of text');
    }
    if (isCount(e.deliveryDelay)) made.deliveryDelay = e.deliveryDelay;
    else if (e.deliveryDelay !== undefined) leftOut('deliveryDelay', 'a number of seconds');
    if (isPlain(e.consumer)) {
      const { value, wrong } = readFields<CloudflareConsumerSettings>(e.consumer, CONSUMER_READERS);
      made.consumer = value;
      for (const key of wrong) leftOut(`consumer.${key}`, 'one of a consumer’s settings, of the right type');
    } else if (e.consumer !== undefined) leftOut('consumer', 'an object');
    for (const key of Object.keys(e)) if (!EDGE_KEYS.has(key)) odd('unknown-field', `${id} has \`${key}\`, which an edge doesn’t have, so it’s been left out.`, { edge: id });
    edges.push(made);
  });
  const system: CloudflareSystem = { services, edges };
  if (typeof raw.name === 'string') system.name = raw.name;
  if (typeof raw.accountId === 'string') system.accountId = raw.accountId;
  return { system, issues };
}

/* ── What a machine can receive ── */

/** Every event a machine's config has a transition for, anywhere in it. `*` means it'll take anything. */
export function machineEvents(config: unknown): { events: string[]; anything: boolean } {
  const events = new Set<string>();
  let anything = false;
  const walk = (s: unknown) => {
    if (!isPlain(s)) return;
    if (isPlain(s.on)) for (const key of Object.keys(s.on)) {
      if (key === '*') anything = true;
      else events.add(key);
    }
    if (isPlain(s.states)) Object.values(s.states).forEach(walk);
  };
  walk(config);
  return { events: [...events].sort(), anything };
}

/** Whether a config has a transition for an event. `error.*` takes `error` and `error.bad`, as it does in XState. */
export function machineReceives(config: unknown, event: string): boolean {
  const { events, anything } = machineEvents(config);
  if (anything || events.includes(event)) return true;
  return events.some((e) => e.endsWith('.*') && (event === e.slice(0, -2) || event.startsWith(e.slice(0, -1))));
}

/** The machines an edge's events get to: what it goes to, or if that has none, whatever's past that, like a consumer past a Queue. */
export function machinesPast(system: CloudflareSystem, edge: Pick<CloudflareEdge, 'to'>): CloudflareService[] {
  const byId = new Map(system.services.map((s) => [s.id, s]));
  const found: CloudflareService[] = [];
  const seen = new Set<string>();
  const queue = [edge.to];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const s = byId.get(id);
    if (!s) continue;
    if (s.machine) { found.push(s); continue; }
    for (const e of system.edges) if (e.from === id) queue.push(e.to);
  }
  return found;
}

/* ── What's drawn on a service's card ── */

/** One thing a card says, as a chip: its words, and a quieter second part. `kind` picks its glyph. */
export interface CloudflareFact {
  kind: 'handler' | 'binding' | 'var' | 'route' | 'custom-domain' | 'workers-dev' | 'cron' | 'socket' | 'email' | 'setting' | 'resource' | 'storage' | 'migration' | 'machine' | 'account' | 'zone' | 'environment';
  label: string;
  detail?: string;
}

/** A labelled section of a card, or of the system's header. Only the sections a service has are made. */
export interface CloudflareFactSection {
  id: 'handlers' | 'bindings' | 'triggers' | 'settings' | 'machine' | 'account';
  title: string;
  items: CloudflareFact[];
}

/** Where things come in to the system from outside: requests (a route, a custom domain, workers.dev, a socket), schedules (a
 *  cron) and messages (mail). */
export type CloudflareEntry = 'request' | 'schedule' | 'message';

/** How the catalog words what's behind a binding to a product, for its resource: `bucket uploads`. */
const RESOURCE_NOUN: Readonly<Record<string, string>> = {
  r2: 'bucket', d1: 'database', kv: 'namespace', queues: 'queue', 'durable-objects': 'class', workflows: 'workflow', vectorize: 'index',
  hyperdrive: 'config', 'workers-analytics-engine': 'dataset', 'basin-pipelines': 'stream', 'ai-search': 'instance', 'secrets-store': 'secret',
};

/** What each trigger's for, as an entry. */
const TRIGGER_ENTRY: Readonly<Record<CloudflareTrigger['kind'], CloudflareEntry>> = {
  route: 'request', 'workers-dev': 'request', socket: 'request', cron: 'schedule', email: 'message',
};
/** The handler a trigger calls. */
const TRIGGER_HANDLER: Readonly<Record<CloudflareTrigger['kind'], string>> = {
  route: 'fetch', 'workers-dev': 'fetch', socket: 'fetch', cron: 'scheduled', email: 'email',
};

/** The ways in to a service from outside the system, each once, in that order. */
export function serviceEntries(service: CloudflareService): CloudflareEntry[] {
  const found = new Set((service.triggers ?? []).map((t) => TRIGGER_ENTRY[t.kind]));
  return (['request', 'schedule', 'message'] as const).filter((e) => found.has(e));
}

/** A service's handlers: those it says it has, and those its triggers and what reaches it say it must have, in the catalog's
 *  order for its kind. */
export function serviceHandlers(system: CloudflareSystem, service: CloudflareService): string[] {
  const have = new Set(service.handlers ?? []);
  for (const t of service.triggers ?? []) have.add(TRIGGER_HANDLER[t.kind]);
  for (const e of system.edges) {
    if (e.to !== service.id) continue;
    if (e.via === 'queue-consumer') have.add('queue');
    else if (e.via === 'tail') have.add('tail');
  }
  if (service.kind === 'workflows') have.add('run');
  const order = handlerNames(service.kind);
  const rank = (h: string) => (order.includes(h) ? order.indexOf(h) : order.length);
  return [...have].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

const triggerFact = (t: CloudflareTrigger): CloudflareFact => {
  switch (t.kind) {
    case 'route': return { kind: t.customDomain ? 'custom-domain' : 'route', label: t.pattern, detail: t.customDomain ? 'custom domain' : t.zone ? `on ${t.zone}` : 'route' };
    case 'workers-dev': return { kind: 'workers-dev', label: 'workers.dev' };
    case 'cron': return { kind: 'cron', label: t.schedule, detail: 'cron' };
    case 'socket': return { kind: 'socket', label: t.address ?? t.name, detail: t.address ? t.name : 'socket' };
    case 'email': return { kind: 'email', label: t.address, detail: 'email' };
    default: return { kind: 'setting', label: String((t as { kind: string }).kind) };
  }
};

/** A Durable Object class's storage and when it started, from its Worker's migrations: `SQLite storage`, since `v1`. */
function classHistory(host: CloudflareService | undefined, className: string): CloudflareFact[] {
  const out: CloudflareFact[] = [];
  for (const m of host?.migrations ?? []) {
    if (m.newSqliteClasses?.includes(className)) out.push({ kind: 'storage', label: 'SQLite storage', detail: `since ${m.tag}` });
    else if (m.newClasses?.includes(className)) out.push({ kind: 'storage', label: 'key-value storage', detail: `since ${m.tag}` });
    else if (m.renamedClasses?.some((r) => r.to === className)) out.push({ kind: 'migration', label: m.tag, detail: 'renamed' });
  }
  return out;
}

/** What's behind a service at Cloudflare, in words, when it isn't what it's called: `bucket uploads`, `class Room`. */
export function serviceResource(service: CloudflareService): string | undefined {
  const noun = RESOURCE_NOUN[service.kind];
  return service.resource && noun && service.resource.toLowerCase() !== service.label?.toLowerCase() ? `${noun} ${service.resource}` : undefined;
}

/** Everything a service's card says beyond its name, its product and its resource (`serviceResource`), as labelled sections
 *  of chips: what it exposes (Handlers), its names on `env` that aren't a connection (Bindings: its vars, and a binding to
 *  something that isn't in the system; each other binding is drawn once, as its connection's label), where things come in
 *  to it (Triggers), what's worth seeing about how it runs (Settings), and its machine. A section with nothing in it isn't
 *  there. */
export function serviceFacts(system: CloudflareSystem, service: CloudflareService): CloudflareFactSection[] {
  const byId = new Map(system.services.map((s) => [s.id, s]));
  const sections: CloudflareFactSection[] = [];
  const add = (id: CloudflareFactSection['id'], title: string, items: CloudflareFact[]) => { if (items.length) sections.push({ id, title, items }); };

  add('handlers', 'Handlers', serviceHandlers(system, service).map((h) => ({ kind: 'handler', label: h })));

  const bindings: CloudflareFact[] = [];
  for (const e of system.edges) {
    if (e.from !== service.id) continue;
    const to = byId.get(e.to);
    const name = edgeBinding(e, to);
    // A connection's label says what it's bound as.
    if (!name || to || !catalogBindingKey(e.via)) continue;
    bindings.push({ kind: 'binding', label: name, detail: catalogBinding(e.via.split('.')[0]!)?.friendlyName ?? e.via });
  }
  for (const v of service.vars ?? []) bindings.push({ kind: 'var', label: v, detail: 'var' });
  add('bindings', 'Bindings', bindings);

  add('triggers', 'Triggers', (service.triggers ?? []).map(triggerFact));

  const settings: CloudflareFact[] = [];
  if (service.kind === 'durable-objects') settings.push(...classHistory(service.host ? byId.get(service.host) : undefined, service.resource ?? service.label ?? service.id));
  const set = service.settings ?? {};
  if (set.compatibilityDate) settings.push({ kind: 'setting', label: set.compatibilityDate, detail: 'compatibility' });
  for (const flag of set.compatibilityFlags ?? []) settings.push({ kind: 'setting', label: flag, detail: 'flag' });
  if (set.placement) settings.push({ kind: 'setting', label: `${set.placement} placement` });
  if (set.cpuMs !== undefined) settings.push({ kind: 'setting', label: `${set.cpuMs} ms`, detail: 'CPU' });
  if (set.subrequests !== undefined) settings.push({ kind: 'setting', label: String(set.subrequests), detail: 'subrequests' });
  if (set.observability) settings.push({ kind: 'setting', label: 'observability', detail: set.headSamplingRate !== undefined ? `${Math.round(set.headSamplingRate * 100)}%` : undefined });
  if (set.logpush) settings.push({ kind: 'setting', label: 'logpush' });
  const classes = (service.migrations ?? []).length;
  if (classes) settings.push({ kind: 'migration', label: service.migrations![classes - 1]!.tag, detail: `${classes} ${classes === 1 ? 'migration' : 'migrations'}` });
  add('settings', 'Settings', settings);

  if (service.machine) {
    const states = isPlain(service.machine.states) ? Object.keys(service.machine.states).length : 0;
    const initial = typeof service.machine.initial === 'string' ? service.machine.initial : undefined;
    add('machine', 'Machine', [{ kind: 'machine', label: typeof service.machine.id === 'string' ? service.machine.id : service.id, detail: `${states} ${states === 1 ? 'state' : 'states'}${initial ? `, from ${initial}` : ''}` }]);
  }
  return sections;
}

/** What's account-wide, for the system's own header: the account, the zones its routes are on, and its environments. */
export function systemFacts(system: CloudflareSystem): CloudflareFactSection[] {
  const items: CloudflareFact[] = [];
  if (system.accountId) items.push({ kind: 'account', label: system.accountId, detail: 'account' });
  const zones = new Set<string>();
  for (const s of system.services) for (const t of s.triggers ?? []) if (t.kind === 'route') zones.add(t.zone ?? hostOf(t.pattern));
  for (const z of zones) if (z) items.push({ kind: 'zone', label: z, detail: 'zone' });
  for (const env of systemEnvironments(system)) items.push({ kind: 'environment', label: env, detail: 'environment' });
  return items.length ? [{ id: 'account', title: 'Account', items }] : [];
}

/** A route pattern's host, without a path or a wildcard label: `*.example.com/api/*` is `example.com`. */
const hostOf = (pattern: string) => pattern.replace(/^https?:\/\//, '').split('/')[0]!.replace(/^\*\.?/, '');

/** The environments a system's services are in, in the order they're first met. */
export const systemEnvironments = (system: CloudflareSystem): string[] => [...new Set(system.services.flatMap((s) => (s.environment ? [s.environment] : [])))];

/** Whether an edge's `via` is a binding key, which is what has a name on `env`. */
const catalogBindingKey = (via: string) => C.bindings.some((b) => b.key === via.split('.')[0]);

/* ── What's wrong with it ── */

/** What a service is called, in words. */
export const serviceName = (s: CloudflareService) => s.label ?? catalogProduct(s.kind)?.name ?? s.id;
/** What an edge is called on `env`: its own name, or what the service it goes to is bound as. */
export const edgeBinding = (e: CloudflareEdge, to: CloudflareService | undefined) => e.binding ?? to?.binding;

/** What a name on `env` can be. */
export const BINDING_NAME = /^[A-Za-z_$][\w$]*$/;

/** Everything that isn't so about a system: edges that aren't real, events nothing can receive, and so on. */
export function validateSystem(system: CloudflareSystem): SystemIssue[] {
  const issues: SystemIssue[] = [];
  const byId = new Map(system.services.map((s) => [s.id, s]));
  for (const s of system.services) {
    if (!catalogProduct(s.kind)) issues.push({ severity: 'warning', code: 'unknown-kind', message: `${serviceName(s)}: “${s.kind}” isn’t in the catalog, as of ${C.pins.docs.date}.`, service: s.id });
    else if (s.machine && !runsCode(s.kind)) issues.push({ severity: 'warning', code: 'machine-no-code', message: `${serviceName(s)} has a machine, and doesn’t run code, so nothing there can run it.`, service: s.id });
    const code = s.machine ? inlineCodeIn(s.machine) : [];
    if (code.length) issues.push({ severity: 'warning', code: 'machine-code', message: `${serviceName(s)}’s machine has code in it, which JSON can’t hold, so saving leaves it out: ${code.join(', ')}.`, service: s.id });
    if (s.host !== undefined) {
      const host = byId.get(s.host);
      if (!host) issues.push({ severity: 'warning', code: 'host', message: `${serviceName(s)} is a class of ${s.host}, which isn’t in this system.`, service: s.id });
      else if (!runsCode(host.kind)) issues.push({ severity: 'error', code: 'host', message: `${serviceName(s)} is a class of ${serviceName(host)}, which doesn’t run code.`, service: s.id });
    }
    if (s.triggers?.length && catalogProduct(s.kind) && !runsCode(s.kind)) issues.push({ severity: 'error', code: 'trigger', message: `${serviceName(s)} doesn’t run code, so nothing can come in to it from a route or a schedule.`, service: s.id });
    for (const t of s.triggers ?? []) {
      if (t.kind === 'cron' && t.schedule.trim().split(/\s+/).length !== 5) issues.push({ severity: 'error', code: 'cron', message: `${serviceName(s)}: “${t.schedule}” isn’t a cron schedule, which has five fields.`, service: s.id });
    }
    const known = handlerNames(s.kind);
    for (const h of s.handlers ?? []) if (known.length && !known.includes(h)) issues.push({ severity: 'warning', code: 'handler', message: `${serviceName(s)}: a ${catalogProduct(s.kind)?.name ?? s.kind} has no ${h} handler.`, service: s.id });
  }
  const namesOn = new Map<string, Set<string>>();
  for (const e of system.edges) {
    const from = byId.get(e.from), to = byId.get(e.to);
    const crossing = e.events?.length ? ` It carries ${e.events.join(', ')}.` : '';
    if (!from) { issues.push({ severity: 'error', code: 'edge-end', message: `${e.id} comes from ${e.from}, which isn’t in this system.${crossing}`, edge: e.id }); continue; }
    if (!to) { issues.push({ severity: 'error', code: 'edge-end', message: `${serviceName(from)} sends to ${e.to}, which isn’t in this system.${crossing}`, edge: e.id, service: from.id }); continue; }
    const check = linkOf(e, from.kind, to.kind);
    if (!check.ok) { issues.push({ severity: 'error', code: 'edge-not-real', message: `${serviceName(from)} to ${serviceName(to)}: ${check.reason}`, edge: e.id }); continue; }
    const { link } = check;
    const dlq = e.consumer?.deadLetterQueue;
    if (dlq && dlq === (from.resource ?? from.label ?? from.id)) issues.push({ severity: 'error', code: 'dead-letter-queue', message: `${serviceName(to)} sends what it gives up on back to ${dlq}, the queue it consumes.`, edge: e.id });
    const offered = new Set(link.operations.map((m) => m.name));
    for (const op of e.operations ?? []) {
      if (!offered.has(op)) issues.push({ severity: 'error', code: 'operation', message: `${serviceName(from)} to ${serviceName(to)}: ${link.label} has no ${op}.`, edge: e.id });
    }
    if (link.kind === 'binding') {
      const name = edgeBinding(e, to);
      if (!name) issues.push({ severity: 'warning', code: 'binding-name', message: `${serviceName(from)} to ${serviceName(to)}: this binding has no name on env.`, edge: e.id });
      else {
        if (!BINDING_NAME.test(name)) issues.push({ severity: 'error', code: 'binding-name', message: `${serviceName(from)}: “${name}” can’t be a name on env.`, edge: e.id });
        const names = namesOn.get(e.from) ?? new Set<string>();
        if (names.has(name)) issues.push({ severity: 'error', code: 'binding-name', message: `${serviceName(from)} has two bindings called ${name}.`, edge: e.id });
        names.add(name);
        namesOn.set(e.from, names);
      }
    }
    if (e.events?.length) {
      const machines = machinesPast(system, e);
      for (const event of e.events) {
        if (!machines.length) issues.push({ severity: 'warning', code: 'event-no-machine', message: `${serviceName(from)} sends ${event} to ${serviceName(to)}, and there’s no machine past there to receive it.`, edge: e.id });
        else if (!machines.some((m) => machineReceives(m.machine, event))) issues.push({ severity: 'error', code: 'event-not-received', message: `${serviceName(from)} sends ${event} to ${machines.map(serviceName).join(' and ')}, whose machine${machines.length > 1 ? 's don’t' : ' doesn’t'} receive it.`, edge: e.id });
      }
    }
  }
  return issues;
}

/** What XState says about each service's machine, drawn as `StateDiagram` would draw it. XState comes in through the argument, as
 *  it's an optional peer. */
export function checkMachines(xstate: { createMachine: (config: never) => unknown }, system: CloudflareSystem): SystemIssue[] {
  const issues: SystemIssue[] = [];
  for (const s of system.services) {
    if (!s.machine) continue;
    try {
      // XState only looks at where a state starts when it's asked, which drawing it does.
      machineToDraft(xstate.createMachine(s.machine as never) as StateMachineLike);
    } catch (e) {
      issues.push({ severity: 'error', code: 'machine', message: `${serviceName(s)}’s machine: ${e instanceof Error ? e.message : String(e)}`, service: s.id });
    }
  }
  return issues;
}

/* ── Changing one ── */

/** A catalog entry in words, for searching: what it's called, its binding, and what it's for. */
function score(p: CatalogProduct, words: readonly string[]): number {
  const name = p.name.toLowerCase(), id = p.id.toLowerCase();
  const bindings = C.bindings.filter((b) => b.product === p.id).map((b) => `${b.key} ${b.friendlyName ?? ''}`).join(' ').toLowerCase();
  const about = (p.description ?? '').toLowerCase(), groups = [p.group, ...p.groups].join(' ').toLowerCase();
  let total = 0;
  for (const w of words) {
    let best = 0;
    if (name === w || id === w) best = 100;
    else if (name.startsWith(w) || id.startsWith(w)) best = 60;
    else if (name.includes(w) || id.includes(w)) best = 40;
    else if (bindings.includes(w)) best = 30;
    else if (about.includes(w)) best = 10;
    else if (groups.includes(w)) best = 5;
    if (!best) return 0;
    total += best;
  }
  return total;
}

/** What's in the catalog for a search, best first, every word having to match somewhere: services, then what's part of one. */
export function searchCatalog(query: string, limit = 12): CatalogProduct[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return C.products
    .filter((p) => p.class === 'service' || p.class === 'feature')
    .map((p) => ({ p, s: score(p, words) + (p.class === 'service' ? 1 : 0) }))
    .filter(({ s }) => s > 1)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map(({ p }) => p);
}

/** A system with one more service, of a kind in the catalog, with an id nothing else has. */
export function addService(system: CloudflareSystem, kind: string): { system: CloudflareSystem; id: string } {
  const taken = new Set(system.services.map((s) => s.id));
  let id = kind;
  for (let n = 2; taken.has(id); n++) id = `${kind}-${n}`;
  return { system: { ...system, services: [...system.services, { id, kind }] }, id };
}

/** A system without some services. An edge that only joined one goes too. One that carries events stays, for `validateSystem` to say
 *  that something's still sending to what's gone, as that's a machine's work that needs another home. */
export function removeServices(system: CloudflareSystem, ids: readonly string[]): CloudflareSystem {
  const gone = new Set(ids);
  return {
    ...system,
    services: system.services.filter((s) => !gone.has(s.id)),
    edges: system.edges.filter((e) => (!gone.has(e.from) && !gone.has(e.to)) || !!e.events?.length),
  };
}

/** What two systems both have, by id and kind, for someone sharing a service between them to see. Each stays its own. */
export function sharedServices(a: CloudflareSystem, b: CloudflareSystem): { id: string; kind: string; sameMachine: boolean }[] {
  const out: { id: string; kind: string; sameMachine: boolean }[] = [];
  for (const s of a.services) {
    const other = b.services.find((x) => x.id === s.id && x.kind === s.kind);
    if (other) out.push({ id: s.id, kind: s.kind, sameMachine: JSON.stringify(s.machine ?? null) === JSON.stringify(other.machine ?? null) });
  }
  return out;
}
