/* The Node runtime and everything it runs. It lives in a Worker, for two reasons. A script can't freeze the page: a
   `while (true)` only stops this thread, and the page can throw the whole Worker away. And when it can be started from a
   `data:` URL (runtime.ts), this Worker has an origin of its own, so nothing that runs here, including a package from npm,
   can read the site's storage. */
import type { ContainerInstance, PackageManager as PackageManagerClass, TerminalSession } from '@agent-wasm/core';
import type { FileData, FileEntry, FsBatch, HostMessage, RuntimeMessage, SessionState } from './protocol';
import { npmInstallOf, npmScriptHeader, npmScriptOf, splitCommandLine, unstreamed, type PackageManifest } from './shell-line';

const scope = globalThis as unknown as {
  postMessage: (message: RuntimeMessage, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<HostMessage>) => void) | null;
  origin: string;
};
const post = (message: RuntimeMessage, transfer?: Transferable[]) => scope.postMessage(message, transfer);

/* The runtime tells a browser from Node by `window`, and without one it reaches for `node:fs` to load ES modules. */
(globalThis as { window?: unknown }).window ??= globalThis;

/* `process.exit()` throws, to stop the script. From inside an event handler that lands in the runtime's emitter, which logs
   it as an error it isn't. */
const logError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  if (args[0] === 'Error in event listener:' && /^Process exited with code/.test((args[1] as Error | undefined)?.message ?? '')) return;
  logError(...args);
};

let container: ContainerInstance;
let PackageManager: typeof PackageManagerClass;
let root = '/';
const sessions = new Map<string, TerminalSession>();

/* ── Files ──
   The page keeps a copy of every file, so that it can show them without asking and start another Worker from them. A
   `change` or `delete` event sends a file over at once, even if the script then blocks this thread for good. The disk has
   no event for folders or renames, so a walk over it, while something runs and when it ends, picks up whatever events
   didn't say. */

const SKIP = new Set(['/dev', '/proc', '/sys']);
/** Where the runtime puts the code of a `node -e`. It's gone again when the command is, and nobody needs to see it. */
const EVAL_FILE = '/__almostnode_eval__.js';
const evalFiles = new Set<string>();
const decoder = new TextDecoder('utf-8', { fatal: true });

const dataOf = (path: string): FileData => {
  const bytes = container.vfs.readFileSync(path) as Uint8Array;
  try {
    return decoder.decode(bytes);
  } catch {
    return bytes.slice();
  }
};

const send = (batch: FsBatch) => {
  const transfer = batch.changed.flatMap(({ data }) => (typeof data === 'string' ? [] : [data.buffer as ArrayBuffer]));
  post({ type: 'fs', batch }, transfer);
};

/** Path → what it looked like when the page last heard about it; '' for a folder. */
const known = new Map<string, string>();

const signature = (path: string) => {
  const stat = container.vfs.statSync(path) as { size: number; mtimeMs: number; ino?: number };
  return `${stat.ino ?? ''}:${stat.size}:${stat.mtimeMs}`;
};

/** A file event from a script. What's under node_modules arrives by the thousand, so that waits for a batch. */
const pendingChanges = new Set<string>();
let pendingTimer: ReturnType<typeof setTimeout> | undefined;

function flushChanges() {
  clearTimeout(pendingTimer);
  pendingTimer = undefined;
  if (!pendingChanges.size) return;
  const changed: FileEntry[] = [];
  for (const path of pendingChanges) {
    if (!container.vfs.existsSync(path)) continue;
    changed.push({ path, data: dataOf(path) });
    known.set(path, signature(path));
  }
  pendingChanges.clear();
  if (changed.length) send({ changed, removed: [], dirs: [], removedDirs: [] });
}

/** Set while applying what the page asked for, which it doesn't need to hear about again. */
let applying = false;

function watchFiles() {
  const { vfs } = container;
  vfs.on('change', (path: string) => {
    if (applying) return;
    if (path.endsWith(EVAL_FILE)) {
      evalFiles.add(path);
      return;
    }
    pendingChanges.add(path);
    if (path.includes('/node_modules/')) pendingTimer ??= setTimeout(flushChanges, 100);
    else flushChanges();
  });
  vfs.on('delete', (path: string) => {
    if (applying || path.endsWith(EVAL_FILE)) return;
    pendingChanges.delete(path);
    known.delete(path);
    send({ changed: [], removed: [path], dirs: [], removedDirs: [] });
  });
}

function walkFiles(visit: (path: string, isDirectory: boolean) => void) {
  const { vfs } = container;
  const walk = (dir: string) => {
    for (const name of vfs.readdirSync(dir) as string[]) {
      const path = dir === '/' ? `/${name}` : `${dir}/${name}`;
      if (SKIP.has(path) || path.endsWith(EVAL_FILE)) continue;
      let isDirectory: boolean;
      try {
        isDirectory = (vfs.statSync(path) as { isDirectory: () => boolean }).isDirectory();
      } catch {
        continue;
      }
      visit(path, isDirectory);
      if (isDirectory) walk(path);
    }
  };
  walk('/');
}

/** Compares the disk with what the page has heard, and tells it the difference. */
function syncFiles() {
  flushChanges();
  const seen = new Set<string>();
  const batch: FsBatch = { changed: [], removed: [], dirs: [], removedDirs: [] };
  walkFiles((path, isDirectory) => {
    seen.add(path);
    if (isDirectory) {
      if (known.get(path) !== '') {
        known.set(path, '');
        batch.dirs.push(path);
      }
      return;
    }
    const now = signature(path);
    if (known.get(path) !== now) {
      known.set(path, now);
      batch.changed.push({ path, data: dataOf(path) });
    }
  });
  for (const [path, was] of known) {
    if (seen.has(path)) continue;
    known.delete(path);
    (was === '' ? batch.removedDirs : batch.removed).push(path);
  }
  if (batch.changed.length || batch.removed.length || batch.dirs.length || batch.removedDirs.length) send(batch);
}

let syncTimer: ReturnType<typeof setInterval> | undefined;

/* ── Output ──
   A script in a tight loop could log faster than the page can draw. Writes go over one at a time until there have been
   many in a moment, and after that together; and once a good deal has gone unanswered the rest is dropped and counted,
   so the page is never buried, however long a loop runs before someone presses Ctrl-C. */

const MAX_UNANSWERED = 8 * 1024 * 1024;
const BURST_MS = 16;
const BURST_WRITES = 32;

interface Run {
  controller: AbortController;
  session: TerminalSession;
  dropped: number;
  /** What the page has last been told about its input. */
  reading: boolean;
}
const runs = new Map<number, Run>();

let unanswered = 0;
let burstStart = 0;
let burstWrites = 0;
const queued: Array<{ id: number; stream: 'stdout' | 'stderr'; data: string }> = [];
let queuedTimer: ReturnType<typeof setTimeout> | undefined;

function flushOutput() {
  clearTimeout(queuedTimer);
  queuedTimer = undefined;
  for (const { id, stream, data } of queued.splice(0)) {
    unanswered += data.length;
    post({ type: 'output', id, stream, data });
  }
}

function emit(id: number, stream: 'stdout' | 'stderr', data: string) {
  const run = runs.get(id);
  // A timer left over from a command that has been stopped.
  if (!run || !data) return;
  if (unanswered > MAX_UNANSWERED) {
    run.dropped += data.length;
    return;
  }
  const last = queued[queued.length - 1];
  if (last && last.id === id && last.stream === stream) last.data += data;
  else queued.push({ id, stream, data });
  const now = performance.now();
  if (now - burstStart > BURST_MS) {
    burstStart = now;
    burstWrites = 0;
  }
  burstWrites += 1;
  if (burstWrites <= BURST_WRITES) flushOutput();
  else queuedTimer ??= setTimeout(flushOutput, BURST_MS);
}

function reportDropped() {
  for (const [id, run] of runs) {
    if (!run.dropped) continue;
    const dropped = run.dropped;
    run.dropped = 0;
    emit(id, 'stderr', `\n[${dropped.toLocaleString('en-US')} characters of output were dropped]\n`);
  }
}

/* ── Who's reading the keyboard ──
   A terminal keeps what's typed until something reads it. The runtime has nowhere to keep it, so the page holds on to keys
   until a script has a listener on its stdin. The runtime says which process it's on by this global. */

interface ScriptProcess {
  stdin?: { listenerCount?: (event: string) => number };
}
const processes = new Set<ScriptProcess>();
let activeProcess: ScriptProcess | undefined;
Object.defineProperty(globalThis, '__almostnodeActiveProcess', {
  configurable: true,
  get: () => activeProcess,
  set(next: ScriptProcess | undefined) {
    activeProcess = next;
    if (next) processes.add(next);
  },
});

const someoneIsReading = () => {
  for (const { stdin } of processes) {
    for (const event of ['data', 'readable', 'keypress']) if ((stdin?.listenerCount?.(event) ?? 0) > 0) return true;
  }
  return false;
};

let readingTimer: ReturnType<typeof setInterval> | undefined;

function reportReading() {
  const reading = someoneIsReading();
  for (const [id, run] of runs) {
    if (run.reading === reading) continue;
    run.reading = reading;
    post({ type: 'reading', id, reading });
  }
}

/* ── Commands ── */

function manifestAt(cwd: string): PackageManifest {
  try {
    return JSON.parse(container.vfs.readFileSync(`${cwd}/package.json`.replace(/\/+/g, '/'), 'utf8') as string) as PackageManifest;
  } catch {
    return {};
  }
}

/** npm's own install prints nothing until it's over; this one prints as it goes. */
async function npmInstall(id: number, cwd: string, packages: string[], dev: boolean) {
  const manager = new PackageManager(container.vfs, { cwd, installMode: 'main-thread' });
  const say = (message: string) => emit(id, 'stdout', `${message}\n`);
  // What it says about each package is too much for an install of any size; and it finishes by saying what's added.
  const progress = (message: string) => {
    if (/^Resolving\s.*[^.]$|^\s+Downloading\s|^\s*Skipping\s|^Installed\s/.test(message)) return;
    say(message.replace(/^Installing 1 packages/, 'Installing 1 package'));
  };
  try {
    if (packages.length) {
      for (const spec of packages) {
        const { added } = await manager.install(spec, { save: true, saveDev: dev, onProgress: progress });
        say(`added ${added.length} package${added.length === 1 ? '' : 's'}`);
      }
    } else {
      const { added } = await manager.installFromPackageJson({ includeDev: true, onProgress: progress });
      say(`added ${added.length} package${added.length === 1 ? '' : 's'}`);
    }
    return 0;
  } catch (error) {
    emit(id, 'stderr', `npm ERR! ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

async function runOne(id: number, run: Run, line: string) {
  const { session, controller } = run;
  const cwd = session.getState().cwd;
  const install = npmInstallOf(line);
  if (install) return npmInstall(id, cwd, install.packages, install.dev);
  let stdout = '';
  let stderr = '';
  // npm prints the script's header when the script is over, and above it only once everything is collected.
  const script = npmScriptOf(line);
  const header = script ? npmScriptHeader(manifestAt(cwd), script) : null;
  if (header) {
    stderr += header;
    emit(id, 'stderr', header);
  }
  const result = await session.run(line, {
    signal: controller.signal,
    onStdout: (data) => { stdout += data; emit(id, 'stdout', data); },
    onStderr: (data) => { stderr += data; emit(id, 'stderr', data); },
  });
  // A line that ran a script reports only the script's output as it goes. The rest is in the result.
  emit(id, 'stdout', unstreamed(result.stdout, stdout));
  emit(id, 'stderr', unstreamed(result.stderr, stderr));
  return result.exitCode;
}

async function runLine(id: number, sessionId: string, line: string) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const run: Run = { controller: new AbortController(), session, dropped: 0, reading: false };
  runs.set(id, run);
  syncTimer ??= setInterval(syncFiles, 400);
  readingTimer ??= setInterval(reportReading, 40);
  let exitCode = 0;
  try {
    for (const segment of splitCommandLine(line)) {
      if (run.controller.signal.aborted) break;
      if (segment.when === 'ok' && exitCode !== 0) continue;
      if (segment.when === 'fail' && exitCode === 0) continue;
      exitCode = await runOne(id, run, segment.line);
    }
  } catch (error) {
    // Some of the runtime's commands throw instead of exiting non-zero.
    emit(id, 'stderr', `${error instanceof Error ? error.message : String(error)}\n`);
    exitCode = 1;
  }
  if (run.controller.signal.aborted) exitCode = 130;
  flushOutput();
  runs.delete(id);
  if (!runs.size) {
    for (const path of evalFiles) if (container.vfs.existsSync(path)) container.vfs.unlinkSync(path);
    evalFiles.clear();
    clearInterval(syncTimer);
    syncTimer = undefined;
    clearInterval(readingTimer);
    readingTimer = undefined;
    processes.clear();
  }
  syncFiles();
  const { cwd, env } = session.getState();
  post({ type: 'done', id, exitCode, cwd, env });
}

function openSession(id: string, state: SessionState) {
  const session = container.createTerminalSession({ cwd: state.cwd, env: state.env });
  session.resize(state.cols, state.rows);
  sessions.set(id, session);
}

/* ── What the page asks for ── */

function applied(seq: number, apply: () => void) {
  applying = true;
  try {
    apply();
    post({ type: 'applied', seq });
  } catch (error) {
    post({ type: 'applied', seq, error: error instanceof Error ? error.message : String(error) });
  } finally {
    applying = false;
  }
}

function removeTree(path: string) {
  const { vfs } = container;
  if (!vfs.existsSync(path)) return;
  if ((vfs.statSync(path) as { isDirectory: () => boolean }).isDirectory()) {
    for (const name of vfs.readdirSync(path) as string[]) removeTree(`${path}/${name}`);
    vfs.rmdirSync(path);
  } else {
    vfs.unlinkSync(path);
  }
  known.delete(path);
}

async function init(message: Extract<HostMessage, { type: 'init' }>) {
  root = message.root;
  const runtime = await import('@agent-wasm/core');
  PackageManager = runtime.PackageManager;
  container = runtime.createContainer({
    cwd: root,
    // This is already a Worker, and the runtime's own install Worker doesn't survive being bundled into this one.
    installMode: 'main-thread',
    // By default the runtime sends every request through a CORS proxy on someone else's server. npm's registry allows
    // browsers, and a script's own fetches are better refused by the browser than read by a third party.
    network: { proxy: { noProxy: '*' } },
  });
  const { vfs } = container;
  for (const dir of message.dirs) vfs.mkdirSync(dir, { recursive: true });
  for (const { path, data } of message.files) vfs.writeFileSync(path, data);
  walkFiles((path, isDirectory) => known.set(path, isDirectory ? '' : signature(path)));
  watchFiles();
  for (const { session, ...state } of message.sessions) openSession(session, state);
  post({ type: 'ready', origin: scope.origin });
}

scope.onmessage = ({ data: message }) => {
  switch (message.type) {
    case 'init':
      init(message).catch((error: unknown) => post({ type: 'failed', message: error instanceof Error ? error.message : String(error) }));
      return;
    case 'open-session':
      openSession(message.session, message.state);
      return;
    case 'close-session':
      sessions.get(message.session)?.dispose();
      sessions.delete(message.session);
      return;
    case 'run':
      void runLine(message.id, message.session, message.line);
      return;
    case 'input':
      sessions.get(message.session)?.sendInput(message.data);
      return;
    case 'abort':
      runs.get(message.id)?.controller.abort();
      return;
    case 'resize':
      sessions.get(message.session)?.resize(message.cols, message.rows);
      return;
    case 'ack':
      unanswered = Math.max(0, unanswered - message.chars);
      if (unanswered <= MAX_UNANSWERED) reportDropped();
      return;
    case 'write':
      applied(message.seq, () => {
        const parent = message.path.slice(0, message.path.lastIndexOf('/')) || '/';
        container.vfs.mkdirSync(parent, { recursive: true });
        container.vfs.writeFileSync(message.path, message.data);
        known.set(message.path, signature(message.path));
      });
      return;
    case 'mkdir':
      applied(message.seq, () => {
        container.vfs.mkdirSync(message.path, { recursive: true });
        known.set(message.path, '');
      });
      return;
    case 'rename':
      applied(message.seq, () => {
        // A new Worker started from the files after the move has nothing left to do.
        if (!container.vfs.existsSync(message.from)) return;
        container.vfs.renameSync(message.from, message.to);
        // Everything under it moved too; let the next walk see it as what the page already knows.
        for (const path of [...known.keys()]) {
          if (path === message.from || path.startsWith(`${message.from}/`)) {
            const moved = message.to + path.slice(message.from.length);
            known.set(moved, known.get(path) as string);
            known.delete(path);
          }
        }
      });
      return;
    case 'remove':
      applied(message.seq, () => {
        removeTree(message.path);
        for (const path of [...known.keys()]) if (path.startsWith(`${message.path}/`)) known.delete(path);
      });
      return;
  }
};

/* A script's uncaught error, from a timer or a callback: Node would print it and exit. */
(globalThis as unknown as { addEventListener: (type: string, listener: (event: ErrorEvent) => void) => void }).addEventListener('error', (event) => {
  event.preventDefault();
  const last = [...runs.keys()].at(-1);
  if (last !== undefined) emit(last, 'stderr', `${event.message}\n`);
});

post({ type: 'hello' });
