/* ══ Sandbox — run code a person or a model wrote, where it can't reach the page ══
   A Node-compatible runtime (`@agent-wasm/core`, our build of almostnode) with a virtual disk, a shell and npm, in a
   Worker that has an origin of its own. The code that runs there, and every package it installs, has no DOM, no
   cookies and no localStorage, and the browser refuses it the site's IndexedDB, caches and OPFS. What it fetches from the
   site goes without the page's cookies, apart from any marked `SameSite=None` (and, in browsers that don't treat a
   cookie without the attribute as `Lax`, those too).

   This module is the page's side and loads nothing: no runtime, no Worker. The Worker is a file of yours that calls
   `serveSandbox()` (lib/sandbox/worker), so that your bundler builds it with the runtime inside:

     const sandbox = createSandbox({
       worker: () => new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' }),
       files: { 'index.js': 'console.log(1 + 1)' },
     });
     await sandbox.start();            // rejects when the host can't give it an origin of its own
     sandbox.isolation;                // 'opaque-origin'
     const { exitCode } = await sandbox.run('node index.js', { onOutput: (chunk) => console.log(chunk) }).exit;

   It never runs with the page's origin unless you say so (`isolation: 'same-origin'`, or `fallback: 'same-origin'`
   for hosts that don't send CORS headers, which applies only before any code has run), and nothing the code in the
   Worker does can change that. `isolation` says what it got. `lib/sandbox/react` has the hook. ══ */
import { createSandboxDisk } from './disk';
import { SandboxError, type SandboxErrorCode } from './error';
import { createSandboxHost } from './host';
import type {
  SandboxEntryKind, SandboxExit, SandboxFetchRequest, SandboxFetchResponse, SandboxFileData, SandboxFileEntry, SandboxFileEvent, SandboxFiles,
  SandboxIsolation, SandboxOutputDetails, SandboxProcess, SandboxRunOptions, SandboxShell, SandboxShellOptions, SandboxStatus,
} from './model';
import { createSpawner } from './spawn';

export { SandboxError };
export type {
  SandboxEntryKind, SandboxErrorCode, SandboxExit, SandboxFetchRequest, SandboxFetchResponse, SandboxFileData, SandboxFileEntry, SandboxFileEvent,
  SandboxFiles, SandboxIsolation, SandboxOutputDetails, SandboxProcess, SandboxRunOptions, SandboxShell, SandboxShellOptions, SandboxStatus,
};

export interface SandboxStatusDetails {
  /** Why it failed, when it has. */
  error: SandboxError | null;
  /** Where the code runs, once a Worker has started. */
  isolation: SandboxIsolation | null;
}

export interface SandboxOptions {
  /** Starts the Worker: `() => new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' })`, where
   *  that file calls `serveSandbox()`. Written out in your code so that your bundler builds the Worker, runtime and all. */
  worker: () => Worker;
  /** The starting disk: path (relative to `cwd`, or absolute) → content. */
  files?: Record<string, SandboxFileData>;
  /** The folder commands start in. Default `/project`. */
  cwd?: string;
  /** Environment variables for every command. */
  env?: Record<string, string>;
  /** Where the code runs. The default, `opaque-origin`, is a Worker with an origin of its own: the sandbox fails to
   *  start where the host can't give it one. `same-origin` runs it in your Worker as it is, within reach of the site's
   *  IndexedDB and caches: for code you trust. */
  isolation?: SandboxIsolation;
  /** What to do when a Worker with an origin of its own can't load. `none` (the default): fail, and say what the host
   *  must serve. `same-origin`: run in your Worker as it is; `isolation` then says `same-origin`. It applies only to
   *  the first start, before any code has run: once code has run isolated, a restart that can't isolate fails, and a
   *  sandbox that fell back stays in the page's origin. */
  fallback?: 'none' | 'same-origin';
  /** Answers the requests the Worker hands to the page (`hostFetch` in `serveSandbox`). It runs with the page's
   *  origin and sign-ins, so it is the gate: check the address before you fetch. */
  onHostFetch?: (request: SandboxFetchRequest, details: { signal: AbortSignal }) => Promise<SandboxFetchResponse>;
  onStatusChange?: (status: SandboxStatus, details: SandboxStatusDetails) => void;
  /** How long a command gets to stop after `kill()` before its Worker is replaced, in ms. Default 800. `Infinity`:
   *  never replace it. */
  killAfter?: number;
  /** How long a Worker gets to load its module, and then the runtime to start, in ms each. Default 30 000.
   *  `Infinity`: wait for ever. */
  startTimeout?: number;
}

/** The page's copy of the disk, read without waiting. */
export interface SandboxMirror {
  /** Absolute path → content. */
  readonly files: ReadonlyMap<string, SandboxFileData>;
  readonly directories: ReadonlySet<string>;
}

export interface Sandbox {
  readonly status: SandboxStatus;
  /** Where the code runs: what the sandbox got, not what was asked for. `null` until a Worker has started, and once
   *  the sandbox has failed. */
  readonly isolation: SandboxIsolation | null;
  readonly error: SandboxError | null;
  readonly cwd: string;
  readonly files: SandboxFiles;
  /** The page keeps a copy of the disk, so that a Worker it has to replace starts from the same files. This is that
   *  copy: as fresh as the Worker's last report, and complete once a command has ended. */
  readonly mirror: SandboxMirror;
  /** Starts the sandbox if it hasn't been, and resolves when it is ready. Rejects with a `SandboxError` when it can't
   *  start. Nothing is loaded before this, or the first command. */
  start: () => Promise<void>;
  /** Replaces the Worker, stopping whatever runs in it. Files and each shell's folder carry over. */
  restart: () => void;
  /** Runs one command line in a shell of its own. Starts the sandbox if need be. */
  run: (command: string, options?: SandboxRunOptions) => SandboxProcess;
  /** Opens a shell that keeps its folder and environment between commands. */
  shell: (options?: SandboxShellOptions) => SandboxShell;
  /** Calls `listener` when `status`, `isolation` or `error` changes. */
  subscribe: (listener: () => void) => () => void;
  /** Ends the Worker and everything in it. */
  dispose: () => void;
}

const encoder = new TextEncoder();

export function createSandbox(options: SandboxOptions): Sandbox {
  const cwd = options.cwd ?? '/project';
  const disk = createSandboxDisk(cwd, options.files);
  const fallback = options.fallback === 'same-origin';
  // Anything but the one word fails closed.
  const isolation = options.isolation === 'same-origin' ? 'same-origin' : 'opaque-origin';
  const host = createSandboxHost({
    root: cwd,
    spawn: createSpawner({ worker: options.worker, isolation, fallback, timeout: options.startTimeout }),
    isolation,
    fallback,
    snapshot: disk.snapshot,
    onFiles: disk.apply,
    onFetch: options.onHostFetch ? (request, signal) => (options.onHostFetch as NonNullable<SandboxOptions['onHostFetch']>)(request, { signal }) : undefined,
    killAfter: options.killAfter,
    startTimeout: options.startTimeout,
  });

  let lastStatus = host.status;
  host.subscribe(() => {
    if (host.status === lastStatus) return;
    lastStatus = host.status;
    options.onStatusChange?.(host.status, { error: host.error, isolation: host.isolation });
  });

  /** Makes the change on the page's copy, where it can be refused, and tells the Worker. It resolves when the page's
   *  copy has it: a command run after it runs after it, and a Worker that is replaced starts with it. */
  const change = async (apply: () => void, tell: () => void) => {
    if (host.status === 'disposed') throw new SandboxError('disposed', 'The sandbox has been disposed.');
    apply();
    tell();
  };
  const fileAt = (path: string) => {
    const data = disk.files.get(path);
    if (data === undefined) throw new SandboxError('files', disk.directories.has(path) ? `Is a directory: ${path}` : `No such file: ${path}`);
    return data;
  };

  const files: SandboxFiles = {
    async read(path) {
      const data = fileAt(disk.resolve(path));
      return typeof data === 'string' ? encoder.encode(data) : data.slice();
    },
    async readText(path) {
      const data = fileAt(disk.resolve(path));
      return typeof data === 'string' ? data : new TextDecoder().decode(data);
    },
    write(path, data) {
      const at = disk.resolve(path);
      return change(() => disk.write(at, data), () => host.write(at, data));
    },
    mkdir(path) {
      const at = disk.resolve(path);
      return change(() => disk.mkdir(at), () => host.mkdir(at));
    },
    async list(path) {
      return disk.list(disk.resolve(path));
    },
    remove(path, { recursive = false } = {}) {
      const at = disk.resolve(path);
      return change(() => disk.remove(at, recursive), () => host.remove(at));
    },
    rename(from, to) {
      const [a, b] = [disk.resolve(from), disk.resolve(to)];
      return change(() => disk.rename(a, b), () => host.rename(a, b));
    },
    watch: (path, listener) => disk.watch(disk.resolve(path), listener),
  };

  let nextSession = 1;
  const openSession = ({ cwd: folder, env, cols = 80, rows = 24 }: SandboxShellOptions) => {
    const session = `session-${nextSession}`;
    nextSession += 1;
    const merged = options.env || env ? { ...options.env, ...env } : undefined;
    host.openSession(session, { cwd: folder ? disk.resolve(folder) : cwd, env: merged, cols, rows });
    return session;
  };

  /** One command on a session. `ended` is told the folder it left the session in, or nothing when it never ran. */
  const start = (session: string, command: string, run: Omit<SandboxRunOptions, 'cwd' | 'env' | 'cols' | 'rows'>, ended: (folder?: string) => void): SandboxProcess => {
    // Called off before it began: it is not sent, and nothing is started for it.
    if (run.signal?.aborted) {
      ended();
      const nothing = () => undefined;
      return { write: nothing, resize: nothing, kill: nothing, exit: Promise.resolve({ exitCode: 130 }) };
    }
    if (host.status === 'idle') host.start();
    let reading = false;
    let over = false;
    /** Input written before the script reads it. */
    let held = '';
    const handle = host.run(session, command, {
      onOutput: (data, stream) => run.onOutput?.(data, { stream }),
      onReading(now) {
        reading = now;
        if (now && held) {
          host.input(session, held);
          held = '';
        }
        run.onReadingChange?.(now);
      },
    });
    const onAbort = () => handle.abort();
    run.signal?.addEventListener('abort', onAbort, { once: true });
    const exit = handle.done.then(({ cwd: folder, ...result }): SandboxExit => {
      over = true;
      held = '';
      run.signal?.removeEventListener('abort', onAbort);
      ended(folder);
      return result;
    });
    return {
      write(data) {
        if (over) return;
        if (reading) host.input(session, data);
        else held += data;
      },
      resize: (cols, rows) => host.resizeSession(session, cols, rows),
      kill: () => handle.abort(),
      exit,
    };
  };

  return {
    get status() { return host.status; },
    get isolation() { return host.isolation; },
    get error() { return host.error; },
    cwd,
    files,
    mirror: { files: disk.files, directories: disk.directories },
    start() {
      host.start();
      return new Promise<void>((resolve, reject) => {
        const settle = () => {
          if (host.status === 'ready') resolve();
          else if (host.status === 'failed') reject(host.error ?? new SandboxError('runtime', 'The sandbox failed to start.'));
          else if (host.status === 'disposed') reject(new SandboxError('disposed', 'The sandbox has been disposed.'));
          else return false;
          return true;
        };
        if (settle()) return;
        const stop = host.subscribe(() => { if (settle()) stop(); });
      });
    },
    restart: () => host.restart(),
    run(command, { cwd: folder, env, cols, rows, ...run } = {}) {
      const session = openSession({ cwd: folder, env, cols, rows });
      return start(session, command, run, () => host.closeSession(session));
    },
    shell(shellOptions = {}) {
      const session = openSession(shellOptions);
      let folder = shellOptions.cwd ? disk.resolve(shellOptions.cwd) : cwd;
      return {
        get cwd() { return folder; },
        run: (command, run = {}) => start(session, command, run, (next) => { if (next) folder = next; }),
        resize: (cols, rows) => host.resizeSession(session, cols, rows),
        dispose: () => host.closeSession(session),
      };
    },
    subscribe: host.subscribe,
    dispose: () => host.dispose(),
  };
}
