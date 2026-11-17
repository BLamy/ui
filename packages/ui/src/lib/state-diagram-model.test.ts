import { describe, expect, it } from 'vitest';
import { and, assign, cancel, createMachine, emit, enqueueActions, fromPromise, log, not, or, raise, sendParent, sendTo, setup, spawnChild, stateIn, stopChild } from 'xstate';
import { toDirectedGraph } from 'xstate/graph';
import { uploadMachine } from '../stories/upload-machine';
import { describeAction, describeEvent, describeGuard, describeMachine, machineToDraft, stateSections, transitionNotation, transitionSections, type StateMachineLike } from './state-diagram-model';
import { parseXState } from './state-diagram-source';

const draftOf = (m: unknown) => machineToDraft(m as StateMachineLike);
const text = (e: { data?: Parameters<typeof transitionNotation>[0] }) => transitionNotation(e.data);
const edgeList = (m: unknown) => draftOf(m).edges.map((e) => `${e.from} ${text(e)} -> ${e.to}`);

describe('the spike’s machine', () => {
  const { nodes, edges } = draftOf(uploadMachine);

  it('has all 33 states and all 36 edges, where toDirectedGraph has 29', () => {
    expect(nodes).toHaveLength(33);
    expect(edges).toHaveLength(36);
    // Where a state starts is its entry marker, not a node and an edge of its own.
    expect(nodes.filter((n) => n.entry)).toHaveLength(7);
    const flat: { edges: unknown[]; children: unknown[] }[] = [];
    const walk = (n: { edges: unknown[]; children: unknown[] }) => { flat.push(n); n.children.forEach((k) => walk(k as never)); };
    walk(toDirectedGraph(uploadMachine as never) as never);
    expect(flat.reduce((sum, n) => sum + n.edges.length, 0)).toBe(29);
  });

  it('counts each kind as the spike did', () => {
    const by = (k: string) => edges.filter((e) => e.data?.transition === k).length;
    expect({ event: by('event'), invoke: by('invoke'), always: by('always'), after: by('after'), done: by('done') }).toEqual({ event: 8, invoke: 14, always: 7, after: 5, done: 2 });
    expect(edges.filter((e) => e.from === e.to)).toHaveLength(4);
  });

  it('labels always, after, invoke and guards by name', () => {
    const labels = new Set(edges.map(text));
    for (const l of ['always [withinQuota]', 'always', 'after IDLE_TIMEOUT', 'after BACKOFF [retriesLeft] / bumpRetry', 'after QUEUE_VISIBILITY', 'after 5,000 ms', 'verifyToken: done', 'verifyToken: error', 'done', 'always [isClean]', 'always [hasViewers]', 'CANCEL', 'EOF']) expect(labels, l).toContain(l);
    // The label's heading is the event alone; the guard and the actions are chips under it.
    const backoff = edges.find((e) => text(e).startsWith('after BACKOFF [retriesLeft]'))!;
    expect(backoff.title).toBe('after BACKOFF');
    expect(backoff.icon).toBe('clock');
    expect(backoff.sections?.[0]?.items.map((i) => i.title)).toEqual(['if retriesLeft', 'bumpRetry']);
    // An event with nothing else to say is a pill: a title and no sections.
    const eof = edges.find((e) => e.title === 'EOF')!;
    expect(eof.sections).toBeUndefined();
  });

  it('gets compound and parallel states, regions, entry markers and final states right', () => {
    const look = (id: string) => { const n = nodes.find((m) => m.id === id); return n && [n.kind, n.variant ?? 'default']; };
    expect(look('upload')).toEqual(['root', 'default']);
    expect(look('upload.worker')).toEqual(['group', 'default']);
    expect(look('upload.processing')).toEqual(['group', 'dashed']);
    expect(look('upload.processing.scan')).toEqual(['region', 'default']);
    expect(look('upload.done')).toEqual(['node', 'double']);
    expect(nodes.find((n) => n.id === 'upload.done')?.icon).toBe('stop');
    expect(look('upload.worker.streaming')).toEqual(['node', 'default']);
    expect(nodes.find((n) => n.id === 'upload.worker.authenticating')?.entry).toBe(true);
    expect(nodes.find((n) => n.id === 'upload.worker.streaming')?.entry).toBeUndefined();
    // Everything in a parallel state starts at once, so none of it is marked.
    expect(nodes.filter((n) => n.parent === 'upload.processing').some((n) => n.entry)).toBe(false);
    expect(nodes.find((n) => n.id === 'upload.processing')?.trailing).toBe('parallel');
    const line = (transition: string) => [...new Set(edges.filter((e) => e.data?.transition === transition).map((e) => e.variant ?? 'default'))];
    expect([line('event'), line('done'), line('invoke'), line('always'), line('after')]).toEqual([['default'], ['default'], ['default'], ['dashed'], ['dotted']]);
    expect(nodes.find((n) => n.id === 'upload.worker.streaming')?.parent).toBe('upload.worker');
    expect(nodes.find((n) => n.id === 'upload.worker')?.data?.initial).toBe('authenticating');
  });

  it('says what a state invokes, its description, and the machine’s context', () => {
    const auth = nodes.find((n) => n.id === 'upload.worker.authenticating')!;
    expect(auth.sections).toEqual([{ id: 'invoke', title: 'Invoke', items: [{ id: '0', title: 'verifyToken', icon: 'play-circle' }] }]);
    expect(nodes.find((n) => n.id === 'upload.worker')?.description).toBe('The Worker takes the request');
    const root = nodes.find((n) => n.id === 'upload')!;
    expect(root.title).toBe('upload');
    expect(root.sections?.[0]).toEqual({ id: 'context', title: 'Context', variant: 'code', items: [{ id: 'retries', title: 'retries', description: '0' }, { id: 'bytes', title: 'bytes', description: '0' }, { id: 'viewers', title: 'viewers', description: '0' }] });
    expect(nodes.find((n) => n.id === 'upload.worker.streaming')?.sections).toBeUndefined();
  });

  it('keeps what simulating needs on each edge', () => {
    const chunk = edges.find((e) => e.title === 'CHUNK')!;
    expect(chunk.data).toEqual({ transition: 'event', event: 'CHUNK', name: 'CHUNK', actions: [{ kind: 'named', name: 'countBytes' }], internal: true });
    expect(chunk.sections?.map((sec) => sec.items.map((i) => i.title))).toEqual([['countBytes'], ['no target']]);
    expect(edges.find((e) => text(e) === 'always [withinQuota]')?.data?.transition).toBe('always');
    expect(chunk.from).toBe(chunk.to);
    const backoff = edges.find((e) => text(e).startsWith('after BACKOFF [retriesLeft]'))!;
    expect(backoff.data?.guard).toEqual({ name: 'retriesLeft', text: 'retriesLeft' });
    expect(backoff.data?.delay).toBe('BACKOFF');
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
    expect(b.nodes.map((n) => [n.id, n.kind, n.title, n.entry])).toEqual(a.nodes.map((n) => [n.id, n.kind, n.title, n.entry]));
    expect(b.edges.map((e) => [e.id, e.from, e.to, text(e)])).toEqual(a.edges.map((e) => [e.id, e.from, e.to, text(e)]));
  });

  it('runs nothing: no implementation is called', () => {
    let called = 0;
    const m = setup({
      guards: { g: () => { called++; return true; } },
      actions: { a: () => { called++; } },
    }).createMachine({ initial: 'x', context: () => { called++; return {}; }, states: { x: { entry: 'a', always: { guard: 'g', target: 'y' } }, y: {} } });
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
    const again = edges.find((e) => e.title === 'AGAIN')!;
    const stay = edges.find((e) => e.title === 'STAY')!;
    expect([again.from, again.to]).toEqual(['m.s', 'm.s']);
    expect(again.data?.internal).toBeUndefined();
    expect(again.data?.reenter).toBe(true);
    // How it goes is a quiet line (a `list` section), not a chip.
    expect(again.sections?.map((sec) => [sec.variant ?? 'default', sec.items.map((i) => i.title)])).toEqual([['list', ['reenters']]]);
    expect([stay.from, stay.to]).toEqual(['m.s', 'm.s']);
    expect(stay.data?.internal).toBe(true);
    // An arrow written in `actions` is named `actions` by JavaScript, which says nothing.
    expect(stay.sections?.map((sec) => sec.items.map((i) => i.title))).toEqual([['inline'], ['no target']]);
  });

  it('marks a deep history state and a shallow one', () => {
    const m = createMachine({
      id: 'm', initial: 'a',
      states: { a: { initial: 'x', states: { x: {}, y: {}, deep: { type: 'history', history: 'deep' }, last: { type: 'history' } }, on: { Z: 'b' } }, b: { on: { BACK: 'a.deep', LAST: 'a.last' } } },
    });
    const { nodes, edges } = draftOf(m);
    expect(nodes.find((n) => n.id === 'm.a.deep')?.icon).toEqual({ text: 'H*' });
    expect(nodes.find((n) => n.id === 'm.a.deep')?.data?.history).toBe('deep');
    expect(nodes.find((n) => n.id === 'm.a.last')?.icon).toEqual({ text: 'H' });
    expect(nodes.find((n) => n.id === 'm.a.last')?.data?.history).toBe('shallow');
    expect(edges.find((e) => e.title === 'BACK')?.to).toBe('m.a.deep');
  });

  it('draws each target of a transition with several, and says it has several', () => {
    const m = createMachine({
      id: 'm', initial: 'p',
      states: { p: { type: 'parallel', states: { r1: { initial: 'a', states: { a: {}, b: {} } }, r2: { initial: 'c', states: { c: {}, d: {} } } } }, q: { on: { BOTH: { target: ['#m.p.r1.b', '#m.p.r2.d'] } } } },
    });
    expect(edgeList(m).filter((l) => l.startsWith('m.q BOTH'))).toEqual(['m.q BOTH -> m.p.r1.b', 'm.q BOTH -> m.p.r2.d']);
    const both = draftOf(m).edges.filter((e) => e.title === 'BOTH');
    expect(both.every((e) => e.data?.targets === 2 && e.sections?.[0]?.items.some((i) => i.title === '2 targets'))).toBe(true);
  });

  it('gives edges of the same name and ends ids of their own', () => {
    const m = createMachine({ id: 'm', initial: 's', states: { s: { on: { GO: [{ guard: () => true, target: 't' }, { target: 't' }] } }, t: {} } });
    const ids = draftOf(m).edges.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names a guard written inline as well as it can', () => {
    function isOk() { return true; }
    const m = createMachine({ id: 'm', initial: 's', states: { s: { on: { A: { guard: isOk, target: 't' }, B: { guard: { type: 'named' }, target: 't' }, C: { guard: () => true, target: 't' } } }, t: {} } });
    const labels = draftOf(m).edges.map(text);
    expect(labels).toContain('A [isOk]');
    expect(labels).toContain('B [named]');
    expect(labels.some((l) => l?.startsWith('C ['))).toBe(true);
  });

  it('copes with a machine that has one state', () => {
    const { nodes, edges } = draftOf(createMachine({ id: 'solo' }));
    expect(nodes.map((n) => n.id)).toEqual(['solo']);
    expect(nodes[0]?.sections).toBeUndefined();
    expect(edges).toEqual([]);
  });
});

describe('what an event’s called', () => {
  it('reads XState’s own events', () => {
    expect(describeEvent('GO')).toEqual({ name: 'GO', kind: 'event' });
    expect(describeEvent('xstate.after.IDLE.m.s')).toEqual({ name: 'after IDLE', kind: 'after' });
    expect(describeEvent('xstate.after.5000.m.s')).toEqual({ name: 'after 5,000 ms', kind: 'after' });
    expect(describeEvent('xstate.done.actor.0.m.s')).toEqual({ name: 'done', kind: 'invoke' });
    expect(describeEvent('xstate.error.actor.0.m.s')).toEqual({ name: 'error', kind: 'invoke' });
    expect(describeEvent('xstate.done.state.m.p')).toEqual({ name: 'done', kind: 'done' });
  });

  it('calls an actor written inline an actor, rather than what XState calls it', () => {
    const m = createMachine({ id: 'm', initial: 'a', states: { a: { invoke: { src: fromPromise(async () => 1), onDone: 'b' } }, b: { invoke: [{ src: 'named' }, { src: fromPromise(async () => 2) }] } } });
    const nodes = machineToDraft(m as never).nodes;
    expect(nodes.find((n) => n.id === 'm.a')?.data?.invoke).toEqual([{ src: 'actor' }]);
    expect(nodes.find((n) => n.id === 'm.b')?.sections?.[0]?.items.map((i) => i.title)).toEqual(['named', 'actor']);
  });

  it('says what a snapshot edge is, the same as a done or an error, and which actor’s it is', () => {
    const m = createMachine({ id: 'm', initial: 'a', states: { a: { invoke: { src: 'x', onSnapshot: 'a', onDone: 'b' } }, b: {} } });
    const edges = machineToDraft(m as never).edges;
    expect(edges.map((e) => e.title).sort()).toEqual(['x: done', 'x: snapshot']);
    expect(edges.every((e) => e.data?.transition === 'invoke' && e.data.actor === 'x')).toBe(true);
  });
});

/* Everything an XState v5 machine says, read from a machine object, from its config through createMachine, and from its
   source through parseXState. */

const PLAYER_SOURCE = `import { assign, raise, setup } from 'xstate';

export const player = setup({
  types: {} as { context: { audioRef: string; currentTime: number; trackSource: string | null } },
  actions: { onLoad: () => {}, onPlay: () => {} },
  guards: { canRetry: () => true, isAbove: (_, p: { min: number }) => true },
  delays: { SHORT: 100 },
}).createMachine({
  id: 'Audio Player',
  description: 'Plays one track',
  context: { audioRef: '', currentTime: 0, trackSource: null, audioContext: new AudioContext() },
  initial: 'idle',
  on: { RESET: { target: '.idle', actions: assign({ currentTime: 0 }) } },
  states: {
    idle: {
      entry: ['onLoad', { type: 'track', params: { name: 'idle', n: 2 } }, assign({ currentTime: 0, audioRef: ({ event }) => event.ref }), raise({ type: 'READY' }), sendTo('logger', { type: 'HI' }), log('idle'), () => console.log('x'), function onIdle() {}],
      exit: [emit({ type: 'LEFT' }), spawnChild('ticker'), stopChild('ticker'), cancel('tick'), enqueueActions(() => {}), sendParent({ type: 'UP' })],
      tags: ['quiet', 'start'],
      meta: { owner: 'audio', weight: 2 },
      invoke: { id: 'loader', src: 'loadTrack', input: { url: '/a.mp3', at: Date.now() }, onDone: 'ready', onError: { target: 'failed', actions: 'onError' } },
      on: {
        GO: { target: 'ready', guard: and(['canRetry', or([{ type: 'isAbove', params: { min: 5 } }, not('canRetry')])]), actions: ['onPlay'], reenter: true },
        NOTE: { actions: 'onPlay' },
        IN: { target: 'ready', guard: stateIn('#Audio Player.ready') },
        '*': 'failed',
      },
      after: { SHORT: 'ready', 500: { target: 'failed', guard: 'canRetry' } },
      always: { guard: { type: 'isAbove', params: { min: 1 } }, target: 'ready' },
    },
    ready: { type: 'final' },
    failed: {},
  },
});`;

/** The same machine, made by XState from a machine object. */
const playerMachine = () => setup({
  actions: { onLoad: () => undefined, onPlay: () => undefined, onError: () => undefined, track: () => undefined },
  guards: { canRetry: () => true, isAbove: () => true },
  actors: { loadTrack: fromPromise(async () => 1), ticker: fromPromise(async () => 1) },
  delays: { SHORT: 100 },
}).createMachine({
  id: 'Audio Player',
  description: 'Plays one track',
  context: { audioRef: '', currentTime: 0, trackSource: null },
  initial: 'idle',
  on: { RESET: { target: '.idle', actions: assign({ currentTime: 0 }) } },
  states: {
    idle: {
      entry: ['onLoad', { type: 'track', params: { name: 'idle', n: 2 } }, assign({ currentTime: 0 }), raise({ type: 'READY' }), sendTo('logger', { type: 'HI' }), log('idle'), () => undefined, function onIdle() { /* code */ }],
      exit: [emit({ type: 'LEFT' }), spawnChild('ticker'), stopChild('ticker'), cancel('tick'), enqueueActions(() => undefined), sendParent({ type: 'UP' })],
      tags: ['quiet', 'start'],
      meta: { owner: 'audio', weight: 2 },
      invoke: { id: 'loader', src: 'loadTrack', input: { url: '/a.mp3' }, onDone: 'ready', onError: { target: 'failed', actions: 'onError' } },
      on: {
        GO: { target: 'ready', guard: and(['canRetry', or([{ type: 'isAbove', params: { min: 5 } }, not('canRetry')])]), actions: ['onPlay'], reenter: true },
        NOTE: { actions: 'onPlay' },
        IN: { target: 'ready', guard: stateIn('#Audio Player.ready') },
        '*': 'failed',
      },
      after: { SHORT: 'ready', 500: { target: 'failed', guard: 'canRetry' } },
      always: { guard: { type: 'isAbove', params: { min: 1 } }, target: 'ready' },
    },
    ready: { type: 'final' },
    failed: {},
  },
} as never);

describe('everything a machine says', () => {
  const ways = {
    'a machine object': () => playerMachine(),
    'its config, through createMachine': () => createMachine((playerMachine() as unknown as { config: object }).config as never),
    'its source, through parseXState': () => createMachine(parseXState(PLAYER_SOURCE) as never),
  };
  for (const [how, make] of Object.entries(ways)) {
    describe(`from ${how}`, () => {
      const m = make();
      const { nodes, edges } = draftOf(m);
      const idle = nodes.find((n) => n.id === 'Audio Player.idle')!;
      const edge = (title: string) => edges.find((e) => e.title === title)!;

      it('reads the machine: its id, description and context', () => {
        const root = nodes.find((n) => !n.parent)!;
        expect(root.title).toBe('Audio Player');
        expect(root.description).toBe('Plays one track');
        const context = Object.fromEntries((root.data?.context ?? []).map((c) => [c.key, c.value]));
        if (how.startsWith('its source')) expect(context).toEqual({ audioRef: 'string', currentTime: 'number', trackSource: 'string | null', audioContext: 'unknown' });
        else expect(context).toEqual({ audioRef: '""', currentTime: '0', trackSource: 'null' });
        expect(root.sections?.[0]?.variant).toBe('code');
      });

      it('reads a state’s entry and exit actions, naming each as what it is', () => {
        const entry = idle.data!.entry.map((a) => [a.kind, a.name, a.detail]);
        expect(entry.slice(0, 6)).toEqual([
          ['named', 'onLoad', undefined], ['named', 'track', 'name: "idle", n: 2'], ['assign', 'assign', how.startsWith('its source') ? 'currentTime, audioRef' : 'currentTime'],
          ['raise', 'raise', 'READY'], ['sendTo', 'sendTo', 'HI to logger'], ['log', 'log', 'idle'],
        ]);
        expect(entry[6]).toEqual(['inline', 'inline', undefined]);
        expect(entry[7]).toEqual(['inline', 'onIdle', undefined]);
        expect(idle.data!.exit.map((a) => [a.name, a.detail])).toEqual([['emit', 'LEFT'], ['spawnChild', 'ticker'], ['stopChild', 'ticker'], ['cancel', 'tick'], ['enqueueActions', undefined], ['sendParent', 'UP']]);
        const entrySection = idle.sections?.find((s) => s.id === 'entry');
        expect(entrySection?.title).toBe('Entry actions');
        expect(entrySection?.items[0]).toEqual({ id: '0', title: 'onLoad', icon: 'bolt' });
        expect(entrySection?.items[6]?.tone).toBe('muted');
        expect(idle.sections?.find((s) => s.id === 'exit')?.title).toBe('Exit actions');
      });

      it('reads invoke, tags, meta and type', () => {
        expect(idle.data?.invoke).toEqual([{ src: 'loadTrack', id: 'loader', input: '{"url":"/a.mp3"}' }]);
        expect(idle.sections?.find((s) => s.id === 'invoke')?.items[0]).toEqual({ id: '0', title: 'loadTrack', description: 'id loader · input {"url":"/a.mp3"}', icon: 'play-circle' });
        expect(idle.data?.tags).toEqual(['quiet', 'start']);
        expect(idle.sections?.find((s) => s.id === 'tags')?.items.map((i) => i.title)).toEqual(['quiet', 'start']);
        expect(idle.data?.meta).toEqual({ owner: 'audio', weight: '2' });
        expect(idle.sections?.find((s) => s.id === 'meta')).toMatchObject({ variant: 'list', items: [{ title: 'owner', description: 'audio' }, { title: 'weight', description: '2' }] });
        expect(idle.entry).toBe(true);
        expect(nodes.find((n) => n.id === 'Audio Player.ready')).toMatchObject({ variant: 'double', icon: 'stop', data: { type: 'final' } });
        expect(nodes.find((n) => n.id === 'Audio Player')?.data?.initial).toBe('idle');
      });

      it('reads a transition’s guard, composed or with params, its actions and reenter', () => {
        const go = edge('GO');
        expect(go.data?.guard).toEqual({ name: 'canRetry and (isAbove(min: 5) or not canRetry)', text: 'canRetry and (isAbove(min: 5) or not canRetry)', composed: true });
        expect(go.data?.reenter).toBe(true);
        expect(go.sections?.map((sec) => sec.items.map((i) => i.title))).toEqual([['if canRetry and (isAbove(min: 5) or not canRetry)', 'onPlay'], ['reenters']]);
        expect(edge('IN').data?.guard?.text).toBe('in #Audio Player.ready');
        const always = edges.find((e) => e.data?.transition === 'always')!;
        expect(always.title).toBe('always');
        expect(always.variant).toBe('dashed');
        expect(always.data?.guard).toEqual({ name: 'isAbove', text: 'isAbove(min: 1)', params: { min: 1 } });
      });

      it('reads a targetless transition, the wildcard, `after` by number and by name, and root `on`', () => {
        const note = edge('NOTE');
        expect([note.from, note.to, note.data?.internal]).toEqual(['Audio Player.idle', 'Audio Player.idle', true]);
        expect(edge('*').to).toBe('Audio Player.failed');
        expect(edge('after SHORT')).toMatchObject({ icon: 'clock', variant: 'dotted', data: { delay: 'SHORT', transition: 'after' } });
        expect(edge('after 500 ms')).toMatchObject({ data: { delay: 500, guard: { name: 'canRetry' } } });
        const reset = edge('RESET');
        expect([reset.from, reset.to]).toEqual(['Audio Player', 'Audio Player.idle']);
        expect(reset.data?.actions).toEqual([{ kind: 'assign', name: 'assign', detail: 'currentTime' }]);
      });

      it('reads an actor’s done and error, by its name', () => {
        expect(edge('loadTrack: done').to).toBe('Audio Player.ready');
        const error = edge('loadTrack: error');
        expect(error.data).toMatchObject({ transition: 'invoke', actor: 'loadTrack', actions: [{ name: 'onError' }] });
      });
    });
  }
});

describe('a machine with only names', () => {
  it('is states as headers and transitions as pills: nothing more to draw', () => {
    const { nodes, edges } = draftOf(createMachine({ id: 'light', initial: 'green', states: { green: { on: { NEXT: 'yellow' } }, yellow: { on: { NEXT: 'red' } }, red: { on: { NEXT: 'green' } } } }));
    expect(nodes.every((n) => !n.sections && !n.description)).toBe(true);
    expect(edges.every((e) => !e.sections && !e.icon)).toBe(true);
    expect(describeMachine(createMachine({ id: 'x', states: {} }) as never)).toEqual({ id: 'x', title: 'x', context: [] });
  });
});

describe('the pieces', () => {
  it('describes values, params and built-ins', () => {
    expect(describeAction({ type: 'xstate.assign', params: { keys: ['a', 'b'] } })).toEqual({ kind: 'assign', name: 'assign', detail: 'a, b' });
    expect(describeAction({ type: 'xstate.inline', params: { name: 'doIt' } })).toEqual({ kind: 'inline', name: 'doIt' });
    expect(describeAction({ type: 'go', params: { to: 'x' } })).toEqual({ kind: 'named', name: 'go', detail: 'to: "x"', params: { to: 'x' } });
    expect(describeGuard(undefined)).toBeUndefined();
    expect(describeGuard({ type: 'xstate.not', params: { guards: [{ type: 'xstate.and', params: { guards: ['a', 'b'] } }] } })?.text).toBe('not (a and b)');
    expect(describeGuard({ type: 'xstate.inline' })).toEqual({ name: 'inline', text: 'inline' });
  });

  it('gives a machine’s title from meta when it has one', () => {
    expect(describeMachine(createMachine({ id: 'audio', meta: { title: 'Audio Player' }, context: () => ({ a: 1 }), states: {} }) as never)).toEqual({ id: 'audio', title: 'Audio Player', context: [], contextFromCode: true });
  });

  it('sections are what a state and a transition say, in a fixed order', () => {
    const data = { key: 's', type: 'atomic' as const, entry: [{ kind: 'named' as const, name: 'a' }], exit: [], invoke: [], tags: ['t'] };
    expect(stateSections(data).map((s) => s.title)).toEqual(['Entry actions', 'Tags']);
    expect(transitionSections({ transition: 'event', event: 'E', name: 'E' })).toEqual([]);
  });
});
