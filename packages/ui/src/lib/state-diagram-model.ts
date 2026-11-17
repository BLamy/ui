/* ══ State diagram model — a machine as nodes and edges ══
   Draws from `machine.root`, XState's own resolved graph, so relative targets, `#id`s, parallel regions, `always`, `after`,
   `invoke` and guards are all there as data. It doesn't touch `toJSON()`, which drops every `always` and can't be read back,
   or `toDirectedGraph`, which has 29 of a 36-edge machine's edges. Nothing here runs a machine, or imports XState: it only
   reads what it's handed.

   It reads everything a machine says: the machine's id, title and context (`describeMachine`); each state's type, `initial`,
   `entry` / `exit` actions, `invoke`s, `tags`, `description` and `meta` (`StateNodeData`); each transition's event (a name,
   `*`, a delay, `always`, an actor or a state finishing), guard (named, with params, or `and` / `or` / `not` / `stateIn`),
   actions, targets, `reenter`, or none at all (`StateEdgeData`). Actions are named as what they are (`describeAction`): the
   machine's own by name and params, XState's built-ins (`assign`, `raise`, `sendTo`, `log`…) by theirs, code as `inline`. */
import type { DiagramDraft, DiagramDraftNode } from '@/lib/diagram-layout';
import type { DiagramEdge, DiagramGlyph, DiagramNode, DiagramSection, DiagramSectionItem } from '@/lib/diagram-model';

/** The parts of an XState `StateNode` this reads. */
export interface StateMachineNode {
  id: string;
  key: string;
  type: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  history?: 'shallow' | 'deep' | false;
  states?: Record<string, StateMachineNode>;
  parent?: StateMachineNode;
  initial?: { target?: readonly StateMachineNode[] };
  invoke?: readonly { id?: string; src: unknown; input?: unknown }[];
  transitions: ReadonlyMap<string, readonly StateMachineTransition[]>;
  always?: readonly StateMachineTransition[];
  tags?: Iterable<string>;
  description?: string;
  meta?: unknown;
  /** The state's config as written: where its `entry` and `exit` are read from (the resolved ones also hold XState's own timers). */
  config?: { entry?: unknown; exit?: unknown };
}

export interface StateMachineTransition {
  eventType?: string;
  target?: readonly StateMachineNode[];
  guard?: unknown;
  reenter?: boolean;
  actions?: readonly unknown[];
  /** An `after` transition's delay: ms, or a delay's name. */
  delay?: number | string;
}

/** A machine, or anything with its resolved graph. */
export interface StateMachineLike {
  root: StateMachineNode;
  /** What it was made from, which is what's simulated and edited. */
  config?: unknown;
  implementations?: { delays?: Readonly<Record<string, unknown>> };
}

/* ── What a machine says, as data ── */

/** What kind of action it is: one of the machine's own, by name; code written inline; or one of XState's built-ins. */
export type StateActionKind = 'named' | 'inline' | 'assign' | 'raise' | 'sendTo' | 'sendParent' | 'log' | 'emit' | 'spawnChild' | 'stopChild' | 'cancel' | 'enqueueActions';

/** An action, in an `entry`, an `exit` or a transition's `actions`. */
export interface StateAction {
  kind: StateActionKind;
  /** What it's called on the diagram: its name, `inline`, or the built-in's (`assign`, `raise`…). */
  name: string;
  /** What a parameterized action is given, or what a built-in does (the keys `assign` sets, the event `raise` sends), in a few words. */
  detail?: string;
  /** A parameterized action's `params`, as written. */
  params?: Readonly<Record<string, unknown>>;
}

/** A transition's guard. */
export interface StateGuard {
  /** One named guard's name; for `and`, `or`, `not` and `stateIn`, the condition as `text` has it. */
  name: string;
  /** The condition in words: `canRetry`, `isAbove(min: 5)`, `a and (b or not c)`, `in #m.on`. */
  text: string;
  /** A parameterized guard's `params`. */
  params?: Readonly<Record<string, unknown>>;
  /** Whether it's `and`, `or`, `not` or `stateIn` rather than one named guard. */
  composed?: boolean;
}

/** An actor a state invokes. Where it goes when it's done, fails or reports is its edges. */
export interface StateInvoke {
  /** The actor's `src`: its name in `setup({ actors })`, or `actor` for one written inline. */
  src: string;
  /** Its `id`, when one was written. */
  id?: string;
  /** What it's given, in a few words, when that isn't code. */
  input?: string;
}

/** A key of the machine's context and what's known of its value. */
export interface StateContextEntry {
  key: string;
  /** Its type, as `types.context` writes it (from source text), or its value, as written (`0`, `""`, `null`, `[]`). */
  value: string;
  /** Where `value` came from: a type, a literal value, or code that makes it (`value` is then `code`). */
  from: 'type' | 'value' | 'code';
}

/** What a machine says about itself: drawn as the root's header and its Context section. */
export interface StateMachineSummary {
  /** The machine's id (its root state's key). */
  id: string;
  /** What it's called: its root's `meta.title` or `meta.name` when there's one, else its id. */
  title: string;
  description?: string;
  /** Its context's keys, in order. Empty when it has none. */
  context: StateContextEntry[];
  /** Its whole context is made by code (a function of `input`): only `types.context` can say what's in it. */
  contextFromCode?: boolean;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);

/** A context value (or a param, an input) as a few words: literals as written, a list or object by its size, code as `code`. */
export function describeContextValue(value: unknown, room = 40): string {
  if (typeof value === 'function') return 'code';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value.length > room ? `${value.slice(0, room - 1)}…` : value);
  if (typeof value !== 'object' || value === null) return String(value);
  if (Array.isArray(value)) return value.length ? `[${value.length} item${value.length === 1 ? '' : 's'}]` : '[]';
  try {
    const text = JSON.stringify(value);
    if (text.length <= room) return text;
  } catch {
    // A cycle, or something JSON can't say.
  }
  const keys = Object.keys(value);
  return keys.length ? `{ ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''} }` : '{}';
}

/** `params` as `a: 1, b: "x"`. */
const paramsText = (params: unknown): string | undefined => {
  if (!isPlainObject(params)) return params === undefined ? undefined : describeContextValue(params);
  const parts = Object.entries(params).map(([k, v]) => `${k}: ${describeContextValue(v, 16)}`);
  return parts.length ? parts.join(', ') : undefined;
};

/** The `type` of an event as written: `{ type: 'E' }`, `'E'`, or code. */
const eventTypeOf = (event: unknown): string | undefined => (typeof event === 'string' ? event : isPlainObject(event) && typeof event.type === 'string' ? event.type : undefined);

const BUILT_IN: Record<string, StateActionKind> = {
  'xstate.assign': 'assign', 'xstate.raise': 'raise', 'xstate.sendTo': 'sendTo', 'xstate.sendParent': 'sendParent', 'xstate.log': 'log', 'xstate.emit': 'emit',
  'xstate.spawnChild': 'spawnChild', 'xstate.stopChild': 'stopChild', 'xstate.stop': 'stopChild', 'xstate.cancel': 'cancel', 'xstate.enqueueActions': 'enqueueActions', 'xstate.inline': 'inline',
};

/** What a built-in does, from its own fields (a machine's) or its `params` (a config `parseXState` read). */
function builtInDetail(kind: StateActionKind, a: Record<string, unknown>): string | undefined {
  const p = isPlainObject(a.params) ? a.params : {};
  const event = eventTypeOf(a.event) ?? (typeof p.event === 'string' ? p.event : undefined);
  const to = typeof a.to === 'string' ? a.to : typeof p.to === 'string' ? p.to : undefined;
  switch (kind) {
    case 'assign': {
      const keys = isPlainObject(a.assignment) ? Object.keys(a.assignment) : Array.isArray(p.keys) ? p.keys.map(String) : [];
      return keys.length ? keys.join(', ') : undefined;
    }
    case 'raise': case 'emit': case 'sendParent': return event;
    case 'sendTo': return event && to ? `${event} to ${to}` : event ?? (to ? `to ${to}` : undefined);
    case 'log': return typeof a.value === 'string' ? a.value : typeof p.value === 'string' ? p.value : undefined;
    case 'spawnChild': return typeof a.src === 'string' ? a.src : typeof p.src === 'string' ? p.src : undefined;
    case 'stopChild': return typeof a.actorRef === 'string' ? a.actorRef : typeof p.actor === 'string' ? p.actor : undefined;
    case 'cancel': return typeof a.sendId === 'string' ? a.sendId : typeof p.id === 'string' ? p.id : undefined;
    default: return undefined;
  }
}

/** An action as it's drawn. Reads a string, `{ type, params }`, one of XState's built-ins (a function with a `type`), a
 *  built-in as `parseXState` writes it (`{ type: 'xstate.assign', params }`), or code written inline. */
export function describeAction(action: unknown): StateAction {
  if (typeof action === 'string') return { kind: 'named', name: action };
  if (typeof action === 'function' || isPlainObject(action)) {
    const a = action as unknown as Record<string, unknown>;
    const type = typeof a.type === 'string' ? a.type : undefined;
    const builtIn = type ? BUILT_IN[type] : undefined;
    if (builtIn === 'inline') {
      const named = isPlainObject(a.params) && typeof a.params.name === 'string' ? a.params.name : undefined;
      return { kind: 'inline', name: named ?? 'inline' };
    }
    if (builtIn) {
      // `sendParent` is `sendTo` the parent.
      const kind = builtIn === 'sendTo' && a.to === '#_parent' ? 'sendParent' : builtIn;
      const detail = builtInDetail(kind, a);
      return { kind, name: kind, ...(detail ? { detail } : null) };
    }
    if (type && typeof action === 'object') {
      const detail = paramsText(a.params);
      return { kind: 'named', name: type, ...(detail ? { detail } : null), ...(isPlainObject(a.params) ? { params: a.params } : null) };
    }
    // Code: a function written in the config, named if it was given one (not by the key it was written under).
    const name = typeof action === 'function' && action.name && !INFERRED.has(action.name) ? action.name : 'inline';
    return { kind: 'inline', name };
  }
  return { kind: 'inline', name: 'inline' };
}

/** A list of actions as written (`entry`, `exit`, `actions`): one, a list, or none. */
export const describeActions = (actions: unknown): StateAction[] => listOf(actions).map(describeAction);

/** What JavaScript names a function written straight under a config's key: no name of the author's. */
const INFERRED = new Set(['', 'anonymous', 'entry', 'exit', 'actions', 'guard', 'cond', 'src']);

const COMPOSED: Record<string, 'and' | 'or' | 'not'> = { 'xstate.and': 'and', 'xstate.or': 'or', 'xstate.not': 'not' };

/** A snapshot just big enough for XState's composed guards to evaluate inline parts against. */
const PROBE_SNAPSHOT = { machine: { implementations: { guards: {} } } };
const PROBE_ARGS = { context: undefined, event: undefined };
const yes = () => true;
const no = () => false;

/** Which of XState's `and` / `or` / `not` a guard function is. XState v5 gives each a `check` evaluator and its parts as
 *  `guards`; a production build renames the functions, so it's told by what `check` does with two inline parts:
 *  [true, false] then [false, true] gives `and` false, false; `or` true, true; `not` (which reads the first) false, true. */
function composedOp(r: Record<string, unknown>): 'and' | 'or' | 'not' | undefined {
  if (typeof r.type === 'string') return COMPOSED[r.type];
  if (typeof r.check !== 'function' || !Array.isArray(r.guards)) return undefined;
  const check = r.check as (snapshot: unknown, args: unknown, params: unknown) => unknown;
  try {
    const a = !!check(PROBE_SNAPSHOT, PROBE_ARGS, { guards: [yes, no] });
    const b = !!check(PROBE_SNAPSHOT, PROBE_ARGS, { guards: [no, yes] });
    if (!a && !b) return 'and';
    if (a && b) return 'or';
    if (!a && b) return 'not';
  } catch {
    // Not one of XState's: read it as all of its parts.
  }
  return 'and';
}

/** `stateIn(…)`: XState's function carries its `stateValue` and a `check`; `parseXState` writes `xstate.stateIn`. */
function stateInValue(r: Record<string, unknown>): string | undefined {
  const p = isPlainObject(r.params) ? r.params : {};
  if (r.type === 'xstate.stateIn') return typeof p.state === 'string' ? p.state : undefined;
  if (typeof r.check === 'function' && !Array.isArray(r.guards) && 'stateValue' in r) {
    return typeof r.stateValue === 'string' ? r.stateValue : JSON.stringify(r.stateValue);
  }
  return undefined;
}

/** A guard as a condition. Reads a name, `{ type, params }`, `and` / `or` / `not` / `stateIn` (XState's functions, told
 *  apart by what they do rather than by name, so a minified build reads the same; or as `parseXState` writes them:
 *  `{ type: 'xstate.and', params: { guards } }`), or code written inline. */
export function describeGuard(guard: unknown): StateGuard | undefined {
  if (guard === undefined || guard === null || guard === false) return undefined;
  const recordOf = (g: unknown) => (typeof g === 'function' || isPlainObject(g) ? g : {}) as Record<string, unknown>;
  const text = (g: unknown, inner: boolean): string => {
    if (typeof g === 'string') return g;
    const r = recordOf(g);
    const p = isPlainObject(r.params) ? r.params : {};
    const fnName = typeof g === 'function' ? g.name : undefined;
    const parts = Array.isArray(r.guards) ? r.guards : Array.isArray(p.guards) ? p.guards : null;
    const op = parts ? composedOp(r) : undefined;
    if (op && parts) {
      if (op === 'not') return `not ${text(parts[0], true)}`;
      const joined = parts.map((x) => text(x, true)).join(` ${op} `);
      return inner && parts.length > 1 ? `(${joined})` : joined;
    }
    const state = stateInValue(r);
    if (state !== undefined) return `in ${state}`;
    if (r.type === 'xstate.inline') return typeof p.name === 'string' ? p.name : 'inline';
    if (typeof r.type === 'string') {
      const args = paramsText(r.params);
      return args ? `${r.type}(${args})` : r.type;
    }
    return fnName && !INFERRED.has(fnName) ? fnName : 'inline';
  };
  if (typeof guard === 'string') return { name: guard, text: guard };
  const r = recordOf(guard);
  const p = isPlainObject(r.params) ? r.params : {};
  const said = text(guard, false);
  const fnName = typeof guard === 'function' ? guard.name : undefined;
  const hasParts = Array.isArray(r.guards) || Array.isArray(p.guards);
  const composed = (hasParts && !!composedOp(r)) || stateInValue(r) !== undefined;
  if (composed) return { name: said, text: said, composed: true };
  if (r.type === 'xstate.inline') return { name: said, text: said };
  if (typeof r.type === 'string') return { name: r.type, text: said, ...(isPlainObject(r.params) ? { params: r.params } : null) };
  // A guard written inline has no name to show, but it's still a guard.
  return { name: fnName && !INFERRED.has(fnName) ? fnName : 'inline', text: said };
}

/** XState gives an actor written inline a name of its own, which isn't anything to show. */
const srcName = (src: unknown) => (typeof src === 'string' && !src.startsWith('xstate.invoke.') ? src : 'actor');

/** XState's own id for an invoke without one: `0.m.s`. */
const ownInvokeId = (id: string | undefined, stateId: string) => !id || (id.endsWith(`.${stateId}`) && /^\d+$/.test(id.slice(0, -(stateId.length + 1))));

/** What a state invokes. */
function describeInvokes(n: StateMachineNode): StateInvoke[] {
  return (n.invoke ?? []).map((i) => {
    const input = i.input === undefined || typeof i.input === 'function' ? undefined : describeContextValue(i.input, 32);
    return { src: srcName(i.src), ...(i.id && !ownInvokeId(i.id, n.id) ? { id: i.id } : null), ...(input ? { input } : null) };
  });
}

/** A machine's id, what it's called, and its context, from its root and its config. */
export function describeMachine(machine: StateMachineLike): StateMachineSummary {
  const root = machine.root;
  const config = isPlainObject(machine.config) ? machine.config : {};
  const meta = isPlainObject(root.meta) ? root.meta : isPlainObject(config.meta) ? config.meta : {};
  const title = typeof meta.title === 'string' ? meta.title : typeof meta.name === 'string' ? meta.name : root.key || root.id;
  const description = root.description ?? (typeof config.description === 'string' ? config.description : undefined);
  const types = isPlainObject(config.types) && isPlainObject(config.types.context) ? config.types.context : {};
  const written = config.context;
  const context: StateContextEntry[] = [];
  const seen = new Set<string>();
  // A type says more than a value of it, when `parseXState` found one.
  for (const [key, type] of Object.entries(types)) {
    if (typeof type !== 'string') continue;
    seen.add(key);
    context.push({ key, value: type, from: 'type' });
  }
  if (isPlainObject(written)) {
    for (const [key, value] of Object.entries(written)) {
      if (seen.has(key)) continue;
      context.push({ key, value: typeof value === 'function' ? 'code' : describeContextValue(value), from: typeof value === 'function' ? 'code' : 'value' });
    }
  }
  return { id: root.key || root.id, title, ...(description ? { description } : null), context, ...(typeof written === 'function' ? { contextFromCode: true } : null) };
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

/** What kind of way out of a state an edge is, as XState has it. */
export type StateTransitionKind = 'event' | 'after' | 'done' | 'invoke' | 'always';

/** What a state's edge stands for: what's drawn on its label, and what simulating and editing need. */
export interface StateEdgeData {
  /** What kind of way out it is: an event, a delay, a state or an actor finishing, or `always`. */
  transition: StateTransitionKind;
  /** The event that takes it: an event's name (`*` for any), or XState's own `xstate.after…` and `xstate.done…`. Absent on
   *  `always`. */
  event?: string;
  /** What the event's called on the diagram: `loaded`, `*`, `after 500 ms`, `after BACKOFF`, `always`, `loadTrack: done`. */
  name?: string;
  /** Its guard, if it has one. */
  guard?: StateGuard;
  /** The actions it runs, in order. */
  actions?: StateAction[];
  /** An `after` transition's delay: ms, or the delay's name. */
  delay?: number | string;
  /** For an actor's `done`, `error` or `snapshot`: the actor, by its `src`. */
  actor?: string;
  /** It leaves and enters its target again even when that's where it is (`reenter: true`). */
  reenter?: boolean;
  /** The transition has no target: it stays where it is and only runs its actions. */
  internal?: boolean;
  /** How many targets the transition has, when it has more than one: each is an edge of its own, and the first's label is
   *  the one they all go from (`DiagramEdge.forkOf`). */
  targets?: number;
}

export interface StateNodeData {
  /** The state's key in its parent. */
  key: string;
  /** What kind of state it is, as XState has it. */
  type: StateMachineNode['type'];
  /** A history state's depth. */
  history?: 'shallow' | 'deep';
  /** The key of the state it starts in, when it holds others and isn't parallel. */
  initial?: string;
  /** What it runs as it's entered and as it's left. */
  entry: StateAction[];
  exit: StateAction[];
  /** The actors it invokes. */
  invoke: StateInvoke[];
  tags: string[];
  description?: string;
  /** Its `meta`, each value in a few words. */
  meta?: Readonly<Record<string, string>>;
  /** The root only: the machine's context. */
  context?: StateContextEntry[];
}

/** What an event's called on a diagram, and what kind of edge it makes. */
export function describeEvent(event: string): { name: string; kind: Exclude<StateTransitionKind, 'always'> } {
  if (event.startsWith('xstate.after.')) {
    const delay = event.split('.')[2]!;
    return { name: `after ${/^\d+$/.test(delay) ? `${Number(delay).toLocaleString('en-US')} ms` : delay}`, kind: 'after' };
  }
  if (event.startsWith('xstate.done.actor.')) return { name: 'done', kind: 'invoke' };
  if (event.startsWith('xstate.error.actor.')) return { name: 'error', kind: 'invoke' };
  if (event.startsWith('xstate.snapshot.')) return { name: 'snapshot', kind: 'invoke' };
  if (event.startsWith('xstate.done.state.')) return { name: 'done', kind: 'done' };
  return { name: event, kind: 'event' };
}

const metaOf = (meta: unknown): Readonly<Record<string, string>> | undefined => {
  if (!isPlainObject(meta) || !Object.keys(meta).length) return undefined;
  return Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, typeof v === 'string' ? v : describeContextValue(v, 32)]));
};

/** Which actor an `xstate.done.actor.<id>` (or error, snapshot) event is about, by its `src`. */
function actorOf(n: StateMachineNode, event: string): string | undefined {
  const id = /^xstate\.(?:done\.actor|error\.actor|snapshot)\.(.*)$/.exec(event)?.[1];
  const found = id === undefined ? undefined : n.invoke?.find((i) => i.id === id);
  return found ? srcName(found.src) : undefined;
}

/** The statechart look, on Diagram's generic looks: how each kind of state is drawn. A state that holds others is a
 *  group (dashed when parallel), a parallel state's child that holds others is a region, and a final state has a double
 *  border (and the final glyph in its header). Where a state starts is its `entry` marker. */
export const STATE_NODE_LOOK = {
  root: { kind: 'root' },
  atomic: { kind: 'node' },
  history: { kind: 'node' },
  compound: { kind: 'group' },
  parallel: { kind: 'group', variant: 'dashed' },
  region: { kind: 'region' },
  final: { kind: 'node', variant: 'double' },
} as const satisfies Record<string, Pick<DiagramNode, 'kind' | 'variant'>>;

/** The statechart look for each kind of way out: an event or a finish is a plain line, `always` is dashed, `after` dotted. */
export const STATE_EDGE_LOOK = {
  event: {},
  done: {},
  invoke: {},
  always: { variant: 'dashed' },
  after: { variant: 'dotted' },
} as const satisfies Record<StateTransitionKind, Pick<DiagramEdge, 'variant'>>;

/** The glyph each part is drawn with: an action's bolt, a guard's question, a delay's clock, an actor's play, a tag. */
export const STATE_GLYPHS = {
  action: 'bolt',
  guard: 'question-circle',
  delay: 'clock',
  invoke: 'play-circle',
  tag: 'tag',
  final: 'stop',
} as const satisfies Record<string, DiagramGlyph>;

/** An action as a chip: its name, and what it's given or does. */
const actionItem = (a: StateAction, i: number): DiagramSectionItem => ({ id: String(i), title: a.name, ...(a.detail ? { description: a.detail } : null), icon: STATE_GLYPHS.action, ...(a.kind === 'inline' ? { tone: 'muted' as const } : null) });

/** A state's sections: what it runs as it's entered and left, what it invokes, its tags and its meta. */
export function stateSections(data: StateNodeData): DiagramSection[] {
  const out: DiagramSection[] = [];
  if (data.context?.length) out.push({ id: 'context', title: 'Context', variant: 'code', items: data.context.map((c) => ({ id: c.key, title: c.key, description: c.value })) });
  if (data.entry.length) out.push({ id: 'entry', title: 'Entry actions', items: data.entry.map(actionItem) });
  if (data.exit.length) out.push({ id: 'exit', title: 'Exit actions', items: data.exit.map(actionItem) });
  if (data.invoke.length) {
    out.push({ id: 'invoke', title: 'Invoke', items: data.invoke.map((inv, i) => ({ id: String(i), title: inv.src, ...(inv.id || inv.input ? { description: [inv.id ? `id ${inv.id}` : '', inv.input ? `input ${inv.input}` : ''].filter(Boolean).join(' · ') } : null), icon: STATE_GLYPHS.invoke })) });
  }
  if (data.tags.length) out.push({ id: 'tags', title: 'Tags', items: data.tags.map((t) => ({ id: t, title: t, icon: STATE_GLYPHS.tag })) });
  if (data.meta) out.push({ id: 'meta', title: 'Meta', variant: 'list', items: Object.entries(data.meta).map(([k, v]) => ({ id: k, title: k, description: v })) });
  return out;
}

/** A transition's label: chips for its guard ("if canRetry"), its actions, and how it goes when that's out of the ordinary
 *  (re-entering, with no target, to several at once). With none, the label is a pill with only the event on it. */
export function transitionSections(data: StateEdgeData): DiagramSection[] {
  const items: DiagramSectionItem[] = [];
  if (data.guard) items.push({ id: 'guard', title: `if ${data.guard.text}`, icon: STATE_GLYPHS.guard });
  (data.actions ?? []).forEach((a, i) => items.push({ ...actionItem(a, i), id: `action-${i}` }));
  // How it goes is a modifier, not something it does: a quiet line of text under its chips, not a chip.
  const how: DiagramSectionItem[] = [];
  if (data.reenter) how.push({ id: 'reenter', title: 'reenters', tone: 'muted' });
  if (data.internal) how.push({ id: 'internal', title: 'no target', tone: 'muted' });
  if (data.targets) how.push({ id: 'targets', title: `${data.targets} targets`, description: 'at once', tone: 'muted' });
  return [...(items.length ? [{ id: 'label', items }] : []), ...(how.length ? [{ id: 'how', variant: 'list' as const, items: how }] : [])];
}

/** A transition in statechart notation, `event [guard] / action, action`: what a Mermaid statechart writes, and a screen
 *  reader says. */
export function transitionNotation(data: StateEdgeData | undefined): string {
  if (!data) return '';
  const actions = (data.actions ?? []).map((a) => a.name);
  return `${data.name ?? data.event ?? ''}${data.guard ? ` [${data.guard.text}]` : ''}${actions.length ? ` / ${actions.join(', ')}` : ''}`;
}

/** A machine as a draft for `useDiagramLayout`: a node for each state, drawn with everything it says, and an edge for each
 *  way out, including `always`, `after`, `invoke` and transitions that stay where they are, labelled with everything they
 *  say. Where a state starts is its `entry` marker. Ids follow the machine's, and stay the same each time, so a state can be
 *  found again. */
export function machineToDraft(machine: StateMachineLike, onEdge?: (transition: StateMachineTransition, edgeId: string, place: TransitionPlace) => void): DiagramDraft<StateNodeData, StateEdgeData> & { edges: DiagramEdge<StateEdgeData>[] } {
  const nodes: DiagramDraftNode<StateNodeData>[] = [];
  const edges: DiagramEdge<StateEdgeData>[] = [];
  const used = new Map<string, number>();
  const edgeId = (base: string) => {
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}#${n}` : base;
  };
  /** What every edge of one transition says: its event as drawn, guard, actions, and how it goes. */
  const transitionData = (n: StateMachineNode, t: StateMachineTransition, kind: StateTransitionKind, event: string | undefined, drawnAs: string): StateEdgeData => {
    const guard = describeGuard(t.guard);
    const actions = describeActions(t.actions);
    const actor = event ? actorOf(n, event) : undefined;
    const name = actor ? `${actor}: ${drawnAs}` : drawnAs;
    return {
      transition: kind, ...(event ? { event } : null), name,
      ...(guard ? { guard } : null),
      ...(actions.length ? { actions } : null),
      ...(t.delay !== undefined ? { delay: t.delay } : null),
      ...(actor ? { actor } : null),
      ...(t.reenter ? { reenter: true } : null),
      ...(!t.target?.length ? { internal: true } : null),
      ...((t.target?.length ?? 0) > 1 ? { targets: t.target!.length } : null),
    };
  };
  /** One edge of a transition. Past its first target, an edge shares the first's label: one label, forking to each. */
  const edgeOf = (id: string, from: StateMachineNode, to: StateMachineNode, data: StateEdgeData, forkOf?: string): DiagramEdge<StateEdgeData> => {
    const sections = transitionSections(data);
    return {
      id, from: from.id, to: to.id, ...STATE_EDGE_LOOK[data.transition], title: data.name,
      ...(forkOf ? { forkOf } : null),
      ...(data.transition === 'after' ? { icon: STATE_GLYPHS.delay } : null),
      ...(sections.length ? { sections } : null),
      data,
    };
  };
  // The states each state starts in.
  const starts = new Set<string>();
  const walk = (n: StateMachineNode, parent: string | null, path: readonly string[]) => {
    const kids = Object.values(n.states ?? {});
    const invoke = describeInvokes(n);
    const isRegion = n.parent?.type === 'parallel' && kids.length > 0;
    const look = STATE_NODE_LOOK[!n.parent ? 'root' : n.type === 'parallel' ? 'parallel' : isRegion ? 'region' : n.type === 'final' ? 'final' : kids.length ? 'compound' : 'atomic'];
    const meta = metaOf(n.meta);
    const summary = parent === null ? describeMachine(machine) : null;
    const initial = kids.length && n.type !== 'parallel' ? n.initial?.target ?? [] : [];
    for (const t of initial) starts.add(t.id);
    const data: StateNodeData = {
      key: n.key, type: n.type,
      ...(n.type === 'history' ? { history: n.history === 'deep' ? 'deep' as const : 'shallow' as const } : null),
      ...(initial[0] ? { initial: initial[0].key } : null),
      entry: describeActions(n.config?.entry), exit: describeActions(n.config?.exit), invoke,
      tags: [...(n.tags ?? [])],
      ...(n.description ? { description: n.description } : null),
      ...(meta ? { meta } : null),
      ...(summary ? { context: summary.context } : null),
    };
    const sections = stateSections(data);
    const description = summary ? summary.description : n.description;
    const icon: DiagramGlyph | undefined = n.type === 'final' ? STATE_GLYPHS.final : n.type === 'history' ? { text: n.history === 'deep' ? 'H*' : 'H' } : undefined;
    nodes.push({
      id: n.id, parent, ...look, title: summary ? summary.title : n.key,
      ...(icon ? { icon } : null),
      ...(n.type === 'parallel' ? { trailing: 'parallel' } : null),
      ...(description ? { description } : null),
      ...(sections.length ? { sections } : null),
      ...(starts.has(n.id) ? { entry: true } : null),
      data,
    });
    for (const [event, list] of n.transitions) {
      const { name, kind } = describeEvent(event);
      list.forEach((t, index) => {
        const said = transitionData(n, t, kind, event, name);
        let first: string | undefined;
        (said.internal ? [n] : t.target!).forEach((to, target) => {
          const id = edgeId(`${n.id}:${event}->${to.id}`);
          edges.push(edgeOf(id, n, to, said, first));
          first ??= id;
          onEdge?.(t, id, { state: path, stateId: n.id, event, index, target });
        });
      });
    }
    (n.always ?? []).forEach((t, index) => {
      const said = transitionData(n, t, 'always', undefined, 'always');
      let first: string | undefined;
      (said.internal ? [n] : t.target!).forEach((to, target) => {
        const id = edgeId(`${n.id}:always->${to.id}`);
        edges.push(edgeOf(id, n, to, said, first));
        first ??= id;
        onEdge?.(t, id, { state: path, stateId: n.id, event: null, index, target });
      });
    });
    for (const k of kids) walk(k, n.id, [...path, k.key]);
  };
  walk(machine.root, null, []);
  return { nodes, edges };
}

/** Which edges each of a machine's transitions is drawn as, by the ids `machineToDraft` gives them. A transition with two
 *  targets is two edges, the second forking from the first's label. */
export function machineEdgeIds(machine: StateMachineLike): Map<StateMachineTransition, string[]> {
  const out = new Map<StateMachineTransition, string[]>();
  machineToDraft(machine, (transition, id) => {
    const ids = out.get(transition);
    if (ids) ids.push(id);
    else out.set(transition, [id]);
  });
  return out;
}

/** Where each edge is written in the machine's config, by the ids `machineToDraft` gives them. An initial marker's isn't
 *  there, as it's only drawn. */
export function machineEdgePlaces(machine: StateMachineLike): Map<string, TransitionPlace> {
  const out = new Map<string, TransitionPlace>();
  machineToDraft(machine, (_transition, id, place) => { out.set(id, place); });
  return out;
}

/** Where each state is in the machine's config, by its id: the keys from the root. */
export function machineStatePaths(machine: StateMachineLike): Map<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  const walk = (n: StateMachineNode, path: readonly string[]) => {
    out.set(n.id, path);
    for (const k of Object.values(n.states ?? {})) walk(k, [...path, k.key]);
  };
  walk(machine.root, []);
  return out;
}
