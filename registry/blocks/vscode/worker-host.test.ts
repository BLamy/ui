import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HostMessage, RuntimeMessage } from './almostnode/protocol';
import { createWorkerHost, sanitizeBatch, type WorkerHostOptions, type WorkerTransport } from './almostnode/worker-host';

/* A Worker that does what it's told, when it's told. */
function fakeWorker(isolation: WorkerTransport['isolation'] = 'opaque-origin') {
  const sent: HostMessage[] = [];
  const transport: WorkerTransport = {
    isolation,
    post: (message) => { sent.push(message); },
    terminate: vi.fn(),
    onmessage: null,
  };
  return { transport, sent, say: (message: RuntimeMessage) => transport.onmessage?.(message) };
}

function setup(options: Partial<WorkerHostOptions> = {}) {
  const workers: Array<ReturnType<typeof fakeWorker>> = [];
  const spawnOptions: unknown[] = [];
  const onFiles = vi.fn();
  const host = createWorkerHost({
    root: '/p',
    spawn: async (o) => {
      spawnOptions.push(o);
      const worker = fakeWorker();
      workers.push(worker);
      return worker.transport;
    },
    snapshot: () => ({ files: [{ path: '/p/a.js', data: 'a' }], dirs: ['/p'] }),
    onFiles,
    killAfter: 50,
    ...options,
  });
  const ready = async () => {
    await Promise.resolve();
    await Promise.resolve();
    workers.at(-1)?.say({ type: 'ready', origin: 'null' });
  };
  return { host, workers, onFiles, ready, spawnOptions };
}

afterEach(() => { vi.useRealTimers(); });

describe('createWorkerHost', () => {
  it('starts nothing until told, then gives the Worker the files and sessions', async () => {
    const { host, workers, ready } = setup();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    expect(workers).toHaveLength(0);
    expect(host.status).toBe('off');
    host.start();
    expect(host.status).toBe('starting');
    await ready();
    expect(host.status).toBe('ready');
    expect(host.isolation).toBe('opaque-origin');
    expect(workers[0].sent[0]).toMatchObject({ type: 'init', root: '/p', files: [{ path: '/p/a.js' }], sessions: [{ session: 's1', cwd: '/p', cols: 80 }] });
  });

  it('holds messages until the Worker is ready', async () => {
    const { host, workers, ready } = setup();
    host.start();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    const run = host.run('s1', 'ls', () => {});
    await Promise.resolve();
    await Promise.resolve();
    expect(workers[0].sent.map((m) => m.type)).toEqual(['init']);
    await ready();
    expect(workers[0].sent.map((m) => m.type)).toEqual(['init', 'open-session', 'run']);
    void run;
  });

  it('batches output, acknowledges it, and finishes a run with its state', async () => {
    const { host, workers, ready } = setup();
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    const out: string[] = [];
    const run = host.run('s1', 'ls', (data) => out.push(data));
    const id = (workers[0].sent.find((m) => m.type === 'run') as { id: number }).id;
    workers[0].say({ type: 'output', id, stream: 'stdout', data: 'a' });
    workers[0].say({ type: 'output', id, stream: 'stderr', data: 'b' });
    workers[0].say({ type: 'done', id, exitCode: 3, cwd: '/p/src', env: { X: '1' } });
    expect(out).toEqual(['ab']);
    expect(workers[0].sent.at(-1)).toEqual({ type: 'ack', chars: 2 });
    await expect(run.done).resolves.toEqual({ exitCode: 3, cwd: '/p/src' });
  });

  it('remembers a session\'s folder for the next Worker', async () => {
    const { host, workers, ready } = setup();
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    host.run('s1', 'cd src', () => {});
    const id = (workers[0].sent.find((m) => m.type === 'run') as { id: number }).id;
    workers[0].say({ type: 'done', id, exitCode: 0, cwd: '/p/src', env: { FOO: 'bar' } });
    host.resizeSession('s1', 40, 10);
    host.restart();
    expect(workers[0].transport.terminate).toHaveBeenCalled();
    await ready();
    expect(workers[1].sent[0]).toMatchObject({ type: 'init', sessions: [{ session: 's1', cwd: '/p/src', env: { FOO: 'bar' }, cols: 40, rows: 10 }] });
  });

  it('Ctrl-C asks first, and replaces a Worker that doesn\'t answer', async () => {
    const { host, workers, ready } = setup();
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    host.openSession('s2', { cwd: '/p', cols: 80, rows: 24 });
    const stuck = host.run('s1', 'spin', () => {});
    const other = host.run('s2', 'other', () => {});
    stuck.abort();
    expect(workers[0].sent.some((m) => m.type === 'abort')).toBe(true);
    await expect(stuck.done).resolves.toMatchObject({ exitCode: 130, restarted: 'blocked' });
    await expect(other.done).resolves.toMatchObject({ exitCode: 137, restarted: 'other' });
    expect(workers[0].transport.terminate).toHaveBeenCalled();
    expect(host.status).toBe('restarting');
    await ready();
    expect(host.status).toBe('ready');
  });

  it('a command that stops when asked keeps its Worker until it\'s idle, then gets a clean one', async () => {
    const { host, workers, ready } = setup();
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    const run = host.run('s1', 'timers', () => {});
    run.abort();
    const id = (workers[0].sent.find((m) => m.type === 'run') as { id: number }).id;
    workers[0].say({ type: 'done', id, exitCode: 130, cwd: '/p', env: {} });
    await expect(run.done).resolves.toEqual({ exitCode: 130, cwd: '/p' });
    // It may have left timers going, and there's no reaching those but to replace it.
    expect(workers[0].transport.terminate).toHaveBeenCalled();
    await ready();
    expect(workers).toHaveLength(2);
  });

  it('ignores what an old Worker says', async () => {
    const out: string[] = [];
    const { host, workers, ready, onFiles } = setup();
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    host.run('s1', 'x', (data) => out.push(data));
    const old = workers[0];
    const { onmessage } = old.transport;
    host.restart();
    await ready();
    onmessage?.({ type: 'fs', batch: { changed: [{ path: '/p/z', data: 'z' }], removed: [], dirs: [], removedDirs: [] } });
    onmessage?.({ type: 'output', id: 1, stream: 'stdout', data: 'late' });
    expect(onFiles).not.toHaveBeenCalled();
    expect(out).toEqual([]);
  });

  it('drops a change the Worker reports to a file it hasn\'t caught up on', async () => {
    const { host, workers, ready, onFiles } = setup();
    host.start();
    await ready();
    host.write('/p/a.js', 'mine');
    const write = workers[0].sent.find((m) => m.type === 'write') as { seq: number };
    workers[0].say({ type: 'fs', batch: { changed: [{ path: '/p/a.js', data: 'older' }], removed: [], dirs: [], removedDirs: [] } });
    expect(onFiles).toHaveBeenLastCalledWith({ changed: [], removed: [], dirs: [], removedDirs: [] });
    workers[0].say({ type: 'applied', seq: write.seq });
    workers[0].say({ type: 'fs', batch: { changed: [{ path: '/p/a.js', data: 'newer' }], removed: [], dirs: [], removedDirs: [] } });
    expect(onFiles.mock.lastCall?.[0].changed).toEqual([{ path: '/p/a.js', data: 'newer' }]);
  });

  it('says when it can\'t start, and answers commands with that', async () => {
    const host = createWorkerHost({
      root: '/p',
      spawn: async () => { throw new Error('no worker'); },
      snapshot: () => ({ files: [], dirs: [] }),
      onFiles: () => {},
    });
    host.start();
    await new Promise((resolve) => { setTimeout(resolve); });
    expect(host.status).toBe('failed');
    expect(host.error).toBe('no worker');
    await expect(host.run('s', 'ls', () => {}).done).resolves.toMatchObject({ exitCode: 1, restarted: 'other' });
  });

  it('tries an ordinary Worker when an isolated one can\'t finish starting', async () => {
    const { host, workers, spawnOptions } = setup();
    host.start();
    await Promise.resolve();
    await Promise.resolve();
    workers[0].say({ type: 'failed', message: 'refused' });
    await Promise.resolve();
    await Promise.resolve();
    expect(workers).toHaveLength(2);
    expect(spawnOptions.at(-1)).toEqual({ sameOriginOnly: true });
  });

  it('tells a run when a script starts reading its input', async () => {
    const { host, workers, ready } = setup();
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    const seen: boolean[] = [];
    host.run('s1', 'x', () => {}, (reading) => seen.push(reading));
    const id = (workers[0].sent.find((m) => m.type === 'run') as { id: number }).id;
    workers[0].say({ type: 'reading', id, reading: true });
    expect(seen).toEqual([true]);
  });
});

describe('sanitizeBatch: what comes from the Worker is untrusted', () => {
  it('keeps what is well formed', () => {
    const bytes = new Uint8Array([1]);
    expect(sanitizeBatch({ changed: [{ path: '/a', data: 'x' }, { path: '/b', data: bytes }], removed: ['/c'], dirs: ['/d'], removedDirs: [] }))
      .toEqual({ changed: [{ path: '/a', data: 'x' }, { path: '/b', data: bytes }], removed: ['/c'], dirs: ['/d'], removedDirs: [] });
  });

  it('drops the rest', () => {
    expect(sanitizeBatch(null)).toBeNull();
    expect(sanitizeBatch({ changed: 'x' })).toBeNull();
    expect(sanitizeBatch({ changed: [{ path: 'relative', data: 'x' }, { path: '/a', data: 3 }, null], removed: [1, '/ok'], dirs: [{}], removedDirs: [] }))
      .toEqual({ changed: [], removed: ['/ok'], dirs: [], removedDirs: [] });
  });
});
