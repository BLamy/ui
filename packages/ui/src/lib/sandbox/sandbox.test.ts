/* The whole of it, both sides of the message protocol: `createSandbox` on the page's side, and the Worker's own code
   (`serve`) on the other, joined by Workers that only pass messages. What is faked is the runtime, `@agent-wasm/core`:
   a small disk and a shell that knows a dozen commands. */
import type { ContainerInstance } from '@agent-wasm/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSandbox, SandboxError, type SandboxFileEvent, type SandboxOptions, type SandboxStatus } from './index';
import { serve, type SandboxRuntimeModule, type SandboxWorkerScope, type ServeOptions } from './serve';

/* ── A runtime that fits in a test ── */

function fakeRuntime(scope: SandboxWorkerScope): SandboxRuntimeModule {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set(['/']);
  const listeners = { change: new Set<(path: string) => void>(), delete: new Set<(path: string) => void>() };
  let clock = 0;
  const times = new Map<string, number>();
  const parent = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';
  const vfs = {
    on(event: 'change' | 'delete', listener: (path: string) => void) { listeners[event].add(listener); return vfs; },
    existsSync: (path: string) => files.has(path) || dirs.has(path),
    statSync(path: string) {
      if (!files.has(path) && !dirs.has(path)) throw new Error(`ENOENT: ${path}`);
      return { size: files.get(path)?.length ?? 0, mtimeMs: times.get(path) ?? 0, isDirectory: () => dirs.has(path) };
    },
    readFileSync(path: string, encoding?: string) {
      const bytes = files.get(path);
      if (!bytes) throw new Error(`ENOENT: no such file, open '${path}'`);
      return encoding ? new TextDecoder().decode(bytes) : bytes;
    },
    writeFileSync(path: string, data: string | Uint8Array) {
      if (!dirs.has(parent(path))) throw new Error(`ENOENT: no such directory '${parent(path)}'`);
      files.set(path, typeof data === 'string' ? new TextEncoder().encode(data) : data);
      times.set(path, (clock += 1));
      for (const listener of listeners.change) listener(path);
    },
    mkdirSync(path: string) {
      const parts = path.split('/').filter(Boolean);
      for (let i = 1; i <= parts.length; i += 1) {
        const dir = `/${parts.slice(0, i).join('/')}`;
        if (files.has(dir)) throw new Error(`ENOTDIR: ${dir}`);
        dirs.add(dir);
      }
    },
    readdirSync: (path: string) => [...dirs, ...files.keys()].filter((entry) => entry !== '/' && parent(entry) === path).map((entry) => entry.slice(entry.lastIndexOf('/') + 1)),
    unlinkSync(path: string) {
      files.delete(path);
      for (const listener of listeners.delete) listener(path);
    },
    rmdirSync: (path: string) => { dirs.delete(path); },
    renameSync(from: string, to: string) {
      for (const [path, bytes] of [...files]) if (path === from || path.startsWith(`${from}/`)) { files.delete(path); files.set(to + path.slice(from.length), bytes); }
      for (const dir of [...dirs]) if (dir === from || dir.startsWith(`${from}/`)) { dirs.delete(dir); dirs.add(to + dir.slice(from.length)); }
    },
  };
  const at = (cwd: string, path: string) => (path.startsWith('/') ? path : `${cwd}/${path}`);

  const createTerminalSession = ({ cwd, env }: { cwd: string; env?: Record<string, string> }) => {
    const state = { cwd, env: { ...env } as Record<string, string>, cols: 0, rows: 0 };
    let input: ((data: string) => void) | null = null;
    return {
      getState: () => state,
      resize(cols: number, rows: number) { state.cols = cols; state.rows = rows; },
      sendInput: (data: string) => input?.(data),
      dispose: vi.fn(),
      async run(line: string, io: { signal: AbortSignal; onStdout: (data: string) => void; onStderr: (data: string) => void }) {
        const [command, ...args] = line.split(' ');
        const rest = args.join(' ');
        const done = (stdout = '', exitCode = 0, stderr = '') => ({ stdout, stderr, exitCode });
        switch (command) {
          case 'echo': return done(`${rest}\n`);
          case 'false': return done('', 1);
          case 'pwd': return done(`${state.cwd}\n`);
          case 'size': return done(`${state.cols}x${state.rows}\n`);
          case 'cd': state.cwd = at(state.cwd, rest); return done();
          case 'export': state.env[rest.split('=')[0]] = rest.split('=')[1]; return done();
          case 'printenv': return done(`${state.env[rest] ?? ''}\n`);
          case 'cat': try { return done(vfs.readFileSync(at(state.cwd, rest), 'utf8') as string); } catch (error) { return done('', 1, `${(error as Error).message}\n`); }
          case 'write': vfs.writeFileSync(at(state.cwd, args[0]), args.slice(1).join(' ')); return done();
          case 'bytes': vfs.writeFileSync(at(state.cwd, rest), new Uint8Array([0xff, 0xfe, 0x00])); return done();
          case 'mkdir': vfs.mkdirSync(at(state.cwd, rest)); return done();
          case 'rm': vfs.unlinkSync(at(state.cwd, rest)); return done();
          // The real disk has no event for a move either: the walk when the command ends finds it.
          case 'mv': vfs.renameSync(at(state.cwd, args[0]), at(state.cwd, args[1])); return done();
          case 'node': io.onStdout('out as it goes\n'); io.onStderr('a warning\n'); return done('out as it goes\n', 0, 'a warning\n');
          case 'throw': throw new Error('the runtime threw');
          // Stops when asked.
          case 'wait': return new Promise<ReturnType<typeof done>>((resolve) => io.signal.addEventListener('abort', () => resolve(done('', 130))));
          // Never stops: `while (true) {}`.
          case 'spin': return new Promise<ReturnType<typeof done>>(() => {});
          // Reads a line from its input, a moment after it starts.
          case 'ask': return new Promise<ReturnType<typeof done>>((resolve) => {
            setTimeout(() => {
              const process = { stdin: { listenerCount: (event: string) => (event === 'data' ? 1 : 0) } };
              (scope as unknown as { __almostnodeActiveProcess: unknown }).__almostnodeActiveProcess = process;
              input = (data) => {
                process.stdin.listenerCount = () => 0;
                input = null;
                io.onStdout(`you said ${data}`);
                resolve(done(`you said ${data}`));
              };
            }, 20);
          });
          case 'fetch': try { return done(`${await (await scope.fetch(rest)).text()}\n`); } catch (error) { return done('', 1, `${(error as Error).message}\n`); }
          default: return done('', 127, `${command}: command not found\n`);
        }
      },
    };
  };

  class PackageManager {
    constructor(private disk: typeof vfs, private options: { cwd: string }) {}
    async install(spec: string, { onProgress }: { onProgress?: (message: string) => void } = {}) {
      onProgress?.(`Resolving ${spec}...`);
      this.disk.mkdirSync(`${this.options.cwd}/node_modules/${spec}`);
      this.disk.writeFileSync(`${this.options.cwd}/node_modules/${spec}/index.js`, `module.exports = '${spec}'`);
      return { added: [spec] };
    }
    async installFromPackageJson() { return { added: [] }; }
  }

  return {
    createContainer: () => ({ vfs, createTerminalSession }) as unknown as ContainerInstance,
    PackageManager: PackageManager as unknown as SandboxRuntimeModule['PackageManager'],
  };
}

/* ── Workers that only pass messages ── */

const PAGE = 'https://app.example';
const HREF = `${PAGE}/assets/sandbox.worker-abc.js`;

interface Started {
  origin: string;
  worker: FakeWorker;
  /** How many times this Worker loaded the runtime. */
  loads: number;
}

class FakeWorker {
  terminated = false;
  private listeners = new Set<(event: MessageEvent) => void>();
  private scope: SandboxWorkerScope | null = null;
  postMessage(message: unknown) {
    setTimeout(() => { if (!this.terminated) this.scope?.onmessage?.({ data: message } as never); });
  }
  terminate() { this.terminated = true; }
  addEventListener(type: string, listener: (event: never) => void) {
    if (type === 'message') this.listeners.add(listener as never);
  }
  /** What the page hears from this Worker. */
  hear(data: unknown) {
    if (!this.terminated) for (const listener of this.listeners) listener({ data } as MessageEvent);
  }
  /** Runs the Worker's own code in a scope with this origin. */
  boot(origin: string, href: string, world: World, options: ServeOptions = {}): Started {
    const started: Started = { origin, worker: this, loads: 0 };
    this.scope = {
      origin,
      location: { href },
      onmessage: null,
      addEventListener: vi.fn(),
      fetch: world.network,
      postMessage: (message) => { setTimeout(() => this.hear(message)); },
    };
    const scope = this.scope;
    serve(scope, async () => {
      started.loads += 1;
      return fakeRuntime(scope);
    }, options);
    return started;
  }
}

interface World {
  started: Started[];
  /** What a `data:` Worker does with the module it is told to import: the host's CORS headers decide. */
  cors: boolean;
  /** The origin a browser gives a `data:` Worker. */
  opaqueOrigin: string;
  network: typeof fetch;
  imported: string[];
  serveOptions: ServeOptions;
}

function world(overrides: Partial<World> = {}): World {
  const w: World = {
    started: [], cors: true, opaqueOrigin: 'null', imported: [], serveOptions: {},
    network: vi.fn(async (input: RequestInfo | URL) => new Response(`network: ${String(input)}`)) as unknown as typeof fetch,
    ...overrides,
  };
  // What the browser's `Worker` does with a `data:` URL: a Worker with an origin of its own, which may import the module.
  vi.stubGlobal('Worker', class {
    constructor(url: string, options: WorkerOptions) {
      const worker = new FakeWorker();
      const source = decodeURIComponent(url.replace(/^data:text\/javascript;charset=utf-8,/, ''));
      const href = /^import\("([^"]+)"\)/.exec(source)?.[1] ?? '';
      expect(options).toEqual({ type: 'module', name: 'bl-sandbox' });
      w.imported.push(href);
      if (w.cors) w.started.push(worker.boot(w.opaqueOrigin, url, w, w.serveOptions));
      else setTimeout(() => worker.hear({ type: 'load-failed', message: 'TypeError: Failed to fetch dynamically imported module' }));
      return worker as unknown as Worker;
    }
  });
  return w;
}

/** What the app passes as `worker`: an ordinary Worker of the page's origin. */
const appWorker = (w: World) => () => {
  const worker = new FakeWorker();
  w.started.push(worker.boot(PAGE, HREF, w, w.serveOptions));
  return worker as unknown as Worker;
};

function setup(options: Partial<SandboxOptions> = {}, overrides: Partial<World> = {}) {
  const w = world(overrides);
  const statuses: SandboxStatus[] = [];
  const sandbox = createSandbox({
    worker: appWorker(w),
    files: { 'index.js': 'console.log(1)', 'src/greet.js': 'hello' },
    killAfter: 30,
    onStatusChange: (status) => statuses.push(status),
    ...options,
  });
  return { sandbox, w, statuses };
}

/** Runs a command and collects what it printed. */
async function output(run: { exit: Promise<{ exitCode: number }> }, chunks: string[]) {
  const { exitCode } = await run.exit;
  return { exitCode, text: chunks.join('') };
}
const exec = (sandbox: ReturnType<typeof createSandbox>, command: string, options: Parameters<typeof sandbox.run>[1] = {}) => {
  const chunks: string[] = [];
  return output(sandbox.run(command, { ...options, onOutput: (chunk) => chunks.push(chunk) }), chunks);
};

afterEach(() => { vi.unstubAllGlobals(); });

describe('where the code runs', () => {
  it('runs in a Worker with an origin of its own by default, and loads the runtime only there', async () => {
    const { sandbox, w, statuses } = setup();
    expect(sandbox.status).toBe('idle');
    expect(sandbox.isolation).toBeNull();
    expect(w.started).toHaveLength(0);
    await sandbox.start();
    expect(sandbox.status).toBe('ready');
    expect(sandbox.isolation).toBe('opaque-origin');
    expect(sandbox.error).toBeNull();
    expect(statuses).toEqual(['loading', 'ready']);
    expect(w.imported).toEqual([HREF]);
    const [mine, isolated] = w.started;
    expect(mine).toMatchObject({ origin: PAGE, loads: 0 });
    expect(mine.worker.terminated).toBe(true);
    expect(isolated).toMatchObject({ origin: 'null', loads: 1 });
    await expect(exec(sandbox, 'cat index.js')).resolves.toEqual({ exitCode: 0, text: 'console.log(1)' });
    sandbox.dispose();
  });

  it('fails to start where the host refuses the module, without ever running in the page\'s origin', async () => {
    const details: unknown[] = [];
    const { sandbox, w } = setup({ onStatusChange: (status, d) => details.push([status, d.error?.code ?? null, d.isolation]) }, { cors: false });
    const failure = await sandbox.start().catch((reason: unknown) => reason);
    expect(failure).toBeInstanceOf(SandboxError);
    expect(failure).toMatchObject({ code: 'isolation', message: expect.stringContaining('Access-Control-Allow-Origin') });
    expect(sandbox.status).toBe('failed');
    expect(sandbox.error).toBe(failure);
    expect(sandbox.isolation).toBeNull();
    expect(details).toEqual([['loading', null, null], ['failed', 'isolation', null]]);
    expect(w.started).toHaveLength(1);
    expect(w.started[0]).toMatchObject({ origin: PAGE, loads: 0 });
    expect(w.started[0].worker.terminated).toBe(true);
    // A command says the same, and still nothing has run.
    await expect(sandbox.run('echo hi').exit).resolves.toEqual({ exitCode: 1, interrupted: 'unavailable' });
    await expect(sandbox.start()).rejects.toBe(failure);
    expect(w.started[0].loads).toBe(0);
  });

  it('falls back to the page\'s origin only when told it may, and reports it', async () => {
    const { sandbox, w } = setup({ fallback: 'same-origin' }, { cors: false });
    await sandbox.start();
    expect(sandbox.isolation).toBe('same-origin');
    expect(w.started).toHaveLength(1);
    expect(w.started[0]).toMatchObject({ origin: PAGE, loads: 1 });
    await expect(exec(sandbox, 'echo hi')).resolves.toEqual({ exitCode: 0, text: 'hi\n' });
    sandbox.dispose();
  });

  it('runs in the page\'s origin when that is what was asked for', async () => {
    const { sandbox, w } = setup({ isolation: 'same-origin' });
    await sandbox.start();
    expect(sandbox.isolation).toBe('same-origin');
    expect(w.imported).toEqual([]);
    sandbox.dispose();
  });

  it('does not take a browser\'s word for it: a Worker that reports the page\'s origin is refused', async () => {
    const { sandbox, w } = setup({}, { opaqueOrigin: PAGE });
    await expect(sandbox.start()).rejects.toMatchObject({ code: 'isolation' });
    expect(w.started.every(({ loads }) => loads === 0)).toBe(true);
    expect(w.started.every(({ worker }) => worker.terminated)).toBe(true);
  });
});

describe('files', () => {
  it('reads what it was given before anything has started', async () => {
    const { sandbox, w } = setup();
    await expect(sandbox.files.readText('index.js')).resolves.toBe('console.log(1)');
    await expect(sandbox.files.read('/project/src/greet.js')).resolves.toEqual(new TextEncoder().encode('hello'));
    await expect(sandbox.files.list('.')).resolves.toEqual([{ name: 'index.js', kind: 'file' }, { name: 'src', kind: 'directory' }]);
    await expect(sandbox.files.read('nope.js')).rejects.toMatchObject({ name: 'SandboxError', code: 'files', message: 'No such file: /project/nope.js' });
    await expect(sandbox.files.read('src')).rejects.toThrow('Is a directory');
    expect(sandbox.cwd).toBe('/project');
    expect(sandbox.mirror.files.get('/project/index.js')).toBe('console.log(1)');
    expect(sandbox.mirror.directories.has('/project/src')).toBe(true);
    expect(w.started).toHaveLength(0);
  });

  it('gives the runtime what the page wrote, before it started and after', async () => {
    const { sandbox } = setup();
    await sandbox.files.write('early.txt', 'before');
    await sandbox.start();
    await expect(exec(sandbox, 'cat early.txt')).resolves.toEqual({ exitCode: 0, text: 'before' });
    await sandbox.files.write('deep/er/late.txt', 'after');
    await expect(exec(sandbox, 'cat deep/er/late.txt')).resolves.toEqual({ exitCode: 0, text: 'after' });
    await sandbox.files.mkdir('made');
    await sandbox.files.rename('deep/er/late.txt', 'made/moved.txt');
    await expect(exec(sandbox, 'cat made/moved.txt')).resolves.toMatchObject({ text: 'after' });
    await expect(exec(sandbox, 'cat deep/er/late.txt')).resolves.toMatchObject({ exitCode: 1 });
    await sandbox.files.remove('made', { recursive: true });
    await expect(exec(sandbox, 'cat made/moved.txt')).resolves.toMatchObject({ exitCode: 1 });
    await expect(sandbox.files.remove('src')).rejects.toThrow('Directory not empty');
    await expect(sandbox.files.write('index.js/x', '')).rejects.toMatchObject({ code: 'files' });
    sandbox.dispose();
  });

  it('shows the page what commands wrote, text and bytes, by the time they end', async () => {
    const { sandbox } = setup();
    await exec(sandbox, 'write out.txt made by a command');
    await exec(sandbox, 'bytes blob.bin');
    await expect(sandbox.files.readText('out.txt')).resolves.toBe('made by a command');
    await expect(sandbox.files.read('blob.bin')).resolves.toEqual(new Uint8Array([0xff, 0xfe, 0x00]));
    expect(sandbox.mirror.files.get('/project/blob.bin')).toBeInstanceOf(Uint8Array);
    await exec(sandbox, 'mkdir build/out');
    await expect(sandbox.files.list('build')).resolves.toEqual([{ name: 'out', kind: 'directory' }]);
    sandbox.dispose();
  });

  it('tells a watcher what changed, whoever changed it', async () => {
    const { sandbox } = setup();
    const seen: SandboxFileEvent[] = [];
    const stop = sandbox.files.watch('.', (events) => seen.push(...events));
    await sandbox.files.write('notes.txt', 'mine');
    expect(seen).toEqual([{ type: 'change', path: '/project/notes.txt', kind: 'file' }]);
    await exec(sandbox, 'write theirs.txt x');
    await exec(sandbox, 'mv theirs.txt renamed.txt');
    await exec(sandbox, 'rm index.js');
    expect(seen.slice(1)).toEqual([
      { type: 'change', path: '/project/theirs.txt', kind: 'file' },
      { type: 'rename', from: '/project/theirs.txt', to: '/project/renamed.txt' },
      { type: 'delete', path: '/project/index.js' },
    ]);
    stop();
    await exec(sandbox, 'write later.txt x');
    expect(seen).toHaveLength(4);
    sandbox.dispose();
  });

  it('installs a package where the command was run, and the page sees it', async () => {
    const { sandbox } = setup();
    const result = await exec(sandbox, 'npm install tiny');
    expect(result).toEqual({ exitCode: 0, text: 'Resolving tiny...\nadded 1 package\n' });
    await expect(sandbox.files.readText('node_modules/tiny/index.js')).resolves.toBe("module.exports = 'tiny'");
    sandbox.dispose();
  });
});

describe('commands', () => {
  it('starts the sandbox for the first command, and reports output by stream and the exit code', async () => {
    const { sandbox } = setup();
    const chunks: Array<[string, string]> = [];
    const run = sandbox.run('node index.js', { onOutput: (chunk, { stream }) => chunks.push([stream, chunk]) });
    expect(sandbox.status).toBe('loading');
    await expect(run.exit).resolves.toEqual({ exitCode: 0 });
    expect(chunks).toEqual([['stdout', 'out as it goes\n'], ['stderr', 'a warning\n']]);
    await expect(exec(sandbox, 'false')).resolves.toEqual({ exitCode: 1, text: '' });
    await expect(exec(sandbox, 'nope')).resolves.toEqual({ exitCode: 127, text: 'nope: command not found\n' });
    await expect(exec(sandbox, 'throw')).resolves.toEqual({ exitCode: 1, text: 'the runtime threw\n' });
    await expect(exec(sandbox, 'false || echo recovered && echo then; echo last')).resolves.toEqual({ exitCode: 0, text: 'recovered\nthen\nlast\n' });
    sandbox.dispose();
  });

  it('runs each command where it is told, with the environment it is given', async () => {
    const { sandbox } = setup({ env: { GREETING: 'hello', WHO: 'world' } });
    await expect(exec(sandbox, 'pwd')).resolves.toMatchObject({ text: '/project\n' });
    await expect(exec(sandbox, 'pwd', { cwd: 'src' })).resolves.toMatchObject({ text: '/project/src\n' });
    await expect(exec(sandbox, 'printenv GREETING')).resolves.toMatchObject({ text: 'hello\n' });
    await expect(exec(sandbox, 'printenv WHO', { env: { WHO: 'you' } })).resolves.toMatchObject({ text: 'you\n' });
    await expect(exec(sandbox, 'size', { cols: 120, rows: 40 })).resolves.toMatchObject({ text: '120x40\n' });
    // One command's `cd` is its own.
    await exec(sandbox, 'cd src');
    await expect(exec(sandbox, 'pwd')).resolves.toMatchObject({ text: '/project\n' });
    sandbox.dispose();
  });

  it('keeps a shell\'s folder and environment from one command to the next', async () => {
    const { sandbox } = setup();
    const shell = sandbox.shell({ env: { A: '1' }, cols: 100, rows: 30 });
    const say = async (command: string) => {
      const chunks: string[] = [];
      return (await output(shell.run(command, { onOutput: (chunk) => chunks.push(chunk) }), chunks)).text;
    };
    expect(shell.cwd).toBe('/project');
    await say('cd src');
    expect(shell.cwd).toBe('/project/src');
    expect(await say('cat greet.js')).toBe('hello');
    await say('export B=2');
    expect(await say('printenv A')).toBe('1\n');
    expect(await say('printenv B')).toBe('2\n');
    expect(await say('size')).toBe('100x30\n');
    shell.resize(132, 50);
    expect(await say('size')).toBe('132x50\n');
    shell.dispose();
    sandbox.dispose();
  });

  it('holds input until the script reads it, and says when it does', async () => {
    const { sandbox } = setup();
    await sandbox.start();
    const chunks: string[] = [];
    const reading: boolean[] = [];
    const run = sandbox.run('ask', { onOutput: (chunk) => chunks.push(chunk), onReadingChange: (now) => reading.push(now) });
    run.write('early ');
    run.write('bird\n');
    await expect(run.exit).resolves.toEqual({ exitCode: 0 });
    expect(chunks.join('')).toBe('you said early bird\n');
    expect(reading[0]).toBe(true);
    // Nothing is read after it ends.
    expect(() => run.write('late')).not.toThrow();
    sandbox.dispose();
  });

  it('stops a command that stops when asked, by kill() or by its signal', async () => {
    const { sandbox } = setup();
    await sandbox.start();
    const first = sandbox.run('wait');
    first.kill();
    await expect(first.exit).resolves.toEqual({ exitCode: 130 });
    const controller = new AbortController();
    const second = sandbox.run('wait', { signal: controller.signal });
    controller.abort();
    await expect(second.exit).resolves.toEqual({ exitCode: 130 });
    await expect(sandbox.run('wait', { signal: AbortSignal.abort() }).exit).resolves.toEqual({ exitCode: 130 });
    sandbox.dispose();
  });

  it('replaces the Worker under a command that won\'t stop, and keeps the files', async () => {
    const { sandbox, w, statuses } = setup();
    await exec(sandbox, 'write kept.txt still here');
    const before = w.started.at(-1) as Started;
    const bystander = sandbox.run('wait');
    const stuck = sandbox.run('spin');
    stuck.kill();
    await expect(stuck.exit).resolves.toEqual({ exitCode: 130, interrupted: 'unresponsive' });
    await expect(bystander.exit).resolves.toEqual({ exitCode: 137, interrupted: 'restarted' });
    expect(sandbox.status).toBe('restarting');
    expect(before.worker.terminated).toBe(true);
    await expect(exec(sandbox, 'cat kept.txt')).resolves.toEqual({ exitCode: 0, text: 'still here' });
    expect(sandbox.status).toBe('ready');
    expect(sandbox.isolation).toBe('opaque-origin');
    expect(statuses).toEqual(['loading', 'ready', 'restarting', 'ready']);
    // The second isolated Worker was started without asking a same-origin one again.
    expect(w.started.map(({ origin }) => origin)).toEqual([PAGE, 'null', 'null']);
    sandbox.dispose();
  });

  it('restart() gives a clean Worker with the same files and each shell where it was', async () => {
    const { sandbox, w } = setup();
    const shell = sandbox.shell();
    await shell.run('cd src').exit;
    await shell.run('write made.txt by a command').exit;
    sandbox.restart();
    expect(sandbox.status).toBe('restarting');
    const chunks: string[] = [];
    await shell.run('cat made.txt', { onOutput: (chunk) => chunks.push(chunk) }).exit;
    expect(chunks.join('')).toBe('by a command');
    expect(shell.cwd).toBe('/project/src');
    expect(w.started.filter(({ loads }) => loads === 1)).toHaveLength(2);
    sandbox.dispose();
  });
});

describe('requests the page answers', () => {
  it('hands the page only the requests the Worker was told to, and the rest go out from the Worker', async () => {
    const asked: string[] = [];
    const { sandbox, w } = setup({
      async onHostFetch(request, { signal }) {
        asked.push(`${request.method} ${request.url}`);
        expect(signal.aborted).toBe(false);
        if (!request.url.startsWith('http://notes.internal/')) throw new Error('Not allowed.');
        return { status: 200, statusText: 'OK', headers: [['content-type', 'text/plain']], body: new TextEncoder().encode('from the page') };
      },
    }, { serveOptions: { hostFetch: (url) => new URL(url).hostname.endsWith('.internal') } });
    await expect(exec(sandbox, 'fetch http://notes.internal/list')).resolves.toEqual({ exitCode: 0, text: 'from the page\n' });
    await expect(exec(sandbox, 'fetch http://other.internal/')).resolves.toEqual({ exitCode: 1, text: 'Not allowed.\n' });
    await expect(exec(sandbox, 'fetch https://registry.npmjs.org/tiny')).resolves.toEqual({ exitCode: 0, text: 'network: https://registry.npmjs.org/tiny\n' });
    expect(asked).toEqual(['GET http://notes.internal/list', 'GET http://other.internal/']);
    expect(w.network).toHaveBeenCalledTimes(1);
    sandbox.dispose();
  });

  it('leaves the Worker\'s fetch alone when nothing is to go to the page', async () => {
    const { sandbox, w } = setup();
    await expect(exec(sandbox, 'fetch http://notes.internal/list')).resolves.toMatchObject({ text: 'network: http://notes.internal/list\n' });
    expect(w.network).toHaveBeenCalledTimes(1);
    sandbox.dispose();
  });
});

describe('the end', () => {
  it('ends the Worker and whatever ran in it, and refuses what comes after', async () => {
    const { sandbox, w, statuses } = setup();
    await sandbox.start();
    const seen: SandboxStatus[] = [];
    sandbox.subscribe(() => seen.push(sandbox.status));
    const running = sandbox.run('wait');
    sandbox.dispose();
    expect(sandbox.status).toBe('disposed');
    expect(seen).toEqual(['disposed']);
    expect(statuses.at(-1)).toBe('disposed');
    expect(w.started.every(({ worker }) => worker.terminated)).toBe(true);
    await expect(running.exit).resolves.toEqual({ exitCode: 137, interrupted: 'unavailable' });
    await expect(sandbox.start()).rejects.toMatchObject({ code: 'disposed' });
    await expect(sandbox.files.write('x', '')).rejects.toMatchObject({ code: 'disposed' });
    await expect(sandbox.run('echo hi').exit).resolves.toEqual({ exitCode: 1, interrupted: 'unavailable' });
    // What it held can still be read.
    await expect(sandbox.files.readText('index.js')).resolves.toBe('console.log(1)');
  });

  it('a start that is disposed of before it is ready rejects, and leaves no Worker', async () => {
    const { sandbox, w } = setup();
    const starting = sandbox.start();
    sandbox.dispose();
    await expect(starting).rejects.toMatchObject({ code: 'disposed' });
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(w.started.every(({ worker }) => worker.terminated)).toBe(true);
  });
});
