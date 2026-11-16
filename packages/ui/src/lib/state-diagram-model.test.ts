import { describe, expect, it } from 'vitest';
import { createMachine, fromPromise, setup } from 'xstate';
import { toDirectedGraph } from 'xstate/graph';
import { uploadMachine } from '../stories/upload-machine';
import { describeEvent, machineToDraft, type StateMachineLike } from './state-diagram-model';

const draftOf = (m: unknown) => machineToDraft(m as StateMachineLike);
const edgeList = (m: unknown) => draftOf(m).edges.filter((e) => e.data?.transition !== 'initial').map((e) => `${e.from} ${e.label} -> ${e.to}`);

describe('the spike’s machine', () => {
  const { nodes, edges } = draftOf(uploadMachine);
  const states = nodes.filter((n) => n.data?.type !== 'initial');
  const ways = edges.filter((e) => e.data?.transition !== 'initial');

  it('has all 33 states and all 36 edges, where toDirectedGraph has 29', () => {
    expect(states).toHaveLength(33);
    expect(ways).toHaveLength(36);
    expect(nodes.filter((n) => n.data?.type === 'initial')).toHaveLength(7);
    expect(edges.filter((e) => e.data?.transition === 'initial')).toHaveLength(7);
    const flat: { edges: unknown[]; children: unknown[] }[] = [];
    const walk = (n: { edges: unknown[]; children: unknown[] }) => { flat.push(n); n.children.forEach((k) => walk(k as never)); };
    walk(toDirectedGraph(uploadMachine as never) as never);
    expect(flat.reduce((sum, n) => sum + n.edges.length, 0)).toBe(29);
  });

  it('counts each kind as the spike did', () => {
    const by = (k: string) => ways.filter((e) => e.data?.transition === k).length;
    expect({ event: by('event'), invoke: by('invoke'), always: by('always'), after: by('after'), done: by('done') }).toEqual({ event: 8, invoke: 14, always: 7, after: 5, done: 2 });
    expect(ways.filter((e) => e.from === e.to)).toHaveLength(4);
  });

  it('labels always, after, invoke and guards by name', () => {
    const labels = new Set(ways.map((e) => e.label));
    for (const l of ['always [withinQuota]', 'always', 'after IDLE_TIMEOUT', 'after BACKOFF [retriesLeft]', 'after BACKOFF', 'after QUEUE_VISIBILITY', 'after 5000', 'done', 'error', 'always [isClean]', 'always [hasViewers]', 'CANCEL', 'EOF']) expect(labels, l).toContain(l);
  });

  it('gets compound and parallel states, regions, initial markers and final states right', () => {
    const look = (id: string) => { const n = nodes.find((m) => m.id === id); return n && [n.kind, n.variant ?? 'default']; };
    expect(look('upload')).toEqual(['root', 'default']);
    expect(look('upload.worker')).toEqual(['group', 'default']);
    expect(look('upload.processing')).toEqual(['group', 'dashed']);
    expect(look('upload.processing.scan')).toEqual(['region', 'default']);
    expect(look('upload.done')).toEqual(['node', 'double']);
    expect(look('upload.worker.streaming')).toEqual(['node', 'default']);
    expect(look('upload.worker.__initial')).toEqual(['marker', 'default']);
    expect(look('upload.processing.__initial')).toBeUndefined();
    const line = (transition: string) => [...new Set(edges.filter((e) => e.data?.transition === transition).map((e) => e.variant ?? 'default'))];
    expect([line('event'), line('done'), line('invoke'), line('always'), line('after'), line('initial')]).toEqual([['default'], ['default'], ['default'], ['dashed'], ['dotted'], ['strong']]);
    expect(nodes.find((n) => n.id === 'upload.worker.streaming')?.parent).toBe('upload.worker');
    expect(edges.find((e) => e.from === 'upload.worker.__initial')?.to).toBe('upload.worker.authenticating');
  });

  it('says what a state invokes, and what a parallel state is', () => {
    expect(nodes.find((n) => n.id === 'upload.worker.authenticating')?.detail).toBe('invoke verifyToken');
    expect(nodes.find((n) => n.id === 'upload.processing')?.detail).toBe('parallel');
    expect(nodes.find((n) => n.id === 'upload.worker.streaming')?.detail).toBeUndefined();
  });

  it('keeps what simulating needs on each edge', () => {
    const chunk = ways.find((e) => e.label === 'CHUNK')!;
    expect(chunk.data).toEqual({ transition: 'event', event: 'CHUNK', internal: true });
    expect(ways.find((e) => e.label === 'always [withinQuota]')?.data?.transition).toBe('always');
    expect(nodes.find((n) => n.id === 'upload.processing')?.data?.type).toBe('parallel');
    expect(chunk.from).toBe(chunk.to);
    const backoff = ways.find((e) => e.label === 'after BACKOFF [retriesLeft]')!;
    expect(backoff.data?.guard).toBe('retriesLeft');
    expect(backoff.data?.event).toContain('xstate.after.BACKOFF');
  });

  it('gives every edge an id of its own, the same each time', () => {
    const ids = edges.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(draftOf(uploadMachine).edges.map((e) => e.id)).toEqual(ids);
  });

  it('comes out the same from JSON, read back through createMachine', () => {
    const fromJson = createMachine(JSON.parse(JSON.stringify((uploadMachine as unknown as { config: object }).config)));
    const a = draftOf(uploadMachine), b = draftOf(fromJson);
    expect(b.nodes.map((n) => [n.id, n.kind, n.label, n.detail])).toEqual(a.nodes.map((n) => [n.id, n.kind, n.label, n.detail]));
    expect(b.edges.map((e) => [e.id, e.from, e.to, e.label, e.kind])).toEqual(a.edges.map((e) => [e.id, e.from, e.to, e.label, e.kind]));
  });

  it('runs nothing: no implementation is called', () => {
    let called = 0;
    const m = setup({
      guards: { g: () => { called++; return true; } },
      actions: { a: () => { called++; } },
    }).createMachine({ initial: 'x', states: { x: { entry: 'a', always: { guard: 'g', target: 'y' } }, y: {} } });
    machineToDraft(m as unknown as StateMachineLike);
    expect(called).toBe(0);
  });
});

describe('the awkward ones', () => {
  it('resolves targets by #id and relative targets', () => {
    const m = createMachine({
      id: 'm', initial: 'a',
      states: {
        a: { initial: 'one', on: { GO: '#m.b.deep', BACK: '.two', NEXT: 'b' }, states: { one: { id: 'first', on: { JUMP: '#second' } }, two: { id: 'second', on: { HOME: '#first' } } } },
        b: { initial: 'deep', states: { deep: {} } },
      },
    });
    const list = edgeList(m);
    expect(list).toContain('m.a GO -> m.b.deep');
    expect(list).toContain('m.a BACK -> second');
    expect(list).toContain('m.a NEXT -> m.b');
    expect(list).toContain('first JUMP -> second');
    expect(list).toContain('second HOME -> first');
  });

  it('draws a transition to itself, reentering or staying', () => {
    const m = createMachine({ id: 'm', initial: 's', states: { s: { on: { AGAIN: { target: 's', reenter: true }, STAY: { actions: () => undefined } } } } });
    const { edges } = draftOf(m);
    const again = edges.find((e) => e.label === 'AGAIN')!;
    const stay = edges.find((e) => e.label === 'STAY')!;
    expect([again.from, again.to]).toEqual(['m.s', 'm.s']);
    expect(again.data?.internal).toBeUndefined();
    expect([stay.from, stay.to]).toEqual(['m.s', 'm.s']);
    expect(stay.data?.internal).toBe(true);
  });

  it('marks a deep history state and a shallow one', () => {
    const m = createMachine({
      id: 'm', initial: 'a',
      states: { a: { initial: 'x', states: { x: {}, y: {}, deep: { type: 'history', history: 'deep' }, last: { type: 'history' } }, on: { Z: 'b' } }, b: { on: { BACK: 'a.deep', LAST: 'a.last' } } },
    });
    const { nodes, edges } = draftOf(m);
    expect(nodes.find((n) => n.id === 'm.a.deep')?.detail).toBe('deep history');
    expect(nodes.find((n) => n.id === 'm.a.last')?.detail).toBe('history');
    expect(edges.find((e) => e.label === 'BACK')?.to).toBe('m.a.deep');
  });

  it('draws each target of a transition with several', () => {
    const m = createMachine({
      id: 'm', initial: 'p',
      states: { p: { type: 'parallel', states: { r1: { initial: 'a', states: { a: {}, b: {} } }, r2: { initial: 'c', states: { c: {}, d: {} } } } }, q: { on: { BOTH: ['#m.p.r1.b', '#m.p.r2.d'] as never } } },
    });
    expect(edgeList(m).filter((l) => l.startsWith('m.q BOTH'))).toEqual(['m.q BOTH -> m.p.r1.b', 'm.q BOTH -> m.p.r2.d']);
  });

  it('gives edges of the same name and ends ids of their own', () => {
    const m = createMachine({ id: 'm', initial: 's', states: { s: { on: { GO: [{ guard: () => true, target: 't' }, { target: 't' }] } }, t: {} } });
    const ids = draftOf(m).edges.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names a guard written inline as well as it can', () => {
    function isOk() { return true; }
    const m = createMachine({ id: 'm', initial: 's', states: { s: { on: { A: { guard: isOk, target: 't' }, B: { guard: { type: 'named' }, target: 't' }, C: { guard: () => true, target: 't' } } }, t: {} } });
    const labels = draftOf(m).edges.map((e) => e.label);
    expect(labels).toContain('A [isOk]');
    expect(labels).toContain('B [named]');
    expect(labels.some((l) => l?.startsWith('C ['))).toBe(true);
  });

  it('copes with a machine that has one state', () => {
    const { nodes, edges } = draftOf(createMachine({ id: 'solo' }));
    expect(nodes.map((n) => n.id)).toEqual(['solo']);
    expect(edges).toEqual([]);
  });
});

describe('what an event’s called', () => {
  it('reads XState’s own events', () => {
    expect(describeEvent('GO')).toEqual({ name: 'GO', kind: 'event' });
    expect(describeEvent('xstate.after.IDLE.m.s')).toEqual({ name: 'after IDLE', kind: 'after' });
    expect(describeEvent('xstate.after.5000.m.s')).toEqual({ name: 'after 5000', kind: 'after' });
    expect(describeEvent('xstate.done.actor.0.m.s')).toEqual({ name: 'done', kind: 'invoke' });
    expect(describeEvent('xstate.error.actor.0.m.s')).toEqual({ name: 'error', kind: 'invoke' });
    expect(describeEvent('xstate.done.state.m.p')).toEqual({ name: 'done', kind: 'done' });
  });

  it('calls an actor written inline an actor, rather than what XState calls it', () => {
    const m = createMachine({ id: 'm', initial: 'a', states: { a: { invoke: { src: fromPromise(async () => 1), onDone: 'b' } }, b: { invoke: [{ src: 'named' }, { src: fromPromise(async () => 2) }] } } });
    const nodes = machineToDraft(m as never).nodes;
    expect(nodes.find((n) => n.id === 'm.a')?.detail).toBe('invoke actor');
    expect(nodes.find((n) => n.id === 'm.b')?.detail).toBe('invoke named, actor');
    expect(nodes.find((n) => n.id === 'm.a')?.data?.invokes).toEqual(['actor']);
  });

  it('says what a snapshot edge is, the same as a done or an error', () => {
    const m = createMachine({ id: 'm', initial: 'a', states: { a: { invoke: { src: 'x', onSnapshot: 'a', onDone: 'b' } }, b: {} } });
    const edges = machineToDraft(m as never).edges.filter((e) => e.data?.transition !== 'initial');
    expect(edges.map((e) => e.label).sort()).toEqual(['done', 'snapshot']);
    expect(edges.every((e) => e.data?.transition === 'invoke')).toBe(true);
  });
});
