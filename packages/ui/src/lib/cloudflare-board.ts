/* ══ A Cloudflare system, as a Diagram's nodes and edges ══
   What's drawn, as plain data, for `CloudflareDiagram`, `cloudflareBoardProps` and the capnp fence alike:
   - the system is the root: a header with its name, and its account-wide section (the account, its zones, its environments);
   - an environment is a dashed box in it, and a Worker that has Durable Object classes holds them;
   - a service is a card: its name, its product's glyph (the library's own icons, never Cloudflare's artwork) and its product, then
     a labelled section of chips for each of what it exposes, its names on `env`, its triggers, its settings and its machine;
   - where requests, schedules and messages come in to the system, the service has an entry marker;
   - a connection's label is a card: what it's called on `env`, then what it uses as chips; a queue's producer and consumer, an
     R2 event notification and a service binding's entrypoint each say what they are;
   - ports are only there to connect by: with `editable`, a card has a "Connect" section whose rows carry them.
   Nothing here renders, so a server, a layout and a test read it as it is. */
import type { CatalogProduct } from '@/lib/cloudflare-catalog';
import {
  catalogProduct, linkOf, serviceIconName, servicePorts,
  type CloudflareEdge, type CloudflareService, type ServiceLink,
} from '@/lib/cloudflare-services';
import {
  edgeBinding, serviceEntries, serviceFacts, serviceName, serviceResource, systemFacts,
  type CloudflareFact, type CloudflareFactSection, type CloudflareSystem, type SystemIssue,
} from '@/lib/cloudflare-system';
import {
  CONTAINER_PADDING, ELBOW_GAP, edgeLabelSize, nodeAnatomy, placeItemPorts,
  type DiagramEdge, type DiagramNode, type DiagramSection, type DiagramSectionItem,
} from '@/lib/diagram-model';
import { estimateText } from '@/lib/diagram-text';
import type { Rect } from '@/lib/canvas-math';
import type { IconName } from '@/lib/icon';

/** What a service's node carries on a Diagram. The system's and an environment's box carry nothing. */
export interface CloudflareServiceNodeData {
  service: CloudflareService;
  product: CatalogProduct | undefined;
  /** Something's wrong with it. */
  problem?: boolean;
}

/** What a connection's edge carries on a Diagram. */
export interface CloudflareServiceEdgeData {
  edge: CloudflareEdge;
  link: ServiceLink | null;
  /** Why it isn't what it says it is, if it isn't. */
  problem: string | null;
  /** It's drawn from a consumer's settings, from its queue to where it sends what it gives up on: not an edge of the system's. */
  deadLetter?: boolean;
}

export interface CloudflareBoardDataOptions {
  /** With ports to connect by, on a "Connect" section of each card. Default `false`: cards, sections and labelled edges. */
  editable?: boolean;
  /** What's wrong with it, drawn as wrong. Default: what `validateSystem` would say isn't drawn here; pass it. */
  issues?: readonly SystemIssue[];
  /** The root's header. Default the system's `name`, or "Cloudflare". */
  title?: string;
}

export interface CloudflareBoardData {
  nodes: DiagramNode<CloudflareServiceNodeData>[];
  edges: DiagramEdge<CloudflareServiceEdgeData>[];
}

/** The system's box, and an environment's, by id. A service can't be called this: its id is its own. */
export const CLOUDFLARE_SYSTEM_NODE = 'cloudflare:system';
export const cloudflareEnvironmentNode = (name: string) => `cloudflare:env:${name}`;

/* ── The chips ── */

/** The glyph for each kind of fact, from the library's icons. */
const FACT_GLYPH: Readonly<Record<CloudflareFact['kind'], IconName>> = {
  handler: 'arrow-right', binding: 'link', var: 'textformat', route: 'globe', 'custom-domain': 'globe', 'workers-dev': 'globe',
  cron: 'clock', socket: 'network', email: 'envelope', setting: 'gear', resource: 'internaldrive', storage: 'internaldrive',
  migration: 'branch', machine: 'flowchart', account: 'person', zone: 'globe', environment: 'layers',
};

const sectionsOf = (sections: readonly CloudflareFactSection[]): DiagramSection[] => sections.map((s) => {
  const seen = new Set<string>();
  return {
    id: s.id,
    title: s.title,
    items: s.items.map((f): DiagramSectionItem => {
      let id = `${f.kind}:${f.label}`;
      for (let n = 2; seen.has(id); n++) id = `${f.kind}:${f.label}:${n}`;
      seen.add(id);
      return { id, title: f.label, ...(f.detail ? { description: f.detail } : null), icon: FACT_GLYPH[f.kind] };
    }),
  };
});

/** What a connection's label says: its title (what it's called on `env`, or what it is), a glyph, and its chips. */
function cloudflareEdgeLabel(edge: CloudflareEdge, to: CloudflareService | undefined, link: ServiceLink | null): Pick<DiagramEdge, 'title' | 'icon' | 'sections'> {
  const items: DiagramSectionItem[] = [];
  const chip = (id: string, title: string, icon: IconName, description?: string) => items.push({ id, title, icon, ...(description ? { description } : null) });
  const name = edgeBinding(edge, to);
  let title = name ?? link?.label ?? edge.via;
  let icon: IconName | undefined;
  if (edge.via === 'queue-consumer') {
    title = 'consumer';
    icon = 'tray';
    const c = edge.consumer ?? {};
    if (c.batchSize !== undefined) chip('batch', `${c.batchSize} per batch`, 'square-on-square');
    if (c.batchTimeout !== undefined) chip('timeout', `${c.batchTimeout}s to fill`, 'clock');
    if (c.retries !== undefined) chip('retries', `${c.retries} ${c.retries === 1 ? 'retry' : 'retries'}`, 'arrow-clockwise');
    if (c.retryDelay !== undefined) chip('retry-delay', `${c.retryDelay}s between`, 'clock');
    if (c.concurrency !== undefined) chip('concurrency', `${c.concurrency} at once`, 'layers');
    if (c.deadLetterQueue) chip('dead-letter', c.deadLetterQueue, 'archivebox', 'dead letters');
  } else if (link?.kind === 'events') {
    title = 'event notification';
    icon = 'bell';
  } else if (link?.kind === 'handler' || link?.kind === 'surface') {
    title = link.label;
  }
  if (edge.via === 'queues') chip('producer', 'producer', 'tray');
  if (edge.deliveryDelay !== undefined) chip('delay', `${edge.deliveryDelay}s delay`, 'clock');
  if (edge.entrypoint) chip('entrypoint', edge.entrypoint, 'link', 'entrypoint');
  for (const op of edge.operations ?? []) chip(`op:${op}`, op, 'bolt');
  for (const event of edge.events ?? []) chip(`event:${event}`, event, 'paperplane', 'event');
  return { title, ...(icon ? { icon } : null), ...(items.length ? { sections: [{ id: 'uses', items }] } : null) };
}

/* ── The nodes ── */

const text = (t: string, kind: Parameters<typeof estimateText>[1]) => estimateText(t, kind);

/** Where a service sits: in the Worker whose class it is, else its environment, else the system. */
function parentOf(service: CloudflareService, byId: ReadonlyMap<string, CloudflareService>): string {
  const host = service.host !== undefined && service.host !== service.id ? byId.get(service.host) : undefined;
  if (host && host.host !== service.id) return host.id;
  return service.environment ? cloudflareEnvironmentNode(service.environment) : CLOUDFLARE_SYSTEM_NODE;
}

/** A service as a node: its card's anatomy and its size, its place if it has one, and with `editable`, its ports. */
function serviceNode(system: CloudflareSystem, service: CloudflareService, byId: ReadonlyMap<string, CloudflareService>, editable: boolean, problem: boolean): DiagramNode<CloudflareServiceNodeData> {
  const product = catalogProduct(service.kind);
  const title = serviceName(service);
  const sections = sectionsOf(serviceFacts(system, service));
  const ports = editable ? servicePorts(service.kind) : [];
  if (ports.length) {
    sections.push({
      id: 'connect',
      title: 'Connect',
      items: ports.map((p) => ({ id: p.id, title: p.label ?? p.id, description: p.direction === 'in' ? 'in' : 'out', icon: p.direction === 'in' ? 'arrow-down-to-line' : 'arrow-up-right', port: p.id })),
    });
  }
  const holds = system.services.some((s) => s.host === service.id && s.id !== service.id);
  const node: DiagramNode<CloudflareServiceNodeData> = {
    id: service.id,
    parent: parentOf(service, byId),
    kind: holds ? 'group' : 'node',
    title,
    icon: serviceIconName(product),
    ...(!product ? { trailing: 'not in the catalog' } : product.name !== title ? { trailing: product.name } : null),
    ...(serviceResource(service) ? { description: serviceResource(service) } : null),
    ...(sections.length ? { sections } : null),
    ...(serviceEntries(service).length ? { entry: true } : null),
    ...(problem ? { tone: 'destructive' as const } : !product ? { tone: 'warning' as const } : null),
    ...(ports.length ? { ports } : null),
    data: { service, product, ...(problem ? { problem } : null) },
    x: service.at?.x ?? 0,
    y: service.at?.y ?? 0,
    w: 0,
    h: 0,
  };
  const a = nodeAnatomy(node, text);
  // A box's height is what it holds and isn't known yet: its item ports go on their rows once it's laid out (or enclosed).
  return holds ? { ...node, w: a.w, h: a.h } : placeItemPorts({ ...node, w: a.w, h: a.h }, a, a.h);
}

/** Only what isn't so is drawn as wrong: a service, or a connection, with an error. */
export function cloudflareProblems(issues: readonly SystemIssue[]) {
  return {
    edges: new Set(issues.flatMap((i) => (i.severity === 'error' && i.edge ? [i.edge] : []))),
    services: new Set(issues.flatMap((i) => (i.severity === 'error' && i.service && !i.edge ? [i.service] : []))),
  };
}

/**
 * A system as a Diagram's nodes and edges. Where every service has a place (`at`), the boxes that hold them are drawn around
 * them; where none has, every node is at 0, 0 for a layout to place (`useDiagramLayout`), with its parents. Give the ones
 * that have no place one with `placeInLayers` first, to draw it with no layout engine.
 */
export function cloudflareBoardData(system: CloudflareSystem, { editable = false, issues = [], title }: CloudflareBoardDataOptions = {}): CloudflareBoardData {
  const byId = new Map(system.services.map((s) => [s.id, s]));
  const wrong = cloudflareProblems(issues);
  const nodes: DiagramNode<CloudflareServiceNodeData>[] = [];
  if (system.services.length) {
    const facts = sectionsOf(systemFacts(system));
    nodes.push({ id: CLOUDFLARE_SYSTEM_NODE, kind: 'root', title: title ?? system.name ?? 'Cloudflare', icon: 'cloud', ...(facts.length ? { sections: facts } : null), x: 0, y: 0, w: 0, h: 0 });
    for (const env of [...new Set(system.services.flatMap((s) => (s.environment ? [s.environment] : [])))]) {
      // An environment's box only holds what's in it that isn't inside one of its Workers.
      if (!system.services.some((s) => s.environment === env && parentOf(s, byId) === cloudflareEnvironmentNode(env))) continue;
      nodes.push({ id: cloudflareEnvironmentNode(env), parent: CLOUDFLARE_SYSTEM_NODE, kind: 'group', variant: 'dashed', title: env, icon: 'layers', trailing: 'environment', x: 0, y: 0, w: 0, h: 0 });
    }
  }
  for (const s of system.services) nodes.push(serviceNode(system, s, byId, editable, wrong.services.has(s.id)));

  const edges: DiagramEdge<CloudflareServiceEdgeData>[] = [];
  for (const e of system.edges) {
    const from = byId.get(e.from), to = byId.get(e.to);
    // An edge with an end that isn't there has nowhere to be drawn. It's still in the system, and it's said to be wrong.
    if (!from || !to) continue;
    const check = linkOf(e, from.kind, to.kind);
    const link = check.ok ? check.link : null;
    edges.push({
      id: e.id,
      from: e.from,
      to: e.to,
      ...(editable && link ? { fromPort: link.fromPort, toPort: link.toPort } : null),
      ...cloudflareEdgeLabel(e, to, link),
      ...(link?.kind === 'events' ? { variant: 'dashed' as const } : null),
      ...(wrong.edges.has(e.id) ? { tone: 'destructive' as const } : null),
      data: { edge: e, link, problem: check.ok ? null : check.reason },
    });
    // Where a consumer sends what it gives up on, if that queue's on the board.
    const dlq = e.via === 'queue-consumer' ? e.consumer?.deadLetterQueue : undefined;
    const into = dlq ? system.services.find((s) => s.kind === 'queues' && s.id !== e.from && (s.resource ?? s.label ?? s.id) === dlq) : undefined;
    if (into) {
      edges.push({
        id: `dead-letter:${e.id}`,
        from: e.from,
        to: into.id,
        title: 'dead letters',
        icon: 'archivebox',
        ...(e.consumer?.retries !== undefined ? { sections: [{ id: 'uses', items: [{ id: 'after', title: `after ${e.consumer.retries} ${e.consumer.retries === 1 ? 'retry' : 'retries'}`, icon: 'arrow-clockwise' }] }] } : null),
        variant: 'dashed',
        data: { edge: e, link: null, problem: null, deadLetter: true },
      });
    }
  }
  return system.services.every((s) => s.at) ? enclose(nodes, edges) : { nodes, edges };
}

/** The boxes that hold others drawn around what they hold, deepest first, with room for their header and sections. */
function enclose<N, E>(nodes: DiagramNode<N>[], edges: DiagramEdge<E>[]): { nodes: DiagramNode<N>[]; edges: DiagramEdge<E>[] } {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const kids = new Map<string, DiagramNode<N>[]>();
  for (const n of nodes) if (n.parent) kids.set(n.parent, [...(kids.get(n.parent) ?? []), n]);
  const depth = (n: DiagramNode<N>): number => {
    let d = 0;
    for (let p = n.parent ? byId.get(n.parent) : undefined; p && d < nodes.length; p = p.parent ? byId.get(p.parent) : undefined) d++;
    return d;
  };
  const holders = nodes.filter((n) => kids.has(n.id)).sort((a, b) => depth(b) - depth(a));
  const P = CONTAINER_PADDING;
  const inside = (holder: string, id: string) => { for (let p = byId.get(id)?.parent; p; p = byId.get(p)?.parent) if (p === holder) return true; return false; };
  for (const holder of holders) {
    const held = kids.get(holder.id)!.map((k) => byId.get(k.id)!);
    const x0 = Math.min(...held.map((k) => k.x)), y0 = Math.min(...held.map((k) => k.y));
    const x1 = Math.max(...held.map((k) => k.x + k.w)), y1 = Math.max(...held.map((k) => k.y + k.h));
    const a = nodeAnatomy(holder, text);
    const room = ownRoom(edges, holder.id, (e) => edgeLabelSize(e, text)?.h ?? 0, (to) => inside(holder.id, to));
    const w = Math.max(a.w, x1 - x0 + P.side * 2);
    const box = { x: x0 - P.side - (w - (x1 - x0 + P.side * 2)) / 2, y: y0 - a.top - P.top - room, w, h: a.top + P.top + room + (y1 - y0) + P.bottom };
    byId.set(holder.id, placeItemPorts({ ...holder, ...box }, a, box.h));
  }
  return { nodes: nodes.map((n) => byId.get(n.id)!), edges: edges.map((e) => {
    // A box's own edge into what it holds: straight down from under its sections to the top of what it goes to.
    const from = byId.get(e.from), to = byId.get(e.to);
    if (!from || !to || !inside(e.from, e.to)) return e;
    const top = from.y + nodeAnatomy(from, text).top;
    const x = Math.round(to.x + to.w / 2);
    return { ...e, points: [{ x, y: Math.round(top) }, { x, y: to.y }] };
  }) };
}

/** The room a box keeps under its sections for the labels of its own edges into what it holds, and their way in. */
function ownRoom<E extends { from: string; to: string }>(edges: readonly E[], id: string, labelOf: (e: E) => number, holds: (to: string) => boolean): number {
  let h = 0;
  for (const e of edges) if (e.from === id && holds(e.to)) h = Math.max(h, labelOf(e));
  return h ? h + ELBOW_GAP + 12 : 0;
}

/** The box around a placed system's drawing, its root's, or null if anything has no place. */
export function cloudflareBoardBounds(system: CloudflareSystem): Rect | null {
  if (!system.services.length || !system.services.every((s) => s.at)) return null;
  const root = cloudflareBoardData(system).nodes.find((n) => n.id === CLOUDFLARE_SYSTEM_NODE);
  return root ? { x: root.x, y: root.y, w: root.w, h: root.h } : null;
}

/* ── A place for each ── */

/** Room beside a card in a row, and the least room between rows, past what the labels on the edges between them need. */
const COLUMN_GAP = 48;
const ROW_GAP = 56;

/**
 * Every service without a place given one, top to bottom: in each box (the system, an environment, a Worker with its
 * classes), what nothing in it reaches goes in the first row, then what those reach, and so on, each row in the middle,
 * with room between rows for the labels on the edges that cross it. It's quick and the same every time, for something read
 * from a file, which needs no layout engine to be drawn. If some already have a place, they keep it, and the rest go in a
 * column to the right of them.
 */
export function placeInLayers(system: CloudflareSystem, { editable = false }: Pick<CloudflareBoardDataOptions, 'editable'> = {}): CloudflareSystem {
  if (!system.services.length || system.services.every((s) => s.at)) return system;
  const board = cloudflareBoardData({ ...system, services: system.services.map(({ at: _, ...s }) => s) }, { editable });
  const nodes = new Map(board.nodes.map((n) => [n.id, n]));
  if (system.services.some((s) => s.at)) return placeBeside(system, nodes);

  const kids = new Map<string, string[]>();
  for (const n of board.nodes) if (n.parent) kids.set(n.parent, [...(kids.get(n.parent) ?? []), n.id]);
  const parentOfNode = (id: string) => nodes.get(id)?.parent ?? null;
  /** The child of `holder` that `id` is in, if it's in one. */
  const childIn = (holder: string, id: string): string | null => {
    let at: string | null = id;
    for (let guard = 0; at && guard < nodes.size; guard++) {
      const p = parentOfNode(at);
      if (p === holder) return at;
      at = p;
    }
    return null;
  };
  const labelH = new Map(board.edges.map((e) => [e.id, edgeLabelSize(e, text)?.h ?? 0]));
  const places = new Map<string, { x: number; y: number }>();
  const sizes = new Map<string, { w: number; h: number }>();
  const P = CONTAINER_PADDING;

  /** Lays out what a box holds, in rows, relative to where its children start; its size. */
  const lay = (id: string): { w: number; h: number } => {
    const node = nodes.get(id)!;
    const inside = kids.get(id) ?? [];
    if (!inside.length) {
      const size = { w: node.w, h: node.h };
      sizes.set(id, size);
      return size;
    }
    for (const k of inside) lay(k);
    // What reaches what among the children: an edge between anything in one and anything in another.
    const into = new Map(inside.map((k) => [k, new Set<string>()]));
    const between = new Map<string, number>();
    for (const e of board.edges) {
      const a = childIn(id, e.from), b = childIn(id, e.to);
      if (!a || !b || a === b) continue;
      into.get(b)!.add(a);
      between.set(`${a}\0${b}`, Math.max(between.get(`${a}\0${b}`) ?? 0, labelH.get(e.id) ?? 0));
    }
    // A circle is broken where it closes, going from what things come in to first, then in the order they're listed.
    const outOf = new Map(inside.map((k) => [k, [...inside].filter((b) => into.get(b)!.has(k))]));
    const starts = [...inside].sort((a, b) => Number(!nodes.get(a)!.entry) - Number(!nodes.get(b)!.entry) || into.get(a)!.size - into.get(b)!.size);
    const state = new Map<string, 'open' | 'done'>();
    const back = new Set<string>();
    const walk = (k: string) => {
      state.set(k, 'open');
      for (const b of outOf.get(k)!) {
        if (state.get(b) === 'open') back.add(`${k}\0${b}`);
        else if (!state.has(b)) walk(b);
      }
      state.set(k, 'done');
    };
    for (const k of starts) if (!state.has(k)) walk(k);
    const rank = new Map<string, number>();
    const depth = (k: string): number => {
      if (rank.has(k)) return rank.get(k)!;
      rank.set(k, 0);
      const d = Math.max(-1, ...[...into.get(k)!].filter((from) => !back.has(`${from}\0${k}`)).map(depth)) + 1;
      rank.set(k, d);
      return d;
    };
    for (const k of inside) depth(k);
    const rows: string[][] = [];
    for (const k of inside) (rows[rank.get(k)!] ??= []).push(k);
    // Each row in the order of what reaches it in the row above, so that lines cross less.
    const order = new Map<string, number>();
    rows.forEach((row, r) => {
      if (r) {
        const at = (k: string) => {
          const from = [...into.get(k)!].filter((f) => order.has(f));
          return from.length ? from.reduce((sum, f) => sum + order.get(f)!, 0) / from.length : Number.POSITIVE_INFINITY;
        };
        row.sort((a, b) => at(a) - at(b));
      }
      row.forEach((k, i) => order.set(k, i));
    });
    const live = rows.filter((row) => row?.length);
    const widths = live.map((row) => row.reduce((w, k) => w + sizes.get(k)!.w, 0) + COLUMN_GAP * (row.length - 1));
    const innerW = Math.max(...widths);
    let y = 0;
    live.forEach((row, r) => {
      if (r) {
        // Room for the tallest label on an edge from the row above into this one.
        const above = new Set(live[r - 1]);
        let label = 0;
        for (const [key, h] of between) {
          const [a, b] = key.split('\0') as [string, string];
          if ((above.has(a) && row.includes(b)) || (above.has(b) && row.includes(a))) label = Math.max(label, h);
        }
        // and for the route to leave the row above and turn before it, and come into this one after it.
        y += Math.max(ROW_GAP, label ? label + ELBOW_GAP * 2 + 16 : 0);
      }
      let x = (innerW - widths[r]!) / 2;
      const rowH = Math.max(...row.map((k) => sizes.get(k)!.h));
      for (const k of row) {
        places.set(k, { x, y });
        x += sizes.get(k)!.w + COLUMN_GAP;
      }
      y += rowH;
    });
    const a = nodeAnatomy(node, text);
    // A box's own edge into what it holds (a Worker's binding to its own class) runs down from under its sections, its
    // label in room kept for it there.
    const room = ownRoom(board.edges, id, (e) => labelH.get(e.id) ?? 0, (to) => childIn(id, to) !== null);
    const size = { w: Math.max(a.w, innerW + P.side * 2), h: a.top + P.top + room + y + P.bottom };
    sizes.set(id, size);
    // Where its children start, inside it: the room under its header and sections, in the middle.
    for (const k of inside) {
      const p = places.get(k)!;
      places.set(k, { x: p.x + (size.w - innerW) / 2, y: p.y + a.top + P.top + room });
    }
    return size;
  };
  lay(CLOUDFLARE_SYSTEM_NODE);
  // From inside each box to the board.
  const absolute = new Map<string, { x: number; y: number }>([[CLOUDFLARE_SYSTEM_NODE, { x: 0, y: 0 }]]);
  const resolve = (id: string): { x: number; y: number } => {
    const known = absolute.get(id);
    if (known) return known;
    const own = places.get(id) ?? { x: 0, y: 0 };
    const base = resolve(parentOfNode(id) ?? CLOUDFLARE_SYSTEM_NODE);
    const at = { x: Math.round(base.x + own.x), y: Math.round(base.y + own.y) };
    absolute.set(id, at);
    return at;
  };
  return { ...system, services: system.services.map((s) => ({ ...s, at: resolve(s.id) })) };
}

/** Services with no place, in a column to the right of those that have one. */
function placeBeside(system: CloudflareSystem, nodes: ReadonlyMap<string, DiagramNode<unknown>>): CloudflareSystem {
  const placed = system.services.filter((s) => s.at);
  const right = Math.max(...placed.map((s) => s.at!.x + (nodes.get(s.id)?.w ?? 0)));
  let y = Math.min(...placed.map((s) => s.at!.y));
  return {
    ...system,
    services: system.services.map((s) => {
      if (s.at) return s;
      const at = { x: right + COLUMN_GAP, y };
      y += (nodes.get(s.id)?.h ?? 0) + COLUMN_GAP;
      return { ...s, at };
    }),
  };
}
