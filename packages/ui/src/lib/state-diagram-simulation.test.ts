import { describe, expect, it, vi } from 'vitest';
import * as xstate from 'xstate';
import { createActor, createMachine } from 'xstate';
import { uploadMachine } from '../stories/upload-machine';
import { machineToDraft } from './state-diagram-model';
import { SETTLE_LIMIT, SimulationClock, TIMER_LIMIT, activeLeaves, activeStateIds, createSimulation, standInConfig, type Simulation } from './state-diagram-simulation';

const config = (uploadMachine as unknown as { config: object }).config;
const sim = (c: unknown, ...rest: unknown[]) => createSimulation(xstate as never, c, ...(rest as []));
const send = (s: Simulation, ...events: string[]) => { for (const e of events) s.send(e); };
const finish = (s: Simulation, label: string) => {
  const f = s.get().finishes.find((x) => x.label === label);
  if (!f) throw new Error(`no finish ${label}: ${s.get().finishes.map((x) => x.label)}`);
  s.send(f.event);
};

describe('the clock', () => {
  it('only moves when told, and fires in order', () => {
    const c = new SimulationClock();
    const fired: string[] = [];
    c.setTimeout(() => fired.push('b'), 200);
    c.setTimeout(() => fired.push('a'), 100);
    const gone = c.setTimeout(() => fired.push('gone'), 50);
    c.clearTimeout(gone);
    expect(c.nextDue()).toBe(100);
    expect(fired).toEqual([]);
    c.advance(100);
    expect(fired).toEqual(['a']);
    expect(c.now).toBe(100);
    expect(c.nextDue()).toBe(200);
    c.advance(500);
    expect(fired).toEqual(['a', 'b']);
    expect(c.now).toBe(500);
    expect(c.nextDue()).toBeNull();
  });

  it('fires what a timer sets, in the same advance, at the right time', () => {
    const c = new SimulationClock();
    const at: number[] = [];
    c.setTimeout(() => { at.push(c.now); c.setTimeout(() => at.push(c.now), 10); }, 10);
    c.advance(100);
    expect(at).toEqual([10, 20]);
  });
});

describe('the clock, against timers of no length', () => {
  const round = (c: SimulationClock, fired: { n: number }) => {
    const again = () => { fired.n++; c.setTimeout(again, 0); };
    c.setTimeout(again, 0);
  };

  it('fires one at a time when it’s asked to', () => {
    const c = new SimulationClock();
    const fired = { n: 0 };
    round(c, fired);
    expect(c.fireNext()).toBe(true);
    expect(fired.n).toBe(1);
  });

  it('stops at its limit and says so, rather than going round for ever', () => {
    const c = new SimulationClock();
    const fired = { n: 0 };
    round(c, fired);
    expect(c.advance(100, 50)).toBe(false);
    expect(fired.n).toBe(50);
    expect(c.now).toBe(0);
  });

  it('isn’t stopped by a limit it only just reaches', () => {
    const c = new SimulationClock();
    let n = 0;
    for (let i = 1; i <= 50; i++) c.setTimeout(() => n++, i);
    expect(c.advance(100, 50)).toBe(true);
    expect(n).toBe(50);
    expect(c.now).toBe(100);
  });

  it('says there’s nothing to fire', () => {
    const c = new SimulationClock();
    expect(c.fireNext()).toBe(false);
    c.setTimeout(() => undefined, 10);
    expect(c.fireNext(5)).toBe(false);
    expect(c.nextDue()).toBe(10);
  });
});

describe('a config with stand-ins', () => {
  it('finds what it names', () => {
    const { names } = standInConfig(config);
    expect(names.actors).toEqual(['broadcast', 'insertRow', 'makeThumbnails', 'pullMessage', 'putObject', 'scanObject', 'verifyToken']);
    expect(names.guards).toEqual(['hasViewers', 'isClean', 'isImage', 'retriesLeft', 'withinQuota']);
    expect(names.actions).toEqual(['ackMessage', 'addViewer', 'bumpRetry', 'countBytes', 'logFailure']);
    expect(names.delays).toEqual(['BACKOFF', 'IDLE_TIMEOUT', 'QUEUE_VISIBILITY']);
  });

  it('leaves the original alone', () => {
    const before = JSON.stringify(config);
    standInConfig(config);
    expect(JSON.stringify(config)).toBe(before);
  });

  it('takes out whatever’s written inline, so no code runs', () => {
    let ran = 0;
    const count = () => { ran++; return false; };
    const s = sim({
      id: 'm', initial: { target: 'a', actions: count }, context: () => { count(); return { n: 0 }; },
      entry: count,
      output: count,
      states: {
        a: { entry: count, exit: [count, 'named', xstate.assign({ n: () => count() })], on: { GO: { guard: count, target: 'b', actions: count } }, after: { 1000: { guard: count, actions: count } }, always: { guard: count, actions: count } },
        b: { invoke: { src: xstate.fromPromise(async () => { count(); }), input: count, onDone: { target: 'c', guard: count, actions: count }, onError: { actions: count }, onSnapshot: { actions: count } } },
        c: { type: 'final', output: count },
      },
    });
    s.send('GO');
    expect(s.get().now).toEqual(['b']);
    expect(ran).toBe(0);
    finish(s, 'b: done');
    expect(s.get().now).toEqual(['c']);
    expect(s.get().status).toBe('done');
    expect(ran).toBe(0);
  });

  it('lists a name only when it has one', () => {
    const { names } = standInConfig({ id: 'm', initial: 'a', states: { a: { entry: () => undefined, on: { GO: { guard: () => true } }, invoke: { src: xstate.fromPromise(async () => 1) } } } });
    expect(names).toEqual({ guards: [], actions: [], actors: [], delays: [] });
  });

  it('keeps a transition that only has code to run, so it’s still one that can be taken', () => {
    const c = { id: 'm', initial: 'a', states: { a: { on: { LOG: { actions: () => undefined }, ASSIGN: { actions: xstate.assign({}) }, NOTHING: {} } } } };
    const real = createActor(createMachine(c as never)).start();
    expect(sim(c).get().events).toEqual(['LOG', 'ASSIGN', 'NOTHING'].filter((e) => real.getSnapshot().can({ type: e } as never)));
    expect(sim(c).get().events).toEqual(['LOG', 'ASSIGN']);
  });

  it('leaves what raise would have said for you to send, and it can', () => {
    const s = sim({ id: 'm', initial: 'a', states: { a: { entry: xstate.raise({ type: 'NEXT' }), on: { NEXT: 'b' } }, b: {} } });
    expect(s.get().now).toEqual(['a']);
    expect(s.get().events).toEqual(['NEXT']);
    s.send('NEXT');
    expect(s.get().now).toEqual(['b']);
  });
});

describe('where it is', () => {
  const m = createMachine({ id: 'm', type: 'parallel', states: { r1: { initial: 'a', states: { a: {}, b: {} } }, r2: { initial: 'c', states: { c: { initial: 'd', states: { d: {} } } } } } });
  const root = (m as unknown as { root: never }).root;

  it('reads a value into ids, parallel regions included', () => {
    expect(activeStateIds(root, { r1: 'a', r2: { c: 'd' } })).toEqual(['m', 'm.r1', 'm.r1.a', 'm.r2', 'm.r2.c', 'm.r2.c.d']);
    expect(activeLeaves(root, ['m', 'm.r1', 'm.r1.a', 'm.r2', 'm.r2.c', 'm.r2.c.d'])).toEqual(['a', 'd']);
  });

  it('ignores what isn’t there', () => {
    expect(activeStateIds(root, { nope: 'x' })).toEqual(['m']);
    expect(activeStateIds(root, 'nope')).toEqual(['m']);
    expect(activeStateIds(root, undefined)).toEqual(['m']);
  });
});

describe('running the spike’s machine', () => {
  const start = () => sim(config, {}, { IDLE_TIMEOUT: 30000, QUEUE_VISIBILITY: 60000 });

  it('starts in its initial states, and waits on what it invokes', () => {
    const s = start();
    expect(s.get().now).toEqual(['authenticating']);
    expect(s.get().active).toEqual(['upload', 'upload.worker', 'upload.worker.authenticating']);
    expect(s.get().finishes.map((f) => f.label).sort()).toEqual(['verifyToken: done', 'verifyToken: error']);
    expect(s.get().status).toBe('active');
  });

  it('goes the whole way, with the 14 steps of the spike’s run', () => {
    const s = start();
    finish(s, 'verifyToken: done');
    // Through the `always` in checkingQuota, on its own.
    expect(s.get().now).toEqual(['streaming']);
    send(s, 'CHUNK', 'CHUNK', 'EOF');
    expect(s.get().now).toEqual(['committing']);
    finish(s, 'putObject: done');
    expect(s.get().now).toEqual(['waiting']);
    s.send('R2_EVENT');
    finish(s, 'pullMessage: done');
    expect(s.get().now).toEqual(['scanning', 'resizing', 'inserting']);
    finish(s, 'scanObject: done');
    finish(s, 'makeThumbnails: done');
    finish(s, 'insertRow: done');
    // The parallel state's done, and the room's next. hasViewers answers true, so it goes straight to broadcasting.
    expect(s.get().now).toEqual(['broadcasting']);
    finish(s, 'broadcast: done');
    expect(s.get().now).toEqual(['done']);
    expect(s.get().status).toBe('done');
    expect(s.get().events).toEqual([]);
    expect(s.get().finishes).toEqual([]);
    expect(s.get().next).toBeNull();
    // Each by what came in, and not what XState said to itself after it, as it does when a parallel state's done.
    expect(s.get().log.map((l) => l.what)).toEqual(['Started', 'verifyToken: done', 'CHUNK', 'CHUNK', 'EOF', 'putObject: done', 'R2_EVENT', 'pullMessage: done', 'scanObject: done', 'makeThumbnails: done', 'insertRow: done', 'broadcast: done']);
  });

  it('lights all the parallel regions at once', () => {
    const s = start();
    finish(s, 'verifyToken: done');
    s.send('EOF');
    finish(s, 'putObject: done');
    s.send('R2_EVENT');
    finish(s, 'pullMessage: done');
    const { active } = s.get();
    for (const id of ['upload.processing', 'upload.processing.scan', 'upload.processing.scan.scanning', 'upload.processing.thumbnails', 'upload.processing.thumbnails.resizing', 'upload.processing.metadata', 'upload.processing.metadata.inserting']) expect(active).toContain(id);
  });

  it('offers what snapshot.can says, at every step', () => {
    const s = start();
    // The same machine run alongside with the same stand-ins, by XState alone.
    const check = () => {
      const { events, status } = s.get();
      if (status !== 'active') return;
      expect(events).toContain('CANCEL');
      for (const e of ['CHUNK', 'HEARTBEAT', 'EOF', 'R2_EVENT', 'VIEWER_JOINED', 'RETRY', 'ALARM']) {
        const leaves = s.get().now;
        const should = (e === 'CHUNK' || e === 'HEARTBEAT' || e === 'EOF') ? leaves.includes('streaming')
          : e === 'R2_EVENT' ? leaves.includes('waiting')
          : e === 'RETRY' ? leaves.includes('waitingToRetry')
          : e === 'VIEWER_JOINED' ? leaves.some((l) => ['broadcasting', 'idle', 'closing'].includes(l))
          : leaves.includes('idle');
        expect(events.includes(e), `${e} in ${leaves}`).toBe(should);
      }
    };
    check();
    finish(s, 'verifyToken: done');
    check();
    s.send('EOF');
    check();
    finish(s, 'putObject: error');
    check();
  });

  it('offers exactly what XState’s own can says, at each of the steps, on the machine with the same stand-ins', () => {
    const noop = () => undefined;
    const never = xstate.fromPromise(() => new Promise<never>(() => undefined));
    const names = standInConfig(config).names;
    const real = createActor((uploadMachine as never as { provide: (i: object) => never }).provide({
      guards: Object.fromEntries(names.guards.map((g) => [g, () => true])),
      actions: Object.fromEntries(names.actions.map((a) => [a, noop])),
      actors: Object.fromEntries(names.actors.map((a) => [a, never])),
      delays: Object.fromEntries(names.delays.map((d) => [d, 100000])),
    })).start();
    const s = sim(config);
    const every = (uploadMachine as unknown as { events: string[] }).events.filter((e) => e !== '*' && !e.startsWith('xstate.'));
    const compare = () => {
      const snapshot = real.getSnapshot() as { value: unknown; status: string; can: (e: object) => boolean };
      expect(s.get().status).toBe(snapshot.status);
      expect([...s.get().events].sort(), JSON.stringify(snapshot.value)).toEqual(snapshot.status === 'active' ? every.filter((e) => snapshot.can({ type: e })).sort() : []);
      expect(s.get().active.slice(1).sort()).toEqual(activeStateIds((uploadMachine as unknown as { root: never }).root, snapshot.value).slice(1).sort());
    };
    const both = (type: string) => {
      s.send(type);
      real.send({ type } as never);
      compare();
    };
    const done = (label: string) => both(s.get().finishes.find((f) => f.label === label)!.event);
    compare();
    done('verifyToken: done');
    both('CHUNK');
    both('HEARTBEAT');
    both('EOF');
    done('putObject: done');
    both('R2_EVENT');
    done('pullMessage: done');
    done('scanObject: done');
    done('makeThumbnails: done');
    done('insertRow: done');
    both('VIEWER_JOINED');
    done('broadcast: done');
    expect(s.get().status).toBe('done');
    real.stop();
  });

  it('agrees with XState’s own can on a machine with no stand-ins to get in the way', () => {
    const c = { id: 'm', initial: 'a', states: { a: { on: { GO: 'b', STAY: { actions: [] } } }, b: { on: { BACK: 'a' } } } };
    const s = sim(c);
    const real = createActor(createMachine(c as never)).start();
    const events = ['GO', 'STAY', 'BACK'];
    const compare = () => expect(s.get().events.sort()).toEqual(events.filter((e) => real.getSnapshot().can({ type: e } as never)).sort());
    compare();
    s.send('GO'); real.send({ type: 'GO' } as never);
    compare();
    s.send('BACK'); real.send({ type: 'BACK' } as never);
    compare();
  });

  it('doesn’t offer an internal event, or a timer’s, as if it could be chosen', () => {
    const s = start();
    for (const e of s.get().events) expect(e.startsWith('xstate.')).toBe(false);
  });

  it('says in the log what a timer was, and when', () => {
    const s = start();
    finish(s, 'verifyToken: done');
    s.stepTime();
    expect(s.get().log.at(-1)).toEqual({ id: 2, at: 30000, what: 'after IDLE_TIMEOUT', now: ['rejected'] });
  });

  it('moves no time until it’s told', async () => {
    const s = start();
    finish(s, 'verifyToken: done');
    expect(s.get().next).toBe(30000);
    await new Promise((r) => setTimeout(r, 30));
    expect(s.get().time).toBe(0);
    expect(s.get().now).toEqual(['streaming']);
    s.stepTime();
    expect(s.get().time).toBe(30000);
    expect(s.get().now).toEqual(['rejected']);
    expect(s.get().status).toBe('done');
    expect(s.get().next).toBeNull();
  });

  it('runs time on by as much as it’s told, firing what comes due', () => {
    const s = start();
    finish(s, 'verifyToken: done');
    s.advance(10000);
    expect(s.get().now).toEqual(['streaming']);
    expect(s.get().time).toBe(10000);
    s.advance(19999);
    expect(s.get().now).toEqual(['streaming']);
    s.advance(1);
    expect(s.get().now).toEqual(['rejected']);
  });

  it('takes a delay as it’s told, and a named one it can’t read as a second', () => {
    const s = sim({ id: 'm', initial: 'a', states: { a: { after: { SOON: 'b' } }, b: { after: { LATER: 'c' } }, c: { after: { 250: 'd' } }, d: {} } }, { delays: { SOON: 5 } });
    expect(s.get().next).toBe(5);
    s.stepTime();
    expect(s.get().now).toEqual(['b']);
    expect(s.get().next).toBe(1005);
    s.stepTime();
    expect(s.get().next).toBe(1255);
  });

  it('takes a delay from the machine’s own numbers, unless it’s told otherwise', () => {
    const c = { id: 'm', initial: 'a', states: { a: { after: { SOON: 'b', CODE: 'b' } }, b: {} } };
    const code = () => 1;
    expect(createSimulation(xstate as never, c, {}, { SOON: 40, CODE: code }).get().next).toBe(40);
    expect(createSimulation(xstate as never, c, { delays: { SOON: 7 } }, { SOON: 40, CODE: code }).get().next).toBe(7);
    expect(createSimulation(xstate as never, { id: 'm', initial: 'a', states: { a: { after: { CODE: 'b' } }, b: {} } }, {}, { CODE: code }).get().next).toBe(1000);
  });

  it('cancels a timer when the state’s left', () => {
    const s = start();
    finish(s, 'verifyToken: done');
    s.send('EOF');
    expect(s.get().next).toBeNull();
  });

  it('answers guards as it’s told', () => {
    const c = { id: 'm', initial: 'a', states: { a: { on: { GO: { guard: 'ok', target: 'b' } } }, b: {} } };
    const s = sim(c);
    expect(s.get().events).toEqual(['GO']);
    s.setGuard('ok', false);
    expect(s.get().events).toEqual([]);
    s.send('GO');
    expect(s.get().now).toEqual(['a']);
    expect(s.get().log.at(-2)?.what).toBe('ok answers no');
    s.setGuard('ok', true);
    s.send('GO');
    expect(s.get().now).toEqual(['b']);
    expect(sim(c, { guards: { ok: false } }).get().events).toEqual([]);
  });

  it('takes the other branch of an always when its guard says no', () => {
    const c = { id: 'm', initial: 'a', states: { a: { on: { GO: 'check' } }, check: { always: [{ guard: 'clean', target: 'yes' }, { target: 'no' }] }, yes: {}, no: {} } };
    const s = sim(c, { guards: { clean: false } });
    s.send('GO');
    expect(s.get().now).toEqual(['no']);
  });

  it('keeps a log of what happened, with Reset starting over', () => {
    const s = start();
    finish(s, 'verifyToken: done');
    s.send('CHUNK');
    s.send('EOF');
    const { log } = s.get();
    expect(log.map((l) => l.what)).toEqual(['Started', 'verifyToken: done', 'CHUNK', 'EOF']);
    expect(log.map((l) => l.id)).toEqual([0, 1, 2, 3]);
    expect(log[1].now).toEqual(['streaming']);
    expect(log[3].now).toEqual(['committing']);
    s.reset();
    expect(s.get().log.map((l) => l.what)).toEqual(['Started']);
    expect(s.get().now).toEqual(['authenticating']);
    expect(s.get().time).toBe(0);
  });

  it('says which edges it just took, by the ids they’re drawn with, always included', () => {
    const s = start();
    const drawn = new Set(machineToDraft(uploadMachine as never).edges.map((e) => e.id));
    expect(s.get().taken).toEqual([]);
    finish(s, 'verifyToken: done');
    expect(s.get().taken).toHaveLength(2);
    expect(s.get().taken[1]).toBe('upload.worker.checkingQuota:always->upload.worker.streaming');
    s.send('CHUNK');
    expect(s.get().taken).toEqual(['upload.worker.streaming:CHUNK->upload.worker.streaming']);
    s.send('EOF');
    expect(s.get().taken).toEqual(['upload.worker.streaming:EOF->upload.worker.committing']);
    finish(s, 'putObject: done');
    s.send('R2_EVENT');
    finish(s, 'pullMessage: done');
    for (const id of s.get().taken) expect(drawn.has(id), id).toBe(true);
    // And it goes when Reset does.
    s.reset();
    expect(s.get().taken).toEqual([]);
  });

  it('gives each edge of a transition with two targets', () => {
    const c = { id: 'm', type: 'parallel', states: { r1: { initial: 'a', states: { a: { on: { GO: { target: ['b', '#m.r2.d'] } } }, b: {} } }, r2: { initial: 'c', states: { c: {}, d: {} } } } };
    const s = sim(c);
    s.send('GO');
    expect(s.get().now).toEqual(['b', 'd']);
    expect([...s.get().taken].sort()).toEqual(['m.r1.a:GO->m.r1.b', 'm.r1.a:GO->m.r2.d']);
  });

  it('tells the two apart when one state has the same event and target twice', () => {
    const c = { id: 'm', initial: 'a', states: { a: { on: { GO: [{ guard: 'first', target: 'b' }, { guard: 'second', target: 'b' }] } }, b: {} } };
    const s = sim(c, { guards: { first: false } });
    s.send('GO');
    expect(s.get().taken).toEqual(['m.a:GO->m.b#1']);
    expect(machineToDraft(createMachine(c as never) as never).edges.find((e) => e.id === 'm.a:GO->m.b#1')?.data?.guard).toBe('second');
  });

  it('tells whoever’s listening, and stops telling them', () => {
    const s = start();
    const heard = vi.fn();
    const off = s.subscribe(heard);
    s.send('CANCEL');
    expect(heard).toHaveBeenCalled();
    heard.mockClear();
    off();
    s.reset();
    expect(heard).not.toHaveBeenCalled();
  });
});

describe('the awkward ones', () => {
  it('an invoke with no stand-in waits, and can be told how it finished', () => {
    const s = sim({ id: 'm', initial: 'a', states: { a: { invoke: { src: 'nobodyWroteThis', onDone: 'b', onError: 'c' } }, b: {}, c: {} } });
    expect(s.get().status).toBe('active');
    expect(s.get().finishes.map((f) => f.label).sort()).toEqual(['nobodyWroteThis: done', 'nobodyWroteThis: error']);
    finish(s, 'nobodyWroteThis: error');
    expect(s.get().now).toEqual(['c']);
  });

  it('an invoke with a stand-in you gave it runs that', async () => {
    const s = sim({ id: 'm', initial: 'a', states: { a: { invoke: { src: 'quick', onDone: 'b' } }, b: {} } }, { actors: { quick: xstate.fromPromise(async () => 7) } });
    const heard = vi.fn();
    s.subscribe(heard);
    expect(s.get().now).toEqual(['a']);
    await vi.waitFor(() => expect(s.get().now).toEqual(['b']), { timeout: 1000 });
    expect(heard).toHaveBeenCalled();
    expect(s.get().log.at(-1)?.what).toBe('quick: done');
  });

  it('a machine that never settles through always is stopped, and says so', () => {
    const s = sim({ id: 'm', initial: 'a', states: { a: { on: { GO: 'x' } }, x: { always: 'y' }, y: { always: 'x' } } });
    expect(s.get().status).toBe('active');
    s.send('GO');
    expect(s.get().status).toBe('error');
    expect(s.get().error).toContain('never settles');
    expect(s.get().events).toEqual([]);
    // And Reset gets it back.
    s.reset();
    expect(s.get().status).toBe('active');
    expect(s.get().now).toEqual(['a']);
  });

  it('one that never settles from the start says so too, and doesn’t hang', () => {
    const s = sim({ id: 'm', initial: 'x', states: { x: { always: 'y' }, y: { always: 'x' } } });
    expect(s.get().status).toBe('error');
    expect(s.get().error).toContain('never settles');
    // Where it got stuck, as far as XState can say.
    expect(s.get().now).toEqual(['x']);
  });

  it('a stand-in that can’t run says so, as it isn’t an actor at all', () => {
    const s = sim({ id: 'm', initial: 'a', states: { a: { invoke: { src: 'broken' } } } }, { actors: { broken: { nothing: true } } });
    expect(s.get().status).toBe('error');
    expect(s.get().now).toEqual(['a']);
    expect(s.get().error).toBeTruthy();
    expect(s.get().events).toEqual([]);
  });

  it('one that never settles once a timer’s fired says so too', () => {
    const s = sim({ id: 'm', initial: 'a', states: { a: { after: { 10: 'x' } }, x: { always: 'y' }, y: { always: 'x' } } });
    s.stepTime();
    expect(s.get().status).toBe('error');
    expect(s.get().error).toContain('never settles');
    expect(s.get().next).toBeNull();
  });

  it('one that goes round on timers of no length can be stepped through, and stops if it’s run', () => {
    const c = { id: 'm', initial: 'a', states: { a: { after: { 0: 'b' } }, b: { after: { 0: 'a' } } } };
    const s = sim(c);
    s.stepTime();
    expect(s.get().now).toEqual(['b']);
    s.stepTime();
    expect(s.get().now).toEqual(['a']);
    expect(s.get().status).toBe('active');
    s.advance(100);
    expect(s.get().status).toBe('error');
    expect(s.get().error).toContain(String(TIMER_LIMIT));
    expect(s.get().next).toBeNull();
    expect(s.get().events).toEqual([]);
    s.reset();
    expect(s.get().status).toBe('active');
    expect(s.get().error).toBeNull();
  });

  it('counts afresh for each event, so a long chain can be gone through many times', () => {
    const states: Record<string, unknown> = {};
    const links = Math.floor(SETTLE_LIMIT * 0.75);
    states.home = { on: { GO: 's0' } };
    for (let i = 0; i < links; i++) states[`s${i}`] = { always: i === links - 1 ? 'home' : `s${i + 1}` };
    const s = sim({ id: 'm', initial: 'home', states });
    s.send('GO');
    s.send('GO');
    s.send('GO');
    expect(s.get().status).toBe('active');
    expect(s.get().now).toEqual(['home']);
  });

  it('a long chain of always that does settle isn’t mistaken for one that doesn’t', () => {
    const states: Record<string, unknown> = { end: {} };
    for (let i = 0; i < 200; i++) states[`s${i}`] = { always: i === 199 ? 'end' : `s${i + 1}` };
    expect(sim({ id: 'm', initial: 's0', states }).get().now).toEqual(['end']);
  });

  it('does nothing once it’s finished', () => {
    const s = sim({ id: 'm', initial: 'a', states: { a: { type: 'final' } } });
    expect(s.get().status).toBe('done');
    s.send('GO');
    s.stepTime();
    s.advance(100);
    s.setGuard('x', true);
    expect(s.get().log).toHaveLength(2);
    expect(s.get().time).toBe(0);
  });

  it('keeps its log to a limit', () => {
    const s = sim({ id: 'm', initial: 'a', states: { a: { on: { GO: 'a' } } } });
    for (let i = 0; i < 300; i++) s.send('GO');
    expect(s.get().log.length).toBe(200);
    expect(s.get().log.at(-1)?.id).toBe(300);
  });

  it('keeps the same lists while nothing’s moved, so that what’s lit needn’t be drawn again', () => {
    const s = sim({ id: 'm', initial: 'a', states: { a: { after: { 100: 'b' } }, b: {} } });
    const { active, now, taken } = s.get();
    s.advance(10);
    expect(s.get().time).toBe(10);
    expect(s.get().active).toBe(active);
    expect(s.get().now).toBe(now);
    expect(s.get().taken).toBe(taken);
    s.advance(100);
    expect(s.get().active).not.toBe(active);
  });

  it('stops for good', () => {
    const s = sim({ id: 'm', initial: 'a', states: { a: { on: { GO: 'b' }, after: { 100: 'b' } }, b: {} } });
    s.stop();
    expect(s.get().now).toEqual(['a']);
    s.send('GO');
    s.stepTime();
    expect(s.get().now).toEqual(['a']);
  });
});
