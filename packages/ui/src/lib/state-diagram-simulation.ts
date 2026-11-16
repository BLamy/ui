/* ══ State diagram simulation — running a machine with nothing real behind it ══
   A machine runs in the page with stand-ins for what it names: guards answer as you've set them, actions do nothing, invoked
   actors wait until you say how they finished, and delays are in a clock that only moves when it's told. So none of an app's
   code runs, and time can be stepped. XState comes in through the argument, as it's an optional peer.

   A machine can loop through `always` for ever, which would hang the page. Each `always` here goes through a guard that counts,
   and past a limit it stops the machine and says so. */
import { describeEvent, machineEdgeIds, type StateMachineLike, type StateMachineNode, type StateMachineTransition } from '@/lib/state-diagram-model';

/* ── The clock ── */

interface SimTimer { id: number; due: number; fn: () => void }

/** A clock for XState that only moves when it's told. */
export class SimulationClock {
  now = 0;
  private timers = new Map<number, SimTimer>();
  private nextId = 1;

  setTimeout = (fn: (...args: unknown[]) => void, ms: number): number => {
    const id = this.nextId++;
    this.timers.set(id, { id, due: this.now + Math.max(0, ms), fn: () => fn() });
    return id;
  };

  clearTimeout = (id: unknown): void => { this.timers.delete(id as number); };

  /** When the next thing's due, or null. */
  nextDue(): number | null {
    let best: number | null = null;
    for (const t of this.timers.values()) if (best === null || t.due < best) best = t.due;
    return best;
  }

  /** Fires the next timer due by `by`, moving to when it's due. False if there isn't one. */
  fireNext(by = Infinity): boolean {
    let next: SimTimer | null = null;
    for (const t of this.timers.values()) if (t.due <= by && (!next || t.due < next.due || (t.due === next.due && t.id < next.id))) next = t;
    if (!next) return false;
    this.now = next.due;
    this.timers.delete(next.id);
    next.fn();
    return true;
  }

  /** Moves to `to`, firing what comes due on the way, in order. It stops where it is after `limit` of them and returns false,
   *  as timers of no length can go round for ever without the clock moving. */
  advance(to: number, limit = Infinity): boolean {
    for (let fired = 0; this.fireNext(to); fired++) if (fired + 1 >= limit && this.nextDue() !== null && this.nextDue()! <= to) return false;
    this.now = Math.max(this.now, to);
    return true;
  }
}

/* ── What a machine names ── */

export interface MachineNames {
  guards: string[];
  actions: string[];
  actors: string[];
  delays: string[];
}

const SETTLE = '__bl_settle';
const INLINE_GUARD = '__bl_inline_guard';
const INLINE_ACTION = '__bl_inline_action';
const INLINE_ACTOR = '__bl_inline_actor';

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A config that can run with nothing real behind it, and what it names. Every `always` goes through the guard that counts, so
 * it can't loop for ever, and whatever's written inline, which is code, is taken out and given a stand-in with a name of its
 * own, so that the same transitions are still there. Context and output go too, as they can be code, and nothing's left to
 * read them. The original's left alone.
 */
export function standInConfig(config: unknown): { config: Record<string, unknown>; names: MachineNames } {
  const names: { guards: Set<string>; actions: Set<string>; actors: Set<string>; delays: Set<string> } = { guards: new Set(), actions: new Set(), actors: new Set(), delays: new Set() };
  const guardRef = (g: unknown): unknown => {
    if (typeof g === 'string') { names.guards.add(g); return g; }
    if (isPlain(g) && typeof g.type === 'string') { names.guards.add(g.type); return { type: g.type }; }
    return g ? INLINE_GUARD : undefined;
  };
  const actionsOf = (a: unknown): unknown => {
    const list = Array.isArray(a) ? a : a === undefined ? [] : [a];
    // One written inline still counts: an event with only that to do can still be taken.
    return list.map((x) => {
      const name = typeof x === 'string' ? x : isPlain(x) && typeof x.type === 'string' ? x.type : null;
      if (!name) return INLINE_ACTION;
      names.actions.add(name);
      return name;
    });
  };
  const transition = (t: unknown): unknown => {
    if (typeof t === 'string' || t === undefined || t === null) return t;
    if (Array.isArray(t)) return t.map(transition);
    if (!isPlain(t)) return t;
    const { guard, actions, ...rest } = t;
    const g = guardRef(guard);
    return { ...rest, ...(g ? { guard: g } : null), ...(actions !== undefined ? { actions: actionsOf(actions) } : null) };
  };
  const counted = (t: unknown): unknown => {
    if (typeof t === 'string') return { target: t, guard: { type: SETTLE } };
    if (Array.isArray(t)) return t.map(counted);
    if (!isPlain(t)) return t;
    const { guard, actions, ...rest } = t;
    const g = guardRef(guard);
    return { ...rest, guard: { type: SETTLE, params: { guard: typeof g === 'string' ? g : isPlain(g) ? g.type : undefined } }, ...(actions !== undefined ? { actions: actionsOf(actions) } : null) };
  };
  const state = (s: unknown): unknown => {
    if (!isPlain(s)) return s;
    const { context: _context, output: _output, ...rest } = s;
    const out: Record<string, unknown> = rest;
    if (isPlain(s.initial)) out.initial = transition(s.initial);
    if (s.entry !== undefined) out.entry = actionsOf(s.entry);
    if (s.exit !== undefined) out.exit = actionsOf(s.exit);
    if (isPlain(s.on)) out.on = Object.fromEntries(Object.entries(s.on).map(([k, t]) => [k, transition(t)]));
    if (s.always !== undefined) out.always = counted(s.always);
    if (isPlain(s.after)) {
      for (const k of Object.keys(s.after)) if (Number.isNaN(Number(k))) names.delays.add(k);
      out.after = Object.fromEntries(Object.entries(s.after).map(([k, t]) => [k, transition(t)]));
    }
    if (s.onDone !== undefined) out.onDone = transition(s.onDone);
    if (s.invoke !== undefined) {
      const list = Array.isArray(s.invoke) ? s.invoke : [s.invoke];
      const made = list.map((inv) => {
        if (!isPlain(inv)) return inv;
        const { src, input: _input, ...rest } = inv;
        if (typeof src === 'string') names.actors.add(src);
        const called: Record<string, unknown> = { ...rest, src: typeof src === 'string' ? src : INLINE_ACTOR };
        for (const k of ['onDone', 'onError', 'onSnapshot']) if (rest[k] !== undefined) called[k] = transition(rest[k]);
        return called;
      });
      out.invoke = Array.isArray(s.invoke) ? made : made[0];
    }
    if (isPlain(s.states)) out.states = Object.fromEntries(Object.entries(s.states).map(([k, v]) => [k, state(v)]));
    return out;
  };
  const made = state(config) as Record<string, unknown>;
  return {
    config: made,
    names: { guards: [...names.guards].sort(), actions: [...names.actions].sort(), actors: [...names.actors].sort(), delays: [...names.delays].sort() },
  };
}

/* ── Where a machine is ── */

/** The ids of the states a `snapshot.value` says it's in, from the outside in. */
export function activeStateIds(root: StateMachineNode, value: unknown): string[] {
  const out: string[] = [root.id];
  const visit = (n: StateMachineNode, v: unknown) => {
    if (typeof v === 'string') {
      const k = n.states?.[v];
      if (k) out.push(k.id);
      return;
    }
    if (!isPlain(v)) return;
    for (const [key, inner] of Object.entries(v)) {
      const k = n.states?.[key];
      if (!k) continue;
      out.push(k.id);
      visit(k, inner);
    }
  };
  visit(root, value);
  return out;
}

/** The states that aren't holding any others, by name: what a person would say it's in. */
export function activeLeaves(root: StateMachineNode, ids: readonly string[]): string[] {
  const set = new Set(ids);
  const out: string[] = [];
  const visit = (n: StateMachineNode) => {
    const kids = Object.values(n.states ?? {}).filter((k) => set.has(k.id));
    if (!kids.length) { out.push(n.key); return; }
    kids.forEach(visit);
  };
  visit(root);
  return out;
}

/* ── The simulation ── */

/** How what's said about a machine that never settles begins. */
export const NEVER_SETTLES = 'This machine never settles';
/** How many `always` guards one event can go through before it's taken as never settling. */
export const SETTLE_LIMIT = 2000;
/** How many timers one move of the clock can fire before they're taken as never settling. */
export const TIMER_LIMIT = 10000;

export interface SimulationLogEntry {
  /** In order, from 0. */
  id: number;
  /** The clock, in ms. */
  at: number;
  /** What happened, in words. */
  what: string;
  /** Where it ended up, by state name. */
  now: readonly string[];
}

export interface SimulationFinish {
  /** The event that says so: `xstate.done.actor…` or `xstate.error.actor…`. */
  event: string;
  label: string;
}

export interface SimulationState {
  /** Everything it's in, by id, including what holds what. */
  active: readonly string[];
  /** The states it's in, by name. */
  now: readonly string[];
  status: 'active' | 'done' | 'error' | 'stopped';
  /** What went wrong, in words. */
  error: string | null;
  /** The events it can take right now. */
  events: readonly string[];
  /** The ways the actors it's waiting on can finish. */
  finishes: readonly SimulationFinish[];
  /** The clock, in ms. */
  time: number;
  /** When the next timer's due, in ms, or null. */
  next: number | null;
  /** The answer each named guard gives. */
  guards: Readonly<Record<string, boolean>>;
  /** What's named, and so what's being stood in for. */
  names: MachineNames;
  /** The edges the last event took, by the ids `machineToDraft` gives them. */
  taken: readonly string[];
  log: readonly SimulationLogEntry[];
}

export interface SimulationStandIns {
  /** Answers for guards, by name. Any not given answer true. */
  guards?: Record<string, boolean>;
  /** How long delays are, by name, in ms. Any not given go by the machine's own number, or take a second. */
  delays?: Record<string, number>;
  /** Actor logic, by name. Any not given wait until they're told how they finished. */
  actors?: Record<string, unknown>;
}

export interface Simulation {
  get(): SimulationState;
  subscribe(listener: () => void): () => void;
  send(event: string): void;
  /** Fires the next timer, moving the clock to when it's due. */
  stepTime(): void;
  /** Moves the clock on by this many ms, firing what comes due. */
  advance(ms: number): void;
  setGuard(name: string, value: boolean): void;
  reset(): void;
  stop(): void;
}

type XState = Pick<typeof import('xstate'), 'createActor' | 'createMachine' | 'fromPromise'>;

interface InspectedEvent {
  type: string;
  actorRef?: unknown;
  event?: { type: string };
  _transitions?: readonly StateMachineTransition[];
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * A running simulation of a machine's config, which it only ever runs a copy of, with stand-ins in it. Guards answer as they're
 * set, actions do nothing, invoked actors wait to be told how they finished, and timers wait for the clock.
 * `delays` are the machine's own, by name, for those that are numbers.
 */
export function createSimulation(xstate: XState, config: unknown, standIns: SimulationStandIns = {}, delays: Readonly<Record<string, unknown>> = {}): Simulation {
  const { config: runnable, names } = standInConfig(config);
  const guards: Record<string, boolean> = Object.fromEntries(names.guards.map((g) => [g, standIns.guards?.[g] ?? true]));
  const never = new Promise<never>(() => undefined);
  const wait = xstate.fromPromise(() => never);
  const delayOf = (name: string) => {
    const given = standIns.delays?.[name] ?? delays[name];
    return typeof given === 'number' ? given : 1000;
  };
  let settling = 0;
  const machine = xstate.createMachine(runnable as never).provide({
    guards: {
      ...Object.fromEntries(names.guards.map((g) => [g, () => guards[g] ?? true])),
      [INLINE_GUARD]: () => true,
      // Every `always` comes through here, so one that goes round for ever comes through here for ever.
      [SETTLE]: (_args: unknown, params: { guard?: string } | undefined) => {
        if (++settling > SETTLE_LIMIT) throw new Error(`${NEVER_SETTLES}: it was still going through always transitions after ${SETTLE_LIMIT} of them.`);
        return params?.guard ? guards[params.guard] ?? true : true;
      },
    },
    actions: { ...Object.fromEntries(names.actions.map((a) => [a, () => undefined])), [INLINE_ACTION]: () => undefined },
    actors: { ...Object.fromEntries(names.actors.map((a) => [a, wait])), [INLINE_ACTOR]: wait, ...standIns.actors },
    delays: Object.fromEntries(names.delays.map((d) => [d, delayOf(d)])),
  } as never) as unknown as StateMachineLike & { events: string[] };
  const edgeIds = machineEdgeIds(machine);
  const events = machine.events.filter((e) => e !== '*' && !e.startsWith('xstate.'));

  let clock = new SimulationClock();
  let actor: ReturnType<XState['createActor']> | null = null;
  let log: SimulationLogEntry[] = [];
  let halted: string | null = null;
  let starting = false;
  let seen: string | null = null;
  let taking: string[] = [];
  let taken: readonly string[] = [];
  let state: SimulationState | null = null;
  const listeners = new Set<() => void>();

  type Can = { can: (e: { type: string }) => boolean };
  const finishesOf = (active: readonly string[], snapshot: Can) => {
    const out: SimulationFinish[] = [];
    const walk = (n: StateMachineNode) => {
      if (!active.includes(n.id)) return;
      for (const event of n.transitions.keys()) {
        const done = event.startsWith('xstate.done.actor.');
        if (!done && !event.startsWith('xstate.error.actor.')) continue;
        if (snapshot.can({ type: event })) out.push({ event, label: labelFor(event) });
      }
      Object.values(n.states ?? {}).forEach(walk);
    };
    walk(machine.root);
    return out;
  };
  /** What an event's called in the log and on a button: an actor's by its name, and a timer's by its delay. */
  const labelFor = (event: string): string => {
    const finished = /^xstate\.(done|error)\.actor\.(.*)$/.exec(event);
    if (finished) {
      const find = (n: StateMachineNode): string | null => {
        const inv = n.invoke?.find((i) => i.id === finished[2]);
        if (inv) return inv.src === INLINE_ACTOR || typeof inv.src !== 'string' ? n.key : inv.src;
        for (const k of Object.values(n.states ?? {})) {
          const found = find(k);
          if (found) return found;
        }
        return null;
      };
      return `${find(machine.root) ?? finished[2]}: ${finished[1]}`;
    }
    return describeEvent(event).name;
  };
  const read = (): SimulationState => {
    const snapshot = actor?.getSnapshot() as unknown as (Can & { value?: unknown; status: string; error?: unknown }) | undefined;
    const active = activeStateIds(machine.root, snapshot?.value);
    const failed = snapshot?.status === 'error' ? (snapshot.error instanceof Error ? snapshot.error.message : String(snapshot.error)) : halted;
    const running = snapshot?.status === 'active' && !failed ? snapshot : null;
    const now = activeLeaves(machine.root, active);
    return {
      // The same arrays while they say the same thing, so that time passing doesn't redraw what's lit.
      active: state && sameList(state.active, active) ? state.active : active,
      now: state && sameList(state.now, now) ? state.now : now,
      status: failed ? 'error' : ((snapshot?.status ?? 'stopped') as SimulationState['status']),
      error: failed ?? null,
      events: running ? events.filter((e) => running.can({ type: e })) : [],
      finishes: running ? finishesOf(active, running) : [],
      time: clock.now,
      next: running ? clock.nextDue() : null,
      guards: { ...guards },
      names,
      taken,
      log,
    };
  };
  const refresh = () => {
    state = read();
    for (const l of listeners) l();
  };
  const note = (what: string) => {
    log = [...log.slice(-199), { id: (log[log.length - 1]?.id ?? -1) + 1, at: clock.now, what, now: read().now }];
  };
  /** An event's been dealt with, however it came. */
  const dealtWith = () => {
    if (starting) return;
    taken = taking;
    taking = [];
    note(seen ? labelFor(seen) : 'Something happened');
    seen = null;
    refresh();
  };
  const inspect = (ev: InspectedEvent) => {
    if (ev.type === '@xstate.event') settling = 0;
    if (ev.type !== '@xstate.microstep' || !actor || ev.actorRef !== actor) return;
    // The first is what came in. After it there can be others of XState's own, like a parallel state saying it's done.
    seen ??= ev.event?.type ?? null;
    for (const t of ev._transitions ?? []) taking.push(...(edgeIds.get(t) ?? []));
  };
  const start = () => {
    actor?.stop();
    clock = new SimulationClock();
    log = [];
    halted = null;
    seen = null;
    taking = [];
    taken = [];
    settling = 0;
    starting = true;
    actor = xstate.createActor(machine as never, { clock, inspect } as never);
    // What goes wrong is shown, rather than being thrown at the page, where it'd only say it was unhandled.
    actor.subscribe({ next: dealtWith, error: dealtWith });
    actor.start();
    starting = false;
    note('Started');
    refresh();
  };
  const isRunning = () => read().status === 'active';
  start();
  return {
    get: () => state!,
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    send: (event) => { if (isRunning()) actor!.send({ type: event } as never); },
    stepTime: () => {
      if (!isRunning()) return;
      clock.fireNext();
      refresh();
    },
    advance: (ms) => {
      if (!isRunning()) return;
      if (!clock.advance(clock.now + ms, TIMER_LIMIT)) {
        halted = `${NEVER_SETTLES}: it was still firing timers after ${TIMER_LIMIT} of them, with ${Math.round(clock.now)} ms gone.`;
        actor?.stop();
        note('Stopped');
      }
      refresh();
    },
    setGuard: (name, value) => {
      guards[name] = value;
      note(`${name} answers ${value ? 'yes' : 'no'}`);
      refresh();
    },
    reset: start,
    stop: () => { actor?.stop(); actor = null; },
  };
}
