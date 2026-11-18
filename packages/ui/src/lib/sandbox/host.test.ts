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
    hostFetch: true,
    post: (message) => { sent.push(message); },
    terminate: vi.fn(),
    onmessage: null,
    onerror: null,
  };
  return { transport, sent, say: (message: RuntimeMessage) => transport.onmessage?.(message), crash: (message: string) => transport.onerror?.(message) };
}

function setup(options: Partial<SandboxHostOptions> = {}) {
  const workers: Array<ReturnType<typeof fakeWorker>> = [];
  const spawnOptions: unknown[] = [];
  const onFiles = vi.fn();
  const host = createSandboxHost({
    root: '/p',
    spawn: async (o) => {
      spawnOptions.push(o);
      const worker = fakeWorker(o?.only ?? 'opaque-origin');
      workers.push(worker);
      return worker.transport;
    },
    isolation: 'opaque-origin',
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
  /** The Worker has been started and given the files; it has not said it is ready. */
  const spawned = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  return { host, workers, onFiles, ready, spawned, spawnOptions, handlers };
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

  it('hands the handler a new object of the five fields, with the address as the browser reads it', async () => {
    const onFetch = vi.fn().mockResolvedValue(response);
    const { host, workers, ready } = setup({ onFetch });
    host.start();
    await ready();
    const headers: Array<[string, string]> = [['x-a', 'b']];
    const posted = { ...request, url: ' HTTP://Notes.Demo-Tailnet.ts.net/a/../b ', headers, credentials: 'include', mode: 'no-cors', referrer: 'x', signal: {} };
    workers[0].say({ type: 'fetch', id: 1, request: posted as never });
    await vi.waitFor(() => expect(onFetch).toHaveBeenCalled());
    const handed = onFetch.mock.calls[0][0] as SandboxFetchRequest;
    expect(handed).toEqual({ url: 'http://notes.demo-tailnet.ts.net/b', method: 'GET', headers: [['x-a', 'b']], body: null, redirect: 'follow' });
    expect(Object.keys(handed).sort()).toEqual(['body', 'headers', 'method', 'redirect', 'url']);
    expect(handed).not.toBe(posted);
    expect(handed.headers).not.toBe(headers);
    expect(handed.headers[0]).not.toBe(headers[0]);
    host.dispose();
  });

  it('refuses an address that is not absolute http or https', async () => {
    const onFetch = vi.fn().mockResolvedValue(response);
    const { host, workers, ready } = setup({ onFetch });
    host.start();
    await ready();
    const urls = ['/api/me', 'api/me', '//notes.internal/', '', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/plain,x', 'blob:https://app.example/1', 'ws://notes.internal/', 'about:blank'];
    urls.forEach((url, i) => workers[0].say({ type: 'fetch', id: i + 1, request: { ...request, url } }));
    expect(workers[0].sent.filter((m) => m.type === 'fetch-result')).toEqual(urls.map((_, i) => ({ type: 'fetch-result', id: i + 1, error: expect.stringContaining('http') })));
    await Promise.resolve();
    expect(onFetch).not.toHaveBeenCalled();
    host.dispose();
  });

  it('takes no request from a Worker whose file hands none to the page', async () => {
    const onFetch = vi.fn().mockResolvedValue(response);
    const workers: Array<ReturnType<typeof fakeWorker>> = [];
    const host = createSandboxHost({
      root: '/p',
      spawn: async () => {
        const worker = fakeWorker();
        worker.transport.hostFetch = false;
        workers.push(worker);
        return worker.transport;
      },
      isolation: 'opaque-origin', fallback: false, snapshot: () => ({ files: [], dirs: [] }), onFiles: () => {}, onFetch,
    });
    host.start();
    await Promise.resolve();
    await Promise.resolve();
    workers[0].say({ type: 'ready', origin: 'null' });
    workers[0].say({ type: 'fetch', id: 1, request });
    await new Promise((resolve) => { setTimeout(resolve); });
    expect(onFetch).not.toHaveBeenCalled();
    expect(workers[0].sent.map((m) => m.type)).toEqual(['init']);
    host.dispose();
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

  it('drops what the Worker reports about a path the page has just changed, until the Worker has caught up', async () => {
    const { host, workers, ready, onFiles } = setup();
    host.start();
    await ready();
    host.write('/p/a.js', 'mine');
    host.mkdir('/p/made');
    const [write, mkdir] = workers[0].sent.filter((m) => m.type === 'write' || m.type === 'mkdir') as Array<{ seq: number }>;
    // A report from before the Worker had the change: an older content, and a removal.
    workers[0].say({ type: 'fs', batch: { changed: [{ path: '/p/a.js', data: 'older' }, { path: '/p/b.js', data: 'b' }], removed: [], dirs: [], removedDirs: [] } });
    expect(onFiles).toHaveBeenLastCalledWith({ changed: [{ path: '/p/b.js', data: 'b' }], removed: [], dirs: [], removedDirs: [] });
    workers[0].say({ type: 'fs', batch: { changed: [], removed: ['/p/a.js'], dirs: [], removedDirs: ['/p/made', '/p'] } });
    expect(onFiles).toHaveBeenLastCalledWith({ changed: [], removed: [], dirs: [], removedDirs: [] });
    workers[0].say({ type: 'applied', seq: write.seq });
    workers[0].say({ type: 'applied', seq: mkdir.seq, error: 'EEXIST' });
    workers[0].say({ type: 'fs', batch: { changed: [{ path: '/p/a.js', data: 'newer' }], removed: [], dirs: [], removedDirs: ['/p/made'] } });
    expect(onFiles).toHaveBeenLastCalledWith({ changed: [{ path: '/p/a.js', data: 'newer' }], removed: [], dirs: [], removedDirs: ['/p/made'] });
  });

  it('tells no Worker of a change while there is none, and a new Worker nothing it was started with', async () => {
    const { host, workers, ready, spawned } = setup();
    host.write('/p/early.js', '');
    host.start();
    // Made while the Worker is being started: it is in the files the Worker is started with.
    host.write('/p/starting.js', '');
    await spawned();
    // Made once the Worker has its files: it has to be told.
    host.rename('/p/starting.js', '/p/started.js');
    await ready();
    expect(workers[0].sent.map((m) => m.type)).toEqual(['init', 'rename']);
    host.remove('/p/a.js');
    host.restart();
    await ready();
    // The next Worker starts from the files as they are: nothing left over is sent to it twice.
    expect(workers[1].sent.map((m) => m.type)).toEqual(['init']);
    host.dispose();
    host.write('/p/late.js', '');
    expect(workers[1].sent.map((m) => m.type)).toEqual(['init']);
  });

  it('says when it can\'t start, and answers commands with that', async () => {
    const host = createSandboxHost({
      root: '/p',
      spawn: async () => { throw new SandboxError('isolation', 'no origin of its own'); },
      isolation: 'opaque-origin',
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
    expect(workers[0].transport.terminate).toHaveBeenCalled();
    expect(spawnOptions.map((o) => (o as { only?: string } | undefined)?.only)).toEqual([undefined, 'same-origin']);
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
  it('drops a path that is not written the one way a path is, and the root', () => {
    const batch = {
      changed: ['/project/../../etc/passwd', '/project/a/', '/', '/a//b', '/a/./b', '/a/..', '/ok/file.txt'].map((path) => ({ path, data: 'x' })),
      removed: ['/a/../b', '/', '/ok'],
      dirs: ['/', '/d/', '/ok/dir'],
      removedDirs: ['/', '/x/.', '/ok/dir'],
    };
    expect(sanitizeBatch(batch)).toEqual({ changed: [{ path: '/ok/file.txt', data: 'x' }], removed: ['/ok'], dirs: ['/ok/dir'], removedDirs: ['/ok/dir'] });
  });

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

/* ── The one promise: where the code runs ── */

describe('when a Worker of the page\'s origin may be given the files', () => {
  it('a Worker that is ready cannot say it failed to start: nothing is replaced, with or without fallback', async () => {
    for (const fallback of [true, false]) {
      const { host, workers, ready, spawnOptions } = setup({ fallback });
      host.start();
      await ready();
      workers[0].say({ type: 'failed', message: 'x' });
      await Promise.resolve();
      await Promise.resolve();
      expect(host.status).toBe('ready');
      expect(host.error).toBeNull();
      expect(host.isolation).toBe('opaque-origin');
      expect(workers).toHaveLength(1);
      expect(spawnOptions).toHaveLength(1);
      expect(workers[0].transport.terminate).not.toHaveBeenCalled();
    }
  });

  it('once a Worker has been ready, every later one is asked for the same isolation and nothing else', async () => {
    const { host, workers, ready, spawned, spawnOptions } = setup({ fallback: true });
    host.start();
    await ready();
    host.restart();
    await spawned();
    expect((spawnOptions[1] as { only?: string }).only).toBe('opaque-origin');
    // It can't finish starting: after code may have run isolated, that is a failure, not a reason to fall back.
    workers[1].say({ type: 'failed', message: 'refused' });
    await spawned();
    expect(workers).toHaveLength(2);
    expect(host.status).toBe('failed');
    expect(host.error).toMatchObject({ code: 'runtime' });
    expect(host.isolation).toBeNull();
    // And so on, for as long as the sandbox lives.
    host.restart();
    await ready();
    expect((spawnOptions[2] as { only?: string }).only).toBe('opaque-origin');
    expect(host.isolation).toBe('opaque-origin');
  });

  it('a sandbox that fell back asks for the page\'s origin from then on', async () => {
    const { host, workers, ready, spawned, spawnOptions } = setup({ fallback: true });
    host.start();
    await spawned();
    workers[0].say({ type: 'failed', message: 'refused' });
    await ready();
    expect(host.isolation).toBe('same-origin');
    host.restart();
    expect(host.isolation).toBe('same-origin');
    await ready();
    expect(spawnOptions.map((o) => (o as { only?: string } | undefined)?.only)).toEqual([undefined, 'same-origin', 'same-origin']);
  });

  it('falls back once for a start: a same-origin Worker that fails too is the end of it', async () => {
    const { host, workers, spawned } = setup({ fallback: true });
    host.start();
    await spawned();
    workers[0].say({ type: 'failed', message: 'refused' });
    await spawned();
    workers[1].say({ type: 'failed', message: 'broken' });
    await spawned();
    expect(workers).toHaveLength(2);
    expect(host.status).toBe('failed');
    expect(host.error).toMatchObject({ code: 'runtime', message: 'The runtime could not start: broken' });
    // Nothing was ever ready, so the next try starts over: isolated first.
    host.restart();
    await spawned();
    expect(workers).toHaveLength(3);
    expect(workers[2].transport.isolation).toBe('opaque-origin');
  });

  it('never gives the files to a Worker of the page\'s origin it was not allowed, whatever the spawner returns', async () => {
    const workers: Array<ReturnType<typeof fakeWorker>> = [];
    const make = (options: Partial<SandboxHostOptions>, kinds: SandboxIsolation[]) => createSandboxHost({
      root: '/p',
      spawn: async () => {
        const worker = fakeWorker(kinds[Math.min(workers.length, kinds.length - 1)]);
        workers.push(worker);
        return worker.transport;
      },
      isolation: 'opaque-origin', fallback: false, snapshot: () => ({ files: [], dirs: [] }), onFiles: () => {}, ...options,
    });
    // Not allowed at all.
    const strict = make({}, ['same-origin']);
    strict.start();
    await new Promise((resolve) => { setTimeout(resolve); });
    expect(strict.status).toBe('failed');
    expect(strict.error).toMatchObject({ code: 'isolation' });
    expect(workers[0].sent).toEqual([]);
    expect(workers[0].transport.terminate).toHaveBeenCalled();
    // Allowed to fall back, but code has run isolated since.
    workers.length = 0;
    const lenient = make({ fallback: true }, ['opaque-origin', 'same-origin']);
    lenient.start();
    await Promise.resolve();
    await Promise.resolve();
    workers[0].say({ type: 'ready', origin: 'null' });
    lenient.restart();
    await new Promise((resolve) => { setTimeout(resolve); });
    expect(lenient.status).toBe('failed');
    expect(lenient.error).toMatchObject({ code: 'isolation' });
    expect(lenient.isolation).toBeNull();
    expect(workers[1].sent).toEqual([]);
    expect(workers[1].transport.terminate).toHaveBeenCalled();
  });

  it('says where the code runs from the moment a Worker is ready, and nowhere once it has failed', async () => {
    const seen: Array<[string, string | null]> = [];
    const { host, workers, spawned } = setup();
    host.subscribe(() => seen.push([host.status, host.isolation]));
    host.start();
    await spawned();
    // A Worker has been chosen, but it may yet fail to start: nothing runs anywhere.
    expect(host.isolation).toBeNull();
    workers[0].say({ type: 'ready', origin: 'null' });
    host.restart();
    await spawned();
    workers[1].say({ type: 'failed', message: 'refused' });
    expect(seen).toEqual([['loading', null], ['ready', 'opaque-origin'], ['restarting', 'opaque-origin'], ['failed', null]]);
  });
});

describe('a start that goes wrong, or is no longer wanted', () => {
  it('gives the runtime a limit to start in, and fails when it says nothing', async () => {
    vi.useFakeTimers();
    const { host, workers, spawned } = setup({ startTimeout: 5000 });
    const run = host.run('s', 'ls', { onOutput: () => {} });
    host.start();
    await spawned();
    expect(workers[0].sent.map((m) => m.type)).toEqual(['init']);
    await vi.advanceTimersByTimeAsync(4999);
    expect(host.status).toBe('loading');
    await vi.advanceTimersByTimeAsync(2);
    expect(host.status).toBe('failed');
    expect(host.error).toMatchObject({ code: 'runtime', message: expect.stringContaining('5 s') });
    expect(workers[0].transport.terminate).toHaveBeenCalled();
    await expect(run.done).resolves.toMatchObject({ exitCode: 1, interrupted: 'unavailable' });
    // A Worker that is ready in time is left alone.
    host.restart();
    await spawned();
    workers[1].say({ type: 'ready', origin: 'null' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(host.status).toBe('ready');
  });

  it('notices a Worker that breaks while it starts, and replaces one that breaks later', async () => {
    const { host, workers, ready, spawned, handlers } = setup();
    host.start();
    await spawned();
    workers[0].crash('out of memory');
    expect(host.status).toBe('failed');
    expect(host.error).toMatchObject({ code: 'runtime', message: expect.stringContaining('out of memory') });
    host.restart();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    const run = host.run('s1', 'x', handlers());
    workers[1].crash('out of memory');
    await expect(run.done).resolves.toMatchObject({ exitCode: 137, interrupted: 'restarted' });
    expect(workers[1].transport.terminate).toHaveBeenCalled();
    expect(host.status).toBe('restarting');
    await ready();
    expect(host.status).toBe('ready');
    expect(host.isolation).toBe('opaque-origin');
  });

  it('tells the spawner when a start is no longer wanted', async () => {
    const { host, spawnOptions } = setup();
    host.start();
    const first = (spawnOptions[0] as { signal: AbortSignal }).signal;
    expect(first.aborted).toBe(false);
    host.restart();
    expect(first.aborted).toBe(true);
    const second = (spawnOptions[1] as { signal: AbortSignal }).signal;
    host.dispose();
    expect(second.aborted).toBe(true);
  });

  it('sends what was waiting before it says it is ready', async () => {
    const { host, workers, spawned } = setup();
    host.start();
    await spawned();
    host.write('/p/a.js', 'first');
    host.subscribe(() => { if (host.status === 'ready') host.write('/p/a.js', 'second'); });
    workers[0].say({ type: 'ready', origin: 'null' });
    expect(workers[0].sent.filter((m) => m.type === 'write').map((m) => (m as { data: string }).data)).toEqual(['first', 'second']);
  });

  it('stays disposed when it is disposed of from an output handler while its Worker is being replaced', async () => {
    const { host, workers, ready, spawned } = setup();
    host.start();
    await ready();
    host.openSession('s', { cwd: '/p', cols: 80, rows: 24 });
    host.run('s', 'x', { onOutput: () => host.dispose() });
    workers[0].say({ type: 'output', id: 1, stream: 'stdout', data: 'bye' });
    host.restart();
    await spawned();
    expect(host.status).toBe('disposed');
    expect(workers).toHaveLength(1);
    // The same from a command's last output.
    const again = setup();
    again.host.start();
    await again.ready();
    again.host.openSession('s', { cwd: '/p', cols: 80, rows: 24 });
    const run = again.host.run('s', 'x', { onOutput: () => again.host.dispose() });
    run.abort();
    again.workers[0].say({ type: 'output', id: 1, stream: 'stdout', data: 'bye' });
    again.workers[0].say({ type: 'done', id: 1, exitCode: 130, cwd: '/p', env: {} });
    await again.spawned();
    expect(again.host.status).toBe('disposed');
    expect(again.workers).toHaveLength(1);
  });

  it('Ctrl-C on a command that is still waiting for a Worker takes it back, and asks nothing of the Worker', async () => {
    const { host, workers, ready, handlers } = setup({ killAfter: 0 });
    host.start();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    const run = host.run('s1', 'never', handlers());
    const kept = host.run('s1', 'kept', handlers());
    run.abort();
    await expect(run.done).resolves.toEqual({ exitCode: 130, cwd: '/p' });
    await new Promise((resolve) => { setTimeout(resolve, 5); });
    expect(host.status).toBe('loading');
    await ready();
    expect(workers).toHaveLength(1);
    expect(workers[0].sent.filter((m) => m.type === 'run' || m.type === 'abort')).toEqual([{ type: 'run', id: 2, session: 's1', line: 'kept' }]);
    void kept;
  });

  it('never replaces a Worker for a command given for ever to stop', async () => {
    vi.useFakeTimers();
    const { host, workers, ready, handlers } = setup({ killAfter: Infinity });
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    const run = host.run('s1', 'slow', handlers());
    run.abort();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(workers[0].transport.terminate).not.toHaveBeenCalled();
    expect(host.status).toBe('ready');
    void run;
  });

  it('replaces a Worker that posts more output than the page has taken', async () => {
    const out: string[] = [];
    const { host, workers, ready, handlers } = setup();
    host.start();
    await ready();
    host.openSession('s1', { cwd: '/p', cols: 80, rows: 24 });
    const run = host.run('s1', 'flood', handlers(out));
    const chunk = 'x'.repeat(1024 * 1024);
    for (let i = 0; i < 16; i += 1) workers[0].say({ type: 'output', id: 1, stream: 'stdout', data: chunk });
    expect(workers[0].transport.terminate).not.toHaveBeenCalled();
    workers[0].say({ type: 'output', id: 1, stream: 'stdout', data: 'one more' });
    expect(workers[0].transport.terminate).toHaveBeenCalled();
    await expect(run.done).resolves.toMatchObject({ exitCode: 137, interrupted: 'restarted' });
    expect(host.status).toBe('restarting');
    // What had arrived within the limit is handed on; the rest is not.
    expect(out.join('').length).toBe(16 * 1024 * 1024);
  });
});
