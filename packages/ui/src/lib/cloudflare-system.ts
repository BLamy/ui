/* ══ A Cloudflare system, as data ══
   A small document: which services, what each is called and bound as, which have a machine, and which events cross which edge.
   It saves as JSON. Reading one never throws, as it can have been edited by hand: what can't be used is left out and said, and
   what's left can still be looked at. `validateSystem` says what's wrong with one that reads. */
import type { CatalogProduct } from '@/lib/cloudflare-catalog';
import { CLOUDFLARE_CATALOG as C } from '@/lib/cloudflare-catalog.generated';
import { SERVICE_NODE, catalogProduct, linkOf, runsCode, serviceNodeHeight, servicePorts, type CloudflareEdge, type CloudflareService } from '@/lib/cloudflare-services';
import { inlineCodeIn } from '@/lib/state-diagram-edit';
import { machineToDraft, type MachineLike } from '@/lib/state-diagram-model';

export interface CloudflareSystem {
  services: readonly CloudflareService[];
  edges: readonly CloudflareEdge[];
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

const SERVICE_KEYS = new Set(['id', 'kind', 'label', 'at', 'binding', 'resource', 'machine']);
const EDGE_KEYS = new Set(['id', 'from', 'to', 'via', 'binding', 'operations', 'events']);

/** As JSON, with what's on each in a set order, so that a change shows as that change. */
export function systemToJson(system: CloudflareSystem): string {
  const service = ({ id, kind, label, binding, resource, at, machine }: CloudflareService) => ({ id, kind, label, binding, resource, at, machine });
  const edge = ({ id, from, to, via, binding, operations, events }: CloudflareEdge) => ({ id, from, to, via, binding, operations, events });
  return `${JSON.stringify({ services: system.services.map(service), edges: system.edges.map(edge) }, null, 2)}\n`;
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
  for (const key of Object.keys(raw)) if (key !== 'services' && key !== 'edges') odd('unknown-field', `A system doesn’t have \`${key}\`, so it’s been left out.`);

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
    if (typeof s.label === 'string') made.label = s.label;
    else if (s.label !== undefined) odd('service-field', `${s.id}: \`label\` has to be text, so it’s been left out.`, { service: s.id });
    if (typeof s.binding === 'string') made.binding = s.binding;
    else if (s.binding !== undefined) odd('service-field', `${s.id}: \`binding\` has to be text, so it’s been left out.`, { service: s.id });
    if (typeof s.resource === 'string') made.resource = s.resource;
    else if (s.resource !== undefined) odd('service-field', `${s.id}: \`resource\` has to be text, so it’s been left out.`, { service: s.id });
    if (isPlain(s.at) && isPlace(s.at.x) && isPlace(s.at.y)) made.at = { x: s.at.x as number, y: s.at.y as number };
    else if (s.at !== undefined) odd('service-field', `${s.id}: \`at\` has to be numbers, up to ${FARTHEST} from the middle, so it’s been left out.`, { service: s.id });
    if (isPlain(s.machine)) made.machine = s.machine;
    else if (s.machine !== undefined) bad('service-field', `${s.id}: \`machine\` has to be a machine’s config, so it’s been left out.`, { service: s.id });
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
    if (typeof e.binding === 'string') made.binding = e.binding;
    else if (e.binding !== undefined) odd('edge-field', `${id}: \`binding\` has to be text, so it’s been left out.`, { edge: id });
    if (areStrings(e.operations)) made.operations = [...e.operations];
    else if (e.operations !== undefined) odd('edge-field', `${id}: \`operations\` has to be a list of text, so it’s been left out.`, { edge: id });
    if (areStrings(e.events)) made.events = [...e.events];
    else if (e.events !== undefined) odd('edge-field', `${id}: \`events\` has to be a list of text, so it’s been left out.`, { edge: id });
    for (const key of Object.keys(e)) if (!EDGE_KEYS.has(key)) odd('unknown-field', `${id} has \`${key}\`, which an edge doesn’t have, so it’s been left out.`, { edge: id });
    edges.push(made);
  });
  return { system: { services, edges }, issues };
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
      machineToDraft(xstate.createMachine(s.machine as never) as MachineLike);
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

/* ── A place for each ── */

const LAYER_GAP = 120;
const ROW_GAP = 40;

/**
 * Every service without a place given one, in layers by what reaches what: what nothing reaches on the left, then what
 * those reach, and so on, in the order they're listed. It's quick and the same every time, for something read from a file,
 * which needs no layout engine to be drawn. Services that already have a place keep it.
 */
export function placeInLayers(system: CloudflareSystem): CloudflareSystem {
  const ids = system.services.map((s) => s.id);
  const into = new Map(ids.map((id) => [id, [] as string[]]));
  for (const e of system.edges) if (e.from !== e.to && into.has(e.to) && into.has(e.from)) into.get(e.to)!.push(e.from);
  const layer = new Map<string, number>();
  const depth = (id: string, path: Set<string>): number => {
    if (layer.has(id)) return layer.get(id)!;
    if (path.has(id)) return 0; // round in a circle: it goes where the circle began
    path.add(id);
    const d = Math.max(-1, ...into.get(id)!.map((from) => depth(from, path))) + 1;
    path.delete(id);
    layer.set(id, d);
    return d;
  };
  for (const id of ids) depth(id, new Set());
  const heightOf = (kind: string) => {
    const ports = servicePorts(kind);
    const ins = ports.filter((p) => p.direction === 'in').length;
    return serviceNodeHeight(ins, ports.length - ins);
  };
  const nextY = new Map<number, number>();
  return {
    ...system,
    services: system.services.map((s) => {
      if (s.at) return s;
      const l = layer.get(s.id) ?? 0;
      const y = nextY.get(l) ?? 0;
      nextY.set(l, y + heightOf(s.kind) + ROW_GAP);
      return { ...s, at: { x: l * (SERVICE_NODE.w + LAYER_GAP), y } };
    }),
  };
}
