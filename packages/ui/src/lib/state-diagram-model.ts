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

const srcName = (src: unknown) => (typeof src === 'string' ? src : (src as { name?: string } | null)?.name || 'actor');

/** What an event's called on a diagram, and what kind of edge it makes. */
export function describeEvent(event: string): { name: string; kind: 'event' | 'after' | 'done' | 'invoke' } {
  if (event.startsWith('xstate.after.')) return { name: `after ${event.split('.')[2]}`, kind: 'after' };
  if (event.startsWith('xstate.done.actor.')) return { name: 'done', kind: 'invoke' };
  if (event.startsWith('xstate.error.actor.')) return { name: 'error', kind: 'invoke' };
  if (event.startsWith('xstate.done.state.')) return { name: 'done', kind: 'done' };
  return { name: event, kind: 'event' };
}

const label = (name: string, guard: string | undefined) => (guard ? `${name} [${guard}]` : name);

/** A machine as a draft for `useDiagramLayout`: a node for each state and each initial marker, and an edge for each way out,
 *  including `always`, `after`, `invoke` and transitions that stay where they are. Ids follow the machine's, and stay the
 *  same each time, so a state can be found again. */
export function machineToDraft(machine: MachineLike): DiagramDraft<StateNodeData, StateEdgeData> {
  const nodes: DiagramDraftNode<StateNodeData>[] = [];
  const edges: DiagramEdge<StateEdgeData>[] = [];
  const used = new Map<string, number>();
  const edgeId = (base: string) => {
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}#${n}` : base;
  };
  const walk = (n: MachineStateNode, parent: string | null) => {
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
      for (const t of list) {
        const guard = guardName(t.guard);
        const internal = !t.target?.length;
        for (const to of internal ? [n] : t.target!) {
          edges.push({ id: edgeId(`${n.id}:${event}->${to.id}`), from: n.id, to: to.id, kind: edgeKind, label: label(name, guard), data: { event, ...(guard ? { guard } : null), ...(internal ? { internal } : null) } });
        }
      }
    }
    for (const t of n.always ?? []) {
      const guard = guardName(t.guard);
      for (const to of t.target?.length ? t.target : [n]) {
        edges.push({ id: edgeId(`${n.id}:always->${to.id}`), from: n.id, to: to.id, kind: 'always', label: label('always', guard), data: { ...(guard ? { guard } : null) } });
      }
    }
    for (const k of kids) walk(k, n.id);
  };
  walk(machine.root, null);
  return { nodes, edges };
}
