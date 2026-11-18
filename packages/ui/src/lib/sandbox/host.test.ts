import { afterEach, describe, expect, it, vi } from 'vitest';
import { SandboxError } from './error';
import { createSandboxHost, sanitizeBatch, type SandboxHostOptions, type SandboxTransport } from './host';
import type { SandboxFetchRequest, SandboxFetchResponse, SandboxIsolation } from './model';
import type { HostMessage, RuntimeMessage } from './protocol';

/* A Worker that does what it's told, when it's told. */
function fakeWorker(isolation: SandboxIsolation = 'opaque-origin') {
  const sent: HostMessage[] = [];
  const transport: SandboxTransport = {
    isolation,
    post: (message) => { sent.push(message); },
    terminate: vi.fn(),
    onmessage: null,
  };
  return { transport, sent, say: (message: RuntimeMessage) => transport.onmessage?.(message) };
}

function setup(options: Partial<SandboxHostOptions> = {}) {
  const workers: Array<ReturnType<typeof fakeWorker>> = [];
  const spawnOptions: unknown[] = [];
  const onFiles = vi.fn();
  const host = createSandboxHost({
    root: '/p',
    spawn: async (o) => {
      spawnOptions.push(o);
      const worker = fakeWorker(o?.sameOrigin ? 'same-origin' : 'opaque-origin');
      workers.push(worker);
      return worker.transport;
    },
    fallback: false,
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
  const handlers = (out: string[] = []) => ({ onOutput: (data: string) => { out.push(data); } });
  return { host, workers, onFiles, ready, spawnOptions, handlers };
}

const idOf = (worker: ReturnType<typeof fakeWorker>) => (worker.sent.find((m) => m.type === 'run') as { id: number }).id;

afterEach(() => { vi.useRealTimers(); });

describe('requests the Worker hands to the page', () => {
  const request: SandboxFetchRequest = { url: 'http://notes.demo-tailnet.ts.net/', method: 'GET', headers: [], body: null, redirect: 'follow' };
  const response: SandboxFetchResponse = { status: 200, statusText: 'OK', headers: [], body: new TextEncoder().encode('hello') };

  it('answers with the page\'s handler, and with its refusal', async () => {
    const onFetch = vi.fn(async (asked: SandboxFetchRequest) => {
      if (!asked.url.includes('demo-tailnet')) throw new Error('Not allowed.');
      return response;
    });
    const { host, workers, ready } = setup({ onFetch });
    host.start();
    await ready();
    workers[0].say({ type: 'fetch', id: 1, request });
    await vi.waitFor(() => expect(workers[0].sent).toContainEqual({ type: 'fetch-result', id: 1, response }));
    workers[0].say({ type: 'fetch', id: 2, request: { ...request, url: 'https://example.com/' } });
    await vi.waitFor(() => expect(workers[0].sent.at(-1)).toEqual({ type: 'fetch-result', id: 2, error: 'Not allowed.' }));
    host.dispose();
  });

  it('refuses a request that is not well formed, and every request when the page answers none', async () => {
    const onFetch = vi.fn().mockResolvedValue(response);
    const { host, workers, ready } = setup({ onFetch });
    host.start();
    await ready();
    workers[0].say({ type: 'fetch', id: 1, request: { ...request, headers: [['only-a-name']] } as never });
    workers[0].say({ type: 'fetch', id: 2, request: { ...request, body: 'text' } as never });
    expect(workers[0].sent.filter((m) => m.type === 'fetch-result')).toEqual([
      { type: 'fetch-result', id: 1, error: expect.any(String) },
      { type: 'fetch-result', id: 2, error: expect.any(String) },
    ]);
    expect(onFetch).not.toHaveBeenCalled();
    host.dispose();

    const none = setup();
    none.host.start();
    await none.ready();
    none.workers[0].say({ type: 'fetch', id: 1, request });
    await vi.waitFor(() => expect(none.workers[0].sent.at(-1)).toMatchObject({ type: 'fetch-result', id: 1, error: expect.stringContaining('answers no requests') }));
  });

  it('cancels network work on restart and never delivers old replies to the replacement Worker', async () => {
    let finish!: (response: SandboxFetchResponse) => void;
    let signal!: AbortSignal;
    const { host, workers, ready } = setup({ onFetch: (_request, active) => { signal = active; return new Promise((resolve) => { finish = resolve; }); } });
    host.start();
    await ready();
    workers[0].say({ type: 'fetch', id: 1, request });
    await Promise.resolve();
    host.restart();
    await ready();
    expect(signal.aborted).toBe(true);
    finish(response);
    await Promise.resolve();
    expect(workers.flatMap((worker) => worker.sent).some((message) => message.type === 'fetch-result')).toBe(false);
    host.dispose();
  });
});

describe('createSandboxHost', () => {
  it('starts nothing until told, then gives the Worker the files and sessions', async () => {
    const { host, workers, ready } = setup();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    expect(workers).toHaveLength(0);
    expect(host.status).toBe('idle');
    expect(host.isolation).toBeNull();
    host.start();
    expect(host.status).toBe('loading');
    await ready();
    expect(host.status).toBe('ready');
    expect(host.isolation).toBe('opaque-origin');
    expect(workers[0].sent[0]).toMatchObject({ type: 'init', root: '/p', files: [{ path: '/p/a.js' }], sessions: [{ session: 's1', cwd: '/p', cols: 80 }] });
  });

  it('holds messages until the Worker is ready', async () => {
    const { host, workers, ready, handlers } = setup();
    host.start();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    const run = host.run('s1', 'ls', handlers());
    await Promise.resolve();
    await Promise.resolve();
    expect(workers[0].sent.map((m) => m.type)).toEqual(['init']);
    await ready();
    expect(workers[0].sent.map((m) => m.type)).toEqual(['init', 'open-session', 'run']);
    void run;
  });

  it('batches output by stream, acknowledges it, and finishes a run with its state', async () => {
    const { host, workers, ready } = setup();
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    const out: Array<[string, string]> = [];
    const run = host.run('s1', 'ls', { onOutput: (data, stream) => out.push([stream, data]) });
    const id = idOf(workers[0]);
    workers[0].say({ type: 'output', id, stream: 'stdout', data: 'a' });
    workers[0].say({ type: 'output', id, stream: 'stdout', data: 'b' });
    workers[0].say({ type: 'output', id, stream: 'stderr', data: 'c' });
    workers[0].say({ type: 'done', id, exitCode: 3, cwd: '/p/src', env: { X: '1' } });
    expect(out).toEqual([['stdout', 'ab'], ['stderr', 'c']]);
    expect(workers[0].sent.at(-1)).toEqual({ type: 'ack', chars: 3 });
    await expect(run.done).resolves.toEqual({ exitCode: 3, cwd: '/p/src' });
  });

  it('remembers a session\'s folder for the next Worker', async () => {
    const { host, workers, ready, handlers } = setup();
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    host.run('s1', 'cd src', handlers());
    workers[0].say({ type: 'done', id: idOf(workers[0]), exitCode: 0, cwd: '/p/src', env: { FOO: 'bar' } });
    host.resizeSession('s1', 40, 10);
    host.restart();
    expect(workers[0].transport.terminate).toHaveBeenCalled();
    await ready();
    expect(workers[1].sent[0]).toMatchObject({ type: 'init', sessions: [{ session: 's1', cwd: '/p/src', env: { FOO: 'bar' }, cols: 40, rows: 10 }] });
  });

  it('Ctrl-C asks first, and replaces a Worker that doesn\'t answer', async () => {
    const { host, workers, ready, handlers } = setup();
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    host.openSession('s2', { cwd: '/p', cols: 80, rows: 24 });
    const stuck = host.run('s1', 'spin', handlers());
    const other = host.run('s2', 'other', handlers());
    stuck.abort();
    expect(workers[0].sent.some((m) => m.type === 'abort')).toBe(true);
    await expect(stuck.done).resolves.toMatchObject({ exitCode: 130, interrupted: 'unresponsive' });
    await expect(other.done).resolves.toMatchObject({ exitCode: 137, interrupted: 'restarted' });
    expect(workers[0].transport.terminate).toHaveBeenCalled();
    expect(host.status).toBe('restarting');
    await ready();
    expect(host.status).toBe('ready');
  });

  it('a command that stops when asked keeps its Worker until it\'s idle, then gets a clean one', async () => {
    const { host, workers, ready, handlers } = setup();
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    const run = host.run('s1', 'timers', handlers());
    run.abort();
    workers[0].say({ type: 'done', id: idOf(workers[0]), exitCode: 130, cwd: '/p', env: {} });
    await expect(run.done).resolves.toEqual({ exitCode: 130, cwd: '/p' });
    // It may have left timers going, and there's no reaching those but to replace it.
    expect(workers[0].transport.terminate).toHaveBeenCalled();
    await ready();
    expect(workers).toHaveLength(2);
  });

  it('ignores what an old Worker says', async () => {
    const out: string[] = [];
    const { host, workers, ready, onFiles, handlers } = setup();
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    host.run('s1', 'x', handlers(out));
    const old = workers[0];
    const { onmessage } = old.transport;
    host.restart();
    await ready();
    onmessage?.({ type: 'fs', batch: { changed: [{ path: '/p/z', data: 'z' }], removed: [], dirs: [], removedDirs: [] } });
    onmessage?.({ type: 'output', id: 1, stream: 'stdout', data: 'late' });
    expect(onFiles).not.toHaveBeenCalled();
    expect(out).toEqual([]);
  });

  it('drops a change the Worker reports to a file it hasn\'t caught up on, and settles the change when it has', async () => {
    const { host, workers, ready, onFiles } = setup();
    host.start();
    await ready();
    let settled = false;
    const written = host.write('/p/a.js', 'mine').then(() => { settled = true; });
    const write = workers[0].sent.find((m) => m.type === 'write') as { seq: number };
    workers[0].say({ type: 'fs', batch: { changed: [{ path: '/p/a.js', data: 'older' }], removed: [], dirs: [], removedDirs: [] } });
    expect(onFiles).toHaveBeenLastCalledWith({ changed: [], removed: [], dirs: [], removedDirs: [] });
    await Promise.resolve();
    expect(settled).toBe(false);
    workers[0].say({ type: 'applied', seq: write.seq });
    await written;
    workers[0].say({ type: 'fs', batch: { changed: [{ path: '/p/a.js', data: 'newer' }], removed: [], dirs: [], removedDirs: [] } });
    expect(onFiles.mock.lastCall?.[0].changed).toEqual([{ path: '/p/a.js', data: 'newer' }]);
  });

  it('rejects a change the Worker\'s disk refused', async () => {
    const { host, workers, ready } = setup();
    host.start();
    await ready();
    const made = host.mkdir('/p/a.js/x');
    workers[0].say({ type: 'applied', seq: (workers[0].sent.at(-1) as { seq: number }).seq, error: 'ENOTDIR' });
    await expect(made).rejects.toMatchObject({ name: 'SandboxError', code: 'files', message: 'ENOTDIR' });
  });

  it('settles a change at once while there is no Worker, when one is replaced, and never after dispose', async () => {
    const { host, workers, ready } = setup();
    await expect(host.write('/p/early.js', '')).resolves.toBeUndefined();
    host.start();
    await ready();
    const pending = host.remove('/p/a.js');
    host.restart();
    await expect(pending).resolves.toBeUndefined();
    // The next Worker starts from the files as they are: nothing left over is sent to it twice.
    await ready();
    expect(workers[1].sent.map((m) => m.type)).toEqual(['init']);
    const last = host.rename('/p/a.js', '/p/b.js');
    host.dispose();
    await expect(last).rejects.toMatchObject({ code: 'disposed' });
    await expect(host.write('/p/late.js', '')).rejects.toMatchObject({ code: 'disposed' });
  });

  it('says when it can\'t start, and answers commands with that', async () => {
    const host = createSandboxHost({
      root: '/p',
      spawn: async () => { throw new SandboxError('isolation', 'no origin of its own'); },
      fallback: false,
      snapshot: () => ({ files: [], dirs: [] }),
      onFiles: () => {},
    });
    host.start();
    const running = host.run('s', 'ls', { onOutput: () => {} });
    await new Promise((resolve) => { setTimeout(resolve); });
    expect(host.status).toBe('failed');
    expect(host.error).toMatchObject({ code: 'isolation', message: 'no origin of its own' });
    await expect(running.done).resolves.toMatchObject({ exitCode: 1, interrupted: 'unavailable' });
    await expect(host.run('s', 'ls', { onOutput: () => {} }).done).resolves.toMatchObject({ exitCode: 1, interrupted: 'unavailable' });
  });

  it('fails when an isolated Worker can\'t finish starting, and says what the host must serve', async () => {
    const { host, workers } = setup();
    host.start();
    await Promise.resolve();
    await Promise.resolve();
    workers[0].say({ type: 'failed', message: 'refused' });
    await Promise.resolve();
    await Promise.resolve();
    expect(workers).toHaveLength(1);
    expect(workers[0].transport.terminate).toHaveBeenCalled();
    expect(host.status).toBe('failed');
    expect(host.error).toMatchObject({ code: 'runtime', message: expect.stringContaining('Access-Control-Allow-Origin') });
  });

  it('tries an ordinary Worker when an isolated one can\'t finish starting, only where the caller allowed it', async () => {
    const { host, workers, spawnOptions, ready } = setup({ fallback: true });
    host.start();
    await Promise.resolve();
    await Promise.resolve();
    workers[0].say({ type: 'failed', message: 'refused' });
    await ready();
    expect(workers).toHaveLength(2);
    expect(spawnOptions.at(-1)).toEqual({ sameOrigin: true });
    expect(host.status).toBe('ready');
    expect(host.isolation).toBe('same-origin');
  });

  it('tells a run when a script starts reading its input', async () => {
    const { host, workers, ready } = setup();
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    const seen: boolean[] = [];
    host.run('s1', 'x', { onOutput: () => {}, onReading: (reading) => seen.push(reading) });
    workers[0].say({ type: 'reading', id: idOf(workers[0]), reading: true });
    expect(seen).toEqual([true]);
  });

  it('tells its listeners once that it is gone, and ends what was running', async () => {
    const { host, workers, ready, handlers } = setup();
    const seen: string[] = [];
    host.subscribe(() => seen.push(host.status));
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    const run = host.run('s1', 'x', handlers());
    host.dispose();
    host.dispose();
    expect(seen.filter((status) => status === 'disposed')).toEqual(['disposed']);
    expect(workers[0].transport.terminate).toHaveBeenCalledOnce();
    await expect(run.done).resolves.toMatchObject({ exitCode: 137, interrupted: 'unavailable' });
    host.start();
    expect(host.status).toBe('disposed');
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
