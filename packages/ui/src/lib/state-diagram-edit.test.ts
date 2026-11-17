import { describe, expect, it } from 'vitest';
import * as xstate from 'xstate';
import { createActor, createMachine, type AnyStateMachine } from 'xstate';
import { uploadMachine } from '../stories/upload-machine';
import {
  StateEditRefused, addAction, addContextKey, addState, addTransition, eventNameProblem, removeAction, removeContextKey, renameAction, renameContextKey, setContextValue, inlineCodeIn, missingImplementations, removeItems, removeState, removeTransition, renameState, setInitial, setTransitionEvent,
  setTransitionGuard, setTransitionSource, setTransitionTarget, stateAt, stateNameProblem, targetText, tryEdit, uniqueName, type StateMachineConfig,
} from './state-diagram-edit';
import { machineEdgePlaces, machineStatePaths, machineToDraft, transitionNotation, type StateMachineLike, type TransitionPlace } from './state-diagram-model';
import { createSimulation } from './state-diagram-simulation';

const uploadConfig = () => JSON.parse(JSON.stringify((uploadMachine as unknown as { config: object }).config)) as StateMachineConfig;
const make = (config: StateMachineConfig) => createMachine(config as never) as unknown as StateMachineLike;
/** What's drawn, as `from -event-> to`. */
const edges = (config: StateMachineConfig) => machineToDraft(make(config)).edges.map((e) => `${e.from} -${e.data?.event ?? 'always'}-> ${e.to}`).sort();
const states = (config: StateMachineConfig) => machineToDraft(make(config)).nodes.map((n) => n.id);
const place = (config: StateMachineConfig, edgeId: string): TransitionPlace => {
  const found = machineEdgePlaces(make(config)).get(edgeId);
  if (!found) throw new Error(`no edge ${edgeId}: ${[...machineEdgePlaces(make(config)).keys()]}`);
  return found;
};
const refused = (fn: () => unknown, words: string | RegExp) => {
  expect(fn).toThrow(StateEditRefused);
  expect(fn).toThrow(words);
};

const DOOR: StateMachineConfig = {
  id: 'door',
  initial: 'closed',
  states: {
    closed: { on: { OPEN: 'open', LOCK: { guard: 'hasKey', target: 'locked' } } },
    open: { on: { CLOSE: 'closed' }, after: { 5000: 'closed' } },
    locked: { on: { UNLOCK: 'closed' }, invoke: { src: 'alarm', onDone: 'closed', onError: 'jammed' } },
    jammed: { type: 'final' },
  },
};

/** Every way of writing a target, all at one state. */
const TARGETS: StateMachineConfig = {
  id: 'm',
  initial: 'a',
  on: { ROOT_DOTTED: '.a.deep', ROOT_ID: '#m.a.deep', ROOT_LIST: { target: ['.a.deep', '.b'] } },
  states: {
    a: {
      initial: 'deep',
      on: {
        SIBLING: 'b', DOTTED: 'b.inner', OWN_CHILD: '.deep', BY_ID: '#m.a.deep', BY_ID_THROUGH: '#named.inner',
        OBJECT: { target: 'b' }, ARRAY: ['b', { target: 'b.inner', guard: 'g' }],
      },
      always: { guard: 'x', target: 'b' },
      after: { 100: 'b', NAMED: { target: 'b.inner' } },
      onDone: 'b',
      invoke: { src: 'work', onDone: 'b', onError: { target: 'b.inner' } },
      states: { deep: { on: { UP: '#m.b', ACROSS: '#named' } } },
    },
    b: {
      id: 'named',
      initial: { target: 'inner' },
      states: { inner: { on: { BACK: '#m.a' } }, h: { type: 'history', target: 'inner' } },
      invoke: [{ src: 'one', onDone: '#m.a' }, { id: 'two', src: 'two', onSnapshot: '#m.a', onError: '#m.a.deep' }],
    },
  },
};

describe('renaming a state', () => {
  it('keeps every transition to it, however it’s written', () => {
    const before = edges(TARGETS);
    const next = renameState(TARGETS, ['b'], 'renamed');
    expect(edges(next)).toEqual(before.map((e) => e.replace(/m\.b|named/g, (x) => (x === 'named' ? 'named' : 'm.renamed'))).sort());
  });

  it('does it for one with others inside, and for something inside', () => {
    const before = edges(TARGETS);
    expect(edges(renameState(TARGETS, ['a'], 'z'))).toEqual(before.map((e) => e.replace(/m\.a/g, 'm.z')).sort());
    expect(edges(renameState(TARGETS, ['a', 'deep'], 'z'))).toEqual(before.map((e) => e.replace(/m\.a\.deep/g, 'm.a.z')).sort());
    const next = renameState(TARGETS, ['b', 'inner'], 'z');
    expect(edges(next)).toEqual(before.map((e) => e.replace(/m\.b\.inner/g, 'm.b.z')).sort());
  });

  it('changes where its parent starts, in the form it was written', () => {
    expect(renameState(DOOR, ['closed'], 'shut').initial).toBe('shut');
    expect((stateAt(renameState(TARGETS, ['b', 'inner'], 'z'), ['b']) as StateMachineConfig).initial).toEqual({ target: 'z' });
    expect(stateAt(renameState(TARGETS, ['b', 'inner'], 'z'), ['b', 'h'])?.target).toBe('z');
  });

  it('keeps each target in the form it was written', () => {
    const next = renameState(TARGETS, ['b'], 'z');
    const a = stateAt(next, ['a']) as { on: Record<string, unknown>; after: unknown; always: unknown };
    expect(a.on.SIBLING).toBe('z');
    expect(a.on.DOTTED).toBe('z.inner');
    expect(a.on.OBJECT).toEqual({ target: 'z' });
    expect(a.on.ARRAY).toEqual(['z', { target: 'z.inner', guard: 'g' }]);
    expect(a.on.BY_ID_THROUGH).toBe('#named.inner');
    expect(a.always).toEqual({ guard: 'x', target: 'z' });
    expect(stateAt(next, ['a', 'deep'])?.on).toEqual({ UP: '#m.z', ACROSS: '#named' });
    expect((next.on as Record<string, unknown>).ROOT_LIST).toEqual({ target: ['.a.deep', '.z'] });
  });

  it('keeps the states in the same order, so that nothing else moves', () => {
    expect(Object.keys(renameState(DOOR, ['open'], 'ajar').states as object)).toEqual(['closed', 'ajar', 'locked', 'jammed']);
  });

  it('leaves everything else alone, and the original too', () => {
    const before = JSON.stringify(TARGETS);
    renameState(TARGETS, ['b'], 'z');
    expect(JSON.stringify(TARGETS)).toBe(before);
    const next = renameState(TARGETS, ['b'], 'z');
    expect(stateAt(next, ['b'])).toBeNull();
    expect(stateAt(next, ['z'])?.id).toBe('named');
  });

  it('runs the same with the new name', () => {
    const next = renameState(uploadConfig(), ['worker', 'streaming'], 'receiving');
    const sim = createSimulation(xstate as never, next);
    sim.send(sim.get().finishes.find((f) => f.label === 'verifyToken: done')!.event);
    expect(sim.get().now).toEqual(['receiving']);
    sim.send('EOF');
    expect(sim.get().now).toEqual(['committing']);
  });

  it('refuses a name that’s there already, or isn’t one, or the machine', () => {
    refused(() => renameState(DOOR, ['open'], 'closed'), /already a state called “closed”/);
    refused(() => renameState(DOOR, ['open'], ''), /needs a name/);
    refused(() => renameState(DOOR, ['open'], 'a.b'), /dot/);
    refused(() => renameState(DOOR, ['open'], '#x'), /dot/);
    refused(() => renameState(DOOR, ['nope'], 'x'), /no state/);
    refused(() => renameState(DOOR, [], 'x'), /its id/);
  });

  it('does nothing if it’s the same name', () => {
    expect(renameState(DOOR, ['open'], 'open')).toBe(DOOR);
  });

  it('copes with a key that has a dot, escaped in a target', () => {
    const c: StateMachineConfig = { id: 'm', initial: 'a.b', states: { 'a.b': { on: { GO: 'c' } }, c: { on: { BACK: 'a\\.b', BACK2: '#m.a\\.b' } } } };
    expect(edges(c)).toContain('m.c -BACK-> m.a.b');
    const next = renameState(c, ['c'], 'd');
    expect(edges(next)).toContain('m.a.b -GO-> m.d');
    expect((stateAt(next, ['d'])?.on as object)).toEqual({ BACK: 'a\\.b', BACK2: '#m.a\\.b' });
  });
});

describe('deleting a state', () => {
  it('takes every transition to it, and only those', () => {
    const next = removeState(DOOR, ['locked']);
    expect(states(next)).toEqual(['door', 'door.closed', 'door.open', 'door.jammed']);
    expect(edges(next)).toEqual(['door.closed -OPEN-> door.open', 'door.open -CLOSE-> door.closed', 'door.open -xstate.after.5000.door.open-> door.closed'].sort());
  });

  it('takes transitions to anything inside it, however they’re written, from anywhere', () => {
    const next = removeState({ ...TARGETS, initial: 'a' }, ['b']);
    const on = stateAt(next, ['a'])?.on as Record<string, unknown>;
    expect(Object.keys(on)).toEqual(['OWN_CHILD', 'BY_ID']);
    const a = stateAt(next, ['a']) as StateMachineConfig;
    expect(a.always).toBeUndefined();
    expect(a.after).toBeUndefined();
    expect(a.onDone).toBeUndefined();
    expect(a.invoke).toEqual({ src: 'work' });
    expect(stateAt(next, ['a', 'deep'])?.on).toBeUndefined();
    expect(() => make(next)).not.toThrow();
  });

  it('keeps the others in a list, and the other target of a transition with two', () => {
    const c: StateMachineConfig = {
      id: 'm', type: 'parallel',
      states: {
        r1: { initial: 'a', states: { a: { on: { GO: { target: ['b', '#m.r2.d'] }, TWO: ['b', 'c'] } }, b: {}, c: {} } },
        r2: { initial: 'x', states: { x: {}, d: {} } },
      },
    };
    const next = removeState(c, ['r2', 'd']);
    expect(stateAt(next, ['r1', 'a'])?.on).toEqual({ GO: { target: ['b'] }, TWO: ['b', 'c'] });
    expect(stateAt(removeState(c, ['r1', 'c']), ['r1', 'a'])?.on).toEqual({ GO: { target: ['b', '#m.r2.d'] }, TWO: ['b'] });
  });

  it('removes what’s left of a history state’s target', () => {
    const next = removeState(TARGETS, ['b', 'inner']);
    // inner was where b starts, and there's another state in b, so that's for XState to refuse. Its history had it too.
    expect(stateAt(next, ['b', 'h'])?.target).toBeUndefined();
  });

  it('leaves where its parent starts for XState to refuse, and says why', () => {
    const next = removeState(DOOR, ['closed']);
    expect(next.initial).toBe('closed');
    const outcome = tryEdit(xstate as never, DOOR, (c) => removeState(c, ['closed']));
    expect(outcome.ok).toBe(false);
    expect((outcome as { reason: string }).reason).toMatch(/closed/);
    // But once somewhere else is where it starts, it can go.
    const moved = tryEdit(xstate as never, setInitial(DOOR, [], 'open'), (c) => removeState(c, ['closed']));
    expect(moved.ok).toBe(true);
  });

  it('does the same for a compound’s initial state, deep down', () => {
    const outcome = tryEdit(xstate as never, uploadConfig(), (c) => removeState(c, ['worker', 'authenticating']));
    expect(outcome.ok).toBe(false);
    expect((outcome as { reason: string }).reason).toMatch(/authenticating/);
  });

  it('turns the state into a plain one when its last one goes', () => {
    const c: StateMachineConfig = { id: 'm', initial: 'a', states: { a: { initial: 'only', states: { only: {} } }, p: { type: 'parallel', states: { r: {} } } } };
    const next = removeState(c, ['a', 'only']);
    expect(stateAt(next, ['a'])).toEqual({});
    expect(stateAt(removeState(c, ['p', 'r']), ['p'])).toEqual({});
    expect(() => make(next)).not.toThrow();
  });

  it('refuses the machine, or one that isn’t there', () => {
    refused(() => removeState(DOOR, []), /machine itself/);
    refused(() => removeState(DOOR, ['nope']), /no state/);
  });
});

describe('adding a state', () => {
  it('adds it where it’s asked, with nothing else changed', () => {
    const next = addState(DOOR, [], 'broken');
    expect(states(next)).toContain('door.broken');
    expect(next.initial).toBe('closed');
    expect(edges(next)).toEqual(edges(DOOR));
  });

  it('makes it where a state with none yet starts, or XState would have nowhere to go', () => {
    const next = addState(DOOR, ['open'], 'ajar');
    expect(stateAt(next, ['open'])?.initial).toBe('ajar');
    const sim = createSimulation(xstate as never, next);
    sim.send('OPEN');
    expect(sim.get().now).toEqual(['ajar']);
    expect(addState({ id: 'm' }, [], 'first').initial).toBe('first');
  });

  it('doesn’t, in a parallel state, where they all start at once', () => {
    const next = addState({ id: 'm', type: 'parallel', states: { r1: {} } }, [], 'r2');
    expect(next.initial).toBeUndefined();
    expect(() => make(next)).not.toThrow();
  });

  it('refuses a name that’s there already, or isn’t one', () => {
    refused(() => addState(DOOR, [], 'open'), /already/);
    refused(() => addState(DOOR, [], ' '), /needs a name/);
    refused(() => addState(DOOR, ['nope'], 'x'), /no state/);
  });
});

describe('where a state starts', () => {
  it('changes, in the form it was written', () => {
    expect(setInitial(DOOR, [], 'open').initial).toBe('open');
    expect(setInitial(TARGETS, ['b'], 'h').states).toBeDefined();
    expect((stateAt(setInitial(TARGETS, ['b'], 'h'), ['b']) as StateMachineConfig).initial).toEqual({ target: 'h' });
  });

  it('refuses what isn’t there, and a parallel state', () => {
    refused(() => setInitial(DOOR, [], 'nope'), /no state/);
    refused(() => setInitial({ id: 'm', type: 'parallel', states: { r: {} } }, [], 'r'), /at once/);
  });
});

describe('adding a transition', () => {
  it('writes a target that goes where it’s asked, wherever the two are', () => {
    const go = (from: string[], to: string[]) => {
      const next = addTransition(TARGETS, from, 'NEW', to);
      return edges(next).filter((e) => e.includes('-NEW->'));
    };
    expect(go(['a'], ['b'])).toEqual(['m.a -NEW-> named']);
    expect(go(['a'], ['a', 'deep'])).toEqual(['m.a -NEW-> m.a.deep']);
    expect(go(['a'], ['a'])).toEqual(['m.a -NEW-> m.a']);
    expect(go(['a', 'deep'], ['b', 'inner'])).toEqual(['m.a.deep -NEW-> m.b.inner']);
    expect(go(['a', 'deep'], ['a'])).toEqual(['m.a.deep -NEW-> m.a']);
    expect(go([], ['b'])).toEqual(['m -NEW-> named']);
    expect(go(['b', 'inner'], [])).toEqual(['m.b.inner -NEW-> m']);
  });

  it('writes one for a machine with no id, or a key with a dot', () => {
    const c: StateMachineConfig = { initial: 'a', states: { a: { initial: 'x', states: { x: {} } }, 'b.c': {} } };
    const next = addTransition(c, ['a', 'x'], 'NEW', ['b.c']);
    expect(edges(next).filter((e) => e.includes('NEW'))).toEqual(['(machine).a.x -NEW-> (machine).b.c']);
    expect(targetText(c, ['a'], ['b.c'])).toBe('b\\.c');
  });

  it('allows the same two states again, and the same event again', () => {
    let next = addTransition(DOOR, ['closed'], 'OPEN', ['open'], 'second');
    expect((stateAt(next, ['closed'])?.on as Record<string, unknown>).OPEN).toEqual(['open', { target: 'open', guard: 'second' }]);
    next = addTransition(next, ['closed'], 'KICK', ['open']);
    expect(edges(next).filter((e) => e.startsWith('door.closed') && e.endsWith('door.open'))).toHaveLength(3);
    expect(() => make(next)).not.toThrow();
  });

  it('refuses a bad event, or a state that isn’t there', () => {
    refused(() => addTransition(DOOR, ['open'], '', ['closed']), /needs a name/);
    refused(() => addTransition(DOOR, ['open'], 'xstate.init', ['closed']), /XState’s own/);
    refused(() => addTransition(DOOR, ['nope'], 'GO', ['closed']), /no state/);
    refused(() => addTransition(DOOR, ['open'], 'GO', ['nope']), /no state/);
  });
});

describe('a transition as it’s drawn, back to where it’s written', () => {
  it('finds every edge of the spike’s machine, and can take each one away', () => {
    const config = uploadConfig();
    const draft = machineToDraft(make(config));
    const places = machineEdgePlaces(make(config));
    const real = draft.edges;
    expect(real).toHaveLength(36);
    for (const e of real) {
      const at = places.get(e.id);
      expect(at, e.id).toBeTruthy();
      const before = machineToDraft(make(config)).edges.length;
      const next = removeTransition(config, at!);
      const after = machineToDraft(make(next)).edges;
      expect(after.length, e.id).toBe(before - 1);
      // It's the one that's gone, and the rest are still there.
      const left = (es: typeof after) => es.map((x) => `${x.from}|${x.to}|${x.data?.event ?? x.kind}|${x.data?.guard?.text ?? ''}`).sort();
      const expected = left(draft.edges);
      expected.splice(expected.indexOf(`${e.from}|${e.to}|${e.data?.event ?? e.kind}|${e.data?.guard?.text ?? ''}`), 1);
      expect(left(after), e.id).toEqual(expected);
    }
  });

  it('keeps others in a list where they were, and the shape of what’s left', () => {
    const c: StateMachineConfig = { id: 'm', initial: 'a', states: { a: { on: { GO: [{ guard: 'g1', target: 'b' }, { guard: 'g2', target: 'b' }, 'c'] } }, b: {}, c: {} } };
    const next = removeTransition(c, place(c, 'm.a:GO->m.b#1'));
    expect(stateAt(next, ['a'])?.on).toEqual({ GO: [{ guard: 'g1', target: 'b' }, 'c'] });
  });

  it('takes only one target of a transition with two', () => {
    const c: StateMachineConfig = { id: 'm', type: 'parallel', states: { r1: { initial: 'a', states: { a: { on: { GO: { target: ['b', '#m.r2.d'] } } }, b: {} } }, r2: { initial: 'x', states: { x: {}, d: {} } } } };
    const next = removeTransition(c, place(c, 'm.r1.a:GO->m.r2.d'));
    expect(stateAt(next, ['r1', 'a'])?.on).toEqual({ GO: { target: ['b'] } });
    expect(stateAt(removeTransition(c, place(c, 'm.r1.a:GO->m.r1.b')), ['r1', 'a'])?.on).toEqual({ GO: { target: ['#m.r2.d'] } });
  });

  it('takes away what it leaves empty', () => {
    const next = removeTransition(DOOR, place(DOOR, 'door.open:CLOSE->door.closed'));
    expect(stateAt(next, ['open'])?.on).toBeUndefined();
    const timed = removeTransition(DOOR, place(DOOR, 'door.open:xstate.after.5000.door.open->door.closed'));
    expect(stateAt(timed, ['open'])?.after).toBeUndefined();
    const inv = stateAt(DOOR, ['locked'])?.invoke;
    expect(inv).toBeDefined();
    const done = machineEdgePlaces(make(DOOR));
    const key = [...done.keys()].find((k) => k.includes('xstate.done.actor'))!;
    expect((stateAt(removeTransition(DOOR, done.get(key)!), ['locked'])?.invoke as StateMachineConfig).onDone).toBeUndefined();
    expect((stateAt(removeTransition(DOOR, done.get(key)!), ['locked'])?.invoke as StateMachineConfig).src).toBe('alarm');
  });

  it('finds an invoke in a list, by its id or its place', () => {
    const c = TARGETS;
    const places = machineEdgePlaces(make(c));
    const one = [...places.keys()].find((k) => k.startsWith('named:xstate.done.actor.0.named'))!;
    const two = [...places.keys()].find((k) => k.startsWith('named:xstate.snapshot.two'))!;
    const err = [...places.keys()].find((k) => k.startsWith('named:xstate.error.actor.two'))!;
    expect((stateAt(removeTransition(c, places.get(one)!), ['b'])?.invoke as StateMachineConfig[])[0].onDone).toBeUndefined();
    expect((stateAt(removeTransition(c, places.get(two)!), ['b'])?.invoke as StateMachineConfig[])[1].onSnapshot).toBeUndefined();
    expect((stateAt(removeTransition(c, places.get(err)!), ['b'])?.invoke as StateMachineConfig[])[1].onError).toBeUndefined();
    expect((stateAt(removeTransition(c, places.get(err)!), ['b'])?.invoke as StateMachineConfig[])[1].onSnapshot).toBe('#m.a');
  });

  it('finds a state’s onDone, and always', () => {
    const places = machineEdgePlaces(make(TARGETS));
    const done = [...places.keys()].find((k) => k.startsWith('m.a:xstate.done.state.m.a'))!;
    expect(stateAt(removeTransition(TARGETS, places.get(done)!), ['a'])?.onDone).toBeUndefined();
    expect(stateAt(removeTransition(TARGETS, places.get('m.a:always->named')!), ['a'])?.always).toBeUndefined();
  });

  it('says so if it can’t find one, rather than taking the wrong one', () => {
    const at = place(DOOR, 'door.open:CLOSE->door.closed');
    const gone = removeTransition(DOOR, at);
    refused(() => removeTransition(gone, at), /isn’t in the config/);
  });

  it('knows where each state is', () => {
    expect(machineStatePaths(make(TARGETS)).get('m.b.inner')).toEqual(['b', 'inner']);
    expect(machineStatePaths(make(TARGETS)).get('named')).toEqual(['b']);
    expect(machineStatePaths(make(TARGETS)).get('m')).toEqual([]);
    expect(machineStatePaths(make(DOOR)).get('door.open')).toEqual(['open']);
  });
});

describe('changing a transition', () => {
  const close = () => place(DOOR, 'door.open:CLOSE->door.closed');

  it('renames its event, in place', () => {
    const next = setTransitionEvent(DOOR, place(DOOR, 'door.closed:OPEN->door.open'), 'PUSH');
    expect(Object.keys(stateAt(next, ['closed'])?.on as object)).toEqual(['PUSH', 'LOCK']);
    expect(edges(next)).toContain('door.closed -PUSH-> door.open');
  });

  it('moves it to an event that’s there already, and out of a list', () => {
    const next = setTransitionEvent(DOOR, place(DOOR, 'door.closed:OPEN->door.open'), 'LOCK');
    expect(stateAt(next, ['closed'])?.on).toEqual({ LOCK: [{ guard: 'hasKey', target: 'locked' }, 'open'] });
    const c: StateMachineConfig = { id: 'm', initial: 'a', states: { a: { on: { GO: ['b', 'c'] } }, b: {}, c: {} } };
    expect(stateAt(setTransitionEvent(c, place(c, 'm.a:GO->m.c'), 'NEW'), ['a'])?.on).toEqual({ GO: ['b'], NEW: 'c' });
  });

  it('refuses a bad name, and one of XState’s own', () => {
    refused(() => setTransitionEvent(DOOR, close(), ''), /needs a name/);
    refused(() => setTransitionEvent(DOOR, place(DOOR, 'door.open:xstate.after.5000.door.open->door.closed'), 'X'), /Only an event of your own/);
    const c: StateMachineConfig = { id: 'm', initial: 'a', states: { a: { always: 'b' }, b: {} } };
    refused(() => setTransitionEvent(c, place(c, 'm.a:always->m.b'), 'X'), /Only an event of your own/);
    expect(setTransitionEvent(DOOR, close(), 'CLOSE')).toBe(DOOR);
  });

  it('sets a guard and clears it, by name, on any kind', () => {
    const guarded = setTransitionGuard(DOOR, close(), 'canClose');
    expect(stateAt(guarded, ['open'])?.on).toEqual({ CLOSE: { target: 'closed', guard: 'canClose' } });
    const cleared = setTransitionGuard(DOOR, place(DOOR, 'door.closed:LOCK->door.locked'), null);
    expect((stateAt(cleared, ['closed'])?.on as Record<string, unknown>).LOCK).toEqual({ target: 'locked' });
    const timed = setTransitionGuard(DOOR, place(DOOR, 'door.open:xstate.after.5000.door.open->door.closed'), 'canTime');
    expect(stateAt(timed, ['open'])?.after).toEqual({ 5000: { target: 'closed', guard: 'canTime' } });
    expect(transitionNotation(machineToDraft(make(timed)).edges.find((e) => e.data?.guard?.name === 'canTime')?.data)).toBe('after 5,000 ms [canTime]');
  });

  it('points it somewhere else', () => {
    const next = setTransitionTarget(DOOR, close(), ['jammed']);
    expect(edges(next)).toContain('door.open -CLOSE-> door.jammed');
    const c: StateMachineConfig = { id: 'm', type: 'parallel', states: { r1: { initial: 'a', states: { a: { on: { GO: { target: ['b', '#m.r2.d'] } } }, b: {}, e: {} } }, r2: { initial: 'x', states: { x: {}, d: {} } } } };
    expect(stateAt(setTransitionTarget(c, place(c, 'm.r1.a:GO->m.r1.b'), ['r1', 'e']), ['r1', 'a'])?.on).toEqual({ GO: { target: ['e', '#m.r2.d'] } });
    refused(() => setTransitionTarget(DOOR, close(), ['nope']), /no state/);
  });

  it('moves it to come from somewhere else, going to the same place', () => {
    const next = setTransitionSource(DOOR, close(), ['locked']);
    expect(edges(next)).toContain('door.locked -CLOSE-> door.closed');
    expect(stateAt(next, ['open'])?.on).toBeUndefined();
    const deep = setTransitionSource(TARGETS, place(TARGETS, 'm.a:SIBLING->named'), ['a', 'deep']);
    expect(edges(deep)).toContain('m.a.deep -SIBLING-> named');
    expect(edges(setTransitionSource(DOOR, place(DOOR, 'door.closed:OPEN->door.open'), ['open']))).toContain('door.open -OPEN-> door.open');
  });

  it('refuses moving one that goes with what its state does', () => {
    refused(() => setTransitionSource(DOOR, place(DOOR, 'door.open:xstate.after.5000.door.open->door.closed'), ['closed']), /goes with what its state does/);
    expect(setTransitionSource(DOOR, close(), ['open'])).toBe(DOOR);
  });
});

describe('actions', () => {
  const C: StateMachineConfig = {
    id: 'm', initial: 'a',
    states: {
      a: { entry: 'onA', exit: ['x', { type: 'track', params: { n: 1 } }, { type: 'xstate.raise', params: { event: 'E' } }], on: { GO: { target: 'b', actions: 'go' }, PLAIN: 'b' } },
      b: {},
    },
  };

  it('adds, renames and removes an entry action, writing one on its own as it was', () => {
    const added = addAction(C, { state: ['a'], slot: 'entry' }, 'onA2');
    expect(stateAt(added, ['a'])?.entry).toEqual(['onA', 'onA2']);
    expect(stateAt(renameAction(C, { state: ['a'], slot: 'entry' }, 0, 'onEnter'), ['a'])?.entry).toBe('onEnter');
    expect(stateAt(removeAction(C, { state: ['a'], slot: 'entry' }, 0), ['a'])).not.toHaveProperty('entry');
    // A state with none gets its first.
    expect(stateAt(addAction(C, { state: ['b'], slot: 'exit' }, 'leave'), ['b'])?.exit).toBe('leave');
  });

  it('keeps a parameterized action’s params when it’s renamed, and refuses to rename code or a built-in', () => {
    const at = { state: ['a'], slot: 'exit' } as const;
    expect((stateAt(renameAction(C, at, 1, 'log'), ['a'])?.exit as unknown[])[1]).toEqual({ type: 'log', params: { n: 1 } });
    refused(() => renameAction(C, at, 2, 'mine'), /has no name in the config/);
    refused(() => renameAction(C, at, 9, 'mine'), /isn’t in the config/);
    refused(() => addAction(C, at, ' '), /needs a name/);
    refused(() => addAction(C, at, 'xstate.raise'), /XState’s own/);
    expect(stateAt(removeAction(C, at, 2), ['a'])?.exit).toEqual(['x', { type: 'track', params: { n: 1 } }]);
  });

  it('changes a transition’s actions, on a transition written as a target alone too', () => {
    const go = place(C, 'm.a:GO->m.b');
    expect((stateAt(addAction(C, { transition: go }, 'more'), ['a'])?.on as Record<string, unknown>).GO).toEqual({ target: 'b', actions: ['go', 'more'] });
    expect((stateAt(removeAction(C, { transition: go }, 0), ['a'])?.on as Record<string, unknown>).GO).toEqual({ target: 'b' });
    const plain = place(C, 'm.a:PLAIN->m.b');
    expect((stateAt(addAction(C, { transition: plain }, 'note'), ['a'])?.on as Record<string, unknown>).PLAIN).toEqual({ target: 'b', actions: 'note' });
  });

  it('is drawn as it’s changed, and XState has it', () => {
    const outcome = tryEdit<StateMachineLike>(xstate as never, C, (c) => addAction(c, { state: ['b'], slot: 'entry' }, 'arrive'));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(machineToDraft(outcome.machine).nodes.find((n) => n.id === 'm.b')?.sections?.[0]?.items.map((i) => i.title)).toEqual(['arrive']);
  });
});

describe('context', () => {
  const C: StateMachineConfig = { id: 'm', initial: 'a', types: { context: { n: 'number', s: 'string' } }, context: { n: 0, s: '' }, states: { a: {} } };

  it('adds, renames, sets and removes a key, keeping its type with it', () => {
    expect(addContextKey(C, 'k').context).toEqual({ n: 0, s: '', k: null });
    expect(addContextKey({ id: 'm', states: { a: {} } }, 'k', 1).context).toEqual({ k: 1 });
    const renamed = renameContextKey(C, 'n', 'count');
    expect(Object.keys(renamed.context as object)).toEqual(['count', 's']);
    expect(renamed.types).toEqual({ context: { count: 'number', s: 'string' } });
    expect(setContextValue(C, 's', 'hi').context).toEqual({ n: 0, s: 'hi' });
    const removed = removeContextKey(C, 'n');
    expect(removed.context).toEqual({ s: '' });
    expect(removed.types).toEqual({ context: { s: 'string' } });
    expect(removeContextKey(removed, 's')).not.toHaveProperty('context');
  });

  it('refuses what it can’t do, and says why', () => {
    refused(() => addContextKey(C, 'n'), /already a context key/);
    refused(() => addContextKey(C, ''), /needs a name/);
    refused(() => renameContextKey(C, 'nope', 'x'), /no context key/);
    refused(() => renameContextKey(C, 'n', 's'), /already a context key/);
    refused(() => addContextKey({ id: 'm', context: () => ({}), states: { a: {} } }, 'k'), /made by code/);
  });
});

describe('several at once', () => {
  it('takes them all as one edit, from the end of each list', () => {
    const c: StateMachineConfig = { id: 'm', initial: 'a', states: { a: { on: { GO: ['b', 'c', 'd'] } }, b: {}, c: {}, d: {} } };
    const next = removeItems(c, { transitions: [place(c, 'm.a:GO->m.b'), place(c, 'm.a:GO->m.c')] });
    expect(stateAt(next, ['a'])?.on).toEqual({ GO: ['d'] });
  });

  it('takes a state along with one of its own transitions, and one that’s inside another', () => {
    const next = removeItems(DOOR, { states: [['locked']], transitions: [place(DOOR, 'door.closed:LOCK->door.locked')] });
    expect(states(next)).not.toContain('door.locked');
    for (const states of [[['a', 'deep'], ['a']], [['a'], ['a', 'deep']]]) {
      const inside = removeItems(TARGETS, { states });
      expect(stateAt(inside, ['a'])).toBeNull();
    }
  });
});

describe('asking XState', () => {
  it('passes one it’ll have, with the machine', () => {
    const outcome = tryEdit(xstate as never, DOOR, (c) => addState(c, [], 'x'));
    expect(outcome.ok).toBe(true);
    expect((outcome as { machine: StateMachineLike }).machine.root.states?.x).toBeTruthy();
  });

  it('refuses one it won’t, with what it said', () => {
    const outcome = tryEdit(xstate as never, DOOR, (c) => ({ ...c, states: { ...(c.states as object), closed: { on: { GO: 'nowhere' } } } }));
    expect(outcome).toEqual({ ok: false, reason: expect.stringContaining('nowhere') });
  });

  it('refuses one of our own, with its reason', () => {
    expect(tryEdit(xstate as never, DOOR, (c) => addState(c, [], 'open'))).toEqual({ ok: false, reason: expect.stringContaining('already') });
  });

  it('refuses what it only finds when it starts', () => {
    const outcome = tryEdit(xstate as never, { id: 'm', initial: 'a', states: { a: { initial: 'nope', states: { x: {} } } } }, (c) => c);
    expect(outcome.ok).toBe(false);
    expect((outcome as { reason: string }).reason).toMatch(/nope/);
  });

  it('refuses what it only finds once it’s running, with what it said', () => {
    const c: StateMachineConfig = { id: 'm', initial: 'h', states: { h: { type: 'history', target: 'nope' }, a: {} } };
    expect(() => createMachine(c as never)).not.toThrow();
    const outcome = tryEdit(xstate as never, c, (x) => x);
    expect(outcome.ok).toBe(false);
    expect((outcome as { reason: string }).reason).toMatch(/nope/);
  });

  it('doesn’t refuse one that never settles, and doesn’t hang', () => {
    const outcome = tryEdit(xstate as never, { id: 'm', initial: 'a', states: { a: {} } }, (c) => ({ ...c, states: { a: { always: 'b' }, b: { always: 'a' } } }));
    expect(outcome.ok).toBe(true);
  });

  it('doesn’t run the code of what it tried', () => {
    let ran = 0;
    const config = { id: 'm', initial: 'a', entry: () => { ran++; }, states: { a: { entry: () => { ran++; } } } };
    expect(tryEdit(xstate as never, config, (c) => addState(c, [], 'b')).ok).toBe(true);
    expect(ran).toBe(0);
  });
});

describe('names, and code', () => {
  it('lists what’s named with nothing behind it', () => {
    expect(missingImplementations(DOOR)).toEqual({ guards: ['hasKey'], actions: [], actors: ['alarm'], delays: [] });
    expect(missingImplementations(DOOR, { guards: { hasKey: () => true } })).toEqual({ guards: [], actions: [], actors: ['alarm'], delays: [] });
  });

  it('finds nothing missing on the spike’s machine, as it has all of its own', () => {
    const { config, implementations } = uploadMachine as unknown as { config: object; implementations: object };
    expect(missingImplementations(config, implementations)).toEqual({ guards: [], actions: [], actors: [], delays: [] });
  });

  it('notices a new name, as an edit leaves it for someone to write', () => {
    const { implementations } = uploadMachine as unknown as { implementations: object };
    const next = setTransitionGuard(uploadConfig(), place(uploadConfig(), 'upload.worker.streaming:EOF->upload.worker.committing'), 'hasEnoughBytes');
    expect(missingImplementations(next, implementations).guards).toEqual(['hasEnoughBytes']);
  });

  it('finds code that JSON can’t hold', () => {
    expect(inlineCodeIn(uploadConfig())).toEqual([]);
    expect(inlineCodeIn({ a: { b: [() => 1, 2] }, c: () => 1, d: 'x' })).toEqual(['a.b[0]', 'c']);
  });

  it('says what’s wrong with a name', () => {
    expect(stateNameProblem('ok', ['x'])).toBeNull();
    expect(stateNameProblem(' ok', [])).toMatch(/space/);
    expect(eventNameProblem('ok')).toBeNull();
    expect(eventNameProblem(' ok')).toMatch(/space/);
    expect(uniqueName('a', [])).toBe('a');
    expect(uniqueName('a', ['a', 'a2'])).toBe('a3');
  });
});

describe('saved as JSON and loaded', () => {
  const save = (config: StateMachineConfig) => JSON.parse(JSON.stringify(config)) as StateMachineConfig;

  /** The spike's run: the same 14 snapshots, with its actors, from `.provide()`. */
  async function run(config: StateMachineConfig) {
    const { implementations } = uploadMachine as unknown as { implementations: object };
    const machine = (createMachine(config as never) as unknown as { provide: (i: object) => AnyStateMachine }).provide(implementations);
    const seen: string[] = [];
    const actor = createActor(machine);
    actor.subscribe((s: { value: unknown }) => seen.push(JSON.stringify(s.value)));
    actor.start();
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await wait(30);
    actor.send({ type: 'CHUNK', size: 10 } as never);
    actor.send({ type: 'HEARTBEAT' } as never);
    actor.send({ type: 'EOF' } as never);
    await wait(30);
    actor.send({ type: 'R2_EVENT' } as never);
    await wait(60);
    actor.send({ type: 'VIEWER_JOINED' } as never);
    actor.send({ type: 'ALARM' } as never);
    await wait(20);
    const snapshot = actor.getSnapshot() as { status: string; value: unknown; context: unknown };
    actor.stop();
    return { seen, status: snapshot.status, value: snapshot.value, context: snapshot.context };
  }

  it('gives the same graph and the same run with nothing edited, as the spike found', async () => {
    const config = (uploadMachine as unknown as { config: StateMachineConfig }).config;
    const loaded = save(config);
    expect(machineToDraft(make(loaded))).toEqual(machineToDraft(make(config)));
    const [a, b] = await Promise.all([run(config), run(loaded)]);
    expect(b).toEqual(a);
    expect(a.seen).toHaveLength(14);
    expect(a.status).toBe('done');
  });

  it('gives the same graph and the same run after an edit of each kind', async () => {
    let edited = uploadConfig();
    edited = addTransition(edited, ['worker', 'streaming'], 'PAUSE', ['worker', 'streaming']);
    edited = addState(edited, ['worker'], 'paused');
    edited = addTransition(edited, ['worker', 'paused'], 'RESUME', ['worker', 'streaming']);
    edited = renameState(edited, ['worker', 'committing'], 'saving');
    edited = removeState(edited, ['worker', 'paused']);
    edited = setTransitionGuard(edited, machineEdgePlaces(make(edited)).get('upload.worker.streaming:PAUSE->upload.worker.streaming')!, 'withinQuota');
    const loaded = save(edited);
    expect(loaded).toEqual(edited);
    expect(machineToDraft(make(loaded))).toEqual(machineToDraft(make(edited)));
    const [a, b] = await Promise.all([run(edited), run(loaded)]);
    expect(b).toEqual(a);
    // It's the same as the spike's run, but for the name. So the edit changed what it said and nothing else.
    const original = await run((uploadMachine as unknown as { config: StateMachineConfig }).config);
    expect(a.seen).toEqual(original.seen.map((s) => s.replaceAll('committing', 'saving')));
    expect(a.value).toEqual(original.value);
  });

  it('runs the same simulated, too', () => {
    const edited = renameState(addTransition(uploadConfig(), ['worker', 'streaming'], 'PAUSE', ['worker', 'streaming']), ['worker', 'streaming'], 'receiving');
    const walk = (config: StateMachineConfig) => {
      const s = createSimulation(xstate as never, config);
      const done = (label: string) => s.send(s.get().finishes.find((f) => f.label === label)!.event);
      done('verifyToken: done');
      s.send('PAUSE');
      s.send('EOF');
      done('putObject: done');
      s.send('R2_EVENT');
      done('pullMessage: done');
      done('scanObject: done');
      done('makeThumbnails: done');
      done('insertRow: done');
      done('broadcast: done');
      return { log: s.get().log, status: s.get().status };
    };
    expect(walk(save(edited))).toEqual(walk(edited));
    expect(walk(edited).status).toBe('done');
  });
});
