/* @internal The page's side of the Worker: it starts it, runs commands on it, and when a command won't stop, replaces
   it. Nothing loads until it starts, and it asks for the files to start a Worker with each time, so a Worker can be
   thrown away. It also holds the one rule the library is for: when a Worker of the page's origin may be given the
   files (see "Where the code may run" below). */
import { normalizePath } from './disk';
import { SandboxError, messageOf } from './error';
import type { SandboxExit, SandboxFetchRequest, SandboxFetchResponse, SandboxFileData, SandboxIsolation, SandboxStatus } from './model';
import type { FileEntry, FsBatch, HostMessage, RuntimeMessage, SessionState } from './protocol';

export interface SandboxTransport {
  /** Where this Worker runs: what it reported of itself before it was given anything. */
  isolation: SandboxIsolation;
  /** Whether the Worker's file hands some requests to the page (`hostFetch`). It said so before anything ran in it. */
  hostFetch: boolean;
  post: (message: HostMessage, transfer?: Transferable[]) => void;
  terminate: () => void;
  onmessage: ((message: RuntimeMessage) => void) | null;
  /** An error of the Worker's own got past its code: it broke, or was made to look broken. */
  onerror: ((message: string) => void) | null;
}

export interface SpawnRequest {
  /** The only place the Worker may run. The start fails rather than land anywhere else. */
  only?: SandboxIsolation;
  /** Aborted when the start is no longer wanted: whatever Worker is being started is ended. */
  signal?: AbortSignal;
}

/** Starts a Worker and resolves once its module is listening. Nothing has been sent to it. */
export type SpawnTransport = (request?: SpawnRequest) => Promise<SandboxTransport>;

export interface HostRunResult extends SandboxExit {
  cwd: string;
}

export interface HostRunHandle {
  done: Promise<HostRunResult>;
  /** Ctrl-C: asks the command to stop, and replaces the Worker if it doesn't. A command that has not reached a Worker
   *  yet is taken back instead. */
  abort: () => void;
}

export interface HostRunHandlers {
  onOutput: (data: string, stream: 'stdout' | 'stderr') => void;
  /** Says when a script starts or stops reading its input: `input` before that goes nowhere. */
  onReading?: (reading: boolean) => void;
}

export interface SandboxHost {
  readonly status: SandboxStatus;
  /** Where code runs: set when a Worker is ready, kept while it is replaced, `null` once the sandbox has failed. */
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
  /** Each tells the Worker of a change the page's copy of the disk already has. They wait for nothing: a Worker takes
   *  its messages in order, so a command sent after a change runs after it, and a Worker that is replaced starts from
   *  the page's copy. */
  write: (path: string, data: SandboxFileData) => void;
  mkdir: (path: string) => void;
  rename: (from: string, to: string) => void;
  remove: (path: string) => void;
}

export interface SandboxHostOptions {
  root: string;
  spawn: SpawnTransport;
  /** Where the caller asked for the code to run. */
  isolation: SandboxIsolation;
  /** Whether a Worker of the page's origin may stand in for an isolated one that can't be started. */
  fallback: boolean;
  /** Every file and folder, to start a Worker with. */
  snapshot: () => { files: FileEntry[]; dirs: string[] };
  /** Commands changed the disk. */
  onFiles: (batch: FsBatch) => void;
  /** Answers the requests the Worker hands to the page. */
  onFetch?: (request: SandboxFetchRequest, signal: AbortSignal) => Promise<SandboxFetchResponse>;
  /** How long a command gets to stop after Ctrl-C before its Worker is replaced, ms. Not finite: for ever. */
  killAfter?: number;
  /** How long the runtime gets to start in a Worker that has been given the files, ms. Not finite: for ever. */
  startTimeout?: number;
}

const OUTPUT_EVERY_MS = 16;

/* The Worker's own code stops posting output once 8 MB of it has gone unanswered (serve.ts). That code shares a global
   with what it runs, which can post for itself, so the page counts too: a Worker with more than twice that waiting to
   be taken is not the library's code any more, and is replaced. */
const MAX_UNTAKEN = 16 * 1024 * 1024;

/* What arrives is untrusted: a package runs in that Worker and can post anything. Only well-formed paths and data get
   through to the page's copy of the disk; output and exit codes for commands that aren't running are dropped where
   they're handled. */

/** A path the page's copy of the disk can hold: absolute, written the one way a path is written (no `.` or `..`, no
 *  doubled or trailing slash), and not the root. */
const isPath = (value: unknown): value is string => typeof value === 'string' && value.length > 1 && value.startsWith('/') && normalizePath(value) === value;
const isFileData = (value: unknown): value is SandboxFileData => typeof value === 'string' || value instanceof Uint8Array;

export function sanitizeBatch(batch: unknown): FsBatch | null {
  const b = batch as Partial<FsBatch> | null;
  if (!b || !Array.isArray(b.changed) || !Array.isArray(b.removed) || !Array.isArray(b.dirs) || !Array.isArray(b.removedDirs)) return null;
  return {
    changed: b.changed.filter((entry) => isPath(entry?.path) && isFileData(entry?.data)).map(({ path, data }) => ({ path, data })),
    removed: b.removed.filter(isPath),
    dirs: b.dirs.filter(isPath),
    removedDirs: b.removedDirs.filter(isPath),
  };
}

const REDIRECTS: unknown[] = ['follow', 'error', 'manual'];
const NOT_WELL_FORMED = 'The request was not well formed.';
const NOT_HTTP = 'The address must be an absolute http: or https: URL.';

/** The request as the page's handler gets it: a new object of the five fields, each checked, so that nothing else the
 *  Worker put in its message comes along. The address is the browser's reading of it, the one `fetch` would use. Or why
 *  not, as a string. */
function fetchRequestOf(request: unknown): SandboxFetchRequest | string {
  const r = request as Partial<SandboxFetchRequest> | null;
  if (!r || typeof r !== 'object' || typeof r.url !== 'string' || typeof r.method !== 'string' || !Array.isArray(r.headers)
    || !(r.body === null || r.body instanceof Uint8Array) || !REDIRECTS.includes(r.redirect)) return NOT_WELL_FORMED;
  const headers: Array<[string, string]> = [];
  for (const header of r.headers as unknown[]) {
    if (!Array.isArray(header) || header.length !== 2 || typeof header[0] !== 'string' || typeof header[1] !== 'string') return NOT_WELL_FORMED;
    headers.push([header[0], header[1]]);
  }
  let url: URL;
  try {
    url = new URL(r.url);
  } catch {
    return NOT_HTTP;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return NOT_HTTP;
  return { url: url.href, method: r.method, headers, body: r.body, redirect: r.redirect as RequestRedirect };
}

/** A shell's environment as a command left it: names to strings, and nothing else a Worker may have put there. */
function envOf(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const env: Record<string, string> = {};
  for (const [name, text] of Object.entries(value)) if (typeof text === 'string') env[name] = text;
  return env;
}

export function createSandboxHost(options: SandboxHostOptions): SandboxHost {
  const { root, spawn, snapshot, onFiles, killAfter = 800, startTimeout = 30_000 } = options;
  let status: SandboxStatus = 'idle';
  let isolation: SandboxIsolation | null = null;
  let error: SandboxError | null = null;
  /** The Worker that has been given the files. */
  let transport: SandboxTransport | null = null;
  /** Bumped by each start, so what an old Worker's start resolves to can be ignored. */
  let generation = 0;
  /** The start that is under way, until its Worker has answered. */
  let starting: AbortController | null = null;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
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
  /** A Worker has its files and has not said it is ready: nothing a sandbox runs has run in it. */
  const isStarting = () => status === 'loading' || status === 'restarting';

  /* ── Where the code may run ──
     The files are given (`init`) to a Worker of the page's origin in two cases, and what a sandbox runs has a say in
     neither:

     1. the caller asked for one: `isolation: 'same-origin'`;
     2. the caller allowed one, `fallback: 'same-origin'`, no Worker of this sandbox has ever been ready, and an
        isolated Worker could not be started for this start: its module would not load (spawn.ts), or it loaded and
        could not start the runtime (`couldNotStart` below).

     Sandboxed code runs only in a Worker that has said `ready`: commands are sent after that, and nothing on the disk
     is run before one is. So everything in case 2 happens before any of that code has run anywhere in this sandbox.

     The first Worker to be ready settles where the sandbox runs, for good. Every later Worker is asked for that
     isolation and no other, and a start that can't have it fails. From then on nothing a Worker posts, and no way it
     stops answering, moves the code to the page's origin: a `failed` from a Worker that is ready is not the library's
     message and is dropped, and a sandbox that has run isolated only ever asks for an isolated Worker, because its
     files may now hold what that code wrote. `mayRunIn` is the last check before a Worker gets the files, whatever
     the spawner returned. */
  let settled: SandboxIsolation | null = null;
  /** This start is the one try in a Worker of the page's origin, after an isolated Worker could not start. */
  let fallingBack = false;
  const mayRunIn = (got: SandboxIsolation) => {
    if (settled) return got === settled;
    return got === 'opaque-origin' || options.isolation === 'same-origin' || options.fallback;
  };

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
  /** Characters of output that have arrived and not been handed on. */
  let untaken = 0;
  /** A stopped command can leave timers going, with no way to reach them but to replace the Worker. */
  let staleTimers = false;

  /* Changes the page has sent and the Worker hasn't confirmed: what it reports about those paths predates what's on
     its way. */
  let nextSeq = 1;
  const inFlight = new Map<string, number>();
  const unconfirmed = new Map<number, string>();

  const send = (message: HostMessage, transfer?: Transferable[]) => {
    if (transport && status === 'ready') transport.post(message, transfer);
    else if (isStarting()) outbox.push([message, transfer]);
  };

  const tellOfChange = (path: string, make: (seq: number) => HostMessage) => {
    // No Worker has the files yet: one will be started from the page's copy, which has the change.
    if (!transport) return;
    const seq = nextSeq;
    nextSeq += 1;
    inFlight.set(path, seq);
    unconfirmed.set(seq, path);
    send(make(seq));
  };

  /** Ends the Worker, or the start of one, and stops listening to it. */
  const endWorker = () => {
    clearTimeout(startTimer);
    starting?.abort();
    starting = null;
    // A Worker that starts from the files as they are now has every change that was on its way.
    inFlight.clear();
    unconfirmed.clear();
    if (!transport) return;
    transport.onmessage = null;
    transport.onerror = null;
    transport.terminate();
    transport = null;
  };

  const flushOutput = () => {
    clearTimeout(flushTimer);
    flushTimer = undefined;
    untaken = 0;
    let chars = 0;
    for (const run of [...runs.values()]) {
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
    endWorker();
    cancelFetches();
    error = reason;
    // Nothing runs anywhere now.
    isolation = null;
    fallingBack = false;
    setStatus('failed');
    for (const run of [...runs.values()]) finishRun(run, { exitCode: 1, cwd: cwdOf(run), interrupted: 'unavailable' });
  };

  const launch = () => {
    if (disposed()) return;
    generation += 1;
    const current = generation;
    starting?.abort();
    const controller = new AbortController();
    starting = controller;
    const only = settled ?? (fallingBack ? 'same-origin' : undefined);
    spawn({ only, signal: controller.signal }).then(
      (next) => {
        if (current !== generation || disposed() || controller.signal.aborted) {
          next.terminate();
          return;
        }
        starting = null;
        if (!mayRunIn(next.isolation)) {
          next.terminate();
          fail(new SandboxError('isolation', settled
            ? `The sandbox runs in a Worker of ${settled === 'opaque-origin' ? 'an origin of its own' : 'the page\'s origin'}, and was handed a different one. Nothing was run in it.`
            : 'The sandbox was handed a Worker of the page\'s origin, which it was not allowed. Nothing was run in it.'));
          return;
        }
        transport = next;
        next.onmessage = (message) => { if (current === generation) handle(message); };
        next.onerror = (message) => { if (current === generation) workerBroke(message); };
        const { files, dirs } = snapshot();
        next.post({ type: 'init', root, files, dirs, sessions: [...sessions].map(([session, state]) => ({ session, ...state })) });
        if (Number.isFinite(startTimeout)) {
          startTimer = setTimeout(() => { if (current === generation) couldNotStart(`it did not start within ${Math.round(startTimeout / 1000)} s`); }, Math.max(0, startTimeout));
        }
      },
      (reason: unknown) => {
        if (current !== generation || disposed() || controller.signal.aborted) return;
        starting = null;
        fail(reason instanceof SandboxError ? reason : new SandboxError('worker', messageOf(reason), { cause: reason }));
      },
    );
  };

  /** The Worker that was given the files did not get as far as `ready`: nothing a sandbox runs has run in it. */
  const couldNotStart = (why: string) => {
    if (!transport || !isStarting()) return;
    const was = transport.isolation;
    endWorker();
    // Case 2 of the rule above, and once for a start.
    if (was === 'opaque-origin' && !settled && options.fallback && !fallingBack) {
      fallingBack = true;
      launch();
      return;
    }
    fail(new SandboxError('runtime', was === 'opaque-origin'
      ? `The runtime could not start in the isolated Worker: ${why}. Every file the Worker imports must be served with Access-Control-Allow-Origin.`
      : `The runtime could not start: ${why}`));
  };

  const replaceWorker = (blocked?: ActiveRun) => {
    if (disposed()) return;
    cancelFetches();
    endWorker();
    staleTimers = false;
    fallingBack = false;
    // The new Worker starts from the files as they are now, and every run is about to be over.
    outbox = outbox.filter(([message]) => message.type === 'open-session' || message.type === 'close-session');
    flushOutput();
    // An output handler may have disposed of the sandbox.
    if (disposed()) return;
    error = null;
    setStatus('restarting');
    for (const run of [...runs.values()]) {
      finishRun(run, { exitCode: run === blocked ? 130 : 137, cwd: cwdOf(run), interrupted: run === blocked ? 'unresponsive' : 'restarted' });
    }
    launch();
  };

  /** An error of the Worker's own reached the page. While it starts, the start has failed. Later, the Worker's own
   *  code would have kept a script's error to itself, so the Worker is in no known state: it is replaced, with the
   *  isolation it had. */
  const workerBroke = (message: string) => {
    if (isStarting()) couldNotStart(message);
    else if (status === 'ready') replaceWorker();
  };

  function handle(message: RuntimeMessage) {
    if (!message || typeof message !== 'object') return;
    switch (message.type) {
      case 'fetch': {
        const target = transport;
        // Only a Worker whose file hands requests to the page can ask, and once for an id.
        if (!target?.hostFetch || !Number.isSafeInteger(message.id) || fetches.has(message.id)) return;
        const request = fetchRequestOf(message.request);
        if (typeof request === 'string') {
          target.post({ type: 'fetch-result', id: message.id, error: request });
          return;
        }
        const controller = new AbortController();
        fetches.set(message.id, controller);
        void Promise.resolve().then(() => {
          controller.signal.throwIfAborted();
          if (!options.onFetch) throw new Error('This page answers no requests for the sandbox.');
          return options.onFetch(request, controller.signal);
        }).then(
          (response) => { if (!controller.signal.aborted) target.post({ type: 'fetch-result', id: message.id, response }); },
        ).catch(
          // The handler's refusal, or an answer that can't be sent.
          (reason: unknown) => { if (!controller.signal.aborted) target.post({ type: 'fetch-result', id: message.id, error: messageOf(reason) }); },
        ).finally(() => { if (fetches.get(message.id) === controller) fetches.delete(message.id); });
        return;
      }
      case 'cancel-fetch':
        fetches.get(message.id)?.abort();
        fetches.delete(message.id);
        return;
      case 'ready': {
        // Only a Worker that is starting becomes ready.
        if (!transport || !isStarting()) return;
        clearTimeout(startTimer);
        settled ??= transport.isolation;
        isolation = settled;
        fallingBack = false;
        error = null;
        // What was waiting goes first: whoever hears `ready` and sends something must find it behind what was sent before.
        const queued = outbox;
        outbox = [];
        for (const [next, transfer] of queued) transport.post(next, transfer);
        setStatus('ready');
        return;
      }
      case 'failed':
        /* The library's Worker code says this once, in place of `ready`. From a Worker that is ready it is something
           sandboxed code posted, and it changes nothing: above all, not where the code runs. */
        if (!isStarting()) return;
        couldNotStart(typeof message.message === 'string' ? message.message : 'The runtime failed to start');
        return;
      case 'output': {
        const run = runs.get(message.id);
        if (!run || typeof message.data !== 'string') return;
        if (untaken + message.data.length > MAX_UNTAKEN) {
          replaceWorker();
          return;
        }
        untaken += message.data.length;
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
        // An output handler may have ended it, by disposing of the sandbox or restarting it.
        if (!runs.has(run.id)) return;
        const state = sessions.get(run.session);
        const cwd = typeof message.cwd === 'string' && message.cwd.startsWith('/') ? normalizePath(message.cwd) : state?.cwd ?? root;
        if (state) {
          state.cwd = cwd;
          state.env = envOf(message.env) ?? state.env;
        }
        finishRun(run, { exitCode: Number.isInteger(message.exitCode) ? message.exitCode : 1, cwd });
        if (staleTimers && !runs.size) replaceWorker();
        return;
      }
      case 'fs': {
        const batch = sanitizeBatch(message.batch);
        if (!batch) return;
        // What the page has sent and the Worker has not confirmed is newer than anything it says about those paths.
        const settledPath = (path: string) => !inFlight.has(path);
        const holdsNone = (dir: string) => ![...inFlight.keys()].some((path) => path === dir || path.startsWith(`${dir}/`));
        onFiles({
          changed: batch.changed.filter(({ path }) => settledPath(path)),
          removed: batch.removed.filter(settledPath),
          dirs: batch.dirs.filter(settledPath),
          // A folder goes with all that is in it, and that must not take what is on its way there.
          removedDirs: batch.removedDirs.filter(holdsNone),
        });
        return;
      }
      case 'applied': {
        // Applied or refused, the Worker has dealt with it. After a refusal it reports what its disk has instead.
        const path = unconfirmed.get(message.seq);
        if (path === undefined) return;
        unconfirmed.delete(message.seq);
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
      endWorker();
      outbox = [];
      const pending = [...runs.values()];
      setStatus('disposed');
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
          // Still waiting for a Worker: it never started, so there is nothing to ask and nothing to replace.
          const waiting = outbox.findIndex(([message]) => message.type === 'run' && message.id === id);
          if (waiting >= 0) {
            outbox.splice(waiting, 1);
            finishRun(run, { exitCode: 130, cwd: cwdOf(run) });
            return;
          }
          run.aborted = true;
          staleTimers = true;
          send({ type: 'abort', id });
          const target = run;
          if (Number.isFinite(killAfter)) run.killTimer = setTimeout(() => { if (runs.has(id)) replaceWorker(target); }, Math.max(0, killAfter));
        },
      };
    },
    input(session, data) {
      send({ type: 'input', session, data });
    },
    write: (path, data) => tellOfChange(path, (seq) => ({ type: 'write', seq, path, data })),
    mkdir: (path) => tellOfChange(path, (seq) => ({ type: 'mkdir', seq, path })),
    rename: (from, to) => tellOfChange(to, (seq) => ({ type: 'rename', seq, from, to })),
    remove: (path) => tellOfChange(path, (seq) => ({ type: 'remove', seq, path })),
  };
}
