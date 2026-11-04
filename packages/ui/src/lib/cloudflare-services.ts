/* ══ Cloudflare services — what the catalog says about connecting them ══
   A service's ports are what it can call and receive, from the catalog: a place for each binding that reaches it and each
   handler it has, and `env` on whatever runs code, which is the only thing that has bindings. What can join what comes from the
   same place. Only plain data and functions: the picture's in `components/cloudflare-diagram`. */
import type { CatalogBinding, CatalogMethod, CatalogProduct, CatalogReceive } from '@/lib/cloudflare-catalog';
import { CLOUDFLARE_CATALOG as C } from '@/lib/cloudflare-catalog.generated';
import type { DiagramPort } from '@/lib/diagram-model';

const PRODUCTS = new Map(C.products.map((p) => [p.id, p]));
const BINDINGS = new Map(C.bindings.map((b) => [b.key, b]));
const RUNNERS = new Map(C.runsCode.map((r) => [r.product, r]));
const SURFACES = new Map(C.nonBindingSurface.map((s) => [s.type, s]));

export const catalogProduct = (id: string): CatalogProduct | undefined => PRODUCTS.get(id);
export const catalogBinding = (key: string): CatalogBinding | undefined => BINDINGS.get(key);
/** Whether it runs code, which is what has an `env`, and so what can have bindings. */
export const runsCode = (kind: string) => RUNNERS.has(kind);
/** Everything someone would draw as a node. */
export const SERVICE_PRODUCTS: readonly CatalogProduct[] = C.products.filter((p) => p.class === 'service');

/** A service on a diagram. `kind` is its id in the catalog. */
export interface CloudflareService {
  id: string;
  kind: string;
  /** What it's called here. By default, its name in the catalog. */
  label?: string;
  /** Where it is on the board. With none on any of them, they're laid out. */
  at?: { x: number; y: number };
}

/** One service reaching another. `via` says how: a binding key, a row of `receives`, `surface:<Type>`, or `events`. */
export interface CloudflareEdge {
  id: string;
  from: string;
  to: string;
  via: string;
  /** What it's called on `env`, for a binding. */
  binding?: string;
  /** Which of what's on offer it uses. */
  operations?: string[];
}

/** How two ports are joined, and what's on offer across it. */
export interface ServiceLink {
  kind: 'binding' | 'surface' | 'handler' | 'events';
  via: string;
  /** What it is, in words. */
  label: string;
  /** What the far end can be asked to do, or can send: a binding's methods, or an event's name. */
  operations: readonly CatalogMethod[];
  fromPort: string;
  toPort: string;
}

export type ServiceLinkCheck = { ok: true; link: ServiceLink } | { ok: false; reason: string };

/* ── Ports ── */

export const ENV_PORT = 'env';
export const EVENTS_PORT = 'events';

/** Where a binding's one of a Worker's own settings, it isn't a way to anything else. */
const isOwnSetting = (b: CatalogBinding) => b.container === 'map' || !b.product || (b.product === 'workers' && b.key !== 'services');
const typeOf = (handler: string) => handler.slice(0, handler.indexOf('.'));
const memberOf = (handler: string) => handler.slice(handler.indexOf('.') + 1);
const ownerOf = (row: CatalogReceive) => C.runsCode.find((r) => r.handlerTypes.includes(typeOf(row.handler)))?.product;
/** It gets there through a binding: that's the edge, and there's nothing else to draw. */
const throughBinding = (row: CatalogReceive) => !!row.config?.some((path) => C.bindings.some((b) => b.path === path || b.key === path));
/** From a thing of a kind to another of the same kind. Anything else that says it's from what it's to is from itself. */
const BETWEEN_TWO = new Set(['tail']);
/** An edge of its own: a service that isn't the one receiving it, reaching a handler directly. */
const isDirectSend = (row: CatalogReceive) => !!row.from && !row.via && !throughBinding(row) && !!row.doc && (row.from !== ownerOf(row) || BETWEEN_TWO.has(row.id));
const SEND_LABEL: Readonly<Record<string, string>> = { 'stream-webhook': 'webhook', 'notifications-webhook': 'webhook', 'logpush-http': 'logs', 'dispatch-outbound': 'outbound' };
const sendLabel = (row: CatalogReceive) => SEND_LABEL[row.id] ?? memberOf(row.handler);

const handlerRows = (kind: string) => C.receives.filter((r) => r.doc && !throughBinding(r) && !r.via && ownerOf(r) === kind);
const sendRows = (kind: string) => C.receives.filter((r) => r.from === kind && isDirectSend(r));
const sendsEvents = (kind: string) => (PRODUCTS.get(kind)?.events.length ?? 0) > 0 || C.receives.some((r) => r.from === kind && r.via);
const takesEvents = (kind: string) => C.receives.some((r) => r.via === kind);
const ownBindings = (kind: string) => C.bindings.filter((b) => b.product === kind && !isOwnSetting(b));
const reachedThrough = (kind: string) => PRODUCTS.get(kind)?.alsoReachedThrough ?? [];
const surfaces = (kind: string) => C.nonBindingSurface.filter((s) => s.product === kind);

/** What a node's made of: how big it is, and which rows its ports sit on. */
export const SERVICE_NODE = { w: 224, head: 46, row: 19, foot: 8, minH: 58 } as const;

/** A service's ports, in, then out, each on its own row. A kind that isn't in the catalog, or is but has nothing to connect, has none. */
export function servicePorts(kind: string): DiagramPort[] {
  const product = PRODUCTS.get(kind);
  if (!product) return [];
  const ins: Omit<DiagramPort, 'side' | 'at'>[] = [
    ...ownBindings(kind).map((b) => ({ id: `binding:${b.key}`, label: b.friendlyName ?? b.key })),
    ...reachedThrough(kind).map((through) => ({ id: `binding:${through}`, label: through })),
    ...surfaces(kind).map((s) => ({ id: `surface:${s.type}`, label: s.type })),
    ...(takesEvents(kind) ? [{ id: EVENTS_PORT, label: 'events' }] : []),
    ...[...new Set(handlerRows(kind).map((r) => memberOf(r.handler)))].map((member) => ({ id: `on:${member}`, label: member })),
  ];
  const outs: Omit<DiagramPort, 'side' | 'at'>[] = [
    ...(runsCode(kind) ? [{ id: ENV_PORT, label: 'env' }] : []),
    ...sendRows(kind).map((r) => ({ id: `sends:${r.id}`, label: sendLabel(r) })),
    ...(sendsEvents(kind) ? [{ id: `out:${EVENTS_PORT}`, label: 'events' }] : []),
  ];
  const h = serviceNodeHeight(ins.length, outs.length);
  const at = (i: number) => (SERVICE_NODE.head + SERVICE_NODE.row * (i + 0.5)) / h;
  return [
    ...ins.map((p, i): DiagramPort => ({ ...p, side: 'l', at: at(i), direction: 'in' })),
    ...outs.map((p, i): DiagramPort => ({ ...p, side: 'r', at: at(i), direction: 'out' })),
  ];
}

export const serviceNodeHeight = (ins: number, outs: number) => Math.max(SERVICE_NODE.minH, SERVICE_NODE.head + SERVICE_NODE.row * Math.max(ins, outs) + SERVICE_NODE.foot);

/* ── What can join what ── */

const nameOf = (kind: string) => PRODUCTS.get(kind)?.name ?? kind;

function bindingOperations(through: string): { label: string; operations: readonly CatalogMethod[] } | null {
  const [key, method] = through.split('.');
  const b = key ? BINDINGS.get(key) : undefined;
  if (!b) return null;
  if (!method) return { label: b.friendlyName ?? b.key, operations: b.methods };
  // Reached through one of another binding's methods, like `env.AI.gateway()`: what that hands back is what's on offer.
  const m = b.methods.find((x) => x.name === method);
  const handed = Object.entries(b.followOn).find(([type]) => m?.returns?.some((r) => r.includes(type)));
  return { label: through, operations: handed ? handed[1].map((name) => ({ name })) : [{ name: method }] };
}

const eventOperations = (kind: string): CatalogMethod[] => {
  const r2 = kind === 'r2' ? C.r2Notifications.categories.map((c) => ({ name: c.category })) : [];
  return [...r2, ...(PRODUCTS.get(kind)?.events ?? []).map((name) => ({ name }))];
};

/** Whether a connection's allowed from one port to another, and if it is, what it means. Saying why not is the point. */
export function linkBetween(fromKind: string, fromPort: string | undefined, toKind: string, toPort: string | undefined): ServiceLinkCheck {
  const from = nameOf(fromKind), to = nameOf(toKind);
  if (!PRODUCTS.has(fromKind)) return { ok: false, reason: `${from} isn’t in the catalog, so there’s nothing to say what it can reach.` };
  if (!PRODUCTS.has(toKind)) return { ok: false, reason: `${to} isn’t in the catalog, so there’s nothing to say what can reach it.` };
  if (!fromPort) return { ok: false, reason: `${from} has nothing that goes out: no code to bind anything to, and nothing it sends.` };
  if (!toPort) return { ok: false, reason: `Nothing reaches ${to} from a Worker: it has no binding, and no handler.` };
  if (fromPort.startsWith('binding:') || fromPort.startsWith('surface:') || fromPort.startsWith('on:') || fromPort === EVENTS_PORT) return { ok: false, reason: `That’s how ${from} is reached, not how it reaches anything.` };
  if (toPort === ENV_PORT || toPort.startsWith('sends:') || toPort === `out:${EVENTS_PORT}`) return { ok: false, reason: `That’s how ${to} reaches things, not how it’s reached.` };
  // A saved edge can say anything, so the ports have to be on what it says they're on.
  if (fromPort === ENV_PORT && !runsCode(fromKind)) return { ok: false, reason: `${from} doesn’t run code, so it has no bindings.` };
  if (!servicePorts(fromKind).some((p) => p.id === fromPort)) return { ok: false, reason: `${from} doesn’t send that.` };
  if (!servicePorts(toKind).some((p) => p.id === toPort)) return { ok: false, reason: `${to} can’t be reached that way.` };

  if (fromPort === ENV_PORT) {
    if (toPort.startsWith('binding:')) {
      const through = toPort.slice('binding:'.length);
      const got = bindingOperations(through);
      if (!got) return { ok: false, reason: `There’s no binding called ${through}.` };
      return { ok: true, link: { kind: 'binding', via: through, label: got.label, operations: got.operations, fromPort, toPort } };
    }
    if (toPort.startsWith('surface:')) {
      const surface = SURFACES.get(toPort.slice('surface:'.length));
      if (!surface) return { ok: false, reason: `There’s nothing called ${toPort.slice('surface:'.length)}.` };
      const needs = surface.reachedBy.startsWith('DurableObjectState') ? 'durable-objects' : null;
      if (needs && fromKind !== needs) return { ok: false, reason: `Only a Durable Object reaches ${to}, through ${surface.reachedBy}.` };
      return { ok: true, link: { kind: 'surface', via: toPort, label: surface.type, operations: surface.methods, fromPort, toPort } };
    }
    if (toPort.startsWith('on:')) return { ok: false, reason: `A binding can’t call ${toPort.slice('on:'.length)} on ${to}. Something has to send it there.` };
    return { ok: false, reason: `${to} takes events from what sends them, not from a binding.` };
  }

  if (fromPort.startsWith('sends:')) {
    const row = C.receives.find((r) => r.id === fromPort.slice('sends:'.length));
    if (!row) return { ok: false, reason: `There’s nothing called ${fromPort}.` };
    const member = memberOf(row.handler);
    if (toPort !== `on:${member}` || ownerOf(row) !== toKind) return { ok: false, reason: `${from} sends ${row.what} to a ${member} handler, and that isn’t one.` };
    return { ok: true, link: { kind: 'handler', via: row.id, label: row.what, operations: [], fromPort, toPort } };
  }

  if (fromPort === `out:${EVENTS_PORT}`) {
    if (toPort !== EVENTS_PORT) return { ok: false, reason: `${from}’s events go through a Queue.` };
    return { ok: true, link: { kind: 'events', via: EVENTS_PORT, label: 'events', operations: eventOperations(fromKind), fromPort, toPort } };
  }
  return { ok: false, reason: `There’s no way from ${from} to ${to} there.` };
}

/** The ports an edge joins, from what it says it is. Null if the two can't be joined that way, as it stands. */
export function linkOf(edge: Pick<CloudflareEdge, 'via'>, fromKind: string, toKind: string): ServiceLinkCheck {
  const { via } = edge;
  if (via === EVENTS_PORT) return linkBetween(fromKind, `out:${EVENTS_PORT}`, toKind, EVENTS_PORT);
  if (via.startsWith('surface:')) return linkBetween(fromKind, ENV_PORT, toKind, via);
  const row = C.receives.find((r) => r.id === via);
  if (row && isDirectSend(row)) return linkBetween(fromKind, `sends:${row.id}`, toKind, `on:${memberOf(row.handler)}`);
  if (BINDINGS.has(via.split('.')[0]!)) return linkBetween(fromKind, ENV_PORT, toKind, `binding:${via}`);
  return { ok: false, reason: `There’s nothing in the catalog called ${via}.` };
}

/** A binding's name on `env` that isn't taken: `R2_BUCKET`, `R2_BUCKET_2` and so on. */
export function bindingName(label: string, taken: readonly string[]): string {
  const base = label.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'BINDING';
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) if (!taken.includes(`${base}_${n}`)) return `${base}_${n}`;
}

/** The edge for a new connection, as what it joins says it is, or null if the catalog says there's no such thing. Its id is its own
 *  on the board. Its name only has to be its own on what it's from, as each Worker has an `env` of its own. */
export function newEdge(edges: readonly CloudflareEdge[], kindOf: (id: string) => string | undefined, c: { from: string; fromPort?: string; to: string; toPort?: string }): CloudflareEdge | null {
  const check = linkBetween(kindOf(c.from) ?? '', c.fromPort, kindOf(c.to) ?? '', c.toPort);
  if (!check.ok) return null;
  const { link } = check;
  const taken = new Set(edges.map((e) => e.id));
  let id = `${c.from}-${link.via}`;
  for (let n = 2; taken.has(id); n++) id = `${c.from}-${link.via}-${n}`;
  const names = edges.filter((e) => e.from === c.from && e.binding).map((e) => e.binding!);
  return { id, from: c.from, to: c.to, via: link.via, ...(link.kind === 'binding' ? { binding: bindingName(link.label, names) } : null) };
}

/** A plain way to write a method: `get(key, options)`. */
export const methodSignature = (m: CatalogMethod) => (m.params ? `${m.name}(${m.params.join(', ')})` : m.name);

/** Which icon of the library's stands for a product. Only ever the library's own: no Cloudflare artwork. */
export function serviceIconName(product: CatalogProduct | undefined): 'sparkle' | 'internaldrive' | 'video' | 'shield' | 'bolt' | 'chart-bar' | 'gear' | 'globe' | 'cube' {
  const all = product ? [product.group, ...product.groups] : [];
  if (all.includes('AI')) return 'sparkle';
  if (all.includes('Storage')) return 'internaldrive';
  if (all.includes('Media')) return 'video';
  if (all.includes('Cloudflare One') || all.includes('Application security') || all.includes('Network security')) return 'shield';
  if (all.includes('Application performance')) return 'bolt';
  if (all.includes('Analytics')) return 'chart-bar';
  if (all.includes('Core platform')) return 'gear';
  if (all.includes('Consumer services')) return 'globe';
  return 'cube';
}
