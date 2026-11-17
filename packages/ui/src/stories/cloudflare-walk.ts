/* ══ Seeded walks of edits on a Cloudflare board ══
   Every change a person can make to a system through an editable CloudflareDiagram (its board, its panel and its toolbar), as
   data, and a walk that makes them one after another the way the component does: the same calls (`cloudflareAddService`,
   `cloudflareEdit`, `cloudflareKeptBoard`, Tidy up's layout, the history's drawings by system), so what a walk draws is what the
   board draws. A seed picks the steps; a walk can be replayed from its step list. The editing fuzz
   (`lib/diagram-editing.fuzz.test.ts`) holds every step to the drawing rules (`diagram-rules`); the Replay story shows one.

   What a person can do, and the step that stands for it:
   - add a service of any product from the catalog's search, beside what's selected or in the middle of the view: `add`
   - delete a service (the panel's Delete, or Delete on the board): `delete`
   - rename a service (the panel's "Called"): `rename`
   - connect two services, by any pair of ports the catalog allows (a drag, or C and the arrows), between environments, a
     class and its own Worker, and one that's there already (a binding again under another name; a handler or events again
     is refused, and the board says why): `connect`
   - delete a connection: `disconnect`
   - rename a binding (the panel's "On env, as"): `binding`
   - tick and untick the operations a connection uses: `operations`
   - name the machine events a connection carries: `events`
   - give a Worker (or anything that runs code) a machine, or take it away: `machine`
   - move a service into an environment, or a new one (a system handed in changed: the panel has no field for it): `environment`
   - move a card by hand: `move`
   - Tidy up, undo, redo: `tidy`, `undo`, `redo`
   A queue consumer's handler, a Durable Object's host and the settings that show as chips come with the connection or the
   service they're on; handlers, triggers and settings have no field in the panel. */
import type { Pt } from '@/lib/canvas-math';
import { cloudflareAddService, cloudflareBoardData, cloudflareEdit, cloudflareKeptBoard, cloudflarePlaces, type CloudflareDrawn } from '@/lib/cloudflare-board';
import { linkBetween, linkOf, newEdge, runsCode, SERVICE_PRODUCTS, servicePorts, type CloudflareEdge, type CloudflareService } from '@/lib/cloudflare-services';
import { removeServices, serviceName, validateSystem, type CloudflareSystem } from '@/lib/cloudflare-system';
import { freePlace } from '@/lib/diagram-layout';
import type { TextMeasurer } from '@/lib/diagram-text';

export type CloudflareWalkStep =
  | { op: 'add'; kind: string; near: string | null }
  | { op: 'delete'; id: string }
  | { op: 'rename'; id: string; label: string }
  | { op: 'connect'; from: string; fromPort: string; to: string; toPort: string }
  | { op: 'disconnect'; edge: string }
  | { op: 'binding'; edge: string; name: string }
  | { op: 'operations'; edge: string; operations: string[] }
  | { op: 'events'; edge: string; events: string[] }
  | { op: 'machine'; id: string; on: boolean }
  | { op: 'environment'; id: string; environment: string | null }
  | { op: 'move'; id: string; by: Pt }
  | { op: 'tidy' }
  | { op: 'undo' }
  | { op: 'redo' };

/** One step made: the system and what's drawn after it, what it selected (what the panel shows), and what it touched (the
 *  cards it's about, which may move). */
export interface CloudflareWalkMade {
  step: CloudflareWalkStep;
  system: CloudflareSystem;
  drawn: CloudflareDrawn;
  select: { nodes: string[]; edges: string[] };
  touched: string[];
  /** What kind of step it was: an edit, a fresh layout (Tidy up), or a step back or on through history. */
  kind: 'edit' | 'tidy' | 'undo' | 'redo' | 'nothing';
  /** How many cards making room moved, and whether something was left without room (the board suggests Tidy up). */
  pushed: number;
  knot: boolean;
}

export interface CloudflareWalkOptions {
  /** The read-only pipeline for the frame: a system with no places laid out (ELK, wrapped, routed). */
  layout: (system: CloudflareSystem) => Promise<CloudflareDrawn>;
  /** The same for Tidy up, which lays out for the board in view (with a column panel open, the narrower one). Default
   *  `layout`. */
  tidyLayout?: (system: CloudflareSystem) => Promise<CloudflareDrawn>;
  text: TextMeasurer;
  /** The middle of the view, in board units, where a service added with nothing selected goes. */
  center: () => Pt | null;
}

/** A small, fast, seeded random number generator (mulberry32): the same seed, the same walk. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const withoutPlaces = (system: CloudflareSystem): CloudflareSystem => ({ ...system, services: system.services.map(({ at: _, ...s }) => s) });

/**
 * A board being edited, as CloudflareDiagram keeps one: the system, what it drew, one history of systems (each with the drawing
 * it had, so undo and redo put back exactly that), and each edit made the component's way.
 */
export class CloudflareWalk {
  system: CloudflareSystem;
  drawn: CloudflareDrawn;
  /** What the last drawing made room for, and whether it was left in a knot. */
  pushed = 0;
  knot = false;
  private past: CloudflareSystem[] = [];
  private future: CloudflareSystem[] = [];
  /** Each system's drawing, by its services and its edges (an edit that only connects keeps the services as they were). */
  private drawings = new WeakMap<readonly CloudflareService[], WeakMap<readonly CloudflareEdge[], CloudflareDrawn>>();
  private remember(system: CloudflareSystem, drawn: CloudflareDrawn) {
    let byEdges = this.drawings.get(system.services);
    if (!byEdges) { byEdges = new WeakMap(); this.drawings.set(system.services, byEdges); }
    byEdges.set(system.edges, drawn);
  }
  private constructor(system: CloudflareSystem, drawn: CloudflareDrawn, private options: CloudflareWalkOptions) {
    this.system = system;
    this.drawn = drawn;
    this.remember(system, drawn);
  }

  /** A board for a system: laid out when nothing has a place (the read-only pipeline), else drawn where its places are. */
  static async start(system: CloudflareSystem, options: CloudflareWalkOptions): Promise<CloudflareWalk> {
    if (!system.services.some((s) => s.at)) return new CloudflareWalk(system, await options.layout(system), options);
    const kept = cloudflareKeptBoard(system, null, { editable: true, issues: validateSystem(system), text: options.text });
    return new CloudflareWalk(system, { nodes: kept.nodes, edges: kept.edges, sized: kept.sized }, options);
  }

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }

  /** What the board draws for a system: what it drew for it last, kept (the render's own `cloudflareKeptBoard`). */
  private shown(system: CloudflareSystem, was: CloudflareDrawn | null): CloudflareDrawn {
    const kept = cloudflareKeptBoard(system, was, { editable: true, issues: validateSystem(system), text: this.options.text });
    this.knot = kept.knot;
    return { nodes: kept.nodes, edges: kept.edges, sized: kept.sized };
  }

  /** An edit, as the component's `send` makes it: places written down, the board drawn from what it drew, one history step. */
  private send(next: CloudflareSystem): boolean {
    const edit = cloudflareEdit(next, this.drawn, { editable: true, issues: validateSystem(next), text: this.options.text, before: this.system });
    const after = edit.system;
    if (after === this.system) return false;
    if (edit.drawn) this.remember(after, edit.drawn);
    this.pushed = edit.pushed;
    this.past.push(this.system);
    this.future = [];
    this.system = after;
    // What the edit drew is what the board draws for it.
    this.drawn = edit.drawn ?? this.shown(after, this.drawn);
    this.knot = edit.knot;
    return true;
  }

  async apply(step: CloudflareWalkStep): Promise<CloudflareWalkMade> {
    const s = this.system;
    this.pushed = 0;
    const made = (kind: CloudflareWalkMade['kind'], select: CloudflareWalkMade['select'] = { nodes: [], edges: [] }, touched: string[] = []): CloudflareWalkMade => ({ step, system: this.system, drawn: this.drawn, select, touched, kind, pushed: this.pushed, knot: this.knot || kind === 'nothing' && false });
    const changeEdge = (id: string, patch: Partial<CloudflareEdge>) => this.send({ ...s, edges: s.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
    const changeService = (id: string, patch: Partial<CloudflareService>) => this.send({ ...s, services: s.services.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
    switch (step.op) {
      case 'add': {
        const { system, id } = cloudflareAddService(s, step.kind, this.drawn, { near: step.near, center: this.options.center(), text: this.options.text });
        return this.send(system) ? made('edit', { nodes: [id], edges: [] }, [id]) : made('nothing');
      }
      case 'delete':
        return this.send(removeServices(s, [step.id])) ? made('edit', { nodes: [], edges: [] }, [step.id]) : made('nothing');
      case 'rename':
        return changeService(step.id, { label: step.label.trim() || undefined }) ? made('edit', { nodes: [step.id], edges: [] }, [step.id]) : made('nothing');
      case 'connect': {
        const edge = newEdge(s.services, s.edges, step);
        // Refused (the catalog's rule, or a handler made again): nothing changes, and the board says why.
        if (!edge) return made('nothing');
        return this.send({ ...s, edges: [...s.edges, edge] }) ? made('edit', { nodes: [], edges: [edge.id] }) : made('nothing');
      }
      case 'disconnect':
        return this.send({ ...s, edges: s.edges.filter((e) => e.id !== step.edge) }) ? made('edit') : made('nothing');
      case 'binding':
        return changeEdge(step.edge, { binding: step.name }) ? made('edit', { nodes: [], edges: [step.edge] }) : made('nothing');
      case 'operations':
        return changeEdge(step.edge, { operations: step.operations }) ? made('edit', { nodes: [], edges: [step.edge] }) : made('nothing');
      case 'events':
        return changeEdge(step.edge, { events: step.events.length ? step.events : undefined }) ? made('edit', { nodes: [], edges: [step.edge] }) : made('nothing');
      case 'machine':
        return changeService(step.id, { machine: step.on ? { id: step.id, initial: 'idle', states: { idle: {} } } : undefined }) ? made('edit', { nodes: [step.id], edges: [] }, [step.id]) : made('nothing');
      case 'environment': {
        // What it holds (a Durable Object class of a Worker's) goes into the environment with it.
        const held = s.services.filter((x) => x.host === step.id && x.id !== step.id).map((x) => x.id);
        return changeService(step.id, { environment: step.environment ?? undefined }) ? made('edit', { nodes: [step.id], edges: [] }, [step.id, ...held]) : made('nothing');
      }
      case 'move': {
        // Let go where the pointer is (the board writes the place down, rounded), in free room near there.
        const n = this.drawn.nodes.find((x) => x.id === step.id);
        if (!n) return made('nothing');
        const others = { nodes: this.drawn.nodes.filter((x) => x.id !== step.id), edges: this.drawn.edges };
        const at = freePlace(others, n, { parent: n.parent ?? null, center: { x: n.x + n.w / 2 + step.by.x, y: n.y + n.h / 2 + step.by.y }, text: this.options.text });
        const placed = cloudflarePlaces(s, this.drawn, s);
        return this.send({ ...placed, services: placed.services.map((x) => (x.id === step.id ? { ...x, at: { x: Math.round(at.x), y: Math.round(at.y) } } : x)) })
          ? made('edit', { nodes: [step.id], edges: [] }, [step.id]) : made('nothing');
      }
      case 'tidy': {
        const to = withoutPlaces(s);
        const drawn = await (this.options.tidyLayout ?? this.options.layout)(to);
        const next = cloudflarePlaces(to, drawn);
        this.remember(next, drawn);
        this.past.push(s);
        this.future = [];
        this.system = next;
        this.drawn = drawn;
        this.knot = false;
        return made('tidy');
      }
      case 'undo':
      case 'redo': {
        const from = step.op === 'undo' ? this.past : this.future;
        const to = from.pop();
        if (!to) return made('nothing');
        (step.op === 'undo' ? this.future : this.past).push(s);
        this.system = to;
        // A system with no places (back before the first edit) is laid out, as the board lays it out.
        // What it drew for that system, exactly; one with no places (back before the first edit) laid out, as the board does.
        this.drawn = this.drawingOf(to) ?? (to.services.some((x) => x.at) ? this.shown(to, null) : await this.options.layout(to));
        this.knot = false;
        return made(step.op);
      }
    }
  }

  /** What it drew last for a system (the history's), for what undo and redo must put back. */
  drawingOf(system: CloudflareSystem): CloudflareDrawn | undefined {
    return this.drawings.get(system.services)?.get(system.edges);
  }
}

/* ── Picking a step ── */

const NAMES = ['Uploads API v2', 'A much longer name than before', 'X', 'Edge cache', 'Thumbnails'];
const BINDINGS = ['UPLOADED_FILES_BUCKET', 'F', 'CACHE_2', 'A_VERY_LONG_BINDING_NAME_FOR_THIS'];
const EVENTS = [['FILE_READY'], ['FILE_READY', 'VIEWER_JOINED'], ['PING', 'PONG', 'VIEWER_LEFT'], []];
const ENVIRONMENTS = ['staging', 'production', null];

/** The steps a person could take next on a board, by weight: what the panel does most (operations, names) most often. */
export function pickStep(rng: () => number, walk: Pick<CloudflareWalk, 'system' | 'canUndo' | 'canRedo'>): CloudflareWalkStep {
  const s = walk.system;
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;
  const byId = new Map(s.services.map((x) => [x.id, x]));
  // What's on the board: a connection to a service that's gone (kept, for its events, for validateSystem to say so) isn't
  // drawn, so no one can select it.
  const drawnEdges = s.edges.filter((e) => byId.has(e.from) && byId.has(e.to));
  const linked = s.edges.flatMap((e) => {
    const a = byId.get(e.from), b = byId.get(e.to);
    const check = a && b ? linkOf(e, a.kind, b.kind) : null;
    return check?.ok ? [{ e, link: check.link }] : [];
  });
  const options: [number, () => CloudflareWalkStep | null][] = [
    [3, () => {
      const withOps = linked.filter((l) => l.link.operations.length);
      if (!withOps.length) return null;
      const { e, link } = pick(withOps);
      const offered = link.operations.map((m) => m.name);
      // Tick one to three more, or untick some.
      const used = new Set(e.operations ?? []);
      if (rng() < 0.7) for (let k = 1 + Math.floor(rng() * 3); k > 0; k--) used.add(pick(offered));
      else for (const o of [...used]) if (rng() < 0.5) used.delete(o);
      return { op: 'operations', edge: e.id, operations: offered.filter((o) => used.has(o)) };
    }],
    [1, () => { const bound = linked.filter((l) => l.link.kind === 'binding'); return bound.length ? { op: 'binding', edge: pick(bound).e.id, name: pick(BINDINGS) } : null; }],
    [1, () => (s.services.length ? { op: 'rename', id: pick(s.services).id, label: pick(NAMES) } : null)],
    [2, () => ({ op: 'add', kind: pick(SERVICE_PRODUCTS).id, near: rng() < 0.5 && s.services.length ? pick(s.services).id : null })],
    [s.services.length > 2 ? 1 : 0, () => ({ op: 'delete', id: pick(s.services).id })],
    [2, () => {
      // Any two ports the catalog joins: between environments, a class to the Worker it's of (or a second the other way), and
      // one that's there already (a binding again draws beside it; a handler or events again is refused, with a reason).
      const ways: CloudflareWalkStep[] = [];
      for (const a of s.services) for (const b of s.services) {
        if (a.id === b.id) continue;
        for (const p of servicePorts(a.kind).filter((x) => x.direction === 'out')) for (const q of servicePorts(b.kind).filter((x) => x.direction === 'in')) {
          if (linkBetween(a.kind, p.id, b.kind, q.id).ok) ways.push({ op: 'connect', from: a.id, fromPort: p.id, to: b.id, toPort: q.id });
        }
      }
      return ways.length ? pick(ways) : null;
    }],
    [1, () => (drawnEdges.length ? { op: 'disconnect', edge: pick(drawnEdges).id } : null)],
    [1, () => (drawnEdges.length ? { op: 'events', edge: pick(drawnEdges).id, events: pick(EVENTS) } : null)],
    [1, () => { const code = s.services.filter((x) => runsCode(x.kind)); if (!code.length) return null; const x = pick(code); return { op: 'machine', id: x.id, on: !x.machine }; }],
    [0.5, () => { const free = s.services.filter((x) => !x.host); return free.length ? { op: 'environment', id: pick(free).id, environment: pick(ENVIRONMENTS) } : null; }],
    [1, () => (s.services.length ? { op: 'move', id: pick(s.services).id, by: { x: Math.round((rng() - 0.5) * 480), y: Math.round((rng() - 0.5) * 360) } } : null)],
    [0.5, () => ({ op: 'tidy' })],
    [walk.canUndo ? 1 : 0, () => ({ op: 'undo' })],
    [walk.canRedo ? 0.7 : 0, () => ({ op: 'redo' })],
  ];
  for (let tries = 0; tries < 20; tries++) {
    const total = options.reduce((t, [w]) => t + w, 0);
    let r = rng() * total;
    for (const [w, make] of options) {
      if ((r -= w) > 0 || !w) continue;
      const step = make();
      if (step) return step;
      break;
    }
  }
  return { op: 'tidy' };
}

/** A step in words, for a failure's report and the Replay story's list. */
export function describeStep(step: CloudflareWalkStep, system?: CloudflareSystem): string {
  const name = (id: string) => { const x = system?.services.find((s) => s.id === id); return x ? serviceName(x) : id; };
  switch (step.op) {
    case 'add': return `add ${step.kind}${step.near ? ` beside ${name(step.near)}` : ''}`;
    case 'delete': return `delete ${name(step.id)}`;
    case 'rename': return `rename ${name(step.id)} “${step.label}”`;
    case 'connect': return `connect ${name(step.from)} (${step.fromPort}) to ${name(step.to)} (${step.toPort})`;
    case 'disconnect': return `disconnect ${step.edge}`;
    case 'binding': return `call ${step.edge} ${step.name} on env`;
    case 'operations': return `${step.edge} uses ${step.operations.join(', ') || 'nothing'}`;
    case 'events': return `${step.edge} carries ${step.events.join(', ') || 'nothing'}`;
    case 'machine': return `${step.on ? 'give' : 'take away'} ${name(step.id)}’s machine`;
    case 'environment': return `${name(step.id)} into ${step.environment ?? 'no environment'}`;
    case 'move': return `move ${name(step.id)} by ${step.by.x},${step.by.y}`;
    default: return step.op;
  }
}

/** The draft a layout of a system starts from (what Tidy up and a first layout lay out). */
export const cloudflareWalkDraft = (system: CloudflareSystem) => cloudflareBoardData(withoutPlaces(system), { editable: true });
