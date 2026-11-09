/* The page's side of the Worker: it starts it, runs commands on it, and when a command won't stop, replaces it. Nothing
   loads until it starts, and it asks for the files to start a Worker with each time, so a Worker can be thrown away. */
import type { FileData, FileEntry, FsBatch, HostMessage, RuntimeMessage, RuntimeFetchRequest, RuntimeFetchResponse, SessionState } from './protocol';
import { isTailnetUrl } from './tailnet-fetch';

export type WorkerStatus = 'off' | 'starting' | 'ready' | 'restarting' | 'failed';

/** `opaque-origin`: the Worker has no access to this site's storage. `same-origin`: it does. See `spawnBrowserWorker`. */
export type WorkerIsolation = 'opaque-origin' | 'same-origin' | null;

export interface WorkerTransport {
  isolation: Exclude<WorkerIsolation, null>;
  post: (message: HostMessage, transfer?: Transferable[]) => void;
  terminate: () => void;
  onmessage: ((message: RuntimeMessage) => void) | null;
}

export type SpawnWorker = (options?: { sameOriginOnly?: boolean }) => Promise<WorkerTransport>;

export interface RunResult {
  exitCode: number;
  cwd: string;
  /** The Worker was replaced under this command, and why. */
  restarted?: 'blocked' | 'other';
}

export interface RunHandle {
  done: Promise<RunResult>;
  /** Ctrl-C: asks the command to stop, and replaces the Worker if it doesn't. */
  abort: () => void;
}

export interface WorkerHost {
  readonly status: WorkerStatus;
  readonly isolation: WorkerIsolation;
  readonly error: string | null;
  subscribe: (listener: () => void) => () => void;
  start: () => void;
  /** Replaces the Worker, stopping whatever runs on it. Files and each terminal's folder carry over. */
  restart: () => void;
  dispose: () => void;
  openSession: (session: string, state: SessionState) => void;
  closeSession: (session: string) => void;
  resizeSession: (session: string, cols: number, rows: number) => void;
  /** `onReading` says when a script starts or stops reading its input: `input` before that goes nowhere. */
  run: (session: string, line: string, onOutput: (data: string) => void, onReading?: (reading: boolean) => void) => RunHandle;
  input: (session: string, data: string) => void;
  write: (path: string, data: FileData) => void;
  mkdir: (path: string) => void;
  rename: (from: string, to: string) => void;
  remove: (path: string) => void;
}

export interface WorkerHostOptions {
  fetch?: (request: RuntimeFetchRequest, signal: AbortSignal) => Promise<RuntimeFetchResponse>;
  root: string;
  spawn: SpawnWorker;
  /** Every file and folder, to start a Worker with. */
  snapshot: () => { files: FileEntry[]; dirs: string[] };
  /** Commands changed the disk. */
  onFiles: (batch: FsBatch) => void;
  /** How long a command gets to stop after Ctrl-C before its Worker is replaced, ms. */
  killAfter?: number;
}

const OUTPUT_EVERY_MS = 16;

/* What arrives is untrusted: a package runs in that Worker and can post anything. Only well-formed paths and data get
   through to the store; output and exit codes for commands that aren't running are dropped where they're handled. */
const isPath = (value: unknown): value is string => typeof value === 'string' && value.startsWith('/');
const isFileData = (value: unknown): value is FileData => typeof value === 'string' || value instanceof Uint8Array;

export function sanitizeBatch(batch: unknown): FsBatch | null {
  const b = batch as Partial<FsBatch> | null;
  if (!b || !Array.isArray(b.changed) || !Array.isArray(b.removed) || !Array.isArray(b.dirs) || !Array.isArray(b.removedDirs)) return null;
  return {
    changed: b.changed.filter((entry) => isPath(entry?.path) && isFileData(entry?.data)),
    removed: b.removed.filter(isPath),
    dirs: b.dirs.filter(isPath),
    removedDirs: b.removedDirs.filter(isPath),
  };
}

export function createWorkerHost(options: WorkerHostOptions): WorkerHost {
  const { root, spawn, snapshot, onFiles, killAfter = 800 } = options;
  let status: WorkerStatus = 'off';
  let isolation: WorkerIsolation = null;
  let error: string | null = null;
  let transport: WorkerTransport | null = null;
  let disposed = false;
  /** Bumped by each start, so what an old Worker's start resolves to can be ignored. */
  let generation = 0;
  let triedSameOrigin = false;
  /** What's waiting for a Worker to be ready. */
  let outbox: Array<[HostMessage, Transferable[]?]> = [];
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  const setStatus = (next: WorkerStatus) => {
    if (next === status) return;
    status = next;
    notify();
  };

  const sessions = new Map<string, SessionState>();

  interface ActiveRun {
    id: number;
    session: string;
    onOutput: (data: string) => void;
    onReading?: (reading: boolean) => void;
    resolve: (result: RunResult) => void;
    pending: string;
    killTimer?: ReturnType<typeof setTimeout>;
    aborted: boolean;
  }
  const runs = new Map<number, ActiveRun>();
  const fetches = new Map<number, AbortController>();
  const cancelFetches = () => { for (const controller of fetches.values()) controller.abort(); fetches.clear(); };
  let nextRun = 1;
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  /** A stopped command can leave timers going, with no way to reach them but to replace the Worker. */
  let staleTimers = false;

  /* Files the page has sent and the Worker hasn't confirmed: a change it reports to those predates what's on its way. */
  let nextSeq = 1;
  const inFlight = new Map<string, number>();
  const seqPaths = new Map<number, string>();

  const send = (message: HostMessage, transfer?: Transferable[]) => {
    if (transport && status === 'ready') transport.post(message, transfer);
    else if (status !== 'off' && status !== 'failed') outbox.push([message, transfer]);
  };

  const sendFileOp = (path: string, make: (seq: number) => HostMessage) => {
    const seq = nextSeq;
    nextSeq += 1;
    inFlight.set(path, seq);
    seqPaths.set(seq, path);
    send(make(seq));
  };

  const flushOutput = () => {
    clearTimeout(flushTimer);
    flushTimer = undefined;
    let chars = 0;
    for (const run of runs.values()) {
      if (!run.pending) continue;
      const data = run.pending;
      run.pending = '';
      chars += data.length;
      run.onOutput(data);
    }
    if (chars) transport?.post({ type: 'ack', chars });
  };

  const finishRun = (run: ActiveRun, result: RunResult) => {
    clearTimeout(run.killTimer);
    runs.delete(run.id);
    run.resolve(result);
  };

  const launch = () => {
    generation += 1;
    const current = generation;
    spawn({ sameOriginOnly: triedSameOrigin }).then(
      (next) => {
        if (current !== generation || disposed) {
          next.terminate();
          return;
        }
        transport = next;
        isolation = next.isolation;
        next.onmessage = (message) => { if (current === generation) handle(message); };
        const { files, dirs } = snapshot();
        next.post({ type: 'init', root, files, dirs, sessions: [...sessions].map(([session, state]) => ({ session, ...state })) });
      },
      (reason: unknown) => {
        if (current !== generation || disposed) return;
        error = reason instanceof Error ? reason.message : String(reason);
        setStatus('failed');
        for (const run of [...runs.values()]) finishRun(run, { exitCode: 1, cwd: sessions.get(run.session)?.cwd ?? root, restarted: 'other' });
      },
    );
  };

  const replaceWorker = (blocked?: ActiveRun) => {
    cancelFetches();
    transport?.terminate();
    transport = null;
    inFlight.clear();
    seqPaths.clear();
    staleTimers = false;
    // The new Worker starts from the files as they are now, and every run is about to be over.
    outbox = outbox.filter(([message]) => message.type === 'open-session' || message.type === 'close-session' || message.type === 'write' || message.type === 'mkdir');
    flushOutput();
    setStatus('restarting');
    for (const run of [...runs.values()]) {
      finishRun(run, { exitCode: run === blocked ? 130 : 137, cwd: sessions.get(run.session)?.cwd ?? root, restarted: run === blocked ? 'blocked' : 'other' });
    }
    launch();
  };

  function handle(message: RuntimeMessage) {
    switch (message.type) {
      case 'fetch': {
        const request = message.request;
        const target = transport;
        if (!Number.isSafeInteger(message.id) || fetches.has(message.id)) return;
        if (!request || typeof request.url !== 'string' || !isTailnetUrl(request.url) || typeof request.method !== 'string'
          || !Array.isArray(request.headers) || !request.headers.every((header) => Array.isArray(header) && header.length === 2 && header.every((value) => typeof value === 'string'))
          || (request.body !== null && !(request.body instanceof Uint8Array)) || !['follow', 'error', 'manual'].includes(request.redirect)) {
          target?.post({ type: 'fetch-result', id: message.id, error: 'Only tailnet HTTP requests are allowed.' });
          return;
        }
        const controller = new AbortController();
        fetches.set(message.id, controller);
        void Promise.resolve().then(() => {
          controller.signal.throwIfAborted();
          if (!options.fetch) throw new Error('Tailscale is not connected.');
          return options.fetch(request, controller.signal);
        }).then(
          (response) => { if (!controller.signal.aborted) target?.post({ type: 'fetch-result', id: message.id, response }); },
          (error: unknown) => { if (!controller.signal.aborted) target?.post({ type: 'fetch-result', id: message.id, error: error instanceof Error ? error.message : String(error) }); },
        ).finally(() => { if (fetches.get(message.id) === controller) fetches.delete(message.id); });
        return;
      }
      case 'cancel-fetch':
        fetches.get(message.id)?.abort();
        fetches.delete(message.id);
        return;
      case 'ready': {
        error = null;
        setStatus('ready');
        const queued = outbox;
        outbox = [];
        for (const [next, transfer] of queued) transport?.post(next, transfer);
        return;
      }
      case 'failed':
        // Started with an opaque origin, it can load but not always finish: its chunks may be refused. Try once without.
        if (isolation === 'opaque-origin' && !triedSameOrigin) {
          triedSameOrigin = true;
          replaceWorker();
          return;
        }
        error = typeof message.message === 'string' ? message.message : 'The runtime failed to start';
        setStatus('failed');
        return;
      case 'output': {
        const run = runs.get(message.id);
        if (!run || typeof message.data !== 'string') return;
        run.pending += message.data;
        flushTimer ??= setTimeout(flushOutput, OUTPUT_EVERY_MS);
        return;
      }
      case 'reading':
        runs.get(message.id)?.onReading?.(!!message.reading);
        return;
      case 'done': {
        const run = runs.get(message.id);
        if (!run) return;
        flushOutput();
        const state = sessions.get(run.session);
        const cwd = isPath(message.cwd) ? message.cwd : state?.cwd ?? root;
        if (state) {
          state.cwd = cwd;
          if (message.env && typeof message.env === 'object') state.env = message.env;
        }
        finishRun(run, { exitCode: typeof message.exitCode === 'number' ? message.exitCode : 1, cwd });
        if (staleTimers && !runs.size) replaceWorker();
        return;
      }
      case 'fs': {
        const batch = sanitizeBatch(message.batch);
        if (!batch) return;
        onFiles({ ...batch, changed: batch.changed.filter(({ path }) => !inFlight.has(path)) });
        return;
      }
      case 'applied': {
        const path = seqPaths.get(message.seq);
        if (path === undefined) return;
        seqPaths.delete(message.seq);
        if (inFlight.get(path) === message.seq) inFlight.delete(path);
        return;
      }
    }
  }

  return {
    get status() { return status; },
    get isolation() { return isolation; },
    get error() { return error; },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start() {
      if (disposed || status !== 'off') return;
      setStatus('starting');
      launch();
    },
    restart() {
      if (disposed) return;
      replaceWorker();
    },
    dispose() {
      cancelFetches();
      disposed = true;
      generation += 1;
      clearTimeout(flushTimer);
      transport?.terminate();
      transport = null;
      for (const run of [...runs.values()]) finishRun(run, { exitCode: 137, cwd: root, restarted: 'other' });
      listeners.clear();
    },
    openSession(session, state) {
      sessions.set(session, { ...state });
      send({ type: 'open-session', session, state });
    },
    closeSession(session) {
      sessions.delete(session);
      send({ type: 'close-session', session });
    },
    resizeSession(session, cols, rows) {
      const state = sessions.get(session);
      if (state) {
        state.cols = cols;
        state.rows = rows;
      }
      send({ type: 'resize', session, cols, rows });
    },
    run(session, line, onOutput, onReading) {
      const id = nextRun;
      nextRun += 1;
      let run: ActiveRun | undefined;
      const done = new Promise<RunResult>((resolve) => {
        run = { id, session, onOutput, onReading, resolve, pending: '', aborted: false };
        runs.set(id, run);
      });
      if (status === 'off' || status === 'failed') {
        finishRun(run as unknown as ActiveRun, { exitCode: 1, cwd: sessions.get(session)?.cwd ?? root, restarted: 'other' });
      } else {
        send({ type: 'run', id, session, line });
      }
      return {
        done,
        abort() {
          if (!run || !runs.has(id) || run.aborted) return;
          run.aborted = true;
          staleTimers = true;
          send({ type: 'abort', id });
          const target = run;
          run.killTimer = setTimeout(() => { if (runs.has(id)) replaceWorker(target); }, killAfter);
        },
      };
    },
    input(session, data) {
      send({ type: 'input', session, data });
    },
    write(path, data) {
      sendFileOp(path, (seq) => ({ type: 'write', seq, path, data }));
    },
    mkdir(path) {
      sendFileOp(path, (seq) => ({ type: 'mkdir', seq, path }));
    },
    rename(from, to) {
      sendFileOp(to, (seq) => ({ type: 'rename', seq, from, to }));
    },
    remove(path) {
      sendFileOp(path, (seq) => ({ type: 'remove', seq, path }));
    },
  };
}

/* Start the Worker from a `data:` URL and the browser gives it an opaque origin of its own: IndexedDB, the Cache API,
   OPFS and locks all refuse it, it has no cookies or localStorage or DOM, and what it fetches from this site goes without
   credentials. Its module has to be fetched with CORS for that, which hosts like GitHub Pages and Cloudflare Pages allow
   and Vite's dev server doesn't. Where it can't load like that it runs as an ordinary Worker of this origin, and the
   status bar says so. */
export const spawnBrowserWorker: SpawnWorker = async (options) => {
  const { default: url } = await import('./worker-url');
  const absolute = new URL(url, location.href).href;
  if (!options?.sameOriginOnly) {
    const source = `import(${JSON.stringify(absolute)}).catch((error) => postMessage({ type: 'load-failed', message: String(error) }));`;
    const worker = new Worker(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`, { type: 'module', name: 'vscode-runtime' });
    const opened = await connect(worker, 'opaque-origin');
    if (opened) return opened;
  }
  const opened = await connect(new Worker(absolute, { type: 'module', name: 'vscode-runtime' }), 'same-origin');
  if (!opened) throw new Error('The runtime could not be loaded.');
  return opened;
};

/** Resolves once the Worker's module says hello; null if it can't load. */
function connect(worker: Worker, isolation: WorkerTransport['isolation']): Promise<WorkerTransport | null> {
  return new Promise((resolve) => {
    const transport: WorkerTransport = {
      isolation,
      post: (message, transfer) => worker.postMessage(message, transfer ?? []),
      terminate: () => worker.terminate(),
      onmessage: null,
    };
    let said = false;
    const fail = () => {
      worker.terminate();
      resolve(null);
    };
    worker.addEventListener('message', ({ data }: MessageEvent<RuntimeMessage>) => {
      if (said) {
        transport.onmessage?.(data);
        return;
      }
      if (data?.type === 'hello') {
        said = true;
        resolve(transport);
      } else if (data?.type === 'load-failed') {
        fail();
      }
    });
    worker.addEventListener('error', (event) => {
      event.preventDefault();
      if (!said) fail();
    });
  });
}
