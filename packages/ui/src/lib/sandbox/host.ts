/* @internal The page's side of the Worker: it starts it, runs commands on it, and when a command won't stop, replaces
   it. Nothing loads until it starts, and it asks for the files to start a Worker with each time, so a Worker can be
   thrown away. */
import { SandboxError, messageOf } from './error';
import type { SandboxExit, SandboxFetchRequest, SandboxFetchResponse, SandboxFileData, SandboxIsolation, SandboxStatus } from './model';
import type { FileEntry, FsBatch, HostMessage, RuntimeMessage, SessionState } from './protocol';

export interface SandboxTransport {
  isolation: SandboxIsolation;
  post: (message: HostMessage, transfer?: Transferable[]) => void;
  terminate: () => void;
  onmessage: ((message: RuntimeMessage) => void) | null;
}

/** Starts a Worker and resolves once its module is listening. `sameOrigin` asks for an ordinary Worker of the page's
 *  origin, whatever the sandbox's isolation: the host only asks when the caller allowed falling back. */
export type SpawnTransport = (options?: { sameOrigin?: boolean }) => Promise<SandboxTransport>;

export interface HostRunResult extends SandboxExit {
  cwd: string;
}

export interface HostRunHandle {
  done: Promise<HostRunResult>;
  /** Ctrl-C: asks the command to stop, and replaces the Worker if it doesn't. */
  abort: () => void;
}

export interface HostRunHandlers {
  onOutput: (data: string, stream: 'stdout' | 'stderr') => void;
  /** Says when a script starts or stops reading its input: `input` before that goes nowhere. */
  onReading?: (reading: boolean) => void;
}

export interface SandboxHost {
  readonly status: SandboxStatus;
  readonly isolation: SandboxIsolation | null;
  readonly error: SandboxError | null;
  subscribe: (listener: () => void) => () => void;
  start: () => void;
  /** Replaces the Worker, stopping whatever runs on it. Files and each session's folder carry over. */
  restart: () => void;
  dispose: () => void;
  openSession: (session: string, state: SessionState) => void;
  closeSession: (session: string) => void;
  resizeSession: (session: string, cols: number, rows: number) => void;
  run: (session: string, line: string, handlers: HostRunHandlers) => HostRunHandle;
  input: (session: string, data: string) => void;
  /** Each resolves once the Worker's disk has the change, or at once while there is no Worker to tell. */
  write: (path: string, data: SandboxFileData) => Promise<void>;
  mkdir: (path: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
}

export interface SandboxHostOptions {
  root: string;
  spawn: SpawnTransport;
  /** Whether a Worker with an origin of its own that cannot finish starting may be replaced with a same-origin one. */
  fallback: boolean;
  /** Every file and folder, to start a Worker with. */
  snapshot: () => { files: FileEntry[]; dirs: string[] };
  /** Commands changed the disk. */
  onFiles: (batch: FsBatch) => void;
  /** Answers the requests the Worker hands to the page. */
  onFetch?: (request: SandboxFetchRequest, signal: AbortSignal) => Promise<SandboxFetchResponse>;
  /** How long a command gets to stop after Ctrl-C before its Worker is replaced, ms. */
  killAfter?: number;
}

const OUTPUT_EVERY_MS = 16;

/* What arrives is untrusted: a package runs in that Worker and can post anything. Only well-formed paths and data get
   through to the page's copy of the disk; output and exit codes for commands that aren't running are dropped where
   they're handled. */
const isPath = (value: unknown): value is string => typeof value === 'string' && value.startsWith('/');
const isFileData = (value: unknown): value is SandboxFileData => typeof value === 'string' || value instanceof Uint8Array;

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

const isFetchRequest = (request: unknown): request is SandboxFetchRequest => {
  const r = request as Partial<SandboxFetchRequest> | null;
  return !!r && typeof r.url === 'string' && typeof r.method === 'string'
    && Array.isArray(r.headers) && r.headers.every((header) => Array.isArray(header) && header.length === 2 && header.every((value) => typeof value === 'string'))
    && (r.body === null || r.body instanceof Uint8Array) && ['follow', 'error', 'manual'].includes(r.redirect as string);
};

export function createSandboxHost(options: SandboxHostOptions): SandboxHost {
  const { root, spawn, snapshot, onFiles, killAfter = 800 } = options;
  let status: SandboxStatus = 'idle';
  let isolation: SandboxIsolation | null = null;
  let error: SandboxError | null = null;
  let transport: SandboxTransport | null = null;
  /** Bumped by each start, so what an old Worker's start resolves to can be ignored. */
  let generation = 0;
  let triedSameOrigin = false;
  /** What's waiting for a Worker to be ready. */
  let outbox: Array<[HostMessage, Transferable[]?]> = [];
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of [...listeners]) listener(); };
  const setStatus = (next: SandboxStatus) => {
    if (next === status) return;
    status = next;
    notify();
  };
  const disposed = () => status === 'disposed';

  const sessions = new Map<string, SessionState>();

  interface ActiveRun {
    id: number;
    session: string;
    handlers: HostRunHandlers;
    resolve: (result: HostRunResult) => void;
    /** Output not yet handed on, in order: stretches of one stream. */
    pending: Array<{ stream: 'stdout' | 'stderr'; data: string }>;
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

  /* Changes the page has sent and the Worker hasn't confirmed: a change it reports to those paths predates what's on
     its way. */
  let nextSeq = 1;
  const inFlight = new Map<string, number>();
  const pendingOps = new Map<number, { path: string; resolve: () => void; reject: (error: SandboxError) => void }>();
  /** A Worker that starts from the files as they are now has every change that was on its way. */
  const settleOps = (failure?: SandboxError) => {
    for (const op of pendingOps.values()) {
      if (failure) op.reject(failure);
      else op.resolve();
    }
    pendingOps.clear();
    inFlight.clear();
  };

  const send = (message: HostMessage, transfer?: Transferable[]) => {
    if (transport && status === 'ready') transport.post(message, transfer);
    else if (status === 'loading' || status === 'restarting') outbox.push([message, transfer]);
  };

  const sendFileOp = (path: string, make: (seq: number) => HostMessage) => new Promise<void>((resolve, reject) => {
    if (disposed()) {
      reject(new SandboxError('disposed', 'The sandbox has been disposed.'));
      return;
    }
    // No Worker to tell: the page's copy has the change, and a Worker starts from that.
    if (status === 'idle' || status === 'failed') {
      resolve();
      return;
    }
    const seq = nextSeq;
    nextSeq += 1;
    inFlight.set(path, seq);
    pendingOps.set(seq, { path, resolve, reject });
    send(make(seq));
  });

  const flushOutput = () => {
    clearTimeout(flushTimer);
    flushTimer = undefined;
    let chars = 0;
    for (const run of runs.values()) {
      if (!run.pending.length) continue;
      const pending = run.pending;
      run.pending = [];
      for (const { stream, data } of pending) {
        chars += data.length;
        run.handlers.onOutput(data, stream);
      }
    }
    if (chars) transport?.post({ type: 'ack', chars });
  };

  const cwdOf = (run: ActiveRun) => sessions.get(run.session)?.cwd ?? root;

  const finishRun = (run: ActiveRun, result: HostRunResult) => {
    clearTimeout(run.killTimer);
    runs.delete(run.id);
    run.resolve(result);
  };

  const fail = (reason: SandboxError) => {
    error = reason;
    setStatus('failed');
    settleOps();
    for (const run of [...runs.values()]) finishRun(run, { exitCode: 1, cwd: cwdOf(run), interrupted: 'unavailable' });
  };

  const launch = () => {
    generation += 1;
    const current = generation;
    spawn({ sameOrigin: triedSameOrigin }).then(
      (next) => {
        if (current !== generation || disposed()) {
          next.terminate();
          return;
        }
        transport = next;
        isolation = next.isolation;
        next.onmessage = (message) => { if (current === generation) handle(message); };
        const { files, dirs } = snapshot();
        next.post({ type: 'init', root, files, dirs, sessions: [...sessions].map(([session, state]) => ({ session, ...state })) });
        notify();
      },
      (reason: unknown) => {
        if (current !== generation || disposed()) return;
        fail(reason instanceof SandboxError ? reason : new SandboxError('worker', messageOf(reason), { cause: reason }));
      },
    );
  };

  const replaceWorker = (blocked?: ActiveRun) => {
    cancelFetches();
    transport?.terminate();
    transport = null;
    settleOps();
    staleTimers = false;
    // The new Worker starts from the files as they are now, and every run is about to be over.
    outbox = outbox.filter(([message]) => message.type === 'open-session' || message.type === 'close-session');
    flushOutput();
    error = null;
    setStatus('restarting');
    for (const run of [...runs.values()]) {
      finishRun(run, { exitCode: run === blocked ? 130 : 137, cwd: cwdOf(run), interrupted: run === blocked ? 'unresponsive' : 'restarted' });
    }
    launch();
  };

  function handle(message: RuntimeMessage) {
    switch (message.type) {
      case 'fetch': {
        const request = message.request;
        const target = transport;
        if (!Number.isSafeInteger(message.id) || fetches.has(message.id)) return;
        if (!isFetchRequest(request)) {
          target?.post({ type: 'fetch-result', id: message.id, error: 'The request was not well formed.' });
          return;
        }
        const controller = new AbortController();
        fetches.set(message.id, controller);
        void Promise.resolve().then(() => {
          controller.signal.throwIfAborted();
          if (!options.onFetch) throw new Error('This page answers no requests for the sandbox.');
          return options.onFetch(request, controller.signal);
        }).then(
          (response) => { if (!controller.signal.aborted) target?.post({ type: 'fetch-result', id: message.id, response }); },
          (reason: unknown) => { if (!controller.signal.aborted) target?.post({ type: 'fetch-result', id: message.id, error: messageOf(reason) }); },
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
      case 'failed': {
        const why = typeof message.message === 'string' ? message.message : 'The runtime failed to start';
        // Started with an origin of its own, it can load but not always finish: its chunks may be refused. Where the
        // caller allowed it, try once without.
        if (isolation === 'opaque-origin' && options.fallback && !triedSameOrigin) {
          triedSameOrigin = true;
          replaceWorker();
          return;
        }
        transport?.terminate();
        transport = null;
        fail(new SandboxError('runtime', isolation === 'opaque-origin'
          ? `The runtime could not start in the isolated Worker: ${why}. Every file the Worker imports must be served with Access-Control-Allow-Origin.`
          : `The runtime could not start: ${why}`));
        return;
      }
      case 'output': {
        const run = runs.get(message.id);
        if (!run || typeof message.data !== 'string') return;
        const stream = message.stream === 'stderr' ? 'stderr' : 'stdout';
        const last = run.pending.at(-1);
        if (last && last.stream === stream) last.data += message.data;
        else run.pending.push({ stream, data: message.data });
        flushTimer ??= setTimeout(flushOutput, OUTPUT_EVERY_MS);
        return;
      }
      case 'reading':
        runs.get(message.id)?.handlers.onReading?.(!!message.reading);
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
        const op = pendingOps.get(message.seq);
        if (!op) return;
        pendingOps.delete(message.seq);
        if (inFlight.get(op.path) === message.seq) inFlight.delete(op.path);
        if (typeof message.error === 'string') op.reject(new SandboxError('files', message.error));
        else op.resolve();
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
      if (status !== 'idle') return;
      setStatus('loading');
      launch();
    },
    restart() {
      if (disposed()) return;
      if (status === 'idle') {
        setStatus('loading');
        launch();
        return;
      }
      replaceWorker();
    },
    dispose() {
      if (disposed()) return;
      cancelFetches();
      generation += 1;
      clearTimeout(flushTimer);
      transport?.terminate();
      transport = null;
      outbox = [];
      const pending = [...runs.values()];
      setStatus('disposed');
      settleOps(new SandboxError('disposed', 'The sandbox has been disposed.'));
      for (const run of pending) finishRun(run, { exitCode: 137, cwd: root, interrupted: 'unavailable' });
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
    run(session, line, handlers) {
      const id = nextRun;
      nextRun += 1;
      let run: ActiveRun | undefined;
      const done = new Promise<HostRunResult>((resolve) => {
        run = { id, session, handlers, resolve, pending: [], aborted: false };
        runs.set(id, run);
      });
      if (status === 'idle' || status === 'failed' || status === 'disposed') {
        finishRun(run as unknown as ActiveRun, { exitCode: 1, cwd: sessions.get(session)?.cwd ?? root, interrupted: 'unavailable' });
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
    write: (path, data) => sendFileOp(path, (seq) => ({ type: 'write', seq, path, data })),
    mkdir: (path) => sendFileOp(path, (seq) => ({ type: 'mkdir', seq, path })),
    rename: (from, to) => sendFileOp(to, (seq) => ({ type: 'rename', seq, from, to })),
    remove: (path) => sendFileOp(path, (seq) => ({ type: 'remove', seq, path })),
  };
}
