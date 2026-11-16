/* ══ State diagram model — a machine as nodes and edges ══
   Draws from `machine.root`, XState's own resolved graph, so relative targets, `#id`s, parallel regions, `always`, `after`,
   `invoke` and guards are all there as data. It doesn't touch `toJSON()`, which drops every `always` and can't be read back,
   or `toDirectedGraph`, which has 29 of a 36-edge machine's edges. Nothing here runs a machine, or imports XState: it only
   reads what it's handed. */
import type { DiagramDraft, DiagramDraftNode } from '@/lib/diagram-layout';
import type { DiagramEdge } from '@/lib/diagram-model';

/** The parts of an XState `StateNode` this reads. */
export interface MachineStateNode {
  id: string;
  key: string;
  type: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  history?: 'shallow' | 'deep' | false;
  states?: Record<string, MachineStateNode>;
  parent?: MachineStateNode;
  initial?: { target?: readonly MachineStateNode[] };
  invoke?: readonly { id?: string; src: unknown }[];
  transitions: ReadonlyMap<string, readonly MachineTransition[]>;
  always?: readonly MachineTransition[];
}

export interface MachineTransition {
  eventType?: string;
  target?: readonly MachineStateNode[];
  guard?: unknown;
  reenter?: boolean;
}

/** A machine, or anything with its resolved graph. */
export interface MachineLike {
  root: MachineStateNode;
  /** What it was made from, which is what's simulated and edited. */
  config?: unknown;
  implementations?: { delays?: Readonly<Record<string, unknown>> };
}

/** Where a transition's written in a machine's config. */
export interface TransitionPlace {
  /** The keys of its state, from the root. */
  state: readonly string[];
  /** That state's id. */
  stateId: string;
  /** The event, or null for `always`. */
  event: string | null;
  /** Its place in that event's list. */
  index: number;
  /** Which of its targets, when it has more than one. */
  target: number;
}

/** What a state's edge stands for, for simulating and editing. */
export interface StateEdgeData {
  /** The event that takes it: an event's name, or XState's own `xstate.after…` and `xstate.done…`. Absent on `always` and initial edges. */
  event?: string;
  /** The guard's name, if it has one. */
  guard?: string;
  /** The transition has no target: it stays where it is and only runs its actions. */
  internal?: boolean;
}

export interface StateNodeData {
  /** The state's key in its parent. */
  key: string;
  /** The names of the actors it invokes. */
  invokes: string[];
}

function guardName(guard: unknown): string | undefined {
  if (!guard) return undefined;
  if (typeof guard === 'string') return guard;
  if (typeof guard === 'object' && typeof (guard as { type?: unknown }).type === 'string') return (guard as { type: string }).type;
  // A guard written inline has no name to show, but it's still a guard.
  if (typeof guard === 'function') return (guard as { name?: string }).name || 'guard';
  return 'guard';
}

/** XState gives an actor written inline a name of its own, which isn't anything to show. */
const srcName = (src: unknown) => (typeof src === 'string' && !src.startsWith('xstate.invoke.') ? src : 'actor');

/** What an event's called on a diagram, and what kind of edge it makes. */
export function describeEvent(event: string): { name: string; kind: 'event' | 'after' | 'done' | 'invoke' } {
  if (event.startsWith('xstate.after.')) return { name: `after ${event.split('.')[2]}`, kind: 'after' };
  if (event.startsWith('xstate.done.actor.')) return { name: 'done', kind: 'invoke' };
  if (event.startsWith('xstate.error.actor.')) return { name: 'error', kind: 'invoke' };
  if (event.startsWith('xstate.snapshot.')) return { name: 'snapshot', kind: 'invoke' };
  if (event.startsWith('xstate.done.state.')) return { name: 'done', kind: 'done' };
  return { name: event, kind: 'event' };
}

const label = (name: string, guard: string | undefined) => (guard ? `${name} [${guard}]` : name);

/** A machine as a draft for `useDiagramLayout`: a node for each state and each initial marker, and an edge for each way out,
 *  including `always`, `after`, `invoke` and transitions that stay where they are. Ids follow the machine's, and stay the
 *  same each time, so a state can be found again. */
export function machineToDraft(machine: MachineLike, onEdge?: (transition: MachineTransition, edgeId: string, place: TransitionPlace) => void): DiagramDraft<StateNodeData, StateEdgeData> & { edges: DiagramEdge<StateEdgeData>[] } {
  const nodes: DiagramDraftNode<StateNodeData>[] = [];
  const edges: DiagramEdge<StateEdgeData>[] = [];
  const used = new Map<string, number>();
  const edgeId = (base: string) => {
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}#${n}` : base;
  };
  const walk = (n: MachineStateNode, parent: string | null, path: readonly string[]) => {
    const kids = Object.values(n.states ?? {});
    const invokes = (n.invoke ?? []).map((i) => srcName(i.src));
    const isRegion = n.parent?.type === 'parallel' && kids.length > 0;
    const kind: DiagramDraftNode['kind'] = !n.parent ? 'root' : n.type === 'parallel' ? 'parallel' : isRegion ? 'region' : n.type === 'final' ? 'final' : kids.length ? 'compound' : 'node';
    const detail = n.type === 'parallel' ? 'parallel'
      : n.type === 'history' ? (n.history === 'deep' ? 'deep history' : 'history')
      : invokes.length ? `invoke ${invokes.join(', ')}` : undefined;
    nodes.push({ id: n.id, parent, kind, label: n.key, ...(detail ? { detail } : null), data: { key: n.key, invokes } });
    if (kids.length && n.type !== 'parallel' && n.initial?.target?.length) {
      const dot = `${n.id}.__initial`;
      nodes.push({ id: dot, parent: n.id, kind: 'initial', data: { key: '', invokes: [] } });
      for (const t of n.initial.target) edges.push({ id: edgeId(`${dot}->${t.id}`), from: dot, to: t.id, kind: 'initial', data: {} });
    }
    for (const [event, list] of n.transitions) {
      const { name, kind: edgeKind } = describeEvent(event);
      list.forEach((t, index) => {
        const guard = guardName(t.guard);
        const internal = !t.target?.length;
        (internal ? [n] : t.target!).forEach((to, target) => {
          const id = edgeId(`${n.id}:${event}->${to.id}`);
          edges.push({ id, from: n.id, to: to.id, kind: edgeKind, label: label(name, guard), data: { event, ...(guard ? { guard } : null), ...(internal ? { internal } : null) } });
          onEdge?.(t, id, { state: path, stateId: n.id, event, index, target });
        });
      });
    }
    (n.always ?? []).forEach((t, index) => {
      const guard = guardName(t.guard);
      (t.target?.length ? t.target : [n]).forEach((to, target) => {
        const id = edgeId(`${n.id}:always->${to.id}`);
        edges.push({ id, from: n.id, to: to.id, kind: 'always', label: label('always', guard), data: { ...(guard ? { guard } : null) } });
        onEdge?.(t, id, { state: path, stateId: n.id, event: null, index, target });
      });
    });
    for (const k of kids) walk(k, n.id, [...path, k.key]);
  };
  walk(machine.root, null, []);
  return { nodes, edges };
}

/** Which edges each of a machine's transitions is drawn as, by the ids `machineToDraft` gives them. A transition with two
 *  targets is two edges. */
export function machineEdgeIds(machine: MachineLike): Map<MachineTransition, string[]> {
  const out = new Map<MachineTransition, string[]>();
  machineToDraft(machine, (transition, id) => {
    const ids = out.get(transition);
    if (ids) ids.push(id);
    else out.set(transition, [id]);
  });
  return out;
}

/** Where each edge is written in the machine's config, by the ids `machineToDraft` gives them. An initial marker's isn't
 *  there, as it's only drawn. */
export function machineEdgePlaces(machine: MachineLike): Map<string, TransitionPlace> {
  const out = new Map<string, TransitionPlace>();
  machineToDraft(machine, (_transition, id, place) => { out.set(id, place); });
  return out;
}

/** Where each state is in the machine's config, by its id: the keys from the root. */
export function machineStatePaths(machine: MachineLike): Map<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  const walk = (n: MachineStateNode, path: readonly string[]) => {
    out.set(n.id, path);
    for (const k of Object.values(n.states ?? {})) walk(k, [...path, k.key]);
  };
  walk(machine.root, []);
  return out;
}
