/* The block's default runtime: Node in a Worker on a virtual disk (see `runtime.worker.ts`), with a copy of every file here
   so that reading one never waits, and so that another Worker can start from them. Nothing else in the block knows
   anything in this folder is here: it's reached only through the `VSCodeRuntime` it returns.

   The runtime is @agent-wasm/core, the fork of almostnode this repository already depends on. `node -e`, a script with
   no output and a script that sets timers all need what the fork adds over the npm package. */
import type { TerminalCommandIO } from '@/lib/terminal-line';
import { toTerminalNewlines } from '@/lib/terminal-line';
import { ancestors, basename } from '../files';
import { createLineTerminal, createTerminalStream, type LineTerminal } from '../line-terminal';
import type {
  FileContent, RuntimeEntry, RuntimeFileEvent, RuntimeScriptList, RuntimeStatus, RuntimeTerminal, RuntimeTerminalOptions, VSCodeRuntime,
} from '../runtime';
import { ROOT, STARTER_PROJECT } from './project';
import type { FileData, FsBatch } from './protocol';
import { completeCommandLine, npmScriptCommand } from './shell-line';
import { createWorkerHost, spawnBrowserWorker, type RunResult, type SpawnWorker } from './worker-host';

export interface AlmostnodeRuntimeOptions {
  /** The files to start with: path relative to the root → text. Default: a small starter project. */
  project?: Record<string, string>;
  /** How to start the Worker. For tests. */
  spawn?: SpawnWorker;
}

const sameData = (a: FileData | undefined, b: FileData | undefined) => {
  if (a === undefined || b === undefined) return false;
  if (typeof a === 'string' || typeof b === 'string') return a === b;
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
};

const PLACE: Record<string, string> = {
  'opaque-origin': "Commands and the packages they install run in an isolated Worker with an origin of its own. They can't read this site's storage, cookies or page, or reach what you've signed in to here.",
  'same-origin': "This host won't load the runtime in an isolated Worker, so it runs as an ordinary Worker of this site. A package you install can't touch the page, cookies or localStorage, but it can read and change this site's IndexedDB and caches. Only install packages you trust here.",
};
const NETWORK = "Either way a command can reach the network, as far as the browser's CORS rules allow. A command that won't stop can't freeze this window: Ctrl-C replaces the Worker and keeps your files.";
const SAME_ORIGIN_WARNING = "\x1b[33mThis host won't load the runtime in an isolated Worker, so what runs here can reach this site's storage.\x1b[0m\n";

/** The block's default `VSCodeRuntime`. Nothing downloads until `start()`, and then only from this site. */
export function createAlmostnodeRuntime(options: AlmostnodeRuntimeOptions = {}): VSCodeRuntime {
  const root = ROOT;
  const files = new Map<string, FileData>();
  const dirs = new Set<string>([root]);
  for (const [relative, text] of Object.entries(options.project ?? STARTER_PROJECT)) {
    const path = `${root}/${relative}`;
    files.set(path, text);
    for (const dir of ancestors(path)) dirs.add(dir);
  }
  const manifest = `${root}/package.json`;

  const fileWatchers = new Set<(events: readonly RuntimeFileEvent[]) => void>();
  const scriptWatchers = new Set<() => void>();
  const statusWatchers = new Set<() => void>();
  const fire = (events: RuntimeFileEvent[]) => {
    if (!events.length) return;
    for (const listener of fileWatchers) listener(events);
    if (events.some((event) => (event.type === 'rename' ? event.from === manifest || event.to === manifest : event.path === manifest))) {
      for (const listener of scriptWatchers) listener();
    }
  };

  /** What commands did to the disk, as events. `mv a b` looks like one gone and one new with the same bytes. */
  const fromWorker = ({ changed, removed, dirs: madeDirs, removedDirs }: FsBatch) => {
    const events: RuntimeFileEvent[] = [];
    const moved = new Set<string>();
    const fresh = changed.filter(({ path }) => !files.has(path));
    for (const from of removed) {
      const was = files.get(from);
      const match = fresh.find(({ path, data }) => !moved.has(path) && sameData(was, data));
      if (!match) continue;
      moved.add(match.path);
      moved.add(from);
      files.delete(from);
      files.set(match.path, match.data);
      events.push({ type: 'rename', from, to: match.path });
    }
    for (const path of madeDirs) {
      if (dirs.has(path)) continue;
      dirs.add(path);
      events.push({ type: 'change', path, kind: 'directory' });
    }
    for (const { path, data } of changed) {
      if (moved.has(path) || sameData(files.get(path), data)) continue;
      files.set(path, data);
      for (const dir of ancestors(path)) dirs.add(dir);
      events.push({ type: 'change', path, kind: 'file' });
    }
    for (const path of removed) {
      if (moved.has(path) || !files.delete(path)) continue;
      events.push({ type: 'delete', path });
    }
    for (const path of removedDirs) {
      if (dirs.delete(path)) events.push({ type: 'delete', path });
    }
    fire(events);
  };

  const host = createWorkerHost({
    root,
    spawn: options.spawn ?? spawnBrowserWorker,
    snapshot: () => ({ files: [...files].map(([path, data]) => ({ path, data })), dirs: [...dirs] }),
    onFiles: fromWorker,
  });

  /* ── Status ── */

  /** Commands running, across terminals. */
  let busy = 0;
  let status: RuntimeStatus | null = null;
  const statusNow = (): RuntimeStatus => {
    if (status) return status;
    const isolation = host.isolation;
    const word = { off: 'Starting…', starting: 'Starting…', restarting: 'Restarting…', failed: 'Failed', ready: busy ? `Running${busy > 1 ? ` (${busy})` : ''}` : 'Ready' }[host.status];
    status = {
      state: host.status === 'ready' ? 'ready' : host.status === 'failed' ? 'failed' : 'starting',
      text: `Node: ${word}`,
      tone: isolation === 'opaque-origin' ? 'safe' : isolation === 'same-origin' ? 'warning' : 'neutral',
      title: `Node runtime: ${word}`,
      details: [
        ...(host.error ? [host.error] : []),
        isolation ? PLACE[isolation] : 'Nothing is running yet.',
        NETWORK,
      ],
      actions: [{ label: 'Restart runtime', run: () => host.restart() }],
    };
    return status;
  };
  const statusChanged = () => {
    status = null;
    for (const listener of statusWatchers) listener();
  };

  /* ── Terminals ── */

  const shells = new Set<LineTerminal>();
  let warned = false;
  const warnIfExposed = () => {
    if (warned || host.isolation !== 'same-origin') return;
    const first = shells.values().next().value;
    if (!first) return;
    warned = true;
    first.shell.write(SAME_ORIGIN_WARNING);
  };
  host.subscribe(() => {
    warnIfExposed();
    statusChanged();
  });

  let nextSession = 1;
  const newSession = (cols: number, rows: number) => {
    const session = `session-${nextSession}`;
    nextSession += 1;
    host.openSession(session, { cwd: root, cols, rows });
    return session;
  };

  const noticeOf = ({ restarted }: RunResult) => {
    if (restarted === 'blocked') return "\x1b[33mThat command wouldn't stop, so the runtime was restarted. Your files are kept.\x1b[0m\n";
    if (restarted !== 'other') return '';
    return host.status === 'failed'
      ? `\x1b[31mThe runtime didn't start: ${host.error ?? 'unknown error'}\x1b[0m\n`
      : '\x1b[33mThe runtime was restarted, which stopped this command.\x1b[0m\n';
  };

  /** One line, on a shell's session. */
  const runLine = async (session: string, line: string, io: TerminalCommandIO) => {
    busy += 1;
    statusChanged();
    // Keys go to a script once it's reading them. Until then the shell holds them, for it or for the next prompt.
    let stopListening = null as (() => void) | null;
    const run = host.run(session, line, (data) => io.write(data), (reading) => {
      stopListening?.();
      stopListening = reading ? io.onInput((data) => host.input(session, data)) : null;
    });
    const onAbort = () => run.abort();
    io.signal.addEventListener('abort', onAbort, { once: true });
    const result = await run.done;
    io.signal.removeEventListener('abort', onAbort);
    stopListening?.();
    busy -= 1;
    statusChanged();
    io.write(noticeOf(result));
    return result;
  };

  const openShell = ({ cols, rows }: RuntimeTerminalOptions): RuntimeTerminal => {
    const session = newSession(cols, rows);
    let cwd = root;
    let lastExit = 0;
    const prompt = () => {
      const name = basename(root);
      const inside = cwd === root || cwd.startsWith(`${root}/`);
      return `\x1b[32m${inside ? name + cwd.slice(root.length) : cwd}\x1b[0m ${lastExit ? '\x1b[31m' : '\x1b[2m'}$\x1b[0m `;
    };
    const terminal = createLineTerminal({
      size: { cols, rows },
      prompt,
      async onCommand(line, io) {
        const command = line.trim();
        if (command === 'clear' || command === 'reset') {
          io.clear();
          return;
        }
        if (command === 'exit') {
          // On a later tick: the shell is still finishing this line.
          setTimeout(() => terminal.exit(0));
          return;
        }
        const result = await runLine(session, line, io);
        cwd = result.cwd;
        lastExit = result.exitCode;
      },
      complete: ({ word, line, cursor }) => completeCommandLine({
        word, line, cursor, cwd, files: files.keys(), dirs, bin: `${root}/node_modules/.bin/`,
        scripts: () => scriptsNow().scripts.map((script) => script.name),
      }),
    });
    terminal.onExit(() => {
      shells.delete(terminal);
      host.closeSession(session);
    });
    const { resize } = terminal;
    terminal.resize = (nextCols, nextRows) => {
      resize(nextCols, nextRows);
      host.resizeSession(session, nextCols, nextRows);
    };
    shells.add(terminal);
    warnIfExposed();
    return terminal;
  };

  /** One command with a terminal to itself: no prompt, and it exits with the command. */
  const openCommand = (command: string, { cols, rows }: RuntimeTerminalOptions): RuntimeTerminal => {
    const session = newSession(cols, rows);
    const stream = createTerminalStream();
    stream.emit(`\x1b[2m$ ${command}\x1b[0m\r\n`);
    busy += 1;
    statusChanged();
    let reading = false;
    const run = host.run(session, command, (data) => stream.emit(toTerminalNewlines(data)), (now) => { reading = now; });
    void run.done.then((result) => {
      busy -= 1;
      statusChanged();
      stream.emit(toTerminalNewlines(noticeOf(result)));
      host.closeSession(session);
      stream.exit(result.exitCode);
    });
    return {
      write(data) {
        if (data.includes('\x03')) run.abort();
        else if (reading) host.input(session, data);
      },
      resize: (nextCols, nextRows) => host.resizeSession(session, nextCols, nextRows),
      kill: () => run.abort(),
      onOutput: stream.onOutput,
      onExit: stream.onExit,
    };
  };

  /* ── Scripts ── */

  const scriptsNow = (): RuntimeScriptList => {
    const text = files.get(manifest);
    if (typeof text !== 'string') return { scripts: [], note: 'There is no package.json.' };
    try {
      const { scripts = {} } = JSON.parse(text) as { scripts?: Record<string, unknown> };
      const list = Object.entries(scripts).flatMap(([name, command]) => (typeof command === 'string' ? [{ name, command }] : []));
      return list.length ? { scripts: list } : { scripts: [], note: 'package.json has no scripts.' };
    } catch {
      return { scripts: [], note: "package.json doesn't parse." };
    }
  };

  return {
    start: () => host.start(),
    dispose() {
      for (const terminal of [...shells]) terminal.kill();
      host.dispose();
    },
    files: {
      root,
      async list() {
        const entries: RuntimeEntry[] = [...dirs].filter((path) => path !== root && path.startsWith(`${root}/`)).map((path) => ({ path, kind: 'directory' }));
        for (const path of files.keys()) if (path.startsWith(`${root}/`)) entries.push({ path, kind: 'file' });
        return entries;
      },
      async read(path) {
        const data = files.get(path);
        if (data === undefined) throw new Error(`No such file: ${path}`);
        return data;
      },
      async write(path, content: FileContent) {
        files.set(path, content);
        for (const dir of ancestors(path)) dirs.add(dir);
        host.write(path, content);
        if (path === manifest) for (const listener of scriptWatchers) listener();
      },
      async mkdir(path) {
        dirs.add(path);
        for (const dir of ancestors(path)) dirs.add(dir);
        host.mkdir(path);
      },
      async rename(from, to) {
        const move = (path: string) => to + path.slice(from.length);
        const inside = (path: string) => path === from || path.startsWith(`${from}/`);
        for (const [path, data] of [...files]) {
          if (!inside(path)) continue;
          files.delete(path);
          files.set(move(path), data);
        }
        for (const dir of [...dirs]) {
          if (!inside(dir)) continue;
          dirs.delete(dir);
          dirs.add(move(dir));
        }
        for (const dir of ancestors(to)) dirs.add(dir);
        host.rename(from, to);
        if (from === manifest || to === manifest) for (const listener of scriptWatchers) listener();
      },
      async delete(path) {
        for (const file of [...files.keys()]) if (file === path || file.startsWith(`${path}/`)) files.delete(file);
        for (const dir of [...dirs]) if (dir === path || dir.startsWith(`${path}/`)) dirs.delete(dir);
        host.remove(path);
        if (path === manifest) for (const listener of scriptWatchers) listener();
      },
      watch(listener) {
        fileWatchers.add(listener);
        return () => { fileWatchers.delete(listener); };
      },
    },
    terminals: {
      async open(terminal) {
        return terminal.command ? openCommand(terminal.command, terminal) : openShell(terminal);
      },
    },
    scripts: {
      list: async () => scriptsNow(),
      onChange(listener) {
        scriptWatchers.add(listener);
        return () => { scriptWatchers.delete(listener); };
      },
      async run(name, size) {
        return openCommand(npmScriptCommand(name), size);
      },
    },
    status: {
      get: statusNow,
      subscribe(listener) {
        statusWatchers.add(listener);
        return () => { statusWatchers.delete(listener); };
      },
    },
  };
}
