import { describe, expect, it, vi } from 'vitest';
import { SandboxError } from './error';
import type { RuntimeMessage } from './protocol';
import { createSpawner, isolatedSource, type SpawnerOptions, type WorkerLike } from './spawn';

/* A Worker that says what the test tells it to. */
function fakeWorker() {
  const listeners = { message: [] as Array<(event: MessageEvent) => void>, error: [] as Array<(event: Event) => void> };
  const posted: unknown[] = [];
  const worker = {
    postMessage: (message: unknown) => { posted.push(message); },
    terminate: vi.fn(),
    addEventListener: (type: 'message' | 'error' | 'messageerror', listener: (event: never) => void) => {
      if (type !== 'messageerror') listeners[type].push(listener as never);
    },
  } as unknown as WorkerLike & { terminate: ReturnType<typeof vi.fn> };
  return {
    worker,
    posted,
    say: (data: RuntimeMessage) => { for (const listener of listeners.message) listener({ data } as MessageEvent); },
    crash: (message: string) => { for (const listener of listeners.error) listener({ message, preventDefault: vi.fn() } as unknown as Event); },
  };
}

const HREF = 'https://app.example/assets/sandbox.worker-abc.js';
const tick = () => new Promise((resolve) => { setTimeout(resolve); });

function setup(options: Partial<SpawnerOptions> = {}) {
  const mine: Array<ReturnType<typeof fakeWorker>> = [];
  const isolated: Array<ReturnType<typeof fakeWorker> & { url: string; options: WorkerOptions }> = [];
  const spawn = createSpawner({
    worker: () => {
      const made = fakeWorker();
      mine.push(made);
      return made.worker;
    },
    isolation: 'opaque-origin',
    fallback: false,
    isolated: (url, workerOptions) => {
      const made = { ...fakeWorker(), url, options: workerOptions };
      isolated.push(made);
      return made.worker;
    },
    ...options,
  });
  const hello = (worker: ReturnType<typeof fakeWorker>, origin: string, href = HREF) => worker.say({ type: 'hello', href, origin });
  return { spawn, mine, isolated, hello };
}

describe('starting the Worker', () => {
  it('asks the app\'s Worker where its module is, then runs it in a Worker with an origin of its own', async () => {
    const { spawn, mine, isolated, hello } = setup();
    const starting = spawn();
    hello(mine[0], 'https://app.example');
    await tick();
    expect(isolated).toHaveLength(1);
    expect(isolated[0].options).toEqual({ type: 'module', name: 'bl-sandbox' });
    expect(decodeURIComponent(isolated[0].url)).toBe(`data:text/javascript;charset=utf-8,${isolatedSource(HREF)}`);
    // Nothing is asked of the first Worker: it is only ended once the second has answered.
    expect(mine[0].posted).toEqual([]);
    expect(mine[0].worker.terminate).not.toHaveBeenCalled();
    hello(isolated[0], 'null', 'data:text/javascript,…');
    const transport = await starting;
    expect(transport.isolation).toBe('opaque-origin');
    expect(mine[0].worker.terminate).toHaveBeenCalledOnce();
    transport.post({ type: 'ack', chars: 1 });
    expect(isolated[0].posted).toEqual([{ type: 'ack', chars: 1 }]);
    const heard: RuntimeMessage[] = [];
    transport.onmessage = (message) => heard.push(message);
    isolated[0].say({ type: 'ready', origin: 'null' });
    expect(heard).toEqual([{ type: 'ready', origin: 'null' }]);
  });

  it('goes straight to the isolated Worker the next time', async () => {
    const { spawn, mine, isolated, hello } = setup();
    const first = spawn();
    hello(mine[0], 'https://app.example');
    await tick();
    hello(isolated[0], 'null');
    await first;
    const second = spawn();
    await tick();
    expect(mine).toHaveLength(1);
    expect(isolated).toHaveLength(2);
    hello(isolated[1], 'null');
    await expect(second).resolves.toMatchObject({ isolation: 'opaque-origin' });
  });

  it('fails, and says what the host must serve, when the module can\'t be loaded across origins', async () => {
    const { spawn, mine, isolated, hello } = setup();
    const starting = spawn();
    hello(mine[0], 'http://localhost:5173', 'http://localhost:5173/src/sandbox.worker.ts?worker_file&type=module');
    await tick();
    isolated[0].say({ type: 'load-failed', message: 'TypeError: Failed to fetch dynamically imported module' });
    const failure = await starting.catch((reason: unknown) => reason);
    expect(failure).toBeInstanceOf(SandboxError);
    expect(failure).toMatchObject({ code: 'isolation' });
    expect((failure as Error).message).toContain('Failed to fetch dynamically imported module');
    expect((failure as Error).message).toContain('Access-Control-Allow-Origin');
    expect((failure as Error).message).toContain("fallback: 'same-origin'");
    // Neither Worker is left running, and nothing was ever asked of the same-origin one.
    expect(isolated[0].worker.terminate).toHaveBeenCalled();
    expect(mine[0].worker.terminate).toHaveBeenCalled();
    expect(mine[0].posted).toEqual([]);
  });

  it('runs in the app\'s Worker instead only where the caller allowed it, and says so', async () => {
    const { spawn, mine, isolated, hello } = setup({ fallback: true });
    const starting = spawn();
    hello(mine[0], 'http://localhost:5173');
    await tick();
    isolated[0].crash('Script error.');
    const transport = await starting;
    expect(transport.isolation).toBe('same-origin');
    expect(mine[0].worker.terminate).not.toHaveBeenCalled();
    transport.post({ type: 'ack', chars: 2 });
    expect(mine[0].posted).toEqual([{ type: 'ack', chars: 2 }]);
  });

  it('refuses a Worker that was not given an origin of its own', async () => {
    const { spawn, mine, isolated, hello } = setup();
    const starting = spawn();
    hello(mine[0], 'https://app.example');
    await tick();
    hello(isolated[0], 'https://app.example');
    await expect(starting).rejects.toMatchObject({ code: 'isolation', message: expect.stringContaining('gave the Worker the origin https://app.example') });
    expect(isolated[0].worker.terminate).toHaveBeenCalled();
  });

  it('starts only the app\'s Worker when same-origin was asked for', async () => {
    const { spawn, mine, isolated, hello } = setup({ isolation: 'same-origin' });
    const starting = spawn();
    hello(mine[0], 'https://app.example');
    await expect(starting).resolves.toMatchObject({ isolation: 'same-origin' });
    expect(isolated).toHaveLength(0);

    const forced = setup();
    const again = forced.spawn({ sameOrigin: true });
    forced.hello(forced.mine[0], 'https://app.example');
    await expect(again).resolves.toMatchObject({ isolation: 'same-origin' });
    expect(forced.isolated).toHaveLength(0);
  });

  it('says so when the app\'s Worker can\'t start, throws, or never answers', async () => {
    const crashed = setup();
    const first = crashed.spawn();
    crashed.mine[0].crash('Unexpected token');
    await expect(first).rejects.toMatchObject({ code: 'worker', message: expect.stringContaining('Unexpected token') });

    const thrown = createSpawner({ worker: () => { throw new Error('no Worker here'); }, isolation: 'opaque-origin', fallback: true });
    await expect(thrown()).rejects.toMatchObject({ code: 'worker', message: expect.stringContaining('no Worker here') });

    vi.useFakeTimers();
    const silent = setup({ timeout: 1000 });
    const waiting = silent.spawn();
    const outcome = waiting.catch((reason: unknown) => reason);
    await vi.advanceTimersByTimeAsync(1001);
    vi.useRealTimers();
    expect(await outcome).toMatchObject({ code: 'worker', message: expect.stringContaining('serveSandbox()') });
    expect(silent.mine[0].worker.terminate).toHaveBeenCalled();
  });

  it('cannot isolate a Worker that has no address to import', async () => {
    const { spawn, mine, isolated, hello } = setup();
    const starting = spawn();
    hello(mine[0], 'https://app.example', 'blob:https://app.example/1234');
    await expect(starting).rejects.toMatchObject({ code: 'isolation', message: expect.stringContaining('did not say where it was loaded from') });
    expect(isolated).toHaveLength(0);
    expect(mine[0].worker.terminate).toHaveBeenCalled();
  });
});
