/* ══ State diagram editing — changes to a machine's config, as plain data ══
   Each of these takes a config and returns a new one, changing only what it has to, so what's saved is what was written. A
   config only names its implementations, so no edit ever touches code. Nothing but `tryEdit` asks XState what it makes of the
   result, and that's what says no. XState comes in through the argument, as it's an optional peer. */
import type { TransitionPlace } from '@/lib/state-diagram-model';
import { createSimulation, NEVER_SETTLES, standInConfig, type MachineNames } from '@/lib/state-diagram-simulation';

/** A state's place in a config: its keys, from the root. */
export type StatePath = readonly string[];
export type StateMachineConfig = Record<string, unknown>;

/** An edit that can't be done, and why, in words. */
export class StateEditRefused extends Error {}

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const sameStart = (path: StatePath, start: StatePath) => start.every((k, i) => path[i] === k) && path.length >= start.length;
const rootIdOf = (config: StateMachineConfig) => (typeof config.id === 'string' ? config.id : '(machine)');

/** The state at `path`, or null. */
export function stateAt(config: StateMachineConfig, path: StatePath): StateMachineConfig | null {
  let at: unknown = config;
  for (const key of path) at = isPlain(at) && isPlain(at.states) ? at.states[key] : undefined;
  return isPlain(at) ? at : null;
}

/** A new config with `fn` done to the state at `path`, and all that isn't on the way to it still the same objects. */
function changeState(config: StateMachineConfig, path: StatePath, fn: (state: StateMachineConfig) => StateMachineConfig): StateMachineConfig {
  if (!path.length) return fn(config);
  const [key, ...rest] = path;
  const states = config.states as Record<string, StateMachineConfig>;
  return { ...config, states: { ...states, [key]: changeState(states[key], rest, fn) } };
}

/* ── Targets, the way XState reads them ── */

/** A target as it was written: what it's relative to, and the keys after that, still escaped. */
interface WrittenTarget {
  head: string;
  base: StatePath;
  tail: string[];
}

const segments = (text: string): string[] => {
  const out: string[] = [];
  let at = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') { at += text[i] + (text[i + 1] ?? ''); i++; }
    else if (text[i] === '.') { out.push(at); at = ''; }
    else at += text[i];
  }
  out.push(at);
  return out;
};
const unescape = (segment: string) => segment.replace(/\\(.)/g, '$1');
const escapeKey = (key: string) => key.replace(/[\\.]/g, '\\$&');

/** Only ones that aren't a path can be found by id: an id's the first part of a `#id.path` target. */
function explicitIds(config: StateMachineConfig): Map<string, StatePath> {
  const ids = new Map<string, StatePath>([[rootIdOf(config), []]]);
  const walk = (s: StateMachineConfig, path: StatePath) => {
    if (typeof s.id === 'string') ids.set(s.id, path);
    if (isPlain(s.states)) for (const [k, kid] of Object.entries(s.states)) if (isPlain(kid)) walk(kid, [...path, k]);
  };
  walk(config, []);
  return ids;
}

function parseTarget(text: string, from: StatePath, ids: ReadonlyMap<string, StatePath>, relativeTo: 'parent' | 'self'): WrittenTarget | null {
  if (text.startsWith('#')) {
    const [id, ...tail] = segments(text.slice(1));
    const base = ids.get(unescape(id));
    return base ? { head: tail.length ? `#${id}.` : `#${id}`, base, tail } : null;
  }
  if (text.startsWith('.')) return { head: '.', base: from, tail: segments(text.slice(1)) };
  if (relativeTo === 'self') return { head: '', base: from, tail: segments(text) };
  return from.length ? { head: '', base: from.slice(0, -1), tail: segments(text) } : null;
}
const pathOfTarget = (w: WrittenTarget): StatePath => [...w.base, ...w.tail.map(unescape)];
const textOfTarget = (w: WrittenTarget) => w.head + w.tail.join('.');

type TargetVisit = (w: WrittenTarget) => string | null;

const GONE = Symbol('gone');

/** A transition with its targets rewritten. If it's left with none it's gone, as otherwise it'd stay where it was instead. */
function rewriteEntry(entry: unknown, visit: (text: string) => string | null): unknown {
  if (typeof entry === 'string') return visit(entry) ?? GONE;
  if (!isPlain(entry) || entry.target === undefined) return entry;
  const next = asList(entry.target).map((t) => (typeof t === 'string' ? visit(t) : t)).filter((t) => t !== null);
  if (!next.length) return GONE;
  return { ...entry, target: Array.isArray(entry.target) ? next : next[0] };
}

function rewriteValue(value: unknown, visit: (text: string) => string | null): unknown {
  if (!Array.isArray(value)) return rewriteEntry(value, visit);
  const out = value.map((e) => rewriteEntry(e, visit)).filter((e) => e !== GONE);
  return out.length ? out : GONE;
}

/** Sets `out[key]` to `value`, or takes it away if it's gone. */
function put(out: Record<string, unknown>, key: string, value: unknown) {
  if (value === GONE) delete out[key];
  else out[key] = value;
}

function rewriteRecord(record: Record<string, unknown>, visit: (text: string) => string | null): Record<string, unknown> | typeof GONE {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) put(out, k, rewriteValue(v, visit));
  return Object.keys(out).length ? out : GONE;
}

function rewriteTargets(state: StateMachineConfig, path: StatePath, ids: ReadonlyMap<string, StatePath>, visit: TargetVisit): StateMachineConfig {
  const out: StateMachineConfig = { ...state };
  const parsed = (relativeTo: 'parent' | 'self') => (text: string) => {
    const w = parseTarget(text, path, ids, relativeTo);
    return w ? visit(w) : text;
  };
  const target = parsed('parent');
  if (isPlain(state.on)) put(out, 'on', rewriteRecord(state.on, target));
  if (isPlain(state.after)) put(out, 'after', rewriteRecord(state.after, target));
  if (state.always !== undefined) put(out, 'always', rewriteValue(state.always, target));
  if (state.onDone !== undefined) put(out, 'onDone', rewriteValue(state.onDone, target));
  if (state.invoke !== undefined) {
    const one = (inv: unknown) => {
      if (!isPlain(inv)) return inv;
      const made: Record<string, unknown> = { ...inv };
      for (const k of ['onDone', 'onError', 'onSnapshot']) if (inv[k] !== undefined) put(made, k, rewriteValue(inv[k], target));
      return made;
    };
    out.invoke = Array.isArray(state.invoke) ? state.invoke.map(one) : one(state.invoke);
  }
  // Where it starts is left as it was, if what it says has gone, for XState to refuse.
  const self = parsed('self');
  if (typeof state.initial === 'string') out.initial = self(state.initial) ?? state.initial;
  else if (isPlain(state.initial) && typeof state.initial.target === 'string') out.initial = { ...state.initial, target: self(state.initial.target) ?? state.initial.target };
  if (state.type === 'history' && typeof state.target === 'string') {
    const next = target(state.target);
    if (next === null) delete out.target;
    else out.target = next;
  }
  if (isPlain(state.states)) {
    out.states = Object.fromEntries(Object.entries(state.states).map(([k, kid]) => [k, isPlain(kid) ? rewriteTargets(kid, [...path, k], ids, visit) : kid]));
  }
  return out;
}

/** What to write to get from `from` to `to`, in the shortest of the forms XState takes. */
export function targetText(config: StateMachineConfig, from: StatePath, to: StatePath): string {
  const keys = to.map(escapeKey);
  if (from.length && to.length === from.length && from.slice(0, -1).every((k, i) => k === to[i])) return keys[keys.length - 1];
  if (to.length > from.length && sameStart(to, from)) return `.${keys.slice(from.length).join('.')}`;
  return [`#${escapeKey(rootIdOf(config))}`, ...keys].join('.');
}

/* ── Names ── */

/** Why a state can't be called this among these others, or null if it can. */
export function stateNameProblem(name: string, others: readonly string[]): string | null {
  if (!name.trim()) return 'A state needs a name.';
  if (name !== name.trim()) return `A state’s name can’t start or end with a space: “${name}”.`;
  if (name.includes('.') || name.startsWith('#')) return `A state’s name can’t have a dot in it or start with #, as targets use those: “${name}”.`;
  if (others.includes(name)) return `There’s already a state called “${name}” there.`;
  return null;
}

/** Why an event can't be called this, or null if it can. */
export function eventNameProblem(name: string): string | null {
  if (!name.trim()) return 'An event needs a name.';
  if (name !== name.trim()) return `An event’s name can’t start or end with a space: “${name}”.`;
  if (name.startsWith('xstate.')) return `Events starting with xstate. are XState’s own: “${name}”.`;
  return null;
}

/** The first of `base`, `base2`, `base3` and so on that's free. */
export function uniqueName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) if (!taken.includes(`${base}${n}`)) return `${base}${n}`;
}

const keysOf = (state: StateMachineConfig | null) => (state && isPlain(state.states) ? Object.keys(state.states) : []);

/* ── States ── */

/** A new state in `parent`. If `parent` had none, it's where it starts now, unless they're all at once. */
export function addState(config: StateMachineConfig, parent: StatePath, key: string): StateMachineConfig {
  const at = stateAt(config, parent);
  if (!at) throw new StateEditRefused(`There’s no state at ${parent.join('.') || 'the root'}.`);
  const problem = stateNameProblem(key, keysOf(at));
  if (problem) throw new StateEditRefused(problem);
  return changeState(config, parent, (s) => ({
    ...s,
    ...(s.type !== 'parallel' && s.initial === undefined ? { initial: key } : null),
    states: { ...(isPlain(s.states) ? s.states : null), [key]: {} },
  }));
}

/** Takes a state away, with whatever's inside it and every transition that goes to any of that. A transition left with no
 *  targets goes too, as otherwise it'd stay where it was instead. If it's where its parent starts, and there are others, that's
 *  left for XState to refuse. */
export function removeState(config: StateMachineConfig, path: StatePath): StateMachineConfig {
  if (!path.length) throw new StateEditRefused('The machine itself can’t be deleted.');
  if (!stateAt(config, path)) throw new StateEditRefused(`There’s no state at ${path.join('.')}.`);
  const ids = explicitIds(config);
  const rewritten = rewriteTargets(config, [], ids, (w) => (sameStart(pathOfTarget(w), path) ? null : textOfTarget(w)));
  const key = path[path.length - 1];
  return changeState(rewritten, path.slice(0, -1), (parent) => {
    const { [key]: _gone, ...rest } = parent.states as Record<string, unknown>;
    if (Object.keys(rest).length) return { ...parent, states: rest };
    // That was the last, so it doesn't hold anything now.
    const { states: _states, initial: _initial, ...left } = parent;
    if (left.type === 'parallel' || left.type === 'compound') delete left.type;
    return left;
  });
}

/** A new name for a state, and for wherever it's written that way: targets from anywhere, however they're written, and where
 *  its parent starts. An id that's written out stays as it is. */
export function renameState(config: StateMachineConfig, path: StatePath, key: string): StateMachineConfig {
  if (!path.length) throw new StateEditRefused('The machine’s own name is its id, in its config.');
  const parent = stateAt(config, path.slice(0, -1));
  const old = path[path.length - 1];
  if (!stateAt(config, path)) throw new StateEditRefused(`There’s no state at ${path.join('.')}.`);
  if (key === old) return config;
  const problem = stateNameProblem(key, keysOf(parent));
  if (problem) throw new StateEditRefused(problem);
  const ids = explicitIds(config);
  const rewritten = rewriteTargets(config, [], ids, (w) => {
    // A target only says this state's name if it comes after what the target's relative to.
    if (!sameStart(pathOfTarget(w), path) || w.base.length >= path.length) return textOfTarget(w);
    const tail = [...w.tail];
    tail[path.length - 1 - w.base.length] = escapeKey(key);
    return w.head + tail.join('.');
  });
  return changeState(rewritten, path.slice(0, -1), (p) => ({
    ...p,
    // In the same place, so that nothing else moves.
    states: Object.fromEntries(Object.entries(p.states as Record<string, unknown>).map(([k, v]) => [k === old ? key : k, v])),
  }));
}

/** Where a state with others in it starts. */
export function setInitial(config: StateMachineConfig, parent: StatePath, key: string): StateMachineConfig {
  const at = stateAt(config, parent);
  if (!at || !keysOf(at).includes(key)) throw new StateEditRefused(`There’s no state called “${key}” there.`);
  if (at.type === 'parallel') throw new StateEditRefused('Everything in a parallel state starts at once.');
  return changeState(config, parent, (s) => ({ ...s, initial: isPlain(s.initial) ? { ...s.initial, target: key } : key }));
}

/* ── Transitions ── */

type Slot = readonly (string | number)[];

const getIn = (state: unknown, slot: Slot): unknown => slot.reduce<unknown>((at, k) => (at as Record<string | number, unknown> | undefined)?.[k], state);

/** A copy with what's at `slot` changed, or taken away, along with whatever that leaves empty on the way. */
function setIn(state: Record<string, unknown>, slot: Slot, value: unknown): Record<string, unknown> {
  const [key, ...rest] = slot;
  const out: Record<string, unknown> = Array.isArray(state) ? ([...state] as never) : { ...state };
  if (rest.length) {
    const inner = setIn((out as Record<string | number, unknown>)[key] as Record<string, unknown>, rest, value);
    const empty = isPlain(inner) && !Object.keys(inner).length;
    if (empty) delete (out as Record<string | number, unknown>)[key];
    else (out as Record<string | number, unknown>)[key] = inner;
  } else if (value === undefined) delete (out as Record<string | number, unknown>)[key];
  else (out as Record<string | number, unknown>)[key] = value;
  return out;
}

/** Where in its state's config a transition's list is, going by the event it's drawn with. */
function slotOf(state: StateMachineConfig, place: TransitionPlace): Slot {
  const { event, stateId } = place;
  if (event === null) return ['always'];
  if (isPlain(state.on) && state.on[event] !== undefined) return ['on', event];
  if (event.startsWith('xstate.after.')) return ['after', event.slice('xstate.after.'.length, -(stateId.length + 1))];
  if (event === `xstate.done.state.${stateId}`) return ['onDone'];
  const actor = /^xstate\.(done\.actor|error\.actor|snapshot)\.(.*)$/.exec(event);
  if (actor) {
    const field = actor[1] === 'done.actor' ? 'onDone' : actor[1] === 'error.actor' ? 'onError' : 'onSnapshot';
    const invokes = asList(state.invoke);
    const i = invokes.findIndex((inv, n) => (isPlain(inv) && inv.id === actor[2]) || `${n}.${stateId}` === actor[2]);
    if (i >= 0) return Array.isArray(state.invoke) ? ['invoke', i, field] : ['invoke', field];
  }
  throw new StateEditRefused(`That transition isn’t in the config: ${event}.`);
}

/** A transition from `from` on `event`. There can be any number of the same event, or the same two states. */
export function addTransition(config: StateMachineConfig, from: StatePath, event: string, to: StatePath, guard?: string): StateMachineConfig {
  const problem = eventNameProblem(event);
  if (problem) throw new StateEditRefused(problem);
  if (!stateAt(config, from)) throw new StateEditRefused(`There’s no state at ${from.join('.') || 'the root'}.`);
  if (!stateAt(config, to)) throw new StateEditRefused(`There’s no state at ${to.join('.') || 'the root'}.`);
  const target = targetText(config, from, to);
  const entry = guard ? { target, guard } : target;
  return changeState(config, from, (s) => {
    const on = isPlain(s.on) ? s.on : {};
    const had = on[event];
    return { ...s, on: { ...on, [event]: had === undefined ? entry : [...asList(had), entry] } };
  });
}

/** Takes a transition away, or only the one target of it, when it has more. */
export function removeTransition(config: StateMachineConfig, place: TransitionPlace): StateMachineConfig {
  return changeState(config, place.state, (s) => {
    const slot = slotOf(s, place);
    const value = getIn(s, slot);
    const list = asList(value);
    const entry = list[place.index];
    if (entry === undefined) throw new StateEditRefused('That transition isn’t in the config.');
    if (isPlain(entry) && Array.isArray(entry.target) && entry.target.length > 1) {
      const narrowed = { ...entry, target: entry.target.filter((_, i) => i !== place.target) };
      return setIn(s, slot, Array.isArray(value) ? list.map((e, i) => (i === place.index ? narrowed : e)) : narrowed);
    }
    const left = list.filter((_, i) => i !== place.index);
    return setIn(s, slot, left.length ? left : undefined);
  });
}

/** Changes one entry of a transition's list, as an object. */
function changeEntry(config: StateMachineConfig, place: TransitionPlace, fn: (entry: Record<string, unknown>) => Record<string, unknown>): StateMachineConfig {
  return changeState(config, place.state, (s) => {
    const slot = slotOf(s, place);
    const value = getIn(s, slot);
    const list = asList(value);
    const entry = list[place.index];
    if (entry === undefined) throw new StateEditRefused('That transition isn’t in the config.');
    const made = fn(typeof entry === 'string' ? { target: entry } : (entry as Record<string, unknown>));
    return setIn(s, slot, Array.isArray(value) ? list.map((e, i) => (i === place.index ? made : e)) : made);
  });
}

/** Which event takes it. Only an event of your own can change: `after` and `done` are what they are. */
export function setTransitionEvent(config: StateMachineConfig, place: TransitionPlace, event: string): StateMachineConfig {
  const problem = eventNameProblem(event);
  if (problem) throw new StateEditRefused(problem);
  const state = stateAt(config, place.state);
  if (place.event === null || !isPlain(state?.on) || state.on[place.event] === undefined) throw new StateEditRefused('Only an event of your own can be renamed. This one comes from what the state does.');
  if (event === place.event) return config;
  return changeState(config, place.state, (s) => {
    const on = s.on as Record<string, unknown>;
    const list = asList(on[place.event!]);
    const entry = list[place.index];
    if (entry === undefined) throw new StateEditRefused('That transition isn’t in the config.');
    const left = list.filter((_, i) => i !== place.index);
    if (on[event] !== undefined) {
      const out = Object.fromEntries(Object.entries(on).map(([k, v]) => [k, k === event ? [...asList(v), entry] : v]));
      if (left.length) out[place.event!] = left;
      else delete out[place.event!];
      return { ...s, on: out };
    }
    // In the same place, if it was the only one.
    if (!left.length) return { ...s, on: Object.fromEntries(Object.entries(on).map(([k, v]) => (k === place.event ? [event, v] : [k, v]))) };
    return { ...s, on: { ...on, [place.event!]: left, [event]: entry } };
  });
}

/** Which guard it goes through, by name, or none. What the name means stays out of the config. */
export function setTransitionGuard(config: StateMachineConfig, place: TransitionPlace, guard: string | null): StateMachineConfig {
  return changeEntry(config, place, ({ guard: _guard, ...rest }) => (guard ? { ...rest, guard } : rest));
}

/** Where it goes to. */
export function setTransitionTarget(config: StateMachineConfig, place: TransitionPlace, to: StatePath): StateMachineConfig {
  if (!stateAt(config, to)) throw new StateEditRefused(`There’s no state at ${to.join('.') || 'the root'}.`);
  const text = targetText(config, place.state, to);
  return changeEntry(config, place, (entry) => ({
    ...entry,
    target: Array.isArray(entry.target) ? entry.target.map((t, i) => (i === place.target ? text : t)) : text,
  }));
}

/** Where it comes from. Only an event's can move: `always`, `after` and `done` go with what their state does. */
export function setTransitionSource(config: StateMachineConfig, place: TransitionPlace, from: StatePath): StateMachineConfig {
  const state = stateAt(config, place.state);
  if (place.event === null || !isPlain(state?.on) || state.on[place.event] === undefined) throw new StateEditRefused('This one goes with what its state does, so it can’t move to another.');
  if (!stateAt(config, from)) throw new StateEditRefused(`There’s no state at ${from.join('.') || 'the root'}.`);
  if (from.join('\0') === place.state.join('\0')) return config;
  const entry = asList(state.on[place.event])[place.index];
  if (entry === undefined) throw new StateEditRefused('That transition isn’t in the config.');
  const ids = explicitIds(config);
  // Its targets are the same states, so they may need writing another way, from there.
  const moved = rewriteEntry(entry, (text) => {
    const w = parseTarget(text, place.state, ids, 'parent');
    return w ? targetText(config, from, pathOfTarget(w)) : text;
  });
  return changeState(removeWhole(config, place), from, (s) => {
    const on = isPlain(s.on) ? s.on : {};
    const had = on[place.event!];
    return { ...s, on: { ...on, [place.event!]: had === undefined ? moved : [...asList(had), moved] } };
  });
}

function removeWhole(config: StateMachineConfig, place: TransitionPlace): StateMachineConfig {
  return changeState(config, place.state, (s) => {
    const slot = slotOf(s, place);
    const left = asList(getIn(s, slot)).filter((_, i) => i !== place.index);
    return setIn(s, slot, left.length ? left : undefined);
  });
}

/** Several at once, as one edit. Transitions go first, from the end of each list, so that the others stay where they were
 *  found, and what's left of the states after that. */
export function removeItems(config: StateMachineConfig, items: { states?: readonly StatePath[]; transitions?: readonly TransitionPlace[] }): StateMachineConfig {
  const places = [...(items.transitions ?? [])].sort((a, b) => b.index - a.index || b.target - a.target);
  let next = config;
  for (const place of places) next = removeTransition(next, place);
  // Inside one that's going goes with it.
  const paths = items.states ?? [];
  const outermost = paths.filter((p) => !paths.some((q) => q !== p && sameStart(p, q)));
  for (const path of outermost) next = removeState(next, path);
  return next;
}

/* ── What it says about code ── */

/** Where a config has code written into it, which JSON can't hold, as dotted paths. */
export function inlineCodeIn(config: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === 'function') out.push(path);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (isPlain(v)) for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(config, '');
  return out;
}

export type StateMachineImplementations = Partial<Record<keyof MachineNames, Readonly<Record<string, unknown>> | undefined>>;

/** What a config names with nothing behind it. A delay that's written as a number has its own, so it's not named. */
export function missingImplementations(config: unknown, implementations: StateMachineImplementations = {}): MachineNames {
  const { names } = standInConfig(config);
  const missing = (kind: keyof MachineNames) => names[kind].filter((name) => !implementations[kind]?.[name]);
  return { guards: missing('guards'), actions: missing('actions'), actors: missing('actors'), delays: missing('delays') };
}

/* ── Asking XState ── */

export type EditOutcome<M = unknown> = { ok: true; config: StateMachineConfig; machine: M } | { ok: false; reason: string };

type XState = Parameters<typeof createSimulation>[0];

/** Does an edit, and asks XState about the result, which is what decides. It starts it too, with stand-ins, as there are things
 *  it only finds then. One that never settles isn't refused, as there's no reason it can't be on its way to being something
 *  else. Simulating it says what's wrong with it. */
export function tryEdit<M = unknown>(xstate: XState, config: StateMachineConfig, edit: (config: StateMachineConfig) => StateMachineConfig): EditOutcome<M> {
  try {
    const next = edit(config);
    const machine = xstate.createMachine(next as never) as M;
    const trial = createSimulation(xstate, next);
    const { status, error } = trial.get();
    trial.stop();
    if (status === 'error' && error && !error.startsWith(NEVER_SETTLES)) return { ok: false, reason: error };
    return { ok: true, config: next, machine };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
