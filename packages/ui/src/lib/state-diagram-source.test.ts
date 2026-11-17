import { describe, expect, it } from 'vitest';
import { createMachine } from 'xstate';
import { machineToDraft, transitionNotation, type StateMachineLike } from './state-diagram-model';
import { parseXState } from './state-diagram-source';

/* parseXState reads a machine's config from its source, TypeScript or JSON, and never runs any of it. What it returns goes
   to XState's createMachine and then machineToDraft, as StateDiagram's `source` and docstream's xstate fence both do. */

const TOGGLE = { id: 'toggle', initial: 'off', states: { off: { on: { TOGGLE: 'on' } }, on: { on: { TOGGLE: 'off' } } } };

describe('parseXState', () => {
  it('reads JSON as it is', () => {
    expect(parseXState(JSON.stringify(TOGGLE))).toEqual(TOGGLE);
  });

  it('reads a setup(…).createMachine call, keeping structure and leaving out code it never runs', () => {
    const code = `import { setup } from "xstate";
      const config = { initial: "off", context: globalThis.mustNeverRun(), states: {
        off: { entry: () => globalThis.mustNeverRun(), on: { TOGGLE: { target: "on", guard: isReady } } }, on: {} } } as const;
      export const machine = setup({}).createMachine(config);`;
    expect(parseXState(code)).toEqual({ initial: 'off', states: { off: { entry: { type: 'xstate.inline' }, on: { TOGGLE: { target: 'on', guard: 'isReady' } } }, on: {} } });
  });

  it('keeps an invoke as its name and where it goes', () => {
    const parsed = parseXState('createMachine({ initial: "a", states: { a: { invoke: { src: fromPromise(load), input: x(), onDone: "b" } }, b: {} } })');
    expect(parsed).toEqual({ initial: 'a', states: { a: { invoke: { src: 'actor', onDone: 'b' } }, b: {} } });
    expect(parseXState('createMachine({ initial: "a", states: { a: { invoke: { src: "load", id: "loader", input: { url: "/a", at: now() } } } } })')).toEqual({ initial: 'a', states: { a: { invoke: { src: 'load', id: 'loader', input: { url: '/a' } } } } });
  });

  it('refuses what it would have to run to read', () => {
    expect(() => parseXState('createMachine({ states: getStates() })')).toThrow(/static machine config/);
    expect(() => parseXState('createMachine({ states: { ...more } })')).toThrow(/literal properties/);
    expect(() => parseXState('{}')).toThrow(/states/);
    expect(() => parseXState('createMachine({')).toThrow();
  });

  it('gives a config that machineToDraft draws, labels and all', () => {
    const machine = createMachine(parseXState('createMachine({ id: "door", initial: "closed", states: { closed: { on: { OPEN: { target: "open", guard: "hasKey" } } }, open: { after: { 500: "closed" } } } })') as never) as unknown as StateMachineLike;
    const labels = machineToDraft(machine).edges.map((e) => transitionNotation(e.data));
    expect(labels).toEqual(['OPEN [hasKey]', 'after 500 ms']);
  });
});
