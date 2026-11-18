import { describe, expect, it, vi } from 'vitest';
import { createAlmostnodeRuntime } from './almostnode';
import type { RuntimeFileEvent } from './runtime';

/* A Worker that says hello, is ready as soon as it is asked to start, and then says what the test tells it to. There
   is no `Worker` here to start one with an origin of its own, so the runtime falls back to this one, as the block
   allows. */
class FakeWorker {
  received: Array<{ type: string } & Record<string, unknown>> = [];
  terminated = false;
  private listeners = new Set<(event: MessageEvent) => void>();
  constructor() {
    setTimeout(() => this.say({ type: 'hello', href: 'https://app.example/assets/sandbox.worker.js', origin: 'https://app.example' }));
  }
  say(data: unknown) {
    if (!this.terminated) for (const listener of this.listeners) listener({ data } as MessageEvent);
  }
  postMessage(message: { type: string }) {
    this.received.push(message);
    if (message.type === 'init') setTimeout(() => this.say({ type: 'ready', origin: 'https://app.example' }));
  }
  terminate() { this.terminated = true; }
  addEventListener(type: string, listener: (event: never) => void) {
    if (type === 'message') this.listeners.add(listener as never);
  }
}

function setup() {
  const workers: FakeWorker[] = [];
  const runtime = createAlmostnodeRuntime({
    project: { 'index.js': 'one', 'package.json': '{"scripts":{"start":"node index.js"}}' },
    worker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    },
  });
  const events: RuntimeFileEvent[] = [];
  runtime.files.watch((batch) => events.push(...batch));
  const ready = () => vi.waitFor(() => expect(runtime.status.get().state).toBe('ready'));
  return { runtime, workers, events, ready };
}

describe('the VS Code block on the Sandbox library', () => {
  it('starts nothing until the window is up, and shows the project meanwhile', async () => {
    const { runtime, workers } = setup();
    expect(workers).toHaveLength(0);
    expect(runtime.status.get()).toMatchObject({ state: 'starting', text: 'Node: Starting…', tone: 'neutral' });
    expect((await runtime.files.list()).map((entry) => entry.path).sort()).toEqual(['/project/index.js', '/project/package.json']);
    await expect(runtime.files.read('/project/index.js')).resolves.toBe('one');
    await expect(runtime.files.read('/project/nope.js')).rejects.toThrow('No such file');
    await expect(runtime.scripts.list()).resolves.toEqual({ scripts: [{ name: 'start', command: 'node index.js' }] });
    runtime.dispose?.();
  });

  it('says where the code runs once it is, and warns when that is this site\'s origin', async () => {
    const { runtime, ready } = setup();
    runtime.start?.();
    await ready();
    const status = runtime.status.get();
    expect(status).toMatchObject({ state: 'ready', text: 'Node: Ready', tone: 'warning' });
    expect(status.details?.[0]).toContain('ordinary Worker of this site');
    runtime.dispose?.();
  });

  it('tells the window what commands changed, and not what the window did itself', async () => {
    const { runtime, workers, events, ready } = setup();
    const scripts = vi.fn();
    runtime.scripts.onChange(scripts);
    runtime.start?.();
    await ready();
    await runtime.files.write('/project/src/mine.js', 'mine');
    await runtime.files.mkdir('/project/made');
    await runtime.files.rename('/project/src/mine.js', '/project/made/mine.js');
    await runtime.files.delete('/project/made');
    await runtime.files.delete('/project/never-there');
    expect(events).toEqual([]);
    expect(workers[0].received.map((message) => message.type)).toEqual(['init', 'write', 'mkdir', 'rename', 'remove']);
    await expect(runtime.files.read('/project/made/mine.js')).rejects.toThrow('No such file');
    // A command wrote a file and moved another.
    workers[0].say({ type: 'fs', batch: { changed: [{ path: '/project/out.txt', data: 'theirs' }, { path: '/project/main.js', data: 'one' }], removed: ['/project/index.js'], dirs: [], removedDirs: [] } });
    expect(events).toEqual([
      { type: 'rename', from: '/project/index.js', to: '/project/main.js' },
      { type: 'change', path: '/project/out.txt', kind: 'file' },
    ]);
    await expect(runtime.files.read('/project/out.txt')).resolves.toBe('theirs');
    // The Run panel hears of package.json, whoever wrote it.
    expect(scripts).not.toHaveBeenCalled();
    await runtime.files.write('/project/package.json', '{"scripts":{}}');
    expect(scripts).toHaveBeenCalledTimes(1);
    await expect(runtime.scripts.list()).resolves.toEqual({ scripts: [], note: 'package.json has no scripts.' });
    runtime.dispose?.();
  });

  it('tells the window when the disk refuses a change', async () => {
    const { runtime } = setup();
    await expect(runtime.files.write('/project/index.js/inside.js', 'no')).rejects.toThrow('Not a directory');
    runtime.dispose?.();
    await expect(runtime.files.write('/project/late.js', 'late')).resolves.toBeUndefined();
  });
});
